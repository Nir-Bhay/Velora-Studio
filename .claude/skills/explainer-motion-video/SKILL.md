---
name: explainer-motion-video
description: "Use when asked to make an explainer, product or concept video (vertical social cut or landscape) rendered from code with no footage and no editor — e.g. \"explain how X works in 30–60 seconds\", a launch film, a hook-led social video, a motion-design piece built with canvas + ffmpeg. Covers the storyboard, the pure draw(t) pattern, camera, typography, the beat grid, synthesized sound with peak-accurate hits, two-pass loudness, QA, the UI preview, and voice-over. Carries every lesson from the MCP explainer and the Samyoj launch film, including the bugs that cost time."
---

# Explainer motion video (code-rendered)

This skill turns a topic into a finished MP4 by writing code: every frame is a pure function of
time, every sound is synthesized, and every check is a script. It is the successor to
`motion-launch-video` for explainers. It was distilled from building the **MCP explainer**
(40 s, 1080×1920, 60 fps) and the **Samyoj launch film**.

Read `references/LESSONS.md` before you start, and `references/BACKLOG.md` for the open gaps. Those are the bugs that cost hours.
Read `references/VOICE-RESEARCH.md` before you add narration.

## Non-negotiables

1. **Pure `draw(ctx, t)`.** No timers, no `Math.random` (use the seeded `hash`), no state carried between frames. Test it: the same `t` must produce identical bytes (`qa.mjs` checks this).
2. **Facts before frames.** Write the script from the primary source (the spec, the docs, the product page), then check each claim against it. Quote exact field names and example JSON when the audience is technical. Trim, but never invent. Keep a source list in the storyboard.
3. **Hook in the first second.** Start on a specific number, a surprising claim, or a moving image. Most viewers watch muted, so the first 1–3 s must carry the idea on screen as text.
4. **The sound lands one frame *after* its picture.** `event + 1/60 s`. A sound early by a frame feels wrong; one frame late reads as on the beat.
5. **Every scene cut lands on the beat grid.** 120 BPM = 0.5 s. Boundaries are multiples of the beat. QA asserts it.
6. **One hero move per scene.** Secondary moves are 50–70 % of the hero's travel and start 100–200 ms later. Ambient motion stays under 5 % of the hero's travel.
7. **Ban the defaults**: purple/blue gradients, glow orbs, lens flares, floating particles, centred-everything layouts, fade-and-slide on every element. Use flat ink backgrounds, one accent per meaning, and structural grids.
8. **Captions are mandatory.** The film has to work on mute. Captions are screen-space, never inside the camera transform, so they never move or clip.
9. **Loudness is measured, not guessed.** Two-pass `loudnorm` to −14 LUFS, then a limiter with `level=disabled` at −2 dBFS. Verify with `ebur128=peak=true`.
10. **Check the MP4, not the source.** Decode the finished file, sample frames, and read the contact sheet.

## The pipeline (copy from `templates/`)

```
brand.mjs     size, fps, tempo, palette, fonts, SCENES, EVENTS (every sound, in picture time)
film.mjs      draw(ctx,t): camera → scenes (world space) → captions → chrome (screen space)
lib/ease.mjs  springs (closed-form), easings, camera keyframes — pure
lib/paint.mjs rounded rects, text with tracking, line-mask reveals, cables, packets, icons, pills
audio.mjs     synth palette + bed; each hit placed at EVENTS[t] + 1/60 s; writes WAV
render.mjs    --stills / --range / --sub N / --audio → raw RGBA into ffmpeg; two-pass loudness
qa.mjs        timeline, determinism, format, loudness, true peak, contact sheet
```

Commands (in the project folder, with `tools/ffmpeg` or `FFMPEG=`):

```bash
npm install                                             # @napi-rs/canvas only
node render.mjs --stills 2,12.6,30.9 --sub 2            # look at frames FIRST
node render.mjs --range 0 6 --sub 1                     # cheap test of a changed span
node audio.mjs                                          # → out/audio-master.wav
node render.mjs --sub 2 --audio out/audio-master.wav    # → out/<name>.mp4 (≈70 s for 40 s)
node qa.mjs                                             # checks + out/contact-sheet.png
```

## Process (in order)

1. **Brief.** Write a storyboard: format, length, hook, the story in one sentence, the scene list with
   times, the hero move per scene, and the sound per scene. Save it as `STORYBOARD.md`
   (see `references/example-storyboard-mcp.md`). Put the facts and their sources in it.
2. **Palette and type.** Ink background, paper text, one accent per semantic role (requests, responses,
   server, etc.). Inter Black for headlines, JetBrains Mono for code and labels. Bundle the OFL fonts.
3. **Layout by budget, not by feel.** For 1080×1920: headline zone y 300–520; visual zone 560–1420;
   captions 1470–1600; chrome at the top (y≈120) and bottom (y≈1840–1870). Anything in the top
   ~200 px or bottom ~300 px can be hidden by the app's UI.
