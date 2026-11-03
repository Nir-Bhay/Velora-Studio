// mcp-video/film-v5.mjs — "How MCP works", v5: the aurora redesign.
//
// Same idea, narration, sound and sync points as v3/v4. The picture is redesigned:
//   · a light aurora background (violet → indigo → navy, with warm and mint glows), not flat black
//   · frosted-glass surfaces (translucent fill, sheen, rim light, soft shadow) instead of outlines
//   · gradient accents (peach → pink for you, mint → teal for "yes") with a glow
//   · a chat UI with proper bubble tails, avatars and a typing state
//   · spring transitions with a small overshoot, pop-in with scale, and a morphing layout
//
// The film is drawn on a canvas, so the "CSS" lives in code here: one design-token block (K),
// and a few component functions (glass, bubble, pill, button, toggle). Nothing remembers a previous frame.

import { createCanvas } from '@napi-rs/canvas';
import { W, H, DUR, SCENES, LOOP_DISSOLVE_FROM } from './brand.mjs';
import { clamp, lerp, prog, outCubic, inOutCubic, sp, keyed } from './lib/ease.mjs';

// ─── design tokens ────────────────────────────────────────────────────────────
// One place for colour, type and rhythm. Change values here, not in the components.
export const K = {
  // aurora background
  bgTop: '#6B5CE7',
  bgMid: '#3B2F9E',
  bgLow: '#1D2F7A',
  bgBottom: '#17275F',
  glowWarm: 'rgba(255,179,107,0.55)',
  glowMint: 'rgba(94,234,212,0.40)',
  glowPink: 'rgba(255,122,182,0.28)',
  // text
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.74)',
  textDark: '#2A1433',
  // accents (gradients are pairs)
  peach: '#FFB36B',
  pink: '#FF7AB6',
  mint: '#5EEAD4',
  teal: '#22C3A6',
  violet: '#B9A6FF',
  sky: '#8FD8FF',
  // glass
  glassFill: 'rgba(255,255,255,0.16)',
  glassSheenTop: 'rgba(255,255,255,0.26)',
  glassSheenBot: 'rgba(255,255,255,0.05)',
  glassRim: 'rgba(255,255,255,0.55)',
  shadow: 'rgba(12,6,40,0.38)',
  // rhythm
  r: { sm: 16, md: 24, lg: 32, pill: 999 },
  fam: { head: 'InterBlack', semi: 'InterSemi', med: 'InterMed', mono: 'JBMono', monoB: 'JBBold' },
};

// Sync points, in seconds (the same as v3 and v4, so the approved audio lines up unchanged).
export const TIMING = {
  steps: [15.48, 17.25, 18.82, 20.09],
  tapHaan: 28.2,
  plugClick: 33.0,
};

// ─── layout (1080 × 1920) ─────────────────────────────────────────────────────
const APPS = [
  { label: 'Chat AI', ini: 'C', color: K.peach },
  { label: 'Writer AI', ini: 'W', color: K.pink },
  { label: 'Photo AI', ini: 'P', color: K.violet },
  { label: 'Code AI', ini: 'K', color: K.mint },
];
const TOOLS = ['Mail', 'Calendar', 'Weather', 'Notes', 'Music', 'Photos', 'Files', 'Pay', 'Shop', 'Videos', 'Alarms', 'Contacts'];

const appGrid = (i) => ({ x: 60 + (i % 2) * 500, y: 640 + Math.floor(i / 2) * 176, w: 460, h: 148 });
const appCol = (i) => ({ x: 60, y: 640 + i * 150, w: 280, h: 122 });
const toolGrid = (j) => ({ x: 60 + (j % 4) * 240, y: 1080 + Math.floor(j / 4) * 100, w: 220, h: 68 });
const toolCol = (j) => ({ x: 780, y: 640 + j * 68, w: 240, h: 56 });
const SOCK = { x: 380, y: 860, w: 300, h: 124 };
const sockL = () => ({ x: SOCK.x, y: SOCK.y + SOCK.h / 2 });
const sockR = () => ({ x: SOCK.x + SOCK.w, y: SOCK.y + SOCK.h / 2 });
const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });

// ─── colour helpers ───────────────────────────────────────────────────────────
function mix(c0, c1, k) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = h(c0), b = h(c1);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))).toString(16).padStart(2, '0')).join('');
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

