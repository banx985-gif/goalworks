// Rivals (Milestone 22, bible §23 story rivals, §30 dynamic rivalry, §32 SEC-RIVAL-02…04; Kairosoft gap 5, the late
// twist). Plain data; the rules live in src/systems/rivals.js. No new system: rivalry feeds the existing challenges,
// rewards, match set-up, Season Review voices, secrets and News.
//
// The rivalry meter (0–100), one per club you have a history with:
//   a story rival starts at `start` once its league is reached (RV01 at the start: 40; RV02–RV07: 30); every other club
//   starts at 0
//   a competitive meeting +5; a final / promotion step (Promotion Match, Playoff, Decider, Promotion Final, Crown Title
//   Match, a cup final) +15 more; a rivalry match won or lost by 3+ goals +5; a player signed from them or sold to them
//   +10; a month without meeting −1. (A club that is not a rival only moves on finals / promotion steps — so a dynamic
//   rivalry is born of big matches, not of ordinary league meetings — and on the monthly fade.)
//   Bands: Cool 0–29, Heated 30–59, Fierce 60–84, Blood Feud 85+.
// What a band changes (EFFECTS):
//   banner     DERBY (RV01, the early derby) / RIVALS on Match Setup and the result — any rivalry match
//   rewards    Heated+: a win pays +50% reputation and Credits; a loss costs a little extra momentum (a dip; the bible
//              never takes away history)
//   cooldown   Heated+: the rival's rematch cooldown × 0.5 (it challenges you more often)
//   intensity  Fierce+: both XIs play at +3% (every match number, like Havoc's roll); the extra card risk is only stored
//              for the M25 discipline system
//   crowd      a rivalry match: the crowd's cheers jump higher and last longer (the game has no crowd audio yet)
//   fans       the Season Review's Fans voice weighs a rival result by its band (Cool 0.5 … Blood Feud 2)
// A dynamic rival: any club that is not a story rival, once its meter reaches 60. It fades (stops being a rival) when the
// meter drops below 30, unless SEC-RIVAL-02 made it permanent.

export const METER = {
  max: 100,
  meeting: 5,
  big: 15, // on top of the meeting's +5
  bigWin: 5, // a rivalry match won or lost by `bigMargin`+ goals
  bigMargin: 3,
  transfer: 10, // a player signed from them / sold to them
  monthly: -1, // a month (28 days) without meeting
  dynamicAt: 60,
  fadeBelow: 30,
};

export const BANDS = [
  { id: 'cool', name: 'Cool', min: 0, colour: '#5B8DB8', fans: 0.5 },
  { id: 'heated', name: 'Heated', min: 30, colour: '#E8A33D', fans: 1 },
  { id: 'fierce', name: 'Fierce', min: 60, colour: '#D9572B', fans: 1.5 },
  { id: 'feud', name: 'Blood Feud', min: 85, colour: '#A3192B', fans: 2 },
];

export const EFFECTS = {
  rewardBand: 'heated', // from this band up
  winMult: 1.5, // reputation and Credits for a win
  lossDip: 0.5, // × the tier's normal loss of momentum, taken on top of it
  cooldownBand: 'heated',
  cooldownMult: 0.5,
  intensityBand: 'fierce',
  intensity: 0.03, // both XIs
  cardRisk: 0.1, // (M25) a Fierce / Blood Feud derby: the referee is 10% stricter with cards (src/match/setPieces.js)
  crowdRoar: 1.6, // × the crowd's cheer (jump height and length)
  derbyFever: 0.02, // (SEC-RIVAL-03) your XI at home in a rivalry match
};

// The eight story rivals (bible §23). club: the club id in data/fixtures.js (RV08 has none: a hidden club, M28).
// manager: who speaks in the rival News lines (M22b gives Danny Vale, Gaz Holroyd and Vincent Crane their faces; the
// others are plain names for now). style: the bible's.
export const STORY_RIVALS = [
  { id: 'RV01', club: 'REG03', league: 'regional', start: 40, identity: 'Early derby', style: 'Direct football, physical', manager: 'Danny Vale', role: 'manager', cast: 'danny_vale', banner: 'DERBY' },
  { id: 'RV02', club: 'CNT01', league: 'county', start: 30, identity: 'Promotion rival', style: 'Wide play', manager: 'Harry Penhale', role: 'manager', banner: 'RIVALS' },
  { id: 'RV03', club: 'NAT02', league: 'national', start: 30, identity: 'Hard-running rival', style: 'High press', manager: 'Gaz Holroyd', role: 'manager', cast: 'gaz_holroyd', banner: 'RIVALS' },
  { id: 'RV04', club: 'CHP01', league: 'championship', start: 30, identity: 'Technical rival', style: 'Possession', manager: 'Clive Ashton', role: 'manager', banner: 'RIVALS' },
  { id: 'RV05', club: 'PRE01', league: 'premier', start: 30, identity: 'Historic-power rival', style: 'Fast transitions', manager: 'Billy Rourke', role: 'manager', banner: 'RIVALS' },
  { id: 'RV06', club: 'PRE03', league: 'premier', start: 30, identity: 'Money-power rival', style: 'Elite possession', manager: 'Vincent Crane', role: 'chairman', cast: 'vincent_crane', banner: 'RIVALS' },
  { id: 'RV07', club: 'PRE02', league: 'premier', start: 30, identity: 'Fan-power rival', style: 'Direct and intense', manager: 'Ned Tait', role: 'manager', banner: 'RIVALS' },
  // RV08: data only until SEC-RIVAL-01 (M28): a "???" row on the Rivals screen; ?debug=1 can unlock the row. It copies
  // your most-used formation and counters your style (rivals.js ghostSide).
  { id: 'RV08', club: null, league: null, start: 50, identity: 'Prestige', style: 'Adaptive: copies your shape, counters your style', name: 'Ghost Eleven', manager: '???', role: 'manager', banner: 'RIVALS', secret: 'SEC-RIVAL-01', crest: 'ui_28' },
];
export const storyById = (id) => STORY_RIVALS.find((r) => r.id === id) ?? null;
export const storyForClub = (clubId) => STORY_RIVALS.find((r) => r.club === clubId) ?? null;

