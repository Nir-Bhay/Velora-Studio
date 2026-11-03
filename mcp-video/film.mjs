// mcp-video/film.mjs
//
// The film. draw(ctx, t) paints exactly one instant. No state, no clocks.
// Scenes are drawn in world space (they move with the camera); captions and the
// chrome are drawn in screen space (they never move, so they always read).
//
// Story: ask once → 48 custom plugs → one standard → three roles → two transports
//        → three offers → the call, step by step → who keeps control → end.

import { W, H, C, F, DUR, SCENES } from './brand.mjs';
import * as P from './lib/paint.mjs';
import { clamp, lerp, prog, outExpo, outCubic, inOutCubic, sp, keyed, hash } from './lib/ease.mjs';

// ─── camera ───────────────────────────────────────────────────────────────────
// [t, scale, focusX, focusY]. The camera always keeps a focus point at screen centre.
const CAM = [
  [0.0, 1.0, 540, 960],
  [4.8, 1.04, 540, 1000],   // hook: a slow push into the wires
  [5.0, 1.0, 540, 960],
  [8.4, 1.02, 540, 1000],
  [9.0, 1.0, 540, 960],
  [10.2, 1.22, 540, 760],   // roles: into the host
  [12.0, 1.12, 540, 1150],  //        down to the servers (headline stays on screen)
  [14.6, 1.0, 540, 960],
  [16.0, 1.0, 540, 960],
  [18.6, 1.05, 540, 1000],  // transports: a push before the offers
  [19.5, 1.0, 540, 960],
  [22.0, 1.03, 540, 1000],
  [25.0, 1.0, 540, 960],
  [33.0, 1.04, 540, 900],   // the call: a slow drift toward the code
  [35.5, 1.0, 540, 960],
  [37.0, 1.06, 540, 960],   // control: a punch-in on the three lines
  [38.0, 1.0, 540, 960],
  [40.0, 0.97, 540, 960],
];

export function camera(t) {
  const [s, fx, fy] = keyed(CAM, t);
  return { s, x: W / 2 - fx, y: H / 2 - fy, fx, fy };
}

// ─── shared pieces ────────────────────────────────────────────────────────────
/** A headline line that enters on a spring and leaves short and early (the "content swap" rule). */
function headLine(ctx, s, x, y, t, tIn, tOut, size = 108, color = C.paper) {
  const pin = sp(t, tIn, 0.9, 2.6);
  const pout = 1 - prog(t, tOut, tOut + 0.22);
  const p = Math.min(pin, pout);
  if (p <= 0.001) return;
  P.maskLine(ctx, s, x, y, p, { fam: F.black, size, color });
}

const HEAD_X = 72;
const HEAD_Y1 = 380;
const HEAD_Y2 = 500;

// ─── Scene A · hook (0–5 s) ───────────────────────────────────────────────────
// 4 hosts × 12 tools as 48 wires with flowing data. The count runs to 48, the wires
// collapse into one point, and the count drops to 4 + 12 = 16 connectors with MCP.
const HOSTS = [
  { name: 'Claude', y: 760 },
  { name: 'VS Code', y: 930 },
  { name: 'Cursor', y: 1100 },
  { name: 'Your app', y: 1270 },
];
const TOOL_Y = Array.from({ length: 12 }, (_, j) => 640 + j * (740 / 11));
const HUB = { x: 540, y: 1010 };

