// Scene drawing for the 60-second RSA film. Kinetic motion-design version.
//
// This module is shared by two front-ends:
//   - render/render.mjs draws frames with @napi-rs/canvas for the ffmpeg pipeline.
//   - remotion/ draws the same frames in the Remotion editor, using the browser canvas.
// It must not import anything Node-only. Fonts are registered by each front-end (see render/fonts.mjs
// and remotion/src/fonts.ts). The font family names used here are: InterK, InterXB, InterB, MonoM, MonoR.
//
// Design direction (from motion-design research on vertical short-form video, 2026):
//   - Bold scale contrast: key words are very large; supporting words are small.
//   - Kinetic type: words slam in with overshoot, shake on impact, and wipe in highlight markers.
//   - "Fight" theme: the title is a versus. Scenes use clashes, shockwaves, speed lines and flashes.
//   - Bright, not dark: royal-blue gradients with a sunburst and halftone texture, white type,
//     cyan and amber accents. Navy is used for shadows and caption boxes only.
//
// Every scene is a function (ctx, lt, alpha). `lt` is the time since the scene started, in seconds.
// Scenes are joined by hard cuts with a flash (see film/frame.mjs), so lt is >= 0 in normal use. The exported SCENE_FNS wrap each scene in save/restore,
// so a scene can translate or scale freely without affecting the next one.

// Palette. Brand hues from the brief, lifted in lightness so the film reads bright on a phone.
export const COL = {
  royal: '#2F6FD0',   // main background, top
  deep: '#0C2A66',    // main background, bottom
  navy: '#0B1F45',    // ink for text on light blocks, caption boxes, shadows
  cyan: '#36C5F0',
  amber: '#F3A64A',
  red: '#FF5A4E',     // impact accent, used sparingly
  white: '#F5F8FF',
  mist: '#D6E4FA',
  grey: '#C9D6EE',
};
const W = 1080, H = 1920, CX = 540;

