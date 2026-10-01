// Formations, player roles and tactical familiarity (Milestone 9, bible §15). Plain data; the engine reads it through
// src/match/matchWorld.js (slots, zones, roles) and matchAI.js (the nudges); src/systems/tactics.js keeps the club's
// choices and familiarity.
import { FORMATION_442 } from './match.js';

// Each formation: 11 slots, keeper first, in the M3 frame (fx 0 left … 1 right as the team sees it, fy 0 = the goal it
// attacks … 1 = its own goal line). line: the engine's line (GK / DF / MF / FW: how far a player may slide, how far he
// runs, what the carrier's options think of him). pos: the natural position the best XI fills it from (GK / DF / MF /
// WG / FW). role: the slot's default player role. zone: the box the zone AI keeps him in — a: [how far up, how far back]
// in metres from the goal the team attacks (none = the line's M3 box).
// The 4-4-2 is the Milestone 3 formation exactly (its default roles have no nudges), so a 4-4-2 on the defaults plays
// the Milestone 3 match to the step.
const S = (line, pos, fx, fy, role, zone = null) => ({ line, pos, fx, fy, role, ...(zone ? { zone } : {}) });
const FB = (fx, fy = 0.78) => S('DF', 'DF', fx, fy, 'fullback');
const CB = (fx, fy = 0.82) => S('DF', 'DF', fx, fy, 'cover');
const WB = (fx, fy, line = 'MF') => S(line, 'DF', fx, fy, 'wingback', { a: [26, 97] });
const CM = (fx, fy = 0.64, role = 'boxToBox') => S('MF', 'MF', fx, fy, role);
const WM = (fx, fy = 0.6) => S('MF', 'WG', fx, fy, 'winger');
const ST = (fx, fy = 0.46, role = 'poacher') => S('FW', 'FW', fx, fy, role);
const GK = S('GK', 'GK', 0.5, 0.96, 'keeper');

export const FORMATIONS = [
  {
    id: '442',
    name: '4-4-2',
    slots: FORMATION_442.map((s) => (s.role === 'GK' ? GK : s.role === 'DF' ? (s.fx < 0.2 || s.fx > 0.8 ? FB(s.fx, s.fy) : CB(s.fx, s.fy)) : s.role === 'MF' ? (s.fx < 0.2 || s.fx > 0.8 ? WM(s.fx, s.fy) : CM(s.fx, s.fy)) : ST(s.fx, s.fy))),
  },
  { id: '433', name: '4-3-3', slots: [GK, FB(0.14), CB(0.38), CB(0.62), FB(0.86), CM(0.3, 0.62), CM(0.5, 0.68, 'holding'), CM(0.7, 0.62), S('FW', 'WG', 0.16, 0.48, 'winger'), ST(0.5, 0.44), S('FW', 'WG', 0.84, 0.48, 'winger')] },
  { id: '4231', name: '4-2-3-1', slots: [GK, FB(0.14), CB(0.38), CB(0.62), FB(0.86), CM(0.38, 0.7), CM(0.62, 0.7), S('MF', 'WG', 0.16, 0.6, 'winger'), CM(0.5, 0.6, 'playmaker'), S('MF', 'WG', 0.84, 0.6, 'winger'), ST(0.5)] },
  { id: '352', name: '3-5-2', slots: [GK, CB(0.28, 0.8), CB(0.5, 0.84), CB(0.72, 0.8), WB(0.08, 0.64), CM(0.3, 0.62), CM(0.5, 0.67, 'holding'), CM(0.7, 0.62), WB(0.92, 0.64), ST(0.38), ST(0.62)] },
  { id: '343', name: '3-4-3', slots: [GK, CB(0.28, 0.8), CB(0.5, 0.84), CB(0.72, 0.8), WB(0.08, 0.62), CM(0.38), CM(0.62), WB(0.92, 0.62), S('FW', 'WG', 0.18, 0.5, 'winger'), ST(0.5, 0.44), S('FW', 'WG', 0.82, 0.5, 'winger')] },
  { id: '532', name: '5-3-2', slots: [GK, WB(0.08, 0.74, 'DF'), CB(0.3), CB(0.5, 0.85), CB(0.7), WB(0.92, 0.74, 'DF'), CM(0.3, 0.62), CM(0.5, 0.66, 'holding'), CM(0.7, 0.62), ST(0.38), ST(0.62)] },
  { id: '4141', name: '4-1-4-1', slots: [GK, FB(0.14), CB(0.38), CB(0.62), FB(0.86), CM(0.5, 0.7), WM(0.14, 0.58), CM(0.38, 0.6), CM(0.62, 0.6), WM(0.86, 0.58), ST(0.5, 0.44)] },
  { id: '4411', name: '4-4-1-1', slots: [GK, FB(0.14), CB(0.38), CB(0.62), FB(0.86), WM(0.14), CM(0.38), CM(0.62), WM(0.86), S('FW', 'FW', 0.5, 0.54, 'falseNine'), ST(0.5, 0.44)] },
];
export const formationById = (id) => FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
export const DEFAULT_FORMATION = '442';

