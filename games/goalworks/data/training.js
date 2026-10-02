// Training, fatigue, form and morale (Milestone 8, bible §13 / §18 / §19). Plain data: every number the rules in
// src/systems/training.js use, so they can be tuned in one place.
//
// Each club day (the M2 calendar) the squad trains: one team session focus for everyone, and an optional individual
// focus per player (then the day's XP splits TEAM_SHARE / 1 − TEAM_SHARE between them). Rest / Recovery trains nothing
// and recovers fatigue. Match days and the weekly day off are not training days.
//   dailyXP = baseXP × coachEffect × facilityEffect × moraleFactor × ageFactor × workloadFactor   (bible §13)
// coachEffect and facilityEffect are 1.0 until staff (M14) and facilities (M12). The XP goes into the focus's core stats
// by its weights; every XP_PER_POINT (more as the player nears his hidden potential) raises that stat by one.

// The ten focuses (bible §13 groups + Rest). stats: how the XP splits over the core stats. load: fatigue a normal day of
// it adds. art: the Batch 5 training icon. placeholder: no meaning of its own yet (Position Learning → M15, Ability
// Development → M26) — they train a little of everything.
export const FOCUSES = [
  { id: 'attack', name: 'Attack', stats: { ATK: 0.7, TEC: 0.15, PHY: 0.15 }, load: 8, art: 'training_tactic_01' },
  { id: 'technique', name: 'Technique', stats: { TEC: 0.7, ATK: 0.15, PAS: 0.15 }, load: 6, art: 'training_tactic_02' },
  { id: 'passing', name: 'Passing', stats: { PAS: 0.75, TEC: 0.25 }, load: 5, art: 'training_tactic_03' },
  { id: 'defence', name: 'Defence', stats: { DEF: 0.75, PHY: 0.25 }, load: 8, art: 'training_tactic_04' },
  { id: 'physical', name: 'Physical', stats: { PHY: 0.85, DEF: 0.15 }, load: 11, art: 'training_tactic_05' },
  { id: 'goalkeeping', name: 'Goalkeeping', stats: { DEF: 0.6, TEC: 0.25, PHY: 0.15 }, load: 6, art: 'training_tactic_06', keepers: true },
  { id: 'setpieces', name: 'Set Pieces', stats: { TEC: 0.5, PAS: 0.35, ATK: 0.15 }, load: 4, art: 'training_tactic_07' },
  { id: 'position', name: 'Position Learning', stats: { ATK: 0.2, TEC: 0.2, PAS: 0.2, DEF: 0.2, PHY: 0.2 }, load: 4, art: 'training_tactic_08', placeholder: 'M15' },
  { id: 'ability', name: 'Ability Development', stats: { ATK: 0.2, TEC: 0.2, PAS: 0.2, DEF: 0.2, PHY: 0.2 }, load: 5, art: 'training_tactic_09', placeholder: 'M26' },
  { id: 'rest', name: 'Rest / Recovery', stats: {}, load: 0, art: 'training_tactic_10', rest: true },
];
export const focusById = (id) => FOCUSES.find((f) => f.id === id) ?? FOCUSES[1];
export const DEFAULT_FOCUS = 'technique';

// Team intensity: XP and fatigue both scale with it. Heavy is overtraining: much more fatigue for a little more XP.
export const INTENSITY = {
  light: { name: 'Light', xp: 0.75, load: 0.6 },
  normal: { name: 'Normal', xp: 1, load: 1 },
  heavy: { name: 'Heavy', xp: 1.25, load: 1.9 },
};
export const DEFAULT_INTENSITY = 'normal';

