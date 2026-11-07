// Frame renderer for the 60-second film.
//
// Modes:
//   node render/render.mjs --still <seconds>          write one PNG frame to out/stills/
//   node render/render.mjs --segment <index>          render one 4-second video segment (no audio) to out/seg/
//
// Each segment is rendered in its own process, so the build can run several in parallel. build.sh joins the
// segments and adds the mixed audio. Frames are raw RGBA piped into ffmpeg, which encodes H.264 yuv420p.
//
// Env: FFMPEG = path to the ffmpeg binary (defaults to 'ffmpeg' on PATH).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { SCENE_FNS, drawCaption, cl } from './scenes.mjs';
import { FPS, WIDTH, HEIGHT, TOTAL } from './script.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const FF = process.env.FFMPEG || 'ffmpeg';
const SEG_SEC = 4;            // seconds per segment
const XF = 0.35;              // cross-fade length between scenes, in seconds
const BG = '#0B1120';

const TL = JSON.parse(fs.readFileSync(path.join(OUT, 'timing.json'), 'utf8'));
const SCENES = TL.scenes;
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// Index of the scene that is on screen at time t.
function sceneIndexAt(t) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].start - 1e-9) return i;
  return 0;
}

// Draws the whole film at time t (seconds). This is the one place where layers are stacked.
export function drawFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Scenes. Near a scene boundary the next scene fades in over the last XF seconds of the current one.
  const i = sceneIndexAt(t);
  const sc = SCENES[i];
  const lt = t - sc.start;
  const tailStart = sc.duration - XF;
  if (i < SCENES.length - 1 && lt > tailStart) {
    SCENE_FNS[i](ctx, lt, 1);
    const nx = SCENES[i + 1];
    // Linear progress keeps the mix exact: final = p*next + (1-p)*current.
    const p = cl((lt - tailStart) / XF);
    // The next scene's local time is negative until it starts. Its functions clamp that to zero.
    SCENE_FNS[i + 1](ctx, t - nx.start, p);
  } else {
    SCENE_FNS[i](ctx, lt, 1);
  }

  // Burned-in captions.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  const cap = TL.captions.find((c) => t >= c.start && t < c.end);
  if (cap) drawCaption(ctx, cap, t);

  applyGrain(t);

  // Thin progress line across the top.
  ctx.fillStyle = 'rgba(54,197,240,0.85)';
  ctx.fillRect(0, 0, WIDTH * (t / TOTAL), 6);

  // Fade to the deep navy background over the last 0.6 s.
  const fade = cl((t - (TOTAL - 0.6)) / 0.6);
  if (fade > 0) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
  }
}

// Film grain: a small noise tile, laid over every frame at a random offset. It hides banding in the
// navy gradients and gives the image a more filmic texture. The offset comes from the frame time,
// so renders are repeatable.
const GRAIN = createCanvas(256, 256);
{
  const gctx = GRAIN.getContext('2d');
  const img = gctx.createImageData(256, 256);
  let seed = 90210;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const v = 118 + (seed >>> 24) % 24; // mid-grey noise, narrow range
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  gctx.putImageData(img, 0, 0);
}
function applyGrain(t) {
  ctx.save();
  const ox = Math.floor((t * 997) % 256), oy = Math.floor((t * 613) % 256);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.09;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat');
  ctx.fillRect(ox, oy, WIDTH, HEIGHT);
  ctx.restore();
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
