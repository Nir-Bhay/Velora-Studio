# Hinglish voice-over · MCP explainer

**Current:** `script.hinglish-v3.json` — eight lines, one clip per scene, each sized to its scene window. Voice: platform voice `voice-02` (masculine, Hindi narration).

Build (from `mcp-video/`):
```
node voiceover/assemble.mjs --pitch 0  --out mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4       # the voice as generated
node voiceover/assemble.mjs --pitch -1 --out mcp-explainer-40s-9x16-1080p60-hinglish-vo-deep.mp4  # one semitone deeper
```

Files:
- `script.hinglish-v3.json` — current lines, with the window each must fit.
- `out/clips-v3/` — the eight generated clips (git-ignored).
- `assemble.mjs` — fit check, pitch step, ducking, two-pass loudness, mux with `-c:v copy`.
- `script.hinglish.json`, `script.hi-v1.json` — earlier drafts. Superseded, kept for reference.

Verified:
- Each clip fits its window at natural pace. No speed-up is used.
- Pitch step: length preserved (8.04 s → 8.05 s); median pitch 136 Hz → 130 Hz (≈ −1 semitone).
- Both MP4s: 1080×1920, 60 fps, 40.0 s, AAC 48 kHz stereo. Loudness −14.1 / −14.2 LUFS, true peak −1.8 / −1.3 dBTP. The video stream is byte-identical to the original.

Known limits:
- The eight clips are one take per scene. The four "steps" in the call scene are one clip, not four, so they are not timed to each caption. Splitting them would mean four more clips.
- The "end" line is "MCP." only.
- This voice runs at its own pace (about 2.5 words a second). Lines are written to fit it; they are not stretched.
