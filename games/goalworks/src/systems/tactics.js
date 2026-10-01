// The club's tactics (Milestone 9, bible §15): the chosen formation, the seven team instructions, a player role per slot
// (kept per formation), any players picked by hand for slots, and tactical familiarity per formation + build style pair.
// Plain functions over the run save (data.tactics); the match engine reads what teamSide() hands it.
//   normaliseTactics(data)            data.tactics in the M9 shape — an older save (none, or the M5 commands object) starts
//                                     in 4-4-2 Balanced, its commands carried across, familiar with that pair only
//   pair(data) → '442:balanced'       familiarity(data, pairKey?) → 0–100
//   familiarityDay(data, kind)        a club day: the chosen pair grows on training days, every other pair fades
//                                     (Milestone 12: the Tactics Board Room's +% on every gain; Milestone 13: research's
//                                     +% on every gain and a slower fade)
//   familiarityMatch(data, pair)      after a match played in that pair
//   rolesOf(data, formation?) → [role per slot]      setRole(data, slot, role)
//   lineupOf(data, formation?) → [playerId | null per slot]   placePlayer(data, slot, playerId)   clearLineup(data)
//   teamSide(data) → { formation, tactics, roles, players (the XI for the match), familiarity }
//   opponentSide(clubId) → { formation, tactics } from data/tactics.js CLUB_TACTICS
import { TACTICS } from '../../data/match.js';
import { FORMATIONS, formationById, DEFAULT_FORMATION, rolesForSlot, FAMILIARITY, pairKey, CLUB_TACTICS } from '../../data/tactics.js';
import { tacticsOf } from '../match/matchWorld.js';
import { xiForMatch } from './squad.js';
import { effect as bonus } from './effects.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = (v) => Math.round(v * 100) / 100; // (two decimals: the daily fade is 0.15)

export function normaliseTactics(data) {
  const t = data.tactics;
  if (t && t.v === 9) return t;
  // (before Milestone 9 data.tactics was the M5 commands { mentality, pressing, tempo, width })
  data.tactics = {
    v: 9,
    formation: DEFAULT_FORMATION,
    instr: tacticsOf(t ?? {}),
    roles: {}, // formation id → { slot: roleId } (only the slots changed from the default)
    lineup: {}, // formation id → { slot: playerId } (players placed by hand)
    familiarity: { [FAMILIARITY.start.pair]: FAMILIARITY.start.value },
  };
  return data.tactics;
}

export const pair = (data) => {
  const t = normaliseTactics(data);
  return pairKey(t.formation, t.instr.build);
};
export const familiarity = (data, key = pair(data)) => normaliseTactics(data).familiarity[key] ?? 0;

export function familiarityDay(data, kind) {
  const t = normaliseTactics(data);
  const now = pair(data);
  const fade = FAMILIARITY.fade * Math.max(0, 1 + bonus(data, 'familiarityFadePct') / 100); // (M13) research fades it slower
  for (const k of Object.keys(t.familiarity)) if (k !== now) t.familiarity[k] = round1(Math.max(0, t.familiarity[k] - fade));
  // (M12) the Tactics Board Room: familiarity grows faster
  if (kind === 'train') t.familiarity[now] = round1(clamp((t.familiarity[now] ?? 0) + FAMILIARITY.training * (1 + bonus(data, 'familiarityPct') / 100), 0, 100));
  for (const k of Object.keys(t.familiarity)) if (t.familiarity[k] <= 0 && k !== now) delete t.familiarity[k];
}
export function familiarityMatch(data, key) {
  const t = normaliseTactics(data);
  t.familiarity[key] = round1(clamp((t.familiarity[key] ?? 0) + FAMILIARITY.match * (1 + bonus(data, 'familiarityPct') / 100), 0, 100));
}

export function rolesOf(data, formation = normaliseTactics(data).formation) {
  const t = normaliseTactics(data);
  const set = t.roles[formation] ?? {};
  return formationById(formation).slots.map((sl, i) => (rolesForSlot(sl).includes(set[i]) ? set[i] : sl.role));
}
export function setRole(data, slot, role) {
  const t = normaliseTactics(data);
  const sl = formationById(t.formation).slots[slot];
  if (!sl || !rolesForSlot(sl).includes(role)) return false;
  (t.roles[t.formation] ??= {})[slot] = role;
  if (role === sl.role) delete t.roles[t.formation][slot];
  return true;
}
export function setFormation(data, id) {
  if (!FORMATIONS.some((f) => f.id === id)) return false;
  normaliseTactics(data).formation = id;
  return true;
}
export function setInstruction(data, key, value) {
  if (!TACTICS[key]?.options.includes(value)) return false;
  normaliseTactics(data).instr[key] = value;
  return true;
}

// Hand-picked players, per formation: { slot: playerId }. Placing a player who is in another slot swaps them.
export function lineupOf(data, formation = normaliseTactics(data).formation) {
  const t = normaliseTactics(data);
  const set = t.lineup[formation] ?? {};
  const ids = new Set(data.squad?.players.map((p) => p.id) ?? []);
  return formationById(formation).slots.map((_, i) => (ids.has(set[i]) ? set[i] : null));
}
export function placePlayer(data, slot, playerId) {
  const t = normaliseTactics(data);
  const f = t.formation;
  const cur = { ...(t.lineup[f] ?? {}) };
  // the XI as it would play now: to swap properly, fill the empty slots with the auto-picks first
  const auto = xiIds(data);
  for (let i = 0; i < auto.length; i++) cur[i] ??= auto[i];
  const from = Object.keys(cur).find((k) => cur[k] === playerId);
  if (from != null) cur[from] = cur[slot]; // swap with whoever was in the slot
  cur[slot] = playerId;
  t.lineup[f] = cur;
  return true;
}
export function clearLineup(data) {
  const t = normaliseTactics(data);
  delete t.lineup[t.formation];
}
// The XI's ids in slot order: hand-picked players where set, the best available by position for the rest.
export function xiIds(data) {
  const t = normaliseTactics(data);
  return xiForMatch(data.squad.players, { formation: t.formation, lineup: lineupOf(data) }).map((p) => p.id);
}

export function teamSide(data) {
  const t = normaliseTactics(data);
  return {
    formation: t.formation,
    tactics: { ...t.instr },
    roles: rolesOf(data),
    players: xiForMatch(data.squad.players, { formation: t.formation, lineup: lineupOf(data) }),
    familiarity: { ...t.familiarity },
  };
}

export function opponentSide(clubId) {
  const c = CLUB_TACTICS[clubId] ?? { formation: DEFAULT_FORMATION };
  const { formation = DEFAULT_FORMATION, ...instr } = c;
  return { formation, tactics: tacticsOf(instr) };
}
