// shiva-ganesha-video/story.mjs — the film as a pure function of time.
//
//   makeDraw(W, H) → draw(ctx, t)
//
// Layout is responsive. layout(W, H) gives each aspect its own boxes for the headline, the
// visual, and the caption. The scene art is drawn in a 1000-unit design space and scaled to
// the visual box. Text is fitted to its box, so the same copy works in portrait, square, and
// landscape. Nothing is hard-coded to one size.
//
// Every frame is a pure function of t: no state, no Math.random. Same t gives the same pixels.

import { createCanvas } from '@napi-rs/canvas';
import { C, FAM, SCENES, DUR, VOICE_LEAD } from './brand.mjs';
import {
  background, vignette, grain, paper, glass, chip, fitText, setFont, label, rr, circle, blob, lotus,
  crescent, trishul, ganeshaHuman, ganeshaElephant, shivaFigure, compass, spark, elephantSide,
  lin, rad, withShadow, cutRR,
} from './lib/paint.mjs';
import { clamp, lerp, prog, outCubic, inOutCubic, sp, hash } from './lib/ease.mjs';

// ── responsive layout ─────────────────────────────────────────────────────────
export function layout(W, H) {
  const a = W / H;
  if (a < 0.8) {                       // portrait 9:16
    return {
      mode: 'portrait',
      head: { x: W * 0.075, y: H * 0.115, w: W * 0.85, h: H * 0.165 },
      vis: { x: 0, y: H * 0.30, w: W, h: H * 0.48 },
      cap: { x: W * 0.075, y: H * 0.80, w: W * 0.85, h: H * 0.095 },
      top: H * 0.045, bar: H * 0.915,
    };
  }
  if (a <= 1.2) {                      // square 1:1
    return {
      mode: 'square',
      head: { x: W * 0.075, y: H * 0.07, w: W * 0.85, h: H * 0.16 },
      vis: { x: W * 0.08, y: H * 0.25, w: W * 0.84, h: H * 0.48 },
      cap: { x: W * 0.075, y: H * 0.765, w: W * 0.85, h: H * 0.12 },
      top: H * 0.035, bar: H * 0.93,
    };
  }
  return {                             // landscape 16:9
    mode: 'landscape',
    head: { x: W * 0.06, y: H * 0.2, w: W * 0.37, h: H * 0.34 },
    vis: { x: W * 0.46, y: H * 0.1, w: W * 0.48, h: H * 0.8 },
    cap: { x: W * 0.06, y: H * 0.6, w: W * 0.37, h: H * 0.2 },
    top: H * 0.06, bar: H * 0.93,
  };
}

// ── text: animated headline and caption ───────────────────────────────────────
/** Size at which every headline line fits its box (one common size). */
function fitLines(c, lines, box, { maxSize = 150, minSize = 30, fam = FAM.black, lh = 1.04 } = {}) {
  let best = minSize;
  for (let s = maxSize; s >= minSize; s -= 2) {
    setFont(c, s, fam);
    const ok = lines.every((l) => c.measureText(l).width <= box.w) && lines.length * s * lh <= box.h;
    if (ok) { best = s; break; }
  }
  return { size: best, lh };
}

function headline(c, scene, lt, L, W, H, alpha) {
  const box = L.head;
  const { size, lh } = fitLines(c, scene.head, box, { maxSize: Math.min(W, H) * 0.15 });
  const totalH = scene.head.length * size * lh;
  let y0 = box.y + (box.h - totalH) / 2 + size * 0.86;
  if (L.mode !== 'portrait') y0 = box.y + size * 0.86;
  let wi = 0;
  scene.head.forEach((line, li) => {
    const words = line.split(' ');
    let x = box.x;
    const y = y0 + li * size * lh;
    setFont(c, size, FAM.black);
    for (const w of words) {
      const start = 0.12 + wi * 0.09;
      const p = outCubic(prog(lt, start, start + 0.5));
      const dy = lerp(size * 0.55, 0, p);
      const isHi = w.replace(/[^\p{L}]/gu, '').toLowerCase() === (scene.hi ?? '').toLowerCase();
      const col = isHi ? (scene.theme === 'cream' || scene.theme === 'dawn' || scene.theme === 'gold' || scene.theme === 'map' ? C.sindoor : C.haldi) : (scene.theme === 'cream' || scene.theme === 'dawn' || scene.theme === 'gold' || scene.theme === 'map' ? C.cocoa : C.cream);
      c.save();
      c.globalAlpha = alpha * p;
      setFont(c, size, FAM.black);
      c.fillStyle = col;
      c.fillText(w, x, y + dy);
      c.restore();
      x += c.measureText(w + ' ').width;
      wi++;
    }
  });
}

