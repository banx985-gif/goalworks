// The stadium (Milestone 24, bible §26): five stages, the 15 expansion pieces, attendance and the stadium lot beside the
// club complex. Plain data; the rules live in src/systems/stadium.js, the screen in src/screens/stadiumSheets.js and the
// drawing in src/screens/ClubScreen.js. Every Credit number is tuned on the 25-year soak (tests/goalworks/m23soak.mjs;
// docs/DECISIONS.md M24 has the before / after numbers): the stages and pieces are the money sink M23 asked for.

// The five stages (bible §26: capacity is stylised). A stage opens when its league flag is set (the club first enters that
// league: data/league.js stadiumFlag) and the stage before it stands; then it is a Credits project that takes `weeks` to
// build. art: the stadium beside the complex (assets/images/stages). upkeep: Credits a week (data/finance.js RUNNING reads it).
export const STAGES = [
  { id: 1, flag: null, name: 'Regional Ground', capacity: 1500, cost: 0, weeks: 0, art: 'club_stage_01', upkeep: 40, lot: 4.5 },
  { id: 2, flag: 'countyStand', name: 'County Stand', capacity: 4000, cost: 15000, weeks: 3, art: 'club_stage_02', upkeep: 150, lot: 5 },
  { id: 3, flag: 'nationalStand', name: 'National Stadium', capacity: 10000, cost: 60000, weeks: 5, art: 'club_stage_03', upkeep: 450, lot: 5.6 },
  { id: 4, flag: 'championshipArena', name: 'Championship Arena', capacity: 22000, cost: 220000, weeks: 7, art: 'club_stage_04', upkeep: 1100, lot: 6.2 },
  { id: 5, flag: 'crownStadium', name: 'Crown Stadium', capacity: 45000, cost: 650000, weeks: 9, art: 'club_stage_05', upkeep: 2400, lot: 6.8 },
];
export const stageById = (id) => STAGES.find((s) => s.id === id) ?? null;
// Which league opens each stage (the Stadium screen's "needs" line).
export const STAGE_NEEDS = { 2: 'County League', 3: 'National League', 4: 'Championship League', 5: 'Crown Premier League' };

// The 15 expansion pieces (art list: stadium_expansion_01–15), three to a stage. Optional add-ons: each needs its stage
// built, costs Credits, takes `weeks`, then adds for good. What a piece gives:
//   capacity  seats (the crowd's ceiling)          gatePct   the matchday gate (+%, the effects key matchdayIncomePct)
//   fanPct    Fan Trust rises (fanGrowthPct)       repPct    reputation from a home match (homeRepPct)
//   mediaPct  big-moment Fan Trust (mediaPct)      merchPct  merch (fanIncomePct)   academyPct academy XP (academyXpPct)
// upkeep: Credits a week while it stands. at: where it stands on the stadium lot (share of the lot: u along col, v along
// row from the lot's back corner); size: its drawn width in tiles.
export const PIECES = [
  // Stage 1 · Regional Ground
  { id: 'P01', stage: 1, art: 'stadium_expansion_01', name: 'Standing terrace', cost: 2000, weeks: 1, upkeep: 5, gives: { capacity: 500 }, at: { u: 1.12, v: 0.82 }, size: 1.7 },
  { id: 'P06', stage: 1, art: 'stadium_expansion_06', name: 'Floodlights', cost: 3500, weeks: 1, upkeep: 10, gives: { gatePct: 3, repPct: 3 }, at: { u: 1.12, v: 0.18 }, size: 1.2 },
  { id: 'P11', stage: 1, art: 'stadium_expansion_11', name: 'Training-ground fence', cost: 1500, weeks: 1, upkeep: 5, gives: { fanPct: 5 }, at: { u: 1.12, v: 0.5 }, size: 1.6 },
  // Stage 2 · County Stand
  { id: 'P02', stage: 2, art: 'stadium_expansion_02', name: 'Covered terrace', cost: 8000, weeks: 2, upkeep: 15, gives: { capacity: 1000 }, at: { u: 1.12, v: 0.82 }, size: 1.7 },
  { id: 'P03', stage: 2, art: 'stadium_expansion_03', name: 'Small seated stand', cost: 14000, weeks: 2, upkeep: 25, gives: { capacity: 1500, gatePct: 3 }, at: { u: 1.12, v: 0.5 }, size: 1.7 },
  { id: 'P07', stage: 2, art: 'stadium_expansion_07', name: 'Scoreboard', cost: 6000, weeks: 1, upkeep: 10, gives: { fanPct: 5, gatePct: 2 }, at: { u: 1.12, v: 0.18 }, size: 1.4 },
  // Stage 3 · National Stadium
  { id: 'P04', stage: 3, art: 'stadium_expansion_04', name: 'Corner seating', cost: 40000, weeks: 3, upkeep: 60, gives: { capacity: 3000 }, at: { u: 1.12, v: 0.82 }, size: 1.8 },
  { id: 'P10', stage: 3, art: 'stadium_expansion_10', name: 'Academy annex', cost: 30000, weeks: 3, upkeep: 50, gives: { academyPct: 10 }, at: { u: 1.12, v: 0.18 }, size: 2 },
  { id: 'P13', stage: 3, art: 'stadium_expansion_13', name: 'Tunnel upgrade', cost: 25000, weeks: 2, upkeep: 40, gives: { repPct: 5, fanPct: 5 }, at: { u: 1.12, v: 0.5 }, size: 1.5 },
  // Stage 4 · Championship Arena
  { id: 'P05', stage: 4, art: 'stadium_expansion_05', name: 'Main stand', cost: 160000, weeks: 4, upkeep: 250, gives: { capacity: 6000 }, at: { u: 1.12, v: 0.82 }, size: 2 },
  { id: 'P08', stage: 4, art: 'stadium_expansion_08', name: 'Hospitality boxes', cost: 120000, weeks: 4, upkeep: 200, gives: { gatePct: 6, merchPct: 5 }, at: { u: 1.12, v: 0.18 }, size: 1.7 },
  { id: 'P09', stage: 4, art: 'stadium_expansion_09', name: 'Media gantry', cost: 90000, weeks: 3, upkeep: 150, gives: { mediaPct: 15, repPct: 5 }, at: { u: 1.12, v: 0.5 }, size: 1.5 },
  // Stage 5 · Crown Stadium
  { id: 'P14', stage: 5, art: 'stadium_expansion_14', name: 'Large roof', cost: 700000, weeks: 6, upkeep: 1000, gives: { capacity: 5000, gatePct: 4 }, at: { u: 1.12, v: 0.82 }, size: 2 },
  { id: 'P12', stage: 5, art: 'stadium_expansion_12', name: 'Supporter plaza', cost: 450000, weeks: 5, upkeep: 600, gives: { fanPct: 10, merchPct: 10 }, at: { u: 1.12, v: 0.18 }, size: 1.8 },
  { id: 'P15', stage: 5, art: 'stadium_expansion_15', name: 'Prestige entrance', cost: 900000, weeks: 6, upkeep: 1200, gives: { repPct: 10, merchPct: 10 }, at: { u: 1.12, v: 0.5 }, size: 1.6 },
];
export const pieceById = (id) => PIECES.find((p) => p.id === id) ?? null;
// A piece's gives → the effects keys (src/systems/effects.js asks every source the same way).
export const PIECE_KEYS = { gatePct: 'matchdayIncomePct', fanPct: 'fanGrowthPct', repPct: 'homeRepPct', mediaPct: 'mediaPct', merchPct: 'fanIncomePct', academyPct: 'academyXpPct' };
export const GIVES_TEXT = {
  capacity: (v) => `+${v.toLocaleString('en-GB')} seats`,
  gatePct: (v) => `+${v}% matchday gate`,
  fanPct: (v) => `+${v}% Fan Trust rises`,
  repPct: (v) => `+${v}% home reputation`,
  mediaPct: (v) => `+${v}% after big moments`,
  merchPct: (v) => `+${v}% merch`,
  academyPct: (v) => `+${v}% academy XP`,
};

