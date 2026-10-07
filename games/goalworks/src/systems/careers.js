// Careers (Milestone 16, bible §10 / §33 / §36): career stats from your matches, age curves (growth for the players who
// don't train at your club, decline for everyone from 30 / 33 GK), retirement inside the bible's windows, a regen for
// every retirement (so the world's player pool never runs dry), club records, the Hall of Fame and the staff-conversion
// flag. Plain functions over the run save; the numbers are in data/careers.js.
//   data.careers = { v: 16, retired: [entry], records: { apps|goals|assists|cleanSheets: { id, name, value } },
//                    academyRegens: [{ position, potential, of, year }], decided: season, events: [], counts, lastDay }
//   a player of yours: p.career = { apps, goals, assists, cleanSheets, fatSum, fatDays } (from his first day here); every
//   player: p.peak (his best overall, for his regen); p.retiring = { season, day } once he has announced it.
//   entry (a retired player of yours) = { uid, id, name, position, tier, trait, portrait, featuredId, founder, age, club,
//     colours, joinedYear, retiredYear, apps, goals, assists, cleanSheets, peak, stats, hof, reasons, staffEligible }
//   normaliseCareers(data, day) · careerOf(p, day)
//   recordMatch(data, { xiIds, score, scorers })   appearances, goals, assists, clean sheets; club records
//   careersDay(data, day) → events: announce (a player of yours will retire at the season's end) · retired · hof
//                          (the season's end's own events come out here the next club day: they happen in transfersDay)
//   retireChance(p, opts) · inWindow(p) · windowOf(p) · declineFrom(p) · growthOf(age)
//   seasonRetire(data, day) / seasonAge(data, day)   called by transfers.js seasonEnd (before the contracts count down /
//                                                    after everyone is a year older)
//   hofReasons(data, p) → why he would go in (empty: not a Hall of Famer)    validateCareers(data) → [] or problems
// Season numbers: season s runs from day 336·s to 336·(s+1) − 1 (Year s + 1); its end is day 336·(s+1).
import { Rng } from '../../../../core/Rng.js';
import { GROWTH, BAND, DECLINE, RETIRE, REGEN, HALL_OF_FAME, STAFF_ELIGIBLE, RECORD_KEYS } from '../../data/careers.js';
import { GEN, FEATURED_NAMES } from '../../data/players.js';
import { YOUTH_SCALE } from '../../data/academy.js';
import { POOL } from '../../data/transfers.js';
import { clubById } from '../../data/fixtures.js';
import { overall, generatePlayer } from './players.js';
import { salaryFor, contractFor } from './squad.js';
import { normalisePlayer, capOf } from './training.js';
import { effect } from './effects.js';
import { inRole } from './staff.js';
import { facilityLevel } from './facilities.js';
import { LEVELS } from '../../data/facilities.js';
import { take, purgeTactics, log as transferLog } from './transfers.js';

const YEAR = 336;
export const seasonOf = (day) => Math.floor(day / YEAR);
const roll = (rng, x) => Math.floor(x) + (rng.next() < x - Math.floor(x) ? 1 : 0);
const isGK = (p) => p.position === 'GK';

export function normaliseCareers(data, day = 0) {
  data.careers ??= { v: 16, retired: [], records: {}, academyRegens: [], decided: -1, events: [], counts: { retired: 0, regens: 0, hof: 0 }, lastDay: null };
  const K = data.careers;
  for (const k of ['retired', 'academyRegens', 'events']) K[k] ??= [];
  K.records ??= {};
  K.counts ??= { retired: 0, regens: 0, hof: 0 };
  for (const p of data.squad?.players ?? []) careerOf(p, day);
  return K;
}
// (an older save: his career here starts now — nothing before Milestone 16 was counted)
export function careerOf(p, day = 0) {
  p.career ??= { apps: 0, goals: 0, assists: 0, cleanSheets: 0, fatSum: 0, fatDays: 0 };
  p.peak ??= overall(p);
  return p.career;
}

