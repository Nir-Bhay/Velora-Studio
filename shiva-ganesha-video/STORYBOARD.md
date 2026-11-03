# Shiva and Ganesha · the story in 60 seconds

Format: 60.0 s · 9:16 (1080×1920) · 60 fps · Hinglish narration (voice-03) · synthesized bed and sound.
Responsive: the same scenes lay out for 1:1 and 16:9 (`layout()` in `story.mjs`).

## Story (source)
Shiva Purana, Rudra Samhita (Kumara Khanda), chapters 13–18. Parvati forms a child from turmeric
paste and sets him to guard the door. Shiva, not knowing him as his son, is stopped at the door.
In anger Shiva cuts the child's head. Parvati's grief threatens the cosmic order. Shiva sends his
ganas to bring the head of the first living being found lying with its head to the north. They
bring an elephant's head. Shiva fixes it to the child and restores him, and grants that he be
worshipped first in every undertaking. The head is never shown in gore: the strike is a gold
streak and a flash, and the head lifts away as light.

Variants in other Puranas (Skanda, Brahma Vaivarta; the Shani and Gajasura accounts) are not used.

## Research used for the design
- Hook in the first 3 s: a bold claim or question on screen, with the first word spoken within 0.5 s
  (vertical-video hook guides, 2025–26). The first line is a question: "Apne hi bete ka sir kaata?"
- Captions on every line, lighting up word by word as they are spoken (silent viewing).
- Analog texture: grain and paper (2026 motion trend reports). Cut-paper cards with hand-cut edges.
- Kinetic type drives the story. Surfaces are paper cards and solid chips. The liquid-glass panel is built in lib/paint.mjs but not used in this cut.
- Modular layout: paper cards and chips, not one diagram.
- Palette from the story, not a default: haldi gold, sindoor vermilion, cream, cocoa ink. No
  blue or purple, and no flat black.

## Scenes
| # | Window (s) | Scene | Picture | Headline | Narration |
|---|---|---|---|---|---|
| 1 | 0.0–6.0 | Hook | Shiva and the child face to face, a gold arc between | Apne hi bete ka sir kaata? | Shiva ne ek bachche ka sir kaat diya. Wo bachcha unka hi beta tha. |
| 2 | 6.0–12.5 | Creation | Turmeric grains gather into the child | Haldi se bana ek bachcha. | Parvati ne haldi ke ubtan se ek bachcha banaya. Use darwaza sambhalne ko kaha. |
| 3 | 12.5–18.5 | The order | Arch door, the child inside, AADESH tag | Andar mat aane dena. | Kisi ko andar mat aane dena. Yeh aadesh tha. |
| 4 | 18.5–25.0 | Shiva arrives | Shiva enters; the child does not know him | Pehchana nahi. | Jab Shiva wapas aaye, to bachche ne unhe pehchana nahi. Unhe rok diya. |
| 5 | 25.0–32.0 | The moment | Gold streak, flash; the head lifts as light | Ek pal mein sab badal gaya. | Gusse mein Shiva ne trishul chalaaya. Ek pal mein sab badal gaya. |
| 6 | 32.0–40.0 | Parvati | Lotus closes; sky-rings slow to a stop | Sansaar thham gaya. | Parvati ka dukh dekh kar sansaar thham gaya. Unhone bachche ko wapas maanga. |
| 7 | 40.0–47.5 | The search | Compass needle turns north; ganas run; elephant found | Uttar ki or sir, sabse pehle. | Shiva ne ganon ko bheja. Jo sabse pehle uttar ki or sir karke soya mile, uska sir laao. |
| 8 | 47.5–54.5 | New life | Elephant head seats; lotus blooms; eyes open | Naya jeevan. Naya roop. | Ganon ko ek hathi mila. Uska sir laakar, Shiva ne bachche ko naya jeevan diya. |
| 9 | 54.5–60.0 | The boon | Ganesha; four chips: Shuruat, Yatra, Vivah, Padhai | Pehle Ganesha. | Isliye har shubh kaam mein, sabse pehle Ganesha ki pooja hoti hai. |

## Sound
- Bed: a soft drone (D and A, slow beating), swelling in and out.
- Hits (`EVENTS` in brand.mjs): bell at 0 and at the head seating; damru drum at 0.1 s; whoosh at
  each scene change; the cut is a low slam plus a chime at 27.2 s, one frame after the picture;
  ticks as the ganas run north; the elephant chime; the eyes-open chime.

## Known limits (next pass)
- Shiva is a stylized silhouette. A richer figure (shoulders, hair, the damru) is the first thing to improve.
- The elephant and the child are simple shapes, which fits the cut-paper style but could carry more detail.
- Narration is one clip per scene (9 clips). A re-voice would need the same clips replaced.
