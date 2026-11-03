// mcp-video/film-v4.mjs — "How MCP works", v4: the chat-and-settings cut.
//
// Same idea, same narration, same sound, same sync points as v3. Only the picture approach changes.
// Research that shaped it (github.com/yihui-dev/awesome-opus5-5-videos):
//   · verbove-268381 — "one shape, never cut": the apps and tools MORPH into one plug; nothing jump-cuts.
//   · verbove-268381 — "real UI, real data": the waiter, steps and choice are chat screens, not diagrams.
//   · ror-fly-880547 — "show the process as it goes": each step appears as a message when it happens.
//   · cryptoxorz-359201 — "zero-basis audience": one plain idea per beat, every term explained once.
//   · archiveexplorer-560622 — beat order: pain → reframe → name → how it works → objection → range → close.
//
// draw(ctx, t) paints exactly one instant. No state, no clocks. The last half-second dissolves into
// frame 0, so the film loops with no end card.

import { createCanvas } from '@napi-rs/canvas';
import { W, H, C, F, DUR, SCENES, LOOP_DISSOLVE_FROM } from './brand.mjs';
import * as P from './lib/paint.mjs';
import { clamp, lerp, prog, outCubic, inOutCubic, sp, keyed } from './lib/ease.mjs';

// Sync points, in seconds (the same as v3, so the approved audio lines up unchanged).
export const TIMING = {
  steps: [15.48, 17.25, 18.82, 20.09], // the four chat messages, one per spoken step
  tapHaan: 28.2,                       // the tap lands on "haan"
  plugClick: 33.0,                     // the new tool's toggle turns on
};

// ─── layout (1080 × 1920) ─────────────────────────────────────────────────────
// Headlines sit in y 300–560. Content lives in y 560–1500. Captions sit in y 1500–1600.
const APPS = ['Chat AI', 'Writer AI', 'Photo AI', 'Code AI'];
const TOOLS = ['Mail', 'Calendar', 'Weather', 'Notes', 'Music', 'Photos', 'Files', 'Pay', 'Shop', 'Videos', 'Alarms', 'Contacts'];
const NEW_TOOL = 'Maps';

// Hook: apps in a 2×2 grid, tools in a 4×3 grid. Morph: apps → a column on the left, tools → a column on the right.
const appGrid = (i) => ({ x: 60 + (i % 2) * 500, y: 640 + Math.floor(i / 2) * 170, w: 460, h: 140 });
const appCol = (i) => ({ x: 60, y: 640 + i * 150, w: 280, h: 120 });
const toolGrid = (j) => ({ x: 60 + (j % 4) * 240, y: 1080 + Math.floor(j / 4) * 96, w: 220, h: 64 });
const toolCol = (j) => ({ x: 780, y: 640 + j * 68, w: 240, h: 56 });
const SOCK = { x: 380, y: 860, w: 300, h: 120 };
const sockL = () => ({ x: SOCK.x, y: SOCK.y + SOCK.h / 2 });
const sockR = () => ({ x: SOCK.x + SOCK.w, y: SOCK.y + SOCK.h / 2 });
const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });

// ─── pieces ───────────────────────────────────────────────────────────────────
function wire(ctx, p0, p1, color, a, { width = 2, grow = 1, bend = 0.5, wob = 0 } = {}) {
  if (a <= 0 || grow <= 0) return;
  const c = P.cable(p0.x, p0.y + wob, p1.x, p1.y - wob, bend);
  P.strokeCable(ctx, c, color, { width, a, to: clamp(grow) });
}

function appCard(ctx, r, label, a) {
  if (a <= 0) return;
  P.fillRR(ctx, r.x, r.y, r.w, r.h, 22, C.panel2, a);
  P.strokeRR(ctx, r.x, r.y, r.w, r.h, 22, C.amber, 3, a);
  P.circle(ctx, r.x + 30, r.y + 36, 8, C.coral, a);
  P.txt(ctx, label, r.x + 52, r.y + 46, { fam: F.black, size: 34, color: C.paper, a });
  P.txt(ctx, '12 tools', r.x + 30, r.y + r.h - 26, { fam: F.mono, size: 22, color: C.mute, a });
}

