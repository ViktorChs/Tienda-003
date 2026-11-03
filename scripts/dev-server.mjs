/*
 * dev-server.mjs  -  Servidor local SIN cache.
 *
 * Por que: `python -m http.server` no manda Cache-Control, entonces el
 * navegador guarda las paginas por su cuenta (heuristic caching) y ves
 * versiones viejas de HTML/JS/CSS. Este servidor manda
 * `Cache-Control: no-store` en TODAS las respuestas -> siempre frescas.
 *
 * Uso:
 *   npm run dev            -> http://localhost:8080
 *   npm run dev -- 3000    -> otro puerto
 *
 * Solo para desarrollo local. No se sube al sitio.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0'
};

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({}, NO_CACHE, headers));
  res.end(body);
}

const server = http.createServer(function (req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://' + HOST).pathname);
  } catch (e) {
    return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad request');
  }

  let rel = pathname.replace(/^\/+/, '');
  let full = path.join(ROOT, rel);

  // Evita salir de la carpeta del proyecto (path traversal).
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    return send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden');
  }

  fs.stat(full, function (err, stat) {
    if (!err && stat.isDirectory()) {
      full = path.join(full, 'index.html');
    }
    fs.readFile(full, function (err2, data) {
      if (err2) {
        console.log('404 ' + req.method + ' ' + pathname);
        return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, '404 Not Found: ' + pathname);
      }
      const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
      console.log('200 ' + req.method + ' ' + pathname);
      send(res, 200, { 'Content-Type': type }, data);
    });
  });
});

server.listen(PORT, HOST, function () {
  console.log('Dev server (sin cache) en http://' + HOST + ':' + PORT);
  console.log('Raiz: ' + ROOT);
});
