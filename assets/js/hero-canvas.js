/*
 * hero-canvas.js  -  Renderer modular de la portada (hero).
 * ------------------------------------------------------------
 * Tipos de decoracion (uno activo a la vez):
 *   hex           -> rejilla de hexagonos animada (modos organicos)
 *   dots          -> matriz de puntos animada
 *   aurora        -> blobs de color tipo aurora / mesh gradient
 *   constellation -> particulas conectadas
 *   grid          -> rejilla en perspectiva
 *   gradient      -> gradiente animado con grano
 *   image         -> imagen de fondo (3 tamanos responsive)
 *
 * Uso:
 *   var h = new GHHero(canvas, { container, bg, overlay, isDark, preview });
 *   h.configure(settings.canvas);
 *   h.setTheme(isDark);
 *   h.destroy();
 *
 * Expone window.GHHero con .KINDS, .MODES, .DEFAULTS, .normalize.
 */
(function () {
  'use strict';

  var MODES = [
    'organic_zones', 'pulse', 'supernova', 'fluid_nodes', 'corner_rotation',
    'drifting_nebula', 'sine_ribbon', 'organic_eclipse', 'organic_constellation'
  ];
  var KINDS = ['hex', 'image', 'aurora', 'dots', 'constellation', 'grid', 'gradient'];

  var DEFAULTS = {
    kind: 'hex',
    height: 100,
    overlay: 0.35,
    speed: 1,
    intensity: 1,
    paused: false,
    bg: { ultra: '', desktop: '', mobile: '' },
    hex: {
      mode: 'pulse',
      colors: {
        lightBg: '#f4f5f7', lightLine: '#dcdfe6', lightGlow: '#a855f7',
        darkBg: '#0F0A1E', darkLine: '#2a2f3a', darkGlow: '#a855f7'
      }
    },
    fx: { color1: '#7c3aed', color2: '#a855f7' }
  };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function hexToRgb(h) {
    h = String(h || '').trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) h = '7c3aed';
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    t = clamp(t, 0, 1);
    return {
      r: Math.round(A.r + (B.r - A.r) * t),
      g: Math.round(A.g + (B.g - A.g) * t),
      b: Math.round(A.b + (B.b - A.b) * t)
    };
  }
  function css(c, a) {
    if (typeof c === 'string') c = hexToRgb(c);
    return a == null ? 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')' : 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function resolveImage(src, width) {
    if (!src) return '';
    try { if (window.GigaSB && GigaSB.resolveImage) return GigaSB.resolveImage(src, width); } catch (e) {}
    return src;
  }

  function normalize(c) {
    c = c || {};
    var d = DEFAULTS;
    var hexc = (c.hex && c.hex.colors) || {};
    return {
      kind: KINDS.indexOf(c.kind) >= 0 ? c.kind : d.kind,
      height: clamp(num(c.height, d.height), 40, 100),
      overlay: clamp(num(c.overlay, d.overlay), 0, 0.85),
      speed: clamp(num(c.speed, d.speed), 0.1, 3),
      intensity: clamp(num(c.intensity, d.intensity), 0.1, 3),
      paused: !!c.paused,
      bg: {
        ultra: (c.bg && c.bg.ultra) || '',
        desktop: (c.bg && c.bg.desktop) || '',
        mobile: (c.bg && c.bg.mobile) || ''
      },
      hex: {
        mode: MODES.indexOf(c.hex && c.hex.mode) >= 0 ? c.hex.mode : d.hex.mode,
        colors: {
          lightBg: hexc.lightBg || d.hex.colors.lightBg,
          lightLine: hexc.lightLine || d.hex.colors.lightLine,
          lightGlow: hexc.lightGlow || d.hex.colors.lightGlow,
          darkBg: hexc.darkBg || d.hex.colors.darkBg,
          darkLine: hexc.darkLine || d.hex.colors.darkLine,
          darkGlow: hexc.darkGlow || d.hex.colors.darkGlow
        }
      },
      fx: {
        color1: (c.fx && c.fx.color1) || d.fx.color1,
        color2: (c.fx && c.fx.color2) || d.fx.color2
      }
    };
  }

  function GHHero(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d', { alpha: true }) : null;
    this.container = opts.container || (canvas && canvas.parentElement);
    this.bgEl = opts.bg || null;
    this.overlayEl = opts.overlay || null;
    this.isDark = !!opts.isDark;
    this.preview = !!opts.preview;
    this.cfg = normalize({});

    this.width = 1; this.height = 1; this.dpr = 1;
    this.raf = null; this.lastT = 0; this.visible = true;

    this.ripples = []; this.lastRipple = 0;
    this.sprites = []; this.stroke = [];
    this.base = document.createElement('canvas');
    this.baseCtx = this.base.getContext('2d', { alpha: true });
    this.grain = null;
    this.particles = null;

    this.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var self = this;
    this._onResize = function () { self.resize(); };
    window.addEventListener('resize', this._onResize);

    if (!this.preview && window.IntersectionObserver && this.container) {
      this._obs = new IntersectionObserver(function (entries) {
        self.visible = !!(entries[0] && entries[0].isIntersecting);
        if (self.visible) self.start(); else self.stop();
      });
      this._obs.observe(this.container);
    }

    this.resize();
  }

  GHHero.prototype.configure = function (c) {
    this.cfg = normalize(c);
    this.applyDom();
    this.resize();
    if (this.cfg.paused || this.reduced) { this.stop(); this.drawStatic(); }
    else this.start();
  };

  GHHero.prototype.setTheme = function (dark) {
    this.isDark = !!dark;
    this.resize();
    if (this.cfg.paused || this.reduced) this.drawStatic();
    else this.start();
  };

  GHHero.prototype.palette = function () {
    var hc = this.cfg.hex.colors;
    this.col = this.isDark
      ? { bg: hc.darkBg, line: hc.darkLine, glow: hc.darkGlow }
      : { bg: hc.lightBg, line: hc.lightLine, glow: hc.lightGlow };
    this.c1 = this.cfg.fx.color1;
    this.c2 = this.cfg.fx.color2;
  };

  GHHero.prototype.pickBgUrl = function () {
    var bg = this.cfg.bg || {};
    var w = window.innerWidth || 1024;
    var order = w >= 1920 ? ['ultra', 'desktop', 'mobile'] : (w >= 768 ? ['desktop', 'mobile', 'ultra'] : ['mobile', 'desktop', 'ultra']);
    var widths = { ultra: 1920, desktop: 1280, mobile: 768 };
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (bg[k]) return resolveImage(bg[k], widths[k]);
    }
    return '';
  };

  GHHero.prototype.applyDom = function () {
    var c = this.cfg;
    if (!this.preview && this.container) this.container.style.height = c.height + 'vh';
    var isImg = c.kind === 'image';
    var url = isImg ? this.pickBgUrl() : '';
    if (this.bgEl) {
      if (isImg && url) {
        if (this.bgEl.getAttribute('src') !== url) this.bgEl.setAttribute('src', url);
        this.bgEl.style.display = 'block';
      } else {
        this.bgEl.style.display = 'none';
      }
    }
    if (this.canvas) this.canvas.style.display = isImg ? 'none' : 'block';
    if (this.overlayEl) {
      this.overlayEl.style.display = isImg ? 'block' : 'none';
      this.overlayEl.style.background = 'rgba(0,0,0,' + c.overlay + ')';
    }
  };

  GHHero.prototype.resize = function () {
    if (!this.container || !this.canvas || !this.ctx) return;
    var w = this.container.clientWidth;
    var h = this.container.clientHeight;
    if (!w || !h) return;
    this.width = w; this.height = h;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    var bw = Math.max(1, Math.round(w * this.dpr));
    var bh = Math.max(1, Math.round(h * this.dpr));
    if (this.canvas.width !== bw) this.canvas.width = bw;
    if (this.canvas.height !== bh) this.canvas.height = bh;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.hexR = w < 640 ? 26 : 30;
    this.horiz = this.hexR * 1.5;
    this.vert = this.hexR * Math.sqrt(3);
    this.palette();
    this.buildBase();
    this.buildSprites();
    if (this.cfg.kind === 'constellation') this.initParticles();
    if (this.cfg.kind === 'gradient') this.buildGrain();
    if (this.cfg.kind === 'image') this.applyDom();
  };

  GHHero.prototype.hexPath = function (c, x, y, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + r * 0.5, y + r * 0.866);
    c.lineTo(x - r * 0.5, y + r * 0.866);
    c.lineTo(x - r, y);
    c.lineTo(x - r * 0.5, y - r * 0.866);
    c.lineTo(x + r * 0.5, y - r * 0.866);
    c.closePath();
  };

  GHHero.prototype.buildBase = function () {
    if (!this.baseCtx) return;
    var kind = this.cfg.kind;
    if (kind !== 'hex' && kind !== 'dots') { this.baseDirty = false; return; }
    var w = this.width, h = this.height, dpr = this.dpr;
    var bw = Math.max(1, Math.round(w * dpr));
    var bh = Math.max(1, Math.round(h * dpr));
    if (this.base.width !== bw) this.base.width = bw;
    if (this.base.height !== bh) this.base.height = bh;
    var c = this.baseCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = this.col.bg;
    c.fillRect(0, 0, w, h);

    var cols = Math.ceil(w / this.horiz) + 2;
    var rows = Math.ceil(h / this.vert) + 2;
    for (var row = -1; row < rows; row++) {
      for (var col = -1; col < cols; col++) {
        var x = col * this.horiz;
        var y = row * this.vert + (col % 2 === 0 ? 0 : this.vert / 2);
        if (kind === 'hex') {
          this.hexPath(c, x, y, this.hexR - 1.2);
          c.fillStyle = this.col.bg;
          c.fill();
          this.hexPath(c, x, y, this.hexR - 1.2);
          c.strokeStyle = this.col.line;
          c.lineWidth = 1.5;
          c.stroke();
        } else {
          c.beginPath();
          c.arc(x, y, 1.7, 0, Math.PI * 2);
          c.fillStyle = css(this.col.line, 0.75);
          c.fill();
        }
      }
    }
    this.baseDirty = false;
  };

  GHHero.prototype.buildSprites = function () {
    if (this.cfg.kind !== 'hex') { this.sprites = []; this.stroke = []; return; }
    var levels = 12;
    var intensity = this.cfg.intensity;
    var blur = 20 * intensity;
    var pad = Math.ceil(blur + 6);
    var size = Math.ceil(this.hexR * 2 + pad * 2);
    this.spriteSize = size;
    var r = this.hexR - 1.2;
    var spriteDpr = Math.min(this.dpr, 1.5);
    var sprites = [];
    var strokes = [];
    for (var b = 0; b < levels; b++) {
      var f = (b + 0.5) / levels;
      var cv = document.createElement('canvas');
      cv.width = cv.height = Math.ceil(size * spriteDpr);
      var g = cv.getContext('2d');
      g.scale(spriteDpr, spriteDpr);
      var cx = size / 2, cy = size / 2;
      this.hexPath(g, cx, cy, r);
      g.lineWidth = 1.5 + f * 2.0;
      g.shadowBlur = f * blur;
      g.shadowColor = css(this.col.glow, f * 0.95);
      g.strokeStyle = 'rgba(0,0,0,0)';
      g.stroke();
      sprites.push(cv);
      strokes.push(css(mix(this.col.line, this.col.glow, f)));
    }
    this.sprites = sprites;
    this.stroke = strokes;
  };

  GHHero.prototype.start = function () {
    if (this.raf != null) return;
    if (this.cfg.kind === 'image') return;
    if (this.cfg.paused || this.reduced) return;
    if (!this.visible) return;
    if (this.container && !this.container.isConnected) return;
    var self = this;
    this.raf = requestAnimationFrame(function (n) { self.tick(n); });
  };

  GHHero.prototype.stop = function () {
    if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = null; }
  };

  GHHero.prototype.tick = function (now) {
    this.raf = null;
    if (this.container && !this.container.isConnected) { this.stop(); return; }
    if (!this.visible) return;
    this.draw(now);
    this.start();
  };

  GHHero.prototype.drawStatic = function () {
    if (!this.ctx) return;
    this.lastT = 0;
    this.draw(performance.now());
  };

  GHHero.prototype.factorFor = function (mode, x, y, t) {
    var w = this.width, h = this.height;
    var intensity = this.cfg.intensity;
    var cx = w / 2, cy = h / 2;
    var dcx = x - cx, dcy = y - cy;
    var distFromCenter = Math.sqrt(dcx * dcx + dcy * dcy);
    var factor = 0;

    switch (mode) {
      case 'pulse': {
        for (var i = 0; i < this.ripples.length; i++) {
          var r = this.ripples[i];
          var dx = x - r.x, dy = y - r.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          var band = 90;
          var dw = Math.abs(dist - r.radius);
          if (dw < band) {
            var f = 1 - dw / band;
            var fade = Math.max(0, 1 - r.radius / r.maxRadius);
            factor = Math.max(factor, f * fade * intensity);
          }
        }
        break;
      }
      case 'supernova': {
        var cycle = (t * 1.2) % 3.5;
        var radius = cycle * 320;
        var ds = Math.abs(distFromCenter - radius);
        if (ds < 90) factor = (1 - ds / 90) * Math.max(0, 1 - cycle / 3.5) * intensity;
        break;
      }
      case 'organic_zones': {
        var zx1 = w * (0.25 + 0.5 * Math.sin(t * 0.4));
        var zy1 = h * (0.25 + 0.5 * Math.cos(t * 0.5));
        var zx2 = w * (0.75 + 0.2 * Math.cos(t * 0.6));
        var zy2 = h * (0.75 + 0.2 * Math.sin(t * 0.4));
        var d1 = Math.hypot(x - zx1, y - zy1);
        var d2 = Math.hypot(x - zx2, y - zy2);
        var dTL = Math.hypot(x, y);
        var dBR = Math.hypot(x - w, y - h);
        var cTL = Math.max(0, 1 - dTL / (w * 0.35)) * Math.max(0, Math.sin(t * 1.5));
        var cBR = Math.max(0, 1 - dBR / (w * 0.35)) * Math.max(0, Math.cos(t * 1.3));
        var p1 = Math.max(0, 1 - d1 / 220) * (Math.sin(t * 2) * 0.5 + 0.5);
        var p2 = Math.max(0, 1 - d2 / 200) * (Math.cos(t * 2.2) * 0.5 + 0.5);
        factor = Math.max(p1, p2, cTL * 0.85, cBR * 0.85) * intensity;
        break;
      }
      case 'fluid_nodes': {
        var nx1 = w * (0.5 + 0.3 * Math.sin(t * 0.5));
        var ny1 = h * (0.5 + 0.3 * Math.cos(t * 0.4));
        var nx2 = w * (0.5 + 0.3 * Math.cos(t * 0.6));
        var ny2 = h * (0.5 + 0.3 * Math.sin(t * 0.7));
        var dn1 = Math.hypot(x - nx1, y - ny1);
        var dn2 = Math.hypot(x - nx2, y - ny2);
        factor = (Math.max(0, 1 - dn1 / 240) + Math.max(0, 1 - dn2 / 240)) * 0.65 * intensity;
        break;
      }
      case 'corner_rotation': {
        var cc = (t * 0.4) % 4;
        var corner = Math.floor(cc);
        var kx = (corner === 0 || corner === 3) ? w * 0.15 : w * 0.85;
        var ky = (corner === 0 || corner === 1) ? h * 0.15 : h * 0.85;
        var dc = Math.hypot(x - kx, y - ky);
        var prog = cc % 1;
        factor = Math.max(0, 1 - dc / (w * 0.45)) * Math.sin(prog * Math.PI) * intensity;
        break;
      }
      case 'drifting_nebula': {
        var sum = 0;
        for (var k = 0; k < 3; k++) {
          var px = w * (0.3 + 0.4 * Math.sin(t * (0.3 + k * 0.15) + k * 2.1));
          var py = h * (0.3 + 0.4 * Math.cos(t * (0.35 + k * 0.12) + k * 1.7));
          sum += Math.max(0, 1 - Math.hypot(x - px, y - py) / 220);
        }
        factor = Math.min(1, sum * 0.6) * intensity;
        break;
      }
      case 'sine_ribbon': {
        var ribbonY = h * 0.5 + Math.sin(x * 0.004 + t) * (h * 0.25) + Math.cos(t * 0.7) * 40;
        factor = Math.max(0, 1 - Math.abs(y - ribbonY) / 160) * (0.5 + 0.5 * Math.sin(t * 2.5)) * intensity;
        break;
      }
      case 'organic_eclipse': {
        var ex = w * 0.5 + Math.sin(t * 0.45) * (w * 0.25);
        var ey = h * 0.5 + Math.cos(t * 0.55) * (h * 0.25);
        var de = Math.hypot(x - ex, y - ey);
        var ring = 140 + Math.sin(t * 1.5) * 70;
        factor = Math.max(0, 1 - Math.abs(de - ring) / 90) * intensity;
        break;
      }
      case 'organic_constellation': {
        var gridN = Math.sin(x * 0.008 + t) + Math.cos(y * 0.008 + t * 1.2);
        var env = Math.max(0, 1 - distFromCenter / (w * 0.7));
        factor = Math.max(0, gridN * 0.5 + 0.5) * env * intensity;
        break;
      }
    }
    return factor;
  };

  GHHero.prototype.draw = function (now) {
    var ctx = this.ctx;
    if (!ctx) return;
    var cfg = this.cfg, w = this.width, h = this.height;
    if (!this.lastT) this.lastT = now;
    var dt = Math.min((now - this.lastT) / 1000, 0.06);
    this.lastT = now;
    var t = now * 0.001 * cfg.speed;

    ctx.clearRect(0, 0, w, h);

    if (cfg.kind === 'hex' || cfg.kind === 'dots') {
      if (cfg.kind === 'hex') this.updateRipples(now, dt);
      if (this.baseDirty) this.buildBase();
      ctx.drawImage(this.base, 0, 0, w, h);
      this.drawGrid(ctx, t);
    } else if (cfg.kind === 'aurora') {
      this.drawAurora(ctx, t);
    } else if (cfg.kind === 'constellation') {
      this.drawConstellation(ctx, t, dt);
    } else if (cfg.kind === 'grid') {
      this.drawPerspective(ctx, t);
    } else if (cfg.kind === 'gradient') {
      this.drawGradient(ctx, t);
    }
  };

  GHHero.prototype.updateRipples = function (now, dt) {
    if (this.cfg.hex.mode !== 'pulse') { this.ripples = []; return; }
    var speed = this.cfg.speed;
    if (!this.lastRipple) this.lastRipple = now - 4000 / speed;
    if (now - this.lastRipple > 5200 / speed) {
      this.ripples.push({
        x: this.width / 2, y: this.height / 2, radius: 0,
        maxRadius: Math.hypot(this.width, this.height) * 0.75,
        speed: 280 * speed
      });
      this.lastRipple = now;
    }
    for (var i = this.ripples.length - 1; i >= 0; i--) {
      this.ripples[i].radius += this.ripples[i].speed * dt;
      if (this.ripples[i].radius > this.ripples[i].maxRadius) this.ripples.splice(i, 1);
    }
  };

  GHHero.prototype.drawGrid = function (ctx, t) {
    var w = this.width, h = this.height;
    var cols = Math.ceil(w / this.horiz) + 2;
    var rows = Math.ceil(h / this.vert) + 2;
    var mode = this.cfg.hex.mode;
    var isHex = this.cfg.kind === 'hex';
    for (var row = -1; row < rows; row++) {
      for (var col = -1; col < cols; col++) {
        var x = col * this.horiz;
        var y = row * this.vert + (col % 2 === 0 ? 0 : this.vert / 2);
        var factor = this.factorFor(mode, x, y, t);
        factor = Math.min(1, Math.max(0, factor));
        if (factor < 0.02) continue;
        if (isHex) {
          var b = Math.min(this.sprites.length - 1, (factor * this.sprites.length) | 0);
          var sp = this.sprites[b];
          if (sp) ctx.drawImage(sp, x - this.spriteSize / 2, y - this.spriteSize / 2, this.spriteSize, this.spriteSize);
          this.hexPath(ctx, x, y, this.hexR - 1.2);
          ctx.strokeStyle = this.stroke[b] || css(this.col.glow);
          ctx.lineWidth = 1.5 + factor * 2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, 1.8 + factor * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = css(mix(this.col.line, this.col.glow, factor), 0.55 + factor * 0.45);
          ctx.shadowBlur = 12 * factor;
          ctx.shadowColor = css(this.col.glow, factor);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }
  };

  GHHero.prototype.drawAurora = function (ctx, t) {
    var w = this.width, h = this.height, c = this.col, cfg = this.cfg;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    var blobs = [
      { k: 0, r: 0.55 }, { k: 1, r: 0.45 }, { k: 0, r: 0.5 }, { k: 1, r: 0.4 }
    ];
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      var px = w * (0.5 + 0.36 * Math.sin(t * (0.22 + i * 0.07) + i * 1.7));
      var py = h * (0.5 + 0.34 * Math.cos(t * (0.19 + i * 0.06) + i * 2.3));
      var r = Math.min(w, h) * b.r * (0.9 + 0.12 * Math.sin(t * 0.4 + i));
      var color = b.k ? cfg.fx.color2 : cfg.fx.color1;
      var g = ctx.createRadialGradient(px, py, 0, px, py, r);
      var a = 0.5 * cfg.intensity;
      g.addColorStop(0, css(color, Math.min(0.85, a)));
      g.addColorStop(0.55, css(color, Math.min(0.4, a * 0.5)));
      g.addColorStop(1, css(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  };

  GHHero.prototype.initParticles = function () {
    var w = this.width, h = this.height;
    var n = clamp(Math.round((w * h) / 22000), 24, 90);
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        r: 1 + Math.random() * 1.6
      });
    }
    this.particles = arr;
  };

  GHHero.prototype.drawConstellation = function (ctx, t, dt) {
    var w = this.width, h = this.height, cfg = this.cfg, c = this.col;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    if (!this.particles) this.initParticles();
    var ps = this.particles || [];
    var speed = cfg.speed, inten = cfg.intensity;
    var i, p;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      p.x += p.vx * dt * speed;
      p.y += p.vy * dt * speed;
      if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; if (p.y > h + 10) p.y = -10;
    }
    var maxD = 130 * Math.min(1.6, inten);
    for (i = 0; i < ps.length; i++) {
      for (var j = i + 1; j < ps.length; j++) {
        var dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxD) {
          var a = (1 - d / maxD) * 0.45 * inten;
          ctx.strokeStyle = css(mix(cfg.fx.color1, cfg.fx.color2, 0.5), a);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(ps[i].x, ps[i].y);
          ctx.lineTo(ps[j].x, ps[j].y);
          ctx.stroke();
        }
      }
    }
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.8 + inten * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = css(i % 2 ? cfg.fx.color2 : cfg.fx.color1, 0.85);
      ctx.fill();
    }
  };

  GHHero.prototype.drawPerspective = function (ctx, t) {
    var w = this.width, h = this.height, c = this.col, cfg = this.cfg;
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    var glow = cfg.fx.color1;
    var lineA = 0.18 + 0.22 * cfg.intensity;
    var vx = w / 2, vy = h * 0.42;
    var line = css(mix(c.line, glow, 0.45), lineA);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;

    var verts = 14;
    for (var i = -verts; i <= verts; i++) {
      var bx = vx + i * (w / verts) * 1.9;
      ctx.beginPath();
      ctx.moveTo(vx + i * 6, vy);
      ctx.lineTo(bx, h);
      ctx.stroke();
    }

    var offset = (t * 0.35) % 1;
    var rows = 14;
    for (var k = 0; k < rows; k++) {
      var p = (k + offset) / rows;
      var y = vy + (h - vy) * Math.pow(p, 1.9);
      var alpha = (0.1 + 0.5 * p) * Math.min(1.4, cfg.intensity);
      ctx.strokeStyle = css(mix(c.line, glow, 0.55), alpha);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    var g = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.min(w, h) * 0.5);
    g.addColorStop(0, css(glow, 0.22 * cfg.intensity));
    g.addColorStop(1, css(glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  GHHero.prototype.buildGrain = function () {
    if (this.grain) return;
    var s = 120;
    var cv = document.createElement('canvas');
    cv.width = cv.height = s;
    var g = cv.getContext('2d');
    var img = g.createImageData(s, s);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = 200 + Math.random() * 55;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() * 40;
    }
    g.putImageData(img, 0, 0);
    this.grain = cv;
  };

  GHHero.prototype.drawGradient = function (ctx, t) {
    var w = this.width, h = this.height, cfg = this.cfg, c = this.col;
    var ang = t * 0.25;
    var cx = w / 2, cy = h / 2;
    var r = Math.hypot(w, h) / 2;
    var g = ctx.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    var inten = Math.min(1, 0.55 + cfg.intensity * 0.35);
    g.addColorStop(0, css(mix(c.bg, cfg.fx.color1, inten)));
    g.addColorStop(0.5, css(mix(c.bg, cfg.fx.color2, inten * 0.85)));
    g.addColorStop(1, css(mix(c.bg, cfg.fx.color1, inten * 0.55)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (!this.grain) this.buildGrain();
    if (this.grain) {
      var pat = ctx.createPattern(this.grain, 'repeat');
      if (pat) {
        ctx.save();
        ctx.globalAlpha = 0.35 * Math.min(1.5, cfg.intensity);
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  };

  GHHero.prototype.destroy = function () {
    this.stop();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this._obs) { try { this._obs.disconnect(); } catch (e) {} }
    this.particles = null;
  };

  window.GHHero = GHHero;
  GHHero.KINDS = KINDS;
  GHHero.MODES = MODES;
  GHHero.DEFAULTS = DEFAULTS;
  GHHero.normalize = normalize;
})();