function toolChip(ctx, r, label, a) {
  if (a <= 0) return;
  P.fillRR(ctx, r.x, r.y, r.w, r.h, 16, C.panel2, a);
  P.strokeRR(ctx, r.x, r.y, r.w, r.h, 16, C.teal, 3, a);
  P.circle(ctx, r.x + 26, r.y + r.h / 2, 7, C.teal, a);
  P.txt(ctx, label, r.x + 44, r.y + r.h / 2 + 9, { fam: F.monoB, size: 24, color: C.paper, a });
}

function socket(ctx, a) {
  if (a <= 0) return;
  P.fillRR(ctx, SOCK.x, SOCK.y, SOCK.w, SOCK.h, 30, C.amber, a);
  P.txt(ctx, 'MCP', SOCK.x + SOCK.w / 2, SOCK.y + SOCK.h / 2 + 24, { fam: F.black, size: 66, color: C.ink, align: 'center', a });
}

/** A chat message: a rounded bubble that rises in on its spoken word. side: 'left' (AI) | 'right' (you). */
function bubble(ctx, t, t0, x, y, w, h, side, fill, stroke, lines) {
  const p = sp(t, t0, 0.9, 2.6);
  if (p <= 0.001) return;
  const dy = (1 - clamp(p)) * 34;
  ctx.save();
  ctx.translate(0, dy);
  P.fillRR(ctx, x, y, w, h, 26, fill, clamp(p));
  if (stroke) P.strokeRR(ctx, x, y, w, h, 26, stroke, 3, clamp(p));
  lines.forEach((ln) => {
    P.txt(ctx, ln.s, x + 32, y + ln.dy, { fam: ln.fam, size: ln.size, color: ln.color, a: clamp(p) });
  });
  ctx.restore();
}

/** Three dots: the AI is "typing" for the 0.35 s before a message. */
function typing(ctx, t, tEnd, x, y) {
  const a = prog(t, tEnd - 0.35, tEnd - 0.2) * (1 - prog(t, tEnd - 0.05, tEnd));
  if (a <= 0) return;
  for (let i = 0; i < 3; i++) {
    const pulse = 0.5 + 0.5 * Math.sin((t * 14) - i * 1.2);
    P.circle(ctx, x + i * 22, y, 7, C.mute, a * (0.35 + 0.65 * pulse));
  }
}

function chatHeader(ctx, t, a) {
  if (a <= 0) return;
  P.fillRR(ctx, 60, 560, 960, 80, 26, C.panel, a);
  P.circle(ctx, 112, 600, 28, C.amber, a);
  P.txt(ctx, 'AI', 112, 611, { fam: F.black, size: 24, color: C.ink, align: 'center', a });
  P.txt(ctx, 'Chat AI', 160, 610, { fam: F.semi, size: 34, color: C.paper, a });
  P.txt(ctx, 'online · MCP se jud-a hai', 160, 636, { fam: F.mono, size: 20, color: C.mute, a });
}

