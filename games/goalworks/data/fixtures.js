// Calendar, speeds and fixtures (Milestone 2, bible §3 / §21). Plain data; the rules live in src/systems/calendar.js.
//
// CALENDAR: 12 months × 28 days = 336 days a year; 1 game day = 2.5 real seconds at 1×.
// SPEEDS: Pause and 1× always; 2× only while a valid fixture is pending (until the Year-25 account unlock); 4× only
// after the NG+1 account unlock (nothing sets either unlock yet — ?debug=1 can flip them in the test fixtures sheet).
// FIXTURE_SOURCES: the only systems whose fixtures count. A fixture from anything else is refused, so there is no way to
// make a free friendly just to open 2×. `live: false` sources are the later tournament / event systems.
// Milestone 10: the Regional League's challenges (src/systems/league.js) replace the M2 Test Challenge, which is retired
// (not live): a fixture now only comes from a challenge a club has actually issued (the calendar asks the league).
export const CALENDAR = {
  daysPerMonth: 28,
  monthsPerYear: 12,
  secondsPerDay: 2.5,
  speeds: [1, 2, 4],
  matchGapDays: 7, // commit → kickoff, and the one-match-per-7-days rule
  weekDays: 7, // an in-game week (autosave boundary)
};

export const FIXTURE_SOURCES = [
  { id: 'test', name: 'Test Challenge', live: false, line: 'Retired in Milestone 10: the Regional League issues challenges now.' },
  { id: 'league', name: 'League challenge', live: true, line: 'A Regional club challenged you; accepted, it plays 7 days later.' },
  { id: 'tournament', name: 'Tournament round', live: false, line: 'Tournaments come later.' },
  { id: 'event', name: 'Event match', live: false, line: 'Events come later.' },
];
export const sourceById = (id) => FIXTURE_SOURCES.find((s) => s.id === id) ?? null;

// The Regional League clubs (bible §8, L1). Milestone 6: each has its crest (Batch 2 art) and its own kit colours (palette
// ids, picked from the crest). Milestone 10 (bible §21 — what each opponent has):
//   ground     its home ground's name
//   strength   × its generated squad's core stats (REG01 weakest … REG06 strongest; the six average 1.0)
//   rep        the reputation it wants from you before it issues challenges
//   cooldown   rematch cooldown: days after playing it before it challenges again
//   reward     reward tier 1–3 (Credits and reputation: data/league.js)
//   rivalry    rivalry effect — a placeholder until rivals (M30s)
//   (home / away alternates by meetings; its tactical identity is data/tactics.js CLUB_TACTICS; every Regional win counts
//   towards promotion — the progression flag)
export const REGIONAL_CLUBS = [
  { id: 'REG01', name: 'Fenland Folk', crest: 'club_reg01_crest', colours: { primary: 'green', secondary: 'gold' }, ground: 'Reedwater Meadow', strength: 0.88, rep: 0, cooldown: 14, reward: 1, rivalry: null },
  { id: 'REG02', name: 'Borderers', crest: 'club_reg02_crest', colours: { primary: 'red', secondary: 'gold' }, ground: 'Castle Gap Park', strength: 0.93, rep: 0, cooldown: 14, reward: 1, rivalry: null },
  { id: 'REG03', name: 'Moorlanders', crest: 'club_reg03_crest', colours: { primary: 'navy', secondary: 'gold' }, ground: 'Heather Top', strength: 0.97, rep: 120, cooldown: 16, reward: 2, rivalry: null },
  { id: 'REG04', name: 'Valley Folk', crest: 'club_reg04_crest', colours: { primary: 'gold', secondary: 'green' }, ground: 'Viaduct Lane', strength: 1.01, rep: 220, cooldown: 16, reward: 2, rivalry: null },
  { id: 'REG05', name: 'Coastfolk', crest: 'club_reg05_crest', colours: { primary: 'sky', secondary: 'white' }, ground: 'Lighthouse Road', strength: 1.05, rep: 340, cooldown: 18, reward: 3, rivalry: null },
  { id: 'REG06', name: 'Midlanders', crest: 'club_reg06_crest', colours: { primary: 'claret', secondary: 'gold' }, ground: 'Castle Works', strength: 1.09, rep: 460, cooldown: 18, reward: 3, rivalry: null },
];
export const clubById = (id) => REGIONAL_CLUBS.find((c) => c.id === id) ?? null;

// The account-wide speed unlocks (bible §3 / §36 account save). Nothing sets them yet.
export const SPEED_FLAGS = {
  perm2x: { label: 'Permanent 2×', why: 'Unlocks after finishing Year 25 once.' },
  perm4x: { label: '4× speed', why: 'Unlocks after finishing NG+1 once.' },
};