function hookScene(ctx, t) {
  if (t > 4.9) return;
  // headlines: "4 AI apps × 12 tools" → "With MCP:"
  headLine(ctx, '4 AI apps', HEAD_X, HEAD_Y1, t, 0.0, 3.0);
  headLine(ctx, '× 12 tools', HEAD_X, HEAD_Y2, t, 0.5, 3.0);
  headLine(ctx, 'With MCP:', HEAD_X, HEAD_Y1, t, 3.4, 99);

  const k = inOutCubic(prog(t, 3.0, 3.7)); // collapse
  const wireA = 1 - prog(t, 3.5, 3.8);
  const flow = -t * 120 * (1 - 0.9 * k);

  // wires: all 48 at once, each a cubic from a host edge to a tool dot
  for (let i = 0; i < HOSTS.length; i++) {
    for (let j = 0; j < 12; j++) {
      const a0 = [300, HOSTS[i].y];
      const b0 = [868, TOOL_Y[j]];
      const a = [lerp(a0[0], HUB.x, k), lerp(a0[1], HUB.y, k)];
      const b = [lerp(b0[0], HUB.x, k), lerp(b0[1], HUB.y, k)];
      const c = P.cable(a[0], a[1], b[0], b[1], 0.5);
      P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.2 * wireA });
      P.strokeCable(ctx, c, C.amber, { width: 2.2, a: 0.6 * wireA, dash: [10, 16], dashOffset: flow + (i * 12 + j) * 3 });
    }
  }
  // hosts and tools fade as the wires collapse
  const nodeA = 1 - prog(t, 3.0, 3.4);
  for (const h of HOSTS) {
    P.fillRR(ctx, 110, h.y - 56, 190, 112, 22, C.panel2, nodeA);
    P.strokeRR(ctx, 110, h.y - 56, 190, 112, 22, C.line, 2, nodeA);
    P.txt(ctx, h.name, 205, h.y + 9, { fam: F.monoB, size: 26, color: C.paper, align: 'center', a: nodeA });
  }
  for (const y of TOOL_Y) P.circle(ctx, 880, y, 11, C.paper, nodeA);

  // the count: 0 → 48 (1–2 s), hold, then 48 → 16 (3.6–4.4 s)
  let v;
  if (t < 1) v = 0;
  else if (t < 2) v = Math.round(48 * outCubic(t - 1));
  else if (t < 3.6) v = 48;
  else v = Math.round(lerp(48, 16, outExpo(prog(t, 3.6, 4.4))));
  const numA = t < 0.9 ? 0 : 1;
  if (numA) {
    P.fillRR(ctx, 330, 800, 420, 420, 36, C.ink, 1);
    P.strokeRR(ctx, 330, 800, 420, 420, 36, C.line, 2);
    P.txt(ctx, String(v), HUB.x, 1080, { fam: F.black, size: 300, color: C.paper, align: 'center' });
  }
  // the label under the number
  const labA = sp(t, 2.0, 0.85, 2.6) * (1 - prog(t, 3.55, 3.75));
  const labW = 460;
  if (labA > 0) { P.fillRR(ctx, HUB.x - labW / 2, 1222, labW, 70, 35, C.ink, labA); P.txt(ctx, 'custom plugs', HUB.x, 1272, { fam: F.semi, size: 52, color: C.paper, align: 'center', a: labA }); }
  const labB = sp(t, 4.2, 0.85, 2.6);
  if (labB > 0) { P.fillRR(ctx, HUB.x - labW / 2, 1222, labW, 70, 35, C.ink, labB); P.txt(ctx, '4 + 12 connectors', HUB.x, 1272, { fam: F.semi, size: 52, color: C.amber, align: 'center', a: labB }); }

  // the MCP pill arrives on the collapse point
  const pillP = sp(t, 3.5, 0.6, 2.8);
  if (pillP > 0) {
    ctx.save();
    ctx.translate(HUB.x, 712);
    ctx.scale(lerp(0.6, 1, pillP), lerp(0.6, 1, pillP));
    ctx.globalAlpha = clamp(pillP);
    P.fillRR(ctx, -150, -60, 300, 120, 60, C.amber);
    P.txt(ctx, 'MCP', 0, 24, { fam: F.black, size: 72, color: C.ink, align: 'center' });
    ctx.restore();
  }
}

// ─── Scene B · protocol (5–9 s) ───────────────────────────────────────────────
// One pillar, the protocol, between four hosts and twelve tools.
function protocolScene(ctx, t) {
  if (t < 4.9 || t > 9.3) return;
  headLine(ctx, 'One open', HEAD_X, HEAD_Y1, t, 5.0, 8.7);
  headLine(ctx, 'standard.', HEAD_X, HEAD_Y2, t, 5.45, 8.7);

  const grow = outExpo(prog(t, 5.5, 6.3));
  const pillarH = 760 * grow;
  const pillarX = 470, pillarW = 140;
  const cy = 1010;

  // wires host→pillar and pillar→tool
  const wa = prog(t, 5.6, 6.2);
  for (let i = 0; i < HOSTS.length; i++) {
    const hy = HOSTS[i].y;
    const c = P.cable(300, hy, pillarX, hy, 0.5);
    P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.25 * wa });
    P.strokeCable(ctx, c, C.amber, { width: 2.2, a: 0.7 * wa, dash: [10, 16], dashOffset: -t * 120 });
  }
  for (let j = 0; j < 12; j++) {
    const ty = TOOL_Y[j];
    const c = P.cable(pillarX + pillarW, ty, 868, ty, 0.5);
    P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.25 * wa });
    P.strokeCable(ctx, c, C.amber, { width: 2.2, a: 0.7 * wa, dash: [10, 16], dashOffset: -t * 120 });
  }

  for (let i = 0; i < HOSTS.length; i++) {
    const p = sp(t, 5.2 + i * 0.12, 0.85, 2.6);
    const h = HOSTS[i];
    P.fillRR(ctx, 110, h.y - 56, 190, 112, 22, C.panel2, p);
    P.strokeRR(ctx, 110, h.y - 56, 190, 112, 22, C.line, 2, p);
    P.txt(ctx, h.name, 205, h.y + 9, { fam: F.monoB, size: 26, color: C.paper, align: 'center', a: p });
  }
  for (let j = 0; j < 12; j++) {
    const p = sp(t, 6.5 + j * 0.05, 0.6, 3.2);
    P.circle(ctx, 880, TOOL_Y[j], 11 * clamp(p), C.paper);
  }

  // the pillar
  if (pillarH > 1) {
    P.fillRR(ctx, pillarX, cy - pillarH / 2, pillarW, pillarH, 26, C.amber);
    ctx.save();
    ctx.beginPath();
    ctx.rect(pillarX, cy - pillarH / 2, pillarW, pillarH);
    ctx.clip();
    ctx.translate(pillarX + pillarW / 2, cy);
    ctx.rotate(-Math.PI / 2);
    P.txt(ctx, 'MCP', 0, 30, { fam: F.black, size: 84, color: C.ink, align: 'center', a: prog(t, 6.1, 6.5) });
    ctx.restore();
  }
  // host and tool labels, quiet
  P.txt(ctx, 'AI apps', 205, 700, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: prog(t, 5.8, 6.1) });
  P.txt(ctx, 'tools', 880, 610, { fam: F.mono, size: 24, color: C.mute, align: 'center', a: prog(t, 6.6, 6.9) });
}

