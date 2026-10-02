// The 35 facilities (Milestone 12, bible §27) and the ground they stand on. Plain data; the rules live in
// src/systems/facilities.js (on core/FacilitySystem) and the drawing in src/screens/ClubScreen.js.
//
// One grid tile here is one bible footprint unit (a 3×5 pitch is 5 tiles by 3: its art runs goal to goal along col). w = tiles along col (screen lower
// right), h = tiles along row (screen lower left). cost = placeholder Credits (bible §25 money arrives in M23; the
// money scale stays a placeholder — docs/DECISIONS.md). Selling pays back 50% (bible §27).
// unlock: 'start' = on the ground from day one (and in the Shop again if sold); 'E'…'S' = the Club Rank (M10) the club
// must have reached; 'secret' = never in normal play (F34 / F35 come from the Secret Engine, M28) — hidden, not greyed.
// role: the seven station roles (bible §6). open: an open-air space (players drill on it); otherwise a building (players
// stand at its front). core: the club can't run without it (it can be moved, not sold).
// effects: [{ key, value }] summed by src/systems/facilities.js bonus(data, key). live: the key changes a system now
// (see EFFECT_KEYS); otherwise the effect is stored and `waits` names the milestone that brings it.
// Milestone 12c (bible addendum §A): facility levels 1–3, bought with Credits from the Facility Detail sheet. Level 2 needs
// Club Rank D, level 3 Club Rank C; an upgrade takes a few club days (the facility works at its old level meanwhile).
// Each level strengthens the facility's effect ×1.0 / ×1.5 / ×2.0 (core/FacilitySystem levels). A count or unlock
// (FLAG_KEYS) doesn't scale; those facilities get a smaller extra at levels 2–3 instead (LEVEL_EXTRAS). Selling pays back
// half of everything spent on it, upgrades included. Prices are a share of the build price (placeholder Credits).
export const LEVELS = {
  max: 3,
  mult: [1, 1.5, 2],
  names: ['1', '2', '3'],
  rank: [null, 'D', 'C'], // the Club Rank each level needs
  costShare: [0, 0.6, 1.2], // × the build price
  days: [0, 3, 5],
};
const FLAG_KEYS = new Set(['teamTraining', 'office', 'scoutDesk', 'kitCare', 'academyIntake', 'academyFull', 'youthPotential', 'physicalCap', 'trainingGroups', 'scoutCandidates', 'legendBonus', 'weatherProof', 'globalScouting', 'legendEvolution', 'prestigeTraining']);
// The extra each level above 1 gives (value per level: level 2 = ×1, level 3 = ×2).
const LEVEL_EXTRAS = {
  F01: [{ key: 'xp:all', value: 3 }], // a better pitch: every session a little better
  F11: [{ key: 'xp:all', value: 2 }],
  F03: [{ key: 'familiarityPct', value: 3 }], // a better office: tactics sink in faster
  F04: [{ key: 'scoutingPct', value: 5 }],
  F06: [{ key: 'storeSize', value: 4 }], // a bigger Kit Room: the Club Store holds more items
  F25: [{ key: 'scoutingPct', value: 4 }],
};
export const FACILITIES = [
  { id: 'F01', name: 'Starter Training Pitch', w: 5, h: 3, effect: 'Basic team training', unlock: 'start', cost: 3000, role: 'Maker', open: true, core: true, effects: [{ key: 'teamTraining', value: 1 }] },
  { id: 'F02', name: 'Clubhouse', w: 4, h: 4, effect: 'Morale / rest hub', unlock: 'start', cost: 2500, role: 'Rest spot', core: true, effects: [{ key: 'moraleDay', value: 0.2 }, { key: 'restPct', value: 10 }] },
  { id: 'F03', name: 'Manager Office', w: 2, h: 2, effect: 'Board / contracts', unlock: 'start', cost: 1200, role: 'Front desk', core: true, effects: [{ key: 'office', value: 1 }] },
  { id: 'F04', name: 'Scout Desk', w: 2, h: 2, effect: 'Scouting reports', unlock: 'start', cost: 1000, role: 'Specialist desk', core: true, effects: [{ key: 'scoutDesk', value: 1 }] },
  { id: 'F05', name: 'Basic Medical Room', w: 2, h: 2, effect: 'Injury recovery', unlock: 'start', cost: 1200, role: 'Specialist desk', effects: [{ key: 'injuryRecoveryPct', value: 5 }] },
  { id: 'F06', name: 'Kit Room', w: 2, h: 2, effect: 'Kit / equipment management', unlock: 'start', cost: 800, role: 'Arena link', effects: [{ key: 'kitCare', value: 1 }] },
  { id: 'F07', name: 'Small Gym', w: 3, h: 3, effect: '+5% Physical training', unlock: 'start', cost: 1500, role: 'Specialist desk', effects: [{ key: 'xp:physical', value: 5 }] },
  { id: 'F08', name: 'Tactics Board Room', w: 2, h: 2, effect: '+5% tactical familiarity', unlock: 'start', cost: 1200, role: 'Maker', effects: [{ key: 'familiarityPct', value: 5 }] },
  { id: 'F09', name: 'Youth Corner', w: 3, h: 3, effect: 'Basic academy intake', unlock: 'E', cost: 2000, role: 'Specialist desk', effects: [{ key: 'academyIntake', value: 1 }] },
  { id: 'F10', name: 'Fan Kiosk', w: 2, h: 2, effect: 'Small matchday income', unlock: 'E', cost: 900, role: 'Showcase', effects: [{ key: 'matchdayIncomePct', value: 3 }] },
  { id: 'F11', name: 'Second Training Pitch', w: 5, h: 3, effect: '+1 training group', unlock: 'D', cost: 4000, role: 'Maker', open: true, effects: [{ key: 'trainingGroups', value: 1 }] },
  { id: 'F12', name: 'Recovery Pool', w: 3, h: 3, effect: 'Fatigue recovery +8%', unlock: 'D', cost: 3500, role: 'Rest spot', effects: [{ key: 'recoveryPct', value: 8 }] },
  { id: 'F13', name: 'Video Room', w: 2, h: 3, effect: 'Opponent scouting +8%', unlock: 'D', cost: 2500, role: 'Thinker', effects: [{ key: 'scoutingPct', value: 8 }, { key: 'rpDay', value: 2 }] },
  { id: 'F14', name: 'Academy Building', w: 4, h: 4, effect: 'Full youth system', unlock: 'D', cost: 6000, role: 'Specialist desk', effects: [{ key: 'academyFull', value: 1 }] },
  { id: 'F15', name: 'Physio Suite', w: 3, h: 3, effect: 'Injury recovery +10%', unlock: 'D', cost: 3500, role: 'Specialist desk', effects: [{ key: 'injuryRecoveryPct', value: 10 }] },
  { id: 'F16', name: 'Strength Centre', w: 3, h: 3, effect: 'Physical cap training', unlock: 'C', cost: 6000, role: 'Maker', effects: [{ key: 'physicalCap', value: 1 }] },
  { id: 'F17', name: 'Skills Cage', w: 3, h: 3, effect: 'Technique training +8%', unlock: 'C', cost: 5000, role: 'Maker', open: true, effects: [{ key: 'xp:technique', value: 8 }] },
  { id: 'F18', name: 'Finishing Range', w: 3, h: 4, effect: 'Attack training +8%', unlock: 'C', cost: 5500, role: 'Maker', open: true, effects: [{ key: 'xp:attack', value: 8 }] },
  { id: 'F19', name: 'Passing Grid', w: 3, h: 4, effect: 'Passing training +8%', unlock: 'C', cost: 5500, role: 'Maker', open: true, effects: [{ key: 'xp:passing', value: 8 }] },
  { id: 'F20', name: 'Defensive Drill Yard', w: 3, h: 4, effect: 'Defence training +8%', unlock: 'C', cost: 5500, role: 'Maker', open: true, effects: [{ key: 'xp:defence', value: 8 }] },
  { id: 'F21', name: 'Goalkeeper Zone', w: 3, h: 4, effect: 'GK development +10%', unlock: 'C', cost: 5500, role: 'Maker', open: true, effects: [{ key: 'xp:goalkeeping', value: 10 }] },
  { id: 'F22', name: 'Advanced Medical Centre', w: 4, h: 4, effect: 'Injury prevention +8%', unlock: 'B', cost: 10000, role: 'Specialist desk', effects: [{ key: 'injuryPreventionPct', value: 8 }] },
  { id: 'F23', name: 'Nutrition Kitchen', w: 3, h: 3, effect: 'Fatigue / recovery +5%', unlock: 'B', cost: 7000, role: 'Rest spot', effects: [{ key: 'recoveryPct', value: 5 }] },
  { id: 'F24', name: 'Analytics Lab', w: 3, h: 3, effect: 'Tactical prep +10%', unlock: 'B', cost: 8000, role: 'Thinker', effects: [{ key: 'tacticalPrepPct', value: 10 }, { key: 'rpDay', value: 4 }] },
  { id: 'F25', name: 'Recruitment Office', w: 3, h: 3, effect: 'Extra transfer / scout candidate', unlock: 'B', cost: 7500, role: 'Front desk', effects: [{ key: 'scoutCandidates', value: 1 }] },
  { id: 'F26', name: 'Elite Academy', w: 5, h: 5, effect: 'Higher youth potential rolls', unlock: 'A', cost: 15000, role: 'Specialist desk', effects: [{ key: 'youthPotential', value: 1 }] },
  { id: 'F27', name: 'Sports Science Lab', w: 4, h: 4, effect: 'Training efficiency +8%', unlock: 'A', cost: 14000, role: 'Thinker', effects: [{ key: 'xp:all', value: 8 }] },
  { id: 'F28', name: 'Media Studio', w: 3, h: 3, effect: 'Sponsor / fan reputation +8%', unlock: 'A', cost: 11000, role: 'Showcase', effects: [{ key: 'sponsorFanPct', value: 8 }] },
  { id: 'F29', name: 'Merch Store', w: 3, h: 3, effect: 'Fan income +10%', unlock: 'A', cost: 10000, role: 'Showcase', effects: [{ key: 'fanIncomePct', value: 10 }] },
  { id: 'F30', name: 'Hospitality Suite', w: 4, h: 3, effect: 'Matchday income +10%', unlock: 'A', cost: 12000, role: 'Showcase', effects: [{ key: 'matchdayIncomePct', value: 10 }] },
  { id: 'F31', name: 'Trophy Museum', w: 4, h: 4, effect: 'History / legend bonuses', unlock: 'S', cost: 20000, role: 'Showcase', effects: [{ key: 'legendBonus', value: 1 }] },
  { id: 'F32', name: 'Indoor Dome', w: 5, h: 5, effect: 'Weather-proof training', unlock: 'S', cost: 25000, role: 'Maker', effects: [{ key: 'weatherProof', value: 1 }] },
  { id: 'F33', name: 'Elite Scouting Network', w: 4, h: 4, effect: 'Global / legendary scouting', unlock: 'S', cost: 22000, role: 'Specialist desk', effects: [{ key: 'globalScouting', value: 1 }] },
  { id: 'F34', name: 'Hall of Legends', w: 5, h: 5, effect: 'Prestige history + ability evolution boost', unlock: 'secret', secret: 'SEC-FAC-01', cost: 30000, role: 'Showcase', effects: [{ key: 'legendEvolution', value: 1 }] },
  { id: 'F35', name: 'Hidden Performance Lab', w: 4, h: 4, effect: 'Prestige training / secret ability checks', unlock: 'secret', secret: 'SEC-FAC-02', cost: 30000, role: 'Thinker', effects: [{ key: 'prestigeTraining', value: 1 }] },
].map((f) => ({
  ...f,
  art: `facility_${f.id.toLowerCase()}`,
  // (M12c) a count / unlock flag never scales with the level (scale: false); the facility's small extra for levels 2–3
  // (LEVEL_EXTRAS) is an effect only upgrades give (levelMult [0, 1, 2])
  effects: [...f.effects.map((e) => (FLAG_KEYS.has(e.key) ? { ...e, scale: false } : e)), ...(LEVEL_EXTRAS[f.id] ?? []).map((e) => ({ ...e, levelMult: [0, 1, 2], extra: true }))],
  noLevels: f.unlock === 'secret', // F34 / F35 don't level
}));
export const facilityById = (id) => FACILITIES.find((f) => f.id === id) ?? null;

