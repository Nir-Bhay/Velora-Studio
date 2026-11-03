# Lessons log

Each entry: **symptom → cause → fix → rule**. Add an entry every time something breaks, so the skill gets better.
Entries marked *(verified)* were confirmed in the MCP or Samyoj work. Entries marked *(to verify)* are
lessons from planning that still need a check on the next film.

## Layout and type

**L1 · Headline too wide for the frame.** *(verified)*
Symptom: at 100 px, Inter Black "The model proposes." measured about 1056 px on a 1080 px frame.
Fix: headlines at or below about 86 px. Rule: measure every headline with `ctx.measureText` at its real
size and require `x + width ≤ W − margin` before looking at pixels.

**L2 · Labels over lines.** *(verified)*
Rule: any text placed over lines or a busy graphic gets a solid ink plate behind it (`fillRR` in ink colour).

**L3 · Chrome counter out of step with the timeline.** *(verified)*
Symptom: a "08 / 08" counter did not match the scene it sat in.
Cause: the counter was computed separately from the scene table.
Rule: anything that describes the timeline is derived from `SCENES`. Nothing computes it separately.

**L4 · Text overflowing a card or panel.** *(verified)*
Rule: `measure(text) + inset ≤ container.width`. Write a bounding-box table and assert no overlaps except intended ones (text on backplates).

**L5 · Headline off the top during a zoom.** *(to verify)*
Expected cause: a camera focus far below a headline, at a high scale, moves the headline off the top.
Rule: check the top-most and bottom-most text at the peak scale.

## Motion and camera

**M1 · Stills can mislead during a reveal.** *(verified)*
A line caught mid-mask can look clipped in a still. Check the next still before you change anything.

**M2 · Motion blur.** *(verified)*
Subframes are averaged with `globalAlpha = 1/(i+1)`; the first subframe is opaque so the background is always painted.
Cost: a `--sub 2` render takes longer than `--sub 1`. Use `--sub 1` to iterate and `--sub 2` for delivery.

## Sound

**S1 · Hits landed late.** *(verified)*
Cause: sines that start at phase 0 with a slow attack put the peak after the onset.
Fix: short attack, peak on the onset. Rule: confirm by decoding the WAV and finding the sample peak
near `onset`.

**S2 · Single-pass loudnorm missed the target.** *(verified)*
Symptom: −15.8 LUFS on a sparse, peaky mix. Cause: single-pass loudnorm rides the level.
Fix: two-pass. Measure with `print_format=json`, then apply the measured values with `linear=true`
(`render.mjs` does this).

**S3 · True peak above the ceiling after loudnorm.** *(verified)*
Fix: brickwall after the loudness stage: `alimiter=limit=0.7943:attack=5:release=60:level=disabled`
(0.7943 = −2 dBFS).

**S4 · `alimiter` made the output louder.** *(verified)*
Cause: `alimiter` levels its output by default (`level=enabled`).
Fix: `level=disabled`. Always set it.

**S5 · Read the right peak line.** *(verified)*
`ebur128=peak=true` prints both sample and true peak. Read the figure under the `True peak` heading.

## Tooling and sandbox

**T1 · No Chromium.** *(verified)*
Playwright's browser download was unavailable. Use `@napi-rs/canvas` (npm) to draw frames.

**T2 · No system fonts.** *(verified)*
`fc-list` was empty. Bundle OFL fonts (Inter and JetBrains Mono are in `mcp-video/fonts/` with their licences).

**T3 · ffmpeg.** *(verified)*
Install `imageio-ffmpeg` into a venv (not system Python, which is PEP 668-managed). Symlink the binary to
`tools/ffmpeg` and keep `tools/` out of Git.

**T4 · Blocked hosts.** *(verified)*
The sandbox can reach only GitHub, npm and PyPI. Hosted TTS APIs (ElevenLabs, Google, Azure, Hume) and
Hugging Face weights are **not** reachable. `raw.githubusercontent.com` is also unreachable.
Plan voice work with this in mind: see `VOICE-RESEARCH.md`.

**T5 · Iterate on ranges.** *(verified)*
Use `--range a b` and `--stills` to test a change. Do the full render only when the range looks right.

## Git

**G1 · Local branch behind or diverged from the remote.** *(verified)*
Fix: never force-push. Cherry-pick the new commit onto the current remote tip in a detached worktree,
then `git push origin HEAD:refs/heads/<branch>`, and remove the worktree.

**G2 · Rebase blocked by untracked files.** *(verified)*
`git rebase` onto a diverged remote failed while untracked root files were present. Use the worktree
route in G1.

## Process

**P1 · Decide on narration at the storyboard stage.** *(to verify, from the MCP film)*
A sound-first film can lose the explanation if the voice-over is not planned. Decide on narration (or on
captions only) before the render, and write the narration track with the scene timings.

**P2 · Verify every fact on screen against its source.** *(verified)*
The MCP facts (three roles, JSON-RPC 2.0, the primitives, the transports) were checked against the
protocol docs. Re-read the source before the final render and record it in the storyboard.