// ─── Scene C · roles (9–16 s) ─────────────────────────────────────────────────
// A host holds one client per server. Packets run client ↔ server.
const CLIENTS = [
  { x: 150, label: 'client · 1' },
  { x: 610, label: 'client · 2' },
];
const SERVERS = [
  { x: 120, name: 'Files' },
  { x: 600, name: 'GitHub' },
];

function vcable(x0, y0, x1, y1) {
  const my = (y0 + y1) / 2;
  return [x0, y0, x0, my, x1, my, x1, y1];
}

function rolesScene(ctx, t) {
  if (t < 8.9 || t > 16.2) return;
  headLine(ctx, 'Three roles.', HEAD_X, HEAD_Y1, t, 9.0, 15.4);

  // HOST container
  const hostP = prog(t, 9.5, 9.85);
  if (hostP > 0) {
    ctx.save();
    P.wipeRect(ctx, 90, 560, 900, 400, hostP);
    P.fillRR(ctx, 90, 560, 900, 400, 44, C.panel);
    P.strokeRR(ctx, 90, 560, 900, 400, 44, C.line, 2);
    P.txt(ctx, 'HOST', 132, 616, { fam: F.monoB, size: 28, color: C.paper, track: 3 });
    P.txt(ctx, 'the AI app you use', 948, 616, { fam: F.mono, size: 24, color: C.mute, align: 'right' });
    ctx.restore();
  }

  // client chips
  CLIENTS.forEach((c, i) => {
    const p = sp(t, 10.5 + i * 0.5, 0.7, 3.0);
    if (p <= 0) return;
    ctx.save();
    ctx.translate(c.x + 160, 760);
    ctx.scale(lerp(0.85, 1, clamp(p)), lerp(0.85, 1, clamp(p)));
    ctx.translate(-(c.x + 160), -760);
    P.fillRR(ctx, c.x, 700, 320, 120, 28, C.teal, clamp(p));
    P.txt(ctx, c.label, c.x + 160, 772, { fam: F.monoB, size: 32, color: C.ink, align: 'center', a: clamp(p) });
    ctx.restore();
  });

  // servers
  SERVERS.forEach((s, i) => {
    const p = sp(t, 12.0 + i * 0.5, 0.85, 2.6);
    if (p <= 0) return;
    P.fillRR(ctx, s.x, 1180, 360, 220, 34, C.panel, clamp(p));
    P.strokeRR(ctx, s.x, 1180, 360, 220, 34, C.coral, 3, clamp(p));
    P.txt(ctx, 'SERVER', s.x + 36, 1236, { fam: F.monoB, size: 26, color: C.coral, track: 3, a: clamp(p) });
    P.txt(ctx, s.name, s.x + 36, 1322, { fam: F.black, size: 66, color: C.paper, a: clamp(p) });
    P.txt(ctx, 'tools · resources · prompts', s.x + 30, 1368, { fam: F.mono, size: 19, color: C.mute, a: clamp(p) });
  });

  // cables client → server (1:1)
  const pairs = [[300, 820, 300, 1180], [770, 820, 780, 1180]];
  const cableA = prog(t, 12.6, 13.0);
  pairs.forEach(([x0, y0, x1, y1], i) => {
    const c = vcable(x0, y0, x1, y1);
    P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.3 * cableA });
    // 1:1 label
    P.txt(ctx, '1 : 1', (x0 + x1) / 2 + 60, (y0 + y1) / 2 + 8, { fam: F.monoB, size: 24, color: C.mute, a: cableA });
    if (t >= 13.0) {
      // requests travel down (amber), responses travel up (teal); a packet every half second
      for (let k = 0; k < 2; k++) {
        const u = (((t - 13.0) * 0.9 + k * 0.5 + i * 0.25) % 1 + 1) % 1;
        P.packet(ctx, c, u, C.amber, { r: 8 });
        P.packet(ctx, c, 1 - ((u + 0.5) % 1), C.teal, { r: 8 });
      }
    }
  });
}

