// Club records with their previous holder (Milestone 27), and the trophy cabinet. Small on purpose (data imports only):
// transfers.js and (M28) the Secret Engine read them without pulling in the achievements system (no import cycle).
//   trophies(data) → the cabinet [{ key, name, art, count, years }]   distinctTrophies(data) → how many kinds (SEC-FAC-08)
import { TROPHY_ART } from '../../data/achievements.js';
import { ALL_CUPS, US } from '../../data/cups.js';
//   data.records = { id: { value, text, day, prev: { value, text, day } | null } }
//   noteRecord(data, id, value, text, day) → true when it is a new record (the old one becomes prev)
export function noteRecord(data, id, value, text, day) {
  if (!(value > 0)) return false;
  const R = (data.records ??= {});
  const cur = R[id];
  if (cur && value <= cur.value) return false;
  R[id] = { value, text, day, prev: cur ? { value: cur.value, text: cur.text, day: cur.day } : null };
  return true;
}

export function trophies(data) {
  const out = [];
  const promos = ['A10', 'A11', 'A12', 'A13'].filter((id) => data.achievements?.[id]).length;
  if (promos) out.push({ key: 'promotion', name: 'Promotion', art: TROPHY_ART.promotion, count: promos });
  if (data.achievements?.A15 || data.league?.crownTitle) out.push({ key: 'crown', name: 'Crown Premier title', art: TROPHY_ART.crown, count: 1 });
  for (const [id, C] of Object.entries(data.cups ?? {})) {
    const cup = ALL_CUPS[id];
    if (!cup || !(C?.wins > 0)) continue;
    const years = (C.history ?? []).filter((h) => h.champion === US).map((h) => h.year);
    out.push({ key: id, name: cup.name, art: TROPHY_ART[id] ?? cup.art, count: C.wins, years });
  }
  const awards = {};
  for (const s of data.verdicts?.seasons ?? []) for (const aw of s.awards ?? []) {
    const k = aw.id;
    awards[k] ??= { key: k, name: aw.name, art: TROPHY_ART[k] ?? aw.art, count: 0, years: [] };
    awards[k].count++;
    awards[k].years.push(s.year);
  }
  return [...out, ...Object.values(awards)];
}
export const distinctTrophies = (data) => trophies(data).length; // (M28 SEC-FAC-08 Museum Full)
