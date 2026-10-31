// Injuries, bans and set-piece takers at the club (Milestone 25, bible §19 / §20). Plain rules on the run save; the match
// engine makes the incidents (src/match/setPieces.js), this keeps them. The numbers are data/matchRules.js.
//   On the squad player: p.injury { sev, days (left, may be fractional), total, since, cause } · p.ban { matches, why }
//   · p.injuries (how many he has had: the injury history M16 stored for this).
//   data.medical { v, yellows: { comp: { playerId: n } }, year, secondWind (the season PH05 last used it), log }
//   normaliseMedical(data) — an older save: nobody injured or banned, no yellows (and default takers: tactics.js)
//   available(p) → true when he can be picked · unavailableWhy(p) → null | 'Injured: 12 days' | 'Banned: 1 match'
//   matchRisk(data, p) → the injury risk multiplier for a match (fatigue at kickoff above 70, his history, less with the
//     Physio / Medical / research / Bolt — bible §19), at least INJURY.minRisk
//   recoveryMult(data) → how much faster injuries heal (Physio, Medical facility, research, Bolt +50%)
//   compOf(fixture) → 'league' | 'cup:C02' … (yellows count per competition) · null for a friendly
//   afterMatch(data, { fixture, incidents }, day) → events  (the injuries and cards of a match: team 0 is always ours)
//   medicalDay(data, day) → events (the daily recovery tick; back from injury; the season's end resets the yellows)
//   injuryList(data) / banList(data) — the Squad screen's lists
// No paid cure and no paid way to lift a ban, ever (bible §19; series money rules).
import { INJURY, DISCIPLINE, severityById } from '../../data/matchRules.js';
import { effect } from './effects.js';
import { news } from './league.js';

const YEAR = 336;
const r1 = (v) => Math.round(v * 10) / 10;
const fmtDays = (d) => (d >= 14 ? `${Math.round(d / 7)} weeks` : `${Math.max(1, Math.ceil(d))} day${Math.ceil(d) === 1 ? '' : 's'}`);

export function normaliseMedical(data) {
  if (!data.medical || data.medical.v !== 1) data.medical = { v: 1, yellows: {}, year: null, secondWind: null, log: [] };
  const M = data.medical;
  M.yellows ??= {};
  M.log ??= [];
  return M;
}
export const available = (p) => !p?.injury && !(p?.ban?.matches > 0);
export function unavailableWhy(p) {
  if (p?.injury) return `Injured: ${fmtDays(p.injury.days)}`;
  if (p?.ban?.matches > 0) return `Banned: ${p.ban.matches} match${p.ban.matches === 1 ? '' : 'es'}`;
  return null;
}

// --- risk and recovery ------------------------------------------------------------------------------------------------
export const preventionPct = (data) => effect(data, 'injuryPreventionPct') + effect(data, 'injuryResistPct'); // (Medical facility, research R19, PH03, Bolt −30%)
export function matchRisk(data, p) {
  const f = p.fatigue ?? 0;
  const tired = f > INJURY.tiredFrom ? 1 + ((INJURY.tiredMax - 1) * (f - INJURY.tiredFrom)) / (100 - INJURY.tiredFrom) : 1;
  const hist = Math.min(INJURY.historyMax, (p.injuries ?? 0) * INJURY.history * Math.max(0, 1 + effect(data, 'reinjuryPct') / 100)); // (R24 Return-to-Play: −25)
  const k = Math.max(INJURY.minRisk, 1 - preventionPct(data) / 100);
  return Math.round(tired * (1 + hist) * k * 1000) / 1000;
}
// (PH01 / PH02 recoveryPct is the fatigue recovery the M14 Physio already gives: since M25 it speeds injuries up too.)
export const recoveryMult = (data) => 1 + (effect(data, 'injuryRecoveryPct') + effect(data, 'recoveryPct')) / 100;

// --- competitions ---------------------------------------------------------------------------------------------------------
export function compOf(fixture) {
  if (!fixture) return 'league';
  if (fixture.cup) return fixture.cup.id === 'SHOW' ? null : `cup:${fixture.cup.id}`;
  return 'league';
}
const squadOf = (data) => data.squad?.players ?? [];
const byId = (data, id) => squadOf(data).find((p) => p.id === id) ?? null;
function log(data, day, text) {
  const M = normaliseMedical(data);
  M.log = [...M.log, { day, text }].slice(-30);
}

