// Key Moments (Milestone 5, bible §17): the moments worth jumping into Play for, read from the match as it stands. Pure
// reads of the world — nothing here changes the match or rolls its dice, so looking never alters what happens.
//   detectKeyMoment(world, team, seen) → a type from KEY_MOMENTS.types or null
//     team: the human's side. seen: { restart } — the last restart already looked at (a corner is offered once; saved
//     with the match, so it is a plain number: the step that restart ends on).
//   momentSettled(world, km) → true once the moment is over (a dead ball, or the ball clearly with the other side)
//   offerFromEvent(e) → a type for a match event, or null — the hook for penalties and free kicks (fouls and set pieces
//   arrive in Milestone 25; until then no event maps to them).
import { KEY_MOMENTS, MATCH_TIME } from '../../data/match.js';
import { pressureOn } from './matchAI.js';

const K = KEY_MOMENTS;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function detectKeyMoment(world, team, seen = {}) {
  const them = 1 - team;
  const diff = world.score[team] - world.score[them];
  // A corner: offered the moment it is given (either way).
  const restartKey = world.phase === 'restart' && world.restart ? world.steps + Math.round(world.phaseLeft / MATCH_TIME.step) : null;
  if (restartKey !== null && restartKey !== seen.restart) {
    seen.restart = restartKey;
    if (world.restart.type === 'corner') return world.restart.team === team ? 'corner' : 'cornerDef';
    return null;
  }
  if (world.phase !== 'play') return null;
  const o = world.owner;
  if (!o || o.role === 'GK') return null;
  const late = world.half === 2;
  if (o.team === team) {
    // Stoppage-time attack: our ball in their half at the very end, level or one down.
    if (late && world.minute >= K.lateAttack.fromMinute && (diff === 0 || diff === -1) && world.aOf(team, o.y) < world.pitch.h / 2) return 'lateAttack';
    // Big chance: close to goal, at most one outfield defender goal-side, not under real pressure.
    const g = world.goalOf(team);
    if (dist(o, g) > K.chance.range) return null;
    const myA = world.aOf(team, o.y);
    let goalSide = 0;
    for (const p of world.players) if (p.team === them && p.role !== 'GK' && world.aOf(team, p.y) < myA + 1 && Math.abs(p.x - o.x) < 14) goalSide++;
    if (goalSide <= K.chance.goalSide && pressureOn(world, o) < K.chance.pressure) return 'chance';
    return null;
  }
  // Last-minute defence: their ball near our goal at the end, us level or one up.
  if (late && world.minute >= K.defence.fromMinute && (diff === 0 || diff === 1) && world.aOf(them, o.y) < K.defence.range) return 'defence';
  return null;
}

// km: { type, start, turn } — turn counts the steps the ball has been with the "wrong" side (updated here).
export function momentSettled(world, km, team) {
  if (world.phase === 'restart' || world.phase === 'goal' || world.phase === 'halftime' || world.phase === 'fulltime') return true;
  const attack = K.types[km.type]?.attack ?? true;
  const o = world.owner;
  const wrong = o ? (attack ? o.team !== team : o.team === team) : false;
  km.turn = wrong ? (km.turn ?? 0) + 1 : 0;
  return km.turn >= Math.round(K.settleSec / MATCH_TIME.step);
}

export function offerFromEvent(e) {
  if (e?.type === 'penalty') return 'penalty';
  if (e?.type === 'freeKick' && e.shooting) return 'freeKick';
  return null;
}
