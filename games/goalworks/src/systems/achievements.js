// Achievements, records, club history and the trophy cabinet (Milestone 27, bible §31 / §33). One system watches the
// game's own counters (careers, cups, secrets' run tallies, research, facilities, fans, stadium, sponsors) and adds only the
// few it needs that nothing kept before (data.achv.track: wins, win runs, late winners, ten-men wins, formations won with,
// manual / pure wins, shoot-outs, academy starters, perfect seasons…). Earned achievements live in the account store
// (account.achievements: every slot and every new game keeps them); the run keeps its own copy (data.achievements).
//   normaliseAchievements(data) — an older save: its counters start at 0 except what its history proves (the league wins,
//     the flags already earned); nothing is invented
//   afterMatch(data, { fixture, score, scorers, cup, xiIds, squadIds, incidents, formation, manual }, day)
//   achievementsDay(data, account, day) → events [{ kind: 'achievement', id } | { kind: 'record', id } | { kind: 'milestone' }]
//     (records, milestones, history lines from what changed, and the achievements now met: reward paid, history line)
//   progressOf(data, account, a) → { value, need, frac, earned }
//   list(data, account) → every achievement with its progress (the screen)
//   historyOf(data, type = null) → the timeline (newest first), typed     trophies(data) → the cabinet
//   recordRows(data) → the Records page
import { ACHIEVEMENT_LIST, achievementById, ACHV_RULES as R, HISTORY_GUESS, MILESTONES, TROPHY_ART, CLUB_RECORDS } from '../../data/achievements.js';
import { FACILITIES } from '../../data/facilities.js';
import { ALL_CUPS, US } from '../../data/cups.js';
import { sponsorById } from '../../data/sponsors.js';
import { STAGES } from '../../data/stadium.js';
import { RECORD_KEYS } from '../../data/careers.js';
import { overall } from './players.js';
import { normaliseSecrets } from './secrets.js';
import { post } from './finance.js';
import { addHistory } from './league.js';
import { noteRecord } from './records.js';

const YEAR = 336;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const NORMAL_FACILITIES = FACILITIES.filter((f) => f.unlock !== 'secret').map((f) => f.id);
const TOP_STAGE = STAGES[STAGES.length - 1].id;

export function normaliseAchievements(data) {
  if (data.achv?.v === 27) return data.achv;
  const fresh = !data.achv;
  data.achv = Object.assign({ v: 27, track: {}, milestones: {}, seen: {} }, data.achv ?? {});
  const T = data.achv.track;
  const z = { matches: 0, goals: 0, wins: 0, winRun: 0, bestWinRun: 0, cleanSheets: 0, mostScored: 0, lateWinners: 0, tenMenWins: 0, academyStarters: 0, homeGrownCup: 0, manualWins: 0, pureWins: 0, shootoutWins: 0, perfectSeasons: 0, eliteAcademy: 0, eliteFree: 0, legendSigned: 0, starsSigned: 0, sellOuts: 0, topSellOut: 0 };
  for (const [k, v] of Object.entries(z)) T[k] ??= v;
  T.formationsWon ??= [];
  T.year ??= { y: yearOf(data.league?.lastDay ?? 1), played: 0, lost: 0 };
  T.season ??= { y: T.year.y, goals: 0 };
  if (fresh && data.league?.clubs) {
    // an older save: what its history proves — the league's results against each club (every competitive win is there)
    T.wins = Object.values(data.league.clubs).reduce((n, c) => n + (c.w ?? 0), 0);
    T.matches = Object.values(data.league.clubs).reduce((n, c) => n + (c.w ?? 0) + (c.d ?? 0) + (c.l ?? 0), 0);
  }
  const S = data.achv.seen;
  S.stage ??= data.stadium?.stage ?? 1;
  S.gods ??= Object.keys(data.gods?.signedEver ?? {});
  S.secrets ??= Object.entries(data.secrets?.state ?? {}).filter(([, s]) => s.found != null).map(([id]) => id);
  S.awards ??= (data.verdicts?.seasons ?? []).length;
  return data.achv;
}