// Player roles (bible §15) by the slot's natural position. Each role's nudges bend that player's movement and choices
// (matchAI.js); the M3 default for each 4-4-2 slot (Keeper, Cover, Fullback, Box-to-Box, Winger, Poacher) has none:
//   aShift   metres deeper (+) / higher (−) in his zone        aOwn     … extra while we have the ball
//   xIn      how far towards the middle (share of the width) while we have the ball (− = out wide)
//   runs     × his support-run length        shot / dribble / passBias   + to those choices when he has the ball
//   progress × how much a forward pass is worth to him         target   + a long / lofted pass to him scores this more
//   chase    × his distance when the team picks who presses (< 1: he goes more often)
//   keeperOut × how far off his line the keeper stands (and claims loose balls)
export const ROLES = {
  keeper: { name: 'Keeper', group: 'GK' },
  sweeperKeeper: { name: 'Sweeper Keeper', group: 'GK', keeperOut: 1.7 },
  stopper: { name: 'Stopper', group: 'DF', aShift: -3, chase: 0.8 },
  cover: { name: 'Cover', group: 'DF' },
  ballPlaying: { name: 'Ball-Playing', group: 'DF', progress: 1.3, passBias: 0.03 },
  fullback: { name: 'Fullback', group: 'DF' },
  wingback: { name: 'Wingback', group: 'DF', aOwn: -16, xIn: -0.05, runs: 1.3 },
  ballWinner: { name: 'Ball Winner', group: 'MF', chase: 0.7, runs: 0.8 },
  boxToBox: { name: 'Box-to-Box', group: 'MF' },
  playmaker: { name: 'Playmaker', group: 'MF', passBias: 0.06, progress: 1.15, dribble: -0.05 },
  holding: { name: 'Holding', group: 'MF', aShift: 6, runs: 0.3 },
  attackingMid: { name: 'Attacking Mid', group: 'MF', aShift: -4, runs: 1.25, shot: 0.04 },
  winger: { name: 'Winger', group: 'WG' },
  insideForward: { name: 'Inside Forward', group: 'WG', xIn: 0.12, shot: 0.04, runs: 0.85 },
  widePlaymaker: { name: 'Wide Playmaker', group: 'WG', xIn: 0.06, passBias: 0.06, runs: 0.8 },
  poacher: { name: 'Poacher', group: 'FW' },
  targetForward: { name: 'Target Forward', group: 'FW', target: 0.12, dribble: -0.08, aShift: 2 },
  pressingForward: { name: 'Pressing Forward', group: 'FW', chase: 0.65, runs: 0.9 },
  falseNine: { name: 'False Nine', group: 'FW', aOwn: 8, passBias: 0.04, shot: -0.02 },
};
export const ROLE_GROUPS = { GK: ['keeper', 'sweeperKeeper'], DF: ['stopper', 'cover', 'ballPlaying', 'fullback', 'wingback'], MF: ['ballWinner', 'boxToBox', 'playmaker', 'holding', 'attackingMid'], WG: ['winger', 'insideForward', 'widePlaymaker'], FW: ['poacher', 'targetForward', 'pressingForward', 'falseNine'] };
// The roles a slot may take: its natural position's group (wide midfield and wide forward slots: the winger roles).
export const rolesForSlot = (slot) => ROLE_GROUPS[slot.pos] ?? ROLE_GROUPS.MF;

// Tactical familiarity (bible §15): 0–100 per formation + build style pair, e.g. '442:balanced'.
export const FAMILIARITY = {
  start: { pair: '442:balanced', value: 70 }, // a new club (and an older save) knows its 4-4-2 Balanced, nothing else
  training: 0.9, // a training day in the chosen pair (not on rest / day off)
  match: 4, // a match played in it (the pair it started in)
  fade: 0.15, // every other pair loses this a day
  comfortable: 70, // at or above: no penalty
  // below comfortable the penalty grows to its full size at 0: positioning slips (metres of extra drift in the zone) and
  // execution errors (× pass / shot error)
  drift: 6,
  errMax: 0.6, // × (1 + errMax) pass and shot error at 0
  decide: 0.5, // × (1 + decide) time between the carrier's decisions at 0
  crowd: 0.4, // × (1 + crowd) the pressure the players feel at 0
};
export const pairKey = (formation, build) => `${formation}:${build}`;

// The Regional clubs' tactics (opponents pick them from here).
export const CLUB_TACTICS = {
  REG01: { formation: '442', build: 'balanced' },
  REG02: { formation: '532', build: 'counter', mentality: 'defensive' },
  REG03: { formation: '433', build: 'possession' },
  REG04: { formation: '4231', build: 'balanced', press: 'high' },
  REG05: { formation: '352', build: 'direct' },
  REG06: { formation: '4141', build: 'counter', line: 'deep' },
};
