// V3 "cast" version: the characters are the generated reference images, keyed to alpha
// (assets/keyed-*.png) and placed on depth layers with rim light, colour grade, sheen,
// breathing, depth blur and ground shadows. Symbols (crescent, trishul, lotus, lightning,
// shards, ritual water) stay vector. Violence is light and silhouette only.
// Usage: node render/cast.mjs            -> out/video.mp4
//        node render/cast.mjs --still 7  -> out/still-7.png
import { createCanvas, loadImage, GlobalFonts, ImageData } from '@napi-rs/canvas';
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

// Off-screen canvas that every frame is drawn on.
const canvas = createCanvas(W, H);
// 2D drawing context of the canvas.
const ctx = canvas.getContext('2d');
// One full turn in radians, used for circles and arcs.
const TAU = Math.PI * 2;
// Horizontal centre of the frame in pixels.
const CX = W / 2;
let NOW = 0; // current time, used by breathing and sheen

// ---------- characters ----------
// Load each keyed PNG, crop to its opaque bounding box, and keep a reusable tint buffer.
const CH = {};
// Loads the four keyed character PNGs, finds the bounding box of the opaque pixels in each, and stores the cropped image source.
async function loadCast() {
  for (const name of ['shiva', 'parvati', 'boy', 'reborn']) {
    const img = await loadImage(path.join(ROOT, 'assets', `keyed-${name}.png`));
    const full = createCanvas(img.width, img.height);
    const fx = full.getContext('2d');
    fx.drawImage(img, 0, 0);
    const d = fx.getImageData(0, 0, img.width, img.height).data;
    let minx = 1e9, miny = 1e9, maxx = -1, maxy = -1;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        if (d[(y * img.width + x) * 4 + 3] > 128) {
          if (x < minx) minx = x; if (x > maxx) maxx = x;
          if (y < miny) miny = y; if (y > maxy) maxy = y;
        }
      }
    }
    const w = maxx - minx + 1, h = maxy - miny + 1;
    CH[name] = { img, sx: minx, sy: miny, w, h };
  }
}
// Height of `name` that matches the pixel scale of a body of height `bodyH` for the boy.
const hMatch = (name, bodyH) => bodyH * (CH[name].h / CH.boy.h);

// Draw a character anchored at its feet (fx, fy) with bounding-box height Hpx.
// Uses Image sources only (canvas-as-source draws leak memory in this runtime).
// Tint and silhouette come from ctx.filter; sheen is a moving brightness band.
function tintFilter(o) {
  if (o.filter) return o.filter;
  if (o.silhouette) {
    const dark = o.silhouette.toLowerCase() < '#808080' && !/^#e|^#f/i.test(o.silhouette);
    return dark ? 'brightness(0.06)' : 'brightness(0) invert(1) sepia(1) saturate(7) hue-rotate(-12deg) brightness(0.92)';
  }
  if (o.tint) {
    const n = parseInt(o.tint.slice(1), 16);
    const r = (n >> 16) & 255, b = n & 255;
    return b > r ? 'saturate(0.7) hue-rotate(190deg) brightness(1.05)' : 'sepia(0.35) saturate(1.2) brightness(1.02)';
  }
  return '';
}
// Draws one character anchored at its feet (fx, fy), with bounding-box height Hpx.
// Options o: alpha, filter/tint/silhouette (colour), rim (glow colour), rimBlur,
// sheen (moving highlight strength), blur (depth blur in px), rot (tilt in radians),
// ground (draw a ground shadow, default true).
function drawChar(name, fx, fy, Hpx, o = {}) {
  const c = CH[name];
  if (!c) return;
  const s = Hpx / c.h;
  const dw = c.w * s;
  const dh = c.h * s;
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.001) return;
  if (o.ground !== false) { // ground shadow for depth
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(1, 0.14);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, dw * 0.42);
    g.addColorStop(0, `rgba(0,0,0,${0.55 * alpha})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, dw * 0.42, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const base = tintFilter(o);
  const blurF = o.blur ? `blur(${o.blur}px) ` : '';
  ctx.save();
  ctx.translate(fx, fy);
  const breathe = 1 + 0.004 * Math.sin(NOW * 1.6 + (o.phase || 0));
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(breathe, breathe);
  ctx.globalAlpha = alpha;
  const src = (x, y, w, h, dx, dy, dw2, dh2) => ctx.drawImage(c.img, c.sx + x, c.sy + y, w, h, dx, dy, dw2, dh2);
  if (o.rim) { // rim glow behind the figure
    ctx.filter = (blurF + base).trim() || 'none';
    ctx.shadowColor = o.rim;
    ctx.shadowBlur = o.rimBlur ?? 36;
    src(0, 0, c.w, c.h, -dw / 2, -dh, dw, dh);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'rgba(0,0,0,0)';
  }
  ctx.filter = (blurF + base).trim() || 'none';
  src(0, 0, c.w, c.h, -dw / 2, -dh, dw, dh);
  if (o.sheen) { // moving highlight band across costume and jewelry
    const p = ((NOW * 0.22) % 1.6) - 0.3;
    ctx.beginPath();
    ctx.rect(-dw / 2 + (p - 0.2) * dw, -dh, dw * 0.4, dh);
    ctx.clip();
    ctx.filter = blurF + 'brightness(1.8)';
    ctx.globalAlpha = Math.min(1, alpha * o.sheen * 2.2);
    src(0, 0, c.w, c.h, -dw / 2, -dh, dw, dh);
  }
  ctx.restore();
}

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
// Ease-in-out curve: 0 at x = 0, 1 at x = 1, smooth in between.
const smooth = (x) => { const c = clamp(x); return c * c * (3 - 2 * c); };
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Convert a #rrggbb colour and an alpha into an rgba() string.
const HEX = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a)})`;
};
// Set a soft coloured glow (shadow) for the next draws.
const glow = (color, blur) => { ctx.shadowColor = color; ctx.shadowBlur = blur; };
// Turn the glow off again.
const noGlow = () => { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; };
// Stroke a straight line from (x1, y1) to (x2, y2) with the current style.
const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