// --- the measures ---------------------------------------------------------------------------------------------------------
const curYear = (data) => yearOf(data.league?.lastDay ?? data.calendar?.clock?.totalDays ?? 1);
const allRetired = (data) => data.careers?.retired ?? [];
const careerMax = (data, key, filter = () => true) => Math.max(0, data.careers?.records?.[key]?.value ?? 0, ...data.squad?.players?.filter(filter).map((p) => p.career?.[key] ?? 0) ?? [0], ...allRetired(data).filter(filter).map((e) => e[key] ?? 0));
export const MEASURES = {
  wins: (d) => d.achv.track.wins,
  winRun: (d) => d.achv.track.bestWinRun,
  unbeaten: (d) => normaliseSecrets(d).track.bestUnbeaten ?? 0,
  cleanSheets: (d) => d.achv.track.cleanSheets,
  mostScored: (d) => d.achv.track.mostScored,
  lateWinners: (d) => d.achv.track.lateWinners,
  comebacks: (d) => normaliseSecrets(d).track.comebacks ?? 0,
  tenMenWins: (d) => d.achv.track.tenMenWins,
  cupsWon: (d) => Object.entries(d.cups ?? {}).filter(([id]) => ALL_CUPS[id] && !ALL_CUPS[id].friendly).reduce((n, [, C]) => n + (C?.wins ?? 0), 0),
  fiveCrowns: (d) => d.cups?.C08?.wins ?? 0,
  academyStarters: (d) => d.achv.track.academyStarters,
  eliteAcademy: (d) => d.achv.track.eliteAcademy,
  founderYears: (d) => {
    const f = d.squad?.players.find((p) => p.founder);
    return f ? curYear(d) - 1 : 0; // (the Founder is there from day one: whole years since)
  },
  mostApps: (d) => careerMax(d, 'apps'),
  mostGoals: (d) => careerMax(d, 'goals'),
  mostAssists: (d) => careerMax(d, 'assists'),
  keeperCleanSheets: (d) => Math.max(0, ...(d.squad?.players ?? []).filter((p) => p.position === 'GK').map((p) => p.career?.cleanSheets ?? 0), ...allRetired(d).filter((e) => e.position === 'GK').map((e) => e.cleanSheets ?? 0)),
  bestSale: (d) => d.records?.sale?.value ?? 0,
  eliteFree: (d) => d.achv.track.eliteFree,
  homeGrownCup: (d) => d.achv.track.homeGrownCup,
  facilitiesOwned: (d) => new Set((d.facilities?.placement ?? []).map((p) => p.def).filter((id) => NORMAL_FACILITIES.includes(id))).size,
  researchDone: (d) => d.research?.sys?.done?.length ?? 0,
  topSellOut: (d) => d.achv.track.topSellOut,
  fanTop: (d) => ((d.fans?.trust ?? 0) >= 80 ? 1 : 0),
  eliteDeals: (d, acc) => Math.max(acc?.achvCounts?.eliteDeals ?? 0, eliteDealsRun(d)),
  formationsWon: (d) => d.achv.track.formationsWon.length,
  manualWins: (d) => d.achv.track.manualWins,
  pureWins: (d) => d.achv.track.pureWins,
  shootoutWins: (d) => d.achv.track.shootoutWins,
  perfectSeasons: (d) => d.achv.track.perfectSeasons,
  legendSigned: (d) => d.achv.track.legendSigned,
  prestigeOpen: (d) => Object.entries(d.league?.cupsOpen ?? {}).filter(([id, day]) => day != null && R.prestigeCups.includes(ALL_CUPS[id]?.visibility)).length,
};
// The elite deals this club has held (the history and the deals running now; each sponsor once)
function eliteDealsRun(d) {
  const S = d.sponsors;
  if (!S) return 0;
  const ids = new Set([...(S.history ?? []).map((h) => h.id), ...(S.active ?? []).map((x) => x.id)].filter((id) => R.eliteSponsorTiers.includes(sponsorById(id)?.tier)));
  return ids.size;
}
const valueOf = (data, account, a) => (a.measure.startsWith('flag:') ? (data.achievements?.[a.measure.slice(5)] || account?.achievements?.[a.measure.slice(5)] ? 1 : 0) : MEASURES[a.measure](data, account));
export function progressOf(data, account, a) {
  normaliseAchievements(data);
  const value = valueOf(data, account, a);
  const earned = account?.achievements?.[a.id] ?? data.achievements?.[a.id] ?? null;
  return { value, need: a.need, frac: earned ? 1 : Math.max(0, Math.min(1, value / a.need)), earned };
}
export const list = (data, account) => ACHIEVEMENT_LIST.map((a) => ({ ...a, ...progressOf(data, account, a) }));

