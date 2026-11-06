// Serves out/ over HTTP with Range support so the MP4 plays and seeks in browsers.
// Usage: PORT=8300 node render/serve.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root: the folder that holds script.json, assets/, audio/, fonts/ and out/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');
// Port to listen on (set with the PORT environment variable).
const PORT = Number(process.env.PORT || 8300);
// MIME types for the file extensions served from out/.
const TYPES = { '.mp4': 'video/mp4', '.png': 'image/png', '.wav': 'audio/wav', '.json': 'application/json' };

http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'ganesh-origin-60s.mp4';
  const file = path.join(ROOT, path.basename(name));
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const [a, b] = range.replace(/bytes=/, '').split('-');
    const start = Number(a);
    const end = b ? Math.min(Number(b), size - 1) : size - 1;
    res.writeHead(206, {
      'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1,
    });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`serving out/ on ${PORT}`));
