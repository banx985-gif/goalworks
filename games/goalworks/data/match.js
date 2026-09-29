// The 11v11 match vertical slice (Milestone 3, bible §16 / §41): pitch size, the 4-4-2, timings and the tuning numbers
// the engine (src/match/) reads. Plain data; units are metres and seconds of match simulation.
//
// The pitch runs up the screen: x across (0 … 68), y along (0 = top goal line … 105 = bottom goal line).
// A full match is ~5 real minutes at 1×: two compressed halves of 150 s of simulation each; the clock shows 0'–90'.
export const PITCH = {
  w: 68,
  h: 105,
  goalW: 7.32,
  goalH: 2.44,
  boxW: 40.32, // penalty area
  boxD: 16.5,
  sixW: 18.32, // goal area
  sixD: 5.5,
  circleR: 9.15,
  spotD: 11,
};

export const MATCH_TIME = {
  step: 1 / 60, // one simulation step (the engine never looks at frame times)
  halfSec: 150, // simulation seconds per half → ~5 real minutes at 1×
  halfMinutes: 45,
  halfTimePause: 2.5, // simulation seconds the teams stand at half time
  restartPause: 0.8, // throw-in / goal kick / corner: the quick placement
  goalPause: 2.2, // after a goal, before the kickoff
  speeds: [1, 2],
};

// 4-4-2 for a team attacking up the pitch (towards y = 0), as fractions: fx across (0 left … 1 right), fy along its own
// half-and-a-bit (0 = the goal it attacks … 1 = its own goal line). The engine mirrors it for the other side.
export const FORMATION_442 = [
  { role: 'GK', fx: 0.5, fy: 0.96 },
  { role: 'DF', fx: 0.14, fy: 0.78 },
  { role: 'DF', fx: 0.38, fy: 0.82 },
  { role: 'DF', fx: 0.62, fy: 0.82 },
  { role: 'DF', fx: 0.86, fy: 0.78 },
  { role: 'MF', fx: 0.14, fy: 0.6 },
  { role: 'MF', fx: 0.38, fy: 0.64 },
  { role: 'MF', fx: 0.62, fy: 0.64 },
  { role: 'MF', fx: 0.86, fy: 0.6 },
  { role: 'FW', fx: 0.38, fy: 0.46 },
  { role: 'FW', fx: 0.62, fy: 0.46 },
];

// How the engine plays (tuned with tests/goalworks/m3.test.mjs: 200 seeded matches).
export const TUNING = {
  playerR: 0.55, // body circle
  controlR: 1.0, // how close a player must be to take the ball (and the ball under 1.3 m high)
  controlH: 1.3,
  speed: { base: 5.2, pace: 2.6 }, // m/s: base + pace × stat/100
  accel: 14,
  decideEvery: 0.36, // seconds between a player's decisions (staggered by shirt number)
  ownerDecideEvery: 0.22,
  chasers: 2, // players per team who go for a loose ball / press the carrier
  shape: { shiftX: 0.35, followY: 0.55, attackPush: 0.12, depth: 58 }, // how the block moves with the ball
  pass: { minSpeed: 11, maxSpeed: 24, errDeg: 11, loftOver: 22, loftChance: 0.55 },
  shot: { range: 28, speed: 25, errDeg: 9, errPerM: 0.36, closeBonus: 0.25, eager: 0.3 },
  tackle: { reach: 1.5, base: 0.42, cooldown: 0.9 },
  dribble: { speedFactor: 0.82, ahead: 0.65 },
  keeper: { reach: 1.25, dive: 3.6, react: 0.18, save: 0.76, hold: 0.55 },
  ball: { rollDecel: 2.6, rollDrag: 0.35, airDrag: 0.05, gravity: 9.8, bounce: 0.45 },
  pressure: { radius: 4.5 },
};

// Test players (Milestone 3): plain generated names, flat stats — no real squad yet.
export const TEST_STAT = 50;
export const FIRST_NAMES = [
  'Alex', 'Ben', 'Cal', 'Dan', 'Eli', 'Finn', 'Gabe', 'Harry', 'Ivo', 'Jack', 'Kai', 'Leo', 'Max', 'Nico', 'Olly', 'Pete',
  'Quinn', 'Rory', 'Sam', 'Theo', 'Uri', 'Vic', 'Will', 'Yusuf', 'Zac', 'Ade', 'Bram', 'Cole', 'Dev', 'Ewan',
];
export const SURNAMES = [
  'Ash', 'Bell', 'Carr', 'Dale', 'Ellis', 'Ford', 'Gray', 'Hale', 'Irwin', 'Jones', 'Kerr', 'Lowe', 'Mason', 'Nash', 'Owen',
  'Pike', 'Reed', 'Shaw', 'Tate', 'Vance', 'Wade', 'Young', 'Baker', 'Cross', 'Drew', 'Frost', 'Hart', 'Lane', 'Moss', 'Price',
];

// Match art (Batch 3). Bodies are picked per side so the two teams read apart; kit tinting is Milestone 6.
export const MATCH_ART = {
  outfield: ['match_01', 'match_02', 'match_03', 'match_04'], // red / blue / yellow / green runners (front view)
  keepers: ['match_07', 'match_08'], // purple / cyan
  ball: 'match_13',
  goal: 'match_15',
  flag: 'match_16',
  kitHex: { match_01: '#D0322B', match_02: '#2154B8', match_03: '#F2C230', match_04: '#2E8B3E' },
};