// ─── Scene D · transports (16–19.5 s) ─────────────────────────────────────────
function transportsScene(ctx, t) {
  if (t < 15.8 || t > 19.6) return;
  headLine(ctx, 'Two ways to talk.', HEAD_X, HEAD_Y1, t, 16.0, 19.0, 100);

  // LOCAL · stdio
  const top = prog(t, 16.5, 16.85);
  if (top > 0) {
    ctx.save();
    P.wipeRect(ctx, 70, 560, 940, 400, top);
    P.fillRR(ctx, 70, 560, 940, 400, 44, C.panel);
    P.strokeRR(ctx, 70, 560, 940, 400, 44, C.line, 2);
    P.txt(ctx, 'LOCAL · stdio', 110, 616, { fam: F.monoB, size: 28, color: C.amber, track: 2 });
    P.fillRR(ctx, 110, 700, 250, 120, 26, C.panel2);
    P.strokeRR(ctx, 110, 700, 250, 120, 26, C.line, 2);
    P.txt(ctx, 'Host', 235, 774, { fam: F.semi, size: 40, color: C.paper, align: 'center' });
    P.fillRR(ctx, 720, 700, 250, 120, 26, C.panel2);
    P.strokeRR(ctx, 720, 700, 250, 120, 26, C.coral, 2);
    P.txt(ctx, 'Server', 845, 774, { fam: F.semi, size: 40, color: C.paper, align: 'center' });
    P.txt(ctx, 'stdin  ·  stdout', 540, 738, { fam: F.mono, size: 26, color: C.mute, align: 'center' });
    P.txt(ctx, 'newline-delimited JSON', 540, 880, { fam: F.mono, size: 24, color: C.mute, align: 'center' });
    ctx.restore();
    const c = P.cable(360, 760, 720, 760, 0.5);
    P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.3 * top });
    for (let k = 0; k < 2; k++) {
      const u = (((t - 17.0) * 0.8 + k * 0.5) % 1 + 1) % 1;
      P.packet(ctx, c, u, C.amber, { r: 8, a: top });
    }
  }

  // REMOTE · Streamable HTTP
  const bot = prog(t, 17.5, 17.85);
  if (bot > 0) {
    ctx.save();
    P.wipeRect(ctx, 70, 1010, 940, 390, bot);
    P.fillRR(ctx, 70, 1010, 940, 390, 44, C.panel);
    P.strokeRR(ctx, 70, 1010, 940, 390, 44, C.line, 2);
    P.txt(ctx, 'REMOTE · Streamable HTTP', 110, 1066, { fam: F.monoB, size: 28, color: C.teal, track: 2 });
    P.fillRR(ctx, 110, 1150, 250, 120, 26, C.panel2);
    P.strokeRR(ctx, 110, 1150, 250, 120, 26, C.line, 2);
    P.txt(ctx, 'Host', 235, 1224, { fam: F.semi, size: 40, color: C.paper, align: 'center' });
    P.fillRR(ctx, 640, 1150, 330, 120, 60, C.panel2);
    P.strokeRR(ctx, 640, 1150, 330, 120, 60, C.teal, 2);
    P.txt(ctx, 'mcp.example.com/mcp', 805, 1222, { fam: F.mono, size: 24, color: C.paper, align: 'center' });
    P.txt(ctx, 'POST →', 500, 1194, { fam: F.monoB, size: 26, color: C.amber, align: 'center' });
    P.txt(ctx, '← SSE stream', 500, 1262, { fam: F.monoB, size: 26, color: C.teal, align: 'center' });
    ctx.restore();
    const c = P.cable(360, 1210, 640, 1210, 0.5);
    P.strokeCable(ctx, c, C.paper, { width: 2, a: 0.3 * bot });
    for (let k = 0; k < 2; k++) {
      const u = (((t - 18.0) * 0.8 + k * 0.5) % 1 + 1) % 1;
      P.packet(ctx, c, u, C.amber, { r: 8, a: bot });
      P.packet(ctx, c, 1 - ((u + 0.25) % 1), C.teal, { r: 8, a: bot });
    }
  }
}