// ─── world: the apps, the plug, the waiter, the chat, the tools ──────────────
function world(ctx, t) {
  // 1 · the problem: 48 wires, each app to each tool. They fade fast as the cards start to move (5.9–6.4 s).
  const tangle = 1 - prog(t, 5.9, 6.4);
  if (tangle > 0) {
    for (let i = 0; i < APPS.length; i++) {
      const g = appGrid(i);
      for (let j = 0; j < TOOLS.length; j++) {
        const q = toolGrid(j);
        const wob = Math.sin(t * 1.1 + i * 1.3 + j * 0.7) * 5;
        wire(ctx, { x: g.x + g.w / 2, y: g.y + g.h }, { x: q.x + q.w / 2, y: q.y }, C.paper, tangle * 0.22, { width: 2, wob });
      }
    }
  }

  // 2 · one shape: the apps and tools morph into a column and one plug. (6.4–7.4 s). Then it holds.
  const fold = inOutCubic(prog(t, 6.4, 7.4));
  const cardsA = 1 - prog(t, 9.3, 9.9);
  const spokeGrow = t < 20 ? prog(t, 6.4, 7.4) : 1;
  const spokesA = prog(t, 6.3, 6.8) * cardsA;
  if (spokesA > 0) {
    for (let i = 0; i < APPS.length; i++) {
      const c = lerpR(appGrid(i), appCol(i), fold);
      wire(ctx, { x: c.x + c.w, y: c.y + c.h / 2 }, sockL(), C.amber, spokesA * 0.9, { width: 3, grow: spokeGrow });
    }
    for (let j = 0; j < TOOLS.length; j++) {
      const q = lerpR(toolGrid(j), toolCol(j), fold);
      wire(ctx, sockR(), { x: q.x, y: q.y + q.h / 2 }, C.teal, spokesA * 0.9, { width: 3, grow: spokeGrow });
    }
  }
  if (cardsA > 0) {
    for (let i = 0; i < APPS.length; i++) appCard(ctx, lerpR(appGrid(i), appCol(i), fold), APPS[i], cardsA);
    for (let j = 0; j < TOOLS.length; j++) toolChip(ctx, lerpR(toolGrid(j), toolCol(j), fold), TOOLS[j], cardsA);
  }
  socket(ctx, prog(t, 6.3, 6.8) * cardsA);

  // 3 · the waiter, as a chat: you order (10.2), the AI takes it (11.8), the order slip goes to the kitchen (12.0–13.2).
  const wA = prog(t, 9.9, 10.3) * (1 - prog(t, 14.8, 15.2));
  if (wA > 0) {
    chatHeader(ctx, t, wA);
    bubble(ctx, t, 10.2, 360, 690, 660, 80, 'right', C.amber, null, [{ s: 'Kal ka weather batao', dy: 51, size: 36, fam: F.semi, color: C.ink }]);
    bubble(ctx, t, 11.8, 60, 830, 540, 80, 'left', C.panel2, C.line, [{ s: 'Order le liya.', dy: 51, size: 34, fam: F.semi, color: C.paper }]);

    // the kitchen: one card with the tools in it (no tile sits under the slip)
    const kA = prog(t, 10.8, 11.2) * wA;
    P.fillRR(ctx, 60, 1040, 960, 290, 30, C.panel, kA);
    P.strokeRR(ctx, 60, 1040, 960, 290, 30, C.teal, 4, kA);
    P.txt(ctx, 'Kitchen = tools', 100, 1104, { fam: F.black, size: 40, color: C.teal, a: kA });
    const picked = prog(t, 13.3, 13.6);
    ['Mail', 'Weather', 'Files'].forEach((name, i) => {
      const x = 100 + i * 300;
      const r = { x, y: 1140, w: 260, h: 84 };
      const fill = i === 1 ? lerpColor(C.panel2, C.teal, picked) : C.panel2;
      P.fillRR(ctx, r.x, r.y, r.w, r.h, 18, fill, kA);
      P.strokeRR(ctx, r.x, r.y, r.w, r.h, 18, C.teal, 3, kA);
      P.txt(ctx, name, r.x + 130, r.y + 52, { fam: F.monoB, size: 28, color: i === 1 && picked > 0.5 ? C.ink : C.paper, align: 'center', a: kA });
    });
    P.txt(ctx, 'kaam karne wale tools', 100, 1280, { fam: F.mono, size: 26, color: C.mute, a: kA });
    P.txt(ctx, 'Order mila.', 100, 1312, { fam: F.semi, size: 30, color: C.teal, a: picked * kA });

    // the slip: person-bubble → AI-bubble → kitchen, on a path that never sits on a label
    const s1 = prog(t, 10.6, 11.8);
    const s2 = prog(t, 12.0, 13.2);
    const slipA = prog(t, 10.5, 10.7) * (1 - prog(t, 13.2, 13.4)) * wA;
    if (slipA > 0) {
      const sx = s2 > 0 ? lerp(330, 450, s2) : lerp(760, 330, s1);
      const sy = s2 > 0 ? lerp(960, 1182, s2) : lerp(800, 960, s1);
      P.fillRR(ctx, sx - 110, sy - 48, 220, 96, 14, C.paper, slipA);
      P.txt(ctx, 'ORDER', sx, sy - 6, { fam: F.black, size: 30, color: C.ink, align: 'center', a: slipA });
      P.txt(ctx, 'kal ka weather', sx, sy + 28, { fam: F.mono, size: 20, color: C.ink, align: 'center', a: slipA });
    }
  }

  // 4 · the settings screen: the tools list with toggles (30.8 s on). Maps is added at 31.5 and switched on at 33.0.
  const setA = prog(t, 30.8, 31.1);
  if (setA > 0) {
    P.fillRR(ctx, 60, 560, 960, 80, 26, C.panel, setA);
    P.txt(ctx, 'Tools', 100, 610, { fam: F.semi, size: 38, color: C.paper, a: setA });
    P.txt(ctx, 'AI ko kaun se tools mil sakte hain', 100, 636, { fam: F.mono, size: 20, color: C.mute, a: setA });
    const rows = [
      ['Mail', 'kaam karta hai'], ['Calendar', 'kaam karta hai'], ['Weather', 'kaam karta hai'], ['Notes', 'kaam karta hai'],
      ['Music', 'kaam karta hai'], ['Photos', 'kaam karta hai'], ['Pay', 'kaam karta hai'],
    ];
    rows.forEach(([name, sub], i) => {
      const y = 680 + i * 100;
      drawRow(ctx, { x: 60, y, w: 960, h: 84 }, name, sub, true, setA);
    });
    // the new tool
    const drop = outCubic(prog(t, 31.5, 32.2));
    const nA = prog(t, 31.5, 31.7) * setA;
    const ry = 1380; // the row slides in from the right, into its own slot (it never sits over another row)
    const on = sp(t, TIMING.plugClick, 0.8, 2.6);
    if (nA > 0) {
      drawRow(ctx, { x: 60 + (1 - drop) * 240, y: ry, w: 960, h: 84 }, NEW_TOOL, 'nayi plug', clamp(on), nA);
      const badgeA = prog(t, TIMING.plugClick, TIMING.plugClick + 0.3) * nA;
      if (badgeA > 0) P.pill(ctx, 'NAYA', 270, ry + 18, { h: 38, size: 20, color: C.coral, a: badgeA, padX: 14 });
      const ring = prog(t, TIMING.plugClick, TIMING.plugClick + 0.6);
      if (ring > 0 && ring < 1) P.circle(ctx, 60 + 960 - 58, ry + 42, 30 + 40 * ring, C.coral, 0.6 * (1 - ring));
    }
  }
}

