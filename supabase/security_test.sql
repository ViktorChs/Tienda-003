-- ============================================================
-- FASE H - PRUEBAS DE SEGURIDAD (SQL Editor)
-- Ejecutar DESPUES de security.sql.
-- Salida: avisos "PASS ..." / "FAIL ..." / "SKIP ...".
-- Todos deben dar PASS (o SKIP donde se indique).
-- ============================================================

-- ------------------------------------------------------------
-- T1: anon NO ve productos ocultos
-- ------------------------------------------------------------
do $$
declare n int;
begin
  set local role anon;
  select count(*) into n from public.products where hidden;
  reset role;
  if n = 0 then
    raise notice 'PASS T1: anon no ve productos ocultos';
  else
    raise notice 'FAIL T1: anon vio % ocultos', n;
  end if;
end $$;

-- ------------------------------------------------------------
-- T2: anon NO puede escribir nada (products/settings/admins/orders)
-- ------------------------------------------------------------
do $$
begin
  set local role anon;
  begin
    insert into public.products (name, store_id) values ('hack', 1);
    raise notice 'FAIL T2a: anon inserto products';
  exception when others then
    raise notice 'PASS T2a: %', sqlerrm;
  end;
  begin
    insert into public.settings (store_id, data) values (1, '{}'::jsonb);
    raise notice 'FAIL T2b: anon inserto settings';
  exception when others then
    raise notice 'PASS T2b: %', sqlerrm;
  end;
  begin
    insert into public.admins (id, name, role) values (gen_random_uuid(), 'hack', 'owner');
    raise notice 'FAIL T2c: anon inserto admins';
  exception when others then
    raise notice 'PASS T2c: %', sqlerrm;
  end;
  begin
    insert into public.orders (name, total, store_id) values ('hack', 0, 1);
    raise notice 'FAIL T2d: anon inserto orders directo';
  exception when others then
    raise notice 'PASS T2d: %', sqlerrm;
  end;
  reset role;
end $$;

-- ------------------------------------------------------------
-- T3: anon NO lee pedidos ni actividad
-- ------------------------------------------------------------
do $$
declare n1 int; n2 int;
begin
  set local role anon;
  select count(*) into n1 from public.orders;
  select count(*) into n2 from public.activity_log;
  reset role;
  if n1 = 0 and n2 = 0 then
    raise notice 'PASS T3: anon lee 0 pedidos y 0 actividades';
  else
    raise notice 'FAIL T3: anon vio % pedidos y % actividades', n1, n2;
  end if;
end $$;

-- ------------------------------------------------------------
-- T4: settings ya no expone el log de actividad
-- ------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from public.settings where data ? 'activity';
  if n = 0 then
    raise notice 'PASS T4: settings sin data.activity';
  else
    raise notice 'FAIL T4: % settings todavia con data.activity', n;
  end if;
end $$;

-- ------------------------------------------------------------
-- T5: create_order valida total, items y tienda
-- ------------------------------------------------------------
do $$
begin
  -- total negativo
  begin
    perform public.create_order('Test', '1', 'X', 'Efectivo', '', '[{"name":"a","qty":1,"price":1}]'::jsonb, -5, 1);
    raise notice 'FAIL T5a: acepto total negativo';
  exception when others then
    if sqlerrm = 'Total no valido' then
      raise notice 'PASS T5a: total negativo rechazado';
    else
      raise notice 'FAIL T5a: error inesperado: %', sqlerrm;
    end if;
  end;
  -- tienda inexistente
  begin
    perform public.create_order('Test', '1', 'X', 'Efectivo', '', '[{"name":"a","qty":1,"price":1}]'::jsonb, 1, 99999);
    raise notice 'FAIL T5b: acepto tienda inexistente';
  exception when others then
    if sqlerrm = 'Tienda no valida' then
      raise notice 'PASS T5b: tienda inexistente rechazada';
    else
      raise notice 'FAIL T5b: error inesperado: %', sqlerrm;
    end if;
  end;
  -- item sin precio / qty invalida
  begin
    perform public.create_order('Test', '1', 'X', 'Efectivo', '', '[{"name":"a","qty":0,"price":1}]'::jsonb, 1, 1);
    raise notice 'FAIL T5c: acepto qty 0';
  exception when others then
    if sqlerrm = 'Cantidad no valida' then
      raise notice 'PASS T5c: qty 0 rechazada';
    else
      raise notice 'FAIL T5c: error inesperado: %', sqlerrm;
    end if;
  end;
  -- 101 items
  begin
    perform public.create_order('Test', '1', 'X', 'Efectivo', '',
      (select jsonb_agg(jsonb_build_object('name','a','qty',1,'price',1)) from generate_series(1,101))::jsonb, 1, 1);
    raise notice 'FAIL T5d: acepto 101 items';
  exception when others then
    if sqlerrm = 'Items no validos' then
      raise notice 'PASS T5d: 101 items rechazados';
    else
      raise notice 'FAIL T5d: error inesperado: %', sqlerrm;
    end if;
  end;
