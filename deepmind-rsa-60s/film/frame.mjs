// Frame composition for the film. Shared by the ffmpeg renderer (render/render.mjs) and the Remotion editor.
//
// drawFilmFrame(ctx, t, timeline, opts) draws the complete picture at time t (seconds):
//   1. the current scene, plus the next scene cross-faded in over the last XF seconds of the current one
//   2. burned-in captions from the timeline
//   3. film grain, a thin progress line, and a fade to the brand navy at the end
//
// `timeline` is the parsed out/timing.json. `opts.makeCanvas(w, h)` creates an offscreen canvas for the
// grain tile. Node passes @napi-rs/canvas, and the browser passes document.createElement.
import { SCENE_FNS, drawCaption, cl } from './scenes.mjs';

export const XF = 0.35;            // cross-fade length, seconds
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
/**
 * @param {CanvasRenderingContext2D} ctx        target 2D context (node-canvas or browser canvas)
 * @param {number} t                             time in seconds
 * @param {{scenes: Array<{start: number, duration: number}>, captions: any[], total: number}} timeline
 * @param {{grain?: any, W?: number, H?: number, total?: number}} [opts]
 */
export function drawFilmFrame(ctx, t, timeline, { grain, W = 1080, H = 1920, total = timeline.total } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Scenes. Near a scene boundary the next scene fades in over the last XF seconds of the current one.
  const scenes = timeline.scenes;
  const i = sceneIndexAt(timeline, t);
  const sc = scenes[i];
  const lt = t - sc.start;
  const tailStart = sc.duration - XF;
  if (i < scenes.length - 1 && lt > tailStart) {
    SCENE_FNS[i](ctx, lt, 1);
    const nx = scenes[i + 1];
    // Linear progress keeps the mix exact: final = p*next + (1-p)*current.
    const p = cl((lt - tailStart) / XF);
    // The next scene's local time is negative until it starts. Its element timers (win/eo) return 0 for negative
    // times, so its content is still hidden during the cross-fade. Known issue: see EDIT-NOTES.md, section 4 (S6 → S7 dip).
    SCENE_FNS[i + 1](ctx, t - nx.start, p);
  } else {
    SCENE_FNS[i](ctx, lt, 1);
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
