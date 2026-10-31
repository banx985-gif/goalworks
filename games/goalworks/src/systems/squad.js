// The squad (Milestone 7, bible §5 / §11): the 18-player starting squad (the Founder + 17 generated Regional-quality
// players), the 3-person youth watch list, basic contracts, the best XI for a match, and an opponent's generated side.
//   createStartingSquad({ founderId, seed, area }) → squad { players[18], watch[3], nextId }
//   validateSquad(squad, founderId?) → [] or the rules it breaks (Node tests, and ?debug=1 on load)
//   bestXI(players, formation = '442', fixed) → 11 players in the formation's slot order (keeper first): the best of each slot's own position,
//                     playing someone out of position only when that position has nobody left
//   xiForMatch(players) → the 11 as match set-up players { name, shirt, stats } (stats: the engine's six numbers)
//     (M25) an injured or banned player is never picked; if fewer than 11 are fit, the least-hurt injured play (never a
//     banned one) · benchFor(players, xi, n) → the next n fit players (a keeper first if there is one)
//   opponentSquad({ seed, clubId }) → a generated 18 at that club's level (names from the club's area)
//   toClubLevel(p, clubId) → a generated player raised to his club's strength (M17: County potential rises too)
//   ensureSquad(data) → true when it had to generate one (a Milestone 0–6 save: once, from its stored Founder)
import { Rng } from '../../../../core/Rng.js';
import { SQUAD, GEN, CONTRACT, ROLES, POSITION_ORDER, CLUB_AREAS, FEATURED_NAMES, STAR } from '../../data/players.js';
import { formationById } from '../../data/tactics.js';
import { clubById, REGIONAL_CLUBS, PREMIER_CLUBS } from '../../data/fixtures.js';
import { founderPlayer, generatePlayer, overall, matchStats, statCap, makeStar } from './players.js';
import { conditionFactor, normaliseSquad } from './training.js';

// Milestone 9: any formation (data/tactics.js). Each slot is rated at its natural position (slot.pos: wide midfield and
// wide forward slots want wingers), and the scarce slots fill first: keeper, strikers, the back line, centre midfield, then
// the wide slots.
const RANK = { GK: 0, FW: 1, DF: 2, MF: 3, WG: 4 };
const fillOrder = (slots) => slots.map((_, i) => i).sort((x, y) => RANK[slots[x].pos] - RANK[slots[y].pos] || x - y);

// Who may fill a slot before anyone plays out of position: its own position (wide slots: wingers or midfielders; up
// front: strikers, then wingers).
const NATURAL = { GK: ['GK'], DF: ['DF'], MF: ['MF'], WG: ['WG', 'MF'], FW: ['FW', 'WG'] };

// fixed: [playerId | null per slot] — players picked by hand for their slots (the rest pick themselves around them).
export function bestXI(players, formation = '442', fixed = null) {
  const slots = formationById(formation).slots;
  const left = players.slice();
  const xi = new Array(slots.length).fill(null);
  if (fixed)
    fixed.forEach((id, i) => {
      const j = id ? left.findIndex((p) => p.id === id) : -1;
      if (j >= 0) xi[i] = left.splice(j, 1)[0];
    });
  for (const i of fillOrder(slots)) {
    if (xi[i]) continue;
    const at = slots[i].pos;
    const pick = (ok) => {
      let best = -1;
      let bestR = -Infinity;
      left.forEach((p, j) => {
        if (!ok(p)) return;
        const r = overall(p, at) * conditionFactor(p); // (Milestone 8: a tired or low player may sit out)
        if (r > bestR) [best, bestR] = [j, r];
      });
      return best;
    };
    let j = -1;
    for (const pos of NATURAL[at]) if (j < 0) j = pick((p) => p.position === pos);
    if (j < 0) j = pick(() => true); // nobody left for the slot: the best of the rest, out of position
    if (j >= 0) xi[i] = left.splice(j, 1)[0];
  }
  return xi;
}

// Milestone 8: each player's six numbers × his condition (fatigue, form, morale — exactly 1 at neutral).
// Milestone 9: in the club's formation, with any hand-picked players: xiForMatch(players, { formation, lineup }).
const fit = (p) => !p.injury && !(p.ban?.matches > 0);
export function pickable(players) {
  const ok = players.filter(fit);
  if (ok.length >= 11) return ok;
  // an injury crisis: the least-hurt injured make up the numbers (never a banned player)
  const hurt = players.filter((p) => p.injury && !(p.ban?.matches > 0)).sort((a, b) => a.injury.days - b.injury.days);
  return [...ok, ...hurt.slice(0, 11 - ok.length)];
}
export function matchPlayer(p) {
  const k = conditionFactor(p);
  const stats = matchStats(p);
  for (const key of Object.keys(stats)) stats[key] = Math.round(stats[key] * k);
  return { id: p.id, name: p.name, shirt: p.shirt, position: p.position, stats, ...(p.god ? { god: p.god } : {}), ...(p.trait ? { trait: p.trait } : {}) }; // (M20b) a god's blessing plays in the match; (M25) his trait (set pieces)
}
export const xiForMatch = (players, { formation = '442', lineup = null } = {}) => bestXI(pickable(players), formation, lineup).filter(Boolean).map(matchPlayer);
// (M25) the bench: the next best fit players who are not in the XI, a keeper among them when there is one
export function benchFor(players, xiIds, n = 7) {
  const rest = players.filter((p) => fit(p) && !xiIds.includes(p.id) && !p.loan);
  const score = (p) => matchStats(p).pace + matchStats(p).passing + matchStats(p).shooting + matchStats(p).tackling + matchStats(p).dribbling;
  const gk = rest.filter((p) => p.position === 'GK').sort((a, b) => matchStats(b).keeping - matchStats(a).keeping)[0];
  const out = rest.filter((p) => p !== gk).sort((a, b) => score(b) - score(a)).slice(0, gk ? n - 1 : n);
  return (gk ? [gk, ...out] : out).map(matchPlayer);
}

