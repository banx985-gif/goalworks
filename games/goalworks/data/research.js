// Research (Milestone 13, bible §28): the 36 visible nodes in six branches, the research queue and the Research Points
// (RP) that pay for them. Plain data; the rules live in src/systems/research.js (on core/ResearchSystem + UnlockRunner)
// and the sheet in src/screens/researchSheets.js.
//
// Every node: id, branch, name, tier (1–6, each branch in order), cost (RP paid when it starts), days (work days on the
// calendar once started), requires (the node before it in its branch), effects ([{ key, value }] — summed over every
// node done, read by src/systems/research.js effect(data, key) together with the facilities), unlocks (fired once by the
// UnlockRunner when it completes: formations, facilities), gives (one line for the sheet).
// PLACEHOLDER numbers (docs/DECISIONS.md — money and pacing stay placeholder until the M35 balance soak).

export const BRANCHES = [
  { id: 'training', name: 'Training', icon: 'ui_08' },
  { id: 'scouting', name: 'Scouting', icon: 'ui_09' },
  { id: 'academy', name: 'Academy', icon: 'ui_12' },
  { id: 'medical', name: 'Medical', icon: 'ui_13' },
  { id: 'tactics', name: 'Tactics', icon: 'ui_07' },
  { id: 'club', name: 'Club', icon: 'ui_05' },
];
export const RESEARCH_ICON = 'ui_26';
export const branchById = (id) => BRANCHES.find((b) => b.id === id) ?? null;

// RP and work days by tier (placeholder).
export const TIER_COST = [0, 40, 80, 140, 220, 320, 450];
export const TIER_DAYS = [0, 5, 8, 12, 16, 21, 28];

// The formations a new club has from the start; the other five come with R25 Formation Library (a save from before
// Milestone 13 keeps any formation it already uses).
export const START_FORMATIONS = ['442', '433', '4231'];
export const LIBRARY_FORMATIONS = ['352', '343', '532', '4141', '4411'];

