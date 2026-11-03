/*
 * data.js  -  Caché compartido de datos de Supabase.
 * ------------------------------------------------------------
 * Carga UNA vez por página: ajustes, temas, categorías,
 * subcategorías, productos, combos, armador.
 * Expone  window.GigaData  con:
 *   .ready        promesa que resuelve cuando todo cargó
 *   .settings .themes .categories .subcategories .products
 *   .comboItems .builderSlots .builderParts
 *   helpers: productsOf(type), productById(id),
 *            subsOf(categoryId), categoryById(id)
 *
 * Requiere assets/js/config.js + sb.js cargados ANTES.
 * Si Supabase no está configurado, resuelve con listas vacías
 * para que cada vista use su respaldo estático.
 */
(function () {
  'use strict';

  var SB = window.GigaSB;
  var STORE_ID = (window.GIGA_CONFIG && window.GIGA_CONFIG.STORE_ID) || 1;
  var D = {
    settings: {}, themes: [], categories: [], subcategories: [],
    products: [], comboItems: [], builderSlots: [], builderParts: []
  };

  // Toda consulta del sitio queda acotada a la tienda actual.
  function scoped(params) {
    var p = params || {};
    p.store_id = 'eq.' + STORE_ID;
    return p;
  }

  function order(table, cols) {
    return SB.get(table, scoped({ select: cols || '*', order: 'position.asc,id.asc' }))
      .then(function (r) { return r || []; }).catch(function () { return []; });
  }

  if (SB && SB.isConfigured()) {
    D.ready = Promise.all([
      SB.get('settings', scoped({ select: 'data' }))
        .then(function (r) { D.settings = (r && r[0] && r[0].data) || {}; }).catch(function () {}),
      SB.get('themes', scoped({ select: '*', order: 'id.asc' })).then(function (r) { D.themes = r || []; }).catch(function () {}),
      order('categories').then(function (r) { D.categories = r; }),
      order('subcategories').then(function (r) { D.subcategories = r; }),
      order('products').then(function (r) { D.products = r; }),
      SB.get('combo_items', scoped({ select: '*', order: 'position.asc' })).then(function (r) { D.comboItems = r || []; }).catch(function () {}),
      order('builder_slots').then(function (r) { D.builderSlots = r; }),
      SB.get('builder_parts', scoped({ select: '*', order: 'slot_id.asc,position.asc,id.asc' }))
        .then(function (r) { D.builderParts = r || []; }).catch(function () {})
    ]).then(function () { return D; });
  } else {
    D.ready = Promise.resolve(D);
  }

  D.productsOf = function (type) {
    return D.products.filter(function (p) { return p.type === type; });
  };
  D.productById = function (id) {
    for (var i = 0; i < D.products.length; i++) if (String(D.products[i].id) === String(id)) return D.products[i];
    return null;
  };
  D.categoryById = function (id) {
    for (var i = 0; i < D.categories.length; i++) if (String(D.categories[i].id) === String(id)) return D.categories[i];
    return null;
  };
  D.subsOf = function (categoryId) {
    return D.subcategories.filter(function (s) { return String(s.category_id) === String(categoryId); });
  };

  /* Rellena una plantilla con {variables}. Tokens sin valor quedan intactos.
     Devuelve ok:false y el texto original si el resultado queda vacio. */
  window.ghTemplate = function (tpl, vars) {
    if (!tpl) return '';
    vars = vars || {};
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k] == null ? '' : vars[k]) : m;
    });
  };

  /* Acceso corto a settings.store (config del negocio). */
  D.store = function () {
    return (D.settings && D.settings.store) ? D.settings.store : {};
  };

  /* Enlace de WhatsApp (wa.me). Sin numero, abre el selector de contacto. */
  window.waLink = function (phone, text) {
    var digits = String(phone || '').replace(/[^\d]/g, '');
    var q = text ? ('?text=' + encodeURIComponent(text)) : '';
    return 'https://wa.me/' + digits + q;
  };

  /* Horario del negocio: ¿esta abierta ahora?
     Combina el interruptor maestro (store.open) con el horario semanal
     (store.schedule = {mon:{c:bool,o:'HH:MM',x:'HH:MM'}, ...}).
     Si no hay horario configurado, se respeta solo el interruptor maestro. */
  var GH_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function ghHM(s) { var m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? (Number(m[1]) * 60 + Number(m[2])) : null; }
  window.ghStoreState = function (store) {
    store = store || (D.settings && D.settings.store) || {};
    var now = new Date();
    var sch = store.schedule || null;
    var st = { open: store.open !== false, manual: store.open !== false, schedule: sch, today: null, slot: null };
    if (store.open === false) st.open = false;
    if (sch) {
      var dayKey = GH_DAYS[now.getDay()];
      var d = sch[dayKey] || {};
      var cur = now.getHours() * 60 + now.getMinutes();
      var o = ghHM(d.o), x = ghHM(d.x);
      st.today = { key: dayKey, closed: !!d.c, o: d.o || '', x: d.x || '' };
      st.open = (store.open !== false) && !d.c && o != null && x != null && cur >= o && cur < x;
    }
    for (var i = 0; i < 7; i++) {
      var dd = new Date(now); dd.setDate(now.getDate() + i);
      var s = sch ? sch[GH_DAYS[dd.getDay()]] : null;
      if (sch) { if (s && !s.c && ghHM(s.o) != null) { st.slot = { offset: i, o: s.o, x: s.x }; break; } }
    }
    if (!sch && store.hours) st.slot = { offset: 0, o: '', x: '', text: store.hours };
    return st;
  };
  /* Texto del aviso de tienda cerrada (usa closedMessage o uno por defecto). */
  window.ghClosedMessage = function (store, st) {
    store = store || (D.settings && D.settings.store) || {};
    st = st || window.ghStoreState(store);
    var base = (store.closedMessage && String(store.closedMessage).trim()) || 'Estamos cerrados';
    base = base.replace(/[.\s]+$/, '');
    var when = '';
    if (st && st.slot) {
      if (st.slot.o && st.slot.x) when = st.slot.o + ' a ' + st.slot.x;
      else if (st.slot.text) when = st.slot.text;
    }
    var parts = [base + '.'];
    if (when) parts.push('Recibimos pedidos en horario laboral de ' + when + '.');
    parts.push('\u00a1Con gusto puedes ver nuestros productos!');
    return parts.join(' ');
  };

  window.GigaData = D;
})();
