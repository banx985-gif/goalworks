// Abilities at the club (Milestone 26, bible §14): each player's slots, what he can learn, how he learns it and how it
// evolves. Plain functions over a player (and the run save for learning / evolution). The numbers: data/abilities.js.
//   p.abl = { personality, innate, learned: [], signature, sigOpen, learning: { id, progress } | null,
//             tally: { tacklesWon, beaten, … } (from his matches: src/match/abilityFx.js), evolved: [{ from, to, day }] }
//   p.trait stays the name of his first trait (the innate one, or the personality / signature one he came with), as before.
//   normaliseAbilities(p) — an older save: his trait goes to the slot it belongs in (a Featured Player gets his bible trait);
//     a generated player also rolls his tier's extras once from his own seed (never the squad generator's dice)
//   abilityIds(p) → every ability he has   matchIds(p) → the ids the match reads   slotsOf(p) → [{ slot, id }]
//   validate(p) → [] or the broken rules (the tests: no illegal stacking)
//   canHold(p, id) → '' or why not       grant(p, id, { slot, open }) → { ok, why, slot }   (debug / secrets / NG+)
//   learnDay(data, p, parts) — a training day's progress towards his next ability (parts: training.js dailyXp's)
//   evolveCheck(data, p, day) → [{ from, to }] (weekly)  evolveProgress(data, p, id) → { to, frac, rows } | null
//   afterMatch(data, { pst, played }) — his tallies from the match; Trickster's morale
//   captainOf(players) → the XI's captain (the armband: p.captain; else the XI's Captain Fantastic / Leader / oldest)
//   teamHas(players, key) → the team-wide value (once a team)
import { Rng } from '../../../../core/Rng.js';
import { ABILITIES, FEATURED_TRAITS, FEATURED_TRAIT_OF, PRESTIGE, SLOTS, GENERATED, LEARN, EVOLVE, CAPTAIN, abilityById, abilityByName } from '../../data/abilities.js';
import { overall } from './players.js';
import { effect } from './effects.js';
import { focusById } from '../../data/training.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h;
}
// His knack for learning (LEARN.talent, fixed from his id: the squad doesn't all learn on one day)
export const talentOf = (p) => LEARN.talent[0] + ((hash(`talent:${p.id}:${p.name}`) % 1000) / 1000) * (LEARN.talent[1] - LEARN.talent[0]);
const LEARNABLE = ABILITIES.filter((a) => !PRESTIGE.has(a.tier));

// --- the evolution family: an ability and anything it evolves into (directly or on down the line) never sit together ------
const NEXT = Object.fromEntries(ABILITIES.filter((a) => a.evolve).map((a) => [a.id, a.evolve.to]));
function descendants(id) {
  const out = new Set();
  for (let x = NEXT[id]; x && !out.has(x); x = NEXT[x]) out.add(x);
  return out;
}
export const related = (a, b) => a === b || descendants(a).has(b) || descendants(b).has(a);

// --- slots ------------------------------------------------------------------------------------------------------------------
const slotFor = (a) => (PRESTIGE.has(a.tier) ? 'signature' : a.kind === 'personality' ? 'personality' : 'innate');
export function slotsOf(p) {
  const A = normaliseAbilities(p);
  return [
    { slot: 'personality', id: A.personality },
    { slot: 'innate', id: A.innate },
    { slot: 'learned', id: A.learned[0] ?? null },
    { slot: 'learned', id: A.learned[1] ?? null },
    { slot: 'signature', id: A.signature, open: A.sigOpen },
  ];
}
export function abilityIds(p) {
  const A = normaliseAbilities(p);
  return [A.personality, A.innate, ...A.learned, A.signature].filter(Boolean);
}
// What the match reads (a god's blessing is not an ability: gods carry none)
export const matchIds = (p) => (p.god ? [] : abilityIds(p));

function emptyAbl() {
  return { personality: null, innate: null, learned: [], signature: null, sigOpen: false, learning: null, tally: {}, evolved: [] };
}
export function normaliseAbilities(p) {
  if (p.abl && p.abl.v === 26) return p.abl;
  const A = Object.assign(emptyAbl(), p.abl ?? {});
  A.learned = (A.learned ?? []).slice(0, SLOTS.learned);
  A.tally ??= {};
  A.evolved ??= [];
  A.v = 26;
  p.abl = A;
  if (p.god) return A; // a god's blessing stays apart (bible §14 / M20b): no ability slots in use
  if (PRESTIGE.has(p.tier)) A.sigOpen = true;
  // a Featured Player: his bible trait (an older save's Founder keeps exactly his)
  const featured = p.featuredId && FEATURED_TRAIT_OF[p.featuredId];
  if (featured && p.trait !== featured) p.trait = featured;
  const own = p.trait ? abilityByName(p.trait) : null;
  if (own && !abilityIds(p).length) {
    const slot = slotFor(own);
    if (slot === 'signature') A.sigOpen = true;
    A[slot] = own.id;
  }
  if (!p.founder && !p.featuredId && !A.rolled) rollGenerated(p);
  return A;
}