// ─── shapes ───────────────────────────────────────────────────────────────────
/** Rounded rect. side: 'left' | 'right' gives a chat bubble with a tail corner (small radius on that side). */
function shape(ctx, x, y, w, h, r, side = null) {
  const rBL = side === 'left' ? 6 : r;
  const rBR = side === 'right' ? 6 : r;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - rBR);
  ctx.arcTo(x + w, y + h, x + w - rBR, y + h, rBR);
  ctx.lineTo(x + rBL, y + h);
  ctx.arcTo(x, y + h, x, y + h - rBL, rBL);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Frosted glass: translucent fill, a top-to-bottom sheen, a rim light, and a soft shadow. */
function glass(ctx, x, y, w, h, r, a = 1, side = null) {
  if (a <= 0 || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.shadowColor = K.shadow;
  ctx.shadowBlur = 42;
  ctx.shadowOffsetY = 16;
  shape(ctx, x, y, w, h, r, side);
  ctx.fillStyle = K.glassFill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  shape(ctx, x, y, w, h, r, side);
  ctx.fillStyle = grad(ctx, 0, y, 0, y + h, [[0, K.glassSheenTop], [1, K.glassSheenBot]]);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = grad(ctx, 0, y, 0, y + h, [[0, K.glassRim], [0.5, 'rgba(255,255,255,0.10)'], [1, 'rgba(255,255,255,0.28)']]);
  ctx.stroke();
  ctx.restore();
}

/** A solid gradient surface with a coloured glow (the primary action, the user's bubble). */
function solid(ctx, x, y, w, h, r, stops, a = 1, side = null, glowColor = null) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 36;
    ctx.shadowOffsetY = 10;
  }
  shape(ctx, x, y, w, h, r, side);
  ctx.fillStyle = grad(ctx, x, y, x + w, y + h, stops);
  ctx.fill();
  ctx.restore();
}

function label(ctx, s, x, y, { size = 36, fam = K.fam.semi, color = K.text, align = 'left', a = 1, track = 0 } = {}) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.font = `${size}px ${fam}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${track}px`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

