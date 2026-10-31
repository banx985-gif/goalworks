// The club's money (Milestone 23, bible §25 finances, §26 fans, §29 board). Plain data; the rules live in
// src/systems/finance.js (the ledger, gate, merch, running costs, Emergency Credit), src/systems/fans.js (Fan Trust) and
// src/systems/board.js (the board's objectives, confidence and the rescue offer). Every number here is Cowork's M23 card
// tuned on the 25-year soak (tests/goalworks/m23soak.mjs; docs/DECISIONS.md M23 has the before / after numbers).

// The ledger's categories: every Credit in or out is one line with one of these (kind: what it usually is — a line keeps
// its own sign, so a facility sold back is a + line under Facilities).
export const FIN_CATS = [
  { id: 'sponsors', name: 'Sponsors', kind: 'in', colour: '#2E86C1' },
  { id: 'gate', name: 'Matchday gate', kind: 'in', colour: '#27AE60' },
  { id: 'prize', name: 'Win pay and prize money', kind: 'in', colour: '#D4A017' },
  { id: 'transfersIn', name: 'Transfer fees in', kind: 'in', colour: '#16A085' },
  { id: 'merch', name: 'Merch and hospitality', kind: 'in', colour: '#E67E22' },
  { id: 'board', name: 'Board support', kind: 'in', colour: '#1B2A4A' },
  { id: 'other', name: 'Item sales', kind: 'in', colour: '#8E8E8E' },
  { id: 'loan', name: 'Emergency Credit', kind: 'in', colour: '#C0392B' },
  { id: 'wages', name: 'Squad wages and payouts', kind: 'out', colour: '#C0392B' },
  { id: 'staff', name: 'Staff wages', kind: 'out', colour: '#7D3C98' },
  { id: 'signing', name: 'Transfer and signing fees', kind: 'out', colour: '#A04000' },
  { id: 'facilities', name: 'Facilities', kind: 'out', colour: '#6B7B8C' },
  { id: 'upkeep', name: 'Stadium upkeep', kind: 'out', colour: '#566573' },
  { id: 'scouting', name: 'Scouting', kind: 'out', colour: '#B9770E' },
  { id: 'research', name: 'Research', kind: 'out', colour: '#1F618D' },
  { id: 'academy', name: 'Academy', kind: 'out', colour: '#229954' },
  { id: 'repay', name: 'Emergency Credit repaid', kind: 'out', colour: '#922B21' },
];
export const finCat = (id) => FIN_CATS.find((c) => c.id === id) ?? null;
// What the Finances screen counts as "income" against the wage bill: everything in but the Emergency Credit itself.
export const NOT_INCOME = ['loan'];
export const WAGE_CATS = ['wages', 'staff'];

// How much the save keeps: the last lines (the Finances screen's "latest"), the week-by-week balance for the 12-week
// chart, each week's totals for the last 60 weeks, and the last 40 seasons' totals by category (small rows).
export const LEDGER = { keepLines: 60, chartWeeks: 12, keepWeeks: 60, keepSeasons: 40 };

// The stadium stage today (bible §26; the stages themselves and attendance growth are M24): the league flags already set
// when you first enter each league. Capacity is stylised.
export const STADIUM_STAGES = [
  { flag: null, name: 'Regional Ground', capacity: 1500 },
  { flag: 'countyStand', name: 'County Stand', capacity: 4000 },
  { flag: 'nationalStand', name: 'National Stadium', capacity: 10000 },
  { flag: 'championshipArena', name: 'Championship Arena', capacity: 22000 },
  { flag: 'crownStadium', name: 'Crown Stadium', capacity: 45000 },
];

// The matchday gate (each home match, not a Showcase friendly): capacity × how full × the ticket price for your league.
//   full = base + Fan Trust share + the Club Rank's pull, at most 1
//   × (1 + matchdayIncomePct / 100) (Fan Kiosk, Hospitality Suite) × Kaching's +20%
export const GATE = {
  price: { 1: 0.6, 2: 0.8, 3: 0.8, 4: 0.6, 5: 0.4 }, // Credits a seat, by league tier (the big grounds are cheaper a seat)
  fill: { base: 0.3, trust: 0.35, rank: { E: 0, D: 0.04, C: 0.08, B: 0.12, A: 0.16, S: 0.2 } },
  round: 10,
};

// Merch and hospitality: a weekly income from Fan Trust and the big names in the squad.
//   (base by league tier) × (0.4 + Fan Trust / 100) + per Star + per god, × (1 + fanIncomePct / 100) × Kaching
export const MERCH = {
  base: { 1: 60, 2: 160, 3: 400, 4: 800, 5: 1300 },
  perStar: { 1: 40, 2: 60, 3: 120, 4: 250, 5: 450 },
  perGod: 400,
  round: 10,
};

// Weekly running costs (bible §25): stadium upkeep by stage (− stadiumOpsPct, Stadium Operations research), the academy
// by its places filled, scouting while the scout is out, research while a node is being worked on.
export const RUNNING = {
  upkeep: [40, 150, 450, 1100, 2400], // by stadium stage
  academyPerPlayer: { 1: 10, 2: 15, 3: 25, 4: 40, 5: 60 }, // by league tier
  scoutingWeek: { 1: 30, 2: 50, 3: 90, 4: 150, 5: 240 }, // a report or closer look under way
  researchWeek: { 1: 20, 2: 40, 3: 80, 4: 140, 5: 220 }, // a node in the slot
};

// Emergency Credit (bible §25): Credits never stay below zero — the board lends the gap (rounded up), repaid each week
// from the Credits in hand (at most repayShare of what is above the cushion). While anything is owed, new non-essential
// building is frozen. Each week in debt past rescueAfterWeeks adds rescueStep to the chance of the board's rescue offer
// (at most rescueMax); one offer at a time, never more often than every rescueGapWeeks.
export const EMERGENCY = {
  round: 500,
  repayShare: 0.5,
  cushion: 500,
  rescueAfterWeeks: 6,
  rescueStep: 0.04,
  rescueMax: 0.5,
  rescueGapWeeks: 8,
  rescueSaleShare: 0.9, // the rescue sale: this share of the player's value (a quick sale)
};

export const FIN_TEXT = {
  title: 'Finances',
  subtitle: 'Every Credit in and out: this week, this season, last season',
  buildBlocked: (owed) => `The board has frozen new building until the Emergency Credit is repaid (${Math.round(owed).toLocaleString('en-GB')} Credits owed).`,
  loanLine: (n) => `Emergency Credit: the board lent ${Math.round(n).toLocaleString('en-GB')} Credits to cover the gap. It is repaid from income each week.`,
  repaidLine: 'The Emergency Credit is repaid in full. The board has lifted the building freeze.',
};
