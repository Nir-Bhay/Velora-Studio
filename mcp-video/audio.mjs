// mcp-video/audio.mjs
//
// Every sound is synthesized in code (no samples, no downloads).
// Each hit's PEAK lands one frame (1/60 s) after its picture event — the article's rule:
// a sound that lands before its picture feels wrong; one frame late reads as on-beat.
//
//   node audio.mjs                 → out/audio-master.wav (48 kHz stereo, 40.000 s)
//
// Bed: a soft 120 BPM pulse (kick on each beat, 8th-note hats from 15 s) and a
// slow pad that follows the chord per bar. Hits sit well above the bed.

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DUR, FPS, BPM, BEAT, EVENTS } from './brand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// seeded noise: deterministic, identical every run
let seed = 1234567;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296 * 2 - 1;
};

/** Add a sound whose peak sits at sample `onset`. `gen(k)` returns the sample at k samples after onset. */
function place(onset, len, gain, pan, gen) {
  const n0 = Math.round(onset);
  for (let k = 0; k < len; k++) {
    const i = n0 + k;
    if (i < 0 || i >= N) continue;
    const s = gen(k / SR) * gain;
    L[i] += s * Math.sqrt(0.5 * (1 - pan));
    R[i] += s * Math.sqrt(0.5 * (1 + pan));
  }
}

const attack = (t, a = 0.001) => Math.min(1, t / a);
const decay = (t, tau) => Math.exp(-t / tau);

// ── the sound palette ─────────────────────────────────────────────────────────
const SOUNDS = {
  slam(t) {
    // thump + air: a low body that falls, and a short band of noise on top
    const f = 48 + 90 * Math.exp(-t * 22);
    const thump = Math.sin(2 * Math.PI * f * t) * decay(t, 0.09) * attack(t);
    return 0.9 * thump + 0.25 * rnd() * decay(t, 0.012) * attack(t);
  },
  thock(t) {
    const f = 140 * Math.exp(-t * 18) + 55;
    return Math.sin(2 * Math.PI * f * t) * decay(t, 0.07) * attack(t) * 0.8 + 0.12 * rnd() * decay(t, 0.004) * attack(t);
  },
  tick(t) {
    return Math.sin(2 * Math.PI * 1900 * t) * decay(t, 0.012) * attack(t, 0.0005) * 0.45;
  },
  type(t) {
    return (0.3 * rnd() * decay(t, 0.003) + 0.25 * Math.sin(2 * Math.PI * 2600 * t) * decay(t, 0.004)) * attack(t, 0.0003);
  },
  pop(t) {
    const f = 520 + 260 * (1 - Math.exp(-t * 60));
    return Math.sin(2 * Math.PI * f * t) * decay(t, 0.05) * attack(t) * 0.55;
  },
  bloop(t) {
    // a pitch-rising bubble: the "packet arrived" sound
    const f = 380 + 420 * (1 - Math.exp(-t * 18));
    return Math.sin(2 * Math.PI * f * t) * decay(t, 0.06) * attack(t) * 0.6;
  },
  snap(t) {
    return (0.8 * rnd() * decay(t, 0.006) + 0.6 * Math.sin(2 * Math.PI * 220 * t) * decay(t, 0.04)) * attack(t, 0.0005) * 0.7;
  },
  chime(t) {
    // two partials, a musical tone: the "landed" sound (D major arpeggio colour)
    return (Math.sin(2 * Math.PI * 880 * t) * 0.6 + Math.sin(2 * Math.PI * 1320 * t) * 0.35) * decay(t, 0.35) * attack(t) * 0.5;
  },
};

// whoosh: a one-pole filter has state across samples, so it is rendered as its own buffer
function whooshBuffer(len) {
  const out = new Float32Array(len);
  let y = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const fc = 300 + 5200 * Math.pow(Math.min(1, t / 0.5), 2);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += a * (rnd() - y);
    const env = Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 2 * decay(Math.max(0, t - 0.5), 0.05);
    out[k] = y * env * 1.6;
  }
  return out;
}

// ── the bed ───────────────────────────────────────────────────────────────────
const beatSec = BEAT;
const CHORDS = [[110, 130.81, 164.81], [87.31, 110, 130.81], [130.81, 164.81, 196], [98, 123.47, 146.83]]; // Am, F, C, G (sub octave)