// --- after a match ----------------------------------------------------------------------------------------------------------
// incidents: the match's (matchResult(world).incidents). Only ours (team 0) are kept: AI clubs keep no injuries or bans.
export function afterMatch(data, { fixture, incidents = [] }, day) {
  const M = normaliseMedical(data);
  const comp = compOf(fixture);
  const events = [];
  // 1. bans: every one of ours still banned has now missed a competitive match
  if (comp) for (const p of squadOf(data)) if (p.ban?.matches > 0) {
    p.ban.matches--;
    if (p.ban.matches <= 0) {
      p.ban = null;
      events.push({ kind: 'banOver', id: p.id, name: p.name });
    }
  }
  const ours = incidents.filter((e) => e.team === 0 && e.id);
  // 2. injuries (a friendly's count too)
  for (const e of ours.filter((x) => x.type === 'injury')) {
    const p = byId(data, e.id);
    if (!p) continue;
    let sev = severityById(e.sev);
    let days = e.days;
    // (PH05 Second Wind) once a season, a Serious injury drops one tier
    if (sev.id === 'serious' && effect(data, 'secondWind') > 0 && M.secondWind !== yearOf(day)) {
      M.secondWind = yearOf(day);
      sev = severityById('moderate');
      days = Math.min(days, sev.days[1]);
    }
    const total = Math.max(1, Math.round(days / recoveryMult(data)));
    p.injury = { sev: sev.id, days: total, total, since: day, cause: e.cause ?? 'the match' };
    M.season = M.season?.year === yearOf(day) ? { ...M.season, injuries: M.season.injuries + 1 } : { year: yearOf(day), injuries: 1 }; // (Awards Night: few injuries)
    p.injuries = (p.injuries ?? 0) + 1;
    // a Serious injury at 30+ can knock his ceiling a little
    if (sev.id === 'serious' && (p.age ?? 0) >= INJURY.potentialKnock.age && p.potential && seeded(data, p.id, day) < INJURY.potentialKnock.chance) {
      const by = INJURY.potentialKnock.by[0] + Math.floor(seeded(data, `${p.id}k`, day) * (INJURY.potentialKnock.by[1] - INJURY.potentialKnock.by[0] + 1));
      p.potential.high = Math.max(p.potential.low ?? 0, p.potential.high - by);
      if (p.potential.exact != null) p.potential.exact = Math.max(p.potential.low ?? 0, p.potential.exact - by);
    }
    const line = `${p.name} is out for ${fmtDays(total)} (${sev.name.toLowerCase()} injury).`;
    news(data, day, line);
    log(data, day, line);
    events.push({ kind: 'injury', id: p.id, name: p.name, sev: sev.id, days: total });
  }
  if (!comp) return events; // (the Summer Showcase: no cards count)
  // 3. cards: a red is a ban (a straight red longer); 5 yellows in one competition is a ban
  const reds = new Set(ours.filter((x) => x.type === 'red').map((x) => x.id));
  for (const e of ours.filter((x) => x.type === 'red')) {
    const p = byId(data, e.id);
    if (!p) continue;
    const n = e.straight ? DISCIPLINE.straightRedBan : DISCIPLINE.redBan;
    p.ban = { matches: (p.ban?.matches ?? 0) + n, why: e.straight ? 'a straight red card' : 'two yellow cards', comp, since: day };
    const line = `${p.name} is banned for ${n} match${n === 1 ? '' : 'es'} (${p.ban.why}).`;
    news(data, day, line);
    log(data, day, line);
    events.push({ kind: 'ban', id: p.id, name: p.name, matches: n, why: p.ban.why });
  }
  const Y = (M.yellows[comp] ??= {});
  for (const e of ours.filter((x) => x.type === 'yellow' && !reds.has(x.id))) {
    Y[e.id] = (Y[e.id] ?? 0) + 1;
    if (Y[e.id] >= DISCIPLINE.yellowsForBan) {
      Y[e.id] = 0;
      const p = byId(data, e.id);
      if (!p) continue;
      p.ban = { matches: (p.ban?.matches ?? 0) + DISCIPLINE.yellowBan, why: `${DISCIPLINE.yellowsForBan} yellow cards`, comp, since: day };
      const line = `${p.name} is banned for the next match (${DISCIPLINE.yellowsForBan} yellow cards in the ${compName(comp)}).`;
      news(data, day, line);
      log(data, day, line);
      events.push({ kind: 'ban', id: p.id, name: p.name, matches: DISCIPLINE.yellowBan, why: p.ban.why });
    }
  }
  return events;
}
const yearOf = (day) => Math.floor(Math.max(0, day) / YEAR) + 1;
const compName = (comp) => (comp === 'league' ? 'league' : 'cup');
function seeded(data, key, day) {
  let h = 2166136261;
  for (const ch of `${data.seed}:${key}:${day}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

// --- the club day -----------------------------------------------------------------------------------------------------------
// The injured heal a day (faster with the Physio, the Medical facility, research, Bolt) and lose a little sharpness and
// form while out; back → a News line (PH04 Return Strong: +5 morale). The season's end: the yellows start again.
export function medicalDay(data, day) {
  const M = normaliseMedical(data);
  const events = [];
  const y = yearOf(day);
  if (M.year !== y) {
    if (M.year != null) M.yellows = {};
    M.year = y;
    if (M.season && M.season.year !== y) M.season = { year: y, injuries: 0 };
  }
  const rate = 1; // (recoveryMult is applied once, to the days set at the injury: the timeline stays honest)
  for (const p of squadOf(data)) {
    if (!p.injury) continue;
    p.injury.days = r1(p.injury.days - rate);
    p.fatigue = Math.max(p.fatigue ?? 0, Math.min(INJURY.fitnessMax, (p.fatigue ?? 0) + INJURY.fitnessPerDay));
    if (p.form != null) p.form = Math.max(-10, p.form + INJURY.formPerDay);
    if (p.injury.days <= 0) {
      p.injury = null;
      const back = effect(data, 'returnMorale');
      if (back && p.morale != null) p.morale = Math.min(100, p.morale + back);
      const line = `${p.name} is back from injury${back ? ' and raring to go' : ''}.`;
      news(data, day, line);
      log(data, day, line);
      events.push({ kind: 'recovered', id: p.id, name: p.name });
    }
  }
  return events;
}

// --- lists ------------------------------------------------------------------------------------------------------------------
export const injuryList = (data) => squadOf(data).filter((p) => p.injury).sort((a, b) => b.injury.days - a.injury.days);
export const banList = (data) => squadOf(data).filter((p) => p.ban?.matches > 0);
export const yellowsOf = (data, id) => Object.entries(normaliseMedical(data).yellows).map(([comp, m]) => ({ comp, n: m[id] ?? 0 })).filter((x) => x.n > 0);
export { severityById };
