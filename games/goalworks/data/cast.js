// The chibi cast in GOALWORKS (Milestone 22b; series SERIES_CHIBI_CAST.md): the shared everyday chibis that fit a football
// club, with GOALWORKS names and jobs. Plain data; the pictures are looked up through src/ui/castArt.js castSprite(id) — the
// walking sprite sheet once the series makes them (none yet), else the still picture filed for that slot, else null (the
// caller draws nothing and its text stands alone). They never replace existing art (Featured Players, staff portraits,
// the gods, the kits on the pitch, the M5 / M6 crowd stay as they are), have no stats and are never staff you hire.
//
// Each slot: id, chibi (the series number, chibis/cast/refs/chibi_NN_*.png), name, job, group, where (where they show),
// still (the filed 512×512 stand-in, assets/images/cast/<still>.png — only the nine faces that speak have one so far),
// colours: 'fixed' (a named character keeps the one colouring of its picture) or 'recolour' (fans: hair, clothes and skin
// vary by recolourCast). Left out of GOALWORKS (beach / holiday looks): 09, 10, 11, 12.

export const CAST_LEFT_OUT = [9, 10, 11, 12];

const face = (id, chibi, name, job, where) => ({ id, chibi, name, job, group: 'face', where, still: `cast_${id}`, colours: 'fixed' });
const worker = (id, chibi, name, job, where) => ({ id, chibi, name, job, group: 'worker', where, still: null, colours: 'fixed' });

export const CAST = [
  // 1. Named faces (speak in pop-ups, News and ceremonies; stand-in portraits filed by Cowork, 31 Oct)
  face('edith_marlow', 4, 'Edith Marlow', 'Club Chair (the Board voice)', ['Awards Night: the Board', 'board News lines', 'promotion offers']),
  face('del_price', 7, 'Del Price', 'Supporters’ Club chair (the Fans voice)', ['Awards Night: the Fans', 'fan News lines', 'derby build-up']),
  face('priya_shah', 14, 'Priya Shah', 'Reporter, The Evening Whistle (the Press voice)', ['Awards Night: the Press', 'match reports', 'big-signing headlines']),
  face('sam_okafor', 30, 'Sam Okafor', 'Assistant Manager: the narrator, the manager with a face', ['the hint line', 'tips and news', 'the Head Coach voice when no coach is hired', 'later: the first-time guide (M34)']),
  face('rex_lamar', 3, 'Rex Lamar', 'Host and stadium announcer', ['Awards Night: the intro and the award reveals', 'the Summer Showcase', 'tournament draws']),
  face('danny_vale', 6, 'Danny Vale', 'Manager of RV01 Moorlanders (the early derby)', ['rival News lines', 'pre-match banter']),
  face('gaz_holroyd', 24, 'Gaz Holroyd', 'Manager of RV03 Yorkshire Tykes (hard-running)', ['rival News lines']),
  face('vincent_crane', 29, 'Vincent Crane', 'Chairman of RV06 Manchester Mancs (money power)', ['rival News lines', 'tries to poach your Stars (News only)']),
  face('celeste_moore', 28, 'Celeste Moore', 'Sponsor rep (Commercial Partnerships)', ['sponsor interest lines', 'sponsor offers when M23 arrives']),
  // 2. Walking club workers (walking sprites later; on the club complex)
  worker('big_tam', 13, 'Big Tam', 'Groundsman', ['the pitches (mowing, marking lines)', 'the build grid while facilities are upgraded']),
  worker('kev_doyle', 17, 'Kev Doyle', 'Kit man', ['the dressing rooms', 'the training pitches before sessions']),
  worker('maureen_hale', 8, 'Maureen Hale', 'Club secretary', ['the Manager Office', 'the club gates on signing days']),
  worker('old_walter', 26, 'Old Walter', 'Tea-hut volunteer, at the club 50 years', ['the tea hut and the stands', 'a funny News line now and then']),
];

// 3. Fans and visitors (walking sprites later): unnamed, recoloured. Most wear your club's home colours, a few plain
// colours, away fans the opponent's. How many walk in grows with Club Rank, up to the bible's 80 crowd sprites (§41).
export const FANS = {
  base: [1, 2, 5, 15, 16, 17, 18, 22, 24, 27],
  family: [25, 26, 1, 18], // (Summer Showcase / open days: grandparents and younger fans)
  maxWalking: 80,
  homeShare: 0.75, // in your colours
  plainShare: 0.15, // plain colours (the rest: away fans in the opponent's colours)
  byRank: { E: 6, D: 12, C: 22, B: 36, A: 56, S: 80 }, // how many walk in on a match day
  cheerAfterWin: 6, // stay and cheer at the gates
  afterDerbyLoss: 0.8, // × next time (light touch)
};
// 4. Trial hopefuls (walking sprites later): sporty chibis walking to the academy pitch on trial days (M15). Never your
// players — they keep their own art.
export const TRIAL_HOPEFULS = [19, 20, 21, 22, 23];

