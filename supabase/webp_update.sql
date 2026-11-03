-- ============================================================
--  webp_update.sql  -  Apunta las imagenes de la BD a los .webp
-- ============================================================
--  Ejecutar en:  Supabase -> SQL Editor -> New query -> Run
--
--  Contexto: products_seed.sql se corrio ANTES de generar los
--  .webp, asi que la BD tiene rutas .png/.avif. Este script las
--  cambia a .webp. Es SEGURO porque los originales se conservan.
--  Idempotente (se puede correr varias veces).
--
--  Solo toca rutas que empiezan por 'assets/img/'; deja intactas
--  las URLs externas (wikimedia/flickr).
-- ============================================================

-- products.image (texto)
update public.products
   set image = regexp_replace(image, '^(assets/img/.*)\.(png|avif|jpe?g)$', '\1.webp')
 where image ~ '^assets/img/.*\.(png|avif|jpe?g)$';

-- products.images (galeria jsonb)
update public.products
   set images = regexp_replace(images::text, '(assets/img/[^"]*)\.(png|avif|jpe?g)', '\1.webp', 'g')::jsonb
 where images::text ~ 'assets/img/.*\.(png|avif|jpe?g)';

-- products.meta (jsonb: extra_image, alt, etc.)
update public.products
   set meta = regexp_replace(meta::text, '(assets/img/[^"]*)\.(png|avif|jpe?g)', '\1.webp', 'g')::jsonb
 where meta::text ~ 'assets/img/.*\.(png|avif|jpe?g)';

-- builder_parts.image
update public.builder_parts
   set image = regexp_replace(image, '^(assets/img/.*)\.(png|avif|jpe?g)$', '\1.webp')
 where image ~ '^assets/img/.*\.(png|avif|jpe?g)$';

-- categories.image
update public.categories
   set image = regexp_replace(image, '^(assets/img/.*)\.(png|avif|jpe?g)$', '\1.webp')
 where image ~ '^assets/img/.*\.(png|avif|jpe?g)$';

-- settings.data (hero.logo, etc.)
update public.settings
   set data = regexp_replace(data::text, '(assets/img/[^"]*)\.(png|avif|jpe?g)', '\1.webp', 'g')::jsonb
 where data::text ~ 'assets/img/.*\.(png|avif|jpe?g)';

-- Verificacion: cuantas imagenes locales quedaron en .webp vs otras
select
  count(*) filter (where image like '%.webp')                        as en_webp,
  count(*) filter (where image ~ 'assets/img/.*\.(png|avif|jpe?g)$') as sin_convertir
from public.products
where image like 'assets/img/%';
