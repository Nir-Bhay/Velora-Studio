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
// It can be negative during a cross-fade. The exported SCENE_FNS wrap each scene in save/restore,
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

// ---------- scene 2: announcement, two fighter cards ----------
function scene2(ctx, lt, a) {
  const sh = shake(lt, [{ t: 0.05, amp: 10 }, { t: 2.4, amp: 14 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 700, glowA: 0.22 });

  // Date stamp on a tilted white tape strip. The date is on-screen text from the brief.
  marker(ctx, 'NOV 06, 2026', CX, 380, lt, 0.0, { font: '44px MonoM', color: COL.white, ink: COL.navy, dur: 0.3 });
  // The headline, slamming word by word.
  slam(ctx, 'GOOGLE', CX, 580, lt, 0.25, { font: '150px InterK', color: COL.white, from: 2.4 });
  slam(ctx, 'DEEPMIND', CX, 740, lt, 0.45, { font: '150px InterK', color: COL.cyan, from: 2.4 });
  marker(ctx, 'TWO RESEARCH ADVANCES', CX, 850, lt, 1.0, { font: '60px InterK', color: COL.amber });

  // Fighter card A slides in from the left. Card B slides in from the right. Both tilt slightly.
  const aP = back(win(lt, 2.4, 0.5)), bP = back(win(lt, 3.1, 0.5));
  const ax = lerp(-940, 108, aP), bx = lerp(1220, 108, bP);
  speedLines(ctx, CX, 1060, win(lt, 2.3, 0.8), 0.7);
  drawFightCard(ctx, ax, 960, 'RSA SIGNATURE FORGERY', 'Modular Roots from a Restricted Oracle', 'PAPER 1 · WORKING PAPER', COL.cyan, cl(aP));
  drawFightCard(ctx, bx, 1160, 'BATCH FACTORIZATION', 'Fan Factories: multiple number fields', 'PAPER 2 · WORKING PAPER', COL.amber, cl(bP));
  ctx.globalAlpha = a;
}

// A research card: a dark card, a coloured edge, and the title, subtitle and tag.
function drawFightCard(ctx, x, y, title, sub, tag, accent, alpha) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, x, y, 864, 160, { fill: 'rgba(11,31,69,0.9)', stroke: accent, lw: 4 });
  ctx.fillStyle = accent;
  rr(ctx, x, y, 14, 160, 6);
  ctx.fill();
  T(ctx, title, x + 46, y + 62, { font: '50px InterK', color: COL.white, align: 'left', shadow: false });
  T(ctx, sub, x + 46, y + 100, { font: '26px MonoR', color: COL.grey, align: 'left', shadow: false });
  T(ctx, tag, x + 46, y + 136, { font: '22px MonoM', color: accent, align: 'left', shadow: false });
  ctx.restore();
}

