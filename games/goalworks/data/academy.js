// The academy (Milestone 15, bible §10 / §12 Youth Coach / facilities F09 / F14 / F26 / research R13–R18). Plain data; the
// rules live in src/systems/academy.js and the sheets in src/screens/academySheets.js. Every number is a placeholder
// for the M35 balance soak.
//
// One intake window a campaign year (the trials): it opens on Day 1 of INTAKE.month and closes at that month's end. The
// trials need a Youth Corner (F09); the Academy Building (F14) is the full youth system (one more trial player, better
// rolls, more places), the Elite Academy (F26) higher potential rolls; each facility level above 1 strengthens them.
// Up to INTAKE.signMax players can be signed from one intake, each into a free academy place (the academy cap is not
// raised by signing). The first intake also takes the M7 youth watch list.

export const INTAKE = {
  month: 3, // the trials: Month 3 of every campaign year (Day 1 – Day 28)
  count: [3, 4], // trial players with a Youth Corner (a seeded roll in this range) …
  academyFull: 1, // … +1 with an Academy Building
  trialsChance: 0.5, // R13 Grassroots Links (youthTrials): this chance of one more
  levelChance: 0.25, // each level above 1 of the Youth Corner / Academy Building: this chance of one more
  min: 3,
  max: 6,
  signMax: 3, // signed from one intake at most
  newFromWatch: 1, // the first intake (with the watch list in it) still has at least this many new faces
  positions: ['GK', 'DF', 'DF', 'MF', 'MF', 'WG', 'FW', 'FW'],
  ages: [15, 18],
};

// Hidden potential (bible §10): rolled at the trials and stored exactly (the projection); the player only ever sees a range.
// roll = mean + sd × z (z: a bell from three uniform numbers), then at least the player's overall + `room`, at most `cap`.
export const POTENTIAL = {
  mean: 60,
  sd: 7,
  academyFull: 3, // the Academy Building: better rolls
  youthPotential: 4, // per point of youthPotential (the Elite Academy, R17 Elite Academy Path)
  perLevel: 1, // each level above 1 of the Youth Corner / Academy Building / Elite Academy
  room: 5,
  cap: 90,
  rareFrom: 74, // a projection this high is a Rare player (generated tiers stay Standard / Rare)
  golden: { chance: 0.08, boost: 6 }, // R18 Golden Generation: this chance of a golden intake (every roll + boost)
};

// A young player's stats at the trials are this share of an adult's of the same level (they grow into them).
export const YOUTH_SCALE = { 15: 0.78, 16: 0.82, 17: 0.86, 18: 0.9 };

// A rare breakthrough (bible §10): a player in the academy beats his projection. Checked on Day 1 of every month for each
// player at the academy (not out on loan): `chance` (× academyFull with an Academy Building), up to `step` at a time,
// never more than `max` over the projection in all.
export const BREAKTHROUGH = { chance: 0.005, academyFull: 1.5, step: [1, 3], max: 5 };

// How well potential is read (0 … 1): what the range's width comes from. width = minWidth + (maxWidth − minWidth) × (1 − a).
export const REVEAL = {
  maxWidth: 20,
  minWidth: 2, // never an exact number from the range itself
  base: 0.1,
  youthCoach: 0.2, // any Youth Coach on the staff
  revealScale: 1.5, // × youthRevealPct / 100 (YC03 Wonderkid Eye: +10% → +0.15)
  scout: 0.1, // any Scout on the staff
  localEye: 0.2, // × the Scout's Local Eye share (SC01: 50% → +0.1; academy players are local)
  scoutingPct: 0.004, // × scoutingPct (the Video Room, scouting research)
  youthTrials: 0.1, // R13 Grassroots Links
  academyFull: 0.1, // the Academy Building
  elite: 0.1, // the Elite Academy
  perLevel: 0.03, // each level above 1 of the three
  perSeason: 0.1, // each season he has spent at the academy …
  seasonsMax: 2, // … for up to this many
};
// The label beside the range (its midpoint).
export const LABELS = [
  [57, 'Squad player'],
  [64, 'Decent prospect'],
  [71, 'Good prospect'],
  [78, 'Strong prospect'],
  [99, 'Future star'],
];

// The academy squad's places (the best academy facility on the ground, + perLevel for each of its levels above 1).
export const PLACES = { F09: 6, F14: 10, F26: 14, perLevel: 1 };

// Daily training (the Milestone 8 system: the academy session focus + each prospect's individual focus, normal intensity).
// Academy XP +%: the Academy Building, each academy facility level above 1, the Youth Coach (academyXpPct), research
// (youthXpPct) and a mentor (MENTOR.xpPct + mentorPct). A prospect out on loan gains `loanShare` of a day's XP (match
// minutes) and moves no retraining.
export const ACADEMY_XP = { academyFull: 10, perLevel: 5, loanShare: 0.6 };
export const DEFAULT_ACADEMY_FOCUS = 'technique';

// Mentoring: a senior player of the same position, one prospect each.
export const MENTOR = { xpPct: 8 };

// Ages: an academy player leaves at the season's end once he is older than maxAge (promote him first); promotion from
// promoteMin, loans from loanMin.
export const AGES = { maxAge: 19, promoteMin: 16, loanMin: 17 };

// Youth loans (the M11 loans): a Regional club takes a prospect for half a season if he is no more than `gap` overall
// below their squad's average (they give youngsters games). No fee either way; he comes back to the academy.
export const YOUTH_LOAN = { gap: 14 };

// The Club Complex: up to this many academy players train at the Academy Building / Youth Corner (inside the 24-walker cap).
export const FIGURES = 5;

// The plain words (sheets, banners, hint line).
export const ACADEMY_TEXT = {
  noCorner: 'Build a Youth Corner (Build → Shop) to hold the yearly trials.',
  trialsMonth: `The trials are held every Month ${INTAKE.month}.`,
  noYouthCoach: 'No Youth Coach: potential is hard to read (wide ranges). Hire one in Staff.',
  breakthrough: (name) => `${name} is beating his projected potential!`,
};
