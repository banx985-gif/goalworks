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
  // Play mode (Milestone 4, bible §17): the human's stick and buttons. Tuned with tests/goalworks/m4.test.mjs so a
  // "perfect input" player gains only a little over the AI with the same squad (the §17 ceiling, ~10–15%).
  control: {
    dead: 0.15, // stick dead zone (0–1): inside it the AI moves the player (a pass on its way to them is met by the AI too)
    holdSteps: 15, // Pass held this long (0.25 s) then released = a lofted through ball / cross
    // steps after taking the ball before the carrier can pass or shoot (a press this early waits). Milestone 7: 5 → 8 —
    // with real squad ratings a perfect-input player gained +20.6% points a match at 5 (over the §17 ~15% ceiling); at 8
    // it gains +9.6% (960 matches each, real squads v generated opponents; 7 gave +15.6%, 10 gave −10%)
    firstTouch: 8,
    buffer: 18, // … how long such an early press is remembered
    coneDeg: 50, // a pass goes to the team-mate nearest the stick direction inside this cone (else the best angle)
    throughLead: 4, // metres ahead of the receiver (towards goal) a through ball is played
    shotH: 0.9, // shot height aimed at (m); the error still comes from the stats
    sprint: 1.12, // speed × while sprinting (with or without the ball) — the biggest lever on the manual advantage
    drain: 0.7, // stamina (0–1) used per second of sprinting (a full bar is a ~1.4 s burst)
    refill: 0.1, // … and won back per second when not sprinting (empty to full in 10 s)
    recover: 0.3, // an empty bar must refill to this before sprinting again
    missCool: 0.6, // a tackle out of reach (tackle.reach, the AI's own): this long before the next one, at half speed
  },
};

// Manage mode (Milestone 5, bible §15 / §17): the four team commands. Each option is a small set of changes to the M3
// zone AI (matchAI.js reads them through world.fx[team]); anything an option leaves out keeps the FX_BASE value, so the
// Balanced / Normal defaults are exactly the Milestone 3 match. Every option is a trade-off — it gains something and pays
// for it (tuned over 300 seeded matches per option; tests/goalworks/m5.test.mjs checks none is a free boost):
//   mentality  line: metres the block sits higher (−) or deeper (+) (fwLine: × for the forwards) · runs: × support-run
//              length · push: × how far the block steps up with the ball · shot: + shot eagerness · progress: × how much
//              a pass forward is worth
//   pressing   press: 'contain' (the first man stands off until they are within zone m of our goal) | 'normal' |
//              'double' (while they are further than zone m out, two press and a third covers) · drop: metres the block
//              drops (+) or steps up (−) without the ball · tackleEvery: steps between a presser's tries
//   tempo      decide: × time between the carrier's decisions · hold: first-touch steps · dribble / passBias: + to those
//              choices · err: × pass error · zip: + pass pace (m/s) · crowd: × the pressure our players feel ·
//              shield: − to tackles against our carrier (a patient side keeps the ball close)
//   width      spread / spreadOff: × how far the shape reaches across with / without the ball · shift: × how far it
//              slides with the ball · shotErr: × our shot error (a crowded box when narrow, a stretched defence when wide)
// Measured (home on the option, away on the defaults, 300 matches each; goals per match for–against, base 1.33–1.24):
//   Defensive 0.74–0.89 · Attacking 2.58–2.60 · Low press 1.02–1.03 · High press 1.64–2.00 · Slow 1.43–1.36 (fewer
//   passes, more of the ball) · Fast 1.15–1.15 (more passes, less of the ball) · Narrow 0.98–0.91 · Wide 1.36–1.53.
// (The full tactics library — formations, roles, familiarity — is Milestone 9.)
export const TACTICS = {
  mentality: { label: 'Mentality', options: ['defensive', 'balanced', 'attacking'], names: ['Defensive', 'Balanced', 'Attacking'], def: 'balanced' },
  pressing: { label: 'Pressing', options: ['low', 'normal', 'high'], names: ['Low', 'Normal', 'High'], def: 'normal' },
  tempo: { label: 'Tempo', options: ['slow', 'normal', 'fast'], names: ['Slow', 'Normal', 'Fast'], def: 'normal' },
  width: { label: 'Width', options: ['narrow', 'normal', 'wide'], names: ['Narrow', 'Normal', 'Wide'], def: 'normal' },
};
export const TACTIC_FX = {
  mentality: {
    defensive: { line: 4, fwLine: 0, runs: 0.85, push: 0.8 },
    attacking: { line: -4, runs: 1.3, push: 1.35, shot: 0.05, progress: 1.15 },
  },
  pressing: {
    low: { press: 'contain', zone: 45, drop: 6, tackleEvery: 11 },
    high: { press: 'double', zone: 50, drop: -3, tackleEvery: 7 },
  },
  tempo: {
    slow: { decide: 1.5, hold: 16, err: 0.75, progress: 0.9, shield: 0.08 },
    fast: { decide: 0.7, hold: 6, passBias: 0.06, err: 1.05, progress: 1.2, runs: 1.2, crowd: 0.8 },
  },
  width: {
    narrow: { spread: 0.92, spreadOff: 0.9, shift: 1.1, shotErr: 2.0, runs: 0.9 },
    wide: { spread: 1.1, spreadOff: 1.03, shift: 0.9, shotErr: 0.6, runs: 1.25 },
  },
};
// The Balanced / Normal values every option starts from (the Milestone 3 engine exactly).
export const FX_BASE = { line: 0, runs: 1, push: 1, shot: 0, progress: 1, press: 'normal', drop: 0, tackleEvery: 9, decide: 1, hold: 8, dribble: 0, passBias: 0, err: 1, zip: 0, spread: 1, spreadOff: 1, shift: 1, crowd: 1, fwLine: 0.6, zone: 40, shotErr: 1, shield: 0 };

