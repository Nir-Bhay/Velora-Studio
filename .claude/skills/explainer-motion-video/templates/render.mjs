// mcp-video/render.mjs
//
// Canvas → raw RGBA → ffmpeg. 1080×1920, 60 fps, with real motion blur.
//
//   node render.mjs --stills 0.4,3.2,12,27        PNG frames at those seconds (look first)
//   node render.mjs --range 0 6                   render only 0–6 s, to test a change cheaply
//   node render.mjs --sub 1                       no motion blur (a fast draft)
//   node render.mjs                               the full film → out/mcp-explainer.mp4
//   node render.mjs --audio out/audio-master.wav  mux a soundtrack (loudness set to −14 LUFS)
//
// MOTION BLUR: each output frame is the average of `sub` subframes spread over half a frame
// (a 180° shutter). Subframe i lands at weight 1/(i+1) via successive source-over draws,
// which is an exact box average and needs no extra buffer.
//
// Determinism: draw(ctx, t) has no state, so any frame renders alone to the same bytes.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { W, H, FPS, DUR } from './brand.mjs';
import { draw } from './film.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name, dflt = null) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return dflt;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

const FFMPEG = process.env.FFMPEG
  ?? (existsSync(join(here, 'tools/ffmpeg')) ? join(here, 'tools/ffmpeg') : 'ffmpeg');
const OUT = join(here, 'out');

// Bundled OFL fonts, registered under the family names used in brand.mjs.
const FONTS = [
  ['Inter-Black.ttf', 'InterBlack'],
  ['Inter-ExtraBold.ttf', 'InterX'],
  ['Inter-SemiBold.ttf', 'InterSemi'],
  ['Inter-Medium.ttf', 'InterMed'],
  ['JetBrainsMono-Regular.ttf', 'JBMono'],
  ['JetBrainsMono-Bold.ttf', 'JBBold'],
];
for (const [file, fam] of FONTS) GlobalFonts.registerFromPath(join(here, 'fonts', file), fam);

const canvas = createCanvas(W, H);          // draft path (sub = 1)
const ctx = canvas.getContext('2d');
const subCanvas = createCanvas(W, H);       // scratch: one subframe
const subCtx = subCanvas.getContext('2d');
const accCanvas = createCanvas(W, H);       // accumulator: the output frame
const accCtx = accCanvas.getContext('2d');

/** Paint the output frame at time t and return the canvas that holds it. */
function frameCanvas(t, sub) {
  if (sub <= 1) {
    draw(ctx, t);
    return canvas;
  }
  const span = 0.5 / FPS;
  for (let i = 0; i < sub; i++) {
    const tt = t + ((i + 0.5) / sub - 0.5) * span;
    draw(subCtx, tt);                       // draw() paints an opaque background first
    accCtx.globalAlpha = 1 / (i + 1);
    accCtx.drawImage(subCanvas, 0, 0);
  }
  accCtx.globalAlpha = 1;
  return accCanvas;
}

async function main() {
  await mkdir(join(OUT, 'stills'), { recursive: true });
  const sub = Math.max(1, Math.round(Number(arg('sub', 2))));

  if (arg('stills')) {
    for (const t of String(arg('stills')).split(',').map(Number)) {
      const tt = Math.round(t * FPS) / FPS;
      const png = await frameCanvas(tt, sub).encode('png');
      const name = `t${tt.toFixed(2).replace('.', 'p')}.png`;
      await writeFile(join(OUT, 'stills', name), png);
      console.log('still', name);
    }
    return;
  }

  const ri = argv.indexOf('--range');
  const a = ri >= 0 ? Number(argv[ri + 1]) : 0;
  const b = ri >= 0 ? Number(argv[ri + 2]) : DUR;
  const f0 = Math.round(a * FPS);
  const f1 = Math.round(Math.min(b, DUR) * FPS);
  const N = f1 - f0;
  const name = String(arg('out', 'mcp-explainer.mp4'));
  const audio = arg('audio');
  const videoOnly = join(OUT, 'picture.mp4');
  const final = join(OUT, name);

  console.log(`rendering ${N} frames (${(N / FPS).toFixed(2)} s) · sub ${sub} · ${W}×${H}@${FPS}`);
  const t0 = Date.now();

  const ff = spawn(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'film',
    '-profile:v', 'high', '-level', '5.1',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-r', String(FPS), videoOnly,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

  for (let i = 0; i < N; i++) {
    const t = (f0 + i) / FPS;
    const buf = frameCanvas(t, sub).data();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 300 === 0) process.stdout.write(`\r  frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  console.log(`\npicture done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  const aPath = audio && join(here, String(audio));
  const haveAudio = aPath && existsSync(aPath);
  if (haveAudio) {
    // Two-pass loudness: measure the soundtrack, then apply the measured values linearly.
    // (Single-pass loudnorm rides the level and lands well off −14 LUFS on a short, sparse mix.)
    const LN = 'I=-14:TP=-1:LRA=11';
    const probe = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', aPath, '-af', `loudnorm=${LN}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
    const json = JSON.parse(/\{[\s\S]*\}/.exec(probe.stderr)[0]);
    const lnFilter = `loudnorm=${LN}:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
    console.log(`loudness measured: ${json.input_i} LUFS · TP ${json.input_tp} dBTP → target −14 / −1`);
    await new Promise((res, rej) => {
      const m = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', videoOnly, '-i', aPath,
        '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        // a brickwall after the loudness stage: the hits are sharp, and the peak must clear −1 dBTP with room
        '-af', `${lnFilter},alimiter=limit=0.7943:attack=5:release=60:level=disabled`,
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-t', String(N / FPS), '-movflags', '+faststart', final], { stdio: 'inherit' });
      m.on('exit', (c) => (c === 0 ? res() : rej(new Error(`mux exited ${c}`))));
    });
  } else {
    await new Promise((res, rej) => {
      const m = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-i', videoOnly, '-c', 'copy', '-movflags', '+faststart', final], { stdio: 'inherit' });
      m.on('exit', (c) => (c === 0 ? res() : rej(new Error(`copy exited ${c}`))));
    });
  }
  console.log(`${haveAudio ? 'muxed with audio' : 'picture only'} → ${final}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
