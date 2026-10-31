// The board (Milestone 23, bible §29): two objectives a season (set at its start: a one-tap sheet), scored at Awards Night
// in the Board voice; Board Confidence 0–100 (hidden except in the Board voice) — it never sacks you. Long Emergency Credit
// debt makes the board's rescue offer likelier (sell one player, or take a sponsor deal with money up front). Plain
// functions over the run save; numbers and words in data/board.js.
//   data.board = { v: 1, year, objectives: [{ id, need, keep?, start }], confidence, results: [row], toShow: year | null,
//                  rescue: { day, playerId, fee, sponsor } | null }
//   normaliseBoard(data, day)            an older save: confidence starts at 60; objectives from its next season's start
//   boardDay(data, day) → events         a new season: two new objectives (event 'boardObjectives')
//   evaluate(data, S) → [{ id, line, met, have }]    (S: the Awards Night season tally, src/systems/verdicts.js)
//   settle(data, S, day) → { met, of, rows, confidence }   at Awards Night: the result row, confidence moves
//   rescueRoll(data, day) → event | null · rescueAccept(data, choice, day) → { ok, why } (choice: 'sell' | 'sponsor' | 'later')
import { Rng } from '../../../../core/Rng.js';
import { BOARD_OBJECTIVES, BOARD, BOARD_TEXT, boardObjective } from '../../data/board.js';
import { EMERGENCY } from '../../data/finance.js';
import { leagueById } from '../../data/league.js';
import { SPONSORS } from '../../data/sponsors.js';
import { promotion, news } from './league.js';
import { trust } from './fans.js';
import { seasonTotals, weekOf, post } from './finance.js';
import * as SP from './sponsors.js';

const YEAR = 336;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const yearOf = (day) => Math.floor(Math.max(0, day) / YEAR) + 1;
const tierOf = (data) => leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;

export function normaliseBoard(data) {
  data.board ??= { v: 1, year: null, objectives: [], confidence: BOARD.confidenceStart, results: [], toShow: null, rescue: null };
  const B = data.board;
  B.results ??= [];
  B.objectives ??= [];
  return B;
}

function promoFrac(data) {
  const lg = data.league?.tier ?? 'regional';
  const st = promotion(data, lg);
  if (st.won) return 1;
  return (Math.min(1, st.distinct / Math.max(1, st.need.distinct)) + Math.min(1, st.wins / Math.max(1, st.need.wins)) + (st.rankOk ? 1 : 0)) / 3;
}
function facilityScore(data) {
  const F = data.facilities;
  if (!F?.placement) return 0;
  return F.placement.length + F.placement.reduce((s, p) => s + Math.max(0, (F.levels?.[p.uid]?.level ?? 1) - 1), 0);
}
function context(data) {
  const lg = leagueById(data.league?.tier ?? 'regional');
  const top = promotion(data, lg.id).won; // this league's promotion (the Crown title, at the top) already won
  return { data, tier: tierOf(data), top, frac: promoFrac(data), trust: trust(data), sponsorsUnlocked: SPONSORS.filter((s) => data.sponsors?.unlocked?.[s.id] != null).length };
}

export function boardDay(data, day) {
  const B = normaliseBoard(data);
  const year = yearOf(day);
  if (B.year === year) return [];
  const fresh = B.year == null && (data.finance?.startDay ?? 0) > 0 && yearOf(data.finance.startDay) === year && day % YEAR !== 0; // (an older save mid-season: objectives from the next season)
  B.year = year;
  if (fresh) {
    B.objectives = [];
    return [];
  }
  const c = context(data);
  const rng = new Rng(`${data.seed}:board:${year}`);
  const pool = BOARD_OBJECTIVES.filter((o) => o.when(c));
  const pick = [];
  while (pick.length < 2 && pool.length) pick.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  B.objectives = pick.map((o) => {
    const need = o.need(c);
    return { id: o.id, need, ...(o.id === 'fans' && need === 80 ? { keep: true } : {}), start: { trust: c.trust, facilities: facilityScore(data) } };
  });
  B.toShow = year;
  news(data, day, `Edith Marlow: “This season the board wants: ${B.objectives.map((o) => lineOf(o).toLowerCase()).join('; and ')}.”`, 'edith_marlow');
  return [{ kind: 'boardObjectives', year }];
}
export const lineOf = (o) => boardObjective(o.id).line(o);