// --- matches ----------------------------------------------------------------------------------------------------------------
// After one of your matches: the XI each get an appearance; goals and assists by name (our side is team 0); a clean sheet
// for the keeper and the defenders who played. Club records follow.
export function recordMatch(data, { xiIds = [], score = [0, 0], scorers = [] }) {
  const K = normaliseCareers(data);
  const inXi = new Set(xiIds);
  const byName = new Map(data.squad.players.map((p) => [p.name, p]));
  for (const p of data.squad.players) {
    if (!inXi.has(p.id)) continue;
    const c = careerOf(p);
    c.apps++;
    if (score[1] === 0 && (p.position === 'GK' || p.position === 'DF')) c.cleanSheets++;
  }
  for (const s of scorers) {
    if (s.team !== 0 || s.own) continue;
    const p = byName.get(s.name);
    if (p && inXi.has(p.id)) careerOf(p).goals++;
    const a = s.assist ? byName.get(s.assist) : null;
    if (a && inXi.has(a.id)) careerOf(a).assists++;
  }
  for (const p of data.squad.players) if (inXi.has(p.id)) noteRecords(K, p);
}
function noteRecords(K, p) {
  for (const { key } of RECORD_KEYS) {
    const v = p.career[key];
    const r = K.records[key];
    if (v > 0 && (!r || v > r.value)) K.records[key] = { id: p.id, name: p.name, value: v }; // (a tie: the first holder keeps it)
  }
}

// --- age curves -------------------------------------------------------------------------------------------------------------
export const growthOf = (age) => GROWTH.find(([upTo]) => age <= upTo)[1];
export const declineFrom = (p) => (isGK(p) ? DECLINE.from.GK : DECLINE.from.outfield);
export const windowOf = (p) => (isGK(p) ? RETIRE.window.GK : RETIRE.window.outfield);
export const inWindow = (p) => p.age >= windowOf(p)[0] && p.age <= windowOf(p)[1];

// The quality band of an AI club / the free agents / the market (see BAND): its players grow no higher than band + room.
export function bandOf(data, owner) {
  const club = data.transfers.clubs[owner];
  if (!club) return BAND[owner] ?? BAND.free;
  club.band ??= Math.round(club.players.reduce((a, p) => a + overall(p), 0) / Math.max(1, club.players.length));
  return club.band;
}
// A season's growth for a player who doesn't train with you: about growthOf(age) overall points toward his ceiling (and
// no higher than ceiling, his club's band + room).
export function grow(p, rng, ceiling = 99) {
  const pts = roll(rng, growthOf(p.age));
  if (!pts) return 0;
  const cap = Math.min(capOf(p), ceiling);
  const start = overall(p);
  const w = GEN.base[p.position];
  const keys = Object.keys(w);
  const total = keys.reduce((s, k) => s + w[k], 0);
  for (let guard = 0; guard < 80 && overall(p) < Math.min(cap, start + pts); guard++) {
    let r = rng.next() * total;
    const k = keys.find((x) => (r -= w[x]) < 0) ?? keys[0];
    p.stats[k]++;
    if (overall(p) > cap) {
      p.stats[k]--;
      break;
    }
  }
  return overall(p) - start;
}