function measure(ctx, s, { size = 36, fam = K.fam.semi } = {}) {
  ctx.save();
  ctx.font = `${size}px ${fam}`;
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

function dot(ctx, x, y, r, color, a = 1, glow = false) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** A four-point sparkle: the AI's mark. */
function sparkle(ctx, cx, cy, s, color, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.quadraticCurveTo(cx + s * 0.18, cy - s * 0.18, cx + s, cy);
  ctx.quadraticCurveTo(cx + s * 0.18, cy + s * 0.18, cx, cy + s);
  ctx.quadraticCurveTo(cx - s * 0.18, cy + s * 0.18, cx - s, cy);
  ctx.quadraticCurveTo(cx - s * 0.18, cy - s * 0.18, cx, cy - s);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Line icons for steps: ask, list, work, done. Drawn with paths, in ink on a bright badge. */
function glyph(ctx, kind, cx, cy, s, color, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'ask') {
    ctx.font = `${Math.round(s * 1.3)}px ${K.fam.head}`;
    ctx.textAlign = 'center';
    ctx.fillText('?', cx, cy + s * 0.42);
  } else if (kind === 'list') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx - s * 0.38, cy + i * s * 0.4, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.18, cy + i * s * 0.4);
      ctx.lineTo(cx + s * 0.38, cy + i * s * 0.4);
      ctx.stroke();
    }
  } else if (kind === 'work') {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.18, cy - s * 0.5);
    ctx.lineTo(cx - s * 0.3, cy + s * 0.08);
    ctx.lineTo(cx - s * 0.02, cy + s * 0.08);
    ctx.lineTo(cx - s * 0.16, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.3, cy - s * 0.1);
    ctx.lineTo(cx + s * 0.02, cy - s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'done') {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.38, cy - s * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── components ───────────────────────────────────────────────────────────────
/** A pill chip: a glass capsule with a glowing dot and a label. */
function chip(ctx, x, y, w, h, text, { dotColor = K.mint, a = 1, size = 26 } = {}) {
  if (a <= 0) return;
  glass(ctx, x, y, w, h, h / 2, a);
  dot(ctx, x + 26, y + h / 2, 7, dotColor, a, true);
  label(ctx, text, x + 46, y + h / 2 + size * 0.36, { size, fam: K.fam.monoB, a });
}

/** An app card: glass, a gradient initial badge, the name, and a line of plain text. */
function appCard(ctx, r, app, a) {
  if (a <= 0) return;
  glass(ctx, r.x, r.y, r.w, r.h, K.r.md + 4, a);
  const bx = r.x + 24, by = r.y + r.h / 2 - 34;
  solid(ctx, bx, by, 68, 68, 22, [[0, app.color], [1, mix(app.color, '#FFFFFF', 0.35)]], a, null, app.color);
  label(ctx, app.ini, bx + 34, by + 46, { size: 36, fam: K.fam.head, color: K.textDark, align: 'center', a });
  label(ctx, app.label, bx + 92, r.y + r.h / 2 - 2, { size: 34, fam: K.fam.semi, a });
  label(ctx, '12 tools', bx + 92, r.y + r.h / 2 + 34, { size: 22, fam: K.fam.mono, color: K.textSoft, a });
}

function socket(ctx, a) {
  if (a <= 0) return;
  solid(ctx, SOCK.x, SOCK.y, SOCK.w, SOCK.h, SOCK.h / 2, [[0, K.peach], [1, K.pink]], a, null, 'rgba(255,122,182,0.6)');
  label(ctx, 'MCP', SOCK.x + SOCK.w / 2, SOCK.y + SOCK.h / 2 + 24, { size: 60, fam: K.fam.head, color: K.textDark, align: 'center', a });
}

/** The chat bubble: user (gradient) or AI (glass). Pops in with a small overshoot and a scale-up. */
function bubble(ctx, t, t0, x, y, w, h, side, lines, { mine = false } = {}) {
  const p = sp(t, t0, 0.72, 2.8);
  if (p <= 0.001) return;
  const a = clamp(p);
  const s = 0.92 + 0.08 * p;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save();
  ctx.translate(cx, cy + (1 - a) * 28);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  if (mine) {
    solid(ctx, x, y, w, h, K.r.lg, [[0, K.peach], [1, K.pink]], a, side, 'rgba(255,122,182,0.45)');
  } else {
    glass(ctx, x, y, w, h, K.r.lg, a, side);
  }
  for (const ln of lines) {
    label(ctx, ln.s, x + 36, y + ln.dy, { size: ln.size, fam: ln.fam, color: mine ? K.textDark : (ln.color || K.text), a });
  }
  ctx.restore();
}

/** Three dots: the AI is "typing" for the 0.35 s before each message. */
function typing(ctx, t, tEnd, x, y) {
  const a = prog(t, tEnd - 0.4, tEnd - 0.22) * (1 - prog(t, tEnd - 0.04, tEnd));
  if (a <= 0) return;
  for (let i = 0; i < 3; i++) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 14 - i * 1.2);
    dot(ctx, x + i * 22, y, 7, K.text, a * (0.35 + 0.65 * pulse));
  }
}

function chatHeader(ctx, t, a) {
  if (a <= 0) return;
  glass(ctx, 60, 560, 960, 84, 42, a);
  solid(ctx, 92, 586, 52, 52, 26, [[0, K.peach], [1, K.pink]], a, null, 'rgba(255,122,182,0.5)');
  sparkle(ctx, 118, 612, 15, K.textDark, a);
  label(ctx, 'Chat AI', 168, 606, { size: 34, fam: K.fam.semi, a });
  dot(ctx, 172 + measure(ctx, 'Chat AI', { size: 34 }) + 14, 600, 6, K.mint, a, true);
  label(ctx, 'online · MCP se jud-a hai', 168, 634, { size: 22, fam: K.fam.mono, color: K.textSoft, a });
}

/** A settings row: a glass card, a coloured dot, a name, a line of plain text, and a gradient toggle. */
function settingsRow(ctx, r, name, sub, on, a, accent = K.mint) {
  if (a <= 0) return;
  glass(ctx, r.x, r.y, r.w, r.h, K.r.md, a);
  dot(ctx, r.x + 40, r.y + r.h / 2, 10, accent, a, true);
  label(ctx, name, r.x + 66, r.y + 40, { size: 36, fam: K.fam.semi, a });
  label(ctx, sub, r.x + 66, r.y + 68, { size: 22, fam: K.fam.mono, color: K.textSoft, a });
  // toggle
  const tx = r.x + r.w - 136, ty = r.y + r.h / 2 - 25, tw = 100, th = 50;
  const k = clamp(on);
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  shape(ctx, tx, ty, tw, th, 25);
  ctx.fillStyle = k > 0.01 ? grad(ctx, tx, ty, tx + tw, ty, [[0, mix('#FFFFFF', K.mint, k)], [1, mix('#FFFFFF', K.teal, k)]]) : 'rgba(255,255,255,0.26)';
  ctx.fill();
  ctx.restore();
  dot(ctx, tx + 25 + k * 50, ty + 25, 20, '#FFFFFF', a);
}

