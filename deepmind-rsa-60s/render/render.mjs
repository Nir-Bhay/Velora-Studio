// Frame renderer for the 60-second film (Node, @napi-rs/canvas, piped to ffmpeg).
//
// Modes:
//   node render/render.mjs --still <seconds>          write one PNG frame to out/stills/
//   node render/render.mjs --segment <index>          render one 4-second video segment (no audio) to out/seg/
//
// The frame composition itself lives in film/frame.mjs, shared with the Remotion editor. This file only
// handles the canvas, the ffmpeg pipe, and the command line.
//
// Env: FFMPEG = path to the ffmpeg binary (defaults to 'ffmpeg' on PATH).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import './fonts.mjs'; // registers the font families before any drawing
import { drawFilmFrame, makeGrainTile } from '../film/frame.mjs';
import { FPS, WIDTH, HEIGHT, TOTAL } from './script.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const FF = process.env.FFMPEG || 'ffmpeg';
const SEG_SEC = 4; // seconds per segment

const TL = JSON.parse(fs.readFileSync(path.join(OUT, 'timing.json'), 'utf8'));
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');
const GRAIN = makeGrainTile(createCanvas);

// Draws the film at time t on the Node canvas.
function drawFrame(t) {
  drawFilmFrame(ctx, t, TL, { grain: GRAIN, W: WIDTH, H: HEIGHT, total: TOTAL });
}

// Writes one frame as a PNG. Used for QA stills and the thumbnail base.
async function still(t) {
  drawFrame(t);
  const dir = path.join(OUT, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `still-${t.toFixed(2)}.png`);
  fs.writeFileSync(file, await canvas.encode('png'));
  console.log(`wrote ${path.relative(ROOT, file)}`);
}

// Renders one segment. Frames are piped to ffmpeg as raw RGBA.
async function segment(index) {
  const f0 = index * SEG_SEC * FPS;
  const f1 = Math.min(TOTAL * FPS, f0 + SEG_SEC * FPS);
  if (f0 >= TOTAL * FPS) throw new Error(`segment ${index} is past the end`);
  const dir = path.join(OUT, 'seg');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `seg-${String(index).padStart(2, '0')}.mp4`);
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${WIDTH}x${HEIGHT}`, '-r', String(FPS), '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-g', String(FPS), '-movflags', '+faststart', file,
  ];
  const ff = spawn(FF, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => {
    ff.on('exit', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code} in segment ${index}`))));
    ff.on('error', rej);
  });
  for (let f = f0; f < f1; f++) {
    drawFrame(f / FPS);
    const px = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }
  }
  ff.stdin.end();
  await done;
  console.log(`seg ${index}: frames ${f0}-${f1 - 1} -> ${path.relative(ROOT, file)}`);
}

// ---- CLI ----
const args = process.argv.slice(2);
const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
if (flag('--still') !== null) {
  await still(Number(flag('--still')));
} else if (flag('--segment') !== null) {
  await segment(Number(flag('--segment')));
} else {
  console.error('usage: render.mjs --still <seconds> | --segment <index>');
  process.exit(2);
}