4. **Measure every text box.** `ctx.measureText` at the real size. Headlines must fit inside
   (1080 − 2×72) px. Inter Black is wide: at 100 px "The model proposes." measures about 1056 px, so it
   overflows. Keep headlines at or below about 86 px. Card text must fit its card. Check with a script before you look at pixels.
5. **Build scene by scene.** Write each scene as a function of local time. Make headlines enter with a
   line-mask reveal (`maskLine`) and leave short and early, so the next scene's text never overlaps.
6. **Stills, then fix, then full render.** Render stills at each scene's hero moment and at each
   transition. View them. Fix. Only then do the full render.
7. **Sound.** Write the events list in `brand.mjs` (every sound, in picture time) before the synth.
   Synth each kind once, so it sounds consistent. Peaks sit on the onset.
8. **Mux and loudness.** Two-pass loudnorm, then `alimiter=limit=0.7943:attack=5:release=60:level=disabled`.
9. **QA.** `node qa.mjs`. Every check must pass. Read the contact sheet and fix anything that reads wrong.
10. **Deliver.** Copy the MP4, the contact sheet, a poster still, and a README to `deliver/`. Commit that
    folder (the workspace resets exclude `out/`, `dist/`, `build/`, `node_modules/`). Add a manifest
    entry for the UI preview (see below).

## Camera

- Keep a focus point at the screen centre: `translate(W/2,H/2) · scale(s) · translate(−fx,−fy)`.
- Keyframes are `[t, scale, fx, fy]`, eased per segment (`keyed` in `lib/ease.mjs`). Never jump; keep every
  segment long enough to read as a move (≈0.6 s or more).
- **Keep headlines on screen while zoomed.** A focus point far below a headline, at a high scale, can push
  the headline off the top of the frame. Check the peak scale for the top-most and bottom-most text.
  Move the focus, or keep headlines in screen space.
- Scale at most about 1.2 for text-heavy frames.

## Motion grammar that worked

- Reveals: closed-form spring `spring(t, zeta, f)` in `lib/ease.mjs`; defaults ζ 0.85, f 2.4 Hz (ζ 1 = no bounce).
- Entrances: line-mask (`maskLine`: text rises inside a clip), wipes (`wipeRect`), pops (scale 0.85→1).
- Exits: short and early, 0.2 s, so the next scene's content never overlaps the old one.
- Data: packets travel along cubic cables at constant speed. Requests amber, responses teal.
- Typing: JSON typed at 60 chars/s, one line after another, each line 0.2 s after the last. Blocks swap with a 0.12 s exit.
- Counts: an odometer-style count (0→48, then 48→16) with `outCubic` or `outExpo` from `lib/ease.mjs`.

## Sound

- Palette: `slam` (low thump + noise), `thock`, `tick`, `type`, `pop`, `bloop` (rising sine), `snap`,
  `chime` (two partials), `whoosh` (one-pole low-pass noise sweep, rendered as its own buffer).
- Peak on the onset. Use a short (≈1 ms) attack. A sine that starts at phase 0 with a slow rise puts its peak late.
- Bed: a quiet pulse per beat, then a bed that enters later in the film. Keep the bed below the hits.
- DC-remove each channel and guard the peak before writing 16-bit PCM.

## Voice-over (if the film needs narration)

Narration is the biggest gap in a sound-first film. A human voice carries the emotion and the explanation.
Options, prices and trade-offs are in `references/VOICE-RESEARCH.md` (researched Nov 2026; prices change, so re-check before buying). Short version:

- Sandbox limits: only GitHub, npm and PyPI are reachable. Hosted TTS APIs (ElevenLabs, Google,
  Azure, Hume) and Hugging Face model weights are **blocked here**. Run hosted APIs on the user's machine, or
  use the platform's own `add_voice` / `generate_speech` tools inside the session.
- Write narration as its own timed track. Place each line in its scene window with `adelay`. Mix it above the
  music with ducking (`sidechaincompress`). Use `asplit` when one voice feeds two chains.
- Keep one voice per film. Never change voices mid-scene.

## UI preview

The user previews films in the app's UI. `films.html` at the repo root reads `films-manifest.json`
(`templates/serve-films.mjs` is the server, and `templates/build-films-manifest.mjs` writes the manifest. Edit the manifest script's film list for each new film). Each entry has `src`, `poster`, `aspect`, `chapters`, and `specs`.
Serve the repo root with `serve-films.mjs`, which supports range requests (for seeking) and blocks
dotfiles, `.git` and `node_modules`.

## Git hygiene

- Commit deliverables under `<project>/deliver/`. Check the repo `.gitignore` so deliver folders aren't ignored by accident.
- If the remote branch is ahead, never force-push. Cherry-pick into a detached worktree and push `HEAD:refs/heads/<branch>`, or use `git rebase --autostash`.
- Only stage the folder you changed. Leave unrelated modified or untracked files alone.

## Done means

- `qa.mjs` passes every check.
- The MP4 decodes, plays from the UI with seeking, and the contact sheet reads in order.
- Captions carry the whole meaning on mute.
- The storyboard lists every fact with its source.
- The deliver folder and manifest are updated, committed and pushed to the session branch.
