/*
 * to-webp.mjs  -  Genera versiones WebP de las imagenes existentes.
 * ------------------------------------------------------------
 * - Recorre assets/img y crea un .webp junto a cada .png/.jpg/.jpeg/.avif.
 * - CONSERVA los originales (no borra nada).
 * - Reescribe las referencias .png/.jpg/.jpeg/.avif -> .webp en el
 *   HTML/CSS/JS/SQL del proyecto (solo si el .webp existe).
 *
 * Uso:  npm install   (una vez)
 *       npm run webp
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_ROOT = path.join(ROOT, 'assets', 'img');
const SRC_EXT = new Set(['.png', '.jpg', '.jpeg', '.avif']);
const TEXT_EXT = new Set(['.html', '.css', '.js', '.sql']);
const SKIP_DIR = new Set(['node_modules', '.git', 'scripts']);
const QUALITY = 82;

const toPosix = (p) => p.split(path.sep).join('/');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

async function convert() {
  const files = walk(IMG_ROOT);
  const converted = new Set();
  let made = 0, skipped = 0, failed = 0;
  for (const f of files) {
    if (!SRC_EXT.has(path.extname(f).toLowerCase())) continue;
    const out = f.replace(/\.[^.]+$/, '.webp');
    const relOut = toPosix(path.relative(ROOT, out));
    if (fs.existsSync(out)) { converted.add(relOut); skipped++; continue; }
    try {
      await sharp(f, { animated: false }).webp({ quality: QUALITY }).toFile(out);
      converted.add(relOut);
      made++;
      console.log('  webp  ' + toPosix(path.relative(ROOT, f)));
    } catch (e) {
      failed++;
      console.warn('  FALLO ' + toPosix(path.relative(ROOT, f)) + ' :: ' + e.message);
    }
  }
  console.log(`\nConvertidas: ${made}   ya existian: ${skipped}   fallidas: ${failed}`);
  return converted;
}

function rewriteRefs(converted) {
  const RE = /assets\/img\/[^"'\s)\]}<>]+?\.(?:png|jpe?g|avif)/gi;
  let filesTouched = 0, refs = 0;
  for (const t of walk(ROOT)) {
    if (!TEXT_EXT.has(path.extname(t).toLowerCase())) continue;
    const src = fs.readFileSync(t, 'utf8');
    let n = 0;
    const out = src.replace(RE, (m) => {
      const cand = m.replace(/\.[^.]+$/, '.webp');
      if (converted.has(cand)) { n++; return cand; }
      return m;
    });
    if (n) { fs.writeFileSync(t, out, 'utf8'); filesTouched++; refs += n; console.log('  refs  ' + toPosix(path.relative(ROOT, t)) + ' (' + n + ')'); }
  }
  console.log(`\nArchivos con refs actualizadas: ${filesTouched}   refs: ${refs}`);
}

(async () => {
  const converted = await convert();
  rewriteRefs(converted);
})().catch((e) => { console.error(e); process.exit(1); });
