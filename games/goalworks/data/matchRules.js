// Injuries, discipline, set pieces and substitutes (Milestone 25, bible §19 / §20). Plain data: the match engine
// (src/match/matchWorld.js, matchAI.js, setPieces.js) reads the in-match numbers, src/systems/medical.js the club side
// (recovery, bans, yellows, takers). Every rate is tuned on the measured matches (tests/goalworks/m25.test.mjs logs them:
// docs/DECISIONS.md M25 has the numbers) to look like real football: 0.1–0.3 injuries, 3–4 yellows, a red every 8–10
// matches and 25–30% of goals from set pieces.

// --- injuries (bible §19) ---------------------------------------------------------------------------------------------
// Severity: Minor 3–10 days, Moderate 2–5 weeks, Serious 6–16 weeks (share = how often, of all injuries).
export const SEVERITY = [
  { id: 'minor', name: 'Minor', days: [3, 10], share: 0.68 },
  { id: 'moderate', name: 'Moderate', days: [14, 35], share: 0.24 },
  { id: 'serious', name: 'Serious', days: [42, 112], share: 0.08 },
];
export const severityById = (id) => SEVERITY.find((s) => s.id === id) ?? SEVERITY[0];
export const INJURY = {
  // in the match: a fouled player is hurt this often (a reckless foul more), a tackle that wins the ball clean now and then,
  // and an overuse knock (a player who started tired), rolled once a minute per player
  onFoul: 0.0095,
  onReckless: 0.05,
  onTackle: 0.0016,
  overusePerMin: 0.00004,
  tiredFrom: 70, // fatigue at kickoff: above it the risk climbs (bible), × up to tiredMax at 100
  tiredMax: 3,
  history: 0.08, // + this much risk per past injury (at most historyMax)
  historyMax: 0.5,
  minRisk: 0.3, // the club's prevention can never take the risk below this share
  pauseSec: 2.2, // the play stops this long with the INJURED tag
  // while out: match fitness and form slip a little each day
  fitnessPerDay: 0.6, // fatigue the player carries back (his match sharpness) builds while he is out, to fitnessMax
  fitnessMax: 45,
  formPerDay: -0.08,
  potentialKnock: { age: 30, chance: 0.5, by: [1, 3] }, // a Serious injury at 30+: his ceiling may drop a little
  cap: 1, // at most one new injury per player per match
};

// --- discipline -------------------------------------------------------------------------------------------------------
// A tackle can be a foul (the same model for the AI and a manual tackle — bible): more when it fails, more from a poor
// tackler on a good dribbler, from hard pressing and an aggressive mentality, and from a reckless tackle (a lunge at speed
// or from behind). A foul may be a card.
export const DISCIPLINE = {
  foulFail: 0.4, // a failed tackle
  foulWon: 0.08, // a tackle that won the ball
  inBox: 1.9, // × in the defenders' own box (more penalties)
  inBoxLine: { deep: 0.55, normal: 1, high: 1 }, // × that: a settled deep block jockeys in its box rather than diving in
  booked: 0.4, // × for a player already on a yellow (he is careful now)
  bookedYellow: 0.15, // × the chance a booked player's foul is a second yellow (the referee gives him a word first)
  skill: 0.004, // per point the dribbler's dribbling is above the tackler's tackling
  reckless: { speed: 1.25, behind: -0.8, add: 0.2 }, // closing faster than 1.25 × his own top speed, or from behind the carrier's run
  yellow: 0.35, // a foul is a yellow this often (a reckless one more)
  recklessYellow: 0.5,
  straightRed: 0.0015,
  recklessRed: 0.012,
  danger: 0.02, // a foul stopping a clear run on goal (DOGSO): more often a card
  pressMult: { low: 0.8, mid: 1, high: 1.3 }, // the team's pressing (hard pressing: more fouls)
  mentalityMult: { defensive: 0.92, balanced: 1, attacking: 1.12 }, // an aggressive mentality: more
  // bans (bible §19): a red card = 1 match (a straight red 2); 5 yellows in one competition = 1 match. Bans are served
  // on your next competitive matches of any competition (not the Summer Showcase); yellows count per competition and
  // reset at the season's end.
  redBan: 1,
  straightRedBan: 2,
  yellowsForBan: 5,
  yellowBan: 1,
};

