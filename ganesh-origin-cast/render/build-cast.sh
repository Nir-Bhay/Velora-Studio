#!/usr/bin/env bash
# Renders the picture in 5 s segments (bounded memory per process), joins them, then muxes audio.
set -euo pipefail
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}
node render/music.mjs
: > out/segs.txt
for s in $(seq 0 11); do
  FROM=$((s*5)); TO=$((s*5+5))
  node render/cast.mjs --from $FROM --to $TO --out seg-$s.mp4
  echo "file 'seg-$s.mp4'" >> out/segs.txt
  echo "segment $s done"
done
"$FF" -y -hide_banner -loglevel error -f concat -safe 0 -i out/segs.txt -c copy out/video.mp4
bash render/mix.sh
echo BUILD_DONE
