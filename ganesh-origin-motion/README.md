# भगवान गणेश की उत्पत्ति: V2 "motion" (60 s, 9:16)

Motion-graphics version. No images are generated for this version. Visuals are drawn
on depth layers (parallax) with chromatic aberration. Same story, VO and captions
as V1.

## Output
`out/ganesh-origin-60s.mp4`, written by `render/mix.sh` (1080×1920, 60 fps, 60.00 s,
AAC loudness-normalised to I=−14 LUFS, TP=−1.5 dBTP). `out/build.log` ends with
`BUILD_DONE`.

## Layout
```
script.json          timeline, captions, highlight words, labels (8 scenes)
audio/vo-01..08.mp3  Hindi VO, one clip per scene
fonts/               NotoSansDevanagari (SIL OFL)
render/motion.mjs    picture renderer (canvas): depth layers, parallax, chromatic aberration
render/music.mjs     original synthesised music bed
render/measure.mjs   reads VO clip lengths into out/vo-durations.json
render/mix.sh        places VO clips, mixes with music, loudness-normalises, muxes
render/serve.mjs     HTTP server for out/ with Range requests (env PORT, default 8300)
post.txt             title and hashtags for posting
```

`assets/` holds the intermediate `cut-*.png` files from the earlier character work.
They are not used by the V2 build and are not committed.

## Build
```
npm install
node render/measure.mjs            # VO lengths
node render/music.mjs              # music bed -> out/music.wav
node render/motion.mjs             # picture -> out/video.mp4
bash render/mix.sh                 # final -> out/ganesh-origin-60s.mp4
node render/motion.mjs --still 7   # one frame -> out/still-7.png
PORT=8302 node render/serve.mjs    # preview out/
```
