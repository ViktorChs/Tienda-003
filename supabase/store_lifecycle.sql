-- ============================================================
--  CICLO DE VIDA DE TIENDA + GATE PUBLICO
--  Ejecutar DESPUES de schema.sql, multistore.sql y security.sql.
--  Idempotente.
--
--  - store_is_open(): activo en stores + interruptor settings.store.open
--  - store_public_status(): estado publico para el gate de la tienda
--  - RLS: si la tienda esta cerrada, anon no puede leer su catalogo
--  - create_order: rechaza pedidos con la tienda cerrada
--  - create_store(): clona configuracion/temas/nav/armador de otra tienda
-- ============================================================

-- 1) Helper: tienda visible/abierta para el publico
create or replace function public.store_is_open(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
      from public.stores st
      left join public.settings se on se.store_id = st.id
     where st.id = p_store
       and st.active
       and coalesce((se.data #>> '{store,open}')::boolean, true)
  );
$$;

grant execute on function public.store_is_open(bigint) to anon, authenticated, service_role;

-- 2) Estado publico (para el overlay de tienda cerrada)
create or replace function public.store_public_status(p_store_id bigint)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'id', st.id,
    'slug', st.slug,
    'name', st.name,
    'active', st.active,
    'open', public.store_is_open(st.id),
    'message', coalesce(se.data #>> '{store,closedMessage}', 'La tienda esta cerrada en este momento')
  )
  from public.stores st
  left join public.settings se on se.store_id = st.id
  where st.id = p_store_id;
$$;

grant execute on function public.store_public_status(bigint) to anon, authenticated, service_role;

-- 3) RLS: lectura publica solo si la tienda esta abierta.
--    El admin autenticado de esa tienda siempre puede leer.
drop policy if exists "public read settings"      on public.settings;
drop policy if exists "public read categories"    on public.categories;
drop policy if exists "public read subcategories" on public.subcategories;
drop policy if exists "public read products"      on public.products;
drop policy if exists "public read combo_items"   on public.combo_items;
drop policy if exists "public read nav_groups"    on public.nav_groups;
drop policy if exists "public read nav_items"     on public.nav_items;
drop policy if exists "public read builder_slots" on public.builder_slots;
drop policy if exists "public read builder_parts" on public.builder_parts;
drop policy if exists "public read themes"        on public.themes;

create policy "public read settings" on public.settings for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

create policy "public read categories" on public.categories for select
  using ((hidden = false and public.store_is_open(store_id)) or public.is_admin_of(store_id));

create policy "public read subcategories" on public.subcategories for select
  using ((hidden = false and public.store_is_open(store_id)) or public.is_admin_of(store_id));

create policy "public read products" on public.products for select
  using ((hidden = false and public.store_is_open(store_id)) or public.is_admin_of(store_id));

create policy "public read combo_items" on public.combo_items for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

create policy "public read nav_groups" on public.nav_groups for select
  using ((hidden = false and public.store_is_open(store_id)) or public.is_admin_of(store_id));

create policy "public read nav_items" on public.nav_items for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

create policy "public read builder_slots" on public.builder_slots for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

create policy "public read builder_parts" on public.builder_parts for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

create policy "public read themes" on public.themes for select
  using (public.store_is_open(store_id) or public.is_admin_of(store_id));

-- 4) create_order: rechaza pedidos si esta cerrada o suspendida
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
  if p_store_id is null or p_store_id <= 0
     or not exists (select 1 from public.stores where id = p_store_id) then
    raise exception 'Tienda no valida';
  end if;

  if not public.store_is_open(p_store_id) then
    raise exception 'La tienda esta cerrada';
  end if;

  if coalesce(btrim(coalesce(p_name, '')), '') = '' then
    raise exception 'Nombre obligatorio';
  end if;
  if length(p_name) > 120 then raise exception 'Nombre demasiado largo'; end if;
  if length(coalesce(p_phone, '')) > 40 then raise exception 'Telefono demasiado largo'; end if;
  if length(coalesce(p_location, '')) > 200 then raise exception 'Ubicacion demasiada larga'; end if;
  if length(coalesce(p_payment_method, '')) > 60 then raise exception 'Metodo de pago muy largo'; end if;
  if length(coalesce(p_note, '')) > 1000 then raise exception 'Nota demasiado larga'; end if;

  if p_total is null or p_total < 0 or p_total > 10000000 then
    raise exception 'Total no valido';
  end if;

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

