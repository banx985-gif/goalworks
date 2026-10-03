// Transfers, contracts and the world's players (Milestone 11, bible §10 / §11 / §36). Plain functions over the run save;
// the numbers are in data/transfers.js. Money is the M10 Credits counter (data.league.credits, a placeholder until M23).
//   data.transfers = { v: 11, nextId, clubs: { REG01: { players } … }, free, market, listed, bids, pending, loanedOut,
//                      talks, scouting, wageBase, log, warnedYear, lastDay }
//   normaliseTransfers(data)            the world on first open (an M10 save too): the six Regional clubs' squads (now
//                                       kept and changing), regional free agents and the wider market (ages 18–34)
//   locate(data, id) → { p, owner }     owner 'us' | 'REG0x' | 'free' | 'market'
//   valuation(data, p, owner?)          value = baseTierValue × ageCurve × formFactor × reputationFactor × contractFactor ×
//                                       potentialFactor (stored on p.valuation with every factor)
//   openTalk / makeOffer / acceptCounter   negotiation for 'transfer' | 'free' | 'loan' | 'loanOption' | 'pre' | 'renew'
//   release · listForSale · respondBid · acceptBid · rejectBid · loanOut · exerciseOption   your own squad
//   rosterProblem(players) → a plain reason the squad would be unplayable, or null (the minimum; the maximum in deals)
//   transfersDay(data, day)             one club day: scouting, bids, loans ending, weekly wages / AI bids / AI clubs'
//                                       signings and releases, the monthly pool refresh, the season's end (contracts
//                                       count down, expired players leave, pre-contracts arrive, everyone a year older)
//   afterMatch(data, xiIds)             a player promised a Starter / Star role who sat out loses morale (M8 morale)
// Milestone 15: an academy player can be loaned out too (src/systems/academy.js loanOut: loanedOut entries with academy:
// true) — he is not counted against the senior squad and comes back to the academy, not the senior squad. Names stay
// unique across the academy and the trials as well.
// Every finished deal returns { ok: true, autosave: true } so the game saves at once (bible §36).
import { Rng } from '../../../../core/Rng.js';
import { VALUE, CONTRACT_TERMS, NEGOTIATION, SQUAD_RULES, LOAN, POOL, AI, WAGES, PROMISE } from '../../data/transfers.js';
import { ROLES, FEATURED_NAMES, POSITION_ORDER } from '../../data/players.js';
import { REGIONAL_CLUBS, clubById } from '../../data/fixtures.js';
import { overall, generatePlayer, generatedName } from './players.js';
import { opponentSquad, bestXI, salaryFor, contractFor } from './squad.js';
import { normalisePlayer } from './training.js';
import { normaliseLeague, rank as clubRank } from './league.js';
import { createTalk, respond, askTerms } from './negotiation.js';
import { normaliseScouting, scoutDay } from './scouting.js';
import { scoutingFac } from './effects.js';

const YEAR = 336;
const WEEK = 7;
const MONTH = 28;
const JOINING = ['transfer', 'free', 'loan', 'loanOption', 'pre'];
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const roundTo = (v, step) => Math.round(v / step) * step;
const r3 = (v) => Math.round(v * 1000) / 1000;
const SHAPE = { GK: 2, DF: 6, MF: 4, WG: 3, FW: 3 }; // what an AI club wants its squad to look like

export const credits = (data) => normaliseLeague(data).credits;
const spend = (data, n) => (data.league.credits = Math.round(data.league.credits - n));
const earn = (data, n) => (data.league.credits = Math.round(data.league.credits + n));

