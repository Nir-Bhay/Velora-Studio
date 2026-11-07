#!/usr/bin/env bash
# Builds the whole film from source.
#   1. prepare.mjs : trims and time-stretches the narration, writes out/timing.json and out/captions.srt
#   2. music.mjs   : synthesises the music bed and SFX into out/music.wav
#   3. mix.sh      : places the narration, ducks the music, loudness-normalises into out/mix.wav
#   4. render.mjs  : renders 15 four-second video segments in parallel (out/seg/)
#   5. concat + mux: joins the segments and the audio into deepmind-rsa-60s.mp4, copies the SRT
#   6. QA          : prints the stream layout and duration from ffmpeg -i
# Usage: FFMPEG=/path/to/ffmpeg bash render/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}
JOBS=${JOBS:-4}
SEGMENTS=15  # 60 s / 4 s

echo "== prepare"; node render/prepare.mjs
echo "== music";   node render/music.mjs
echo "== mix";     FFMPEG="$FF" bash render/mix.sh

echo "== render ($SEGMENTS segments, $JOBS at a time)"
rm -rf out/seg && mkdir -p out/seg
seq 0 $((SEGMENTS - 1)) | xargs -P "$JOBS" -I{} env FFMPEG="$FF" node render/render.mjs --segment {}

echo "== concat + mux"
: > out/seg/list.txt
for i in $(seq -w 0 $((SEGMENTS - 1))); do echo "file 'seg-$i.mp4'" >> out/seg/list.txt; done
"$FF" -y -hide_banner -loglevel error -f concat -safe 0 -i out/seg/list.txt -i out/mix.wav \
  -map 0:v -map 1:a -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t 60 -movflags +faststart deepmind-rsa-60s.mp4
cp out/captions.srt deepmind-rsa-captions.srt

echo "== QA"
# The bundled imageio-ffmpeg binary has no ffprobe, so the stream info comes from ffmpeg -i.
"$FF" -hide_banner -i deepmind-rsa-60s.mp4 2>&1 | grep -E "Duration|Stream" || true
echo "DONE: deepmind-rsa-60s.mp4"
