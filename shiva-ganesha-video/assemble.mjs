// shiva-ganesha-video/assemble.mjs
//
//   node assemble.mjs --picture out/picture-only-9x16.mp4 --out deliver/shiva-ganesha-9x16-1080p60.mp4
//
// 1. Checks every narration clip fits its scene (clip + lead must end before the scene ends).
// 2. Normalises each clip to −18 LUFS (speech level), places it at scene start + VOICE_LEAD.
// 3. Mixes the placed narration over the synthesized bed (music-master.wav), 48 kHz stereo.
// 4. Two-pass loudness to −14 LUFS / −1 dBTP, then a limiter.
// 5. Muxes with the picture (video stream copied, no re-encode).

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, VOICE_LEAD, DUR } from './brand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const FFMPEG = process.env.FFMPEG ?? (existsSync(join(here, 'tools/ffmpeg')) ? join(here, 'tools/ffmpeg') : 'ffmpeg');
const picture = join(here, arg('picture', 'out/picture-only-9x16.mp4'));
const out = join(here, arg('out', 'deliver/shiva-ganesha-9x16-1080p60.mp4'));
const music = join(here, 'out/music-master.wav');
const mixWav = join(here, 'out/mix.wav');
const voiceDir = join(here, 'out/voice');

const run = (args, opts = {}) => spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-loglevel', 'error', ...args], { encoding: 'utf8', ...opts });
const die = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };

// 1. fit check
for (const sc of SCENES) {
  const window = sc.t1 - sc.t0;
  const need = VOICE_LEAD + sc.vDur + 0.25;
  if (need > window) die(`${sc.id}: clip ${sc.vDur}s + lead does not fit ${window}s window`);
  if (!existsSync(join(voiceDir, sc.voice))) die(`missing ${sc.voice}`);
  console.log(`fits  ${sc.id.padEnd(9)} clip ${sc.vDur.toFixed(2)} s  window ${window.toFixed(2)} s`);
}

// 2. normalise clips to −18 LUFS
const norm = [];
for (const sc of SCENES) {
  const src = join(voiceDir, sc.voice);
  const dst = join(voiceDir, `norm-${sc.id}.wav`);
  const r = run(['-y', '-i', src, '-af', 'aresample=48000,loudnorm=I=-18:TP=-2:LRA=7,pan=stereo|c0=c0|c1=c0', '-c:a', 'pcm_s16le', dst]);
  if (r.status !== 0) die(`normalise ${sc.id}: ${r.stderr}`);
  norm.push({ sc, dst });
}

// 3. mix: bed at 0.8, narration placed at scene start + lead
const inputs = ['-i', music, ...norm.flatMap((n) => ['-i', n.dst])];
const parts = [`[0:a]volume=0.8[bed]`];
norm.forEach((n, k) => {
  const ms = Math.round((n.sc.t0 + VOICE_LEAD) * 1000);
  parts.push(`[${k + 1}:a]adelay=${ms}|${ms},volume=1.0[v${k}]`);
});
const labels = ['[bed]', ...norm.map((_, k) => `[v${k}]`)].join('');
parts.push(`${labels}amix=inputs=${norm.length + 1}:duration=first:normalize=0,atrim=0:${DUR},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[mix]`);
const r3 = run(['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[mix]', '-c:a', 'pcm_s24le', mixWav]);
if (r3.status !== 0) die(`mix: ${r3.stderr}`);
console.log('mixed → out/mix.wav');

// 4. two-pass loudness
const LN = 'I=-14:TP=-1:LRA=11';
const probe = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', mixWav, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const json = JSON.parse(/\{[\s\S]*\}/.exec(probe.stderr)[0]);
const lnFilter = `loudnorm=${LN}:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
console.log(`loudness measured ${json.input_i} LUFS · TP ${json.input_tp} dBTP → target −14 / −1`);

// 5. mux: picture copied, audio encoded AAC 48 kHz stereo, limiter after loudness
const mux = spawnSync(FFMPEG, ['-y', '-i', picture, '-i', mixWav, '-map', '0:v', '-map', '1:a',
  '-c:v', 'copy', '-af', `${lnFilter},alimiter=limit=0.7943:attack=5:release=60:level=disabled`,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-t', String(DUR), '-movflags', '+faststart', out],
  { encoding: 'utf8' });
if (mux.status !== 0) die(`mux: ${mux.stderr}`);
console.log(`wrote ${out}`);
