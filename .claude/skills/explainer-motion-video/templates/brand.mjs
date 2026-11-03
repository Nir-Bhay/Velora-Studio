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

// Scene table: name, start, end (seconds). Every boundary is a multiple of BEAT.
export const SCENES = [
  { id: 'hook', t0: 0.0, t1: 5.0 },
  { id: 'protocol', t0: 5.0, t1: 9.0 },
  { id: 'roles', t0: 9.0, t1: 16.0 },
  { id: 'transports', t0: 16.0, t1: 19.5 },
  { id: 'offers', t0: 19.5, t1: 25.0 },
  { id: 'call', t0: 25.0, t1: 35.5 },
  { id: 'control', t0: 35.5, t1: 38.0 },
  { id: 'end', t0: 38.0, t1: 40.0 },
];

// Every sound event, as seconds of PICTURE time. The audio engine places each
// peak at t + 1 frame (the article's sync rule: the hit lands one frame after its visual).
// kinds: slam, thock, tick, pop, whoosh, bloop, snap, chime, type, kick
export const EVENTS = [
  // A · hook
  { t: 0.0, k: 'slam' }, { t: 0.5, k: 'slam' },
  { t: 1.0, k: 'whoosh' },
  ...Array.from({ length: 25 }, (_, i) => ({ t: 1.0 + i * 0.04, k: 'tick' })),
  { t: 2.0, k: 'thock' },
  { t: 3.0, k: 'whoosh' }, { t: 3.4, k: 'slam' }, { t: 3.5, k: 'snap' },
  ...Array.from({ length: 12 }, (_, i) => ({ t: 3.6 + i * 0.066, k: 'tick' })),
  { t: 4.4, k: 'chime' },
  // B · protocol
  { t: 5.0, k: 'slam' }, { t: 5.5, k: 'whoosh' }, { t: 6.3, k: 'thock' },
  ...Array.from({ length: 12 }, (_, j) => ({ t: 6.5 + j * 0.05, k: 'pop' })),
  { t: 7.3, k: 'tick' }, { t: 7.9, k: 'tick' },
  // C · roles
  { t: 9.0, k: 'slam' }, { t: 9.5, k: 'thock' }, { t: 10.0, k: 'whoosh' },
  { t: 10.5, k: 'pop' }, { t: 11.0, k: 'pop' }, { t: 11.5, k: 'whoosh' },
  { t: 12.0, k: 'thock' }, { t: 12.5, k: 'thock' },
  { t: 13.0, k: 'bloop' }, { t: 13.5, k: 'bloop' }, { t: 14.0, k: 'bloop' }, { t: 14.5, k: 'bloop' },
  { t: 15.0, k: 'chime' },
  // D · transports
  { t: 16.0, k: 'slam' }, { t: 16.5, k: 'whoosh' }, { t: 16.6, k: 'thock' },
  { t: 17.5, k: 'whoosh' }, { t: 17.6, k: 'thock' },
  { t: 18.0, k: 'bloop' }, { t: 18.5, k: 'bloop' }, { t: 19.0, k: 'tick' },
  // E · offers
  { t: 19.5, k: 'slam' },
  { t: 20.0, k: 'thock' }, { t: 21.0, k: 'thock' }, { t: 22.0, k: 'thock' },
  { t: 23.0, k: 'chime' }, { t: 23.5, k: 'tick' }, { t: 24.0, k: 'tick' },
  // F · the call
  { t: 25.0, k: 'pop' }, { t: 25.0, k: 'slam' }, { t: 25.5, k: 'slam' },
  { t: 25.5, k: 'pop' }, { t: 25.6, k: 'bloop' }, { t: 26.0, k: 'bloop' }, { t: 26.4, k: 'bloop' }, { t: 26.8, k: 'bloop' },
  ...Array.from({ length: 6 }, (_, i) => ({ t: 25.7 + i * 0.12, k: 'type' })),
  { t: 28.0, k: 'pop' }, { t: 28.1, k: 'bloop' }, { t: 28.5, k: 'bloop' }, { t: 28.9, k: 'bloop' }, { t: 29.3, k: 'bloop' },
  ...Array.from({ length: 6 }, (_, i) => ({ t: 28.2 + i * 0.12, k: 'type' })),
  { t: 30.5, k: 'pop' }, { t: 30.6, k: 'bloop' }, { t: 31.0, k: 'bloop' }, { t: 31.8, k: 'bloop' }, { t: 32.2, k: 'bloop' },
  ...Array.from({ length: 8 }, (_, i) => ({ t: 30.7 + i * 0.12, k: 'type' })),
  { t: 33.0, k: 'pop' }, { t: 33.1, k: 'type' }, { t: 33.3, k: 'type' }, { t: 33.5, k: 'type' },
  { t: 34.5, k: 'pop' }, { t: 35.0, k: 'chime' },
  // G · control
  { t: 35.5, k: 'thock' }, { t: 36.5, k: 'thock' }, { t: 37.5, k: 'thock' },
  // H · end
  { t: 38.0, k: 'whoosh' }, { t: 38.5, k: 'chime' }, { t: 39.0, k: 'tick' }, { t: 39.5, k: 'pop' },
].sort((a, b) => a.t - b.t);