// Colour palettes for the scenes: top and bottom gradient colours and the glow colour.
const PAL = {
  blue: { top: '#070d18', bot: '#22324d', glow: '#8fb3e0' },
  gold: { top: '#1c1206', bot: '#5c3d10', glow: '#ffcf6a' },
  storm: { top: '#03060c', bot: '#14233f', glow: '#7fa6e6' },
  red: { top: '#14040a', bot: '#4a0e12', glow: '#e0573a' },
  lumi: { top: '#2a1a04', bot: '#8a5a14', glow: '#fff0b8' },
};

// Global camera drift in pixels. Each layer moves by this times its depth, which creates parallax.
let camX = 0;
let camY = 0;
// Draws fn() at depth d (0 = far, 1 = near). Applies camera parallax, a small zoom and an optional depth blur of blurPx pixels.
function layer(d, blurPx, fn) {
  ctx.save();
  const k = 1 + d * 0.05;
  ctx.translate(CX + camX * d, H / 2 + camY * d);
  ctx.scale(k, k);
  ctx.translate(-CX, -H / 2);
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  fn();
  ctx.restore();
}
// Zooms the whole frame by z around the centre (camera push-in).
function push(z) {
  ctx.translate(CX, H / 2);
  ctx.scale(z, z);
  ctx.translate(-CX, -H / 2);
}
// Draws the background: a vertical gradient plus a soft glow centred at height cy.
function bg(p, pulse = 0, cy = 0.45) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p.top);
  g.addColorStop(1, p.bot);
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, W + 400, H + 400);
  const r = ctx.createRadialGradient(CX, H * cy, 0, CX, H * cy, H * 0.65);
  r.addColorStop(0, HEX(p.glow, 0.28 + pulse));
  r.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = r;
  ctx.fillRect(-200, -200, W + 400, H + 400);
}
// Creates n dust particles with random positions and speeds, from a fixed seed.
function makeMotes(seed, n) {
  const R = rng(seed);
  return Array.from({ length: n }, () => ({
    x: R() * W, y: R() * H, vx: (R() - 0.5) * 24, vy: 6 + R() * 26,
    r: 0.8 + R() * 3, d: R(), a: 0.3 + R() * 0.7,
  }));
}
// Draws the dust particles, drifting and wrapping around the frame edges.
function drawMotes(ms, t, col, amp = 1) {
  for (const m of ms) {
    const x = (((m.x + m.vx * t) % W) + W) % W;
    const y = (((m.y - m.vy * t) % H) + H) % H;
    ctx.fillStyle = HEX(col, m.a * amp * (0.35 + 0.65 * m.d));
    ctx.beginPath();
    ctx.arc(x, y, m.r * (0.5 + m.d), 0, TAU);
    ctx.fill();
  }
}
// Draws a circle outline (pulse rings and shockwaves).
function ring(x, y, r, col, a, w = 3) {
  ctx.strokeStyle = HEX(col, a);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}
