// The leagues (Milestone 10: Regional; Milestone 17: County — bible §7 / §8 / §21 / §22). Plain data; the rules live in
// src/systems/league.js, the cups in src/systems/cup.js. The clubs themselves are data/fixtures.js REGIONAL_CLUBS /
// COUNTY_CLUBS. One definition per tier (LEAGUES), so the higher tiers (M18–M20) only add data.
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
// (M17) Tiers 4–6 are the County clubs: bigger rewards than any Regional club.
export const REPUTATION = {
  win: { 1: { history: 30, momentum: 12 }, 2: { history: 42, momentum: 16 }, 3: { history: 55, momentum: 20 }, 4: { history: 70, momentum: 24 }, 5: { history: 85, momentum: 28 }, 6: { history: 100, momentum: 32 } },
  draw: { 1: { history: 6, momentum: 4 }, 2: { history: 10, momentum: 5 }, 3: { history: 14, momentum: 6 }, 4: { history: 20, momentum: 8 }, 5: { history: 25, momentum: 9 }, 6: { history: 30, momentum: 10 } },
  loss: { 1: 18, 2: 14, 3: 10, 4: 10, 5: 8, 6: 6 }, // momentum lost (a loss to a weaker side stings more)
  promotionWin: { history: 150, momentum: 30 },
  fade: 0.5,
};

// Credits per result (a PLACEHOLDER counter until the real money ledger in Milestone 23).
export const CREDITS = { win: { 1: 400, 2: 600, 3: 850, 4: 1100, 5: 1350, 6: 1600 }, draw: { 1: 150, 2: 220, 3: 300, 4: 400, 5: 480, 6: 560 }, loss: { 1: 60, 2: 80, 3: 100, 4: 140, 5: 160, 6: 180 }, promotionWin: 1500 };

// Regional → County (bible §8): beat 4 distinct Regional clubs + 8 total Regional wins → a Promotion Match against the
// highest unlocked Regional opponent; win it → the County promotion offer.
export const PROMOTION = { distinct: 4, wins: 8, retryCooldown: 10 };

// The leagues, one per tier (Milestone 17). Each:
//   id, tier, name, short          'regional' … ; the words the slot card / top bar / League sheet use
//   clubs                          club ids (data/fixtures.js) — they issue the challenges while it is your league
//   promotion                      the rule for the next tier's offer (bible §8):
//     distinct / wins / rank       clubs beaten at least once (all: the league's size), total wins, the Club Rank needed
//     final                        then one more step: 'match' (a Promotion Match against the highest unlocked club —
//                                  Regional) or { cup, playoff } (win that cup, or once the rest is met without having won
//                                  it, a one-off Promotion Playoff against the league's strongest club — County)
//     retryCooldown                days after a lost Promotion Match / Playoff before it comes back
//     bonus                        Credits and reputation for winning that match ({ credits, history, momentum })
//     to, offerLine                the next league's id (null: not built yet) and the offer's words
//   cup                            the league's own cup (data/cups.js), opened when you enter the league
//   achievement                    recorded when you are promoted out of it (the achievements screen is M27)
//   stadiumFlag                    a stadium stage it unlocks as a flag only when you enter it (stages are M24)
export const LEAGUES = [
  {
    id: 'regional',
    tier: 1,
    name: 'Regional League',
    short: 'Regional',
    clubs: ['REG01', 'REG02', 'REG03', 'REG04', 'REG05', 'REG06'],
    promotion: { distinct: PROMOTION.distinct, wins: PROMOTION.wins, rank: null, final: 'match', retryCooldown: PROMOTION.retryCooldown, bonus: { credits: CREDITS.promotionWin, ...REPUTATION.promotionWin }, to: 'county' },
    cup: null, // (C01 Regional Cup: Milestone 21)
    achievement: 'A10',
    stadiumFlag: null,
  },
  {
    id: 'county',
    tier: 2,
    name: 'County League',
    short: 'County',
    clubs: ['CNT01', 'CNT02', 'CNT03', 'CNT04', 'CNT05', 'CNT06'],
    promotion: { distinct: 6, wins: 0, rank: 'D', final: { cup: 'C02', playoff: true }, retryCooldown: 21, bonus: { credits: 2500, history: 220, momentum: 40 }, to: 'national' },
    cup: 'C02',
    achievement: 'A11',
    stadiumFlag: 'countyStand',
  },
];
export const leagueById = (id) => LEAGUES.find((l) => l.id === id) ?? null;
// The next tiers, named before they are built (the offer says "coming soon").
export const COMING = { national: { name: 'National League', milestone: 'M18' } };

// Achievement flags recorded now (bible §31; the achievements screen is M27).
export const ACHIEVEMENTS = {
  A10: { name: 'Regional Kings', line: 'Clear Regional promotion' }, // recorded when you accept the County offer
  A11: { name: 'County Kings', line: 'Clear County promotion' }, // recorded when you accept the National offer
};
// Stadium stage flags (bible §26; the stages themselves are M24).
export const STADIUM_FLAGS = { countyStand: { name: 'County Stand', stage: 2 } };
