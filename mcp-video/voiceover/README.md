# Hinglish voice-over · MCP explainer (v2)

**Current:** `script.v2.json`. Seven lines, one clip per scene, each sized to its scene window. Voice: platform voice `voice-02` (masculine, Hindi/Hinglish narration).

The problem line (`s2-problem.wav`) is generated but not used. Its idea is on screen as a caption, so the narration stays short.

## Build (from `mcp-video/`)

```
node render.mjs                         # picture only → out/mcp-explainer-v2.mp4 (and out/picture-v2.mp4)
node voiceover/assemble.mjs --pitch 0   # → deliver/mcp-explainer-v2-loop-9x16-1080p60.mp4
```

Run `node audio.mjs` first if the sound design changed (it writes `out/audio-master.wav`, which the assembler ducks under the voice).

## Files

- `script.v2.json` — the lines, their clip files, and their windows.
- `out/v2/` — the eight generated clips (git-ignored).
- `assemble.mjs` — fit check (clip ≤ window, no speed-up), resample to 48 kHz, optional pitch, ducking, two-pass loudness, mux with `-c:v copy`.
- Earlier scripts (`script.hinglish*.json`, `script.hi-v1.json`) are superseded. Do not use them.

## Pitch and resampling

- `--pitch 0` is the voice as generated. This is the approved cut.
- A non-zero pitch goes through `aresample=48000` **first**, then `asetrate`, `aresample`, `atempo=1/f`. Applying `asetrate` to the 24 kHz clip without resampling first made the voice 1.8× too fast and nasal. That was the cause of the rejected release.
- Before any pitch change is delivered, check it: length unchanged (±1 frame) and median F0 down by the expected ratio.

## Verified for v2

- Each clip fits its window at natural pace. No speed-up.
- Output: 1080×1920, 60 fps, 40.00 s. Video stream copied from the picture render.
- Loudness −14.1 LUFS, true peak −1.7 dBTP.

## Open

- The voice has not been compared against the approved preview by ear after this build. Listen before calling it final.
- Four clips in the steps scene are one line. Each card is timed to the spoken step boundary, not to a separate clip.