// Draws a soft glowing orb: white centre fading to the colour at the edge.
function orb(x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, HEX('#ffffff', a));
  g.addColorStop(0.35, HEX(col, a * 0.8));
  g.addColorStop(1, HEX(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
// Builds the path of a crescent moon: an outer circle minus an offset circle.
function crescentPath(x, y, r) {
  const dx = r * 0.45, rr = r * 0.95;
  const xi = (r * r - rr * rr + dx * dx) / (2 * dx);
  const yi = Math.sqrt(Math.max(0, r * r - xi * xi));
  const a0 = Math.atan2(yi, xi), a1 = Math.atan2(-yi, xi);
  const b0 = Math.atan2(yi, xi - dx), b1 = Math.atan2(-yi, xi - dx);
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1, false);
  ctx.arc(x + dx, y, rr, b1, b0, true);
  ctx.closePath();
}
// Fills a glowing crescent moon.
function crescent(x, y, r, col, a) {
  glow(HEX(col, a), r * 0.6);
  ctx.fillStyle = HEX(col, a);
  crescentPath(x, y, r);
  ctx.fill();
  noGlow();
}
// Draws a lotus of petals. open (0..1) sets how far the petals are unfolded.
function lotus(x, y, r, open, col, a, petals = 8) {
  ctx.save();
  glow(HEX(col, a * 0.8), r * 0.25);
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i * TAU) / petals);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5 * Math.max(0.05, open), r * 0.2, r * 0.5 * Math.max(0.05, open), 0, 0, TAU);
    ctx.fillStyle = HEX(col, a * 0.55);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.16, 0, TAU);
  ctx.fillStyle = HEX('#fff3c4', a);
  ctx.fill();
  ctx.restore();
}
// Draws particles on an outward spiral from the centre (creation scene).
function spiral(t, n, cx, cy, col, speed) {
  for (let i = 0; i < n; i++) {
    const a0 = i * 2.399;
    const rad = (i * 37 + t * speed) % 720;
    const ang = a0 + rad * 0.012;
    ctx.fillStyle = HEX(col, 1 - rad / 720);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * 0.7, 1.5 + (i % 3), 0, TAU);
    ctx.fill();
  }
}
// Draws large soft fog clouds that drift slowly.
function fogBlobs(t, col, a) {
  [[200, 500, 320], [880, 900, 360], [420, 1400, 380], [760, 1700, 420]].forEach(([bx, by, br], k) => {
    const x = bx + Math.sin(t * 0.2 + k) * 60;
    const y = by + Math.cos(t * 0.17 + k * 2) * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, br);
    g.addColorStop(0, HEX(col, a));
    g.addColorStop(1, HEX(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, br, 0, TAU);
    ctx.fill();
  });
}
// Draws a ring of short rays around a point, used for the rebirth burst.
function chromaSpikes(x, y, r, col, a) {
  ctx.save();
  glow(HEX(col, a), 16);
  ctx.strokeStyle = HEX(col, a);
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const ang = (i * TAU) / 12;
    line(x + Math.cos(ang) * r * 0.3, y + Math.sin(ang) * r * 0.3, x + Math.cos(ang) * r, y + Math.sin(ang) * r);
  }
  ctx.restore();
}
function trishulSymbol(x, y, h, col, a) { // small vector trishul used for the payoff corners
  ctx.save();
  glow(HEX(col, a * 0.9), h * 0.05);
  ctx.fillStyle = HEX(col, a);
  ctx.strokeStyle = HEX(col, a);
  ctx.lineWidth = h * 0.022;
  ctx.lineCap = 'round';
  const top = y - h * 0.5;
  line(x, top + h * 0.2, x, y + h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x - h * 0.05, top + h * 0.2); ctx.lineTo(x, top); ctx.lineTo(x + h * 0.05, top + h * 0.2);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - h * 0.03, top + h * 0.2);
  ctx.quadraticCurveTo(x - h * 0.2, top + h * 0.12, x - h * 0.19, top);
  ctx.quadraticCurveTo(x - h * 0.13, top + h * 0.1, x - h * 0.03, top + h * 0.23);
  ctx.moveTo(x + h * 0.03, top + h * 0.2);
  ctx.quadraticCurveTo(x + h * 0.2, top + h * 0.12, x + h * 0.19, top);
  ctx.quadraticCurveTo(x + h * 0.13, top + h * 0.1, x + h * 0.03, top + h * 0.23);
  ctx.fill();
  ctx.restore();
}
function trishulBeam(x, y, h, col, a) { // big light trishul (battle)
  ctx.save();
  glow(HEX(col, a), h * 0.08);
  ctx.strokeStyle = HEX(col, a);
  ctx.lineWidth = h * 0.02;
  ctx.lineCap = 'round';
  line(x, y - h * 0.5, x, y + h * 0.5);
  ctx.restore();
}

