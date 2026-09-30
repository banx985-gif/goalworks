// The squad (Milestone 7, bible §5 / §11): the 18-player starting squad (the Founder + 17 generated Regional-quality
// players), the 3-person youth watch list, basic contracts, the best XI for a match, and an opponent's generated side.
//   createStartingSquad({ founderId, seed, area }) → squad { players[18], watch[3], nextId }
//   validateSquad(squad, founderId?) → [] or the rules it breaks (Node tests, and ?debug=1 on load)
//   bestXI(players) → 11 players in the 4-4-2's slot order (keeper first): the best of each slot's own position,
//                     playing someone out of position only when that position has nobody left
//   xiForMatch(players) → the 11 as match set-up players { name, shirt, stats } (stats: the engine's six numbers)
//   opponentSquad({ seed, clubId }) → a generated 18 of the same Regional level (names from the club's area)
//   ensureSquad(data) → true when it had to generate one (a Milestone 0–6 save: once, from its stored Founder)
import { Rng } from '../../../../core/Rng.js';
import { SQUAD, GEN, CONTRACT, ROLES, POSITION_ORDER, CLUB_AREAS, FEATURED_NAMES } from '../../data/players.js';
import { FORMATION_442 } from '../../data/match.js';
import { founderPlayer, generatePlayer, overall, matchStats } from './players.js';

// The 4-4-2's slots as positions to rate at: the wide midfield slots want wingers.
const SLOT_POS = FORMATION_442.map((s) => (s.role === 'MF' && (s.fx < 0.2 || s.fx > 0.8) ? 'WG' : s.role));
// Fill the scarce slots first: keeper, strikers, back four, centre midfield, then the wide slots.
const FILL_ORDER = [0, 9, 10, 1, 2, 3, 4, 6, 7, 5, 8];

// Who may fill a slot before anyone plays out of position: its own position (wide midfield: wingers or midfielders; up
// front: strikers, then wingers).
const NATURAL = { GK: ['GK'], DF: ['DF'], MF: ['MF'], WG: ['WG', 'MF'], FW: ['FW', 'WG'] };

export function bestXI(players) {
  const left = players.slice();
  const xi = new Array(11).fill(null);
  for (const i of FILL_ORDER) {
    const at = SLOT_POS[i];
    const pick = (ok) => {
      let best = -1;
      let bestR = -Infinity;
      left.forEach((p, j) => {
        if (!ok(p)) return;
        const r = overall(p, at);
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

export const xiForMatch = (players) => bestXI(players).map((p) => ({ id: p.id, name: p.name, shirt: p.shirt, position: p.position, stats: matchStats(p) }));

function contractFor(rng, p, role) {
  const s = CONTRACT.salary[p.tier] ?? CONTRACT.salary.Standard;
  const salary = Math.round(((s.base + s.perOvr * Math.max(0, overall(p) - 40)) * CONTRACT.roleBonus[role]) / 10) * 10;
  return { salary, years: rng.int(...CONTRACT.years[role]), role };
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
  return { players, watch, nextId: next };
}

export function opponentSquad({ seed, clubId }) {
  const rng = new Rng(`${seed}:opponent:${clubId}`);
  const { players } = generateSide(rng, { area: CLUB_AREAS[clubId] ?? 'fen' });
  assignRoles(rng, players, []);
  return { players, watch: [], nextId: players.length + 1 };
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
  if (data.squad?.players?.length) return false;
  data.squad = createStartingSquad({ founderId: data.club.founder.id, seed: data.seed, area: data.club.area });
  return true;
}