// What each effect key does now. live: wired into a system this milestone (where); otherwise `waits` = the milestone
// that brings the system it belongs to.
export const EFFECT_KEYS = {
  teamTraining: { live: true, where: 'The team session trains here' },
  moraleDay: { live: true, where: 'Morale: every player +{v} a day', unit: '' },
  restPct: { live: true, where: 'Rest days recover {v}% more fatigue' },
  office: { live: true, where: 'League, tactics, transfers and contracts' },
  scoutDesk: { live: true, where: 'Scout reports' },
  'xp:physical': { live: true, where: 'Physical sessions: +{v}% XP' },
  'xp:technique': { live: true, where: 'Technique sessions: +{v}% XP' },
  'xp:attack': { live: true, where: 'Attack sessions: +{v}% XP' },
  'xp:passing': { live: true, where: 'Passing sessions: +{v}% XP' },
  'xp:defence': { live: true, where: 'Defence sessions: +{v}% XP' },
  'xp:goalkeeping': { live: true, where: 'Goalkeeping sessions: +{v}% XP' },
  'xp:all': { live: true, where: 'Every training session: +{v}% XP' },
  familiarityPct: { live: true, where: 'Tactical familiarity grows {v}% faster' },
  recoveryPct: { live: true, where: 'Fatigue recovers {v}% faster' },
  scoutingPct: { live: true, where: 'Scouting learns {v}% more a day' },
  scoutCandidates: { live: true, where: '+{v} player in every scout report' },
  rpDay: { live: true, where: 'Research: +{v} RP a day' }, // (Milestone 13: the Thinker rooms feed research)
  storeSize: { live: true, where: 'The Club Store holds {v} more items' }, // (Milestone 12c)
  injuryRecoveryPct: { waits: 'M25', what: 'injuries' },
  injuryPreventionPct: { waits: 'M25', what: 'injuries' },
  kitCare: { waits: 'M23', what: 'the club finances (kit and equipment costs)' },
  academyIntake: { waits: 'M15', what: 'the academy' },
  academyFull: { waits: 'M15', what: 'the academy' },
  youthPotential: { waits: 'M15', what: 'the academy' },
  physicalCap: { waits: 'M15', what: 'player potential and caps' },
  trainingGroups: { waits: 'M14', what: 'coaching staff (separate training groups)' },
  tacticalPrepPct: { waits: 'M14', what: 'the Analyst (match preparation)' },
  matchdayIncomePct: { waits: 'M23', what: 'matchday income' },
  fanIncomePct: { waits: 'M23', what: 'fans and fan income' },
  sponsorFanPct: { waits: 'M23', what: 'sponsors and fans' },
  legendBonus: { waits: 'M27', what: 'club history' },
  weatherProof: { waits: 'M24', what: 'matchday and stadium conditions' },
  globalScouting: { waits: 'M18', what: 'scouting beyond the Regional and County leagues' },
  legendEvolution: { waits: 'M28', what: 'the Secret Engine' },
  prestigeTraining: { waits: 'M28', what: 'the Secret Engine' },
};

