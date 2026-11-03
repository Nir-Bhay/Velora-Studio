# mcp-video — How MCP works (40 s, 9:16)

A vertical explainer built the way the Opus 5.5 motion-lab article describes: every frame is a pure function of time, sound is synthesized in code and lands one frame after its picture, the mix is loudness-matched to −14 LUFS. The storyboard and the research behind it are in **`STORYBOARD.md`**.

Deliverable: **`deliver/mcp-explainer-40s-9x16-1080p60.mp4`**.

## Run it

```bash
npm install                                   # @napi-rs/canvas
# ffmpeg: a static build is needed in tools/ffmpeg (or set FFMPEG=/path/to/ffmpeg)
node render.mjs --stills 2.2,12.6,30.9        # look at frames first
node audio.mjs                                # → out/audio-master.wav
node render.mjs --sub 2 --audio out/audio-master.wav   # → out/mcp-explainer.mp4
node qa.mjs                                   # checks + out/contact-sheet.png
```

## Files

| File | What it does |
| --- | --- |
| `brand.mjs` | canvas size, fps, tempo, palette, fonts, scene table, **EVENTS** (every sound, in picture time) |
| `film.mjs` | the film: `draw(ctx, t)`; camera keys; scenes; captions; chrome |
| `lib/ease.mjs` | springs (closed-form), easings, camera keyframes — pure functions |
| `lib/paint.mjs` | drawing helpers: line-mask reveals, cables, packets, icons, pills |
| `audio.mjs` | the soundtrack: palette of synthesized hits, 120 BPM bed, placed at event + 1 frame |
| `render.mjs` | canvas → raw RGBA → ffmpeg; 2-sub-frame motion blur; two-pass loudness; limiter |
| `qa.mjs` | timeline, determinism, duration, format, loudness, true peak, contact sheet |

## Sources used for the facts

- Model Context Protocol architecture overview, revision 2026-07-28 — modelcontextprotocol.io/docs/learn/architecture
- The `tools/call` example is the spec's own (`weather_current`), trimmed for the screen.
