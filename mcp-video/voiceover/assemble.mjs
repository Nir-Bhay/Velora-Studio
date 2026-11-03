// mcp-video/voiceover/assemble.mjs — place the Hinglish lines on the picture.
//   node voiceover/assemble.mjs [--pitch -1] [--clips out/clips] [--out name.mp4]
// 1. checks each clip fits its scene window (script.hinglish.json)
// 2. optional pitch-down (semitones, time-preserving) to make the voice heavier
// 3. places each line at t0 (adelay), ducks the existing sound design under the voice
// 4. two-pass loudness to -14 LUFS, limiter at -2 dBFS (level=disabled)
// 5. muxes onto the picture from the current delivered MP4 (video is copied, not re-rendered)
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MCP = resolve(HERE, '..');
const FFMPEG = process.env.FFMPEG || join(MCP, 'tools', 'ffmpeg');
const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const PITCH = Number(arg('--pitch', '0'));            // semitones; negative = deeper
const CLIPS = resolve(HERE, arg('--clips', 'out/clips'));
const OUT_NAME = arg('--out', 'mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4');
const SR = 48000;

const script = JSON.parse(readFileSync(join(HERE, 'script.hinglish.json'), 'utf8'));
const work = join(HERE, 'out', 'mix');
mkdirSync(work, { recursive: true });

function ff(args, opts = {}) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`ffmpeg failed:\n${r.stderr.slice(-1500)}`);
  return r;
}

function duration(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr);
  if (!m) throw new Error(`no duration for ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// 1 · fit check. A clip may be sped up by at most 7 % (pitch kept) to fit its window; more than that is rejected.
const MAX_SPEEDUP = 1.07;
const placed = [];
for (const line of script.lines) {
  const clip = join(CLIPS, `${line.id}.wav`);
  if (!existsSync(clip)) throw new Error(`missing clip ${clip}`);
  const d = duration(clip);
  const window = line.t1 - line.t0;
  const speed = Math.max(1, d / window);
  console.log(`${line.id.padEnd(11)} clip ${d.toFixed(2)}s  window ${window.toFixed(2)}s  speed-up ${speed.toFixed(3)}`);
  if (speed > MAX_SPEEDUP) throw new Error(`${line.id} needs ${speed.toFixed(2)}x to fit — shorten the text`);
  placed.push({ ...line, clip, speed });
}

// 2 · narration track: pitch-down (time-preserving) + small fit speed-up + delay each line to its scene start
const pitchFactor = 1 / 2 ** (PITCH / 12);
const inputs = placed.flatMap((p) => ['-i', p.clip]);
const chains = placed.map((p, i) => {
  const ms = Math.round(p.t0 * 1000);
  const pitch = PITCH !== 0
    ? `asetrate=${SR}*${(2 ** (PITCH / 12)).toFixed(6)},aresample=${SR},`
    : '';
  const tempo = pitchFactor * p.speed; // atempo keeps length; this combines pitch compensation and fit speed-up
  const tempoChain = Math.abs(tempo - 1) > 1e-6 ? `atempo=${tempo.toFixed(6)},` : '';
  return `[${i}:a]${pitch}${tempoChain}aformat=sample_rates=${SR}:channel_layouts=stereo,volume=1.6,adelay=${ms}|${ms}[n${i}]`;
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
const probe = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', mixWav, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const json = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{'), probe.stderr.lastIndexOf('}') + 1));
const lnFilter = `loudnorm=${LN}:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
const finalWav = join(work, 'final.wav');
ff(['-i', mixWav, '-af', `${lnFilter},alimiter=limit=0.7943:attack=5:release=60:level=disabled`, '-ar', String(SR), '-ac', '2', finalWav]);

// 5 · mux onto the picture (video copied)
const picture = join(MCP, 'deliver', 'mcp-explainer-40s-9x16-1080p60.mp4');
const outFile = join(MCP, 'deliver', OUT_NAME);
ff(['-i', picture, '-i', finalWav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', String(SR), '-movflags', '+faststart', '-t', '40', outFile]);

console.log(`pitch ${PITCH} st · loudness measured ${json.input_i} LUFS, true peak ${json.input_tp} dBTP before the final pass`);
console.log(`wrote ${outFile}`);
