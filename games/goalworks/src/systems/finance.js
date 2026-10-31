// The money ledger (Milestone 23, bible §25): every Credit in and out of data.league.credits is one ledger line with a
// category and a date — nothing else in the game changes the Credits. Also the matchday gate, the weekly merch and running
// costs, and Emergency Credit. Plain functions over the run save; numbers in data/finance.js.
//   data.finance = { v: 23, startDay, startBalance, total, today, lines: [{ day, cat, n, note, bal }],
//                    seasons: { year: { cat: [in, out] } }, weeks: { week: { cat: [in, out] } }, chart: [{ week, bal }],
//                    emergency: { owed, lent, since, weeks, lastRescueWeek, years: [year] } }
//   normaliseFinance(data, day)    an older save: the ledger starts today from the Credits it has (no past is invented)
//   post(data, n, cat, note, day?) → n   THE way Credits change (+ in, − out). Below zero → Emergency Credit at once.
//   check(data) → { ok, diff }     the ledger sums to the balance: startBalance + total === data.league.credits
//   seasonTotals(data, year) / weekTotals(data, week) → { income, costs, net, byCat: { cat: { in, out } } }
//   stadiumStage(data) → { index, name, capacity }    gateFor(data, fixture?, day?) → Credits    merchFor(data) → Credits a week
//   (M24) the stage is the one built (src/systems/stadium.js); the gate comes from the match's real attendance
//   runningCosts(data) → [{ cat, n, note }]           weeklyIncomeEstimate(data) → Credits a week (the recurring part)
//   financeDay(data, day) → events                    the club day: on each week's day, merch, sponsors, running costs,
//                                                     the repayment, the chart point and the rescue chance
//   buildBlock(data) → null | the message             (debt freezes new building and upgrades)
//   inDebt(data) / owed(data)
import { FIN_CATS, NOT_INCOME, WAGE_CATS, LEDGER, STADIUM_STAGES, GATE, MERCH, RUNNING, EMERGENCY, FIN_TEXT } from '../../data/finance.js';
import { leagueById } from '../../data/league.js';
import { rank as clubRank, news } from './league.js';
import { effect } from './effects.js';
import { incomeMult } from './gods.js';
import * as SP from './sponsors.js';
import * as FAN from './fans.js';
import * as BOARD from './board.js';
import * as STAD from './stadium.js';
import { ATTENDANCE } from '../../data/stadium.js';

const YEAR = 336;
const WEEK = 7;
export const yearOf = (day) => Math.floor(Math.max(0, day) / YEAR) + 1;
export const weekOf = (day) => Math.floor(Math.max(0, day) / WEEK);
const roundTo = (v, n) => Math.round(v / n) * n;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const tierOf = (data) => leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;

export function normaliseFinance(data, day = data.league?.lastDay ?? 0) {
  if (!data.finance || data.finance.v !== 23) {
    const bal = data.league?.credits ?? 0;
    data.finance = { v: 23, startDay: day ?? 0, startBalance: bal, total: 0, today: day ?? 0, lines: [], seasons: {}, weeks: {}, chart: [{ week: weekOf(day ?? 0), bal }], emergency: { owed: 0, lent: 0, since: null, weeks: 0, lastRescueWeek: -99, years: [] } };
  }
  const F = data.finance;
  F.emergency ??= { owed: 0, lent: 0, since: null, weeks: 0, lastRescueWeek: -99, years: [] };
  F.emergency.years ??= [];
  return F;
}

function addTo(book, key, cat, n) {
  const row = (book[key] ??= {});
  const c = (row[cat] ??= [0, 0]);
  if (n >= 0) c[0] += n;
  else c[1] += -n;
}

// THE way Credits change. n > 0 in, n < 0 out; rounded to whole Credits. → the amount posted
export function post(data, n, cat, note = '', day = null) {
  const F = normaliseFinance(data);
  n = Math.round(n);
  if (!n) return 0;
  const d = day ?? F.today ?? 0;
  data.league.credits = Math.round((data.league.credits ?? 0) + n);
  F.total += n;
  const y = yearOf(d);
  const w = weekOf(d);
  if (!F.seasons[y]) for (const k of Object.keys(F.seasons)) if (Number(k) <= y - LEDGER.keepSeasons) delete F.seasons[k]; // (a new season: the oldest rows go)
  if (!F.weeks[w]) for (const k of Object.keys(F.weeks)) if (Number(k) < w - LEDGER.keepWeeks) delete F.weeks[k]; // (a new week: only the last ones are kept)
  addTo(F.seasons, y, cat, n);
  addTo(F.weeks, w, cat, n);
  F.lines = [...F.lines, { day: d, cat, n, note, bal: data.league.credits }].slice(-LEDGER.keepLines);
  if (data.league.credits < 0 && cat !== 'loan') lend(data, d);
  return n;
}

