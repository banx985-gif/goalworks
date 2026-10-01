// Scouting (Milestone 11, bible §10): the Founder-era scout (a placeholder until staff arrive in M14) looks at a region and
// a position; after a few game days a report lists players with stats as ranges and potential as a label and a range.
// Knowledge of a player (0 … 1) grows with every scouting day spent on him, and the ranges narrow; reports expire, the
// knowledge stays. Your own players are known exactly.
//   normaliseScouting(T) → T.scouting = { task, reports, knowledge, nextId }
//   sendScout(T, { region, position }, day) / lookCloser(T, playerId, day) → { ok, why }
//   scoutDay(T, day, pools, rng, fac) → finished task or null   pools(region) → the players there now
//                                     fac (Milestone 12, optional): { knowledgePct, extra } from the facilities —
//                                     the Video Room's +% knowledge, the Recruitment Office's extra candidate
//   (Milestone 13: research adds to both; sendScout / lookCloser take fac too — { days, closerDays }: research's shorter
//   report and closer-look times; src/systems/effects.js scoutingFac(data) builds fac)
//   reportDays(fac) · closerDaysOf(fac) → the days a report / a closer look takes now
//   knowledge(T, id) · statRange(p, k, stat) · overallRange(p, k) · potentialView(p, k) → { low, high, label }
import { SCOUTING } from '../../data/transfers.js';
import { overall } from './players.js';

export function normaliseScouting(T) {
  T.scouting ??= { task: null, reports: [], knowledge: {}, nextId: 1 };
  return T.scouting;
}

export const knowledge = (T, id) => Math.min(1, T?.scouting?.knowledge?.[id] ?? 0);
export const regionById = (id) => SCOUTING.regions.find((r) => r.id === id);

export const reportDays = (fac = null) => Math.max(1, SCOUTING.days + (fac?.days ?? 0));
export const closerDaysOf = (fac = null) => Math.max(1, SCOUTING.closerDays + (fac?.closerDays ?? 0));

export function sendScout(T, { region, position = 'any' }, day, fac = null) {
  const S = normaliseScouting(T);
  if (S.task) return { ok: false, why: `${SCOUTING.scout.name} is already out (${taskLine(S.task, day)}).` };
  if (!regionById(region) || !SCOUTING.positions.includes(position)) return { ok: false, why: 'Pick a region and a position.' };
  S.task = { kind: 'report', region, position, start: day, days: reportDays(fac) };
  return { ok: true };
}

export function lookCloser(T, playerId, day, fac = null) {
  const S = normaliseScouting(T);
  if (S.task) return { ok: false, why: `${SCOUTING.scout.name} is already out (${taskLine(S.task, day)}).` };
  if (knowledge(T, playerId) >= 1) return { ok: false, why: 'Already fully scouted.' };
  S.task = { kind: 'closer', playerId, start: day, days: closerDaysOf(fac) };
  return { ok: true };
}

export function taskLine(task, day) {
  const left = Math.max(0, task.start + task.days - day);
  const what = task.kind === 'closer' ? 'a closer look at one player' : `${regionById(task.region)?.name ?? task.region} · ${task.position === 'any' ? 'any position' : task.position}`;
  return `${what}, back in ${left} day${left === 1 ? '' : 's'}`;
}

// One club day: a task that is due finishes (a new report, or knowledge of one player); old reports expire.
export function scoutDay(T, day, pools, rng, fac = null) {
  const S = normaliseScouting(T);
  S.reports = S.reports.filter((r) => day <= r.until);
  const t = S.task;
  if (!t || day < t.start + t.days) return null;
  S.task = null;
  // (M13: a faster report — research — learns as much as a standard one, just sooner)
  const gain = (t.kind === 'closer' ? SCOUTING.closerDays : SCOUTING.days) * SCOUTING.knowledgePerDay * (1 + (fac?.knowledgePct ?? 0) / 100);
  if (t.kind === 'closer') {
    S.knowledge[t.playerId] = Math.min(1, (S.knowledge[t.playerId] ?? 0) + gain);
    return { kind: 'closer', playerId: t.playerId };
  }
  // a report: the players there that fit, the least known first (ties: a seeded shuffle)
  const fit = pools(t.region).filter((p) => t.position === 'any' || p.position === t.position);
  const shuffled = fit.map((p) => ({ p, r: rng.next() })).sort((a, b) => knowledge(T, a.p.id) - knowledge(T, b.p.id) || a.r - b.r).map((x) => x.p);
  const ids = shuffled.slice(0, SCOUTING.reportSize + (fac?.extra ?? 0)).map((p) => p.id);
  for (const id of ids) S.knowledge[id] = Math.min(1, (S.knowledge[id] ?? 0) + gain);
  const report = { id: `r${S.nextId++}`, day, until: day + SCOUTING.expiresDays, region: t.region, position: t.position, ids };
  S.reports.push(report);
  return { kind: 'report', report };
}

// A steady number in 0 … 1 for this player and key (where the true value sits inside its range: never re-rolled).
function hash01(id, key) {
  let h = 2166136261;
  for (const ch of `${id}:${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h % 1000) / 999;
}
const width = (full, min, k) => Math.round(min + (full - min) * (1 - Math.max(0, Math.min(1, k))));
function around(v, w, u) {
  const low = Math.max(1, Math.round(v - u * w));
  return { low, high: Math.min(99, Math.max(low, low + w)) };
}
export const statRange = (p, k, stat) => around(p.stats[stat], width(SCOUTING.range.stat, SCOUTING.range.statMin, k), hash01(p.id, stat));
export const overallRange = (p, k) => around(overall(p), width(SCOUTING.range.overall, SCOUTING.range.overallMin, k), hash01(p.id, 'ovr'));

export function potentialView(p, k) {
  const extra = Math.round(SCOUTING.range.potential * (1 - Math.max(0, Math.min(1, k))));
  const u = hash01(p.id, 'pot');
  const low = Math.max(1, p.potential.low - Math.round(extra * u));
  const high = Math.min(99, p.potential.high + (extra - Math.round(extra * u)));
  const room = (low + high) / 2 - overall(p);
  const label = SCOUTING.potentialLabels.find(([upTo]) => room <= upTo)[1];
  return { low, high, label };
}
export const rangeText = (r) => (r.low === r.high ? `${r.low}` : `${r.low}–${r.high}`);
