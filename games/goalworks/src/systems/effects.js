// The one place the club's systems ask "how much X does the club get now?" (Milestone 13): the facilities built
// (src/systems/facilities.js bonus, Milestone 12) plus the research done (data/research.js node effects). Plain reads of
// the run save; nothing here changes it.
//   researchBonus(data, key) → the summed effect of every research node done
//   effect(data, key) → facilities + research (0 without either)
//   scoutingFac(data) → what scouting reads: { knowledgePct, extra, days, closerDays }
import { bonus as facilityBonus } from './facilities.js';
import { nodeById } from '../../data/research.js';

export function researchBonus(data, key) {
  const done = data?.research?.sys?.done;
  if (!done?.length) return 0;
  let v = 0;
  for (const id of done) for (const e of nodeById(id)?.effects ?? []) if (e.key === key) v += e.value;
  return v;
}

export const effect = (data, key) => facilityBonus(data, key) + researchBonus(data, key);

// Scouting (src/systems/scouting.js): the Video Room / research knowledge %, extra report players (Recruitment Office,
// research), and research's shorter report / closer-look days.
export const scoutingFac = (data) => ({
  knowledgePct: effect(data, 'scoutingPct'),
  extra: effect(data, 'scoutCandidates'),
  days: effect(data, 'scoutDays'),
  closerDays: effect(data, 'closerDays'),
});
