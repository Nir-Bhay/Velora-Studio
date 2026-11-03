// shiva-ganesha-video/audio.mjs
//
// Every sound is synthesized in code. No samples, no downloads.
//   node audio.mjs   → out/music-master.wav (48 kHz stereo, 60.000 s, 32-bit float)
//
// The bed is a soft drone (a tanpura-like stack of D and A with slow beating), so the narration
// has room. The hits are placed from brand.mjs EVENTS. Each hit's peak lands one frame
// (1/60 s) after its picture event: a sound early by a frame feels wrong, one frame late reads
// as on the beat.

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUR, FPS, EVENTS } from './brand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// seeded noise: deterministic, identical every run
let seed = 987654321;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

/** Add a sound whose peak sits at sample `onset`. gen(s) gives the sample at s seconds after onset. */
function place(onset, len, gain, pan, gen) {
  const n0 = Math.round(onset);
  for (let k = 0; k < Math.round(len * SR); k++) {
    const i = n0 + k;
    if (i < 0 || i >= N) continue;
    const s = gen(k / SR) * gain;
    L[i] += s * Math.sqrt(0.5 * (1 - pan));
    R[i] += s * Math.sqrt(0.5 * (1 + pan));
  }
}

const att = (t, a = 0.002) => Math.min(1, t / a);
const dec = (t, tau) => Math.exp(-t / tau);

const SOUND = {
  // temple bell: inharmonic partials, a long ring
  bell(t) {
    const f = 620;
    const parts = [[1, 1, 1.4], [2.76, 0.45, 0.9], [5.4, 0.2, 0.5], [8.93, 0.1, 0.25]];
    let s = 0;
    for (const [m, a, tau] of parts) s += a * Math.sin(2 * Math.PI * f * m * t) * dec(t, tau);
    return 0.5 * s * att(t, 0.004);
  },
  // damru-like: two quick pitch-dropping thumps
  drum(t) {
    const tt = t % 0.12;
    const f = 190 * Math.exp(-tt * 40) + 70;
    return Math.sin(2 * Math.PI * f * tt) * dec(tt, 0.06) * att(tt, 0.002) * 0.9;
  },
  // a breath of air across the cut: band-limited noise with a rising then falling swell
  whoosh(t) {
    const env = Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 2;
    return env * 0.12 * (rnd() * 0.6 + 0.4 * Math.sin(2 * Math.PI * 180 * t));
  },
  // the cut: a low body falling, plus a short band of noise on top
  slam(t) {
    const f = 46 + 110 * Math.exp(-t * 20);
    const body = Math.sin(2 * Math.PI * f * t) * dec(t, 0.14) * att(t);
    return 0.85 * body + 0.2 * rnd() * dec(t, 0.015) * att(t);
  },
  // a soft chime: three partials, a bright short ring
  chime(t) {
    const f = 1046;
    return (Math.sin(2 * Math.PI * f * t) * 0.6 + Math.sin(2 * Math.PI * f * 1.5 * t) * 0.3 + Math.sin(2 * Math.PI * f * 2 * t) * 0.15)
      * dec(t, 0.5) * att(t, 0.003) * 0.7;
  },
  tick(t) {
    return Math.sin(2 * Math.PI * 1900 * t) * dec(t, 0.012) * att(t, 0.0005) * 0.45;
  },
};

const LEN = { bell: 4.5, drum: 0.2, whoosh: 0.5, slam: 1.2, chime: 2.2, tick: 0.08 };

// ── the drone bed: D2, A2, D3 with slow beating, one swell per scene ─────────
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const swell = Math.min(1, t / 2) * Math.min(1, (DUR - t) / 2.5);
  const beat = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t);
  const d = 0.05 * (Math.sin(2 * Math.PI * 73.42 * t) + 0.5 * Math.sin(2 * Math.PI * 146.83 * t) + 0.35 * Math.sin(2 * Math.PI * 110 * t * 1.0005));
  const v = d * beat * swell;
  L[i] += v * 0.9;
  R[i] += v * 1.0;
}

// ── event hits: peak lands one frame after the picture event ─────────────────
for (const [t, kind, gain, pan] of EVENTS) {
  const onset = (t + 1 / FPS) * SR;
  place(onset, LEN[kind] ?? 1, gain, pan, SOUND[kind]);
}

// ── write a 32-bit float WAV (stereo, 48 kHz) ─────────────────────────────────
function wav(l, r) {
  const n = l.length;
  const buf = Buffer.alloc(44 + n * 2 * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2 * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2 * 4, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2 * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    buf.writeFloatLE(l[i], o); o += 4;
    buf.writeFloatLE(r[i], o); o += 4;
  }
  return buf;
}

await mkdir(join(here, 'out'), { recursive: true });
await writeFile(join(here, 'out/music-master.wav'), wav(L, R));
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
console.log(`out/music-master.wav · ${DUR.toFixed(3)} s · ${EVENTS.length} hits · peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`);