/** Caption as a dark chip at the bottom. Each word lights up as it is spoken. */
function caption(c, scene, t, L, W, H) {
  if (!scene.cap) return;
  const box = L.cap;
  const pad = Math.min(W, H) * 0.028;
  const inner = { x: box.x + pad, y: box.y + pad * 0.6, w: box.w - pad * 2, h: box.h - pad * 1.2 };
  const fit = fitText(c, scene.cap, inner, { maxSize: Math.min(W, H) * 0.052, minSize: 22, fam: FAM.semi, lh: 1.25 });
  const onAt = scene.t0 + VOICE_LEAD;
  const enter = outCubic(prog(t, scene.t0 + 0.1, scene.t0 + 0.45));
  const exit = 1 - prog(t, scene.t1 - 0.3, scene.t1 - 0.02);
  const boxA = enter * exit;
  if (boxA <= 0.001) return;
  c.save();
  c.globalAlpha = boxA;
  chip(c, box.x, box.y, box.w, box.h, 'rgba(42,28,22,0.86)', 1);
  c.restore();
  // words
  const words = scene.cap.split(' ');
  const total = words.length;
  let wi = 0;
  setFont(c, fit.size, FAM.semi);
  const lineH = fit.size * fit.lh;
  const blockH = fit.lines.length * lineH;
  const top = inner.y + (inner.h - blockH) / 2 + fit.size * 0.85;
  fit.lines.forEach((line, li) => {
    const ws = line.split(' ');
    const lineW = c.measureText(line).width;
    let x = inner.x + (inner.w - lineW) / 2;
    for (const w of ws) {
      const at = onAt + (wi / total) * scene.vDur;
      const a = clamp((t - at) / 0.12) * boxA;
      c.save();
      c.globalAlpha = a;
      setFont(c, fit.size, FAM.semi);
      c.fillStyle = a > 0.5 ? C.cream : 'rgba(255,243,220,0.55)';
      c.fillText(w, x, top + li * lineH);
      c.restore();
      x += c.measureText(w + ' ').width;
      wi++;
    }
  });
}

// ── scene art (design space, centred at 0,0, roughly ±500) ─────────────────────
function within(c, vis, fn) {
  const s = Math.min(vis.w, vis.h) / 1000;
  c.save();
  c.translate(vis.x + vis.w / 2, vis.y + vis.h / 2);
  c.scale(s, s);
  fn(s);
  c.restore();
}

function arch(c, x, y, w, h) {
  c.beginPath();
  c.moveTo(x - w / 2, y + h / 2);
  c.lineTo(x - w / 2, y - h / 2 + w / 2);
  c.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0);
  c.lineTo(x + w / 2, y + h / 2);
  c.closePath();
}

function glowRing(c, x, y, r, color, a) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = rad(c, x, y, r * 0.55, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  circle(c, x, y, r);
  c.fill();
  c.restore();
}

function dotsRing(c, x, y, r, n, size, color, a, rot) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rot;
    circle(c, x + Math.cos(ang) * r, y + Math.sin(ang) * r, size);
    c.fill();
  }
  c.restore();
}