// ─── the aurora background ────────────────────────────────────────────────────
function background(ctx, t) {
  ctx.fillStyle = grad(ctx, 0, 0, W * 0.35, H, [[0, K.bgTop], [0.42, K.bgMid], [0.8, K.bgLow], [1, K.bgBottom]]);
  ctx.fillRect(0, 0, W, H);
  // three slow glows that drift deterministically with t (no state)
  const glow = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  glow(220 + 40 * Math.sin(t * 0.31), 380 + 30 * Math.cos(t * 0.23), 640, K.glowWarm);
  glow(900 + 30 * Math.cos(t * 0.27), 1320 + 36 * Math.sin(t * 0.21), 720, K.glowMint);
  glow(540 + 50 * Math.sin(t * 0.17), 980 + 40 * Math.cos(t * 0.19), 980, K.glowPink);
}

// ─── world: the apps, the plug, the waiter, the settings ─────────────────────
function world(ctx, t) {
  // 1 · the problem: 48 wires (each app to each tool), faded out fast as the cards start to move.
  const tangle = 1 - prog(t, 5.9, 6.4);
  if (tangle > 0) {
    for (let i = 0; i < APPS.length; i++) {
      const g = appGrid(i);
      for (let j = 0; j < TOOLS.length; j++) {
        const q = toolGrid(j);
        const wob = Math.sin(t * 1.1 + i * 1.3 + j * 0.7) * 5;
        wire(ctx, { x: g.x + g.w / 2, y: g.y + g.h }, { x: q.x + q.w / 2, y: q.y }, 'rgba(255,255,255,0.5)', tangle * 0.5, { width: 2, wob });
      }
    }
  }

  // 2 · one shape: the apps and tools morph into two columns around one plug (6.4–7.4 s), then hold.
  const fold = inOutCubic(prog(t, 6.4, 7.4));
  const cardsA = 1 - prog(t, 9.3, 9.9);
  const spokeGrow = t < 20 ? prog(t, 6.4, 7.4) : 1;
  const spokesA = prog(t, 6.3, 6.8) * cardsA;
  if (spokesA > 0) {
    for (let i = 0; i < APPS.length; i++) {
      const c = lerpR(appGrid(i), appCol(i), fold);
      wire(ctx, { x: c.x + c.w, y: c.y + c.h / 2 }, sockL(), K.peach, spokesA * 0.85, { width: 4, grow: spokeGrow });
    }
    for (let j = 0; j < TOOLS.length; j++) {
      const q = lerpR(toolGrid(j), toolCol(j), fold);
      wire(ctx, sockR(), { x: q.x, y: q.y + q.h / 2 }, K.mint, spokesA * 0.85, { width: 4, grow: spokeGrow });
    }
  }
  if (cardsA > 0) {
    for (let i = 0; i < APPS.length; i++) appCard(ctx, lerpR(appGrid(i), appCol(i), fold), APPS[i], cardsA);
    for (let j = 0; j < TOOLS.length; j++) {
      const r = lerpR(toolGrid(j), toolCol(j), fold);
      chip(ctx, r.x, r.y, r.w, r.h, TOOLS[j], { a: cardsA, size: 24 });
    }
  }
  socket(ctx, prog(t, 6.3, 6.8) * cardsA);

  // 3 · the waiter, as a chat: your bubble, the AI bubble, then the order slip to the kitchen card.
  const wA = prog(t, 9.9, 10.3) * (1 - prog(t, 14.8, 15.2));
  if (wA > 0) {
    chatHeader(ctx, t, wA);
    bubble(ctx, t, 10.2, 380, 690, 640, 88, 'right', [{ s: 'Kal ka weather batao', dy: 56, size: 36, fam: K.fam.semi }], { mine: true });
    bubble(ctx, t, 11.8, 60, 830, 540, 88, 'left', [{ s: 'Order le liya.', dy: 56, size: 34, fam: K.fam.semi }]);

    // the kitchen: one glass card holding three chips (the slip never lands on a label)
    const kA = prog(t, 10.8, 11.2) * wA;
    glass(ctx, 60, 1040, 960, 296, K.r.lg, kA);
    label(ctx, 'Kitchen', 100, 1106, { size: 40, fam: K.fam.head, color: K.text, a: kA });
    label(ctx, 'tools yahan kaam karte hain', 100, 1140, { size: 22, fam: K.fam.mono, color: K.textSoft, a: kA });
    const picked = prog(t, 13.3, 13.6);
    ['Mail', 'Weather', 'Files'].forEach((name, i) => {
      const x = 100 + i * 300;
      const on = i === 1 ? picked : 0;
      if (on > 0) solid(ctx, x, 1170, 260, 84, 42, [[0, K.mint], [1, K.teal]], on * kA, null, 'rgba(94,234,212,0.5)');
      glass(ctx, x, 1170, 260, 84, 42, kA * (1 - on));
      label(ctx, name, x + 130, 1222, { size: 28, fam: K.fam.monoB, color: on > 0.5 ? K.textDark : K.text, align: 'center', a: kA });
    });
    label(ctx, 'Order mila.', 100, 1312, { size: 30, fam: K.fam.semi, color: K.mint, a: picked * kA });

    // the slip rides from your bubble, to the AI bubble, to the kitchen card
    const s1 = prog(t, 10.6, 11.8);
    const s2 = prog(t, 12.0, 13.2);
    const slipA = prog(t, 10.5, 10.7) * (1 - prog(t, 13.2, 13.4)) * wA;
    if (slipA > 0) {
      const sx = s2 > 0 ? lerp(330, 450, s2) : lerp(760, 330, s1);
      const sy = s2 > 0 ? lerp(960, 1212, s2) : lerp(800, 960, s1);
      glass(ctx, sx - 110, sy - 48, 220, 96, 22, slipA);
      label(ctx, 'ORDER', sx, sy - 4, { size: 30, fam: K.fam.head, align: 'center', a: slipA });
      label(ctx, 'kal ka weather', sx, sy + 28, { size: 20, fam: K.fam.mono, color: K.textSoft, align: 'center', a: slipA });
    }
  }

  // 4 · the settings: toggles on. Maps slides in from the right and its toggle switches on at 33.0 s.
  const setA = prog(t, 30.8, 31.1);
  if (setA > 0) {
    glass(ctx, 60, 560, 960, 84, 42, setA);
    label(ctx, 'Tools', 104, 604, { size: 38, fam: K.fam.semi, a: setA });
    label(ctx, 'AI ko kaun se tools mil sakte hain', 104, 634, { size: 22, fam: K.fam.mono, color: K.textSoft, a: setA });
    const rows = [
      ['Mail', 'kaam karta hai'], ['Calendar', 'kaam karta hai'], ['Weather', 'kaam karta hai'], ['Notes', 'kaam karta hai'],
      ['Music', 'kaam karta hai'], ['Photos', 'kaam karta hai'], ['Pay', 'kaam karta hai'],
    ];
    rows.forEach(([name, sub], i) => settingsRow(ctx, { x: 60, y: 680 + i * 100, w: 960, h: 84 }, name, sub, 1, setA));
    // the new one
    const drop = outCubic(prog(t, 31.5, 32.2));
    const nA = prog(t, 31.5, 31.7) * setA;
    const on = sp(t, TIMING.plugClick, 0.72, 2.8);
    if (nA > 0) {
      const r = { x: 60 + (1 - drop) * 240, y: 1380, w: 960, h: 84 };
      settingsRow(ctx, r, 'Maps', 'nayi plug', clamp(on), nA, K.peach);
      const badgeA = prog(t, TIMING.plugClick, TIMING.plugClick + 0.3) * nA;
      if (badgeA > 0) {
        solid(ctx, r.x + 230, r.y + 20, 96, 38, 19, [[0, K.peach], [1, K.pink]], badgeA, null, 'rgba(255,122,182,0.45)');
        label(ctx, 'NAYA', r.x + 278, r.y + 46, { size: 24, fam: K.fam.monoB, color: K.textDark, align: 'center', a: badgeA });
      }
      const ring = prog(t, TIMING.plugClick, TIMING.plugClick + 0.6);
      if (ring > 0 && ring < 1) dot(ctx, r.x + r.w - 86, r.y + r.h / 2, 30 + 46 * ring, K.mint, 0.5 * (1 - ring));
    }
  }
}