// The Strength Centre's physical-cap strength: its flag (1) × its level (data/facilities.js LEVELS.mult: 1 / 1.5 / 2) — the
// flag keys don't scale by themselves (M12c), so the level is read here. Research / staff adding physicalCap add on top.
export function strengthOf(data) {
  const lv = facilityLevel(data, 'F16');
  return effect(data, 'physicalCap') + (lv > 1 ? LEVELS.mult[lv - 1] - 1 : 0);
}
// The decline multiplier for a player (traits; yours: fitness and the Physio) and the PHY one (yours: the Strength Centre).
export function declineMults(data, p, ours) {
  let m = DECLINE.traits[p.trait] ?? 1;
  if (ours) {
    const c = p.career;
    if (c?.fatDays && c.fatSum / c.fatDays < DECLINE.fitness.below) m *= DECLINE.fitness.mult;
    if (inRole(data, 'PH')) m *= DECLINE.physio;
  }
  const phy = ours ? m * Math.max(0, 1 - DECLINE.strength * strengthOf(data)) : m;
  return { all: m, phy };
}
// One season's decline (his age now, after the birthday). The ceiling falls with the overall. → { phy, others, drop }
export function decline(data, p, rng, ours = false) {
  const from = declineFrom(p);
  if (p.age < from) return { phy: 0, others: 0, drop: 0 };
  const k = p.age - from;
  const m = declineMults(data, p, ours);
  const before = overall(p);
  const lose = (key, n) => {
    const was = p.stats[key];
    p.stats[key] = Math.max(DECLINE.floor, was - n);
    return was - p.stats[key];
  };
  const D = DECLINE;
  const phy = lose('PHY', roll(rng, Math.min(D.phy.max, D.phy.base + D.phy.perYear * k) * m.phy));
  let others = 0;
  for (const key of ['ATK', 'TEC', 'PAS', 'DEF']) others += lose(key, roll(rng, Math.min(D.others.max, D.others.base + D.others.perYear * k) * m.all));
  const after = overall(p);
  const drop = before - after;
  if (drop > 0) {
    const P = p.potential;
    P.high = Math.max(after, P.high - drop);
    P.low = Math.max(Math.min(after, P.high), Math.min(P.high, P.low - drop));
    if (P.exact != null) P.exact = Math.max(after, P.exact - drop);
  }
  return { phy, others, drop };
}

// --- retirement -------------------------------------------------------------------------------------------------------------
// The chance he retires at this season's end (his age during the season). opts: { ours, seasons (at your club), free }.
export function retireChance(p, { ours = false, seasons = 0, free = false } = {}) {
  const [a, b] = windowOf(p);
  if (p.age < a) return 0;
  if (p.age >= b) return 1;
  const R = RETIRE;
  let c = R.first + (1 - R.first) * ((p.age - a) / (b - a)) ** R.power;
  if ((p.form ?? 0) < R.lowForm.below) c *= R.lowForm.mult;
  c *= R.tier[p.tier] ?? 1;
  c *= R.traits[p.trait] ?? 1;
  if (p.stats.PHY >= R.fit.phy) c *= R.fit.mult;
  if (ours && seasons >= R.longServing.seasons) c *= R.longServing.mult;
  if (free) c *= R.freeAgent;
  return Math.min(1, c);
}
const seasonsHere = (p, day) => Math.floor((day - (p.joinedDay ?? 0)) / YEAR);

// Your players (and yours out on loan) decide `announceDays` before the season's end.
function ourDeciders(data) {
  const T = data.transfers;
  const out = data.squad.players.filter((p) => !p.loan);
  for (const l of T?.loanedOut ?? []) {
    if (l.academy) continue;
    const p = T.clubs[l.clubId]?.players.find((x) => x.id === l.id);
    if (p) out.push(p);
  }
  return out;
}
function decide(data, day, season, announce) {
  const K = data.careers;
  K.decided = season;
  const events = [];
  for (const p of ourDeciders(data)) {
    if (p.retiring) continue;
    const rng = new Rng(`${data.seed}:retire:${season}:${p.id}`);
    if (rng.next() >= retireChance(p, { ours: true, seasons: seasonsHere(p, day) })) continue;
    p.retiring = { season, day };
    if (announce) {
      events.push({ kind: 'announce', id: p.id, name: p.name, age: p.age, position: p.position });
      if (data.transfers) transferLog(data, day, `${p.name} (${p.age}) will retire at the end of the season.`);
    }
  }
  return events;
}