// --- after one of your matches ---------------------------------------------------------------------------------------------
// The winning goal: ours that put us ahead for good (the (theirs + 1)th of ours). → its minute, or null
export function winnerMinute(scorers) {
  const theirs = scorers.filter((g) => g.team !== 0).length;
  const ours = scorers.filter((g) => g.team === 0);
  return ours.length > theirs ? ours[theirs].minute : null;
}
export function afterMatch(data, { fixture, score, scorers = [], cup = null, xiIds = [], squadIds = [], incidents = [], formation = null, manual = false }, day) {
  if (fixture?.cup && ALL_CUPS[fixture.cup.id]?.friendly) return; // (the Summer Showcase is a friendly)
  const T = normaliseAchievements(data).track;
  rollYear(data, day);
  const [us, them] = score;
  const won = us > them || (cup?.won && us === them);
  const lost = us < them || (cup && !cup.won && us === them);
  T.matches++;
  T.goals += us;
  T.year.played++;
  if (lost) T.year.lost++;
  if (T.season.y !== yearOf(day)) T.season = { y: yearOf(day), goals: 0 };
  T.season.goals += us;
  noteRecord(data, 'teamGoals', T.season.goals, `${T.season.goals} in Year ${T.season.y}`, day);
  if (them === 0) T.cleanSheets++;
  T.mostScored = Math.max(T.mostScored, us);
  if (us - them > 0) noteRecord(data, 'bigWin', (us - them) * 100 + us, `${us}–${them} against ${fixture?.opponent?.name ?? 'a club'}`, day); // (the margin, then the goals)
  const byId = new Map(data.squad.players.map((p) => [p.id, p]));
  const academy = (ids) => ids.filter((id) => byId.get(id)?.origin === 'academy').length;
  T.academyStarters = Math.max(T.academyStarters, academy(xiIds));
  if (won) {
    T.wins++;
    T.winRun++;
    T.bestWinRun = Math.max(T.bestWinRun, T.winRun);
    const wm = us > them ? winnerMinute(scorers) : null;
    if (wm != null && wm >= R.lateMinute) T.lateWinners++;
    if (incidents.some((e) => e.type === 'red' && e.team === 0)) T.tenMenWins++;
    if (formation && !T.formationsWon.includes(formation)) T.formationsWon.push(formation);
    if (manual) T.manualWins++;
    else T.pureWins++;
    if (cup?.pens) T.shootoutWins++;
    if (cup?.champion && academy([...new Set([...xiIds, ...squadIds])]) >= 6) T.homeGrownCup++;
  } else T.winRun = 0;
  // the crowd (a home match: the stadium noted it today)
  const last = data.stadium?.last;
  if (last && last.day === day) {
    noteRecord(data, 'crowd', last.crowd, `${last.crowd.toLocaleString('en-GB')} against ${fixture?.opponent?.name ?? 'a club'}`, day);
    if (last.soldOut) {
      T.sellOuts++;
      if ((data.stadium?.stage ?? 1) >= TOP_STAGE) T.topSellOut++;
    }
  }
}
// A new campaign year: was the last one perfect (unbeaten, enough played)?
function rollYear(data, day) {
  const T = data.achv.track;
  const y = yearOf(day);
  if (T.year.y === y) return;
  if (T.year.played >= R.perfectMin && T.year.lost === 0) T.perfectSeasons++;
  T.year = { y, played: 0, lost: 0 };
}