// The rival manager's lines before and after a rivalry match (News; {m} the manager, {club} his club, {us} yours).
// Picked by the match's seed, so the same match always says the same thing. A chairman speaks for RV06.
export const LINES = {
  before: [
    '{m} ({club}): “We’ve been looking forward to this one all month.”',
    '{m} ({club}): “My lot will run through walls on Saturday. Hope {us} brought spare legs.”',
    '{m} ({club}): “Derby day. Nobody remembers second place in this one.”',
    '{m} ({club}): “I’ve told the kit man to pack the lucky socks. Twice.”',
    '{m} ({club}): “Form goes out of the window in this fixture.”',
  ],
  ourWin: [
    '{m} says {us} got lucky: “The ball bounced for them all day.”',
    '{m} ({club}): “Fair play. Enjoy it, because it won’t happen again.”',
    '{m} blames the pitch, the referee and the pies after defeat to {us}.',
  ],
  ourLoss: [
    '{m} ({club}): “Bragging rights are ours. Tell {us} to come back when they’ve grown up.”',
    '{m} was seen dancing in the dugout after beating {us}.',
    '{m} ({club}): “That’s how you play a derby.”',
  ],
  draw: [
    '{m} ({club}): “A point each. Nobody sleeps happy tonight.”',
    '{m} ({club}): “We’ll settle this next time.”',
  ],
  formed: '{club} and {us} have met in too many big games: a new rivalry is born!',
  faded: 'The rivalry with {club} has cooled off: just another club again.',
};

// SEC-RIVAL-04 Poached Captain's prize: a short News chain over the next weeks (days after the signing).
export const POACH_CHAIN = [
  { after: 0, text: '{p} swaps {club} for {us}! The {club} captain has been poached.' },
  { after: 3, text: '{m} ({club}): “Snakes. The lot of them. We gave that lad everything.”' },
  { after: 10, text: 'Fans of {club} burn their {p} shirts outside the ground. Fans of {us} buy twice as many.' },
  { after: 21, text: 'The Evening Whistle: “{p} says joining {us} was the easiest choice he ever made.”' },
];

// The late twist (Kairosoft gap 5): from Year 19, or on reaching the Crown Premier if later, the Premier clubs counter
// your most-used formation. They read your last `window` competitive matches; only a formation used in at least `share`
// of them is "worked out". The counter: the formation and build style that score best against it (COUNTERS, measured
// with the M9 engine: tools/gw_m22_counters.mjs). The cap (DECISIONS, M22): a club counters you in every other meeting
// with it (`every`), and never with a stat edge — at Crown Premier level even +1% to an XI is about 8 points of win rate.
// Mix your shapes (none in `share` of your last matches) and there is nothing to counter.
export const TWIST = {
  year: 19,
  league: 'premier',
  window: 20,
  share: 0.5,
  every: 2, // the cap: every other meeting with that club (its meetings count even: the first one after the twist)
  newsLine: 'The big clubs have worked you out: Premier sides now set up to beat your favourite formation. Changing your shape now and then keeps them guessing.',
};

// Your formation → the Premier side's counter { formation, build } (on top of the club's own instructions). Measured by
// tools/gw_m22_counters.mjs on 31 Oct (10 matches a pairing; both XIs one Crown Premier squad, you on Balanced, them on
// Attacking): for each of your formations, every opponent shape × build; the best goal difference for them (in brackets).
export const COUNTERS = {
  442: { formation: '532', build: 'counter' }, // (+0.9)
  433: { formation: '352', build: 'possession' }, // (+1.5)
  4231: { formation: '4231', build: 'direct' }, // (+1.8)
  352: { formation: '442', build: 'direct' }, // (+0.7)
  343: { formation: '532', build: 'direct' }, // (+1.0)
  532: { formation: '442', build: 'possession' }, // (+0.2)
  4141: { formation: '442', build: 'direct' }, // (+1.4)
  4411: { formation: '4411', build: 'direct' }, // (+1.3)
};
