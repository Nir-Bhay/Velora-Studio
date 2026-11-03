// scripts/build-films-manifest.mjs — writes films-manifest.json for films.html.
//   node scripts/build-films-manifest.mjs
// The chapter list is READ from each film's own scene table (mcp-video/brand.mjs SCENES,
// samyoj-video/deliver/render.json scenes), so the page cannot drift from the picture.
// It fails loudly if a scene has no label, the scenes leave a gap, or a file is missing.
import { writeFile, access, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => p.split('\\').join('/');

const brand = await import(pathToFileURL(join(ROOT, 'mcp-video', 'brand.mjs')).href);
const samyojRender = JSON.parse(await readFile(join(ROOT, 'samyoj-video', 'deliver', 'render.json'), 'utf8'));

// Human labels for each scene id. A missing id is a build error, so new scenes get a label.
const MCP_LABELS = {
  hook: 'The problem',
  solution: 'One plug',
  waiter: 'Like a waiter',
  steps: 'Four steps',
  control: 'You decide',
  newtool: 'Add a tool',
  loop: 'Again',
};
const SAMYOJ_LABELS = {
  hook: 'Hook',
  broadcast: 'Broadcast',
  ai: 'AI agent',
  flows: 'Automation',
  inbox: 'Shared inbox',
  commerce: 'Commerce',
  ads: 'Ads → pipeline',
  cta: 'End card',
};

function chapters(scenes, labels, duration, film) {
  const out = [];
  let cursor = 0;
  for (const s of scenes) {
    if (!(s.id in labels)) throw new Error(`${film}: scene "${s.id}" has no label in build-films-manifest.mjs`);
    if (Math.abs(s.t0 - cursor) > 1e-6) throw new Error(`${film}: gap or overlap before "${s.id}" (${cursor} → ${s.t0})`);
    if (!(s.t1 > s.t0)) throw new Error(`${film}: scene "${s.id}" has no length`);
    out.push({ id: s.id, label: labels[s.id], t0: s.t0, t1: s.t1 });
    cursor = s.t1;
  }
  if (Math.abs(cursor - duration) > 1e-6) throw new Error(`${film}: scenes end at ${cursor}, duration is ${duration}`);
  return out;
}

const films = [
  {
    id: 'mcp-explainer-v3',
    title: 'How MCP works',
    kind: 'Explainer · 40 s · loops',
    summary: 'Four AI apps and twelve tools make forty-eight connections. MCP is one common plug, like a phone charger. It works like a waiter who takes your order to the kitchen. The AI suggests, you say haan. Then it loops back to the start.',
    src: 'mcp-video/deliver/mcp-explainer-v3-loop-9x16-1080p60.mp4',
    poster: 'mcp-video/deliver/poster-v3-2s.png',
    aspect: '9:16',
    width: brand.W, height: brand.H, fps: brand.FPS, duration: brand.DUR,
    specs: ['1080×1920 · 60 fps · H.264 + AAC', 'Hinglish narration (voice-02)', '−14.1 LUFS · true peak −1.7 dBTP', 'seamless loop, no end card'],
    chapters: chapters(brand.SCENES, MCP_LABELS, brand.DUR, 'mcp-explainer-v3'),
    source: 'mcp-video/brand.mjs',
    voiceNote: 'Script, voice clips and assembly: mcp-video/voiceover/ (script.v2.json). Storyboard: mcp-video/STORYBOARD-v2.md.',
  },
  {
    id: 'mcp-explainer-v4',
    title: 'How MCP works · chat version',
    kind: 'Explainer · 40 s · loops · compare with v3',
    summary: 'The same idea, the same narration and sound as v3, shown as an app. Four AI apps and twelve tools morph into one plug. The waiter, the four steps and the choice are chat messages, and the new tool is a settings toggle.',
    src: 'mcp-video/deliver/mcp-explainer-v4-chat-9x16-1080p60.mp4',
    poster: 'mcp-video/deliver/poster-v4-2s.png',
    aspect: '9:16',
    width: brand.W, height: brand.H, fps: brand.FPS, duration: brand.DUR,
    specs: ['1080×1920 · 60 fps · H.264 + AAC', 'Hinglish narration (voice-02), same as v3', '−14.1 LUFS · true peak −1.7 dBTP', 'seamless loop, no end card'],
    chapters: chapters(brand.SCENES, MCP_LABELS, brand.DUR, 'mcp-explainer-v4'),
    source: 'mcp-video/brand.mjs',
    voiceNote: 'Visual approach from the awesome-opus5-5-videos research. Storyboard: mcp-video/STORYBOARD-v4.md.',
  },
  {
    id: 'samyoj-launch',
    title: 'Samyoj launch film',
    kind: 'Launch film · 60 s',
    summary: 'The 60-second Samyoj launch film: hook, broadcast, AI agent, automation, shared inbox, commerce, ads and an end card.',
    src: 'samyoj-video/deliver/samyoj-launch-1080p60-with-voice.mp4',
    poster: 'samyoj-video/deliver/poster.jpg',
    aspect: '16:9',
    width: samyojRender.width, height: samyojRender.height, fps: samyojRender.fps, duration: samyojRender.duration,
    specs: ['1920×1080 · 60 fps', 'with voice-over and music', 'synthesized soundtrack'],
    chapters: chapters(samyojRender.scenes, SAMYOJ_LABELS, samyojRender.duration, 'samyoj-launch'),
    source: 'samyoj-video/deliver/render.json',
    voiceNote: 'With the voice-over track.',
  },
];

for (const f of films) {
  try { await access(join(ROOT, f.src)); } catch { throw new Error(`${f.id}: missing file ${f.src}`); }
  if (f.poster) { try { await access(join(ROOT, f.poster)); } catch { f.poster = null; } }
  f.src = rel(f.src);
  if (f.poster) f.poster = rel(f.poster);
}

const manifest = {
  generatedBy: 'scripts/build-films-manifest.mjs',
  note: 'Generated. Do not edit by hand. Run: node scripts/build-films-manifest.mjs',
  films,
};
await writeFile(join(ROOT, 'films-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote films-manifest.json: ${films.length} films, ${films.reduce((n, f) => n + f.chapters.length, 0)} chapters`);