// (Milestone 11: exported — what a player's wages are for a role, and a fresh contract — for transfers and renewals)
export function salaryFor(p, role) {
  const s = CONTRACT.salary[p.tier] ?? CONTRACT.salary.Standard;
  return Math.round(((s.base + s.perOvr * Math.max(0, overall(p) - 40)) * CONTRACT.roleBonus[role]) / 10) * 10;
}
export function contractFor(rng, p, role) {
  return { salary: salaryFor(p, role), years: rng.int(...CONTRACT.years[role]), role };
}

// Roles: the best XI start (its two best are the Stars); the rest rotate, the young ones are Prospects. Shirts: the XI
// wear 1–11 in formation order, the rest 12–18.
function assignRoles(rng, players, watch) {
  const xi = bestXI(players);
  const inXi = new Set(xi.map((p) => p.id));
  const stars = new Set(xi.slice().sort((a, b) => overall(b) - overall(a)).slice(0, 2).map((p) => p.id));
  for (const p of players) {
    const role = stars.has(p.id) ? 'Star' : inXi.has(p.id) ? 'Starter' : p.age <= CONTRACT.prospectAge ? 'Prospect' : 'Rotation';
    p.contract = contractFor(rng, p, role);
    if (p.founder) p.contract.years = 5; // the founding player signs for the longest term
  }
  xi.forEach((p, i) => (p.shirt = i + 1));
  const rest = players.filter((p) => !inXi.has(p.id)).sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || overall(b) - overall(a));
  rest.forEach((p, i) => (p.shirt = 12 + i));
  for (const p of watch) {
    p.contract = contractFor(rng, p, 'Prospect');
    p.shirt = null;
  }
}

function generateSide(rng, { area, founder = null }) {
  const shape = rng.pick(SQUAD.shapes);
  const need = { ...shape };
  const used = new Set(FEATURED_NAMES);
  let n = 1;
  const players = [];
  if (founder) {
    players.push(founder);
    used.add(founder.name);
    need[founder.position]--;
    n = 2;
  }
  for (const pos of POSITION_ORDER) for (let i = 0; i < need[pos]; i++) players.push(generatePlayer(rng, { id: `p${n++}`, position: pos, area, usedNames: used }));
  return { players, used, n };
}

export function createStartingSquad({ founderId, seed, area = 'fen' }) {
  const rng = new Rng(`${seed}:squad`);
  const { players, used, n } = generateSide(rng, { area, founder: founderPlayer(founderId, 'p1') });
  let next = n;
  const watch = [];
  for (let i = 0; i < SQUAD.watch; i++) {
    const p = generatePlayer(rng, { id: `p${next++}`, position: rng.pick(['GK', 'DF', 'DF', 'MF', 'MF', 'WG', 'FW', 'FW']), tier: 'Standard', ageRange: GEN.youthAge, area, usedNames: used });
    p.watch = true;
    watch.push(p);
  }
  assignRoles(rng, players, watch);
  return normaliseSquad({ players, watch, nextId: next });
}

