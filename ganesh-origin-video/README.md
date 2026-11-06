# भगवान गणेश की उत्पत्ति — 60 s 9:16 film

Output: `out/ganesh-origin-60s.mp4` (1080×1920, 60 fps, 60.00 s, H.264 + AAC, about −14 LUFS, TP −1 dBFS).

## Status
- **VO and on-screen text are DRAFTS.** The original brief text was not saved in the workspace, so the 8 Hindi lines in `audio/` and the captions in `script.json` were written from the story. Replace them with the user's exact text, then rebuild.
- Scene images: `assets/scene-1..8`. Character refs: `assets/ref-*.png`.
- Music: original, synthesised in `render/music.mjs`. No samples and no chant recordings.
- Reference sheets (side, three-quarter, expression): not made. Flagged for the delivery note.

## Build
```
cd ganesh-origin-video
npm install
FFMPEG=/path/to/ffmpeg node render/measure.mjs   # VO lengths -> out/vo-durations.json
FFMPEG=/path/to/ffmpeg node render/render.mjs    # picture -> out/video.mp4 (about 2.5 min)
FFMPEG=/path/to/ffmpeg node render/music.mjs     # music bed -> out/music.wav
FFMPEG=/path/to/ffmpeg bash render/mix.sh        # final mux -> out/ganesh-origin-60s.mp4
```
Single-frame check: `node render/render.mjs --still 7`.
Preview server: `PORT=8300 node render/serve.mjs`.

## Timing
| Block | Scene | Image |
|---|---|---|
| 0–5 | Hook | scene-1-hook |
| 5–14 | Creation | scene-2-creation |
| 14–21 | Command | scene-3-command |
| 21–27 | Confrontation | scene-4-confrontation |
| 27–35 | Battle (flash and silhouettes only) | scene-5-battle |
| 35–41 | Grief | scene-6-grief |
| 41–51 | Rebirth (symbolic elephant silhouette only) | scene-7-rebirth |
| 51–60 | Payoff | scene-8-payoff |

## Post copy
See `post.txt`. The wisdomlib and Shiva Purana references in the brief are unverified.
