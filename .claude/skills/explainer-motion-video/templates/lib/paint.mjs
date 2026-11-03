// mcp-video/lib/paint.mjs
//
// Drawing helpers on a 2D canvas. Everything takes an explicit time-derived value;
// nothing here remembers a previous frame.

import { C, F, W, H } from '../brand.mjs';
import { clamp, lerp, bez } from './ease.mjs';

export const font = (fam, size) => `${size}px ${fam}`;

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fillRR(ctx, x, y, w, h, r, color, a = 1) {
  if (a <= 0 || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function strokeRR(ctx, x, y, w, h, r, color, width = 2, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

export function circle(ctx, x, y, r, color, a = 1) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Text with optional tracking (letter-spacing) and alignment. Returns the drawn width. */
export function txt(ctx, s, x, y, { fam = F.med, size = 40, color = C.paper, align = 'left', a = 1, track = 0 } = {}) {
  if (a <= 0) return 0;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.font = font(fam, size);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  let width;
  if (!track) {
    width = ctx.measureText(s).width;
  } else {
    width = [...s].reduce((acc, ch, i, arr) => acc + ctx.measureText(ch).width + (i < arr.length - 1 ? track : 0), 0);
  }
  let x0 = x;
  if (align === 'center') x0 = x - width / 2;
  if (align === 'right') x0 = x - width;
  if (!track) {
    ctx.textAlign = 'left';
    ctx.fillText(s, x0, y);
  } else {
    ctx.textAlign = 'left';
    let cx = x0;
    for (const ch of s) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + track;
    }
  }
  ctx.restore();
  return width;
}

export function measure(ctx, s, { fam = F.med, size = 40, track = 0 } = {}) {
  ctx.save();
  ctx.font = font(fam, size);
  const w = track
    ? [...s].reduce((acc, ch, i, arr) => acc + ctx.measureText(ch).width + (i < arr.length - 1 ? track : 0), 0)
    : ctx.measureText(s).width;
  ctx.restore();
  return w;
}

/**
 * Line-mask reveal: the line rises from inside a clip rectangle, so it never shows
 * above its baseline box. p ∈ [0,1]: 0 hidden, 1 in place. Used for every headline.
 */
export function maskLine(ctx, s, x, y, p, opts = {}) {
  const size = opts.size ?? 40;
  if (p <= 0) return;
  const w = measure(ctx, s, opts) + 20;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 10, y - size * 1.05, w + 20, size * 1.4);
  ctx.clip();
  txt(ctx, s, x, y + (1 - clamp(p)) * size * 1.15, opts);
  ctx.restore();
}

/** Wipe: a left-to-right reveal of a rectangle's contents (cards arriving). */
export function wipeRect(ctx, x, y, w, h, p) {
  ctx.beginPath();
  ctx.rect(x, y, w * clamp(p), h);
  ctx.clip();
}

export function bg(ctx) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, W, H);
  // Structural grid: a drafting surface, not decoration. Very low contrast.
  ctx.save();
  ctx.strokeStyle = 'rgba(244,241,234,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 108) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 108) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  ctx.restore();
}

/** A cubic cable from (x0,y0) to (x1,y1), horizontal tangents. Returns the four control points. */
export function cable(x0, y0, x1, y1, bend = 0.5) {
  const mx = lerp(x0, x1, bend);
  return [x0, y0, mx, y0, mx, y1, x1, y1];
}

export function cableAt(c, u) {
  return [bez(c[0], c[2], c[4], c[6], u), bez(c[1], c[3], c[5], c[7], u)];
}

export function strokeCable(ctx, c, color, { width = 3, a = 1, dash = null, dashOffset = 0, from = 0, to = 1 } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset; }
  ctx.beginPath();
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const u = lerp(from, to, i / N);
    const [x, y] = cableAt(c, u);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A packet: a solid dot with a short fading tail, moving along a cable. u ∈ [0,1]. */
export function packet(ctx, c, u, color, { r = 9, tail = 0.12, a = 1 } = {}) {
  if (u < 0 || u > 1 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  for (let i = 4; i >= 1; i--) {
    const uu = clamp(u - (tail * i) / 4);
    const [x, y] = cableAt(c, uu);
    ctx.globalAlpha = a * (1 - i / 5) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r * (1 - i / 6), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = a;
  const [x, y] = cableAt(c, u);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Simple geometric icons drawn in code (no image assets). */
export function icon(ctx, kind, cx, cy, s, color, a = 1) {
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.09;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'tools') {
    // a bolt: the thing a model does
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.15, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.08);
    ctx.lineTo(cx - s * 0.02, cy + s * 0.08);
    ctx.lineTo(cx - s * 0.15, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.02, cy - s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'resources') {
    // a stack of documents: things the app reads
    for (let i = 2; i >= 0; i--) {
      ctx.globalAlpha = a * (i === 0 ? 1 : 0.45);
      ctx.strokeRect(cx - s * 0.32 + i * s * 0.08, cy - s * 0.42 + i * s * 0.08, s * 0.5, s * 0.66);
    }
  } else if (kind === 'prompts') {
    // a chat bubble with a slash: a template you pick
    ctx.beginPath();
    ctx.roundRect(cx - s * 0.45, cy - s * 0.36, s * 0.9, s * 0.62, s * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy + s * 0.26);
    ctx.lineTo(cx - s * 0.2, cy + s * 0.44);
    ctx.lineTo(cx + s * 0.02, cy + s * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, cy - s * 0.08);
    ctx.lineTo(cx + s * 0.12, cy - s * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

/** Small pill label. Returns its width. */
export function pill(ctx, label, x, y, { h = 58, color = C.amber, textColor = C.ink, size = 26, fam = F.monoB, a = 1, track = 2, padX = 26 } = {}) {
  const w = measure(ctx, label, { fam, size, track }) + padX * 2;
  fillRR(ctx, x, y, w, h, h / 2, color, a);
  txt(ctx, label, x + w / 2, y + h / 2 + size * 0.36, { fam, size, color: textColor, align: 'center', a, track });
  return w;
}
