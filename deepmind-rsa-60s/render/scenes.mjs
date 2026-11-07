// Scene drawing for the 60-second RSA film.
//
// Every scene is a function (ctx, lt, alpha) that draws one moment of that scene. `lt` is the time since the
// scene started, in seconds. It can be slightly negative during a cross-fade, and the easing helpers clamp it.
// All motion comes from the local time, so a frame can be rendered on its own, in any order.
//
// Layout rules:
//   - Scene content stays between y=300 and y=1300. Captions sit around y=1430, above the platform overlays.
//   - Text is drawn with the fonts registered below. Numbers use the Inter Black face.
//   - The palette comes from the brief: deep navy, electric cyan, warning amber, soft white.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const F = (p) => path.join(ROOT, 'node_modules', '@expo-google-fonts', p);
GlobalFonts.registerFromPath(F('inter/900Black/Inter_900Black.ttf'), 'InterK');
GlobalFonts.registerFromPath(F('inter/800ExtraBold/Inter_800ExtraBold.ttf'), 'InterXB');
GlobalFonts.registerFromPath(F('inter/700Bold/Inter_700Bold.ttf'), 'InterB');
GlobalFonts.registerFromPath(F('jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf'), 'MonoM');
GlobalFonts.registerFromPath(F('jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf'), 'MonoR');

export const COL = {
  navy: '#101725',
  deep: '#0B1120',
  panel: '#151F30',
  cyan: '#36C5F0',
  amber: '#F3A64A',
  white: '#E8EDF5',
  mute: '#7F8BA3',
  grey: '#8593AA',
};
const W = 1080, H = 1920, CX = 540;

// ---------- helpers ----------
export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const eo = (x) => 1 - Math.pow(1 - cl(x), 3);            // ease-out cubic
export const ei = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }; // ease in-out cubic
// 0..1 progress of a window that starts at `a` and lasts `d` seconds.
export const win = (lt, a, d) => cl((lt - a) / d);
const lerp = (a, b, t) => a + (b - a) * t;

// Small seeded PRNG so particles and cracks look the same on every render.
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Rounded rectangle path. Defined here because it works on every canvas version.
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Returns the font string with its pixel size reduced, if needed, so the text fits in maxW.
function fitFont(ctx, s, font, maxW) {
  const m = font.match(/(\d+)px/);
  if (!m) return font;
  ctx.font = font;
  const w = ctx.measureText(s).width;
  if (w <= maxW) return font;
  return font.replace(/\d+px/, `${Math.floor((Number(m[1]) * maxW) / w)}px`);
}

// Draws text with the given font, colour and alignment. `a` is extra alpha (0..1).
function txt(ctx, s, x, y, { font = '40px InterB', color = COL.white, align = 'center', a = 1, glow = 0, glowColor = COL.cyan } = {}) {
  ctx.save();
  ctx.font = fitFont(ctx, s, font, 900);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = cl(a) * ctx.globalAlpha;
  ctx.fillStyle = color;
  if (glow) { ctx.shadowColor = glowColor; ctx.shadowBlur = glow; }
  ctx.fillText(s, x, y);
  ctx.restore();
}

// Same as txt(), but the whole text fades in while it rises a little.
function rise(ctx, s, x, y, p, opts = {}) {
  txt(ctx, s, x, y + (1 - eo(p)) * 24, { ...opts, a: eo(p) * (opts.a ?? 1) });
}

// Rounded panel: glass fill plus a thin cyan edge.
function panel(ctx, x, y, w, h, { r = 28, fill = 'rgba(21,31,48,0.82)', stroke = 'rgba(54,197,240,0.42)', lw = 2, glow = 0 } = {}) {
  ctx.save();
  if (glow) { ctx.shadowColor = 'rgba(54,197,240,0.35)'; ctx.shadowBlur = glow; }
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

// Pill-shaped label (used for badges such as THEORETICAL ESTIMATE).
function pill(ctx, s, cx, y, color, { font = '26px MonoM', padX = 26, h = 56 } = {}) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(s).width + padX * 2;
  rr(ctx, cx - w / 2, y - h / 2 - 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(11,17,32,0.85)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, cx, y);
  ctx.restore();
  return w;
}

