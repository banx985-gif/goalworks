// Sponsors (Milestone 23, bible §24; SERIES_COMMON_FEATURES: sponsors are a series feature). Plain data; the rules live in
// src/systems/sponsors.js. Offers come from Celeste Moore (data/cast.js SPONSOR_REP) as a one-tap offer sheet.
//   id, name, tier, colour       the text badge (a coloured shield with the name, drawn in code) until Aaron's logo arrives
//                                as assets/images/sponsors/sponsor_sp01.png … (looked for first: it drops in with no code change)
//   art                          the logo key (the two secret ones exist already)
//   unlock                       when the sponsor starts making offers: { wins } (all competitive wins), { rank }, { league },
//                                { secret } (SEC-SPON-01 / 02 on the secret checker; real triggers M28, ?debug=1 forces them)
//   stipend                      Credits a week while the deal runs (× Kaching's +20%, × sponsorPct research)
//   benefit                      { key, value, text }: the shared effect query (src/systems/effects.js) while the deal runs;
//                                'signingBudget' is paid as Credits when the deal starts and at each season's start
//   seasons                      the deal's length; slot: the slot it prefers (any free slot is fine)
export const SPONSOR_SLOTS = [
  { id: 'shirt', name: 'Shirt' },
  { id: 'sleeve', name: 'Sleeve' },
  { id: 'stadium', name: 'Stadium' },
];

export const SPONSORS = [
  { id: 'SP01', name: 'Town Motors', tier: 'Local', colour: '#C0392B', art: 'sponsor_sp01', unlock: { wins: 1 }, unlockText: 'Win your first match', stipend: 180, seasons: 1, slot: 'shirt', benefit: { key: 'stipendBonus', value: 0, text: 'A steady weekly stipend' } },
  { id: 'SP02', name: 'Field & Farm', tier: 'Regional', colour: '#4F772D', art: 'sponsor_sp02', unlock: { wins: 3 }, unlockText: '3 wins', stipend: 300, seasons: 2, slot: 'sleeve', benefit: { key: 'xp:all', value: 4, text: 'Training budget: +4% XP from every session' } },
  { id: 'SP03', name: 'Northline Telecom', tier: 'Regional', colour: '#2A6F97', art: 'sponsor_sp03', unlock: { rank: 'D' }, unlockText: 'Club Rank D', stipend: 450, seasons: 2, slot: 'stadium', benefit: { key: 'scoutDays', value: -1, text: 'Scouting speed: reports back 1 day sooner' } },
  { id: 'SP04', name: 'Ironbank', tier: 'National', colour: '#5D6D7E', art: 'sponsor_sp04', unlock: { rank: 'C' }, unlockText: 'Club Rank C', stipend: 900, seasons: 2, slot: 'shirt', benefit: { key: 'signingBudget', value: 8, text: 'Transfer budget: 8 weeks of stipend paid up front, each season' } },
  { id: 'SP05', name: 'Pulse Nutrition', tier: 'National', colour: '#E67E22', art: 'sponsor_sp05', unlock: { rank: 'C' }, unlockText: 'Club Rank C', stipend: 800, seasons: 2, slot: 'sleeve', benefit: { key: 'recoveryPct', value: 6, text: 'Recovery: fatigue recovers 6% faster' } },
  { id: 'SP06', name: 'Aero Travel', tier: 'Elite', colour: '#1ABC9C', art: 'sponsor_sp06', unlock: { rank: 'B' }, unlockText: 'Club Rank B', stipend: 1500, seasons: 3, slot: 'sleeve', benefit: { key: 'awayRepPct', value: 15, text: 'Away and tournament reputation +15%' } },
  { id: 'SP07', name: 'Vertex Tech', tier: 'Elite', colour: '#7D3C98', art: 'sponsor_sp07', unlock: { rank: 'A' }, unlockText: 'Club Rank A', stipend: 2000, seasons: 3, slot: 'stadium', benefit: { key: 'rpDay', value: 3, text: 'Analytics: +3 Research Points a day' } },
  { id: 'SP08', name: 'Crown Media', tier: 'Global', colour: '#D4A017', art: 'sponsor_sp08', unlock: { league: 'premier' }, unlockText: 'Reach the top league', stipend: 3600, seasons: 3, slot: 'shirt', benefit: { key: 'fanGrowthPct', value: 20, text: 'Fan growth: Fan Trust rises 20% faster' } },
  { id: 'SP09', name: 'Legacy Athletic', tier: 'Secret', colour: '#1B2A4A', art: 'sponsor_secret_01', unlock: { secret: 'SEC-SPON-01' }, unlockText: 'A secret', stipend: 3600, seasons: 3, slot: 'shirt', benefit: { key: 'xp:all', value: 8, text: 'Ability training: +8% XP from every session' } },
  { id: 'SP10', name: 'Zero Eleven', tier: 'Secret prestige', colour: '#111111', art: 'sponsor_secret_02', unlock: { secret: 'SEC-SPON-02' }, unlockText: 'A secret prestige sponsor', stipend: 5000, seasons: 3, slot: 'shirt', benefit: { key: 'prestigePct', value: 10, text: 'Prestige rewards +10% (Prestige arrives in M29)' } },
];
export const sponsorById = (id) => SPONSORS.find((s) => s.id === id) ?? null;