/** A plain line between two points, with a cable curve. Glowing, no outline. */
function wire(ctx, p0, p1, color, a, { width = 3, grow = 1, bend = 0.5, wob = 0 } = {}) {
  if (a <= 0 || grow <= 0) return;
  const x0 = p0.x, y0 = p0.y + wob, x1 = p1.x, y1 = p1.y - wob;
  const mx = lerp(x0, x1, bend);
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  // grow along the cable: sample the bezier up to `grow`
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const u = (i / steps) * clamp(grow);
    const bx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * mx + u * u * x1;
    const by = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * ((y0 + y1) / 2) + u * u * y1;
    ctx.lineTo(bx, by);
  }
  ctx.stroke();
  ctx.restore();
}

// ─── screen: headlines, captions, counter, steps, choice ─────────────────────
/** A headline that rises from a mask and leaves short and early. */
function headline(ctx, t, lines, tIn, tOut, y0, size = 84) {
  lines.forEach((s, i) => {
    const pin = sp(t, tIn + i * 0.08, 0.8, 2.6);
    const pout = 1 - prog(t, tOut, tOut + 0.25);
    const p = Math.min(pin, pout);
    if (p <= 0.001) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(60, y0 + i * size * 1.08 - size * 1.05, 960, size * 1.4);
    ctx.clip();
    label(ctx, s, 72, y0 + i * size * 1.08 + (1 - clamp(p)) * size * 1.15, { size, fam: K.fam.head, color: K.text });
    ctx.restore();
  });
}

