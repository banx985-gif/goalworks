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
  { id: 'league', name: 'League challenge', live: true, line: 'A club in your league challenged you; accepted, it plays 7 days later. (M17: County Shield ties come this way too.)' },
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
// Milestone 17: the County League clubs (bible §8, L2), the same fields. Their squads sit clearly above the Regional ones:
// strength 1.16 → 1.32 makes squads of about 69 → 79 overall (the top Regional band, REG06 ~65, +4 → +14). Reward tiers
// 4–6 (data/league.js: bigger than Regional). You only meet them once you are in the County League; the two weakest
// challenge a newly promoted club at once, the others want more reputation first. CNT01 Devonians is the future promotion
// rival RV02 (bible §23: data only, rivalry is M22).
export const COUNTY_CLUBS = [
  { id: 'CNT01', name: 'Devonians', crest: 'club_cnt01_crest', colours: { primary: 'green', secondary: 'white' }, ground: 'Tor View Park', strength: 1.16, rep: 0, cooldown: 14, reward: 4, rivalry: 'RV02' },
  { id: 'CNT02', name: 'Cornish', crest: 'club_cnt02_crest', colours: { primary: 'black', secondary: 'white' }, ground: 'Tin Mine Lane', strength: 1.19, rep: 0, cooldown: 14, reward: 4, rivalry: null },
  { id: 'CNT03', name: 'Somerset Folk', crest: 'club_cnt03_crest', colours: { primary: 'claret', secondary: 'white' }, ground: 'Orchard Ground', strength: 1.23, rep: 600, cooldown: 16, reward: 5, rivalry: null },
  { id: 'CNT04', name: 'Norfolkers', crest: 'club_cnt04_crest', colours: { primary: 'gold', secondary: 'green' }, ground: 'Broadland Road', strength: 1.26, rep: 750, cooldown: 16, reward: 5, rivalry: null },
  { id: 'CNT05', name: 'Suffolkers', crest: 'club_cnt05_crest', colours: { primary: 'royal', secondary: 'white' }, ground: 'Heathside', strength: 1.29, rep: 900, cooldown: 18, reward: 6, rivalry: null },
  { id: 'CNT06', name: 'Cumbrians', crest: 'club_cnt06_crest', colours: { primary: 'teal', secondary: 'gold' }, ground: 'Fellside', strength: 1.32, rep: 1100, cooldown: 18, reward: 6, rivalry: null },
];
// Milestone 18: the National League clubs (bible §8, L3), the same fields. Squads clearly above County: strength 1.40 →
// 1.58 makes squads of about 82 → 90 overall (the top County band, CNT06 ~78, +4 → +12; stats stop at 99, so the top end
// flattens). Reward tiers 7–9. NAT02 Yorkshire Tykes is the promotion rival RV03 (bible §23: hard-running, high press;
// data only, rivalry is M22): beating it in the Promotion Decider is the last step to the Championship.
export const NATIONAL_CLUBS = [
  { id: 'NAT01', name: 'Lancastrians', crest: 'club_nat01_crest', colours: { primary: 'red', secondary: 'gold' }, ground: 'Red Rose Park', strength: 1.4, rep: 0, cooldown: 14, reward: 7, rivalry: null },
  { id: 'NAT02', name: 'Yorkshire Tykes', crest: 'club_nat02_crest', colours: { primary: 'royal', secondary: 'white' }, ground: 'Ridings Road', strength: 1.43, rep: 0, cooldown: 14, reward: 7, rivalry: 'RV03' },
  { id: 'NAT03', name: 'Essex Boys', crest: 'club_nat03_crest', colours: { primary: 'claret', secondary: 'gold' }, ground: 'Saxon Fields', strength: 1.47, rep: 1700, cooldown: 16, reward: 8, rivalry: null },
  { id: 'NAT04', name: 'Kentish', crest: 'club_nat04_crest', colours: { primary: 'navy', secondary: 'white' }, ground: 'Invicta Park', strength: 1.5, rep: 2100, cooldown: 16, reward: 8, rivalry: null },
  { id: 'NAT05', name: 'Teessiders', crest: 'club_nat05_crest', colours: { primary: 'white', secondary: 'red' }, ground: 'Transporter Road', strength: 1.54, rep: 2600, cooldown: 18, reward: 9, rivalry: null },
  { id: 'NAT06', name: 'Black Country', crest: 'club_nat06_crest', colours: { primary: 'black', secondary: 'gold' }, ground: 'Pithead Ground', strength: 1.58, rep: 3200, cooldown: 18, reward: 9, rivalry: null },
];
// Every club the game knows (each league's clubs, data/league.js LEAGUES); a fixture's opponent is looked up here.
export const ALL_CLUBS = [...REGIONAL_CLUBS, ...COUNTY_CLUBS, ...NATIONAL_CLUBS];
export const clubById = (id) => ALL_CLUBS.find((c) => c.id === id) ?? null;

// The account-wide speed unlocks (bible §3 / §36 account save). Nothing sets them yet.
export const SPEED_FLAGS = {
  perm2x: { label: 'Permanent 2×', why: 'Unlocks after finishing Year 25 once.' },
  perm4x: { label: '4× speed', why: 'Unlocks after finishing NG+1 once.' },
};
