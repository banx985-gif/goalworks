// Transfers, scouting and contracts (Milestone 11, bible §10 / §11 / §36). Plain data; the rules live in
// src/systems/transfers.js, negotiation.js and scouting.js. Money is the Milestone 10 Credits counter (still a placeholder
// until the M23 ledger): fees, signing bonuses, payouts and wages come out of it; a deal that would take it below zero is
// refused.

// Player value (bible §11): value = baseTierValue × ageCurve × formFactor × reputationFactor × contractFactor ×
// potentialFactor. Every factor is worked out here and stored on the player (p.valuation) so nothing is hidden from the save.
export const VALUE = {
  // baseTierValue: the tier's price at overall 50, ± perOvr for each overall point (never below minShare of it)
  base: { Standard: 1200, Rare: 3000 },
  perOvr: 0.07,
  minShare: 0.3,
  // ageCurve: [up to age, factor]
  age: [
    [19, 1.1],
    [23, 1.25],
    [27, 1.15],
    [30, 1],
    [32, 0.8],
    [34, 0.6],
    [99, 0.4],
  ],
  // formFactor: 1 + perPoint × form (form −10 … +10)
  formPerPoint: 0.015,
  // reputationFactor: the club that owns him (free agents and the wider market have none of their own)
  reputation: { free: 0.8, market: 1, club: { 1: 0.95, 2: 1, 3: 1.08 }, rank: { E: 1, D: 1.05, C: 1.1, B: 1.18, A: 1.26, S: 1.35 } },
  // contractFactor: by years left (0 = a free agent)
  contract: { 0: 0.5, 1: 0.65, 2: 0.85, 3: 1, 4: 1.08, 5: 1.15 },
  // potentialFactor: 1 + perPoint × (potential midpoint − overall), at most max
  potentialPerPoint: 0.025,
  potentialMax: 1.5,
  round: 50,
};

// Contracts (bible §11): salary (a week), years 1–5, squad role, signing bonus, optional release clause.
// What a player asks: the Milestone 7 salary formula (data/players.js CONTRACT) for the role, × askMarkup when moving clubs.
export const CONTRACT_TERMS = {
  years: [1, 5],
  askMarkup: { renew: 1.05, transfer: 1.12, free: 1.1, loan: 1, pre: 1.12 },
  // the signing bonus a free agent / pre-contract wants: this many weeks of salary (a transfer's player wants none)
  bonusWeeks: { free: 4, pre: 6, transfer: 0, renew: 0, loan: 0 },
  // years a player wants: [min, max] by age
  yearsWanted: [
    [21, [3, 5]],
    [26, [2, 5]],
    [30, [1, 4]],
    [99, [1, 2]],
  ],
  // offering a role below the one he expects in your squad: his salary ask rises this much per step down
  roleShortfall: 0.15,
  // a release clause at or below this × his value: he asks this much less salary (he likes the way out)
  releaseClause: { options: [0, 1.5, 2, 3], cheapAt: 2, salaryCut: 0.05 },
  // releasing a player: pay this many weeks of his salary per contract year left
  payoutWeeksPerYear: 8,
  // the shirt numbers new players take (the lowest free one)
  shirts: [12, 40],
};

// Negotiation (bible §11): offer → accept, reject or counter. 1–3 counters at most (each talk draws its limit), no agent.
export const NEGOTIATION = {
  counters: [1, 3],
  walkAway: 0.7, // an offer below this share of the ask (fee or salary) is rejected outright
  meet: 0.5, // a counter meets you this share of the way between the ask and your offer
  cooldownDays: 7, // after a rejection that side will not talk again for this long
  // the selling club's ask: value × (key player in their best XI ? key : 1)
  keyPlayer: 1.3,
  // an AI club bidding for your player: it starts at bid × value and will pay up to max × value
  aiBid: [0.85, 1.05],
  aiMax: 1.25,
};

