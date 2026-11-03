/*
 * migrate.js  -  Migracion de una sola vez
 * ------------------------------------------------------------
 * Lee los productos y combos hardcodeados en index.html y
 * catalogo.html, y genera  supabase/products_seed.sql  listo
 * para pegar en el SQL Editor de Supabase (DESPUES de schema.sql).
 *
 * Ademas enlaza cada combo con los productos reales que reconoce
 * por nombre (tabla combo_items). El resto se enlaza en el panel.
 *
 * Uso:   node supabase/migrate.js
 *
 * Sin dependencias: solo Node (fs/path).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'products_seed.sql');
const HTML_FILES = ['index.html', 'catalogo.html'];

/* ---------- helpers ---------- */

function decode(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function sqlStr(s) {
  if (s === null || s === undefined) return 'null';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function toNum(v) {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}

function read(f) {
  return fs.readFileSync(path.join(ROOT, f), 'utf8');
}

/* ---------- parsers ---------- */

const PRODUCT_RE =
  /<div class="product-card[^"]*"\s+data-cat="([^"]*)"\s+data-subcat="([^"]*)"[^>]*>([\s\S]*?)<\/button>\s*<\/div>/g;

function parseProducts(html) {
  const out = [];
  let m;
  while ((m = PRODUCT_RE.exec(html)) !== null) {
    const cat = decode(m[1]);
    const subcat = decode(m[2]);
    const body = m[3];
    const name = decode((body.match(/<h4 class="product-name">([\s\S]*?)<\/h4>/) || [])[1] || '');
    const sub = decode((body.match(/<p class="product-sub">([\s\S]*?)<\/p>/) || [])[1] || '');
    const imgM = body.match(/<img[^>]*\bsrc="([^"]*)"/);
    const altM = body.match(/<img[^>]*\balt="([^"]*)"/);
    const badgeM = body.match(/<span class="absolute top-2[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const priceM = body.match(/<span class="text-gray-900[^"]*">\s*\$([0-9.,]+)\s*<\/span>/);
    if (!name) continue;
    out.push({
      name,
      sub,
      img: imgM ? decode(imgM[1]) : '',
      alt: altM ? decode(altM[1]) : '',
      badge: badgeM ? decode(badgeM[1]) : '',
      price: priceM ? toNum(priceM[1]) : 0,
      cat,
      subcat,
      type: 'product'
    });
  }
  return out;
}

const COMBO_RE =
  /<article class="combo-card"\s+data-name="([^"]*)"\s+data-price="([^"]*)"\s+data-img="([^"]*)"\s+data-cat="([^"]*)"\s+data-subcat="([^"]*)"[^>]*>([\s\S]*?)<\/article>/g;

function parseComboMeta(html) {
  const meta = {};
  const re = /'([^']+)':\s*\{\s*sub:\s*'([^']*)',\s*extra:\s*'([^']*)',\s*includes:\s*\[([^\]]*)\]\s*\}/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const includes = [...m[4].matchAll(/'([^']*)'/g)].map(x => decode(x[1]));
    meta[decode(m[1])] = { sub: decode(m[2]), extra: decode(m[3]), includes };
  }
  return meta;
}

function parseCombos(html, meta) {
  const out = [];
  let m;
  while ((m = COMBO_RE.exec(html)) !== null) {
    const name = decode(m[1]);
    const body = m[6];
    const li = [...body.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x => decode(x[1]));
    const mm = meta[name] || {};
    out.push({
      name,
      sub: mm.sub || '',
      img: decode(m[3]),
      price: toNum(m[2]),
      cat: decode(m[4]),
      subcat: decode(m[5]),
      type: 'combo',
      meta: {
        cpu_line1: decode((body.match(/<span class="combo-cpu-line1">([\s\S]*?)<\/span>/) || [])[1] || ''),
        cpu_line2: decode((body.match(/<span class="combo-cpu-line2">([\s\S]*?)<\/span>/) || [])[1] || ''),
        tag: decode((body.match(/<span class="combo-tag">([\s\S]*?)<\/span>/) || [])[1] || ''),
        card_specs: li,
        extra_image: mm.extra || ''
      },
      includes: mm.includes || []
    });
  }
  return out;
}

/* ---------- enlazar combos con productos reales ---------- */

const STOP = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'con', 'para', 'hasta',
  'un', 'una', 'en', 'al', 'gabinete', 'procesador', 'tarjeta', 'madre',
  'memoria', 'almacenamiento', 'grafica', 'fuente', 'poder', 'refrigeracion',
  'incluida', 'compatible', 'included', 'super', 'pro', 'gaming'
]);

function tokens(s) {
  return String(s).toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter(x => x.length >= 2 && !STOP.has(x));
}

// token "distintivo": modelo (7800x3d, z790) o numero de 4 cifras (4070).
// Se excluyen capacidades/specs genericas (12gb, ddr5, 165hz, pcie4...) para
// evitar falsos positivos (p.ej. "12GB" en un combo vs una GPU de 12GB).
function isStrong(tok) {
  if (/^[0-9]{4}$/.test(tok)) return true;                                  // 4070, 4060...
  if (/^[0-9]+(gb|tb|mb|ghz|mhz|hz|fps|w|v|k|bit)$/i.test(tok)) return false;
  if (/^(ddr|pcie|wifi|usb|bluetooth|hd|uhd|am|fm|xmp|atx)[0-9]*$/i.test(tok)) return false;
  return /(?=.*[a-z])(?=.*[0-9])/.test(tok) && tok.length >= 3;
}

