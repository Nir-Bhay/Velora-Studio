// Measures the length of each VO clip with ffmpeg and writes out/vo-durations.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Project root: the folder that holds script.json, assets/, audio/, fonts/ and out/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FF = process.env.FFMPEG || 'ffmpeg';
// Length of each VO clip in seconds, keyed by scene id.
const durations = {};
for (let id = 1; id <= 8; id++) {
  const file = path.join(ROOT, 'audio', `vo-0${id}.mp3`);
  const r = spawnSync(FF, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = r.stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
  if (!m) throw new Error(`cannot read duration of ${file}`);
  durations[id] = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'out', 'vo-durations.json'), JSON.stringify(durations, null, 2));
console.log('VO durations (s):', JSON.stringify(durations));