// Attendance at a home match: the people who want to come (demand), never more than the capacity.
//   demand = pool[tier] × (trust.base + trust.k × Fan Trust / 100) × rank × opponent × cup × (a ±jitter by the day)
//   opponent: a rival by its band (M22), a big club (one of its league's two strongest, or a club from a higher league)
//   cup: + perRound a round, × final for a final; the Promotion / title match × promotion; a Showcase friendly × friendly
//   crowd = min(capacity, round(demand)); a full ground is "sold out" and the gate × soldOut (tickets go for more)
export const ATTENDANCE = {
  pool: { 1: 1600, 2: 4200, 3: 10500, 4: 23000, 5: 44000 },
  trust: { base: 0.6, k: 0.8 },
  rank: { E: 0.85, D: 0.92, C: 1, B: 1.06, A: 1.12, S: 1.2 },
  derby: { cool: 1.08, heated: 1.15, fierce: 1.25, feud: 1.35 },
  big: 1.1,
  higherLeague: 1.15,
  perRound: 0.06,
  final: 1.3,
  promotion: 1.3,
  friendly: 0.7,
  jitter: 0.03,
  soldOut: 1.1,
  round: 1,
};

// Where the stadium stands: a lot past the ground's right-hand fence, `gap` tiles out, its front-left edge `front` tiles in
// front of the ground's front edge; each stage's lot is `lot` tiles square (the art grows with it). The pieces stand along
// its right-hand side (at: u, v in lot shares). Fans come up the road in front of the
// club gate and walk along the front fence to the stadium (src/ui/walkers.js).
export const LOT = { gap: 2, front: 0.8, artWidth: 1, foot: 0.86 };

// Building: one project at a time (a stage or a piece). Paid when it starts (frozen while the club owes an Emergency
// Credit, like every new building — M23), ready after its weeks (on the calendar; Bolt's faster upgrades count).
export const STADIUM_TEXT = {
  title: 'Stadium',
  subtitle: 'Stages, seats and the matchday crowd',
  needsLeague: (league) => `Opens when you reach the ${league}`,
  needsStage: (name) => `Build the ${name} first`,
  busy: (name, day) => `${name} is being built: ready ${day}`,
  noMoney: (cost) => `Needs ${cost.toLocaleString('en-GB')} Credits`,
  built: (name) => `${name} built!`,
  started: (name, weeks) => `Building the ${name}: ready in ${weeks} week${weeks === 1 ? '' : 's'}`,
  crowdLine: (crowd, cap) => `Crowd ${crowd.toLocaleString('en-GB')} / ${cap.toLocaleString('en-GB')}`,
  soldOut: 'Sold out',
};
