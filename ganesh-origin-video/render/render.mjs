// Renders the 1080x1920, 60 fps picture: Ken Burns pushes, colour grades,
// Devanagari on-screen labels, two-line captions, and the blood-free flash.
// Usage: node render/render.mjs            -> out/video.mp4
//        node render/render.mjs --still 7  -> out/still-7.png (one frame, for checks)
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root: the folder that holds script.json, assets/, audio/, fonts/ and out/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Timeline and on-screen text (scenes, captions, highlights), loaded from script.json.
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'));
// Measured length of each VO clip in seconds, written by render/measure.mjs.
const VDUR = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'vo-durations.json'), 'utf8'));
// Frame size, frame rate and total duration, from script.json.
const { width: W, height: H, fps: FPS, duration: DUR } = S;
// ffmpeg binary to use; override with the FFMPEG environment variable.
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
// Command-line arguments after the script name.
const argv = process.argv.slice(2);
// --still <seconds>: render one frame to a PNG instead of the whole film.
const STILL = argv.includes('--still') ? parseFloat(argv[argv.indexOf('--still') + 1]) : null;
// Output folder for the rendered video, stills and intermediate files.
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'NotoSansDevanagari-Black.ttf'), 'NDBlack');
GlobalFonts.registerFromPath(path.join(ROOT, 'fonts', 'NotoSansDevanagari-SemiBold.ttf'), 'NDSemi');

// Scene images, loaded once before rendering starts.
const imgs = await Promise.all(S.scenes.map((s) => loadImage(path.join(ROOT, s.image))));
// Off-screen canvas that every frame is drawn on.
const canvas = createCanvas(W, H);
// 2D drawing context of the canvas.
const ctx = canvas.getContext('2d');

// Colour grades follow the user's palette journey:
// blue-grey (mystery), warm gold (creation), stormy blue (battle), dark red/gold (grief), luminous gold (rebirth).
const GRADES = {
  blue: [
    { c: 'rgba(70, 95, 135, 0.38)', op: 'multiply' },
    { c: 'rgba(20, 30, 50, 0.22)', op: 'source-over' },
  ],
  gold: [
    { c: 'rgba(255, 196, 96, 0.24)', op: 'soft-light' },
    { c: 'rgba(255, 170, 60, 0.07)', op: 'source-over' },
  ],
  storm: [
    { c: 'rgba(35, 60, 115, 0.50)', op: 'multiply' },
    { c: 'rgba(10, 16, 30, 0.20)', op: 'source-over' },
  ],
  red: [
    { c: 'rgba(130, 25, 25, 0.38)', op: 'multiply' },
    { c: 'rgba(255, 190, 80, 0.10)', op: 'soft-light' },
  ],
};

// Index of the scene that contains time t.
function sceneIndex(t) {
  for (let i = 0; i < S.scenes.length; i++) if (t < S.scenes[i].end) return i;
  return S.scenes.length - 1;
}