// Pre-generated dust particles for each scene. Seeded, so every frame is the same.
const MOTES = {
  s1: makeMotes(11, 90), s2: makeMotes(12, 60), s3: makeMotes(13, 70), s4: makeMotes(14, 60),
  s5: makeMotes(15, 40), s6: makeMotes(16, 140), s7: makeMotes(17, 80), s8: makeMotes(18, 110),
};

// ---------- scenes ----------
const SCENES = [];

// 1 Hook (0-5): cold blue-grey. Shiva is first a dark silhouette, then steps into colour.
SCENES[0] = (t, lt) => {
  bg(PAL.blue, 0.04 * Math.sin(t), 0.4);
  push(1 + 0.06 * lt);
  layer(0.1, 26, () => fogBlobs(t, '#8fb3e0', 0.18));
  layer(0.35, 0, () => crescent(CX + 40, 700 - 40 * smooth(lt), 190, '#e6f0ff', 0.9));
  layer(0.5, 0, () => drawMotes(MOTES.s1, t, '#cfe0ff', 0.9));
  layer(0.72, 0, () => {
    const reveal = smooth((lt - 0.2) * 3);
    drawChar('shiva', CX, 1780, 1240, { silhouette: '#0a1222', alpha: 1 - reveal, rim: '#9fc2ff', rimBlur: 50 });
    drawChar('shiva', CX, 1780, 1240, { tint: '#4a6fa5', tintAlpha: 0.12, alpha: reveal, rim: '#9fc2ff', rimBlur: 40, sheen: 0.12 });
  });
  layer(0.95, 10, () => {
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = HEX('#cfe0ff', 0.08);
      ctx.beginPath(); ctx.arc(120 + k * 200 + Math.sin(t + k) * 20, 1650 - k * 80, 90 + k * 10, 0, TAU); ctx.fill();
    }
  });
};

// 2 Creation (5-14): warm gold. Sparks spiral in, an orb breathes, Parvati shapes the clay
// and the boy rises from the golden clay, still tinted gold and then natural.
SCENES[1] = (t, lt) => {
  bg(PAL.gold, 0.08 * Math.sin(t * 1.3), 0.6);
  push(1 + 0.05 * lt);
  layer(0.15, 18, () => {
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = HEX('#FFD27A', 0.16); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(CX, 1080, 380 + k * 170, Math.PI, TAU); ctx.stroke();
    }
  });
  layer(0.3, 0, () => spiral(t - 5, 220, CX, 1060, '#FFE7A8', 70));
  layer(0.45, 0, () => {
    orb(CX, 1060, 60 + 90 * smooth(lt * 1.5), '#FFD27A', 0.95);
    for (let k = 0; k < 3; k++) {
      const ph = ((t - 5 - k * 1.1) % 3.3) / 3.3;
      if (ph > 0) ring(CX, 1060, 80 + 420 * ph, '#FFD27A', (1 - ph) * 0.6, 4);
    }
  });
  layer(0.7, 0, () => drawChar('parvati', 250, 1740, 1120, { alpha: smooth(lt * 2), tint: '#ffb347', tintAlpha: 0.08, rim: '#FFD27A', rimBlur: 30, sheen: 0.18 }));
  layer(0.6, 0, () => { // clay pile
    const a = smooth((lt - 0.15) * 2.5);
    const g = ctx.createRadialGradient(600, 1500, 10, 600, 1500, 200);
    g.addColorStop(0, HEX('#FFD27A', 0.85 * a)); g.addColorStop(1, HEX('#FFD27A', 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(600, 1500, 200, 40, 0, 0, TAU); ctx.fill();
  });
  layer(0.65, 0, () => {
    const reveal = 1500 - 560 * smooth((lt - 0.3) * 1.6);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, reveal, W, H); ctx.clip();
    drawChar('boy', 600, 1500, 560, { tint: '#FFD27A', tintAlpha: 0.65 * (1 - smooth((lt - 0.4) * 1.5)), rim: '#FFE7A8', rimBlur: 30, sheen: 0.2 });
    ctx.restore();
  });
  layer(0.95, 8, () => drawMotes(MOTES.s2, t, '#FFE7A8', 1));
};

