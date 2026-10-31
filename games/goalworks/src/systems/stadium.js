// The stadium (Milestone 24, bible §26): the five stages, the 15 expansion pieces, attendance. Plain rules on the run save
// (data.stadium); the numbers are data/stadium.js. Every Credit goes through the M23 ledger (finance.post, category
// 'stadium'); an Emergency Credit freezes new building here too (finance.buildBlock).
//   normaliseStadium(data) → data.stadium { v, stage, pieces: { id: day }, project, last, told, cheer, dip, builds }
//     (a new club: the Regional Ground; an older save: the stage its league flags reached, as M23 read it, no pieces)
//   stageNow(data) → the STAGES entry built     capacity(data) → seats (the stage + the pieces built)
//   nextStage(data) → { stage, open, why, cost, weeks } | null (the Crown Stadium stands)
//   canBuildStage(data) / buildStage(data, day) → { ok, why }      canBuyPiece(data, id) / buyPiece(data, id, day)
//   piecesOf(data, stageId) → [{ def, built, building, ok, why }]   project(data) → { kind, id, name, doneDay } | null
//   stadiumBonus(data, key) → the pieces' effect (src/systems/effects.js)    upkeepOf(data) → Credits a week
//   attendance(data, fixture, day) → { crowd, capacity, demand, soldOut, parts }   (a home match; null: away / friendly)
//   noteMatch(data, fixture, att, res, day)   the last crowd, the cheer after a win, the dip after a derby loss
//   stadiumDay(data, day) → events: a project finished ({ kind: 'stadiumBuilt' | 'pieceBuilt' }), a stage opened
//   forceStage(data, id) (debug / tests)
import { STAGES, stageById, STAGE_NEEDS, PIECES, pieceById, PIECE_KEYS, ATTENDANCE, STADIUM_TEXT } from '../../data/stadium.js';
import { leagueById, LEAGUES } from '../../data/league.js';
import { clubById } from '../../data/fixtures.js';
import { cupById } from '../../data/cups.js';
import { post, buildBlock } from './finance.js';
import { upgradeDays } from './effects.js';
import { rank as clubRank, news } from './league.js';
import * as FAN from './fans.js';
import * as RIV from './rivals.js';

const WEEK = 7;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const tierOf = (data) => leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;

// The stage an older save's league flags reached (M23's reading).
function stageFromFlags(data) {
  const u = data.unlocks ?? {};
  let id = 1;
  for (const s of STAGES) if (s.flag && u[s.flag] != null) id = Math.max(id, s.id);
  return id;
}
export function normaliseStadium(data) {
  if (!data.stadium || data.stadium.v !== 1) data.stadium = { v: 1, stage: stageFromFlags(data), pieces: {}, project: null, last: null, told: {}, cheer: null, dip: 1, builds: 0 };
  const S = data.stadium;
  S.pieces ??= {};
  S.told ??= {};
  S.dip ??= 1;
  S.builds ??= 0; // (stages and pieces finished since M24: the board's 'build or upgrade' objective counts them)
  return S;
}
export const stageNow = (data) => stageById(normaliseStadium(data).stage) ?? STAGES[0];
export const piecesBuilt = (data) => Object.keys(normaliseStadium(data).pieces).map(pieceById).filter(Boolean);
export const capacity = (data) => stageNow(data).capacity + piecesBuilt(data).reduce((n, p) => n + (p.gives.capacity ?? 0), 0);
export const upkeepOf = (data) => stageNow(data).upkeep + piecesBuilt(data).reduce((n, p) => n + p.upkeep, 0);
export function stadiumBonus(data, key) {
  if (!data?.stadium) return 0;
  let v = 0;
  for (const p of piecesBuilt(data)) for (const [k, n] of Object.entries(p.gives)) if (PIECE_KEYS[k] === key) v += n;
  return v;
}