// ---------- small utilities ----------
export const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const eo = (x) => 1 - Math.pow(1 - cl(x), 3);            // ease-out cubic
const ei = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
// 0..1 progress of a window that starts at `a` and lasts `d` seconds.
export const win = (lt, a, d) => cl((lt - a) / d);
const lerp = (a, b, t) => a + (b - a) * t;
// Overshoot curve: rises past 1, then settles. This gives the slam its snap.
const back = (p) => { p = cl(p); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

// Seeded PRNG so particles, speed lines and glitches look the same on every render.
function mulberry(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Rounded-rectangle path, drawn by hand so it works on every canvas build.
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Returns the font with its pixel size reduced if the text would be wider than maxW.
function fitFont(ctx, s, font, maxW = 900) {
  const m = font.match(/(\d+)px/);
  if (!m) return font;
  ctx.font = font;
  const w = ctx.measureText(s).width;
  if (w <= maxW) return font;
  return font.replace(/\d+px/, `${Math.floor((Number(m[1]) * maxW) / w)}px`);
}

// Core text draw. Options: font, color, align, a (alpha), scale and rot (about x,y), shadow, stroke.
export function T(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.font = fitFont(ctx, s, o.font || '40px InterB', o.maxW || 900);
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = cl(o.a ?? 1) * ctx.globalAlpha;
  if (o.scale !== undefined || o.rot) {
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.scale !== undefined) ctx.scale(o.scale, o.scale);
    ctx.translate(-x, -y);
  }
  if (o.shadow !== false) {
    // Navy drop shadow keeps white type legible on the bright background.
    ctx.shadowColor = o.shadowColor || 'rgba(11,31,69,0.55)';
    ctx.shadowBlur = o.shadowBlur ?? 16;
    ctx.shadowOffsetY = o.shadowOffsetY ?? 6;
  }
  if (o.glow) { ctx.shadowColor = o.glowColor || COL.cyan; ctx.shadowBlur = o.glow; ctx.shadowOffsetY = 0; }
  if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || COL.navy; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = o.color || COL.white;
  ctx.fillText(s, x, y);
  ctx.restore();
}

// Slam: text rushes in from `from` times its size, overshoots, and settles. It also fades in fast.
export function slam(ctx, s, x, y, lt, t0, o = {}) {
  const p = win(lt, t0, o.dur ?? 0.38);
  if (p <= 0) return;
  const from = o.from ?? 2.0;
  const sc = lerp(from, 1, back(p));
  T(ctx, s, x, y, { ...o, scale: sc, a: cl(p * 4) * (o.a ?? 1) });
}

// Marker: a coloured block wipes in from the left, and the text is revealed inside it.
export function marker(ctx, s, x, y, lt, t0, o = {}) {
  const p = eo(win(lt, t0, o.dur ?? 0.45));
  if (p <= 0) return;
  const font = fitFont(ctx, s, o.font || '60px InterK', 900);
  const px = Number((font.match(/(\d+)px/) || [, 60])[1]);
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(s).width + 48;
  const h = px * 1.22;
  const left = x - w / 2, top = y - px * 0.86;
  // Coloured block wipes in from the left.
  ctx.fillStyle = o.color || COL.amber;
  ctx.shadowColor = 'rgba(11,31,69,0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillRect(left, top, w * p, h);
  ctx.restore();
  // Ink text, clipped to the same wipe, so it only appears where the block already is.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top - 4, w * p, h + 8);
  ctx.clip();
  T(ctx, s, x, y, { font, color: o.ink || COL.navy, shadow: false, maxW: 900 });
  ctx.restore();
}

// Screen shake. Each hit gives a decaying offset for 0.35 s.
export function shake(lt, hits) {
  let x = 0, y = 0;
  for (const h of hits) {
    const d = lt - h.t;
    if (d >= 0 && d < 0.35) {
      const k = (1 - d / 0.35) * h.amp;
      x += Math.sin(d * 90) * k;
      y += Math.cos(d * 73) * k * 0.6;
    }
  }
  return { x, y };
}

// Shockwave ring that expands from (x, y) and fades out.
export function shock(ctx, x, y, lt, t0, color = COL.white, maxR = 720, dur = 0.7) {
  const p = win(lt, t0, dur);
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha *= (1 - p);
  ctx.strokeStyle = color;
  ctx.lineWidth = 12 * (1 - p) + 2;
  ctx.beginPath();
  ctx.arc(x, y, maxR * eo(p), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Full-frame flash on impact. It peaks at `peak` and fades in `dur` seconds.
export function flash(ctx, lt, t0, color = '#FFFFFF', peak = 0.5, dur = 0.25) {
  const d = lt - t0;
  if (d < 0 || d > dur) return;
  ctx.save();
  ctx.globalAlpha *= peak * (1 - d / dur);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Speed lines: thin radial streaks that stretch outward from (cx, cy). p runs 0..1.
const SPEED = (() => {
  const r = mulberry(7);
  return Array.from({ length: 84 }, () => ({ a: r() * Math.PI * 2, r0: 120 + r() * 260, len: 260 + r() * 900, w: 2 + r() * 6 }));
})();
export function speedLines(ctx, cx, cy, p, alpha = 1, color = COL.white) {
  if (p <= 0 || p >= 1) return;
  ctx.save();
  ctx.globalAlpha *= alpha * (1 - p);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (const l of SPEED) {
    const r1 = l.r0 + l.len * eo(p);
    ctx.lineWidth = l.w;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(l.a) * l.r0, cy + Math.sin(l.a) * l.r0);
    ctx.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
    ctx.stroke();
  }
  ctx.restore();
}

// Glitch bars: short horizontal coloured slices that flicker for `dur` seconds after t0.
export function glitch(ctx, lt, t0, dur = 0.4, seed = 3) {
  const d = lt - t0;
  if (d < 0 || d > dur) return;
  const r = mulberry(seed + Math.floor(d * 30));
  ctx.save();
  for (let i = 0; i < 9; i++) {
    ctx.globalAlpha *= 0.55;
    ctx.fillStyle = r() > 0.5 ? COL.cyan : COL.red;
    ctx.fillRect(r() * 160 - 80, r() * H, W, 6 + r() * 34);
  }
  ctx.restore();
}

// ---------- backgrounds ----------
// Bright royal gradient, a rotating sunburst, halftone dots and a soft vignette.
// `tint` is the glow colour. `glowX` and `glowY` place the glow. `base: false` skips the base layers.
export function background(ctx, t, { tint = COL.cyan, glowX = CX, glowY = 760, glowA = 0.25, glowR = 980, base = true } = {}) {
  ctx.save();
  if (base) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.royal);
    g.addColorStop(0.55, '#1D57B5');
    g.addColorStop(1, COL.deep);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Sunburst: alternating wedges rotate slowly around the centre.
    const cx = CX, cy = 760, n = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let i = 0; i < n; i += 2) {
      const a0 = t * 0.07 + (i * Math.PI * 2) / n;
      const a1 = a0 + (Math.PI * 2) / n;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * 2400, cy + Math.sin(a0) * 2400);
      ctx.lineTo(cx + Math.cos(a1) * 2400, cy + Math.sin(a1) * 2400);
      ctx.closePath();
      ctx.fill();
    }

    // Halftone dots, drifting up slowly.
    const step = 60, off = (t * 8) % step;
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    for (let y = -step + off; y < H + step; y += step) {
      for (let x = 0; x < W + step; x += step) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Soft vignette, lighter than before so the edges still feel bright.
    const vg = ctx.createRadialGradient(CX, 960, 420, CX, 960, 1150);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(6,20,55,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
  const rg = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowR);
  rg.addColorStop(0, hexA(tint, glowA));
  rg.addColorStop(1, hexA(tint, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// '#RRGGBB' plus an alpha as an rgba() string.
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Panel: a solid card with a thin light edge, used for the research cards and the warning card.
function card(ctx, x, y, w, h, { fill = 'rgba(11,31,69,0.88)', stroke = 'rgba(255,255,255,0.35)', r = 26, lw = 3 } = {}) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(11,31,69,0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
}

// ---------- the lock (used in scenes 1, 7, 8 and in the thumbnail) ----------
// Local coordinates: origin at the centre of the body, about 400 px wide and 330 px tall.
export function drawLock(ctx, { cx, cy, s = 1, alpha = 1, cracked = 0, crackSeed = 7, glow = COL.cyan, glowA = 0.6, inscription = 'RSA-1024' }) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha * ctx.globalAlpha;

  // Shackle, drawn behind the body.
  ctx.lineWidth = 46;
  ctx.lineCap = 'round';
  const sg = ctx.createLinearGradient(-140, -170, 140, -20);
  sg.addColorStop(0, '#FFFFFF');
  sg.addColorStop(0.5, '#B8C6DD');
  sg.addColorStop(1, '#5D6F8F');
  ctx.strokeStyle = sg;
  ctx.beginPath();
  ctx.arc(0, -20, 128, Math.PI, 2 * Math.PI);
  ctx.stroke();

  // Body: bright metal gradient with a glow.
  ctx.save();
  if (glow) { ctx.shadowColor = hexA(glow, glowA); ctx.shadowBlur = 60; }
  rr(ctx, -200, -20, 400, 330, 46);
  const bg = ctx.createLinearGradient(-200, -20, 200, 310);
  bg.addColorStop(0, '#FFFFFF');
  bg.addColorStop(0.45, '#A9B9D3');
  bg.addColorStop(1, '#4A5D7E');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.restore();
  rr(ctx, -200, -20, 400, 330, 46);
  ctx.lineWidth = 6;
  ctx.strokeStyle = COL.navy;
  ctx.stroke();

  // Keyhole.
  ctx.fillStyle = COL.navy;
  ctx.beginPath(); ctx.arc(0, 110, 30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-17, 128); ctx.lineTo(17, 128); ctx.lineTo(26, 206); ctx.lineTo(-26, 206); ctx.closePath(); ctx.fill();

  // Inscription under the keyhole.
  if (inscription) {
    ctx.font = '46px InterXB';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(inscription, 1, 269);
    ctx.fillStyle = COL.navy;
    ctx.fillText(inscription, 0, 268);
  }

  // Crack: a jagged amber line that draws in from the top, with two branches.
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
    ctx.shadowColor = 'rgba(255,190,90,0.95)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = COL.amber;
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i <= upto; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.lineWidth = 3;
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

// ---------- scene 1: hook, "AI VS RSA-1024" ----------
function scene1(ctx, lt, a) {
  const sh = shake(lt, [{ t: 0.42, amp: 20 }, { t: 3.0, amp: 30 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 840, glowA: 0.3 });
  speedLines(ctx, CX, 840, win(lt, 0, 0.6), 0.9);

  // "AI" rushes in from the top, a versus in the upper third.
  slam(ctx, 'AI', CX, 560, lt, 0.05, { font: '340px InterK', color: COL.white, from: 2.6, dur: 0.4 });
  // "VS" sticker: an amber badge that slams in and tilts.
  marker(ctx, 'VS', CX, 700, lt, 0.5, { font: '84px InterK', color: COL.amber, ink: COL.navy, dur: 0.35 });

  // The lock arrives at 1.9 s, then the crack lands at 3.0 s with a flash and a shockwave.
  const lockA = cl((lt - 1.9) * 4);
  if (lockA > 0) {
    drawLock(ctx, { cx: CX, cy: 880, s: 0.78, alpha: lockA, cracked: ei(win(lt, 3.0, 1.2)), glowA: 0.7 });
  }
  shock(ctx, CX, 880, lt, 3.0, COL.amber, 620);
  glitch(ctx, lt, 3.0, 0.35, 11);
  flash(ctx, lt, 3.0, '#FFE2B0', 0.75, 0.3);

  // "RSA-1024" slams in at the bottom to complete the versus.
  slam(ctx, 'RSA-1024', CX, 1245, lt, 0.9, { font: '170px InterK', color: COL.white, from: 2.2, dur: 0.4, glow: 30, glowColor: COL.cyan });
  ctx.globalAlpha = a;
}

// ---------- scene 2: announcement, two research cards with icons ----------
// Revised for visual clarity: the paper titles were removed, and each card leads with an icon.
function scene2(ctx, lt, a) {
  const sh = shake(lt, [{ t: 0.05, amp: 10 }, { t: 2.4, amp: 14 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 700, glowA: 0.22 });

  // Date stamp, the headline, and the two research advances from the brief.
  marker(ctx, 'NOV 06, 2026', CX, 380, lt, 0.0, { font: '44px MonoM', color: COL.white, ink: COL.navy, dur: 0.3 });
  slam(ctx, 'GOOGLE', CX, 580, lt, 0.25, { font: '150px InterK', color: COL.white, from: 2.4 });
  slam(ctx, 'DEEPMIND', CX, 740, lt, 0.45, { font: '150px InterK', color: COL.cyan, from: 2.4 });
  marker(ctx, 'TWO RESEARCH ADVANCES', CX, 850, lt, 1.0, { font: '60px InterK', color: COL.amber });

  // Card A slides in from the left, card B from the right. Each card leads with an icon.
  const aP = back(win(lt, 2.4, 0.5)), bP = back(win(lt, 3.1, 0.5));
  const ax = lerp(-940, 108, aP), bx = lerp(1220, 108, bP);
  speedLines(ctx, CX, 1060, win(lt, 2.3, 0.8), 0.7);
  drawFightCard(ctx, ax, 960, 'RSA SIGNATURE FORGERY', 'PAPER 1', COL.cyan, cl(aP), 'seal');
  drawFightCard(ctx, bx, 1160, 'BATCH FACTORIZATION', 'PAPER 2', COL.amber, cl(bP), 'blocks');
  ctx.globalAlpha = a;
}

// A research card: a dark card, an accent edge, an icon on the left, the title and a short tag.
function drawFightCard(ctx, x, y, title, tag, accent, alpha, icon) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, x, y, 864, 160, { fill: 'rgba(11,31,69,0.9)', stroke: accent, lw: 4 });
  ctx.fillStyle = accent;
  rr(ctx, x, y, 14, 160, 6);
  ctx.fill();
  const ix = x + 104, iy = y + 80;
  if (icon === 'seal') {
    // A seal: a ring with a tick, for a signature.
    ctx.strokeStyle = accent; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(ix, iy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix - 22, iy + 2); ctx.lineTo(ix - 4, iy + 20); ctx.lineTo(ix + 26, iy - 18); ctx.stroke();
  } else {
    // Blocks: a 3x3 grid of small squares, for factoring many keys at once.
    ctx.fillStyle = accent;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      rr(ctx, ix - 44 + c * 32, iy - 44 + r * 32, 24, 24, 4); ctx.fill();
    }
  }
  T(ctx, title, x + 200, y + 84, { font: '46px InterK', color: COL.white, align: 'left', shadow: false, maxW: 620 });
  T(ctx, tag, x + 200, y + 126, { font: '24px MonoM', color: accent, align: 'left', shadow: false });
  ctx.restore();
}

// ---------- scene 3: the signature problem (block diagram) ----------
// Visual: a 128-byte block drawn as a grid. Fixed padding, caller-controlled bytes, and the 32-byte digest.
function scene3(ctx, lt, a) {
  const sh = shake(lt, [{ t: 8.3, amp: 16 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 860, glowA: 0.22, tint: COL.cyan });

  // Phase 1 (0–3.2 s): the public modulus N = p × q, then it whips away.
  const exitP = eo(win(lt, 3.2, 0.45));
  ctx.save();
  ctx.globalAlpha *= 1 - exitP;
  ctx.translate(0, -exitP * 260);
  slam(ctx, 'p', 220, 760, lt, 0.1, { font: '220px InterK', color: COL.white, from: 2.6 });
  slam(ctx, '×', 380, 760, lt, 0.3, { font: '140px InterK', color: COL.white, from: 2.4 });
  slam(ctx, 'q', 540, 760, lt, 0.5, { font: '220px InterK', color: COL.white, from: 2.6 });
  slam(ctx, '=', 700, 760, lt, 0.7, { font: '140px InterK', color: COL.white, from: 2.4 });
  slam(ctx, 'N', 860, 760, lt, 0.9, { font: '220px InterK', color: COL.amber, from: 2.6 });
  T(ctx, 'PRIME 1 · PRIME 2 · PUBLIC MODULUS', CX, 880, { font: '26px MonoM', color: COL.white, a: win(lt, 1.2, 0.5) });
  ctx.restore();

  // Phase 2 (3.6 s onward): the headline phrases from the brief, with less text on screen at once.
  slam(ctx, 'DIGITAL SIGNATURES', CX, 470, lt, 3.6, { font: '92px InterK', color: COL.white, from: 2.2 });
  slam(ctx, 'SIGNING INTERFACE', CX, 575, lt, 4.4, { font: '92px InterK', color: COL.cyan, from: 2.2 });
  marker(ctx, 'PADDING WEAKNESS', CX, 690, lt, 5.2, { font: '80px InterK', color: COL.amber });

  // The 128-byte block as a 16 × 8 grid. Each cell is one byte. Cells light up in a fast wave.
  const gx = 108, gy = 780, cols = 16, rows = 8, cw = 52, ch = 32, gap = 6;
  const span = 38;                                      // caller-controlled bytes, grown in the animation
  const callerEnd = 40 + Math.round(lerp(0, span, ei(win(lt, 6.5, 3.0))));
  const half = 64;                                      // half of 128 bytes
  for (let i = 0; i < 128; i++) {
    const reveal = win(lt, 6.0 + i * 0.012, 0.25);
    if (reveal <= 0) continue;
    const r = Math.floor(i / cols), c = i % cols;
    const x = gx + c * (cw + gap), y = gy + r * (ch + gap);
    let fill;
    if (i < 40) fill = 'rgba(255,255,255,0.22)';        // fixed padding
    else if (i < callerEnd) fill = COL.amber;           // caller-controlled
    else if (i >= 96) fill = COL.cyan;                  // 32-byte digest
    else fill = 'rgba(255,255,255,0.22)';
    ctx.save();
    ctx.globalAlpha *= eo(reveal);
    ctx.fillStyle = fill;
    rr(ctx, x, y, cw, ch, 6); ctx.fill();
    ctx.restore();
  }
  // Half-block line through the grid, between rows 3 and 4.
  const hy = gy + 4 * (ch + gap) - gap / 2;
  ctx.save();
  ctx.globalAlpha *= cl((lt - 6.0) * 3);
  ctx.strokeStyle = COL.white; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
  ctx.beginPath(); ctx.moveTo(gx - 20, hy); ctx.lineTo(gx + 16 * (cw + gap) + 20, hy); ctx.stroke();
  ctx.restore();
  T(ctx, 'SCHEMATIC · NOT TO SCALE', CX, gy - 22, { font: '22px MonoM', color: COL.mist, shadow: false, a: cl((lt - 6.0) * 3) });

  // Legend: three swatches, one per byte type.
  const legend = [['FIXED PADDING', 'rgba(255,255,255,0.22)', 108], ['CALLER-CONTROLLED', COL.amber, 420], ['32-BYTE DIGEST', COL.cyan, 800]];
  legend.forEach(([label, col, x], i) => {
    const p = cl((lt - 6.8 - i * 0.2) * 3);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= p;
    ctx.fillStyle = col; rr(ctx, x, 1120, 28, 28, 6); ctx.fill();
    ctx.restore();
    T(ctx, label, x + 40, 1144, { font: '24px MonoM', color: COL.white, align: 'left', shadow: false, a: p });
  });

  // The warning once caller-controlled bytes pass the half-block line.
  if (lt > 8.3) {
    flash(ctx, lt, 8.3, COL.red, 0.25, 0.25);
    marker(ctx, 'MORE THAN HALF ATTACKER-CONTROLLED', CX, 1210, lt, 8.3, { font: '40px InterK', color: COL.amber });
    marker(ctx, 'PADDING ADDS NO EXTRA PROTECTION', CX, 1276, lt, 8.6, { font: '36px InterK', color: COL.white, ink: COL.navy });
  }
  // Scope note, required by the brief's accuracy rules.
  T(ctx, 'A SPECIFIC SIGNING INTERFACE · NOT ALL RSA OPERATIONS', CX, 1326, { font: '22px MonoM', color: COL.mist, a: win(lt, 10.0, 0.6) });
  ctx.globalAlpha = a;
}

// ---------- scene 4: the 1,600x estimate (cost bars) ----------
// Visual: a full-width bar for today's cost, and a sliver for the theoretical estimate (1/1,600).
function scene4(ctx, lt, a) {
  const sh = shake(lt, [{ t: 2.2, amp: 26 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { tint: COL.amber, glowY: 760, glowA: 0.28 });
  speedLines(ctx, CX, 640, win(lt, 2.2, 0.7), 0.85);

  // The number counts up fast, then lands on 1,600× at 2.2 s.
  const fmt = (n) => n.toLocaleString('en-US');
  const counting = win(lt, 0.2, 2.0);
  const val = counting >= 1 ? 1600 : Math.round(1600 * eo(counting));
  const label = counting >= 1 ? '1,600×' : `${fmt(val)}×`;
  const sc = lt >= 2.2 ? lerp(1.12, 1, back(win(lt, 2.2, 0.4))) : 1;
  T(ctx, label, CX, 600, { font: '260px InterK', color: COL.cyan, scale: sc, glow: 40, glowColor: COL.white, maxW: 960 });
  shock(ctx, CX, 560, lt, 2.2, COL.white, 760, 0.8);
  flash(ctx, lt, 2.2, '#FFF4E0', 0.6, 0.25);

  // Cost bars: today's cost is the full bar. The estimate is 1/1,600 of that width.
  const bx = 108, bw = 864, by1 = 780, by2 = 880, bh = 56;
  const p1 = eo(win(lt, 2.8, 0.8));
  const p2 = eo(win(lt, 3.6, 0.6));
  T(ctx, 'TODAY: COST = 1', bx, by1 - 14, { font: '24px MonoM', color: COL.white, align: 'left', shadow: false, a: cl((lt - 2.8) * 3) });
  ctx.save();
  ctx.fillStyle = 'rgba(11,31,69,0.35)'; rr(ctx, bx, by1, bw, bh, 28); ctx.fill();
  ctx.fillStyle = COL.white; rr(ctx, bx, by1, bw * p1, bh, 28); ctx.fill();
  ctx.restore();
  T(ctx, 'ESTIMATE: ABOUT 1 / 1,600 OF TODAY', bx, by2 - 14, { font: '24px MonoM', color: COL.navy, align: 'left', shadow: false, a: cl((lt - 3.6) * 3) });
  ctx.save();
  ctx.fillStyle = 'rgba(11,31,69,0.35)'; rr(ctx, bx, by2, bw, bh, 28); ctx.fill();
  ctx.fillStyle = COL.cyan; rr(ctx, bx, by2, Math.max(8, (bw / 1600) * p2), bh, 28); ctx.fill();
  ctx.restore();

  marker(ctx, 'THEORETICAL ESTIMATE', CX, 1020, lt, 4.2, { font: '64px InterK', color: COL.amber });
  T(ctx, 'NOT EXPERIMENTALLY DEMONSTRATED', CX, 1110, { font: '50px InterB', color: COL.white, a: cl((lt - 4.8) * 3) });
  T(ctx, 'AT THIS SIZE', CX, 1170, { font: '50px InterB', color: COL.white, a: cl((lt - 5.0) * 3) });
  T(ctx, '32-BYTE DIGEST · SIGNATURE FORGERY', CX, 1250, { font: '26px MonoM', color: COL.mist, a: cl((lt - 5.4) * 3) });
  ctx.globalAlpha = a;
}

// ---------- scene 5: fan factories (shared setup vs per-key cost) ----------
// Visual: one shared setup block, then two bars for the cost of each additional key.
function scene5(ctx, lt, a) {
  background(ctx, lt, { glowY: 680, glowA: 0.22 });
  slam(ctx, 'FAN FACTORIES', CX, 400, lt, 0.1, { font: '120px InterK', color: COL.white, from: 2.4, glow: 26, glowColor: COL.cyan });
  marker(ctx, 'BATCH FACTORING', CX, 500, lt, 1.2, { font: '60px InterK', color: COL.amber });

  // One shared setup, done once. The brief says its cost is about one factorization.
  const sp = eo(win(lt, 2.2, 0.6));
  ctx.save();
  ctx.globalAlpha *= sp;
  ctx.fillStyle = COL.amber; rr(ctx, 108, 580, 864 * sp, 110, 24); ctx.fill();
  ctx.restore();
  T(ctx, 'ONE SHARED SETUP ≈ ONE FACTORIZATION', CX, 652, { font: '34px InterK', color: COL.navy, a: cl((lt - 2.6) * 3) });

  // Cost per additional key: the old method is tall, the new projection is 1/30 of that height.
  // Bars sit high enough that their labels and the two-line projection text never reach the caption box (top ~1339).
  const baseY = 1040, maxH = 320;
  const hPrev = maxH * eo(win(lt, 4.0, 0.9));
  const hNew = (maxH / 30) * eo(win(lt, 5.4, 0.6));
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; rr(ctx, 170, baseY - hPrev, 260, hPrev, 18); ctx.fill();
  ctx.fillStyle = COL.cyan; rr(ctx, 610, baseY - Math.max(hNew, 0), 260, Math.max(hNew, 0), 10); ctx.fill();
  ctx.restore();
  T(ctx, 'PREVIOUS METHOD', 300, baseY + 40, { font: '26px MonoM', color: COL.white, a: cl((lt - 4.2) * 3) });
  T(ctx, 'COST PER KEY', 300, baseY + 76, { font: '22px MonoM', color: COL.mist, a: cl((lt - 4.4) * 3) });
  T(ctx, 'NEW', 740, baseY + 40, { font: '26px MonoM', color: COL.white, a: cl((lt - 5.6) * 3) });
  T(ctx, 'PROJECTED, NOT IMPLEMENTED', 740, baseY + 76, { font: '22px MonoM', color: COL.mist, a: cl((lt - 5.8) * 3) });
  T(ctx, '≈30× LESS', 740, baseY - hNew - 22, { font: '64px InterK', color: COL.cyan, a: cl((lt - 5.8) * 3) });

  // The on-screen line from the brief, two lines at most.
  T(ctx, '≈30× PROJECTED REDUCTION', CX, 1200, { font: '46px InterB', color: COL.white, a: cl((lt - 6.6) * 3) });
  T(ctx, 'PER ADDITIONAL KEY', CX, 1256, { font: '46px InterB', color: COL.white, a: cl((lt - 7.0) * 3) });
  ctx.globalAlpha = a;
}

// ---------- scene 6: the real computation (racing bars) ----------
// Visual: two bars from the brief's numbers, drawn to scale. Caveats are kept, but they are smaller.
function scene6(ctx, lt, a) {
  background(ctx, lt, { glowY: 700, glowA: 0.2, tint: COL.cyan });

  // The brief's comparison line, on two lines.
  T(ctx, '1,380 CPU CORE-YEARS', CX, 330, { font: '64px InterK', color: COL.amber, a: cl((lt - 0.2) * 3), maxW: 960 });
  T(ctx, '→ 391 CPU CORE-YEARS', CX, 420, { font: '64px InterK', color: COL.cyan, a: cl((lt - 0.6) * 3), maxW: 960 });

  // Racing bars, to scale: the new run is 391 / 1,380 of the old one.
  const full = 864, newW = full * (391 / 1380);
  const b1 = eo(win(lt, 1.6, 1.6)), b2 = eo(win(lt, 2.2, 0.9));
  ctx.save();
  rr(ctx, 108, 500, full, 60, 30); ctx.fillStyle = 'rgba(11,31,69,0.45)'; ctx.fill();
  ctx.fillStyle = COL.amber; rr(ctx, 108, 500, full * b1, 60, 30); ctx.fill();
  rr(ctx, 108, 600, full, 60, 30); ctx.fillStyle = 'rgba(11,31,69,0.45)'; ctx.fill();
  ctx.fillStyle = COL.cyan; rr(ctx, 108, 600, newW * b2, 60, 30); ctx.fill();
  ctx.restore();
  T(ctx, 'OLD RUN', 140, 541, { font: '30px MonoM', color: COL.navy, align: 'left', shadow: false, a: cl((lt - 2.0) * 3) });
  T(ctx, 'NEW RUN', 108 + newW * b2 + 20, 641, { font: '30px MonoM', color: COL.white, align: 'left', shadow: false, a: cl((lt - 2.8) * 3) });
  speedLines(ctx, CX, 620, win(lt, 2.2, 1.0), 0.5);

  // Headline: 3.5× less CPU work. The number is kept clear of the bars.
  slam(ctx, '3.5×', CX, 960, lt, 3.2, { font: '260px InterK', color: COL.cyan, from: 2.6, glow: 30, glowColor: COL.white });
  T(ctx, 'LESS CPU WORK', CX, 1030, { font: '44px InterK', color: COL.white, a: cl((lt - 4.0) * 3) });
  marker(ctx, 'SAME BENCHMARK AND ALGORITHM', CX, 1096, lt, 4.6, { font: '38px InterK', color: COL.white, ink: COL.navy });

  // Required caveats: measured on other hardware, and not the 1,600× result. Small and stacked.
  T(ctx, 'MEASURED REPRODUCTION · NOT THE 1,600× RESULT', CX, 1156, { font: '22px MonoM', color: COL.white, a: cl((lt - 5.4) * 3) });
  T(ctx, 'COMPARISON USES COSTS REPORTED ON OTHER HARDWARE', CX, 1192, { font: '21px MonoM', color: COL.mist, a: cl((lt - 5.7) * 3) });
  T(ctx, 'PAPER: AT MOST ~1.5× (SIEVE) AND ~1.2× (2ND TIER) FROM HARDWARE', CX, 1226, { font: '21px MonoM', color: COL.mist, a: cl((lt - 6.0) * 3) });
  ctx.globalAlpha = a;
}

// ---------- scene 7: the reality check (versus split) ----------
function scene7(ctx, lt, a) {
  const sh = shake(lt, [{ t: 0.9, amp: 16 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { tint: COL.amber, glowX: 270, glowY: 760, glowA: 0.28, glowR: 760 });
  background(ctx, lt, { tint: COL.cyan, glowX: 810, glowY: 760, glowA: 0.3, glowR: 760, base: false });

  // The diagonal divider splits the frame into the two sides of the versus.
  ctx.save();
  ctx.strokeStyle = COL.white;
  ctx.lineWidth = 8;
  ctx.globalAlpha *= eo(win(lt, 0.4, 0.4));
  // The line stops above the NIST note (y 1150), so it never crosses the text.
  ctx.beginPath(); ctx.moveTo(CX + 170, 330); ctx.lineTo(CX - 124, 1150); ctx.stroke();
  ctx.restore();
  slam(ctx, '≠', CX, 800, lt, 0.8, { font: '150px InterK', color: COL.navy, from: 2.6 });

  // Title from the brief.
  slam(ctx, 'RSA-1024 ≠ RSA-2048+', CX, 420, lt, 0.1, { font: '90px InterK', color: COL.white, from: 2.2 });
  T(ctx, 'THESE SPECIFIC FINDINGS DO NOT THREATEN MODERN RSA', CX, 480, { font: '24px MonoM', color: COL.mist, a: cl((lt - 0.6) * 3) });

  // Legacy lock: cracked, on the amber side. Modern lock: intact, on the cyan side.
  const lp = back(win(lt, 0.5, 0.5)), mp = back(win(lt, 0.9, 0.5));
  drawLock(ctx, { cx: 270, cy: 760, s: 0.6, alpha: cl(lp), cracked: 1, crackSeed: 11, glow: COL.amber, glowA: 0.6, inscription: '1024' });
  drawLock(ctx, { cx: 810, cy: 760, s: 0.6, alpha: cl(mp), cracked: 0, glow: COL.white, glowA: 0.7, inscription: '2048+' });
  flash(ctx, lt, 0.9, '#FFFFFF', 0.35, 0.2);

  marker(ctx, 'RSA-1024:', 270, 1000, lt, 1.6, { font: '40px InterK', color: COL.amber });
  T(ctx, 'LEGACY TARGET', 270, 1050, { font: '28px MonoM', color: COL.white, a: cl((lt - 2.0) * 3) });
  marker(ctx, 'RSA-2048+:', 810, 1000, lt, 2.0, { font: '40px InterK', color: COL.cyan, ink: COL.navy });
  T(ctx, 'NOT THREATENED BY', 810, 1050, { font: '26px MonoM', color: COL.white, a: cl((lt - 2.4) * 3) });
  T(ctx, 'THESE RESULTS', 810, 1088, { font: '26px MonoM', color: COL.white, a: cl((lt - 2.5) * 3) });

  // NIST citation, as stated in the paper.
  T(ctx, 'NIST NO LONGER APPROVES 1024-BIT RSA', CX, 1196, { font: '24px MonoM', color: COL.white, a: cl((lt - 3.6) * 3) });
  T(ctx, 'FOR GENERATING SIGNATURES (SP 800-131A REV. 2)', CX, 1230, { font: '24px MonoM', color: COL.white, a: cl((lt - 3.8) * 3) });
  ctx.globalAlpha = a;
}

// ---------- scene 8: the closing ----------
function scene8(ctx, lt, a) {
  background(ctx, lt, { tint: COL.cyan, glowY: 560, glowA: 0.3 });
  // A light sweep crosses the frame once.
  const bp = win(lt, 0.2, 2.2);
  if (bp > 0 && bp < 1) {
    ctx.save();
    ctx.globalAlpha *= Math.sin(bp * Math.PI) * 0.45;
    const x = lerp(-500, 1580, bp);
    const g = ctx.createLinearGradient(x - 220, 0, x + 220, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.translate(x, 960);
    ctx.rotate(-0.4);
    ctx.fillRect(-220, -1100, 440, 2200);
    ctx.restore();
  }
  // The modern lock floats gently above the words.
  drawLock(ctx, { cx: CX, cy: 470 + Math.sin(lt * 1.1) * 7, s: 0.62, alpha: cl(lt * 3), cracked: 0, glow: COL.white, glowA: 0.8, inscription: 'RSA-2048+' });

  // The closing line, word by word, from the brief.
  slam(ctx, 'THE FUTURE OF', CX, 880, lt, 1.0, { font: '120px InterK', color: COL.white, from: 2.4 });
  marker(ctx, 'CYBERSECURITY', CX, 1020, lt, 1.5, { font: '120px InterK', color: COL.cyan });
  slam(ctx, 'IS CHANGING.', CX, 1160, lt, 2.0, { font: '120px InterK', color: COL.amber, from: 2.4 });
  ctx.globalAlpha = a;
}

// Every scene is wrapped so it starts from a clean transform and alpha, and the next one is not affected.
const RAW = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8];
export const SCENE_FNS = RAW.map((fn) => (ctx, lt, a) => {
  ctx.save();
  ctx.globalAlpha = a;
  fn(ctx, lt, a);
  ctx.restore();
});

// ---------- captions (burned in, two lines at most) ----------
// `caption` comes from out/timing.json: { start, end, lines: [[{text, highlight}, ...], ...] }.
// Style: a navy box with white text, and highlighted words in amber. The box is high-contrast on a bright background.
export function drawCaption(ctx, caption, t) {
  const k = cl(Math.min(t - caption.start, caption.end - t) / 0.08); // quick fade in and out
  ctx.save();
  ctx.font = '56px InterXB';
  const lineH = 74;
  const lines = caption.lines;
  const widths = lines.map((ln) => ln.reduce((w, tok, i) => w + ctx.measureText(tok.text + (i < ln.length - 1 ? ' ' : '')).width, 0));
  const maxW = Math.max(...widths);
  const boxW = Math.min(900, maxW + 70);
  const boxH = lines.length * lineH + 34;
  const cx = CX, cy = 1430;
  ctx.globalAlpha = k;
  card(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, { fill: 'rgba(11,31,69,0.92)', stroke: COL.white, r: 22, lw: 2 });
  lines.forEach((ln, li) => {
    let x = cx - widths[li] / 2;
    const y = cy - ((lines.length - 1) * lineH) / 2 + li * lineH + 20;
    ln.forEach((tok, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = tok.highlight ? COL.amber : COL.white;
      ctx.shadowColor = 'transparent';
      ctx.fillText(tok.text, x, y);
      x += ctx.measureText(tok.text + (i < ln.length - 1 ? ' ' : '')).width;
    });
  });
  ctx.restore();
}
