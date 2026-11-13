/*
 * ox1.js - puente entre la tienda GIGA y el control plane OX1.
 * Requiere config.js. No usa service_role: solo la anon key publica.
 */
(function () {
  'use strict';

  var cfg = window.GIGA_CONFIG || {};
  var OX1_URL = String(cfg.OX1_URL || '').replace(/\/+$/, '');
  var OX1_KEY = String(cfg.OX1_ANON_KEY || '');
  var WS_REF = String(cfg.WS_REF || '');
  var STORE = Number(cfg.STORE_ID) || 1;
  var UPGRADE = String((cfg.BRAND && cfg.BRAND.whatsapp) || '584121049705').replace(/[^\d]/g, '');

  var cache = { at: 0, value: null };
  var CACHE_MS = 20000;

  function isConfigured() {
    return !!OX1_URL && !!OX1_KEY && !!WS_REF;
  }

  function timeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('OX1 timeout')); }, ms || 6000);
      })
    ]);
  }

  function fetchStatus() {
    if (!isConfigured()) return Promise.resolve(null);
    return timeout(fetch(OX1_URL + '/rest/v1/rpc/store_status', {
      method: 'POST',
      headers: {
        apikey: OX1_KEY,
        Authorization: 'Bearer ' + OX1_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_ws_ref: WS_REF, p_ws_store_id: STORE })
    }), 6000).then(function (res) {
      if (!res.ok) return res.text().then(function (t) {
        throw new Error('OX1 HTTP ' + res.status + ': ' + String(t || '').slice(0, 160));
      });
      return res.json();
    });
  }

  function status(opts) {
    var fresh = opts && opts.fresh;
    if (!fresh && cache.value && (Date.now() - cache.at) < CACHE_MS) {
      return Promise.resolve(cache.value);
    }
    return fetchStatus().then(function (st) {
      cache = { at: Date.now(), value: st };
      return st;
    });
  }

  function limitsFor(tier) {
    switch (String(tier || 'free')) {
      case 'empresarial':
        return { tier: 'empresarial', label: 'Empresario', visible_limit: 100, image_limit: 5, hidden_limit: 20 };
      case 'profesional':
        return { tier: 'profesional', label: 'Emprendimiento', visible_limit: 25, image_limit: 2, hidden_limit: 20 };
      case 'basico':
        return { tier: 'basico', label: 'Pequeno Emprendimiento', visible_limit: 7, image_limit: 1, hidden_limit: 20 };
      default:
        return { tier: 'free', label: 'Prueba', visible_limit: 7, image_limit: 1, hidden_limit: 20 };
    }
  }

  function tierLabel(tier) {
    return limitsFor(tier).label;
  }

  function upgradeUrl(text) {
    var msg = text || 'Hola, quiero subir la suscripcion de mi tienda.';
    return 'https://wa.me/' + UPGRADE + '?text=' + encodeURIComponent(msg);
  }

  function openUpgrade(text) {
    try { window.open(upgradeUrl(text), '_blank', 'noopener'); } catch (e) {}
  }

  function productUsage() {
    if (!window.GigaSB || !window.GigaSB.rpc) return Promise.resolve(null);
    return window.GigaSB.rpc('store_product_usage', { p_store_id: STORE }).catch(function () {
      return null;
    });
  }

  window.GHOx1 = {
    isConfigured: isConfigured,
    status: status,
    limitsFor: limitsFor,
    tierLabel: tierLabel,
    upgradeUrl: upgradeUrl,
    openUpgrade: openUpgrade,
    productUsage: productUsage,
    storeId: STORE,
    wsRef: WS_REF
  };
})();