// A generated player's extras by tier, rolled once from his own seed (a learned ability or two, maybe a personality).
function rollGenerated(p) {
  const A = p.abl;
  A.rolled = true;
  const rng = new Rng(`abl:${p.id}:${p.name}`);
  const tier = p.tier ?? 'Standard';
  const [one, two] = GENERATED.learned[tier] ?? GENERATED.learned.Standard;
  const n = rng.next() < one ? (rng.next() < two / Math.max(one, 1e-9) ? 2 : 1) : 0;
  for (let k = 0; k < n; k++) {
    const elite = rng.next() < (GENERATED.eliteShare[tier] ?? 0);
    const pool = LEARNABLE.filter((a) => a.kind === 'football' && a.pos.includes(p.position) && (elite ? a.tier === 'Elite' : a.tier !== 'Elite') && !canHold(p, a.id, 'learned'));
    if (pool.length) A.learned.push(pool[Math.floor(rng.next() * pool.length)].id);
  }
  if (!A.personality && rng.next() < GENERATED.personality) {
    const pool = LEARNABLE.filter((a) => a.kind === 'personality' && a.pos.includes(p.position) && (a.tier !== 'Elite' || tier !== 'Standard') && !canHold(p, a.id, 'personality'));
    if (pool.length) A.personality = pool[Math.floor(rng.next() * pool.length)].id;
  }
}

// '' when p may hold this ability in this slot, else why not (the stacking rules).
export function canHold(p, id, slot = null) {
  const a = abilityById(id);
  if (!a) return 'unknown ability';
  const A = p.abl ?? emptyAbl();
  const held = [A.personality, A.innate, ...A.learned, A.signature].filter(Boolean);
  if (held.some((h) => related(h, id))) return held.includes(id) ? 'already has it' : 'has a stronger or weaker form of it';
  const want = slot ?? (PRESTIGE.has(a.tier) ? 'signature' : a.kind === 'personality' ? 'personality' : 'learned');
  if (PRESTIGE.has(a.tier) && want !== 'signature') return 'Legendary and Secret abilities only go in the signature slot';
  if (want === 'signature') {
    if (!PRESTIGE.has(a.tier)) return 'only Legendary and Secret abilities go in the signature slot';
    if (!A.sigOpen) return 'his signature slot is not open';
    if (A.signature) return 'his signature slot is full';
  }
  if (want === 'personality' && a.kind !== 'personality') return 'not a personality trait';
  if (want !== 'personality' && want !== 'signature' && a.kind === 'personality') return 'a personality trait goes in the personality slot';
  if (want === 'personality' && A.personality) return 'his personality slot is full';
  if (want === 'innate' && A.innate) return 'his innate slot is full';
  if (want === 'learned' && A.learned.length >= SLOTS.learned) return 'both learned slots are full';
  if (/^FT/.test(id) && want === 'learned') return 'a Featured Player trait is never learned';
  return '';
}
// Put an ability in (debug, the secrets in M28, NG+ in M29). open: open the signature slot first.
export function grant(p, id, { slot = null, open = false } = {}) {
  const A = normaliseAbilities(p);
  const a = abilityById(id);
  if (!a) return { ok: false, why: 'unknown ability' };
  if (open && PRESTIGE.has(a.tier)) A.sigOpen = true;
  const want = slot ?? (PRESTIGE.has(a.tier) ? 'signature' : a.kind === 'personality' ? 'personality' : 'learned');
  const why = canHold(p, id, want);
  if (why) return { ok: false, why };
  if (want === 'learned') A.learned.push(id);
  else A[want] = id;
  if (A.learning?.id === id) A.learning = null;
  return { ok: true, slot: want };
}