// --- the world ------------------------------------------------------------------------------------------------------------
function allPlayers(data) {
  const T = data.transfers;
  return [...data.squad.players, ...(data.squad.watch ?? []), ...(data.academy?.players ?? []), ...(data.academy?.intake?.candidates ?? []), ...Object.values(T.clubs).flatMap((c) => c.players), ...T.free, ...T.market];
}
function genPlayer(data, rng, { position = null, area = null, kind = 'free', clubId = null } = {}) {
  const T = data.transfers;
  const used = new Set([...FEATURED_NAMES, ...allPlayers(data).map((p) => p.name)]);
  const pos = position ?? rng.pick(['GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'WG', 'WG', 'FW', 'FW']);
  const p = generatePlayer(rng, { id: `g${T.nextId++}`, position: pos, area: area ?? rng.pick(POOL.areas), usedNames: used });
  const k = clubId ? clubById(clubId)?.strength ?? 1 : 1;
  if (k !== 1) for (const key of Object.keys(p.stats)) p.stats[key] = Math.max(10, Math.round(p.stats[key] * k));
  p.contract = kind === 'free' ? { salary: salaryFor(p, 'Rotation'), years: 0, role: 'Rotation' } : contractFor(rng, p, rng.pick(['Rotation', 'Rotation', 'Starter']));
  p.origin = kind;
  p.shirt = null;
  return normalisePlayer(p);
}

export function normaliseTransfers(data) {
  normaliseLeague(data);
  data.squad.players.forEach(normalisePlayer);
  if (!data.transfers) {
    const T = (data.transfers = { v: 11, nextId: 1, clubs: {}, free: [], market: [], listed: [], bids: [], pending: [], loanedOut: [], talks: {}, log: [], wageBase: 0, warnedYear: 0, lastDay: null });
    const rng = new Rng(`${data.seed}:transfers:init`);
    const used = new Set([...FEATURED_NAMES, ...data.squad.players.map((p) => p.name), ...(data.squad.watch ?? []).map((p) => p.name)]);
    for (const club of REGIONAL_CLUBS) {
      const sq = opponentSquad({ seed: `${data.seed}:club:${club.id}`, clubId: club.id });
      for (const p of sq.players) {
        p.id = `g${T.nextId++}`;
        if (used.has(p.name)) p.name = generatedName(rng, 'fen', used);
        used.add(p.name);
        p.origin = 'club';
        normalisePlayer(p);
      }
      T.clubs[club.id] = { players: sq.players };
    }
    while (T.free.length < POOL.free.target) T.free.push(genPlayer(data, rng, { kind: 'free' }));
    while (T.market.length < POOL.market.target) T.market.push(genPlayer(data, rng, { kind: 'market' }));
    T.wageBase = Math.ceil((wageBill(data) * WAGES.supportShare) / WAGES.round) * WAGES.round;
  }
  const T = data.transfers;
  for (const k of ['free', 'market', 'listed', 'bids', 'pending', 'loanedOut', 'log']) T[k] ??= [];
  T.talks ??= {};
  normaliseScouting(T);
  return T;
}

export function locate(data, id) {
  const T = data.transfers;
  let p = data.squad.players.find((x) => x.id === id);
  if (p) return { p, owner: 'us' };
  for (const [cid, c] of Object.entries(T.clubs)) {
    p = c.players.find((x) => x.id === id);
    if (p) return { p, owner: cid };
  }
  p = T.free.find((x) => x.id === id);
  if (p) return { p, owner: 'free' };
  p = T.market.find((x) => x.id === id);
  if (p) return { p, owner: 'market' };
  return { p: null, owner: null };
}
export const ownerName = (owner) => (owner === 'us' ? 'your club' : owner === 'free' ? 'Free agent' : owner === 'market' ? 'Other clubs' : clubById(owner)?.name ?? owner);
function listOf(data, owner) {
  const T = data.transfers;
  return owner === 'us' ? data.squad.players : owner === 'free' ? T.free : owner === 'market' ? T.market : T.clubs[owner]?.players;
}
function take(data, owner, p) {
  const list = listOf(data, owner);
  const i = list.indexOf(p);
  if (i >= 0) list.splice(i, 1);
}

// The region's pools for scouting and the Transfers sheet.
export function pool(data, region) {
  const T = data.transfers;
  if (region === 'free') return T.free;
  if (region === 'market') return T.market;
  return Object.values(T.clubs).flatMap((c) => c.players.filter((p) => !p.loan && !p.preContract));
}
// Regional players their club could spare on loan (not in its best XI), and everyone at the wider market.
export function loanable(data) {
  const T = data.transfers;
  const out = [];
  for (const [cid, c] of Object.entries(T.clubs)) {
    const xi = new Set(bestXI(c.players).map((p) => p?.id));
    for (const p of c.players) if (!xi.has(p.id) && !p.loan && !p.preContract) out.push({ p, owner: cid });
  }
  for (const p of T.market) out.push({ p, owner: 'market' });
  return out;
}

// --- value (bible §11) ----------------------------------------------------------------------------------------------------
export function valuation(data, p, owner = locate(data, p.id).owner) {
  const ovr = overall(p);
  const base = Math.round(VALUE.base[p.tier] * Math.max(VALUE.minShare, 1 + VALUE.perOvr * (ovr - 50)));
  const age = VALUE.age.find(([upTo]) => p.age <= upTo)[1];
  const form = r3(1 + VALUE.formPerPoint * (p.form ?? 0));
  const R = VALUE.reputation;
  const reputation = owner === 'us' ? R.rank[clubRank(data).id] : owner === 'free' ? R.free : owner === 'market' ? R.market : R.club[clubById(owner)?.reward ?? 1];
  const contract = VALUE.contract[owner === 'free' ? 0 : Math.max(0, Math.min(5, p.contract?.years ?? 0))];
  const mid = (p.potential.low + p.potential.high) / 2;
  const potential = r3(Math.min(VALUE.potentialMax, 1 + VALUE.potentialPerPoint * Math.max(0, mid - ovr)));
  const value = Math.max(VALUE.round, roundTo(base * age * form * reputation * contract * potential, VALUE.round));
  p.valuation = { base, age, form, reputation, contract, potential, value };
  return p.valuation;
}
export const valueOf = (data, p, owner) => valuation(data, p, owner).value;

// --- the squad's rules -----------------------------------------------------------------------------------------------------
// A plain reason the squad would be unplayable (below the minimum), or null.
export function rosterProblem(players) {
  const R = SQUAD_RULES;
  const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
  for (const p of players) c[p.position]++;
  if (c.GK < R.need.GK) return `You need ${R.need.GK} goalkeepers (you would have ${c.GK}). Sign one first.`;
  if (c.DF < R.need.DF) return `You need ${R.need.DF} defenders (you would have ${c.DF}). Sign one first.`;
  if (c.MF + c.WG < R.need.midWing) return `You need ${R.need.midWing} midfielders or wingers (you would have ${c.MF + c.WG}). Sign one first.`;
  if (c.FW + c.WG < R.need.fwdWing) return `You need ${R.need.fwdWing} forwards or wingers (you would have ${c.FW + c.WG}). Sign one first.`;
  if (c.MF + c.WG + c.FW < R.need.midWing + R.need.fwdWing) return `You need ${R.need.midWing + R.need.fwdWing} midfielders, wingers and forwards (you would have ${c.MF + c.WG + c.FW}).`;
  if (players.length < R.min) return `You need at least ${R.min} senior players (you would have ${players.length}). Sign someone first.`;
  return null;
}
// Senior players counted against the maximum: here now, loaned out (they come back) and pre-contracts still to arrive.
export const squadCount = (data) => data.squad.players.length + data.transfers.loanedOut.filter((l) => !l.academy).length + data.transfers.pending.length; // (M15: academy loans don't count)
const fullReason = (data) => (squadCount(data) >= SQUAD_RULES.max ? `Your squad is full (${SQUAD_RULES.max}, counting loans out and players still to arrive). Sell, release or loan someone out first.` : null);
const clubProblem = (players) => {
  const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
  for (const p of players) c[p.position]++;
  if (players.length < POOL.clubSquad[0]) return 'their squad is too small';
  return rosterProblem(players) ? 'they would be short in that position' : null;
};

export const wageBill = (data) => data.squad.players.reduce((s, p) => s + (p.contract?.salary ?? 0), 0);
export const wageSupport = (data) => roundTo((data.transfers?.wageBase ?? 0) * WAGES.rank[clubRank(data).id], WAGES.round);

// --- negotiation -----------------------------------------------------------------------------------------------------------
const yearsWanted = (p) => CONTRACT_TERMS.yearsWanted.find(([upTo]) => p.age <= upTo)[1];
// The role a player expects in your squad: Star (one of your XI's two best), Starter (in your XI), else Rotation —
// Prospect for the young.
export function expectedRole(data, p) {
  const roster = [...data.squad.players.filter((x) => x.id !== p.id), p];
  const xi = bestXI(roster, data.tactics?.formation ?? '442').filter(Boolean);
  if (xi.some((x) => x.id === p.id)) {
    const stars = xi.slice().sort((a, b) => overall(b) - overall(a)).slice(0, 2);
    return stars.some((x) => x.id === p.id) ? 'Star' : 'Starter';
  }
  return p.age <= 21 ? 'Prospect' : 'Rotation';
}
// His salary ask for the role offered and the release clause (a lower role than he expects costs more; a cheap clause less).
function salaryMult(data, p, role, clause) {
  const steps = Math.max(0, ROLES.indexOf(expectedRole(data, p)) - ROLES.indexOf(role));
  const rc = CONTRACT_TERMS.releaseClause;
  return (1 + CONTRACT_TERMS.roleShortfall * steps) * (clause > 0 && clause <= rc.cheapAt ? 1 - rc.salaryCut : 1);
}
const talkKey = (kind, id) => `${kind}:${id}`;

// What can be negotiated for this player, and why not.
export function canTalk(data, kind, p, owner, day) {
  if (!p) return 'That player is no longer available.';
  const cd = data.transfers.talks[talkKey(kind, p.id)]?.cooldownUntil ?? -1;
  if (cd > day) return `They will not talk again for ${cd - day} day${cd - day === 1 ? '' : 's'}.`;
  if (kind === 'renew') return owner !== 'us' ? 'Not your player.' : p.loan ? `He is on loan from ${ownerName(p.loan.from)}.` : null;
  if (owner === 'us') return 'He already plays for you.';
  if (p.preContract) return 'He has already agreed to join another club.';
  if (p.loan) return 'He is out on loan.';
  if (kind === 'free') return owner === 'free' ? null : 'He is not a free agent.';
  if (owner === 'free') return 'He is a free agent: sign him on a free.';
  if (kind === 'pre') return owner === 'market' || (p.contract?.years ?? 0) !== 1 ? 'A pre-contract is only for a Regional player in the final year of his contract.' : null;
  if (kind === 'loan' || kind === 'loanOption') return loanable(data).some((x) => x.p.id === p.id) ? null : `${ownerName(owner)} will not loan out a first-team player.`;
  return null;
}

export function openTalk(data, kind, id, day) {
  const T = data.transfers;
  const { p, owner } = locate(data, id);
  const why = canTalk(data, kind, p, owner, day);
  if (why) return { ok: false, why };
  const key = talkKey(kind, id);
  if (T.talks[key]?.state === 'open') return { ok: true, talk: T.talks[key], p, owner };
  const v = valueOf(data, p, owner);
  const role = expectedRole(data, p);
  const salary = kind === 'loan' || kind === 'loanOption' ? 0 : Math.round((salaryFor(p, role) * CONTRACT_TERMS.askMarkup[kind]) / 10) * 10;
  const key2 = kind === 'transfer' && data.transfers.clubs[owner] && bestXI(data.transfers.clubs[owner].players).some((x) => x?.id === id) ? NEGOTIATION.keyPlayer : 1;
  const fee = kind === 'transfer' ? roundTo(v * key2, 50) : kind === 'loan' ? roundTo(v * LOAN.feeShare, 10) : kind === 'loanOption' ? roundTo(v * LOAN.optionFeeShare, 10) : 0;
  const bonus = salary * (CONTRACT_TERMS.bonusWeeks[kind] ?? 0);
  const years = kind === 'loan' ? null : yearsWanted(p);
  const rng = new Rng(`${data.seed}:talk:${key}:${day}`);
  T.talks[key] = { ...createTalk({ kind, ask: { fee, salary, bonus, years }, limit: rng.int(...NEGOTIATION.counters) }), playerId: id, role, startDay: day };
  return { ok: true, talk: T.talks[key], p, owner };
}

// A first offer to put in front of the player: a little under what they want, in the role he expects.
export function startingOffer(data, talk) {
  // (the role he expects, no release clause)
  const a = talk.ask;
  return {
    fee: roundTo(a.fee * 0.85, 10),
    salary: roundTo(a.salary * 0.9, 10),
    bonus: roundTo(a.bonus * 0.8, 10),
    years: a.years ? Math.min(a.years[1], Math.max(a.years[0], talk.kind === 'renew' ? 2 : 3)) : null,
    role: talk.role,
    clause: 0,
    promised: false,
  };
}

// What a deal needs before anyone says yes (refused before it costs a counter): Credits, wages, squad size.
export function dealProblem(data, kind, p, owner, offer) {
  const T = data.transfers;
  const fee = offer.fee ?? 0;
  const bonus = offer.bonus ?? 0;
  const need = fee + bonus;
  if (need > credits(data)) return `Not enough Credits: ${fmt(need)} needed, ${fmt(credits(data))} available.`;
  const salary = kind === 'loan' || kind === 'loanOption' ? p.contract?.salary ?? 0 : offer.salary ?? 0;
  const extra = kind === 'renew' ? salary - (p.contract?.salary ?? 0) : kind === 'pre' ? 0 : salary;
  const bill = wageBill(data) + extra;
  const sup = wageSupport(data);
  if (extra > 0 && bill > sup && credits(data) - need < (bill - sup) * WAGES.cushionWeeks)
    return `Wages would run over the board's support (${fmt(bill)} a week against ${fmt(sup)}): keep ${fmt((bill - sup) * WAGES.cushionWeeks)} Credits in hand for it.`;
  if (JOINING.includes(kind)) {
    const full = fullReason(data);
    if (full) return full;
  }
  if ((kind === 'transfer' || kind === 'loan' || kind === 'loanOption') && owner !== 'market' && T.clubs[owner]) {
    const left = T.clubs[owner].players.filter((x) => x.id !== p.id);
    const why = clubProblem(left);
    if (why) return `${ownerName(owner)} will not let him go: ${why}.`;
  }
  return null;
}

// Make an offer (offer = { fee, salary, bonus, years, role, clause }). → { result, why, terms?, deal? }
export function makeOffer(data, kind, id, offer, day) {
  const T = data.transfers;
  const key = talkKey(kind, id);
  const talk = T.talks[key];
  if (!talk || talk.state !== 'open') return { result: 'reject', why: 'Start the talks again.' };
  const { p, owner } = locate(data, id);
  const why = canTalk(data, kind, p, owner, day) ?? dealProblem(data, kind, p, owner, offer);
  if (why) return { result: 'refused', why };
  // the salary ask moves with the role offered and the release clause
  const mult = talk.ask.salary ? salaryMult(data, p, offer.role ?? talk.role, offer.clause ?? 0) : 1;
  const base = talk.ask.salary;
  talk.ask.salary = Math.round(base * mult);
  const r = respond(talk, offer);
  talk.ask.salary = mult === 1 ? talk.ask.salary : Math.round(talk.ask.salary / mult);
  if (r.result === 'counter') r.terms = { ...offer, ...r.terms, salary: talk.ask.salary ? Math.max(offer.salary ?? 0, Math.round(talk.ask.salary * mult)) : offer.salary };
  if (r.result === 'reject') T.talks[key] = { cooldownUntil: day + NEGOTIATION.cooldownDays, state: 'over' };
  if (r.result === 'accept') {
    delete T.talks[key];
    const deal = completeDeal(data, kind, p, owner, offer, day);
    return { ...r, deal };
  }
  return r;
}
// Take the other side's last counter as it stands.
export function acceptCounter(data, kind, id, day) {
  const talk = data.transfers.talks[talkKey(kind, id)];
  if (!talk?.last?.terms || talk.state !== 'open') return { result: 'reject', why: 'There is no counteroffer on the table.' };
  return makeOffer(data, kind, id, talk.last.terms, day);
}
export const talkOf = (data, kind, id) => data.transfers.talks[talkKey(kind, id)] ?? null;
export function walkAway(data, kind, id) {
  const T = data.transfers;
  if (T.talks[talkKey(kind, id)]?.state === 'open') delete T.talks[talkKey(kind, id)];
}

export function freeShirt(data) {
  const used = new Set(data.squad.players.map((p) => p.shirt));
  for (let n = CONTRACT_TERMS.shirts[0]; n <= CONTRACT_TERMS.shirts[1]; n++) if (!used.has(n)) return n;
  return null;
}
function joinUs(data, p, day) {
  normalisePlayer(p);
  p.shirt = freeShirt(data);
  p.watch = false;
  p.preContract = false;
  p.joinedDay = day;
  delete data.transfers.scouting.knowledge[p.id]; // known exactly now
  data.squad.players.push(p);
}
function purgeTactics(data, id) {
  for (const set of Object.values(data.tactics?.lineup ?? {})) for (const [slot, pid] of Object.entries(set)) if (pid === id) delete set[slot];
  data.transfers.listed = data.transfers.listed.filter((x) => x !== id);
  data.transfers.bids = data.transfers.bids.filter((b) => b.playerId !== id);
}
export function log(data, day, text) {
  const T = data.transfers;
  T.log = [...T.log, { day, text }].slice(-40);
}
const contractOf = (offer, day, value) => ({
  salary: offer.salary,
  years: offer.years,
  role: offer.role,
  bonus: offer.bonus ?? 0,
  clause: offer.clause > 0 ? roundTo(value * offer.clause, 50) : null,
  promised: PROMISE.roles.includes(offer.role),
  signedDay: day,
});

export function completeDeal(data, kind, p, owner, offer, day) {
  const T = data.transfers;
  const why = dealProblem(data, kind, p, owner, offer);
  if (why) return { ok: false, why };
  const v = valueOf(data, p, owner);
  spend(data, (offer.fee ?? 0) + (offer.bonus ?? 0));
  if (kind === 'renew') {
    p.contract = contractOf(offer, day, v);
    log(data, day, `${p.name} renewed: ${offer.years} year${offer.years === 1 ? '' : 's'} at ${fmt(offer.salary)} a week (${offer.role}).`);
  } else if (kind === 'pre') {
    p.preContract = true;
    T.pending.push({ id: p.id, from: owner, joinDay: (Math.floor(day / YEAR) + 1) * YEAR, contract: contractOf(offer, day, v) });
    log(data, day, `${p.name} agreed a pre-contract: joins from ${ownerName(owner)} at the end of the season.`);
  } else if (kind === 'loan' || kind === 'loanOption') {
    take(data, owner, p);
    p.loan = { from: owner, fromName: ownerName(owner), until: day + LOAN.days, optionPrice: kind === 'loanOption' ? roundTo(v * LOAN.optionPriceShare, 50) : null, years: offer.years ?? null };
    p.contract = { ...p.contract, role: offer.role ?? p.contract.role, promised: PROMISE.roles.includes(offer.role) };
    joinUs(data, p, day);
    log(data, day, `${p.name} joins on loan from ${ownerName(owner)}${kind === 'loanOption' ? ` (option to buy: ${fmt(p.loan.optionPrice)} Credits)` : ''}.`);
  } else {
    take(data, owner, p);
    p.contract = contractOf(offer, day, v);
    joinUs(data, p, day);
    log(data, day, `${p.name} signs from ${ownerName(owner)}${offer.fee ? ` for ${fmt(offer.fee)} Credits` : ' on a free'}: ${offer.years} year${offer.years === 1 ? '' : 's'}, ${fmt(offer.salary)} a week.`);
  }
  valuation(data, p);
  return { ok: true, autosave: true };
}

// --- your own squad --------------------------------------------------------------------------------------------------------
function ownPlayer(data, id) {
  const p = data.squad.players.find((x) => x.id === id);
  if (!p) return { why: 'Not in your squad.' };
  if (p.founder) return { p, why: 'The Founder stays with the club.' };
  if (p.loan) return { p, why: `He is on loan from ${ownerName(p.loan.from)}.` };
  return { p, why: null };
}
export const releasePayout = (p) => Math.round(p.contract.salary * CONTRACT_TERMS.payoutWeeksPerYear * Math.max(0, p.contract.years));
export function release(data, id, day) {
  const { p, why } = ownPlayer(data, id);
  if (why) return { ok: false, why };
  const pay = releasePayout(p);
  if (pay > credits(data)) return { ok: false, why: `Not enough Credits for his payout: ${fmt(pay)} needed, ${fmt(credits(data))} available.` };
  const short = rosterProblem(data.squad.players.filter((x) => x !== p));
  if (short) return { ok: false, why: short };
  spend(data, pay);
  take(data, 'us', p);
  purgeTactics(data, id);
  toFree(data, p, 'us', day);
  log(data, day, `${p.name} released (payout ${fmt(pay)} Credits).`);
  return { ok: true, autosave: true };
}
function toFree(data, p, from, day = null) {
  p.contract = { salary: p.contract?.salary ?? salaryFor(p, 'Rotation'), years: 0, role: 'Rotation' };
  p.origin = 'released';
  p.releasedBy = from;
  p.leftDay = day;
  p.shirt = null;
  p.loan = null;
  p.preContract = false;
  data.transfers.free.push(p);
}
export function listForSale(data, id, on = true) {
  const { why } = ownPlayer(data, id);
  if (why) return { ok: false, why };
  const T = data.transfers;
  T.listed = T.listed.filter((x) => x !== id);
  if (on) T.listed.push(id);
  return { ok: true };
}
// A bid for one of your players (an AI club): { id, playerId, clubId, until, talk } — talk.ask.fee is their current bid.
function newBid(data, p, clubId, day, rng) {
  const T = data.transfers;
  const v = valueOf(data, p, 'us');
  const fee = roundTo(v * (NEGOTIATION.aiBid[0] + rng.next() * (NEGOTIATION.aiBid[1] - NEGOTIATION.aiBid[0])), 50);
  const max = roundTo(v * NEGOTIATION.aiMax, 50);
  // a release clause they can reach: he goes (if the squad can spare him)
  if (p.contract.clause && max >= p.contract.clause && !rosterProblem(data.squad.players.filter((x) => x !== p))) {
    sellTo(data, p, clubId, p.contract.clause, day);
    log(data, day, `${p.name} left for ${ownerName(clubId)}: they paid his release clause (${fmt(p.contract.clause)} Credits).`);
    return 'clause';
  }
  const bid = { id: `b${T.nextId++}`, playerId: p.id, clubId, day, until: day + AI.bidOpenDays, talk: createTalk({ kind: 'sale', side: 'buyer', ask: { fee, max }, limit: rng.int(...NEGOTIATION.counters) }) };
  T.bids.push(bid);
  return bid;
}
export const openBids = (data) => data.transfers.bids.filter((b) => b.talk.state === 'open');
function sellTo(data, p, clubId, fee, day) {
  take(data, 'us', p);
  purgeTactics(data, p.id);
  earn(data, fee);
  const rng = new Rng(`${data.seed}:sale:${p.id}:${day}`);
  p.contract = { ...contractFor(rng, p, 'Starter'), salary: Math.round((p.contract.salary * 1.1) / 10) * 10 };
  p.shirt = null;
  p.origin = 'club';
  data.transfers.clubs[clubId].players.push(p);
}
export function acceptBid(data, bidId, day) {
  const T = data.transfers;
  const b = T.bids.find((x) => x.id === bidId && x.talk.state === 'open');
  if (!b) return { ok: false, why: 'That bid is gone.' };
  const p = data.squad.players.find((x) => x.id === b.playerId);
  if (!p) return { ok: false, why: 'He is no longer in your squad.' };
  const short = rosterProblem(data.squad.players.filter((x) => x !== p));
  if (short) return { ok: false, why: short };
  const fee = b.talk.ask.fee;
  b.talk.state = 'done';
  sellTo(data, p, b.clubId, fee, day);
  log(data, day, `${p.name} sold to ${ownerName(b.clubId)} for ${fmt(fee)} Credits.`);
  return { ok: true, autosave: true };
}
export function rejectBid(data, bidId) {
  const b = data.transfers.bids.find((x) => x.id === bidId);
  if (b) b.talk.state = 'over';
  return { ok: true };
}
// Ask an AI bidder for more: your asking fee → they accept, raise their bid (1–3 times) or walk away.
export function respondBid(data, bidId, askFee, day) {
  const T = data.transfers;
  const b = T.bids.find((x) => x.id === bidId && x.talk.state === 'open');
  if (!b) return { result: 'reject', why: 'That bid is gone.' };
  const p = data.squad.players.find((x) => x.id === b.playerId);
  const short = p ? rosterProblem(data.squad.players.filter((x) => x !== p)) : 'He is no longer in your squad.';
  if (short) return { result: 'refused', why: short };
  const r = respond(b.talk, { fee: askFee });
  if (r.result === 'accept') {
    b.talk.ask.fee = r.terms.fee;
    b.talk.state = 'open';
    const done = acceptBid(data, bidId, day);
    return { ...r, deal: done };
  }
  return r;
}
export function loanOut(data, id, clubId, day) {
  const { p, why } = ownPlayer(data, id);
  if (why) return { ok: false, why };
  const T = data.transfers;
  const club = T.clubs[clubId];
  if (!club) return { ok: false, why: 'Pick a club.' };
  if (club.players.length >= POOL.clubSquad[1]) return { ok: false, why: `${ownerName(clubId)} have no room in their squad.` };
  const avg = club.players.reduce((s, x) => s + overall(x), 0) / club.players.length;
  if (overall(p) < avg - 8) return { ok: false, why: `${ownerName(clubId)} do not want him: not good enough for their squad.` };
  const short = rosterProblem(data.squad.players.filter((x) => x !== p));
  if (short) return { ok: false, why: short };
  const fee = roundTo(valueOf(data, p, 'us') * LOAN.outFeeShare, 10);
  take(data, 'us', p);
  purgeTactics(data, id);
  p.loan = { from: 'us', until: day + LOAN.days };
  club.players.push(p);
  T.loanedOut.push({ id, clubId, until: day + LOAN.days });
  earn(data, fee);
  log(data, day, `${p.name} loaned to ${ownerName(clubId)} until day ${day + LOAN.days} (+${fmt(fee)} Credits).`);
  return { ok: true, autosave: true };
}
export function exerciseOption(data, id, day) {
  const p = data.squad.players.find((x) => x.id === id);
  if (!p?.loan?.optionPrice) return { ok: false, why: 'No option to buy on this loan.' };
  if (p.loan.optionPrice > credits(data)) return { ok: false, why: `Not enough Credits: ${fmt(p.loan.optionPrice)} needed, ${fmt(credits(data))} available.` };
  spend(data, p.loan.optionPrice);
  log(data, day, `${p.name} bought from ${ownerName(p.loan.from)} for ${fmt(p.loan.optionPrice)} Credits (the loan option).`);
  p.contract = { ...p.contract, years: p.loan.years ?? 3, signedDay: day };
  p.loan = null;
  return { ok: true, autosave: true };
}
export const expiring = (data) => data.squad.players.filter((p) => !p.loan && (p.contract?.years ?? 0) <= 1);

// Always a playable squad: if departures the club could not stop (contracts ending, loans going home) leave it short, the
// board signs free agents on short deals to the minimum (no fee, no bonus — wages only).
export function ensureMinimum(data, day) {
  const T = data.transfers;
  const signed = [];
  for (let guard = 0; guard < SQUAD_RULES.max && rosterProblem(data.squad.players); guard++) {
    const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
    for (const p of data.squad.players) c[p.position]++;
    const R = SQUAD_RULES.need;
    const pos = c.GK < R.GK ? 'GK' : c.DF < R.DF ? 'DF' : c.MF + c.WG < R.midWing ? 'MF' : c.FW + c.WG < R.fwdWing ? 'FW' : rngPos(day + guard);
    // (never a player whose contract with you has just ended: he chose to go)
    let p = T.free.filter((x) => x.position === pos && !(x.releasedBy === 'us' && x.leftDay === day)).sort((a, b) => overall(b) - overall(a))[0];
    if (!p) {
      p = genPlayer(data, new Rng(`${data.seed}:emergency:${day}:${guard}`), { position: pos, kind: 'free' });
      T.free.push(p);
    }
    take(data, 'free', p);
    p.contract = { salary: salaryFor(p, 'Rotation'), years: 1, role: 'Rotation', bonus: 0, clause: null, promised: false, signedDay: day };
    joinUs(data, p, day);
    log(data, day, `${p.name} signed on a one-year deal by the board: the squad was short.`);
    signed.push(p.id);
  }
  return signed;
}
const rngPos = (n) => POSITION_ORDER[1 + (n % 4)];

// --- the calendar ----------------------------------------------------------------------------------------------------------
export function transfersDay(data, day) {
  const T = normaliseTransfers(data);
  if (T.lastDay === day) return { saved: false };
  const rng = new Rng(`${data.seed}:transfers:${day}`);
  let changed = false;
  scoutDay(T, day, (region) => pool(data, region), rng, scoutingFac(data)); // (M12) Video Room / Recruitment Office, (M13) research
  // bids: expire, and bids for players no longer here
  for (const b of T.bids) if (b.talk.state === 'open' && (day > b.until || !data.squad.players.some((p) => p.id === b.playerId))) b.talk.state = 'over';
  T.bids = T.bids.filter((b) => b.talk.state === 'open' || day - b.day <= AI.bidOpenDays * 2);
  // listed players draw bids
  for (const id of T.listed) {
    const p = data.squad.players.find((x) => x.id === id);
    const roll = rng.next();
    if (!p || openBids(data).some((b) => b.playerId === id) || roll >= AI.listedBidChancePerDay) continue;
    const club = bidderFor(data, p, rng);
    if (club && newBid(data, p, club, day, rng) === 'clause') changed = true;
  }
  // loans ending
  for (const p of data.squad.players.filter((x) => x.loan && x.loan.until <= day)) {
    take(data, 'us', p);
    purgeTactics(data, p.id);
    const from = p.loan.from;
    p.loan = null;
    p.shirt = null;
    (listOf(data, from) ?? T.market).push(p);
    log(data, day, `${p.name}'s loan ended: back to ${ownerName(from)}.`);
    changed = true;
  }
  for (const l of T.loanedOut.filter((x) => x.until <= day)) {
    const club = T.clubs[l.clubId];
    const p = club?.players.find((x) => x.id === l.id);
    if (p && l.academy && data.academy) {
      // (M15) an academy player goes back to the academy
      take(data, l.clubId, p);
      p.loan = null;
      p.shirt = null;
      data.academy.players.push(p);
      log(data, day, `${p.name} is back at the academy from his loan at ${ownerName(l.clubId)}.`);
    } else if (p) {
      take(data, l.clubId, p);
      p.loan = null;
      joinUs(data, p, day);
      log(data, day, `${p.name} is back from his loan at ${ownerName(l.clubId)}.`);
    }
    changed = true;
  }
  T.loanedOut = T.loanedOut.filter((x) => x.until > day);
  if (day > 0 && day % YEAR === 0) {
    seasonEnd(data, day, rng);
    changed = true;
  }
  if (day % WEEK === 0) {
    weekly(data, day, rng);
    changed = true;
  }
  if (day > 0 && day % MONTH === 0) refreshPools(data, day, rng);
  if (ensureMinimum(data, day).length) changed = true;
  for (const cid of Object.keys(T.clubs)) topUpClub(data, cid, rng);
  T.lastDay = day;
  return { saved: changed };
}

function bidderFor(data, p, rng) {
  const clubs = Object.entries(data.transfers.clubs).filter(([, c]) => c.players.length < POOL.clubSquad[1]);
  return clubs.length ? rng.pick(clubs)[0] : null;
}

function weekly(data, day, rng) {
  const T = data.transfers;
  // wages (the board's support in, the wage bill out — placeholder money; never below zero)
  const net = wageSupport(data) - wageBill(data);
  if (credits(data) + net < 0) {
    data.league.credits = 0;
    for (const p of data.squad.players) p.morale = Math.max(0, (p.morale ?? 50) - 2);
    log(data, day, 'Wages ran short this week: the players are not happy.');
  } else earn(data, net);
  // an AI club bids for one of your players now and then (the better he is, the likelier)
  if (rng.next() < AI.bidChancePerWeek) {
    const cands = data.squad.players.filter((p) => !p.founder && !p.loan && !openBids(data).some((b) => b.playerId === p.id));
    if (cands.length) {
      const sorted = cands.slice().sort((a, b) => overall(b) - overall(a));
      const p = sorted[Math.min(sorted.length - 1, Math.floor(rng.next() ** 2 * sorted.length))];
      const club = bidderFor(data, p, rng);
      if (club) newBid(data, p, club, day, rng);
    }
  }
  // the AI clubs sign and release their own
  for (const [cid, club] of Object.entries(T.clubs)) {
    const roll = rng.next();
    if (roll >= AI.clubMoveChancePerWeek && club.players.length >= POOL.clubSquad[0]) continue;
    const movable = club.players.filter((p) => !p.loan && !p.preContract);
    const old = movable.filter((p) => p.age >= AI.releaseAge).sort((a, b) => b.age - a.age)[0];
    const weakest = movable.slice().sort((a, b) => overall(a) - overall(b))[0];
    const out = club.players.length >= POOL.clubSquad[1] - 1 || (old && rng.next() < 0.6) ? old ?? weakest : null;
    if (out && club.players.length > POOL.clubSquad[0] && !clubProblem(club.players.filter((x) => x !== out))) {
      take(data, cid, out);
      toFree(data, out, cid, day);
      continue;
    }
    if (club.players.length < POOL.clubSquad[1]) {
      const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
      for (const p of club.players) c[p.position]++;
      const pos = POSITION_ORDER.slice().sort((a, b) => c[a] - SHAPE[a] - (c[b] - SHAPE[b]))[0];
      const avg = club.players.reduce((s, x) => s + overall(x), 0) / Math.max(1, club.players.length);
      const free = T.free.filter((p) => p.position === pos && Math.abs(overall(p) - avg) <= 6 && p.age < AI.releaseAge).sort((a, b) => overall(b) - overall(a))[0];
      const p = free && rng.next() < 0.6 ? free : genPlayer(data, rng, { position: pos, kind: 'club', clubId: cid });
      if (p === free) take(data, 'free', p);
      p.contract = contractFor(rng, p, 'Rotation');
      p.origin = 'club';
      club.players.push(p);
    }
  }
  // values move with form, age and contracts
  for (const p of data.squad.players) valuation(data, p, 'us');
}

// An AI club that lost players it could not refuse (pre-contracts, loans going home) signs to a squad it can field.
function topUpClub(data, cid, rng) {
  const club = data.transfers.clubs[cid];
  for (let guard = 0; guard < 8 && clubProblem(club.players); guard++) {
    const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
    for (const p of club.players) c[p.position]++;
    const R = SQUAD_RULES.need;
    const pos = c.GK < R.GK ? 'GK' : c.DF < R.DF ? 'DF' : c.MF + c.WG < R.midWing ? 'MF' : c.FW + c.WG < R.fwdWing ? 'FW' : POSITION_ORDER.slice().sort((a, b) => c[a] - SHAPE[a] - (c[b] - SHAPE[b]))[0];
    const p = genPlayer(data, rng, { position: pos, kind: 'club', clubId: cid });
    p.contract = contractFor(rng, p, 'Rotation');
    club.players.push(p);
  }
}

function refreshPools(data, day, rng) {
  const T = data.transfers;
  for (const [key, cfg] of [
    ['free', POOL.free],
    ['market', POOL.market],
  ]) {
    const list = T[key];
    // a few sign elsewhere (never one you are scouting closely or talking to)
    for (const p of list.slice()) if (rng.next() < POOL.refreshShare && !T.talks[`free:${p.id}`]?.state && !T.talks[`transfer:${p.id}`]?.state) list.splice(list.indexOf(p), 1);
    while (list.length < cfg.target) list.push(genPlayer(data, rng, { kind: key }));
    while (list.length > cfg.max) list.splice(list.reduce((oi, p, i) => (p.age > list[oi].age ? i : oi), 0), 1);
  }
}

function seasonEnd(data, day, rng) {
  const T = data.transfers;
  // pre-contracts arrive
  for (const pend of T.pending) {
    const { p, owner } = locate(data, pend.id);
    if (!p || owner === 'us') continue;
    take(data, owner, p);
    p.contract = pend.contract;
    p.loan = null;
    joinUs(data, p, day);
    log(data, day, `${p.name} arrives on his pre-contract from ${ownerName(owner)}.`);
  }
  T.pending = [];
  // your contracts count down; those that end leave (the Founder re-signs: he stays with the club)
  for (const p of data.squad.players.slice()) {
    if (p.loan) continue;
    p.contract.years -= 1;
    if (p.contract.years > 0) continue;
    if (p.founder) {
      p.contract.years = 3;
      log(data, day, `${p.name} (Founder) signs on for 3 more years.`);
      continue;
    }
    take(data, 'us', p);
    purgeTactics(data, p.id);
    toFree(data, p, 'us', day);
    log(data, day, `${p.name}'s contract ended: he has left the club.`);
  }
  // the AI clubs' contracts too (they keep a squad they can field)
  for (const [cid, club] of Object.entries(T.clubs)) {
    for (const p of club.players.slice()) {
      if (p.loan) continue;
      p.contract.years -= 1;
      if (p.contract.years > 0) continue;
      if (club.players.length > POOL.clubSquad[0] && !clubProblem(club.players.filter((x) => x !== p)) && rng.next() < 0.5) {
        take(data, cid, p);
        toFree(data, p, cid, day);
      } else p.contract = contractFor(rng, p, p.contract.role ?? 'Rotation');
    }
  }
  for (const p of T.market) if ((p.contract.years -= 1) <= 0) p.contract.years = rng.int(1, 3);
  // everyone a season older (the watch list waits for the academy, M15); the oldest free agents leave the game
  for (const p of [...data.squad.players, ...Object.values(T.clubs).flatMap((c) => c.players), ...T.free, ...T.market]) p.age += 1;
  T.free = T.free.filter((p) => p.age < POOL.freeAgentLeaveAge);
  T.market = T.market.filter((p) => p.age < POOL.freeAgentLeaveAge);
}

// After a match: a player promised a Starter / Star role who sat it out loses morale on top of the M8 benched hit.
export function afterMatch(data, xiIds) {
  const inXi = new Set(xiIds);
  for (const p of data.squad.players) if (p.contract?.promised && PROMISE.roles.includes(p.contract.role) && !inXi.has(p.id)) p.morale = Math.max(0, Math.round(((p.morale ?? 50) + PROMISE.brokenMorale) * 10) / 10);
}

// Players for the Transfers sheet's lists (with their owner), most valuable first.
export function marketList(data) {
  const T = data.transfers;
  const out = [];
  for (const [cid, c] of Object.entries(T.clubs)) for (const p of c.players) if (!p.loan && !p.preContract) out.push({ p, owner: cid });
  for (const p of T.market) out.push({ p, owner: 'market' });
  return out.sort((a, b) => valueOf(data, b.p, b.owner) - valueOf(data, a.p, a.owner));
}
export const freeList = (data) => data.transfers.free.map((p) => ({ p, owner: 'free' })).sort((a, b) => overall(b.p) - overall(a.p));
export const preContractable = (data) => marketList(data).filter((x) => x.owner !== 'market' && x.p.contract?.years === 1);
