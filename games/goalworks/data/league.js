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
// (M17) Tiers 4–6 are the County clubs: bigger rewards than any Regional club. (M18) Tiers 7–9 the National clubs. (M19)
// Tiers 10–12 the Championship clubs. (M20) Tiers 13–15 the Crown Premier clubs: the biggest.
export const REPUTATION = {
  win: { 1: { history: 30, momentum: 12 }, 2: { history: 42, momentum: 16 }, 3: { history: 55, momentum: 20 }, 4: { history: 70, momentum: 24 }, 5: { history: 85, momentum: 28 }, 6: { history: 100, momentum: 32 }, 7: { history: 125, momentum: 38 }, 8: { history: 145, momentum: 42 }, 9: { history: 165, momentum: 46 }, 10: { history: 195, momentum: 52 }, 11: { history: 220, momentum: 56 }, 12: { history: 245, momentum: 60 }, 13: { history: 285, momentum: 68 }, 14: { history: 320, momentum: 74 }, 15: { history: 360, momentum: 80 } },
  draw: { 1: { history: 6, momentum: 4 }, 2: { history: 10, momentum: 5 }, 3: { history: 14, momentum: 6 }, 4: { history: 20, momentum: 8 }, 5: { history: 25, momentum: 9 }, 6: { history: 30, momentum: 10 }, 7: { history: 38, momentum: 12 }, 8: { history: 44, momentum: 13 }, 9: { history: 50, momentum: 14 }, 10: { history: 60, momentum: 16 }, 11: { history: 68, momentum: 17 }, 12: { history: 76, momentum: 18 }, 13: { history: 90, momentum: 20 }, 14: { history: 100, momentum: 22 }, 15: { history: 110, momentum: 24 } },
  loss: { 1: 18, 2: 14, 3: 10, 4: 10, 5: 8, 6: 6, 7: 8, 8: 6, 9: 5, 10: 6, 11: 5, 12: 4, 13: 5, 14: 4, 15: 3 }, // momentum lost (a loss to a weaker side stings more)
  promotionWin: { history: 150, momentum: 30 },
  fade: 0.5,
};