// On-screen words in Roman Hinglish. Same copy as v3 and v4.
const CAPTIONS = [
  [0.2, 5.6, ['Har AI app ko har tool se', 'alag jodna padta hai.']],
  [6.2, 9.8, ['MCP = ek common plug', 'jaise phone ka charger']],
  [10.2, 14.8, ['Aap order dete ho.', 'Waiter kitchen tak le jaata hai.']],
  [25.4, 30.6, ['AI sirf suggest karta hai.', 'Aap haan kaho, tabhi kaam hota hai.']],
  [31.2, 34.6, ['Naya tool? Bas ek aur plug.']],
  [35.2, 38.8, ['Har app ka alag plug? Ab nahi.']],
];

function captions(ctx, t) {
  for (const [t0, t1, lines] of CAPTIONS) {
    if (t < t0 || t > t1) continue;
    const out = 1 - prog(t, t1 - 0.2, t1);
    lines.forEach((s, i) => {
      const p = sp(t, t0 + i * 0.06, 0.8, 2.8);
      const y = 1520 + i * 64;
      const w = measure(ctx, s, { size: 42, fam: K.fam.semi }) + 52;
      const a = clamp(p) * out;
      if (a > 0) {
        ctx.save();
        ctx.globalAlpha *= a;
        shape(ctx, 60, y - 50, w, 64, 32);
        ctx.fillStyle = 'rgba(18,8,48,0.42)';
        ctx.fill();
        ctx.restore();
      }
      label(ctx, s, 86, y, { size: 42, fam: K.fam.semi, a: clamp(p) * out });
    });
  }
}

/** The number of connections: 48 (the problem), 16 (one plug), 17 (with the new tool). */
function counter(ctx, t) {
  const a = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.8, 31.1));
  if (a <= 0) return;
  let n;
  if (t < 6.4) n = Math.round(48 * outCubic(prog(t, 0.2, 1.4)));
  else if (t < 7.4) n = Math.round(lerp(48, 16, outCubic(prog(t, 6.4, 7.4))));
  else if (t < 33.0) n = 16;
  else n = 17;
  const g = grad(ctx, 800, 380, 1008, 500, [[0, K.peach], [1, K.pink]]);
  label(ctx, String(n).padStart(2, '0'), 1008, 470, { size: 150, fam: K.fam.head, color: g, align: 'right', a });
  label(ctx, 'connections', 1008, 524, { size: 26, fam: K.fam.monoB, color: K.textSoft, align: 'right', track: 1, a });
}