// --- building ---------------------------------------------------------------------------------------------------------
export function project(data) {
  const P = normaliseStadium(data).project;
  if (!P) return null;
  const def = P.kind === 'stage' ? stageById(P.id) : pieceById(P.id);
  return { ...P, name: def?.name ?? P.id };
}
const projectBusy = (data) => {
  const P = project(data);
  return P ? STADIUM_TEXT.busy(P.name, `day ${P.doneDay}`) : null;
};
// The next stage: open when its league flag is set (and the stage before it stands — always, since they go in order).
export function nextStage(data) {
  const S = normaliseStadium(data);
  const st = stageById(S.stage + 1);
  if (!st) return null;
  const open = (data.unlocks ?? {})[st.flag] != null;
  return { stage: st, open, why: open ? null : STADIUM_TEXT.needsLeague(STAGE_NEEDS[st.id]), cost: st.cost, weeks: st.weeks };
}
const credits = (data) => data.league?.credits ?? 0;
export function canBuildStage(data) {
  const n = nextStage(data);
  if (!n) return { ok: false, why: 'The Crown Stadium stands: every stage is built' };
  if (!n.open) return { ok: false, why: n.why };
  const busy = projectBusy(data);
  if (busy) return { ok: false, why: busy };
  const block = buildBlock(data);
  if (block) return { ok: false, why: block };
  if (credits(data) < n.cost) return { ok: false, why: STADIUM_TEXT.noMoney(n.cost) };
  return { ok: true, why: null, ...n };
}
const daysFor = (data, weeks) => upgradeDays(data, weeks * WEEK); // (M20b: Bolt builds faster)
export function buildStage(data, day) {
  const c = canBuildStage(data);
  if (!c.ok) return c;
  const S = normaliseStadium(data);
  post(data, -c.cost, 'stadium', `Building the ${c.stage.name}`, day);
  S.project = { kind: 'stage', id: c.stage.id, start: day, doneDay: day + daysFor(data, c.weeks), cost: c.cost };
  return { ok: true, why: null, doneDay: S.project.doneDay, name: c.stage.name };
}
export function canBuyPiece(data, id) {
  const p = pieceById(id);
  if (!p) return { ok: false, why: 'Unknown piece' };
  const S = normaliseStadium(data);
  if (S.pieces[id] != null) return { ok: false, why: 'Built' };
  if (S.stage < p.stage) return { ok: false, why: STADIUM_TEXT.needsStage(stageById(p.stage).name) };
  const busy = projectBusy(data);
  if (busy) return { ok: false, why: busy };
  const block = buildBlock(data);
  if (block) return { ok: false, why: block };
  if (credits(data) < p.cost) return { ok: false, why: STADIUM_TEXT.noMoney(p.cost) };
  return { ok: true, why: null, def: p };
}
export function buyPiece(data, id, day) {
  const c = canBuyPiece(data, id);
  if (!c.ok) return c;
  const S = normaliseStadium(data);
  post(data, -c.def.cost, 'stadium', `Stadium: ${c.def.name}`, day);
  S.project = { kind: 'piece', id, start: day, doneDay: day + daysFor(data, c.def.weeks), cost: c.def.cost };
  return { ok: true, why: null, doneDay: S.project.doneDay, name: c.def.name };
}
export function piecesOf(data, stageId) {
  const S = normaliseStadium(data);
  return PIECES.filter((p) => p.stage === stageId).map((def) => {
    const c = canBuyPiece(data, def.id);
    return { def, built: S.pieces[def.id] != null, building: S.project?.kind === 'piece' && S.project.id === def.id, ok: c.ok, why: c.ok ? null : c.why };
  });
}

