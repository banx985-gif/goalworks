// The Regional League (Milestone 10, bible §7 / §8 / §21). Plain data; the rules live in src/systems/league.js. The
// clubs themselves are data/fixtures.js REGIONAL_CLUBS.
//
// Challenges (bible §21): a club issues a challenge when your reputation reaches its requirement and it is not cooling
// down — on each club day it may issue one (chance ISSUE.chance); an offer stays open for ISSUE.openDays, then expires.
// A declined or expired offer: that club waits ISSUE.declineCooldown days. After playing it: the club's own rematch
// cooldown. Accepting is the M2 commitment (kickoff 7 days later, temporary 2×, one match per 7 days).

export const ISSUE = { chance: 0.22, openDays: 6, declineCooldown: 6 };

// Club Rank by reputation (bible §7).
export const RANKS = [
  { id: 'E', min: 0, line: 'regional unknown' },
  { id: 'D', min: 500, line: 'established local club' },
  { id: 'C', min: 1500, line: 'nationally noticed' },
  { id: 'B', min: 3500, line: 'strong professional club' },
  { id: 'A', min: 7000, line: 'elite domestic club' },
  { id: 'S', min: 12000, line: 'world-class / prestige eligible' },
];

// Reputation per result by the opponent's reward tier. Reputation = history (permanent: it only ever grows — bible §7
// "never deletes long-term club history") + momentum (short-term form: a win adds some, a loss takes some away, it fades
// back day by day, and it is never below 0 — so reputation never drops below what history earned).
//   win / draw: { history, momentum } added · loss: momentum lost · fade: momentum lost per day
export const REPUTATION = {
  win: { 1: { history: 30, momentum: 12 }, 2: { history: 42, momentum: 16 }, 3: { history: 55, momentum: 20 } },
  draw: { 1: { history: 6, momentum: 4 }, 2: { history: 10, momentum: 5 }, 3: { history: 14, momentum: 6 } },
  loss: { 1: 18, 2: 14, 3: 10 }, // momentum lost (a loss to a weaker side stings more)
  promotionWin: { history: 150, momentum: 30 },
  fade: 0.5,
};

// Credits per result (a PLACEHOLDER counter until the real money ledger in Milestone 23).
export const CREDITS = { win: { 1: 400, 2: 600, 3: 850 }, draw: { 1: 150, 2: 220, 3: 300 }, loss: { 1: 60, 2: 80, 3: 100 }, promotionWin: 1500 };

// Regional → County (bible §8): beat 4 distinct Regional clubs + 8 total Regional wins → a Promotion Match against the
// highest unlocked Regional opponent; win it → the County promotion offer.
export const PROMOTION = { distinct: 4, wins: 8, retryCooldown: 10 };