/** The steps as chat messages: each one arrives on its spoken word, with a typing state first. */
function steps(ctx, t) {
  const out = 1 - prog(t, 24.8, 25.2);
  if (out <= 0) return;
  ctx.save();
  ctx.globalAlpha = out;
  bubble(ctx, t, 15.2, 340, 680, 680, 150, 'right', [
    { s: 'Kal ka weather batao,', dy: 66, size: 34, fam: K.fam.semi },
    { s: 'aur Ravi ko message bhejo.', dy: 114, size: 34, fam: K.fam.semi },
  ], { mine: true });

  typing(ctx, t, TIMING.steps[0], 96, 930);
  bubble(ctx, t, TIMING.steps[0], 60, 880, 660, 112, 'left', [
    { s: '1 · AI POOCHTA HAI', dy: 40, size: 24, fam: K.fam.monoB, color: K.peach },
    { s: 'Tum kya kar sakte ho?', dy: 86, size: 34, fam: K.fam.semi },
  ]);

  typing(ctx, t, TIMING.steps[1], 96, 1100);
  const tA = sp(t, TIMING.steps[1], 0.72, 2.8);
  if (tA > 0.001) {
    bubble(ctx, t, TIMING.steps[1], 60, 1040, 780, 150, 'left', [
      { s: '2 · TOOL BATATA HAI', dy: 40, size: 24, fam: K.fam.monoB, color: K.mint },
    ]);
    ['Mail', 'Calendar', 'Weather'].forEach((name, i) => chip(ctx, 96 + i * 240, 1098, 220, 64, name, { a: clamp(tA), size: 24 }));
  }

  typing(ctx, t, TIMING.steps[2], 96, 1282);
  const wkA = sp(t, TIMING.steps[2], 0.72, 2.8);
  if (wkA > 0.001) {
    bubble(ctx, t, TIMING.steps[2], 60, 1220, 780, 150, 'left', [
      { s: '3 · KAAM HOTA HAI', dy: 40, size: 24, fam: K.fam.monoB, color: K.mint },
      { s: 'Weather mila. Ravi ko message gaya.', dy: 86, size: 28, fam: K.fam.mono },
    ]);
    const bar = prog(t, TIMING.steps[2] + 0.2, TIMING.steps[2] + 1.0);
    const bx = 96, by = 1322, bw = 700;
    glass(ctx, bx, by, bw, 14, 7, clamp(wkA) * 0.9);
    if (bar > 0) solid(ctx, bx, by, bw * bar, 14, 7, [[0, K.mint], [1, K.teal]], clamp(wkA), null, 'rgba(94,234,212,0.6)');
  }

  typing(ctx, t, TIMING.steps[3], 96, 1466);
  bubble(ctx, t, TIMING.steps[3], 60, 1400, 660, 112, 'left', [
    { s: '4 · AI AAPKO BATATA HAI', dy: 40, size: 24, fam: K.fam.monoB, color: K.pink },
    { s: 'Ho gaya. Done.', dy: 86, size: 34, fam: K.fam.semi },
  ]);
  ctx.restore();
}

/** You decide: the AI proposes; a tap on HAAN lands at 28.2 s; then your answer and the result. */
function control(ctx, t) {
  const a = prog(t, 25.2, 25.5) * (1 - prog(t, 30.8, 31.1));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  bubble(ctx, t, 25.2, 60, 680, 960, 230, 'left', [
    { s: 'AI · SUGGESTION', dy: 40, size: 24, fam: K.fam.monoB, color: K.peach },
    { s: 'Ravi ko message bhejun?', dy: 92, size: 42, fam: K.fam.semi },
    { s: '"Kal milte hain"', dy: 142, size: 30, fam: K.fam.mono, color: K.textSoft },
    { s: 'Aap decide karo.', dy: 190, size: 26, fam: K.fam.mono, color: K.peach },
  ]);

  const gone = prog(t, 28.4, 28.7);
  const btnA = sp(t, 25.6, 0.72, 2.8) * (1 - gone);
  const haanDone = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.3);
  if (btnA > 0) {
    solid(ctx, 100, 940, 380, 120, 60, [[0, K.mint], [1, K.teal]], btnA * (1 - 0.35 * haanDone), null, 'rgba(94,234,212,0.5)');
    label(ctx, 'HAAN', 290, 1014, { size: 50, fam: K.fam.head, color: K.textDark, align: 'center', a: btnA });
    glass(ctx, 560, 940, 380, 120, 60, btnA * (1 - 0.6 * haanDone));
    label(ctx, 'NAHI', 750, 1014, { size: 50, fam: K.fam.head, align: 'center', a: btnA * (1 - 0.6 * haanDone) });
  }

  // the cursor: a glass pointer that travels to HAAN and rings on the tap
  const tapU = inOutCubic(prog(t, 27.2, TIMING.tapHaan));
  if (t >= 27.2 && t < TIMING.tapHaan + 0.6) {
    const cx = lerp(900, 290, tapU);
    const cy = lerp(1330, 1000, tapU);
    dot(ctx, cx, cy, 26, '#FFFFFF', 0.9 * a);
    const ring = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.5);
    if (ring > 0) dot(ctx, 290, 1000, 40 + 120 * ring, K.mint, 0.45 * (1 - ring));
  }

  bubble(ctx, t, 28.5, 620, 1120, 400, 96, 'right', [{ s: 'HAAN', dy: 62, size: 40, fam: K.fam.head }], { mine: true });
  bubble(ctx, t, 28.9, 60, 1260, 760, 150, 'left', [
    { s: 'Bhej diya.', dy: 62, size: 40, fam: K.fam.semi, color: K.mint },
    { s: 'Ravi ko message gaya.', dy: 112, size: 28, fam: K.fam.mono },
  ]);
  ctx.restore();
}

