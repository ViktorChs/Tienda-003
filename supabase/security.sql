-- ============================================================
-- FASE H - SEGURIDAD (ejecutar en el SQL Editor de Supabase)
-- Orden: schema.sql -> multistore.sql -> ESTE ARCHIVO.
-- Idempotente (se puede re-ejecutar).
--
-- Basado en lo utilizable de OX1WhatShop (validacion estricta de
-- subidas: extension permitida + limite de tamano + nombre aleatorio)
-- + fixes propios: escalada de rol en admins, create_order abierto,
-- actividad publica en settings, storage sin aislamiento por tienda,
-- productos ocultos legibles por anon.
-- ============================================================

-- ============================================================
-- 0. PREVIO
-- ============================================================
-- is_admin_of se usa ahora en policies de SELECT publicas, que anon
-- tambien evalua. anon nunca coincide (auth.uid() es null -> false),
-- pero necesita el permiso EXECUTE para no romper la tienda.
grant execute on function public.is_admin_of(bigint) to anon;

-- Owner bootstrap: el admin principal pasa a 'owner' ANTES del trigger
-- (sin esto, el guard de abajo bloquearia cualquier promocion inicial).
-- Se busca por EMAIL (portable a cualquier proyecto / proyecto nuevo).
update public.admins a
   set role = 'owner'
  from auth.users u
 where a.id = u.id
   and a.store_id = 1
   and lower(u.email) = 'admin@gigahertzstore.com';

-- ============================================================
-- 1. is_owner_of: helper para acciones exclusivas del propietario
-- ============================================================
create or replace function public.is_owner_of(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.admins a
    where a.id = auth.uid() and a.active and a.role = 'owner' and a.store_id = p_store
  );
$$;

grant execute on function public.is_owner_of(bigint) to authenticated, service_role;

-- ============================================================
-- 2. admins: corta la escalada de privilegios
--    (antes: "admins write" usaba is_admin_of -> un editor podia
--     ponerse role='owner' en su propia fila)
-- ============================================================
create or replace function public.admins_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Consola SQL (postgres) y service_role no traen sub -> sin restriccion.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id <> auth.uid() and not public.is_owner_of(new.store_id) then
      raise exception 'admins: sin permiso para crear usuarios';
    end if;
    if new.role = 'owner' and not public.is_owner_of(new.store_id) then
      raise exception 'admins: solo el propietario puede crear propietarios';
    end if;
  else
    -- Cambiar rol, tienda o estado (activo/inactivo) solo lo hace el owner.
    if (old.role, old.store_id, old.active) is distinct from (new.role, new.store_id, new.active)
       and not public.is_owner_of(old.store_id) then
      raise exception 'admins: solo el propietario cambia rol/tienda/estado';
    end if;
    if new.role = 'owner' and not public.is_owner_of(new.store_id) then
      raise exception 'admins: solo el propietario puede dar rol owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists admins_guard_tg on public.admins;
create trigger admins_guard_tg
  before insert or update on public.admins
  for each row execute function public.admins_guard();

-- Policies: owner gestiona toda la tabla; el editor solo su propio
-- perfil (nombre/usuario) y NUNCA su rol (lo corta el trigger).
drop policy if exists "admins write"      on public.admins;
drop policy if exists "admins write owner" on public.admins;
drop policy if exists "admins update self" on public.admins;
create policy "admins write owner" on public.admins for all to authenticated
  using (public.is_owner_of(store_id)) with check (public.is_owner_of(store_id));
create policy "admins update self" on public.admins for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================
-- 3. stores: renombrar/configurar la tienda, solo owner
-- ============================================================
drop policy if exists "write stores" on public.stores;
create policy "write stores" on public.stores for all to authenticated
  using (public.is_owner_of(id)) with check (public.is_owner_of(id));

-- ============================================================
-- 4. Catalogo oculto: anon ya no ve filas con hidden = true
--    (antes el filtro era solo cliente; cualquier anon los bajaba)
-- ============================================================
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select
  using (hidden = false or public.is_admin_of(store_id));

