// mcp-video/film.mjs — "How MCP works", v2. For people who use AI apps and don't know what is behind them.
//
// draw(ctx, t) paints exactly one instant. No state, no clocks. The last half-second dissolves into
// frame 0, so the film loops with no end card.
//
// Story, in plain words: 4 AI apps × 12 tools = 48 separate connections. MCP is one common plug.
// Like a waiter: you order, the waiter takes it to the kitchen on a standard order slip.
// The AI asks what the tool can do, the tool answers, the work is done, the AI tells you.
// The AI only suggests. You say yes.
//
// Scenes are drawn in world space (they move with the camera). Headlines, captions and chrome are
// drawn in screen space, so they never move and always read.

import { createCanvas } from '@napi-rs/canvas';
import { W, H, C, F, DUR, SCENES, LOOP_DISSOLVE_FROM } from './brand.mjs';
import * as P from './lib/paint.mjs';
import { clamp, lerp, prog, outCubic, inOutCubic, sp, keyed } from './lib/ease.mjs';

// Sync points, in seconds. Each comes from the voice clips (voiceover/out/v2): the peak of a spoken word.
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
// Headlines sit in y 300–560. The world lives in y 620–1400. Captions sit in y 1450–1600.
const AI = ['A', 'B', 'C', 'D'].map((k, i) => ({ x: 60, y: 640 + i * 178, w: 260, h: 112, label: `AI app ${k}` }));

// 12 base tools in a 2-column grid, plus one tool ("Maps") that joins later.
const TOOL_NAMES = ['Mail', 'Calendar', 'Weather', 'Notes', 'Music', 'Photos', 'Files', 'Pay', 'Shop', 'Videos', 'Alarms', 'Contacts', 'Maps'];
const TOOLS = TOOL_NAMES.map((label, i) => ({
  x: 760 + (i % 2) * 138,
  y: 640 + Math.floor(i / 2) * 96,
  w: 118,
  h: 84,
  label,
}));
const NEW_TOOL = 12;   // index of "Maps"
const BASE_TOOLS = 12; // indices 0..11

const SOCK = { x: 430, y: 1000, w: 210, h: 130 };
const SOCK_L = { x: SOCK.x, y: SOCK.y + SOCK.h / 2 };
const SOCK_R = { x: SOCK.x + SOCK.w, y: SOCK.y + SOCK.h / 2 };

const aiRight = (i) => ({ x: AI[i].x + AI[i].w, y: AI[i].y + AI[i].h / 2 });
const toolLeft = (j) => ({ x: TOOLS[j].x, y: TOOLS[j].y + TOOLS[j].h / 2 });

// ─── small pieces ─────────────────────────────────────────────────────────────
function tile(ctx, r, label, color, a, big = false) {
  if (a <= 0) return;
  P.fillRR(ctx, r.x, r.y, r.w, r.h, 14, C.panel2, a);
  P.strokeRR(ctx, r.x, r.y, r.w, r.h, 14, color, 3, a);
  P.txt(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + (big ? 10 : 8), {
    fam: big ? F.monoB : F.mono, size: big ? 26 : 20, color: C.paper, align: 'center', a,
  });
}

function wire(ctx, p0, p1, color, a, { width = 2, grow = 1, bend = 0.5, wob = 0 } = {}) {
  if (a <= 0 || grow <= 0) return;
  const c = P.cable(p0.x, p0.y + wob, p1.x, p1.y - wob, bend);
  P.strokeCable(ctx, c, color, { width, a, to: clamp(grow) });
}

function socket(ctx, a) {
  if (a <= 0) return;
  P.fillRR(ctx, SOCK.x, SOCK.y, SOCK.w, SOCK.h, 28, C.amber, a);
  P.txt(ctx, 'MCP', SOCK.x + SOCK.w / 2, SOCK.y + SOCK.h / 2 + 24, { fam: F.black, size: 64, color: C.ink, align: 'center', a });
}