// Every rule (the tests): → [] when the slots are legal.
export function validate(p) {
  const A = p.abl;
  const errs = [];
  if (!A) return errs;
  const at = [['personality', A.personality], ['innate', A.innate], ...A.learned.map((x) => ['learned', x]), ['signature', A.signature]].filter(([, x]) => x);
  if (A.learned.length > SLOTS.learned) errs.push('more than 2 learned abilities');
  const ids = at.map(([, x]) => x);
  if (new Set(ids).size !== ids.length) errs.push('the same ability twice');
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (ids[i] !== ids[j] && related(ids[i], ids[j])) errs.push(`${ids[i]} with its own evolution ${ids[j]}`);
  for (const [slot, id] of at) {
    const a = abilityById(id);
    if (!a) {
      errs.push(`unknown ${id}`);
      continue;
    }
    if (PRESTIGE.has(a.tier) && slot !== 'signature') errs.push(`${a.name} (${a.tier}) outside the signature slot`);
    if (slot === 'signature' && !PRESTIGE.has(a.tier)) errs.push(`${a.name} in the signature slot`);
    if (slot === 'signature' && !A.sigOpen) errs.push('a signature ability with the slot shut');
    if (slot === 'personality' && a.kind !== 'personality') errs.push(`${a.name} in the personality slot`);
    if (slot !== 'personality' && slot !== 'signature' && a.kind === 'personality') errs.push(`${a.name} (personality) in the ${slot} slot`);
    if (slot === 'learned' && /^FT/.test(id)) errs.push(`${a.name} learned`);
  }
  if (p.god && ids.length) errs.push('a god with ability slots in use');
  return errs;
}