// ─── Scene E · offers (19.5–25 s) ─────────────────────────────────────────────
const OFFERS = [
  { kind: 'tools', name: 'TOOLS', color: C.amber, desc: 'Actions the AI can call.', methods: 'tools/list  ·  tools/call', t0: 20.0 },
  { kind: 'resources', name: 'RESOURCES', color: C.teal, desc: 'Read-only context: files, rows, docs.', methods: 'resources/list  ·  resources/read', t0: 21.0 },
  { kind: 'prompts', name: 'PROMPTS', color: C.coral, desc: 'Templates you pick, like /commands.', methods: 'prompts/list  ·  prompts/get', t0: 22.0 },
];

function offersScene(ctx, t) {
  if (t < 19.4 || t > 25.2) return;
  headLine(ctx, 'Three things', HEAD_X, HEAD_Y1, t, 19.5, 24.9);
  headLine(ctx, 'a server offers.', HEAD_X, HEAD_Y2, t, 19.9, 24.9);

  OFFERS.forEach((o, i) => {
    const y = 600 + i * 280;
    const p = prog(t, o.t0, o.t0 + 0.5);
    if (p <= 0) return;
    const pulse = i === 0 ? prog(t, 23.0, 23.15) * (1 - prog(t, 23.5, 23.9)) : 0;
    ctx.save();
    P.wipeRect(ctx, 80, y, 920, 230, outCubic(p));
    P.fillRR(ctx, 80, y, 920, 230, 36, C.panel);
    P.strokeRR(ctx, 80, y, 920, 230, 36, pulse > 0 ? C.amber : C.line, pulse > 0 ? 4 : 2);
    P.fillRR(ctx, 80, y + 36, 12, 158, 6, o.color);
    P.icon(ctx, o.kind, 170, y + 115, 92, o.color);
    P.txt(ctx, o.name, 262, y + 100, { fam: F.black, size: 60, color: C.paper, track: 1 });
    P.txt(ctx, o.desc, 262, y + 152, { fam: F.med, size: 34, color: C.paper });
    P.txt(ctx, o.methods, 262, y + 196, { fam: F.mono, size: 24, color: C.mute });
    ctx.restore();
  });
}

// ─── Scene F · the call (25–35.5 s) ───────────────────────────────────────────
// The centrepiece. A question goes in; four steps run; an answer comes back.
// Each step has its own block of code. Blocks swap with a short exit, as the rule says.

const STEP_BLOCKS = [
  {
    head: 'step 1 · discover', t0: 25.6,
    lines: [
      [['→ ', C.amber], ['server/discover', C.keyBlue]],
      [['← ', C.teal], ['"tools": ', C.keyBlue], ['{ "listChanged": true }', C.mute], [',', C.mute]],
      [['   ', C.mute], ['"resources": ', C.keyBlue], ['{}', C.mute]],
    ],
  },
  {
    head: 'step 2 · list', t0: 28.2,
    lines: [
      [['→ ', C.amber], ['tools/list', C.keyBlue]],
      [['← ', C.teal], ['{ "name": ', C.keyBlue], ['"weather_current"', C.strGreen], [',', C.mute]],
      [['   ', C.mute], ['"inputSchema": ', C.keyBlue], ['{ "location": ', C.keyBlue], ['"string"', C.strGreen], [' }', C.mute]],
    ],
  },
  {
    head: 'step 3 · call', t0: 30.6,
    lines: [
      [['→ ', C.amber], ['tools/call', C.keyBlue], [' {', C.mute]],
      [['    ', C.mute], ['"name": ', C.keyBlue], ['"weather_current"', C.strGreen], [',', C.mute]],
      [['    ', C.mute], ['"arguments": {', C.keyBlue]],
      [['      ', C.mute], ['"location": ', C.keyBlue], ['"San Francisco"', C.strGreen], [',', C.mute]],
      [['      ', C.mute], ['"units": ', C.keyBlue], ['"imperial"', C.strGreen]],
      [['    } }', C.mute]],
    ],
  },
  {
    head: 'step 4 · answer', t0: 33.0,
    lines: [
      [['← ', C.teal], ['"content": [', C.keyBlue]],
      [['    { ', C.mute], ['"type": ', C.keyBlue], ['"text"', C.strGreen], [',', C.mute]],
      [['      ', C.mute], ['"text": ', C.keyBlue], ['"68°F, partly cloudy"', C.strGreen], [' } ]', C.mute]],
    ],
  },
];

