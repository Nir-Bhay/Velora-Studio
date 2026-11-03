// mcp-video/film.mjs — "How MCP works", v3. For people who use AI apps and don't know what is behind them.
//
// v3 changes (picture and on-screen words only; the narration clips and the sound events are unchanged):
//   · wires are drawn BEFORE the tiles, so cables never cross a label
//   · larger labels, real column headers ("AI APPS" / "TOOLS"), a counter that says "connections"
//   · the waiter scene is a clean three-stop diagram: person → AI → kitchen; the order slip ends at the kitchen door
//   · step cards carry small glyphs; the choice card has an AI avatar and a proper result state
//   · the new tool carries a NAYA badge and clicks into the socket on the voice's word
//
// draw(ctx, t) paints exactly one instant. No state, no clocks. The last half-second dissolves into
// frame 0, so the film loops with no end card.
//
// Story, in plain words: 4 AI apps × 12 tools = 48 connections. MCP is one common plug.
// Like a waiter: you order, the waiter takes it to the kitchen on a standard slip.
// The AI asks what a tool can do, the tool answers, the work gets done, and the AI tells you.
// The AI only suggests. You say haan. A new tool is one more plug. Then the loop closes.

import { createCanvas } from '@napi-rs/canvas';
import { W, H, C, F, DUR, SCENES, LOOP_DISSOLVE_FROM } from './brand.mjs';
import * as P from './lib/paint.mjs';
import { clamp, lerp, prog, outCubic, inOutCubic, sp, keyed } from './lib/ease.mjs';

// Sync points, in seconds. These match the voice clips and the sound events in brand.mjs. Do not move them
// without re-timing the audio.
export const TIMING = {
  steps: [15.48, 17.25, 18.82, 20.09], // the four step cards, one per spoken step
  tapHaan: 28.2,                       // the tap lands on "haan"
  plugClick: 33.0,                     // the new tool clicks into the socket
};

// ─── camera ───────────────────────────────────────────────────────────────────
// [t, scale, focusX, focusY]. Gentle; the world moves, the words do not.
const CAM = [
  [0.0, 1.0, 540, 960],
  [6.0, 1.04, 540, 980],   // the problem: a slow push into the wires
  [6.1, 1.0, 540, 960],    // cut on the beat to the one plug
  [15.0, 1.0, 540, 960],
  [15.4, 1.03, 540, 960],  // the steps: a small push
  [25.0, 1.0, 540, 960],
  [31.0, 1.02, 540, 960],
  [35.0, 1.0, 540, 960],
  [40.0, 1.0, 540, 960],
];

function camera(t) {
  const [s, fx, fy] = keyed(CAM, t);
  return { s, fx, fy };
}

// ─── layout (1080 × 1920, world space) ────────────────────────────────────────
// Headlines sit in y 300–560. The world lives in y 600–1400. Captions sit in y 1450–1600.
const AI_NAMES = ['Chat AI', 'Writer AI', 'Photo AI', 'Code AI'];
const AI = AI_NAMES.map((label, i) => ({ x: 60, y: 640 + i * 178, w: 260, h: 112, label }));

// 12 base tools in a 2-column grid, plus "Maps", which joins later (slot 12).
const TOOL_NAMES = ['Mail', 'Calendar', 'Weather', 'Notes', 'Music', 'Photos', 'Files', 'Pay', 'Shop', 'Videos', 'Alarms', 'Contacts', 'Maps'];
const TOOLS = TOOL_NAMES.map((label, i) => ({
  x: 700 + (i % 2) * 168,
  y: 640 + Math.floor(i / 2) * 110,
  w: 152,
  h: 96,
  label,
}));
const NEW_TOOL = 12;   // index of "Maps"
const BASE_TOOLS = 12; // indices 0..11

const SOCK = { x: 430, y: 1000, w: 200, h: 130 };
const SOCK_L = { x: SOCK.x, y: SOCK.y + SOCK.h / 2 };
const SOCK_R = { x: SOCK.x + SOCK.w, y: SOCK.y + SOCK.h / 2 };

