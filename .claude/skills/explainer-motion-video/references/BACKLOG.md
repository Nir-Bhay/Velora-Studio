# Backlog — what to improve next

The skill is meant to get better with each film. Add to this list when you find a gap, and move an item to
`LESSONS.md` when it's fixed and verified. Put the film it came from in brackets.

## Open gaps

1. **Voice-over doesn't carry the picture's emotion.** [MCP explainer] The film is sound-first. The narration
   has not been rendered, and when it is, its delivery must match each scene (curious on the hook, decisive on
   the call, dry on the error). Next step: pick a voice (see `VOICE-RESEARCH.md`), write a per-scene emotion
   note, render one 10-second test, and listen before the full render.
2. **Narration is not in the MP4 yet.** [MCP explainer] Mix it with `adelay` and `sidechaincompress` per
   `SKILL.md`, then re-run the two-pass loudness and QA.
3. **Caption and voice timing check.** Add a QA check that every caption's start and end fall inside its scene,
   and that each narration line finishes before its scene ends.
4. **Mobile preview.** [UI] Check the films page on a phone-width viewport. It is responsive by CSS, but it hasn't been viewed on a device.
5. **Samyoj chapter labels** are set in `build-films-manifest.mjs`. Keep them in step with `SHOT-LIST.md`.

## Ideas to test

- A 5-second "hook test" check: state the idea in on-screen text within the first second, and verify with a still.
- Automatic contrast check of captions against the background.
- Measure caption reading speed (words per second) and flag lines that are too dense.
