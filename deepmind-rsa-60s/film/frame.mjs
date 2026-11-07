// Frame composition for the film. Shared by the ffmpeg renderer (render/render.mjs) and the Remotion editor.
//
// drawFilmFrame(ctx, t, timeline, opts) draws the complete picture at time t (seconds):
//   1. the scene that is on screen at t. Scenes are joined by hard cuts, with a short white flash around each cut.
//   2. burned-in captions from the timeline
//   3. film grain, a thin progress line, and a fade to the brand navy at the end
//
// Why hard cuts: an earlier cross-fade faded the outgoing scene into the background before the incoming scene's
// elements had started (their timers are 0 at local time 0). That produced a near-empty frame at every cut.
// A cut with a flash has no such gap, and it reads as a deliberate edit.
//
// `timeline` is the parsed out/timing.json. `opts.makeCanvas(w, h)` creates an offscreen canvas for the
// grain tile. Node passes @napi-rs/canvas, and the browser passes document.createElement.
import { SCENE_FNS, drawCaption, cl } from './scenes.mjs';

export const FLASH_HALF = 0.12;    // seconds on each side of a scene cut where the white flash is drawn
export const BG = '#0B1120';       // brand navy used for the end fade
const GRAIN_SIZE = 256;

// Index of the scene that is on screen at time t.
export function sceneIndexAt(timeline, t) {
  const scenes = timeline.scenes;
  for (let i = scenes.length - 1; i >= 0; i--) if (t >= scenes[i].start - 1e-9) return i;
  return 0;
}

// Builds the film-grain tile once. It is a noise canvas that gets laid over every frame.
export function makeGrainTile(makeCanvas) {
  const tile = makeCanvas(GRAIN_SIZE, GRAIN_SIZE);
  const g = tile.getContext('2d');
  const img = g.createImageData(GRAIN_SIZE, GRAIN_SIZE);
  let seed = 90210; // fixed seed, so renders are repeatable
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const v = 118 + (seed >>> 24) % 24; // mid-grey, narrow range
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tile;
}

// Lays the grain over the frame at a random-looking offset that changes with time.
function applyGrain(ctx, grain, t, W, H) {
  ctx.save();
  const ox = Math.floor((t * 997) % GRAIN_SIZE), oy = Math.floor((t * 613) % GRAIN_SIZE);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.09;
  ctx.translate(-ox, -oy);
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(ox, oy, W, H);
  ctx.restore();
}

// Draws the whole film at time t. `grain` is the tile from makeGrainTile, and `total` is the film length.
export function drawFilmFrame(ctx, t, timeline, { grain, W = 1080, H = 1920, total = timeline.total } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Scene: a hard cut at each scene start. Its local time is t minus its start.
  const scenes = timeline.scenes;
  const i = sceneIndexAt(timeline, t);
  SCENE_FNS[i](ctx, t - scenes[i].start, 1);

  // White flash around the cut into the next scene. It peaks at the cut and fades out over FLASH_HALF.
  if (i < scenes.length - 1) {
    const d = Math.abs(scenes[i + 1].start - t);
    if (d < FLASH_HALF) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.pow(1 - d / FLASH_HALF, 2) * 0.85;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  // Burned-in captions.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  const cap = timeline.captions.find((c) => t >= c.start && t < c.end);
  if (cap) drawCaption(ctx, cap, t);

  if (grain) applyGrain(ctx, grain, t, W, H);

  // Thin progress line across the top.
  ctx.fillStyle = 'rgba(54,197,240,0.85)';
  ctx.fillRect(0, 0, W * (t / total), 6);

  // Fade to the brand navy over the last 0.6 s.
  const fade = cl((t - (total - 0.6)) / 0.6);
  if (fade > 0) {
    ctx.globalAlpha = fade;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}
