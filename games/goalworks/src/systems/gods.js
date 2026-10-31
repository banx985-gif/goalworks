// The Works Gods at the club (Milestone 20b; data/gods.js): who is here, signing / appointing / releasing them, and their
// blessings as plain reads of the run save. Their arrivals come from the secrets (src/systems/secrets.js).
//   data.gods = { v: 1, offers: [{ god, day, until }], chairman: 'GOD4' | null, returnAt: { god: day }, signedEver: { god: day },
//                 chaos: { fixtureId: { good, pct, line } } }
//   account.gods = { signed: { god: true }, titleRuns: [seed], found: { secretId: { day, conditions } }, pantheon: day | null }
//   normaliseGods(data) · normaliseAccountGods(account)
//   godAtClub(data, id) · godsAtClub(data) → [id]   offerFor(data, id) → the open arrival offer, or null
//   makeGodPlayer(data, id, day) → the god as a player (a Star, Divine tier, ageless)
//   sign(data, id, day, account, { force }) → { ok, why }   (a player joins the squad; Bolt takes the Physio seat; Kaching
//     the Honorary Chairman seat)        release(data, id, day) → { ok, why } (he leaves the game; back after the next
//     season's end)
//   godBonus(data, key) → what the gods add to the shared effect query (src/systems/effects.js)
//   incomeMult(data) → Kaching's Golden touch on match income and prize money (1 or 1.2)
//   jinxInGoal(data) · shootoutChance(data) → 0.5, or 0.75 with Jinx in goal
//   havocInXi(data) · chaosRoll(data, fixtureId) → null, or { good, pct, line } for that match (the same every time)
import { Rng } from '../../../../core/Rng.js';
import { GODS, GOD_IDS, DIVINE, PANTHEON, godById } from '../../data/gods.js';
import { CONTRACT, STAR } from '../../data/players.js';
import { overall } from './players.js';

const YEAR = 336;
export const nextSeasonEnd = (day) => (Math.floor(day / YEAR) + 1) * YEAR;

export function normaliseGods(data) {
  data.gods ??= { v: 1, offers: [], chairman: null, returnAt: {}, signedEver: {}, chaos: {} };
  const G = data.gods;
  G.offers ??= [];
  G.returnAt ??= {};
  G.signedEver ??= {};
  G.chaos ??= {};
  G.chairman ??= null;
  return G;
}
export function normaliseAccountGods(account) {
  account.gods ??= { signed: {}, titleRuns: [], found: {}, pantheon: null };
  const A = account.gods;
  A.signed ??= {};
  A.titleRuns ??= [];
  A.found ??= {};
  A.pantheon ??= null;
  return A;
}

export const godPlayer = (data, id) => data?.squad?.players.find((p) => p.god === id) ?? null;
export function godAtClub(data, id) {
  const g = godById(id);
  if (!g || !data) return false;
  if (g.kind === 'player') return !!godPlayer(data, id);
  if (g.kind === 'staff') return !!data.staff?.hired?.some((s) => s.id === id);
  return data.gods?.chairman === id;
}
export const godsAtClub = (data) => GOD_IDS.filter((id) => godAtClub(data, id));
export const offerFor = (data, id) => data?.gods?.offers.find((o) => o.god === id) ?? null;

// The god as a player: his stat line exactly, a Star (cap 140), Divine tier, ageless; wages like the Secret tier.
export function makeGodPlayer(data, id, day = 0) {
  const g = godById(id);
  const p = {
    id: `god_${id}`,
    name: g.name,
    position: g.position,
    age: DIVINE.age,
    tier: DIVINE.tier,
    level: DIVINE.level,
    trait: g.trait,
    stats: { ...g.stats },
    form: 0,
    morale: 60,
    fatigue: 0,
    portrait: g.art,
    founder: false,
    star: true,
    cap: STAR.cap,
    god: id,
    ...(g.wildcard ? { anyOutfield: true } : {}),
    joinedDay: day,
  };
  const ovr = overall(p);
  p.potential = { low: ovr, high: ovr, exact: ovr };
  p.peak = ovr;
  const s = CONTRACT.salary[DIVINE.wageTier];
  p.contract = { salary: Math.round(((s.base + s.perOvr * Math.max(0, ovr - 40)) * CONTRACT.roleBonus.Star) / 10) * 10, years: 1, role: 'Star', god: true };
  return p;
}

const credits = (data) => data.league?.credits ?? 0;
function history(data, day, text) {
  data.clubHistory = [...(data.clubHistory ?? []), { day, year: Math.floor((Math.max(1, day) - 1) / YEAR) + 1, text }].slice(-60);
}

