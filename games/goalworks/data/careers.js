// Careers: age curves, decline, retirement, regens and the Hall of Fame (Milestone 16, bible §10 / §33 / §36). Plain data;
// the rules live in src/systems/careers.js. Every number is a placeholder for the M35 balance soak.

// Growth for players who don't train at your club (the AI clubs, free agents, the wider market): overall points a season
// toward their potential, by age ([up to age, points]). Your own players grow by training (data/training.js XP.age already
// slows it from the late 20s). Growth stops at 30.
export const GROWTH = [
  [18, 3],
  [21, 2.5],
  [24, 1.8],
  [27, 1],
  [29, 0.4],
  [99, 0],
];
// Each AI club keeps its level: its band is its squad's average overall (worked out once and kept on the club); its
// players grow no higher than band + room, and its regens' potential stays under that too. Free agents and the wider
// market have fixed bands (their starting averages). So the six clubs stay six different strengths, decade after decade.
export const BAND = { room: 5, free: 58, market: 60 };

// Decline (bible §10): checked at the season's end for everyone at least `from` (after the birthday). Stat points lost =
// base + perYear × (age − from), PHY first and most, the other four stats a little each; never more than `max` a stat in
// one season and never below `floor`. Fractions are rolled (0.4 = a 40% chance of a point). The ceiling (potential) falls
// with the overall, so training can't simply win the points back.
export const DECLINE = {
  from: { outfield: 30, GK: 33 },
  phy: { base: 1, perYear: 0.7, max: 6 },
  others: { base: 0.1, perYear: 0.3, max: 3 },
  floor: 10,
  // softening (× the points lost); several multiply
  traits: { 'Engine Room': 0.8, 'Box to Box': 0.8, 'Calm Under Pressure': 0.9, Leader: 0.9, 'Safe Hands': 0.9 },
  // fitness: your player's average fatigue over the season below this → × mult (a well-managed body ages slower)
  fitness: { below: 35, mult: 0.85 },
  // the Physio (any one on the staff): × this on your players' decline
  physio: 0.9,
  // F16 Strength Centre "Physical cap training" (effect physicalCap: 1 / 1.5 / 2 by facility level): your players' PHY
  // decline × (1 − strength × physicalCap) → × 0.75 / 0.625 / 0.5
  strength: 0.25,
};

// Retirement (bible §10): the window by position (ages during the season, before the birthday). Inside it a player may
// retire at the season's end: chance = first + (1 − first) × ((age − start) / (end − start)) ^ power, × the modifiers
// below (never above 1); at the window's last age he always retires. Your players decide `announceDays` before the
// season's end (a "Last season" tag and a banner); the rest of the world decides on the day.
export const RETIRE = {
  window: { outfield: [32, 38], GK: [34, 40] },
  first: 0.08,
  power: 1.4,
  lowForm: { below: -3, mult: 1.4 }, // a poor season
  tier: { Rare: 0.85, Legendary: 0.6 }, // the great ones play on longer
  longServing: { seasons: 8, mult: 0.7 }, // your players: this many seasons at the club
  fit: { phy: 65, mult: 0.85 }, // still strong
  traits: { Leader: 0.8, 'Engine Room': 0.9 },
  freeAgent: 1.5, // nobody wants him: more likely
  // injury history: stored until injuries arrive (M25)
  announceDays: 28,
};

// Regens (bible §10): every retirement makes one new young player (an original name, the retiree's position, a share of
// his best overall as potential). Where: a retiree from an AI club → that club's youth (17–18) if it has room, else the
// free agents (18); from the free agents / wider market → the same pool (18); yours → your next academy trials (15–18)
// with a Youth Corner, else the free agents. Never a Featured Player (no portrait, a generated name).
export const REGEN = {
  share: [0.86, 1.08], // potential = best overall × this
  spread: 4, // the range shown around it (non-academy)
  room: 5, // potential at least current overall + room
  cap: { Standard: 74, Rare: 84 }, // the Regional world's ceilings (data/players.js GEN.potential.cap)
  rareFrom: 74,
  clubAges: [17, 18],
  poolAge: 18,
  academyAges: [15, 18],
  pendingMax: 6, // regens waiting for the next trials
};

// The Hall of Fame (bible §10 / §33 / §36): a retired player of yours goes in when he meets any one of these. Entries live
// in the account save (they survive new games; NG+ Legacy Player reads them in M29).
export const HALL_OF_FAME = {
  apps: 150,
  goals: 60,
  cleanSheets: 50,
  record: { minApps: 50 }, // holding a club record (appearances, goals, assists, clean sheets) counts from this many games
  trophies: 1, // stored until the trophies list (M27)
  max: 200, // account entries kept
};

// Staff-conversion eligibility (bible §10): the event itself is M28; the flag is stored now.
export const STAFF_ELIGIBLE = { apps: 150 };

export const RECORD_KEYS = [
  { key: 'apps', name: 'Appearances' },
  { key: 'goals', name: 'Goals' },
  { key: 'assists', name: 'Assists' },
  { key: 'cleanSheets', name: 'Clean sheets' },
];

export const CAREER_TEXT = {
  lastSeason: 'LAST SEASON',
  hofTitle: 'Hall of Fame',
  hofSubtitle: 'Your club legends, kept for every club you run',
  hofEmpty: 'Nobody yet. A player of yours who retires with 150+ appearances, 60+ goals, 50+ clean sheets or a club record goes in.',
};
