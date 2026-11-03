-- ============================================================
--  PRODUCTS: secciones de la ficha del producto
-- ============================================================
--  1) Añade la columna `specs` (filas {k,v} de "Especificaciones
--     tecnicas"). Si esta vacia, esa seccion NO se muestra.
--  2) Rellena la informacion que la ficha mostraba ANTES (texto
--     fijo en index.html / catalogo.html) para que cada producto
--     vuelva a tener sus secciones, pero ahora EDITABLES desde
--     el panel.
--
--  Idempotente: no pisa nada que ya hayas editado.
--  Ejecutar en Supabase -> SQL Editor.
-- ============================================================

-- ---------- 1) columna ----------
alter table public.products
  add column if not exists specs jsonb not null default '[]'::jsonb;

-- ---------- 2) especificaciones (mismas 6 filas de antes) ----------
update public.products
set specs = jsonb_build_array(
        jsonb_build_object('k', 'Modelo',          'v', coalesce(name, '')),
        jsonb_build_object('k', 'Resumen técnico', 'v', coalesce(sub, '')),
        jsonb_build_object('k', 'Condición',       'v', 'Nuevo · sellado de fábrica'),
        jsonb_build_object('k', 'Garantía',        'v', '12 meses'),
        jsonb_build_object('k', 'Disponibilidad',  'v', 'En stock · zulia'),
        jsonb_build_object('k', 'Envío',           'v', 'A toda Venezuela')
      )
where coalesce(specs, '[]'::jsonb) = '[]'::jsonb;

-- ---------- 3) descripcion (mismo texto de antes) ----------
update public.products
set description =
      coalesce(name, '') || ' — ' || coalesce(sub, '') ||
      '. Seleccionado por el equipo técnico de MANIAWORLD y probado en banco de pruebas antes de salir a la venta, garantizando rendimiento estable, temperaturas controladas y compatibilidad verificada con los estándares actuales de la industria.' ||
      E'\n\n' ||
      'El producto se entrega nuevo y sellado de fábrica, con su empaque original, manuales, accesorios completos y certificados de cumplimiento. Incluye garantía de 12 meses por fallas de fabricación, asistencia técnica especializada para la instalación y configuración inicial, así como soporte postventa directo por WhatsApp con nuestro personal en zulia.' ||
      E'\n\n' ||
      'MANIAWORLD despacha a domicilio a toda Venezuela: zulia (24-48h), Valencia y Maracaibo (48-72h) y resto del país de 3 a 5 días hábiles. Aceptamos transferencia bancaria, Pago Móvil, Zelle, tarjetas de crédito y débito, así como pago contra entrega en zonas cubiertas. Consulta disponibilidad exacta, descuentos por cantidad y opciones de financiamiento antes de finalizar tu compra.' ||
      E'\n\n' ||
      '¿Dudas sobre compatibilidad con tu equipo actual? Escríbenos antes de comprar y te asesoramos con la instalación, la actualización de firmware y las mejores alternativas de precio dentro del catálogo de la tienda.'
where coalesce(description, '') = '';
