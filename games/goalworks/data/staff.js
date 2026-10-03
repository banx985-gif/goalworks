// Support staff (Milestone 14, bible §12): five roles × five named hires (Standard / Rare / Elite / Legendary / Secret).
// Plain data only; src/systems/staff.js runs the hiring on core/StaffModel + core/StaffSystem and adds the hired staff's
// effects to the shared effect query (src/systems/effects.js). One of each role at a time (a second Head Coach etc. needs a
// later facility / research). Legendary and Secret staff never appear in normal play (secret / NG+ unlocks, M28 / M29);
// ?debug=1 shows them as a preview, never hireable. Wages, signing fees and release pay are placeholder Credits (the
// money scale is left for M23 / M35 — docs/DECISIONS.md).
//   effects: [{ key, value }] — keys in STAFF_EFFECTS (live: wired now; waits: the milestone that brings its system)
//   plain:   the effect in plain words for the Staff card

// stations: where the staff member works on the Club Complex, the first one built wins; otherwise they wait at the
// Clubhouse (F02, always on the ground). verb: what the "Now" line says they are doing there.
export const STAFF_ROLES = [
  { id: 'HC', name: 'Head Coach', short: 'Coach', stations: ['F01', 'F11'], verb: 'Coaching', colour: '#E0533D', line: 'Runs training: better sessions, tactics that sink in, faster young players.' },
  { id: 'SC', name: 'Scout', short: 'Scout', stations: ['F04', 'F25'], verb: 'Reading reports', colour: '#D4A017', line: 'Goes out on scouting reports: closer ranges, more names, rarer finds.' },
  { id: 'PH', name: 'Physio', short: 'Physio', stations: ['F05', 'F15', 'F22'], verb: 'Treating players', colour: '#2E86C1', line: 'Keeps the squad fresh: faster recovery, less fatigue (injuries: M25).' },
  { id: 'YC', name: 'Youth Coach', short: 'Youth', stations: ['F09', 'F14', 'F26'], verb: 'Working with the youth', colour: '#3FA34D', line: 'Brings on the academy’s young players: more XP, faster position learning, potential read better.' },
  { id: 'AN', name: 'Analyst', short: 'Analyst', stations: ['F13', 'F24', 'F08'], verb: 'Studying match video', colour: '#7D3C98', line: 'Prepares each match: opponent clues, preparation, quicker changes in Manage.' },
];
export const STAFF_FALLBACK_STATION = 'F02';

// gate: when the tier can be hired — start, county (the County offer accepted: the County League itself is M17), rankB
// (Club Rank B or better), hidden (never in normal play). years: contract length in seasons.
export const STAFF_TIERS = {
  Standard: { gate: 'start', wage: 60, fee: 300, years: 2, colour: '#6B7B8C' },
  Rare: { gate: 'county', wage: 120, fee: 1500, years: 3, colour: '#2E86C1' },
  Elite: { gate: 'rankB', wage: 220, fee: 5000, years: 3, colour: '#7D3C98' },
  Legendary: { gate: 'hidden', unlock: 'secret unlock (M28)', wage: 400, fee: 12000, years: 3, colour: '#D4A017' },
  Secret: { gate: 'hidden', unlock: 'New Game+ secret (M29)', wage: 500, fee: 20000, years: 3, colour: '#C0392B' },
};
export const TIER_ORDER = ['Standard', 'Rare', 'Elite', 'Legendary', 'Secret'];
export const GATE_TEXT = { county: 'Opens once the County offer is accepted', rankB: 'Opens at Club Rank B' };

// Release: the club pays this many weeks of their wage. Extending a contract: this share of the signing fee, for the
// tier's contract length again. The last season's warning shows from this month.
export const STAFF_RULES = { releaseWeeks: 4, extendFeeShare: 0.5, warnMonth: 9 };