// Background shared by every scene: gradient, soft glow, faint drifting dot grid, and a vignette.
// `tint` is the glow colour (cyan by default; amber for the warning sections).
export function background(ctx, t, { tint = COL.cyan, glowX = CX, glowY = 700, glowA = 0.16, glowR = 980, base = true } = {}) {
  ctx.save();
  if (base) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0A0F1B');
    g.addColorStop(0.55, COL.navy);
    g.addColorStop(1, '#0B1120');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const rg = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
  rg.addColorStop(0, hexA(tint, glowA));
  rg.addColorStop(1, hexA(tint, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  if (base) {
    // Dot grid that drifts slowly upward.
    const step = 72, off = (t * 6) % step;
    ctx.fillStyle = 'rgba(232,237,245,0.05)';
    for (let y = -step + off; y < H + step; y += step) {
      for (let x = 0; x < W + step; x += step) ctx.fillRect(x, y, 2, 2);
    }

    // Vignette to keep the edges dark.
    const vg = ctx.createRadialGradient(CX, 960, 380, CX, 960, 1100);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// Turns '#RRGGBB' plus an alpha into an rgba() string.
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Mathematical particles: small symbols that drift slowly, so the background feels like a number field.
const SYMBOLS = ['π', '∑', 'N', 'p', 'q', 'λ', 'e', '×', '=', '1', '0', '+', '∫', 'mod'];
const PARTICLES = (() => {
  const r = mulberry(42);
  return Array.from({ length: 46 }, (_, i) => ({
    x: r(), y: r(), s: 16 + r() * 22, sym: SYMBOLS[i % SYMBOLS.length],
    ph: r() * Math.PI * 2, sp: 0.02 + r() * 0.04, a: 0.12 + r() * 0.22,
    cyan: r() > 0.3,
  }));
})();
function particles(ctx, t, k = 1) {
  ctx.save();
  for (const p of PARTICLES) {
    const x = ((p.x + Math.sin(t * p.sp + p.ph) * 0.02) % 1 + 1) % 1 * W;
    const y = ((p.y - t * p.sp * 0.6) % 1 + 1) % 1 * H;
    ctx.globalAlpha = p.a * k * ctx.globalAlpha;
    ctx.font = `${p.s}px MonoR`;
    ctx.fillStyle = p.cyan ? COL.cyan : COL.white;
    ctx.textAlign = 'center';
    ctx.fillText(p.sym, x, y);
  }
  ctx.restore();
}

// ---------- the lock (scenes 1, 2, 7, 8) ----------
// Local coordinates: origin at the centre of the lock body, about 400 px wide, 330 px tall.
export function drawLock(ctx, { cx, cy, s = 1, alpha = 1, cracked = 0, crackSeed = 7, glow = COL.cyan, glowA = 0.6, inscription = 'RSA-1024' }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha * ctx.globalAlpha;

  // Shackle (the curved top part). It goes behind the body.
  ctx.lineWidth = 46;
  ctx.lineCap = 'round';
  const sg = ctx.createLinearGradient(-140, -170, 140, -20);
  sg.addColorStop(0, '#E6ECF5');
  sg.addColorStop(0.5, '#8794AA');
  sg.addColorStop(1, '#3A4659');
  ctx.strokeStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -20, 128, Math.PI, 2 * Math.PI);
  ctx.stroke();

  // Body: metal gradient, dark edge, inner bevel highlight.
  ctx.save();
  if (glow) { ctx.shadowColor = hexA(glow, glowA); ctx.shadowBlur = 60; }
  rr(ctx, -200, -20, 400, 330, 46);
  const bg = ctx.createLinearGradient(-200, -20, 200, 310);
  bg.addColorStop(0, '#DCE4EF');
  bg.addColorStop(0.45, '#7D8CA3');
  bg.addColorStop(1, '#27313F');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  rr(ctx, -200, -20, 400, 330, 46);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(5,8,14,0.9)';
  ctx.stroke();
  rr(ctx, -190, -10, 380, 310, 38);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  ctx.stroke();

  // Keyhole.
  ctx.fillStyle = COL.deep;
  ctx.beginPath(); ctx.arc(0, 110, 30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-17, 128); ctx.lineTo(17, 128); ctx.lineTo(26, 206); ctx.lineTo(-26, 206); ctx.closePath(); ctx.fill();

  // Engraved inscription under the keyhole.
  if (inscription) {
    ctx.font = '46px InterXB';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText(inscription, 1, 269);
    ctx.fillStyle = '#1B2433';
    ctx.fillText(inscription, 0, 268);
  }

  // Hairline crack, revealed from the top down.
  if (cracked > 0) {
    const r = mulberry(crackSeed);
    const pts = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push({ x: lerp(-40, 70, u) + (r() - 0.5) * 26, y: lerp(-20, 300, u) + (r() - 0.5) * 16 });
    }
    const upto = Math.max(1, Math.floor(cracked * n));
    ctx.save();
    ctx.shadowColor = 'rgba(243,166,74,0.9)';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = COL.amber;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= upto; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    // Two short branches off the main crack.
    ctx.lineWidth = 2;
    for (const b of [8, 17]) {
      if (upto < b) continue;
      const p = pts[b];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 46 + r() * 20, p.y + 30 + r() * 18);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ---------- scene 1: hook ----------
export function scene1(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { glowA: 0.10 });
  particles(ctx, lt, 0.7);
  const appear = eo(win(lt, 0, 1.2));
  ctx.globalAlpha = a;
  rise(ctx, 'AI VS RSA-1024', CX, 380, win(lt, 0.3, 0.9), { font: '104px InterK', color: COL.white });
  // Camera push: slow scale-in on the lock.
  const s = 0.94 + 0.12 * ei(win(lt, 0, 5));
  drawLock(ctx, { cx: CX, cy: 960 + (1 - appear) * 40, s, alpha: appear, cracked: ei(win(lt, 3.0, 1.5)), glowA: 0.5 });
  // Scan beam sweeps down the lock.
  const sp = win(lt, 0.8, 1.8);
  if (sp > 0 && sp < 1) {
    const y = lerp(760, 1230, ei(sp));
    ctx.save();
    ctx.globalAlpha = a * (1 - win(lt, 2.4, 0.6));
    const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
    g.addColorStop(0, 'rgba(54,197,240,0)');
    g.addColorStop(0.5, 'rgba(54,197,240,0.85)');
    g.addColorStop(1, 'rgba(54,197,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(170, y - 40, 740, 80);
    ctx.restore();
  }
  ctx.globalAlpha = a;
}

// ---------- scene 2: announcement ----------
export function scene2(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { glowY: 760, glowA: 0.13 });
  particles(ctx, lt, 0.5);
  ctx.globalAlpha = a;
  // Lock fades out and shrinks as the research environment takes over.
  const out = 1 - eo(win(lt, 0, 1.2));
  if (out > 0) drawLock(ctx, { cx: CX, cy: 980, s: 0.6 + 0.2 * out, alpha: out, cracked: 1, glowA: 0.2 });
  ctx.globalAlpha = a;
  rise(ctx, 'NOV 06, 2026', CX, 390, win(lt, 0.7, 0.6), { font: '34px MonoM', color: COL.cyan });
  rise(ctx, 'GOOGLE DEEPMIND', CX, 462, win(lt, 0.9, 0.7), { font: '66px InterK', color: COL.white });
  rise(ctx, 'TWO RESEARCH ADVANCES', CX, 524, win(lt, 1.1, 0.6), { font: '30px MonoM', color: COL.amber });

  // Panel A slides in from the left, panel B from the right. Then they split apart.
  const inA = eo(win(lt, 1.6, 1.0)), inB = eo(win(lt, 1.8, 1.0));
  const split = ei(win(lt, 3.6, 1.4));
  const ax = 108 + (1 - inA) * -420 - split * 30, ay = 720 - split * 70;
  const bx = 108 + (1 - inB) * 420 + split * 30, by = 1060 + split * 60;
  // Connector: a line from the middle of the top panel's bottom edge to the bottom panel.
  if (inB > 0) {
    ctx.save();
    ctx.globalAlpha = a * inB * (1 - split * 0.6);
    ctx.strokeStyle = 'rgba(54,197,240,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(CX, 880); ctx.lineTo(CX, 1000); ctx.stroke();
    ctx.restore();
  }
  drawResearchPanel(ctx, ax, ay, inA * a, 'RSA SIGNATURE FORGERY', 'Modular Roots from a Restricted Oracle', 'PAPER 1 · WORKING PAPER', COL.cyan);
  drawResearchPanel(ctx, bx, by, inB * a, 'BATCH FACTORIZATION', 'Fan Factories: multiple number fields', 'PAPER 2 · WORKING PAPER', COL.amber);
  ctx.globalAlpha = a;
}

function drawResearchPanel(ctx, x, y, alpha, title, sub, tag, accent) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  panel(ctx, x, y, 864, 220, { glow: 30 });
  ctx.fillStyle = accent;
  rr(ctx, x, y + 28, 8, 164, 4);
  ctx.fill();
  txt(ctx, title, x + 44, y + 92, { font: '48px InterK', color: COL.white, align: 'left' });
  txt(ctx, sub, x + 44, y + 140, { font: '28px MonoR', color: COL.grey, align: 'left' });
  txt(ctx, tag, x + 44, y + 186, { font: '24px MonoM', color: accent, align: 'left' });
  ctx.restore();
}

// ---------- scene 3: the signature problem ----------
export function scene3(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { glowY: 820, glowA: 0.12 });
  particles(ctx, lt, 0.35);
  ctx.globalAlpha = a;

  // Phase 1 (0–2.6 s): RSA public modulus, N = p × q, as a quick explainer.
  const eqA = 1 - ei(win(lt, 2.2, 0.5));
  if (eqA > 0.001) {
    ctx.save();
    ctx.globalAlpha = a * eqA;
    rise(ctx, 'RSA PUBLIC MODULUS', CX, 620, win(lt, 0.1, 0.6), { font: '32px MonoM', color: COL.grey });
    const p1 = eo(win(lt, 0.3, 0.6)), p2 = eo(win(lt, 0.6, 0.6)), p3 = eo(win(lt, 1.0, 0.6));
    txt(ctx, 'p', 230, 790 + (1 - p1) * 20, { font: '150px InterK', color: COL.cyan, a: p1 });
    txt(ctx, '×', 400, 790, { font: '120px InterK', color: COL.white, a: p2 });
    txt(ctx, 'q', 560, 790 + (1 - p2) * 20, { font: '150px InterK', color: COL.cyan, a: p2 });
    txt(ctx, '=', 690, 790, { font: '120px InterK', color: COL.white, a: p3 });
    txt(ctx, 'N', 840, 790 + (1 - p3) * 20, { font: '150px InterK', color: COL.amber, a: p3, glow: 30, glowColor: COL.amber });
    txt(ctx, 'PRIME 1', 230, 850, { font: '24px MonoR', color: COL.grey, a: p1 });
    txt(ctx, 'PRIME 2', 560, 850, { font: '24px MonoR', color: COL.grey, a: p2 });
    txt(ctx, 'PUBLIC', 840, 850, { font: '24px MonoR', color: COL.grey, a: p3 });
    txt(ctx, 'factoring N reveals p and q', CX, 920, { font: '30px MonoR', color: COL.white, a: p3 * 0.8 });
    ctx.restore();
  }
  ctx.globalAlpha = a;

  // Phase 2 (2.8 s onward): message → padding → signing → signature, shown as four chips.
  const chips = ['MESSAGE', 'PADDING', 'RSA SIGNING', 'DIGITAL SIGNATURE'];
  const chipW = 190, gapX = 36, y0 = 500;
  chips.forEach((c, i) => {
    const x = 108 + i * (chipW + gapX);
    const p = eo(win(lt, 2.8 + i * 0.35, 0.45));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = a * p;
    panel(ctx, x, y0, chipW, 120, { r: 22, glow: 0 });
    const parts = c.split(' ');
    parts.forEach((w, k) => txt(ctx, w, x + chipW / 2, y0 + 56 + k * 34 - (parts.length - 1) * 17, { font: '26px MonoM', color: i === 1 ? COL.amber : COL.white }));
    if (i < chips.length - 1) {
      ctx.strokeStyle = 'rgba(54,197,240,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + chipW + 6, y0 + 60); ctx.lineTo(x + chipW + gapX - 8, y0 + 60);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.globalAlpha = a;

  // The 128-byte block. The caller-controlled part on the right grows across the half-block line.
  // The block is hidden until the equation has faded (3.4 s), so the two never overlap.
  ctx.globalAlpha = a * eo(win(lt, 3.4, 0.6));
  const bx = 108, bw = 864, by = 880, bh = 84;
  const frac = lerp(0.2, 0.62, ei(win(lt, 4.0, 5.2)));
  rise(ctx, '128 BYTES · 1024-BIT SIGNED BLOCK', CX, 840, win(lt, 3.6, 0.6), { font: '26px MonoM', color: COL.grey });
  // Fixed padding (left, hatched).
  ctx.save();
  ctx.beginPath(); rr(ctx, bx, by, bw, bh, 14); ctx.clip();
  ctx.fillStyle = 'rgba(120,135,160,0.28)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(120,135,160,0.35)';
  ctx.lineWidth = 2;
  for (let x = bx - bh; x < bx + bw; x += 22) { ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x + bh, by); ctx.stroke(); }
  ctx.restore();
  // Caller-controlled part (right).
  const cw = bw * frac, cx0 = bx + bw - cw;
  ctx.save();
  ctx.beginPath(); rr(ctx, cx0, by, cw, bh, 14); ctx.clip();
  ctx.fillStyle = 'rgba(54,197,240,0.82)';
  ctx.fillRect(cx0, by, cw, bh);
  ctx.restore();
  txt(ctx, 'FIXED PADDING', bx + 24, by + bh / 2 + 9, { font: '26px MonoM', color: COL.white, align: 'left', a: 0.9 });
  if (cw > 260) txt(ctx, 'CALLER-CONTROLLED', cx0 + cw / 2, by + bh / 2 + 9, { font: '26px MonoM', color: COL.deep });
  // The half-block threshold.
  const tx = bx + bw / 2;
  const over = frac >= 0.5;
  const pulse = 0.5 + 0.5 * Math.sin(lt * 5);
  ctx.save();
  ctx.strokeStyle = over ? COL.amber : 'rgba(243,166,74,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.shadowColor = COL.amber;
  ctx.shadowBlur = over ? 18 + pulse * 14 : 0;
  ctx.beginPath(); ctx.moveTo(tx, by - 26); ctx.lineTo(tx, by + bh + 26); ctx.stroke();
  ctx.restore();
  txt(ctx, '½ BLOCK', tx, by + bh + 58, { font: '26px MonoM', color: COL.amber });

  // Warning card, shown once the attacker-controlled part passes half the block.
  ctx.globalAlpha = a;
  const warn = eo(win(lt, 7.6, 0.8));
  if (warn > 0) {
    ctx.save();
    ctx.globalAlpha = a * warn;
    panel(ctx, 108, 1040, 864, 160, { r: 24, stroke: COL.amber, fill: 'rgba(40,30,18,0.82)' });
    txt(ctx, 'MORE THAN HALF ATTACKER-CONTROLLED', CX, 1098, { font: '32px InterB', color: COL.amber });
    txt(ctx, 'PADDING ADDS NO EXTRA PROTECTION', CX, 1148, { font: '32px InterB', color: COL.white });
    ctx.restore();
  }
  ctx.globalAlpha = a;

  // Scope note: a specific signing interface, not all RSA.
  rise(ctx, 'A SPECIFIC SIGNING INTERFACE · NOT ALL RSA OPERATIONS', CX, 1250, win(lt, 9.0, 0.8), { font: '26px MonoM', color: COL.grey });
  ctx.globalAlpha = a;
}

// ---------- scene 4: the 1,600x estimate ----------
export function scene4(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { tint: COL.amber, glowY: 700, glowA: 0.12 });
  ctx.globalAlpha = a;
  rise(ctx, "DEEPMIND'S THEORETICAL ESTIMATE", CX, 380, win(lt, 0.2, 0.7), { font: '34px MonoM', color: COL.amber });

  // Big number: pops in at the reveal (2.2 s) and settles.
  const rv = win(lt, 2.2, 0.9);
  const sc = 1.25 - 0.25 * eo(rv);
  const ap = eo(win(lt, 2.2, 0.35));
  ctx.save();
  ctx.translate(CX, 700);
  ctx.scale(sc, sc);
  txt(ctx, '1,600×', 0, 0, { font: '260px InterK', color: COL.cyan, a: ap, glow: 60 });
  ctx.restore();

  // Shock ring after the impact: fades and does not flash.
  const ring = win(lt, 2.2, 1.4);
  if (ring > 0 && ring < 1) {
    ctx.save();
    ctx.globalAlpha = a * (1 - ring) * 0.5;
    ctx.strokeStyle = COL.cyan;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(CX, 640, 120 + ring * 620, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = a;

  // Illustrative curves on a log-style axis. The gap at the right end stands for the 1,600× estimate.
  const x0 = 130, x1 = 950, base = 1080;
  const grow = ei(win(lt, 3.0, 2.2));
  const prev = (u) => base - 140 * Math.pow(u, 0.7);
  const next = (u) => prev(u) + 140 * Math.pow(u, 0.7);
  panel(ctx, 108, 850, 864, 300, { r: 24 });
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const u = (i / 80) * grow;
    const x = lerp(x0, x1, i / 80), y = prev(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COL.grey; ctx.lineWidth = 5; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 80; i++) {
    const u = (i / 80) * grow;
    const x = lerp(x0, x1, i / 80), y = next(u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = COL.cyan; ctx.lineWidth = 5; ctx.shadowColor = COL.cyan; ctx.shadowBlur = 16; ctx.stroke();
  ctx.restore();
  txt(ctx, 'PREVIOUS ESTIMATE', 140, 900, { font: '24px MonoM', color: COL.grey, align: 'left' });
  txt(ctx, 'NEW THEORETICAL ESTIMATE', 940, 900, { font: '24px MonoM', color: COL.cyan, align: 'right' });
  txt(ctx, 'ILLUSTRATIVE · LOG SCALE · NOT MEASURED DATA', CX, 1128, { font: '22px MonoR', color: COL.mute });

  // Badges and the key qualifier.
  const bAp = eo(win(lt, 4.2, 0.6));
  ctx.save();
  ctx.globalAlpha = a * bAp;
  pill(ctx, 'THEORETICAL ESTIMATE', 300, 1200, COL.amber);
  pill(ctx, '32-BYTE DIGEST', 720, 1200, COL.cyan);
  txt(ctx, 'NOT EXPERIMENTALLY RUN AT THIS KEY SIZE', CX, 1268, { font: '28px InterB', color: COL.amber });
  ctx.restore();
  ctx.globalAlpha = a;
}

// ---------- scene 5: fan factories ----------
export function scene5(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { glowY: 700, glowA: 0.13 });
  ctx.globalAlpha = a;
  rise(ctx, 'FAN FACTORIES', CX, 370, win(lt, 0.1, 0.7), { font: '88px InterK', color: COL.cyan, glow: 24 });

  // Shared precomputation node at the top.
  const pIn = eo(win(lt, 0.4, 0.8));
  ctx.save();
  ctx.globalAlpha = a * pIn;
  panel(ctx, 230, 470, 620, 130, { r: 26, glow: 26 });
  txt(ctx, 'SHARED PRECOMPUTATION', CX, 528, { font: '28px MonoM', color: COL.grey });
  txt(ctx, '≈ ONE FACTORIZATION', CX, 578, { font: '34px InterB', color: COL.white });
  ctx.restore();
  ctx.globalAlpha = a;

  // Six target moduli along the bottom of the branching structure.
  const tw = 128, th = 120, ty = 800;
  const gap = (864 - 6 * tw) / 5;
  const tgt = [];
  for (let i = 0; i < 6; i++) tgt.push({ x: 108 + i * (tw + gap), y: ty });
  const src = { x: CX, y: 600 };
  tgt.forEach((tg, i) => {
    const edge = eo(win(lt, 2.2 + i * 0.12, 0.9));
    if (edge > 0) {
      // Bezier from the precomputation node to the target's top centre.
      const ex = tg.x + tw / 2, ey = tg.y;
      const c1x = src.x, c1y = (src.y + ey) / 2;
      ctx.save();
      ctx.globalAlpha = a * edge;
      ctx.strokeStyle = 'rgba(54,197,240,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(src.x, src.y + 66);
      ctx.bezierCurveTo(c1x, c1y, ex, (src.y + ey) / 2, ex, ey);
      ctx.stroke();
      // Light pulses travelling down the edge.
      const pulse = (lt * 0.55 + i * 0.17) % 1;
      const u = pulse, v = 1 - u;
      const px = v * v * v * src.x + 3 * v * v * u * c1x + 3 * v * u * u * ex + u * u * u * ex;
      const py = v * v * v * (src.y + 66) + 3 * v * v * u * c1y + 3 * v * u * u * (src.y + 66 + (ey - src.y - 66) * 0.5) + u * u * u * ey;
      ctx.fillStyle = COL.cyan;
      ctx.shadowColor = COL.cyan; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const tin = eo(win(lt, 1.5 + i * 0.22, 0.5));
    if (tin > 0) {
      ctx.save();
      ctx.globalAlpha = a * tin;
      panel(ctx, tg.x, tg.y, tw, th, { r: 18 });
      txt(ctx, `N${'₁₂₃₄₅₆'[i]}`, tg.x + tw / 2, tg.y + 62, { font: '40px InterK', color: COL.white });
      txt(ctx, '1024-BIT', tg.x + tw / 2, tg.y + 98, { font: '18px MonoR', color: COL.grey });
      ctx.restore();
    }
    // Fan of number fields: three rays from each target.
    const fan = eo(win(lt, 5.0 + i * 0.1, 0.8));
    if (fan > 0) {
      ctx.save();
      ctx.globalAlpha = a * fan;
      ctx.strokeStyle = 'rgba(243,166,74,0.7)';
      ctx.lineWidth = 2.5;
      for (const d of [-34, 0, 34]) {
        ctx.beginPath();
        ctx.moveTo(tg.x + tw / 2, tg.y + th);
        ctx.lineTo(tg.x + tw / 2 + d, tg.y + th + 40 * fan);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
  ctx.globalAlpha = a;

  // The headline number and its qualifiers.
  const big = eo(win(lt, 6.4, 0.8));
  ctx.save();
  ctx.translate(CX, 1110);
  const s = 1 + 0.1 * (1 - big);
  ctx.scale(s, s);
  txt(ctx, '≈30×', 0, 0, { font: '210px InterK', color: COL.amber, a: big, glow: 40, glowColor: COL.amber });
  ctx.restore();
  ctx.globalAlpha = a;
  rise(ctx, 'LOWER ESTIMATED COST PER ADDITIONAL TARGET', CX, 1185, win(lt, 7.2, 0.7), { font: '30px InterB', color: COL.white });
  rise(ctx, 'AFTER SHARED PRECOMPUTATION', CX, 1232, win(lt, 7.5, 0.6), { font: '26px MonoM', color: COL.grey });
  rise(ctx, 'THEORETICAL · NOT IMPLEMENTED', CX, 1280, win(lt, 7.8, 0.6), { font: '28px MonoM', color: COL.amber });
  ctx.globalAlpha = a;
}

// ---------- scene 6: the real computation ----------
export function scene6(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { glowY: 540, glowA: 0.13 });
  ctx.globalAlpha = a;
  rise(ctx, 'WHAT ACTUALLY RAN', CX, 340, win(lt, 0.1, 0.6), { font: '34px MonoM', color: COL.cyan });

  // Grid of compute nodes, lit in waves.
  const cols = 16, rows = 6, sx = 54, sy = 36, ox = 108 + 27, oy = 420;
  const r = mulberry(99);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const delay = 0.4 + (col + row * 0.6) * 0.05 + r() * 0.5;
      const on = eo(win(lt, delay, 0.25));
      const x = ox + col * sx, y = oy + row * sy;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = on > 0 ? `rgba(54,197,240,${0.25 + 0.7 * on})` : 'rgba(127,139,163,0.35)';
      ctx.fill();
    }
  }
  ctx.globalAlpha = a;

  // Comparison bars, with the full bar as 1,380 and the new bar scaled to 391.
  const full = 864, newW = full * (391 / 1380);
  const b1 = eo(win(lt, 1.8, 1.2)), b2 = eo(win(lt, 3.0, 1.0));
  rise(ctx, 'PREVIOUS CPU WORK', 108, 640, win(lt, 1.5, 0.5), { font: '26px MonoM', color: COL.grey, align: 'left' });
  txt(ctx, '1,380 CORE-YEARS', 972, 640, { font: '26px MonoM', color: COL.amber, align: 'right', a: b1 });
  ctx.fillStyle = 'rgba(243,166,74,0.45)';
  rr(ctx, 108, 660, full * b1, 40, 10); ctx.fill();

  rise(ctx, 'NEW CPU WORK', 108, 740, win(lt, 2.8, 0.5), { font: '26px MonoM', color: COL.grey, align: 'left' });
  txt(ctx, '391 CORE-YEARS', 972, 740, { font: '26px MonoM', color: COL.cyan, align: 'right', a: b2 });
  ctx.save();
  ctx.shadowColor = COL.cyan; ctx.shadowBlur = 22;
  ctx.fillStyle = COL.cyan;
  rr(ctx, 108, 760, newW * b2, 40, 10); ctx.fill();
  ctx.restore();

  // Headline: 3.5x less CPU work.
  const hp = eo(win(lt, 4.2, 0.9));
  ctx.save();
  ctx.translate(CX, 960);
  const s = 1 + 0.08 * (1 - hp);
  ctx.scale(s, s);
  txt(ctx, '3.5×', 0, 0, { font: '170px InterK', color: COL.cyan, a: hp, glow: 30 });
  txt(ctx, 'LESS CPU WORK', 0, 60, { font: '52px InterB', color: COL.white, a: hp });
  ctx.restore();
  ctx.globalAlpha = a;

  // Supporting facts, revealed one after another.
  const facts = [
    'UP TO 300,000 CPU CORES · 16 GPUs',
    '336 DISTRIBUTED EXPERIMENTS · 33,500 LINES OF NEW CODE',
    '3.2 DAYS OF FULL-SCALE EXECUTION (CALENDAR TIME)',
  ];
  facts.forEach((f, i) => rise(ctx, f, CX, 1080 + i * 36, win(lt, 5.4 + i * 0.5, 0.6), { font: '26px MonoM', color: COL.white }));
  rise(ctx, 'MEASURED REPRODUCTION · NOT THE 1,600× RESULT', CX, 1200, win(lt, 7.2, 0.6), { font: '22px MonoM', color: COL.amber });
  // Required on-screen caveat: the 1,380 figure was reported on other hardware.
  rise(ctx, 'COMPARISON USES COSTS REPORTED ON OTHER HARDWARE', CX, 1244, win(lt, 7.5, 0.6), { font: '22px MonoM', color: COL.grey });
  rise(ctx, 'PAPER: AT MOST ~1.5× (SIEVE) AND ~1.2× (2ND TIER) FROM HARDWARE', CX, 1274, win(lt, 7.7, 0.6), { font: '22px MonoM', color: COL.grey });
  ctx.globalAlpha = a;
}

// ---------- scene 7: the reality check ----------
export function scene7(ctx, lt, a) {
  // Alpha first, so the cross-fade from scene 6 mixes correctly.
  ctx.globalAlpha = a;
  // Background moves from amber (left, legacy) to cyan (right, modern).
  const w = ei(win(lt, 0.2, 2.0));
  background(ctx, lt, { tint: COL.amber, glowX: 270, glowY: 760, glowA: 0.14 * (1 - w), glowR: 720 });
  background(ctx, lt, { tint: COL.cyan, glowX: 810, glowY: 760, glowA: 0.16 * w, glowR: 720, base: false });
  ctx.globalAlpha = a;
  rise(ctx, 'RSA-1024 ≠ RSA-2048+', CX, 370, win(lt, 0.1, 0.7), { font: '80px InterK', color: COL.white });
  rise(ctx, 'THESE SPECIFIC FINDINGS DO NOT THREATEN MODERN RSA', CX, 430, win(lt, 0.4, 0.7), { font: '24px MonoM', color: COL.grey });

  // Legacy lock: cracked. Modern lock: intact, with a cool rim.
  const lp = eo(win(lt, 0.5, 1.0)), mp = eo(win(lt, 0.8, 1.0));
  drawLock(ctx, { cx: 270, cy: 700, s: 0.56, alpha: lp, cracked: 1, crackSeed: 11, glow: COL.amber, glowA: 0.35, inscription: '1024' });
  drawLock(ctx, { cx: 810, cy: 700, s: 0.56, alpha: mp, cracked: 0, glow: COL.cyan, glowA: 0.55, inscription: '2048+' });
  ctx.globalAlpha = a;
  rise(ctx, 'RSA-1024:', 270, 945, win(lt, 1.6, 0.6), { font: '36px InterK', color: COL.amber });
  rise(ctx, 'LEGACY TARGET', 270, 990, win(lt, 1.7, 0.6), { font: '28px MonoM', color: COL.amber });
  rise(ctx, 'RSA-2048+:', 810, 945, win(lt, 2.0, 0.6), { font: '36px InterK', color: COL.cyan });
  rise(ctx, 'NOT THREATENED BY', 810, 990, win(lt, 2.1, 0.6), { font: '26px MonoM', color: COL.cyan });
  rise(ctx, 'THESE RESULTS', 810, 1026, win(lt, 2.2, 0.6), { font: '26px MonoM', color: COL.cyan });

  rise(ctx, 'NIST NO LONGER APPROVES 1024-BIT RSA', CX, 1200, win(lt, 3.6, 0.7), { font: '24px MonoM', color: COL.grey });
  rise(ctx, 'FOR GENERATING SIGNATURES (SP 800-131A REV. 2)', CX, 1236, win(lt, 3.8, 0.7), { font: '24px MonoM', color: COL.grey });
  ctx.globalAlpha = a;
}

// ---------- scene 8: the closing ----------
export function scene8(ctx, lt, a) {
  ctx.globalAlpha = a;
  background(ctx, lt, { tint: COL.cyan, glowY: 740, glowA: 0.14 * (1 - win(lt, 0, 2.5)) + 0.04 });
  ctx.globalAlpha = a;
  // The modern lock stays in view. The rest of the scene darkens around it.
  drawLock(ctx, { cx: CX, cy: 720, s: 0.9, alpha: 1, cracked: 0, glow: COL.cyan, glowA: 0.6, inscription: 'RSA-2048+' });
  // A single light beam crosses the frame once.
  const bp = win(lt, 0.5, 2.6);
  if (bp > 0 && bp < 1) {
    ctx.save();
    ctx.globalAlpha = a * Math.sin(bp * Math.PI) * 0.5;
    const x = lerp(-400, 1480, bp);
    const g = ctx.createLinearGradient(x - 200, 0, x + 200, 0);
    g.addColorStop(0, 'rgba(54,197,240,0)');
    g.addColorStop(0.5, 'rgba(54,197,240,0.55)');
    g.addColorStop(1, 'rgba(54,197,240,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, 960);
    ctx.rotate(-0.5);
    ctx.fillRect(-200, -900, 400, 1800);
    ctx.restore();
    ctx.restore();
  }
  ctx.globalAlpha = a;
  rise(ctx, 'THE FUTURE OF', CX, 1090, win(lt, 1.2, 0.9), { font: '84px InterK', color: COL.white });
  rise(ctx, 'CYBERSECURITY', CX, 1180, win(lt, 1.5, 0.9), { font: '84px InterK', color: COL.cyan });
  rise(ctx, 'IS CHANGING.', CX, 1270, win(lt, 1.8, 0.9), { font: '84px InterK', color: COL.white });
  ctx.globalAlpha = a;
}

export const SCENE_FNS = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8];

// ---------- captions (burned in, two lines at most) ----------
// `caption` comes from out/timing.json: { start, end, lines: [[{text, highlight}, ...], ...] }.
export function drawCaption(ctx, caption, t) {
  const k = cl(Math.min(t - caption.start, caption.end - t) / 0.08); // quick fade in and out
  ctx.save();
  ctx.font = '54px InterXB';
  const lineH = 72;
  const lines = caption.lines;
  const widths = lines.map((ln) => ln.reduce((w, tok, i) => w + ctx.measureText(tok.text + (i < ln.length - 1 ? ' ' : '')).width, 0));
  const maxW = Math.max(...widths);
  const boxW = Math.min(864, maxW + 64);
  const boxH = lines.length * lineH + 30;
  const cx = CX, cy = 1430;
  ctx.globalAlpha = k;
  rr(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, 22);
  ctx.fillStyle = 'rgba(11,17,32,0.74)';
  ctx.fill();
  lines.forEach((ln, li) => {
    let x = cx - widths[li] / 2;
    const y = cy - ((lines.length - 1) * lineH) / 2 + li * lineH + 18;
    ln.forEach((tok, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = tok.highlight ? COL.cyan : COL.white;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(tok.text, x, y);
      x += ctx.measureText(tok.text + (i < ln.length - 1 ? ' ' : '')).width;
    });
  });
  ctx.restore();
}