export const castById = (id) => CAST.find((c) => c.id === id) ?? null;
// Every chibi number GOALWORKS uses (none outside these lists).
export const CAST_NUMBERS = [...new Set([...CAST.map((c) => c.chibi), ...FANS.base, ...FANS.family, ...TRIAL_HOPEFULS])].sort((a, b) => a - b);

// Who speaks for each Awards Night voice (bible voices: data/verdicts.js), and the host.
export const VOICE_FACES = { board: 'edith_marlow', fans: 'del_price', press: 'priya_shah', coach: 'sam_okafor' };
export const HOST = 'rex_lamar';
export const NARRATOR = 'sam_okafor';
export const SPONSOR_REP = 'celeste_moore';

// The narrator's voice on the hint line: "Boss, …".
export const SAM = {
  hint: (text) => `Boss, ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
  standIn: 'Sam Okafor, Assistant Manager (no Head Coach hired)',
};

// recolourCast's masks (src/ui/castArt.js): colour ranges on the still picture (hue in degrees, wrapping past 360;
// saturation and lightness 0–1) inside a box (share of the picture: x0, x1, y0, y1). The clothes are looked for first,
// then the hair, then the skin, so each pixel changes once. A pixel in a mask takes the new colour's hue and saturation
// and keeps its own light and shade (hair and skin also shift lightness, so blond or dark both read). Measured on the
// reference pictures (chibis/cast/refs, 31 Oct): each look's own clothes colour, because they differ.
const TORSO = { x0: 0.3, x1: 0.7, y0: 0.44, y1: 0.74 };
const clothes = (h, s = [0.3, 1], l = [0.12, 0.9], box = TORSO) => ({ h, s, l, ...box });
export const CAST_MASKS = {
  hair: { h: [0, 60], s: [0, 1], l: [0, 0.5], x0: 0.15, x1: 0.85, y0: 0, y1: 0.3 },
  // (long hair: down the sides of the face to the shoulders, clear of the eyes)
  hairSides: { h: [0, 60], s: [0, 1], l: [0, 0.5], x0: 0.15, x1: 0.85, y0: 0.3, y1: 0.5, eyes: [0.34, 0.66] },
  skin: { h: [5, 42], s: [0.2, 0.85], l: [0.3, 0.9], x0: 0, x1: 1, y0: 0, y1: 1 },
  clothes: {
    1: clothes([40, 62], [0.5, 1]), // yellow jumper
    2: clothes([165, 200]), // teal hoodie
    5: clothes([200, 240]), // blue top
    15: clothes([195, 225], [0.2, 1]), // denim jacket
    16: clothes([350, 20], [0.55, 1], [0.4, 0.85]), // coral tee
    17: clothes([55, 110], [0.15, 1]), // green hoodie
    18: clothes([33, 55], [0.65, 1]), // yellow tee
    22: clothes([165, 200]), // teal sports tee
    24: clothes([12, 36], [0.75, 1], [0.35, 0.7]), // orange tracksuit
    27: clothes([55, 115], [0.12, 1]), // sage shirt
    25: clothes([330, 15], [0.3, 1]), // rose blazer (family days)
    26: clothes([15, 35], [0.3, 0.7], [0.15, 0.5]), // brown cardigan (family days)
  },
};
// The palettes a fan can get: hair (a colour and a lightness shift), skin (a lightness shift and a warmth), and plain
// clothes colours (the club's own come from its kit colours, data/setup.js COLOURS).
export const FAN_HAIR = [{ hex: '#2B1D14', dl: -0.12 }, { hex: '#5A3A22', dl: 0 }, { hex: '#C99A4B', dl: 0.25 }, { hex: '#8E3B1F', dl: 0.05 }, { hex: '#1B1B1B', dl: -0.2 }, { hex: '#9C9C9C', dl: 0.2 }];
export const FAN_SKIN = [{ dl: 0.08, dh: 2 }, { dl: 0, dh: 0 }, { dl: -0.1, dh: -2 }, { dl: -0.2, dh: -4 }, { dl: -0.3, dh: -5 }];
export const PLAIN_CLOTHES = ['#3B4252', '#6B6F78', '#2A6F97', '#4F772D', '#E9E6DE'];