// Key Moments (Milestone 5, bible §17): in Watch / Manage the match pauses and offers a short jump into Play. A moment
// lasts at least minSec of play (unless the half ends) and at most maxSec, and after minSec it hands back at the next dead
// ball or once the ball has clearly changed hands (settleSec). Offers are spaced by cooldownSec, at most maxPerMatch.
// penalty / freeKick are hooks only: fouls and set pieces arrive in Milestone 25 (keyMoments.js offerFromEvent()).
export const KEY_MOMENTS = {
  minSec: 20,
  maxSec: 60,
  settleSec: 1.5,
  cooldownSec: 30,
  maxPerMatch: 5,
  chance: { range: 26, goalSide: 2, pressure: 0.9 }, // our carrier this close to goal, ≤ goalSide outfield defenders goal-side
  defence: { fromMinute: 84, range: 40 }, // their carrier within range of our goal, us level or one up
  lateAttack: { fromMinute: 87 }, // our ball in their half, us level or one down
  types: {
    chance: { title: 'Big chance!', line: 'Through on goal. Take the shot yourself?', attack: true },
    corner: { title: 'Dangerous corner', line: 'A corner for us. Attack it yourself?', attack: true },
    cornerDef: { title: 'Dangerous corner', line: 'A corner against us. Defend it yourself?', attack: false },
    defence: { title: 'Last-minute defence', line: 'They are pressing for a late goal. Hold them off?', attack: false },
    lateAttack: { title: 'Stoppage-time attack', line: 'One last push. Lead it yourself?', attack: true },
    penalty: { title: 'Penalty!', line: 'Take it yourself?', attack: true, hook: true },
    freeKick: { title: 'Free kick', line: 'In shooting range. Take it yourself?', attack: true, hook: true },
  },
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
  goal: 'match_15', // (menus only: the match draws its goals in code, square on the goal line — Milestone 7)
  flag: 'match_16',
  kitHex: { match_01: '#D0322B', match_02: '#2154B8', match_03: '#F2C230', match_04: '#2E8B3E' },
};
