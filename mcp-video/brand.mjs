// mcp-video/brand.mjs
//
// One place for the numbers that both the picture and the sound depend on:
// canvas size, frame rate, tempo, palette, fonts, and the EVENTS list.
// The film draws from these; the soundtrack is placed from the same EVENTS list,
// so a hit and the picture it belongs to can never drift apart.

export const W = 1080;          // 9:16 vertical — Reels, Shorts, TikTok, X
export const H = 1920;
export const FPS = 60;
export const DUR = 40.0;        // seconds. Brief: 30–42 s.
export const BPM = 120;
export const BEAT = 60 / BPM;   // 0.5 s — every scene cut lands on this grid

export const C = {
  ink: '#0D0E11',
  panel: '#16181E',
  panel2: '#1E2129',
  line: '#2B2F38',
  mute: '#8B919C',
  paper: '#F4F1EA',
  amber: '#FFB547',   // requests, data, the MCP pillar
  teal: '#3DDBC0',    // client, responses, resources
  coral: '#FF7A59',   // server, prompts
  keyBlue: '#8FD3FF', // code: keys
  strGreen: '#A8E6A1',// code: strings
};

// Font families registered in render.mjs from fonts/.
export const F = {
  black: 'InterBlack',
  bold: 'InterX',
  semi: 'InterSemi',
  med: 'InterMed',
  mono: 'JBMono',
  monoB: 'JBBold',
};

// Scene table. Each cut sits on the 120 BPM grid (multiples of 0.5 s), and each scene window
// is sized to its narration clip (voiceover/out/v2). The loop closes at DUR: the last 0.5 s
// dissolve into the opening frame, so the film repeats with no end card.
export const SCENES = [
  { id: 'hook',     t0: 0.0,  t1: 6.0,  label: 'The problem' },
  { id: 'solution', t0: 6.0,  t1: 10.0, label: 'One plug' },
  { id: 'waiter',   t0: 10.0, t1: 15.0, label: 'Like a waiter' },
  { id: 'steps',    t0: 15.0, t1: 25.0, label: 'Four steps' },
  { id: 'control',  t0: 25.0, t1: 31.0, label: 'You decide' },
  { id: 'newtool',  t0: 31.0, t1: 35.0, label: 'Add a tool' },
  { id: 'loop',     t0: 35.0, t1: 40.0, label: 'Again' },
];
export const LOOP_DISSOLVE_FROM = 39.5; // the final 0.5 s blends into frame 0

// Every sound event, in seconds of PICTURE time. audio.mjs places each peak at t + 1 frame.
// kinds: slam, thock, tick, pop, whoosh, bloop, snap, chime
export const EVENTS = [
  // 1 · the problem (0–6): the 48 wires are already there; the counter rolls
  { t: 0.0, k: 'slam' },
  ...Array.from({ length: 20 }, (_, i) => ({ t: 0.2 + i * 0.06, k: 'tick' })),
  { t: 1.5, k: 'thock' }, { t: 2.5, k: 'pop' }, { t: 3.5, k: 'thock' },
  // 2 · one plug (6–10): the wires fold into one socket
  { t: 6.1, k: 'whoosh' },
  ...Array.from({ length: 8 }, (_, i) => ({ t: 6.2 + i * 0.1, k: 'tick' })),
  { t: 6.9, k: 'snap' }, { t: 7.6, k: 'chime' }, { t: 8.4, k: 'pop' },
  // 3 · the waiter (10–15): the order slip travels
  { t: 10.0, k: 'slam' }, { t: 10.6, k: 'whoosh' }, { t: 11.4, k: 'pop' }, { t: 12.2, k: 'pop' },
  { t: 13.0, k: 'bloop' }, { t: 14.4, k: 'chime' },
  // 4 · four steps (15–25): one sound per card, on the voice's word
  { t: 15.2, k: 'pop' }, { t: 15.48, k: 'pop' }, { t: 17.25, k: 'bloop' },
  { t: 18.82, k: 'thock' }, { t: 20.09, k: 'chime' },
  // 5 · you decide (25–31): the tap lands on "haan"
  { t: 25.0, k: 'slam' }, { t: 25.5, k: 'pop' }, { t: 28.2, k: 'thock' }, { t: 28.5, k: 'chime' },
  // 6 · add a tool (31–35): the tile drops and clicks in
  { t: 31.1, k: 'whoosh' }, { t: 32.0, k: 'thock' }, { t: 33.0, k: 'snap' }, { t: 33.3, k: 'chime' },
  // 7 · loop (35–40): the closing slam, then the dissolve
  { t: 35.0, k: 'slam' }, { t: 37.2, k: 'thock' },
];