end $$;

-- ------------------------------------------------------------
-- T6: rate limit por telefono (5 cada 10 min) - como anon
-- ------------------------------------------------------------
do $$
declare i int; ok int := 0; err text := '';
begin
  set local role anon;
  for i in 1..6 loop
    begin
      perform public.create_order('RATE TEST', '+5550001112', 'X', 'Efectivo', '',
        '[{"name":"prueba","qty":1,"price":1}]'::jsonb, 1, 1);
      ok := ok + 1;
    exception when others then
      err := sqlerrm;
      exit;
    end;
  end loop;
  reset role;
  delete from public.orders where phone = '+5550001112' and name = 'RATE TEST';
  if ok = 5 and err = 'Demasiados pedidos con este telefono' then
    raise notice 'PASS T6: 6to pedido en 10 min bloqueado (%)', err;
  else
    raise notice 'FAIL T6: % aceptados, error=% (se esperaba 5 / rate limit)', ok, err;
  end if;
end $$;

-- ------------------------------------------------------------
-- T7: storage - anon no sube nada; authenticated solo
--      imagenes validas dentro de s{su tienda}
-- ------------------------------------------------------------
do $$
declare v_uid text;
begin
  select u.id::text into v_uid from auth.users u
   where lower(u.email) = 'admin@gigahertzstore.com';
  set local role anon;
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('images', 'anon-hack.exe', null);
    raise notice 'FAIL T7a: anon subio archivo';
  exception when others then
    if sqlerrm like '%row-level security%' then
      raise notice 'PASS T7a: anon bloqueado por RLS';
    else
      raise notice 'REVISAR T7a: error distinto a RLS: %', sqlerrm;
    end if;
  end;
  reset role;

  -- owner de la tienda 1: extension mala -> rechazada
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid, true);
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('images', 's1/catalog/mal.exe', null);
    raise notice 'FAIL T7b: subio .exe';
  exception when others then
    if sqlerrm like '%row-level security%' then
      raise notice 'PASS T7b: .exe rechazado por RLS';
    else
      raise notice 'REVISAR T7b: error distinto a RLS: %', sqlerrm;
    end if;
  end;
  -- ruta de OTRA tienda -> rechazada
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('images', 's2/catalog/x.webp', null);
    raise notice 'FAIL T7c: subio a la tienda 2';
  exception when others then
    if sqlerrm like '%row-level security%' then
      raise notice 'PASS T7c: ruta de otra tienda rechazada';
    else
      raise notice 'REVISAR T7c: error distinto a RLS: %', sqlerrm;
    end if;
  end;
  -- ruta valida -> aceptada (se limpia luego)
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('images', 's1/catalog/ok-test.webp', null);
    raise notice 'PASS T7d: ruta valida s1/... aceptada';
    delete from storage.objects where name = 's1/catalog/ok-test.webp';
  exception when others then
    raise notice 'FAIL T7d: ruta valida rechazada: %', sqlerrm;
  end;
  reset role;
end $$;

-- ------------------------------------------------------------
-- T8: editor NO se puede escalalar a owner
--      (se salta si todavia no existe ningun usuario editor)
-- ------------------------------------------------------------
do $$
declare ed uuid; cnt int;
begin
  select id into ed from public.admins where role = 'editor' and active limit 1;
  if ed is null then
    raise notice 'SKIP T8: no hay editor. Crea uno en Authentication > Users y vuelve a ejecutar.';
    return;
  end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', ed, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', ed::text, true);

  begin
    update public.admins set role = 'owner' where id = ed;
    update public.admins set role = 'editor' where id = ed;  -- revertir si llego a pasar
    raise notice 'FAIL T8: el editor se escalo a owner';
  exception when others then
    raise notice 'PASS T8: escalada bloqueada (%)', sqlerrm;
  end;

  -- el editor si debe poder editar su propio nombre
  begin
    update public.admins set name = name where id = ed;
    get diagnostics cnt = row_count;
    if cnt = 1 then
      raise notice 'PASS T8b: editor edita su propio perfil';
    else
      raise notice 'FAIL T8b: el editor no pudo editar su perfil';
    end if;
  exception when others then
    raise notice 'FAIL T8b: %', sqlerrm;
  end;

  reset role;
end $$;

-- ------------------------------------------------------------
-- T9: el owner si gestiona usuarios (rol funcional)
-- ------------------------------------------------------------
do $$
declare cnt int; v_uid text;
begin
  select u.id::text into v_uid from auth.users u
   where lower(u.email) = 'admin@gigahertzstore.com';
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid, true);
  select count(*) into cnt from public.admins;
  if cnt >= 1 then
    raise notice 'PASS T9: owner ve % usuarios', cnt;
  else
    raise notice 'FAIL T9: el owner no ve usuarios';
  end if;
  reset role;
end $$;

-- Limpieza extra de la simulacion de T7
delete from storage.objects where name = 's1/catalog/ok-test.webp';

notify pgrst, 'reload schema';
