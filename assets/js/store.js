/*
 * store.js  -  Hidrata el storefront con datos de Supabase.
 * - Textos/hero/tienda   (settings)
 * - Productos y combos   (products / combo_items)
 * - Tema / festivos      (themes + settings.holiday)
 * - Buscador (overlay)
 *
 * Enfoque "in-place": actualiza las tarjetas y combos ya presentes en el
 * HTML (misma estructura), los reordena y oculta los que no esten activos.
 * Asi se conservan los handlers (modal, carrito) que el HTML ya registra.
 * Si Supabase no esta configurado o falla, el sitio queda como esta.
 *
 * Depende de assets/js/data.js (window.GigaData) cargado en <head>.
 */
(function () {
  'use strict';

  var SB = window.GigaSB;
  var GD = window.GigaData;
  if (!SB || !SB.isConfigured() || !GD) {
    if (SB && !SB.isConfigured()) console.warn('[store] Supabase no configurado (assets/js/config.js). Se muestra el HTML estatico.');
    return;
  }

  var MONEY = { cur: '$', pos: 'before' };

  function money(n) {
    var v = (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return MONEY.pos === 'after' ? (v + ' ' + MONEY.cur) : (MONEY.cur + v);
  }
  function imgSrc(src, width) {
    if (window.GigaSB && GigaSB.resolveImage) return GigaSB.resolveImage(src, width);
    return (!src || /^https?:/i.test(src) || /^data:/i.test(src)) ? src : src.replace(/^\.?\//, '');
  }

  /* ---------------- Tema / festivos ---------------- */

  function themeCss(c) {
    c = c || {};
    function v(k, d) { return c[k] || d; }
    return [
      ':root{--gh-brand:' + v('brand', '#7c3aed') +
        ';--gh-brand-dark:' + v('brandDark', '#6d28d9') +
        ';--gh-brand-light:' + v('brandLight', '#a78bfa') +
        ';--gh-accent:' + v('accent', '#a855f7') +
        ';--gh-bg:' + v('bg', '#ffffff') +
        ';--gh-surface:' + v('surface', '#f9fafb') +
        ';--gh-text:' + v('text', '#111827') + ';}',
      'html.dark{--gh-bg:' + v('darkBg', '#0b0b12') +
        ';--gh-surface:' + v('darkSurface', '#141422') +
        ';--gh-text:' + v('darkText', '#e5e7eb') + ';}',
      'body{background-color:var(--gh-bg)!important;color:var(--gh-text)!important}',
      '.bg-white,.bg-white\\/60,.bg-white\\/80,.bg-white\\/85,.bg-white\\/90,.bg-white\\/95{background-color:var(--gh-surface)!important}',
      '.bg-gray-50{background-color:var(--gh-bg)!important}',
      '.text-gray-900{color:var(--gh-text)!important}',
      '.text-gray-800,.text-gray-700{color:color-mix(in srgb,var(--gh-text) 82%,var(--gh-bg))!important}',
      '.text-gray-600,.text-gray-500{color:color-mix(in srgb,var(--gh-text) 58%,var(--gh-bg))!important}',
      '.bg-purple-600{background-color:var(--gh-brand)!important}',
      '.hover\\:bg-purple-700:hover{background-color:var(--gh-brand-dark)!important}',
      '.bg-purple-500{background-color:var(--gh-brand)!important}',
      '.bg-purple-50{background-color:color-mix(in srgb,var(--gh-brand) 10%,#fff)!important}',
      '.hover\\:bg-purple-50:hover{background-color:color-mix(in srgb,var(--gh-brand) 10%,#fff)!important}',
      '.text-purple-600{color:var(--gh-brand)!important}',
      '.hover\\:text-purple-600:hover{color:var(--gh-brand)!important}',
      '.text-purple-500{color:var(--gh-brand)!important}',
      '.text-purple-700{color:var(--gh-brand-dark)!important}',
      '.border-purple-100{border-color:color-mix(in srgb,var(--gh-brand) 22%,#fff)!important}',
      '.border-purple-200{border-color:color-mix(in srgb,var(--gh-brand) 30%,#fff)!important}',
      '.border-purple-600{border-color:var(--gh-brand)!important}',
      '.ring-purple-600{--tw-ring-color:var(--gh-brand)!important}',
      '.from-purple-600{--tw-gradient-from:var(--gh-brand) var(--tw-gradient-from-position)!important;--tw-gradient-to:rgb(255 255 255/0) var(--tw-gradient-to-position)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)!important}',
      '.to-purple-600{--tw-gradient-to:var(--gh-brand) var(--tw-gradient-to-position)!important}'
    ].join('');
  }

  function applyTheme(settings, themes) {
    if (!themes || !themes.length) return;
    var h = (settings && settings.holiday) || {};
    var key = 'default';
    var active = themes.filter(function (t) { return t.is_active; })[0];
    if (active) key = active.key;

    var inRange = true;
    if (h.startDate) inRange = inRange && (new Date() >= new Date(h.startDate + 'T00:00:00'));
    if (h.endDate) inRange = inRange && (new Date() <= new Date(h.endDate + 'T23:59:59'));
    if (h.active && h.mode && h.mode !== 'none' && inRange) key = h.mode;

    var theme = themes.filter(function (t) { return t.key === key; })[0]
             || themes.filter(function (t) { return t.key === 'default'; })[0];
    if (!theme || !theme.colors) return;

    var style = document.getElementById('gh-theme') || document.createElement('style');
    style.id = 'gh-theme';
    style.textContent = themeCss(theme.colors);
    document.head.appendChild(style);

    var deco = theme.decorations || {};
    if (h.decorations && h.decorations.snow) deco = Object.assign({}, deco, { snow: true });
    if (h.decorations && h.decorations.bats) deco = Object.assign({}, deco, { bats: true });
    applyDecorations(deco);

    applyFx(theme.decorations && theme.decorations.fx);

    if (h.banner && h.banner.enabled && h.banner.text) applyBanner(h.banner);
  }

  /* Efectos visuales configurables por tema (themes.decorations.fx):
     borde animado de las tarjetas (color, nucleo, grosor, velocidad, glow,
     on/off) y transicion al abrir/cerrar producto. Todo con fallbacks al
     look por defecto para no romper temas viejos (fx = {}). */
  function hex6(v, d) { return /^#[0-9a-fA-F]{3,8}$/.test(String(v)) ? v : d; }
  function clampNum(v, d, lo, hi) { v = parseFloat(v); if (isNaN(v)) v = d; return Math.min(hi, Math.max(lo, v)); }

  function applyFx(fx) {
    fx = fx || {};
    var hover = hex6(fx.hover, '#7c3aed');
    var core = hex6(fx.core, '#ffffff');
    var ring = clampNum(fx.ring, 2, 1, 8);
    var speed = clampNum(fx.speed, 3.2, 0.5, 12);
    var glow = fx.glow === false ? 'transparent' : hex6(fx.glowColor, hover);
    var anim = fx.animate === false ? 'none' : ('gh-border-run ' + speed + 's linear infinite');

    var style = document.getElementById('gh-fx') || document.createElement('style');
    style.id = 'gh-fx';
    style.textContent =
      ':root{--gh-fx-hover:' + hover +
      ';--gh-fx-core:' + core +
      ';--gh-fx-ring:' + ring + 'px' +
      ';--gh-fx-glow:' + glow +
      ';--gh-fx-anim:' + anim + ';}';
    document.head.appendChild(style);

    var root = document.documentElement;
    root.classList.toggle('fx-cards-off', fx.enabled === false);
    root.classList.toggle('fx-noglow', fx.glow === false);

    window.GH_TRANSITION_BG = hex6(fx.transitionColor, '');
    window.GH_TRANSITION_ENABLED = fx.transition !== false;
  }

  function applyBanner(b) {
    if (document.getElementById('gh-holiday-banner')) return;
    var bar = document.createElement('a');
    bar.id = 'gh-holiday-banner';
    bar.href = b.link || '#';
    bar.textContent = b.text;
    bar.style.cssText = 'display:block;text-align:center;padding:8px 14px;font:600 13px/1.4 inherit;color:#fff;background:var(--gh-brand,#7c3aed);text-decoration:none;position:relative;z-index:60';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  /* Aviso de tienda cerrada (fuera de horario o por interruptor maestro).
     Se muestra en un modal la primera vez; al cerrarlo no vuelve a aparecer. */
  function applyClosedBanner(store) {
    if (!window.ghStoreState) return;
    var st = window.ghStoreState(store);
    window.GIGA_STORE_OPEN = st.open;
    var key = 'gh_closed_dismissed_' + ((window.GIGA_CONFIG && window.GIGA_CONFIG.STORE_ID) || 1);
    if (st.open) { try { localStorage.removeItem(key); } catch (e) {} return; }
    try { if (localStorage.getItem(key) === '1') return; } catch (e) {}
    if (document.getElementById('gh-closed-modal')) return;

    var ov = document.createElement('div');
    ov.id = 'gh-closed-modal';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Tienda cerrada');
    ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(17,24,39,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)';
    ov.innerHTML =
      '<div style="position:relative;max-width:440px;width:100%;background:#fff;color:#111827;border-radius:18px;padding:30px 24px 22px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);text-align:center;font-family:inherit">' +
        '<button type="button" id="gh-closed-x" aria-label="Cerrar" style="position:absolute;top:10px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:#f3f4f6;color:#6b7280;font-size:18px;line-height:1;cursor:pointer">&#10005;</button>' +
        '<div style="width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:#f5f3ff;display:flex;align-items:center;justify-content:center">' +
          '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
        '</div>' +
        '<h2 style="margin:0 0 8px;font-size:19px;font-weight:800">Tienda cerrada</h2>' +
        '<p id="gh-closed-msg" style="margin:0 0 18px;font-size:14px;line-height:1.55;color:#4b5563"></p>' +
        '<button type="button" id="gh-closed-ok" style="width:100%;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:700;font-size:14px;padding:12px 18px;cursor:pointer">Entendido</button>' +
      '</div>';
    document.body.appendChild(ov);
    var msgEl = ov.querySelector('#gh-closed-msg');
    if (msgEl) msgEl.textContent = window.ghClosedMessage ? window.ghClosedMessage(store, st) : 'Estamos cerrados por ahora.';

    var onKey = function (e) { if (e.key === 'Escape') close(); };
    function close() {
      try { localStorage.setItem(key, '1'); } catch (e) {}
      document.removeEventListener('keydown', onKey);
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var bx = ov.querySelector('#gh-closed-x'); if (bx) { bx.addEventListener('click', close); bx.focus(); }
    var ok = ov.querySelector('#gh-closed-ok'); if (ok) ok.addEventListener('click', close);
  }

  /* Ajuste de tamaño del logo de la tienda (store.logoScale, %). */
  function applyLogoSize(store) {
    var pct = Number(store && store.logoScale);
    if (!pct || pct === 100) return;
    pct = Math.max(30, Math.min(200, pct)) / 100;
    var els = document.querySelectorAll('.pl-logo, .hero-logo-img, [data-gh-logo]');
    Array.prototype.forEach.call(els, function (im) { im.style.zoom = pct; });
  }

  function applyDecorations(deco) {
    var old = document.getElementById('gh-decor');
    if (old) old.remove();
    if (!deco || (!deco.snow && !deco.bats)) return;
    var wrap = document.createElement('div');
    wrap.id = 'gh-decor';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:55;overflow:hidden';
    var n = 40;
    for (var i = 0; i < n; i++) {
      var s = document.createElement('span');
      var left = Math.random() * 100;
      var dur = 6 + Math.random() * 8;
      var delay = (-Math.random() * dur).toFixed(2);
      if (deco.snow) {
        s.textContent = '❄';
        s.style.cssText = 'position:absolute;top:-2rem;left:' + left + '%;color:#e0f2fe;font-size:' + (10 + Math.random() * 14) + 'px;animation:ghFall ' + dur + 's linear ' + delay + 's infinite';
      } else {
        s.textContent = '🦇';
        s.style.cssText = 'position:absolute;top:-2rem;left:' + left + '%;font-size:' + (12 + Math.random() * 12) + 'px;animation:ghFall ' + dur + 's linear ' + delay + 's infinite';
      }
      wrap.appendChild(s);
    }
    if (!document.getElementById('gh-decor-kf')) {
      var kf = document.createElement('style');
      kf.id = 'gh-decor-kf';
      kf.textContent = '@keyframes ghFall{0%{transform:translateY(-2rem) translateX(0) rotate(0)}100%{transform:translateY(105vh) translateX(30px) rotate(120deg)}}';
      document.head.appendChild(kf);
    }
    document.body.appendChild(wrap);
  }

  /* ---------------- Contenido (textos / hero) ---------------- */

  function setText(root, sel, val) {
    if (!root || val === undefined || val === null || val === '') return;
    var el = root.querySelector(sel);
    if (el) el.textContent = val;
  }

  function hydrateTexts(s) {
    if (!s) return;
    if (s.store) {
      MONEY.cur = s.store.currency || '$';
      MONEY.pos = s.store.currencyPosition || 'before';
      var brand = document.querySelector('nav .font-bold');
      if (brand && s.store.name) brand.textContent = s.store.name;
    }
    var hasStoreLogo = s.store && Object.prototype.hasOwnProperty.call(s.store, 'logo');
    var logo = hasStoreLogo ? (s.store.logo || '') : ((s.hero && s.hero.logo) || '');
    var logoEls = document.querySelectorAll('.pl-logo, .hero-logo-img, [data-gh-logo]');
    if (logo) {
      Array.prototype.forEach.call(logoEls, function (im) { im.src = logo; im.style.display = ''; });
    } else if (hasStoreLogo) {
      Array.prototype.forEach.call(logoEls, function (im) { im.removeAttribute('src'); im.style.display = 'none'; });
    }
    var heroImg = document.querySelector('.hero-logo-img');
    if (heroImg && s.hero) {
      if (logo) heroImg.src = logo;
      heroImg.style.display = (!logo || s.hero.showLogo === false) ? 'none' : '';
    }
    var combosSec = document.getElementById('combos');
    if (combosSec && s.texts && s.texts.combos) {
      setText(combosSec, 'span.uppercase', s.texts.combos.badge);
      setText(combosSec, 'h3', s.texts.combos.title);
      setText(combosSec, 'p', s.texts.combos.subtitle);
    }
    var bsSec = document.getElementById('lo-mas-vendido');
    if (bsSec && s.texts && s.texts.bestSellers) {
      setText(bsSec, 'span.uppercase', s.texts.bestSellers.badge);
      setText(bsSec, 'h3', s.texts.bestSellers.title);
      setText(bsSec, 'p', s.texts.bestSellers.subtitle);
    }
    hydrateSections(s.sections);
    hydrateContact(s.store);
  }

  /* Rellena datos de contacto en [data-gh] (teléfono, whatsapp, correo, etc.) */
  function hydrateContact(store) {
    if (!store) return;
    var map = {
      name: store.name,
      address: store.address,
      email: store.email,
      phone: store.phone,
      hours: store.hours,
      whatsapp: store.whatsappLabel || store.whatsapp
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-gh]'), function (el) {
      var v = map[el.getAttribute('data-gh')];
      if (v == null || v === '') return;
      el.textContent = v;
      if (el.getAttribute('data-gh') === 'email' && el.tagName === 'A') el.href = 'mailto:' + v;
    });
  }

  function hydrateSections(sections) {
    if (!sections || !sections.length) return;
    var map = { 'hero': '#canvasContainer', 'combos': '#combos', 'lo-mas-vendido': '#lo-mas-vendido' };
    var els = [];
    sections.forEach(function (sec) {
      var el = document.querySelector(map[sec.key]);
      if (!el) return;
      el.style.display = sec.visible === false ? 'none' : '';
      els.push({ el: el, pos: sec.position || 0 });
    });
    var reorder = els.filter(function (e) { return e.el.id === 'combos' || e.el.id === 'lo-mas-vendido'; });
    if (reorder.length === 2 && reorder[0].el.parentNode === reorder[1].el.parentNode) {
      reorder.sort(function (a, b) { return a.pos - b.pos; });
      var parent = reorder[0].el.parentNode;
      var marker = document.createComment('gh-sec');
      parent.insertBefore(marker, reorder[0].el);
      reorder.forEach(function (e) { parent.insertBefore(e.el, marker); });
      parent.removeChild(marker);
    }
  }

  /* ---------------- Productos ---------------- */

  function fillProduct(card, p) {
    card.__gdata = p; // datos ricos para el modal (galería, descripción, etc.)
    card.dataset.id = p.id;
    card.dataset.cat = p.category_name || '';
    card.dataset.subcat = p.subcategory_name || '';
    card.dataset.img = imgSrc(p.image, 640);
    var img = card.querySelector('img');
    if (img) { img.src = imgSrc(p.image, 600); img.alt = p.sub || p.name; }
    var h4 = card.querySelector('.product-name');
    if (h4) h4.textContent = p.name;
    var sub = card.querySelector('.product-sub');
    if (sub) sub.textContent = p.sub || '';
    var price = Array.prototype.slice.call(card.querySelectorAll('span')).filter(function (s) {
      return s.textContent.indexOf('$') !== -1 || s.className.indexOf('font-extrabold') !== -1;
    })[0];
    if (price) price.textContent = money(p.price);
    var badge = card.querySelector('span[class*="top-2"]');
    if (badge) {
      if (p.badge) { badge.textContent = p.badge; badge.style.display = ''; }
      else { badge.textContent = ''; badge.style.display = 'none'; }
    }
    card.style.display = p.hidden ? 'none' : '';
  }

  function hydrateGrid(grid, products) {
    if (!grid || !products) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.product-card'));
    if (!cards.length) return;
    var tpl = cards[0].cloneNode(true);
    products.forEach(function (p, i) {
      var card = cards[i] || tpl.cloneNode(true);
      fillProduct(card, p);
      grid.appendChild(card);
    });
    cards.slice(products.length).forEach(function (c) {
      c.style.display = 'none';
      grid.appendChild(c);
    });
  }

  /* ---------------- Combos ---------------- */

  function fillCombo(card, c) {
    var meta = c.meta || {};
    card.__gdata = c;
    card.dataset.name = c.name;
    card.dataset.price = c.price;
    card.dataset.img = imgSrc(c.image, 640);
    card.dataset.cat = c.category_name || c.cat || 'Combos';
    card.dataset.subcat = c.subcategory_name || '';
    var l1 = card.querySelector('.combo-cpu-line1'); if (l1) l1.textContent = meta.cpu_line1 || '';
    var l2 = card.querySelector('.combo-cpu-line2'); if (l2) l2.textContent = meta.cpu_line2 || '';
    var tag = card.querySelector('.combo-tag'); if (tag) tag.textContent = meta.tag || 'Combo';
    var img = card.querySelector('.combo-case'); if (img) img.src = imgSrc(c.image, 640);
    card.dataset.img = imgSrc(meta.composite || c.image, 640);
    var wrap = card.querySelector('.combo-imgwrap');
    if (wrap) {
      Array.prototype.slice.call(wrap.querySelectorAll('img.combo-layer')).forEach(function (x) { x.remove(); });
      // Si la imagen del combo ya es el compuesto, las capas están horneadas:
      // no volver a pintarlas encima (evita duplicados).
      var baked = !!(meta.composite && c.image === meta.composite);
      (baked ? [] : (meta.layers || [])).forEach(function (L) {
        if (!L || !L.src) return;
        var im = document.createElement('img');
        im.className = 'combo-layer';
        im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
        im.src = imgSrc(L.src, 320);
        im.style.cssText = 'position:absolute;left:' + (Number(L.x) || 0) + '%;top:' + (Number(L.y) || 0) +
          '%;width:' + (Number(L.w) || 40) + '%;height:auto;object-fit:contain;z-index:' + (Number(L.z) || 1) +
          ';pointer-events:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,.18))';
        wrap.appendChild(im);
      });
    }
    var price = card.querySelector('.combo-price'); if (price) price.textContent = money(c.price);
    var ul = card.querySelector('.combo-specs');
    if (ul) {
      var specs = (meta.card_specs && meta.card_specs.length) ? meta.card_specs : (c.includes || []);
      ul.innerHTML = specs.map(function (x) { return '<li>' + String(x).replace(/</g, '&lt;') + '</li>'; }).join('');
    }
    card.style.display = c.hidden ? 'none' : '';
  }

  function hydrateCombos(track, combos) {
    if (!track || !combos) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.combo-card'));
    if (!cards.length) return;
    var tpl = cards[0].cloneNode(true);
    combos.forEach(function (c, i) {
      var card = cards[i] || tpl.cloneNode(true);
      fillCombo(card, c);
      track.appendChild(card);
    });
    cards.slice(combos.length).forEach(function (c) {
      c.style.display = 'none';
      track.appendChild(c);
    });
  }

  /* ---------------- Buscador (overlay compartido) ---------------- */

  var ALL_PRODUCTS = [];
  var searchBuilt = false;
  var searchOverlay, searchInput, searchResults;

  function buildSearch() {
    if (searchBuilt) return;
    searchBuilt = true;
    searchOverlay = document.createElement('div');
    searchOverlay.id = 'gh-search';
    searchOverlay.setAttribute('role', 'dialog');
    searchOverlay.setAttribute('aria-modal', 'true');
    searchOverlay.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(15,15,25,.55);backdrop-filter:blur(6px);display:none;align-items:flex-start;justify-content:center;padding:80px 16px';
    searchOverlay.innerHTML =
      '<div style="width:min(640px,96vw);background:#fff;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.4);overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef0f3">' +
      '<svg width="18" height="18" fill="none" stroke="#6b7280" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
      '<input id="gh-search-input" type="text" placeholder="Buscar productos…" style="flex:1;border:0;outline:none;font:inherit;font-size:15px;background:transparent">' +
      '<button id="gh-search-close" type="button" style="border:0;background:transparent;font-size:18px;cursor:pointer;color:#6b7280">✕</button>' +
      '</div>' +
      '<div id="gh-search-results" style="max-height:52vh;overflow:auto;padding:6px"></div>' +
      '</div>';
    document.body.appendChild(searchOverlay);
    searchInput = searchOverlay.querySelector('#gh-search-input');
    searchResults = searchOverlay.querySelector('#gh-search-results');
    searchOverlay.addEventListener('mousedown', function (e) { if (e.target === searchOverlay) closeSearch(); });
    searchOverlay.querySelector('#gh-search-close').addEventListener('click', closeSearch);
    searchInput.addEventListener('input', function () { renderSearch(searchInput.value); });
    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); goSearch(searchInput.value); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isSearchOpen()) closeSearch(); });
  }

  function isSearchOpen() { return searchOverlay && searchOverlay.style.display === 'flex'; }
  function openSearch() {
    buildSearch();
    searchOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    searchInput.value = '';
    renderSearch('');
    setTimeout(function () { searchInput.focus(); }, 30);
  }
  function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }
  function renderSearch(q) {
    q = (q || '').trim().toLowerCase();
    var list = ALL_PRODUCTS.filter(function (p) {
      return (!q) || ((p.name || '') + ' ' + (p.sub || '')).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 24);
    if (!list.length) { searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:#6b7280;font-size:13px">Sin resultados</div>'; return; }
    searchResults.innerHTML = list.map(function (p) {
      return '<a href="catalogo.html?q=' + encodeURIComponent(p.name) + '" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;text-decoration:none;color:#111827">' +
        '<img loading="lazy" decoding="async" src="' + imgSrc(p.image, 88) + '" alt="" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;background:#fff">' +
        '<span style="flex:1;min-width:0"><span style="display:block;font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + String(p.name).replace(/</g, '&lt;') + '</span>' +
        '<span style="display:block;color:#6b7280;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + String(p.sub || '').replace(/</g, '&lt;') + '</span></span>' +
        '<span style="font-weight:700;color:var(--gh-brand,#7c3aed)">' + money(p.price) + '</span></a>';
    }).join('');
    Array.prototype.forEach.call(searchResults.querySelectorAll('a'), function (a) {
      a.addEventListener('mouseenter', function () { a.style.background = '#f5f3ff'; });
      a.addEventListener('mouseleave', function () { a.style.background = ''; });
    });
  }
  function goSearch(q) {
    q = (q || '').trim();
    location.href = 'catalogo.html' + (q ? ('?q=' + encodeURIComponent(q)) : '');
  }
  function bindSearch() {
    var btns = document.querySelectorAll('button[title="Buscar"], [data-gh-search]');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openSearch(); });
    });
  }

  /* ---------------- Carga ---------------- */

  GD.ready.then(function (D) {
    D = D || {};
    var hasCfg = D.settings && Object.keys(D.settings).length;
    if (hasCfg) {
      if (window.GHTheme && window.GHTheme.setDefault) {
        window.GHTheme.setDefault(((D.settings.store || {}).defaultTheme) || 'light');
      }
      applyTheme(D.settings, D.themes || []); hydrateTexts(D.settings); applyClosedBanner(D.settings.store); applyLogoSize(D.settings.store);
    }

    var products = D.products || [];
    if (!products.length) { window.dispatchEvent(new CustomEvent('gh:ready')); return; }

    var catName = {}, subName = {};
    (D.categories || []).forEach(function (c) { catName[c.id] = c.name; });
    (D.subcategories || []).forEach(function (s) { subName[s.id] = s.name; });
    products.forEach(function (p) {
      p.category_name = catName[p.category_id] || '';
      p.subcategory_name = subName[p.subcategory_id] || '';
    });

    var combos = products.filter(function (p) { return p.type === 'combo'; });
    var items = products.filter(function (p) { return p.type !== 'combo'; });
    ALL_PRODUCTS = items.slice();

    var byId = {};
    products.forEach(function (p) { byId[p.id] = p; });
    combos.forEach(function (c) {
      c.includes = (D.comboItems || []).filter(function (l) { return l.combo_id === c.id; })
        .map(function (l) { return byId[l.product_id] ? byId[l.product_id].name : null; })
        .filter(Boolean);
    });

    hydrateGrid(document.getElementById('homeGrid'), items);
    hydrateGrid(document.getElementById('crGrid'), items);
    hydrateCombos(document.getElementById('comboTrack'), combos);
    bindSearch();

    window.dispatchEvent(new CustomEvent('gh:ready'));
  }).catch(function (e) {
    console.warn('[store] No se pudo hidratar desde Supabase:', e.message);
  });
})();