export function careersDay(data, day) {
  const K = normaliseCareers(data, day);
  if (K.lastDay === day) return [];
  K.lastDay = day;
  const events = K.events.splice(0); // the season's end's news (retirements, the Hall of Fame)
  for (const p of data.squad.players) {
    const c = careerOf(p, day);
    c.fatSum = Math.round((c.fatSum + (p.fatigue ?? 0)) * 10) / 10;
    c.fatDays++;
  }
  const season = seasonOf(day);
  if (day % YEAR >= YEAR - RETIRE.announceDays && K.decided < season) events.push(...decide(data, day, season, true));
  return events;
}

// --- the season's end (from transfers.js) -----------------------------------------------------------------------------------
// Before the contracts count down: everyone who retires this season goes (yours as announced; the rest of the world rolls).
export function seasonRetire(data, day) {
  const K = normaliseCareers(data, day);
  const T = data.transfers;
  const season = day / YEAR - 1;
  if (K.decided < season) decide(data, day, season, false); // (an older save that missed the announcement days)
  const rng = new Rng(`${data.seed}:careers:retire:${day}`);
  const goes = [];
  // yours: as announced (and anyone at the window's end — e.g. a pre-contract who arrived today)
  for (const p of data.squad.players) {
    if (p.loan) {
      if (p.age >= windowOf(p)[1] || rng.next() < retireChance(p)) goes.push({ p, owner: 'us', parent: p.loan.from });
    } else if (p.retiring || p.age >= windowOf(p)[1]) goes.push({ p, owner: 'us', parent: 'us' });
  }
  for (const [cid, club] of Object.entries(T.clubs)) {
    for (const p of club.players) {
      if (p.loan?.academy) continue;
      const mine = p.loan?.from === 'us';
      if (mine) {
        if (p.retiring || p.age >= windowOf(p)[1]) goes.push({ p, owner: cid, parent: 'us' });
      } else if (p.retiring || p.age >= windowOf(p)[1] || (!p.loan && rng.next() < retireChance(p))) goes.push({ p, owner: cid, parent: p.loan ? p.loan.from : cid });
    }
  }
  for (const p of T.free) if (p.retiring || rng.next() < retireChance(p, { free: true })) goes.push({ p, owner: 'free', parent: 'free' });
  for (const p of T.market) if (p.retiring || rng.next() < retireChance(p)) goes.push({ p, owner: 'market', parent: 'market' });
  for (const g of goes) retire(data, g, day, season, rng);
}
// After everyone is a year older: the best overall so far, growth for the world's players, decline for everyone, and the
// oldest free agents retire (POOL.freeAgentLeaveAge — they used to just leave the game).
export function seasonAge(data, day) {
  const T = data.transfers;
  const rng = new Rng(`${data.seed}:careers:age:${day}`);
  const season = day / YEAR - 1;
  const mine = new Set(ourDeciders(data).map((p) => p.id));
  const owners = [['us', data.squad.players], ...Object.entries(T.clubs).map(([cid, c]) => [cid, c.players]), ['free', T.free], ['market', T.market]];
  for (const [owner, list] of owners) for (const p of list) {
    p.peak = Math.max(p.peak ?? 0, overall(p));
    const ours = mine.has(p.id);
    if (!ours && !p.loan?.academy) grow(p, rng, bandOf(data, owner === 'us' ? p.loan?.from ?? 'free' : owner) + BAND.room);
    decline(data, p, rng, ours);
    if (p.career) p.career.fatSum = p.career.fatDays = 0;
  }
  for (const key of ['free', 'market']) for (const p of T[key].filter((x) => x.age >= POOL.freeAgentLeaveAge)) retire(data, { p, owner: key, parent: key }, day, season, rng);
}

