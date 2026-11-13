/*
 * config.js  -  Credenciales de Supabase para GIGAHEARTZ
 * ------------------------------------------------------------
 * Pega aqui tu Project URL y tu anon (publishable) key.
 * Estan en:  Supabase -> Project Settings -> API
 *
 * La anon key es PUBLICA (va en el navegador); la proteccion real
 * es RLS. NO pongas aqui la service_role key.
 */
window.GIGA_CONFIG = {
  SUPABASE_URL: 'https://isnbkqgzncjgttijzlmo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_rMzQcYJeHfExcJn0PH6K4w_1QLvg_FR',
  STORAGE_BUCKET: 'images',

  // Multi-tienda: esta tienda (una base de datos, varias tiendas).
  // Todas las consultas del sitio filtran por este store_id.
  // Para otra tienda: cambia STORE_ID (o que el Worker lo inyecte por subdominio).
  STORE_ID: 3,
  STORE_SLUG: 'tienda-003',

  // Fallback local si la RPC store_product_usage aun no esta aplicada.
  PLAN_TIER: 'basico',

  // OX1 = control plane (pagos, licencias, bloqueo, tier).
  // WS_REF es el project ref de la base GIGA compartida.
  OX1_URL: 'https://wufzqynbhvfbzlmqnvgw.supabase.co',
  OX1_ANON_KEY: 'sb_publishable_MLdr8wFcc2vG9npNtUg38g_Dg_uxodE',
  WS_REF: 'isnbkqgzncjgttijzlmo',

  // Branding dinamico. brand.js reemplaza MANIAWORLD/GIGAHEARTZ en el DOM.
  BRAND: {
    name: 'WhatShop Demo 3',
    whatsapp: '584121049705'
  },

  // Al subir una imagen desde el panel se convierte a WebP en el navegador
  // antes de enviarla (menos peso). Se salta SVG y GIF animado.
  IMAGE_MAX_WIDTH: 1600,
  IMAGE_WEBP_QUALITY: 0.82,

  // Seguridad de la sesión del panel (ms). El panel cierra sesión solo:
  //   idleMs: tras este tiempo SIN actividad.
  //   maxMs:  tope absoluto desde el inicio de sesión (no se puede extender).
  // Cambia los números a tu gusto (p. ej. 15 y 8 horas).
  SESSION: {
    idleMs: 30 * 60 * 1000,   // 30 minutos de inactividad
    maxMs: 12 * 60 * 60 * 1000 // 12 horas de sesión como máximo
  },

  // Fase G: CDN de imagenes (Cloudflare Worker en worker/). Solo CACHE
  // en el borde (gratis). Vacio = desactivado (se usa Supabase Storage
  // directo). Cuando se define, las imagenes del bucket se piden al
  // Worker: <IMAGE_CDN>/<ruta>
  IMAGE_CDN: ''
};
