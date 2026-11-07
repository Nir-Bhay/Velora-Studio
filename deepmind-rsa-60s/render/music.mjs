// Builds the music bed and sound effects for the whole film as one WAV file (out/music.wav).
//
// Everything here is synthesised in code (sine pads, kick pulse, filtered noise). No samples or recordings
// are used, so the audio is original. The narration is ducked against this bed by mix.sh (sidechaincompress).
//
// Layers:
//   - pad: a slow minor-key chord per scene, cross-faded at scene boundaries
//   - pulse: a soft kick on 84 BPM from scene 2, plus hats that get denser in the computing scene (6)
//   - SFX: lock click, crack glitch, whoosh at scene starts, the 1,600x impact after a short drop, the
//     computing riser, and closing chime. Event times come from out/timing.json.
//
// Usage: node render/music.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const SR = 48000;
const T = JSON.parse(fs.readFileSync(path.join(OUT, 'timing.json'), 'utf8'));
const TOTAL = T.total;
const N = Math.round(TOTAL * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// Deterministic noise so the file is identical on every build.
let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

// Adds a sample at time t (seconds) to both channels; `pan` is -1..1.
function put(t, v, pan = 0) {
  const i = Math.round(t * SR);
  if (i < 0 || i >= N) return;
  const g = (1 - pan) * 0.5 + 0.5, h = (1 + pan) * 0.5 + 0.5;
  L[i] += v * Math.min(1, g) * 0.8;
  R[i] += v * Math.min(1, h) * 0.8;
}

// Sine tone with a linear attack and exponential release.
function tone(t0, dur, freq, amp, { attack = 0.02, decay = 3, pan = 0, freq2 = null } = {}) {
  const n = Math.round(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = freq2 ? freq + (freq2 - freq) * (t / dur) : freq;
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t / dur);
    put(t0 + t, Math.sin(ph) * amp * env, pan);
  }
}

// Kick: a sine sweep from 110 Hz down to 38 Hz with a fast exponential decay.
function kick(t0, amp) {
  const dur = 0.42, n = Math.round(dur * SR);
  let ph = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const f = 38 + 72 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    put(t0 + t, Math.sin(ph) * amp * Math.exp(-t * 9));
  }
}

// Noise burst through a one-pole high-pass (for hats, clicks and glitches).
function burst(t0, dur, amp, { hp = 0.6, decay = 6, pan = 0 } = {}) {
  const n = Math.round(dur * SR);
  let y = 0, x1 = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const x = rnd();
    const hpv = hp * (y + x - x1);
    x1 = x; y = hpv;
    put(t0 + t, hpv * amp * Math.exp(-decay * t / dur), pan);
  }
}

// Riser or whoosh: noise through a one-pole low-pass whose cutoff rises over the duration.
function riser(t0, dur, amp, fromHz, toHz) {
  const n = Math.round(dur * SR);
  let y = 0;
  for (let k = 0; k < n; k++) {
    const t = k / SR, p = t / dur;
    const fc = fromHz * Math.pow(toHz / fromHz, p * p);
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    y += a * (rnd() - y);
    const env = Math.pow(p, 1.6) * Math.min(1, (dur - t) / 0.08);
    put(t0 + t, y * amp * env, (p - 0.5) * 0.6);
  }
}

// Chords per scene (Hz). Minor-key colours, kept low so the narration stays clear.
const CHORDS = [
  [73.42, 110.0, 146.83],   // 1 hook: D2 A2 D3
  [65.41, 98.0, 130.81],    // 2 announcement: C2 G2 C3
  [73.42, 110.0, 146.83],   // 3 signature
  [58.27, 87.31, 116.54],   // 4 1,600x: Bb1 F2 Bb2 (darker, tense)
  [73.42, 110.0, 146.83],   // 5 fan factories
  [61.74, 92.5, 123.47],    // 6 computing: B1 F#2 B2
  [65.41, 98.0, 130.81],    // 7 reality check
  [73.42, 110.0, 146.83],   // 8 closing
];

// Pads: each scene's chord fades in and out across its boundaries.
T.scenes.forEach((s, i) => {
  const a = Math.max(0, s.start - 0.6), b = Math.min(TOTAL, s.start + s.duration + 0.6);
  const chord = CHORDS[i] || CHORDS[0];
  chord.forEach((f, j) => {
    const amp = 0.055 - j * 0.012;
    const n = Math.round((b - a) * SR);
    for (let k = 0; k < n; k++) {
      const t = a + k / SR;
      const edge = Math.min(1, (t - a) / 0.6, (b - t) / 0.6);
      const lfo = 0.85 + 0.15 * Math.sin(2 * Math.PI * (0.07 + 0.01 * j) * t);
      const v = Math.sin(2 * Math.PI * f * t) * Math.sin(2 * Math.PI * (f * 1.004) * t) * 0.5;
      put(t, v * amp * edge * lfo, j === 1 ? -0.25 : j === 2 ? 0.25 : 0);
    }
  });
});