// ─── world: the picture ───────────────────────────────────────────────────────
function world(ctx, t) {
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

  // Apps and tools. They are on screen for the problem, the plug, and the new tool.
  const tiles = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.6, 31.0));
  if (tiles > 0) {
    AI.forEach((r) => tile(ctx, r, r.label, C.amber, tiles, true));
    for (let j = 0; j < BASE_TOOLS; j++) tile(ctx, TOOLS[j], TOOLS[j].label, C.teal, tiles);
  }

  // 2 · one plug: the wires fold into the socket. Four spokes in, twelve spokes out.
  const fold = prog(t, 6.4, 7.4);
  const spokesA = Math.max(prog(t, 6.3, 6.8) * (1 - prog(t, 9.3, 9.9)), prog(t, 30.6, 31.0));
  const spokeGrow = t < 20 ? fold : 1;
  if (spokesA > 0) {
    for (let i = 0; i < AI.length; i++) wire(ctx, aiRight(i), SOCK_L, C.amber, spokesA * 0.9, { width: 3, grow: spokeGrow });
    for (let j = 0; j < BASE_TOOLS; j++) wire(ctx, SOCK_R, toolLeft(j), C.teal, spokesA * 0.9, { width: 3, grow: spokeGrow });
  }
  socket(ctx, Math.max(prog(t, 6.3, 6.8) * (1 - prog(t, 9.3, 9.9)), prog(t, 30.6, 31.0)));

  // 3 · like a waiter: a person, an app, the kitchen. An order slip goes across (10–14 s).
  const wA = prog(t, 9.9, 10.3) * (1 - prog(t, 14.8, 15.2));
  if (wA > 0) {
    P.circle(ctx, 190, 900, 50, C.paper, wA);
    P.fillRR(ctx, 130, 968, 120, 150, 50, C.paper, wA);
    P.txt(ctx, 'Aap', 190, 1196, { fam: F.monoB, size: 30, color: C.paper, align: 'center', a: wA });

    P.fillRR(ctx, 420, 930, 240, 150, 22, C.panel2, wA);
    P.strokeRR(ctx, 420, 930, 240, 150, 22, C.amber, 3, wA);
    P.txt(ctx, 'AI', 540, 1010, { fam: F.black, size: 60, color: C.paper, align: 'center', a: wA });
    P.txt(ctx, 'waiter', 540, 1052, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: wA });

    [['Mail', 930], ['Weather', 1000], ['Files', 1070]].forEach(([label, y]) => tile(ctx, { x: 800, y, w: 200, h: 56 }, label, C.teal, wA));
    P.txt(ctx, 'Tools (kitchen)', 900, 1196, { fam: F.monoB, size: 26, color: C.teal, align: 'center', a: wA });

    wire(ctx, { x: 270, y: 1000 }, { x: 420, y: 1000 }, C.paper, wA * 0.5, { width: 4, bend: 0.5 });
    wire(ctx, { x: 660, y: 1000 }, { x: 800, y: 1000 }, C.paper, wA * 0.5, { width: 4, bend: 0.5 });
    P.pill(ctx, 'MCP', 672, 948, { h: 46, size: 22, color: C.amber, a: wA });

    // the order slip: person → waiter (10.6–11.8), waiter → kitchen (12.0–13.2)
    const u1 = prog(t, 10.6, 11.8);
    const u2 = prog(t, 12.0, 13.2);
    const slipA = prog(t, 10.5, 10.7) * (1 - prog(t, 13.6, 14.0));
    if (slipA > 0) {
      const x = u2 > 0 ? lerp(640, 880, u2) : lerp(230, 640, u1);
      P.fillRR(ctx, x - 48, 970, 96, 60, 8, C.paper, slipA);
      P.txt(ctx, 'ORDER', x, 1008, { fam: F.monoB, size: 18, color: C.ink, align: 'center', a: slipA });
    }
  }

  // 4 · the new tool: "Maps" drops in and clicks into the socket (31.5–33.6 s).
  if (t >= 31.5) {
    const drop = outCubic(prog(t, 31.5, 32.2));
    const y = lerp(560, TOOLS[NEW_TOOL].y, drop);
    const nA = prog(t, 31.5, 31.7);
    const r = { x: TOOLS[NEW_TOOL].x, y, w: TOOLS[NEW_TOOL].w, h: TOOLS[NEW_TOOL].h };
    if (t >= 33.0) wire(ctx, SOCK_R, { x: r.x, y: r.y + r.h / 2 }, C.coral, prog(t, 33.0, 33.4), { width: 3 });
    tile(ctx, r, TOOLS[NEW_TOOL].label, C.coral, nA);
    const ring = prog(t, TIMING.plugClick, TIMING.plugClick + 0.6);
    if (ring > 0 && ring < 1) P.strokeRR(ctx, SOCK.x - 30 * ring, SOCK.y - 30 * ring, SOCK.w + 60 * ring, SOCK.h + 60 * ring, 40 + 30 * ring, C.amber, 4, 1 - ring);
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

// Captions in Roman Hinglish, because the caption font has no Devanagari glyphs.
// Times match the voice clips, not the scene edges.
const CAPTIONS = [
  [0.2, 5.6, ['har AI x har tool = alag connection']],
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
      const y = 1520 + i * 62;
      const w = P.measure(ctx, s, { fam: F.semi, size: 44 }) + 40;
      P.fillRR(ctx, 60, y - 50, w, 62, 14, C.ink, 0.72 * clamp(p) * out);
      ctx.save();
      ctx.globalAlpha = out;
      P.maskLine(ctx, s, 80, y, clamp(p), { fam: F.semi, size: 44, color: C.paper });
      ctx.restore();
    });
  }
}

