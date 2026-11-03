// shiva-ganesha-video/brand.mjs
//
// One source of truth for the film: format, palette, type, the nine scenes with their
// windows, the narration lines, and every sound event in picture time.
//
// Format is chosen with ASPECT (env): 9x16 (1080×1920, default), 1x1 (1080×1080), 16x9 (1920×1080).
// The design is responsive: the same scenes lay out into the box that each aspect gives them
// (see layout() in story.mjs). Timing never depends on the aspect.

export const ASPECT = process.env.ASPECT ?? '9x16';
const SIZES = { '9x16': [1080, 1920], '1x1': [1080, 1080], '16x9': [1920, 1080] };
export const [W, H] = SIZES[ASPECT] ?? SIZES['9x16'];
export const FPS = 60;
export const DUR = 60.0;

// Palette: haldi gold, sindoor vermilion, cream paper, cocoa ink, sandal and ash.
// No blue or purple. The look is warm, earthy and printed.
export const C = {
  cocoa: '#2A1C16',
  cocoa2: '#3F2A20',
  cocoa3: '#5B3A2C',
  oxblood: '#4A1A1A',
  cream: '#FFF3DC',
  paper: '#F6E7C6',
  haldi: '#F5B531',
  haldi2: '#FFD97A',
  sindoor: '#E2472D',
  sindoor2: '#FF8A5C',
  sandal: '#C9AE8A',
  ash: '#8E7F76',
  elephant: '#D9CFC4',
  gold: '#E9A825',
};

export const FAM = {
  black: 'InterBlack',
  xb: 'InterX',
  semi: 'InterSemi',
  med: 'InterMed',
  mono: 'JBMono',
  monoB: 'JBBold',
};

// The nine scenes. t0/t1 are picture seconds. `voice` is the narration file. The narration
// starts VOICE_LEAD seconds after the scene starts and must end before t1.
export const VOICE_LEAD = 0.2;
export const SCENES = [
  { id: 'hook', label: 'Hook', t0: 0.0, t1: 6.0, voice: 'L1-hook.wav', vDur: 5.00,
    head: ['Apne hi bete ka', 'sir kaata?'], hi: 'bete',
    cap: 'Shiva ne ek bachche ka sir kaat diya. Wo bachcha unka hi beta tha.',
    theme: 'dusk' },
  { id: 'creation', label: 'Creation', t0: 6.0, t1: 12.5, voice: 'L2-creation.wav', vDur: 6.04,
    head: ['Haldi se bana', 'ek bachcha.'], hi: 'Haldi',
    cap: 'Parvati ne haldi ke ubtan se ek bachcha banaya. Use darwaza sambhalne ko kaha.',
    theme: 'dawn' },
  { id: 'door', label: 'The order', t0: 12.5, t1: 18.5, voice: 'L3-door.wav', vDur: 3.44,
    head: ['Andar mat', 'aane dena.'], hi: 'mat',
    cap: 'Kisi ko andar mat aane dena. Yeh aadesh tha.',
    theme: 'dusk' },
  { id: 'arrival', label: 'Shiva arrives', t0: 18.5, t1: 25.0, voice: 'L4-arrival.wav', vDur: 4.92,
    head: ['Pehchana', 'nahi.'], hi: 'nahi',
    cap: 'Jab Shiva wapas aaye, to bachche ne unhe pehchana nahi. Unhe rok diya.',
    theme: 'dusk' },
  { id: 'cut', label: 'The moment', t0: 25.0, t1: 32.0, voice: 'L5-cut.wav', vDur: 5.40,
    head: ['Ek pal mein', 'sab badal gaya.'], hi: 'pal',
    cap: 'Gusse mein Shiva ne trishul chalaaya. Ek pal mein sab badal gaya.',
    theme: 'oxblood' },
  { id: 'grief', label: 'Parvati', t0: 32.0, t1: 40.0, voice: 'L6-grief.wav', vDur: 6.04,
    head: ['Sansaar', 'thham gaya.'], hi: 'thham',
    cap: 'Parvati ka dukh dekh kar sansaar thham gaya. Unhone bachche ko wapas maanga.',
    theme: 'night' },
  { id: 'search', label: 'The search', t0: 40.0, t1: 47.5, voice: 'L7-search.wav', vDur: 6.64,
    head: ['Uttar ki or', 'sir, sabse pehle.'], hi: 'Uttar',
    cap: 'Shiva ne ganon ko bheja. Jo sabse pehle uttar ki or sir karke soya mile, uska sir laao.',
    theme: 'map' },
  { id: 'restore', label: 'New life', t0: 47.5, t1: 54.5, voice: 'L8-restore.wav', vDur: 6.16,
    head: ['Naya jeevan.', 'Naya roop.'], hi: 'jeevan',
    cap: 'Ganon ko ek hathi mila. Uska sir laakar, Shiva ne bachche ko naya jeevan diya.',
    theme: 'gold' },
  { id: 'boon', label: 'The boon', t0: 54.5, t1: 60.0, voice: 'L9-boon.wav', vDur: 4.96,
    head: ['Pehle', 'Ganesha.'], hi: 'Ganesha',
    cap: 'Isliye har shubh kaam mein, sabse pehle Ganesha ki pooja hoti hai.',
    theme: 'cream' },
];

// Sound events in picture seconds. Each hit's peak lands at t + 1/FPS (one frame late).
export const EVENTS = [
  // [t, kind, gain, pan]
  [0.00, 'bell', 0.9, 0],
  [0.10, 'drum', 0.6, -0.2],
  [6.00, 'whoosh', 0.5, 0],
  [12.50, 'whoosh', 0.5, 0],
  [18.50, 'whoosh', 0.5, 0],
  [25.00, 'whoosh', 0.5, 0],
  [27.20, 'slam', 1.0, 0],          // the cut
  [27.20, 'chime', 0.5, 0.3],
  [32.00, 'whoosh', 0.5, 0],
  [40.00, 'whoosh', 0.5, 0],
  [43.00, 'tick', 0.4, -0.4],       // ganas start north
  [44.00, 'tick', 0.4, 0.4],
  [45.00, 'tick', 0.4, 0],
  [45.80, 'chime', 0.6, 0],         // elephant found
  [47.50, 'whoosh', 0.5, 0],
  [49.60, 'bell', 0.8, 0],          // head seats
  [52.20, 'chime', 0.6, -0.3],      // eyes open
  [54.50, 'whoosh', 0.5, 0],
  [56.50, 'bell', 0.9, 0],
  [58.50, 'bell', 0.6, 0],
];

export const sceneAt = (t) => SCENES.find((s) => t >= s.t0 && t < s.t1) ?? SCENES[SCENES.length - 1];