/** One settings row: a dot, the tool name, a line of plain text, and a toggle. on: 0..1 (the toggle's position). */
function drawRow(ctx, r, name, sub, on, a) {
  if (a <= 0) return;
  P.fillRR(ctx, r.x, r.y, r.w, r.h, 20, C.panel2, a);
  P.strokeRR(ctx, r.x, r.y, r.w, r.h, 20, C.line, 2, a);
  P.circle(ctx, r.x + 34, r.y + r.h / 2, 9, C.teal, a);
  P.txt(ctx, name, r.x + 62, r.y + 40, { fam: F.semi, size: 36, color: C.paper, a });
  P.txt(ctx, sub, r.x + 62, r.y + 68, { fam: F.mono, size: 20, color: C.mute, a });
  // toggle
  const tx = r.x + r.w - 130;
  const ty = r.y + r.h / 2 - 24;
  const k = clamp(on);
  P.fillRR(ctx, tx, ty, 96, 48, 24, lerpColor(C.line, C.teal, k), a);
  P.circle(ctx, tx + 24 + k * 48, ty + 24, 19, C.paper, a);
}

function lerpColor(c0, c1, k) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = h(c0), b = h(c1);
  const m = a.map((v, i) => Math.round(lerp(v, b[i], clamp(k))));
  return '#' + m.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ─── screen: headlines, captions, counter, the chat messages, the choice ─────
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