const S = (id, name, tier, trait, effect, eligibility, effects, plain) => ({ id, name, role: id.slice(0, 2), tier, trait, effect, eligibility, effects, plain, art: `staff_${id.toLowerCase()}` });
export const STAFF = [
  S('HC01', 'Ada Moss', 'Standard', 'Balanced Sessions', '+4% team training efficiency', 'Start', [{ key: 'coachPct', value: 4 }], 'Every player gets 4% more XP from every training session.'),
  S('HC02', 'Theo Cross', 'Rare', 'Shape Teacher', '+6% tactical familiarity', 'County', [{ key: 'familiarityPct', value: 6 }], 'Tactical familiarity grows 6% faster in training and matches.'),
  S('HC03', 'Nora Vale', 'Elite', 'Development Mind', '+8% XP to players 21 and under', 'Rank B', [{ key: 'u21XpPct', value: 8 }], 'Players aged 21 and under get 8% more training XP.'),
  S('HC04', 'Dax Crown', 'Legendary', 'Master Coach', '+10% all training and one extra ability-evolution check/season', 'Secret', [{ key: 'coachPct', value: 10 }, { key: 'evolutionChecks', value: 1 }], '10% more XP from all training, and one extra ability-evolution check a season.'),
  S('HC05', 'Coach Zero', 'Secret', 'Perfect System', '+12% training; tactics lose familiarity 50% slower', 'NG+ secret', [{ key: 'coachPct', value: 12 }, { key: 'familiarityFadePct', value: -50 }], '12% more XP from training; unused tactics fade half as fast.'),

  S('SC01', 'Mina Reed', 'Standard', 'Local Eye', 'narrows local potential ranges', 'Start', [{ key: 'localPotentialPct', value: 50 }], 'Potential ranges of Regional players and free agents are half as wide.'),
  S('SC02', 'Arun Pike', 'Rare', 'Networker', '+1 candidate per scout report', 'County', [{ key: 'scoutCandidates', value: 1 }], 'Every scout report lists one more player.'),
  S('SC03', 'Cass Ward', 'Elite', 'Hidden Gem', '+15% rare-player discovery chance', 'Rank B', [{ key: 'rareFindPct', value: 15 }], 'A 15% chance each report turns up a Rare player who would have been missed.'),
  S('SC04', 'Iris North', 'Legendary', 'World Eye', 'reveals one extra hidden trait', 'Secret', [{ key: 'hiddenTraitReveal', value: 1 }], 'Reveals one extra hidden trait on scouted players.'),
  S('SC05', 'Null Mercer', 'Secret', 'Impossible Find', 'can surface Secret player rumours when conditions are met', 'NG+ secret', [{ key: 'secretRumours', value: 1 }], 'Can surface Secret player rumours when the conditions are met.'),

  S('PH01', 'Jae Bell', 'Standard', 'Recovery Hands', '-5% recovery time', 'Start', [{ key: 'recoveryPct', value: 5 }], 'Fatigue recovers 5% faster every day (injury recovery: M25).'),
  S('PH02', 'Priya Stone', 'Rare', 'Load Manager', '-8% fatigue accumulation', 'County', [{ key: 'fatigueGainPct', value: -8 }], 'Players build up 8% less fatigue in training and matches.'),
  S('PH03', 'Mara Cross', 'Elite', 'Prevention', '+10% injury resistance', 'Rank B', [{ key: 'injuryResistPct', value: 10 }], '10% fewer injuries (stored until injuries arrive in M25).'),
  S('PH04', 'Dr. Selene Ward', 'Legendary', 'Return Strong', 'recovered players return with +5 morale', 'Secret', [{ key: 'returnMorale', value: 5 }], 'Players back from injury return with +5 morale.'),
  S('PH05', 'Dr. Zero Hale', 'Secret', 'Second Wind', 'one serious injury/season downgrades one severity tier', 'NG+ secret', [{ key: 'secondWind', value: 1 }], 'Once a season a serious injury drops one severity tier.'),

  S('YC01', 'Ben Moss', 'Standard', 'Patient', '+5% academy XP', 'Start', [{ key: 'academyXpPct', value: 5 }], 'Academy players get 5% more XP.'),
  S('YC02', 'Zoe Grant', 'Rare', 'Position Teacher', 'position learning +10%', 'County', [{ key: 'positionLearnPct', value: 10 }], 'Players retraining to a new position learn it 10% faster.'),
  S('YC03', 'Hana Vale', 'Elite', 'Wonderkid Eye', '+10% youth potential reveal accuracy', 'Rank B', [{ key: 'youthRevealPct', value: 10 }], 'Youth potential is read 10% more accurately: narrower ranges at the trials and in the academy.'),
  S('YC04', 'Milo Crest', 'Legendary', 'Golden Generation', 'one extra high-potential academy roll every second season', 'Secret', [{ key: 'goldenRoll', value: 1 }], 'One extra high-potential academy roll every second season.'),
  S('YC05', 'Sage Future', 'Secret', 'Prodigy Maker', 'eligible youth can exceed projected potential by +5', 'NG+ secret', [{ key: 'prodigyPotential', value: 5 }], 'Eligible youth can beat their projected potential by up to 5.'),

  S('AN01', 'Noor Reed', 'Standard', 'Match Notes', 'opponent weakness clue', 'Start', [{ key: 'weaknessClue', value: 1 }], 'Match Setup shows a clue to the opponent’s weakness.'),
  S('AN02', 'Eli Webb', 'Rare', 'Pattern Spotter', '+5% tactical prep effect', 'County', [{ key: 'tacticalPrepPct', value: 5 }], 'Match preparation +5%: the team starts each match a little more familiar with its tactics.'),
  S('AN03', 'Keira Moss', 'Elite', 'Live Read', 'Manage-mode tactical changes settle 20% faster', 'Rank B', [{ key: 'settleFasterPct', value: 20 }], 'A formation or instruction change in a match settles 20% sooner.'),
  S('AN04', 'Sol Quinn', 'Legendary', 'Counter Plan', 'reveals opponent tactical switch once/match', 'Secret', [{ key: 'counterPlan', value: 1 }], 'Once a match, warns you when the opponent is about to switch tactics.'),
  S('AN05', 'Vector Lane', 'Secret', 'Perfect Read', 'one pre-match weakness becomes exact', 'NG+ secret', [{ key: 'exactWeakness', value: 1 }], 'One pre-match weakness clue becomes exact.'),
];
export const staffById = (id) => STAFF.find((s) => s.id === id) ?? null;
export const roleById = (id) => STAFF_ROLES.find((r) => r.id === id) ?? null;