// Sign / appoint an arrived god (an open offer; force: ?debug=1 and the tests). → { ok, why, accountChanged }
export function sign(data, id, day, account = null, { force = false, hooks = {} } = {}) {
  const G = normaliseGods(data);
  const g = godById(id);
  if (!g) return { ok: false, why: 'Unknown god.' };
  if (godAtClub(data, id)) return { ok: false, why: `${g.name} is already at the club.` };
  const offer = offerFor(data, id);
  if (!offer && !force) return { ok: false, why: `${g.name} isn’t waiting at the gates.` };
  if (g.kind === 'player') {
    const max = hooks.squadMax ?? 26;
    if (data.squad.players.length >= max) return { ok: false, why: `The squad is full (${max}). Release or sell someone first — ${g.name} will wait until the window closes.` };
    const p = makeGodPlayer(data, id, day);
    p.shirt = hooks.freeShirt?.(data) ?? null;
    data.squad.players.push(p);
  } else if (g.kind === 'staff') {
    const r = hooks.appointStaff?.(data, id, day);
    if (r && !r.ok) return r;
  } else G.chairman = id;
  G.offers = G.offers.filter((o) => o.god !== id);
  delete G.returnAt[id];
  const first = !G.signedEver[id];
  G.signedEver[id] ??= day;
  if (first) history(data, day, `${g.name}, ${g.title}, joined the club (Divine)`);
  let accountChanged = false;
  if (account) {
    const A = normaliseAccountGods(account);
    if (!A.signed[id]) accountChanged = A.signed[id] = true;
    if (!A.pantheon && GOD_IDS.every((x) => A.signed[x])) {
      A.pantheon = day;
      accountChanged = true;
    }
    if (A.pantheon) (data.achievements ??= {})[PANTHEON.id] ??= { day };
  }
  return { ok: true, accountChanged };
}

// Release: he leaves the game (never to an AI club or the free agents) and comes back after the next season's end.
export function release(data, id, day, hooks = {}) {
  const G = normaliseGods(data);
  const g = godById(id);
  if (!godAtClub(data, id)) return { ok: false, why: `${g?.name ?? 'That god'} isn’t at the club.` };
  if (g.kind === 'player') {
    const p = godPlayer(data, id);
    data.squad.players = data.squad.players.filter((x) => x !== p);
    hooks.purge?.(data, p.id);
  } else if (g.kind === 'staff') hooks.releaseStaff?.(data, id, day);
  else G.chairman = null;
  G.returnAt[id] = nextSeasonEnd(day);
  return { ok: true };
}

// --- blessings -------------------------------------------------------------------------------------------------------------
// The effect query (keys shared with facilities / research / staff): Zip's recovery, Kaching's income. (Bolt is a hired
// staff member: his effects come through staffBonus.)
export function godBonus(data, key) {
  if (!data?.gods && !data?.squad?.players?.some((p) => p.god)) return 0;
  let v = 0;
  if (key === 'recoveryPct' && godPlayer(data, 'GOD3')) v += GODS.GOD3.blessing.recoveryPct;
  if (key === 'incomePct' && data.gods?.chairman === 'GOD4') v += GODS.GOD4.blessing.incomePct;
  if (key === 'sponsorPct' && data.gods?.chairman === 'GOD4') v += GODS.GOD4.blessing.sponsorPct; // (M23: stored since M20b, live with sponsors)
  return v;
}
export const incomeMult = (data) => 1 + godBonus(data, 'incomePct') / 100;

// Is Jinx in goal? Her club's keeper slot: the hand-picked keeper, else the best keeper (she always is, when fit).
export function jinxInGoal(data, xi = null) {
  const j = godPlayer(data, 'GOD2');
  if (!j) return false;
  if (xi) return xi[0]?.id === j.id;
  const fixed = data.tactics?.lineup?.[data.tactics?.formation]?.[0];
  if (fixed && fixed !== j.id && data.squad.players.some((p) => p.id === fixed)) return false;
  return !data.squad.players.some((p) => p.position === 'GK' && p !== j && overall(p) > overall(j));
}
export const shootoutChance = (data) => (jinxInGoal(data) ? GODS.GOD2.blessing.shootout : 0.5);

// Havoc's chaos roll for one match (seeded by the fixture: the same every time it is asked).
export function chaosRoll(data, fixtureId) {
  const G = normaliseGods(data);
  if (G.chaos[fixtureId]) return G.chaos[fixtureId];
  const b = GODS.GOD5.blessing;
  const rng = new Rng(`${data.seed}:havoc:${fixtureId}`);
  const good = rng.next() < b.good;
  const lines = good ? GODS.GOD5.boosts : GODS.GOD5.setbacks;
  const r = { good, pct: good ? b.up : b.down, line: rng.pick(lines) };
  G.chaos = { ...Object.fromEntries(Object.entries(G.chaos).slice(-7)), [fixtureId]: r };
  return r;
}
// Apply a roll to an XI's engine numbers (xiForMatch players): every stat × (1 + pct).
export function applyChaos(xi, roll) {
  if (!roll) return xi;
  for (const p of xi) for (const k of Object.keys(p.stats)) p.stats[k] = Math.round(p.stats[k] * (1 + roll.pct));
  return xi;
}
export const DIVINE_TIER = DIVINE;
