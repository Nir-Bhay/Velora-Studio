// shiva-ganesha-video/lib/paint.mjs — drawing vocabulary for the film.
//
// Surfaces, not outlines: every component is a filled paper or glass surface with a soft
// shadow and a light sheen. Edges of paper cards are cut slightly by hand (seeded jitter),
// so nothing is perfectly machine-straight. Text is fitted to its box, never clipped.
// Glyphs are drawn in a 1000-unit design space centred on (0, 0); the caller sets the transform.

import { C, FAM } from '../brand.mjs';
import { hash } from './ease.mjs';

// ── basics ────────────────────────────────────────────────────────────────────
export function rr(c, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.roundRect(x, y, w, h, k);
}

/** Rounded rectangle whose four corners are nudged by seeded jitter (cut paper). */
export function cutRR(c, x, y, w, h, r, seed = 1, amp = 2.2) {
  const j = (i) => (hash(seed * 13 + i) - 0.5) * 2 * amp;
  const k = Math.min(r, w / 2, h / 2);
  const p = [
    [x + j(1), y + j(2)], [x + w + j(3), y + j(4)],
    [x + w + j(5), y + h + j(6)], [x + j(7), y + h + j(8)],
  ];
  c.beginPath();
  c.moveTo(p[0][0] + k, p[0][1]);
  c.lineTo(p[1][0] - k, p[1][1]);
  c.quadraticCurveTo(p[1][0], p[1][1], p[1][0], p[1][1] + k);
  c.lineTo(p[2][0], p[2][1] - k);
  c.quadraticCurveTo(p[2][0], p[2][1], p[2][0] - k, p[2][1]);
  c.lineTo(p[3][0] + k, p[3][1]);
  c.quadraticCurveTo(p[3][0], p[3][1], p[3][0], p[3][1] - k);
  c.lineTo(p[0][0], p[0][1] + k);
  c.quadraticCurveTo(p[0][0], p[0][1], p[0][0] + k, p[0][1]);
  c.closePath();
}

export function withShadow(c, { blur = 40, dy = 18, dx = 0, color = 'rgba(42,28,22,0.30)' } , fn) {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.shadowOffsetX = dx;
  c.shadowOffsetY = dy;
  fn();
  c.restore();
}

export function lin(c, x0, y0, x1, y1, stops) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
export function rad(c, x, y, r0, r1, stops) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

// ── backgrounds ───────────────────────────────────────────────────────────────
export const THEMES = {
  dusk: { base: [[0, '#4A2A20'], [0.55, '#2E1B15'], [1, '#22140F']], glow: ['rgba(226,71,45,0.42)', 0.2, 0.22] },
  dawn: { base: [[0, '#FFF3DC'], [0.6, '#FBD27A'], [1, '#F5B531']], glow: ['rgba(255,255,255,0.55)', 0.5, 0.25] },
  oxblood: { base: [[0, '#5C1F1B'], [0.6, '#2E1412'], [1, '#1F0F0D']], glow: ['rgba(245,181,49,0.38)', 0.5, 0.52] },
  night: { base: [[0, '#4A3026'], [0.55, '#2C1C17'], [1, '#1C120E']], glow: ['rgba(255,217,122,0.22)', 0.5, 0.42] },
  map: { base: [[0, '#FBEFD6'], [1, '#EBD6AE']], glow: ['rgba(255,255,255,0.4)', 0.5, 0.5] },
  gold: { base: [[0, '#FFD97A'], [0.5, '#F5A23A'], [1, '#B8402A']], glow: ['rgba(255,247,220,0.9)', 0.5, 0.42] },
  cream: { base: [[0, '#FFF3DC'], [1, '#F3DDB0']], glow: ['rgba(245,181,49,0.35)', 0.8, 0.12] },
};

export function background(c, W, H, theme) {
  const T = THEMES[theme] ?? THEMES.dusk;
  c.fillStyle = lin(c, 0, 0, W * 0.35, H, T.base);
  c.fillRect(0, 0, W, H);
  const [col, gx, gy] = T.glow;
  c.fillStyle = rad(c, W * gx, H * gy, 0, Math.max(W, H) * 0.7, [[0, col], [1, 'rgba(0,0,0,0)']]);
  c.fillRect(0, 0, W, H);
}

export function vignette(c, W, H, a = 0.28) {
  c.fillStyle = rad(c, W / 2, H / 2, Math.min(W, H) * 0.35, Math.max(W, H) * 0.75,
    [[0, 'rgba(0,0,0,0)'], [1, `rgba(20,10,6,${a})`]]);
  c.fillRect(0, 0, W, H);
}