const aiRight = (i) => ({ x: AI[i].x + AI[i].w, y: AI[i].y + AI[i].h / 2 });
const toolLeft = (j) => ({ x: TOOLS[j].x, y: TOOLS[j].y + TOOLS[j].h / 2 });

// ─── small pieces ─────────────────────────────────────────────────────────────
function tile(ctx, r, label, color, a, big = false) {
  if (a <= 0) return;
  P.fillRR(ctx, r.x, r.y, r.w, r.h, 16, C.panel2, a);
  P.strokeRR(ctx, r.x, r.y, r.w, r.h, 16, color, 3, a);
  // a small colour dot marks what kind of thing the tile is
  P.circle(ctx, r.x + 22, r.y + r.h / 2, 6, color, a);
  P.txt(ctx, label, r.x + (big ? 40 : 36), r.y + r.h / 2 + 9, {
    fam: F.monoB, size: big ? 28 : 22, color: C.paper, align: 'left', a,
  });
}

function header(ctx, s, x, y, color, a) {
  if (a <= 0) return;
  P.txt(ctx, s, x, y, { fam: F.monoB, size: 26, color, track: 3, a });
}

function wire(ctx, p0, p1, color, a, { width = 2, grow = 1, bend = 0.5, wob = 0 } = {}) {
  if (a <= 0 || grow <= 0) return;
  const c = P.cable(p0.x, p0.y + wob, p1.x, p1.y - wob, bend);
  P.strokeCable(ctx, c, color, { width, a, to: clamp(grow) });
}

function socket(ctx, a) {
  if (a <= 0) return;
  P.fillRR(ctx, SOCK.x, SOCK.y, SOCK.w, SOCK.h, 30, C.amber, a);
  P.txt(ctx, 'MCP', SOCK.x + SOCK.w / 2, SOCK.y + SOCK.h / 2 + 24, { fam: F.black, size: 66, color: C.ink, align: 'center', a });
}

