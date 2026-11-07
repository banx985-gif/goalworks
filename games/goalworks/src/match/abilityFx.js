// Abilities in the match (Milestone 26, bible §14): the one lookup the engine reads, as facilities and staff go through
// effects.js. Each match player may carry abl (ability ids, src/systems/abilities.js matchIds); initAbilities turns them
// into p.ax { key: value } once (data/abilities.js FX_KEYS: what each key changes and where). Team-wide abilities (Tempo
// Setter, Leader, Captain Fantastic, Time Bender) go into the side's own map instead and count once, however many of its
// players on the pitch have them. Nothing here rolls a die: a player with no abilities reads 0 everywhere, so a match
// without abilities runs exactly as before.
//   initAbilities(world)        p.ax for everyone who starts (and a bench player when he comes on: refreshPlayer)
//   ax(p, key) → number          his own value (0 without)
//   tax(world, team, key) → n    the side's team-wide value (the players on the pitch now; once a team)
//   moveMult(world, p, dt, own)  → { speed, accel } × for this step (Electric's burst, Blink Run, Cover Defender, a
//                                 sweeper keeper) — keeps the little run state it needs on p
//   tally(world, p, key, n)      a per-player match count (world.pst[id or name]: tacklesWon, beaten, …) the club reads
import { abilityById, abilityByName } from '../../data/abilities.js';
import { GODS } from '../../data/gods.js';
import { MATCH_TIME } from '../../data/match.js';

const ZIP = GODS.GOD3.blessing;
const DT = MATCH_TIME.step;

// The engine map of a list of ability ids: per-player keys summed over distinct abilities (the same id twice counts once),
// team keys kept apart.
export function fxOfIds(ids = []) {
  const own = {};
  const team = {};
  for (const id of new Set(ids)) {
    const a = abilityById(id);
    if (!a) continue;
    for (const [k, v] of Object.entries(a.fx)) {
      const m = a.team ? team : own;
      m[k] = a.team ? Math.max(m[k] ?? 0, v) : (m[k] ?? 0) + v;
    }
  }
  return { own: Object.keys(own).length ? own : null, team: Object.keys(team).length ? team : null };
}

export function refreshPlayer(world, p) {
  // (a player with only a trait name — a test side, an older set-up — plays that one ability)
  const ids = p.abl?.length ? p.abl : p.trait && abilityByName(p.trait) ? [abilityByName(p.trait).id] : [];
  const f = ids.length ? fxOfIds(ids) : { own: null, team: null };
  p.ax = f.own;
  p.tax = f.team;
  // Big Match Monster: everything +v in a final or a promotion game (a copy: the set-up's numbers stay as they are)
  if (world.setup.big && p.ax?.bigMatch) p.stats = Object.fromEntries(Object.entries(p.stats).map(([k, v]) => [k, Math.round(v * (1 + p.ax.bigMatch))]));
  world.taxCache = null;
}
export function initAbilities(world) {
  world.pst = {};
  world.taxCache = null;
  for (const p of world.all) refreshPlayer(world, p);
}

export const ax = (p, k) => (p?.ax ? p.ax[k] ?? 0 : 0);
export function tax(world, team, k) {
  if (!world.taxCache) {
    world.taxCache = [{}, {}];
    for (const p of world.players) if (p.tax) for (const [kk, v] of Object.entries(p.tax)) world.taxCache[p.team][kk] = Math.max(world.taxCache[p.team][kk] ?? 0, v);
  }
  return world.taxCache[team][k] ?? 0;
}

// Speed / acceleration × for one step of movement. own: his side has the ball.
export function moveMult(world, p, dt, own) {
  if (!p.ax) return null;
  let speed = 1;
  let accel = 1;
  if (p.ax.rush && p.role === 'GK') speed *= 1 + p.ax.rush;
  if (p.ax.recovery && !own) speed *= 1 + p.ax.recovery;
  if (p.ax.burst) {
    // the first 3 seconds of a run (he has been moving at a good lick for less than 3 s)
    const v = Math.hypot(p.vx, p.vy);
    p.runFor = v > 3 ? (p.runFor ?? 0) + dt : 0;
    if (v > 0.5 && p.runFor < 3) speed *= 1 + p.ax.burst;
  }
  if (p.ax.blink && own && p !== world.owner) {
    // one burst off the ball every blink seconds: 1 s at the God of Speed's acceleration
    const t = world.steps * DT;
    if (p.blinkUntil != null && t < p.blinkUntil) accel *= ZIP.accelMult;
    else if (p.blinkAt == null || t - p.blinkAt >= p.ax.blink) {
      p.blinkAt = t;
      p.blinkUntil = t + 1;
      accel *= ZIP.accelMult;
      tally(world, p, 'blinks');
    }
  }
  return speed === 1 && accel === 1 ? null : { speed, accel };
}

export const keyOf = (p) => `${p.team}:${p.id ?? p.name}`; // (the side first: an opponent's id never mixes with ours)
export function tally(world, p, k, n = 1) {
  if (!p) return;
  const s = (world.pst ??= {})[keyOf(p)] ??= {};
  s[k] = (s[k] ?? 0) + n;
}