// --- team-wide abilities: once a team -------------------------------------------------------------------------------------
export function teamHas(players, key) {
  let v = 0;
  for (const p of players) for (const id of matchIds(p)) {
    const a = abilityById(id);
    if (a?.team && a.fx[key]) v = Math.max(v, a.fx[key]);
  }
  return v;
}
export const has = (p, key) => matchIds(p).reduce((v, id) => v + (abilityById(id)?.fx[key] ?? 0), 0);
// The XI's captain: the armband (p.captain, picked on the player card) if he plays; else the first with Captain
// Fantastic / Iron Captain / Leader; else the oldest of the five best.
export function captainOf(players) {
  const list = players.filter(Boolean);
  const picked = list.find((p) => p.captain);
  if (picked) return picked;
  for (const id of CAPTAIN.auto) {
    const p = list.find((q) => matchIds(q).includes(id));
    if (p) return p;
  }
  return list.slice().sort((a, b) => overall(b) - overall(a)).slice(0, 5).sort((a, b) => b.age - a.age || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}
export function setCaptain(data, id) {
  for (const p of data.squad.players) p.captain = p.id === id ? true : undefined;
}

// --- learning ---------------------------------------------------------------------------------------------------------------
// The ability he works towards: the one that fits him (his position) in the group he trains most, Standard first (Rare, then
// Elite only from LEARN.eliteFrom overall). Kept until learned (or no longer possible).
export function learnTarget(p, parts = []) {
  const A = normaliseAbilities(p);
  if (p.god || A.learned.length >= SLOTS.learned) return null;
  if (A.learning && !canHold(p, A.learning.id, 'learned')) return A.learning.id;
  const share = (g) => parts.reduce((n, x) => n + (x.focus === g ? x.share : 0), 0);
  const ovr = overall(p);
  const pool = LEARNABLE.filter((a) => a.kind === 'football' && a.pos.includes(p.position) && (a.tier !== 'Elite' || ovr >= LEARN.eliteFrom) && !canHold(p, a.id, 'learned'));
  if (!pool.length) return null;
  // the group he trains most; then one made for his position (its first); then his own taste (fixed from his id)
  const tierOrder = { Standard: 0, Rare: 1, Elite: 2 };
  const main = (a) => (a.pos[0] === p.position ? 0 : 1);
  pool.sort((a, b) => share(b.group) - share(a.group) || main(a) - main(b) || tierOrder[a.tier] - tierOrder[b.tier] || hash(`${p.id}:${a.id}`) - hash(`${p.id}:${b.id}`));
  return pool[0].id;
}
// One training day: progress towards his target. data: the run save (the Head Coach, research, sponsors). → the id
// learned today, else null.
export function learnDay(data, p, parts) {
  const A = normaliseAbilities(p);
  const target = learnTarget(p, parts);
  if (!target) return null;
  if (A.learning?.id !== target) {
    // (his first target starts part way, fixed from his id — the squad doesn't all learn in one week)
    A.learning = { id: target, progress: A.started ? 0 : Math.round(((hash(`head:${p.id}`) % 1000) / 1000) * LEARN.headStart * 1000) / 1000 };
    A.started = true;
  }
  const a = abilityById(target);
  let s = 0;
  for (const x of parts) s += x.share * (x.focus === a.group ? 1 : x.focus === 'ability' ? LEARN.abilityFocus : focusById(x.focus).rest ? 0 : LEARN.otherShare);
  const coach = 1 + effect(data, 'coachPct') / 100;
  const research = 1 + effect(data, LEARN.sponsor) / 100;
  A.learning.progress = Math.round((A.learning.progress + LEARN.perDay * s * coach * research * talentOf(p) * (LEARN.tier[a.tier] ?? 0.3)) * 1e7) / 1e7;
  if (A.learning.progress < 1) return null;
  A.learning = null;
  grant(p, target, { slot: 'learned' });
  return target;
}
// A loved item: a little progress towards what he is learning (never a Legendary / Secret: they are never learned).
export function itemNudge(p) {
  const A = normaliseAbilities(p);
  if (!A.learning) return false;
  A.learning.progress = Math.min(0.99, A.learning.progress + LEARN.item);
  return true;
}

// --- evolution --------------------------------------------------------------------------------------------------------------
const secretFound = (data, id) => !!data.secrets?.state?.[id]?.found;
// How much easier evolution is at this club: C11's evolution boost (a prize flag), F34 Hall of Legends, HC04 (× each).
function needScale(data) {
  let m = 1;
  if (data.unlocks?.evolutionBoost != null) m *= EVOLVE.boost;
  if (effect(data, 'legendEvolution') > 0) m *= EVOLVE.boost;
  if (effect(data, 'evolutionChecks') > 0) m *= 0.9;
  return m;
}
const counter = (p, k) => p.abl?.tally?.[k] ?? p.career?.[k] ?? 0;
export function evolveProgress(data, p, id) {
  const a = abilityById(id);
  if (!a?.evolve) return null;
  const to = abilityById(a.evolve.to);
  const scale = needScale(data);
  const rows = [];
  for (const [k, n] of Object.entries(a.evolve.need)) {
    const stat = /^[A-Z]{3}$/.test(k);
    const need = stat ? n : Math.ceil(n * scale);
    const have = stat ? p.stats[k] ?? 0 : counter(p, k);
    rows.push({ key: k, need, have, frac: clamp(have / need, 0, 1) });
  }
  const locked = a.evolve.secret && !secretFound(data, a.evolve.secret) ? a.evolve.secret : null;
  const blocked = PRESTIGE.has(to.tier) && p.abl.signature ? 'his signature slot is full' : '';
  return { to: to.id, rows, frac: rows.reduce((m, r) => Math.min(m, r.frac), 1), locked, blocked };
}
// Weekly: each of his abilities whose needs are all met evolves (into the same slot; a Legendary / Secret one moves to the
// signature slot, which opens for it).
export function evolveCheck(data, p, day) {
  const A = normaliseAbilities(p);
  const out = [];
  if (p.god) return out;
  for (const slot of ['personality', 'innate', 'learned']) {
    const list = slot === 'learned' ? A.learned.slice() : [A[slot]];
    for (const id of list) {
      if (!id) continue;
      const ev = evolveProgress(data, p, id);
      if (!ev || ev.frac < 1 || ev.locked || ev.blocked) continue;
      const to = abilityById(ev.to);
      if (abilityIds(p).some((h) => h !== id && related(h, ev.to))) continue; // (he has it, or its stronger form, already)
      if (slot === 'learned') A.learned = A.learned.filter((x) => x !== id);
      else A[slot] = null;
      if (PRESTIGE.has(to.tier)) {
        A.sigOpen = true;
        A.signature = to.id;
      } else if (slot === 'learned') A.learned.push(to.id);
      else A[slot] = to.id;
      if (p.trait === abilityById(id).name) p.trait = to.name;
      A.evolved.push({ from: id, to: to.id, day });
      out.push({ from: id, to: to.id });
    }
  }
  return out;
}

// --- after a match ------------------------------------------------------------------------------------------------------------
// pst: the match's per-player tallies (world.pst, keyed '0:<id>' for our side); played: the ids who played (XI + subs).
export function afterMatch(data, { pst = {}, played = [] }) {
  const ids = new Set(played);
  const out = [];
  for (const p of data.squad?.players ?? []) {
    if (!ids.has(p.id)) continue;
    const A = normaliseAbilities(p);
    const t = pst[`0:${p.id}`];
    if (t) for (const [k, v] of Object.entries(t)) A.tally[k] = (A.tally[k] ?? 0) + v;
    // Trickster: beating a tackle lifts his morale
    const tr = has(p, 'trickster');
    if (tr && t?.beaten > 0) {
      p.morale = Math.min(100, Math.round(((p.morale ?? 50) + tr) * 10) / 10);
      out.push({ kind: 'trickster', id: p.id });
    }
  }
  return out;
}