function retire(data, { p, owner, parent }, day, season, rng) {
  const T = data.transfers;
  const K = data.careers;
  take(data, owner, p);
  if (owner === 'us') purgeTactics(data, p.id);
  T.loanedOut = T.loanedOut.filter((l) => l.id !== p.id);
  T.pending = T.pending.filter((x) => x.id !== p.id);
  T.bids = T.bids.filter((b) => b.playerId !== p.id);
  T.listed = T.listed.filter((x) => x !== p.id);
  for (const k of Object.keys(T.talks)) if (k.endsWith(`:${p.id}`)) delete T.talks[k];
  if (T.scouting?.knowledge) delete T.scouting.knowledge[p.id];
  if (data.training?.group2?.ids) data.training.group2.ids = data.training.group2.ids.filter((x) => x !== p.id);
  K.counts.retired++;
  if (parent === 'us') {
    const entry = retiredEntry(data, p, season);
    K.retired = [...K.retired, entry].slice(-300);
    if (data.transfers) transferLog(data, day, `${p.name} has retired${entry.hof ? ': into the Hall of Fame' : ''}.`);
    K.events.push({ kind: 'retired', id: p.id, name: p.name, age: p.age, hof: entry.hof });
    if (entry.hof) {
      K.counts.hof++;
      K.events.push({ kind: 'hof', id: p.id, uid: entry.uid, name: p.name, reasons: entry.reasons });
    }
  }
  makeRegen(data, rng, p, parent, season, day);
}

// --- regens -----------------------------------------------------------------------------------------------------------------
export function regenPotential(rng, p) {
  const best = Math.max(p.peak ?? 0, overall(p));
  return Math.round(best * (REGEN.share[0] + rng.next() * (REGEN.share[1] - REGEN.share[0])));
}
function usedNames(data) {
  const T = data.transfers;
  return new Set([...FEATURED_NAMES, ...data.squad.players, ...(data.squad.watch ?? []), ...(data.academy?.players ?? []), ...(data.academy?.intake?.candidates ?? []), ...Object.values(T.clubs).flatMap((c) => c.players), ...T.free, ...T.market].map((x) => x.name ?? x));
}
function makeRegen(data, rng, from, parent, season, day) {
  const T = data.transfers;
  const K = data.careers;
  const pot = regenPotential(rng, from);
  // yours → the next academy trials (with a Youth Corner and room in the queue)
  if (parent === 'us' && data.facilities?.placement?.some((x) => x.def === 'F09' || x.def === 'F14' || x.def === 'F26') && K.academyRegens.length < REGEN.pendingMax) {
    K.academyRegens.push({ position: from.position, potential: pot, of: from.name, year: season + 1 });
    K.counts.regens++;
    return;
  }
  const club = T.clubs[parent];
  const toClub = club && club.players.length < POOL.clubSquad[1];
  const ceiling = bandOf(data, toClub ? parent : parent === 'market' ? 'market' : 'free') + BAND.room;
  const age = toClub ? rng.int(...REGEN.clubAges) : REGEN.poolAge;
  const tier = pot >= REGEN.rareFrom ? 'Rare' : 'Standard';
  const area = parent === 'us' ? data.club?.area ?? 'fen' : rng.pick(POOL.areas);
  const p = generatePlayer(rng, { id: `g${T.nextId++}`, position: from.position, tier, ageRange: [age, age], area, usedNames: usedNames(data) });
  const k = (YOUTH_SCALE[age] ?? 1) * (toClub ? clubById(parent)?.strength ?? 1 : 1);
  for (const s of Object.keys(p.stats)) p.stats[s] = Math.max(8, Math.round(p.stats[s] * k));
  const ovr = overall(p);
  const exact = Math.min(REGEN.cap[tier], Math.max(Math.min(pot, ceiling), ovr + REGEN.room));
  p.potential = { low: Math.max(ovr, exact - REGEN.spread), high: exact + REGEN.spread, exact };
  p.peak = ovr;
  p.regen = { of: from.name, year: season + 1 };
  p.origin = 'regen';
  p.shirt = null;
  if (toClub) {
    p.contract = contractFor(rng, p, 'Prospect');
    club.players.push(p);
  } else {
    p.contract = parent === 'market' ? contractFor(rng, p, 'Rotation') : { salary: salaryFor(p, 'Rotation'), years: 0, role: 'Rotation' };
    p.leftDay = day; // (in the pool from today: the month's refresh leaves him be today)
    (parent === 'market' ? T.market : T.free).push(p);
  }
  normalisePlayer(p);
  K.counts.regens++;
}
// (academy.js) the regens waiting for these trials, oldest first, at most n.
export function takeAcademyRegens(data, n) {
  const K = data.careers;
  if (!K?.academyRegens?.length || n <= 0) return [];
  return K.academyRegens.splice(0, n);
}

