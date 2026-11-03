# MCP explainer v2 — storyboard (40 s loop, 9:16, 1080×1920, 60 fps)

**Audience:** non-technical people who use AI apps and do not know how they work.
**Promise:** one idea, said like you would to a child: *one common plug is easier than 48 wires.*
**Loop:** the last half-second dissolves into frame 0 and the audio fades under it. There is no end card, title, or outro. Watching again starts with the same hook, with no stop.
**Voice:** `voice-02`, Hinglish, calm and heavy. Devanagari is for the voice only. Captions are Roman Hinglish, because the caption font has no Devanagari glyphs.

## The story in one breath

4 AI apps each want to use 12 tools. That is 48 separate connections. MCP is one common plug, like a phone charger. It works like a waiter: you give an order, and the waiter carries it to the kitchen on a standard slip. The AI asks what a tool can do, the tool answers, the work gets done, and the AI tells you. The AI only suggests. You say haan. A new tool is just one more plug. Then the loop closes: "Har app ka alag plug? Ab nahi." The next play starts from 48 wires again.

## Scenes

Cuts sit on the 120 BPM grid (0.5 s). Each window is sized to its voice clip with room to breathe.

| # | Time | Voice (Devanagari, `voice-02`) | Caption (Roman) | Picture | Sound |
|---|------|-------------------------------|-----------------|---------|-------|
| 1 | 0.0–6.0 | 0.2 "चार AI apps, बारह tools. यानी अड़तालीस अलग connections!" | har AI x har tool = alag connection (0.2–5.6) | Headline "48 alag connections?". Four AI tiles (A–D) on the left, twelve tool tiles on the right, 48 tangled wires. Counter rolls 00 → 48. Slow push-in. | Slam on frame 0, ticks as the counter rolls, thocks on the headline beats |
| 2 | 6.0–10.0 | 6.2 "MCP: एक common plug. जैसे phone का charger." | MCP = ek common plug / jaise phone ka charger (6.2–9.8) | The wires fold into one amber MCP socket. Counter 48 → 16. Headline "Ek plug. Sab jagah." | Whoosh at the cut, a tick run into the snap and chime |
| 3 | 10.0–15.0 | 10.2 "Waiter जैसा. आप order देते हो, वो kitchen तक जाता है." | Aap order dete ho. / Waiter kitchen tak le jaata hai. (10.2–14.8) | Person → AI "waiter" → kitchen tools. An "ORDER" slip travels across both links (10.6 and 12.0 s). Headline "Waiter ki tarah." | Pops on each handoff, bloop on arrival |
| 4 | 15.0–25.0 | 15.2 "पहले AI पूछता है… फिर काम होता है. आख़िर में AI आपको बताता है." | (none; the cards are the text) | A chat bubble "Kal ka weather batao, aur Ravi ko message bhejo." Then four cards that appear on the spoken words: 15.48 "AI poochta hai", 17.25 "Tool list deta hai", 18.82 "Kaam hota hai", 20.09 "AI aapko batata hai". Headline "Ek request, 4 kadam." | One pop per card, the last card on a chime |
| 5 | 25.0–31.0 | 25.4 "AI सिर्फ सुझाता है. आप haan बोलो, तभी काम होगा." | AI sirf suggest karta hai. / Aap haan kaho, tabhi kaam hota hai. (25.4–30.6) | The AI's proposal "Ravi ko message bhejun?" with two buttons, HAAN and NAHI. A cursor taps HAAN at 28.2 s, then the buttons leave and the card reads "Bhej diya." Headline "AI suggest karta hai." | Thock on the tap, a rising chime on the result |
| 6 | 31.0–35.0 | 31.2 "नया tool? बस एक और plug." | Naya tool? Bas ek aur plug. (31.2–34.6) | Four AI tiles on the socket. A new coral tile "Maps" drops in from above (31.5–32.2). At 33.0 s it clicks into the socket and the counter goes 16 → 17. Headline "Naya tool?" | Whoosh, then a click on the plug |
| 7 | 35.0–40.0 | 35.2 "हर app का अलग plug? अब नहीं." | Har app ka alag plug? Ab nahi. (35.2–38.8) | The full socket, 17 plugs, with the headline "Ab nahi." Dissolves into frame 0 over 39.5–40 s. | The bed keeps the groove. The master fades out over the last 0.5 s. |

## Directing rules used

- **Word leads, picture follows.** Each scene starts on the voice's first word, so the picture supports the line it sits under.
- **One idea per scene.** The problem, the plug, the waiter, the steps, the choice, the new tool, the close.
- **Headlines come from a mask and leave early** (0.25 s), so the next idea is never fighting the last one.
- **The camera moves the world, not the words.** Only gentle pushes. Captions and headlines stay put.
- **No jargon on screen.** No "host", "client", "server", "transport", "JSON" or "primitives". Tools are shown as little named tiles ("Mail", "Weather"), and the socket is called "MCP".
- **The loop is built in:** frame 0 and frame 40 are the same picture, with the counter at 00 and the wires tangled.

## Files

- `film.mjs`: the picture, per frame. `TIMING` holds the sync points.
- `brand.mjs`: the scene table, the colors, and the sound event list.
- `audio.mjs`: the sound design. Events past 40 s wrap to the start. The bed runs to the end, with hats from 15 s. A 0.5 s cosine fade-out sits under the dissolve.
- `voiceover/script.v2.json`: the script and the clip for each line. Clips are in `voiceover/out/v2/`.
- `voiceover/assemble.mjs`: fit check, pitch (0 by default), ducking, two-pass loudness, mux with `-c:v copy`.
- `render.mjs`: picture (video only) → `out/picture-v2.mp4`.

## Checks before delivery

1. Stills at each scene, looking at composition and text fit (done for 12 frames).
2. Loop seam: frame 0 equals the frame after the dissolve in composition. The audio ends at 0 at 40 s.
3. Loudness: integrated about −14 LUFS, true peak under −1 dBTP.
4. Voice pitch matches the approved preview. No speed-up.

## v3 changes (picture and on-screen words; narration and sound unchanged)

The narration clips, `audio-master.wav`, the scene table, and every sync point are unchanged. The audio was approved as is.

- **Cables go under the labels.** The spokes used to be drawn over the tiles and struck through the text. Now the cables are drawn first.
- **Readable labels.** Tool labels grow from 20 to 22 px (bold), with a colour dot. AI apps are named (Chat AI, Writer AI, Photo AI, Code AI).
- **Column headers.** "AI APPS" and "TOOLS" sit above the two columns, so the viewer knows what each side is.
- **"connections", not "plugs".** The counter says what it counts: 48 → 16 → 17.
- **Waiter scene rebuilt as a three-stop diagram.** Person ("order dete ho") → AI waiter ("order lekar jaata hai") → kitchen with Mail, Weather, Files. The order slip rides a dotted track above the stops, so it never covers a label. The kitchen door lights up when the order arrives.
- **Step cards with glyphs.** ? (ask), list (tools), bolt (work), check (done), with a clearer second line on each card.
- **The choice card.** An AI avatar, a message bubble inside the proposal, and a result card with a check. The proposal fades out before the result fades in, so the two never show together.
- **New tool badge.** "NAYA" marks the new tile, and the counter goes 16 → 17 on the click.
- **Captions.** The problem caption now explains the cause ("Har AI app ko har tool se alag jodna padta hai").
