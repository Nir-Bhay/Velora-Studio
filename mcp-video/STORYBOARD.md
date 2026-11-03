# How MCP works — 40-second vertical explainer

Format: **1080×1920 (9:16)**, **60 fps**, **40.0 s**, **120 BPM** (1 beat = 0.5 s, 80 beats).
Target: Reels / Shorts / TikTok / X vertical. Works muted: every idea is on screen as text.

---

## 1 · What the research said (and how it became rules)

Sources and the rule each one produced.

| Source | What it says | Rule in this film |
| --- | --- | --- |
| The X article "Opus 5.5 Motion Lab" (Florence) | Every frame is a pure function of `t`; directed prompts with numbers; 120 BPM beat grid; 60 fps with subframe motion blur; sound peaks **one frame after** each picture; mix to −14 LUFS, peaks at −1 dBTP; a 1-frame early hit is the usual sync error; vertical is 1080×1920 | `draw(ctx, t)` has no state; `render.mjs` averages 2 subframes; scene cuts sit on beats; `audio.mjs` puts every hit at `event + 1/60 s`; loudnorm to −14 LUFS |
| Same article, "anatomy of a directed prompt" | One hero move per shot; secondary moves 50–70 % as far, 100–200 ms later; ambient motion under 5 % of hero travel; ban the defaults (purple/blue gradients, glow orbs, particles, centered everything, fade-and-slide on every element) | One hero per scene; no glows, no particles, no gradients on chrome; flat ink background; the only "ambient" motion is the data packets |
| Same article, "numbers cheat sheet" | `ease-out-expo` for reveals; `ease-in-out` for camera; springs with damping ratio 0.7–0.85 for premium, no bounce on text; text held ≥ 0.3 s per word + 0.5 s; contrast ≥ 4.5:1; never more than 3 flashes/s | Reveals use closed-form springs (ζ 0.85, 2.4 Hz); camera uses cubic in/out; captions are on screen for ≥ 1.5 s; paper-on-ink contrast ≈ 16:1 |
| `.claude/skills/motion-launch-video/SKILL.md` (repo skill) | One shape never cut; content swaps with a short blur; springs everywhere; camera frames every state; music-first; every sound synthesized and placed on its peak; the last frame equals the first | Scenes are linked by camera moves and morphs (the pillar, the bus, the host box); content swaps exit short and early; everything is synthesized in code |
| Hook research (short-form, 2026): the first 1–3 s decide the scroll; lead with a specific, surprising claim or number; on-screen text is mandatory because most views are muted; change the visual every 2–3 s | "4 AI apps × 12 tools = 48 custom plugs" is a specific number in the first second. The screen changes at least every 2.5 s | Hook is numeric and visual at frame 0; scene changes stay ≤ 5 s; captions carry the full meaning with sound off |

Facts used in the film, checked against modelcontextprotocol.io (architecture page, revision **2026-07-28**):

- Three roles: **host** (the AI app, e.g. Claude Code, VS Code), **client** (one per server, created by the host, 1:1), **server** (exposes primitives; local or remote).
- Built on **JSON-RPC 2.0**.
- Server primitives: **tools** (`tools/list`, `tools/call`), **resources** (`resources/list`, `resources/read`), **prompts** (`prompts/list`, `prompts/get`).
- Transports: **stdio** (local subprocess, stdin/stdout) and **Streamable HTTP** (POST to one endpoint, optional SSE).
- Revision 2026-07-28 is stateless: every request carries version and capabilities in `_meta`; `server/discover` is the discovery request. The older `initialize` handshake belonged to earlier revisions, so the film does not show it.
- Sampling is deprecated in 2026-07-28; the film does not mention it.
- The `tools/call` example is the spec's own (`weather_current`, `San Francisco`, `imperial`), trimmed to fit the screen.

## 2 · Narrative (the story in one line)

> Ask an AI one question, and it reaches the outside world through four steps. MCP is the standard those steps follow.

The film walks from problem (48 plugs) → standard (one protocol) → roles (host / client / server) → transports → what servers offer → the actual call, step by step → who keeps control → end card.

## 3 · Beat sheet (absolute time, 120 BPM)

| Scene | Time | Beats | Hero move | Sound (peak lands +1 frame) |
| --- | --- | --- | --- | --- |
| A · Hook | 0.0 – 5.0 | 1–10 | 48 wires; the count runs 0→48; wires collapse into one point; count drops to 16 | slam ×2, count ticks, thock, snap, chime |
| B · Protocol | 5.0 – 9.0 | 11–18 | The MCP pillar grows between 4 hosts and 12 tools | slam, whoosh, thock, pops |
| C · Roles | 9.0 – 16.0 | 19–32 | Camera zooms into the host, then drops to the servers; packets run client ↔ server | slam, thock, whoosh, pops, bloops |
| D · Transports | 16.0 – 19.5 | 33–39 | Two panels: stdio (local) and Streamable HTTP (remote) | whoosh, thock, bloops |
| E · Offers | 19.5 – 25.0 | 40–50 | Three cards wipe in on beats: Tools, Resources, Prompts | slam, thock ×3, chime |
| F · The call | 25.0 – 35.5 | 50–71 | Bus + typed JSON for four steps; packets travel host → server → host | pops, typing ticks, bloops |
| G · Control | 35.5 – 38.0 | 71–76 | "The model proposes. The host decides. You can say no." | thock ×3 |
| H · End | 38.0 – 40.0 | 76–80 | Pillar returns as the MCP wordmark; URL | whoosh, chime, tick, pop |

Scene boundaries are all on the beat grid (multiples of 0.5 s). QA checks this.

## 4 · Look

- Ink `#0D0E11`, paper `#F4F1EA`, panels `#16181E`, hairlines `#2B2F38`. Flat colours, no gradients on chrome.
- Accents carry meaning: **amber** `#FFB547` = requests and data (packets, MCP pillar); **teal** `#3DDBC0` = client and responses; **coral** `#FF7A59` = server.
- Type: Inter (headlines, 900 weight) and JetBrains Mono (code and labels). Both OFL, bundled in `fonts/`.
- Motion grammar: line-mask reveals (text rises inside a clip), wipes for cards, springs for everything with mass, linear for packets along a path.
- Camera: `ease-in-out` focus moves between scenes; scale never exceeds 1.22.

## 5 · Verify

- `node qa.mjs` — duration, beat alignment of scene cuts, frame-to-frame determinism, no blank frames, every event inside the film, contact sheet.
- Stills at every scene's hero moment, viewed before the full render.
