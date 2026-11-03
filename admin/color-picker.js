/*
 * color-picker.js  -  Selector de color propio para el panel.
 * Reemplaza los <input type="color"> nativos por un control con
 * canvas HSV + barra de tono + hex (6 digitos) + muestras.
 * Portado del color-picker de OX1WhatShop (sin transparencia).
 *
 * Uso:
 *   ColorPicker.init(root)   -> construye un picker por cada input[type=color]
 *   ColorPicker.syncAll(root)-> relee el value de los inputs y refresca el picker
 *
 * El input original se oculta; conserva su .value y dispara
 * eventos 'input'/'change' para que el codigo que ya los escucha siga igual.
 */
(function () {
  'use strict';

  var SWATCHES = [
    '#7c3aed', '#6d28d9', '#a78bfa', '#a855f7',
    '#dc2626', '#f59e0b', '#16a34a', '#0ea5e9',
    '#3b82f6', '#ec4899', '#111827', '#ffffff'
  ];

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (h.length !== 6) return null;
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    var hx = function (v) { return ('0' + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); };
    return '#' + hx(r) + hx(g) + hx(b);
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0, s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h: h, s: s, v: v };
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
  }

  function build(el) {
    var initial = hexToRgb(el.value) || { r: 124, g: 58, b: 237 };
    var hsv = rgbToHsv(initial.r, initial.g, initial.b);
    var state = { hue: hsv.h, s: hsv.s, v: hsv.v, r: initial.r, g: initial.g, b: initial.b };

    el.style.display = 'none';

    var wrap = document.createElement('div');
    wrap.className = 'cp';

    var swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'cp-swatch';
    swatch.title = 'Abrir selector de color';

    var hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.className = 'cp-hex';
    hexInput.spellcheck = false;
    hexInput.setAttribute('autocomplete', 'off');
    hexInput.setAttribute('aria-label', 'Color hexadecimal');

    var panel = document.createElement('div');
    panel.className = 'cp-panel';
    panel.innerHTML =
      '<div class="cp-sv-wrap"><canvas class="cp-sv" width="208" height="124"></canvas><span class="cp-thumb"></span></div>' +
      '<div class="cp-bar cp-hue"><span class="cp-thumb"></span></div>' +
      '<div class="cp-swatches"></div>' +
      '<div class="cp-hex-row"><span class="cp-hash">#</span><input type="text" class="cp-hex-input" spellcheck="false" autocomplete="off" /><span class="cp-preview"></span></div>';

    wrap.appendChild(swatch);
    wrap.appendChild(hexInput);
    wrap.appendChild(panel);
    el.parentNode.insertBefore(wrap, el.nextSibling);

    var sv = panel.querySelector('.cp-sv');
    var hueBar = panel.querySelector('.cp-hue');
    var svThumb = panel.querySelector('.cp-sv-wrap .cp-thumb');
    var hueThumb = panel.querySelector('.cp-hue .cp-thumb');
    var swatchesBox = panel.querySelector('.cp-swatches');
    var hexField = panel.querySelector('.cp-hex-input');
    var preview = panel.querySelector('.cp-preview');

    function render(emit) {
      var rgb = hsvToRgb(state.hue, state.s, state.v);
      state.r = rgb.r; state.g = rgb.g; state.b = rgb.b;
      var hex = rgbToHex(state.r, state.g, state.b);

      swatch.style.setProperty('--c', hex);
      hexInput.value = hex.replace('#', '');
      hexField.value = hex.replace('#', '');

      svThumb.style.left = (state.s * sv.width) + 'px';
      svThumb.style.top = ((1 - state.v) * sv.height) + 'px';
      svThumb.style.display = 'block';
      hueThumb.style.left = (state.hue / 360 * hueBar.offsetWidth) + 'px';
      preview.style.background = hex;

      el.value = hex;
      if (emit !== false) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      drawSV();
    }

    function drawSV() {
      var ctx = sv.getContext('2d');
      var w = sv.width, h = sv.height;
      ctx.fillStyle = 'hsl(' + state.hue + ',100%,50%)';
      ctx.fillRect(0, 0, w, h);
      var g1 = ctx.createLinearGradient(0, 0, w, 0);
      g1.addColorStop(0, '#fff');
      g1.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);
      var g2 = ctx.createLinearGradient(0, 0, 0, h);
      g2.addColorStop(0, 'rgba(0,0,0,0)');
      g2.addColorStop(1, '#000');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
    }

    SWATCHES.forEach(function (hex) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-sw';
      b.style.background = hex;
      b.title = hex;
      b.addEventListener('click', function () {
        var p = hexToRgb(hex);
        state.r = p.r; state.g = p.g; state.b = p.b;
        var h2 = rgbToHsv(p.r, p.g, p.b);
        state.hue = h2.h; state.s = h2.s; state.v = h2.v;
        render();
      });
      swatchesBox.appendChild(b);
    });

    function attachDrag(bar, apply) {
      bar.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var move = function (ev) {
          var rect = bar.getBoundingClientRect();
          apply(clamp((ev.clientX - rect.left) / rect.width, 0, 1));
          render();
        };
        move(e);
        try { bar.setPointerCapture(e.pointerId); } catch (err) {}
        var up = function () { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
        bar.addEventListener('pointermove', move);
        bar.addEventListener('pointerup', up);
      });
    }
    attachDrag(hueBar, function (val) { state.hue = val * 360; });

    sv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var move = function (ev) {
        var rect = sv.getBoundingClientRect();
        state.s = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        state.v = clamp(1 - (ev.clientY - rect.top) / rect.height, 0, 1);
        render();
      };
      move(e);
      try { sv.setPointerCapture(e.pointerId); } catch (err) {}
      var up = function () { sv.removeEventListener('pointermove', move); sv.removeEventListener('pointerup', up); };
      sv.addEventListener('pointermove', move);
      sv.addEventListener('pointerup', up);
    });

    function fromText(v) {
      var p = hexToRgb(v);
      if (!p) return false;
      state.r = p.r; state.g = p.g; state.b = p.b;
      var h2 = rgbToHsv(p.r, p.g, p.b);
      state.hue = h2.h; state.s = h2.s; state.v = h2.v;
      render();
      return true;
    }
    hexField.addEventListener('change', function () {
      if (!fromText(hexField.value)) hexField.value = rgbToHex(state.r, state.g, state.b).replace('#', '');
    });
    hexField.addEventListener('input', function () { fromText(hexField.value); });

    hexInput.addEventListener('change', function () {
      if (!fromText(hexInput.value)) hexInput.value = rgbToHex(state.r, state.g, state.b).replace('#', '');
    });
    hexInput.addEventListener('focus', function () { hexInput.select(); });
    hexInput.addEventListener('click', function (e) { e.stopPropagation(); openPanel(); });

    function openPanel() { panel.classList.add('open'); }
    function closePanel() { panel.classList.remove('open'); }
    swatch.addEventListener('click', function (e) { e.stopPropagation(); panel.classList.contains('open') ? closePanel() : openPanel(); });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) closePanel(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });

    render(false);
    return { input: el, sync: function () { var p = hexToRgb(el.value); if (p) { state.r = p.r; state.g = p.g; state.b = p.b; var h2 = rgbToHsv(p.r, p.g, p.b); state.hue = h2.h; state.s = h2.s; state.v = h2.v; render(false); } } };
  }

  function root_(root) { return root || document; }

  function init(root) {
    root_(root).querySelectorAll('input[type="color"]').forEach(function (el) {
      if (el.__cpBuilt) return;
      el.__cpBuilt = true;
      el.__cp = build(el);
    });
  }

  function syncAll(root) {
    root_(root).querySelectorAll('input[type="color"]').forEach(function (el) {
      if (el.__cpBuilt && el.__cp) el.__cp.sync();
    });
  }

  window.ColorPicker = { init: init, syncAll: syncAll };
})();
