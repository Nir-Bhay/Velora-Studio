// Preview server for the film. Serves a page with the video player, the captions as a WebVTT track,
// and HTTP Range support so the player can seek. Binds to 0.0.0.0 so the sandbox preview can reach it.
// Usage: PORT=8080 node preview/server.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const VIDEO = path.join(ROOT, 'deepmind-rsa-60s.mp4');
const SRT = path.join(ROOT, 'deepmind-rsa-captions.srt');

// SRT uses commas in timestamps; WebVTT uses dots and a header line.
function srtToVtt(srt) {
  return 'WEBVTT\n\n' + srt.replace(/\r/g, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DeepMind RSA · 60 s preview</title>
<style>
  html,body{margin:0;height:100%;background:#0B1120;color:#E8EDF5;font-family:Inter,system-ui,sans-serif}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px}
  video{height:min(92vh,1920px);aspect-ratio:9/16;background:#050812;border-radius:18px;box-shadow:0 0 60px rgba(54,197,240,.18)}
  p{margin:0;font:14px ui-monospace,monospace;color:#7F8BA3}
</style></head>
<body>
  <video controls playsinline preload="auto" src="/video.mp4">
    <track kind="captions" src="/captions.vtt" srclang="en" label="English" default>
  </video>
  <p>deepmind-rsa-60s.mp4 · 1080×1920 · 60 s · reload after each rebuild</p>
</body></html>`;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE);
  }
  if (url.pathname === '/captions.vtt') {
    res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(srtToVtt(fs.readFileSync(SRT, 'utf8')));
  }
  if (url.pathname === '/video.mp4') {
    if (!fs.existsSync(VIDEO)) { res.writeHead(404); return res.end('build the video first'); }
    const size = fs.statSync(VIDEO).size;
    const range = req.headers.range;
    const common = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' };
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m[1] ? Number(m[1]) : size - Number(m[2]);
      const end = m[2] && m[1] ? Number(m[2]) : size - 1;
      res.writeHead(206, { ...common, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(VIDEO, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...common, 'Content-Length': size });
    return fs.createReadStream(VIDEO).pipe(res);
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, '0.0.0.0', () => console.log(`preview on http://0.0.0.0:${PORT}`));