// --- the club day ---------------------------------------------------------------------------------------------------------------
const TYPE_OF = { promotion: 'promotion', cup: 'cup' };
export function achievementsDay(data, account, day) {
  const A = normaliseAchievements(data);
  const T = A.track;
  rollYear(data, day);
  const events = [];
  const squad = data.squad?.players ?? [];
  // players: an academy / free-agent player at Elite; a Legendary signed; a Star signed
  for (const p of squad) {
    if (p.god) continue;
    if (p.origin === 'academy' && overall(p) >= R.eliteOverall) T.eliteAcademy = 1;
    if (p.joinedFrom === 'free' && !p.founder && overall(p) >= R.eliteOverall) T.eliteFree = 1;
    if ((p.tier === 'Legendary' || p.tier === 'Secret') && !A.seen[`legend:${p.id}`]) {
      A.seen[`legend:${p.id}`] = day;
      T.legendSigned++;
    }
    if (p.star && !A.seen[`star:${p.id}`]) {
      A.seen[`star:${p.id}`] = day;
      T.starsSigned++;
    }
  }
  // records: the unbeaten run, a player's goals in a season, the career records (each with the previous holder)
  const ST = normaliseSecrets(data).track;
  if (noteRecord(data, 'unbeaten', ST.bestUnbeaten ?? 0, `${ST.bestUnbeaten} matches`, day)) events.push({ kind: 'record', id: 'unbeaten' });
  const top = Object.entries(ST.season?.goals ?? {}).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const name = squad.find((p) => p.id === top[0])?.name ?? 'A player';
    noteRecord(data, 'seasonGoals', top[1], `${name}: ${top[1]} in Year ${ST.season.year}`, day);
  }
  for (const { key, name } of RECORD_KEYS) {
    const r = data.careers?.records?.[key];
    if (r) noteRecord(data, `career:${key}`, r.value, `${r.name}: ${r.value} ${name.toLowerCase()}`, day);
  }
  // the history: a stadium stage built, a god signed, a secret found, an awards night
  const S = A.seen;
  const stage = data.stadium?.stage ?? 1;
  if (stage > S.stage) {
    addHistory(data, day, `The ${STAGES.find((s) => s.id === stage)?.name ?? 'new stadium'} opens`, 'stadium');
    S.stage = stage;
  }
  for (const g of Object.keys(data.gods?.signedEver ?? {})) if (!S.gods.includes(g)) {
    S.gods.push(g);
    addHistory(data, day, `A Works God joins: ${g}`, 'god');
  }
  for (const [id, st] of Object.entries(data.secrets?.state ?? {})) if (st.found != null && !S.secrets.includes(id)) {
    S.secrets.push(id);
    addHistory(data, day, `A secret found (${id})`, 'secret');
  }
  const seasons = data.verdicts?.seasons ?? [];
  for (const s of seasons.slice(S.awards)) for (const aw of s.awards ?? []) addHistory(data, day, `${aw.name}: ${aw.player ?? 'the club'}`, 'award');
  S.awards = seasons.length;
  // milestone moments
  const m = { matches: T.matches, goals: T.goals, starsSigned: T.starsSigned, sellOuts: T.sellOuts, godsSigned: S.gods.length };
  for (const ms of MILESTONES) if (!A.milestones[ms.id] && m[ms.measure] >= ms.at) {
    A.milestones[ms.id] = day;
    addHistory(data, day, ms.text, 'milestone');
    events.push({ kind: 'milestone', id: ms.id, text: ms.text });
  }
  // the account's "historically" counts
  if (account) {
    account.achvCounts ??= {};
    account.achvCounts.eliteDeals = Math.max(account.achvCounts.eliteDeals ?? 0, eliteDealsRun(data));
  }
  // the achievements now met
  for (const a of ACHIEVEMENT_LIST) if (earn(data, account, a, day)) events.push({ kind: 'achievement', id: a.id });
  return events;
}
// Earn one if it is met and not yet earned (account-wide): the reward, a history line. → true when earned now
export function earn(data, account, a, day, { force = false } = {}) {
  if (account?.achievements?.[a.id]) {
    (data.achievements ??= {})[a.id] ??= { day: account.achievements[a.id].day, earlier: true };
    return false;
  }
  if (!force && valueOf(data, account, a) < a.need) return false;
  (data.achievements ??= {})[a.id] ??= { day };
  if (account) (account.achievements ??= {})[a.id] = { day, year: yearOf(day), club: data.club?.name ?? '' };
  if (a.reward.credits) post(data, a.reward.credits, 'prize', `Achievement: ${a.name}`, day);
  if (a.reward.rep && data.league?.rep) data.league.rep.history = Math.round((data.league.rep.history + a.reward.rep) * 10) / 10;
  addHistory(data, day, `Achievement: ${a.name}`, 'achievement');
  return true;
}
// An older save's run flags (A10–A15, A41) go into the account once (the reward was the promotion itself: none paid again)
export function syncAccount(data, account) {
  if (!account) return false;
  let changed = false;
  for (const [id, v] of Object.entries(data.achievements ?? {})) if (achievementById(id) && !account.achievements?.[id]) {
    (account.achievements ??= {})[id] = { day: v.day ?? 0, year: yearOf(v.day ?? 1), club: data.club?.name ?? '' };
    changed = true;
  }
  return changed;
}