// Scene 1: the hook. Shiva and the child, a gold arc between them, and a sun-disc behind.
function sceneHook(c, lt, vis) {
  within(c, vis, () => {
    glowRing(c, 0, 0, 470 * sp(lt, 0.1, 0.9), C.haldi, 0.35);
    dotsRing(c, 0, 0, 420, 56, 4, C.haldi2, 0.5 * sp(lt, 0.2, 0.9), lt * 0.12);
    const shivaS = 520 * sp(lt, 0.2, 0.8);
    const childS = 500 * sp(lt, 0.45, 0.8);
    shivaFigure(c, -250, -80, shivaS, 0.2);
    ganeshaHuman(c, 250, 0, childS, { blink: lt > 2.2 && lt < 2.3 });
    // a single gold arc between the two: the question the hook asks
    const a = prog(lt, 1.8, 2.6);
    if (a > 0) {
      c.save();
      c.strokeStyle = C.haldi2;
      c.lineWidth = 14;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-130, -120);
      c.quadraticCurveTo(0, -330, -130 + 260 * a, -120 + 60 * a);
      c.stroke();
      c.restore();
      spark(c, -130 + 260 * a, -120 + 60 * a, 14 * a, a);
    }
  });
}

// Scene 2: creation. Turmeric grains gather into a body, then the child's face appears.
function sceneCreation(c, lt, vis) {
  within(c, vis, () => {
    const lotusOpen = prog(lt, 0.2, 1.4);
    lotus(c, -300, -360, 150, lotusOpen, C.sindoor2, 8);
    // grains: start at the edge, settle into the body
    const cx = 0, cy = 60, R = 210;
    for (let i = 0; i < 150; i++) {
      const a0 = hash(i * 3.1) * Math.PI * 2;
      const r0 = 440 + hash(i * 7.7) * 70;
      const x0 = Math.cos(a0) * r0, y0 = Math.sin(a0) * r0;
      const a1 = hash(i * 1.3) * Math.PI * 2;
      const rr1 = R * Math.sqrt(hash(i * 5.9));
      const x1 = cx + Math.cos(a1) * rr1, y1 = cy + Math.sin(a1) * rr1 * 1.05;
      const p = inOutCubic(prog(lt, 0.1 + hash(i) * 0.9, 2.6 + hash(i * 2) * 0.4));
      const x = lerp(x0, x1, p), y = lerp(y0, y1, p);
      c.globalAlpha = 0.9;
      c.fillStyle = i % 3 === 0 ? C.haldi2 : C.haldi;
      circle(c, x, y, 4 + hash(i * 9) * 5);
      c.fill();
    }
    c.globalAlpha = 1;
    const s = 620 * sp(lt, 2.7, 0.9);
    if (s > 1) ganeshaHuman(c, 0, 40, s, { blink: lt > 4.4 && lt < 4.52 });
  });
}

// Scene 3: the order. An arch door and a child who stands in it.
function sceneDoor(c, lt, vis) {
  within(c, vis, () => {
    const drop = (1 - outCubic(prog(lt, 0, 0.9))) * -700;
    c.save();
    c.translate(0, drop);
    arch(c, 0, 60, 640, 780);
    c.fillStyle = lin(c, 0, -330, 0, 450, [[0, C.cocoa3], [1, C.cocoa]]);
    c.fill();
    c.restore();
    glowRing(c, 0, 80, 420, C.sindoor, 0.22 * prog(lt, 0.5, 1.2));
    ganeshaHuman(c, 0, 90, 560 * sp(lt, 0.6, 0.8), { blink: lt > 3.4 && lt < 3.5 });
    // the order, on a paper tag
    const tagA = outCubic(prog(lt, 1.0, 1.5));
    c.save();
    c.globalAlpha = tagA;
    paper(c, -300, -470 - (1 - tagA) * 30, 600, 96, 48, { seed: 9 });
    c.restore();
    label(c, 'AADESH', 0, -470 - (1 - tagA) * 30 + 62, { size: 46, fam: FAM.monoB, color: C.cocoa, align: 'center', alpha: tagA, track: 6 });
  });
}