/** The number of plugs: 48 (the problem), 16 (one plug), 17 (with the new tool). */
function counter(ctx, t) {
  const a = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.6, 31.0));
  if (a <= 0) return;
  let n;
  if (t < 6.4) n = Math.round(48 * outCubic(prog(t, 0.2, 1.4)));
  else if (t < 7.4) n = Math.round(lerp(48, 16, outCubic(prog(t, 6.4, 7.4))));
  else if (t < 33.0) n = 16;
  else n = 17;
  P.txt(ctx, String(n).padStart(2, '0'), 1008, 470, { fam: F.black, size: 150, color: C.amber, align: 'right', a });
  P.txt(ctx, 'plugs', 1008, 524, { fam: F.mono, size: 26, color: C.mute, align: 'right', a });
}

/** Steps: a question in a chat bubble, then four cards that appear on the spoken words. */
function steps(ctx, t) {
  const a = prog(t, 15.2, 15.5) * (1 - prog(t, 24.8, 25.2));
  if (a <= 0) return;
  // the user's message
  P.fillRR(ctx, 160, 610, 848, 150, 26, C.panel2, a);
  P.strokeRR(ctx, 160, 610, 848, 150, 26, C.amber, 3, a);
  P.txt(ctx, 'Kal ka weather batao,', 196, 668, { fam: F.med, size: 38, color: C.paper, a });
  P.txt(ctx, 'aur Ravi ko message bhejo.', 196, 722, { fam: F.med, size: 38, color: C.paper, a });

  const cards = [
    { title: 'AI poochta hai', sub: 'Tum kya kar sakte ho?', color: C.amber },
    { title: 'Tool list deta hai', sub: 'Weather · Mail · Calendar', color: C.teal },
    { title: 'Kaam hota hai', sub: 'Kal baarish · Ravi ko message gaya', color: C.teal },
    { title: 'AI aapko batata hai', sub: 'Ho gaya. Done.', color: C.coral },
  ];
  cards.forEach((c, i) => {
    const p = sp(t, TIMING.steps[i], 0.9, 2.6) * (1 - prog(t, 24.8, 25.2));
    if (p <= 0.001) return;
    const y = 830 + i * 170;
    ctx.save();
    P.wipeRect(ctx, 72, y, 936, 138, p);
    P.fillRR(ctx, 72, y, 936, 138, 22, C.panel, 1);
    P.fillRR(ctx, 72, y, 12, 138, 6, c.color, 1);
    P.circle(ctx, 150, y + 69, 34, c.color, 1);
    P.txt(ctx, String(i + 1), 150, y + 82, { fam: F.black, size: 38, color: C.ink, align: 'center' });
    P.txt(ctx, c.title, 212, y + 66, { fam: F.semi, size: 40, color: C.paper });
    P.txt(ctx, c.sub, 212, y + 108, { fam: F.mono, size: 26, color: C.mute });
    ctx.restore();
  });
}

/** You decide: the AI proposes, a tap says yes. */
function control(ctx, t) {
  const a = prog(t, 25.2, 25.5) * (1 - prog(t, 30.8, 31.1));
  if (a <= 0) return;
  // the AI's proposal fades out as the result fades in (no ghosting)
  const pa = a * (1 - prog(t, 28.3, 28.5));
  P.fillRR(ctx, 72, 640, 936, 250, 26, C.panel2, pa);
  P.strokeRR(ctx, 72, 640, 936, 250, 26, C.amber, 3, pa);
  P.txt(ctx, 'AI: Ravi ko message bhejun?', 112, 730, { fam: F.semi, size: 46, color: C.paper, a: pa });
  P.txt(ctx, '"Kal milte hain"', 112, 790, { fam: F.mono, size: 30, color: C.mute, a: pa });
  P.txt(ctx, 'Sirf ek suggestion.', 112, 840, { fam: F.mono, size: 26, color: C.amber, a: pa });

  // two buttons; the tap goes to HAAN
  // the buttons are the question; once the tap lands they leave, and the result takes their place
  const haanDone = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.3);
  const gone = prog(t, 28.4, 28.7);
  const btnA = a * (1 - gone);
  P.fillRR(ctx, 72, 1000, 436, 150, 26, C.teal, btnA * (1 - 0.3 * haanDone));
  P.txt(ctx, 'HAAN', 290, 1095, { fam: F.black, size: 60, color: C.ink, align: 'center', a: btnA });
  P.fillRR(ctx, 572, 1000, 436, 150, 26, C.coral, btnA * (1 - 0.6 * haanDone));
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

  // the result, after the tap
  const after = prog(t, 28.5, 28.8);
  if (after > 0) {
    P.fillRR(ctx, 72, 640, 936, 250, 26, C.panel2, after * a);
    P.strokeRR(ctx, 72, 640, 936, 250, 26, C.teal, 3, after * a);
    P.txt(ctx, 'Bhej diya.', 112, 730, { fam: F.semi, size: 46, color: C.teal, a: after * a });
    P.txt(ctx, 'Ravi ko message gaya.', 112, 790, { fam: F.mono, size: 30, color: C.paper, a: after * a });
    P.txt(ctx, 'Aapki haan se hua.', 112, 840, { fam: F.mono, size: 26, color: C.mute, a: after * a });
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
