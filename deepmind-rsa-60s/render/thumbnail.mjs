// Thumbnail for the film: the title, the lock, and the 1,600x figure with its caveat.
// It uses the same background, lock and fonts as the film, so the thumbnail matches the video.
//
// Usage: node render/thumbnail.mjs   -> writes deepmind-rsa-thumbnail.png (1080x1920)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import './fonts.mjs';
import { background, drawLock, COL } from '../film/scenes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const c = createCanvas(1080, 1920), ctx = c.getContext('2d');
const CX = 540;

background(ctx, 26, { glowY: 760, glowA: 0.2 });

// Title, large enough to read at small sizes.
ctx.textAlign = 'center';
ctx.fillStyle = COL.white;
ctx.font = '96px InterK';
ctx.fillText('AI VS', CX, 420);
ctx.fillStyle = COL.cyan;
ctx.fillText('RSA-1024', CX, 530);

// The lock sits in the middle, with the cyan glow the film uses for it.
drawLock(ctx, { cx: CX, cy: 770, s: 1.0, alpha: 1, cracked: 1, glowA: 0.5 });

// The 1,600x figure, with its qualifier printed right under it.
ctx.fillStyle = COL.cyan;
ctx.shadowColor = COL.cyan;
ctx.shadowBlur = 50;
ctx.font = '230px InterK';
ctx.fillText('1,600×', CX, 1370);
ctx.shadowBlur = 0;
ctx.fillStyle = COL.amber;
ctx.font = '40px InterB';
ctx.fillText('THEORETICAL ESTIMATE', CX, 1440);
ctx.fillStyle = COL.grey;
ctx.font = '30px MonoM';
ctx.fillText('NOT RUN AT THIS KEY SIZE · RSA-2048+ NOT THREATENED', CX, 1500);

fs.writeFileSync(path.join(ROOT, 'deepmind-rsa-thumbnail.png'), await c.encode('png'));
console.log('wrote deepmind-rsa-thumbnail.png');