// Scene 4: Shiva arrives. The child stands at the door. He does not recognise Shiva.
function sceneArrival(c, lt, vis) {
  within(c, vis, () => {
    arch(c, -180, -10, 560, 880);
    c.fillStyle = lin(c, 0, -450, 0, 430, [[0, C.cocoa3], [1, C.cocoa]]);
    c.fill();
    ganeshaHuman(c, -180, 110, 500, { blink: false });
    const shivaX = lerp(1000, 260, outCubic(prog(lt, 0.2, 1.8)));
    const armUp = outCubic(prog(lt, 2.2, 3.0)) * 0.7;
    shivaFigure(c, shivaX, -50, 500, armUp);
    // gaze: three dots between them, growing toward the child
    const gaze = prog(lt, 2.4, 3.2);
    for (let i = 0; i < 3; i++) {
      const p = (i + 1) / 4;
      const x = lerp(260, -60, p);
      c.globalAlpha = gaze;
      circle(c, x, -40, 9 + 6 * (1 - p));
      c.fillStyle = C.haldi2;
      c.fill();
    }
    c.globalAlpha = 1;
    // name tags
    const a1 = outCubic(prog(lt, 1.2, 1.7));
    const a2 = outCubic(prog(lt, 2.8, 3.3));
    c.save();
    c.globalAlpha = a2;
    paper(c, -420, 400, 330, 92, 46, { seed: 3 });
    c.restore();
    label(c, 'Bachcha', -255, 458, { size: 40, fam: FAM.monoB, color: C.cocoa, align: 'center', alpha: a2, track: 2 });
    c.save();
    c.globalAlpha = a1;
    chip(c, 150, 400, 360, 92, C.sindoor);
    c.restore();
    label(c, 'Shiva', 330, 458, { size: 40, fam: FAM.monoB, color: C.cream, align: 'center', alpha: a1, track: 2 });
  });
}

// Scene 5: the moment. The trishul is struck, a flash, and the head lifts away as light.
function sceneCut(c, lt, vis) {
  within(c, vis, () => {
    const flash = 1 - prog(lt, 2.3, 3.1);
    const hx = 260, hy = -150;                  // Shiva's hand
    const tx = -180, ty = 40;                   // the child's neck
    // body of the child stays
    blob(c, -180, 200, 176, 170, 11, 0.04);
    c.fillStyle = C.haldi;
    c.fill();
    // the child's head: present until the strike, then lifts and fades into light
    const lift = outCubic(prog(lt, 2.4, 3.6));
    const headA = 1 - prog(lt, 2.9, 3.9);
    if (headA > 0.01) {
      c.save();
      c.globalAlpha = headA;
      const hy2 = -40 - lift * 360;
      blob(c, -180, hy2, 150, 145, 9, 0.03);
      c.fillStyle = C.paper;
      c.fill();
      c.restore();
      spark(c, -180, hy2, 26 * headA, headA * 0.8);
    }
    shivaFigure(c, hx, -70, 520, 0.9 - 0.4 * prog(lt, 1.6, 2.2));
    // the strike: a gold streak from the trishul to the neck
    const streak = prog(lt, 1.9, 2.3);
    if (streak > 0 && lt < 2.6) {
      c.save();
      c.strokeStyle = C.haldi2;
      c.lineWidth = 22 * (1 - prog(lt, 2.2, 2.6));
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(hx - 120, hy);
      c.lineTo(lerp(hx - 120, tx, streak), lerp(hy, ty, streak));
      c.stroke();
      c.restore();
    }
    // the flash, over the whole frame in design units
    if (flash > 0) {
      c.save();
      c.globalAlpha = flash * 0.7;
      c.fillStyle = rad(c, tx, ty, 0, 900, [[0, '#FFF8E6'], [0.3, 'rgba(255,217,122,0.7)'], [1, 'rgba(255,217,122,0)']]);
      c.fillRect(-900, -900, 1800, 1800);
      c.restore();
    }
  });
}

