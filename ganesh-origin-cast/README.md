# भगवान गणेश की उत्पत्ति: V3 "cast" (60 s, 9:16)

Character version of the film. Characters are cut-outs (transparent PNGs) placed on
layers, with motion graphics for the symbols. Build status is in the section below.

## Output
`out/ganesh-origin-60s.mp4`, written by `render/mix.sh`. Target: 1080×1920, 60 fps,
60.00 s, AAC audio loudness-normalised to I=−14 LUFS, TP=−1.5 dBTP (set in `mix.sh`).

## Layout
```
script.json          timeline, captions, highlight words, labels (8 scenes)
assets/keyed-*.png   character cut-outs: shiva, parvati, boy, reborn (with alpha)
audio/vo-01..08.mp3  Hindi VO, one clip per scene
fonts/               NotoSansDevanagari (SIL OFL)
render/cast.mjs      picture renderer (canvas): layers, characters, captions
render/music.mjs     original synthesised music bed (no samples or recordings)
render/measure.mjs   reads VO clip lengths into out/vo-durations.json
render/mix.sh        places VO clips, mixes with music, loudness-normalises, muxes
render/build-cast.sh full build: music, 12 × 5 s picture segments, concat, mix
render/serve.mjs     HTTP server for out/ with Range requests (env PORT, default 8300)
post.txt             title and hashtags for posting
```

## Build
Needs Node.js, `npm install` (uses `@napi-rs/canvas`), and ffmpeg (set `FFMPEG` if it
is not on PATH).
```
npm install
node render/measure.mjs                  # VO lengths -> out/vo-durations.json
bash render/build-cast.sh                # full film -> out/ganesh-origin-60s.mp4
node render/cast.mjs --still 46          # one frame -> out/still-46.png
node render/cast.mjs --from 14 --to 15   # render a range -> out/t-*.mp4 (use --out to name it)
PORT=8301 node render/serve.mjs          # preview out/
```

## Why 5 s segments
Canvas used as a `drawImage` source leaked memory (about 3 MB per call), so a single
60 s process ran out of memory. `drawChar` now draws from `Image` sources and uses
`ctx.filter` for tint and blur. The build still renders in 5 s segments so each
process stays small.

## Status and known issue
- Full build completed: `out/ganesh-origin-60s.mp4`, 60.00 s, 1080×1920, 60 fps,
  integrated loudness −13.7 LUFS, true peak −1.0 dBFS.
- An earlier build exited with a segfault (code 139) at 14–15 s. It did not
  reproduce after the rebuild (14–15 s, and 10–15 s, rendered cleanly three times in
  a row). The cause is not confirmed. Likely suspects were the blur and rim-shadow
  filters, a filter string on Parvati or Shiva, or a sheen clip with a negative
  width, and an earlier concurrent build may have been involved. If it returns,
  run `node render/cast.mjs --from 14 --to 15` to reproduce.
- VO clips and on-screen text come from `script.json`. Check them against the
  approved script before posting.

## Rules followed
- No blood, wounds or gore. Violence is shown through shadow, light and sound only.
- The elephant head is symbolic and appears only at rebirth. Before that the boy
  has a human head.
- Two arms for every humanoid figure.
- Same face, costume and jewelry in every scene; the reborn figure keeps the same
  body, dhoti, sash and jewelry.

## QA checked on out/ganesh-origin-60s.mp4
- Format: 60.00 s, 1080×1920, 60 fps, H.264 + AAC. Loudness −13.7 LUFS, true peak −1.0 dBFS.
- Contact sheet, one frame every 2.5 s (24 frames): the boy has a human head from
  0 to 42.5 s. The symbolic elephant silhouette first appears at 45 s, inside the
  41–51 s rebirth block.
- Flash at 27.4 s: silhouette and light only, with no blood or gore.
- Captions sit between roughly 1000 and 1170 px of 1920 px height, inside the safe area.
- Not checked: every frame, a listen to the full mix, and the on-screen text against
  the approved script (only script.json was used as the source).
