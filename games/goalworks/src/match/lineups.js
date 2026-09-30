// Match set-up (Milestone 3): the seed and both line-ups, fixed when the match is created and saved with it, so a
// reload never changes what happens. Test players only: plain generated names, flat stats (TEST_STAT) — no real squad.
//   createMatchSetup({ seed, home: { name, colour }, away: { name, colour } }) → setup (plain, save-friendly data)
//     colour: { hex, ink }. Each side gets 11 players in the 4-4-2 (keeper first) and a body picture that reads apart
//     from the other side's. A side may carry stat: n (Milestone 4 tests: one side's flat stats low, the other high).
//   Milestone 6: a side may carry colours: { primary, secondary } (palette ids) — then both kits come from the kit clash
//     check (src/match/kits.js: the away side changes to its second colour on a clash) and colour is the shirt it
//     wears; badge (the club's code-drawn badge) and crest (an opponent's crest art) ride along for the screens. Every
//     team gets kit = { shirt, shorts, keeper, change } (hexes; from colour alone when there are no palette colours).
//     None of this touches the seeded draws, so the same seed still gives the same match.
import { Rng } from '../../../../core/Rng.js';
import { FORMATION_442, FIRST_NAMES, SURNAMES, TEST_STAT, MATCH_ART } from '../../data/match.js';
import { COLOURS, colourById } from '../../data/setup.js';
import { matchKits, kitFromColour } from './kits.js';

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
    return { shirt: i + 1, name, role: slot.role, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, side.stat ?? TEST_STAT])) };
  });
  const colour = side.colour ?? colourById(side.colours?.primary);
  const t = { name: side.name, colour: { hex: colour.hex, ink: colour.ink ?? '#FFFFFF' }, players };
  if (side.colours) t.colours = { primary: side.colours.primary, secondary: side.colours.secondary };
  if (side.badge) t.badge = { ...side.badge };
  if (side.crest) t.crest = side.crest;
  return t;
}

const colourByHex = (hex) => COLOURS.find((c) => c.hex.toLowerCase() === hex.toLowerCase()) ?? null;

export function createMatchSetup({ seed, home, away }) {
  const rng = new Rng(`${seed}:lineups`);
  const used = new Set();
  const h = makeTeam(rng, home, used);
  const a = makeTeam(rng, away, used);
  if (h.colours && a.colours) {
    const k = matchKits(h.colours, a.colours);
    h.kit = k.home;
    a.kit = k.away;
    const ink = (hex) => colourByHex(hex)?.ink ?? '#FFFFFF';
    a.colour = { hex: k.away.shirt, ink: ink(k.away.shirt) };
  } else {
    // If the two colours are too close, the away side wears white rings so they read apart.
    if (colourGap(h.colour.hex, a.colour.hex) < 120) a.colour = { hex: '#F7F7F2', ink: '#222222' };
    h.kit = kitFromColour(h.colour.hex, [a.colour.hex]);
    a.kit = kitFromColour(a.colour.hex, [h.colour.hex, h.kit.keeper]);
  }
  h.body = bodyFor(h.colour.hex);
  a.body = bodyFor(a.colour.hex, h.body);
  h.keeper = MATCH_ART.keepers[0];
  a.keeper = MATCH_ART.keepers[1];
  return { seed: String(seed), home: h, away: a };
}