// --- attendance -------------------------------------------------------------------------------------------------------
// A small steady wobble (the same match always draws the same crowd): a hash of the day and the opponent.
function wobble(day, id) {
  let h = 2166136261;
  for (const ch of `${day}:${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (((h >>> 0) % 10000) / 10000) * 2 - 1;
}
const leagueOfClub = (id) => LEAGUES.find((l) => l.clubs.includes(id)) ?? null;
// Is this one of the two strongest clubs of its league?
function bigClub(id) {
  const lg = leagueOfClub(id);
  if (!lg) return false;
  const top = lg.clubs.map(clubById).filter(Boolean).sort((a, b) => b.strength - a.strength).slice(0, 2);
  return top.some((c) => c.id === id);
}
export function demandParts(data, fixture) {
  const A = ATTENDANCE;
  const t = tierOf(data);
  const id = fixture?.opponent?.id ?? null;
  const parts = { pool: A.pool[t] ?? A.pool[1], trust: A.trust.base + (A.trust.k * FAN.trust(data)) / 100, rank: A.rank[clubRank(data).id] ?? 1, opponent: 1, cup: 1 };
  if (id) {
    const riv = RIV.info(data, id);
    if (riv) parts.opponent *= A.derby[riv.band.id] ?? 1;
    const theirs = leagueOfClub(id)?.tier ?? t;
    if (theirs > t) parts.opponent *= A.higherLeague;
    else if (bigClub(id)) parts.opponent *= A.big;
  }
  if (fixture?.cup) {
    const def = cupById(fixture.cup.id);
    if (def?.friendly) parts.cup = A.friendly;
    else {
      parts.cup = 1 + A.perRound * (fixture.cup.round ?? 0);
      if (def && fixture.cup.round === def.rounds.length - 1) parts.cup *= A.final;
    }
  } else if (fixture?.promotion) parts.cup = A.promotion;
  return parts;
}
// A home match's crowd (an away match or none: the "average home match" for the estimates).
export function attendance(data, fixture = null, day = 0) {
  const parts = demandParts(data, fixture);
  const jig = 1 + ATTENDANCE.jitter * wobble(day, fixture?.opponent?.id ?? '-');
  const demand = Math.round(parts.pool * parts.trust * parts.rank * parts.opponent * parts.cup * jig);
  const cap = capacity(data);
  const crowd = Math.min(cap, demand);
  return { crowd, capacity: cap, demand, soldOut: demand >= cap, fill: crowd / cap, parts };
}
// After a home result (league.recordResult): the last crowd (the Stadium screen, Match Setup); after any result, the fans
// on the complex: a win → a few stay to cheer at the gates; a derby loss → fewer walk in next time.
export function noteMatch(data, fixture, att, res, day) {
  const S = normaliseStadium(data);
  if (att) S.last = { day, crowd: att.crowd, capacity: att.capacity, soldOut: att.soldOut, opponent: fixture.opponent?.id ?? null };
  S.cheer = res === 'win' ? { day } : null;
  const derby = !!RIV.info(data, fixture.opponent?.id);
  S.dip = derby && res === 'loss' ? 0.8 : 1;
}

// --- the club day -----------------------------------------------------------------------------------------------------
export function stadiumDay(data, day) {
  const S = normaliseStadium(data);
  const events = [];
  const P = S.project;
  if (P && day >= P.doneDay) {
    S.project = null;
    S.builds++;
    if (P.kind === 'stage') {
      S.stage = Math.max(S.stage, P.id);
      const st = stageById(P.id);
      news(data, day, `The ${st.name} is open: ${fmt(capacity(data))} seats.`);
      events.push({ kind: 'stadiumBuilt', id: P.id, name: st.name, capacity: capacity(data) });
    } else {
      S.pieces[P.id] = day;
      const p = pieceById(P.id);
      news(data, day, `Stadium: the ${p.name.toLowerCase()} is ready.`);
      events.push({ kind: 'pieceBuilt', id: P.id, name: p.name });
    }
  }
  const n = nextStage(data);
  if (n?.open && !S.told[n.stage.id] && S.project?.id !== n.stage.id) {
    S.told[n.stage.id] = day;
    events.push({ kind: 'stageOpen', id: n.stage.id, name: n.stage.name, cost: n.cost });
  }
  return events;
}

// Debug / tests: the stage stands now (no Credits, no wait).
export function forceStage(data, id) {
  const S = normaliseStadium(data);
  S.stage = Math.max(1, Math.min(STAGES.length, id));
  if (S.project?.kind === 'stage') S.project = null;
  return stageNow(data);
}