// 3 Command (14-21): gold door-light. Parvati stands back in the light; the boy holds the
// staff at the door; Shiva's cool figure grows in the distance. Camera pushes in.
SCENES[2] = (t, lt) => {
  bg(PAL.gold, 0.05, 0.45);
  push(1 + 0.2 * smooth(lt));
  layer(0.2, 0, () => {
    const g = ctx.createLinearGradient(CX, 600, CX, 1500);
    g.addColorStop(0, HEX('#FFE7A8', 0.45));
    g.addColorStop(1, HEX('#FFE7A8', 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(CX - 260, 1500); ctx.lineTo(CX - 260, 620);
    ctx.arc(CX, 620, 260, Math.PI, 0);
    ctx.lineTo(CX + 260, 1500); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = HEX('#FFD27A', 0.5); ctx.lineWidth = 8; ctx.stroke();
  });
  layer(0.4, 4, () => drawChar('parvati', 620, 1480, 760, { alpha: 0.85, tint: '#ffb347', tintAlpha: 0.1, rim: '#FFD27A', rimBlur: 24 }));
  layer(0.5, 0, () => drawChar('shiva', 860, 1580, 700 + 260 * smooth(lt), { alpha: 0.7 + 0.3 * smooth(lt), tint: '#8fb3e0', tintAlpha: 0.25, rim: '#a9c4e6', rimBlur: 30 }));
  layer(0.8, 0, () => drawChar('boy', 330, 1700, 900, { rim: '#FFE7A8', rimBlur: 28, sheen: 0.15 }));
  layer(0.95, 6, () => drawMotes(MOTES.s3, t, '#FFE7A8', 0.9));
};

// 4 Confrontation (21-27): cold palette, low angle. Staff (gold) and trishul (cold) face
// each other across a trembling line; heartbeat rings pulse behind.
SCENES[3] = (t, lt) => {
  bg(PAL.blue, 0.03, 0.55);
  push(1 + 0.1 * lt);
  layer(0.25, 0, () => {
    const g = ctx.createLinearGradient(CX - 120, 0, CX + 120, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, HEX('#cfe0ff', 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(CX - 120, 0, 240, H);
  });
  layer(0.35, 0, () => {
    const ph = (t - 21) % 1;
    ring(CX, 1000, 60 + 500 * ph, '#A9C4E6', (1 - ph) * 0.45, 3);
  });
  layer(0.55, 0, () => {
    ctx.strokeStyle = HEX('#FFE7A8', 0.85);
    ctx.lineWidth = 4 + 3 * lt;
    ctx.beginPath();
    for (let x = 0; x <= 1; x += 0.02) {
      const px = 440 + 260 * x;
      const py = 1020 + Math.sin(x * 40 + t * 30) * 14 * lt;
      x === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
  layer(0.75, 0, () => drawChar('boy', 320, 1760, 1000, { rim: '#FFE7A8', rimBlur: 34, tint: '#8fb3e0', tintAlpha: 0.08, sheen: 0.12 }));
  layer(0.85, 0, () => drawChar('shiva', 780, 1780, 1080, { rim: '#cfe0ff', rimBlur: 36, tint: '#3d5e8f', tintAlpha: 0.12 }));
  layer(0.95, 6, () => drawMotes(MOTES.s4, t, '#cfe0ff', 0.8));
};

// 5 Battle (27-35): stormy blue. Shiva as a dark silhouette with a bright rim, lit by the
// flash. Only light, shards and shockwaves; no bodies are harmed.
SCENES[4] = (t, lt) => {
  bg(PAL.storm, 0.02, 0.45);
  push(1 + 0.1 * lt);
  const T = t - 27;
  layer(0.3, 0, () => {
    const k = Math.floor(t * 4);
    const R = rng(k * 97 + 3);
    if (R() > 0.45) {
      ctx.strokeStyle = HEX('#eef5ff', 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = 200 + R() * 680, y = 0;
      ctx.moveTo(x, y);
      while (y < 1100) { x += (R() - 0.5) * 120; y += 60 + R() * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  layer(0.4, 0, () => {
    for (let k = 0; k < 3; k++) {
      const age = T - k * 0.7;
      if (age > 0) ring(CX, 900, 60 + age * 700, '#dfe9ff', clamp(1 - age / 2.2) * 0.7, 6 - k);
    }
  });
  layer(0.5, 0, () => {
    const R = rng(777);
    for (let i = 0; i < 40; i++) {
      const ang = R() * TAU;
      const sp = 300 + R() * 900;
      const d = Math.max(0, T) * sp;
      const x = CX + Math.cos(ang) * d;
      const y = 900 + Math.sin(ang) * d;
      const sz = 22 + R() * 46;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang + T * 2);
      ctx.fillStyle = HEX('#dfe9ff', clamp(0.9 - T / 4) * 0.8);
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * 0.4, sz * 0.5); ctx.lineTo(-sz * 0.4, sz * 0.4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  });
  layer(0.7, 0, () => drawChar('shiva', CX, 1840, 1320, { silhouette: '#070b14', rim: '#dfe9ff', rimBlur: 50, alpha: smooth((T - 0.1) * 3), ground: true }));
  layer(0.9, 0, () => trishulBeam(CX, 980, 760, '#eef5ff', 0.5 * smooth((T - 0.3) * 2)));
  layer(0.95, 0, () => drawMotes(MOTES.s5, t, '#dfe9ff', 0.7));
};

// 6 Grief (35-41): dark red. Parvati bows slightly, tears of light fall, a lotus closes
// behind her. Dignified, not frightening.
SCENES[5] = (t, lt) => {
  bg(PAL.red, 0.03, 0.2);
  push(1 + 0.04 * lt);
  layer(0.2, 0, () => {
    const g = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 700);
    g.addColorStop(0, HEX('#FFB35A', 0.35)); g.addColorStop(1, HEX('#FFB35A', 0));
    ctx.fillStyle = g; ctx.fillRect(-200, -200, W + 400, H + 400);
  });
  layer(0.4, 0, () => drawMotes(MOTES.s6, t, '#FFB35A', 0.8));
  layer(0.55, 0, () => lotus(CX, 1080, 300, 0.85 - 0.25 * lt, '#FF7A4A', 0.5 - 0.15 * lt));
  layer(0.75, 0, () => drawChar('parvati', CX, 1780, 1080, { tint: '#8b1a1a', tintAlpha: 0.2, rim: '#FFB35A', rimBlur: 34, rot: 0.025 * smooth(lt), sheen: 0.12 }));
  layer(0.8, 0, () => { // tears of light
    for (let k = 0; k < 3; k++) {
      const ph = ((t - 35 + k * 0.6) % 1.8) / 1.8;
      ctx.fillStyle = HEX('#FFD27A', 1 - ph);
      ctx.beginPath(); ctx.ellipse(CX - 22 + k * 22, 830 + ph * 260, 5, 9, 0, 0, TAU); ctx.fill();
    }
  });
  layer(0.95, 10, () => {
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = HEX('#FFB35A', 0.08);
      ctx.beginPath(); ctx.arc(150 + k * 260, ((t * 50 + k * 400) % 2100) - 100, 110, 0, TAU); ctx.fill();
    }
  });
};

// 7 Rebirth (41-51): luminous gold. Ritual water falls, the boy's human head becomes a
// symbolic gold elephant silhouette (no detail, no harm), then the light settles.
SCENES[6] = (t, lt) => {
  bg(PAL.lumi, 0.12 + 0.05 * Math.sin(t * 2), 0.42);
  push(1 + 0.05 * lt);
  layer(0.2, 0, () => {
    for (let k = 0; k < 16; k++) {
      const ang = k * (TAU / 16) + t * 0.15;
      ctx.fillStyle = HEX('#FFF0B8', 0.1);
      ctx.beginPath();
      ctx.moveTo(CX, 900);
      ctx.lineTo(CX + Math.cos(ang) * 1400, 900 + Math.sin(ang) * 1400);
      ctx.lineTo(CX + Math.cos(ang + 0.09) * 1400, 900 + Math.sin(ang + 0.09) * 1400);
      ctx.closePath(); ctx.fill();
    }
  });
  layer(0.4, 0, () => orb(CX, 1100, 300 + 40 * Math.sin(t * 2), '#FFE7A8', 0.6));
  layer(0.55, 0, () => {
    for (let k = 0; k < 16; k++) {
      const ph = ((t - 41 + k * 0.23) % 1.6) / 1.6;
      ctx.fillStyle = HEX('#FFF3C4', 0.8 * (1 - ph * 0.5));
      ctx.beginPath(); ctx.ellipse(CX + Math.sin(k * 7.3) * 60, 250 + ph * 580, 4, 9, 0, 0, TAU); ctx.fill();
    }
  });
  const m = smooth((lt - 0.3) / 0.3);
  layer(0.7, 0, () => {
    const Hb = 900;
    drawChar('boy', CX, 1760, Hb, { alpha: 1 - m, tint: '#FFD27A', tintAlpha: 0.1, rim: '#FFF0B8', rimBlur: 40, sheen: 0.18 });
    if (m > 0) drawChar('reborn', CX, 1760, hMatch('reborn', Hb), { alpha: m, silhouette: '#E8B04A', rim: '#B8862E', rimBlur: 22 });
  });
  layer(0.9, 0, () => { // symbolic north marker
    ctx.save();
    glow('#FFF0B8', 20);
    ctx.fillStyle = HEX('#FFF0B8', 0.9 * smooth((lt - 0.5) * 3));
    ctx.beginPath(); ctx.moveTo(880, 560); ctx.lineTo(850, 620); ctx.lineTo(910, 620); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
  layer(0.95, 8, () => drawMotes(MOTES.s7, t, '#FFF3C4', 1));
  if (lt > 0.5) chromaSpikes(CX, 1180, 320, '#FFF0B8', 0.25 * smooth((lt - 0.5) * 2));
};

// 8 Payoff (51-60): Shiva and Parvati bless the elephant-headed child (full colour) under
// a blooming lotus. Warm gold resolve.
SCENES[7] = (t, lt) => {
  bg(PAL.gold, 0.08, 0.35);
  push(1 + 0.05 * smooth(lt));
  layer(0.2, 0, () => lotus(CX, 1180, 330, smooth(lt * 1.6), '#FF9A5A', 0.6, 10));
  layer(0.35, 0, () => {
    crescent(230, 420, 110, '#e6f0ff', 0.7);
    trishulSymbol(860, 520, 380, '#FFD27A', 0.7);
  });
  layer(0.5, 0, () => drawMotes(MOTES.s8, t, '#FFE7A8', 0.9));
  layer(0.6, 0, () => {
    drawChar('shiva', 220, 1740, 1040, { tint: '#8fb3e0', tintAlpha: 0.12, rim: '#dfe9ff', rimBlur: 34, sheen: 0.1 });
    drawChar('parvati', 880, 1740, 1040, { tint: '#ffb347', tintAlpha: 0.1, rim: '#FFD27A', rimBlur: 34, sheen: 0.14 });
  });
  layer(0.9, 0, () => drawChar('reborn', CX, 1800, hMatch('reborn', 760), { rim: '#FFF0B8', rimBlur: 40, sheen: 0.15 }));
  layer(0.95, 8, () => {
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = HEX('#FFD27A', 0.07);
      ctx.beginPath(); ctx.arc(160 + k * 380, 1550 + Math.sin(t + k) * 30, 110, 0, TAU); ctx.fill();
    }
  });
};

// ---------- overlays ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Index of the scene that contains time t.
function sceneIndex(t) {
  for (let i = 0; i < S.scenes.length; i++) if (t < S.scenes[i].end) return i;
  return S.scenes.length - 1;
}
// Draws the on-screen title pill in the top safe area, fading in and out with its scene.
function drawLabel(i, t) {
  const s = S.scenes[i];
  const alpha = Math.min(1, (t - s.start) / 0.4, (s.end - t) / 0.4);
  if (alpha <= 0) return;
  ctx.save();
  ctx.font = '58px NDSemi';
  const w = ctx.measureText(s.label).width;
  const padX = 44, h = 96, x = (W - w - padX * 2) / 2, y = 360;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10, 12, 22, 0.55)';
  roundRect(x, y, w + padX * 2, h, 48);
  ctx.fill();
  ctx.fillStyle = '#FFE7A8';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(s.label, x + padX, y + h / 2 + 2);
  ctx.restore();
}
// Finds the Hindi caption that is on screen at time t. Captions follow the real VO length.
function captionAt(t) {
  for (const s of S.scenes) {
    const start = s.start + s.voStart;
    const end = start + VDUR[s.id];
    if (t >= start - 0.1 && t < end + 0.25) {
      return { s, alpha: Math.min(1, (t - start + 0.1) / 0.15, (end + 0.25 - t) / 0.2) };
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
  const lineH = 92, firstY = 1300;
  const widest = Math.max(...s.caption.map((ln) => ctx.measureText(ln).width));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
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
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}
// Chromatic aberration: shifts the red channel right and the blue channel left by a pixels (colour fringe).
function chromaPass(a) {
  if (a < 0.5) return;
  const src = ctx.getImageData(0, 0, W, H).data;
  const out = new Uint8ClampedArray(src.length);
  const d = Math.round(a);
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      const i = row + x * 4;
      out[i] = src[row + Math.min(W - 1, x + d) * 4];
      out[i + 1] = src[i + 1];
      out[i + 2] = src[row + Math.max(0, x - d) * 4 + 2];
      out[i + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(out, W, H), 0, 0);
}
// Strength of the colour fringe at time t: battle flash and scene cuts.
function chromaAmt(t) {
  let a = 0;
  if (t >= 27 && t < 28.6) a = Math.max(a, 16 * (1 - (t - 27) / 1.6));
  for (const c of [5, 14, 21, 35, 41, 51]) {
    const dt = t - c;
    if (dt >= 0 && dt < 0.35) a = Math.max(a, 7 * (1 - dt / 0.35));
  }
  return a;
}

// Renders one frame at time t, in order: scene, flash, colour fringe, label, caption.
function renderFrame(t) {
  NOW = t;
  const i = sceneIndex(t);
  const s = S.scenes[i];
  const lt = clamp((t - s.start) / (s.end - s.start));
  camX = Math.sin(t * 0.35) * 14;
  camY = Math.cos(t * 0.27) * 10;
  ctx.save();
  const shake = t >= 27 && t < 28.2 ? (1 - (t - 27) / 1.2) * 10 : 0;
  ctx.translate(Math.sin(t * 90) * shake, Math.cos(t * 77) * shake);
  SCENES[i](t, lt);
  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  if (t >= 27 && t < 27.9) {
    const a = t < 27.1 ? 0.95 : 0.95 * Math.exp(-(t - 27.1) * 6);
    ctx.fillStyle = `rgba(255, 250, 235, ${a})`;
    ctx.fillRect(0, 0, W, H);
  }
  chromaPass(chromaAmt(t));
  drawLabel(i, t);
  const cap = captionAt(t);
  if (cap) drawCaption(cap.s, cap.alpha);
}

await loadCast();
if (STILL !== null) {
  renderFrame(STILL);
  fs.writeFileSync(path.join(OUT, `still-${STILL}.png`), await canvas.encode('png'));
  console.log(`wrote out/still-${STILL}.png`);
} else {
  // Optional segment mode (--from/--to in seconds) keeps memory bounded; segments are concatenated later.
  const from = argv.includes('--from') ? parseFloat(argv[argv.indexOf('--from') + 1]) : 0;
  const to = argv.includes('--to') ? parseFloat(argv[argv.indexOf('--to') + 1]) : DUR;
  const outName = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'video.mp4';
  const ff = spawn(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', path.join(OUT, outName),
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const startF = Math.round(from * FPS);
  const total = Math.round(to * FPS);
  for (let f = startF; f < total; f++) {
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
