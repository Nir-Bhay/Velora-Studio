#!/usr/bin/env bash
# Mixes the narration clips over the music bed and loudness-normalises the result.
#   inputs : out/music.wav (music + SFX), out/vo-fast-01..08.wav (narration, placed at each scene's voStart)
#   steps  : place each clip with adelay, sum the narration, duck the music under it (sidechaincompress),
#            add the narration back on top, then loudnorm to -14 LUFS / -1.5 dBTP.
#   output : out/mix.wav (48 kHz stereo PCM, exactly TOTAL seconds)
# Usage: FFMPEG=/path/to/ffmpeg bash render/mix.sh
set -euo pipefail
cd "$(dirname "$0")/.."
FF=${FFMPEG:-ffmpeg}

# Start time of each narration clip in milliseconds, from out/timing.json.
readarray -t STARTS < <(node -e '
  const t = JSON.parse(require("fs").readFileSync("out/timing.json", "utf8"));
  for (const s of t.scenes) console.log(Math.round(s.voStart * 1000));
')
TOTAL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("out/timing.json","utf8")).total)')

ARGS=(-y -hide_banner -loglevel error -i out/music.wav)
for i in $(seq -w 1 8); do ARGS+=(-i "out/vo-fast-0${i}.wav"); done

FILTER=""
VOIN=""
for k in $(seq 0 7); do
  ms=${STARTS[$k]}
  FILTER+="[$((k+1)):a]adelay=${ms}|${ms},volume=1.0[v$k];"
  VOIN+="[v$k]"
done
FILTER+="${VOIN}amix=inputs=8:normalize=0:duration=longest[vo];"
FILTER+="[vo]asplit=2[vosc][vomix];"
# Music is ducked by about 9 dB while the narration speaks. Attack and release keep the duck smooth.
FILTER+="[0:a][vosc]sidechaincompress=threshold=0.03:ratio=3.5:attack=15:release=320[duck];"
FILTER+="[duck][vomix]amix=inputs=2:normalize=0:weights=0.8 1.2[mix];"
FILTER+="[mix]loudnorm=I=-14:TP=-1.5:LRA=11,atrim=0:${TOTAL},asetpts=N/SR/TB[a]"

"$FF" "${ARGS[@]}" -filter_complex "$FILTER" -map "[a]" -ar 48000 -ac 2 out/mix.wav
echo "wrote out/mix.wav"