// The Club Rank order (data/league.js RANKS ids).
export const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];

// The ground grows as the Club Rank rises (the Regional ground first). Each stage is a rectangle from (0, 0): it only ever
// grows to the right (col) and the front (row), so a facility already placed never moves. The gate sits in the middle of
// the front edge (its tile is always kept clear: everyone comes in there). The stage reached is kept even if reputation
// momentum later dips below the rank.
export const STAGES = [
  { rank: 'E', name: 'Regional Ground', cols: 11, rows: 12 },
  { rank: 'D', name: 'Local Ground', cols: 15, rows: 14 },
  { rank: 'C', name: 'Town Ground', cols: 20, rows: 16 },
  { rank: 'B', name: 'Professional Ground', cols: 23, rows: 18 },
  { rank: 'A', name: 'Elite Complex', cols: 26, rows: 21 },
  { rank: 'S', name: 'World-Class Complex', cols: 30, rows: 24 },
];
export const gateOf = (stage) => ({ col: Math.floor(stage.cols / 2), row: stage.rows - 1 });

// The starting facilities on the Regional ground (a new club, and an older save once). ids name the three the Founder
// visits (and the tests): pitch, office, scout.
export const START_LAYOUT = [
  { def: 'F01', col: 0, row: 0, name: 'pitch' },
  { def: 'F03', col: 7, row: 1, name: 'office' },
  { def: 'F06', col: 9, row: 1 },
  { def: 'F05', col: 0, row: 4 },
  { def: 'F07', col: 3, row: 4 },
  { def: 'F02', col: 6, row: 6, name: 'clubhouse' },
  { def: 'F04', col: 0, row: 7, name: 'scout' },
  { def: 'F08', col: 2, row: 9 },
];