const N = (id, branch, name, tier, gives, effects = [], unlocks = []) => ({ id, branch, name, tier, gives, effects, unlocks });
const LIST = [
  // Training
  N('R01', 'training', 'Session Planning', 1, '+5% XP in every session', [{ key: 'xp:all', value: 5 }]),
  N('R02', 'training', 'Position Coaching', 2, '+12% XP in Position and Ability sessions', [{ key: 'xp:position', value: 12 }, { key: 'xp:ability', value: 12 }]),
  N('R03', 'training', 'Technical Reps', 3, '+8% XP in Technique and Passing sessions', [{ key: 'xp:technique', value: 8 }, { key: 'xp:passing', value: 8 }]),
  N('R04', 'training', 'Physical Periodisation', 4, '+8% Physical XP; sessions tire players 10% less', [{ key: 'xp:physical', value: 8 }, { key: 'trainingLoadPct', value: -10 }]),
  N('R05', 'training', 'Advanced Roles', 5, '+8% XP in Attack, Defence and Goalkeeping sessions', [{ key: 'xp:attack', value: 8 }, { key: 'xp:defence', value: 8 }, { key: 'xp:goalkeeping', value: 8 }]),
  N('R06', 'training', 'Elite Development', 6, '+10% XP in every session', [{ key: 'xp:all', value: 10 }]),
  // Scouting
  N('R07', 'scouting', 'Local Network', 1, 'Scout reports come back 1 day sooner', [{ key: 'scoutDays', value: -1 }]),
  N('R08', 'scouting', 'Regional Network', 2, '+1 player in every scout report', [{ key: 'scoutCandidates', value: 1 }]),
  N('R09', 'scouting', 'National Network', 3, 'Report accuracy: scouting learns 15% more a day', [{ key: 'scoutingPct', value: 15 }]),
  N('R10', 'scouting', 'Contract Intelligence', 4, 'A closer look at one player takes 1 day less', [{ key: 'closerDays', value: -1 }]),
  N('R11', 'scouting', 'Potential Modelling', 5, 'Report accuracy: scouting learns 20% more a day', [{ key: 'scoutingPct', value: 20 }]),
  N('R12', 'scouting', 'Global Network', 6, '+1 player in every report, back 1 day sooner', [{ key: 'scoutCandidates', value: 1 }, { key: 'scoutDays', value: -1 }]),
  // Academy (the academy itself arrives in M15)
  N('R13', 'academy', 'Grassroots Links', 1, 'More local youngsters at the academy trials', [{ key: 'youthTrials', value: 1 }]),
  N('R14', 'academy', 'Youth Intake', 2, '+1 player in every youth intake', [{ key: 'youthIntakeSize', value: 1 }]),
  N('R15', 'academy', 'Position Schooling', 3, 'Academy players +10% XP', [{ key: 'youthXpPct', value: 10 }]),
  N('R16', 'academy', 'Mentor System', 4, 'Senior players mentor the academy (+10% youth growth)', [{ key: 'mentorPct', value: 10 }]),
  N('R17', 'academy', 'Elite Academy Path', 5, 'Higher youth potential rolls', [{ key: 'youthPotential', value: 1 }]),
  N('R18', 'academy', 'Golden Generation', 6, 'A rare chance of a golden youth intake', [{ key: 'goldenGeneration', value: 1 }]),
  // Medical
  N('R19', 'medical', 'Recovery Basics', 1, 'Fatigue recovers 5% faster', [{ key: 'recoveryPct', value: 5 }]),
  N('R20', 'medical', 'Load Monitoring', 2, 'Sessions tire players 8% less; the Recovery Pool can be built from Rank E', [{ key: 'trainingLoadPct', value: -8 }], [{ type: 'facility', id: 'F12' }]),
  N('R21', 'medical', 'Injury Prevention', 3, 'Injury risk −10%', [{ key: 'injuryPreventionPct', value: 10 }]),
  N('R22', 'medical', 'Rehab Planning', 4, 'Injuries heal 10% faster', [{ key: 'injuryRecoveryPct', value: 10 }]),
  N('R23', 'medical', 'Sports Science', 5, 'Fatigue recovers 8% faster', [{ key: 'recoveryPct', value: 8 }]),
  N('R24', 'medical', 'Return-to-Play', 6, 'Fewer re-injuries after a comeback', [{ key: 'reinjuryPct', value: -25 }]),
  // Tactics
  N('R25', 'tactics', 'Formation Library', 1, 'Five more formations: 3-5-2, 3-4-3, 5-3-2, 4-1-4-1, 4-4-1-1', [], LIBRARY_FORMATIONS.map((id) => ({ type: 'formation', id }))),
  N('R26', 'tactics', 'Pressing Principles', 2, 'Tactical familiarity grows 8% faster', [{ key: 'familiarityPct', value: 8 }]),
  N('R27', 'tactics', 'Transition Play', 3, 'Unused formations are forgotten 25% more slowly', [{ key: 'familiarityFadePct', value: -25 }]),
  N('R28', 'tactics', 'Set Pieces', 4, 'Set-piece routines (+8% set-piece threat)', [{ key: 'setPiecePct', value: 8 }]),
  N('R29', 'tactics', 'Opponent Analysis', 5, 'Match preparation +10%; the Video Room can be built from Rank E', [{ key: 'tacticalPrepPct', value: 10 }], [{ type: 'facility', id: 'F13' }]),
  N('R30', 'tactics', 'Adaptive Match Plans', 6, 'Tactical familiarity grows 10% faster, fades 25% more slowly', [{ key: 'familiarityPct', value: 10 }, { key: 'familiarityFadePct', value: -25 }]),
  // Club
  N('R31', 'club', 'Fan Programme', 1, 'Fan growth +8%', [{ key: 'fanGrowthPct', value: 8 }]),
  N('R32', 'club', 'Sponsor Relations', 2, 'Sponsor offers +8%', [{ key: 'sponsorPct', value: 8 }]),
  N('R33', 'club', 'Stadium Operations', 3, 'Matchday running costs −10%', [{ key: 'stadiumOpsPct', value: 10 }]),
  N('R34', 'club', 'Media Training', 4, 'Better answers after big moments (+fan trust)', [{ key: 'mediaPct', value: 10 }]),
  N('R35', 'club', 'Commercial Growth', 5, 'Commercial income +10%', [{ key: 'commercialPct', value: 10 }]),
  N('R36', 'club', 'World Reputation', 6, 'Reputation from continental matches +10%', [{ key: 'worldReputationPct', value: 10 }]),
];
// The tree: each branch in order, tier n needs tier n − 1 of the same branch.
export const NODES = LIST.map((n, i) => ({
  ...n,
  icon: branchById(n.branch).icon,
  cost: TIER_COST[n.tier],
  days: TIER_DAYS[n.tier],
  requires: n.tier > 1 ? [LIST[i - 1].id] : [],
  hidden: false,
}));
export const nodeById = (id) => NODES.find((n) => n.id === id) ?? null;