function linkCombos(combos, products) {
  const prodTok = products.map(p => ({ p, tk: new Set(tokens(p.name)) }));
  const links = [];
  for (const c of combos) {
    const used = new Set();
    c.includes.forEach((line, idx) => {
      const lt = new Set(tokens(line));
      let best = null, bestScore = 0, tie = false, strongHit = false;
      for (const { p, tk } of prodTok) {
        if (used.has(p.name)) continue;
        let score = 0, strong = false;
        for (const t of lt) {
          if (tk.has(t)) { score++; if (isStrong(t)) strong = true; }
        }
        if (score > bestScore) { bestScore = score; best = p; tie = false; strongHit = strong; }
        else if (score === bestScore && score > 0) { tie = true; }
      }
      if (best && bestScore >= 1 && strongHit && !tie) {
        used.add(best.name);
        links.push({ combo: c.name, product: best.name, qty: 1, pos: idx });
      }
    });
  }
  return links;
}

/* ---------- main ---------- */

const htmlIndex = read('index.html');
const htmlCat = read('catalogo.html');

const comboMeta = parseComboMeta(htmlIndex);

let products = [];
for (const f of HTML_FILES) {
  const html = f === 'index.html' ? htmlIndex : htmlCat;
  for (const p of parseProducts(html)) products.push(p);
}
const seen = new Set();
const deduped = [];
for (const p of products) {
  const key = p.name.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(p);
}
products = deduped;

const combos = parseCombos(htmlIndex, comboMeta);

combos.forEach((c, i) => (c.pos = i));
products.forEach((p, i) => (p.pos = i));

const subKey = new Set();
const subs = [];
for (const it of [...combos, ...products]) {
  const k = it.cat + '||' + it.subcat;
  if (!it.subcat || subKey.has(k)) continue;
  subKey.add(k);
  subs.push({ cat: it.cat, subcat: it.subcat });
}
subs.forEach((s, i) => (s.pos = i));

const links = linkCombos(combos, products);

/* ---------- emitir SQL ---------- */

const L = [];
L.push('-- ============================================================');
L.push('--  products_seed.sql  (GENERADO por supabase/migrate.js)');
L.push('--  Ejecutar DESPUES de schema.sql. Idempotente.');
L.push('--  Combos: ' + combos.length + '   Productos: ' + products.length +
       '   Subcategorias: ' + subs.length + '   Links combo: ' + links.length);
L.push('-- ============================================================');
L.push('');

L.push('-- ---------- Subcategorias ----------');
L.push('insert into public.subcategories (category_id, name, position)');
L.push('select c.id, x.subcat, x.pos');
L.push('from (values');
L.push(subs.map(s => `  (${sqlStr(s.cat)}, ${sqlStr(s.subcat)}, ${s.pos})`).join(',\n'));
L.push(') as x(cat, subcat, pos)');
L.push('join public.categories c on c.name = x.cat');
L.push('where not exists (select 1 from public.subcategories);');
L.push('');

L.push('-- ---------- Productos y Combos ----------');
L.push('insert into public.products');
L.push('  (name, sub, price, badge, type, image, category_id, subcategory_id, includes, meta, position)');
L.push('select x.name, x.sub, x.price, x.badge, x.type, x.image,');
L.push('       (select id from public.categories c where c.name = x.cat),');
L.push('       (select s.id from public.subcategories s');
L.push('          join public.categories c2 on c2.id = s.category_id');
L.push('         where s.name = x.subcat and c2.name = x.cat),');
L.push('       x.includes::jsonb, x.meta::jsonb, x.pos');
L.push('from (values');

const all = [...combos, ...products];
const rows = all.map(it => {
  const includes = it.type === 'combo' ? it.includes : [];
  const meta = it.type === 'combo' ? it.meta : { alt: it.alt };
  return '  (' + [
    sqlStr(it.name),
    sqlStr(it.sub || ''),
    it.price,
    it.badge ? sqlStr(it.badge) : 'null',
    sqlStr(it.type),
    sqlStr(it.img),
    sqlStr(it.cat),
    sqlStr(it.subcat),
    sqlStr(JSON.stringify(includes)),
    sqlStr(JSON.stringify(meta)),
    it.pos
  ].join(', ') + ')';
});
L.push(rows.join(',\n'));
L.push(') as x(name, sub, price, badge, type, image, cat, subcat, includes, meta, pos)');
L.push('where not exists (select 1 from public.products);');
L.push('');

if (links.length) {
  L.push('-- ---------- Combo -> Productos reales (auto-detectado por nombre) ----------');
  L.push('insert into public.combo_items (combo_id, product_id, qty, position)');
  L.push('select c.id, p.id, x.qty, x.pos');
  L.push('from (values');
  L.push(links.map(l => `  (${sqlStr(l.combo)}, ${sqlStr(l.product)}, ${l.qty}, ${l.pos})`).join(',\n'));
  L.push(') as x(combo_name, product_name, qty, pos)');
  L.push('join public.products c on c.name = x.combo_name');
  L.push('join public.products p on p.name = x.product_name');
  L.push('where not exists (select 1 from public.combo_items);');
  L.push('');
} else {
  L.push('-- ---------- Combo -> Productos: (sin coincidencias automaticas) ----------');
  L.push('');
}

fs.writeFileSync(OUT, L.join('\n'), 'utf8');

console.log('Escrito: ' + path.relative(ROOT, OUT));
console.log('  Combos:        ' + combos.length);
console.log('  Productos:     ' + products.length);
console.log('  Subcategorias: ' + subs.length);
console.log('  Links combo:   ' + links.length);
if (links.length) {
  console.log('');
  console.log('  Enlaces combo -> producto:');
  for (const l of links) console.log('    ' + l.combo + '  ->  ' + l.product);
}