function bed() {
  // kick on every beat, quiet
  for (let b = 0; b * beatSec < DUR - 1.2; b++) {
    const t0 = b * beatSec;
    if (t0 > DUR - 0.5) break;
    place(t0 * SR, 0.3 * SR, 0.35, 0, (t) => Math.sin(2 * Math.PI * (48 + 60 * Math.exp(-t * 35)) * t) * decay(t, 0.12) * attack(t, 0.002));
  }
  // 8th-note hats from 15 s on (the steps scene), running to the end so the loop tail has the same groove
  for (let e = 0; e * beatSec / 2 < DUR - 0.5; e++) {
    const t0 = e * beatSec / 2;
    if (t0 < 15.0) continue;
    place(t0 * SR, 0.05 * SR, 0.05, e % 2 ? 0.3 : -0.3, (t) => rnd() * decay(t, 0.012) * attack(t, 0.0005));
  }
  // pad: a slow chord per bar (4 beats = 2 s), fading in and out of the film
  const bar = 4 * beatSec;
  for (let i = 0; i * bar < DUR; i++) {
    const t0 = i * bar;
    const chord = CHORDS[i % CHORDS.length];
    for (const f of chord) {
      place(t0 * SR, bar * SR, 0.012, 0, (t) => {
        const env = Math.min(1, t / 0.4) * Math.min(1, (bar - t) / 0.4);
        return Math.sin(2 * Math.PI * f * t) * env;
      });
    }
  }
}

// ── render ────────────────────────────────────────────────────────────────────
bed();

const pan = (k, t) => (k === 'whoosh' ? Math.max(-0.5, Math.min(0.5, -0.6 + (t / DUR) * 0.6)) : 0);

for (const ev0 of EVENTS) {
  const k = ev0.k;
  // events past DUR wrap to the start: the film loops, so a late hit belongs to the next play-through's opening
  const et = ev0.t >= DUR ? ev0.t - DUR : ev0.t;
  // the frame after the picture event
  const onset = (et + 1 / FPS) * SR;
  if (k === 'whoosh') {
    const buf = whooshBuffer(Math.round(0.9 * SR));
    const n0 = Math.round(onset);
    for (let i = 0; i < buf.length; i++) {
      const idx = n0 + i;
      if (idx >= N) break;
      L[idx] += buf[i] * 0.5 * Math.sqrt(0.5 * (1 - pan(k, et)));
      R[idx] += buf[i] * 0.5 * Math.sqrt(0.5 * (1 + pan(k, et)));
    }
    continue;
  }
  const gen = SOUNDS[k];
  if (!gen) throw new Error(`unknown sound kind ${k}`);
  const len = k === 'chime' ? 1.2 * SR : k === 'slam' ? 0.4 * SR : 0.5 * SR;
  place(onset, len, k === 'slam' ? 0.9 : k === 'thock' ? 0.7 : k === 'chime' ? 0.6 : 0.55, 0, gen);
}

// remove DC, guard the peak (the loudness stage normalises the level later)
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const mL = mean(L), mR = mean(R);
let peak = 0;
// 0.5 s cosine fade-out to silence at DUR. The picture dissolves into frame 0 over the same half second,
// so the loop point has no click and no hard cut; the opening slam then arrives on a clean floor.
const FADE0 = N - Math.round(0.5 * SR);
for (let i = 0; i < N; i++) {
  const g = i >= FADE0 ? 0.5 + 0.5 * Math.cos((Math.PI * (i - FADE0)) / (N - FADE0)) : 1;
  L[i] = (L[i] - mL) * g; R[i] = (R[i] - mR) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = peak > 0.95 ? 0.95 / peak : 1;

// 16-bit PCM WAV, stereo
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * norm * 32767))), i * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * norm * 32767))), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);

await mkdir(join(here, 'out'), { recursive: true });
const outPath = join(here, 'out', 'audio-master.wav');
await writeFile(outPath, Buffer.concat([header, data]));
console.log(`audio → ${outPath}  (${(N / SR).toFixed(3)} s, ${BPM} BPM, ${EVENTS.length} hits, peak before norm ${peak.toFixed(3)})`);
