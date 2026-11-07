# Final audit: DeepMind RSA-1024 60 s vertical film (revision 2 + audit fixes)

Checked against the actual exported file `deepmind-rsa-60s.mp4` unless marked otherwise.

## Technical (ffmpeg on the final MP4)
- Duration 60.00 s, 1,800 frames (`-map 0:v -c copy -f null`), 30 fps, 1080 × 1920, H.264 High, yuv420p, progressive.
- Audio: AAC LC, 48 kHz, stereo.
- Loudness (ebur128): integrated −14.0 LUFS. True peak −1.5 dBFS (limit −1 dBTP). LRA 2.6 LU.

## Visual QA (frames extracted from the final MP4)
- Contact sheets at 0.5–58.5 s, and at every scene cut (4.6, 11.2, 22.8, 30.6, 41.8, 49.7, 56.6 s).
- Checked: hook, announcement, signature grid, 1,600× bars, fan-factory bars, 3.5× racing bars, RSA-1024 ≠ RSA-2048+ split, closing lock.

## Corrected in this audit
1. **Dip at every scene cut.** Scenes were cross-faded, so the incoming scene's elements were still hidden and the frame went almost empty (seen at 49.4–49.6 s). Fixed: hard cuts with a white flash (±0.12 s) in `film/frame.mjs`. Verified at 49.6 and at all seven cuts.
2. **Scene 7 divider** crossed the NIST citation text. Line now ends at y 1150. Verified at 54 s.
3. **Scene 5 layout** (final state, 36–41 s): the projection line overlapped the bar labels and the caption box. Bars moved up, text moved to y 1200/1256. Verified at 41.7 s.
4. **Prepare step silently swallowed ffmpeg errors** (the reason the first rebuild had no clear error). Transform steps now throw on failure (`ffRun`).
5. **README** described the old cross-fade. Updated.

## Re-rendered
- Full MP4 rebuilt three times with the code above. The final build is the one in the deliverable (exit 0).
- Thumbnail re-rendered from the current code.

## Research and copy checks (against the approved script in `render/script.mjs`)
- Captions match the narration text (38 caption blocks, `deepmind-rsa-captions.srt`).
- Claims on screen: 1,600× is labelled theoretical and "not run at this key size". 3.5× is labelled a measured reproduction, not the 1,600× result. The paper's hardware caveat is shown. RSA-2048+ is "not threatened". The film does not say that a bank, a messaging app or the internet was broken.
- The 30× claim is labelled "projected, not implemented". It is shown as a per-key cost, not as a claim about one target.

## Remaining limitations (not fixed)
- **Caption timing is estimated**, not forced-aligned. `render/prepare.mjs` spreads word times across each clip. Expect up to about 0.2 s of drift on some lines.
- **Narration is time-stretched 1.25×** (`atempo`, pitch kept). This is disclosed here. The voice sounds faster than the original recording.
- **Scene starts are briefly sparse.** Each scene's elements build in over about 0.1–0.3 s after the cut, so the first frame of a scene can be mostly background (seen at 4.7 s and 11.3 s). Not a black frame, but a designer may want the first frame populated.
- **Scene 7 opens on empty background** for about 0.3 s before the locks appear.
- **Thumbnail:** the crack line crosses the RSA-1024 text on the lock. Minor.
- **No sub-frame motion blur.** Frames are rendered at 30 fps without blur.
- **Music** is an original synthesised bed from `render/music.mjs`. No licensed track and no separate sound-effect library.
- **Forensic 17-shot video** (`deepmind-rsa-forensic-60s/`) is not built. It is blocked on the narration-length decision (script ~81 s vs 60 s).