// ─── the frame ────────────────────────────────────────────────────────────────
function chrome(ctx, t) {
  const text = 'How MCP works';
  const tw = measure(ctx, text, { size: 26, fam: K.fam.monoB });
  const w = tw + 84;
  glass(ctx, 540 - w / 2, 120, w, 60, 30, 1);
  dot(ctx, 540 - w / 2 + 34, 150, 8, K.mint, 1, true);
  label(ctx, text, 540 + 12, 160, { size: 26, fam: K.fam.monoB, align: 'center', track: 1 });

  const p = clamp(t / DUR);
  glass(ctx, 60, 1858, 960, 12, 6, 0.8);
  if (p > 0) solid(ctx, 60, 1858, 960 * p, 12, 6, [[0, K.peach], [1, K.pink]], 1, null, 'rgba(255,122,182,0.5)');
  const idx = Math.max(0, SCENES.findIndex((s) => t >= s.t0 && t < s.t1));
  label(ctx, `${String(idx + 1).padStart(2, '0')} / ${String(SCENES.length).padStart(2, '0')}`, 60, 1836, { size: 24, fam: K.fam.mono, color: K.textSoft });
  const sec = Math.floor(t);
  const frac = Math.floor((t - sec) * 10);
  label(ctx, `0:${String(sec).padStart(2, '0')}.${frac} / 0:40`, 1020, 1836, { size: 24, fam: K.fam.mono, color: K.textSoft, align: 'right' });
}

function headlines(ctx, t) {
  headline(ctx, t, ['48 alag', 'connections?'], 0.1, 5.8, 330);
  headline(ctx, t, ['Ek plug.', 'Sab jagah.'], 6.2, 9.8, 330);
  headline(ctx, t, ['Waiter ki', 'tarah.'], 10.2, 14.8, 330);
  headline(ctx, t, ['Ek request,', '4 kadam.'], 15.2, 24.8, 330);
  headline(ctx, t, ['AI suggest', 'karta hai.'], 25.2, 30.8, 330);
  headline(ctx, t, ['Naya tool?'], 31.2, 34.8, 330);
  headline(ctx, t, ['Ab nahi.'], 35.2, 40.0, 380, 120);
}

/** One full paint at time t (no loop handling). */
function paint(ctx, t) {
  background(ctx, t);
  world(ctx, t);
  headlines(ctx, t);
  counter(ctx, t);
  steps(ctx, t);
  control(ctx, t);
  captions(ctx, t);
  chrome(ctx, t);
}

// Scratch canvases for the loop dissolve, allocated once.
const scratchA = createCanvas(W, H);
const scratchB = createCanvas(W, H);

/**
 * draw(ctx, t): the frame at t. The final half-second dissolves into frame 0,
 * so frame DUR and frame 0 are identical and the film repeats without a seam.
 */
export function draw(ctx, t) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  if (t <= LOOP_DISSOLVE_FROM) {
    paint(ctx, t);
    ctx.restore();
    return;
  }
  const a = inOutCubic(prog(t, LOOP_DISSOLVE_FROM, DUR));
  const A = scratchA.getContext('2d');
  const B = scratchB.getContext('2d');
  A.globalAlpha = 1;
  B.globalAlpha = 1;
  paint(A, t);
  paint(B, 0);
  ctx.drawImage(scratchA, 0, 0, W, H);
  ctx.globalAlpha = a;
  ctx.drawImage(scratchB, 0, 0, W, H);
  ctx.restore();
}