// --- set pieces (bible §20) ---------------------------------------------------------------------------------------------
// Routines for corners and wide free kicks: where the delivery goes, who attacks it, and the chance it makes.
//   aim: share across the goal mouth (0 near post … 1 far post) and depth (metres out); headerBonus: + chance to win the
//   header; shot: what a won ball becomes (header / volley from the edge / a short move that keeps the ball)
export const ROUTINES = [
  { id: 'near', name: 'Near Post', line: 'Whipped to the near post: a flick-on header', aim: { across: 0.25, depth: 5.5 }, headerBonus: 0.06, shot: 'header', danger: 1 },
  { id: 'far', name: 'Far Post', line: 'Floated to the far post: your tallest attacks it', aim: { across: 0.8, depth: 7 }, headerBonus: 0.02, shot: 'header', danger: 1.1, tall: true },
  { id: 'edge', name: 'Edge', line: 'Pulled back to the edge of the box: a first-time shot', aim: { across: 0.5, depth: 16 }, headerBonus: 0.1, shot: 'volley', danger: 0.9 },
  { id: 'short', name: 'Short', line: 'Played short: keep the ball and work a cross', aim: { across: 0, depth: 0 }, headerBonus: 0, shot: 'short', danger: 0.6 },
  { id: 'mixed', name: 'Mixed', line: 'A bit of everything: they never know what is coming', aim: null, headerBonus: 0.03, shot: 'mixed', danger: 1 },
];
export const routineById = (id) => ROUTINES.find((r) => r.id === id) ?? ROUTINES[4];
export const SET_PIECES = {
  // the aerial contest: attacker (PHY + ATK) against the best defender's (PHY + DEF) and the keeper coming for it
  header: { base: 0.38, perPoint: 0.006, keeperClaim: 0.1, power: 19, lineFx: { deep: -0.12, normal: 0, high: 0.05 } }, // lineFx: the defending side's line
  volley: { power: 21 },
  corner: { fromParry: 0.55, fromBlock: 0.6, fromMiss: 0.4 }, // how often a parried save / a block / a shot just wide off a defender goes behind
  freeKick: { directRange: 30, wideX: 0.28, directSkill: 0.5, wall: 0.18, power: 22 },
  penalty: { base: 0.77, skill: 0.004, keeper: 0.003, miss: 0.06, power: 24, spot: 11 },
  // Play mode: aim (−1 left … +1 right across the goal, 0 low … 1 high) and power (0–1). Close to a post or high is
  // harder to save but too close / too hard goes wide or over; the keeper's dive (−1, 0, +1) and timing (0–1, 0.5 ideal)
  aimEdge: 0.86, // |aim.x| past this or aim.y past this with power past overPower: wide / over
  overPower: 0.88,
  diveReach: 0.42, // a dive the right way saves shots within this share of the goal of where he went, timing permitting
  level: { ref: 52, min: 0.45, max: 1.15 }, // (src/match/setPieces.js setPieceLevel) the defending side's organisation: ref ÷ its average tackling
  pause: 1.4, // seconds the set piece is set up before it is taken
  pensEach: 5, // shoot-out: five each, then sudden death
  shootoutPause: 1.3, // seconds between kicks on screen
  setPiecePct: 'setPiecePct', // the effect key (research R28 Set Pieces, training) that adds to the taker's skill
  takerSuggest: { pen: ['shooting', 'TEC'], fk: ['shooting', 'passing'], corner: ['passing'] },
};
// Set-piece abilities (bible traits; the full 40 are M26 — these hooks are what they plug into):
export const SET_PIECE_TRAITS = {
  'Penalty King': { pen: 0.12, saves: 0.1 }, // as a taker: +12% to score; as a keeper: +10% to save
  'Penalty Reader': { saves: 0.12 },
  'Ice Cold': { pen: 0.06, shootout: 0.06 },
};

// --- substitutes ----------------------------------------------------------------------------------------------------------
// 7 on the bench (Match Setup), 3 changes a match. An injured player is replaced at once while changes are left (by the
// AI for both sides, and for you in every mode); a sent-off player is never replaced (the side plays on a man down).
export const SUBS = { bench: 7, max: 3 };