/** Small line icons drawn with paths (no glyph dependency). kind: 'ask' | 'list' | 'work' | 'done'. */
function glyph(ctx, kind, cx, cy, s, color, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.strokeStyle = C.ink;
  ctx.fillStyle = C.ink;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'ask') {
    P.txt(ctx, '?', cx, cy + s * 0.34, { fam: F.black, size: s * 1.25, color: C.ink, align: 'center' });
  } else if (kind === 'list') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx - s * 0.36, cy + i * s * 0.38, s * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.18, cy + i * s * 0.38);
      ctx.lineTo(cx + s * 0.36, cy + i * s * 0.38);
      ctx.stroke();
    }
  } else if (kind === 'work') {
    P.icon(ctx, 'tools', cx, cy, s * 1.1, C.ink, 1);
  } else if (kind === 'done') {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.08, cy + s * 0.3);
    ctx.lineTo(cx + s * 0.38, cy - s * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── world: the picture ───────────────────────────────────────────────────────
function world(ctx, t) {
  // Visibility of the apps and tools: on for the problem and the plug, off for the waiter and the steps, back for the new tool.
  const tiles = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.6, 31.0));
  const tilesCol = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.6, 31.0));

  // 1 · the problem: 48 wires, 4 apps × 12 tools. They fade as the plug arrives (5.9–6.7 s).
  const tangle = 1 - prog(t, 5.9, 6.7);
  if (tangle > 0) {
    for (let i = 0; i < AI.length; i++) {
      for (let j = 0; j < BASE_TOOLS; j++) {
        const wob = Math.sin(t * 1.1 + i * 1.3 + j * 0.7) * 5;
        wire(ctx, aiRight(i), toolLeft(j), C.paper, tangle * 0.22, { width: 2, bend: 0.5, wob });
      }
    }
  }

  // 2 · one plug: the wires fold into the socket. Four spokes in, twelve spokes out.
  //     Drawn BEFORE the tiles, so the cables go under the labels and never cross the text.
  const fold = prog(t, 6.4, 7.4);
  const spokesA = Math.max(prog(t, 6.3, 6.8) * (1 - prog(t, 9.3, 9.9)), prog(t, 30.6, 31.0));
  const spokeGrow = t < 20 ? fold : 1;
  if (spokesA > 0) {
    for (let i = 0; i < AI.length; i++) wire(ctx, aiRight(i), SOCK_L, C.amber, spokesA * 0.9, { width: 3, grow: spokeGrow });
    for (let j = 0; j < BASE_TOOLS; j++) wire(ctx, SOCK_R, toolLeft(j), C.teal, spokesA * 0.9, { width: 3, grow: spokeGrow });
  }

  // Column headers (what each side is).
  header(ctx, 'AI APPS', 60, 610, C.amber, tilesCol);
  header(ctx, 'TOOLS', 700, 610, C.teal, tilesCol);

  // Apps and tools, on top of the cables.
  if (tiles > 0) {
    AI.forEach((r) => tile(ctx, r, r.label, C.amber, tiles, true));
    for (let j = 0; j < BASE_TOOLS; j++) tile(ctx, TOOLS[j], TOOLS[j].label, C.teal, tiles);
  }

  socket(ctx, Math.max(prog(t, 6.3, 6.8) * (1 - prog(t, 9.3, 9.9)), prog(t, 30.6, 31.0)));

  // 3 · like a waiter: a person, an AI "waiter", the kitchen. An order slip travels (10.5–13.6 s).
  const wA = prog(t, 9.9, 10.3) * (1 - prog(t, 14.8, 15.2));
  if (wA > 0) {
    const y = 1000;
    // the person
    P.circle(ctx, 200, 920, 46, C.paper, wA);
    P.fillRR(ctx, 150, 986, 100, 130, 46, C.paper, wA);
    P.txt(ctx, 'Aap', 200, 1170, { fam: F.black, size: 40, color: C.paper, align: 'center', a: wA });
    P.txt(ctx, 'order dete ho', 200, 1212, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: wA });

    // the AI waiter
    P.fillRR(ctx, 400, 880, 280, 240, 30, C.panel2, wA);
    P.strokeRR(ctx, 400, 880, 280, 240, 30, C.amber, 4, wA);
    P.txt(ctx, 'AI', 540, 982, { fam: F.black, size: 88, color: C.paper, align: 'center', a: wA });
    P.txt(ctx, 'waiter', 540, 1036, { fam: F.monoB, size: 28, color: C.amber, align: 'center', a: wA });
    P.txt(ctx, 'AI = waiter', 540, 1170, { fam: F.black, size: 40, color: C.paper, align: 'center', a: wA });
    P.txt(ctx, 'order lekar jaata hai', 540, 1212, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: wA });

    // the kitchen: the tools, listed (not separate tiles, so the slip never lands on a label)
    P.fillRR(ctx, 800, 880, 240, 240, 30, C.panel2, wA);
    P.strokeRR(ctx, 800, 880, 240, 240, 30, C.teal, 4, wA);
    ['Mail', 'Weather', 'Files'].forEach((s, i) => {
      P.circle(ctx, 836, 936 + i * 56, 8, C.teal, wA);
      P.txt(ctx, s, 858, 944 + i * 56, { fam: F.monoB, size: 28, color: C.paper, a: wA });
    });
    P.txt(ctx, 'Tools = kitchen', 920, 1170, { fam: F.black, size: 40, color: C.paper, align: 'center', a: wA });
    P.txt(ctx, 'kaam karte hain', 920, 1212, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: wA });

    // the two links, with the standard slip named
    wire(ctx, { x: 250, y }, { x: 400, y }, C.paper, wA * 0.6, { width: 5 });
    wire(ctx, { x: 680, y }, { x: 800, y }, C.paper, wA * 0.6, { width: 5 });
    P.pill(ctx, 'MCP', 690, 960, { h: 46, size: 22, color: C.amber, a: wA });

    // the order slip rides a dotted track above the three stops, so it never covers a label:
    // person → waiter (10.6–11.8 s), waiter → kitchen (12.0–13.2 s), then it is taken in (13.2–13.5 s)
    const track = 790;
    ctx.save();
    ctx.globalAlpha = wA * 0.35;
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = C.paper;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(200, track);
    ctx.lineTo(920, track);
    ctx.stroke();
    ctx.restore();
    const u1 = prog(t, 10.6, 11.8);
    const u2 = prog(t, 12.0, 13.2);
    const slipA = prog(t, 10.5, 10.7) * (1 - prog(t, 13.2, 13.5));
    if (slipA > 0) {
      const x = u2 > 0 ? lerp(540, 920, u2) : lerp(200, 540, u1);
      P.fillRR(ctx, x - 62, track - 40, 124, 80, 10, C.paper, slipA);
      P.txt(ctx, 'ORDER', x, track - 8, { fam: F.black, size: 24, color: C.ink, align: 'center', a: slipA });
      P.txt(ctx, 'kal ka weather', x, track + 22, { fam: F.mono, size: 16, color: C.ink, align: 'center', a: slipA });
    }
    // the kitchen door lights up when the slip arrives
    const got = prog(t, 13.2, 13.5);
    if (got > 0) P.strokeRR(ctx, 800, 880, 240, 240, 30, C.teal, 8, got * 0.5 * wA);
  }

  // 4 · the new tool: "Maps" drops in and clicks into the socket (31.5–33.6 s).
  if (t >= 31.5) {
    const drop = outCubic(prog(t, 31.5, 32.2));
    const y = lerp(560, TOOLS[NEW_TOOL].y, drop);
    const nA = prog(t, 31.5, 31.7);
    const r = { x: TOOLS[NEW_TOOL].x, y, w: TOOLS[NEW_TOOL].w, h: TOOLS[NEW_TOOL].h };
    if (t >= 33.0) wire(ctx, SOCK_R, { x: r.x, y: r.y + r.h / 2 }, C.coral, prog(t, 33.0, 33.4), { width: 3 });
    tile(ctx, r, TOOLS[NEW_TOOL].label, C.coral, nA);
    // NAYA badge on the new tile
    const badgeA = prog(t, 33.0, 33.3) * nA;
    if (badgeA > 0) P.pill(ctx, 'NAYA', r.x + r.w - 74, r.y - 22, { h: 40, size: 20, color: C.coral, a: badgeA, padX: 14 });
    const ring = prog(t, TIMING.plugClick, TIMING.plugClick + 0.6);
    if (ring > 0 && ring < 1) P.strokeRR(ctx, SOCK.x - 30 * ring, SOCK.y - 30 * ring, SOCK.w + 60 * ring, SOCK.h + 60 * ring, 50 + 30 * ring, C.amber, 4, 1 - ring);
  }
}

