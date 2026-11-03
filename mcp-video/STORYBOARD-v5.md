# MCP explainer · v5 aurora (styling pass on v4)

Picture only. Same script (`voiceover/script.v2.json`), same `voice-02` clips (`voiceover/out/v2/`), same `out/audio-master.wav`, same timings and copy as v4.

Deliverable: `deliver/mcp-explainer-v5-aurora-9x16-1080p60.mp4` (40.00 s, 1080×1920, 60 fps, −14.1 LUFS, true peak −1.7 dBTP). Poster: `deliver/poster-v5-2s.png`. Source: `film-v5.mjs`.

## What changed from v4 (styling only)
- Background: light aurora (violet → indigo → navy) with warm, mint and pink glows. No flat black.
- Surfaces: frosted glass cards (translucent fill, soft shadow, top highlight). Outline-only styling removed.
- Accents: user bubbles peach → pink gradient; "haan" button mint → teal gradient; "nahi" glass.
- Chat bubbles have tails and spring pop-in.
- Labels: step labels, suggestion label and settings subtitles raised to 22–24 px so they read on a phone.
- Tool chips in the steps scene moved below their label (fixes the overlap seen in the first stills).

## Checks
- Stills at 1.0, 3.0, 7.6, 11.5, 13.6, 17.6, 21.5, 26.5, 28.9, 32.6, 33.6, 38.0 s reviewed (`out/stills/sheet-v5a.png`, `sheet-v5b.png`).
- Audio: checksum matches the approved v2 delivery exactly.
- Seam (last frame vs frame 0): mean diff 0.59 / 255.

## Comparison set on the films page
- v3: dark, outlined, diagram cut (baseline).
- v4: chat and settings, dark style (earlier styling).
- v5: chat and settings, aurora style (current).