drop policy if exists "public read subcategories" on public.subcategories;
create policy "public read subcategories" on public.subcategories for select
  using (hidden = false or public.is_admin_of(store_id));

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select
  using (hidden = false or public.is_admin_of(store_id));

drop policy if exists "public read nav_groups" on public.nav_groups;
create policy "public read nav_groups" on public.nav_groups for select
  using (hidden = false or public.is_admin_of(store_id));

-- ============================================================
-- 5. activity_log: el registro de actividad deja de vivir dentro de
--    settings.data (que era legible publicamente) y pasa a tabla
--    privada por tienda.
-- ============================================================
create table if not exists public.activity_log (
  id         bigserial primary key,
  store_id   bigint not null references public.stores(id) on delete cascade,
  user_id    uuid,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_store_idx
  on public.activity_log (store_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists "read activity"  on public.activity_log;
drop policy if exists "write activity" on public.activity_log;
create policy "read activity"  on public.activity_log for select to authenticated
  using (public.is_admin_of(store_id));
create policy "write activity" on public.activity_log for insert to authenticated
  with check (public.is_admin_of(store_id) and (user_id = auth.uid() or user_id is null));
create policy "delete activity" on public.activity_log for delete to authenticated
  using (public.is_owner_of(store_id));

-- Mantiene las ultimas 200 entradas por tienda (auto-limpieza en BD).
create or replace function public.activity_trim()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.activity_log
   where store_id = new.store_id
     and id not in (
       select id from public.activity_log
        where store_id = new.store_id
        order by created_at desc
        limit 200
     );
  return new;
end;
$$;

drop trigger if exists activity_trim_tg on public.activity_log;
create trigger activity_trim_tg
  after insert on public.activity_log
  for each row execute function public.activity_trim();

-- Migra lo que ya existia en settings.data.activity y lo limpia de ahi.
insert into public.activity_log (store_id, user_id, text, created_at)
select 1,
       null,
       coalesce(a.value ->> 'text', ''),
       coalesce(nullif(a.value ->> 'at', '')::timestamptz, now())
  from public.settings s,
       jsonb_array_elements(coalesce(s.data -> 'activity', '[]'::jsonb)) a
 where s.id = 1
   and s.data ? 'activity'
   and coalesce(a.value ->> 'text', '') <> ''
on conflict do nothing;

update public.settings
   set data = data - 'activity', updated_at = now()
 where data ? 'activity';

-- ============================================================
-- 6. create_order: valida todo lo que antes era libre para anon
--    (p_total arbitrario, items sin tope, tienda inexistente, spam)
-- ============================================================
create or replace function public.create_order(
  p_name           text,
  p_phone          text,
  p_location       text,
  p_payment_method text,
  p_note           text,
  p_items          jsonb,
  p_total          numeric,
  p_store_id       bigint default 1
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num     bigint;
  v_row     public.orders%rowtype;
  v_n       int;
  v_item    jsonb;
  v_recent  int;
begin
  -- Tienda
  if p_store_id is null or p_store_id <= 0
     or not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Tienda no valida';
  end if;

  -- Datos del cliente
  if coalesce(btrim(coalesce(p_name, '')), '') = '' then
    raise exception 'Nombre obligatorio';
  end if;
  if length(p_name) > 120 then raise exception 'Nombre demasiado largo'; end if;
  if length(coalesce(p_phone, '')) > 40 then raise exception 'Telefono demasiado largo'; end if;
  if length(coalesce(p_location, '')) > 200 then raise exception 'Ubicacion demasiada larga'; end if;
  if length(coalesce(p_payment_method, '')) > 60 then raise exception 'Metodo de pago muy largo'; end if;
  if length(coalesce(p_note, '')) > 1000 then raise exception 'Nota demasiado larga'; end if;

  -- Total
  if p_total is null or p_total < 0 or p_total > 10000000 then
    raise exception 'Total no valido';
  end if;

  -- Items
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items no validos';
  end if;
  v_n := jsonb_array_length(p_items);
  if v_n = 0 or v_n > 100 then
    raise exception 'Items no validos';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'name') <> 'text'
       or coalesce(length(v_item ->> 'name'), 0) < 1
       or length(v_item ->> 'name') > 200 then
      raise exception 'Items no validos';
    end if;
    if jsonb_typeof(v_item -> 'qty') <> 'number'
       or (case when jsonb_typeof(v_item -> 'qty') = 'number'
                then (v_item ->> 'qty')::numeric else 0 end) not between 1 and 999 then
      raise exception 'Cantidad no valida';
    end if;
    if jsonb_typeof(v_item -> 'price') <> 'number'
       or (case when jsonb_typeof(v_item -> 'price') = 'number'
                then (v_item ->> 'price')::numeric else -1 end) not between 0 and 1000000 then
      raise exception 'Precio no valido';
    end if;
  end loop;

  -- Rate limit (solo SQL, como se decidio): max 10 pedidos/min por tienda
  -- y max 5 cada 10 min con el mismo telefono.
  select count(*) into v_recent
    from public.orders
   where store_id = p_store_id
     and created_at > now() - interval '1 minute';
  if v_recent >= 10 then
    raise exception 'Demasiados pedidos, intentalo en unos minutos';
  end if;

  if coalesce(btrim(coalesce(p_phone, '')), '') <> '' then
    select count(*) into v_recent
      from public.orders
     where store_id = p_store_id
       and phone = p_phone
       and created_at > now() - interval '10 minutes';
    if v_recent >= 5 then
      raise exception 'Demasiados pedidos con este telefono';
    end if;
  end if;

  v_num := nextval('public.orders_seq');
  insert into public.orders
    (order_number, name, phone, location, payment_method, note, items, total, status, store_id)
  values
    (v_num, left(p_name, 120), left(coalesce(p_phone, ''), 40), left(coalesce(p_location, ''), 200),
     left(coalesce(p_payment_method, ''), 60), left(coalesce(p_note, ''), 1000),
     p_items, p_total, 'nuevo', p_store_id)
  returning * into v_row;

  return json_build_object('id', v_row.id, 'order_number', v_row.order_number, 'store_id', v_row.store_id);
end;
$$;

grant execute on function public.create_order(text,text,text,text,text,jsonb,numeric,bigint)
  to anon, authenticated, service_role;

-- ============================================================
-- 7. Storage "images": aislado por tienda + extension permitida
--    (antes cualquier authenticated podia borrar/sobrescribir
--     imagenes de otra tienda y subir cualquier archivo)
--    Ruta nueva: s{store_id}/... (la pone sb.js.upload)
--    Rutas viejas (catalog/...): solo admins de la tienda 1.
--    Limite de tamano (15 MB) ya lo aplica el cliente en sb.js.
-- ============================================================
drop policy if exists "images auth insert" on storage.objects;
create policy "images auth insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'images'
    and name ~* '\.(webp|png|jpe?g|gif|svg)$'
    and (
      (storage.foldername(name))[1] = 's' || public.current_admin_store()::text
      or (name !~ '^s[0-9]+/' and public.is_admin_of(1))
    )
  );

drop policy if exists "images auth update" on storage.objects;
create policy "images auth update" on storage.objects for update to authenticated
  using (
    bucket_id = 'images'
    and (
      (storage.foldername(name))[1] = 's' || public.current_admin_store()::text
      or (name !~ '^s[0-9]+/' and public.is_admin_of(1))
    )
  )
  with check (
    bucket_id = 'images'
    and name ~* '\.(webp|png|jpe?g|gif|svg)$'
    and (
      (storage.foldername(name))[1] = 's' || public.current_admin_store()::text
      or (name !~ '^s[0-9]+/' and public.is_admin_of(1))
    )
  );

drop policy if exists "images auth delete" on storage.objects;
create policy "images auth delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'images'
    and (
      (storage.foldername(name))[1] = 's' || public.current_admin_store()::text
      or (name !~ '^s[0-9]+/' and public.is_admin_of(1))
    )
  );

-- ============================================================
-- LISTO. Despues: ejecutar security_test.sql (todos los "esperado"
-- deben pasar) y probar el panel.
-- ============================================================