// Squad size (bible §5 / §11). A deal that breaks the minimum (or the maximum) is refused with a plain reason, so there
// is always a valid XI. Counted: senior players at the club now (loaned-in players count, loaned-out ones do not) plus
// pre-contract arrivals still to come (for the maximum).
export const SQUAD_RULES = {
  max: 26,
  min: 16,
  need: { GK: 2, DF: 5, midWing: 4, fwdWing: 3 }, // wingers count once, as in the starting squad's coverage
};

// Loans (bible §11): loan, and loan with option. The borrower pays the player's wages and a loan fee.
export const LOAN = {
  days: 168, // half a season
  feeShare: 0.08, // the loan fee: this share of his value
  optionFeeShare: 0.1, // a loan with option costs a little more up front …
  optionPriceShare: 1, // … and fixes the price to buy him: this share of his value at signing
  outFeeShare: 0.05, // loaning one of yours out earns this share of his value
};

// The transfer pool (bible §10): Regional quality, ages 18–34.
export const POOL = {
  free: { target: 14, max: 24 }, // regional free agents (plus released players)
  market: { target: 10, max: 14 }, // transfer-market players at clubs beyond the region ("Other clubs")
  refreshDays: 28, // each month a few new faces join and a few leave
  refreshShare: 0.3,
  freeAgentLeaveAge: 35, // a free agent this old leaves the pool at the season's end
  areas: ['fen', 'border', 'moor', 'valley', 'coast', 'mid', 'cape', 'lakes', 'mills', 'dales', 'estuary', 'iron'],
  // the six Regional clubs' squads: they keep between these sizes
  clubSquad: [17, 24],
};

// The AI clubs (bible §11): occasional bids for your players and signings / releases of their own.
export const AI = {
  bidChancePerWeek: 0.2, // an unsolicited bid for one of your players
  listedBidChancePerDay: 0.35, // a bid for a player you listed for sale
  bidOpenDays: 5,
  clubMoveChancePerWeek: 0.18, // each club, each week: a signing or a release
  releaseAge: 33, // they let their oldest go first
};

// Scouting (bible §10 / §12): the Founder-era scout until staff arrive (M14). Stats shown as ranges, potential as a label and
// a range; ranges narrow with more scouting time on that player. Reports expire.
export const SCOUTING = {
  scout: { name: 'Pat Doyle', title: 'Founder-era scout (a save without staff only; since M14 the hired Scout goes)' },
  regions: [
    { id: 'regional', name: 'Regional clubs', line: 'Players at the six Regional clubs.' },
    { id: 'free', name: 'Free agents', line: 'Out of contract: no fee, just wages and a bonus.' },
    { id: 'market', name: 'Wider market', line: 'Players at clubs beyond the region.' },
  ],
  positions: ['any', 'GK', 'DF', 'MF', 'WG', 'FW'],
  days: 4, // a report takes this long
  closerDays: 3, // a closer look at one player
  reportSize: 4,
  expiresDays: 28,
  knowledgePerDay: 0.12, // knowledge of a player 0 … 1 grows this much per scouting day spent on him
  range: { stat: 16, statMin: 2, overall: 12, overallMin: 1, potential: 8 },
  potentialLabels: [
    [4, 'Little room to grow'],
    [9, 'Some room to grow'],
    [15, 'Good ceiling'],
    [99, 'High ceiling'],
  ],
};

// The weekly wages and the board's wage support (a placeholder until the M23 ledger): each week Credits get the support and
// pay the wage bill. The support starts a little above the starting squad's bill and grows with the Club Rank. A deal that
// takes the bill above the support needs Credits for cushionWeeks of the difference.
export const WAGES = {
  supportShare: 1.05,
  rank: { E: 1, D: 1.1, C: 1.25, B: 1.4, A: 1.6, S: 2 },
  cushionWeeks: 8,
  round: 100,
};

// Morale (Milestone 8): a player promised a Starter / Star role who is left out takes this on top of the M8 benched hit.
export const PROMISE = { brokenMorale: -3, roles: ['Starter', 'Star'] };

// Autosave reason on every completed transfer / contract (bible §36).
export const AUTOSAVE_REASON = 'transfer:done';