-- 5) Crear tienda clonando configuracion, temas, navegacion y armador.
--    No copia productos/categorias (cada tienda arranca vacia).
create or replace function public.create_store(
  p_slug   text,
  p_name   text,
  p_source bigint default 1
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_slot record;
  v_new_slot bigint;
  v_group record;
  v_new_group bigint;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{1,40}$' then
    raise exception 'Slug no valido';
  end if;
  if p_name is null or btrim(p_name) = '' or length(p_name) > 80 then
    raise exception 'Nombre no valido';
  end if;

  -- SQL Editor (sin auth.uid) puede crear; un usuario debe ser owner de la tienda origen.
  if auth.uid() is not null and not public.is_owner_of(p_source) then
    raise exception 'Solo el propietario puede crear tiendas';
  end if;

  if exists (select 1 from public.stores where slug = p_slug) then
    raise exception 'Ya existe una tienda con ese slug';
  end if;

  insert into public.stores (slug, name) values (p_slug, btrim(p_name))
  returning id into v_id;

  -- settings: copia la configuracion y fuerza nombre + abierta
  insert into public.settings (store_id, data)
  select v_id,
         jsonb_set(
           jsonb_set(coalesce(data, '{}'::jsonb), '{store,name}', to_jsonb(btrim(p_name)), true),
           '{store,open}', 'true'::jsonb, true
         )
    from public.settings where store_id = p_source;

  if not found then
    insert into public.settings (store_id, data)
    values (v_id, jsonb_build_object(
      'store', jsonb_build_object(
        'name', btrim(p_name), 'open', true,
        'closedMessage', 'La tienda esta cerrada en este momento'
      )
    ));
  end if;

  -- temas
  insert into public.themes (store_id, key, label, colors, decorations, is_active)
  select v_id, key, label, colors, decorations, is_active
    from public.themes where store_id = p_source;

  -- navegacion
  for v_group in select * from public.nav_groups where store_id = p_source order by position, id loop
    insert into public.nav_groups (store_id, name, icon, position, hidden)
    values (v_id, v_group.name, v_group.icon, v_group.position, v_group.hidden)
    returning id into v_new_group;
    insert into public.nav_items (store_id, group_id, name, position)
    select v_id, v_new_group, name, position from public.nav_items where group_id = v_group.id order by position, id;
  end loop;

  -- armador: slots + piezas con remapeo de ids
  for v_slot in select * from public.builder_slots where store_id = p_source order by position, id loop
    insert into public.builder_slots (store_id, key, name, label, icon, position)
    values (v_id, v_slot.key, v_slot.name, v_slot.label, v_slot.icon, v_slot.position)
    returning id into v_new_slot;
    insert into public.builder_parts (store_id, slot_id, name, short, price, image, position)
    select v_id, v_new_slot, name, short, price, image, position
      from public.builder_parts where slot_id = v_slot.id order by position, id;
  end loop;

  return v_id;
end;
$$;

grant execute on function public.create_store(text,text,bigint) to authenticated, service_role;

-- 6) Semilla idempotente de Tienda 002 y 003 (vacias, configuradas)
do $$
begin
  if not exists (select 1 from public.stores where slug = 'tienda-002') then
    perform public.create_store('tienda-002', 'Tienda 002', 1);
  end if;
  if not exists (select 1 from public.stores where slug = 'tienda-003') then
    perform public.create_store('tienda-003', 'Tienda 003', 1);
  end if;
end $$;

-- 7) Verificacion
select st.id, st.slug, st.name, st.active,
       public.store_is_open(st.id) as open,
       (select name from public.admins a where a.store_id = st.id order by a.created_at limit 1) as primer_admin
  from public.stores st
 order by st.id;