// ─── screen: headlines, captions, counter, steps, control ────────────────────
/** A headline that rises from a mask and leaves short and early (the content-swap rule). */
function headline(ctx, t, lines, tIn, tOut, y0, size = 84) {
  lines.forEach((s, i) => {
    const pin = sp(t, tIn + i * 0.08, 0.9, 2.6);
    const pout = 1 - prog(t, tOut, tOut + 0.25);
    const p = Math.min(pin, pout);
    if (p <= 0.001) return;
    P.maskLine(ctx, s, 72, y0 + i * size * 1.08, p, { fam: F.black, size, color: C.paper });
  });
}

// On-screen words in Roman Hinglish (the caption font has no Devanagari). Times match the voice clips.
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
      const p = sp(t, t0 + i * 0.06, 0.9, 2.8);
      const y = 1500 + i * 62;
      const w = P.measure(ctx, s, { fam: F.semi, size: 44 }) + 40;
      P.fillRR(ctx, 60, y - 50, w, 62, 14, C.ink, 0.72 * clamp(p) * out);
      ctx.save();
      ctx.globalAlpha = out;
      P.maskLine(ctx, s, 80, y, clamp(p), { fam: F.semi, size: 44, color: C.paper });
      ctx.restore();
    });
  }
}

/** The number of connections: 48 (the problem), 16 (one plug), 17 (with the new tool). */
function counter(ctx, t) {
  const a = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.6, 31.0));
  if (a <= 0) return;
  let n;
  if (t < 6.4) n = Math.round(48 * outCubic(prog(t, 0.2, 1.4)));
  else if (t < 7.4) n = Math.round(lerp(48, 16, outCubic(prog(t, 6.4, 7.4))));
  else if (t < 33.0) n = 16;
  else n = 17;
  P.txt(ctx, String(n).padStart(2, '0'), 1008, 470, { fam: F.black, size: 150, color: C.amber, align: 'right', a });
  P.txt(ctx, 'connections', 1008, 524, { fam: F.monoB, size: 26, color: C.mute, align: 'right', track: 2, a });
}