// Milestone 10: a club's squad is as strong as its data says (REGIONAL_CLUBS strength: × every core stat).
export function opponentSquad({ seed, clubId }) {
  const rng = new Rng(`${seed}:opponent:${clubId}`);
  const { players } = generateSide(rng, { area: CLUB_AREAS[clubId] ?? 'fen' });
  for (const p of players) toClubLevel(p, clubId);
  assignRoles(rng, players, []);
  addClubStars(players, clubId, rng); // (M20) a Crown Premier club's 2–3 Stars
  return { players, watch: [], nextId: players.length + 1 };
}
// (M20) The overall a Crown Premier club's Star aims at: PRE01's around 105 … PRE06's around 125 (± a little).
export function starTarget(clubId, rng) {
  const i = PREMIER_CLUBS.findIndex((c) => c.id === clubId);
  const [lo, hi] = STAR.premier.overall;
  return Math.round(Math.min(hi, Math.max(lo, lo + ((hi - lo) * Math.max(0, i)) / 5 + rng.int(-3, 3))));
}
// (M20) Make a Premier club's best players of different positions its Stars (aged 23–30), up to its count.
export function addClubStars(players, clubId, rng) {
  const i = PREMIER_CLUBS.findIndex((c) => c.id === clubId);
  if (i < 0) return [];
  const want = STAR.premier.count[i] - players.filter((p) => p.star).length;
  const made = [];
  const used = new Set(players.filter((p) => p.star).map((p) => p.position));
  const ORDER = { FW: 0, WG: 1, MF: 2, DF: 3 }; // (Stars up front first: the forward, a winger, a playmaker)
  for (const p of players.filter((x) => !x.star && x.position !== 'GK').sort((a, b) => ORDER[a.position] - ORDER[b.position] || overall(b) - overall(a))) {
    if (made.length >= want) break;
    if (used.has(p.position)) continue;
    used.add(p.position);
    if (p.age < 23 || p.age > 30) p.age = rng.int(23, 29);
    makeStar(p, starTarget(clubId, rng));
    made.push(p);
  }
  return made;
}
// A generated player brought up to his club's level: × its strength on every core stat. (M17) Above the Regional League
// (County on) his hidden potential rises with him (the same gap above his overall, at most LIFT_CAP — never below his
// overall) and no stat passes 99;
// the Regional clubs' players stay exactly as M10 made them.
const LIFT_CAP = 90;
export function toClubLevel(p, clubId) {
  const k = clubById(clubId)?.strength ?? 1;
  if (k === 1) return p;
  const lift = !REGIONAL_CLUBS.some((c) => c.id === clubId);
  const before = lift ? overall(p) : 0;
  for (const key of Object.keys(p.stats)) p.stats[key] = Math.max(10, Math.round(p.stats[key] * k));
  if (lift) {
    for (const key of Object.keys(p.stats)) p.stats[key] = Math.min(statCap(p), p.stats[key]); // (M20: 99 — a Star is made after)
    const ovr = overall(p);
    const up = ovr - before;
    const high = Math.max(ovr, Math.min(LIFT_CAP, p.potential.high + up)); // (a rare star already past the cap keeps his level)
    p.potential = { low: Math.min(high, Math.max(ovr, p.potential.low + up)), high };
  }
  return p;
}

// Coverage (bible §5): at least 2 GK, 6 DEF, 5 MID/WNG and 5 FWD/WNG, each winger counted once.
export function coverage(players) {
  const c = { GK: 0, DF: 0, MF: 0, WG: 0, FW: 0 };
  for (const p of players) c[p.position]++;
  const ok = c.GK >= SQUAD.need.GK && c.DF >= SQUAD.need.DF && c.MF + c.WG >= SQUAD.need.midWing && c.FW + c.WG >= SQUAD.need.fwdWing && c.MF + c.WG + c.FW >= SQUAD.need.midWing + SQUAD.need.fwdWing;
  return { ...c, ok };
}

export function validateSquad(squad, founderId = null) {
  const errors = [];
  const all = [...(squad?.players ?? []), ...(squad?.watch ?? [])];
  if (squad?.players?.length !== SQUAD.size) errors.push(`senior squad has ${squad?.players?.length} players, not ${SQUAD.size}`);
  if (squad?.watch?.length !== SQUAD.watch) errors.push(`watch list has ${squad?.watch?.length}, not ${SQUAD.watch}`);
  const founders = squad.players.filter((p) => p.founder);
  if (founders.length !== 1) errors.push(`${founders.length} Founders in the squad`);
  if (founderId && founders[0]?.featuredId !== founderId) errors.push('the Founder is not the chosen one');
  if (!coverage(squad.players).ok) errors.push(`coverage ${JSON.stringify(coverage(squad.players))}`);
  const featured = new Set(FEATURED_NAMES);
  for (const p of all) {
    if (!['Standard', 'Rare'].includes(p.tier)) errors.push(`${p.name} is ${p.tier}`);
    if (!p.founder && (featured.has(p.name) || p.portrait)) errors.push(`${p.name}: a generated player with a Featured name or portrait`);
    if (!p.contract || p.contract.years < 1 || p.contract.years > 5 || !ROLES.includes(p.contract.role) || !(p.contract.salary > 0)) errors.push(`${p.name}: bad contract`);
    if (p.watch ? p.age < GEN.youthAge[0] || p.age > GEN.youthAge[1] : !p.founder && (p.age < GEN.seniorAge[0] || p.age > GEN.seniorAge[1])) errors.push(`${p.name}: age ${p.age}`);
    if (!(p.potential?.low <= p.potential?.high)) errors.push(`${p.name}: potential`);
  }
  if (new Set(all.map((p) => p.id)).size !== all.length) errors.push('ids repeat');
  if (new Set(all.map((p) => p.name)).size !== all.length) errors.push('names repeat');
  return errors;
}

export function ensureSquad(data) {
  if (data.squad?.players?.length) {
    normaliseSquad(data.squad); // (an M7 save: everyone starts at neutral fatigue / form / morale)
    return false;
  }
  data.squad = createStartingSquad({ founderId: data.club.founder.id, seed: data.seed, area: data.club.area });
  return true;
}