// Bus packets: [start, arrive, direction]. +1 = host→server (request), -1 = server→host.
const BUS = [
  [25.6, 26.0, +1], [26.4, 26.8, -1],
  [28.1, 28.5, +1], [28.9, 29.3, -1],
  [30.6, 31.0, +1], [31.8, 32.2, -1],
  [33.0, 33.4, -1],
];

function callScene(ctx, t) {
  if (t < 24.9 || t > 35.6) return;
  headLine(ctx, 'Ask once.', HEAD_X, HEAD_Y1, t, 25.0, 35.2);
  headLine(ctx, 'Four steps.', HEAD_X, HEAD_Y2, t, 25.5, 35.2);

  // user bubble
  const ub = sp(t, 25.0, 0.8, 2.8);
  if (ub > 0) {
    const text = "What's the weather in San Francisco?";
    const tw = P.measure(ctx, text, { fam: F.med, size: 38 });
    const bw = tw + 60;
    P.fillRR(ctx, 1010 - bw, 600, bw, 84, 42, C.panel2, clamp(ub));
    P.txt(ctx, text, 1010 - bw / 2, 655, { fam: F.med, size: 38, color: C.paper, align: 'center', a: clamp(ub) });
  }

  // step rail
  const names = ['1 Discover', '2 List', '3 Call', '4 Answer'];
  const starts = [25.5, 28.0, 30.5, 33.0];
  names.forEach((n, i) => {
    const x = 60 + i * 242;
    const active = t >= starts[i] && (i === 3 || t < starts[i + 1]);
    const done = t >= starts[i] && !active;
    const pp = sp(t, starts[i] - 0.3, 0.8, 3.0);
    if (pp <= 0) return;
    P.fillRR(ctx, x, 720, 224, 62, 31, active ? C.amber : C.panel, clamp(pp));
    if (!active) P.strokeRR(ctx, x, 720, 224, 62, 31, done ? C.paper : C.line, 2, clamp(pp));
    P.txt(ctx, n, x + 112, 761, { fam: F.monoB, size: 26, color: active ? C.ink : done ? C.paper : C.mute, align: 'center', a: clamp(pp), track: 1 });
  });

  // bus: HOST ─── SERVER with packets
  const busY = 840;
  const hostX = 250, srvX = 830;
  P.fillRR(ctx, 60, busY - 40, 190, 80, 40, C.panel2, sp(t, 25.4, 0.8, 2.8));
  P.txt(ctx, 'HOST', 155, busY + 10, { fam: F.monoB, size: 28, color: C.paper, align: 'center', a: sp(t, 25.4, 0.8, 2.8) });
  P.fillRR(ctx, 830, busY - 40, 190, 80, 40, C.panel2, sp(t, 25.4, 0.8, 2.8));
  P.strokeRR(ctx, 830, busY - 40, 190, 80, 40, C.coral, 2, sp(t, 25.4, 0.8, 2.8));
  P.txt(ctx, 'SERVER', 925, busY + 10, { fam: F.monoB, size: 28, color: C.paper, align: 'center', a: sp(t, 25.4, 0.8, 2.8) });
  const bc = P.cable(hostX, busY, srvX, busY, 0.5);
  P.strokeCable(ctx, bc, C.line, { width: 3, a: prog(t, 25.4, 25.8), dash: [4, 12], dashOffset: 0 });
  for (const [a, b, dir] of BUS) {
    if (t < a || t > b + 0.12) continue;
    const u = clamp((t - a) / (b - a));
    if (dir > 0) {
      P.packet(ctx, bc, u, C.amber, { r: 11 });
    } else {
      P.packet(ctx, bc, 1 - u, C.teal, { r: 11 });
    }
  }

  // code card (blocks swap: the old one leaves short, the new one types in)
  const card = { x: 60, y: 900, w: 960, h: 340 };
  let active = null;
  for (let i = 0; i < STEP_BLOCKS.length; i++) {
    const b = STEP_BLOCKS[i];
    const next = STEP_BLOCKS[i + 1];
    const outT = next ? next.t0 - 0.12 : 99;
    if (t >= b.t0 - 0.02 && t < outT + 0.12) {
      active = { b, i, out: t > outT ? 1 - prog(t, outT, outT + 0.12) : 1 };
    }
  }
  if (active) {
    const { b, out } = active;
    const cardIn = sp(t, b.t0 - 0.02, 0.85, 3.0);
    P.fillRR(ctx, card.x, card.y, card.w, card.h, 34, C.panel, clamp(out) * clamp(cardIn));
    P.strokeRR(ctx, card.x, card.y, card.w, card.h, 34, C.line, 2, clamp(out) * clamp(cardIn));
    P.txt(ctx, b.head, card.x + 40, card.y + 58, { fam: F.mono, size: 24, color: C.mute, track: 2, a: out });
    b.lines.forEach((line, li) => {
      const lt0 = b.t0 + li * 0.2;
      const total = line.reduce((n, [s]) => n + s.length, 0);
      const count = clamp((t - lt0) / 0.18) * total;
      let remaining = Math.floor(count);
      if (remaining <= 0) return;
      let x = card.x + 40;
      const y = card.y + 120 + li * 56;
      for (const [s, color] of line) {
        if (remaining <= 0) break;
        const part = s.slice(0, remaining);
        remaining -= s.length;
        P.txt(ctx, part, x, y, { fam: F.mono, size: 30, color, a: out });
        x += P.measure(ctx, s, { fam: F.mono, size: 30 });
      }
    });
  }

  // the answer, as a reply bubble
  const rb = sp(t, 34.5, 0.8, 2.8);
  if (rb > 0) {
    const text = "It's 68°F and partly cloudy in San Francisco.";
    const tw = P.measure(ctx, text, { fam: F.med, size: 36 });
    const bw = Math.min(tw + 60, 980);
    P.fillRR(ctx, 60, 1300, bw * clamp(rb), 84, 42, C.teal, clamp(rb));
    P.txt(ctx, text, 60 + 30, 1355, { fam: F.med, size: 36, color: C.ink, a: clamp(rb) });
  }
}

