/*
 * store-gate.js - bloquea la tienda completa cuando esta cerrada o suspendida.
 * Requiere config.js + sb.js cargados antes. Se incluye solo en paginas publicas.
 */
(function () {
  'use strict';

  var cfg = window.GIGA_CONFIG || {};
  var BASE = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY = String(cfg.SUPABASE_ANON_KEY || '');
  var STORE = Number(cfg.STORE_ID) || 1;
  var STORE_NAME = cfg.STORE_SLUG || 'la tienda';

  if (!BASE || !KEY || KEY.indexOf('TU_') === 0) return;

  var overlay = null;
  var closed = false;

  function esc(s) {
    var d = document.createElement('span');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'gh-store-gate';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0c0d12;color:#f3f4f6;display:flex;align-items:center;justify-content:center;padding:24px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function render(title, message, showRetry) {
    var ov = ensureOverlay();
    ov.innerHTML =
      '<div style="max-width:440px;display:flex;flex-direction:column;align-items:center;gap:14px">' +
        '<div style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:24px">&#128274;</div>' +
        '<h1 style="margin:0;font-size:22px;line-height:1.2">' + esc(title) + '</h1>' +
        '<p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.6">' + esc(message) + '</p>' +
        (showRetry ? '<button type="button" id="gh-gate-retry" style="margin-top:6px;padding:10px 24px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;cursor:pointer">Reintentar</button>' : '') +
      '</div>';
    var btn = document.getElementById('gh-gate-retry');
    if (btn) btn.addEventListener('click', function () { render('Comprobando...', 'Verificando el estado de la tienda.', false); check(true); });
    document.documentElement.style.overflow = 'hidden';
  }

  function unlock() {
    if (overlay) { overlay.remove(); overlay = null; }
    document.documentElement.style.overflow = '';
    closed = false;
  }

  function lock(title, message, retry) {
    closed = true;
    render(title, message, retry);
  }

  function check(silent) {
    if (!silent) render('Comprobando...', 'Verificando el estado de la tienda.', false);
    return fetch(BASE + '/rest/v1/rpc/store_public_status', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_store_id: STORE })
    }).then(function (res) {
      if (res.status === 404) { unlock(); return null; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (st) {
      if (!st) return;
      if (st.open === true) { unlock(); return; }
      var name = st.name || STORE_NAME;
      lock(
        'Tienda cerrada',
        (st.message || 'La tienda esta cerrada en este momento.') + ' Vuelve mas tarde o escribenos por WhatsApp.',
        true
      );
      try { document.title = name + ' - Tienda cerrada'; } catch (e) {}
    }).catch(function () {
      lock('No se pudo verificar la tienda', 'Revisa tu conexion e intentalo de nuevo.', true);
    });
  }

  function start() {
    if (closed) return;
    check(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.GHStoreGate = {
    check: function () { return check(true); },
    isClosed: function () { return closed; }
  };
})();
