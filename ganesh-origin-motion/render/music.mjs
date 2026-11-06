// Original music bed and hits, synthesised from scratch (sine pads, filtered noise,
// FM bells, a sub-bass impact). No samples, no recordings. Writes out/music.wav.
// The bed ducks under the Hindi VO so the narration stays clear.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root: the folder that holds script.json, assets/, audio/, fonts/ and out/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Timeline and on-screen text (scenes, captions, highlights), loaded from script.json.
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'));
// Measured length of each VO clip in seconds, written by render/measure.mjs.
const VDUR = JSON.parse(fs.readFileSync(path.join(ROOT, 'out', 'vo-durations.json'), 'utf8'));
// Audio sample rate in Hz.
const SR = 44100;
// Total length of the film in seconds.
const DUR = S.duration;
// Number of audio samples in the whole film, per channel.
const N = SR * DUR;
// Left and right channel buffers for the music mix.
const L = new Float32Array(N);
const R = new Float32Array(N);

// Seed for the noise generator, so every build produces the same audio.
let seed = 20261103;
// Deterministic pseudo-random number in [-1, 1). Used instead of Math.random so builds are repeatable.
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

// Adds a sound: for every sample from start for dur seconds, calls fn(localTime, dur) and mixes the result into L/R with the given stereo pan.
function add(start, dur, fn, pan = 0) {
  const i0 = Math.max(0, Math.floor(start * SR));
  const i1 = Math.min(N, Math.floor((start + dur) * SR));
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = i0; i < i1; i++) {
    const v = fn(i / SR - start, dur);
    L[i] += v * gl;
    R[i] += v * gr;
  }
}

// Simple envelope: fades in over a seconds and out over r seconds, clamped to 0..1.
const env = (tl, dur, a, r) => Math.max(0, Math.min(1, tl / a, (dur - tl) / r));
// One full turn in radians, used for circles and arcs.
const TAU = 2 * Math.PI;

// 1) Pad: one chord per section, overlapping soft fades.
const PADS = [
  { a: 0, b: 14, f: [73.42, 110.0, 146.83], amp: 0.1, lfo: 0.07 }, // D2 A2 D3 - cold mystery
  { a: 14, b: 27, f: [73.42, 87.31, 110.0], amp: 0.1, lfo: 0.12 }, // D2 F2 A2 - tension
  { a: 27, b: 35, f: [58.27, 69.3, 116.54], amp: 0.12, lfo: 0.6 }, // stormy, unsettled
  { a: 35, b: 41, f: [69.3, 103.83, 138.59], amp: 0.09, lfo: 0.05 }, // dark, grief
  { a: 41, b: 51, f: [98.0, 146.83, 246.94], amp: 0.11, lfo: 0.1 }, // luminous rebirth
  { a: 51, b: 60, f: [98.0, 130.81, 164.81, 196.0], amp: 0.12, lfo: 0.08 }, // warm resolve
];
for (const p of PADS) {
  add(p.a, p.b - p.a, (tl, dur) => {
    let v = 0;
    for (const f of p.f) v += Math.sin(TAU * f * tl) + 0.5 * Math.sin(TAU * f * 1.003 * tl);
    return v * p.amp * env(tl, dur, 1.0, 1.2) * (0.8 + 0.2 * Math.sin(TAU * p.lfo * tl));
  }, 0);
}

// 2) Wind: quiet most of the time, loud in the storm (27-35 s).
const WIND = [
  { a: 0, b: 14, amp: 0.02 }, { a: 14, b: 27, amp: 0.03 }, { a: 27, b: 35, amp: 0.22 },
  { a: 35, b: 41, amp: 0.05 }, { a: 41, b: 51, amp: 0.03 }, { a: 51, b: 60, amp: 0.02 },
];
for (const w of WIND) {
  let y = 0;
  add(w.a, w.b - w.a, (tl, dur) => {
    y += 0.02 * (rnd() - y);
    return y * w.amp * env(tl, dur, 1.0, 1.0) * 6;
  }, rnd() * 0.2);
}

// 3) Heartbeat pulse 14-27 s (60 bpm, soft).
add(14, 13, (tl) => {
  const ph = tl % 1;
  return Math.sin(TAU * 52 * tl) * Math.exp(-ph * 14) * 0.18;
});

// 4) Battle flash impact at 27.0 s, plus a second thud.
add(27.0, 2.4, (tl) => {
  const f = 28 + 62 * Math.exp(-3 * tl);
  const ph = TAU * (28 * tl + (62 * (1 - Math.exp(-3 * tl))) / 3);
  return Math.sin(ph) * Math.exp(-tl * 2.2) * 0.9;
});
add(27.0, 1.5, (tl) => rnd() * Math.exp(-tl * 3.2) * 0.3, -0.3);
add(28.6, 1.2, (tl) => Math.sin(TAU * 40 * tl) * Math.exp(-tl * 6) * 0.5);

// 5) FM bells: cold chime at start, luminous chimes at rebirth, warm chimes at the end.
function bell(freq, start, amp, pan) {
  add(start, 4.5, (tl) => {
    const mod = Math.sin(TAU * freq * 2.01 * tl) * 1.6 * Math.exp(-tl * 4);
    return Math.sin(TAU * freq * tl + mod) * Math.exp(-tl * 2.6) * amp;
  }, pan);
}
bell(293.66, 0.6, 0.12, -0.3);
[
  [587.33, 41.2, 0.12, 0.3], [784.0, 42.6, 0.12, -0.3], [880.0, 44.0, 0.12, 0.2],
  [1174.66, 45.6, 0.1, -0.2], [987.77, 47.5, 0.1, 0.25], [784.0, 49.5, 0.1, -0.1],
  [392.0, 51.2, 0.14, 0], [523.25, 52.6, 0.12, 0.25], [659.25, 54.0, 0.12, -0.25],
  [784.0, 55.5, 0.11, 0.1], [1046.5, 57.0, 0.1, -0.1], [784.0, 58.6, 0.1, 0.2],
].forEach(([f, t, a, p]) => bell(f, t, a, p));

// 6) Duck the bed under each VO clip.
const mask = new Float32Array(N);
for (const s of S.scenes) {
  const start = s.start + s.voStart;
  const end = start + VDUR[s.id];
  for (let i = Math.floor(start * SR); i < Math.min(N, Math.floor(end * SR)); i++) mask[i] = 1;
}
// Current ducking gain applied to the music bed (1 = full level, lower under the VO).
let g = 1;
// Smoothing coefficients for the ducking envelope: quick attack, slow release.
const kAttack = 1 - Math.exp(-1 / (0.08 * SR));
const kRelease = 1 - Math.exp(-1 / (0.4 * SR));
for (let i = 0; i < N; i++) {
  const target = mask[i] ? 0.45 : 1.0;
  g += (target - g) * (target < g ? kAttack : kRelease);
  L[i] *= g;
  R[i] *= g;
}

// 7) Normalise the peak and write a 16-bit stereo WAV.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
// Scale that brings the loudest sample to 0.7 of full scale, leaving headroom.
const scale = 0.7 / peak;
// Interleaved 16-bit stereo PCM samples.
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * scale)) * 32767), i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * scale)) * 32767), i * 4 + 2);
}
// 44-byte RIFF/WAVE header for 16-bit stereo PCM.
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'music.wav'), Buffer.concat([header, data]));
console.log('wrote out/music.wav');