// How the objectives stand (S: the season tally — wins, cup ties won, starts, youth starts).
export function evaluate(data, S) {
  const B = normaliseBoard(data);
  const year = S?.year ?? B.year;
  return B.objectives.map((o) => {
    let have = 0;
    let met = false;
    if (o.id === 'promotion') {
      have = promoFrac(data);
      met = have >= o.need - 1e-9 || (S && data.league?.tier !== S.start?.tier);
    } else if (o.id === 'wins') met = (have = S?.w ?? 0) >= o.need;
    else if (o.id === 'cup') met = (have = S?.tiesWon ?? 0) >= o.need;
    else if (o.id === 'youth') met = (have = S?.apps ? Math.round((S.youthApps / S.apps) * 100) : 0) >= o.need;
    else if (o.id === 'wages') {
      const t = seasonTotals(data, year);
      have = t.income ? Math.round((t.wages / t.income) * 100) : 0;
      met = have <= o.need;
    } else if (o.id === 'fans') {
      have = o.keep ? Math.round(trust(data)) : Math.round(trust(data) - (o.start?.trust ?? 50));
      met = have >= o.need;
    } else if (o.id === 'facility') met = (have = facilityScore(data) - (o.start?.facilities ?? 0)) >= o.need;
    else if (o.id === 'sponsor') met = (have = data.sponsors?.active?.length ?? 0) >= o.need;
    return { id: o.id, line: lineOf(o), need: o.need, have, met };
  });
}

// Awards Night: the result row and Board Confidence.
export function settle(data, S, day) {
  const B = normaliseBoard(data);
  const rows = evaluate(data, S);
  const met = rows.filter((r) => r.met).length;
  B.confidence = clamp(B.confidence + met * BOARD.met + (rows.length - met) * BOARD.missed, 0, 100);
  B.results = [...B.results, { year: S?.year ?? B.year, met, of: rows.length, rows: rows.map(({ id, met: m }) => ({ id, met: m })), confidence: B.confidence }].slice(-12);
  return { met, of: rows.length, rows, confidence: B.confidence };
}

// --- the rescue offer --------------------------------------------------------------------------------------------------
function rescueCandidate(data) {
  const squad = (data.squad?.players ?? []).filter((p) => !p.founder && !p.god && !p.loan);
  const val = (p) => p.value ?? 0;
  return squad.sort((a, b) => val(b) - val(a))[0] ?? null;
}
export function rescueRoll(data, day) {
  const B = normaliseBoard(data);
  const E = data.finance?.emergency;
  if (!E?.owed || B.rescue) return null;
  if (E.weeks <= EMERGENCY.rescueAfterWeeks || weekOf(day) - (E.lastRescueWeek ?? -99) < EMERGENCY.rescueGapWeeks) return null;
  const chance = Math.min(EMERGENCY.rescueMax, (E.weeks - EMERGENCY.rescueAfterWeeks) * EMERGENCY.rescueStep);
  if (new Rng(`${data.seed}:rescue:${day}`).next() >= chance) return null;
  const p = rescueCandidate(data);
  const S = SP.normaliseSponsors(data, day);
  const sp = SPONSORS.filter((s) => S.unlocked[s.id] != null && !S.active.some((d) => d.id === s.id)).sort((a, b) => b.stipend - a.stipend)[0] ?? null;
  if (!p && !sp) return null;
  E.lastRescueWeek = weekOf(day);
  B.rescue = { day, playerId: p?.id ?? null, playerName: p?.name ?? null, fee: p ? Math.round(((p.value ?? 0) * EMERGENCY.rescueSaleShare) / 50) * 50 : 0, sponsor: sp?.id ?? null, advance: sp ? sp.stipend * BOARD.rescueAdvanceWeeks : 0, weeks: E.weeks, owed: E.owed };
  news(data, day, `Edith Marlow: “We have been in debt too long. The board has a rescue plan for you.”`, 'edith_marlow');
  return { kind: 'rescue', day };
}
export const pendingRescue = (data) => data?.board?.rescue ?? null;
// choice 'sell': that player goes for the quick-sale fee (hooks.sell(data, id, fee, day) → { ok, why }); 'sponsor': the
// deal is signed now (a free slot, else replacing the deal ending soonest) and pays its advance at once; 'later': no.
export function rescueAccept(data, choice, day, hooks = {}) {
  const B = normaliseBoard(data);
  const R = B.rescue;
  if (!R) return { ok: false, why: 'No rescue plan on the table.' };
  if (choice === 'sell') {
    if (!R.playerId) return { ok: false, why: 'Nobody to sell.' };
    const r = hooks.sell?.(data, R.playerId, R.fee, day) ?? { ok: false, why: 'Not available.' };
    if (!r.ok) return r;
  } else if (choice === 'sponsor') {
    if (!R.sponsor) return { ok: false, why: 'No sponsor available.' };
    const o = SP.forceOffer(data, R.sponsor, day);
    const r = SP.accept(data, o.uid, day);
    if (!r.ok) return r;
    post(data, R.advance, 'sponsors', 'Rescue deal: money up front', day);
  } else B.confidence = clamp(B.confidence + BOARD.laterRescue, 0, 100);
  B.rescue = null;
  return { ok: true, choice };
}
export { BOARD_TEXT };
