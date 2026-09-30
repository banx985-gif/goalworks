// Players (Milestone 7, bible §9 / §10): the player model, derived ratings, the positional overall, the match numbers,
// the Founders as real players, and generated players. Plain functions over plain save-friendly objects.
//   player = { id, name, position (GK|DF|MF|WG|FW), age, tier (Standard|Rare), level, trait, stats { ATK, TEC, PAS, DEF,
//              PHY }, potential { low, high } (hidden: shown as a range once scouting exists), form 0, morale 50 (neutral
//              placeholders until Milestone 8), portrait (an art key, or null → a code-drawn silhouette), founder,
//              featuredId, shirt, contract { salary, years, role } }
//   derived(p) → { Pace, Finishing, … }        overall(p, at = p.position) → the positional overall (at another position:
//   matchStats(p) → the engine's six numbers    the out-of-position rating the best XI uses)
//   founderPlayer(founderId, id) · generatePlayer(rng, { id, position, tier?, ageRange, area, usedNames })
import { DERIVED, OVERALL, MATCH, OUTFIELD_KEEPING, OUT_OF_POSITION, NEAR, FOUNDER_PLAYERS, FEATURED_NAMES, GEN, TRAITS, AREA_NAMES, SHARED_NAMES, AREA_SHARE } from '../../data/players.js';
import { founderById } from '../../data/setup.js';

const sumWeights = (w, v) => Object.entries(w).reduce((s, [k, x]) => s + x * v[k], 0);

export function derived(p) {
  const out = {};
  for (const [key, w] of Object.entries(DERIVED)) out[key] = Math.max(1, Math.round(sumWeights(w, p.stats)));
  if (p.position !== 'GK') out.Goalkeeping = Math.max(1, Math.round(out.Goalkeeping * OUTFIELD_KEEPING));
  return out;
}

export function overall(p, at = p.position) {
  const d = derived(p);
  const own = Math.round(sumWeights(OVERALL[at], d));
  if (at === p.position) return own;
  // out of position: rated with the slot's weights, less a penalty (a keeper's gloves for an outfielder cost the most)
  const k = at === 'GK' || p.position === 'GK' ? OUT_OF_POSITION.keeper : NEAR[at]?.includes(p.position) ? OUT_OF_POSITION.near : OUT_OF_POSITION.far;
  const asGk = at === 'GK' ? { ...d, Goalkeeping: Math.round(sumWeights(DERIVED.Goalkeeping, p.stats) * OUTFIELD_KEEPING) } : d;
  return Math.round(sumWeights(OVERALL[at], asGk) * k);
}

export function matchStats(p) {
  const d = derived(p);
  const out = {};
  for (const [key, w] of Object.entries(MATCH)) out[key] = Math.round(sumWeights(w, d));
  return out;
}

export function founderPlayer(founderId, id = 'p1') {
  const row = FOUNDER_PLAYERS[founderId];
  const f = founderById(founderId);
  if (!row || !f) throw new Error(`Unknown founder ${founderId}`);
  const p = {
    id,
    name: row.name,
    position: row.position,
    age: row.age,
    tier: row.tier,
    level: row.level,
    trait: row.trait,
    stats: { ...row.stats },
    form: 0,
    morale: 50,
    portrait: f.art,
    founder: true,
    featuredId: founderId,
  };
  const ovr = overall(p);
  p.potential = { low: ovr + 8, high: ovr + 16 }; // a Founder is a young featured player with room to grow
  return p;
}

const between = (rng, [a, b]) => rng.int(a, b);

// A made-up name: mostly from the area's pool, the rest from the shared one; never a name anyone in `used` has, never a
// Featured Player's name or surname, and a surname nobody in `used` has while any are left.
const FEATURED = new Set(FEATURED_NAMES);
const surname = (n) => n.split(' ').slice(1).join(' ');
const FEATURED_SURNAMES = new Set(FEATURED_NAMES.map(surname));
export function generatedName(rng, area, used) {
  const pool = AREA_NAMES[area] ?? AREA_NAMES.fen;
  const taken = new Set([...used].map(surname));
  for (let i = 0; i < 400; i++) {
    const src = rng.next() < AREA_SHARE ? pool : SHARED_NAMES;
    const name = `${rng.pick(src.first)} ${rng.pick(src.last)}`;
    if (used.has(name) || FEATURED.has(name) || FEATURED_SURNAMES.has(surname(name))) continue;
    if (taken.has(surname(name)) && i < 300) continue; // a new surname if one can be found
    used.add(name);
    return name;
  }
  let n = 0;
  let name;
  do name = `${rng.pick(pool.first)} ${String.fromCharCode(65 + (n++ % 26))}. ${rng.pick(pool.last)}`;
  while (used.has(name));
  used.add(name);
  return name;
}

export function generatePlayer(rng, { id, position, tier = null, ageRange = GEN.seniorAge, area = 'fen', usedNames = new Set() }) {
  const t = tier ?? (rng.next() < GEN.rareChance ? 'Rare' : 'Standard');
  const age = between(rng, ageRange);
  let level = between(rng, GEN.levels[t]);
  if (age <= 20) level = Math.min(level, t === 'Rare' ? GEN.levels.Rare[0] : 2); // the youngest are not yet at their best
  const scale = 1 + GEN.levelStep * (level - 1) + (t === 'Rare' ? GEN.rareBonus : 0);
  const stats = {};
  for (const [k, v] of Object.entries(GEN.base[position])) stats[k] = Math.max(10, Math.round(v * scale * (1 + (rng.next() * 2 - 1) * GEN.jitter)));
  const traits = [...TRAITS[position].Standard, ...(t === 'Rare' ? TRAITS[position].Rare : [])];
  const p = {
    id,
    name: generatedName(rng, area, usedNames),
    position,
    age,
    tier: t,
    level,
    trait: t === 'Rare' ? rng.pick(TRAITS[position].Rare.length ? TRAITS[position].Rare : traits) : rng.pick(TRAITS[position].Standard),
    stats,
    form: 0,
    morale: 50,
    portrait: null, // generated players have no art: a silhouette in the kit colours (never a Featured Player's portrait)
    founder: false,
    featuredId: null,
  };
  const ovr = overall(p);
  const P = GEN.potential;
  const grow = Math.max(0, P.peakAge - age) * (P.growthPerYear[0] + rng.next() * (P.growthPerYear[1] - P.growthPerYear[0]));
  const mid = Math.min(P.cap[t], Math.round(ovr + grow));
  p.potential = { low: Math.max(ovr, mid - P.spread), high: Math.max(ovr, mid + P.spread) };
  return p;
}
