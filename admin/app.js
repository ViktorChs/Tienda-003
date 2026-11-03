/*
 * app.js  -  Panel de administración MANIAWORLD (Supabase)
 * Vanilla JS, sin dependencias. Usa window.GigaSB (assets/js/sb.js).
 */
(function () {
  'use strict';

  var SB = window.GigaSB;
  var S = { user: null, me: null, tab: 'dashboard', cache: {} };

  /* =========================================================
   *  Utilidades DOM
   * ========================================================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }
  function toast(msg, type, actionLabel, onAction) {
    var t = el('div', { class: 'toast ' + (type || '') });
    t.appendChild(el('span', { class: 'toast-msg' }, esc(msg)));
    if (actionLabel) {
      var a = el('button', { class: 'toast-action', type: 'button' }, esc(actionLabel));
      a.addEventListener('click', function () { t.remove(); onAction && onAction(); });
      t.appendChild(a);
    }
    $('#toast').appendChild(t);
    var life = actionLabel ? 6500 : 3000;
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, life - 350);
    setTimeout(function () { t.remove(); }, life);
    return t;
  }
  function money(n) { return '$' + (Number(n) || 0).toFixed(2); }

  /* =========================================================
   *  Iconos + botones de acción (fila/tarjeta) y menú "⋯"
   * ========================================================= */
  var ICO = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
    pkg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/></svg>'
  };
  function actIcon(cls, attrs, title, icon) {
    return '<button type="button" class="act-btn' + (cls ? ' ' + cls : '') + '" ' + attrs +
      ' title="' + esc(title) + '" aria-label="' + esc(title) + '">' + icon + '</button>';
  }
  // Menú "⋯" (una sola instancia abierta). Los items llevan los mismos
  // data-* que ya maneja el click delegado de la lista, así que no hace
  // falta re-cablear cada acción.
  var ACTMENU = null;
  function closeActMenu() {
    if (!ACTMENU) return;
    ACTMENU.menu.hidden = true;
    if (ACTMENU.btn) ACTMENU.btn.setAttribute('aria-expanded', 'false');
    ACTMENU = null;
  }
  function openActMenu(btn) {
    var menu = btn.parentNode && btn.parentNode.querySelector('.act-menu');
    if (!menu) return;
    var wasOpen = ACTMENU && ACTMENU.menu === menu;
    closeActMenu();
    if (wasOpen) return;
    btn.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    var b = btn.getBoundingClientRect();
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = Math.max(8, Math.min((window.innerWidth || 9999) - mw - 8, b.right - mw));
    var top = b.bottom + 6;
    if (top + mh > (window.innerHeight || 9999) - 8) top = Math.max(8, b.top - mh - 6);
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(top) + 'px';
    ACTMENU = { btn: btn, menu: menu };
  }
  document.addEventListener('click', function (e) {
    if (!ACTMENU) return;
    var t = e.target;
    if (ACTMENU.menu.contains(t)) {
      if (t.closest('[data-dup],[data-del],[data-items]')) closeActMenu();
      return;
    }
    if (ACTMENU.btn.contains(t)) return;
    closeActMenu();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeActMenu(); });
  window.addEventListener('scroll', closeActMenu, true);

  // Acciones estándar de una fila/tarjeta de producto (icono + menú ⋯).
  function productActions(r, isCombo) {
    return actIcon('act-edit', 'data-edit="' + esc(r.id) + '"', 'Editar', ICO.edit) +
      actIcon(r.hidden ? 'is-off' : 'is-on', 'data-toggle="' + esc(r.id) + '"',
        r.hidden ? 'Oculto — pulsa para mostrar' : 'Visible — pulsa para ocultar',
        r.hidden ? ICO.eyeOff : ICO.eye) +
      '<div class="act-menu-wrap">' +
        actIcon('act-more', 'data-menu="' + esc(r.id) + '" aria-haspopup="menu" aria-expanded="false"', 'Más acciones', ICO.more) +
        '<div class="act-menu" role="menu" hidden>' +
          (isCombo ? '<button type="button" role="menuitem" data-items="' + esc(r.id) + '">' + ICO.pkg + '<span>Piezas e imagen</span></button>' : '') +
          '<button type="button" role="menuitem" data-dup="' + esc(r.id) + '">' + ICO.copy + '<span>Duplicar</span></button>' +
          '<div class="act-menu-sep"></div>' +
          '<button type="button" role="menuitem" class="danger" data-del="' + esc(r.id) + '">' + ICO.trash + '<span>Borrar</span></button>' +
        '</div>' +
      '</div>';
  }
  // Acciones genéricas (resto de listas: editar + borrar).
  function entityActions(r) {
    return actIcon('act-edit', 'data-edit="' + esc(r.id) + '"', 'Editar', ICO.edit) +
      actIcon('act-del', 'data-del="' + esc(r.id) + '"', 'Borrar', ICO.trash);
  }

  // Fase 3/4: UI persistente (por tienda) y navegación con filtro.
  function uiKey(k) { return 'gh_ui_' + sid() + '_' + k; }
  function uiGet(k, def) {
    try { var v = localStorage.getItem(uiKey(k)); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function uiSet(k, v) {
    try { localStorage.setItem(uiKey(k), JSON.stringify(v)); } catch (e) {}
  }
  // Navegación entre pestañas con filtro/estado inicial (p. ej. desde el dashboard).
  var PENDING = {};
  function goTab(tab, filter) {
    if (filter) PENDING[tab] = filter;
    switchTab(tab);
  }
  function errorState(mount, err, retry) {
    mount.innerHTML = '<div class="card empty"><div class="empty-ico">⚠️</div>' +
      '<div class="empty-title">No se pudo cargar</div>' +
      '<p class="muted">' + esc((err && err.message) || 'Error de conexión.') + '</p>' +
      '<button class="btn primary" id="retryBtn">Reintentar</button></div>';
    var b = $('#retryBtn', mount);
    if (b) b.addEventListener('click', function () { mount.innerHTML = skeleton(4); retry(); });
  }

  function skeleton(rows) {
    var out = '';
    for (var i = 0; i < (rows || 4); i++) {
      out += '<div class="sk-row"><span class="sk sk-thumb"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span></div>';
    }
    return '<div class="skeleton">' + out + '</div>';
  }
  function productSkeleton() {
    var cards = '';
    for (var i = 0; i < 8; i++) {
      cards += '<div class="sk-pcard"><span class="sk sk-pcard-img"></span><span class="sk sk-line"></span><span class="sk sk-line short"></span></div>';
    }
    return '<div class="sk-toolbar">' +
      '<span class="sk sk-search"></span><span class="sk sk-filter"></span><span class="sk sk-filter"></span><span class="sk sk-filter"></span><span class="sk sk-actions"></span>' +
      '</div><div class="pcard-grid">' + cards + '</div>';
  }
  function emptyState(title, sub, ctaLabel, ctaId, icon) {
    return '<div class="card empty">' +
      (icon ? '<div class="empty-ico">' + icon + '</div>' : '') +
      '<div class="empty-title">' + esc(title) + '</div>' +
      (sub ? '<p class="muted">' + esc(sub) + '</p>' : '') +
      (ctaLabel ? '<button class="btn primary" ' + (ctaId ? 'id="' + ctaId + '"' : '') + '>+ ' + esc(ctaLabel) + '</button>' : '') +
      '</div>';
  }

  // Registro de actividad (tabla privada activity_log, aislada por tienda).
  function logActivity(text) {
    if (!S.me) return Promise.resolve();
    return SB.insert('activity_log', {
      store_id: sid(),
      user_id: (S.me && S.me.id) || (S.user && S.user.id) || null,
      text: String(text || '').slice(0, 500)
    }).catch(function () {});
  }

  // Borrado con deshacer: recuerda la fila y la reinserta si el usuario pulsa "Deshacer".
  function removeWithUndo(table, row, opts) {
    opts = opts || {};
    return SB.remove(table, { id: 'eq.' + row.id }).then(function () {
      invalidate();
      if (opts.after) opts.after();
      toast(opts.label || 'Elemento eliminado', 'ok', 'Deshacer', function () {
        var copy = JSON.parse(JSON.stringify(row));
        SB.insert(table, copy).then(function () {
          invalidate();
          if (opts.after) opts.after();
          toast('Restaurado', 'ok');
        }).catch(function (e) { toast('No se pudo restaurar: ' + e.message, 'err'); });
      });
    }).catch(function (e) { toast(e.message, 'err'); });
  }

  /* =========================================================
   *  Modal genérico (accesible)
   * ========================================================= */
  var MODAL = null;

  function focusables(root) {
    return $all('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root)
      .filter(function (n) { return n.offsetParent !== null; });
  }
  function busy(btn, on) {
    if (on) {
      if (btn.dataset.label == null) btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.classList.add('busy');
      btn.innerHTML = '<span class="btn-spin"></span>' + btn.dataset.label;
    } else {
      btn.disabled = false;
      btn.classList.remove('busy');
      if (btn.dataset.label != null) btn.innerHTML = btn.dataset.label;
    }
  }
  function trapKey(e) {
    if (!MODAL || e.key !== 'Tab') return;
    var f = focusables(MODAL.modal);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  // Construye (o reconstruye) los botones del pie del modal.
  function fillFooter(foot, buttons) {
    foot.innerHTML = '';
    (buttons || []).forEach(function (b) {
      if (b.spacer) { foot.appendChild(el('span', { class: 'foot-spacer' })); return; }
      var btn = el('button', { class: 'btn ' + (b.class || '') + (b.sm ? ' sm' : ''), type: 'button' }, esc(b.label));
      if (b.attrs) Object.keys(b.attrs).forEach(function (a) { btn.setAttribute(a, b.attrs[a]); });
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var r = b.onClick && b.onClick();
        if (r && typeof r.then === 'function') {
          busy(btn, true);
          r.then(function () { busy(btn, false); }, function () { busy(btn, false); });
        }
      });
      foot.appendChild(btn);
    });
    if (!buttons || !buttons.length) {
      var cancel = el('button', { class: 'btn', type: 'button' }, 'Cerrar');
      cancel.addEventListener('click', requestClose);
      foot.appendChild(cancel);
    }
    return foot;
  }
  function openModal(opts) {
    opts = opts || {};
    if (MODAL) closeModal(true);
    var root = $('#modalRoot');
    // Limpia overlays que aún estén animando su salida.
    if (root) $all('.overlay.closing', root).forEach(function (o) { o.remove(); });
    var isFs = opts.size === 'fullscreen';
    var ov = el('div', { class: 'overlay' + (isFs ? ' overlay-fs' : '') });
    var modal = el('div', { class: 'modal' + (opts.size ? ' ' + opts.size : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Diálogo' });
    if (isFs) {
      ov.style.padding = '0';
      ov.style.alignItems = 'stretch';
      ov.style.justifyContent = 'stretch';
      ov.style.overflow = 'hidden';
      modal.style.width = '100%';
      modal.style.maxWidth = 'none';
      modal.style.height = '100%';
      modal.style.maxHeight = 'none';
      modal.style.margin = '0';
      modal.style.border = '0';
      modal.style.borderRadius = '0';
      modal.style.boxShadow = 'none';
    }
    var head = el('header', null,
      '<h3>' + esc(opts.title || '') + '</h3>' +
      '<button class="btn ghost sm" data-x type="button" aria-label="Cerrar">✕</button>');
    var body = el('div', { class: 'body' }, opts.body || '');
    var foot = el('footer');
    fillFooter(foot, opts.buttons);
    modal.appendChild(head); modal.appendChild(body); modal.appendChild(foot);
    ov.appendChild(modal);
    root.appendChild(ov);

    MODAL = { ov: ov, modal: modal, guard: !!opts.guard, dirty: false, prevFocus: document.activeElement, closing: false };
    if (opts.guard) {
      body.addEventListener('input', function () { MODAL.dirty = true; });
      body.addEventListener('change', function () { MODAL.dirty = true; });
    }

    ov.addEventListener('mousedown', function (e) { if (e.target === ov) requestClose(); });
    head.querySelector('[data-x]').addEventListener('click', requestClose);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', trapKey, true);

    opts.onMount && opts.onMount(body, modal);
    setTimeout(function () {
      var target = modal.querySelector('[autofocus]');
      if (!target) {
        var bf = focusables(body), ff = focusables(foot), mf = focusables(modal);
        target = bf[0] || ff[0] || mf[0];
      }
      if (target) target.focus();
    }, 0);
    return { body: body, modal: modal, close: closeModal };
  }
  function requestClose() {
    if (!MODAL || MODAL.closing) return;
    if (MODAL.guard && (MODAL.dirty || (MODAL._prodDraft && MODAL._prodDraft.dirty && MODAL._prodDraft.dirty()))) {
      if (MODAL._prodDraft) {
        var dk = MODAL._prodDraft.key;
        var ov = el('div', { class: 'overlay top' });
        var modalD = el('div', { class: 'modal sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cambios sin guardar' });
        modalD.appendChild(el('header', null, '<h3>Cambios sin guardar</h3>'));
        modalD.appendChild(el('div', { class: 'body' }, '<p>Tienes cambios sin guardar. Puedes guardarlos como borrador para retomarlos después o cerrarlos sin guardar.</p>'));
        var footD = el('footer');
        var keep = el('button', { class: 'btn', type: 'button' }, 'Continuar editando');
        var drop = el('button', { class: 'btn', type: 'button' }, 'Cerrar sin guardar');
        var saveAndClose = el('button', { class: 'btn primary', type: 'button' }, 'Guardar borrador y cerrar');
        footD.appendChild(keep); footD.appendChild(drop); footD.appendChild(saveAndClose);
        modalD.appendChild(footD);
        ov.appendChild(modalD);
        document.body.appendChild(ov);
        function closeD(){ ov.remove(); }
        keep.addEventListener('click', closeD);
        drop.addEventListener('click', function(){ try{localStorage.removeItem(dk);}catch(e){} closeD(); closeModal(true); });
        saveAndClose.addEventListener('click', function(){ try{ MODAL._prodDraft && MODAL._prodDraft.save && MODAL._prodDraft.save(); }catch(e){} closeD(); closeModal(true); });
        ov.addEventListener('mousedown', function(e){ if(e.target===ov) closeD(); });
        setTimeout(function(){ keep.focus(); }, 0);
        return;
      }
      confirmDiscard(closeModal);
      return;
    }
    closeModal();
  }
  function closeModal(force) {
    var root = $('#modalRoot');
    var had = !!MODAL;
    if (MODAL) {
      document.removeEventListener('keydown', trapKey, true);
      var pf = MODAL.prevFocus;
      MODAL = null;
      if (pf && pf.focus) { try { pf.focus(); } catch (e) {} }
    }
    if (!root) return;
    document.body.classList.remove('modal-open');
    var ov = root.firstElementChild;
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (!had || force || reduce || !ov) { root.innerHTML = ''; return; }
    // Salida simétrica a la entrada (pop): se difiere el borrado ~140 ms.
    ov.classList.add('closing');
    var modal = ov.querySelector('.modal');
    if (modal) modal.classList.add('closing');
    setTimeout(function () { if (ov.parentNode === root) root.removeChild(ov); }, 150);
  }
  // Diálogo de cambios sin guardar (encima del modal activo).
  function confirmDiscard(onDiscard) {
    var ov = el('div', { class: 'overlay top' });
    var modal = el('div', { class: 'modal sm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cambios sin guardar' });
    modal.appendChild(el('header', null, '<h3>Cambios sin guardar</h3>'));
    modal.appendChild(el('div', { class: 'body' }, '<p>Hay cambios que no has guardado. ¿Quieres descartarlos?</p>'));
    var foot = el('footer');
    var keep = el('button', { class: 'btn', type: 'button' }, 'Seguir editando');
    var drop = el('button', { class: 'btn danger', type: 'button' }, 'Descartar cambios');
    foot.appendChild(keep); foot.appendChild(drop);
    modal.appendChild(foot);
    ov.appendChild(modal);
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    keep.addEventListener('click', close);
    drop.addEventListener('click', function () { close(); onDiscard && onDiscard(); });
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    setTimeout(function () { keep.focus(); }, 0);
  }
  function confirmDialog(msg, onYes, opts) {
    opts = opts || {};
    openModal({
      title: opts.title || 'Confirmar',
      size: opts.size || 'sm',
      body: '<p>' + esc(msg) + '</p>',
      buttons: [
        { label: opts.cancelLabel || 'Cancelar', onClick: closeModal },
        { label: opts.dangerLabel || 'Eliminar', class: opts.dangerClass || 'danger', onClick: function () { closeModal(); onYes(); } }
      ]
    });
  }

  function changeMyPassword() {
    var email = (S.user && S.user.email) || '';
    var busy = false;
    openModal({
      title: 'Mi cuenta',
      body: '<div class="field"><label>Correo</label><input value="' + esc(email) + '" disabled></div>' +
        '<div class="field"><label>Nueva contraseña</label><input type="password" id="pw_new" autocomplete="new-password" required></div>' +
        '<div class="field mb0"><label>Repetir contraseña</label><input type="password" id="pw_rep" autocomplete="new-password" required></div>' +
        '<p class="help">Al cambiarla, el propietario de la tienda verá la nueva contraseña en Usuarios.</p>',
      buttons: [
        { label: 'Cancelar', onClick: closeModal },
        { label: 'Cambiar', class: 'primary', onClick: function () {
          if (busy) return;
          var p1 = $('#pw_new').value, p2 = $('#pw_rep').value;
          if (p1.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', 'err');
          if (p1 !== p2) return toast('Las contraseñas no coinciden', 'err');
          busy = true;
          SB.updatePassword(p1).then(function () {
            return SB.upsert('admin_credentials', {
              admin_id: S.me.id, store_id: sid(), email: email, password: p1, updated_at: new Date().toISOString()
            }, 'admin_id').then(function () { return true; }).catch(function () { return false; });
          }).then(function (saved) {
            closeModal();
            toast(saved ? 'Contraseña actualizada' : 'Contraseña cambiada; falta guardarla en el panel (ejecuta admin_credentials.sql)', saved ? 'ok' : 'err');
          }).catch(function (e) {
            busy = false;
            toast(e.message, 'err');
          });
        } }
      ]
    });
  }

  /* =========================================================
   *  API + caché  (todo acotado a la tienda del admin)
   * ========================================================= */
  var TENANT = ['settings', 'categories', 'subcategories', 'products', 'combo_items',
    'nav_groups', 'nav_items', 'builder_slots', 'builder_parts', 'themes', 'orders', 'admins', 'admin_credentials', 'activity_log'];
  function sid() { return (S.me && S.me.store_id) || 1; }
  function scope(table, params) {
    if (TENANT.indexOf(table) === -1) return params;
    var p = params || {};
    p.store_id = 'eq.' + sid();
    return p;
  }
  function load(key, params) {
    return SB.get(key, scope(key, params)).then(function (rows) { S.cache[key] = rows; return rows; });
  }
  function invalidate() { S.cache = {}; }

  /* =========================================================
   *  Definición de entidades CRUD simples
   * ========================================================= */
  var ENTITIES = {
    categories: {
      title: 'Categorías', order: 'position.asc,id.asc',
      cols: [
        { k: 'name', l: 'Nombre' },
        { k: 'slug', l: 'Slug' },
        { k: 'color', l: 'Color', r: function (v) { return '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:14px;border-radius:4px;border:1px solid #e5e7eb;background:' + esc(v || '#7c3aed') + '"></span>' + esc(v || '') + '</span>'; } },
        { k: 'position', l: 'Pos' },
        { k: 'hidden', l: 'Oculto', r: boolTag }
      ],
      fields: [
        { k: 'name', l: 'Nombre', req: true, step: 0 },
        { k: 'slug', l: 'Slug (URL)', step: 0 },
        { k: 'color', l: 'Color', t: 'color', step: 0 },
        { k: 'icon', l: 'Icono SVG (opcional)', step: 0 },
        { k: 'image', l: 'Imagen', t: 'image', step: 1 },
        { k: 'position', l: 'Posición', t: 'number', step: 1 },
        { k: 'hidden', l: 'Oculto', t: 'bool', step: 1 }
      ],
      steps: [
        { title: 'Identidad', short: 'Identidad', sub: 'Nombre, slug, color e icono de la categoría.' },
        { title: 'Imagen y orden', short: 'Imagen', sub: 'Imagen, posición y visibilidad.' }
      ]
    },
    subcategories: {
      title: 'Subcategorías', order: 'position.asc,id.asc',
      cols: [
        { k: 'name', l: 'Nombre' },
        { k: 'category_id', l: 'Categoría', r: function (v) { return esc(refName('categories', v)); } },
        { k: 'position', l: 'Pos' },
        { k: 'hidden', l: 'Oculto', r: boolTag }
      ],
      fields: [
        { k: 'category_id', l: 'Categoría', t: 'ref', ref: 'categories', req: true },
        { k: 'name', l: 'Nombre', req: true },
        { k: 'position', l: 'Posición', t: 'number' },
        { k: 'hidden', l: 'Oculto', t: 'bool' }
      ],
      steps: [
        { title: 'Datos de la subcategoría', short: 'Datos', sub: 'Categoría padre, nombre, orden y visibilidad.' }
      ]
    },
    nav_groups: {
      title: 'Grupos de navegación', order: 'position.asc,id.asc',
      cols: [
        { k: 'name', l: 'Nombre' },
        { k: 'position', l: 'Pos' },
        { k: 'hidden', l: 'Oculto', r: boolTag }
      ],
      fields: [
        { k: 'name', l: 'Nombre', req: true },
        { k: 'icon', l: 'Icono SVG (paths)', t: 'textarea', help: 'Se inyecta dentro de <svg>. Pega los <path .../>.' },
        { k: 'position', l: 'Posición', t: 'number' },
        { k: 'hidden', l: 'Oculto', t: 'bool' }
      ]
    },
    nav_items: {
      title: 'Ítems de navegación', order: 'position.asc,id.asc',
      cols: [
        { k: 'name', l: 'Nombre' },
        { k: 'group_id', l: 'Grupo', r: function (v) { return esc(refName('nav_groups', v)); } },
        { k: 'position', l: 'Pos' }
      ],
      fields: [
        { k: 'group_id', l: 'Grupo', t: 'ref', ref: 'nav_groups', req: true },
        { k: 'name', l: 'Nombre', req: true },
        { k: 'position', l: 'Posición', t: 'number' }
      ]
    },
    builder_slots: {
      title: 'Slots del armador', order: 'position.asc,id.asc',
      cols: [
        { k: 'key', l: 'Clave' },
        { k: 'name', l: 'Nombre' },
        { k: 'label', l: 'Etiqueta' },
        { k: 'position', l: 'Pos' }
      ],
      fields: [
        { k: 'key', l: 'Clave (case, cpu, mb, ram, gpu, psu, cooler)', req: true },
        { k: 'name', l: 'Nombre', req: true },
        { k: 'label', l: 'Etiqueta' },
        { k: 'icon', l: 'Icono' },
        { k: 'position', l: 'Posición', t: 'number' }
      ]
    },
    builder_parts: {
      title: 'Piezas del armador', order: 'slot_id.asc,position.asc,id.asc',
      cols: [
        { k: 'name', l: 'Nombre' },
        { k: 'slot_id', l: 'Slot', r: function (v) { return esc(refName('builder_slots', v)); } },
        { k: 'short', l: 'Resumen' },
        { k: 'price', l: 'Precio', r: function (v) { return money(v); } },
        { k: 'position', l: 'Pos' }
      ],
      fields: [
        { k: 'slot_id', l: 'Slot', t: 'ref', ref: 'builder_slots', req: true },
        { k: 'name', l: 'Nombre', req: true },
        { k: 'short', l: 'Resumen' },
        { k: 'price', l: 'Precio', t: 'money', req: true },
        { k: 'image', l: 'Imagen', t: 'image' },
        { k: 'position', l: 'Posición', t: 'number' }
      ]
    }
  };

  function boolTag(v) { return v ? '<span class="tag off">Sí</span>' : '<span class="tag on">No</span>'; }
  function refName(table, id) {
    var rows = S.cache[table] || [];
    var hit = rows.filter(function (r) { return String(r.id) === String(id); })[0];
    return hit ? (hit.name || hit.label || hit.key || id) : '—';
  }

  /* =========================================================
   *  Helpers de lista (búsqueda, filtros, orden, CSV)
   * ========================================================= */
  function downloadBlob(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function toCSV(rows, cols) {
    function cell(v) { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return '\uFEFF' + cols.map(function (c) { return cell(c.l); }).join(',') + '\n' +
      rows.map(function (r) { return cols.map(function (c) { return cell(c.v(r)); }).join(','); }).join('\n');
  }
  var SEARCH_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';
var VIEW_ICO = {
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>'
};

  function filterRows(rows, q, fields) {
    if (!q) return rows;
    q = q.toLowerCase();
    return rows.filter(function (r) {
      return fields.some(function (f) {
        var v = typeof f === 'function' ? f(r) : r[f];
        return String(v == null ? '' : v).toLowerCase().indexOf(q) !== -1;
      });
    });
  }
  function toolbarHtml(o) {
    o = o || {};
    var h = '<div class="list-toolbar">';
    if (o.search) h += '<div class="search-box">' + SEARCH_ICO + '<input type="search" id="' + o.searchId + '" placeholder="' + esc(o.placeholder || 'Buscar…') + '" autocomplete="off"></div>';
    (o.filters || []).forEach(function (f) {
      h += '<select id="' + f.id + '" class="filter-select">' + f.options.map(function (x) {
        return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + '</option>';
      }).join('') + '</select>';
    });
    h += '<span class="toolbar-spacer"></span>';
    if (o.extra) h += o.extra;
    (o.buttons || []).forEach(function (b) {
      h += '<button class="btn ' + (b.class || '') + '"' + (b.id ? ' id="' + b.id + '"' : '') + (b.attrs || '') + '>' + (b.html || esc(b.label)) + '</button>';
    });
    h += '</div>';
    if (o.countId) h += '<div class="list-count" id="' + o.countId + '">' + (o.countText || '') + '</div>';
    return h;
  }

  // Ordenar filas de una tabla arrastrando (drag & drop). Llama onReorder con la lista de ids.
  function enableRowSort(tbody, onReorder) {
    if (!tbody) return;
    var dragEl = null;
    function rows() { return $all('tr[data-id]', tbody); }
    rows().forEach(function (tr) {
      tr.draggable = true;
      tr.classList.add('sortable-row');
      tr.addEventListener('dragstart', function (e) {
        dragEl = tr; tr.classList.add('dragging');
        try { e.dataTransfer.setData('text/plain', tr.dataset.id); e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
      });
      tr.addEventListener('dragend', function () { tr.classList.remove('dragging'); dragEl = null; });
      tr.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      tr.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!dragEl || dragEl === tr) return;
        var list = rows();
        if (list.indexOf(dragEl) < list.indexOf(tr)) tbody.insertBefore(dragEl, tr.nextSibling);
        else tbody.insertBefore(dragEl, tr);
        dragEl.classList.remove('dragging');
        onReorder($all('tr[data-id]', tbody).map(function (r) { return r.dataset.id; }));
      });
    });
  }
  // Persiste el nuevo orden de position para una lista de ids.
  function saveOrder(table, ids) {
    return Promise.all(ids.map(function (id, i) {
      return SB.update(table, { id: 'eq.' + id }, { position: i });
    })).then(function () { invalidate(); toast('Orden guardado', 'ok'); })
      .catch(function (e) { toast(e.message, 'err'); });
  }

  /* =========================================================
   *  Formularios
   * ========================================================= */
  function specRowHtml(s) {
    s = s || {};
    return '<span class="spec-row" draggable="true">' +
      '<span class="drag-handle" title="Arrastrar para reordenar">⠿</span>' +
      '<input type="text" class="spec-k" placeholder="Clave (ej: Garantía)" value="' + esc(s.k || '') + '">' +
      '<input type="text" class="spec-v" placeholder="Valor (ej: 12 meses)" value="' + esc(s.v || '') + '">' +
      '<button type="button" class="btn sm danger" data-specs-rm title="Quitar fila">×</button>' +
      '</span>';
  }

  function fieldHtml(f, val) {
    val = val == null ? '' : val;
    var id = 'f_' + f.k;
    var wide = (f.t === 'image' || f.t === 'gallery' || f.t === 'textarea' || f.t === 'specs');
    var h = '<div class="field' + (wide ? ' full' : '') + '" data-field="' + f.k + '"><label for="' + id + '">' + esc(f.l) +
      (f.req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>';
    if (f.t === 'bool') {
      h += '<div class="check"><input type="checkbox" id="' + id + '" data-k="' + f.k + '"' + (val ? ' checked' : '') + '><span>Activado</span></div>';
    } else if (f.t === 'textarea') {
      h += '<textarea id="' + id + '" data-k="' + f.k + '">' + esc(val) + '</textarea>';
    } else if (f.t === 'color') {
      h += '<div style="display:flex;gap:10px;align-items:center"><input type="color" id="' + id + '" data-k="' + f.k + '" value="' + esc(val || '#7c3aed') + '"><input type="text" data-for="' + f.k + '" value="' + esc(val) + '"></div>';
    } else if (f.t === 'image') {
      h += '<div class="img-drop' + (val ? ' has-img' : '') + '" data-drop="' + f.k + '">' +
        '<img class="thumb" data-prev="' + f.k + '" src="' + esc(val ? SB.resolveImage(val, 160) : '') + '" alt="">' +
        '<input type="hidden" data-k="' + f.k + '" value="' + esc(val) + '">' +
        '<div class="img-drop-info">' +
          '<input type="file" accept="image/*" data-upload="' + f.k + '" aria-label="Subir ' + esc(f.l) + '">' +
          '<span class="help">Arrastra una imagen aquí o elige un archivo.</span>' +
          '<button type="button" class="btn sm ghost" data-clear="' + f.k + '"' + (val ? '' : ' disabled') + '>Quitar imagen</button>' +
        '</div></div>';
    } else if (f.t === 'gallery') {
      var gval = Array.isArray(val) ? val.join('\n') : (val || '');
      h += '<div class="gallery-field">' +
        '<div class="gallery-chips" data-chips="' + f.k + '"></div>' +
        '<textarea id="' + id + '" data-k="' + f.k + '" data-gallery-ta="' + f.k + '" rows="2" placeholder="Una ruta/URL por linea">' + esc(gval) + '</textarea>' +
        '<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input type="file" accept="image/*" multiple data-gallery-add="' + f.k + '"><span class="help">Arrastra las miniaturas para reordenar. Sube archivos para añadir.</span></div>' +
        '</div>';
    } else if (f.t === 'specs') {
      var srows = Array.isArray(val) ? val : [];
      h += '<div class="specs-field" data-specs="' + f.k + '">' +
        '<div class="specs-rows">' + srows.map(specRowHtml).join('') + '</div>' +
        '<button type="button" class="btn sm ghost" data-specs-add="' + f.k + '">+ Añadir fila</button>' +
        '</div>';
    } else if (f.t === 'ref') {
      var opts = '<option value="">— elegir —</option>';
      (S.cache[f.ref] || []).forEach(function (r) {
        opts += '<option value="' + esc(r.id) + '"' + (String(r.id) === String(val) ? ' selected' : '') + '>' + esc(r.name || r.label || r.key) + '</option>';
      });
      h += '<select id="' + id + '" data-k="' + f.k + '" data-ref="' + f.ref + '"' + (f.req ? ' required' : '') + '>' + opts + '</select>';
    } else if (f.t === 'money') {
      h += '<div class="money-wrap"><span class="money-cur">$</span>' +
        '<input type="text" inputmode="decimal" class="money-input" id="' + id + '" data-k="' + f.k + '"' +
        ' value="' + esc(val) + '"' + (f.req ? ' required' : '') + ' data-type="money"></div>';
    } else if (f.t === 'badge') {
      var cur = String(val || '');
      var opts = PRODUCT_BADGES.slice();
      if (cur && opts.indexOf(cur) === -1) opts.push(cur);
      h += '<div class="badge-opts" data-badge="' + f.k + '">' +
        '<input type="hidden" data-k="' + f.k + '" value="' + esc(cur) + '">' +
        opts.map(function (o) {
          var lbl = o === '' ? 'Sin etiqueta' : o;
          return '<button type="button" class="badge-opt' + (o === cur ? ' active' : '') + '" data-val="' + esc(o) + '"' +
            (o === '' ? '' : ' aria-pressed="' + (o === cur ? 'true' : 'false') + '"') + '>' + esc(lbl) + '</button>';
        }).join('') + '</div>';
    } else {
      h += '<input type="' + (f.t === 'number' ? 'number' : 'text') + '" id="' + id + '" data-k="' + f.k + '"' +
        (f.t === 'number' ? ' step="any"' : '') + ' value="' + esc(val) + '"' + (f.req ? ' required' : '') +
        ' data-type="' + (f.t || 'text') + '">';
    }
    if (f.help) h += '<div class="help">' + esc(f.help) + '</div>';
    return h + '</div>';
  }

  function renderForm(fields, values) {
    return fields.map(function (f) { return fieldHtml(f, values ? values[f.k] : ''); }).join('');
  }

  function readForm(fields, root) {
    var out = {};
    fields.forEach(function (f) {
      var node = root.querySelector('[data-k="' + f.k + '"]');
      if (!node) return;
      if (f.t === 'bool') out[f.k] = node.checked;
      else if (f.t === 'number') {
        var nv = node.value === '' ? null : Number(node.value);
        out[f.k] = (nv === null && (f.req || f.k === 'position')) ? 0 : nv;
      }
      else if (f.t === 'money') {
        var raw = String(node.value).replace(',', '.').replace(/[^0-9.\-]/g, '').trim();
        var mv = raw === '' ? null : Number(raw);
        out[f.k] = (mv === null || isNaN(mv)) ? (f.req ? 0 : null) : mv;
      }
      else if (f.t === 'ref') out[f.k] = node.value === '' ? null : (/^\d+$/.test(node.value) ? Number(node.value) : node.value);
      else if (f.t === 'color') out[f.k] = root.querySelector('[data-for="' + f.k + '"]').value.trim() || node.value;
      else if (f.t === 'gallery') out[f.k] = node.value.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
      else if (f.t === 'specs') {
        var srows = [];
        var wrap = root.querySelector('[data-specs="' + f.k + '"]');
        if (wrap) $all('.spec-row', wrap).forEach(function (r) {
          var kk = r.querySelector('.spec-k').value.trim();
          var vv = r.querySelector('.spec-v').value.trim();
          if (kk || vv) srows.push({ k: kk, v: vv });
        });
        out[f.k] = srows;
      }
      else out[f.k] = node.value.trim();
    });
    return out;
  }

  function wireForm(fields, root, formState) {
    // color: sincroniza picker <-> texto
    $all('[data-k]', root).forEach(function (picker) {
      if (picker.type !== 'color') return;
      var txt = root.querySelector('[data-for="' + picker.dataset.k + '"]');
      picker.addEventListener('input', function () { txt.value = picker.value; });
      txt.addEventListener('input', function () { if (/^#[0-9a-f]{6}$/i.test(txt.value)) picker.value = txt.value; });
    });
    // etiqueta: chips -> input hidden (mantiene readForm sin cambios)
    $all('[data-badge]', root).forEach(function (group) {
      var hidden = group.querySelector('input[data-k]');
      $all('.badge-opt', group).forEach(function (btn) {
        btn.addEventListener('click', function () {
          hidden.value = btn.dataset.val;
          $all('.badge-opt', group).forEach(function (b) {
            var on = b === btn;
            b.classList.toggle('active', on);
            if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          hidden.dispatchEvent(new Event('input', { bubbles: true }));
        });
      });
    });
    // subida de imágenes
    function doUpload(file, k, prev) {
      formState.uploading = (formState.uploading || 0) + 1;
      toast('Subiendo imagen…');
      return SB.upload('catalog', file).then(function (url) {
        root.querySelector('input[type=hidden][data-k="' + k + '"]').value = url;
        if (prev) { prev.src = url; prev.style.visibility = ''; }
        var zone = root.querySelector('[data-drop="' + k + '"]');
        if (zone) {
          zone.classList.add('has-img');
          var clr = zone.querySelector('[data-clear]');
          if (clr) clr.disabled = false;
        }
        toast('Imagen subida', 'ok');
        return url;
      }).catch(function (e) { toast('Error: ' + e.message, 'err'); })
        .then(function (r) { formState.uploading--; return r; });
    }
    $all('[data-upload]', root).forEach(function (input) {
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (file) doUpload(file, input.dataset.upload, root.querySelector('[data-prev="' + input.dataset.upload + '"]'));
      });
    });
    // zona drag & drop de imagen
    $all('[data-drop]', root).forEach(function (zone) {
      var k = zone.dataset.drop;
      zone.addEventListener('click', function (e) {
        if (e.target.closest('input, button')) return;
        var fileIn = zone.querySelector('input[type=file]');
        if (fileIn) fileIn.click();
      });
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('over'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('over'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('over');
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) doUpload(file, k, root.querySelector('[data-prev="' + k + '"]'));
      });
    });
    $all('[data-clear]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var k = btn.dataset.clear;
        root.querySelector('input[type=hidden][data-k="' + k + '"]').value = '';
        var prev = root.querySelector('[data-prev="' + k + '"]');
        if (prev) { prev.removeAttribute('src'); prev.style.visibility = 'hidden'; }
        var zone = root.querySelector('[data-drop="' + k + '"]');
        if (zone) zone.classList.remove('has-img');
        btn.disabled = true;
      });
    });
    // galería: chips reordenables + subida múltiple
    $all('[data-gallery-add]', root).forEach(function (fileIn) {
      var k = fileIn.dataset.galleryAdd;
      var ta = root.querySelector('[data-gallery-ta="' + k + '"]');
      var chips = root.querySelector('[data-chips="' + k + '"]');
      function lines() { return ta.value.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean); }
      function renderChips() {
        var arr = lines(), dragI = null;
        chips.innerHTML = arr.map(function (u, i) {
          return '<span class="chip" draggable="true" data-ci="' + i + '"><img src="' + esc(SB.resolveImage(u, 80)) + '" alt="">' +
            '<button type="button" class="chip-x" data-ci-rm="' + i + '">×</button></span>';
        }).join('');
        $all('[data-ci]', chips).forEach(function (ch) {
          ch.addEventListener('dragstart', function (e) { dragI = Number(ch.dataset.ci); ch.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', ch.dataset.ci); } catch (_) {} });
          ch.addEventListener('dragend', function () { ch.classList.remove('dragging'); });
          ch.addEventListener('dragover', function (e) { e.preventDefault(); });
          ch.addEventListener('drop', function (e) {
            e.preventDefault();
            var to = Number(ch.dataset.ci);
            if (dragI == null || dragI === to) return;
            var a = lines(); a.splice(to, 0, a.splice(dragI, 1)[0]);
            ta.value = a.join('\n'); renderChips();
          });
        });
        $all('[data-ci-rm]', chips).forEach(function (b) {
          b.addEventListener('click', function () { var a = lines(); a.splice(Number(b.dataset.ciRm), 1); ta.value = a.join('\n'); renderChips(); });
        });
      }
      ta.addEventListener('input', renderChips);
      fileIn.addEventListener('change', function () {
        var files = Array.prototype.slice.call(fileIn.files);
        if (!files.length) return;
        formState.uploading = (formState.uploading || 0) + files.length;
        toast('Subiendo ' + files.length + ' imagen(es)…');
        Promise.all(files.map(function (f) { return SB.upload('catalog', f); })).then(function (urls) {
          var a = lines(); urls.forEach(function (u) { if (u) a.push(u); });
          ta.value = a.join('\n'); renderChips(); toast('Imágenes añadidas', 'ok');
        }).catch(function (e) { toast(e.message, 'err'); })
          .then(function () { formState.uploading -= files.length; });
      });
      renderChips();
    });
    // especificaciones: filas clave/valor (añadir, quitar, reordenar)
    $all('[data-specs]', root).forEach(function (wrap) {
      var rowsEl = wrap.querySelector('.specs-rows');
      var addBtn = wrap.querySelector('[data-specs-add]');
      if (addBtn) addBtn.addEventListener('click', function () { rowsEl.insertAdjacentHTML('beforeend', specRowHtml({})); });
      var dragRow = null;
      rowsEl.addEventListener('dragstart', function (e) { var r = e.target.closest('.spec-row'); if (!r) return; dragRow = r; r.classList.add('dragging'); try { e.dataTransfer.setData('text/plain', '1'); e.dataTransfer.effectAllowed = 'move'; } catch (_) {} });
      rowsEl.addEventListener('dragend', function () { if (dragRow) dragRow.classList.remove('dragging'); dragRow = null; });
      rowsEl.addEventListener('dragover', function (e) { if (!dragRow) return; e.preventDefault(); var over = e.target.closest('.spec-row'); if (!over || over === dragRow) return; var r = rowsEl.getBoundingClientRect(); var after = (e.clientY - r.top) > r.height / 2; rowsEl.insertBefore(dragRow, after ? over.nextSibling : over); });
      wrap.addEventListener('click', function (e) { var rm = e.target.closest('[data-specs-rm]'); if (rm) rm.closest('.spec-row').remove(); });
    });
    // filtro dependiente: subcategory_id según category_id
    var catSel = root.querySelector('[data-k="category_id"][data-ref="categories"]');
    var subSel = root.querySelector('[data-k="subcategory_id"][data-ref="subcategories"]');
    if (catSel && subSel) {
      var applySubFilter = function () {
        var cid = catSel.value;
        var cur = subSel.value;
        var rows = (S.cache.subcategories || []).filter(function (s) { return !cid || String(s.category_id) === String(cid); });
        subSel.innerHTML = '<option value="">— elegir —</option>' + rows.map(function (s) {
          return '<option value="' + esc(s.id) + '"' + (String(s.id) === String(cur) ? ' selected' : '') + '>' + esc(s.name) + '</option>';
        }).join('');
      };
      catSel.addEventListener('change', applySubFilter);
      applySubFilter();
    }
  }

  /* =========================================================
   *  Asistente por pasos (productos, combos, categorías...)
   * =========================================================
   *  Idea: TODOS los campos quedan montados en el DOM; cada paso
   *  solo los muestra/oculta. Así readForm/wireForm/reportValidity
   *  y los handlers de imagen/galería/specs siguen funcionando sin
   *  cambios. */

  // Agrupa una lista de campos en pasos según su propiedad .step.
  function buildSteps(fields, meta) {
    var steps = meta.map(function (s) {
      return { title: s.title, short: s.short, sub: s.sub, icon: s.icon, fields: [] };
    });
    fields.forEach(function (f) {
      var i = f.step || 0;
      if (!steps[i]) i = 0;
      steps[i].fields.push(f);
    });
    return steps;
  }

  function flattenFields(steps) {
    var out = [];
    steps.forEach(function (s) { if (Array.isArray(s.fields)) out = out.concat(s.fields); });
    return out;
  }

  function openFormWizard(opts) {
    var steps = opts.steps || [];
    var values = opts.values || {};
    var allFields = flattenFields(steps);
    var cur = 0;
    var maxStep = opts.freeNav ? steps.length - 1 : 0;
    var formState = {};
    var single = steps.length <= 1;
    var horizontal = !!opts.horizontalSteps && !single;

    var stepsHtml = steps.map(function (s, i) {
      var hasFields = Array.isArray(s.fields);
      var body = s.review ? (opts.reviewHtml || '') :
        (hasFields ? '<div class="fgrid">' + renderForm(s.fields, values) + '</div>' : (s.html || ''));
      var head = (s.title && !single && !horizontal)
        ? '<div class="fstep-head"><h4>' + esc(s.title) + '</h4>' + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + '</div>'
        : '';
      return '<section class="fstep" data-step="' + i + '"' + (i ? ' hidden' : '') + '>' + head + body + '</section>';
    }).join('');

    var stepper = single ? '' : (horizontal
      ? '<div class="wiz-steps-h"><div class="wiz-steps-h-track">' + steps.map(function (s, i) {
          return '<button type="button" class="wiz-pill" data-goto="' + i + '">' +
            '<span class="wiz-pill-num">' + (i + 1) + '</span>' +
            '<span class="wiz-pill-txt"><span class="wiz-pill-title">' + esc(s.short || s.title || ('Paso ' + (i + 1))) + '</span>' +
            (s.sub ? '<span class="wiz-pill-sub">' + esc(s.sub) + '</span>' : '') + '</span>' +
          '</button>';
        }).join('') + '</div></div>'
      : '<div class="wiz-steps">' + steps.map(function (s, i) {
          return '<button type="button" class="wiz-dot" data-goto="' + i + '">' +
            '<span class="wiz-num">' + (i + 1) + '</span>' +
            '<span class="wiz-lbl">' + esc(s.short || s.title || ('Paso ' + (i + 1))) + '</span></button>';
        }).join('') + '</div>');

    var m = openModal({
      title: opts.title,
      size: opts.size || (horizontal ? 'fullscreen' : (steps.length > 2 ? 'lg' : '')),
      guard: opts.guard !== false,
      body: '<form id="entForm" novalidate><div class="wiz' + (single ? ' single' : '') + (horizontal ? ' horizontal' : '') + '">' +
        stepper + '<div class="wiz-body">' + stepsHtml + '</div></div></form>',
      buttons: opts.buttons
    });

    var foot = m.modal.querySelector('footer');
    var h3 = m.modal.querySelector('header h3');
    wireForm(allFields, m.body, formState);

    function stepEl(i) { return $('.fstep[data-step="' + i + '"]', m.body); }

    function stepInvalid(i) {
      var sec = stepEl(i);
      if (!sec) return null;
      var bad = null;
      $all('input, select, textarea', sec).forEach(function (n) {
        if (bad || n.disabled) return;
        if (typeof n.checkValidity === 'function' && !n.checkValidity()) bad = n;
      });
      return bad;
    }
    function validateStep(i) {
      if (single) return true;
      var bad = stepInvalid(i);
      if (bad) { bad.reportValidity(); if (bad.focus) bad.focus(); return false; }
      return true;
    }
    function invalidAny() {
      for (var i = 0; i < steps.length; i++) {
        var bad = stepInvalid(i);
        if (bad) return { step: i, node: bad };
      }
      return null;
    }

    function show(i) {
      $all('.fstep', m.body).forEach(function (el) { el.hidden = Number(el.dataset.step) !== i; });
      if (horizontal) {
        $all('.wiz-pill', m.body).forEach(function (d) {
          var n = Number(d.dataset.goto);
          d.classList.toggle('active', n === i);
          d.classList.toggle('done', n < i);
          d.disabled = n > maxStep;
          d.setAttribute('aria-selected', String(n === i));
        });
      } else {
        $all('.wiz-dot', m.body).forEach(function (d) {
          var n = Number(d.dataset.goto);
          d.classList.toggle('active', n === i);
          d.classList.toggle('done', n < i);
          d.disabled = n > maxStep;
        });
      }
      if (h3 && !single) h3.textContent = opts.title;
      m.body.scrollTop = 0;
      syncFooter();
      var activeDot = horizontal ? $('.wiz-pill.active', m.body) : $('.wiz-dot.active', m.body);
      if (activeDot && activeDot.scrollIntoView) activeDot.scrollIntoView({ block: 'nearest', inline: 'center' });
      var sec = stepEl(i);
      var target = sec && sec.querySelector('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea');
      if (target && !steps[i].review) target.focus();
      if (opts.onStep) opts.onStep(i, m.body);
    }
    function go(i) { cur = i; if (i > maxStep) maxStep = i; show(cur); }

    function syncFooter() {
      var specs = [{ label: 'Cancelar', class: 'ghost', onClick: requestClose }];
      if (!single) {
        specs.push({ spacer: true });
        if (cur > 0) specs.push({ label: '← Anterior', onClick: function () { go(cur - 1); } });
        if (cur < steps.length - 1) {
          specs.push({ label: 'Siguiente →', class: 'primary', onClick: function () { if (validateStep(cur)) go(cur + 1); } });
        } else {
          specs.push({ label: opts.saveLabel || 'Guardar', class: 'primary', onClick: doSave, attrs: { title: 'Guardar (Ctrl + Enter)' } });
        }
      } else {
        specs.push({ spacer: true });
        specs.push({ label: opts.saveLabel || 'Guardar', class: 'primary', onClick: doSave, attrs: { title: 'Guardar (Ctrl + Enter)' } });
      }
      fillFooter(foot, specs);
    }

    function doSave() {
      if (formState.uploading) return toast('Espera: subiendo imagen…', 'err');
      var bad = invalidAny();
      if (bad) {
        if (bad.step !== cur) go(bad.step);
        setTimeout(function () { bad.node.reportValidity(); if (bad.node.focus) bad.node.focus(); }, 0);
        return;
      }
      return opts.onSave(readForm(allFields, m.body), m);
    }

    function advance() { if (cur < steps.length - 1) { if (validateStep(cur)) go(cur + 1); } else doSave(); }

    // Navegación por los puntos del stepper (solo hasta el paso más lejano alcanzado).
    $all(horizontal ? '.wiz-pill' : '.wiz-dot', m.body).forEach(function (d) {
      d.addEventListener('click', function () { var n = Number(d.dataset.goto); if (n <= maxStep) go(n); });
    });
    // Enter avanza de paso (no en textarea ni en inputs de archivo).
    m.body.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); doSave(); return; }
      if (single) return;
      var t = e.target;
      if ((t.tagName === 'INPUT' && t.type !== 'file') || t.tagName === 'SELECT') { e.preventDefault(); advance(); }
    });

    wireReview(m, opts, allFields);
    show(0);
    return { body: m.body, modal: m.modal, close: closeModal, go: go };
  }

  // Vista previa en vivo (paso "Revisar") reutilizando el markup de .pcard.
  function wireReview(m, opts, allFields) {
    var host = $('#wizPreview', m.body);
    if (!host) return;
    function render() {
      var v = readForm(allFields, m.body);
      var badge = typeof v.badge === 'string' ? v.badge : '';
      var specs = Array.isArray(v.specs) ? v.specs.filter(function (s) { return s.k || s.v; }).length : 0;
      host.innerHTML =
        '<div class="review-preview">' +
          '<span class="review-preview-label">Vista previa en la tienda</span>' +
          '<div class="pcard">' +
            '<div class="pcard-img">' +
              (v.image ? '<img src="' + esc(SB.resolveImage(v.image, 480)) + '" alt="">' : '<div class="pcard-ph">Sin imagen</div>') +
              (badge ? '<span class="pcard-badge">' + esc(badge) + '</span>' : '') +
              (v.hidden ? '<span class="pcard-hidden">Oculto</span>' : '') +
            '</div>' +
            '<div class="pcard-body">' +
              '<div class="pcard-name">' + esc(v.name || 'Nombre del producto') + '</div>' +
              (v.sub ? '<div class="pcard-sub">' + esc(v.sub) + '</div>' : '') +
              '<div class="pcard-meta"><span class="pcard-price"><strong>' + esc(money(v.price)) + '</strong></span>' +
                (v.category_id ? '<span class="pcard-cat">' + esc(refName('categories', v.category_id)) + '</span>' : '') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<ul class="review-list">' +
          revRow('Nombre', v.name || '—') +
          revRow('Precio', money(v.price)) +
          (v.original_price != null && v.original_price !== '' ? revRow('Antes', money(v.original_price)) : '') +
          revRow('Etiqueta', badge || 'Sin etiqueta') +
          revRow('Categoría', v.category_id ? refName('categories', v.category_id) : '—') +
          revRow('Subcategoría', v.subcategory_id ? refName('subcategories', v.subcategory_id) : '—') +
          revRow('Ficha', specs + ' fila(s)') +
          revRow('Estado', v.hidden ? 'Oculto' : 'Visible') +
        '</ul>';
    }
    function revRow(k, val) { return '<li><span class="k">' + esc(k) + '</span><span>' + esc(val) + '</span></li>'; }
    m.body.addEventListener('input', render);
    m.body.addEventListener('change', render);
    render();
  }

  /* =========================================================
   *  Lista CRUD genérica
   * ========================================================= */
  function renderEntityList(key, mount, opts) {
    opts = opts || {};
    var ent = ENTITIES[key];
    var title = opts.title || ent.title;
    var run = function () {
    mount.innerHTML = skeleton(4);
    var deps = ent.fields.filter(function (f) { return f.t === 'ref'; }).map(function (f) { return f.ref; });
    var uniq = deps.filter(function (d, i) { return deps.indexOf(d) === i; });
    var sortable = ent.fields.some(function (f) { return f.k === 'position'; });
    Promise.all(uniq.map(function (t) { return S.cache[t] ? null : load(t, { select: '*', order: 'position.asc,id.asc' }); }))
      .then(function () { return load(key, { select: '*', order: ent.order }); })
      .then(function (rows) {
        var uiTag = opts.uiKey || key;
        var saved = uiGet(uiTag, {});
        var allowBulk = !opts.onRowClick;
        var hasHidden = ent.fields.some(function (f) { return f.k === 'hidden'; });
        var state = { q: saved.q || '', sort: saved.sort || (sortable ? 'position' : '') };
        var sel = {};
        function persist() { uiSet(uiTag, { q: state.q, sort: state.sort }); }
        function baseRows() {
          if (opts.filterField && opts.filterValue != null && opts.filterValue !== '') {
            return rows.filter(function (r) { return String(r[opts.filterField]) === String(opts.filterValue); });
          }
          return rows;
        }
        draw();

        function searchFields() {
          return ent.cols.map(function (c) { return function (r) { return r[c.k]; }; })
            .concat([function (r) { return r.name; }]);
        }
        function labelOf(r) { return r && (r.name || r.label || r.key || r.slug); }
        function sortRows(arr) {
          if (!state.sort || state.sort === 'position') return arr;
          var p = state.sort.split(':'), k = p[0], dir = p[1] === 'desc' ? -1 : 1;
          return arr.slice().sort(function (a, b) {
            var av = a[k], bv = b[k];
            if (typeof av === 'number' || typeof bv === 'number') { av = Number(av) || 0; bv = Number(bv) || 0; return (av - bv) * dir; }
            av = String(av == null ? '' : av).toLowerCase(); bv = String(bv == null ? '' : bv).toLowerCase();
            return av < bv ? -dir : av > bv ? dir : 0;
          });
        }
        function sortOptions() {
          var o = sortable ? [['position', 'Orden manual']] : [];
          ent.cols.forEach(function (c) { o.push([c.k + ':asc', c.l + ' ↑']); o.push([c.k + ':desc', c.l + ' ↓']); });
          return o;
        }
        function byId(id) { return rows.filter(function (r) { return String(r.id) === String(id); })[0]; }

        function draw() {
          var btns = [];
          if (!opts.hideCsv) btns.push({ label: 'Exportar CSV', id: 'csvBtn', class: 'ghost' });
          if (!opts.hideNew) btns.push({ label: '+ Nuevo', id: 'newBtn', class: 'primary' });
          var html = toolbarHtml({
            search: true, searchId: 'entQ', placeholder: 'Buscar ' + title.toLowerCase() + '…',
            filters: [{ id: 'entSort', options: sortOptions() }],
            countId: 'entCount', countText: opts.countText,
            buttons: btns
          }) + (opts.hint ? '<p class="muted" style="font-size:12.5px;margin:0 0 8px">' + esc(opts.hint) + '</p>' : '') +
            '<div id="entBulk" class="bulkbar" hidden></div><div id="entBody"></div>';
          mount.innerHTML = html;
          $('#entQ', mount).value = state.q;
          $('#entSort', mount).value = state.sort;
          renderBody();
          $('#entQ', mount).addEventListener('input', function () { state.q = this.value; persist(); renderBody(); });
          $('#entSort', mount).addEventListener('change', function () { state.sort = this.value; persist(); renderBody(); });
          if ($('#newBtn', mount)) $('#newBtn', mount).addEventListener('click', function () { openEditor(null); });
          if ($('#csvBtn', mount)) $('#csvBtn', mount).addEventListener('click', exportCsv);
          if (allowBulk) {
            $('#entBulk', mount).addEventListener('click', function (e) {
              var h = e.target.closest('[data-bulk-hidden]');
              if (h) { bulkHidden(h.dataset.bulkHidden === '1'); return; }
              if (e.target.closest('[data-bulk-del]')) { bulkDelete(); return; }
              if (e.target.closest('[data-bulk-clear]')) { sel = {}; renderBody(); return; }
            });
          }
        }

        function renderBody() {
          var body = $('#entBody', mount);
          var all = baseRows();
          var view = sortRows(filterRows(all, state.q, searchFields()));
          $('#entCount', mount).textContent = view.length + ' de ' + all.length + ' registro(s)';
          updateBulk();
          if (!all.length) {
            body.innerHTML = emptyState('Sin ' + title.toLowerCase() + ' todavía', opts.emptySub || 'Crea el primer registro para empezar.', opts.hideNew ? null : 'Nuevo', 'emptyNew');
            var eb = $('#emptyNew', body); if (eb) eb.addEventListener('click', function () { openEditor(null); });
            return;
          }
          if (!view.length) { body.innerHTML = '<div class="card empty">' + esc(opts.emptyFilter || ('Nada coincide con «' + state.q + '».')) + '</div>'; return; }
          var allChecked = allowBulk && view.length && view.every(function (r) { return sel[r.id]; });
          body.innerHTML = '<div class="card" style="padding:0;overflow:auto"><table class="responsive' + (state.sort === 'position' && sortable ? ' sortable' : '') + '"><thead><tr>' +
            (allowBulk ? '<th class="pick-h"><input type="checkbox" data-all' + (allChecked ? ' checked' : '') + ' title="Seleccionar todo"></th>' : '') +
            (state.sort === 'position' && sortable ? '<th class="drag-h"></th>' : '') +
            ent.cols.map(function (c) { return '<th class="sort-th" data-sortkey="' + esc(c.k) + '">' + esc(c.l) + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
            view.map(function (r) {
              var isSel = opts.selectedId != null && String(r.id) === String(opts.selectedId);
              var cls = [];
              if (opts.onRowClick) cls.push('row-click');
              if (isSel) cls.push('selected');
              if (sel[r.id]) cls.push('picked');
              return '<tr data-id="' + esc(r.id) + '"' + (cls.length ? ' class="' + cls.join(' ') + '"' : '') + '>' +
                (allowBulk ? '<td class="pick-cell" data-label=""><input type="checkbox" data-sel="' + esc(r.id) + '"' + (sel[r.id] ? ' checked' : '') + '></td>' : '') +
                (state.sort === 'position' && sortable ? '<td class="drag-cell" data-label=""><span class="drag-handle" title="Arrastrar para ordenar">⠿</span></td>' : '') +
                ent.cols.map(function (c) {
                  var v = r[c.k];
                  return '<td data-label="' + esc(c.l) + '">' + (c.r ? c.r(v, r) : esc(v == null ? '' : v)) + '</td>';
                }).join('') +
                '<td data-label=""><div class="list-actions icon-actions">' + entityActions(r) + '</div></td></tr>';
            }).join('') + '</tbody></table></div>';

          body.onclick = function (e) {
            var t = e.target;
            if (t.matches('[data-sel]') || t.matches('[data-all]')) return;
            var th = t.closest('[data-sortkey]');
            if (th) { cycleSort(th.dataset.sortkey); return; }
            var mb = t.closest('[data-menu]');
            if (mb) { openActMenu(mb); return; }
            var ed = t.closest('[data-edit]');
            if (ed) { openEditor(byId(ed.dataset.edit)); return; }
            var de = t.closest('[data-del]');
            if (de) { doDelete(de.dataset.del); return; }
            if (opts.onRowClick) {
              var tr = t.closest('tr[data-id]');
              if (tr) { var row = byId(tr.dataset.id); if (row) opts.onRowClick(row); }
            }
          };
          if (allowBulk) body.onchange = function (e) {
            var t = e.target;
            if (t.matches('[data-all]')) {
              view.forEach(function (r) { if (t.checked) sel[r.id] = true; else delete sel[r.id]; });
              renderBody(); return;
            }
            if (t.matches('[data-sel]')) {
              if (t.checked) sel[t.dataset.sel] = true; else delete sel[t.dataset.sel];
              var tr = t.closest('tr'); if (tr) tr.classList.toggle('picked', !!sel[t.dataset.sel]);
              updateBulk();
            }
          };
          if (state.sort === 'position' && sortable) enableRowSort($('tbody', body), function (ids) {
            saveOrder(key, ids); logActivity('Reordenó ' + title.toLowerCase());
          });
        }

        function cycleSort(k) {
          var cur = state.sort.split(':');
          var dir = cur[0] === k && cur[1] === 'asc' ? 'desc' : 'asc';
          state.sort = k + ':' + dir; persist();
          var s = $('#entSort', mount);
          if (s) {
            if (!Array.prototype.some.call(s.options, function (o) { return o.value === state.sort; })) {
              var o = document.createElement('option'); o.value = state.sort; o.textContent = 'Orden: ' + state.sort; s.appendChild(o);
            }
            s.value = state.sort;
          }
          renderBody();
        }
        function selectedIds() { return Object.keys(sel).filter(function (id) { return sel[id]; }); }
        function updateBulk() {
          var bar = $('#entBulk', mount); if (!bar || !allowBulk) return;
          var ids = selectedIds();
          if (!ids.length) { bar.hidden = true; bar.innerHTML = ''; return; }
          bar.hidden = false;
          bar.innerHTML = '<span class="bulk-count">' + ids.length + ' seleccionado(s)</span>' +
            (hasHidden ? '<button class="btn sm" data-bulk-hidden="1">Ocultar</button><button class="btn sm" data-bulk-hidden="0">Mostrar</button>' : '') +
            '<button class="btn sm danger" data-bulk-del>Borrar</button>' +
            '<span class="toolbar-spacer"></span>' +
            '<button class="btn sm ghost" data-bulk-clear>Quitar selección</button>';
        }
        function bulkHidden(hidden) {
          var ids = selectedIds(); if (!ids.length || !hasHidden) return;
          Promise.all(ids.map(function (id) { return SB.update(key, { id: 'eq.' + id }, { hidden: hidden }); }))
            .then(function () {
              ids.forEach(function (id) { var r = byId(id); if (r) r.hidden = hidden; });
              toast(hidden ? 'Ocultados' : 'Mostrados', 'ok');
              logActivity((hidden ? 'Ocultó ' : 'Mostró ') + ids.length + ' registro(s)');
              sel = {}; renderBody();
            }).catch(function (e) { toast(e.message, 'err'); });
        }
        function bulkDelete() {
          var ids = selectedIds(); if (!ids.length) return;
          confirmDialog('¿Eliminar ' + ids.length + ' registro(s)? No se puede deshacer.', function () {
            Promise.all(ids.map(function (id) { return SB.remove(key, { id: 'eq.' + id }); }))
              .then(function () {
                toast(ids.length + ' eliminado(s)', 'ok');
                logActivity('Eliminó ' + ids.length + ' ' + ent.title.toLowerCase());
                sel = {}; invalidate(); reload();
              }).catch(function (e) { toast(e.message, 'err'); });
          }, { dangerLabel: 'Eliminar' });
        }

        function reload() { return load(key, { select: '*', order: ent.order }).then(function (r2) { rows = r2; sel = {}; renderBody(); }); }

        function doDelete(id) {
          var row = rows.filter(function (r) { return String(r.id) === id; })[0];
          confirmDialog('¿Eliminar «' + (labelOf(row) || 'este registro') + '»?', function () {
            removeWithUndo(key, row, { label: 'Registro eliminado', after: reload });
            logActivity('Eliminó ' + ent.title.toLowerCase() + ': ' + (labelOf(row) || id));
          });
        }

        function exportCsv() {
          var cols = ent.cols.map(function (c) {
            return { l: c.l, v: function (r) { return c.r ? String(c.r(r[c.k], r)).replace(/<[^>]+>/g, '') : r[c.k]; } };
          });
          downloadBlob(key + '-' + Date.now() + '.csv', toCSV(rows, cols), 'text/csv;charset=utf-8');
        }

        function openEditor(row) {
          if (ent.steps) {
            var isProdEnt = key === 'products';
            openFormWizard({
              title: (row ? 'Editar ' : 'Nuevo ') + ent.title.toLowerCase(),
              steps: buildSteps(ent.fields, ent.steps),
              values: row || { position: rows.length },
              freeNav: !!row,
              horizontalSteps: isProdEnt,
              size: isProdEnt ? 'fullscreen' : undefined,
              onSave: function (data) {
                if (!row) data.store_id = sid();
                var p = row ? SB.update(key, { id: 'eq.' + row.id }, data) : SB.insert(key, data);
                return p.then(function () {
                  closeModal(); invalidate(); toast('Guardado', 'ok');
                  logActivity((row ? 'Editó ' : 'Creó ') + ent.title.toLowerCase() + ': ' + (data[ent.cols[0].k] || ''));
                  reload();
                }).catch(function (e) { toast(e.message, 'err'); });
              }
            });
            return;
          }
          var formState = {};
          var m = openModal({
            title: (row ? 'Editar ' : 'Nuevo ') + ent.title.toLowerCase(),
            body: '<form id="entForm">' + renderForm(ent.fields, row || { position: rows.length }) + '</form>',
            guard: true,
            buttons: [
              { label: 'Cancelar', onClick: closeModal },
              { label: 'Guardar', class: 'primary', onClick: save }
            ]
          });
          wireForm(ent.fields, m.body, formState);

          function save() {
            if (formState.uploading) return toast('Espera: subiendo imagen…', 'err');
            var form = $('#entForm', m.body);
            if (!form.reportValidity()) return;
            var data = readForm(ent.fields, m.body);
            if (!row) data.store_id = sid();
            var p = row ? SB.update(key, { id: 'eq.' + row.id }, data) : SB.insert(key, data);
            return p.then(function () {
              closeModal(); invalidate(); toast('Guardado', 'ok');
              logActivity((row ? 'Editó ' : 'Creó ') + ent.title.toLowerCase() + ': ' + (data[ent.cols[0].k] || ''));
              reload();
            }).catch(function (e) { toast(e.message, 'err'); });
          }
        }
      }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  /* =========================================================
   *  Productos (type = product)
   * ========================================================= */
  var PRODUCT_BADGES = ['', 'Top Ventas', 'Destacado', 'Nuevo', 'Oferta', 'Popular'];

  var PRODUCT_FIELDS = [
    { k: 'name', l: 'Nombre del producto', req: true, step: 0 },
    { k: 'sub', l: 'Subtítulo para la tarjeta', step: 0 },
    { k: 'badge', l: 'Etiqueta promocional', t: 'badge', step: 0 },
    { k: 'price', l: 'Precio de venta', t: 'money', req: true, step: 1 },
    { k: 'original_price', l: 'Precio anterior (tachado)', t: 'money', step: 1, help: 'Se muestra solo si es mayor al precio de venta.' },
    { k: 'position', l: 'Orden en listado', t: 'number', step: 1 },
    { k: 'image', l: 'Imagen principal', t: 'image', step: 2, help: 'Recomendado 800x800 px o superior. Formato JPG/WEBP/PNG.' },
    { k: 'images', l: 'Galería de imágenes', t: 'gallery', step: 2, help: 'Añade varias vistas del producto. Puedes reordenarlas arrastrando.' },
    { k: 'description', l: 'Descripción del producto', t: 'textarea', help: 'Se muestra en la ficha. Si se deja vacío, no aparece.', step: 2 },
    { k: 'specs', l: 'Especificaciones técnicas', t: 'specs', help: 'Clave/valor. Usa nombres claros: Marca, Modelo, Garantía, etc.', step: 2 },
    { k: 'category_id', l: 'Categoría', t: 'ref', ref: 'categories', step: 3 },
    { k: 'subcategory_id', l: 'Subcategoría', t: 'ref', ref: 'subcategories', step: 3 },
    { k: 'featured', l: 'Destacar en inicio', t: 'bool', step: 3 },
    { k: 'hidden', l: 'Ocultar en tienda', t: 'bool', step: 3 }
  ];

  // Metadatos de los pasos del asistente (agrupan PRODUCT_FIELDS por .step).
  var PRODUCT_STEPS = [
    { title: 'Identidad', short: 'Identidad', sub: 'Nombre, subtítulo y etiqueta.' },
    { title: 'Precios', short: 'Precios', sub: 'Precio, oferta y orden.' },
    { title: 'Imágenes y contenido', short: 'Contenido', sub: 'Foto principal, galería, descripción y fichas.' },
    { title: 'Organización', short: 'Organizar', sub: 'Categorías y visibilidad.' }
  ];

  // Filas de especificaciones precargadas al crear un producto nuevo.
  // Son editables; el admin puede completarlas, cambiarlas o quitarlas.
  var DEFAULT_PRODUCT_SPECS = [
    { k: 'Modelo', v: '' },
    { k: 'Resumen técnico', v: '' },
    { k: 'Condición', v: 'Nuevo · sellado de fábrica' },
    { k: 'Garantía', v: '12 meses' },
    { k: 'Disponibilidad', v: 'En stock · zulia' },
    { k: 'Envío', v: 'A toda Venezuela' }
  ];

  // Mismo texto que mostraba la ficha antes (editable; si lo vacías, la
  // sección "Descripción" deja de salir en la tienda).
  var DEFAULT_PRODUCT_DESCRIPTION = [
    'Seleccionado por el equipo técnico de MANIAWORLD y probado en banco de pruebas antes de salir a la venta, garantizando rendimiento estable, temperaturas controladas y compatibilidad verificada con los estándares actuales de la industria.',
    'El producto se entrega nuevo y sellado de fábrica, con su empaque original, manuales, accesorios completos y certificados de cumplimiento. Incluye garantía de 12 meses por fallas de fabricación, asistencia técnica especializada para la instalación y configuración inicial, así como soporte postventa directo por WhatsApp con nuestro personal en zulia.',
    'MANIAWORLD despacha a domicilio a toda Venezuela: zulia (24-48h), Valencia y Maracaibo (48-72h) y resto del país de 3 a 5 días hábiles. Aceptamos transferencia bancaria, Pago Móvil, Zelle, tarjetas de crédito y débito, así como pago contra entrega en zonas cubiertas. Consulta disponibilidad exacta, descuentos por cantidad y opciones de financiamiento antes de finalizar tu compra.',
    '¿Dudas sobre compatibilidad con tu equipo actual? Escríbenos antes de comprar y te asesoramos con la instalación, la actualización de firmware y las mejores alternativas de precio dentro del catálogo de la tienda.'
  ].join('\n\n');

  function renderProducts(mount) {
    renderTyped('product', PRODUCT_FIELDS, 'Productos', mount, false, 'productos');
  }
  function renderCombos(mount) {
    renderTyped('combo', COMBO_FIELDS, 'Combos', mount, true, 'combos');
  }

  var COMBO_FIELDS = [
    { k: 'name', l: 'Nombre', req: true, step: 0 },
    { k: 'sub', l: 'Subtítulo', step: 0 },
    { k: 'badge', l: 'Etiqueta', t: 'badge', step: 0 },
    { k: 'price', l: 'Precio', t: 'money', req: true, step: 1 },
    { k: 'position', l: 'Posición', t: 'number', step: 1 },
    { k: 'image', l: 'Imagen base', t: 'image', step: 2, help: 'Fondo del compositor. Si la dejas vacía, al generar se usará la imagen de la primera pieza.' },
    { k: 'images', l: 'Galería (para la imagen del combo)', t: 'gallery', step: 2, help: 'Sube 1 o varias imágenes; luego podrás combinarlas en una sola desde “Piezas e imagen”.' },
    { k: 'category_id', l: 'Categoría', t: 'ref', ref: 'categories', step: 2 },
    { k: 'hidden', l: 'Oculto', t: 'bool', step: 2 }
  ];

  var COMBO_STEPS = [
    { title: 'Identidad', short: 'Identidad', sub: 'Nombre y presentación del combo.' },
    { title: 'Precio', short: 'Precio', sub: 'Precio de venta del combo.' },
    { title: 'Clasificación', short: 'Clasificar', sub: 'Imagen, categoría y visibilidad.' }
  ];

  function renderTyped(type, fields, title, mount, isCombo, tabKey) {
    var noun = isCombo ? 'combo' : 'producto';
    tabKey = tabKey || (isCombo ? 'combos' : 'productos');
    var run = function () {
    mount.innerHTML = uiGet(tabKey, {}).view === 'table' ? skeleton(6) : productSkeleton();
    Promise.all([
      S.cache.categories ? null : load('categories', { select: '*', order: 'position.asc,id.asc' }),
      S.cache.subcategories ? null : load('subcategories', { select: '*', order: 'position.asc,id.asc' })
    ]).then(function () {
      return load('products', { select: '*', type: 'eq.' + type, order: 'position.asc,id.asc' });
    }).then(function (rows) {
      var saved = uiGet(tabKey, {});
      var state = {
        q: saved.q || '', cat: saved.cat || '', status: saved.status || '',
        view: saved.view || 'cards', sort: saved.sort || 'position'
      };
      var sel = {};
      if (PENDING[tabKey]) { for (var pk in PENDING[tabKey]) state[pk] = PENDING[tabKey][pk]; PENDING[tabKey] = null; }
      function persist() { uiSet(tabKey, { q: state.q, cat: state.cat, status: state.status, view: state.view, sort: state.sort }); }
      function clearFilters() {
        state.q = ''; state.cat = ''; state.status = ''; delete state.missing;
        persist(); draw();
      }
      draw();

      function catOptions() {
        return [['', 'Todas las categorías']].concat((S.cache.categories || []).map(function (c) { return [String(c.id), c.name]; }));
      }
      function searchFields() {
        return ['name', 'sub', 'badge', function (r) { return refName('categories', r.category_id); }];
      }
      function sortRows(arr) {
        if (!state.sort || state.sort === 'position') return arr;
        var parts = state.sort.split(':'), k = parts[0], dir = parts[1] === 'desc' ? -1 : 1;
        return arr.slice().sort(function (a, b) {
          var av, bv;
          if (k === 'category') { av = refName('categories', a.category_id); bv = refName('categories', b.category_id); }
          else if (k === 'price') { av = Number(a.price) || 0; bv = Number(b.price) || 0; }
          else if (k === 'status') { av = a.hidden ? 1 : 0; bv = b.hidden ? 1 : 0; }
          else { av = a[k]; bv = b[k]; }
          if (typeof av === 'string' || typeof bv === 'string') {
            av = String(av == null ? '' : av).toLowerCase(); bv = String(bv == null ? '' : bv).toLowerCase();
            return av < bv ? -dir : av > bv ? dir : 0;
          }
          return (av - bv) * dir;
        });
      }
      function visibleRows() {
        var v = filterRows(rows, state.q, searchFields());
        if (state.cat) v = v.filter(function (r) { return String(r.category_id) === state.cat; });
        if (state.status) v = v.filter(function (r) { return state.status === 'hidden' ? !!r.hidden : !r.hidden; });
        if (state.missing === 'image') v = v.filter(function (r) { return !r.image; });
        return sortRows(v);
      }
      function sortOptions() {
        return [
          ['position', 'Orden manual'], ['name:asc', 'Nombre ↑'], ['name:desc', 'Nombre ↓'],
          ['price:asc', 'Precio ↑'], ['price:desc', 'Precio ↓'], ['status', 'Visibles primero']
        ];
      }

      function draw() {
        var html = toolbarHtml({
          search: true, searchId: 'pQ', placeholder: 'Buscar ' + esc(title.toLowerCase()) + '…',
          filters: [
            { id: 'pCat', options: catOptions() },
            { id: 'pStatus', options: [['', 'Todos los estados'], ['visible', 'Visibles'], ['hidden', 'Ocultos']] },
            { id: 'pSort', options: sortOptions() }
          ],
          countId: 'pCount',
          extra: '<div class="view-toggle" role="group" aria-label="Vista">' +
            '<button type="button" data-view="cards" aria-pressed="' + (state.view === 'cards') + '" aria-label="Vista de tarjetas" title="Tarjetas">' + VIEW_ICO.cards + '</button>' +
            '<button type="button" data-view="table" aria-pressed="' + (state.view === 'table') + '" aria-label="Vista de lista" title="Lista">' + VIEW_ICO.table + '</button>' +
            '</div>',
          buttons: [
            { label: 'Exportar CSV', id: 'csvBtn', class: 'ghost' },
            { label: '+ Nuevo', id: 'newBtn', class: 'primary' }
          ]
        }) + '<div id="pBulk" class="bulkbar" hidden></div><div id="pBody"></div>';
        mount.innerHTML = html;
        $('#pQ', mount).value = state.q;
        $('#pCat', mount).value = state.cat;
        $('#pStatus', mount).value = state.status;
        $('#pSort', mount).value = state.sort;
        renderBody();
        $('#pQ', mount).addEventListener('input', function () { state.q = this.value; persist(); renderBody(); });
        $('#pCat', mount).addEventListener('change', function () { state.cat = this.value; persist(); renderBody(); });
        $('#pStatus', mount).addEventListener('change', function () { state.status = this.value; persist(); renderBody(); });
        $('#pSort', mount).addEventListener('change', function () { state.sort = this.value; persist(); renderBody(); });
        $all('[data-view]', mount).forEach(function (b) {
          b.addEventListener('click', function () {
            if (state.view === b.dataset.view) return;
            state.view = b.dataset.view; persist();
            $all('[data-view]', mount).forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.view === state.view)); });
            renderBody();
          });
        });
        $('#newBtn', mount).addEventListener('click', function () { openEditor(null); });
        $('#csvBtn', mount).addEventListener('click', exportCsv);
        $('#pBulk', mount).addEventListener('click', function (e) {
          var h = e.target.closest('[data-bulk-hidden]');
          if (h) { bulkHidden(h.dataset.bulkHidden === '1'); return; }
          if (e.target.closest('[data-bulk-del]')) { bulkDelete(); return; }
          if (e.target.closest('[data-bulk-clear]')) { sel = {}; renderBody(); return; }
        });
        $('#pBulk', mount).addEventListener('change', function (e) {
          if (e.target.matches('[data-bulk-cat]') && e.target.value) bulkCategory(e.target.value);
        });
      }

      function renderBody() {
        var body = $('#pBody', mount);
        var view = visibleRows();
        var filtersOn = [state.q, state.cat, state.status, state.missing].filter(Boolean).length;
        var hiddenN = rows.filter(function (r) { return !!r.hidden; }).length;
        var count = $('#pCount', mount);
        if (count) {
          count.innerHTML = '<span class="list-count-txt">' + view.length + ' de ' + rows.length + ' ' + esc(title.toLowerCase()) +
            ' <span class="count-sep">·</span> ' + hiddenN + ' oculto' + (hiddenN === 1 ? '' : 's') +
            (filtersOn ? ' <span class="count-sep">·</span> filtros activos' : '') + '</span>' +
            (filtersOn ? '<button type="button" class="link-btn" data-clear-filters>Limpiar filtros</button>' : '');
          var cf = $('[data-clear-filters]', count);
          if (cf) cf.addEventListener('click', clearFilters);
        }
        updateBulk();
        if (!rows.length) {
          body.innerHTML = emptyState('Sin ' + title.toLowerCase() + ' todavía', 'Añade tu primer ' + noun + ' para mostrarlo en la tienda.', 'Nuevo', 'emptyNew', svgIcon(isCombo ? 'combos' : 'productos'));
          var eb = $('#emptyNew', body); if (eb) eb.addEventListener('click', function () { openEditor(null); });
          return;
        }
        if (!view.length) {
          body.innerHTML = '<div class="card empty"><div class="empty-ico">' + SEARCH_ICO + '</div>' +
            '<div class="empty-title">Sin resultados</div>' +
            '<p class="muted">Ningún ' + noun + ' coincide con la búsqueda o los filtros.</p>' +
            '<button type="button" class="btn sm" data-clear-filters>Limpiar filtros</button></div>';
          var cb = $('[data-clear-filters]', body); if (cb) cb.addEventListener('click', clearFilters);
          return;
        }

        if (state.view === 'cards') {
          body.innerHTML = '<div class="pcard-grid">' + view.map(function (r) {
            var cat = refName('categories', r.category_id);
            return '<div class="pcard' + (sel[r.id] ? ' picked' : '') + (r.hidden ? ' is-hidden' : '') + '" data-id="' + esc(r.id) + '">' +
              '<label class="pcard-pick" title="Seleccionar"><input type="checkbox" data-sel="' + esc(r.id) + '"' + (sel[r.id] ? ' checked' : '') + '></label>' +
              '<div class="pcard-img">' +
                (r.image ? '<img src="' + esc(SB.resolveImage(r.image, 480)) + '" alt="" loading="lazy" decoding="async">' :
                  '<span class="pcard-noimg">' + svgIcon(isCombo ? 'combos' : 'productos') + 'Sin imagen</span>') +
                (r.badge ? '<span class="pcard-badge">' + esc(r.badge) + '</span>' : '') +
                (r.hidden ? '<span class="pcard-hidden">Oculto</span>' : '') +
              '</div>' +
              '<div class="pcard-body">' +
                '<div class="pcard-name" title="' + esc(r.name) + '">' + esc(r.name) + '</div>' +
                (r.sub ? '<div class="pcard-sub">' + esc(r.sub) + '</div>' : '') +
                '<div class="pcard-meta">' +
                  '<div class="pcard-price"><span class="cur">$</span><input class="inline-price" type="text" inputmode="decimal" aria-label="Precio de ' + esc(r.name) + '" data-price="' + esc(r.id) + '" value="' + esc(r.price) + '"></div>' +
                  (cat ? '<span class="pcard-cat">' + esc(cat) + '</span>' : '') +
                '</div>' +
                '<div class="pcard-actions icon-actions">' + productActions(r, isCombo) + '</div>' +
              '</div></div>';
          }).join('') + '</div>';
        } else {
          var allChecked = view.length && view.every(function (r) { return sel[r.id]; });
          body.innerHTML = '<div class="card p-table-wrap"><table class="responsive' + (state.sort === 'position' ? ' sortable' : '') + '"><thead><tr>' +
            '<th class="pick-h"><input type="checkbox" data-all' + (allChecked ? ' checked' : '') + ' title="Seleccionar todo"></th>' +
            (state.sort === 'position' ? '<th class="drag-h"></th>' : '') +
            '<th class="sort-th" data-sortkey="name">Nombre</th><th class="sort-th" data-sortkey="price">Precio</th>' +
            '<th class="sort-th" data-sortkey="category">Categoría</th>' + (isCombo ? '<th>Piezas</th>' : '') +
            '<th class="sort-th" data-sortkey="status">Estado</th><th></th></tr></thead><tbody>' +
            view.map(function (r) {
              return '<tr data-id="' + esc(r.id) + '"' + (sel[r.id] ? ' class="picked"' : '') + '>' +
                '<td class="pick-cell" data-label=""><input type="checkbox" data-sel="' + esc(r.id) + '"' + (sel[r.id] ? ' checked' : '') + '></td>' +
                (state.sort === 'position' ? '<td class="drag-cell" data-label=""><span class="drag-handle" title="Arrastrar para ordenar">⠿</span></td>' : '') +
                '<td data-label="Imagen">' + (r.image ? '<img class="thumb" src="' + esc(SB.resolveImage(r.image, 96)) + '" alt="" loading="lazy" decoding="async">' :
                  '<span class="thumb thumb-empty">' + svgIcon(isCombo ? 'combos' : 'productos') + '</span>') + '</td>' +
                '<td data-label="Nombre"><strong>' + esc(r.name) + '</strong><div class="muted" style="font-size:12px">' + esc(r.sub || '') + '</div></td>' +
                '<td data-label="Precio"><input class="inline-price" type="text" inputmode="decimal" aria-label="Precio de ' + esc(r.name) + '" data-price="' + esc(r.id) + '" value="' + esc(r.price) + '"></td>' +
                '<td data-label="Categoría">' + esc(refName('categories', r.category_id)) + '</td>' +
                (isCombo ? '<td data-label="Piezas" class="muted">—</td>' : '') +
                '<td data-label="Estado"><button class="tag ' + (r.hidden ? 'off' : 'on') + '" data-toggle="' + esc(r.id) + '">' + (r.hidden ? 'Oculto' : 'Visible') + '</button></td>' +
                '<td data-label=""><div class="list-actions icon-actions">' + productActions(r, isCombo) + '</div></td></tr>';
            }).join('') + '</tbody></table></div>';

          if (state.sort === 'position') enableRowSort($('tbody', body), function (ids) { saveOrder('products', ids); logActivity('Reordenó ' + title.toLowerCase()); });
        }

        body.onclick = function (e) {
          var t = e.target;
          if (t.matches('[data-sel]') || t.matches('[data-all]')) return;
          var th = t.closest('[data-sortkey]'); if (th) { cycleSort(th.dataset.sortkey); return; }
          var mb = t.closest('[data-menu]'); if (mb) { openActMenu(mb); return; }
          var ed = t.closest('[data-edit]'); if (ed) { openEditor(byId(ed.dataset.edit)); return; }
          var de = t.closest('[data-del]'); if (de) { doDelete(de.dataset.del); return; }
          var du = t.closest('[data-dup]'); if (du) { doDuplicate(du.dataset.dup); return; }
          var it = t.closest('[data-items]'); if (it) { openItemsEditor(it.dataset.items, reload); return; }
          var tg = t.closest('[data-toggle]'); if (tg) { toggleHidden(tg.dataset.toggle); return; }
          var card = t.closest('.pcard');
          if (card && !t.closest('input,button,select,label,a')) {
            var row = byId(card.dataset.id); if (row) openEditor(row);
          }
        };
        body.onchange = function (e) {
          var t = e.target;
          if (t.matches('[data-all]')) {
            view.forEach(function (r) { if (t.checked) sel[r.id] = true; else delete sel[r.id]; });
            renderBody(); return;
          }
          if (t.matches('[data-sel]')) {
            if (t.checked) sel[t.dataset.sel] = true; else delete sel[t.dataset.sel];
            var row = t.closest('tr, .pcard');
            if (row) row.classList.toggle('picked', !!sel[t.dataset.sel]);
            updateBulk(); return;
          }
        };
        $all('[data-price]', body).forEach(function (inp) {
          inp.addEventListener('change', function () { savePrice(inp.dataset.price, inp); });
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
        });
      }

      function cycleSort(k) {
        var cur = state.sort.split(':');
        var dir = cur[0] === k && cur[1] === 'asc' ? 'desc' : 'asc';
        state.sort = k + ':' + dir; persist(); syncSortSelect(); renderBody();
      }
      function syncSortSelect() {
        var s = $('#pSort', mount); if (!s) return;
        var has = Array.prototype.some.call(s.options, function (o) { return o.value === state.sort; });
        if (!has) { var o = document.createElement('option'); o.value = state.sort; o.textContent = 'Orden: ' + state.sort; s.appendChild(o); }
        s.value = state.sort;
      }
      function selectedIds() { return Object.keys(sel).filter(function (id) { return sel[id]; }); }
      function updateBulk() {
        var bar = $('#pBulk', mount); if (!bar) return;
        var ids = selectedIds();
        if (!ids.length) { bar.hidden = true; bar.innerHTML = ''; return; }
        bar.hidden = false;
        bar.innerHTML = '<span class="bulk-count">' + ids.length + ' seleccionado(s)</span>' +
          '<button class="btn sm" data-bulk-hidden="1">Ocultar</button>' +
          '<button class="btn sm" data-bulk-hidden="0">Mostrar</button>' +
          (S.cache.categories ? '<select class="filter-select" data-bulk-cat><option value="">Mover a categoría…</option>' +
            (S.cache.categories || []).map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('') + '</select>' : '') +
          '<button class="btn sm danger" data-bulk-del>Borrar</button>' +
          '<span class="toolbar-spacer"></span>' +
          '<button class="btn sm ghost" data-bulk-clear>Quitar selección</button>';
      }
      function bulkHidden(hidden) {
        var ids = selectedIds(); if (!ids.length) return;
        Promise.all(ids.map(function (id) { return SB.update('products', { id: 'eq.' + id }, { hidden: hidden }); }))
          .then(function () {
            ids.forEach(function (id) { var r = byId(id); if (r) r.hidden = hidden; });
            toast(hidden ? 'Ocultados' : 'Mostrados', 'ok');
            logActivity((hidden ? 'Ocultó ' : 'Mostró ') + ids.length + ' ' + noun + '(s)');
            sel = {}; renderBody();
          }).catch(function (e) { toast(e.message, 'err'); });
      }
      function bulkCategory(cid) {
        var ids = selectedIds(); if (!ids.length) return;
        Promise.all(ids.map(function (id) { return SB.update('products', { id: 'eq.' + id }, { category_id: cid }); }))
          .then(function () {
            ids.forEach(function (id) { var r = byId(id); if (r) r.category_id = cid; });
            toast('Categoría actualizada', 'ok');
            logActivity('Movió ' + ids.length + ' ' + noun + '(s) de categoría');
            sel = {}; renderBody();
          }).catch(function (e) { toast(e.message, 'err'); });
      }
      function bulkDelete() {
        var ids = selectedIds(); if (!ids.length) return;
        confirmDialog('¿Eliminar ' + ids.length + ' ' + noun + '(s)? No se puede deshacer.', function () {
          Promise.all(ids.map(function (id) { return SB.remove('products', { id: 'eq.' + id }); }))
            .then(function () {
              toast(ids.length + ' eliminado(s)', 'ok');
              logActivity('Eliminó ' + ids.length + ' ' + noun + '(s)');
              sel = {}; invalidate(); reload();
            }).catch(function (e) { toast(e.message, 'err'); });
        }, { dangerLabel: 'Eliminar' });
      }

      function byId(id) { return rows.filter(function (r) { return String(r.id) === String(id); })[0]; }
      function reload() { return load('products', { select: '*', type: 'eq.' + type, order: 'position.asc,id.asc' }).then(function (r2) { rows = r2; sel = {}; renderBody(); }); }

      function savePrice(id, inp) {
        var raw = String(inp.value).replace(',', '.').replace(/[^0-9.\-]/g, '').trim();
        var price = raw === '' ? null : Number(raw);
        if (price === null || isNaN(price)) { var cur = byId(id); inp.value = cur ? cur.price : ''; return toast('Precio no válido', 'err'); }
        SB.update('products', { id: 'eq.' + id }, { price: price }).then(function () {
          var r = byId(id); if (r) r.price = price;
          inp.value = price;
          toast('Precio actualizado', 'ok');
        }).catch(function (e) { toast(e.message, 'err'); renderBody(); });
      }
      function toggleHidden(id) {
        var r = byId(id); var hidden = !r.hidden;
        SB.update('products', { id: 'eq.' + id }, { hidden: hidden }).then(function () {
          r.hidden = hidden; toast(hidden ? 'Oculto' : 'Visible', 'ok'); renderBody();
        }).catch(function (e) { toast(e.message, 'err'); });
      }
      function doDelete(id) {
        var row = byId(id);
        confirmDialog('¿Eliminar «' + (row && row.name) + '»?', function () {
          removeWithUndo('products', row, { label: 'Eliminado', after: reload });
          logActivity('Eliminó ' + noun + ': ' + (row && row.name));
        });
      }
      function doDuplicate(id) {
        var row = byId(id);
        var copy = {}; Object.keys(row).forEach(function (k) { if (k !== 'id' && k !== 'created_at') copy[k] = row[k]; });
        copy.name = row.name + ' (copia)'; copy.position = rows.length; copy.store_id = sid();
        SB.insert('products', copy).then(function () {
          toast('Duplicado', 'ok'); logActivity('Duplicó ' + noun + ': ' + row.name); reload();
        }).catch(function (e) { toast(e.message, 'err'); });
      }
      function exportCsv() {
        var cols = [
          { l: 'ID', v: function (r) { return r.id; } },
          { l: 'Nombre', v: function (r) { return r.name; } },
          { l: 'Precio', v: function (r) { return r.price; } },
          { l: 'Categoría', v: function (r) { return refName('categories', r.category_id); } },
          { l: 'Estado', v: function (r) { return r.hidden ? 'Oculto' : 'Visible'; } }
        ];
        downloadBlob('products-' + type + '-' + Date.now() + '.csv', toCSV(rows, cols), 'text/csv;charset=utf-8');
      }

      function openEditor(row) {
        var isProd = !isCombo;
        var values = row || { position: rows.length, price: 0, specs: isCombo ? [] : DEFAULT_PRODUCT_SPECS, description: isCombo ? '' : DEFAULT_PRODUCT_DESCRIPTION };
        var steps = buildSteps(fields, isCombo ? COMBO_STEPS : PRODUCT_STEPS);
        if (isCombo) {
          steps.push({ title: 'Textos del combo', short: 'Textos', sub: 'Líneas de CPU y etiqueta que aparecen en la tarjeta del combo.', html: comboMetaHtml(row) });
        }
      if (!isProd) steps.push({ title: 'Revisar', short: 'Revisar', sub: 'Así se verá la tarjeta en la tienda.', review: true });

      var draftKey = 'gh_product_draft_' + sid() + '_' + (row && row.id ? row.id : 'new');
      try {
        var saved = localStorage.getItem(draftKey);
        if (saved) {
          var d = JSON.parse(saved);
          if (d && d.values) {
            values = Object.assign({}, values, d.values);
            if (Array.isArray(d.values.specs)) values.specs = d.values.specs;
            if (d.values.description !== undefined) values.description = d.values.description;
            toast('Borrador restaurado', 'ok');
          }
        }
      } catch (e) {}

      var wiz = openFormWizard({
        title: (row ? 'Editar ' : 'Nuevo ') + noun,
        saveLabel: row ? 'Guardar cambios' : 'Crear ' + noun,
        steps: steps,
        values: values,
        freeNav: !!row,
        horizontalSteps: isProd,
        size: isProd ? 'fullscreen' : undefined,
        reviewHtml: isProd ? '' : '<div class="review-pane" id="wizPreview"></div>',
        guard: true,
        onSave: function (data, m) {
          data.type = type;
          if (isCombo) {
            data.meta = (row && row.meta) || {};
            data.meta.cpu_line1 = val(m.body, 'cpu_line1');
            data.meta.cpu_line2 = val(m.body, 'cpu_line2');
            data.meta.tag = val(m.body, 'tag');
            if (!data.category_id) data.category_id = null;
          }
          if (!row) data.store_id = sid();
          var p = row ? SB.update('products', { id: 'eq.' + row.id }, data) : SB.insert('products', data);
          return p.then(function () {
            try { localStorage.removeItem(draftKey); } catch (e) {}
            if (MODAL && MODAL._prodDraft) MODAL._prodDraft.clear();
            if (MODAL) MODAL.dirty = false;
            closeModal(); invalidate(); toast('Guardado', 'ok');
            logActivity((row ? 'Editó ' : 'Creó ') + noun + ': ' + data.name);
            reload();
          }).catch(function (e) { toast(e.message, 'err'); });
        }
      });

    if (isProd && wiz && wiz.body) {
      var formEl = wiz.body.querySelector('#entForm');
      var saving = null;
      var hasUnsaved = false;
      function saveDraft() {
        try {
          var flat = flattenFields(steps);
          var v = readForm(flat, wiz.body);
          localStorage.setItem(draftKey, JSON.stringify({ values: v, t: Date.now(), name: v.name || '' }));
          hasUnsaved = true;
        } catch (e) {}
      }
      function sched() { if (saving) clearTimeout(saving); saving = setTimeout(saveDraft, 400); }
      if (formEl) {
        formEl.addEventListener('input', sched);
        formEl.addEventListener('change', sched);
      }
      setTimeout(saveDraft, 250);
      var mo = MODAL;
      if (mo) {
        mo.guard = true;
        mo.dirty = false;
        mo._prodDraft = { key: draftKey, dirty: function(){ return hasUnsaved; }, save: saveDraft, clear: function(){ try{localStorage.removeItem(draftKey);}catch(e){} hasUnsaved=false; } };
      }
    }
      }
    }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  function val(root, name) { var n = root.querySelector('[name="' + name + '"]'); return n ? n.value.trim() : ''; }
  function clampNum(v, d, lo, hi) { v = parseFloat(v); if (isNaN(v)) v = d; return Math.min(hi, Math.max(lo, v)); }
  function comboMetaHtml(row) {
    var meta = (row && row.meta) || {};
    return '<div class="fgrid">' +
      '<div class="field"><label>Línea 1 (CPU)</label><input type="text" name="cpu_line1" value="' + esc(meta.cpu_line1 || '') + '"></div>' +
      '<div class="field"><label>Línea 2</label><input type="text" name="cpu_line2" value="' + esc(meta.cpu_line2 || '') + '"></div>' +
      '<div class="field full mb0"><label>Etiqueta (tag)</label><input type="text" name="tag" value="' + esc(meta.tag || '') + '"></div>' +
      '</div>';
  }
  function fillComboMeta() { /* placeholders ya renderizados por comboMetaHtml */ }

  function openItemsEditor(comboId, after) {
    var m = openModal({
      title: 'Piezas e imagen del combo', size: 'lg',
      body: '<div class="loading"><span class="spinner"></span> Cargando…</div>',
      buttons: [{ label: 'Cerrar', onClick: function () { closeModal(); after && after(); } }]
    });
    var st = { prods: [], links: [], combo: null, layers: [], base: '', sources: [], tab: 'piezas', sel: -1 };
    Promise.all([
      load('products', { select: 'id,name,sub,type,price,image,hidden', order: 'name.asc' }),
      load('combo_items', { select: '*', combo_id: 'eq.' + comboId, order: 'position.asc' }),
      load('products', { select: 'id,name,image,images,meta,type', id: 'eq.' + comboId })
    ]).then(function (r) {
      st.prods = (r[0] || []).filter(function (p) { return p.type !== 'combo'; });
      st.links = r[1] || [];
      st.combo = (r[2] && r[2][0]) || null;
      var meta = (st.combo && st.combo.meta) || {};
      st.layers = Array.isArray(meta.layers) ? meta.layers.slice() : [];
      st.base = meta.base !== undefined && meta.base !== null ? meta.base : ((st.combo && st.combo.image) || '');
      draw();
    }).catch(function (e) { m.body.innerHTML = '<div class="card empty">Error: ' + esc(e.message) + '</div>'; });

    function prodById(id) { for (var i = 0; i < st.prods.length; i++) if (String(st.prods[i].id) === String(id)) return st.prods[i]; return null; }
    function pieceProduct(l) { return prodById(l.product_id) || { name: '(producto eliminado)', price: 0, image: '', hidden: true }; }
    function pieceImgHtml(p, cls) {
      return p.image ? '<img class="' + cls + '" src="' + esc(SB.resolveImage(p.image, 96)) + '" alt="">' :
        '<span class="' + cls + ' piece-thumb-empty" aria-hidden="true">' + svgIcon('productos') + '</span>';
    }
    function reloadLinks() {
      return load('combo_items', { select: '*', combo_id: 'eq.' + comboId, order: 'position.asc' }).then(function (rows) { st.links = rows || []; });
    }
    function saveLayers() {
      var meta = (st.combo && st.combo.meta) || {};
      meta.layers = st.layers; meta.base = st.base;
      return SB.update('products', { id: 'eq.' + comboId }, { meta: meta }).then(function () { if (st.combo) st.combo.meta = meta; invalidate(); });
    }

    function draw() {
      var tabs = '<div class="subnav" role="tablist">' +
        '<button class="subnav-btn' + (st.tab === 'piezas' ? ' active' : '') + '" data-studio="piezas" type="button">Piezas del combo</button>' +
        '<button class="subnav-btn' + (st.tab === 'imagen' ? ' active' : '') + '" data-studio="imagen" type="button">Imagen del combo</button></div>';
      m.body.innerHTML = tabs + (st.tab === 'piezas' ? piezasHtml() : imagenHtml());
      $all('[data-studio]', m.body).forEach(function (b) {
        b.addEventListener('click', function () { st.tab = b.dataset.studio; draw(); });
      });
      if (st.tab === 'piezas') wirePiezas(); else wireImagen();
    }

    /* ---------------- Piezas ---------------- */
    function piezasHtml() {
      var pickRows = st.prods.map(function (p) {
        var qty = 0;
        st.links.forEach(function (l) { if (String(l.product_id) === String(p.id)) qty += Number(l.qty) || 1; });
        var search = (p.name + ' ' + (p.sub || '')).toLowerCase();
        return '<button type="button" class="pick-row" data-pick="' + esc(p.id) + '" data-search="' + esc(search) + '">' +
          pieceImgHtml(p, 'pick-thumb') +
          '<span class="pick-meta"><span class="pick-name">' + esc(p.name) + '</span>' +
            '<span class="pick-sub">' + money(p.price) + (p.hidden ? ' · Solo en el combo' : '') + '</span></span>' +
          (qty ? '<span class="pick-count">×' + qty + '</span>' : '') +
          '<span class="pick-add" aria-hidden="true">＋</span></button>';
      }).join('') || '<p class="muted pad">No hay productos en la tienda todavía.</p>';

      var list = st.links.length ? st.links.map(function (l, i) {
        var p = pieceProduct(l);
        return '<div class="piece-row" data-l="' + esc(l.id) + '">' +
          pieceImgHtml(p, 'piece-thumb') +
          '<div class="piece-meta"><div class="piece-name">' + esc(p.name) + '</div>' +
            '<div class="piece-sub">' + money(p.price) +
              (p.hidden ? ' <span class="piece-tag">Solo en el combo</span>' : '') +
              (!p.image ? ' · Sin imagen' : '') + '</div></div>' +
          '<input class="piece-qty" type="number" min="1" inputmode="numeric" data-qty="' + esc(l.id) + '" value="' + esc(l.qty) + '" title="Cantidad" aria-label="Cantidad de ' + esc(p.name) + '">' +
          '<div class="piece-actions">' +
            '<button type="button" class="act-btn" data-up="' + i + '" title="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="act-btn" data-down="' + i + '" title="Bajar"' + (i === st.links.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="act-btn act-del" data-rm="' + esc(l.id) + '" title="Quitar">' + ICO.trash + '</button>' +
          '</div>' +
        '</div>';
      }).join('') : '<p class="muted piece-empty">Sin piezas todavía. Añade un producto de la tienda o crea uno externo.</p>';

      var units = st.links.reduce(function (n, l) { return n + (Number(l.qty) || 1); }, 0);
      return '<div class="pz-grid">' +
        '<div class="card pz pz-pick">' +
          '<div class="pz-head"><div><h3>Productos de la tienda</h3>' +
            '<p class="desc">Toca un producto para añadirlo. Si ya está en el combo, suma una unidad.</p></div>' +
            '<span class="pz-count">' + st.prods.length + '</span></div>' +
          '<div class="search-box">' + SEARCH_ICO + '<input type="search" id="pickSearch" placeholder="Buscar producto…" autocomplete="off" aria-label="Buscar producto"></div>' +
          '<div class="pick-list" id="pickList">' + pickRows + '</div>' +
          '<p class="muted pz-none" id="pickNone" hidden>Ningún producto coincide con la búsqueda.</p>' +
        '</div>' +
        '<div class="card pz pz-new">' +
          '<h3>Producto externo</h3>' +
          '<p class="desc">Si no está en la tienda, créalo aquí con <strong>nombre e imagen</strong>. Solo se verá como pieza de este combo.</p>' +
          '<div class="fgrid ext-form">' +
            '<div class="field full"><label for="npName">Nombre <span class="req">*</span></label><input type="text" id="npName" placeholder="Ej. Monitor 24&rdquo; 165 Hz" autocomplete="off"></div>' +
            '<div class="field full"><label for="npPrice">Precio (opcional)</label><div class="money-wrap"><span class="money-cur">$</span><input class="money-input" type="text" inputmode="decimal" id="npPrice" placeholder="0"></div></div>' +
            '<div class="field full mb0"><label for="npImg">Imagen <span class="req">*</span></label>' +
              '<div class="img-drop" id="npDrop"><img class="thumb" id="npPrev" alt="">' +
                '<div class="img-drop-info"><input type="file" accept="image/*" id="npImg" aria-label="Imagen del producto externo">' +
                '<span class="help">Arrastra una imagen o elige un archivo.</span></div></div></div>' +
          '</div>' +
          '<button class="btn primary pz-create" id="createPiece" type="button">Crear y añadir al combo</button>' +
        '</div>' +
      '</div>' +
      '<div class="card pz pz-selected"><div class="pz-head"><div>' +
        '<h3>Piezas del combo <span class="pz-count">' + st.links.length + '</span></h3>' +
        '<p class="desc">' + (units ? units + ' unidad(es) en total. Usa las flechas para ordenar.' : 'Aún no hay piezas.') + '</p></div></div>' +
        '<div class="piece-list">' + list + '</div></div>';
    }
    function wirePiezas() {
      function addProduct(pid, qty) {
        var existing = null;
        st.links.forEach(function (l) { if (String(l.product_id) === String(pid)) existing = l; });
        var pcall;
        if (existing) {
          pcall = SB.update('combo_items', { id: 'eq.' + existing.id }, { qty: (Number(existing.qty) || 1) + (qty || 1) });
        } else {
          pcall = SB.insert('combo_items', { combo_id: Number(comboId), product_id: Number(pid), qty: qty || 1, position: st.links.length, store_id: sid() });
        }
        return pcall.then(reloadLinks).then(function () { invalidate(); draw(); toast(existing ? 'Cantidad actualizada' : 'Añadido al combo', 'ok'); });
      }
      $all('[data-pick]', m.body).forEach(function (b) {
        b.addEventListener('click', function () {
          b.disabled = true;
          addProduct(b.dataset.pick, 1).catch(function (e) { toast(e.message, 'err'); b.disabled = false; });
        });
      });
      var search = $('#pickSearch', m.body);
      if (search) search.addEventListener('input', function () {
        var q = this.value.trim().toLowerCase(), shown = 0;
        $all('[data-pick]', m.body).forEach(function (row) {
          var ok = !q || (row.dataset.search || '').indexOf(q) !== -1;
          row.hidden = !ok;
          if (ok) shown++;
        });
        var none = $('#pickNone', m.body); if (none) none.hidden = shown > 0;
      });

      var npImg = $('#npImg', m.body), prev = $('#npPrev', m.body), drop = $('#npDrop', m.body), picked = null;
      function preview(file) {
        picked = file || null;
        if (prev) {
          try { if (prev.dataset.url) URL.revokeObjectURL(prev.dataset.url); } catch (e) {}
          if (file) { var u = URL.createObjectURL(file); prev.src = u; prev.dataset.url = u; } else { prev.removeAttribute('src'); }
        }
        if (drop) { drop.classList.toggle('has-img', !!file); if (file) drop.classList.remove('missing'); }
      }
      if (npImg) npImg.addEventListener('change', function () { preview(npImg.files[0]); });
      if (drop) {
        drop.addEventListener('click', function (e) { if (e.target.closest('input,button')) return; if (npImg) npImg.click(); });
        drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
        drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
        drop.addEventListener('drop', function (e) {
          e.preventDefault(); drop.classList.remove('drag');
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if (f && /^image\//.test(f.type)) preview(f);
        });
      }

      var create = $('#createPiece', m.body);
      if (create) create.addEventListener('click', function () {
        var nameEl = $('#npName', m.body);
        var name = (nameEl.value || '').trim();
        var price = parseFloat(($('#npPrice', m.body).value || '').replace(',', '.')) || 0;
        var file = picked || (npImg && npImg.files[0]);
        if (!name) { nameEl.focus(); return toast('Ponle nombre al producto externo', 'err'); }
        if (!file) { if (drop) drop.classList.add('missing'); return toast('Añade una imagen para el producto externo', 'err'); }
        create.disabled = true;
        SB.upload('catalog', file).then(function (url) {
          return SB.insert('products', { store_id: sid(), type: 'product', name: name, price: price, image: url, hidden: true, position: 0 });
        }).then(function (rows) {
          var pid = Array.isArray(rows) && rows[0] ? rows[0].id : rows && rows.id;
          return SB.insert('combo_items', { combo_id: Number(comboId), product_id: Number(pid), qty: 1, position: st.links.length, store_id: sid() });
        }).then(function () { return load('products', { select: 'id,name,sub,type,price,image,hidden', order: 'name.asc' }); })
          .then(function (r0) { st.prods = (r0 || []).filter(function (p) { return p.type !== 'combo'; }); return reloadLinks(); })
          .then(function () { invalidate(); draw(); toast('Producto externo añadido', 'ok'); })
          .catch(function (e) { toast(e.message, 'err'); create.disabled = false; });
      });
      $all('[data-qty]', m.body).forEach(function (inp) {
        inp.addEventListener('change', function () {
          var q = Math.max(1, Number(inp.value) || 1);
          inp.value = q;
          SB.update('combo_items', { id: 'eq.' + inp.dataset.qty }, { qty: q }).then(function () { toast('Cantidad actualizada', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
      $all('[data-rm]', m.body).forEach(function (b) {
        b.addEventListener('click', function () {
          SB.remove('combo_items', { id: 'eq.' + b.dataset.rm }).then(reloadLinks).then(function () { invalidate(); draw(); toast('Quitado', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
      $all('[data-up],[data-down]', m.body).forEach(function (b) {
        b.addEventListener('click', function () {
          var i = Number(b.dataset.up || b.dataset.down);
          var j = b.dataset.up ? i - 1 : i + 1;
          if (j < 0 || j >= st.links.length) return;
          var a = st.links.slice(); var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
          Promise.all(a.map(function (l, k) { return SB.update('combo_items', { id: 'eq.' + l.id }, { position: k }); }))
            .then(reloadLinks).then(function () { invalidate(); draw(); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
    }

    /* ---------------- Imagen (compositor por capas) ---------------- */
    function buildSources() {
      var out = [], seen = {};
      function add(src, label, extra) {
        if (!src || seen[src]) return;
        seen[src] = 1;
        var o = { src: src, label: label };
        if (extra) for (var k in extra) o[k] = extra[k];
        out.push(o);
      }
      if (st.base) add(st.base, 'Imagen principal', { isBase: true });
      (st.combo && st.combo.images || []).forEach(function (u) { add(u, 'Galería'); });
      st.links.forEach(function (l) {
        var p = prodById(l.product_id);
        if (p && p.image) add(p.image, p.name + ((Number(l.qty) || 1) > 1 ? ' ×' + l.qty : ''), { product_id: p.id });
      });
      st.sources = out;
      return out;
    }
    function pieceImages() {
      var out = [], seen = {};
      st.links.forEach(function (l) {
        var p = prodById(l.product_id);
        if (p && p.image && !seen[p.image]) { seen[p.image] = 1; out.push(p); }
      });
      return out;
    }
    function autoArrangePieces() {
      var items = pieceImages().filter(function (p) { return p.image !== st.base; });
      if (!items.length) return 0;
      var cols = items.length <= 2 ? items.length : (items.length <= 4 ? 2 : 3);
      var rows = Math.ceil(items.length / cols);
      var w = cols === 1 ? 46 : Math.floor(78 / cols);
      var x0 = (100 - cols * w) / 2;
      var y0 = rows > 1 ? 22 : 30;
      var stepY = rows > 1 ? Math.min(34, (72 - y0) / (rows - 1)) : 0;
      st.layers = items.map(function (p, i) {
        var col = i % cols, row = Math.floor(i / cols);
        return { src: p.image, x: Math.round(x0 + col * w), y: Math.round(y0 + row * stepY), w: w, z: i + 1, product_id: p.id, label: p.name };
      });
      st.sel = -1;
      return st.layers.length;
    }
    function imagenHtml() {
      var srcs = buildSources();
      var withImg = st.links.filter(function (l) { var p = prodById(l.product_id); return !!(p && p.image); }).length;
      var missing = st.links.length - withImg;
      var srcHtml = srcs.length ? srcs.map(function (s, i) {
        return '<div class="src-chip"><img src="' + esc(SB.resolveImage(s.src, 96)) + '" alt="">' +
          '<span class="src-label">' + esc(s.label) + '</span>' +
          '<div class="src-actions"><button type="button" class="btn sm" data-addsrc="' + i + '">＋ Capa</button>' +
          (s.isBase ? '<button type="button" class="btn sm ghost" data-clearbase>Quitar base</button>' :
            '<button type="button" class="btn sm ghost" data-setbase="' + i + '">Usar base</button>') + '</div></div>';
      }).join('') : '<p class="muted">No hay imágenes. Sube imágenes en el paso “Clasificación” o añade piezas con imagen.</p>';

      var stage = '<div class="composer-stage" id="cStage">' +
        (st.base ? '<img class="c-base" src="' + esc(SB.resolveImage(st.base, 720)) + '" alt="" draggable="false">' : '<div class="c-empty">Sin base · fondo blanco al generar</div>') +
        st.layers.map(function (L, i) {
          return '<img class="c-layer' + (st.sel === i ? ' sel' : '') + '" data-layer="' + i + '" draggable="false" src="' + esc(SB.resolveImage(L.src, 400)) + '" ' +
            'style="left:' + (Number(L.x) || 0) + '%;top:' + (Number(L.y) || 0) + '%;width:' + (Number(L.w) || 40) + '%;z-index:' + (Number(L.z) || 1) + '">';
        }).join('') +
        '</div>';

      var sel = st.sel >= 0 ? st.layers[st.sel] : null;
      var ctrls = '<div class="composer-controls">' +
        (sel ? '<span class="muted">Capa ' + (st.sel + 1) + '</span>' +
          '<label class="cl">Tamaño <input type="range" min="5" max="120" value="' + (Number(sel.w) || 40) + '" data-size></label>' +
          '<button type="button" class="btn sm" data-z="1">Traer al frente</button>' +
          '<button type="button" class="btn sm" data-z="-1">Enviar atrás</button>' +
          '<button type="button" class="btn sm danger" data-rmlayer>Quitar capa</button>'
          : '<span class="muted">Toca una capa en el lienzo para moverla, cambiar su tamaño u orden.</span>') +
        '</div>';

      return '<div class="card"><h3>Imagen del combo</h3>' +
        '<p class="desc">La <strong>imagen principal</strong> es la base opcional. Añade las piezas como capas, arrástralas sobre el lienzo y ajusta tamaño y orden. Si no colocas capas, se usarán todas las piezas con imagen. La imagen generada se aplica al combo en la tienda.</p>' +
        '<div class="composer-pieces">' + (st.links.length ? '<span>' + st.links.length + ' pieza(s) en el combo</span>' +
          (missing ? '<span class="warn">' + missing + ' sin imagen</span>' : '<span class="ok">Todas con imagen</span>') :
          '<span>Sin piezas todavía</span>') + '</div>' +
        '<div class="composer"><div class="composer-aside"><div class="src-list">' + srcHtml + '</div></div>' +
        '<div class="composer-main">' + stage + ctrls +
        '<div class="composer-actions"><button type="button" class="btn" id="autoPieces" title="Reemplaza las capas actuales con las imágenes de las piezas">Colocar piezas</button>' +
        '<button type="button" class="btn" id="saveLayers">Guardar borrador</button>' +
        '<button type="button" class="btn primary" id="genImage">Generar y aplicar</button></div></div></div></div>';
    }
    function wireImagen() {
      var stage = $('#cStage', m.body);
      if (!stage) return;
      $all('[data-addsrc]', m.body).forEach(function (b) {
        b.addEventListener('click', function () {
          var s = st.sources[Number(b.dataset.addsrc)]; if (!s) return;
          var n = st.layers.length;
          st.layers.push({ src: s.src, x: 20 + (n % 4) * 12, y: 20 + (n % 4) * 12, w: 42, z: n + 1, product_id: s.product_id });
          st.sel = st.layers.length - 1; draw();
        });
      });
      $all('[data-setbase]', m.body).forEach(function (b) {
        b.addEventListener('click', function () {
          var s = st.sources[Number(b.dataset.setbase)]; if (!s) return;
          st.base = s.src;
          var meta = (st.combo && st.combo.meta) || {};
          meta.base = s.src;
          SB.update('products', { id: 'eq.' + comboId }, { image: s.src, meta: meta }).then(function () {
            if (st.combo) { st.combo.image = s.src; st.combo.meta = meta; }
            invalidate(); toast('Base actualizada', 'ok'); draw();
          }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
      var clearBase = $('[data-clearbase]', m.body);
      if (clearBase) clearBase.addEventListener('click', function () {
        st.base = '';
        var meta = (st.combo && st.combo.meta) || {};
        meta.base = '';
        SB.update('products', { id: 'eq.' + comboId }, { image: '', meta: meta }).then(function () {
          if (st.combo) { st.combo.image = ''; st.combo.meta = meta; }
          invalidate(); toast('Base quitada', 'ok'); draw();
        }).catch(function (e) { toast(e.message, 'err'); });
      });
      stage.addEventListener('pointerdown', function (e) {
        var im = e.target.closest('[data-layer]'); if (!im) return;
        e.preventDefault();
        var idx = Number(im.dataset.layer), L = st.layers[idx];
        st.sel = idx;
        $all('.c-layer', stage).forEach(function (x) { x.classList.toggle('sel', x === im); });
        var rect = stage.getBoundingClientRect();
        var sx = e.clientX, sy = e.clientY, ox = Number(L.x) || 0, oy = Number(L.y) || 0;
        function move(ev) {
          L.x = Math.round(Math.max(-20, Math.min(100, ox + (ev.clientX - sx) / rect.width * 100)));
          L.y = Math.round(Math.max(-20, Math.min(100, oy + (ev.clientY - sy) / rect.height * 100)));
          im.style.left = L.x + '%'; im.style.top = L.y + '%';
        }
        function up() { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); refreshControls(); }
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
      });
      function refreshControls() {
        var c = $('.composer-controls', m.body); if (!c) return;
        var sel = st.layers[st.sel];
        c.innerHTML = sel ? '<span class="muted">Capa ' + (st.sel + 1) + '</span>' +
          '<label class="cl">Tamaño <input type="range" min="5" max="120" value="' + (Number(sel.w) || 40) + '" data-size></label>' +
          '<button type="button" class="btn sm" data-z="1">Traer al frente</button>' +
          '<button type="button" class="btn sm" data-z="-1">Enviar atrás</button>' +
          '<button type="button" class="btn sm danger" data-rmlayer>Quitar capa</button>'
          : '<span class="muted">Toca una capa en el lienzo para moverla, cambiar su tamaño u orden.</span>';
        bindControls();
      }
      function bindControls() {
        var size = $('[data-size]', m.body);
        if (size) size.addEventListener('input', function () { var sel = st.layers[st.sel]; if (!sel) return; sel.w = Number(size.value); var el = $('.c-layer[data-layer="' + st.sel + '"]', stage); if (el) el.style.width = sel.w + '%'; });
        var zf = $('[data-z="1"]', m.body); if (zf) zf.addEventListener('click', function () { var sel = st.layers[st.sel]; if (!sel) return; sel.z = (Number(sel.z) || 1) + 1; var el = $('.c-layer[data-layer="' + st.sel + '"]', stage); if (el) el.style.zIndex = sel.z; });
        var zb = $('[data-z="-1"]', m.body); if (zb) zb.addEventListener('click', function () { var sel = st.layers[st.sel]; if (!sel) return; sel.z = Math.max(1, (Number(sel.z) || 1) - 1); var el = $('.c-layer[data-layer="' + st.sel + '"]', stage); if (el) el.style.zIndex = sel.z; });
        var rm = $('[data-rmlayer]', m.body); if (rm) rm.addEventListener('click', function () { if (st.sel < 0) return; st.layers.splice(st.sel, 1); st.sel = -1; draw(); });
      }
      bindControls();
      var auto = $('#autoPieces', m.body);
      if (auto) auto.addEventListener('click', function () {
        var n = autoArrangePieces();
        if (!n) return toast('Añade piezas con imagen para colocarlas', 'err');
        draw(); toast(n + ' pieza(s) colocadas automáticamente', 'ok');
      });
      var save = $('#saveLayers', m.body);
      if (save) save.addEventListener('click', function () { save.disabled = true; saveLayers().then(function () { toast('Borrador guardado. Genera la imagen para aplicarla.', 'ok'); save.disabled = false; }).catch(function (e) { toast(e.message, 'err'); save.disabled = false; }); });
      var gen = $('#genImage', m.body);
      if (gen) gen.addEventListener('click', function () {
        if (!st.base) {
          var gallery = ((st.combo && st.combo.images) || []).filter(Boolean);
          if (gallery.length) st.base = gallery[0];
        }
        if (!st.base && !pieceImages().length) return toast('Añade una imagen base o piezas con imagen', 'err');
        if (!st.layers.length) autoArrangePieces();
        gen.disabled = true; toast('Generando imagen…');
        bakeImage(st.base, st.layers, function (blob, err) {
          if (!blob) { toast('No se pudo generar: ' + (err && err.message || 'error'), 'err'); gen.disabled = false; return; }
          var file = new File([blob], 'combo-' + Date.now() + '.png', { type: 'image/png' });
          SB.upload('catalog', file).then(function (url) {
            st.composite = url;
            var meta = (st.combo && st.combo.meta) || {};
            meta.layers = st.layers; meta.base = st.base; meta.composite = url;
            return SB.update('products', { id: 'eq.' + comboId }, { image: url, meta: meta }).then(function () {
              if (st.combo) { st.combo.image = url; st.combo.meta = meta; }
            });
          }).then(function () { invalidate(); toast('Imagen generada y aplicada al combo', 'ok'); draw(); })
            .catch(function (e) { toast(e.message, 'err'); gen.disabled = false; });
        });
      });
    }
  }

  // Compone una imagen (base + capas) en un canvas y devuelve un Blob PNG.
  function bakeImage(base, layers, cb) {
    function loadImg(src) {
      return new Promise(function (res, rej) {
        var im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('imagen')); };
        im.src = src;
      });
    }
    function abs(src) {
      if (!src) return '';
      if (/^(https?:|data:)/i.test(src)) return src;
      var u = SB.resolveImage(src, 0);
      if (/^https?:/i.test(u)) return u;
      try { return new URL(src.replace(/^\.?\//, ''), location.href).href; } catch (e) { return u; }
    }
    var SIZE = 1200;
    var canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SIZE, SIZE);
    var chain = Promise.resolve();
    if (base) chain = chain.then(function () { return loadImg(abs(base)); }).then(function (im) {
      var s = Math.max(SIZE / im.width, SIZE / im.height);
      var w = im.width * s, h = im.height * s;
      ctx.drawImage(im, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
    });
    layers.slice().sort(function (a, b) { return (Number(a.z) || 0) - (Number(b.z) || 0); }).forEach(function (L) {
      chain = chain.then(function () { return loadImg(abs(L.src)); }).then(function (im) {
        var w = SIZE * (Number(L.w) || 40) / 100, h = w * im.height / im.width;
        ctx.drawImage(im, SIZE * (Number(L.x) || 0) / 100, SIZE * (Number(L.y) || 0) / 100, w, h);
      }).catch(function () {});
    });
    chain.then(function () {
      try { canvas.toBlob(function (b) { cb(b, b ? null : new Error('toBlob')); }, 'image/png'); }
      catch (e) { cb(null, e); }
    }).catch(function (e) { cb(null, e); });
  }


  /* =========================================================
   *  Home / Contenido (settings.data)
   * ========================================================= */
  function getSettings() {
    return load('settings', { select: 'data' }).then(function (r) { return (r[0] && r[0].data) || {}; });
  }

  /* Horario semanal (settings.store.schedule). Cada día: {c:cerrado, o:'HH:MM', x:'HH:MM'} */
  var SCHED_DAYS = [['mon', 'Lunes'], ['tue', 'Martes'], ['wed', 'Miércoles'], ['thu', 'Jueves'], ['fri', 'Viernes'], ['sat', 'Sábado'], ['sun', 'Domingo']];
  function scheduleHtml(sch) {
    sch = sch || {};
    return '<div class="sched-grid">' + SCHED_DAYS.map(function (d) {
      var s = sch[d[0]] || {};
      return '<div class="sched-row" data-day="' + d[0] + '">' +
        '<label class="check"><input type="checkbox" data-sch="c"' + (s.c ? ' checked' : '') + '><span>' + d[1] + '</span></label>' +
        '<input type="time" data-sch="o" value="' + esc(s.o || '') + '">' +
        '<span class="muted">a</span>' +
        '<input type="time" data-sch="x" value="' + esc(s.x || '') + '"></div>';
    }).join('') + '</div>';
  }
  function readSchedule(root) {
    var sch = {};
    $all('.sched-row', root).forEach(function (row) {
      sch[row.dataset.day] = {
        c: row.querySelector('[data-sch="c"]').checked,
        o: row.querySelector('[data-sch="o"]').value,
        x: row.querySelector('[data-sch="x"]').value
      };
    });
    return sch;
  }
  function applySchedule(root, sch) {
    sch = sch || {};
    SCHED_DAYS.forEach(function (d) {
      var row = root.querySelector('.sched-row[data-day="' + d[0] + '"]');
      if (!row) return;
      var s = sch[d[0]] || {};
      row.querySelector('[data-sch="c"]').checked = !!s.c;
      row.querySelector('[data-sch="o"]').value = s.o || '';
      row.querySelector('[data-sch="x"]').value = s.x || '';
    });
  }

  function homeDraftKey() { return 'gh_home_draft_' + sid(); }
  function readHomeDraft() {
    try { return JSON.parse(localStorage.getItem(homeDraftKey()) || 'null'); } catch (e) { return null; }
  }
  function clearHomeDraft() { try { localStorage.removeItem(homeDraftKey()); } catch (e) {} }
  function captureHomeDraft(mount) {
    var d = { set: {}, sections: [] };
    $all('[data-set]', mount).forEach(function (n) { d.set[n.dataset.set] = n.value; });
    d.st = $('#st_open', mount) ? $('#st_open', mount).checked : undefined;
    d.closed = $('#st_closed', mount) ? $('#st_closed', mount).value : '';
    d.schedule = mount.querySelector('.sched-row') ? readSchedule(mount) : undefined;
    d.pay = $('#payMethods', mount) ? $('#payMethods', mount).value : '';
    d.msg = $('#msgTpl', mount) ? $('#msgTpl', mount).value : '';
    d.contact = $('#contactTpl', mount) ? $('#contactTpl', mount).value : '';
    d.share = $('#shareTpl', mount) ? $('#shareTpl', mount).value : '';
    d.heroShow = $('#hero_show', mount) ? $('#hero_show', mount).checked : undefined;
    var lf = mount.querySelector('input[type=hidden][data-k="logo"]');
    d.logo = lf ? lf.value : undefined;
    d.sections = $all('[data-visible]', mount).map(function (cb, i) {
      var ps = $('[data-pos="' + i + '"]', mount);
      return { visible: cb.checked, position: ps ? Number(ps.value) || 0 : 0 };
    });
    return d;
  }
  function applyHomeDraft(mount, d) {
    Object.keys(d.set || {}).forEach(function (k) { var n = mount.querySelector('[data-set="' + k + '"]'); if (n) n.value = d.set[k]; });
    if (d.st != null && $('#st_open', mount)) $('#st_open', mount).checked = d.st;
    if (d.closed != null && $('#st_closed', mount)) $('#st_closed', mount).value = d.closed;
    if (d.schedule) applySchedule(mount, d.schedule);
    if (d.pay != null && $('#payMethods', mount)) $('#payMethods', mount).value = d.pay;
    if (d.msg != null && $('#msgTpl', mount)) $('#msgTpl', mount).value = d.msg;
    if (d.contact != null && $('#contactTpl', mount)) $('#contactTpl', mount).value = d.contact;
    if (d.share != null && $('#shareTpl', mount)) $('#shareTpl', mount).value = d.share;
    if (d.heroShow != null && $('#hero_show', mount)) $('#hero_show', mount).checked = d.heroShow;
    if (d.logo != null) {
      var lf = mount.querySelector('input[type=hidden][data-k="logo"]');
      var lp = mount.querySelector('[data-prev="logo"]');
      if (lf) lf.value = d.logo;
      if (lp) { if (d.logo) { lp.src = SB.resolveImage(d.logo, 96); lp.style.visibility = ''; } else { lp.removeAttribute('src'); lp.style.visibility = 'hidden'; } }
    }
    (d.sections || []).forEach(function (sec, i) {
      var cb = mount.querySelector('[data-visible="' + i + '"]'), ps = mount.querySelector('[data-pos="' + i + '"]');
      if (cb) cb.checked = sec.visible; if (ps) ps.value = sec.position;
    });
  }

  function renderHome(mount) {
    var pending = PENDING.home || null;
    PENDING.home = null;
    var startPane = (pending && pending.pane) || 'general';
    mount.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando…</div>';
    getSettings().then(function (s) {
      var store = s.store || {}, hero = s.hero || {}, texts = s.texts || {}, sections = s.sections || [];
      var logo = store.logo || hero.logo || '';
      var cardLogo = '<div class="card"><h3>Logo de la tienda</h3><p class="desc">Se muestra en el encabezado de todas las páginas y en la portada. Sube una imagen o pega una ruta/URL.</p>' +
        fieldHtml({ k: 'logo', l: 'Logo', t: 'image', help: 'PNG, WEBP o SVG con fondo transparente.' }, logo) +
        '<div class="check" style="margin-top:10px"><input type="checkbox" id="hero_show"' + (hero.showLogo !== false ? ' checked' : '') + '><span>Mostrar el logo en la portada</span></div></div>';
      var cardStore = '<div class="card"><h3>Tienda</h3><p class="desc">Datos generales y de contacto.</p><div class="row">' +
        fld('store.name', 'Nombre', store.name) + fld('store.whatsapp', 'WhatsApp (número)', store.whatsapp) +
        fld('store.phone', 'Teléfono', store.phone) + fld('store.email', 'Correo', store.email) +
        fld('store.hours', 'Horario (texto libre)', store.hours) + fld('store.address', 'Dirección', store.address) +
        fld('store.currency', 'Símbolo moneda', store.currency) +
        sel('store.currencyPosition', 'Posición moneda', [['before', 'Antes ($10)'], ['after', 'Después (10 $)']], store.currencyPosition || 'before') +
        '</div><div class="check"><input type="checkbox" id="st_open"' + (store.open !== false ? ' checked' : '') + '><span>Tienda abierta (interruptor general)</span></div>' +
        '<p class="desc" style="margin:4px 0 0">Si lo desmarcas, la tienda se muestra cerrada sin importar el horario.</p>' +
        '<div class="field"><label>Mensaje de tienda cerrada</label><input type="text" id="st_closed" placeholder="Déjalo vacío para usar el mensaje automático" value="' + esc(store.closedMessage || '') + '"></div>' +
        '</div>';
      var cardSchedule = '<div class="card"><h3>Horario de atención</h3>' +
        '<p class="desc">Define los días y horas en que se aceptan pedidos. Fuera de este horario la tienda aparece <strong>cerrada</strong> y no se pueden enviar pedidos. Marca «cerrado» en los días sin atención.</p>' +
        '<div id="schNow" class="sched-now"></div>' +
        scheduleHtml(store.schedule) +
        '</div>';
      var cardHero = '<div class="card"><h3>Portada (Hero)</h3><div class="row">' +
        fld('hero.title', 'Título', hero.title) + fld('hero.subtitle', 'Subtítulo', hero.subtitle) +
        fld('hero.buttonText', 'Texto del botón', hero.buttonText) + fld('hero.buttonLink', 'Enlace del botón', hero.buttonLink) +
        '</div></div>';
      var cardTextos = '<div class="card"><h3>Textos de secciones</h3><div class="row">' +
        fld('texts.combos.badge', 'Combos · badge', texts.combos && texts.combos.badge) +
        fld('texts.combos.title', 'Combos · título', texts.combos && texts.combos.title) +
        ta('texts.combos.subtitle', 'Combos · subtítulo', texts.combos && texts.combos.subtitle) +
        fld('texts.bestSellers.badge', 'Vendidos · badge', texts.bestSellers && texts.bestSellers.badge) +
        fld('texts.bestSellers.title', 'Vendidos · título', texts.bestSellers && texts.bestSellers.title) +
        ta('texts.bestSellers.subtitle', 'Vendidos · subtítulo', texts.bestSellers && texts.bestSellers.subtitle) +
        '</div></div>';
      var cardSec = '<div class="card"><h3>Secciones del home</h3><p class="desc">Visibilidad y orden.</p>' +
        '<div id="secList">' + sections.map(function (sec, i) { return sectionRow(sec, i); }).join('') + '</div></div>';
      var cardPay = '<div class="card"><h3>Métodos de pago</h3><p class="desc">Uno por línea.</p>' +
        '<textarea id="payMethods" style="min-height:110px">' + esc((store.paymentMethods || []).join('\n')) + '</textarea></div>';
      var cardMsg1 = '<div class="card"><h3>Plantilla de mensaje (WhatsApp) — Cotización</h3><p class="desc">Variables: {storeName} {name} {location} {paymentMethod} {items} {total}</p>' +
        '<textarea id="msgTpl" style="min-height:130px">' + esc(store.messageTemplate || '') + '</textarea></div>';
      var cardMsg2 = '<div class="card"><h3>Plantilla de mensaje (WhatsApp) — Contacto</h3><p class="desc">Variables: {storeName} {name} {subject} {message}</p>' +
        '<textarea id="contactTpl" style="min-height:110px">' + esc(store.contactTemplate || '') + '</textarea></div>';
      var cardMsg3 = '<div class="card"><h3>Plantilla de mensaje (WhatsApp) — Compartir producto</h3><p class="desc">Variables: {storeName} {name} {sub} {url}</p>' +
        '<textarea id="shareTpl" style="min-height:90px">' + esc(store.shareTemplate || '') + '</textarea></div>';

      var panes = [
        { k: 'general', l: 'General', html: cardStore + cardSchedule },
        { k: 'portada', l: 'Portada', html: cardLogo + cardHero },
        { k: 'textos', l: 'Textos', html: cardTextos + cardSec },
        { k: 'pagos', l: 'Pagos', html: cardPay },
        { k: 'mensajes', l: 'Mensajes', html: cardMsg1 + cardMsg2 + cardMsg3 }
      ];
      if (!panes.some(function (p) { return p.k === startPane; })) startPane = 'general';
      var subnav = '<div class="subnav" role="tablist">' +
        panes.map(function (p) { return '<button class="subnav-btn' + (p.k === startPane ? ' active' : '') + '" data-htab="' + p.k + '" type="button" role="tab">' + esc(p.l) + '</button>'; }).join('') +
        '</div>';
      var panesHtml = panes.map(function (p) { return '<div class="hpane" data-pane="' + p.k + '"' + (p.k === startPane ? '' : ' hidden') + '>' + p.html + '</div>'; }).join('');
      var html = '<form id="homeForm">' + subnav + panesHtml + '</form>';
      mount.innerHTML = html;

      wireForm([{ k: 'logo', t: 'image' }], mount, {});

      var va = $('#viewActions');
      if (va) {
        va.innerHTML = '';
        va.appendChild(el('span', { class: 'muted', id: 'draftNote' }));
        va.appendChild(el('button', { class: 'btn primary', id: 'saveHome' }, 'Guardar cambios'));
      }
      var saveBtn = $('#saveHome');
      var note = $('#draftNote');
      var draftTimer = null;
      var form = $('#homeForm', mount);
      form.addEventListener('input', scheduleDraft);
      form.addEventListener('change', scheduleDraft);

      // Indicador en vivo: ¿abierta ahora según el formulario?
      var schNowEl = $('#schNow', mount);
      function updateSchNow() {
        if (!schNowEl) return;
        var sch = readSchedule(mount);
        var open = $('#st_open', mount) ? $('#st_open', mount).checked : true;
        var now = new Date();
        var keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        var d = sch[keys[now.getDay()]] || {};
        var hm = function (s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
        var cur = now.getHours() * 60 + now.getMinutes();
        var o = hm(d.o), x = hm(d.x);
        var isOpen = open && !d.c && o != null && x != null && cur >= o && cur < x;
        schNowEl.innerHTML = '<span class="sched-badge ' + (isOpen ? 'on' : 'off') + '">' + (isOpen ? 'Abierta ahora' : 'Cerrada ahora') + '</span>';
      }
      form.addEventListener('input', updateSchNow);
      form.addEventListener('change', updateSchNow);
      updateSchNow();
      var subnav = mount.querySelector('.subnav');
      if (subnav) {
        subnav.onclick = function (e) {
          var btn = e.target.closest('.subnav-btn');
          if (!btn) return;
          subnav.querySelectorAll('.subnav-btn').forEach(function (x) { x.classList.toggle('active', x === btn); });
          mount.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== btn.dataset.htab; });
        };
      }

      var draft = readHomeDraft();
      if (draft) {
        applyHomeDraft(mount, draft);
        note.textContent = 'Borrador sin guardar';
        toast('Borrador restaurado', 'ok', 'Descartar', function () { clearHomeDraft(); renderHome(mount); });
      }

      if (saveBtn) saveBtn.addEventListener('click', function () { saveHome(s); });

      function scheduleDraft() {
        if (draftTimer) clearTimeout(draftTimer);
        draftTimer = setTimeout(function () {
          try { localStorage.setItem(homeDraftKey(), JSON.stringify(captureHomeDraft(mount))); } catch (e) {}
          note.textContent = 'Borrador sin guardar';
        }, 400);
      }
    }).catch(function (e) { mount.innerHTML = '<div class="card empty">Error: ' + esc(e.message) + '</div>'; });

    function fld(name, label, v) {
      return '<div class="field"><label>' + esc(label) + '</label><input type="text" data-set="' + name + '" value="' + esc(v == null ? '' : v) + '"></div>';
    }
    function ta(name, label, v) {
      return '<div class="field"><label>' + esc(label) + '</label><textarea data-set="' + name + '">' + esc(v == null ? '' : v) + '</textarea></div>';
    }
    function sel(name, label, opts, v) {
      return '<div class="field"><label>' + esc(label) + '</label><select data-set="' + name + '">' +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
    }
    function sectionRow(sec, i) {
      return '<div class="spread" style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px" data-sec="' + i + '">' +
        '<div class="check"><input type="checkbox" data-visible="' + i + '"' + (sec.visible !== false ? ' checked' : '') + '><span><strong>' + esc(sec.label || sec.key) + '</strong> <span class="muted">(' + esc(sec.key) + ')</span></span></div>' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="muted">Orden</span><input type="number" data-pos="' + i + '" value="' + (sec.position || 0) + '" style="width:80px"></div></div>';
    }
  }

  function saveHome(orig) {
    var root = $('#view');
    var out = JSON.parse(JSON.stringify(orig));
    var set = {};
    $all('[data-set]', root).forEach(function (n) { set[n.dataset.set] = n.value.trim(); });
    out.store = out.store || {}; out.hero = out.hero || {}; out.texts = out.texts || {};
    Object.keys(set).forEach(function (path) {
      var parts = path.split('.');
      var o = out; for (var i = 0; i < parts.length - 1; i++) { o = o[parts[i]] = o[parts[i]] || {}; }
      o[parts[parts.length - 1]] = set[path];
    });
    out.store.open = $('#st_open').checked;
    out.store.closedMessage = $('#st_closed').value.trim();
    out.store.schedule = readSchedule(root);
    out.store.paymentMethods = $('#payMethods').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    out.store.messageTemplate = $('#msgTpl').value;
    out.store.contactTemplate = $('#contactTpl').value;
    out.store.shareTemplate = $('#shareTpl').value;
    out.hero.showLogo = $('#hero_show').checked;
    var logoInp = root.querySelector('input[type=hidden][data-k="logo"]');
    if (logoInp) out.store.logo = logoInp.value.trim();
    (out.sections || []).forEach(function (sec, i) {
      var cb = root.querySelector('[data-visible="' + i + '"]'); var ps = root.querySelector('[data-pos="' + i + '"]');
      if (cb) sec.visible = cb.checked;
      if (ps) sec.position = Number(ps.value) || 0;
    });
    SB.upsert('settings', { store_id: sid(), data: out, updated_at: new Date().toISOString() }, 'store_id')
      .then(function () {
        invalidate(); clearHomeDraft();
        var note = $('#draftNote'); if (note) note.textContent = '';
        logActivity('Guardó configuración del home');
        toast('Configuración guardada', 'ok');
      })
      .catch(function (e) { toast(e.message, 'err'); });
  }

  /* =========================================================
   *  Temas / Festivos
   * ========================================================= */
  var COLOR_KEYS = ['brand', 'brandDark', 'brandLight', 'accent', 'bg', 'surface', 'text', 'darkBg', 'darkSurface', 'darkText'];
  var COLOR_LABELS = {
    brand: 'Color de marca',
    brandDark: 'Marca (oscuro)',
    brandLight: 'Marca (claro)',
    accent: 'Acento',
    bg: 'Fondo de la página',
    surface: 'Fondo de tarjetas',
    text: 'Color de texto',
    darkBg: 'Fondo (modo oscuro)',
    darkSurface: 'Tarjetas (modo oscuro)',
    darkText: 'Texto (modo oscuro)'
  };

  function renderThemes(mount) {
    mount.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando…</div>';
    Promise.all([load('themes', { select: '*', order: 'id.asc' }), getSettings()])
      .then(function (r) { draw(r[0], r[1]); })
      .catch(function (e) { mount.innerHTML = '<div class="card empty">Error: ' + esc(e.message) + '</div>'; });

    function draw(themes, s) {
      var holiday = s.holiday || {};
      var defTheme = ((s.store || {}).defaultTheme === 'dark') ? 'dark' : 'light';
      var html = '<div class="card"><h3>Tema predeterminado de la tienda</h3>' +
        '<p class="desc">Es el tema con el que abre la tienda la primera vez. Si el cliente pulsa el botón de modo oscuro, su elección se guarda en su navegador y se mantiene.</p>' +
        '<div class="theme-default-choices">' +
        '<button type="button" class="theme-default-btn' + (defTheme === 'light' ? ' active' : '') + '" data-default-theme="light" aria-pressed="' + (defTheme === 'light') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
        '<span><strong>Claro</strong><em>Fondo blanco por defecto</em></span></button>' +
        '<button type="button" class="theme-default-btn' + (defTheme === 'dark' ? ' active' : '') + '" data-default-theme="dark" aria-pressed="' + (defTheme === 'dark') + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
        '<span><strong>Oscuro</strong><em>Fondo oscuro por defecto</em></span></button>' +
        '</div></div>';

      html += '<div class="card"><h3>Modo festivo</h3><p class="desc">Cuando está activo (y dentro de las fechas), anula el tema por defecto.</p>' +
        '<div class="check"><input type="checkbox" id="h_active"' + (holiday.active ? ' checked' : '') + '><span>Activado</span></div>' +
        '<div class="row" style="margin-top:12px">' +
        sel('h_mode', 'Tema festivo', themes.map(function (t) { return [t.key, t.label]; }), holiday.mode || 'none', true) +
        fld('h_start', 'Desde', holiday.startDate, 'date') + fld('h_end', 'Hasta', holiday.endDate, 'date') + '</div>' +
        '<hr style="border:0;border-top:1px solid var(--border);margin:16px 0">' +
        '<div class="check"><input type="checkbox" id="h_banner_en"' + ((holiday.banner || {}).enabled ? ' checked' : '') + '><span>Mostrar banner</span></div>' +
        '<div class="row" style="margin-top:10px">' + fld('h_banner_text', 'Texto del banner', (holiday.banner || {}).text) + fld('h_banner_link', 'Enlace del banner', (holiday.banner || {}).link) + '</div>' +
        '<div class="spread" style="margin-top:12px"><div class="check"><input type="checkbox" id="h_snow"' + ((holiday.decorations || {}).snow ? ' checked' : '') + '><span>Nieve ❄</span></div>' +
        '<div class="check"><input type="checkbox" id="h_bats"' + ((holiday.decorations || {}).bats ? ' checked' : '') + '><span>Murciélagos 🦇</span></div></div>' +
        '<button class="btn primary" id="saveHoliday" style="margin-top:16px">Guardar festivo</button></div>';

      html += '<div class="card"><h3>Temas</h3><p class="desc">Elige el tema activo. Los colores y efectos se editan en la pestaña <strong>Apariencia</strong>.</p>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><button class="btn sm" id="goApariencia" type="button">Ir a Apariencia</button></div>' +
        // goApariencia wired below
        '<table class="responsive"><tbody>' +
        themes.map(function (t) {
          return '<tr><td data-label="Tema"><strong>' + esc(t.label) + '</strong> <span class="muted">(' + esc(t.key) + ')</span></td>' +
            '<td data-label="Activo"><label class="check"><input type="radio" name="activeTheme" data-active="' + esc(t.id) + '"' + (t.is_active ? ' checked' : '') + '><span>Activo</span></label></td></tr>';
        }).join('') +
        '</tbody></table></div>';
        mount.innerHTML = html;
        var ga = $('#goApariencia', mount); if (ga) ga.addEventListener('click', function () { switchTab('apariencia'); });

        $all('[data-default-theme]', mount).forEach(function (btn) {
          btn.addEventListener('click', function () {
            var t = btn.getAttribute('data-default-theme') === 'dark' ? 'dark' : 'light';
            s.store = s.store || {};
            s.store.defaultTheme = t;
            $all('[data-default-theme]', mount).forEach(function (b) {
              var on = b === btn;
              b.classList.toggle('active', on);
              b.setAttribute('aria-pressed', String(on));
            });
            try { localStorage.setItem('gh_store_default_theme', t); } catch (e) {}
            SB.upsert('settings', { store_id: sid(), data: s, updated_at: new Date().toISOString() }, 'store_id')
              .then(function () { toast('Tema de la tienda guardado: ' + (t === 'dark' ? 'oscuro' : 'claro'), 'ok'); })
              .catch(function (e) { toast(e.message, 'err'); });
          });
        });

        $('#saveHoliday', mount).addEventListener('click', function () {
        s.holiday = {
          active: $('#h_active').checked,
          mode: $('#h_mode').value,
          startDate: $('#h_start').value,
          endDate: $('#h_end').value,
          banner: { enabled: $('#h_banner_en').checked, text: $('#h_banner_text').value.trim(), link: $('#h_banner_link').value.trim() },
          decorations: { snow: $('#h_snow').checked, bats: $('#h_bats').checked }
        };
        SB.upsert('settings', { store_id: sid(), data: s, updated_at: new Date().toISOString() }, 'store_id')
          .then(function () { toast('Modo festivo guardado', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
      });

      $all('[data-active]', mount).forEach(function (rad) {
        rad.addEventListener('change', function () {
          var tid = rad.dataset.active;
          Promise.all(themes.map(function (t) {
            return SB.update('themes', { id: 'eq.' + t.id }, { is_active: String(t.id) === String(tid) });
          })).then(function () { toast('Tema activo actualizado', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
    }
    function fld(name, label, v, type) {
      return '<div class="field"><label>' + esc(label) + '</label><input type="' + (type || 'text') + '" id="' + name + '" value="' + esc(v == null ? '' : v) + '"></div>';
    }
    function sel(name, label, opts, v, allowNone) {
      var o = allowNone ? '<option value="none">— ninguno —</option>' : '';
      o += opts.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(x[0]) === String(v) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
      return '<div class="field"><label>' + esc(label) + '</label><select id="' + name + '">' + o + '</select></div>';
    }
  }

  /* =========================================================
   *  Apariencia (colores + efectos por tema)
   * ========================================================= */
  function renderApariencia(mount) {
    mount.innerHTML = '<div class="loading"><span class="spinner"></span> Cargando…</div>';
    load('themes', { select: '*', order: 'id.asc' })
      .then(draw)
      .catch(function (e) { mount.innerHTML = '<div class="card empty">Error: ' + esc(e.message) + '</div>'; });

    function draw(themes) {
      var html = '<div class="card"><h3>Colores y efectos</h3><p class="desc">Personaliza cada tema. La tienda usa el tema activo (o el festivo vigente). El botón de modo <strong>oscuro/claro</strong> de la tienda usa los colores "modo oscuro".</p>' +
        '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><button class="btn sm" id="goTemas" type="button">Ir a Temas / Festivos</button></div>';
      themes.forEach(function (t) {
        var c = t.colors || {};
        var fx = (t.decorations || {}).fx || {};
        html += '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:12px" data-theme="' + esc(t.id) + '">' +
          '<div class="spread"><strong>' + esc(t.label) + '</strong>' + (t.is_active ? '<span class="badge" style="position:static">Activo</span>' : '') + '</div>' +
          '<div class="row" style="margin-top:10px">' + COLOR_KEYS.map(function (k) {
            return '<div class="field mb0"><label>' + esc(COLOR_LABELS[k] || k) + '</label><input type="color" data-color="' + k + '" value="' + esc(c[k] || '#7c3aed') + '"></div>';
          }).join('') + '</div>' +
          '<div class="spread" style="margin-top:12px"><strong style="font-size:13px">Partículas</strong>' +
            '<div class="row">' +
              '<label class="check mb0"><input type="checkbox" data-t-snow="' + esc(t.id) + '"' + ((t.decorations || {}).snow ? ' checked' : '') + '><span>Nieve ❄</span></label>' +
              '<label class="check mb0"><input type="checkbox" data-t-bats="' + esc(t.id) + '"' + ((t.decorations || {}).bats ? ' checked' : '') + '><span>Murciélagos 🦇</span></label>' +
            '</div></div>' +
          '<hr style="border:0;border-top:1px solid var(--border);margin:14px 0">' +
          '<strong style="font-size:13px">Efectos de tarjetas y transiciones</strong>' +
          '<div class="row" style="margin-top:8px">' +
            '<div class="field mb0"><label>Color de hover (tarjetas)</label><input type="color" data-fx-hover="' + esc(t.id) + '" value="' + esc(fx.hover || c.brand || '#7c3aed') + '"></div>' +
            '<div class="field mb0"><label>Color del núcleo (barrido)</label><input type="color" data-fx-core="' + esc(t.id) + '" value="' + esc(fx.core || '#ffffff') + '"></div>' +
            '<div class="field mb0"><label>Color del resplandor</label><input type="color" data-fx-glow-color="' + esc(t.id) + '" value="' + esc(fx.glowColor || fx.hover || c.brand || '#7c3aed') + '"></div>' +
          '</div>' +
          '<div class="row" style="margin-top:8px">' +
            '<div class="field mb0"><label>Grosor del borde (px)</label><input type="number" min="1" max="8" step="1" data-fx-ring="' + esc(t.id) + '" value="' + esc(fx.ring != null ? fx.ring : 2) + '"></div>' +
            '<div class="field mb0"><label>Velocidad del giro (s)</label><input type="number" min="0.5" max="12" step="0.1" data-fx-speed="' + esc(t.id) + '" value="' + esc(fx.speed != null ? fx.speed : 3.2) + '"></div>' +
            '<div class="field mb0"><label>Color de transición</label><input type="color" data-fx-transition-color="' + esc(t.id) + '" value="' + esc(fx.transitionColor || '#2a1b4d') + '"></div>' +
          '</div>' +
          '<div class="row" style="margin-top:10px">' +
            '<label class="check"><input type="checkbox" data-fx-enabled="' + esc(t.id) + '"' + (fx.enabled !== false ? ' checked' : '') + '><span>Efecto hover activo</span></label>' +
            '<label class="check"><input type="checkbox" data-fx-animate="' + esc(t.id) + '"' + (fx.animate !== false ? ' checked' : '') + '><span>Girar el borde</span></label>' +
            '<label class="check"><input type="checkbox" data-fx-glow="' + esc(t.id) + '"' + (fx.glow !== false ? ' checked' : '') + '><span>Resplandor exterior</span></label>' +
            '<label class="check"><input type="checkbox" data-fx-transition="' + esc(t.id) + '"' + (fx.transition !== false ? ' checked' : '') + '><span>Transición al abrir/cerrar producto</span></label>' +
          '</div>' +
          '<div class="field" style="margin-top:12px"><label>Vista previa</label>' +
            '<div class="theme-preview" data-preview>' +
              '<div class="tp-top"><span class="tp-dot"></span><span class="tp-dot"></span><span class="tp-dot"></span></div>' +
              '<div class="tp-body"><div class="tp-hero"><span class="tp-title"></span><span class="tp-btn"></span></div>' +
              '<div class="tp-cards"><span class="tp-card"></span><span class="tp-card"></span><span class="tp-card"></span></div></div>' +
            '</div></div>' +
          '<button class="btn" data-save-theme="' + esc(t.id) + '" style="margin-top:10px">Guardar paleta y efectos</button></div>';
      });
      html += '</div>';
      mount.innerHTML = html;
      var gta = $('#goTemas', mount); if (gta) gta.addEventListener('click', function () { switchTab('temas'); });

      if (window.ColorPicker && ColorPicker.init) ColorPicker.init(mount);

      function paintPreview(box) {
        var pv = box.querySelector('[data-preview]'); if (!pv) return;
        function cc(k) { var inp = box.querySelector('[data-color="' + k + '"]'); return inp ? inp.value : '#7c3aed'; }
        pv.style.background = cc('bg');
        pv.style.color = cc('text');
        var hero = pv.querySelector('.tp-hero'); hero.style.background = cc('brandLight');
        pv.querySelector('.tp-title').style.background = cc('text');
        pv.querySelector('.tp-btn').style.background = cc('brand');
        $all('.tp-card', pv).forEach(function (card) { card.style.background = cc('surface'); card.style.color = cc('text'); });
        pv.style.borderColor = cc('brandDark');
      }
      $all('[data-theme]', mount).forEach(function (box) {
        paintPreview(box);
        $all('[data-color]', box).forEach(function (inp) { inp.addEventListener('input', function () { paintPreview(box); }); });
      });

      $all('[data-save-theme]', mount).forEach(function (btn) {
        btn.addEventListener('click', function () {
          var tid = btn.dataset.saveTheme;
          var box = mount.querySelector('[data-theme="' + tid + '"]');
          var theme = themes.filter(function (t) { return String(t.id) === String(tid); })[0];
          var colors = {}; COLOR_KEYS.forEach(function (k) { colors[k] = box.querySelector('[data-color="' + k + '"]').value; });
          var fx = {
            hover: box.querySelector('[data-fx-hover]').value,
            core: box.querySelector('[data-fx-core]').value,
            glowColor: box.querySelector('[data-fx-glow-color]').value,
            ring: clampNum(box.querySelector('[data-fx-ring]').value, 2, 1, 8),
            speed: clampNum(box.querySelector('[data-fx-speed]').value, 3.2, 0.5, 12),
            enabled: box.querySelector('[data-fx-enabled]').checked,
            animate: box.querySelector('[data-fx-animate]').checked,
            glow: box.querySelector('[data-fx-glow]').checked,
            transition: box.querySelector('[data-fx-transition]').checked,
            transitionColor: box.querySelector('[data-fx-transition-color]').value
          };
          var deco = Object.assign({}, theme.decorations, {
            snow: box.querySelector('[data-t-snow]').checked,
            bats: box.querySelector('[data-t-bats]').checked,
            fx: fx
          });
          SB.update('themes', { id: 'eq.' + tid }, { colors: colors, decorations: deco })
            .then(function () { toast('Paleta y efectos guardados', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
    }
  }

  /* =========================================================
   *  Usuarios (admins)
   * ========================================================= */
  function renderUsers(mount) {
    var run = function () {
    mount.innerHTML = skeleton(4);
    var rows = [], creds = [], credsOk = true, credMap = {};
    function loadAll() {
      return Promise.all([
        load('admins', { select: '*', order: 'created_at.asc' }),
        load('admin_credentials', { select: '*' }).catch(function () { credsOk = false; return []; })
      ]).then(function (r) {
        rows = r[0];
        creds = r[1] || [];
        credMap = {};
        creds.forEach(function (c) { credMap[c.admin_id] = c; });
      });
    }
    loadAll().then(function () {
      var saved = uiGet('usuarios', {});
      var state = { q: saved.q || '' };
      draw();

      function reload() { return loadAll().then(renderBody); }

      function draw() {
        mount.innerHTML = toolbarHtml({
          search: true, searchId: 'uQ', placeholder: 'Buscar usuario…', countId: 'uCount',
          buttons: [{ label: '+ Crear usuario', id: 'newUser', class: 'primary' }]
        }) + '<div id="uBody"></div>' +
          '<div class="card"><p class="mb0 muted" style="font-size:12.5px">Creas la cuenta con correo y contraseña; el usuario entra al panel con esos datos y puede cambiarla en <strong>Mi cuenta</strong>. El propietario ve las contraseñas de esta tienda. ' +
          (credsOk ? 'Si Supabase tiene activada la confirmación por correo, el usuario deberá confirmar antes de entrar.' : '<strong>Falta ejecutar <code>supabase/admin_credentials.sql</code> para guardar y ver contraseñas.</strong>') +
          '</p></div>';
        $('#uQ', mount).value = state.q;
        renderBody();
        $('#uQ', mount).addEventListener('input', function () { state.q = this.value; uiSet('usuarios', { q: state.q }); renderBody(); });
        $('#newUser', mount).addEventListener('click', inviteUser);
      }

      function renderBody() {
        var body = $('#uBody', mount);
        var view = filterRows(rows, state.q, ['name', 'username', 'role', function (r) { return r.id; }]);
        $('#uCount', mount).textContent = view.length + ' de ' + rows.length + ' usuario(s)';
        if (!rows.length) {
          body.innerHTML = emptyState('Sin usuarios', 'Invita a un editor para ayudarte a gestionar la tienda.', 'Invitar usuario', 'emptyNew');
          var eb = $('#emptyNew', body); if (eb) eb.addEventListener('click', inviteUser);
          return;
        }
        if (!view.length) { body.innerHTML = '<div class="card empty">Ningún usuario coincide.</div>'; return; }
        body.innerHTML = '<div class="card" style="padding:0;overflow:auto"><table class="responsive"><thead><tr><th>Nombre</th><th>Correo</th><th>Usuario</th><th>Contraseña</th><th>Rol</th><th>Estado</th><th></th></tr></thead><tbody>' +
          view.map(function (r) {
            var c = credMap[r.id];
            var passCell = c
              ? '<code class="muted" data-pw="' + esc(c.password) + '">••••••</code> <button class="btn sm" data-reveal="' + esc(r.id) + '">Ver</button>'
              : '<span class="muted">—</span>';
            return '<tr data-id="' + esc(r.id) + '"><td data-label="Nombre">' + esc(r.name || '—') + '<div class="muted" style="font-size:12px">' + esc(r.id) + '</div></td>' +
              '<td data-label="Correo">' + esc((c && c.email) || '—') + '</td>' +
              '<td data-label="Usuario">' + esc(r.username || '—') + '</td>' +
              '<td data-label="Contraseña">' + passCell + '</td>' +
              '<td data-label="Rol"><span class="tag role">' + esc(r.role) + '</span></td>' +
              '<td data-label="Estado">' + (r.active ? '<span class="tag on">Activo</span>' : '<span class="tag off">Inactivo</span>') + '</td>' +
              '<td data-label=""><div class="list-actions"><button class="btn sm" data-edit="' + esc(r.id) + '">Editar</button>' +
              (r.id === S.me.id ? '' : '<button class="btn sm danger" data-del="' + esc(r.id) + '">Quitar</button>') + '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
        body.onclick = function (e) {
          var rv = e.target.closest('[data-reveal]');
          if (rv) {
            var code = rv.parentNode.querySelector('[data-pw]');
            if (code) {
              var hidden = code.dataset.hidden !== '0';
              code.textContent = hidden ? code.dataset.pw : '••••••';
              code.dataset.hidden = hidden ? '0' : '1';
              rv.textContent = hidden ? 'Ocultar' : 'Ver';
            }
            return;
          }
          var ed = e.target.closest('[data-edit]');
          if (ed) { editUser(rows.filter(function (r) { return r.id === ed.dataset.edit; })[0]); return; }
          var de = e.target.closest('[data-del]');
          if (de) doRemove(de.dataset.del);
        };
      }

      function doRemove(id) {
        var row = rows.filter(function (r) { return r.id === id; })[0];
        confirmDialog('¿Quitar el perfil de «' + ((row && (row.name || row.username)) || id) + '»? (La cuenta de Auth no se borra.)', function () {
          SB.remove('admins', { id: 'eq.' + id }).then(function () {
            toast('Quitado', 'ok'); logActivity('Quitó usuario: ' + (row && (row.name || row.username))); reload();
          }).catch(function (e) { toast(e.message, 'err'); });
        });
      }

      function editUser(row) {
        openModal({
          title: 'Editar usuario',
          body: '<form id="uForm"><div class="field"><label>Nombre</label><input id="u_name" value="' + esc(row.name || '') + '"></div>' +
            '<div class="field"><label>Usuario</label><input id="u_user" value="' + esc(row.username || '') + '"></div>' +
            '<div class="field"><label>Rol</label><select id="u_role"><option value="editor"' + (row.role === 'editor' ? ' selected' : '') + '>editor</option>' +
            '<option value="owner"' + (row.role === 'owner' ? ' selected' : '') + '>owner</option></select></div>' +
            '<div class="check"><input type="checkbox" id="u_active"' + (row.active ? ' checked' : '') + '><span>Activo</span></div></form>',
          buttons: [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Guardar', class: 'primary', onClick: function () {
              SB.update('admins', { id: 'eq.' + row.id }, {
                name: $('#u_name').value.trim(), username: $('#u_user').value.trim() || null,
                role: $('#u_role').value, active: $('#u_active').checked
              }).then(function () { closeModal(); toast('Guardado', 'ok'); logActivity('Editó usuario: ' + $('#u_name').value.trim()); reload(); })
                .catch(function (e) { toast(e.message, 'err'); });
            } }
          ]
        });
      }

      function inviteUser() {
        var busy = false;
        openModal({
          title: 'Crear usuario',
          body: '<form id="invForm"><div class="field"><label>Correo</label><input type="email" id="i_email" required autocomplete="off"></div>' +
            '<div class="field"><label>Contraseña</label><div style="display:flex;gap:8px"><input type="text" id="i_pass" required autocomplete="new-password" style="flex:1"><button type="button" class="btn" id="i_gen">Generar</button></div></div>' +
            '<div class="field"><label>Nombre</label><input id="i_name"></div>' +
            '<div class="field mb0"><label>Rol</label><select id="i_role"><option value="editor">editor</option><option value="owner">owner</option></select></div>' +
            '<p class="help">El propietario de esta tienda podrá ver esta contraseña en la lista. El usuario puede cambiarla después en <strong>Mi cuenta</strong>.</p></form>',
          buttons: [
            { label: 'Cancelar', onClick: closeModal },
            { label: 'Crear', class: 'primary', onClick: function () {
              if (busy) return;
              var email = $('#i_email').value.trim(), pass = $('#i_pass').value;
              if (!email || !pass) return toast('Correo y contraseña obligatorios', 'err');
              if (pass.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', 'err');
              var name = $('#i_name').value.trim(), role = $('#i_role').value;
              busy = true;
              SB.adminSignUp(email, pass).then(function (res) {
                var uid = res && res.user && res.user.id;
                if (!uid) throw new Error('No se pudo crear el usuario (¿confirmación por correo activada?).');
                return SB.insert('admins', { id: uid, name: name, role: role, active: true, store_id: sid() }).then(function () {
                  return SB.insert('admin_credentials', {
                    admin_id: uid, store_id: sid(), email: email, password: pass, updated_at: new Date().toISOString()
                  }).catch(function () { return false; });
                });
              }).then(function (saved) {
                closeModal();
                toast(saved === false ? 'Usuario creado, pero falta ejecutar admin_credentials.sql' : 'Usuario creado', saved === false ? 'err' : 'ok');
                logActivity('Creó usuario: ' + email);
                reload();
              }).catch(function (e) {
                busy = false;
                toast(e.message, 'err');
              });
            } }
          ]
        });
        var gen = $('#i_gen');
        if (gen) gen.addEventListener('click', function () {
          var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
          var out = '';
          var buf = new Uint32Array(12);
          if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
          else for (var i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 4294967295);
          for (var j = 0; j < 12; j++) out += chars[buf[j] % chars.length];
          $('#i_pass').value = out;
        });
      }
    }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  /* =========================================================
   *  Tiendas (solo owner)
   * ========================================================= */
  function renderStores(mount) {
    var run = function () {
      mount.innerHTML = skeleton(3);
      SB.get('stores', { select: '*', order: 'id.asc' }).then(function (rows) {
        draw();

        function draw() {
          mount.innerHTML =
            '<div class="card"><h3>Tiendas</h3><p class="desc mb0">Cada tienda tiene su propio catálogo, tema, armador y panel. Comparten base de datos.</p></div>' +
            '<div class="card" style="padding:0;overflow:auto"><table class="responsive"><thead><tr><th>#</th><th>Nombre</th><th>Slug</th><th>Estado</th><th>Panel</th></tr></thead><tbody>' +
              rows.map(function (s) {
                return '<tr><td data-label="ID">' + esc(s.id) + '</td>' +
                  '<td data-label="Nombre"><strong>' + esc(s.name) + '</strong></td>' +
                  '<td data-label="Slug"><code>' + esc(s.slug) + '</code></td>' +
                  '<td data-label="Estado">' + (s.active ? '<span class="tag on">Activa</span>' : '<span class="tag off">Suspendida</span>') + '</td>' +
                  '<td data-label="Panel">' + (Number(s.id) === sid() ? '<span class="tag">Panel actual</span>' : '<span class="muted">Otro repositorio</span>') + '</td></tr>';
              }).join('') + '</tbody></table></div>' +
            '<div class="card"><h3>Crear tienda</h3>' +
              '<p class="desc">Clona configuración, temas, navegación y armador de la tienda actual. El catálogo arranca vacío.</p>' +
              '<div class="row">' +
                '<div class="field"><label>Nombre</label><input id="stName" maxlength="80" placeholder="Tienda 004"></div>' +
                '<div class="field"><label>Slug</label><input id="stSlug" maxlength="40" placeholder="tienda-004"></div>' +
              '</div>' +
              '<button type="button" class="btn primary" id="stCreate">Crear tienda</button>' +
              '<p class="help" style="margin-top:12px">Después crea el usuario en Supabase Auth y asígnale un perfil en <code>admins</code> con el <code>store_id</code> nuevo. El panel de esa tienda se despliega desde su propio repositorio con <code>STORE_ID</code> ajustado en <code>assets/js/config.js</code>.</p>' +
            '</div>';
          $('#stCreate', mount).addEventListener('click', createStore);
        }

        function createStore() {
          var name = $('#stName', mount).value.trim();
          var slug = $('#stSlug', mount).value.trim().toLowerCase();
          if (!name) return toast('Escribe un nombre', 'err');
          if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return toast('Slug no válido (minúsculas, números y guiones)', 'err');
          var btn = $('#stCreate', mount);
          btn.disabled = true;
          SB.rpc('create_store', { p_slug: slug, p_name: name, p_source: sid() }).then(function (id) {
            var newId = Array.isArray(id) ? id[0] : id;
            toast('Tienda creada', 'ok');
            logActivity('Creó la tienda ' + name + ' (#' + newId + ')');
            rows = rows.concat([{ id: newId, name: name, slug: slug, active: true }]);
            draw();
            openModal({
              title: 'Tienda creada',
              body: '<p>La tienda <strong>' + esc(name) + '</strong> quedó con el id <strong>' + esc(newId) + '</strong>.</p>' +
                '<p class="muted">Para darle acceso: crea el usuario en <strong>Supabase → Authentication → Users</strong> y ejecuta en SQL Editor:</p>' +
                '<pre style="white-space:pre-wrap;font-size:12px;background:rgba(0,0,0,.06);padding:12px;border-radius:8px">insert into public.admins (id, name, username, role, active, store_id)\nvalues (\'UUID-DEL-USUARIO\', \'Owner\', \'owner\', \'owner\', true, ' + esc(newId) + ');</pre>' +
                '<p class="muted mb0">Luego despliega el repositorio de esa tienda con <code>STORE_ID: ' + esc(newId) + '</code> en <code>assets/js/config.js</code>.</p>',
              buttons: [{ label: 'Entendido', class: 'primary', onClick: closeModal }]
            });
          }).catch(function (e) {
            btn.disabled = false;
            toast(e.message, 'err');
          });
        }
      }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  /* =========================================================
   *  Pedidos
   * ========================================================= */
  var ORDER_STATUS = ['nuevo', 'en_proceso', 'pagado', 'entregado', 'cancelado'];
  function renderOrders(mount) {
    var run = function () {
    mount.innerHTML = skeleton(5);
    load('orders', { select: '*', order: 'created_at.desc' }).then(function (rows) {
      var saved = uiGet('pedidos', {});
      var state = { q: saved.q || '', status: saved.status || '' };
      if (PENDING.pedidos) { if (PENDING.pedidos.status != null) state.status = PENDING.pedidos.status; PENDING.pedidos = null; }
      function persist() { uiSet('pedidos', { q: state.q, status: state.status }); }
      draw();

      function visibleRows() {
        var v = filterRows(rows, state.q, ['name', 'phone', 'location', 'order_number', function (r) { return r.id; }]);
        if (state.status) v = v.filter(function (o) { return o.status === state.status; });
        return v;
      }
      function draw() {
        mount.innerHTML = toolbarHtml({
          search: true, searchId: 'oQ', placeholder: 'Buscar pedido, cliente o teléfono…',
          filters: [{ id: 'oStatus', options: [['', 'Todos los estados']].concat(ORDER_STATUS.map(function (s) { return [s, s]; })) }],
          countId: 'oCount',
          buttons: [{ label: 'Exportar CSV', id: 'csvBtn', class: 'ghost' }]
        }) + '<div id="oBody"></div>';
        $('#oQ', mount).value = state.q;
        $('#oStatus', mount).value = state.status;
        renderBody();
        $('#oQ', mount).addEventListener('input', function () { state.q = this.value; persist(); renderBody(); });
        $('#oStatus', mount).addEventListener('change', function () { state.status = this.value; persist(); renderBody(); });
        $('#csvBtn', mount).addEventListener('click', exportCsv);
      }
      function renderBody() {
        var body = $('#oBody', mount);
        var view = visibleRows();
        $('#oCount', mount).textContent = view.length + ' de ' + rows.length + ' pedido(s)';
        if (!rows.length) {
          body.innerHTML = emptyState('Sin pedidos todavía', 'Cuando un cliente envíe una cotización aparecerá aquí.', '', '', '🧾');
          return;
        }
        if (!view.length) { body.innerHTML = '<div class="card empty">Ningún pedido coincide con los filtros.</div>'; return; }
        body.innerHTML = '<div class="card" style="padding:0;overflow:auto"><table class="responsive"><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr></thead><tbody>' +
          view.map(function (o) {
            return '<tr><td data-label="Pedido">' + (o.order_number || o.id) + '</td><td data-label="Cliente"><strong>' + esc(o.name) + '</strong><div class="muted" style="font-size:12px">' + esc(o.phone || '') + '</div></td>' +
              '<td data-label="Total">' + money(o.total) + '</td><td data-label="Estado"><span class="pill ' + esc(o.status) + '">' + esc(o.status) + '</span></td>' +
              '<td data-label="Fecha" class="muted">' + esc(new Date(o.created_at).toLocaleString()) + '</td>' +
              '<td data-label=""><button class="btn sm" data-view="' + esc(o.id) + '">Ver</button></td></tr>';
          }).join('') + '</tbody></table></div>';
        body.onclick = function (e) {
          var b = e.target.closest('[data-view]');
          if (b) openOrder(rows.filter(function (r) { return String(r.id) === b.dataset.view; })[0]);
        };
      }
      function reload() { return load('orders', { select: '*', order: 'created_at.desc' }).then(function (r2) { rows = r2; renderBody(); refreshNavBadge(); }); }
      function exportCsv() {
        var cols = [
          { l: 'Nº', v: function (o) { return o.order_number || o.id; } },
          { l: 'Cliente', v: function (o) { return o.name; } },
          { l: 'Teléfono', v: function (o) { return o.phone; } },
          { l: 'Ubicación', v: function (o) { return o.location; } },
          { l: 'Pago', v: function (o) { return o.payment_method; } },
          { l: 'Total', v: function (o) { return o.total; } },
          { l: 'Estado', v: function (o) { return o.status; } },
          { l: 'Fecha', v: function (o) { return o.created_at; } }
        ];
        downloadBlob('pedidos-' + Date.now() + '.csv', toCSV(rows, cols), 'text/csv;charset=utf-8');
      }
      function openOrder(o) {
        var items = (o.items || []).map(function (it) {
          return '<tr><td data-label="Ítem">' + esc(it.name || it.title || '') + '</td><td data-label="Cant.">' + esc(it.qty || 1) + '</td><td data-label="Precio">' + money(it.price) + '</td></tr>';
        }).join('');
        openModal({
          title: 'Pedido #' + (o.order_number || o.id),
          body: '<div class="row"><div class="field"><label>Cliente</label><input value="' + esc(o.name) + '" readonly></div>' +
            '<div class="field"><label>Teléfono</label><input value="' + esc(o.phone || '') + '" readonly></div></div>' +
            '<div class="row"><div class="field"><label>Ubicación</label><input value="' + esc(o.location || '') + '" readonly></div>' +
            '<div class="field"><label>Pago</label><input value="' + esc(o.payment_method || '') + '" readonly></div></div>' +
            (o.note ? '<div class="field"><label>Nota</label><textarea readonly>' + esc(o.note) + '</textarea></div>' : '') +
            '<div class="card" style="padding:0;margin:0 0 14px"><table class="responsive"><thead><tr><th>Ítem</th><th>Cant.</th><th>Precio</th></tr></thead><tbody>' + items + '</tbody></table></div>' +
            '<div class="field"><label>Estado</label><select id="o_status">' + ORDER_STATUS.map(function (s) { return '<option value="' + s + '"' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>',
          buttons: [
            { label: 'Cerrar', onClick: closeModal },
            { label: 'Guardar estado', class: 'primary', onClick: function () {
              var st = $('#o_status').value;
              SB.update('orders', { id: 'eq.' + o.id }, { status: st }).then(function () {
                closeModal(); toast('Estado actualizado', 'ok');
                logActivity('Cambió pedido #' + (o.order_number || o.id) + ' a ' + st);
                invalidate(); refreshNavBadge(); reload();
              }).catch(function (e) { toast(e.message, 'err'); });
            } }
          ]
        });
      }
    }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  // Actualiza el badge de pedidos nuevos en el menú lateral.
  function refreshNavBadge() {
    var badges = $all('[data-badge="pedidos"]');
    if (!badges.length) return;
    load('orders', { select: 'id,status' }).then(function (rows) {
      var n = rows.filter(function (o) { return o.status === 'nuevo'; }).length;
      badges.forEach(function (badge) { badge.textContent = n; badge.hidden = !n; });
    }).catch(function () {});
  }

  /* =========================================================
   *  Dashboard + Backup
   * ========================================================= */
  function dashboardSkeleton() {
    return '<div class="dash-wrap" aria-hidden="true">' +
      '<div class="dash-hero"><span class="sk sk-hero-title"></span><span class="sk sk-hero-btn"></span></div>' +
      '<div class="dash-stats">' + [0, 1, 2, 3].map(function () { return '<span class="sk sk-stat"></span>'; }).join('') + '</div>' +
      '<div class="dashboard-layout"><span class="sk sk-panel"></span><span class="sk sk-panel"></span></div>' +
      '</div>';
  }

  function renderDashboard(mount) {
    var run = function () {
    mount.innerHTML = dashboardSkeleton();
    Promise.all([
      SB.get('products', scope('products', { select: 'id,type,hidden,image' })),
      SB.get('categories', scope('categories', { select: 'id' })),
      SB.get('activity_log', scope('activity_log', { select: 'text,created_at,user_id', order: 'created_at.desc', limit: '10' })).catch(function () { return []; }),
      SB.get('admins', scope('admins', { select: 'id,name,username' })).catch(function () { return []; }),
      SB.get('orders', scope('orders', { select: 'id,status' })).catch(function () { return []; }),
      getSettings().catch(function () { return null; })
    ]).then(function (r) {
      var prod = r[0], cats = r[1], log = r[2] || [], admins = r[3] || [], orders = r[4] || [], settings = r[5] || {};
      var settingsOk = r[5] != null;
      draw();

      function draw() {
        var normal = prod.filter(function (p) { return p.type !== 'combo'; });
        var combos = prod.filter(function (p) { return p.type === 'combo'; });
        var nProd = normal.length, nCombo = combos.length;
        var nHidden = prod.filter(function (p) { return p.hidden; }).length;
        var nNoImg = prod.filter(function (p) { return !p.image; }).length;
        var nNewOrders = orders.filter(function (o) { return o.status === 'nuevo'; }).length;
        var nInProcess = orders.filter(function (o) { return o.status === 'en_proceso'; }).length;
        var isOpen = !settings.store || settings.store.open !== false;
        var nameOf = {}; admins.forEach(function (a) { nameOf[a.id] = a.name || a.username || ''; });
        var acts = log.slice(0, 10);
        var who = (S.me && (S.me.name || S.me.username)) || '';
        var now = new Date();
        var dateStr = now.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
        dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

        var actHtml = acts.length ? '<ul class="activity">' + acts.map(function (a) {
          var name = nameOf[a.user_id] || '';
          var initial = name ? name.trim().charAt(0).toUpperCase() : '';
          return '<li><span class="act-avatar" aria-hidden="true">' + esc(initial || '·') + '</span>' +
            '<span class="act-body"><span class="act-text">' + esc(a.text) + '</span>' +
            '<span class="act-meta">' + (name ? esc(name) + ' · ' : '') + esc(timeAgo(a.created_at)) + '</span></span></li>';
        }).join('') + '</ul>' : '<div class="dash-empty"><span class="dash-empty-ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
          '</span><p>Aquí verás los cambios del panel en cuanto ocurran.</p></div>';

        mount.innerHTML =
          '<div class="dash-wrap">' +
            '<header class="dash-hero">' +
              '<div class="dash-hero-copy">' +
                '<p class="dash-eyebrow">Resumen de la tienda</p>' +
                '<h1>' + (who ? 'Hola, ' + esc(who) : 'Hola') + '</h1>' +
                '<p class="dash-hero-sub">' + esc(dateStr) + ' · <strong style="color:' + (isOpen ? 'var(--ok)' : 'var(--danger)') + '">' + (isOpen ? 'Tienda abierta' : 'Tienda cerrada') + '</strong></p>' +
              '</div>' +
              '<div class="dash-hero-actions">' +
                '<button type="button" class="btn ' + (isOpen ? '' : 'primary') + '" data-store-power="' + (isOpen ? 'close' : 'open') + '"' + (settingsOk ? '' : ' disabled title="No se pudieron cargar los ajustes"') + '>' +
                  (isOpen ? 'Cerrar tienda' : 'Abrir tienda') + '</button>' +
                '<button type="button" class="btn primary" data-create="productos">+ Nuevo producto</button>' +
                '<button type="button" class="btn" data-tab="pedidos">Ver pedidos</button>' +
              '</div>' +
            '</header>' +
            '<div class="dash-stats">' +
              stat({ tab: 'productos', icon: 'productos', tone: 'brand', value: nProd, label: 'Productos', meta: visibleMeta(normal) }) +
              stat({ tab: 'combos', icon: 'combos', tone: 'blue', value: nCombo, label: 'Combos', meta: visibleMeta(combos) }) +
              stat({ tab: 'categorias', icon: 'categorias', tone: 'teal', value: cats.length, label: 'Categorías', meta: cats.length === 1 ? '1 categoría activa' : cats.length + ' categorías activas' }) +
              stat({ tab: 'pedidos', status: 'nuevo', icon: 'pedidos', tone: 'amber', value: nNewOrders, label: 'Pedidos nuevos', meta: nInProcess ? nInProcess + ' en proceso' : 'Todo al día' }) +
            '</div>' +
            '<div class="dashboard-layout">' +
              '<section class="card dash-card"><header class="card-head"><div><h3>Accesos rápidos</h3><p class="desc">A donde quieres ir ahora.</p></div></header>' +
                '<div class="quick-grid">' +
                  quick('pedidos', 'pedidos', 'Pedidos', nNewOrders ? nNewOrders + ' sin revisar' : orders.length + ' en total') +
                  quick('productos', 'productos', 'Productos', nProd + ' en catálogo') +
                  quick('combos', 'combos', 'Combos', nCombo + ' en catálogo') +
                  quick('categorias', 'categorias', 'Categorías', cats.length + ' registradas') +
                  quick('home', 'portada', 'Portada', 'Hero y logo', ' data-pane="portada"') +
                  quick('navegacion', 'navegacion', 'Navegación', 'Menú de la tienda') +
                  quick('apariencia', 'apariencia', 'Apariencia', 'Colores y estilo') +
                  quick('backup', 'backup', 'Backup', 'Exportar / restaurar') +
                '</div>' +
                ((nHidden || nNoImg) ? '<div class="alert-strip"><span class="alert-ico" aria-hidden="true">!</span><div class="alert-copy"><div class="alert-title">Necesita tu atención</div><div class="alert-list">' +
                  (nHidden ? '<button type="button" class="alert-pill" data-tab="productos" data-status="hidden">' + nHidden + ' oculto' + (nHidden === 1 ? '' : 's') + '</button>' : '') +
                  (nNoImg ? '<button type="button" class="alert-pill" data-tab="productos" data-missing="image">' + nNoImg + ' sin imagen</button>' : '') +
                '</div></div></div>' : '') +
              '</section>' +
              '<section class="card dash-card dash-activity"><header class="card-head"><div><h3>Actividad reciente</h3><p class="desc">Últimos cambios en el panel.</p></div></header><div class="card-body dash-activity-body">' + actHtml + '</div></section>' +
            '</div>' +
          '</div>';

        $all('[data-tab]', mount).forEach(function (b) {
          b.addEventListener('click', function () {
            var f = {};
            if (b.dataset.status) f.status = b.dataset.status;
            if (b.dataset.missing) f.missing = b.dataset.missing;
            if (b.dataset.pane) f.pane = b.dataset.pane;
            goTab(b.dataset.tab, Object.keys(f).length ? f : null);
          });
        });
        $all('[data-store-power]', mount).forEach(function (b) {
          b.addEventListener('click', function () {
            var wantOpen = b.dataset.storePower === 'open';
            if (!settingsOk) return toast('No se pudieron cargar los ajustes de la tienda', 'err');
            function apply() {
              var next = JSON.parse(JSON.stringify(settings || {}));
              next.store = next.store || {};
              next.store.open = wantOpen;
              SB.upsert('settings', { store_id: sid(), data: next, updated_at: new Date().toISOString() }, 'store_id')
                .then(function () {
                  settings = next;
                  invalidate();
                  logActivity((wantOpen ? 'Abrió' : 'Cerró') + ' la tienda');
                  toast(wantOpen ? 'Tienda abierta' : 'Tienda cerrada', 'ok');
                  draw();
                })
                .catch(function (e) { toast(e.message, 'err'); });
            }
            if (wantOpen) { apply(); return; }
            confirmDialog('La tienda dejará de mostrar su catálogo y no se podrán enviar pedidos hasta que la abras de nuevo.', apply, {
              title: 'Cerrar tienda', dangerLabel: 'Cerrar tienda', dangerClass: 'primary'
            });
          });
        });
        $all('[data-create]', mount).forEach(function (b) {
          b.addEventListener('click', function () { quickCreate(b.dataset.create); });
        });

        function stat(o) {
          return '<button type="button" class="stat stat-link" data-tab="' + esc(o.tab) + '"' + (o.status ? ' data-status="' + esc(o.status) + '"' : '') + '>' +
            '<span class="stat-top"><span class="stat-ico tone-' + o.tone + '">' + svgIcon(o.icon) + '</span></span>' +
            '<span class="stat-n">' + esc(o.value) + '</span>' +
            '<span class="stat-l">' + esc(o.label) + '</span>' +
            '<span class="stat-meta">' + esc(o.meta) + '</span></button>';
        }
        function visibleMeta(list) {
          var hidden = list.filter(function (p) { return p.hidden; }).length;
          var visible = list.length - hidden;
          return hidden ? visible + ' visibles · ' + hidden + ' ocultos' : visible + ' visibles';
        }
        function quick(tab, icon, title, sub, extra) {
          return '<button type="button" class="quick-item" data-tab="' + esc(tab) + '"' + (extra || '') + '>' +
            '<span class="quick-icon">' + svgIcon(icon) + '</span>' +
            '<span class="quick-text"><span class="quick-title">' + esc(title) + '</span><span class="quick-sub">' + esc(sub) + '</span></span>' +
            '<span class="quick-arrow" aria-hidden="true">›</span></button>';
        }
      }
    }).catch(function (e) { errorState(mount, e, run); });
    };
    run();
  }

  function timeAgo(iso) {
    var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (isNaN(s)) return '';
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
    return 'hace ' + Math.floor(s / 86400) + ' d';
  }

  var BACKUP_TABLES = ['settings', 'categories', 'subcategories', 'products', 'combo_items', 'nav_groups', 'nav_items', 'builder_slots', 'builder_parts', 'themes', 'orders'];
  function renderBackup(mount) {
    mount.innerHTML =
      '<div class="card"><h3>Copia de seguridad</h3><p class="desc">Descarga un JSON con todas las tablas del catálogo y la configuración.</p>' +
      '<button class="btn primary" id="dlBackup">Descargar backup (JSON)</button></div>' +
      '<div class="card"><h3>Restaurar desde backup</h3><p class="desc">Sube un archivo JSON. Se combinan los registros (upsert); no borra lo existente.</p>' +
      '<label class="btn" for="impFile">Elegir archivo…</label>' +
      '<input type="file" id="impFile" accept="application/json,.json" hidden>' +
      '<div id="impStatus" class="status-line"></div></div>';

    $('#dlBackup', mount).addEventListener('click', function () {
      Promise.all(BACKUP_TABLES.map(function (t) { return SB.get(t, scope(t, { select: '*' })).then(function (rows) { return [t, rows]; }); }))
        .then(function (pairs) {
          var out = { exported_at: new Date().toISOString(), store_id: sid(), data: {} };
          pairs.forEach(function (p) { out.data[p[0]] = p[1]; });
          downloadBlob('maniaworld-backup-' + Date.now() + '.json', JSON.stringify(out, null, 2), 'application/json');
          toast('Backup descargado', 'ok');
        }).catch(function (e) { toast(e.message, 'err'); });
    });

    $('#impFile', mount).addEventListener('change', function () {
      var file = this.files[0]; if (!file) return;
      var st = $('#impStatus', mount);
      st.className = 'status-line'; st.textContent = 'Leyendo…';
      var reader = new FileReader();
      reader.onload = function () {
        var payload;
        try { payload = JSON.parse(reader.result); } catch (e) { st.textContent = 'JSON inválido.'; return; }
        var data = (payload && payload.data) || payload;
        var tables = BACKUP_TABLES.filter(function (t) { return Array.isArray(data[t]) && data[t].length; });
        if (!tables.length) { st.textContent = 'El archivo no contiene tablas reconocibles.'; return; }
        confirmDialog('Se importarán ' + tables.length + ' tabla(s) en esta tienda. ¿Continuar?', function () {
          st.textContent = 'Importando…';
          var total = 0;
          tables.reduce(function (chain, t) {
            return chain.then(function () {
              var rows = data[t].map(function (r) {
                var c = Object.assign({}, r);
                if (TENANT.indexOf(t) !== -1) c.store_id = sid();
                return c;
              });
              return SB.upsert(t, rows, t === 'settings' ? 'store_id' : 'id').then(function () { total += rows.length; });
            });
          }, Promise.resolve()).then(function () {
            invalidate();
            st.className = 'status-line ok';
            st.textContent = 'Importados ' + total + ' registro(s).';
            toast('Importación completada', 'ok');
            logActivity('Importó backup (' + total + ' registros)');
          }).catch(function (e) { st.textContent = 'Error: ' + e.message; toast(e.message, 'err'); });
        }, { title: 'Importar backup', dangerLabel: 'Importar', dangerClass: 'primary' });
      };
      reader.readAsText(file);
    });
  }

  /* =========================================================
   *  Navegación / tabs
   * ========================================================= */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    productos: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    combos: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    categorias: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    subcategorias: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    navegacion: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
    armador: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    temas: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    apariencia: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    pedidos: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01M18 16h.01"/>',
    usuarios: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tiendas: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
    backup: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    portada: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>'
  };
  function svgIcon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }

  var TABS = [
    { k: 'dashboard', l: 'Panel', grp: 'General', svg: 'dashboard', render: renderDashboard },
    { k: 'productos', l: 'Productos', grp: 'Catálogo', svg: 'productos', render: renderProducts },
    { k: 'combos', l: 'Combos', grp: 'Catálogo', svg: 'combos', render: renderCombos },
    { k: 'categorias', l: 'Categorías', grp: 'Catálogo', svg: 'categorias', render: function (m) { renderEntityList('categories', m); } },
    { k: 'subcategorias', l: 'Subcategorías', grp: 'Catálogo', svg: 'subcategorias', render: function (m) { renderEntityList('subcategories', m); } },
    { k: 'armador', l: 'Armador', grp: 'Catálogo', svg: 'armador', render: renderBuilderTab },
    { k: 'home', l: 'Home / Contenido', grp: 'Tienda', svg: 'home', render: renderHome },
    { k: 'navegacion', l: 'Navegación', grp: 'Tienda', svg: 'navegacion', render: renderNavTab },
    { k: 'apariencia', l: 'Apariencia', grp: 'Tienda', svg: 'apariencia', render: renderApariencia },
    { k: 'temas', l: 'Temas / Festivos', grp: 'Tienda', svg: 'temas', render: renderThemes },
    { k: 'pedidos', l: 'Pedidos', grp: 'Ventas', svg: 'pedidos', render: renderOrders },
    { k: 'tiendas', l: 'Tiendas', grp: 'Sistema', svg: 'tiendas', render: renderStores, ownerOnly: true },
    { k: 'usuarios', l: 'Usuarios', grp: 'Sistema', svg: 'usuarios', render: renderUsers, ownerOnly: true },
    { k: 'backup', l: 'Backup', grp: 'Sistema', svg: 'backup', render: renderBackup }
  ];

  function renderNavTab(mount) {
    mount.innerHTML = '<div class="nav2col">' +
      '<div><div class="card" style="padding:0"><h3 style="padding:18px 18px 0">Grupos</h3><div id="navGroups" style="padding:0 18px 18px"></div></div></div>' +
      '<div><div class="card" style="padding:0"><h3 style="padding:18px 18px 0">Ítems</h3><div id="navItems" style="padding:0 18px 18px"></div></div></div>' +
      '</div>';
    var selected = null;
    function drawGroups() {
      renderEntityList('nav_groups', $('#navGroups', mount), {
        title: 'Grupos', selectedId: selected,
        onRowClick: function (row) { selected = row.id; drawGroups(); drawItems(); }
      });
    }
    function drawItems() {
      renderEntityList('nav_items', $('#navItems', mount), {
        title: 'Ítems', filterField: 'group_id', filterValue: selected,
        hint: selected ? null : 'Selecciona un grupo a la izquierda para filtrar sus ítems.',
        emptyFilter: 'Este grupo aún no tiene ítems.',
        emptySub: 'Crea el primer grupo a la izquierda.'
      });
    }
    drawGroups(); drawItems();
  }
  function renderBuilderTab(mount) {
    mount.innerHTML = '<div class="nav2col">' +
      '<div><div class="card" style="padding:0"><h3 style="padding:18px 18px 0">Slots</h3><div id="bSlots" style="padding:0 18px 18px"></div></div></div>' +
      '<div><div class="card" style="padding:0"><h3 style="padding:18px 18px 0">Piezas</h3><div id="bParts" style="padding:0 18px 18px"></div></div></div>' +
      '</div>';
    var selected = null;
    function drawSlots() {
      renderEntityList('builder_slots', $('#bSlots', mount), {
        title: 'Slots', selectedId: selected,
        onRowClick: function (row) { selected = row.id; drawSlots(); drawParts(); }
      });
    }
    function drawParts() {
      renderEntityList('builder_parts', $('#bParts', mount), {
        title: 'Piezas', filterField: 'slot_id', filterValue: selected,
        hint: selected ? null : 'Selecciona un slot a la izquierda para filtrar sus piezas.',
        emptyFilter: 'Este slot aún no tiene piezas.',
        emptySub: 'Crea el primer slot a la izquierda.'
      });
    }
    drawSlots(); drawParts();
  }

  function buildSidebar() {
    var nav = $('#sideNav');
    nav.innerHTML = '';
    var groups = [];
    TABS.forEach(function (t) {
      if (t.ownerOnly && (!S.me || S.me.role !== 'owner')) return;
      var g = groups.filter(function (x) { return x.name === t.grp; })[0];
      if (!g) { g = { name: t.grp, tabs: [] }; groups.push(g); }
      g.tabs.push(t);
    });
    groups.forEach(function (g) {
      var box = el('div', { class: 'nav-group' });
      box.appendChild(el('div', { class: 'nav-heading' }, esc(g.name)));
      g.tabs.forEach(function (t) {
        var b = el('button', { class: 'nav-item' + (t.k === S.tab ? ' active' : ''), 'data-tab': t.k, type: 'button', 'aria-current': t.k === S.tab ? 'page' : 'false' },
          svgIcon(t.svg) + '<span>' + esc(t.l) + '</span>' + (t.k === 'pedidos' ? '<span class="badge" data-badge="pedidos" hidden>0</span>' : ''));
        b.addEventListener('click', function () { switchTab(t.k); });
        box.appendChild(b);
      });
      nav.appendChild(box);
    });
  }

  // Accesos rápidos de la barra inferior (teléfono). El centro es el botón "+".
  var TABBAR = [
    { k: 'categorias', l: 'Categorías', svg: 'categorias' },
    { k: 'productos', l: 'Productos', svg: 'productos' },
    { fab: true },
    { k: 'apariencia', l: 'Personalizar', svg: 'apariencia' },
    { k: 'pedidos', l: 'Pedidos', svg: 'pedidos', badge: true }
  ];
  var FAB_OPEN = false;
  var FAB_CREATE = [
    { k: 'productos', l: 'Nuevo producto', svg: 'productos' },
    { k: 'combos', l: 'Nuevo combo', svg: 'combos' },
    { k: 'categorias', l: 'Nueva categoría', svg: 'categorias' }
  ];

  function buildTabbar() {
    var bar = $('#tabbar');
    if (!bar) return;
    bar.innerHTML = '';
    TABBAR.forEach(function (t) {
      if (t.fab) {
        var wrap = el('div', { class: 'tabbar-fab-wrap' });
        var menu = el('div', { class: 'tabbar-fab-menu', hidden: true, role: 'menu' });
        FAB_CREATE.forEach(function (o) {
          var mb = el('button', { class: 'tabbar-fab-item', type: 'button', role: 'menuitem' },
            svgIcon(o.svg) + '<span>' + esc(o.l) + '</span>');
          mb.addEventListener('click', function (e) { e.stopPropagation(); setFab(false); quickCreate(o.k); });
          menu.appendChild(mb);
        });
        var fab = el('button', { class: 'tabbar-fab', type: 'button', 'aria-label': 'Crear', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>');
        fab.addEventListener('click', function (e) { e.stopPropagation(); setFab(!FAB_OPEN); });
        wrap.appendChild(menu);
        wrap.appendChild(fab);
        bar.appendChild(wrap);
        return;
      }
      var b = el('button', { class: 'tabbar-btn' + (t.k === S.tab ? ' active' : ''), 'data-tab': t.k, type: 'button' },
        svgIcon(t.svg) + '<span>' + esc(t.l) + '</span>' +
        (t.badge ? '<span class="tabbar-badge" data-badge="pedidos" hidden>0</span>' : ''));
      b.addEventListener('click', function () { switchTab(t.k); });
      bar.appendChild(b);
    });
    if (!bar.dataset.bound) {
      bar.dataset.bound = '1';
      document.addEventListener('click', function () { setFab(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setFab(false); });
    }
  }

  function setFab(open) {
    var bar = $('#tabbar');
    if (!bar) return;
    FAB_OPEN = !!open;
    var menu = $('.tabbar-fab-menu', bar);
    var fab = $('.tabbar-fab', bar);
    if (menu) menu.hidden = !open;
    if (fab) fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    bar.classList.toggle('fab-open', !!open);
  }

  // Abre el editor de alta de una sección tras navegar a ella.
  function quickCreate(tab) {
    switchTab(tab);
    var tries = 0;
    (function wait() {
      var b = document.getElementById('newBtn');
      if (b && b.offsetParent !== null) { b.click(); return; }
      if (b && tries > 6) { b.click(); return; }
      if (tries++ < 50) setTimeout(wait, 60);
    })();
  }

  function switchTab(key) {
    var tab = TABS.filter(function (t) { return t.k === key; })[0];
    if (!tab) return;
    S.tab = key;
    closeModal();
    setFab(false);
    $all('#sideNav .nav-item').forEach(function (b) {
      var on = b.dataset.tab === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    $all('#tabbar .tabbar-btn').forEach(function (b) {
      var on = b.dataset.tab === key;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
    });
    $('#viewTitle').textContent = tab.l;
    $('#viewActions').innerHTML = '';
    if (key === 'home') {
      var save = el('button', { class: 'btn primary', id: 'saveHome' }, 'Guardar cambios');
      $('#viewActions').appendChild(save);
    }
    toggleNav(false);
    tab.render($('#view'));
  }

  function toggleNav(force) {
    var sb = $('#sidebar');
    var open = force != null ? force : !sb.classList.contains('open');
    sb.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
  }

  /* =========================================================
   *  Arranque + Auth
   * ========================================================= */
  function showLogin() {
    $('#loginView').hidden = false;
    $('#appView').hidden = true;
  }
  function loginError(msg) {
    var e = $('#lgError');
    if (!e) return;
    e.hidden = false;
    e.textContent = msg || '';
  }
  /* =========================================================
   *  Tema del panel (claro / oscuro)
   * ========================================================= */
  var THEME_KEY = 'gh_admin_theme';
  function storedTheme() {
    try { var t = localStorage.getItem(THEME_KEY); return (t === 'dark' || t === 'light') ? t : null; } catch (e) { return null; }
  }
  function systemTheme() {
    try { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b = $('#themeToggle');
    if (b) {
      b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
      b.title = t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    }
  }
  function setTheme(t, persist) {
    applyTheme(t);
    if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  }
  function toggleTheme() {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
    toast(next === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado', 'ok');
  }
  function themeOptHtml(kind, title, desc) {
    var icon = kind === 'dark'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    return '<button type="button" class="theme-opt" data-theme-opt="' + kind + '">' +
      '<span class="theme-opt-ico">' + icon + '</span>' +
      '<span class="theme-opt-txt"><strong>' + title + '</strong><span>' + desc + '</span></span>' +
      '</button>';
  }
  function askThemeOnce(done) {
    if (storedTheme()) { if (done) done(); return; }
    openModal({
      title: 'Elige el tema del panel',
      size: 'sm',
      body: '<p class="muted" style="margin-top:0">Escoge cómo quieres ver el panel. Podrás cambiarlo cuando quieras con el botón de tema de la barra superior.</p>' +
        '<div class="theme-choice">' +
        themeOptHtml('light', 'Modo claro', 'Fondo claro, ideal con mucha luz.') +
        themeOptHtml('dark', 'Modo oscuro', 'Fondo oscuro, más cómodo de noche.') +
        '</div>',
      onMount: function (body) {
        $all('[data-theme-opt]', body).forEach(function (b) {
          b.addEventListener('click', function () {
            var t = b.getAttribute('data-theme-opt');
            setTheme(t, true);
            closeModal();
            toast(t === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado', 'ok');
            if (done) done();
          });
        });
      }
    });
  }

  function showApp() {
    $('#loginView').hidden = true;
    $('#appView').hidden = false;
    var who = $('#whoami');
    who.textContent = (S.me.name || S.user.email || '') + (S.me.role === 'owner' ? ' · propietario' : '');
    buildSidebar();
    buildTabbar();
    switchTab('dashboard');
    refreshNavBadge();
    var seen = false;
    try { seen = !!localStorage.getItem(tourDoneKey()); } catch (e) {}
    function maybeTour() { if (!seen) setTimeout(startTour, 500); }
    if (storedTheme()) maybeTour();
    else askThemeOnce(maybeTour);
    startSessionGuard();
  }

  function boot() {
    applyTheme(storedTheme() || systemTheme());
    var themeBtn = $('#themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    if (!SB.isConfigured()) {
      showLogin();
      return;
    }
    if (SB.isLoggedIn()) {
      resolveMe().then(showApp).catch(function (err) {
        console.error('[login] sesión guardada inválida:', err && err.message);
        SB.signOut().then(function () { showLogin(); loginError(err.message); });
      });
    } else {
      showLogin();
    }
  }

  function resolveMe() {
    S.user = SB.currentUser();
    if (!S.user) return Promise.reject(new Error('sin sesión'));
    return SB.get('admins', { select: '*', id: 'eq.' + S.user.id }).then(function (rows) {
      var me = rows[0];
      if (!me) throw new Error('Tu cuenta no tiene perfil de administrador. Pide al propietario que te agregue.');
      if (!me.active) throw new Error('Tu cuenta está desactivada.');
      var pinned = Number((window.GIGA_CONFIG && window.GIGA_CONFIG.STORE_ID) || 0);
      if (pinned && Number(me.store_id) !== pinned) {
        throw new Error('Esta cuenta pertenece a otra tienda. Usa el panel de la tienda ' + pinned + '.');
      }
      S.me = me;
      return me;
    });
  }

  /* =========================================================
   *  Paleta de búsqueda global (Ctrl+K)
   * ========================================================= */
  function openPalette() {
    var root = $('#paletteRoot');
    if (root && !root.hidden) return;
    root.hidden = false;
    root.innerHTML = '<div class="palette-scrim"></div>' +
      '<div class="palette" role="dialog" aria-modal="true" aria-label="Búsqueda global">' +
        '<div class="palette-input">' + SEARCH_ICO + '<input id="palQ" placeholder="Buscar pestañas, productos, pedidos…" autocomplete="off"></div>' +
        '<div class="palette-results" id="palRes"><p class="muted pad">Cargando…</p></div>' +
      '</div>';

    var input = $('#palQ', root), res = $('#palRes', root);
    var items = [], sel = 0;
    var tabsItems = TABS.map(function (t) {
      return { group: 'Ir a', label: t.l, hint: 'Sección', run: function () { switchTab(t.k); } };
    });
    var prodItems = [], orderItems = [];
    Promise.all([
      load('products', { select: 'id,name,type' }),
      load('orders', { select: 'id,order_number,name,status' })
    ]).then(function (r) {
      prodItems = r[0].map(function (p) {
        return { group: 'Producto', label: p.name, hint: p.type === 'combo' ? 'Combo' : 'Producto', run: function () { switchTab(p.type === 'combo' ? 'combos' : 'productos'); } };
      });
      orderItems = r[1].map(function (o) {
        return { group: 'Pedido', label: '#' + (o.order_number || o.id) + ' · ' + (o.name || ''), hint: o.status, run: function () { switchTab('pedidos'); } };
      });
      render('');
    }).catch(function () { render(''); });

    function render(q) {
      var ql = (q || '').trim().toLowerCase();
      var pool = tabsItems.concat(prodItems, orderItems);
      items = (ql ? pool.filter(function (it) { return it.label.toLowerCase().indexOf(ql) !== -1; }) : pool).slice(0, 12);
      sel = 0;
      if (!items.length) { res.innerHTML = '<p class="muted pad">Sin resultados.</p>'; return; }
      res.innerHTML = items.map(function (it, i) {
        return '<button type="button" class="palette-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' +
          '<span class="pi-main">' + esc(it.label) + '</span><span class="pi-hint">' + esc(it.group) + ' · ' + esc(it.hint) + '</span></button>';
      }).join('');
    }
    function move(d) {
      if (!items.length) return;
      sel = (sel + d + items.length) % items.length;
      $all('.palette-item', res).forEach(function (b, i) { b.classList.toggle('sel', i === sel); });
      var s = $('.palette-item.sel', res); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    }
    function go() { var it = items[sel]; if (it) { closePalette(); it.run(); } }
    function closePalette() {
      document.removeEventListener('keydown', onKey, true);
      root.hidden = true; root.innerHTML = '';
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(); }
    }
    $('.palette-scrim', root).addEventListener('click', closePalette);
    input.addEventListener('input', function () { render(this.value); });
    res.addEventListener('click', function (e) {
      var b = e.target.closest('.palette-item');
      if (b) { sel = Number(b.dataset.i); go(); }
    });
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { input.focus(); }, 0);
  }

  /* =========================================================
   *  Atajos / Ayuda
   * ========================================================= */
  function openShortcuts() {
    var rows = [
      ['Ctrl + K', 'Búsqueda global'],
      ['Ctrl + S', 'Guardar cambios (en Home)'],
      ['Esc', 'Cerrar diálogo o menú'],
      ['?', 'Abrir esta ayuda']
    ];
    var body = '<p class="desc">Atajos de teclado y guía rápida.</p>' +
      '<table class="shortcuts"><tbody>' + rows.map(function (r) {
        return '<tr><td><kbd>' + esc(r[0]) + '</kbd></td><td>' + esc(r[1]) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="muted" style="font-size:12.5px;margin-top:14px">¿Primera vez? Haz el recorrido guiado para conocer el panel.</p>';
    openModal({
      title: 'Ayuda y atajos',
      size: 'sm',
      body: body,
      buttons: [
        { label: 'Entendido', onClick: closeModal },
        { label: 'Ver recorrido', class: 'primary', onClick: function () { closeModal(); setTimeout(startTour, 120); } }
      ]
    });
  }

  /* =========================================================
   *  Recorrido guiado (tour)
   * ========================================================= */
  var TOUR_STEPS = [
    { tab: 'dashboard', sel: '.ws', title: 'Tu tienda', text: 'Desde aquí gestionas todo el contenido de la tienda.', side: 'right' },
    { tab: 'dashboard', sel: '#sideNav', title: 'Secciones', text: 'Agrupadas en Catálogo, Tienda y Sistema. Cada grupo abre su pestaña.', side: 'right' },
    { tab: 'productos', sel: '[data-tab="productos"]', title: 'Productos', text: 'Crea, edita, duplica y ordena tus productos. También combos y categorías.', side: 'right' },
    { tab: 'pedidos', sel: '[data-tab="pedidos"]', title: 'Ventas', text: 'Los pedidos que llegan de la tienda aparecen aquí con su estado.', side: 'right' },
    { tab: 'home', sel: '#viewActions', title: 'Guardar cambios', text: 'En Home y otras pestañas guarda con este botón o con Ctrl+S.', side: 'bottom' },
    { tab: 'dashboard', sel: '#searchBtn', title: 'Búsqueda rápida', text: 'Pulsa Ctrl+K para saltar a cualquier sección, producto o pedido.', side: 'bottom' },
    { tab: 'dashboard', sel: '#helpBtn', title: 'Ayuda', text: 'Puedes reabrir este recorrido cuando quieras desde aquí.', side: 'right' }
  ];
  var tour = null;
  function tourDoneKey() { return 'gh_tour_done_' + sid(); }
  function startTour() {
    if (tour) return;
    var ov = el('div', { class: 'tour-overlay' });
    var spot = el('div', { class: 'tour-spot' });
    var tip = el('div', { class: 'tour-tip', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Recorrido guiado' });
    tip.innerHTML = '<h4></h4><p></p><div class="tour-tip-actions">' +
      '<button class="btn ghost sm" data-skip type="button">Saltar</button>' +
      '<span class="tour-dots"></span>' +
      '<button class="btn sm" data-prev type="button">Anterior</button>' +
      '<button class="btn primary sm" data-next type="button">Siguiente</button></div>';
    ov.appendChild(spot); ov.appendChild(tip);
    document.body.appendChild(ov);
    tour = { ov: ov, spot: spot, tip: tip, i: 0 };
    tip.querySelector('[data-next]').addEventListener('click', function () {
      if (tour.i >= TOUR_STEPS.length - 1) return endTour();
      tour.i++; showStep();
    });
    tip.querySelector('[data-prev]').addEventListener('click', function () { if (tour.i > 0) { tour.i--; showStep(); } });
    tip.querySelector('[data-skip]').addEventListener('click', endTour);
    window.addEventListener('resize', positionTour);
    showStep();
  }
  function showStep() {
    if (!tour) return;
    var step = TOUR_STEPS[tour.i];
    if (step.tab && S.tab !== step.tab) switchTab(step.tab);
    setTimeout(positionTour, 80);
  }
  function positionTour() {
    if (!tour) return;
    var step = TOUR_STEPS[tour.i];
    var target = document.querySelector(step.sel);
    if (!target) { if (tour.i >= TOUR_STEPS.length - 1) return endTour(); tour.i++; return showStep(); }
    var r = target.getBoundingClientRect(), pad = 8;
    var sp = tour.spot;
    sp.style.top = (r.top - pad) + 'px';
    sp.style.left = (r.left - pad) + 'px';
    sp.style.width = (r.width + pad * 2) + 'px';
    sp.style.height = (r.height + pad * 2) + 'px';
    var tip = tour.tip;
    tip.querySelector('h4').textContent = step.title;
    tip.querySelector('p').textContent = step.text;
    tip.querySelector('[data-prev]').style.visibility = tour.i ? 'visible' : 'hidden';
    tip.querySelector('[data-next]').textContent = tour.i === TOUR_STEPS.length - 1 ? 'Finalizar' : 'Siguiente';
    tip.querySelector('.tour-dots').textContent = (tour.i + 1) + ' / ' + TOUR_STEPS.length;
    tip.style.visibility = 'hidden';
    tip.style.top = '0px'; tip.style.left = '0px';
    var tr = tip.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    var top, left;
    if (step.side === 'right') { left = r.right + pad + 10; top = r.top; }
    else { top = r.bottom + pad + 10; left = r.left; }
    if (top + tr.height > vh - 12) top = Math.max(12, r.top - tr.height - pad - 10);
    if (left + tr.width > vw - 12) left = Math.max(12, vw - tr.width - 12);
    if (left < 12) left = 12;
    if (top < 12) top = 12;
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.visibility = '';
  }
  function endTour() {
    if (!tour) return;
    window.removeEventListener('resize', positionTour);
    tour.ov.remove();
    tour = null;
    try { localStorage.setItem(tourDoneKey(), '1'); } catch (e) {}
  }

  function saveCurrent() {
    var s = $('#saveHome');
    if (s) { s.click(); return true; }
    return false;
  }

  /* =========================================================
   *  Seguridad: anti fuerza bruta (login) + vigencia de sesión
   * ========================================================= */
  // --- Bloqueo progresivo por correo (por navegador) ---
  var LOGIN_KEY = 'gh_login_guard';
  var MAX_TRIES = 5;
  var BASE_LOCK = 30 * 1000;         // 30 s al llegar al 5º fallo
  var MAX_LOCK = 15 * 60 * 1000;     // tope 15 min
  var lockTimer = null;

  function readGuard() {
    try { return JSON.parse(localStorage.getItem(LOGIN_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeGuard(g) { try { localStorage.setItem(LOGIN_KEY, JSON.stringify(g)); } catch (e) {} }
  function guardFor(email) { return (email && readGuard()[email]) || null; }
  function registerFail(email) {
    if (!email) return 0;
    var g = readGuard();
    var e = g[email] || { fails: 0, lockUntil: 0 };
    e.fails += 1;
    if (e.fails >= MAX_TRIES) {
      e.lockUntil = Date.now() + Math.min(MAX_LOCK, BASE_LOCK * Math.pow(2, e.fails - MAX_TRIES));
    }
    e.at = Date.now();
    g[email] = e;
    var keys = Object.keys(g);
    if (keys.length > 20) {
      keys.sort(function (a, b) { return (g[b].at || 0) - (g[a].at || 0); });
      keys.slice(20).forEach(function (k) { delete g[k]; });
    }
    writeGuard(g);
    return e.lockUntil;
  }
  function clearGuard(email) { var g = readGuard(); if (g[email]) { delete g[email]; writeGuard(g); } }
  function lockRemaining(email) {
    var e = guardFor(email);
    return (!e || !e.lockUntil) ? 0 : Math.max(0, e.lockUntil - Date.now());
  }
  function fmtWait(ms) {
    var s = Math.ceil(ms / 1000);
    return s < 60 ? s + ' s' : Math.ceil(s / 60) + ' min';
  }
  function stopLockTimer() { if (lockTimer) { clearInterval(lockTimer); lockTimer = null; } }
  function applyLock(email) {
    var bar = $('#lgLock'), btn = $('#lgBtn');
    var left = lockRemaining(email);
    if (left <= 0) {
      stopLockTimer();
      if (bar) { bar.hidden = true; bar.textContent = ''; }
      if (btn && !btn.dataset.busy) { btn.disabled = false; btn.textContent = 'Entrar'; }
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Bloqueado'; }
    if (bar) {
      bar.hidden = false;
      bar.textContent = 'Demasiados intentos fallidos. Espera ' + fmtWait(left) + ' para volver a intentarlo.';
      bar.classList.add('shake');
      setTimeout(function () { bar.classList.remove('shake'); }, 500);
    }
    if (!lockTimer) {
      lockTimer = setInterval(function () {
        var e = $('#lgEmail'); applyLock(e ? e.value.trim().toLowerCase() : '');
      }, 1000);
    }
  }

  // --- Vigencia de sesión: aviso 60 s antes + cierre automático ---
  var sessTimer = null, warnTick = null, touchAt = 0;
  var ACTIVITY = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'focus'];
  function onActivity() {
    var t = Date.now();
    if (t - touchAt < 20000) return;
    touchAt = t;
    SB.touch();
    hideSessionWarn();
  }
  function startSessionGuard() {
    stopSessionGuard();
    ACTIVITY.forEach(function (ev) { document.addEventListener(ev, onActivity, { passive: true }); });
    document.addEventListener('visibilitychange', checkSession);
    sessTimer = setInterval(checkSession, 5000);
    checkSession();
  }
  function stopSessionGuard() {
    if (sessTimer) { clearInterval(sessTimer); sessTimer = null; }
    ACTIVITY.forEach(function (ev) { document.removeEventListener(ev, onActivity); });
    document.removeEventListener('visibilitychange', checkSession);
    hideSessionWarn();
  }
  function hideSessionWarn() {
    var w = $('#sessWarn');
    if (w && !w.hidden) w.hidden = true;
    if (warnTick) { clearInterval(warnTick); warnTick = null; }
  }
  function showSessionWarn(limit) {
    var w = $('#sessWarn');
    if (!w) return;
    var isIdle = limit !== 'abs';
    var hours = Math.round((SB.SESSION.maxMs || 0) / 3600000);
    var ico = $('#sessWarnIco'), txt = $('#sessWarnTxt'), stay = $('#sessStay');
    if (ico) ico.textContent = isIdle ? '⏳' : '🔒';
    if (txt) txt.innerHTML = isIdle
      ? 'Tu sesión se cerrará por <strong>inactividad</strong> en <b id="sessWarnCount">60</b> s.'
      : 'Tu sesión alcanzó el <strong>máximo de ' + hours + ' h</strong>. Se cerrará en <b id="sessWarnCount">60</b> s.';
    if (stay) stay.hidden = !isIdle;
    w.hidden = false;
    if (warnTick) clearInterval(warnTick);
    var paint = function () {
      var el2 = $('#sessWarnCount');
      if (el2) el2.textContent = Math.max(0, Math.ceil(SB.remaining().min / 1000));
    };
    paint();
    warnTick = setInterval(paint, 1000);
  }
  function checkSession() {
    if (!$('#appView') || $('#appView').hidden) { hideSessionWarn(); return; }
    if (!SB.getSession() || !SB.isLoggedIn()) { doLogout('Tu sesión expiró. Inicia sesión de nuevo.'); return; }
    var r = SB.remaining();
    if (r.min <= 0) {
      doLogout(r.limit === 'abs'
        ? 'Tu sesión alcanzó el máximo permitido. Inicia sesión de nuevo.'
        : 'Sesión cerrada por inactividad.');
      return;
    }
    if (r.min <= 60000) showSessionWarn(r.limit); else hideSessionWarn();
  }
  function doLogout(msg) {
    stopSessionGuard();
    stopLockTimer();
    S.user = null; S.me = null;
    try { Promise.resolve(SB.signOut()).catch(function () {}); } catch (e) {}
    invalidate();
    showLogin();
    if (msg) loginError(msg);
  }

  var lgReveal = $('#lgReveal');
  if (lgReveal) {
    lgReveal.addEventListener('click', function () {
      var input = $('#lgPass');
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      lgReveal.setAttribute('aria-pressed', show ? 'true' : 'false');
      lgReveal.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#lgEmail').value.trim().toLowerCase();
    var pass = $('#lgPass').value;
    var btn = $('#lgBtn');
    var errBox = $('#lgError');
    if (errBox) { errBox.hidden = true; errBox.textContent = ''; }

    if (lockRemaining(email) > 0) { applyLock(email); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !pass) {
      loginError('Escribe un correo y una contraseña válidos.');
      return;
    }

    var started = Date.now();
    btn.dataset.busy = '1';
    btn.disabled = true;
    btn.textContent = 'Entrando';

    SB.signIn(email, pass).then(function () { return resolveMe(); }).then(function () {
      clearGuard(email);
      delete btn.dataset.busy;
      btn.disabled = false; btn.textContent = 'Entrar';
      showApp();
    }, function () {
      var left = registerFail(email);
      // Retardo mínimo: encarece la automatización sin bloquear al usuario.
      var wait = Math.max(0, 600 - (Date.now() - started));
      setTimeout(function () {
        delete btn.dataset.busy;
        if (left > 0 || lockRemaining(email) > 0) {
          loginError('Credenciales incorrectas. Acceso bloqueado temporalmente por seguridad.');
          applyLock(email);
        } else {
          var e2 = guardFor(email) || { fails: 0 };
          var left2 = Math.max(0, MAX_TRIES - e2.fails);
          loginError(left2 <= 2 ? 'Credenciales incorrectas. Te quedan ' + left2 + ' intento(s).' : 'Credenciales incorrectas.');
          btn.disabled = false; btn.textContent = 'Entrar';
        }
      }, wait);
    });
  });

  $('#logoutBtn').addEventListener('click', function () { doLogout('Has cerrado sesión.'); });
  window.addEventListener('giga:unauthorized', function () { doLogout('Tu sesión expiró por seguridad. Inicia sesión de nuevo.'); });
  var stayBtn = $('#sessStay');
  if (stayBtn) stayBtn.addEventListener('click', function () { SB.touch(); hideSessionWarn(); });
  var accountBtn = $('#accountBtn'); if (accountBtn) accountBtn.addEventListener('click', changeMyPassword);
  $('#menuToggle').addEventListener('click', function () { toggleNav(); });
  $('#sidebarScrim').addEventListener('click', function () { toggleNav(false); });
  $('#sidebarClose').addEventListener('click', function () { toggleNav(false); });
  var searchBtn = $('#searchBtn'); if (searchBtn) searchBtn.addEventListener('click', openPalette);
  var helpBtn = $('#helpBtn'); if (helpBtn) helpBtn.addEventListener('click', openShortcuts);
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); openPalette(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 's') { if (saveCurrent()) e.preventDefault(); return; }
    if (k === '?' && !e.ctrlKey && !e.metaKey) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') { e.preventDefault(); openShortcuts(); }
      return;
    }
    if (e.key === 'Escape') {
      var discard = document.querySelector('#modalRoot ~ .overlay.top, body > .overlay.top');
      if (discard) { discard.remove(); return; }
      if (tour) { endTour(); return; }
      if (!$('#paletteRoot').hidden) return;
      if ($('#modalRoot').children.length) { requestClose(); return; }
      if ($('#sidebar').classList.contains('open')) toggleNav(false);
    }
  });

  boot();
})();