/** Analog grain: a seeded noise tile, laid over the frame with overlay blending. */
export function grain(c, W, H, tile, alpha = 0.10) {
  c.save();
  c.globalCompositeOperation = 'overlay';
  c.globalAlpha = alpha;
  c.fillStyle = c.createPattern(tile, 'repeat');
  c.fillRect(0, 0, W, H);
  c.restore();
}

// ── surfaces ──────────────────────────────────────────────────────────────────
/** Paper card: cream fill, soft shadow, top sheen, cut edges. */
export function paper(c, x, y, w, h, r, { seed = 1, fill = null, shadow = true, amp = 2.2 } = {}) {
  const draw = () => {
    cutRR(c, x, y, w, h, r, seed, amp);
    c.fillStyle = fill ?? lin(c, 0, y, 0, y + h, [[0, '#FFF8E8'], [1, '#F6E4BE']]);
    c.fill();
  };
  if (shadow) withShadow(c, { blur: 44, dy: 22, color: 'rgba(42,28,22,0.34)' }, draw);
  else draw();
  // sheen: a soft light band across the top third
  c.save();
  cutRR(c, x, y, w, h, r, seed, amp);
  c.clip();
  c.fillStyle = lin(c, 0, y, 0, y + h * 0.4, [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  c.fillRect(x, y, w, h * 0.4);
  c.restore();
}

/** Liquid-glass panel: translucent gradient, light edge sheen, soft shadow. The one glass accent. */
export function glass(c, x, y, w, h, r) {
  withShadow(c, { blur: 60, dy: 24, color: 'rgba(42,28,22,0.28)' }, () => {
    rr(c, x, y, w, h, r);
    c.fillStyle = lin(c, x, y, x + w, y + h, [[0, 'rgba(255,248,232,0.46)'], [1, 'rgba(255,230,190,0.14)']]);
    c.fill();
  });
  c.save();
  rr(c, x, y, w, h, r);
  c.clip();
  // inner light at the top edge, and a warm dispersion band at the bottom
  c.fillStyle = lin(c, 0, y, 0, y + 6, [[0, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
  c.fillRect(x, y, w, 6);
  c.fillStyle = lin(c, x, 0, x + w, 0, [[0, 'rgba(245,181,49,0.35)'], [0.5, 'rgba(255,138,92,0.25)'], [1, 'rgba(245,181,49,0.35)']]);
  c.fillRect(x, y + h - 10, w, 10);
  c.restore();
}

/** Solid chip: a filled pill with text. Used for captions, tags and status. */
export function chip(c, x, y, w, h, fill, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  withShadow(c, { blur: 24, dy: 10, color: 'rgba(42,28,22,0.22)' }, () => {
    rr(c, x, y, w, h, h / 2);
    c.fillStyle = fill;
    c.fill();
  });
  c.restore();
}

// ── type ──────────────────────────────────────────────────────────────────────
export function setFont(c, size, fam = FAM.xb, weight = '') {
  c.font = `${weight ? weight + ' ' : ''}${size}px ${fam}`;
}

/** Largest size (≤ maxSize, ≥ minSize) at which the text wraps inside box. Returns { size, lines }. */
export function fitText(c, text, box, { maxSize = 120, minSize = 24, fam = FAM.black, lh = 1.06, weight = '' } = {}) {
  const words = text.split(' ');
  for (let size = maxSize; size >= minSize; size -= 2) {
    setFont(c, size, fam, weight);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (c.measureText(trial).width <= box.w) cur = trial;
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    const h = lines.length * size * lh;
    const widest = Math.max(...lines.map((l) => c.measureText(l).width));
    if (h <= box.h && widest <= box.w) return { size, lines, lh };
  }
  setFont(c, minSize, fam, weight);
  return { size: minSize, lines: [text], lh };
}

/** Text with optional tracking, left-aligned at (x, y) baseline. */
export function label(c, s, x, y, { size = 22, fam = FAM.mono, color = C.cream, track = 0, align = 'left', alpha = 1 } = {}) {
  setFont(c, size, fam);
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = color;
  c.textBaseline = 'alphabetic';
  c.textAlign = align;
  c.letterSpacing = `${track}px`;
  c.fillText(s, x, y);
  c.restore();
}

// ── glyphs (design space; the caller transforms) ─────────────────────────────
export function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }

/** Soft organic blob with four bezier lobes. rx, ry are the half-extents. */
export function blob(c, x, y, rx, ry, seed = 3, wob = 0.06) {
  const k = 0.5523;
  const j = (i) => 1 + (hash(seed * 7 + i) - 0.5) * 2 * wob;
  const top = [x, y - ry * j(0)];
  const right = [x + rx * j(1), y];
  const bottom = [x, y + ry * j(2)];
  const left = [x - rx * j(3), y];
  c.beginPath();
  c.moveTo(...top);
  c.bezierCurveTo(x + rx * k * j(4), y - ry, right[0], y - ry * k, ...right);
  c.bezierCurveTo(right[0], y + ry * k, x + rx * k, y + ry, ...bottom);
  c.bezierCurveTo(x - rx * k, y + ry, left[0], y + ry * k, ...left);
  c.bezierCurveTo(left[0], y - ry * k, x - rx * k, y - ry, ...top);
  c.closePath();
}

/** Lotus: n petals, open 0..1 (0 = closed bud). */
export function lotus(c, x, y, s, open, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const len = s * (0.35 + 0.65 * open);
    c.save();
    c.translate(x, y);
    c.rotate(a);
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(s * 0.22, -len * 0.3, s * 0.2, -len * 0.9, 0, -len);
    c.bezierCurveTo(-s * 0.2, -len * 0.9, -s * 0.22, -len * 0.3, 0, 0);
    c.fillStyle = color;
    c.globalAlpha = 0.5 + 0.5 * open;
    c.fill();
    c.restore();
  }
  c.globalAlpha = 1;
  circle(c, x, y, s * 0.16);
  c.fillStyle = C.haldi2;
  c.fill();
}

/** Crescent moon, opening to the right. Tips at top and bottom. */
export function crescent(c, x, y, r, color) {
  c.beginPath();
  c.arc(x, y, r, -Math.PI / 2 - 0.02, Math.PI / 2 + 0.02, false);
  c.quadraticCurveTo(x - r * 0.05, y, x, y - r);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

/** Trishul: a shaft and three prongs, from base (x, y) upward to height h. */
export function trishul(c, x, y, h, color) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = h * 0.035;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x, y - h);
  c.stroke();
  c.beginPath();
  c.moveTo(x - h * 0.12, y - h * 0.78);
  c.quadraticCurveTo(x - h * 0.12, y - h * 0.98, x, y - h * 1.02);
  c.quadraticCurveTo(x + h * 0.12, y - h * 0.98, x + h * 0.12, y - h * 0.78);
  c.lineTo(x - h * 0.12, y - h * 0.78);
  c.fillStyle = color;
  c.fill();
  c.restore();
}

/** Ganesha as a child, human head (before the change). Body is a haldi blob. */
export function ganeshaHuman(c, x, y, s, { blink = false } = {}) {
  blob(c, x, y + s * 0.34, s * 0.34, s * 0.3, 11, 0.04);
  c.fillStyle = C.haldi;
  c.fill();
  blob(c, x, y - s * 0.12, s * 0.27, s * 0.26, 5, 0.03);
  c.fillStyle = C.paper;
  c.fill();
  // ears
  for (const sx of [-1, 1]) {
    circle(c, x + sx * s * 0.27, y - s * 0.1, s * 0.09);
    c.fillStyle = C.paper;
    c.fill();
  }
  // eyes and smile, in cocoa
  c.fillStyle = C.cocoa;
  if (!blink) {
    circle(c, x - s * 0.1, y - s * 0.14, s * 0.024); c.fill();
    circle(c, x + s * 0.1, y - s * 0.14, s * 0.024); c.fill();
  } else {
    c.fillRect(x - s * 0.13, y - s * 0.14, s * 0.06, s * 0.012);
    c.fillRect(x + s * 0.07, y - s * 0.14, s * 0.06, s * 0.012);
  }
  c.beginPath();
  c.arc(x, y - s * 0.03, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI);
  c.strokeStyle = C.cocoa;
  c.lineWidth = s * 0.02;
  c.lineCap = 'round';
  c.stroke();
}

/** Ganesha with the elephant head: big ears, trunk, tusks. Body is the same haldi blob. */
export function ganeshaElephant(c, x, y, s, { headY = 0, eyes = true } = {}) {
  blob(c, x, y + s * 0.34, s * 0.34, s * 0.3, 11, 0.04);
  c.fillStyle = C.haldi;
  c.fill();
  const hy = y - s * 0.12 + headY;
  // ears behind the head
  for (const sx of [-1, 1]) {
    blob(c, x + sx * s * 0.3, hy - s * 0.02, s * 0.22, s * 0.28, 21 + sx, 0.03);
    c.fillStyle = C.elephant;
    c.fill();
  }
  blob(c, x, hy, s * 0.27, s * 0.25, 9, 0.02);
  c.fillStyle = C.elephant;
  c.fill();
  // trunk: a thick curve falling to the front and curling up
  c.beginPath();
  c.moveTo(x, hy + s * 0.12);
  c.bezierCurveTo(x + s * 0.02, hy + s * 0.32, x + s * 0.16, hy + s * 0.36, x + s * 0.14, hy + s * 0.5);
  c.bezierCurveTo(x + s * 0.12, hy + s * 0.6, x + s * 0.04, hy + s * 0.58, x + s * 0.06, hy + s * 0.5);
  c.strokeStyle = C.elephant;
  c.lineWidth = s * 0.1;
  c.lineCap = 'round';
  c.stroke();
  // tusks
  for (const sx of [-1, 1]) {
    c.beginPath();
    c.moveTo(x + sx * s * 0.08, hy + s * 0.12);
    c.quadraticCurveTo(x + sx * s * 0.12, hy + s * 0.26, x + sx * s * 0.05, hy + s * 0.28);
    c.strokeStyle = C.cream;
    c.lineWidth = s * 0.03;
    c.stroke();
  }
  if (eyes) {
    c.fillStyle = C.cocoa;
    circle(c, x - s * 0.1, hy - s * 0.06, s * 0.024); c.fill();
    circle(c, x + s * 0.1, hy - s * 0.06, s * 0.024); c.fill();
  }
  // forehead mark
  circle(c, x, hy - s * 0.16, s * 0.03);
  c.fillStyle = C.sindoor;
  c.fill();
}

/** Shiva as a tall silhouette with a crescent and a trishul. armUp 0..1 raises the trishul. */
export function shivaFigure(c, x, y, s, armUp = 0) {
  blob(c, x, y + s * 0.5, s * 0.36, s * 0.52, 31, 0.02);
  c.fillStyle = C.cocoa3;
  c.fill();
  circle(c, x, y - s * 0.12, s * 0.2);
  c.fillStyle = C.cocoa3;
  c.fill();
  crescent(c, x + s * 0.02, y - s * 0.3, s * 0.17, C.haldi2);
  // trishul in hand, raised by armUp
  const hx = x + s * 0.34;
  const hyy = y + s * (0.2 - 0.22 * armUp);
  trishul(c, hx, hyy + s * 0.5, s * (0.9 + 0.2 * armUp), C.haldi2);
}

/** Compass: paper disc, ticks, and a gold north needle that turns to angle (degrees, 0 = up). */
export function compass(c, x, y, r, angleDeg) {
  paper(c, x - r, y - r, r * 2, r * 2, r, { seed: 4, amp: 1, shadow: true });
  c.save();
  c.translate(x, y);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    c.beginPath();
    c.moveTo(Math.sin(a) * r * 0.82, -Math.cos(a) * r * 0.82);
    c.lineTo(Math.sin(a) * r * (i % 6 === 0 ? 0.62 : 0.72), -Math.cos(a) * r * (i % 6 === 0 ? 0.62 : 0.72));
    c.strokeStyle = C.sandal;
    c.lineWidth = r * 0.02;
    c.stroke();
  }
  c.rotate((angleDeg * Math.PI) / 180);
  c.beginPath();
  c.moveTo(0, -r * 0.7);
  c.lineTo(r * 0.14, 0);
  c.lineTo(-r * 0.14, 0);
  c.closePath();
  c.fillStyle = C.sindoor;
  c.fill();
  c.beginPath();
  c.moveTo(0, r * 0.7);
  c.lineTo(r * 0.14, 0);
  c.lineTo(-r * 0.14, 0);
  c.closePath();
  c.fillStyle = C.cocoa3;
  c.fill();
  circle(c, 0, 0, r * 0.07);
  c.fillStyle = C.cocoa;
  c.fill();
  c.restore();
}

/** A small glowing spark (light particle). */
export function spark(c, x, y, r, alpha, color = C.haldi2) {
  if (alpha <= 0.01) return;
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = rad(c, x, y, 0, r * 2.4, [[0, color], [0.35, 'rgba(255,217,122,0.6)'], [1, 'rgba(255,217,122,0)']]);
  circle(c, x, y, r * 2.4);
  c.fill();
  circle(c, x, y, r * 0.5);
  c.fillStyle = '#FFFBEF';
  c.fill();
  c.restore();
}

/** Simple side-view elephant for the search scene. */
export function elephantSide(c, x, y, s, color = C.elephant) {
  c.save();
  c.fillStyle = color;
  blob(c, x, y, s * 0.46, s * 0.3, 41, 0.02);
  c.fill();
  blob(c, x - s * 0.44, y - s * 0.22, s * 0.2, s * 0.2, 42, 0.02);
  c.fill();
  c.beginPath();
  c.moveTo(x - s * 0.6, y - s * 0.12);
  c.bezierCurveTo(x - s * 0.72, y + s * 0.1, x - s * 0.7, y + s * 0.3, x - s * 0.64, y + s * 0.42);
  c.strokeStyle = color;
  c.lineWidth = s * 0.06;
  c.lineCap = 'round';
  c.stroke();
  c.restore();
}