// Bounded objectives (bible §24: wins, youth starts, clean sheets, fan growth, league tier, cup progress). Each deal has one
// or two, counted over each season of the deal; need scales with the sponsor's tier (by index: Local … Secret prestige).
//   measure: what is counted from the deal's season start (src/systems/sponsors.js measureNow)
export const OBJECTIVES = [
  { id: 'wins', measure: 'wins', text: (n) => `Win ${n} matches this season`, need: [5, 8, 10, 12, 14, 16, 18, 18, 18, 20] },
  { id: 'youth', measure: 'youthApps', text: (n) => `${n} starts for players 21 or under`, need: [6, 10, 14, 18, 20, 24, 28, 30, 30, 34] },
  { id: 'cleanSheets', measure: 'cleanSheets', text: (n) => `Keep ${n} clean sheets`, need: [3, 4, 5, 6, 7, 8, 9, 10, 10, 12] },
  { id: 'fans', measure: 'fanGain', text: (n) => `Raise Fan Trust by ${n}`, need: [3, 4, 4, 5, 5, 6, 6, 6, 6, 8] },
  { id: 'tier', measure: 'tierUp', text: () => 'Stay up or move up a league', need: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'cup', measure: 'tiesWon', text: (n) => `Win ${n} cup tie${n === 1 ? '' : 's'}`, need: [1, 1, 2, 2, 2, 3, 3, 3, 3, 4] },
];
export const TIER_ORDER = ['Local', 'Regional', 'National', 'Elite', 'Global', 'Secret', 'Secret prestige'];

// The rules.
//   offerDays: an offer stays open this long · offerGap: days between Celeste's offers · bonusWeeks: the end-of-deal bonus
//   for every objective met (weeks of stipend; part met, part paid) · resign: the chance they offer to re-sign (all met …
//   none met) · interest: a cup won ("sponsor interest", M17–M21 flags) → the next offer's stipend × this
export const SPONSOR_RULES = {
  maxActive: 3,
  offerDays: 28,
  offerGap: 21,
  firstOfferDay: 3, // (Celeste waits a few days after an unlock)
  bonusWeeks: 6,
  resign: { all: 0.9, some: 0.55, none: 0.2 },
  interest: 1.15,
  cooldownDays: 168, // a sponsor who did not re-sign waits half a season
};

export const SPONSOR_TEXT = {
  rep: 'Celeste Moore, Commercial Partnerships',
  offerTitle: (name) => `${name} want to sponsor the club`,
  offerLine: 'Celeste Moore has a deal on the table. One tap to sign.',
  noSlot: 'All three sponsor slots are full. Sign anyway to replace the deal ending soonest (no penalty).',
  interestLine: 'Cup winners! The sponsors are paying attention: the next offer is better.',
};
