#!/usr/bin/env bash
# Muxes the rendered picture, the ducked music bed, and the 8 VO clips into the final MP4.
# Loudness target: -14 LUFS integrated, -1.5 dBTP true peak. Length is exactly 60 s.
set -euo pipefail
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}

# Inputs: 0 = video, 1 = music bed, 2..9 = VO 1..8.
ARGS=(-i out/video.mp4 -i out/music.wav)
FILTER="[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[m];"
MIX="[m]"
for i in 1 2 3 4 5 6 7 8; do
  ARGS+=(-i "audio/vo-0$i.mp3")
  MS=$(node -e "const s=require('./script.json');const sc=s.scenes[$i-1];console.log(Math.round((sc.start+sc.voStart)*1000))")
  FILTER+="[$((i+1)):a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=${MS}|${MS}[v$i];"
  MIX+="[v$i]"
done
FILTER+="${MIX}amix=inputs=9:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11,atrim=0:60,asetpts=N/SR/TB[a]"

"$FF" -y -hide_banner -loglevel error "${ARGS[@]}" \
  -filter_complex "$FILTER" \
  -map 0:v:0 -map "[a]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -t 60 \
  -movflags +faststart out/ganesh-origin-60s.mp4
echo "wrote out/ganesh-origin-60s.mp4"