// Scene 6: Parvati's grief. The lotus closes, and the rings of the sky slow to a stop.
function sceneGrief(c, lt, vis) {
  within(c, vis, () => {
    // ring speed decays: angle = A·∫(1−τ/5)² dτ over 0..5 s, then constant
    const A = 2.4;
    const tt = Math.min(lt, 5);
    const ang = A * (5 / 3) * (1 - Math.pow(1 - tt / 5, 3));
    dotsRing(c, 0, 0, 460, 40, 5, C.sandal, 0.5, ang);
    dotsRing(c, 0, 0, 340, 28, 4, C.sandal, 0.4, -ang * 1.3);
    lotus(c, 0, 0, 300, 1 - prog(lt, 0.8, 3.2), C.sindoor2, 8);
    c.save();
    c.globalAlpha = 0.4;
    ganeshaHuman(c, 0, 330, 230, { blink: false });
    c.restore();
  });
}

// Scene 7: the search. The compass needle turns to north. The ganas run north and find an elephant.
function sceneSearch(c, lt, vis) {
  within(c, vis, () => {
    const ang = lerp(200, 0, outCubic(prog(lt, 0, 1.6)));
    compass(c, 0, -330, 128, ang);
    // Shiva at the base, arm raised
    shivaFigure(c, 0, 20, 420, 0.4);
    // ganas run north, from Shiva's base outward
    const ends = [[-360, -120], [-200, -330], [200, -340], [380, -90], [-420, 120], [400, 150]];
    ends.forEach(([ex, ey], i) => {
      const p = outCubic(prog(lt, 1.2 + i * 0.12, 3.6 + i * 0.12));
      const x = lerp(0, ex, p), y = lerp(20, ey, p);
      c.save();
      c.globalAlpha = 0.25 + 0.75 * p;
      c.fillStyle = C.cocoa3;
      blob(c, x, y, 26, 30, 50 + i, 0.05);
      c.fill();
      c.restore();
    });
    // the elephant is found
    const found = sp(lt, 5.2, 0.9);
    if (found > 0.01) {
      c.save();
      c.globalAlpha = found;
      elephantSide(c, 0, -20, 480 * found);
      c.restore();
      c.save();
      c.globalAlpha = prog(lt, 5.6, 6.1);
      chip(c, 190, -440, 290, 96, C.sindoor);
      c.restore();
      label(c, 'Hathi mila!', 335, -378, { size: 48, fam: FAM.monoB, color: C.cream, align: 'center', alpha: prog(lt, 5.6, 6.1), track: 2 });
    }
  });
}

// Scene 8: new life. The elephant head is placed on the body. The lotus blooms. The eyes open.
function sceneRestore(c, lt, vis) {
  within(c, vis, () => {
    glowRing(c, 0, 120, 540, C.cream, 0.5 * prog(lt, 0.8, 2.4));
    lotus(c, 0, 150, 620, prog(lt, 1.0, 3.0), C.paper, 10);
    const headDrop = (1 - spring2(prog(lt, 0.4, 2.0))) * -300;
    ganeshaElephant(c, 0, 120, 560, { headY: headDrop, eyes: lt > 5.0 });
    if (lt > 2.0 && lt < 3.2) {
      const p = prog(lt, 2.0, 3.2);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        spark(c, Math.cos(a) * 340 * outCubic(p), 60 + Math.sin(a) * 340 * outCubic(p), 16, 1 - p);
      }
    }
  });
}
const spring2 = (p) => sp(p, 0, 1);

// Scene 9: the boon. Ganesha, and the moments he is worshipped first, as chips.
function sceneBoon(c, lt, vis) {
  within(c, vis, () => {
    glowRing(c, 0, -60, 460 + 14 * Math.sin(lt * 3), C.haldi, 0.35);
    ganeshaElephant(c, 0, -60, 600 * sp(lt, 0.1, 0.9));
    const tags = ['Shuruat', 'Yatra', 'Vivah', 'Padhai'];
    tags.forEach((tag, i) => {
      const p = outCubic(prog(lt, 1.2 + i * 0.25, 1.8 + i * 0.25));
      const w = 210, h = 92;
      const x = -(tags.length * (w + 26) - 26) / 2 + i * (w + 26);
      c.save();
      c.globalAlpha = p;
      paper(c, x, 400 + (1 - p) * 40, w, h, 46, { seed: 20 + i });
      c.restore();
      label(c, tag, x + w / 2, 400 + (1 - p) * 40 + 58, { size: 42, fam: FAM.monoB, color: C.cocoa, align: 'center', alpha: p, track: 1 });
    });
  });
}

