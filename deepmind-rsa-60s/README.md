# DeepMind RSA: 60-second vertical video

A 60-second, 1080×1920 explainer on DeepMind's November 2026 RSA results, in eight scenes.
Working title: **AI JUST MADE AN OLD DIGITAL LOCK EASIER TO ATTACK**.

Final outputs (in this folder):

- `deepmind-rsa-60s.mp4`: H.264 yuv420p, 1080×1920, 30 fps, 1800 frames, AAC 48 kHz stereo, exactly 60.00 s.
- `deepmind-rsa-thumbnail.png`: 1080×1920 still for the thumbnail.
- `deepmind-rsa-captions.srt`: burned-in caption timing, synced to the narration.
- `research-notes.md`: every figure, its source, and whether it is measured or theoretical.

## Build

Requirements: Node 22+, npm, and an ffmpeg binary (set `FFMPEG` to its path).

```bash
npm install
FFMPEG=/path/to/ffmpeg bash render/build.sh   # full build -> deepmind-rsa-60s.mp4
FFMPEG=/path/to/ffmpeg node render/thumbnail.mjs
```

`build.sh` runs these steps in order:

1. `render/prepare.mjs`: trims silence from each narration clip, applies `atempo=1.25` (`TEMPO` in
   `render/script.mjs`), lays out the eight scenes from the narration, and writes `out/timing.json` and `out/captions.srt`.
2. `render/music.mjs`: synthesises the music bed and sound effects into `out/music.wav`.
3. `render/mix.sh`: places each narration clip, ducks the music under the narration with sidechain compression,
   and loudness-normalises the mix to −14 LUFS (−1.5 dBTP).
4. `render/render.mjs`: renders 15 four-second segments in parallel (`out/seg/`). Frames are piped to ffmpeg as raw RGBA.
5. Concat and mux into `deepmind-rsa-60s.mp4`, then copy the SRT.

## Source layout

| Path | Purpose |
|---|---|
| `render/script.mjs` | Scene text, on-screen text, highlights, and the global settings (FPS, size, length, tempo). Edit content here. |
| `render/prepare.mjs` | Narration timing, caption blocks, SRT. |
| `render/music.mjs` | Original procedural music and SFX. No samples. |
| `render/mix.sh` | Narration + music mix and loudness. |
| `render/scenes.mjs` | Scene drawing functions, lock, background, captions, fonts. |
| `render/render.mjs` | Frame loop, scene cross-fades, ffmpeg pipe, stills (`--still <s>`). |
| `render/build.sh` | Full pipeline. |
| `render/thumbnail.mjs` | Thumbnail. |
| `audio/vo-01..08.mp3` | Narration clips (one per scene), generated with the registered voice. |
| `package.json` | Dependencies: `@napi-rs/canvas`, `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono` (both SIL OFL). |

Generated files (`out/`, `node_modules/`) are not committed. Rebuild them with the steps above.

## Palette and type

- Background `#101725` with a deep navy gradient. Cyan `#36C5F0`, amber `#F3A64A`, soft white `#E8EDF5`.
- Inter Black for headline numbers, Inter Bold for supporting text, JetBrains Mono for labels and on-screen text.
- Scene content stays between y = 300 and y = 1300. Captions sit around y = 1430.

## Accuracy

The film follows `research-notes.md`. The 1,600× and 30× are labelled as theoretical estimates. The 3.5× is labelled
as a measured reproduction with the hardware caveat on screen. RSA-2048+ is stated as not threatened. The film does
not claim that the internet, banks or TLS were broken.
