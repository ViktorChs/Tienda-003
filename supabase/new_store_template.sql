-- ============================================================
--  PLANTILLA: crear una tienda nueva (mismo base de datos)
-- ============================================================
--  Requiere haber corrido antes:  supabase/multistore.sql
--  Edita el slug y el nombre y ejecuta en el SQL Editor.
--
--  Crea: la tienda + su fila de settings + los 3 temas + los
--  7 slots del armador. Luego, desde el panel de ESA tienda,
--  agrega categorias/productos/navegacion.
--
--  Admin de la tienda nueva:
--    1) Crea el usuario en Supabase -> Authentication -> Add user.
--    2) insert into public.admins (id, name, role, active, store_id)
--         select u.id, 'Admin Mi Tienda', 'owner', true, <ID_TIENDA>
--         from auth.users u where u.email = 'admin@mitienda.com';
-- ============================================================

do $$
declare
  v_store bigint;
begin
  -- 1) Tienda
  insert into public.stores (slug, name)
  values ('mitienda', 'Mi Tienda')
  returning id into v_store;

  raise notice 'Tienda creada con id = %', v_store;

  -- 2) Configuracion por defecto (minima; se completa en el panel)
  insert into public.settings (store_id, data)
  values (v_store, '{
    "store": {
      "name": "Mi Tienda",
      "whatsapp": "",
      "phone": "",
      "email": "",
      "whatsappLabel": "",
      "hours": "Lunes a sábado, 9:00 am - 6:00 pm",
      "address": "Venezuela",
      "currency": "$",
      "currencyPosition": "before",
      "open": true,
      "closedMessage": "La tienda está cerrada en este momento",
      "paymentMethods": ["Pago Móvil", "Transferencia bancaria", "Zelle"],
      "messageTemplate": "*Cotización - {storeName}*\n\n*Nombre:* {name}\n*Ubicación:* {location}\n*Método de pago:* {paymentMethod}\n\n*Productos:*\n{items}\n\n*Total estimado:* {total}",
      "contactTemplate": "*Mensaje desde {storeName}*\n\n*Nombre:* {name}\n*Asunto:* {subject}\n*Mensaje:* {message}",
      "shareTemplate": "{name} — {sub} | {storeName}"
    },
    "hero": { "logo": "", "showLogo": true, "title": "", "subtitle": "", "buttonText": "", "buttonLink": "" },
    "sections": [
      { "key": "hero",           "label": "Portada / Hero",            "visible": true, "position": 0 },
      { "key": "combos",         "label": "Combos",                    "visible": true, "position": 1 },
      { "key": "lo-mas-vendido", "label": "Lo Más Vendido / Catálogo", "visible": true, "position": 2 },
      { "key": "categorias",     "label": "Categorías",                "visible": true, "position": 3 },
      { "key": "ubicacion",      "label": "Ubicación / Pie de página", "visible": true, "position": 4 }
    ],
    "texts": {
      "combos": { "badge": "Arma y ahorra", "title": "Combos", "subtitle": "" },
      "bestSellers": { "badge": "Tendencias", "title": "Lo Más Vendido", "subtitle": "" }
    },
    "holiday": { "active": false, "mode": "none", "startDate": "", "endDate": "",
      "banner": { "enabled": false, "text": "", "link": "" },
      "decorations": { "snow": false, "bats": false } }
  }'::jsonb);

  -- 3) Temas
  insert into public.themes (store_id, key, label, colors, decorations, is_active) values
    (v_store, 'default', 'Tema por defecto',
     '{"brand":"#7c3aed","brandDark":"#6d28d9","brandLight":"#a78bfa","accent":"#a855f7","bg":"#ffffff","surface":"#f9fafb","text":"#111827","darkBg":"#0b0b12","darkSurface":"#141422","darkText":"#e5e7eb"}'::jsonb,
     '{}'::jsonb, true),
    (v_store, 'christmas', 'Navidad',
     '{"brand":"#dc2626","brandDark":"#b91c1c","brandLight":"#f87171","accent":"#16a34a","bg":"#ffffff","surface":"#f0fdf4","text":"#111827","darkBg":"#0b1a0f","darkSurface":"#12291a","darkText":"#e5e7eb"}'::jsonb,
     '{"banner":false,"snow":true,"emoji":"🎄"}'::jsonb, false),
    (v_store, 'halloween', 'Halloween',
     '{"brand":"#ea580c","brandDark":"#c2410c","brandLight":"#fb923c","accent":"#7c3aed","bg":"#ffffff","surface":"#fff7ed","text":"#111827","darkBg":"#120b1a","darkSurface":"#1e1330","darkText":"#e5e7eb"}'::jsonb,
     '{"banner":false,"bats":true,"emoji":"🎃"}'::jsonb, false);

  -- 4) Slots del armador
  insert into public.builder_slots (store_id, key, name, label, icon, position) values
    (v_store, 'case',   'Gabinete',        'Gabinete',      'case',   0),
    (v_store, 'cpu',    'Procesador',      'CPU',           'cpu',    1),
    (v_store, 'mb',     'Tarjeta Madre',   'Placa madre',   'mb',     2),
    (v_store, 'ram',    'Memoria RAM',     'RAM',           'ram',    3),
    (v_store, 'gpu',    'Tarjeta de Video','GPU',           'gpu',    4),
    (v_store, 'psu',    'Fuente de Poder', 'Fuente',        'psu',    5),
    (v_store, 'cooler', 'Enfriamiento',    'Refrigeración', 'cooler', 6);
end $$;
