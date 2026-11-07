// Prepares the timeline from the narration clips.
//
// 1. Trims leading/trailing silence from each VO clip (audio/vo-NN.mp3) and time-stretches it by TEMPO.
// 2. Measures each stretched clip and lays the eight scenes out so the narration fills the 60 s film.
//    Each scene lasts its narration plus an equal share of the leftover gap, so the total is exactly 60 s.
// 3. Builds caption blocks with word timings. Times are spread across each clip's speech in proportion to
//    word length, with extra weight after punctuation. This is an estimate, not a forced alignment.
// 4. Writes out/timing.json (used by the renderer, the music builder and the mixer) and out/captions.srt.
//
// Usage: FFMPEG=/path/to/ffmpeg node render/prepare.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, TOTAL, TEMPO, FPS } from './script.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const FF = process.env.FFMPEG || 'ffmpeg';
fs.mkdirSync(OUT, { recursive: true });

// Runs ffmpeg and returns its stderr (ffmpeg writes progress and metadata there).
function ff(args) {
  try {
    return execFileSync(FF, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stderr || '') + (e.stdout || '');
  }
}

// Duration in seconds, read from the "Duration: HH:MM:SS.ss" line that ffmpeg prints for an input.
function duration(file) {
  const log = ff(['-i', file]);
  const m = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`cannot read duration of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Step 1: trim silence and time-stretch each clip. Output is 48 kHz stereo WAV.
const clips = SCENES.map((s) => {
  const src = path.join(ROOT, s.vo);
  const trimmed = path.join(OUT, `vo-trim-${String(s.id).padStart(2, '0')}.wav`);
  const fast = path.join(OUT, `vo-fast-${String(s.id).padStart(2, '0')}.wav`);
  // Trim leading and trailing silence (below -40 dB, at least 50 ms kept at each end).
  const trim = 'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.05,areverse,' +
    'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.05,areverse';
  ff(['-y', '-i', src, '-af', trim, '-ar', '48000', '-ac', '2', trimmed]);
  // atempo changes speed and keeps pitch. Values above about 1.3 start to sound unnatural.
  ff(['-y', '-i', trimmed, '-af', `atempo=${TEMPO}`, '-ar', '48000', '-ac', '2', fast]);
  return { scene: s, fast, dur: duration(fast) };
});

// Step 2: lay out the scenes. The leftover gap is spread equally between the eight scenes.
const speech = clips.reduce((a, c) => a + c.dur, 0);
const gap = (TOTAL - speech) / SCENES.length;
if (gap < 0.2) throw new Error(`narration too long for ${TOTAL}s (speech ${speech.toFixed(2)}s)`);

let t = 0;
const scenes = clips.map((c, i) => {
  const isLast = i === clips.length - 1;
  const duration = isLast ? TOTAL - t : c.dur + gap;
  const scene = {
    id: c.scene.id,
    name: c.scene.name,
    start: +t.toFixed(4),
    duration: +duration.toFixed(4),
    voStart: +(t + gap / 2).toFixed(4),
    voDur: +c.dur.toFixed(4),
    vo: c.fast,
    text: c.scene.text,
    onScreen: c.scene.onScreen,
    highlight: c.scene.highlight,
  };
  t += duration;
  return scene;
});

// Step 3: word timings and caption blocks.
const MAX_LINE = 24; // characters per caption line (keeps lines inside the 80% safe width)
const MAX_LINES = 2; // at most two lines on screen at once
const MAX_BLOCK_SEC = 3.0; // longest time one caption block stays on screen

const norm = (w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, '');

const words = [];
for (const sc of scenes) {
  const toks = sc.text.split(/\s+/).filter(Boolean);
  // Weight = characters, plus extra for punctuation pauses.
  const weights = toks.map((w) => w.length + (/[.,:;!?]$/.test(w) ? 4 : 0) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  toks.forEach((w, k) => {
    const s0 = sc.voStart + (acc / total) * sc.voDur;
    acc += weights[k];
    const s1 = sc.voStart + (acc / total) * sc.voDur;
    const hl = (sc.highlight || []).some((h) => norm(h) === norm(w));
    words.push({ text: w, start: s0, end: s1, scene: sc.id, highlight: hl });
  });
}

// Groups consecutive words into caption blocks (up to two lines, one block at a time).
const blocks = [];
let cur = null;
for (const w of words) {
  if (cur) {
    const lines = cur.lines;
    const last = lines[lines.length - 1];
    const fitsLast = last.join(' ').length + 1 + w.text.length <= MAX_LINE;
    const canNewLine = lines.length < MAX_LINES;
    const sameScene = cur.scene === w.scene;
    const shortEnough = w.end - cur.start <= MAX_BLOCK_SEC;
    if (sameScene && shortEnough && (fitsLast || canNewLine)) {
      if (fitsLast) last.push(w); else lines.push([w]);
      cur.end = w.end;
      continue;
    }
    blocks.push(cur);
  }
  cur = { start: w.start, end: w.end, scene: w.scene, lines: [[w]] };
}
if (cur) blocks.push(cur);

const captions = blocks.map((b) => ({
  start: +b.start.toFixed(3),
  end: +(b.end + 0.2).toFixed(3),
  scene: b.scene,
  lines: b.lines.map((ln) => ln.map((w) => ({ text: w.text, highlight: w.highlight }))),
}));
// Keep consecutive blocks from overlapping.
for (let i = 0; i + 1 < captions.length; i++) {
  if (captions[i].end > captions[i + 1].start) captions[i].end = captions[i + 1].start - 0.02;
}
// Nothing may run past the end of the film.
for (const c of captions) c.end = Math.min(c.end, TOTAL - 0.05);

// Step 4: write the timing file and the SRT.
const timing = { total: TOTAL, fps: FPS, tempo: TEMPO, speechSeconds: +speech.toFixed(3), gap: +gap.toFixed(4), scenes, captions };
fs.writeFileSync(path.join(OUT, 'timing.json'), JSON.stringify(timing, null, 2));

function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}
const srt = captions.map((c, i) =>
  `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.lines.map((ln) => ln.map((w) => w.text).join(' ')).join('\n')}\n`
).join('\n');
fs.writeFileSync(path.join(OUT, 'captions.srt'), srt);

console.log(`speech ${speech.toFixed(2)}s, gap ${gap.toFixed(3)}s per scene, total ${TOTAL}s`);
for (const s of scenes) console.log(`scene ${s.id} ${s.name.padEnd(18)} start ${s.start.toFixed(2)} dur ${s.duration.toFixed(2)} vo ${s.voStart.toFixed(2)}+${s.voDur.toFixed(2)}`);
console.log(`caption blocks: ${captions.length}`);