export const XP = {
  base: 10, // baseXP a training day
  coachEffect: 1, // (Milestone 14: × (1 + the Head Coach's coachPct); +u21XpPct for players 21 and under)
  facilityEffect: 1, // facilities: Milestone 12
  teamShare: 0.6, // with an individual focus: this share of the day's XP goes to the team session
  outfieldKeeping: 0.3, // an outfield player in a Goalkeeping session gains this share
  perPoint: 150, // XP for one core stat point while far from potential…
  nearSlow: 4, // …up to (1 + nearSlow) × that as the overall closes on the potential
  nearRange: 10, // (the slowing starts this many overall points short of it)
  // moraleFactor = moraleLow + (moraleHigh − moraleLow) × morale / 100   (morale 50 → 1.0)
  moraleLow: 0.85,
  moraleHigh: 1.15,
  // ageFactor by age band (the young learn fastest)
  age: [
    [18, 1.3],
    [21, 1.2],
    [24, 1.05],
    [28, 0.95],
    [31, 0.75],
    [99, 0.5],
  ],
  // workloadFactor = the intensity's xp × (a tired body learns less: from `tiredFrom` fatigue down to `tiredMin` at 100)
  tiredFrom: 60,
  tiredMin: 0.6,
};

// Fatigue 0–100 (bible §19).
export const FATIGUE = {
  start: 0, // a new squad (and an M7 save) starts fresh
  recoverDay: 4, // lost every day
  restExtra: 12, // … and this much more on a Rest / Recovery day or the day off
  match: 26, // a match played (the XI)
  weekOff: 7, // every 7th club day is a day off (no training)
  // injury risk (injuries arrive in M25): stored only — 0 until riskFrom fatigue, then up to riskMax at 100
  riskFrom: 70,
  riskMax: 0.3,
};

// Form −10…+10 (bible §18): mean-reverting; a small match modifier.
export const FORM = {
  min: -10,
  max: 10,
  drift: 0.3, // towards 0 each day
  win: 2,
  draw: 0,
  loss: -2,
  goal: 1.5, // each goal a player scored
  cleanSheet: 1, // keeper and back four when we kept one
  training: 0.35, // a training day moves form by up to this (seeded), better on light days, worse when tired
};

// Morale 0–100 (bible §18).
export const MORALE = {
  neutral: 50,
  drift: 0.5, // towards neutral each day
  win: 6,
  draw: 1,
  loss: -6,
  played: 2, // the XI, on top of the result
  benched: { Star: -5, Starter: -3, Rotation: -1, Prospect: 0 }, // left out, by squad role
};

// How condition changes a player's match numbers (all six engine numbers are multiplied). Neutral (fresh, form 0,
// morale 50) is exactly 1, so a squad at neutral plays the Milestone 7 match.
export const MATCH_CONDITION = {
  fatigueFrom: 50, // up to here: no effect
  fatigueSoft: 0.03, // lost by 70
  fatigueHard: 70, // above here it clearly hurts (bible §19): a further `fatigueSteep` per point
  fatigueSteep: 0.011,
  fatigueFloor: 0.65,
  form: 0.04, // ± at form ±10
  morale: 0.03, // ± at morale 0 / 100
};

// The Founder perks that switch on now (bible §5; the perk values live in data/setup.js FOUNDERS[].perk.effects):
//   xp               × (1 + value %) on the XP going into `stats` (all stats if none), for players in `positions` (all if
//                    none), in `focus` sessions (any if none) — for the whole squad
//   cleanSheetMorale + value morale for everyone after a clean sheet ("team confidence")
// Keys not listed here (familiarBackLinePct, tacticalFamiliarityPct, winExcitementPct) wait for their systems.
export const PERKS = {
  devGK: { kind: 'xp', positions: ['GK'] }, // Eli Mercer: +5% GK development
  cleanSheetConfidencePct: { kind: 'cleanSheetMorale' }, // Eli Mercer: +3% team confidence after a clean sheet
  devDEF: { kind: 'xp', stats: ['DEF'] }, // Mason Hale: +5% defending development
  devPAS: { kind: 'xp', stats: ['PAS', 'TEC'] }, // Milo Hart: +5% passing / technique development
  devPAC: { kind: 'xp', stats: ['PHY', 'TEC'] }, // Zoe Lane: +5% pace / technique development (pace grows from PHY)
  devATT: { kind: 'xp', stats: ['ATK'] }, // Leo Mercer: +5% attack development
  finishingDrillXpPct: { kind: 'xp', focus: 'attack' }, // Leo Mercer: finishing drill XP +5% (Attack sessions)
};
