# Voice research (for emotional, human-sounding voice-over)

Researched Nov 2026 from web search results. Prices and tiers change often. Re-check the vendor page
before you buy. Vendor claims (for example "indistinguishable") are marketing, not measurements.

## Short answer

| Need | Pick | Why | Free credits | Paid |
|---|---|---|---|---|
| Most emotional control, plain-English direction | **Hume AI, Octave 2** | Steers emotion from natural-language instructions | 10k chars/mo | Starter about $3 (30k chars) |
| Most natural, widely used, emotional tags | **ElevenLabs, Eleven v3** (audio tags such as `[whispers]`) | Strong expressiveness and voice library; large user base | 10k chars/mo, **non-commercial only**, no cloning | Starter $6 (30k chars, commercial), Creator $22 (121k) |
| Free, large allowance, commercial OK | **Google Cloud TTS** (Chirp 3 HD / Neural2) | 1M chars/mo free | 1M chars/mo | Chirp 3 HD $30 per 1M chars |
| Free, enterprise-grade | **Azure AI Speech**, Neural / Neural HD | 500k chars/mo free (F0 tier) | 500k chars/mo | Neural $15 per 1M, Neural HD $22 per 1M |
| Dialogue (two speakers) | **Play.ht, PlayDialog** | Built for conversation | 12.5k chars/mo | Creator $39 |
| Free, run on your own machine, commercial OK | **Chatterbox** (Resemble AI, MIT) | Zero-shot clone from about 5 s of audio, emotion control | Free (self-host) | Free |
| Free, open, strong expression | **Orpheus 3B** (Apache-2.0) | Emotion tags in the text | Free (self-host) | Free |

**Recommendation for the explainer films:** Hume Octave 2 for the emotional direction (the user asked for
voice that matches the picture). Use ElevenLabs Eleven v3 as the comparison voice. For a commercial
release, ElevenLabs Starter ($6) or Hume Starter (about $3) is the cheapest legal route. If the film must
be free and open, run Chatterbox or Orpheus on the user's own GPU.

## Platforms

**ElevenLabs.** Free: 10k credits/month, non-commercial, no voice cloning. Starter $6 (30k credits, commercial);
Creator $22 (121k); Pro $99 (600k); Scale $299; Business $990. API about $0.08 per 1k characters for v3 and
Multilingual v2, and about $0.04 per 1k for Flash and Turbo. Sources: cartesia.ai "ElevenLabs pricing"
(Oct 2026), websitevoice.com (Oct 2026), toolchase.com (Aug 2026). Some sites list Starter at $5. Check the
live page.

**Hume AI (Octave 2).** Free: 10k characters/month. Starter about $3 (30k). Octave steers emotion from
plain-English instructions, such as "warm, slightly amused, slows on the last word". Source: toolradar (May 2026).

**Play.ht (PlayDialog).** Free: 12.5k characters/month. Creator $39. Dialogue model for two speakers.
Source: aisotools and toolradar (2026).

**Murf.** No free tier, only a trial. Creator $29/month. "90% indistinguishable" is a vendor claim. Source: toolradar.

**Cartesia (Sonic).** Free: 20k credits/month. Pro $4 (100k). Tuned for latency (about 90 ms), so it suits
live agents more than emotional narration. Source: toolradar and cartesia.ai.

**Google Cloud Text-to-Speech.** 1M characters/month free (Neural2 and Chirp HD). Chirp 3 HD $30 per 1M
characters. Source: toolradar (2026).

**Azure AI Speech.** 500k characters/month free (F0 tier). Neural $15 per 1M characters, Neural HD $22 per 1M.
Source: toolradar (2026).

**Fish Audio (S2 Pro).** Free tier of about 7 minutes/month. Weights can be self-hosted for personal use.
Strong emotion control. Source: nerdynav.com (2026).

## Open-source (run locally)

- **Chatterbox** (Resemble AI, MIT). About 0.5B parameters. Clones a voice from about 5 s of audio. 23
  languages. Emotion control. Needs a GPU with about 4–6 GB VRAM. The vendor's blind test reports 63.8–65.3 %
  preference. That figure is vendor-run, so test it yourself. Sources: localaimaster.com (Jul 2026),
  secondtalent.com (Jun 2026), presenc.ai (May 2026).
- **Orpheus 3B** (Apache-2.0). Emotion tags in the text. Needs a GPU.
- **Kokoro-82M** (Apache-2.0). Runs on a CPU. 54 voices. **No cloning**, and weak expressive control.
  Good as a fallback for clear narration with no emotion.
- **Dia-1.6B** (Apache-2.0). Two-speaker dialogue.
- **F5-TTS.** Weights are CC-BY-NC, so **not commercial**.
- **XTTS v2.** Coqui Public Model Licence (CPML), **non-commercial**.
- **Fish Speech (open weights).** CC-BY-NC-SA, **non-commercial**.

Check licences before any commercial use.

## Licence traps

- Free tiers are usually **non-commercial**. ElevenLabs free is explicitly non-commercial, with no cloning.
- Several strong open models (F5, XTTS, Fish Speech) are non-commercial.
- Commercially safe open choices: Chatterbox (MIT), Orpheus (Apache-2.0), Kokoro (Apache-2.0), Dia (Apache-2.0).

## Sandbox constraint

The build sandbox can reach only GitHub, npm and PyPI. ElevenLabs, Hume, Google, Azure and Hugging Face
weights are **not reachable from the sandbox**. So a hosted voice has to be generated on the user's machine,
or through the platform's own voice tools inside the session. A local model has to be installed and run on the
user's machine.

## How to use a voice in the film

1. Write the narration per scene (about 2.5 words per second for a calm explainer; keep lines inside their scene window).
2. Give the TTS the emotion direction for the scene (for example "curious, then decisive" on a
   reveal; "dry, slightly amused" on a failure). Hume takes this as plain text. ElevenLabs v3 takes
   audio tags.
3. Render each line to its own WAV. Place it in the mix with `adelay` at the scene's start time, plus the
   beat offset. Duck the music under the voice with `sidechaincompress`.
4. Keep one voice per film. Test the emotion on a 10-second excerpt before you render the whole film.
5. Record the voice name, model, settings and any tags in `deliver/README.md`, so the next film can match it.