const SCENE_DRAW = {
  hook: sceneHook, creation: sceneCreation, door: sceneDoor, arrival: sceneArrival,
  cut: sceneCut, grief: sceneGrief, search: sceneSearch, restore: sceneRestore, boon: sceneBoon,
};

// ── the film ──────────────────────────────────────────────────────────────────
export function makeDraw(W, H) {
  const L = layout(W, H);
  const tile = createCanvas(256, 256);
  {
    const tc = tile.getContext('2d');
    const img = tc.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const v = Math.floor(hash(i * 0.731 + 7) * 255);
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    tc.putImageData(img, 0, 0);
  }
  const sceneIndexAt = (t) => {
    let k = SCENES.findIndex((s) => t >= s.t0 && t < s.t1);
    return k < 0 ? SCENES.length - 1 : k;
  };

  /** Draw one scene, complete with background, art, headline, and caption, at picture time t. */
  function drawScene(c, k, t) {
    const sc = SCENES[k];
    const lt = Math.max(0, t - sc.t0);
    c.save();
    background(c, W, H, sc.theme);
    SCENE_DRAW[sc.id](c, lt, L.vis);
    c.restore();
    c.save();
    const exit = 1 - prog(t, sc.t1 - 0.35, sc.t1 - 0.05);
    headline(c, sc, lt, L, W, H, exit);
    c.restore();
    caption(c, sc, t, L, W, H);
  }

  function chrome(c, t) {
    const k = sceneIndexAt(t);
    const sc = SCENES[k];
    const dark = !['dawn', 'map', 'cream', 'gold'].includes(sc.theme);
    const ink = dark ? C.cream : C.cocoa;
    label(c, 'SHIVA · GANESHA', L.head.x, L.top, { size: 26, fam: FAM.monoB, color: ink, track: 3, alpha: 0.85 });
    label(c, `${String(k + 1).padStart(2, '0')} / ${String(SCENES.length).padStart(2, '0')} · ${sc.label}`,
      L.head.x + L.head.w, L.top, { size: 26, fam: FAM.mono, color: ink, track: 1, align: 'right', alpha: 0.7 });
    // progress bar
    const bx = L.head.x, bw = L.head.w, by = L.bar, bh = 10;
    c.save();
    rr(c, bx, by, bw, bh, 5);
    c.fillStyle = dark ? 'rgba(255,243,220,0.18)' : 'rgba(42,28,22,0.14)';
    c.fill();
    rr(c, bx, by, bw * clamp(t / DUR), bh, 5);
    c.fillStyle = lin(c, bx, 0, bx + bw, 0, [[0, C.haldi], [1, C.sindoor]]);
    c.fill();
    c.restore();
    const tc = (s) => `00:${String(Math.floor(s)).padStart(2, '0')}`;
    label(c, `${tc(t)} / ${tc(DUR)}`, bx + bw, by - 14, { size: 22, fam: FAM.mono, color: ink, align: 'right', alpha: 0.6 });
  }

  return function draw(ctx, t) {
    const c = ctx;
    const W0 = c.canvas.width, H0 = c.canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.shadowColor = 'rgba(0,0,0,0)';
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    const k = sceneIndexAt(t);
    const sc = SCENES[k];
    // ring wipe from the previous scene into this one, centred on the visual
    const WIPE = 0.42;
    const into = t - sc.t0;
    if (k > 0 && into < WIPE) {
      drawScene(c, k - 1, t);
      const p = inOutCubic(into / WIPE);
      const cx = L.vis.x + L.vis.w / 2, cy = L.vis.y + L.vis.h / 2;
      const R = Math.hypot(W0, H0) * p;
      c.save();
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.clip();
      drawScene(c, k, t);
      c.restore();
    } else {
      drawScene(c, k, t);
    }
    chrome(c, t);
    vignette(c, W0, H0, 0.22);
    grain(c, W0, H0, tile, 0.09);
  };
}
