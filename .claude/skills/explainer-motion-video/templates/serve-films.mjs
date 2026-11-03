// scripts/serve.mjs — serve the To-Do app and the films in a browser, on a port.
//   node scripts/serve.mjs [port]     → http://localhost:8200/films.html
// Serves the repo root. Supports HTTP Range (so the videos can seek), and hides anything
// that should never be public: dotfiles and dot-folders (.git, .claude, .env …), node_modules,
// build output (out, tools). Node built-ins only.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, extname, normalize, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8200);
const HIDDEN = new Set(['node_modules', 'out', 'tools']);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2',
};

function resolvePath(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p === '/' || p === '') p = '/index.html';
  const parts = p.split('/').filter(Boolean);
  if (parts.some((s) => s.startsWith('.') || HIDDEN.has(s))) return null;
  const full = normalize(join(ROOT, ...parts));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null; // no escaping the repo
  return full;
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const full = resolvePath(req.url || '/');
  if (!full) { res.writeHead(404).end('not found'); return; }

  let info;
  try { info = await stat(full); } catch { res.writeHead(404).end('not found'); return; }
  if (info.isDirectory()) { res.writeHead(404).end('not found'); return; }

  const type = TYPES[extname(full).toLowerCase()] || 'application/octet-stream';
  const size = info.size;
  const common = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = req.headers.range;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start, end;
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') { // suffix: last N bytes
        const n = Number(m[2]);
        start = Math.max(0, size - n);
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
      }
    }
    if (start === undefined || start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, {
      ...common,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(full, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...common, 'Content-Length': size });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(full).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`films + To-Do on http://0.0.0.0:${PORT}/  (films.html)`);
});