// ---------- scene 3: the signature problem ----------
function scene3(ctx, lt, a) {
  const sh = shake(lt, [{ t: 7.6, amp: 16 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 860, glowA: 0.22, tint: COL.cyan });

  // Phase 1 (0–3.2 s): the public modulus, N = p × q. Each token slams in, then the group whips away.
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

  // Phase 2 (3.6 s onward): three on-screen phrases from the brief, each slamming in.
  slam(ctx, 'DIGITAL SIGNATURES', CX, 560, lt, 3.6, { font: '104px InterK', color: COL.white, from: 2.2 });
  slam(ctx, 'SIGNING INTERFACE', CX, 680, lt, 4.4, { font: '104px InterK', color: COL.cyan, from: 2.2 });
  marker(ctx, 'PADDING WEAKNESS', CX, 800, lt, 5.2, { font: '96px InterK', color: COL.amber });

  // The 128-byte block. Caller-controlled bytes grow across the half-block line.
  const bx = 108, bw = 864, by = 880, bh = 92;
  const blockP = eo(win(lt, 6.0, 0.5));
  const frac = lerp(0.2, 0.62, ei(win(lt, 6.5, 4.0)));
  if (blockP > 0) {
    ctx.save();
    ctx.globalAlpha *= blockP;
    T(ctx, '128 BYTES · 1024-BIT SIGNED BLOCK', CX, by - 22, { font: '24px MonoM', color: COL.white, shadow: false });
    ctx.beginPath(); rr(ctx, bx, by, bw, bh, 18); ctx.clip();
    ctx.fillStyle = 'rgba(11,31,69,0.55)';
    ctx.fillRect(bx, by, bw, bh);
    // Fixed padding is hatched.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    for (let x = bx - bh; x < bx + bw; x += 24) { ctx.beginPath(); ctx.moveTo(x, by + bh); ctx.lineTo(x + bh, by); ctx.stroke(); }
    // Caller-controlled bytes, in amber so the threat reads at a glance.
    const cw = bw * frac;
    ctx.fillStyle = COL.amber;
    ctx.fillRect(bx + bw - cw, by, cw, bh);
    ctx.restore();
    T(ctx, 'FIXED PADDING', bx + 24, by + bh / 2 + 9, { font: '26px MonoM', color: COL.navy, align: 'left', shadow: false });
    if (bw * frac > 300) T(ctx, 'CALLER-CONTROLLED', bx + bw - (bw * frac) / 2, by + bh / 2 + 9, { font: '26px MonoM', color: COL.navy, shadow: false });
    // Half-block line.
    ctx.save();
    ctx.globalAlpha *= blockP;
    ctx.strokeStyle = COL.white;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.moveTo(CX, by - 14); ctx.lineTo(CX, by + bh + 14); ctx.stroke();
    ctx.restore();
    T(ctx, '½ BLOCK', CX, by + bh + 46, { font: '24px MonoM', color: COL.white, shadow: false, a: blockP });
  }

  // Warning, shown once the caller-controlled part passes half the block at 7.6 s.
  if (lt > 7.6) {
    flash(ctx, lt, 7.6, COL.red, 0.25, 0.25);
    marker(ctx, 'MORE THAN HALF ATTACKER-CONTROLLED', CX, 1040, lt, 7.6, { font: '40px InterK', color: COL.amber });
    marker(ctx, 'PADDING ADDS NO EXTRA PROTECTION', CX, 1110, lt, 7.9, { font: '40px InterK', color: COL.white, ink: COL.navy });
  }

  // Chips: the signing path, one chip after another from 9.0 s.
  const chips = ['MESSAGE', 'PADDING', 'RSA SIGNING', 'DIGITAL SIGNATURE'];
  chips.forEach((c, i) => {
    const x = 108 + i * (190 + 36);
    const p = back(win(lt, 9.0 + i * 0.3, 0.4));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= cl(p * 3);
    card(ctx, x, 1180, 190, 104, { fill: i === 1 ? COL.amber : 'rgba(11,31,69,0.9)', stroke: COL.white, r: 18, lw: 2 });
    const parts = c.split(' ');
    parts.forEach((w, k) => T(ctx, w, x + 95, 1180 + 50 + k * 30 - (parts.length - 1) * 15, { font: '24px MonoM', color: i === 1 ? COL.navy : COL.white, shadow: false }));
    ctx.restore();
  });
  // Scope note, on-screen per the brief's accuracy rules.
  T(ctx, 'A SPECIFIC SIGNING INTERFACE · NOT ALL RSA OPERATIONS', CX, 1318, { font: '24px MonoM', color: COL.white, a: win(lt, 10.0, 0.6) });
  ctx.globalAlpha = a;
}

// ---------- scene 4: the 1,600x estimate ----------
function scene4(ctx, lt, a) {
  const sh = shake(lt, [{ t: 2.2, amp: 26 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { tint: COL.amber, glowY: 760, glowA: 0.28 });
  speedLines(ctx, CX, 720, win(lt, 2.2, 0.7), 0.85);

  // The number counts up fast, then lands on 1,600× at the 2.2 s reveal.
  const fmt = (n) => n.toLocaleString('en-US');
  const counting = win(lt, 0.2, 2.0);
  const val = counting >= 1 ? 1600 : Math.round(1600 * eo(counting));
  const label = counting >= 1 ? '1,600×' : `${fmt(val)}×`;
  const sc = lt >= 2.2 ? lerp(1.12, 1, back(win(lt, 2.2, 0.4))) : 1;
  T(ctx, label, CX, 760, { font: '300px InterK', color: COL.cyan, scale: sc, glow: 40, glowColor: COL.white, maxW: 960 });

  shock(ctx, CX, 720, lt, 2.2, COL.white, 760, 0.8);
  flash(ctx, lt, 2.2, '#FFF4E0', 0.6, 0.25);

  marker(ctx, 'THEORETICAL ESTIMATE', CX, 920, lt, 2.6, { font: '64px InterK', color: COL.amber });
  T(ctx, 'NOT EXPERIMENTALLY DEMONSTRATED', CX, 1040, { font: '50px InterB', color: COL.white, a: cl((lt - 3.3) * 3) });
  T(ctx, 'AT THIS SIZE', CX, 1100, { font: '50px InterB', color: COL.white, a: cl((lt - 3.5) * 3) });
  T(ctx, '32-BYTE DIGEST · SIGNATURE FORGERY', CX, 1190, { font: '26px MonoM', color: COL.grey, a: cl((lt - 4.0) * 3) });
  ctx.globalAlpha = a;
}

// ---------- scene 5: fan factories ----------
function scene5(ctx, lt, a) {
  background(ctx, lt, { glowY: 680, glowA: 0.22 });
  slam(ctx, 'FAN FACTORIES', CX, 400, lt, 0.1, { font: '120px InterK', color: COL.white, from: 2.4, glow: 26, glowColor: COL.cyan });
  marker(ctx, 'BATCH FACTORING', CX, 500, lt, 0.7, { font: '56px InterK', color: COL.amber });

  // The shared precomputation orb. It pulses, then bursts into six fans at 2.0 s.
  const pulse = 1 + 0.04 * Math.sin(lt * 6);
  const orbA = eo(win(lt, 0.6, 0.6));
  const ox = CX, oy = 610, orbR = 66;
  const targets = Array.from({ length: 6 }, (_, i) => ({ x: 108 + i * 152 + 65, y: 1130 }));
  // Fan lines, drawn first so they sit behind the text.
  targets.forEach((tg, i) => {
    const p = eo(win(lt, 2.0 + i * 0.07, 0.7));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= p * 0.85;
    ctx.strokeStyle = COL.white;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ox, oy + orbR);
    ctx.bezierCurveTo(ox, (oy + tg.y) / 2, tg.x, (oy + tg.y) / 2, tg.x, tg.y);
    ctx.stroke();
    // Energy pulse travelling down the line.
    const u = (lt * 0.7 + i * 0.16) % 1, v = 1 - u;
    const px = v * v * v * ox + 3 * v * v * u * ox + 3 * v * u * u * tg.x + u * u * u * tg.x;
    const py = v * v * v * (oy + orbR) + 3 * v * v * u * (oy + tg.y) / 2 + 3 * v * u * u * (oy + tg.y) / 2 + u * u * u * tg.y;
    ctx.fillStyle = COL.cyan;
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // The orb.
  ctx.save();
  ctx.globalAlpha *= orbA;
  ctx.translate(ox, oy);
  ctx.scale(pulse, pulse);
  const og = ctx.createRadialGradient(0, 0, 10, 0, 0, orbR + 30);
  og.addColorStop(0, COL.white);
  og.addColorStop(0.5, COL.cyan);
  og.addColorStop(1, 'rgba(54,197,240,0)');
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(0, 0, orbR + 30, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (orbA > 0) {
    ctx.save();
    ctx.globalAlpha *= orbA;
    card(ctx, CX - 390, 716, 780, 56, { fill: 'rgba(11,31,69,0.92)', stroke: COL.cyan, r: 14, lw: 2 });
    ctx.restore();
    T(ctx, 'SHARED PRECOMPUTATION · ≈ ONE FACTORIZATION', CX, 752, { font: '24px MonoM', color: COL.white, a: orbA, shadow: false });
  }
  shock(ctx, ox, oy, lt, 2.0, COL.cyan, 700, 0.9);
  flash(ctx, lt, 2.0, COL.cyan, 0.35, 0.3);

  // Six targets at the bottom of the fan.
  targets.forEach((tg, i) => {
    const p = back(win(lt, 2.3 + i * 0.07, 0.4));
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= cl(p * 3);
    card(ctx, tg.x - 65, tg.y - 45, 130, 90, { fill: 'rgba(11,31,69,0.92)', stroke: COL.cyan, r: 16, lw: 3 });
    T(ctx, `N${'₁₂₃₄₅₆'[i]}`, tg.x, tg.y + 6, { font: '34px InterK', color: COL.white, shadow: false });
    ctx.restore();
  });

  // The headline number, with its phrase from the brief.
  slam(ctx, '≈30×', CX, 1000, lt, 4.2, { font: '260px InterK', color: COL.amber, from: 2.6, glow: 30, glowColor: COL.amber });
  T(ctx, 'PROJECTED REDUCTION PER ADDITIONAL KEY', CX, 1058, { font: '28px MonoM', color: COL.white, a: cl((lt - 5.2) * 3) });
  marker(ctx, 'THEORETICAL · NOT IMPLEMENTED', CX, 1110, lt, 5.6, { font: '40px InterK', color: COL.cyan });
  ctx.globalAlpha = a;
}

// ---------- scene 6: the real computation ----------
function scene6(ctx, lt, a) {
  const sh = shake(lt, [{ t: 3.4, amp: 18 }]);
  ctx.translate(sh.x, sh.y);
  background(ctx, lt, { glowY: 560, glowA: 0.22, tint: COL.cyan });

  // The two numbers from the brief, slamming in one after the other.
  slam(ctx, '1,380 CPU CORE-YEARS', CX, 480, lt, 0.2, { font: '96px InterK', color: COL.amber, from: 2.4 });
  slam(ctx, '→', CX, 600, lt, 0.8, { font: '110px InterK', color: COL.white, from: 2.2 });
  slam(ctx, '391 CPU CORE-YEARS', CX, 730, lt, 1.2, { font: '96px InterK', color: COL.cyan, from: 2.4 });

  // Racing bars: the old run is long and amber; the new one is short and cyan.
  const full = 864, newW = full * (391 / 1380);
  const b1 = eo(win(lt, 1.6, 1.6)), b2 = eo(win(lt, 2.2, 0.9));
  ctx.save();
  rr(ctx, 108, 800, full, 56, 28); ctx.fillStyle = 'rgba(11,31,69,0.45)'; ctx.fill();
  ctx.fillStyle = COL.amber; rr(ctx, 108, 800, full * b1, 56, 28); ctx.fill();
  rr(ctx, 108, 890, full, 56, 28); ctx.fillStyle = 'rgba(11,31,69,0.45)'; ctx.fill();
  ctx.fillStyle = COL.cyan; rr(ctx, 108, 890, newW * b2, 56, 28); ctx.fill();
  ctx.restore();
  speedLines(ctx, CX, 860, win(lt, 2.2, 1.0), 0.5);

  // Headline: 3.5× less CPU work, with the same benchmark phrase as the brief.
  slam(ctx, '3.5×', CX, 1080, lt, 3.2, { font: '280px InterK', color: COL.cyan, from: 2.6, glow: 30, glowColor: COL.white });
  T(ctx, 'UP TO 300,000 CPU CORES · 16 GPUs', CX, 1120, { font: '26px MonoM', color: COL.white, a: cl((lt - 4.4) * 3) });
  marker(ctx, 'SAME BENCHMARK AND ALGORITHM', CX, 1180, lt, 4.8, { font: '40px InterK', color: COL.white, ink: COL.navy });
  // Required caveats: measured on other hardware, and not the 1,600× result.
  T(ctx, 'MEASURED REPRODUCTION · NOT THE 1,600× RESULT', CX, 1232, { font: '22px MonoM', color: COL.white, a: cl((lt - 5.4) * 3) });
  T(ctx, 'COMPARISON USES COSTS REPORTED ON OTHER HARDWARE', CX, 1266, { font: '21px MonoM', color: COL.mist, a: cl((lt - 5.7) * 3) });
  T(ctx, 'PAPER: AT MOST ~1.5× (SIEVE) AND ~1.2× (2ND TIER) FROM HARDWARE', CX, 1298, { font: '21px MonoM', color: COL.mist, a: cl((lt - 6.0) * 3) });
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
  ctx.beginPath(); ctx.moveTo(CX + 170, 330); ctx.lineTo(CX - 170, 1280); ctx.stroke();
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
