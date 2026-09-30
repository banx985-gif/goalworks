// Calendar, speeds and fixtures (Milestone 2, bible §3 / §21). Plain data; the rules live in src/systems/calendar.js.
//
// CALENDAR: 12 months × 28 days = 336 days a year; 1 game day = 2.5 real seconds at 1×.
// SPEEDS: Pause and 1× always; 2× only while a valid fixture is pending (until the Year-25 account unlock); 4× only
// after the NG+1 account unlock (nothing sets either unlock yet — ?debug=1 can flip them in the test fixtures sheet).
// FIXTURE_SOURCES: the only systems whose fixtures count. A fixture from anything else is refused, so there is no way to
// make a free friendly just to open 2×. `live: false` sources are the later league / tournament / event systems; the
// temporary Test Challenge stands in for the league until Milestone 10.
export const CALENDAR = {
  daysPerMonth: 28,
  monthsPerYear: 12,
  secondsPerDay: 2.5,
  speeds: [1, 2, 4],
  matchGapDays: 7, // commit → kickoff, and the one-match-per-7-days rule
  weekDays: 7, // an in-game week (autosave boundary)
};

export const FIXTURE_SOURCES = [
  { id: 'test', name: 'Test Challenge', live: true, temporary: true, line: 'Temporary test fixture — stands in for the league until Milestone 10.' },
  { id: 'league', name: 'League challenge', live: false, line: 'Milestone 10.' },
  { id: 'tournament', name: 'Tournament round', live: false, line: 'Tournaments come later.' },
  { id: 'event', name: 'Event match', live: false, line: 'Events come later.' },
];
export const sourceById = (id) => FIXTURE_SOURCES.find((s) => s.id === id) ?? null;

// The Regional League clubs (bible §8, L1). The Test Challenge picks its opponent from here. Milestone 6: each has its
// crest (Batch 2 art) and its own kit colours (palette ids, picked from the crest).
export const REGIONAL_CLUBS = [
  { id: 'REG01', name: 'Fenland Folk', crest: 'club_reg01_crest', colours: { primary: 'green', secondary: 'gold' } },
  { id: 'REG02', name: 'Borderers', crest: 'club_reg02_crest', colours: { primary: 'red', secondary: 'gold' } },
  { id: 'REG03', name: 'Moorlanders', crest: 'club_reg03_crest', colours: { primary: 'navy', secondary: 'gold' } },
  { id: 'REG04', name: 'Valley Folk', crest: 'club_reg04_crest', colours: { primary: 'gold', secondary: 'green' } },
  { id: 'REG05', name: 'Coastfolk', crest: 'club_reg05_crest', colours: { primary: 'sky', secondary: 'white' } },
  { id: 'REG06', name: 'Midlanders', crest: 'club_reg06_crest', colours: { primary: 'claret', secondary: 'gold' } },
];
export const clubById = (id) => REGIONAL_CLUBS.find((c) => c.id === id) ?? null;

// The account-wide speed unlocks (bible §3 / §36 account save). Nothing sets them yet.
export const SPEED_FLAGS = {
  perm2x: { label: 'Permanent 2×', why: 'Unlocks after finishing Year 25 once.' },
  perm4x: { label: '4× speed', why: 'Unlocks after finishing NG+1 once.' },
};
