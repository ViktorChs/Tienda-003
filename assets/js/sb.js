/*
 * sb.js  -  Cliente minimo de Supabase (REST + Auth) sin dependencias.
 * Uso:  window.GigaSB.get('products', 'select=*&order=position.asc')
 *
 * Lee credenciales de assets/js/config.js (window.GIGA_CONFIG).
 * Guarda la sesion del panel en localStorage (clave gh_admin_session).
 */
(function () {
  'use strict';

  var cfg = window.GIGA_CONFIG || {};
  var BASE = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  var KEY = String(cfg.SUPABASE_ANON_KEY || '');
  var BUCKET = cfg.STORAGE_BUCKET || 'images';
  var SESSION_KEY = 'gh_admin_session';

  // Vigencia de la sesion del panel (ms). Configurable desde config.js:
  //   window.GIGA_CONFIG.SESSION = { idleMs: 30*60*1000, maxMs: 12*60*60*1000 }
  // idleMs: sin actividad del usuario. maxMs: tope absoluto desde el login.
  var SEC = {
    idleMs: Number((cfg.SESSION && cfg.SESSION.idleMs) || 30 * 60 * 1000),
    maxMs: Number((cfg.SESSION && cfg.SESSION.maxMs) || 12 * 60 * 60 * 1000)
  };

  // Tablas/funciones siempre se pasan como literales en el codigo. Este
  // guardia lo garantiza: nada raro puede llegar a la URL de PostgREST.
  var SAFE_IDENT = /^[a-z_][a-z0-9_]*$/i;
  function ident(name) {
    if (typeof name !== 'string' || !SAFE_IDENT.test(name)) {
      throw new Error('Identificador no válido: ' + name);
    }
    return name;
  }

  function isConfigured() {
    return BASE.indexOf('http') === 0 && KEY && KEY.indexOf('TU_') !== 0;
  }

  function nowMs() { return Date.now(); }

  function getSession() {
    var s;
    try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
    if (!s || typeof s !== 'object' || typeof s.access_token !== 'string' || !s.access_token) return null;
    return s;
  }
  function setSession(s) {
    if (!s) { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} return; }
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function token() {
    var s = getSession();
    return s && s.access_token ? s.access_token : KEY;
  }
  function authHeaders() {
    return {
      apikey: KEY,
      Authorization: 'Bearer ' + token()
    };
  }

  // ---- Vigencia de la sesion ----
  function touchSession() {
    var s = getSession();
    if (!s) return null;
    s.last_activity = nowMs();
    if (!s.issued_at) s.issued_at = s.last_activity;
    setSession(s);
    return s;
  }
  // Restante (ms) hasta el limite que ocurra primero. limit: 'idle' | 'abs'.
  function sessionRemaining() {
    var s = getSession();
    if (!s) return { idle: 0, abs: 0, min: 0, limit: 'idle' };
    var t = nowMs();
    var last = s.last_activity || s.issued_at || t;
    var since = s.issued_at || last;
    var idle = SEC.idleMs - (t - last);
    var abs = SEC.maxMs - (t - since);
    return { idle: idle, abs: abs, min: Math.min(idle, abs), limit: idle <= abs ? 'idle' : 'abs' };
  }
  // Si vencio (inactividad o tope), borra la sesion y devuelve true.
  function expireIfStale() {
    var s = getSession();
    if (!s) return false;
    if (sessionRemaining().min <= 0) { setSession(null); return true; }
    return false;
  }
  // Sesion invalidada por el servidor (token revocado/expirado).
  function handleUnauthorized() {
    if (getSession()) setSession(null);
    try { window.dispatchEvent(new CustomEvent('giga:unauthorized')); } catch (e) {}
  }

  // Renueva el access_token antes de que caduque (sesion de 1h).
  // Si falla, se devuelve la sesion tal cual: el 401 lo reportara el request.
  function refreshSession() {
    var s = getSession();
    if (!s || !s.refresh_token) return Promise.resolve(s);
    if (expireIfStale()) return Promise.resolve(null);
    return fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (res) {
      if (!res.ok) {
        // El refresh_token ya no sirve (revocado o reusado): fuera.
        if (res.status === 400 || res.status === 401 || res.status === 403) handleUnauthorized();
        return getSession();
      }
      return res.json().then(function (data) {
        if (!getSession()) return null; // se cerró sesión en otra pestaña
        var ns = {
          access_token: data.access_token || s.access_token,
          refresh_token: data.refresh_token || s.refresh_token,
          expires_at: nowMs() + (data.expires_in ? data.expires_in * 1000 : 3600000),
          issued_at: s.issued_at || nowMs(),
          last_activity: nowMs(),
          user: data.user || s.user
        };
        setSession(ns);
        return ns;
      });
    }).catch(function () { return getSession(); });
  }

  function ensureFresh() {
    if (expireIfStale()) return Promise.resolve(null);
    var s = getSession();
    if (!s || !s.access_token) return Promise.resolve(s);
    if (!s.expires_at || s.expires_at - nowMs() > 60000) return Promise.resolve(s);
    return refreshSession();
  }

  // ---- REST ----
  function qs(params) {
    if (!params) return '';
    if (typeof params === 'string') {
      var raw = params.charAt(0) === '?' ? params.slice(1) : params;
      if (/[#\r\n]/.test(raw)) throw new Error('Parámetros no válidos');
      return raw ? '?' + raw : '';
    }
    var p = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) p.append(k, params[k]);
    });
    var s = p.toString();
    return s ? '?' + s : '';
  }

  function request(method, path, body, extraHeaders) {
    if (!isConfigured()) {
      return Promise.reject(new Error('Supabase no configurado: edita assets/js/config.js'));
    }
    return ensureFresh().then(function () {
      var headers = Object.assign({ 'Content-Type': 'application/json' }, authHeaders(), extraHeaders || {});
      return fetch(BASE + path, {
        method: method,
        headers: headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      }).then(function (res) {
        if (res.status === 204) return null;
        return res.text().then(function (txt) {
          var data = null;
          try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
          if (!res.ok) {
            if (res.status === 401) handleUnauthorized();
            var msg = (data && (data.message || data.error_description || data.error || data.hint)) || res.statusText;
            var err = new Error(msg || ('HTTP ' + res.status));
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      });
    });
  }

  function get(table, params) {
    return request('GET', '/rest/v1/' + ident(table) + qs(params));
  }
  function insert(table, rows) {
    return request('POST', '/rest/v1/' + ident(table), rows, { Prefer: 'return=representation' });
  }
  function update(table, match, patch) {
    return request('PATCH', '/rest/v1/' + ident(table) + qs(match), patch, { Prefer: 'return=representation' });
  }
  function remove(table, match) {
    return request('DELETE', '/rest/v1/' + ident(table) + qs(match), undefined, { Prefer: 'return=representation' });
  }
  // insert-or-update por columna unica (merge-duplicates)
  function upsert(table, rows, onConflict) {
    var extra = { Prefer: 'resolution=merge-duplicates,return=representation' };
    var path = '/rest/v1/' + ident(table) + (onConflict ? ('?on_conflict=' + encodeURIComponent(onConflict)) : '');
    return request('POST', path, rows, extra);
  }
  // llama una funcion RPC de Postgres (p.ej. create_order)
  function rpc(fn, args) {
    return request('POST', '/rest/v1/rpc/' + ident(fn), args || {});
  }

  // ---- Auth ----
  function signIn(email, password) {
    if (!isConfigured()) return Promise.reject(new Error('Supabase no configurado: edita assets/js/config.js'));
    return fetch(BASE + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error(data.error_description || data.msg || data.error || 'No se pudo iniciar sesion');
        }
        var session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: nowMs() + (data.expires_in ? data.expires_in * 1000 : 3600000),
          issued_at: nowMs(),
          last_activity: nowMs(),
          user: data.user
        };
        setSession(session);
        return session;
      });
    });
  }

  // Crea una cuenta nueva (registro) SIN reemplazar la sesión actual del panel.
  function adminSignUp(email, password) {
    if (!isConfigured()) return Promise.reject(new Error('Supabase no configurado: edita assets/js/config.js'));
    return fetch(BASE + '/auth/v1/signup', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error_description || data.msg || data.error || 'No se pudo crear el usuario');
        return data;
      });
    });
  }

  function signOut() {
    var s = getSession();
    setSession(null);
    if (s && s.access_token) {
      return fetch(BASE + '/auth/v1/logout', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token }
      }).catch(function () {});
    }
    return Promise.resolve();
  }

  function currentUser() {
    var s = getSession();
    return s ? s.user : null;
  }
  function isLoggedIn() {
    var s = getSession();
    if (!s || !s.access_token) return false;
    if (sessionRemaining().min <= 0) { setSession(null); return false; }
    if (!s.expires_at || s.expires_at > nowMs()) return true;
    // Caduco pero hay refresh_token: se renueva solo en el primer request.
    return !!s.refresh_token;
  }

  // ---- Storage ----
  var MAXW = Number(cfg.IMAGE_MAX_WIDTH) || 1600;
  var WEBP_Q = Number(cfg.IMAGE_WEBP_QUALITY) || 0.82;

  // Convertibles a WebP: cualquier imagen salvo SVG y GIF (perderian animacion).
  function canWebp(file) {
    return /^image\//i.test(file.type) && !/svg|gif/i.test(file.type);
  }

  // Redimensiona (max maxW de ancho) y recodifica a WebP con canvas.
  // Resuelve el Blob WebP, o null si el navegador no soporta el formato.
  function toWebp(file, maxW, quality) {
    return new Promise(function (resolve) {
      if (typeof document === 'undefined' || !window.URL || !URL.createObjectURL) { resolve(null); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var scale = Math.min(1, (maxW || 1600) / w);
          var cw = Math.max(1, Math.round(w * scale));
          var ch = Math.max(1, Math.round(h * scale));
          var canvas = document.createElement('canvas');
          canvas.width = cw; canvas.height = ch;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, cw, ch);
          canvas.toBlob(function (blob) {
            URL.revokeObjectURL(url);
            resolve(blob && /webp/i.test(blob.type) ? blob : null);
          }, 'image/webp', quality || 0.82);
        } catch (e) { URL.revokeObjectURL(url); resolve(null); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function putObject(name, body, type) {
    return ensureFresh().then(function () {
      return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + name, {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: 'Bearer ' + token(),
          'Content-Type': type || 'application/octet-stream',
          'x-upsert': 'true'
        },
        body: body
      });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('Subida fallida: ' + t); });
      return publicUrl(name);
    });
  }

  // Extensiones permitidas y tope de tamano (misma regla que el servidor
  // de OX1WhatShop). El nombre ya es aleatorio: ts-random.ext
  var OK_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
  var MAX_UPLOAD = 15 * 1024 * 1024;

  // Sube a Storage. Si es imagen convertible, la pasa a WebP primero.
  // Las rutas nuevas van bajo s{STORE_ID}/ para que RLS las aisle por tienda.
  function upload(path, file) {
    if (!file) return Promise.reject(new Error('No se recibio ninguna imagen'));
    if (!OK_EXT.test(file.name || '')) {
      return Promise.reject(new Error('Formato no permitido: usa PNG, JPG, WEBP, GIF o SVG'));
    }
    if (file.size && file.size > MAX_UPLOAD) {
      return Promise.reject(new Error('Imagen muy grande: maximo 15 MB'));
    }
    var pref = 's' + (Number(cfg.STORE_ID) || 1) + '/';
    var clean = String(path || '').replace(/^\/+|\/+$/g, '');
    var base = pref + (clean ? clean + '/' : '') + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var conv = canWebp(file) ? toWebp(file, MAXW, WEBP_Q) : Promise.resolve(null);
    return conv.then(function (blob) {
      if (blob) return putObject(base + '.webp', blob, 'image/webp');
      var ext = (file.name.split('.').pop() || 'png').toLowerCase();
      return putObject(base + '.' + ext, file, file.type || 'application/octet-stream');
    });
  }
  function publicUrl(path) {
    if (!path) return '';
    if (/^https?:/i.test(path)) return path;
    return BASE + '/storage/v1/object/public/' + BUCKET + '/' + path.replace(/^\/+/, '');
  }

  // ---- Storage: nombres, borrado y listado ----
  // Prefijo de esta tienda dentro del bucket (los uploads usan este prefijo).
  function storePrefix() { return 's' + (Number(cfg.STORE_ID) || 1) + '/'; }

  // Convierte una URL guardada en el nombre del objeto dentro del bucket.
  // Devuelve '' si la URL no apunta a un objeto de este bucket.
  function storageName(src) {
    if (!src) return '';
    var s = String(src).trim();
    if (!s) return '';
    var pub = '/storage/v1/object/public/' + BUCKET + '/';
    var i = s.indexOf(pub);
    if (i >= 0) return decodeURIComponent(s.slice(i + pub.length));
    var own = '/storage/v1/object/' + BUCKET + '/';
    var j = s.indexOf(own);
    if (j >= 0) return decodeURIComponent(s.slice(j + own.length));
    if (CDN) {
      var c = CDN.replace(/\/+$/, '') + '/';
      var k = s.indexOf(c);
      if (k === 0) return decodeURIComponent(s.slice(c.length));
    }
    return '';
  }

  // Borra un objeto del bucket. Solo deja borrar objetos de esta tienda.
  // Nunca lanza: devuelve {deleted, name, reason}.
  function removeImage(src) {
    var name = storageName(src);
    if (!name) return Promise.resolve({ deleted: false, reason: 'no-es-imagen-de-storage' });
    if (name.indexOf(storePrefix()) !== 0) return Promise.resolve({ deleted: false, name: name, reason: 'pertenece-a-otra-tienda' });
    var enc = name.split('/').map(encodeURIComponent).join('/');
    return ensureFresh().then(function () {
      return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + enc, {
        method: 'DELETE',
        headers: { apikey: KEY, Authorization: 'Bearer ' + token() }
      });
    }).then(function (res) {
      if (res.ok) return { deleted: true, name: name };
      return res.text().then(function (t) {
        return { deleted: false, name: name, reason: 'HTTP ' + res.status, detail: String(t || '').slice(0, 200) };
      });
    }).catch(function (e) {
      return { deleted: false, name: name, reason: e && e.message ? e.message : 'error' };
    });
  }

  // Lista los archivos del bucket (recursivo). Devuelve nombres de objeto.
  function listImages(prefix) {
    var pre = prefix == null ? storePrefix() : prefix;
    function list(p) {
      return fetch(BASE + '/storage/v1/object/list/' + BUCKET, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 1000, prefix: p })
      }).then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error('No se pudo listar: ' + String(t || '').slice(0, 160)); });
        return res.json();
      }).then(function (arr) {
        var files = [], folders = [];
        (arr || []).forEach(function (o) {
          if (!o || !o.name) return;
          if (o.id) files.push(p + o.name);
          else folders.push(o.name);
        });
        if (!folders.length) return files;
        return Promise.all(folders.map(function (f) { return list(p + f + '/'); })).then(function (subs) {
          return files.concat.apply(files, subs);
        });
      });
    }
    return ensureFresh().then(function () { return list(pre); });
  }

  // Resuelve cualquier valor de imagen a una URL usable:
  //   http(s) | data:  -> tal cual (externa)
  //   assets/ | ./ | / -> relativo a la pagina (archivo local)
  //   resto            -> objeto del bucket en Storage
  // Si IMAGE_CDN esta configurado (Fase G), las imagenes del bucket se
  // piden al Worker (capa de cache en el borde, gratis).
  var CDN = String(cfg.IMAGE_CDN || '').replace(/\/+$/, '');

  // Base de la carpeta assets/, calculada desde la URL real de este script
  // (.../assets/js/sb.js -> .../assets/). Asi las rutas relativas de imagen
  // funcionan sin importar si el sitio se sirve en la raiz o bajo un subpath
  // (p. ej. /admin/index.html, /labs/x.html o /GIGAHEARTZ/admin/index.html).
  var SCRIPT_SRC = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  var ASSETS_BASE = SCRIPT_SRC ? SCRIPT_SRC.replace(/[^\/]*$/, '').replace(/js\/$/, '') : '';

  function cdnUrl(path) {
    var obj = String(path || '').replace(/^\/+/, '');
    var enc = obj.split('/').map(encodeURIComponent).join('/');
    return CDN + '/' + enc;
  }

  function resolveImage(path) {
    if (!path) return '';
    if (/^(https?:|data:)/i.test(path)) return path;
    // assets/... -> absoluta usando la base real del script (soporta subpath).
    if (/^assets\//i.test(path)) {
      var rel = path.replace(/^assets\//i, '');
      return ASSETS_BASE ? ASSETS_BASE + rel : '/' + path;
    }
    if (/^\.\//.test(path)) return path.slice(2);
    if (path.charAt(0) === '/') return path;
    if (CDN) return cdnUrl(path);
    return publicUrl(path);
  }

  window.GigaSB = {
    URL: BASE,
    BUCKET: BUCKET,
    isConfigured: isConfigured,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    upsert: upsert,
    rpc: rpc,
    signIn: signIn,
    adminSignUp: adminSignUp,
    signOut: signOut,
    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    getSession: getSession,
    refresh: refreshSession,
    // Vigencia de sesión (usado por el panel para el aviso/cierre automático).
    SESSION: SEC,
    touch: touchSession,
    remaining: sessionRemaining,
    expireIfStale: expireIfStale,
    upload: upload,
    publicUrl: publicUrl,
    resolveImage: resolveImage,
    cdnUrl: cdnUrl,
    // Storage: utilidades de limpieza (borrado de archivos sin uso)
    storageName: storageName,
    storePrefix: storePrefix,
    removeImage: removeImage,
    listImages: listImages
  };
})();
