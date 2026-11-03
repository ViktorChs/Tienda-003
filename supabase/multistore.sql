-- ============================================================
--  MULTI-TIENDA  (varias tiendas en la MISMA base de datos)
-- ============================================================
--  Ejecutar en:  Supabase -> SQL Editor -> New query -> Run
--  Es idempotente (se puede correr varias veces sin romper).
--
--  Que hace:
--    1. Crea la tabla stores.
--    2. Agrega store_id (default 1 = tienda actual MANIAWORLD) a todas
--       las tablas de catalogo/contenido/pedidos.
--    3. admins.store_id: a que tienda pertenece cada administrador.
--    4. RLS por tienda: un admin solo escribe/lee lo de SU tienda.
--    5. create_order ahora recibe p_store_id.
--
--  La tienda actual (todos los datos ya existentes) queda como store_id = 1.
--  Para sembrar otra tienda usa supabase/new_store_template.sql.
-- ============================================================

-- ============================================================
-- 1. TABLA STORES
-- ============================================================
create table if not exists public.stores (
  id          bigserial primary key,
  slug        text not null unique,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.stores (id, slug, name)
values (1, 'maniaworld', 'MANIAWORLD')
on conflict (id) do nothing;

select setval('public.stores_id_seq', greatest((select coalesce(max(id), 1) from public.stores), 1));

-- ============================================================
-- 2. COLUMNA store_id EN TABLAS DE TENANT
-- ============================================================
alter table public.settings      add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.categories    add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.subcategories add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.products      add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.combo_items   add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.nav_groups    add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.nav_items     add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.builder_slots add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.builder_parts add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.themes        add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;
alter table public.orders        add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;

alter table public.admins        add column if not exists store_id bigint not null default 1 references public.stores(id) on delete cascade;

create index if not exists categories_store_idx    on public.categories (store_id);
create index if not exists subcategories_store_idx on public.subcategories (store_id);
create index if not exists products_store_idx      on public.products (store_id);
create index if not exists nav_items_store_idx     on public.nav_items (store_id);
create index if not exists builder_parts_store_idx on public.builder_parts (store_id);
create index if not exists themes_store_idx        on public.themes (store_id);
create index if not exists orders_store_idx        on public.orders (store_id);

-- ---- settings: una fila por tienda ----
-- Quitamos el check(id = 1), damos secuencia al id y hacemos store_id unico.
alter table public.settings drop constraint if exists settings_id_check;
create sequence if not exists public.settings_id_seq;
alter table public.settings alter column id set default nextval('public.settings_id_seq');
select setval('public.settings_id_seq', greatest((select coalesce(max(id), 1) from public.settings), 1));
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'settings_store_id_key') then
    alter table public.settings add constraint settings_store_id_key unique (store_id);
  end if;
end $$;

-- ---- llaves unicas de builder_slots/themes que antes eran globales ----
-- (key debe ser unica POR tienda, no global)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'builder_slots_key_key') then
    alter table public.builder_slots drop constraint builder_slots_key_key;
  end if;
  if exists (select 1 from pg_constraint where conname = 'themes_key_key') then
    alter table public.themes drop constraint themes_key_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'builder_slots_store_key_key') then
    alter table public.builder_slots add constraint builder_slots_store_key_key unique (store_id, key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'themes_store_key_key') then
    alter table public.themes add constraint themes_store_key_key unique (store_id, key);
  end if;
end $$;

-- ---- admins.username unico por tienda ----
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'admins_username_key') then
    alter table public.admins drop constraint admins_username_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admins_store_username_key') then
    alter table public.admins add constraint admins_store_username_key unique (store_id, username);
  end if;
end $$;

-- ============================================================
-- 3. HELPERS DE AUTORIZACION
-- ============================================================
-- Devuelve la tienda del admin autenticado (o null).
create or replace function public.current_admin_store()
returns bigint
language sql stable security definer set search_path = public
as $$
  select store_id from public.admins where id = auth.uid() and active;