// Where the squad goes for each training focus (data/training.js FOCUSES): the first of these that is built, in order;
// a facility that is full sends the rest on down the list. A training pitch always takes the overflow. Rest goes to the
// Recovery Pool or the Clubhouse.
export const FOCUS_PLACES = {
  attack: ['F18', 'F11', 'F01'],
  technique: ['F17', 'F11', 'F01'],
  passing: ['F19', 'F11', 'F01'],
  defence: ['F20', 'F11', 'F01'],
  physical: ['F16', 'F07', 'F11', 'F01'],
  goalkeeping: ['F21', 'F11', 'F01'],
  setpieces: ['F18', 'F11', 'F01'],
  position: ['F11', 'F01'],
  ability: ['F17', 'F11', 'F01'],
  rest: ['F12', 'F23', 'F02'],
};
export const PITCHES = ['F01', 'F11'];
export const REST_PLACES = ['F12', 'F23', 'F02'];
// How many players a place takes at once: open-air spaces by their size, buildings at their front.
export const capacityOf = (def) => (def.open ? Math.min(12, def.w * def.h - 3) : Math.min(6, def.w + def.h - 1));

// The facility art: drawn width = the footprint's diamond width × LOOK.width (the same for every facility, so the set
// stays at one scale); the footprint's front corner sits LOOK.foot down the picture. A few pictures have more empty
// margin or a taller roof — `art` tweaks them (width / foot).
export const ART_LOOK = { width: 1.12, foot: 0.86 };
export const ART_TWEAK = {
  F01: { foot: 0.86 },
  F02: { width: 1.08, foot: 0.88 },
  F10: { width: 1.2, foot: 0.84 },
  F12: { foot: 0.85 },
  F14: { foot: 0.84 },
  F22: { foot: 0.88 },
  F28: { foot: 0.9 },
  F29: { foot: 0.88 },
  F30: { foot: 0.9 },
  F31: { foot: 0.93 },
  F32: { foot: 0.9 },
};
