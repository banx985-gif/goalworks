// Substitutions by choice (Milestone 26; M25 built only the forced ones — injuries and a keeper sent off). Three changes a
// match (SUBS.max, an injury change uses one), from the bench of seven.
//   makeChange(world, team, i, benchIndex, why) — the man on the pitch with index p.i goes off, the bench player comes on in
//     his place (the timeline command ['sub', team, i, benchIndex]: Manage / Play / Watch's pause menu, so a saved match
//     replays exactly). → true when made (refused quietly with no change left, a shoot-out on, …)
//   canChange(world, team) → may a change be made now?
//   aiChanges(world) — once a match minute: the AI's own changes. The opponent always; your side only in Watch (in Manage
//     and Play the changes are yours). Tired players from 58′ (fatigue at kickoff + the match so far, fitter players last
//     longer), then protecting a lead (a forward off for a defender or midfielder) or chasing the game (a defender off for
//     a forward or winger). A change is only made with a like player on the bench who is not much worse. No dice: the
//     same match gives the same changes.
import { SUBS } from '../../data/matchRules.js';
import { replaceOnPitch } from './setPieces.js';
import { ax } from './abilityFx.js';

export const AI_CHANGES = {
  from: 58, // the first minute the AI looks at its bench
  every: 5, // minutes between two of one side's changes
  keepUntil: 80, // one change is kept back for an injury until then
  tired: { unknown: 35, perMinute: 0.45, fitness: 0.2, at: 66 }, // tiredness = fatigue at kickoff + minutes × perMinute − (pace − 50) × fitness
  lead: { from: 75, max: 2 }, // protecting a lead of 1–2 goals
  chase: { from: 70 }, // a goal or more down
  worse: 0.85, // the bench player must have at least this share of the tired man's numbers
};
const sum = (p) => p.stats.pace + p.stats.passing + p.stats.shooting + p.stats.tackling + p.stats.dribbling;

export function canChange(world, team) {
  return world.subsLeft[team] > 0 && world.bench[team].length > 0 && world.phase !== 'fulltime' && !world.pens;
}
export function makeChange(world, team, i, bi, why = 'tactical') {
  const p = world.players.find((q) => q.team === team && q.i === i);
  const b = world.bench[team]?.[bi];
  if (!p || !b || !canChange(world, team) || p.hurt) return false;
  const sp = world.special;
  if (sp?.kind === 'pen' && (sp.taker === p || sp.keeper === p)) return false; // (not the penalty taker or keeper mid-kick)
  if (sp?.taker === p) return false;
  if (world.owner === p) world.release(p);
  world.bench[team].splice(bi, 1);
  world.subsLeft[team]--;
  replaceOnPitch(world, p, b, why);
  return true;
}

export function aiChanges(world) {
  const A = AI_CHANGES;
  const m = world.minute;
  if (m < A.from || world.phase !== 'play' || world.special || world.pens) return;
  world.aiSub ??= [{ at: -99, lead: false, chase: false }, { at: -99, lead: false, chase: false }];
  for (const team of [0, 1]) {
    if (team === world.team && world.mode !== 'watch') continue;
    const st = world.aiSub[team];
    const left = world.subsLeft[team];
    if (!left || !world.bench[team].length || left <= (m < A.keepUntil ? 1 : 0) || m - st.at < A.every) continue;
    const side = world.players.filter((p) => p.team === team && p.role !== 'GK' && !p.hurt && p !== world.owner);
    const bench = world.bench[team];
    const like = (pos, out, min) => {
      let best = -1;
      bench.forEach((b, j) => {
        if (b.position === 'GK' || !pos.includes(b.position) || sum(b) < min) return;
        if (best < 0 || sum(b) > sum(bench[best])) best = j;
      });
      return best;
    };
    const go = (p, j, why) => {
      if (j < 0 || !makeChange(world, team, p.i, j, why)) return false;
      st.at = m;
      return true;
    };
    const diff = world.score[team] - world.score[1 - team];
    // tired players (the most tired first)
    const T = A.tired;
    const tiredness = (p) => ((p.fat ?? T.unknown) + m * T.perMinute * (1 - ax(p, 'stamina'))) - (p.stats.pace - 50) * T.fitness;
    const tired = side.filter((p) => tiredness(p) >= T.at).sort((a, b) => tiredness(b) - tiredness(a) || a.i - b.i);
    let done = false;
    for (const p of tired) if (!done) done = go(p, like([p.position], p, sum(p) * A.worse), 'tired');
    if (done) continue;
    // protecting a lead: a forward off, a defender / midfielder on
    if (!st.lead && m >= A.lead.from && diff >= 1 && diff <= A.lead.max) {
      const fw = side.filter((p) => p.position === 'FW' || p.position === 'WG').sort((a, b) => sum(a) - sum(b) || a.i - b.i)[0];
      if (fw && go(fw, like(['DF', 'MF'], fw, 0), 'lead')) st.lead = true;
      continue;
    }
    // chasing the game: a defender off, a forward / winger on
    if (!st.chase && m >= A.chase.from && diff < 0) {
      const df = side.filter((p) => p.position === 'DF').sort((a, b) => sum(a) - sum(b) || a.i - b.i)[0];
      if (df && go(df, like(['FW', 'WG'], df, 0), 'chase')) st.chase = true;
    }
  }
}
export { SUBS };
