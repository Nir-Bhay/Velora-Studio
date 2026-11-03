# MCP explainer v4 — the chat-and-settings cut

**Same idea, same narration, same sound, same timing as v3.** Only the picture approach changes, so you can compare v3 and v4 directly.

- v3 (`mcp-explainer-v3-loop-9x16-1080p60.mp4`): diagram style. Apps, tools, and a plug, with a waiter diagram and cards.
- v4 (`mcp-explainer-v4-chat-9x16-1080p60.mp4`): app style. The steps arrive as chat messages, the choice is a real chat exchange, and the new tool is a settings toggle.

Narration: `voiceover/out/v2/` clips, unchanged. Sound: `out/audio-master.wav`, unchanged (byte-identical to v2 and v3). Scene timing: `brand.mjs`, unchanged.

## What the research repo gave us

Source: `github.com/yihui-dev/awesome-opus5-5-videos` (703 Opus 5.5 video prompts, 116 of them explainers).

**Limit to know first:** the repo has no views, likes, watch time, or duration fields. So it cannot tell us which videos work best on social media. I picked patterns by fit with our audience and story, not by performance. Use the v3 vs v4 comparison to decide.

| Pattern taken | Where it came from | How v4 uses it |
|---|---|---|
| One shape, never cut. Elements morph instead of cutting. | `verbove-268381` (explainer, real-UI) | The 4 apps and 12 tools morph into one column and one plug (6.4–7.4 s). Nothing jump-cuts. |
| Real UI with real data, no placeholders | `verbove-268381` | The waiter, the steps, the choice, and the settings are chat or settings screens with real labels. |
| Show the process as it happens | `ror-fly-880547` (recipe: items go into the glass one at a time) | Each step is a chat message that appears on its spoken word. |
| Zero-basis audience, one idea per beat, every term explained once | `cryptoxorz-359201` (science explainer template with target audience = zero basis) | One plain idea per scene. "Tool" is shown as a chip, and "kaam karne wale tools" is written under the kitchen. |
| Beat order: pain → reframe → name → how it works → objection → range → close | `archiveexplorer-560622` (9-beat launch video) | Hook (pain), one plug (reframe), waiter (how it works), steps, you decide (objection), new tool (range), loop (close). |
| Loop: last frame equals first frame | `verbove-268381` | Same as v3. The last half-second dissolves into frame 0. |

Techniques already in v3 that are not from the repo: per-frame pure functions of time, Playwright-free canvas render, two-pass loudness, captions burned in.

## Scenes

| # | Time | Picture | On-screen words (Roman Hinglish) |
|---|---|---|---|
| 1 | 0–6 | 4 app cards (2×2) and 12 tool chips, 48 wires between them | 48 alag connections? · Har AI app ko har tool se alag jodna padta hai. |
| 2 | 6–10 | Cards and chips morph into two columns with one MCP plug in the middle. Counter 48 → 16. | Ek plug. Sab jagah. · MCP = ek common plug, jaise phone ka charger |
| 3 | 10–15 | Chat: your bubble "Kal ka weather batao". The order slip goes to the AI bubble, then to the kitchen card. The kitchen's Weather chip lights up. | Waiter ki tarah. · Aap order dete ho. Waiter kitchen tak le jaata hai. |
| 4 | 15–25 | Chat messages arrive on each spoken step: 1 AI poochta hai → 2 Tool batata hai (chips) → 3 Kaam hota hai (progress bar) → 4 AI aapko batata hai | Ek request, 4 kadam. |
| 5 | 25–31 | AI suggestion bubble with HAAN / NAHI. Cursor taps HAAN at 28.2 s. Your "HAAN" bubble, then "Bhej diya." | AI suggest karta hai. · AI sirf suggest karta hai. Aap haan kaho, tabhi kaam hota hai. |
| 6 | 31–35 | Tools settings: toggles on. Maps row slides in, then its toggle switches on at 33.0 s. NAYA tag. Counter 16 → 17. | Naya tool? Bas ek aur plug. |
| 7 | 35–40 | Same settings screen, 17 connected, headline "Ab nahi." Dissolves into frame 0. | Har app ka alag plug? Ab nahi. |

## Layout rules used (from the v3 review)

- Cables are drawn before the boxes, so no cable crosses a label.
- Tool and app labels are 22–34 px bold, not 20 px regular.
- Nothing sits on top of text. The slip travels on its own path, and the toggle row never overlaps another row.
- Content stays between y 560 and 1500. Captions sit in 1500–1600, clear of the platform's bottom UI.

## Compare with v3

Watch both at phone size. Check:
1. Does the hook read in the first 2 seconds? (Both use the 48 counter and the wire tangle.)
2. Does the waiter explain itself faster in chat (v4) or in the diagram (v3)?
3. Does the chat make the four steps easier to follow?
4. Which feels more like a real app to a non-technical viewer?

Record the answers in `LESSONS.md` with the viewer evidence.
