# Hinglish voice-over · MCP explainer

- `script.hinglish.json` — the narration, one line per scene, with the scene window each line must fit. **Current version.**
- `script.hi-v1.json` — the first, heavier Hindi draft (kept for comparison).
- `out/clips/` — the generated clips (git-ignored). Voice: platform voice `voice-02` (masculine, Hindi, narration).
- `assemble.mjs` — fits, deepens, ducks, normalises and muxes:
  `node voiceover/assemble.mjs --pitch -1.5` (run from `mcp-video/`) → `deliver/mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4`.

Rules this follows (from the first attempt):
- Every clip must fit its window. A clip may be sped up by at most 7 % (pitch kept). Longer is rejected, so rewrite the line.
- Calibrated pace for this voice: about 2 words per second. Hindi in Devanagari, technical words in Latin.
- Pitch-down −1.5 semitones (time-preserving) makes the voice heavier. Pitch-down by more than about 2 semitones risks artifacts.
- The picture is copied, not re-rendered. The `-hinglish-vo` MP4 has the same video stream as the original (verified byte-identical).

Open:
- `end` line ("MCP. One standard plug.") is deferred: its window is 1.7 s, too short for the clip. Next: a short tag such as "MCP." (≈1 s).
- The Sarvam voice `anand_hi_documentary` (Bulbul v4-flash, the "clear, low, slow" narrator in Sarvam's catalog) is the planned A/B candidate. The sandbox cannot reach api.sarvam.ai, so run it on your machine with the key in `.secrets/voice-keys.env`.