// Draws the scene image with a slow push-in and pan, then the scene colour grade and vignette.
function drawBackground(i, t) {
  const s = S.scenes[i];
  const img = imgs[i];
  const u = Math.min(1, Math.max(0, (t - s.start) / (s.end - s.start)));
  const base = Math.max(W / img.width, H / img.height); // cover-fit
  const zoom = 1.03 + 0.07 * u; // slow push-in
  const dw = img.width * base * zoom;
  const dh = img.height * base * zoom;
  const pan = (i % 2 === 0 ? 1 : -1) * 30 * (u - 0.5);
  ctx.drawImage(img, (W - dw) / 2 + pan, (H - dh) / 2, dw, dh);
  for (const g of GRADES[s.grade] || []) {
    ctx.globalCompositeOperation = g.op;
    ctx.fillStyle = g.c;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// Gold rebirth glow (scenes 7-8 only).
function drawGlow(t) {
  if (t < 41) return;
  const a = Math.min(1, (t - 41) / 3) * (0.22 + 0.06 * Math.sin(t * 2.2));
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 40, W / 2, H * 0.42, H * 0.55);
  g.addColorStop(0, `rgba(255, 226, 150, ${a})`);
  g.addColorStop(1, 'rgba(255, 200, 90, 0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

// Violence is shown only as a light flash (no blood, no wounds).
function drawFlash(t) {
  const t0 = 27.0;
  if (t < t0 || t > t0 + 0.9) return;
  const a = t < t0 + 0.1 ? 0.95 : 0.95 * Math.exp(-(t - t0 - 0.1) * 5);
  ctx.fillStyle = `rgba(255, 250, 235, ${a})`;
  ctx.fillRect(0, 0, W, H);
}

// Builds a rounded-rectangle path.
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// On-screen label in the top safe area, shown for the whole scene.
function drawLabel(i, t) {
  const s = S.scenes[i];
  const alpha = Math.min(1, (t - s.start) / 0.4, (s.end - t) / 0.4);
  if (alpha <= 0) return;
  ctx.save();
  ctx.font = '58px NDSemi';
  const text = s.label;
  const w = ctx.measureText(text).width;
  const padX = 44;
  const h = 96;
  const x = (W - w - padX * 2) / 2;
  const y = 360;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10, 12, 22, 0.55)';
  roundRect(x, y, w + padX * 2, h, 48);
  ctx.fill();
  ctx.fillStyle = '#FFE7A8';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + h / 2 + 2);
  ctx.restore();
}

// The VO clip that is playing at time t (captions follow the actual VO length).
function captionAt(t) {
  for (const s of S.scenes) {
    const start = s.start + s.voStart;
    const end = start + VDUR[s.id];
    if (t >= start - 0.1 && t < end + 0.25) {
      const alpha = Math.min(1, (t - start + 0.1) / 0.15, (end + 0.25 - t) / 0.2);
      return { s, alpha };
    }
  }
  return null;
}

// Splits a caption line into normal and highlighted parts around the highlight word.
function splitHighlight(line, hl) {
  const idx = line.indexOf(hl);
  if (idx < 0) return [{ t: line, hi: false }];
  return [
    { t: line.slice(0, idx), hi: false },
    { t: hl, hi: true },
    { t: line.slice(idx + hl.length), hi: false },
  ].filter((p) => p.t.length > 0);
}

// Draws a two-line caption with a dark shadow and a soft band behind it. Highlighted words are gold.
function drawCaption(s, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = '64px NDBlack';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const lineH = 92;
  const firstY = 1300;
  const widest = Math.max(...s.caption.map((ln) => ctx.measureText(ln).width));
  // soft dark band behind the captions for legibility
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
  roundRect((W - widest) / 2 - 36, firstY - 84, widest + 72, lineH * (s.caption.length - 1) + 130, 34);
  ctx.fill();
  s.caption.forEach((ln, li) => {
    const y = firstY + li * lineH;
    const hl = (s.highlight || []).find((h) => ln.includes(h));
    const parts = hl ? splitHighlight(ln, hl) : [{ t: ln, hi: false }];
    const widths = parts.map((p) => ctx.measureText(p.t).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = (W - total) / 2;
    parts.forEach((p, k) => {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = p.hi ? '#FFD27A' : '#FFFFFF';
      ctx.fillText(p.t, x, y);
      x += widths[k];
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}

// Renders one frame at time t, in order: scene, flash, colour fringe, label, caption.
function renderFrame(t) {
  const i = sceneIndex(t);
  drawBackground(i, t);
  drawGlow(t);
  drawFlash(t);
  drawLabel(i, t);
  const cap = captionAt(t);
  if (cap) drawCaption(cap.s, cap.alpha);
}

if (STILL !== null) {
  renderFrame(STILL);
  fs.writeFileSync(path.join(OUT, `still-${STILL}.png`), await canvas.encode('png'));
  console.log(`wrote out/still-${STILL}.png`);
} else {
  const ff = spawn(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', path.join(OUT, 'video.mp4'),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(DUR * FPS);
  for (let f = 0; f < total; f++) {
    renderFrame(f / FPS);
    const px = ctx.getImageData(0, 0, W, H).data;
    if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) await once(ff.stdin, 'drain');
    if (f % 600 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  const [code] = await once(ff, 'close');
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  console.log('wrote out/video.mp4');
}