// On-screen words in Roman Hinglish (the caption font has no Devanagari). Same as v3.
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

/** The number of connections: 48 (the problem), 16 (one plug), 17 (with the new tool). */
function counter(ctx, t) {
  const a = Math.max(1 - prog(t, 9.3, 9.9), prog(t, 30.8, 31.1));
  if (a <= 0) return;
  let n;
  if (t < 6.4) n = Math.round(48 * outCubic(prog(t, 0.2, 1.4)));
  else if (t < 7.4) n = Math.round(lerp(48, 16, outCubic(prog(t, 6.4, 7.4))));
  else if (t < 33.0) n = 16;
  else n = 17;
  P.txt(ctx, String(n).padStart(2, '0'), 1008, 470, { fam: F.black, size: 150, color: C.amber, align: 'right', a });
  P.txt(ctx, 'connections', 1008, 524, { fam: F.monoB, size: 26, color: C.mute, align: 'right', track: 2, a });
}

/** The steps as chat messages (15–21 s), each arriving on its spoken word. */
function steps(ctx, t) {
  const out = 1 - prog(t, 24.8, 25.2);
  if (out <= 0) return;
  ctx.save();
  ctx.globalAlpha = out;
  // you ask
  bubble(ctx, t, 15.2, 340, 680, 680, 150, 'right', C.amber, null, [
    { s: 'Kal ka weather batao,', dy: 62, size: 34, fam: F.semi, color: C.ink },
    { s: 'aur Ravi ko message bhejo.', dy: 110, size: 34, fam: F.semi, color: C.ink },
  ]);
  // 1 · the AI asks
  typing(ctx, t, TIMING.steps[0], 96, 932);
  bubble(ctx, t, TIMING.steps[0], 60, 880, 660, 112, 'left', C.panel2, C.line, [
    { s: '1 · AI POOCHTA HAI', dy: 40, size: 20, fam: F.monoB, color: C.amber },
    { s: 'Tum kya kar sakte ho?', dy: 84, size: 34, fam: F.semi, color: C.paper },
  ]);
  // 2 · the tool answers, with its tools as chips
  typing(ctx, t, TIMING.steps[1], 96, 1100);
  const tA = sp(t, TIMING.steps[1], 0.9, 2.6);
  if (tA > 0.001) {
    bubble(ctx, t, TIMING.steps[1], 60, 1040, 780, 150, 'left', C.panel2, C.line, [
      { s: '2 · TOOL BATATA HAI', dy: 40, size: 20, fam: F.monoB, color: C.teal },
    ]);
    ['Mail', 'Calendar', 'Weather'].forEach((name, i) => {
      toolChip(ctx, { x: 96 + i * 240, y: 1090, w: 220, h: 64 }, name, clamp(tA));
    });
  }
  // 3 · the work gets done: a progress bar
  typing(ctx, t, TIMING.steps[2], 96, 1280);
  const wkA = sp(t, TIMING.steps[2], 0.9, 2.6);
  if (wkA > 0.001) {
    bubble(ctx, t, TIMING.steps[2], 60, 1220, 780, 150, 'left', C.panel2, C.line, [
      { s: '3 · KAAM HOTA HAI', dy: 40, size: 20, fam: F.monoB, color: C.teal },
      { s: 'Weather mila. Ravi ko message gaya.', dy: 84, size: 28, fam: F.mono, color: C.paper },
    ]);
    const bar = prog(t, TIMING.steps[2] + 0.2, TIMING.steps[2] + 1.0);
    P.fillRR(ctx, 96, 1318, 700, 14, 7, C.line, clamp(wkA));
    P.fillRR(ctx, 96, 1318, 700 * bar, 14, 7, C.teal, clamp(wkA));
  }
  // 4 · the AI tells you
  typing(ctx, t, TIMING.steps[3], 96, 1466);
  bubble(ctx, t, TIMING.steps[3], 60, 1400, 660, 112, 'left', C.panel2, C.line, [
    { s: '4 · AI AAPKO BATATA HAI', dy: 40, size: 20, fam: F.monoB, color: C.coral },
    { s: 'Ho gaya. Done.', dy: 84, size: 34, fam: F.semi, color: C.paper },
  ]);
  ctx.restore();
}

