/*
 * Fase G - Worker de imagenes (Cloudflare Workers) - CACHE (gratis).
 *
 * Pone una capa de cache en el borde delante de Supabase Storage:
 *   - 1a visita: trae la imagen de Supabase y la guarda en el edge.
 *   - siguientes: la sirve del edge (rapidisimo, casi no toca Supabase).
 *
 * NO redimensiona ni convierte (eso usa cf.image = de pago). Las
 * imagenes ya se convierten a WebP al subirlas desde el panel.
 *
 * Uso desde el sitio (cuando config.js -> IMAGE_CDN esta definido):
 *   https://<worker>/<ruta-objeto>        -> objeto del bucket Supabase
 *   https://<worker>/?src=<url-absoluta>  -> solo hosts permitidos
 *
 * Fuentes permitidas via ?src=: ALLOW_HOSTS, el propio Supabase o
 * SITE_ORIGIN (evita SSRF). Sin ?src= siempre se sirve del bucket.
 *
 * Plan free de Workers: hasta 100.000 pedidos/dia. Suficiente.
 */

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function host(u) {
  try { return new URL(u).hostname; } catch (e) { return ''; }
}

function resolveSource(url, cfg) {
  const src = url.searchParams.get('src') || url.searchParams.get('url');
  if (src) {
    let abs;
    try { abs = new URL(src, cfg.site || 'https://invalid.local'); }
    catch (e) { throw new Error('src invalido'); }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') throw new Error('protocolo no permitido');
    const h = abs.hostname;
    const allowed = cfg.allow.indexOf(h) !== -1 ||
      (cfg.site && h === host(cfg.site)) ||
      (cfg.supabase && h === host(cfg.supabase));
    if (!allowed) throw new Error('host no permitido: ' + h);
    return abs.href;
  }

  const raw = url.pathname.replace(/^\/+/, '');
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) throw new Error('usa ?src= para URLs absolutas');
  if (!cfg.supabase) throw new Error('SUPABASE_URL no configurado');
  return cfg.supabase + '/storage/v1/object/public/' + cfg.bucket + '/' + raw;
}

function corsHeaders(base) {
  const h = new Headers(base || {});
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Accept,If-None-Match');
  return h;
}

export default {
  async fetch(request, env, ctx) {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (method !== 'GET' && method !== 'HEAD') return json({ error: 'metodo no permitido' }, 405);

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true, cache: true });

    const cfg = {
      supabase: String(env.SUPABASE_URL || '').replace(/\/+$/, ''),
      bucket: String(env.BUCKET || 'images'),
      site: String(env.SITE_ORIGIN || '').replace(/\/+$/, ''),
      allow: String(env.ALLOW_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean),
      ttl: Number(env.CACHE_TTL) || 31536000,
      debug: String(env.DEBUG || '') === 'true'
    };

    let sourceUrl;
    try { sourceUrl = resolveSource(url, cfg); }
    catch (e) { return json({ error: e.message }, 400); }
    if (!sourceUrl) return json({ error: 'Falta la imagen: /<ruta> o ?src=' }, 400);

    const cache = caches.default;
    const cacheKey = new Request(sourceUrl, { method: 'GET' });

    // 1) Intento en cache del edge
    let hit = null;
    try { hit = await cache.match(cacheKey); } catch (e) { hit = null; }
    if (hit) {
      const headers = corsHeaders(hit.headers);
      headers.set('X-Cache', 'HIT');
      if (cfg.debug) headers.set('X-Image-Source', sourceUrl);
      return new Response(method === 'HEAD' ? null : hit.body, { status: hit.status, headers });
    }

    // 2) Origen (Supabase u host permitido)
    let upstream;
    try { upstream = await fetch(sourceUrl); }
    catch (e) { return json({ error: 'fallo al traer la imagen', detail: String(e) }, 502); }

    const headers = new Headers(upstream.headers);
    headers.delete('Set-Cookie');
    headers.delete('Content-Security-Policy');
    headers.set('X-Cache', 'MISS');
    headers.set('Access-Control-Allow-Origin', '*');
    if (cfg.debug) headers.set('X-Image-Source', sourceUrl);

    // Solo se cachea lo exitoso y publico
    if (upstream.ok) {
      headers.set('Cache-Control', 'public, max-age=' + cfg.ttl + ', immutable');
      const toCache = new Response(upstream.body, { status: upstream.status, headers: new Headers(headers) });
      if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, toCache.clone()).catch(function () {}));
      return new Response(toCache.body, { status: upstream.status, headers: corsHeaders(headers) });
    }

    return new Response(method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers: corsHeaders(headers) });
  }
};
