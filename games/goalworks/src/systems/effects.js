// The one place the club's systems ask "how much X does the club get now?" (Milestone 13): the facilities built
// (src/systems/facilities.js bonus, Milestone 12) plus the research done (data/research.js node effects) plus (Milestone 14)
// the support staff hired (src/systems/staff.js staffBonus). Plain reads of the run save; nothing here changes it.
//   researchBonus(data, key) → the summed effect of every research node done
//   effect(data, key) → facilities + research + staff (0 without any)
//   scoutingFac(data) → what scouting reads: { knowledgePct, extra, days, closerDays, scoutName, rareFind, localNarrow }
//   (M14) the Analyst's match preparation:
//   tacticalPrep(data) → the % match preparation (facilities + research + staff; 0 without an Analyst)
//   preparedFamiliarity(data, map) → the familiarity map the match starts with (each pair × (1 + prep %), at most 100)
//   settleSec(data) → match seconds a Manage change takes to settle (SETTLE.sec, shorter with Live Read)
//   weaknessClue(data, opponentId) → { by, text } for Match Setup (with Match Notes), else null
//   (M20b) the Works Gods add to the same query (src/systems/gods.js godBonus: Zip's recovery, Kaching's income; Bolt is
//   a hired staff member) · upgradeDays(data, days) → a facility upgrade's days with Bolt's upgradeFasterPct (at least 1)
//   (M23) the active sponsors' benefits add to the same query (src/systems/sponsors.js sponsorBonus)
//   (M24) and the stadium's expansion pieces (src/systems/stadium.js stadiumBonus)
import { bonus as facilityBonus } from './facilities.js';
import { nodeById } from '../../data/research.js';
import { staffBonus, scoutName, inRole } from './staff.js';
import { SETTLE, WEAKNESS_CLUES } from '../../data/staff.js';
import { CLUB_TACTICS } from '../../data/tactics.js';
import { godBonus } from './gods.js';
import { sponsorBonus } from './sponsors.js';
import { stadiumBonus } from './stadium.js';

export function researchBonus(data, key) {
  const done = data?.research?.sys?.done;
  if (!done?.length) return 0;
  let v = 0;
  for (const id of done) for (const e of nodeById(id)?.effects ?? []) if (e.key === key) v += e.value;
  return v;
}

export const effect = (data, key) => facilityBonus(data, key) + researchBonus(data, key) + staffBonus(data, key) + godBonus(data, key) + sponsorBonus(data, key) + stadiumBonus(data, key); // (M24: the stadium's expansion pieces)
export const upgradeDays = (data, days) => (days > 0 ? Math.max(1, Math.round(days * Math.max(0, 1 - effect(data, 'upgradeFasterPct') / 100))) : days);

// Scouting (src/systems/scouting.js): the Video Room / research knowledge %, extra report players (Recruitment Office,
// research, the Scout's Networker), and research's shorter report / closer-look days. (M14) the hired scout: their name
// (null: no scout — reports can't be sent), Hidden Gem's rare-player chance, Local Eye's narrower local potential.
export const scoutingFac = (data) => ({
  knowledgePct: effect(data, 'scoutingPct'),
  extra: effect(data, 'scoutCandidates'),
  days: effect(data, 'scoutDays'),
  closerDays: effect(data, 'closerDays'),
  scoutName: scoutName(data),
  rareFind: effect(data, 'rareFindPct'),
  localNarrow: Math.min(100, effect(data, 'localPotentialPct')) / 100,
});

export const tacticalPrep = (data) => (inRole(data, 'AN') ? effect(data, 'tacticalPrepPct') : 0);
export function preparedFamiliarity(data, map) {
  const k = 1 + tacticalPrep(data) / 100;
  if (k === 1 || !map) return map;
  return Object.fromEntries(Object.entries(map).map(([pair, v]) => [pair, Math.min(100, Math.round(v * k * 100) / 100)]));
}
export const settleSec = (data) => Math.round(SETTLE.sec * Math.max(0, 1 - effect(data, 'settleFasterPct') / 100) * 100) / 100;
export function weaknessClue(data, opponentId) {
  if (!effect(data, 'weaknessClue')) return null;
  const t = CLUB_TACTICS[opponentId] ?? {};
  const rule = WEAKNESS_CLUES.find((r) => Object.entries(r.when).every(([k, v]) => t[k] === v));
  return { by: inRole(data, 'AN')?.name ?? 'Analyst', text: rule.text };
}
