-- ============================================================
--  PRUEBA DE AISLAMIENTO MULTI-TIENDA  (crear datos de prueba)
-- ============================================================
--  Ejecutar en Supabase -> SQL Editor.
--  Crea una 2da tienda ("tienda-test") con 1 categoria, 1 producto
--  y 1 tema, para comprobar que NO se afectan entre tiendas.
--  Al terminar la prueba: correr multistore_test_cleanup.sql
-- ============================================================

insert into public.stores (slug, name)
values ('tienda-test', 'Tienda Test')
on conflict (slug) do nothing;

with s as (select id from public.stores where slug = 'tienda-test')
insert into public.categories (store_id, name, slug, position)
select s.id, 'Cat Test', 'cat-test', 0 from s
where not exists (
  select 1 from public.categories c
  join public.stores st on st.id = c.store_id
  where st.slug = 'tienda-test'
);

with s as (select id from public.stores where slug = 'tienda-test'),
     c as (select id from public.categories where slug = 'cat-test')
insert into public.products (store_id, category_id, name, price, type, image)
select s.id, c.id, 'Producto Test 2', 9.99, 'product', 'assets/img/products/p-1.webp'
from s, c
where not exists (
  select 1 from public.products p
  join public.stores st on st.id = p.store_id
  where st.slug = 'tienda-test'
);

with s as (select id from public.stores where slug = 'tienda-test')
insert into public.themes (store_id, key, label, colors, decorations, is_active)
select s.id, 'default', 'Tema Test 2', '{"brand":"#123456"}'::jsonb, '{}'::jsonb, true from s
on conflict (store_id, key) do nothing;

-- Devuelve el id de la tienda de prueba (para las comprobaciones)
select id as tienda_test_id from public.stores where slug = 'tienda-test';