// Credits per result (a PLACEHOLDER counter until the real money ledger in Milestone 23).
export const CREDITS = { win: { 1: 400, 2: 600, 3: 850, 4: 1100, 5: 1350, 6: 1600, 7: 2000, 8: 2300, 9: 2600, 10: 3100, 11: 3500, 12: 3900, 13: 4600, 14: 5200, 15: 5800 }, draw: { 1: 150, 2: 220, 3: 300, 4: 400, 5: 480, 6: 560, 7: 700, 8: 800, 9: 900, 10: 1050, 11: 1200, 12: 1350, 13: 1550, 14: 1750, 15: 1950 }, loss: { 1: 60, 2: 80, 3: 100, 4: 140, 5: 160, 6: 180, 7: 220, 8: 250, 9: 280, 10: 320, 11: 360, 12: 400, 13: 460, 14: 520, 15: 580 }, promotionWin: 1500 };

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
//                                  it, a one-off Promotion Playoff against the league's strongest club — County) or
//                                  { rival } (M18: a one-off Promotion Decider against that club — National, RV03) or
//                                  { cup, promotionFinal, fallback } (M19: once the rest is met, that cup's final is the
//                                  Promotion Final; won before the rest is met it's just a cup win. With the rest met and
//                                  no edition you are still in, a one-off Promotion Final against `fallback` — Championship)
//     stepName                     what the last step is called on the sheets (Promotion Match / Playoff / Decider)
//     retryCooldown                days after a lost Promotion Match / Playoff / Decider before it comes back
//     bonus                        Credits and reputation for winning that match ({ credits, history, momentum })
//     to, offerLine                the next league's id (null: not built yet) and the offer's words
//   cup                            the league's own cup (data/cups.js), opened when you enter the league (M18: the cups
//                                  say when they open — data/cups.js `opens`; this is the one the League sheet leads with)
//   achievement                    recorded when you are promoted out of it (the achievements screen is M27)
//   stadiumFlag                    a stadium stage it unlocks as a flag only when you enter it (stages are M24)
export const LEAGUES = [
  {
    id: 'regional',
    tier: 1,
    name: 'Regional League',
    short: 'Regional',
    clubs: ['REG01', 'REG02', 'REG03', 'REG04', 'REG05', 'REG06'],
    promotion: { distinct: PROMOTION.distinct, wins: PROMOTION.wins, rank: null, final: 'match', stepName: 'Promotion Match', retryCooldown: PROMOTION.retryCooldown, bonus: { credits: CREDITS.promotionWin, ...REPUTATION.promotionWin }, to: 'county' },
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
    promotion: { distinct: 6, wins: 0, rank: 'D', final: { cup: 'C02', playoff: true }, stepName: 'Promotion Playoff', retryCooldown: 21, bonus: { credits: 2500, history: 220, momentum: 40 }, to: 'national' },
    cup: 'C02',
    achievement: 'A11',
    stadiumFlag: 'countyStand',
  },
  // (M18) National → Championship (bible §8): 12 National wins + 5 different National clubs beaten + Rank C, then beat
  // the designated rival RV03 (NAT02 Yorkshire Tykes) in a one-off Promotion Decider.
  {
    id: 'national',
    tier: 3,
    name: 'National League',
    short: 'National',
    clubs: ['NAT01', 'NAT02', 'NAT03', 'NAT04', 'NAT05', 'NAT06'],
    promotion: { distinct: 5, wins: 12, rank: 'C', final: { rival: 'NAT02' }, stepName: 'Promotion Decider', retryCooldown: 28, bonus: { credits: 4000, history: 320, momentum: 60 }, to: 'championship' },
    cup: 'C03',
    achievement: 'A12',
    stadiumFlag: 'nationalStand',
  },
  // (M19) Championship → Crown Premier (bible §8): 14 Championship wins + all six beaten + Rank B, then win the C05
  // Promotion Final (the Championship Trophy's final, or the one-off fallback against CHP06).
  {
    id: 'championship',
    tier: 4,
    name: 'Championship League',
    short: 'Championship',
    clubs: ['CHP01', 'CHP02', 'CHP03', 'CHP04', 'CHP05', 'CHP06'],
    promotion: { distinct: 6, wins: 14, rank: 'B', final: { cup: 'C05', promotionFinal: true, fallback: 'CHP06' }, stepName: 'Promotion Final', retryCooldown: 28, bonus: { credits: 6000, history: 420, momentum: 80 }, to: 'premier' },
    cup: 'C05',
    achievement: 'A13',
    stadiumFlag: 'championshipArena',
  },
  // (M20) The top flight — no league above it. The title chain (bible §8): 18 Premier wins + every Premier club beaten at
  // least twice over the club's whole history (`timesEach`) + Rank A, then a one-off Crown Title Match against the strongest
  // Premier club at the time (`final: { title }`, by its squad now). Winning it is the Crown title (data.league.crownTitle,
  // A15, club history) — not the end of the game (bible §0 rule 8: prestige and NG+ come later). `entered`: recorded on
  // arrival (A14 Top Flight).
  {
    id: 'premier',
    tier: 5,
    name: 'Crown Premier League',
    short: 'Premier',
    clubs: ['PRE01', 'PRE02', 'PRE03', 'PRE04', 'PRE05', 'PRE06'],
    promotion: { distinct: 6, timesEach: 2, wins: 18, rank: 'A', final: { title: true }, stepName: 'Crown Title Match', retryCooldown: 28, bonus: { credits: 15000, history: 1200, momentum: 200 }, to: null },
    cup: 'C06',
    achievement: 'A15',
    entered: 'A14',
    stadiumFlag: 'crownStadium',
  },
];
export const leagueById = (id) => LEAGUES.find((l) => l.id === id) ?? null;
// The next tiers, named before they are built (the offer says "coming soon"). (M20: none — the Crown Premier is the top.)
export const COMING = {};
// (M20) After the Crown title (bible §0 rule 8: the top flight is not full completion).
export const AFTER_TITLE = 'Prestige tournaments, Secret players and New Game+ are coming later.';

// Achievement flags recorded now (bible §31; the achievements screen is M27).
export const ACHIEVEMENTS = {
  A10: { name: 'Regional Kings', line: 'Clear Regional promotion' }, // recorded when you accept the County offer
  A11: { name: 'County Kings', line: 'Clear County promotion' }, // recorded when you accept the National offer
  A12: { name: 'National Kings', line: 'Clear National promotion' }, // (M18) recorded when you accept the Championship offer
  A13: { name: 'Championship Kings', line: 'Clear Championship promotion' }, // (M19) recorded when you accept the Crown Premier offer
  A14: { name: 'Top Flight', line: 'Reach Crown Premier League' }, // (M20) recorded when you enter the Crown Premier
  A15: { name: 'Crown Champions', line: 'Win top-flight title chain' }, // (M20) recorded when you win the Crown Title Match
};
// Stadium stage flags (bible §26; the stages themselves are M24).
export const STADIUM_FLAGS = { countyStand: { name: 'County Stand', stage: 2 }, nationalStand: { name: 'National Stand', stage: 3 }, championshipArena: { name: 'Championship Arena', stage: 4 }, crownStadium: { name: 'Crown Stadium', stage: 5 } };