// What each effect key does now. live: wired into a system this milestone; otherwise waits = the milestone that brings it.
export const RESEARCH_EFFECTS = {
  'xp:all': { live: true, system: 'training' },
  'xp:position': { live: true, system: 'training' },
  'xp:ability': { live: true, system: 'training' },
  'xp:technique': { live: true, system: 'training' },
  'xp:passing': { live: true, system: 'training' },
  'xp:physical': { live: true, system: 'training' },
  'xp:attack': { live: true, system: 'training' },
  'xp:defence': { live: true, system: 'training' },
  'xp:goalkeeping': { live: true, system: 'training' },
  trainingLoadPct: { live: true, system: 'fatigue' },
  recoveryPct: { live: true, system: 'fatigue' },
  scoutDays: { live: true, system: 'scouting' },
  closerDays: { live: true, system: 'scouting' },
  scoutCandidates: { live: true, system: 'scouting' },
  scoutingPct: { live: true, system: 'scouting' },
  familiarityPct: { live: true, system: 'tactics' },
  familiarityFadePct: { live: true, system: 'tactics' },
  youthTrials: { waits: 'M15', what: 'the academy' },
  youthIntakeSize: { waits: 'M15', what: 'the academy' },
  youthXpPct: { waits: 'M15', what: 'the academy' },
  mentorPct: { waits: 'M15', what: 'the academy' },
  youthPotential: { waits: 'M15', what: 'the academy' },
  goldenGeneration: { waits: 'M15', what: 'the academy' },
  injuryPreventionPct: { waits: 'M25', what: 'injuries' },
  injuryRecoveryPct: { waits: 'M25', what: 'injuries' },
  reinjuryPct: { waits: 'M25', what: 'injuries' },
  setPiecePct: { waits: 'M25', what: 'set pieces' },
  tacticalPrepPct: { waits: 'M14', what: 'the Analyst (match preparation)' },
  fanGrowthPct: { waits: 'M23', what: 'fans' },
  sponsorPct: { waits: 'M23', what: 'sponsors' },
  stadiumOpsPct: { waits: 'M24', what: 'the stadium' },
  mediaPct: { waits: 'M23', what: 'fans and media' },
  commercialPct: { waits: 'M23', what: 'commercial income' },
  worldReputationPct: { waits: 'M21', what: 'continental competitions' },
};

// One research slot (bible §28). The second is shown locked: it needs Club Rank A and an Analytics Lab at level 2 —
// facility levels arrive later, so it cannot open yet.
export const QUEUES = [
  { id: 'main', name: 'Research' },
  { id: 'second', name: 'Second slot', rule: { rank: 'A', facility: 'F24', level: 2 }, lockedText: 'Rank A + Analytics Lab' },
];
// Research has no staff yet (M14): the Club Manager runs the one slot.
export const MANAGER_WORKER = { id: 'manager', name: 'Club Manager' };

// Research Points (placeholder): a small base each club day, plus the Video Room / Analytics Lab (facility effect rpDay,
// data/facilities.js); match results; firsts (the first win against each club, the first Promotion Match).
export const RP = {
  day: 4,
  result: { win: 6, draw: 3, loss: 1 },
  firstWin: 15, // the first win against each club
  firstPromotion: 30, // the first Promotion Match played
};