// Emergency Credit: the board covers the gap at once (rounded up), and the club owes it.
function lend(data, day) {
  const F = data.finance;
  const gap = -data.league.credits;
  const n = Math.ceil(gap / EMERGENCY.round) * EMERGENCY.round;
  const E = F.emergency;
  if (!E.owed) {
    E.since = day;
    E.weeks = 0;
  }
  E.owed += n;
  E.lent += n;
  if (!E.years.includes(yearOf(day))) E.years = [...E.years, yearOf(day)].slice(-30);
  post(data, n, 'loan', 'Emergency Credit from the board', day);
  news(data, day, FIN_TEXT.loanLine(n), 'edith_marlow');
  (F.events ??= []).push({ kind: 'loan', n, day });
}
export const owed = (data) => data?.finance?.emergency?.owed ?? 0;
export const inDebt = (data) => owed(data) > 0;
export const buildBlock = (data) => (inDebt(data) ? FIN_TEXT.buildBlocked(owed(data)) : null);

// The ledger sums to the balance.
export function check(data) {
  const F = normaliseFinance(data);
  const diff = Math.round((data.league?.credits ?? 0) - (F.startBalance + F.total));
  return { ok: diff === 0, diff };
}

function totalsOf(row) {
  const byCat = {};
  let income = 0;
  let costs = 0;
  let loans = 0;
  for (const c of FIN_CATS) {
    const [i, o] = row?.[c.id] ?? [0, 0];
    if (!i && !o) continue;
    byCat[c.id] = { in: i, out: o };
    if (NOT_INCOME.includes(c.id)) loans += i - o;
    else {
      income += i;
      costs += o;
    }
  }
  const wages = WAGE_CATS.reduce((s, k) => s + (byCat[k]?.out ?? 0) - (byCat[k]?.in ?? 0), 0);
  return { income, costs, net: income - costs + loans, loans, wages, byCat };
}
export const seasonTotals = (data, year) => totalsOf(normaliseFinance(data).seasons[year]);
export const weekTotals = (data, week) => totalsOf(normaliseFinance(data).weeks[week]);

// --- income -----------------------------------------------------------------------------------------------------------
export function stadiumStage(data) {
  const st = STAD.stageNow(data);
  return { index: st.id - 1, flag: st.flag, name: st.name, capacity: STAD.capacity(data) };
}
// The gate for a home match: its attendance × your league's ticket price (a sold-out ground charges more; + the matchday
// facilities and stadium pieces, Kaching). No fixture: an average home match today (the estimates).
export function gateParts(data, fixture = null, day = data.finance?.today ?? 0) {
  const st = stadiumStage(data);
  const att = STAD.attendance(data, fixture, day);
  const price = GATE.price[tierOf(data)] ?? 1;
  const k = (1 + effect(data, 'matchdayIncomePct') / 100) * incomeMult(data) * (att.soldOut ? ATTENDANCE.soldOut : 1);
  return { stage: st, att, crowd: att.crowd, fill: att.fill, price, n: roundTo(att.crowd * price * k, GATE.round) };
}
export const gateFor = (data, fixture = null, day) => gateParts(data, fixture, day).n;

// Merch and hospitality, a week: Fan Trust, the Stars and the gods in the squad.
export function merchFor(data) {
  const t = tierOf(data);
  const squad = data.squad?.players ?? [];
  const stars = squad.filter((p) => p.star && !p.god && !p.loan).length;
  const gods = squad.filter((p) => p.god).length;
  const raw = MERCH.base[t] * (0.4 + FAN.trust(data) / 100) + stars * MERCH.perStar[t] + gods * MERCH.perGod;
  return roundTo(raw * (1 + (effect(data, 'fanIncomePct') + effect(data, 'commercialPct')) / 100) * incomeMult(data), MERCH.round);
}

