# How MCP works — 40-second loop, 9:16

**Current film:** `mcp-explainer-v3-loop-9x16-1080p60.mp4` (v3: same narration and sound as v2, with a clearer picture)
- 1080×1920 (9:16), 60 fps, 40.00 s, H.264 High + AAC 48 kHz stereo.
- Narration: Hinglish, `voice-02`, the approved voice at its natural pace (pitch 0).
- Loudness −14.1 LUFS integrated, true peak −1.7 dBTP.
- Loops with no end card. The last half-second dissolves into frame 0 and the audio fades under it.
- `poster-v3-2s.png` — the 2-second cover frame.

## Compare: two versions of the same film

Same narration, same sound, same timing. Only the picture differs.

- `mcp-explainer-v3-loop-9x16-1080p60.mp4` — v3, diagram style (apps, tools, a plug; a waiter diagram; cards).
- `mcp-explainer-v4-chat-9x16-1080p60.mp4` — v4, app style (apps morph into one plug; chat messages for the waiter and steps; a settings toggle for the new tool). Storyboard: `../STORYBOARD-v4.md`. Poster: `poster-v4-2s.png`.

Both are on the films page. Both have −14.1 LUFS, true peak −1.7 dBTP, and a seamless loop.

## Previous version

- `mcp-explainer-v2-loop-9x16-1080p60.mp4` — v2, the approved narration with the first picture. Kept for comparison; not on the films page.

Scenes: problem, 48 connections (0–6 s) · one plug (6–10) · like a waiter (10–15) · four steps (15–25) · you decide, haan (25–31) · new tool (31–35) · loop (35–40).

Storyboard: `../STORYBOARD-v2.md`. Script and voice clips: `../voiceover/` (`script.v2.json`). Build: `node render.mjs` (picture) then `node voiceover/assemble.mjs --pitch 0 --out mcp-explainer-v3-loop-9x16-1080p60.mp4`.

## Retired — do not present

These files are kept in git history and in this folder for reference. They are not on the films page.
- `mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4` and `-vo-deep.mp4` — the earlier Hinglish cut. The audio came from a resample bug (`asetrate` before `aresample`), so the voice was fast and nasal. The user rejected it. The "heavier, no artifacts" claim about the deep cut was never checked by ear.
- `mcp-explainer-40s-9x16-1080p60.mp4` — the English v1 film (sound design only, no narration). Its scenes are superseded by the v2 scene table, so its chapter markers no longer match `brand.mjs`.

## v5 · aurora (current styling pass)

- `mcp-explainer-v5-aurora-9x16-1080p60.mp4`: same picture layout as v4, new light aurora styling with glass cards and gradient accents. Same audio as v2. 40.00 s, −14.1 LUFS, true peak −1.7 dBTP. Source `film-v5.mjs`, storyboard `STORYBOARD-v5.md`.
- `poster-v5-2s.png`: poster at 2 s.