/** You decide: the AI proposes in a chat bubble with two buttons; a tap on HAAN lands at 28.2 s. */
function control(ctx, t) {
  const a = prog(t, 25.2, 25.5) * (1 - prog(t, 30.8, 31.1));
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  bubble(ctx, t, 25.2, 60, 680, 960, 230, 'left', C.panel2, C.amber, [
    { s: 'AI · SUGGESTION', dy: 40, size: 20, fam: F.monoB, color: C.amber },
    { s: 'Ravi ko message bhejun?', dy: 92, size: 42, fam: F.semi, color: C.paper },
    { s: '"Kal milte hain"', dy: 142, size: 30, fam: F.mono, color: C.mute },
    { s: 'Aap decide karo.', dy: 190, size: 26, fam: F.mono, color: C.amber },
  ]);

  // the buttons (they leave when the tap lands)
  const gone = prog(t, 28.4, 28.7);
  const btnA = sp(t, 25.6, 0.9, 2.6) * (1 - gone);
  const haanDone = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.3);
  if (btnA > 0) {
    P.fillRR(ctx, 100, 940, 380, 120, 26, C.teal, btnA * (1 - 0.3 * haanDone));
    P.txt(ctx, 'HAAN', 290, 1014, { fam: F.black, size: 52, color: C.ink, align: 'center', a: btnA });
    P.fillRR(ctx, 560, 940, 380, 120, 26, C.coral, btnA * (1 - 0.6 * haanDone));
    P.txt(ctx, 'NAHI', 750, 1014, { fam: F.black, size: 52, color: C.ink, align: 'center', a: btnA * (1 - 0.6 * haanDone) });
  }

  // the cursor travels to HAAN, then a ring marks the tap
  const tapU = inOutCubic(prog(t, 27.2, TIMING.tapHaan));
  if (t >= 27.2 && t < TIMING.tapHaan + 0.6) {
    const cx = lerp(900, 290, tapU);
    const cy = lerp(1330, 1000, tapU);
    P.circle(ctx, cx, cy, 26, C.paper, 0.9 * a);
    const ring = prog(t, TIMING.tapHaan, TIMING.tapHaan + 0.5);
    if (ring > 0) P.strokeRR(ctx, 290 - 110 * ring, 1000 - 70 * ring, 220 * ring, 140 * ring, 40, C.teal, 4, 1 - ring);
  }

  // your answer, then the AI's result
  bubble(ctx, t, 28.5, 620, 1120, 400, 96, 'right', C.amber, null, [{ s: 'HAAN', dy: 62, size: 40, fam: F.black, color: C.ink }]);
  bubble(ctx, t, 28.9, 60, 1260, 760, 150, 'left', C.panel2, C.teal, [
    { s: 'Bhej diya.', dy: 62, size: 40, fam: F.semi, color: C.teal },
    { s: 'Ravi ko message gaya.', dy: 112, size: 28, fam: F.mono, color: C.paper },
  ]);
  ctx.restore();
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