// The weekly running costs (each a ledger line of its own category).
export function runningCosts(data) {
  const t = tierOf(data);
  const st = stadiumStage(data);
  const cut = effect(data, 'stadiumOpsPct') + (effect(data, 'kitCare') > 0 ? 10 : 0); // (R33 Stadium Operations; the Kit Room)
  const out = [{ cat: 'upkeep', n: Math.round(STAD.upkeepOf(data) * Math.max(0, 1 - cut / 100)), note: `${st.name} upkeep` }]; // (M24: the stage and its pieces)
  const kids = data.academy?.players?.length ?? 0;
  if (kids) out.push({ cat: 'academy', n: kids * RUNNING.academyPerPlayer[t], note: `${kids} academy player${kids === 1 ? '' : 's'}` });
  if (data.transfers?.scouting?.task) out.push({ cat: 'scouting', n: RUNNING.scoutingWeek[t], note: 'The scout is out' });
  if (data.research?.sys?.queues?.some((q) => q?.nodeId)) out.push({ cat: 'research', n: RUNNING.researchWeek[t], note: 'Research under way' });
  return out.filter((x) => x.n > 0);
}

// The recurring income a week, roughly (the Finances screen's "against the wage bill"; the transfer cushion): board
// support, sponsors, merch and half a home gate (about one match a fortnight at home).
// (once the ledger has 8 full weeks: their average gate and win pay instead of the guess)
const RECENT = 8;
export function weeklyIncomeEstimate(data, { support = 0 } = {}) {
  const F = data.finance;
  const now = weekOf(F?.today ?? 0);
  let matchday = gateFor(data) / 4 + 0; // (about one home match a month before there is any history)
  if (F && now - weekOf(F.startDay ?? 0) > RECENT) {
    let sum = 0;
    for (let w = now - RECENT; w < now; w++) for (const k of ['gate', 'prize']) sum += F.weeks[w]?.[k]?.[0] ?? 0;
    matchday = sum / RECENT;
  }
  return Math.round(support + SP.weeklyStipends(data) + merchFor(data) + matchday);
}

// After one of your matches (main.js matchFinished, the auto player): the sponsors' objective counters and Fan Trust.
// sum: league.recordResult's summary (cup, promotionWon, crownTitle). → events (a Fan Trust band moved)
export function afterMatch(data, { fixture, score, xiIds = [], sum = null }, day) {
  const squad = data.squad?.players ?? [];
  const youth = xiIds.filter((id) => (squad.find((p) => p.id === id)?.age ?? 99) <= 21).length;
  const cup = sum?.cup ?? null;
  SP.afterMatch(data, { fixture, score, xiIds, cup, youth }, day);
  return FAN.afterMatch(data, { fixture, score, cup, youth, promoted: !!sum?.promotionWon && !sum?.crownTitle, crown: !!sum?.crownTitle }, day);
}

// --- the club day -----------------------------------------------------------------------------------------------------
// Each week's day (after the wages, transfersDay / staffDay): sponsors' stipends, merch, the running costs, the Emergency
// Credit repayment, the chart point; the season's start sets the board's objectives; Fan Trust drifts. → events
export function financeDay(data, day) {
  const F = normaliseFinance(data, day);
  if (F.lastDay === day) return [];
  F.lastDay = day;
  F.today = day;
  const events = [...(F.events ?? [])];
  F.events = [];
  events.push(...STAD.stadiumDay(data, day)); // (M24) a stage or piece finished; a new stage opened
  events.push(...SP.sponsorsDay(data, day));
  events.push(...BOARD.boardDay(data, day));
  events.push(...FAN.fansDay(data, day));
  if (day > 0 && day % WEEK === 0) {
    const m = merchFor(data);
    if (m) post(data, m, 'merch', 'Merch and hospitality', day);
    for (const c of runningCosts(data)) post(data, -c.n, c.cat, c.note, day);
    const E = F.emergency;
    if (E.owed > 0) {
      E.weeks++;
      const spare = Math.max(0, data.league.credits - EMERGENCY.cushion);
      const pay = Math.min(E.owed, Math.floor(spare * EMERGENCY.repayShare));
      if (pay > 0) {
        post(data, -pay, 'repay', 'Emergency Credit repaid', day);
        E.owed -= pay;
        if (E.owed <= 0) {
          E.owed = 0;
          E.since = null;
          E.weeks = 0;
          news(data, day, FIN_TEXT.repaidLine, 'edith_marlow');
          events.push({ kind: 'repaid', day });
        }
      }
      if (E.owed > 0) {
        const r = BOARD.rescueRoll(data, day);
        if (r) events.push(r);
      }
    }
    F.chart = [...F.chart, { week: weekOf(day), bal: data.league.credits }].slice(-LEDGER.chartWeeks);
  }
  events.push(...F.events);
  F.events = [];
  return events;
}
