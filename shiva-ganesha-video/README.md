# shiva-ganesha-video — the story in 60 seconds

A story film with its own design system: cut-paper cards, kinetic headlines, word-by-word captions,
a responsive layout, and a ring-wipe between scenes. Picture from code (canvas + ffmpeg), sound
synthesized in code, Hinglish narration from voice-03.

Deliverables (in `deliver/`):
- `shiva-ganesha-9x16-1080p60.mp4` — the main cut, 60.00 s, 1080×1920, 60 fps, −14 LUFS.
- `shiva-ganesha-1x1-1080p60.mp4` — square cut from the same layout code.
- `shiva-ganesha-16x9-1080p60.mp4` — landscape cut from the same layout code.
- `poster-2s.png` — the main cut at 2 s.

Pipeline:
```
brand.mjs     format, palette, scenes, narration windows, sound events
story.mjs     draw(ctx, t): layout(W,H) → scenes → headline → captions → chrome
lib/paint.mjs cut-paper surfaces, glass accent, glyphs, text fitting
lib/ease.mjs  springs, easings, stepped holds, seeded hash (no Math.random)
audio.mjs     synthesized drone and hits → out/music-master.wav
render.mjs    frames → ffmpeg (ASPECT=9x16|1x1|16x9)
assemble.mjs  narration fit check, clip levels, mix, two-pass loudness, mux
voice/        out/voice/*.wav are the narration clips (git-ignored)
```

Commands:
```
node render.mjs --stills 2,8.8,26.4 --sub 1   # look at frames first
node render.mjs --sub 2                        # full picture
node audio.mjs                                 # sound bed
node assemble.mjs --picture out/picture-only-9x16.mp4 --out deliver/shiva-ganesha-9x16-1080p60.mp4
ASPECT=1x1 node render.mjs --sub 1 --out picture-only-1x1.mp4
```

Storyboard and sources: `STORYBOARD.md`.