// --- the Hall of Fame -------------------------------------------------------------------------------------------------------
export function hofReasons(data, p) {
  const H = HALL_OF_FAME;
  const c = p.career ?? {};
  const out = [];
  if ((c.apps ?? 0) >= H.apps) out.push(`${c.apps} appearances`);
  if ((c.goals ?? 0) >= H.goals) out.push(`${c.goals} goals`);
  if ((c.cleanSheets ?? 0) >= H.cleanSheets) out.push(`${c.cleanSheets} clean sheets`);
  if ((c.apps ?? 0) >= H.record.minApps) for (const { key, name } of RECORD_KEYS) if (data.careers?.records[key]?.id === p.id) out.push(`Club record: ${name.toLowerCase()} (${c[key]})`);
  return out;
}
function retiredEntry(data, p, season) {
  const c = careerOf(p);
  const reasons = hofReasons(data, p);
  const hof = reasons.length > 0;
  return {
    uid: `${data.seed}:${p.id}`,
    id: p.id,
    name: p.name,
    position: p.position,
    tier: p.tier,
    trait: p.trait,
    portrait: p.founder ? p.portrait : null,
    featuredId: p.featuredId ?? null,
    founder: !!p.founder,
    age: p.age,
    club: data.club?.name ?? '',
    colours: { ...(data.club?.colours ?? { primary: 'green', secondary: 'white' }) },
    joinedYear: seasonOf(p.joinedDay ?? 0) + 1,
    retiredYear: season + 1,
    apps: c.apps,
    goals: c.goals,
    assists: c.assists,
    cleanSheets: c.cleanSheets,
    peak: Math.max(p.peak ?? 0, overall(p)),
    stats: { ...p.stats },
    hof,
    reasons,
    staffEligible: hof || c.apps >= STAFF_ELIGIBLE.apps, // (bible §10: the conversion event itself is M28)
  };
}
// The run's Hall of Famers (for the account save).
export const hallOfFamers = (data) => (data.careers?.retired ?? []).filter((e) => e.hof);
// Copy any Hall of Famer the account doesn't have yet into it. → true when the account changed (save it).
export function syncAccountHof(account, data) {
  account.hallOfFame ??= [];
  const have = new Set(account.hallOfFame.map((e) => e.uid));
  let changed = false;
  for (const e of hallOfFamers(data)) {
    if (have.has(e.uid)) continue;
    account.hallOfFame.push({ ...e, inducted: Date.now() });
    changed = true;
  }
  if (account.hallOfFame.length > HALL_OF_FAME.max) account.hallOfFame = account.hallOfFame.slice(-HALL_OF_FAME.max);
  return changed;
}

// --- checks -----------------------------------------------------------------------------------------------------------------
export function validateCareers(data) {
  const errors = [];
  const T = data.transfers;
  const all = [...data.squad.players, ...Object.values(T.clubs).flatMap((c) => c.players), ...T.free, ...T.market];
  for (const p of all) {
    const [, end] = windowOf(p);
    if (p.age > end) errors.push(`${p.name}: age ${p.age} past the retirement window`);
    for (const [k, v] of Object.entries(p.stats)) if (!Number.isFinite(v)) errors.push(`${p.name}: ${k} is ${v}`);
    if (!Number.isFinite(overall(p))) errors.push(`${p.name}: overall NaN`);
    if (FEATURED_NAMES.includes(p.name) && !p.founder && !p.featuredId) errors.push(`${p.name}: a Featured Player's name`);
  }
  const ids = new Set();
  for (const p of all) {
    if (ids.has(p.id)) errors.push(`${p.id} twice in the world`);
    ids.add(p.id);
  }
  return errors;
}
