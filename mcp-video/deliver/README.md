# How MCP works — 40-second loop, 9:16

**Current film:** `mcp-explainer-v2-loop-9x16-1080p60.mp4`
- 1080×1920 (9:16), 60 fps, 40.00 s, H.264 High + AAC 48 kHz stereo.
- Narration: Hinglish, `voice-02`, the approved voice at its natural pace (pitch 0).
- Loudness −14.1 LUFS integrated, true peak −1.7 dBTP.
- Loops with no end card. The last half-second dissolves into frame 0 and the audio fades under it.
- `poster-v2-2s.png` — the 2-second cover frame.

Scenes: problem, 48 connections (0–6 s) · one plug (6–10) · like a waiter (10–15) · four steps (15–25) · you decide, haan (25–31) · new tool (31–35) · loop (35–40).

Storyboard: `../STORYBOARD-v2.md`. Script and voice clips: `../voiceover/` (`script.v2.json`). Build: `node render.mjs` (picture) then `node voiceover/assemble.mjs --pitch 0`.

## Retired — do not present

These files are kept in git history and in this folder for reference. They are not on the films page.
- `mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4` and `-vo-deep.mp4` — the earlier Hinglish cut. The audio came from a resample bug (`asetrate` before `aresample`), so the voice was fast and nasal. The user rejected it. The "heavier, no artifacts" claim about the deep cut was never checked by ear.
- `mcp-explainer-40s-9x16-1080p60.mp4` — the English v1 film (sound design only, no narration). Its scenes are superseded by the v2 scene table, so its chapter markers no longer match `brand.mjs`.