// Pulse: soft kick on 84 BPM from scene 2 onward. Off in the first scene so the hook stays quiet.
const BEAT = 60 / 84;
const pulseStart = T.scenes[1].start;
for (let t = pulseStart; t < TOTAL - 0.5; t += BEAT) {
  const s = T.scenes.find((x) => t >= x.start && t < x.start + x.duration);
  const amp = s && s.id === 7 ? 0.10 : s && s.id === 8 ? 0.06 : 0.20;
  if (s && s.id === 4 && t > s.start + 1.6 && t < s.start + 2.4) continue; // the drop before 1,600x
  kick(t, amp);
}

// Hats: 8th notes in scenes 5 and 6, 16th notes in the computing scene (6).
T.scenes.forEach((s) => {
  if (s.id !== 5 && s.id !== 6) return;
  const step = s.id === 6 ? BEAT / 4 : BEAT / 2;
  for (let t = s.start + 0.2; t < s.start + s.duration - 0.2; t += step) {
    burst(t, 0.035, s.id === 6 ? 0.07 : 0.045, { hp: 0.9, decay: 8, pan: (rnd() * 0.4) });
  }
});

// SFX.
const sc = (id) => T.scenes.find((s) => s.id === id);

// Scene 1: lock click when the scan starts, a low opening boom, and a glitch when the crack appears.
tone(0, 2.2, 42, 0.35, { attack: 0.01, decay: 4 });
burst(0.8, 0.12, 0.25, { hp: 0.5, decay: 10 });
burst(3.0, 0.22, 0.3, { hp: 0.7, decay: 6, pan: -0.3 });
burst(3.05, 0.10, 0.18, { hp: 0.8, decay: 12, pan: 0.4 });

// Scene 2: whoosh on entry, then a double click when the two panels split apart.
riser(sc(2).start, 0.9, 0.22, 300, 6000);
burst(sc(2).start + 3.0, 0.05, 0.25, { hp: 0.8, decay: 14, pan: -0.5 });
burst(sc(2).start + 3.12, 0.05, 0.25, { hp: 0.8, decay: 14, pan: 0.5 });

// Scene 3: soft ticks as the flow chips appear.
[0.4, 0.9, 1.4, 1.9].forEach((dt) => burst(sc(3).start + 2.9 + dt, 0.03, 0.12, { hp: 0.9, decay: 14 }));

// Scene 4: the drop, then the 1,600x impact. Music is silent for 0.3 s before the impact.
const s4 = sc(4);
riser(s4.start, 1.5, 0.12, 200, 2400);
tone(s4.start + 2.2, 1.6, 60, 0.55, { attack: 0.005, decay: 4, freq2: 32 });
burst(s4.start + 2.2, 0.25, 0.35, { hp: 0.6, decay: 6 });
tone(s4.start + 2.2, 1.1, 880, 0.04, { attack: 0.01, decay: 3 });

// Scene 5: a sparse rising pulse as the shared precomputation fans out.
for (let k = 0; k < 6; k++) burst(sc(5).start + 3.0 + k * 0.45, 0.04, 0.10 + k * 0.012, { hp: 0.9, decay: 12, pan: (k % 2 ? 0.3 : -0.3) });

// Scene 6: riser through the whole computing shot, then a short hit when the bars land.
const s6 = sc(6);
riser(s6.start, s6.duration - 0.6, 0.16, 180, 4200);
tone(s6.start + 3.2, 0.9, 110, 0.28, { attack: 0.005, decay: 5, freq2: 70 });

// Scene 7: two soft chime notes (A4 and E5) for the calm contrast between the locks.
tone(sc(7).start + 0.4, 1.6, 440, 0.07, { attack: 0.01, decay: 3 });
tone(sc(7).start + 0.9, 1.6, 659.25, 0.05, { attack: 0.01, decay: 3, pan: 0.2 });

// Scene 8: closing chime, then the film fades out in the last second.
tone(sc(8).start + 0.6, 2.4, 587.33, 0.08, { attack: 0.01, decay: 3 });
tone(sc(8).start + 0.8, 2.4, 880, 0.04, { attack: 0.01, decay: 3, pan: -0.2 });

// Fade the whole bed in and out for a clean start and finish.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(1, t / 0.4) * Math.min(1, (TOTAL - t) / 1.0);
  L[i] *= g; R[i] *= g;
}

// Soft limit so the bed never clips before mixing.
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 0.9) * 0.9;
  R[i] = Math.tanh(R[i] * 0.9) * 0.9;
}

// Write a 16-bit stereo WAV.
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(OUT, 'music.wav'), Buffer.concat([hdr, data]));
console.log(`wrote out/music.wav (${TOTAL}s, ${SR} Hz stereo)`);
