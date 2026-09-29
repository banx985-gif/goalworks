// Match set-up (Milestone 3): the seed and both line-ups, fixed when the match is created and saved with it, so a
// reload never changes what happens. Test players only: plain generated names, flat stats (TEST_STAT) — no real squad.
//   createMatchSetup({ seed, home: { name, colour }, away: { name, colour } }) → setup (plain, save-friendly data)
//     colour: { hex, ink }. Each side gets 11 players in the 4-4-2 (keeper first) and a body picture that reads apart
//     from the other side's.
import { Rng } from '../../../../core/Rng.js';
import { FORMATION_442, FIRST_NAMES, SURNAMES, TEST_STAT, MATCH_ART } from '../../data/match.js';

const STAT_KEYS = ['pace', 'passing', 'shooting', 'tackling', 'dribbling', 'keeping'];

function hexRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const colourGap = (a, b) => {
  const [r1, g1, b1] = hexRgb(a);
  const [r2, g2, b2] = hexRgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
};
// The body whose kit is nearest the club colour, and for the away side the nearest one that is not the home body.
function bodyFor(hex, not = null) {
  const list = MATCH_ART.outfield.filter((k) => k !== not);
  return list.reduce((best, k) => (colourGap(MATCH_ART.kitHex[k], hex) < colourGap(MATCH_ART.kitHex[best], hex) ? k : best), list[0]);
}

function makeTeam(rng, side, used) {
  const players = FORMATION_442.map((slot, i) => {
    let name;
    do name = `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`;
    while (used.has(name));
    used.add(name);
    return { shirt: i + 1, name, role: slot.role, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, TEST_STAT])) };
  });
  return { name: side.name, colour: { hex: side.colour.hex, ink: side.colour.ink ?? '#FFFFFF' }, players };
}

export function createMatchSetup({ seed, home, away }) {
  const rng = new Rng(`${seed}:lineups`);
  const used = new Set();
  const h = makeTeam(rng, home, used);
  const a = makeTeam(rng, away, used);
  // If the two colours are too close, the away side wears white rings so they read apart.
  if (colourGap(h.colour.hex, a.colour.hex) < 120) a.colour = { hex: '#F7F7F2', ink: '#222222' };
  h.body = bodyFor(h.colour.hex);
  a.body = bodyFor(a.colour.hex, h.body);
  h.keeper = MATCH_ART.keepers[0];
  a.keeper = MATCH_ART.keepers[1];
  return { seed: String(seed), home: h, away: a };
}
