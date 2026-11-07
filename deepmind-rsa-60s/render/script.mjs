// Script data for the 60-second film.
// Narration lines are the user's VO text, used verbatim. The audio clips in audio/ were generated from these same lines.
// `onScreen` is the on-screen label text from the brief. `highlight` lists up to two caption words to colour.
// Scene durations are NOT stored here: prepare.mjs derives them from the measured VO clips (see README).

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TOTAL = 60; // seconds; the film is exactly this long

export const SCENES = [
  {
    id: 1,
    name: 'hook',
    vo: 'audio/vo-01.mp3',
    text: "AI hasn't broken the internet. It's putting old digital locks under pressure.",
    onScreen: 'AI VS RSA-1024',
    highlight: ['pressure'],
  },
  {
    id: 2,
    name: 'announcement',
    vo: 'audio/vo-02.mp3',
    text: 'On November 6, DeepMind revealed two AI-assisted advances against legacy RSA-1024.',
    onScreen: 'NOV 06, 2026 · GOOGLE DEEPMIND · TWO RESEARCH ADVANCES',
    highlight: ['two'],
  },
  {
    id: 3,
    name: 'signature',
    vo: 'audio/vo-03.mp3',
    text: 'First: digital signatures, the seals that prove software and messages are authentic. In certain PKCS#1 v1.5 signing setups, attacker-controlled input can make padding add no extra protection.',
    onScreen: 'DIGITAL SIGNATURES · SIGNING INTERFACE · PADDING WEAKNESS',
    highlight: ['attacker-controlled', 'padding'],
  },
  {
    id: 4,
    name: 'theoretical-1600',
    vo: 'audio/vo-04.mp3',
    text: "For one harder case, DeepMind estimates attack costs could fall around 1,600-fold. That's theoretical, not a completed attack.",
    onScreen: '1,600× · THEORETICAL ESTIMATE · NOT EXPERIMENTALLY DEMONSTRATED AT THIS SIZE',
    highlight: ['1,600-fold', 'theoretical'],
  },
  {
    id: 5,
    name: 'fan-factories',
    vo: 'audio/vo-05.mp3',
    text: 'Second: batch factoring. After an expensive shared setup, each additional RSA-1024 key is projected to cost roughly 30 times less than with the previous method. This hasn\'t been implemented.',
    onScreen: 'FAN FACTORIES · BATCH FACTORING · ≈30× PROJECTED REDUCTION PER ADDITIONAL KEY',
    highlight: ['30', 'implemented.'],
  },
  {
    id: 6,
    name: 'real-computation',
    vo: 'audio/vo-06.mp3',
    text: 'What actually ran? Agents reproduced an already-solved RSA-1024 benchmark with 3.5 times less CPU work.',
    onScreen: '1,380 CPU CORE-YEARS → 391 CPU CORE-YEARS · SAME BENCHMARK AND ALGORITHM',
    highlight: ['3.5', 'less'],
  },
  {
    id: 7,
    name: 'reality-check',
    vo: 'audio/vo-07.mp3',
    text: "DeepMind says these findings don't threaten deployed RSA-2048-or-larger systems. This isn't a mass internet breach.",
    onScreen: 'RSA-1024 ≠ RSA-2048+ · THESE SPECIFIC FINDINGS DO NOT THREATEN MODERN RSA',
    highlight: ['RSA-2048-or-larger', 'breach.'],
  },
  {
    id: 8,
    name: 'closing',
    vo: 'audio/vo-08.mp3',
    text: 'The warning: AI can accelerate cryptanalysis.',
    onScreen: 'THE FUTURE OF CYBERSECURITY IS CHANGING.',
    highlight: ['cryptanalysis.'],
  },
];

// Speech-rate factor applied to the VO clips (pitch-preserving atempo). See prepare.mjs for why.
export const TEMPO = 1.25;
