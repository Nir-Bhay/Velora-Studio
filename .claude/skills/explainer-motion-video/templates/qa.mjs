// mcp-video/qa.mjs
//
// Checks that the film is what the storyboard says it is, then writes a contact sheet.
//   node qa.mjs            → prints each check; exits 1 on any failure
//
// Checks: format, duration, loudness (−14 LUFS, −1 dBTP), beat-aligned scene cuts,
// every sound event inside the film and in time order, frame determinism (same t → same
// bytes), motion (frames differ across the film), and the contact sheet.

import { spawnSync } from 'node:child_process';
import { createCanvas } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, H, FPS, DUR, BEAT, SCENES, EVENTS } from './brand.mjs';
import { draw } from './film.mjs';
import { CAPTIONS } from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FFMPEG = existsSync(join(here, 'tools/ffmpeg')) ? join(here, 'tools/ffmpeg') : 'ffmpeg';
const MP4 = join(here, 'out', process.argv[2] ?? 'mcp-explainer.mp4');

let failed = 0;
const check = (ok, name, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`);
};

// ── 1 · the timeline itself ──────────────────────────────────────────────────
const beatsOk = SCENES.every((s) => Math.abs(s.t0 / BEAT - Math.round(s.t0 / BEAT)) < 1e-9 && Math.abs(s.t1 / BEAT - Math.round(s.t1 / BEAT)) < 1e-9);
check(beatsOk, 'every scene cut lands on the 120 BPM beat grid', `${SCENES.length} scenes, grid ${BEAT}s`);
check(SCENES.every((s, i) => i === 0 || s.t0 === SCENES[i - 1].t1), 'scenes are contiguous (no gaps, no overlaps)');
check(SCENES.at(-1).t1 === DUR, 'the last scene ends at the film duration', `${DUR}s`);
check(DUR >= 30 && DUR <= 42, 'duration is inside the brief (30–42 s)', `${DUR}s`);
const sorted = EVENTS.every((e, i) => i === 0 || e.t >= EVENTS[i - 1].t);
check(sorted, 'sound events are in time order');
check(EVENTS.every((e) => e.t >= 0 && e.t < DUR), 'every sound event is inside the film', `${EVENTS.length} events`);
check(CAPTIONS.every(([a, b]) => a < b && b <= DUR), 'every caption has a valid span');
check(CAPTIONS.every(([a, b], i) => i === 0 || a >= CAPTIONS[i - 1][0]), 'captions are in time order');

// ── 2 · determinism: any frame, any time, the same bytes ─────────────────────
const c = createCanvas(W, H);
const x = c.getContext('2d');
const hash = (t) => { draw(x, t); return createHash('sha1').update(c.data()).digest('hex').slice(0, 12); };
const h1 = hash(12.345), h2 = hash(12.345), h3 = hash(12.346);
check(h1 === h2, 'same instant renders byte-identical', h1);
check(h1 !== h3, 'the next frame differs (the film moves)');

// motion across the film: every scene changes within its own span
const probes = [];
for (const s of SCENES) probes.push(hash(s.t0 + (s.t1 - s.t0) * 0.5));
check(new Set(probes).size === probes.length, 'each scene has distinct content at its midpoint', `${probes.length} scenes`);

// ── 3 · the file on disk ─────────────────────────────────────────────────────
if (!existsSync(MP4)) {
  check(false, 'the MP4 exists', MP4);
} else {
  const info = spawnSync(FFMPEG, ['-hide_banner', '-i', MP4], { encoding: 'utf8' }).stderr;
  const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
  const seconds = dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : NaN;
  check(Math.abs(seconds - DUR) < 0.05, 'file duration matches', `${seconds.toFixed(3)} s`);
  check(/1080x1920/.test(info), 'resolution is 1080×1920 (9:16)');
  check(/\b60 fps\b|\b60 tbr\b/.test(info), 'frame rate is 60 fps');
  check(/aac.*48000 Hz/.test(info) || /48000 Hz/.test(info), 'audio is 48 kHz');

  const ln = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', MP4, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(ln.split('Summary')[1] ?? '');
  const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(ln.split('Summary')[1] ?? '');
  const lufs = I ? Number(I[1]) : NaN;
  const tp = TP ? Number(TP[1]) : NaN;
  check(Math.abs(lufs - -14) <= 1, 'integrated loudness ≈ −14 LUFS', `${lufs} LUFS`);
  check(tp <= -0.9, 'true peak ≤ −1 dBTP (±0.1)', `${tp} dBFS`);

  // contact sheet: one frame per second, 10 across, 4 down
  const sheet = join(here, 'out', 'contact-sheet.png');
  spawnSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', MP4,
    '-vf', 'fps=1,scale=216:-1,tile=10x4', '-frames:v', '1', sheet]);
  check(existsSync(sheet), 'contact sheet written', 'out/contact-sheet.png');
}

console.log(failed === 0 ? '\n✅ all checks passed' : `\n❌ ${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