$$;

-- True si el usuario autenticado es admin activo de esa tienda.
create or replace function public.is_admin_of(p_store bigint)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.admins a
    where a.id = auth.uid() and a.active and a.store_id = p_store
  );
$$;

grant execute on function public.current_admin_store()     to authenticated, service_role;
grant execute on function public.is_admin_of(bigint)        to authenticated, service_role;

-- ============================================================
-- 4. RLS POR TIENDA
-- ============================================================
alter table public.stores enable row level security;

-- stores: lectura publica (para resolver slug/nombre), sin escritura desde el cliente.
drop policy if exists "public read stores" on public.stores;
create policy "public read stores" on public.stores for select using (true);

-- ---- Lectura publica del catalogo: se mantiene (el sitio solo lee) ----
-- (las policies existentes de select siguen vigentes; no se tocan)

-- ---- Escritura: SOLO el admin de ESA tienda ----
drop policy if exists "write settings"      on public.settings;
create policy "write settings"      on public.settings      for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write categories"    on public.categories;
create policy "write categories"    on public.categories    for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write subcategories" on public.subcategories;
create policy "write subcategories" on public.subcategories for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write products"      on public.products;
create policy "write products"      on public.products      for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write combo_items"   on public.combo_items;
create policy "write combo_items"   on public.combo_items   for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write nav_groups"    on public.nav_groups;
create policy "write nav_groups"    on public.nav_groups    for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write nav_items"     on public.nav_items;
create policy "write nav_items"     on public.nav_items     for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write builder_slots" on public.builder_slots;
create policy "write builder_slots" on public.builder_slots for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write builder_parts" on public.builder_parts;
create policy "write builder_parts" on public.builder_parts for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write themes"        on public.themes;
create policy "write themes"        on public.themes        for all to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));
drop policy if exists "write stores"        on public.stores;
create policy "write stores"        on public.stores        for all to authenticated using (public.is_admin_of(id)) with check (public.is_admin_of(id));

-- ---- Admins: leer los de mi tienda + mi propio perfil; escribir los de mi tienda ----
drop policy if exists "admin read self" on public.admins;
drop policy if exists "read admins"     on public.admins;
drop policy if exists "admin write self" on public.admins;
drop policy if exists "admins read"     on public.admins;
drop policy if exists "admins write"    on public.admins;
create policy "admins read"  on public.admins for select to authenticated using (id = auth.uid() or public.is_admin_of(store_id));
create policy "admins write" on public.admins for all    to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));

-- ---- Pedidos: solo mi tienda ----
drop policy if exists "read orders"  on public.orders;
drop policy if exists "write orders" on public.orders;
create policy "read orders"  on public.orders for select to authenticated using (public.is_admin_of(store_id));
create policy "write orders" on public.orders for all    to authenticated using (public.is_admin_of(store_id)) with check (public.is_admin_of(store_id));

-- ============================================================
-- 5. create_order CON store_id
-- ============================================================
drop function if exists public.create_order(text,text,text,text,text,jsonb,numeric);

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
  v_num bigint;
  v_row public.orders%rowtype;
begin
  v_num := nextval('public.orders_seq');
  insert into public.orders
    (order_number, name, phone, location, payment_method, note, items, total, status, store_id)
  values
    (v_num, p_name, p_phone, p_location, p_payment_method, p_note, p_items, p_total, 'nuevo', p_store_id)
  returning * into v_row;
  return json_build_object('id', v_row.id, 'order_number', v_row.order_number, 'store_id', v_row.store_id);
end;
$$;

grant execute on function public.create_order(text,text,text,text,text,jsonb,numeric,bigint)
  to anon, authenticated, service_role;

-- ============================================================
--  LISTO. Tienda actual = store_id 1.
--  Siguiente (opcional): sembrar otra tienda -> new_store_template.sql
-- ============================================================
