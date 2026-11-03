-- ============================================================
--  MANIAWORLD / GIGAHEARTZ  -  Esquema Supabase  (v2)
-- ============================================================
--  Ejecutar completo en:  Supabase -> SQL Editor -> New query -> Run
--
--  Disenado 100% a la medida del sitio (tienda de PC / hardware):
--    * Una sola tienda (NO multi-tienda).
--    * Productos con badge, subtitulo, galeria y combos.
--    * Combos armados con PRODUCTOS REALES (tabla combo_items).
--    * Categorias / subcategorias (taxonomia real de las tarjetas).
--    * Navegacion (nav_groups / nav_items).
--    * Armador / "builder" (piezas de la PC a armar)  -> custom.html.
--    * Configuracion (hero, secciones, textos, tienda) como JSON.
--    * TEMAS / festivos (paletas editables, decoracion, fechas).
--    * Pedidos / cotizaciones.
--
--  SEGURIDAD: Supabase Auth (email + password).
--    - Lectura PUBLICA (el storefront solo lee).
--    - Escritura SOLO usuarios autenticados (authenticated).
--    - La tabla admins es el perfil (rol/estado) de cada auth user.
--
--  Descartado de WhatShop por no aplicar:
--    variantes color x talla, plantillas de tallas, multi-tienda,
--    splash, wizard, editor libre de tipografias.
-- ============================================================

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- ---------- Configuracion global (1 sola fila, id = 1) ----------
create table if not exists public.settings (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------- Admins (perfil de cada usuario de Supabase Auth) ----------
-- El password vive en Supabase Auth (auth.users). Aqui solo rol/estado.
create table if not exists public.admins (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  username    text unique,
  role        text not null default 'editor' check (role in ('owner','editor')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- Categorias (taxonomia de las tarjetas: data-cat) ----------
create table if not exists public.categories (
  id        bigserial primary key,
  name      text not null,
  slug      text,
  icon      text,
  image     text,
  color     text default '#7c3aed',
  position  int  not null default 0,
  hidden    boolean not null default false
);
create index if not exists categories_position_idx on public.categories (position);

-- ---------- Subcategorias (data-subcat) ----------
create table if not exists public.subcategories (
  id           bigserial primary key,
  category_id  bigint references public.categories(id) on delete cascade,
  name         text not null,
  position     int  not null default 0,
  hidden       boolean not null default false
);
create index if not exists subcategories_category_idx on public.subcategories (category_id);

-- ---------- Productos y combos ----------
create table if not exists public.products (
  id              bigserial primary key,
  category_id     bigint references public.categories(id) on delete set null,
  subcategory_id  bigint references public.subcategories(id) on delete set null,
  name            text not null,
  sub             text default '',              -- subtitulo de la tarjeta (product-sub)
  description     text default '',
  price           numeric not null default 0,
  original_price  numeric,                       -- precio tachado (oferta)
  badge           text,                          -- Top Ventas / Destacado / Nuevo / Oferta / Popular
  type            text not null default 'product' check (type in ('product','combo')),
  featured        boolean not null default false,
  hidden          boolean not null default false,
  position        int  not null default 0,
  image           text,                          -- imagen principal (o el case del combo)
  images          jsonb not null default '[]'::jsonb,  -- galeria ordenada
  includes        jsonb not null default '[]'::jsonb,  -- lineas de texto extra del combo
  meta            jsonb not null default '{}'::jsonb,  -- extras: cpu_line1/cpu_line2/tag/extra_image
  specs           jsonb not null default '[]'::jsonb,  -- filas {k,v} de "Especificaciones tecnicas" (vacio = seccion oculta)
  stock           int  default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists products_category_idx    on public.products (category_id);
create index if not exists products_subcategory_idx on public.products (subcategory_id);
create index if not exists products_position_idx    on public.products (position);

-- ---------- Combo = varios productos reales ----------
create table if not exists public.combo_items (
  id          bigserial primary key,
  combo_id    bigint not null references public.products(id) on delete cascade,
  product_id  bigint not null references public.products(id) on delete cascade,
  qty         int  not null default 1,
  position    int  not null default 0
);
create index if not exists combo_items_combo_idx   on public.combo_items (combo_id);
create index if not exists combo_items_product_idx on public.combo_items (product_id);

-- ---------- Grupos de navegacion (modal de categorias / dropdown nav) ----------
create table if not exists public.nav_groups (
  id        bigserial primary key,
  name      text not null,
  icon      text,                                -- svg <path>...</path> (se inyecta dentro de <svg>)
  position  int  not null default 0,
  hidden    boolean not null default false
);
create table if not exists public.nav_items (
  id        bigserial primary key,
  group_id  bigint not null references public.nav_groups(id) on delete cascade,
  name      text not null,
  position  int  not null default 0
);
create index if not exists nav_items_group_idx on public.nav_items (group_id);

-- ---------- Armador (custom.html): slots + piezas ----------
create table if not exists public.builder_slots (
  id        bigserial primary key,
  key       text not null unique,                -- case, cpu, mb, ram, gpu, psu, cooler
  name      text not null,
  label     text,
  icon      text,                                -- clave de icono del storefront
  position  int  not null default 0
);
create table if not exists public.builder_parts (
  id        bigserial primary key,
  slot_id   bigint not null references public.builder_slots(id) on delete cascade,
  name      text not null,
  short     text,
  price     numeric not null default 0,
  image     text,
  position  int  not null default 0
);
create index if not exists builder_parts_slot_idx on public.builder_parts (slot_id);

-- ---------- Temas / festivos (paletas editables) ----------
create table if not exists public.themes (
  id           bigserial primary key,
  key          text not null unique,             -- default | christmas | halloween
  label        text not null,
  colors       jsonb not null default '{}'::jsonb,       -- variables de color
  decorations  jsonb not null default '{}'::jsonb,       -- banner, snow, bats...
  is_active    boolean not null default false,           -- tema aplicado cuando no hay festivo
  created_at   timestamptz not null default now()
);

-- ---------- Pedidos / cotizaciones ----------
create table if not exists public.orders (
  id              bigserial primary key,
  order_number    bigint,
  name            text not null,
  phone           text,
  location        text,
  payment_method  text,
  note            text,
  items           jsonb not null default '[]'::jsonb,
  total           numeric not null default 0,
  status          text not null default 'nuevo',  -- nuevo / en_proceso / pagado / entregado / cancelado
  created_at      timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- Secuencia + RPC para crear pedido desde el cliente ----------
create sequence if not exists public.orders_seq;

create or replace function public.create_order(
  p_name           text,
  p_phone          text,
  p_location       text,
  p_payment_method text,
  p_note           text,
  p_items          jsonb,
  p_total          numeric
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
    (order_number, name, phone, location, payment_method, note, items, total, status)
  values
    (v_num, p_name, p_phone, p_location, p_payment_method, p_note, p_items, p_total, 'nuevo')
  returning * into v_row;
  return json_build_object('id', v_row.id, 'order_number', v_row.order_number);
end;
$$;

grant execute on function public.create_order(text,text,text,text,text,jsonb,numeric)
  to anon, authenticated, service_role;

-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
-- Storefront: lectura PUBLICA. Escritura: SOLO authenticated (Auth).

alter table public.settings      enable row level security;
alter table public.admins        enable row level security;
alter table public.categories    enable row level security;
alter table public.subcategories enable row level security;
alter table public.products      enable row level security;
alter table public.combo_items   enable row level security;
alter table public.nav_groups    enable row level security;
alter table public.nav_items     enable row level security;
alter table public.builder_slots enable row level security;
alter table public.builder_parts enable row level security;
alter table public.themes        enable row level security;
alter table public.orders        enable row level security;

-- Lectura publica (el sitio muestra el catalogo)
drop policy if exists "public read settings"       on public.settings;
create policy "public read settings"       on public.settings       for select using (true);
drop policy if exists "public read categories"     on public.categories;
create policy "public read categories"     on public.categories     for select using (true);
drop policy if exists "public read subcategories"  on public.subcategories;
create policy "public read subcategories"  on public.subcategories  for select using (true);
drop policy if exists "public read products"       on public.products;
create policy "public read products"       on public.products       for select using (true);
drop policy if exists "public read combo_items"    on public.combo_items;
create policy "public read combo_items"    on public.combo_items    for select using (true);
drop policy if exists "public read nav_groups"     on public.nav_groups;
create policy "public read nav_groups"     on public.nav_groups     for select using (true);
drop policy if exists "public read nav_items"      on public.nav_items;
create policy "public read nav_items"      on public.nav_items      for select using (true);
drop policy if exists "public read builder_slots"  on public.builder_slots;
create policy "public read builder_slots"  on public.builder_slots  for select using (true);
drop policy if exists "public read builder_parts"  on public.builder_parts;
create policy "public read builder_parts"  on public.builder_parts  for select using (true);
drop policy if exists "public read themes"         on public.themes;
create policy "public read themes"         on public.themes         for select using (true);

-- Escritura: SOLO usuarios autenticados (panel)
drop policy if exists "write settings"      on public.settings;
create policy "write settings"      on public.settings      for all to authenticated using (true) with check (true);
drop policy if exists "write categories"    on public.categories;
create policy "write categories"    on public.categories    for all to authenticated using (true) with check (true);
drop policy if exists "write subcategories" on public.subcategories;
create policy "write subcategories" on public.subcategories for all to authenticated using (true) with check (true);
drop policy if exists "write products"      on public.products;
create policy "write products"      on public.products      for all to authenticated using (true) with check (true);
drop policy if exists "write combo_items"   on public.combo_items;
create policy "write combo_items"   on public.combo_items   for all to authenticated using (true) with check (true);
drop policy if exists "write nav_groups"    on public.nav_groups;
create policy "write nav_groups"    on public.nav_groups    for all to authenticated using (true) with check (true);
drop policy if exists "write nav_items"     on public.nav_items;
create policy "write nav_items"     on public.nav_items     for all to authenticated using (true) with check (true);
drop policy if exists "write builder_slots" on public.builder_slots;
create policy "write builder_slots" on public.builder_slots for all to authenticated using (true) with check (true);
drop policy if exists "write builder_parts" on public.builder_parts;
create policy "write builder_parts" on public.builder_parts for all to authenticated using (true) with check (true);
drop policy if exists "write themes"        on public.themes;
create policy "write themes"        on public.themes        for all to authenticated using (true) with check (true);

-- Admins: cada usuario autenticado lee/edita su propio perfil.
-- (El owner puede gestionar a todos desde el panel; se refuerza en la app.)
drop policy if exists "admin read self"  on public.admins;
create policy "admin read self"  on public.admins for select to authenticated using (true);
drop policy if exists "admin write self"  on public.admins;
create policy "admin write self"  on public.admins for all to authenticated using (true) with check (true);
drop policy if exists "read admins"  on public.admins;
create policy "read admins"  on public.admins for select to authenticated using (true);

-- Pedidos: el cliente inserta via RPC (security definer); el panel lee/actualiza.
drop policy if exists "read orders"  on public.orders;
create policy "read orders"  on public.orders for select to authenticated using (true);
drop policy if exists "write orders" on public.orders;
create policy "write orders" on public.orders for all to authenticated using (true) with check (true);

-- ============================================================
-- 3. STORAGE (bucket publico "images")
-- ============================================================
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects for select using (bucket_id = 'images');
drop policy if exists "images auth insert" on storage.objects;
create policy "images auth insert" on storage.objects for insert to authenticated with check (bucket_id = 'images');
drop policy if exists "images auth update" on storage.objects;
create policy "images auth update" on storage.objects for update to authenticated using (bucket_id = 'images');
drop policy if exists "images auth delete" on storage.objects;
create policy "images auth delete" on storage.objects for delete to authenticated using (bucket_id = 'images');

-- ============================================================
-- 4. DATOS INICIALES (tomados del sitio actual)
-- ============================================================

-- ---------- settings ----------
insert into public.settings (id, data)
values (1, '{
  "store": {
    "name": "MANIAWORLD",
    "whatsapp": "",
    "phone": "+58 (212) 555-GIGA",
    "email": "soporte@gigahertzstore.com",
    "whatsappLabel": "+58 (424) 555-GIGA",
    "hours": "Lunes a sábado, 9:00 am - 6:00 pm",
    "address": "Zulia, Venezuela",
    "currency": "$",
    "currencyPosition": "before",
    "open": true,
    "closedMessage": "La tienda está cerrada en este momento",
    "paymentMethods": [
      "Pago Móvil",
      "Transferencia bancaria",
      "Zelle",
      "Tarjeta de crédito / débito",
      "Pago contra entrega"
    ],
    "messageTemplate": "*Cotización - {storeName}*\n\n*Nombre:* {name}\n*Ubicación:* {location}\n*Método de pago:* {paymentMethod}\n\n*Productos:*\n{items}\n\n*Total estimado:* {total}",
    "contactTemplate": "*Mensaje desde {storeName}*\n\n*Nombre:* {name}\n*Asunto:* {subject}\n*Mensaje:* {message}",
    "shareTemplate": "{name} — {sub} | {storeName}"
  },
  "hero": {
    "logo": "assets/img/logos/logo2.webp",
    "showLogo": true,
    "title": "",
    "subtitle": "",
    "buttonText": "",
    "buttonLink": ""
  },
  "sections": [
    { "key": "hero",           "label": "Portada / Hero",            "visible": true, "position": 0 },
    { "key": "combos",         "label": "Combos Mania",              "visible": true, "position": 1 },
    { "key": "lo-mas-vendido", "label": "Lo Más Vendido / Catálogo", "visible": true, "position": 2 },
    { "key": "categorias",     "label": "Categorías",                "visible": true, "position": 3 },
    { "key": "ubicacion",      "label": "Ubicación / Pie de página", "visible": true, "position": 4 }
  ],
  "texts": {
    "combos": {
      "badge": "Arma y ahorra",
      "title": "Combos Mania",
      "subtitle": "Equipos listos para jugar y trabajar. Elige el tuyo y llévalo completo."
    },
    "bestSellers": {
      "badge": "Tendencias del Mes",
      "title": "Lo Más Vendido & Catálogo Destacado",
      "subtitle": "Los equipos y componentes preferidos por nuestra comunidad en Zulia y toda Venezuela."
    }
  },
  "holiday": {
    "active": false,
    "mode": "none",
    "startDate": "",
    "endDate": "",
    "banner": { "enabled": false, "text": "", "link": "" },
    "decorations": { "snow": false, "bats": false }
  }
}'::jsonb)
on conflict (id) do nothing;

-- ---------- categorias (taxonomia real de las tarjetas) ----------
insert into public.categories (name, slug, color, position)
select * from (values
  ('Combos',       'combos',       '#7c3aed', 0),
  ('Componentes',  'componentes',  '#7c3aed', 1),
  ('Computadoras', 'computadoras', '#7c3aed', 2),
  ('Laptops',      'laptops',      '#7c3aed', 3),
  ('Periféricos',  'perifericos',  '#7c3aed', 4),
  ('Impresión',    'impresion',    '#7c3aed', 5)
) as v(name, slug, color, position)
where not exists (select 1 from public.categories);

-- ---------- temas / festivos ----------
insert into public.themes (key, label, colors, decorations, is_active)
select * from (values
  ('default', 'Tema por defecto',
   '{"brand":"#7c3aed","brandDark":"#6d28d9","brandLight":"#a78bfa","accent":"#a855f7","bg":"#ffffff","surface":"#f9fafb","text":"#111827","darkBg":"#0b0b12","darkSurface":"#141422","darkText":"#e5e7eb"}'::jsonb,
   '{}'::jsonb, true),
  ('christmas', 'Navidad',
   '{"brand":"#dc2626","brandDark":"#b91c1c","brandLight":"#f87171","accent":"#16a34a","bg":"#ffffff","surface":"#f0fdf4","text":"#111827","darkBg":"#0b1a0f","darkSurface":"#12291a","darkText":"#e5e7eb"}'::jsonb,
   '{"banner":false,"snow":true,"emoji":"🎄"}'::jsonb, false),
  ('halloween', 'Halloween',
   '{"brand":"#ea580c","brandDark":"#c2410c","brandLight":"#fb923c","accent":"#7c3aed","bg":"#ffffff","surface":"#fff7ed","text":"#111827","darkBg":"#120b1a","darkSurface":"#1e1330","darkText":"#e5e7eb"}'::jsonb,
   '{"banner":false,"bats":true,"emoji":"🎃"}'::jsonb, false)
) as v(key, label, colors, decorations, is_active)
where not exists (select 1 from public.themes);

-- ---------- grupos de navegacion (modal de categorias) ----------
insert into public.nav_groups (name, icon, position)
select * from (values
  ('Hardware y Componentes', '<path d="M4 4h16v16H4z"/><path d="M9 9h6v6H9z"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>', 0),
  ('Periféricos y Gaming', '<path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>', 1),
  ('Laptops, Computadoras y Pantallas', '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10H3V5z"/><path d="M2 17h20v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2z"/>', 2),
  ('Audio', '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>', 3),
  ('Oficina, Impresión y Estética', '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>', 4),
  ('Accesorios y Varios', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>', 5)
) as v(name, icon, position)
where not exists (select 1 from public.nav_groups);

-- items de cada grupo
insert into public.nav_items (group_id, name, position)
select g.id, x.name, x.pos
from (values
  ('Hardware y Componentes', 'Procesadores', 0),
  ('Hardware y Componentes', 'Tarjetas Madre AMD', 1),
  ('Hardware y Componentes', 'Tarjetas Madre Intel', 2),
  ('Hardware y Componentes', 'Tarjetas de Video', 3),
  ('Hardware y Componentes', 'Memorias Ram DDR3', 4),
  ('Hardware y Componentes', 'Memorias Ram DDR4', 5),
  ('Hardware y Componentes', 'Memorias Ram DDR5', 6),
  ('Hardware y Componentes', 'Memorias Ram Laptop', 7),
  ('Hardware y Componentes', 'SSD M.2', 8),
  ('Hardware y Componentes', 'SSD Sata', 9),
  ('Hardware y Componentes', 'Discos Externos', 10),
  ('Hardware y Componentes', 'Enclosure/Case externo', 11),
  ('Hardware y Componentes', 'Fuentes de Poder', 12),
  ('Hardware y Componentes', 'Enfriamiento', 13),
  ('Hardware y Componentes', 'Pastas Térmicas', 14),
  ('Hardware y Componentes', 'Thermal Pads', 15),
  ('Hardware y Componentes', 'Cases', 16),
  ('Hardware y Componentes', 'Equipos Repotenciados', 17),
  ('Periféricos y Gaming', 'Teclados', 0),
  ('Periféricos y Gaming', 'Mouses', 1),
  ('Periféricos y Gaming', 'Kit Teclado + Mouse', 2),
  ('Periféricos y Gaming', 'Mouse Pads', 3),
  ('Periféricos y Gaming', 'Keycaps', 4),
  ('Periféricos y Gaming', 'Audífonos', 5),
  ('Periféricos y Gaming', 'Micrófonos', 6),
  ('Periféricos y Gaming', 'Controles/Volantes', 7),
  ('Periféricos y Gaming', 'Sillas Gamer', 8),
  ('Periféricos y Gaming', 'Mesas/Escritorios Gamer', 9),
  ('Laptops, Computadoras y Pantallas', 'Laptops', 0),
  ('Laptops, Computadoras y Pantallas', 'Mini PC', 1),
  ('Laptops, Computadoras y Pantallas', 'Tablets', 2),
  ('Laptops, Computadoras y Pantallas', 'Tabletas Graficas', 3),
  ('Laptops, Computadoras y Pantallas', 'Monitores', 4),
  ('Laptops, Computadoras y Pantallas', 'Proyectores y Pantallas', 5),
  ('Audio', 'Audio', 0),
  ('Audio', 'Grabación y Podcast', 1),
  ('Audio', 'Webcam', 2),
  ('Oficina, Impresión y Estética', 'Impresoras', 0),
  ('Oficina, Impresión y Estética', 'Tintas y Toner', 1),
  ('Oficina, Impresión y Estética', 'Letreros Led y Lámparas', 2),
  ('Oficina, Impresión y Estética', 'Soportes', 3),
  ('Accesorios y Varios', 'Redes', 0),
  ('Accesorios y Varios', 'Router y Mesh', 1),
  ('Accesorios y Varios', 'Cargadores', 2),
  ('Accesorios y Varios', 'UPS / Respaldo Eléctrico', 3),
  ('Accesorios y Varios', 'Cables y Adaptadores', 4),
  ('Accesorios y Varios', 'Camaras de Seguridad', 5),
  ('Accesorios y Varios', 'Maletines y Bolsos', 6),
  ('Accesorios y Varios', 'Accesorios', 7),
  ('Accesorios y Varios', 'Gift Cards y Licencias', 8)
) as x(group_name, name, pos)
join public.nav_groups g on g.name = x.group_name
where not exists (select 1 from public.nav_items);

-- ---------- armador (builder): slots + piezas ----------
insert into public.builder_slots (key, name, label, icon, position)
select * from (values
  ('case',   'Gabinete',        'Gabinete',      'case',   0),
  ('cpu',    'Procesador',      'CPU',           'cpu',    1),
  ('mb',     'Tarjeta Madre',   'Placa madre',   'mb',     2),
  ('ram',    'Memoria RAM',     'RAM',           'ram',    3),
  ('gpu',    'Tarjeta de Video','GPU',           'gpu',    4),
  ('psu',    'Fuente de Poder', 'Fuente',        'psu',    5),
  ('cooler', 'Enfriamiento',    'Refrigeración', 'cooler', 6)
) as v(key, name, label, icon, position)
where not exists (select 1 from public.builder_slots);

insert into public.builder_parts (slot_id, name, short, price, image, position)
select s.id, x.name, x.short, x.price, x.image, x.pos
from (values
  ('case',   'Gabinete Lian Li O11 Dynamic EVO dual chamber', 'Lian Li O11 EVO',   169, 'assets/img/products/p-12.webp',  0),
  ('cpu',    'AMD Ryzen 7 7800X3D 8 núcleos AM5',             'Ryzen 7 7800X3D',   389, 'assets/img/products/p-2.webp',   0),
  ('cpu',    'Intel Core i7-14700K 20 núcleos LGA1700',        'Core i7-14700K',    409, 'assets/img/products/p-7.webp',   1),
  ('mb',     'ASUS ROG Strix Z790-A Gaming WiFi DDR5',         'Z790-A Strix',      329, 'assets/img/products/p-8.webp',   0),
  ('ram',    'Corsair Vengeance RGB 32GB DDR5 6000MHz',        '32GB DDR5 RGB',     119, 'assets/img/products/p-9.webp',  0),
  ('gpu',    'NVIDIA RTX 4070 Super 12GB GDDR6X',              'RTX 4070 Super',    799, 'assets/img/products/p-1.webp',   0),
  ('psu',    'Corsair RM850x 850W 80 Plus Gold',               'RM850x 850W',       139, 'assets/img/products/p-11.webp',  0),
  ('cooler', 'Refrigeración NZXT Kraken 360 RGB AIO',          'Kraken 360 RGB',    189, 'assets/img/products/p-13.webp', 0)
) as x(slot_key, name, short, price, image, pos)
join public.builder_slots s on s.key = x.slot_key
where not exists (select 1 from public.builder_parts);

-- ============================================================
-- 5. PERFIL DEL ADMIN (rol owner)
-- ============================================================
-- 1) Crea el usuario en:  Supabase -> Authentication -> Add user
--    email: admin@gigahertzstore.com   password: <tu-contrasena-segura>
-- 2) Ejecuta promote_owner.sql para enlazarlo como owner.
--    (o simplemente corre el insert de abajo con el email correcto)
-- ============================================================

insert into public.admins (id, name, username, role, active)
select u.id, 'Administrador', 'admin', 'owner', true
from auth.users u
where u.email = 'admin@gigahertzstore.com'
on conflict (id) do nothing;

-- ============================================================
--  NOTA: productos, combos (combo_items) y subcategorias se migran
--  desde el HTML actual con supabase/migrate.js -> products_seed.sql
-- ============================================================
