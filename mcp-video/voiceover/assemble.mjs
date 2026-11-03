// mcp-video/voiceover/assemble.mjs — place the Hinglish narration on the picture.
//   node voiceover/assemble.mjs [--pitch 0] [--clips out/clips-v3] [--script script.hinglish-v3.json] [--out name.mp4]
//
// Steps
// 1. Check each clip fits its scene window at its natural pace. No speed-up: a line that is too
//    long is an error, so it gets rewritten, not stretched.
// 2. Resample each clip to 48 kHz FIRST, then (optionally) pitch-shift, keeping its length.
//    (The v1 bug: asetrate was applied to a 24 kHz clip as if it were 48 kHz, which made the voice
//    fast and nasal. Always resample before asetrate.)
// 3. Place each line at its scene start (adelay).
// 4. Duck the existing sound design under the voice (sidechain).
// 5. Two-pass loudness to -14 LUFS, limiter at -2 dBFS (level=disabled).
// 6. Mux onto the picture from the delivered MP4 with -c:v copy (no re-render).
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP = resolve(HERE, '..');
const FFMPEG = process.env.FFMPEG || join(MCP, 'tools', 'ffmpeg');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const PITCH = Number(arg('--pitch', '0'));            // semitones; 0 = the voice as generated
const CLIPS = resolve(HERE, arg('--clips', 'out/v2'));
const SCRIPT = join(HERE, arg('--script', 'script.v2.json'));
const OUT_NAME = arg('--out', 'mcp-explainer-v2-loop-9x16-1080p60.mp4');
const PICTURE = join(MCP, 'out', 'picture-v2.mp4'); // video-only, from render.mjs (no audio)
const SR = 48000;

const script = JSON.parse(readFileSync(SCRIPT, 'utf8'));
const work = join(HERE, 'out', 'mix');
mkdirSync(work, { recursive: true });

function ff(args, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`ffmpeg failed:\n${r.stderr.slice(-1500)}`);
  return r;
}

function probe(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr);
  const sr = /(\d+) Hz/.exec(r.stderr);
  if (!m) throw new Error(`no duration for ${file}`);
  return { seconds: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]), rate: sr ? Number(sr[1]) : null };
}

// 1 · fit check at natural pace
const placed = [];
for (const line of script.lines) {
  const clip = join(CLIPS, line.clip ?? `${line.id}.wav`);
  if (!existsSync(clip)) throw new Error(`missing clip ${clip}`);
  const { seconds: d, rate } = probe(clip);
  const window = line.t1 - line.t0;
  const fits = d <= window;
  console.log(`${line.id.padEnd(11)} clip ${d.toFixed(2)}s  window ${window.toFixed(2)}s  ${rate} Hz  ${fits ? 'fits' : 'TOO LONG — shorten the text'}`);
  if (!fits) throw new Error(`${line.id} is ${d.toFixed(2)}s, window is ${window.toFixed(2)}s`);
  placed.push({ ...line, clip });
}

// 2 · narration track
const inputs = placed.flatMap((p) => ['-i', p.clip]);
const chains = placed.map((p, i) => {
  const ms = Math.round(p.t0 * 1000);
  // resample to 48 kHz first, so asetrate works on the true rate
  const base = `aresample=${SR},aformat=sample_rates=${SR}:channel_layouts=stereo`;
  // Pitch shift without changing length. For f = 2^(PITCH/12):
  //   asetrate=48000*f  → pitch ×f, but the clip becomes 1/f times longer
  //   atempo=1/f        → restores the original length
  const f = 2 ** (PITCH / 12);
  const pitch = PITCH !== 0
    ? `,asetrate=${SR}*${f.toFixed(6)},aresample=${SR},atempo=${(1 / f).toFixed(6)}`
    : '';
  return `[${i}:a]${base}${pitch},volume=1.6,adelay=${ms}|${ms}[n${i}]`;
});
const mixIns = placed.map((_, i) => `[n${i}]`).join('');
const narrFilter = `${chains.join(';')};${mixIns}amix=inputs=${placed.length}:normalize=0:duration=longest,apad=whole_dur=40[nar]`;
const narrationWav = join(work, 'narration.wav');
ff([...inputs, '-filter_complex', narrFilter, '-map', '[nar]', '-t', '40', '-ar', String(SR), '-ac', '2', narrationWav]);

// 3 · duck the existing sound design under the voice, then add the voice
const bed = join(MCP, 'out', 'audio-master.wav');
const mixWav = join(work, 'mix.wav');
const duckFilter = [
  '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[bed]',
  '[1:a]asplit=2[nsc][nmix]',
  '[bed][nsc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350:makeup=1[ducked]',
  '[ducked][nmix]amix=inputs=2:normalize=0:duration=longest,volume=1.0[mix]',
].join(';');
ff(['-i', bed, '-i', narrationWav, '-filter_complex', duckFilter, '-map', '[mix]', '-t', '40', '-ar', String(SR), '-ac', '2', mixWav]);

// 4 · two-pass loudness
const LN = 'I=-14:TP=-1.5:LRA=11';
const measure = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', mixWav, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const json = JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf('{'), measure.stderr.lastIndexOf('}') + 1));
const lnFilter = `loudnorm=${LN}:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
const finalWav = join(work, `final-pitch${PITCH}.wav`);
ff(['-i', mixWav, '-af', `${lnFilter},alimiter=limit=0.7943:attack=5:release=60:level=disabled`, '-ar', String(SR), '-ac', '2', finalWav]);

// 5 · mux onto the picture (video copied, not re-rendered)
const picture = PICTURE;
const outFile = join(MCP, 'deliver', OUT_NAME);
ff(['-i', picture, '-i', finalWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-movflags', '+faststart', '-t', '40', outFile]);

console.log(`pitch ${PITCH} st · measured before final pass ${json.input_i} LUFS, true peak ${json.input_tp} dBTP`);
console.log(`wrote ${outFile}`);