// ─── Scene G · control (35.5–38 s) ────────────────────────────────────────────
function controlScene(ctx, t) {
  if (t < 35.4 || t > 38.1) return;
  const lines = [
    { s: 'The model proposes.', t0: 35.5, y: 900 },
    { s: 'The host decides.', t0: 36.5, y: 1040 },
  ];
  for (const l of lines) {
    const p = sp(t, l.t0, 0.9, 2.6);
    if (p > 0) P.maskLine(ctx, l.s, HEAD_X, l.y, clamp(p), { fam: F.black, size: 86, color: C.paper });
  }
  // third line: "You can say no." with "no." in amber
  const p3 = sp(t, 37.5, 0.9, 2.6);
  if (p3 > 0) {
    const a = 'You can say ';
    const b = 'no.';
    const wa = P.measure(ctx, a, { fam: F.black, size: 86 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(HEAD_X - 10, 1180 - 86 * 1.05, 860, 86 * 1.4);
    ctx.clip();
    const off = (1 - clamp(p3)) * 86 * 1.15;
    P.txt(ctx, a, HEAD_X, 1180 + off, { fam: F.black, size: 86, color: C.paper });
    P.txt(ctx, b, HEAD_X + wa, 1180 + off, { fam: F.black, size: 86, color: C.amber });
    ctx.restore();
  }
  // a rule that draws in under the lines
  const rule = prog(t, 36.0, 36.6);
  if (rule > 0) {
    P.fillRR(ctx, HEAD_X, 1280, 920 * rule, 6, 3, C.line);
  }
}

// ─── Scene H · end (38–40 s) ──────────────────────────────────────────────────
function endScene(ctx, t) {
  if (t < 37.9) return;
  const g = outExpo(prog(t, 38.0, 38.6));
  const w = 920 * g;
  if (w > 2) {
    P.fillRR(ctx, 540 - w / 2, 720, w, 300, 60, C.amber);
    ctx.save();
    ctx.beginPath();
    ctx.rect(540 - w / 2, 720, w, 300);
    ctx.clip();
    P.txt(ctx, 'MCP', 540, 930, { fam: F.black, size: 230, color: C.ink, align: 'center' });
    ctx.restore();
  }
  const tag = sp(t, 38.9, 0.9, 2.6);
  if (tag > 0) P.maskLine(ctx, 'Build once.', HEAD_X + 80, 1130, clamp(tag), { fam: F.black, size: 84, color: C.paper });
  const tag2 = sp(t, 39.2, 0.9, 2.6);
  if (tag2 > 0) P.maskLine(ctx, 'Connect everywhere.', HEAD_X + 80, 1230, clamp(tag2), { fam: F.black, size: 84, color: C.paper });
  const url = sp(t, 39.5, 0.8, 3.0);
  if (url > 0) {
    const label = 'modelcontextprotocol.io';
    const w2 = P.measure(ctx, label, { fam: F.monoB, size: 34 }) + 70;
    P.strokeRR(ctx, 540 - w2 / 2, 1340, w2, 80, 40, C.amber, 3, clamp(url));
    P.txt(ctx, label, 540, 1392, { fam: F.monoB, size: 34, color: C.amber, align: 'center', a: clamp(url) });
  }
  const sub = sp(t, 39.7, 0.9, 2.6);
  if (sub > 0) P.txt(ctx, 'Open standard · JSON-RPC 2.0', 540, 1516, { fam: F.mono, size: 26, color: C.mute, align: 'center', a: clamp(sub) });
}

// ─── captions (screen space, bottom zone) ─────────────────────────────────────
export const CAPTIONS = [
  [0.3, 3.0, ['Every AI app needs its own plug', 'for every tool.']],
  [3.3, 4.9, ['MCP makes it one standard plug per side.']],
  [5.6, 8.8, ['One open protocol, built on JSON-RPC 2.0.']],
  [9.6, 11.4, ['HOST: the AI app you use,', 'like Claude Code or VS Code.']],
  [11.4, 12.9, ['CLIENT: lives inside the host.', 'One client per server.']],
  [12.9, 14.6, ['SERVER: exposes tools,', 'resources and prompts.']],
  [14.6, 15.9, ['Always one client to one server.']],
  [16.3, 19.3, ['Local: the host starts the server as a', 'subprocess. Remote: plain HTTP.']],
  [19.8, 24.8, ['A server offers three kinds of things.']],
  [25.4, 27.9, ['Step 1 · Discover what the server can do.']],
  [28.0, 30.4, ['Step 2 · List its tools and their inputs.']],
  [30.5, 32.9, ['Step 3 · Call one with JSON arguments.']],
  [33.0, 35.4, ['Step 4 · The result goes back to the model.']],
];

function captions(ctx, t) {
  for (const [t0, t1, lines] of CAPTIONS) {
    if (t < t0 || t > t1) continue;
    const out = 1 - prog(t, t1 - 0.2, t1);
    lines.forEach((s, i) => {
      const p = sp(t, t0 + i * 0.06, 0.9, 2.8);
      const y = 1520 + i * 62;
      // a backing plate keeps captions legible over any scene
      const w = P.measure(ctx, s, { fam: F.semi, size: 44 }) + 40;
      P.fillRR(ctx, 60, y - 50, w, 62, 14, C.ink, 0.72 * clamp(p) * out);
      ctx.save();
      ctx.globalAlpha = out;
      P.maskLine(ctx, s, 80, y, clamp(p), { fam: F.semi, size: 44, color: C.paper });
      ctx.restore();
    });
  }
}

// ─── chrome (screen space, always visible) ────────────────────────────────────
function chrome(ctx, t) {
  // title chip
  const label = 'HOW MCP WORKS';
  const tw = P.measure(ctx, label, { fam: F.monoB, size: 26, track: 4 });
  const w = tw + 90;
  P.fillRR(ctx, 540 - w / 2, 120, w, 60, 30, C.panel);
  P.circle(ctx, 540 - w / 2 + 34, 150, 8, C.amber);
  P.txt(ctx, label, 540 + 18, 160, { fam: F.monoB, size: 26, color: C.paper, align: 'center', track: 4 });

  // progress: a playhead along the bottom
  const p = clamp(t / DUR);
  P.fillRR(ctx, 60, 1862, 960, 6, 3, C.line);
  P.fillRR(ctx, 60, 1862, 960 * p, 6, 3, C.amber);
  // scene index + timecode
  const idx = Math.max(1, SCENES.findIndex((sc) => t >= sc.t0 && t < sc.t1) + 1 || SCENES.length);
  P.txt(ctx, `${String(idx).padStart(2, '0')} / 08`, 60, 1840, { fam: F.mono, size: 24, color: C.mute });
  const sec = Math.floor(t), frac = Math.floor((t - sec) * 10);
  P.txt(ctx, `0:${String(sec).padStart(2, '0')}.${frac} / 0:40`, 1020, 1840, { fam: F.mono, size: 24, color: C.mute, align: 'right' });
}

// ─── entry point ─────────────────────────────────────────────────────────────
export function draw(ctx, t) {
  P.bg(ctx);
  const cam = camera(t);
  // p' = centre + s · (p − focus): the focus point always sits at the middle of the frame
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(cam.s, cam.s);
  ctx.translate(-cam.fx, -cam.fy);
  hookScene(ctx, t);
  protocolScene(ctx, t);
  rolesScene(ctx, t);
  transportsScene(ctx, t);
  offersScene(ctx, t);
  callScene(ctx, t);
  controlScene(ctx, t);
  endScene(ctx, t);
  ctx.restore();

  captions(ctx, t);
  chrome(ctx, t);
}