// --- history, trophies, records -------------------------------------------------------------------------------------------------
export function historyOf(data, type = null) {
  const lines = (data.clubHistory ?? []).map((h) => ({ ...h, type: h.type ?? HISTORY_GUESS.find(([re]) => re.test(h.text))?.[1] ?? 'club' }));
  return lines.filter((h) => !type || h.type === type).reverse();
}
export function trophies(data) {
  const out = [];
  const promos = ['A10', 'A11', 'A12', 'A13'].filter((id) => data.achievements?.[id]).length;
  if (promos) out.push({ key: 'promotion', name: 'Promotion', art: TROPHY_ART.promotion, count: promos });
  if (data.achievements?.A15 || data.league?.crownTitle) out.push({ key: 'crown', name: 'Crown Premier title', art: TROPHY_ART.crown, count: 1 });
  for (const [id, C] of Object.entries(data.cups ?? {})) {
    const cup = ALL_CUPS[id];
    if (!cup || !(C?.wins > 0)) continue;
    const years = (C.history ?? []).filter((h) => h.champion === US).map((h) => h.year);
    out.push({ key: id, name: cup.name, art: TROPHY_ART[id] ?? cup.art, count: C.wins, years });
  }
  const awards = {};
  for (const s of data.verdicts?.seasons ?? []) for (const aw of s.awards ?? []) {
    const k = aw.id;
    awards[k] ??= { key: k, name: aw.name, art: TROPHY_ART[k] ?? aw.art, count: 0, years: [] };
    awards[k].count++;
    awards[k].years.push(s.year);
  }
  return [...out, ...Object.values(awards)];
}
export const distinctTrophies = (data) => trophies(data).length; // (M28 SEC-FAC-08 Museum Full)
export function recordRows(data) {
  const R2 = data.records ?? {};
  const club = CLUB_RECORDS.map((r) => ({ id: r.id, name: r.name, now: R2[r.id] ?? null }));
  const careers = RECORD_KEYS.map(({ key, name }) => ({ id: `career:${key}`, name: `Most ${name.toLowerCase()} (a career)`, now: R2[`career:${key}`] ?? null }));
  return { club, careers };
}
export { ACHIEVEMENT_LIST, achievementById, TYPE_OF };