/** Steps: a question in a chat bubble, then four cards that appear on the spoken words. */
function steps(ctx, t) {
  const a = prog(t, 15.2, 15.5) * (1 - prog(t, 24.8, 25.2));
  if (a <= 0) return;
  // the user's message, as a chat bubble on the right
  P.fillRR(ctx, 160, 610, 848, 150, 30, C.panel2, a);
  P.strokeRR(ctx, 160, 610, 848, 150, 30, C.amber, 3, a);
  P.circle(ctx, 210, 660, 22, C.amber, a);
  P.txt(ctx, 'Tum', 210, 668, { fam: F.black, size: 16, color: C.ink, align: 'center', a });
  P.txt(ctx, 'Kal ka weather batao,', 252, 668, { fam: F.med, size: 38, color: C.paper, a });
  P.txt(ctx, 'aur Ravi ko message bhejo.', 252, 722, { fam: F.med, size: 38, color: C.paper, a });

  const cards = [
    { title: 'AI poochta hai', sub: 'Tum kya kar sakte ho?', color: C.amber, g: 'ask' },
    { title: 'Tool batata hai', sub: 'Mail, Weather, Calendar', color: C.teal, g: 'list' },
    { title: 'Kaam hota hai', sub: 'Weather mila. Ravi ko message gaya.', color: C.teal, g: 'work' },
    { title: 'AI aapko batata hai', sub: 'Ho gaya. Done.', color: C.coral, g: 'done' },
  ];
  cards.forEach((c, i) => {
    const p = sp(t, TIMING.steps[i], 0.9, 2.6) * (1 - prog(t, 24.8, 25.2));
    if (p <= 0.001) return;
    const y = 830 + i * 170;
    ctx.save();
    P.wipeRect(ctx, 72, y, 936, 138, p);
    P.fillRR(ctx, 72, y, 936, 138, 24, C.panel, 1);
    P.strokeRR(ctx, 72, y, 936, 138, 24, C.line, 2, 1);
    P.fillRR(ctx, 72, y, 12, 138, 6, c.color, 1);
    P.circle(ctx, 152, y + 69, 40, c.color, 1);
    glyph(ctx, c.g, 152, y + 69, 34, C.ink, 1);
    P.txt(ctx, `${i + 1}`, 232, y + 52, { fam: F.monoB, size: 24, color: c.color });
    P.txt(ctx, c.title, 232, y + 72, { fam: F.semi, size: 40, color: C.paper });
    P.txt(ctx, c.sub, 232, y + 112, { fam: F.mono, size: 26, color: C.mute });
    ctx.restore();
  });
}

