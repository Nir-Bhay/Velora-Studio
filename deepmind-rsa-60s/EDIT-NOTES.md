# DeepMind RSA 60 s: edit notes for review

This file is for frame-level and clip-level feedback in Remotion Studio. Write your comments under the item numbers (for example, "C3: move the 3.5× slam 0.2 s earlier"). Ideas are suggestions only. Nothing here has been applied to the film yet, except where marked "done".

## 1. Open the editor

```bash
cd deepmind-rsa-60s
npm install
bash render/build.sh          # builds out/timing.json and out/mix.wav, and renders the mp4
npm run studio                # Remotion Studio on port 3000
```

If you only changed the Remotion side, `npm run remotion:sync` copies the narration mix into `remotion/public/audio/`. The Studio needs that file for playback.

- Composition: `DeepMindRSA60s` (1080×1920, 30 fps, 1800 frames, 60 s).
- Timeline: each scene is a labelled `Sequence` (for example `S6 real-computation 41.81–49.67s`). Use them to jump between scenes.
- The picture is drawn by the same code as the mp4 render (`film/frame.mjs` and `film/scenes.mjs`). If a frame looks different in the Studio and in the mp4, that is a bug to report.

## 2. Scene timings

Times are from `out/timing.json`, in seconds.

| # | Name | Start (s) | End (s) | Length (s) | Brief window |
|---|------|-----------|---------|-----------|--------------|
| S1 | hook | 0.00 | 4.63 | 4.63 | 00:00–05 |
| S2 | announcement | 4.63 | 11.17 | 6.53 | 05–10 |
| S3 | signature | 11.17 | 22.79 | 11.62 | 10–22 |
| S4 | theoretical-1600 | 22.79 | 30.55 | 7.76 | 22–30 |
| S5 | fan-factories | 30.55 | 41.81 | 11.26 | 30–42 |
| S6 | real-computation | 41.81 | 49.68 | 7.86 | 42–50 |
| S7 | reality-check | 49.68 | 56.62 | 6.94 | 50–56 |
| S8 | closing | 56.62 | 60.00 | 3.38 | 56–60 |

Narration: 8 clips, `audio/vo-01..08.mp3`, voice-05. The speech was time-stretched with `atempo=1.25` to fit the windows. It is disclosed here as a time-stretch. Narration after trim: 71.22 s.

Captions: 38 burned-in caption entries, also written to `deepmind-rsa-captions.srt`.

## 3. Review checklist

Please check these in the Studio, frame by frame where needed.

- [ ] **Hook (0–1 s):** does the first second stop a scroll? Is the versus clear?
- [ ] **Safe areas:** all critical text inside the centre, and no caption box covering a number.
- [ ] **Max two caption lines** on every caption entry.
- [ ] **Exact on-screen text:** each line matches the brief's `onScreen` strings. Check the S6 caveat line: "COMPARISON USES COSTS REPORTED ON OTHER HARDWARE" and "PAPER: AT MOST ~1.5× (SIEVE) AND ~1.2× (2ND TIER) FROM HARDWARE".
- [ ] **Facts framing:** 1,600× is labelled theoretical. 30× is labelled theoretical and not implemented. 3.5× is labelled as a measured reproduction on an already-solved key. The internet and banks are not said to be broken.
- [ ] **Audio sync:** each VO line starts on or near its scene cue.
- [ ] **Brightness:** the royal-blue base is bright enough on a phone screen.
- [ ] **Ending (S8):** the closing line lands and the fade to navy at 59.4–60 s is clean.

## 4. Known issues (not yet fixed)

- **Dip at the S6 → S7 cut (about 49.3–49.7 s).** The cross-fade is correct, but the incoming scene's elements start at local time 0. During the fade they are still hidden, so the frame goes almost empty before S7 appears. Cause: `film/frame.mjs` cross-fades into the next scene at its negative local time, and element timers return 0 there. Options, for you to pick:
  - (a) a short white flash cut at 49.67 s (recommended, the cut matches the "reality check" beat),
  - (b) start the S7 elements earlier inside a pre-roll,
  - (c) keep the cross-fade but make it 0.15 s.
- **Remotion browser preview not verified headlessly.** The sandbox could not download the Chrome build that Remotion needs (`remotion.media` is blocked). The Studio compiled and serves HTTP 200, but the first real check is in your browser. Please report any blank or missing frame by its timeline position.
- **Thumbnail** (`deepmind-rsa-thumbnail.png`) is rebuilt from the same scene code. Please check it against the bright palette.
- **Final mp4 is not tracked by git.** The repo's `.gitignore` ignores `*.mp4`, as it did before this work. The mp4 is in the workspace. Tell me if you want it committed or stored elsewhere.

## 5. Polish ideas (for your review)

- P1. Tighten the hook: if there is any silence before the first VO word, trim it, and start the versus wipe on the first syllable.
- P2. Use a consistent kinetic rhythm: one hit per beat of the music bed. Snap key words to the nearest beat.
- P3. Make the 3.5× number the biggest element in S6 for at least 1.5 s before the caveat lines appear.
- P4. Add a reading pause of 0.5 s after each caveat line, so the caveats are readable on a phone.
- P5. Use a single thin progress bar style everywhere (currently top edge, cyan).
- P6. The caption box is always navy right now. Consider a lighter box, or no box, on scenes where the big number is the focus (S6).

## 6. Clip ideas (for your review)

- C1. Split S3 into two clips at about 16 s, so the signature forgery and the 32-byte digest each get their own beat.
- C2. Add a short "versus" bar intro (0.6 s) before S4, to restate the fight theme.
- C3. Move the 3.5× slam 0.2 s earlier in S6, to land on the word "less".
- C4. Shorten S5 by about 1 s, if the precomputation card reads faster than the VO.
- C5. Add a 1-second end card with the research note name, after S8. This would extend the film past 60 s, so it needs a decision on the length limit.

## 7. Effect ideas (for your review)

- E1. Chromatic aberration on the lock crack moment (S3 and S7). Motion only, no gore.
- E2. Radial speed-line burst on each scene cut, in amber for the theoretical claims and cyan for the measured ones.
- E3. A slow zoom on the lock icon during the closing line.
- E4. Halftone texture in the bright backgrounds, at low opacity.
- E5. Grain: a light grain is already on. Let me know if it is too strong on a phone screen.

## 8. Sound (original or licensed only)

- The music bed and SFX are generated by `render/music.mjs` (original synthesis). Note any change you want to the bed or to the hits.

## 9. How to send feedback

Write the item number, the timeline time (seconds, or frames at 30 fps), and the change you want. Example: "S6 at 43.2 s: the caveat line is too small, make it 26 px."