// What each staff effect key does now (keys shared with facilities / research add up in the one effect query).
export const STAFF_EFFECTS = {
  coachPct: { live: true, system: 'training' },
  u21XpPct: { live: true, system: 'training' },
  familiarityPct: { live: true, system: 'tactics' },
  familiarityFadePct: { live: true, system: 'tactics' },
  localPotentialPct: { live: true, system: 'scouting' },
  scoutCandidates: { live: true, system: 'scouting' },
  rareFindPct: { live: true, system: 'scouting' },
  recoveryPct: { live: true, system: 'fatigue' },
  fatigueGainPct: { live: true, system: 'fatigue' },
  weaknessClue: { live: true, system: 'match setup' },
  tacticalPrepPct: { live: true, system: 'match preparation' },
  settleFasterPct: { live: true, system: 'Manage' },
  injuryResistPct: { waits: 'M25', what: 'injuries' },
  returnMorale: { waits: 'M25', what: 'injuries' },
  secondWind: { waits: 'M25', what: 'injuries' },
  academyXpPct: { live: true, system: 'academy' }, // (Milestone 15)
  positionLearnPct: { live: true, system: 'position learning' },
  youthRevealPct: { live: true, system: 'academy' },
  goldenRoll: { waits: 'M28', what: 'the Secret Engine' }, // (Legendary / Secret: not in M15)
  prodigyPotential: { waits: 'M28', what: 'the Secret Engine' },
  evolutionChecks: { waits: 'M28', what: 'ability evolution' },
  hiddenTraitReveal: { waits: 'M28', what: 'hidden traits' },
  secretRumours: { waits: 'M28', what: 'the Secret Engine' },
  counterPlan: { waits: 'M28', what: 'the Secret Engine' },
  exactWeakness: { waits: 'M28', what: 'the Secret Engine' },
};

// Match settling (Milestone 14): a formation or team-instruction change in a match (Manage) takes a while to sink in. For
// `sec` match seconds after it the side carries an extra familiarity penalty that starts at `pen` (0 … 1, the same scale as
// an unfamiliar formation) and fades to nothing. The Analyst's Live Read shortens `sec`.
export const SETTLE = { sec: 40, pen: 0.5, refreshSec: 0.5 };

// The Analyst's opponent clue (AN01 Match Notes) on Match Setup: from the opponent's own tactics (data/tactics.js
// CLUB_TACTICS), the first rule that fits.
export const WEAKNESS_CLUES = [
  { when: { press: 'high' }, text: 'they press high and leave space behind: a Direct build gets in behind them' },
  { when: { line: 'deep' }, text: 'they sit deep: keep the ball and go wide to stretch them' },
  { when: { build: 'counter' }, text: 'they wait to counter: keep your line deep and don’t over-commit' },
  { when: { build: 'possession' }, text: 'they like the ball: press them high and they give it away' },
  { when: { build: 'direct' }, text: 'they go long early: a deep line wins the second balls' },
  { when: { mentality: 'defensive' }, text: 'they defend in numbers: patient passing finds the gaps' },
  { when: {}, text: 'their wide areas are thin: attack down the flanks' },
];
