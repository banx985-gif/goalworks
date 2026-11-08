// The Secret Engine's notes from other systems (Milestone 28). Tiny on purpose (no imports): transfers.js and league.js
// note a signing, a scout report or a promotion here without pulling in the secrets engine (no import cycle). They write
// the run's M28 counters (data.secrets.track.m28, made by src/systems/secretMeasures.js normaliseM28); a run without them
// yet (an old save before its first secrets day) simply isn't noted.
//   areaOf(p) — a player's home area (one of the 12): his own, else a steady one from his id (players from before M28)
//   noteScouted(data, players) — a finished scout report: each player's home area counts (SEC-FAC-06)
//   noteSigning(data, p, scouted) — a player signed: this tier's signings (SEC-BEH-04, SEC-NGP-01); a scouted one (SEC-FAC-06)
//   notePromotion(data, fromTier) — promoted out of a tier: was it without a signing?
export const AREAS = ['fen', 'border', 'moor', 'valley', 'coast', 'mid', 'cape', 'lakes', 'mills', 'dales', 'estuary', 'iron'];
export function areaOf(p) {
  if (p?.area && AREAS.includes(p.area)) return p.area;
  let h = 2166136261;
  for (const ch of String(p?.id ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return AREAS[h % AREAS.length];
}
const M28 = (data) => data.secrets?.track?.m28 ?? null;
export function noteScouted(data, players) {
  const M = M28(data);
  if (!M) return;
  for (const p of players) {
    const a = areaOf(p);
    if (!M.scoutedAreas.includes(a)) M.scoutedAreas.push(a);
  }
}
export function noteSigning(data, p, scouted = false) {
  const M = M28(data);
  if (!M) return;
  M.tierSignings++;
  if (scouted) M.signedScouted++;
}
export function notePromotion(data, fromTier) {
  const M = M28(data);
  if (!M) return;
  if (M.tierSignings === 0) {
    M.promotedNoSigning = 1;
    if (fromTier === 'regional') M.regionalNoSigning = 1;
  }
  M.tierSignings = 0;
}