/** You decide: the AI proposes, a tap says yes. */
function control(ctx, t) {
  const a = prog(t, 25.2, 25.5) * (1 - prog(t, 30.8, 31.1));
  if (a <= 0) return;
  // the result arrives after the tap, and the proposal leaves before the result enters (no ghosting)
  const pa = a * (1 - prog(t, 28.3, 28.5));
  const after = prog(t, 28.5, 28.8);

  // the AI's proposal
  P.fillRR(ctx, 72, 640, 936, 250, 28, C.panel2, pa);
  P.strokeRR(ctx, 72, 640, 936, 250, 28, C.amber, 3, pa);
  P.circle(ctx, 152, 735, 42, C.amber, pa);
  P.txt(ctx, 'AI', 152, 747, { fam: F.black, size: 32, color: C.ink, align: 'center', a: pa });
  P.txt(ctx, 'Ravi ko message bhejun?', 218, 728, { fam: F.semi, size: 46, color: C.paper, a: pa });
  P.fillRR(ctx, 218, 752, 700, 62, 18, C.panel, pa);
  P.txt(ctx, '"Kal milte hain"', 246, 796, { fam: F.mono, size: 30, color: C.paper, a: pa });
  P.txt(ctx, 'Sirf ek suggestion. Aap decide karo.', 112, 850, { fam: F.mono, size: 24, color: C.amber, a: pa });

  // two buttons; they leave when the tap lands
  const gone = prog(t, 28.4, 28.7);
  const btnA = a * (1 - gone);
  const haanDone = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.3);
  P.fillRR(ctx, 72, 1000, 436, 150, 28, C.teal, btnA * (1 - 0.3 * haanDone));
  P.txt(ctx, 'HAAN', 290, 1095, { fam: F.black, size: 60, color: C.ink, align: 'center', a: btnA });
  P.fillRR(ctx, 572, 1000, 436, 150, 28, C.coral, btnA * (1 - 0.6 * haanDone));
  P.txt(ctx, 'NAHI', 790, 1095, { fam: F.black, size: 60, color: C.ink, align: 'center', a: btnA * (1 - 0.6 * haanDone) });

  // the cursor travels to HAAN, then a ring marks the tap
  const tapU = inOutCubic(prog(t, 27.2, TIMING.tapHaan));
  if (t >= 27.2 && t < TIMING.tapHaan + 0.6) {
    const cx = lerp(900, 290, tapU);
    const cy = lerp(1330, 1075, tapU);
    P.circle(ctx, cx, cy, 26, C.paper, 0.9 * a);
    const ring = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.5);
    if (ring > 0) P.strokeRR(ctx, 290 - 90 * ring, 1075 - 60 * ring, 180 * ring, 120 * ring, 40, C.teal, 4, 1 - ring);
  }

  // the result: a teal card with a check
  if (after > 0) {
    const ra = after * a;
    P.fillRR(ctx, 72, 640, 936, 250, 28, C.panel2, ra);
    P.strokeRR(ctx, 72, 640, 936, 250, 28, C.teal, 3, ra);
    P.circle(ctx, 152, 735, 42, C.teal, ra);
    glyph(ctx, 'done', 152, 735, 34, C.ink, ra);
    P.txt(ctx, 'Bhej diya.', 218, 728, { fam: F.semi, size: 46, color: C.teal, a: ra });
    P.txt(ctx, 'Ravi ko message gaya.', 218, 790, { fam: F.mono, size: 30, color: C.paper, a: ra });
    P.txt(ctx, 'Aapki haan se hua.', 112, 850, { fam: F.mono, size: 24, color: C.mute, a: ra });
  }
}

// ─── the frame ────────────────────────────────────────────────────────────────
function chrome(ctx, t) {
  const label = 'HOW MCP WORKS';
  const tw = P.measure(ctx, label, { fam: F.monoB, size: 26, track: 4 });
  const w = tw + 90;
  P.fillRR(ctx, 540 - w / 2, 120, w, 60, 30, C.panel);
  P.circle(ctx, 540 - w / 2 + 34, 150, 8, C.amber);
  P.txt(ctx, label, 540 + 18, 160, { fam: F.monoB, size: 26, color: C.paper, align: 'center', track: 4 });

  const p = clamp(t / DUR);
  P.fillRR(ctx, 60, 1862, 960, 6, 3, C.line);
  P.fillRR(ctx, 60, 1862, 960 * p, 6, 3, C.amber);
  const idx = Math.max(0, SCENES.findIndex((s) => t >= s.t0 && t < s.t1));
  P.txt(ctx, `${String(idx + 1).padStart(2, '0')} / ${String(SCENES.length).padStart(2, '0')}`, 60, 1840, { fam: F.mono, size: 24, color: C.mute });
  const sec = Math.floor(t);
  const frac = Math.floor((t - sec) * 10);
  P.txt(ctx, `0:${String(sec).padStart(2, '0')}.${frac} / 0:40`, 1020, 1840, { fam: F.mono, size: 24, color: C.mute, align: 'right' });
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
  P.bg(ctx);
  ctx.save();
  const cam = camera(t);
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-cam.fx, -cam.fy);
  world(ctx, t);
  ctx.restore();

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
