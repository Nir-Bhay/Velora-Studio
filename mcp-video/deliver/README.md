# How MCP works — 40-second vertical explainer

- **`mcp-explainer-40s-9x16-1080p60.mp4`** — the film. 1080×1920 (9:16), 60 fps, 40.0 s, H.264 High + AAC 48 kHz stereo, −14.8 LUFS, true peak −1 dBTP.
- `poster-2s.png` — the cover frame (the "48 custom plugs" hook).
- `contact-sheet.png` — one frame per second, the whole film at a glance.

Built to work with the sound off: every idea is on screen as a headline or caption.

Scenes: hook (0–5 s) · one protocol (5–9) · three roles (9–16) · two transports (16–19.5) · three offers (19.5–25) · the call, four steps (25–35.5) · who decides (35.5–38) · end card (38–40).

Source, research notes and the beat sheet: `../STORYBOARD.md`. Build: `node render.mjs --sub 2 --audio out/audio-master.wav` after `node audio.mjs`. Checks: `node qa.mjs`.

## Hinglish voice-over versions

- `mcp-explainer-40s-9x16-1080p60-hinglish-vo.mp4` — the Hinglish narration as generated (voice `voice-02`, natural pitch). −14.1 LUFS, true peak −1.8 dBTP.
- `mcp-explainer-40s-9x16-1080p60-hinglish-vo-deep.mp4` — the same narration, one semitone lower. −14.2 LUFS, true peak −1.3 dBTP.
- Both: the video stream is identical to `mcp-explainer-40s-9x16-1080p60.mp4`. The sound design is ducked under the voice.
- Built by `voiceover/assemble.mjs`. Script: `voiceover/script.hinglish-v3.json`.
- The original `mcp-explainer-40s-9x16-1080p60.mp4` (sound only) is unchanged.
