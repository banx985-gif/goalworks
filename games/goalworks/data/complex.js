// The club complex (Milestone 1, bible §6; rebuilt for Milestone 12): the club's ground on a hidden grid, seen in the 3/4
// dollhouse view (the art's angle). Plan space: col runs to the lower right on screen, row to the lower left; one tile is
// cellSize plan units. Since Milestone 12 one tile is one bible facility unit (data/facilities.js), the ground's size is
// the stage the Club Rank has reached (data/facilities.js STAGES: 11×12 Regional ground first) and the facilities stand
// wherever Build Mode put them. Grass, the worn paths (from the gate to every facility), the fence and the trees are
// drawn by code; the facilities are their art at one scale.
export const COMPLEX = {
  cellSize: 200, // plan units per tile (pathing and walking speed)
  view: { halfW: 144, halfH: 72 }, // one tile draws as a 288 × 144 diamond (2:1, the series art angle)
  margin: 300, // grass round the ground (the camera stops at the ground plus this)
  fenceH: 64, // drawn height of the perimeter fence
  zoom: { min: 0.22, max: 1.4, start: 0.62 }, // start close in (style guide §2); pinch out to see the whole ground
  floorMaxPixels: 7e6, // the cached ground picture is capped at this many device pixels
};

// The Founder's loop: pitch → office → scout desk → pitch, a short stop at each (game seconds). The stops are the first
// Starter Training Pitch, Manager Office and Scout Desk on the ground (wherever they have been moved to).
export const ROUTE = [
  { station: 'pitch', def: 'F01', stay: 7, walking: 'Walking to the training pitch' },
  { station: 'office', def: 'F03', stay: 4, walking: 'Walking to the manager office' },
  { station: 'scout', def: 'F04', stay: 4, walking: 'Walking to the scout desk' },
];
export const BUSY = { F01: 'Training', F03: 'Meeting the manager', F04: 'Reading scout reports' };

// Code-drawn trees outside the fence (decoration, never tapped): every `every` tiles along the back two edges and the
// right-hand edge, nudged by `jitter`; r = crown size (share of a tile).
export const TREES = { every: 2.6, out: 0.75, r: 0.42, jitter: [0, 0.35, -0.25, 0.2, -0.3] };

// Milestone 6 props (decoration on grass, never tapped), now kept beside the facility they belong to: at = facility id
// (or 'gate'); u / v = plan tiles from that facility's back corner (u along col, v along row; outside its footprint),
// h = drawn height at zoom 1 (logical px). A prop is left out while a facility, a worn path or the gate is under it.
// table: a small code-drawn table under it. flag: the club flag (prop_25 in the club colour, with the badge on it).
export const PROPS = [
  { art: 'prop_01', at: 'F01', u: 5.35, v: 2.55, h: 64 }, // cones by the pitch
  { art: 'prop_02', at: 'F01', u: 5.4, v: 1.0, h: 96 }, // free-kick mannequins
  { art: 'prop_03', at: 'F01', u: 0.45, v: 3.4, h: 92 }, // the ball rack in front of the pitch
  { art: 'prop_11', at: 'F04', u: 2.45, v: 1.5, h: 54, table: true }, // the scout's laptop by the Scout Desk
  { art: 'prop_12', at: 'F03', u: -0.55, v: 0.65, h: 46, table: true }, // a contract folder by the Office
  { art: 'prop_25', at: 'gate', u: 1.45, v: 0.75, h: 230, flag: true }, // the club flag by the gate
];

// People: drawn height in logical px at zoom 1; feet = where the feet sit in the 512² picture (share of its height).
export const PERSON = { height: 200, feet: 0.93, speed: 260, tagSize: 28 };

export const LOOK = {
  outside: '#A9D883', // rough grass beyond the ground (paler, so the club's own mown grass stands out)
  grassA: '#6DB847',
  grassB: '#7CC353',
  grassLine: 'rgba(60, 110, 40, 0.18)',
  path: '#E6D3A8',
  pathEdge: '#C9B07E',
  fencePost: '#6B4F34',
  fenceRail: '#9B7A52',
  fenceShade: 'rgba(40, 70, 30, 0.18)',
  gate: '#F2EAD6',
  trunk: '#7A5533',
  crown: '#4FA244',
  crownLight: '#6BBE55',
  outline: '#2E3A2A',
  buildTint: 'rgba(255, 255, 255, 0.22)',
  buildLine: 'rgba(255, 255, 255, 0.7)',
  ok: 'rgba(80, 200, 90, 0.55)',
  okLine: '#2E8B3A',
  bad: 'rgba(230, 70, 60, 0.55)',
  badLine: '#B3261E',
  picked: '#FFD23F',
};

// The squad on the complex (Milestone 8, walking since Milestone 12). Each player walks to the place for his session
// today (data/facilities.js FOCUS_PLACES) and drills there; resting players go to the Recovery Pool / Clubhouse; on the
// day off and match days everyone rests. At most PEOPLE.max walkers on the ground at once (bible §41: 24, the Founder
// included). Drill spots are in footprint tiles (u along col, v along row) so they follow a pitch wherever it stands:
//   shuttle: runs between two cones along a lane (Attack, Technique, Physical, Set Pieces, the placeholders)
//   pairs:   partners facing each other, a slight lean (Passing, Defence)
//   keeper:  keepers in front of the goal, the rest lined up to shoot (Goalkeeping)
export const PEOPLE = { max: 24 };
export const DRILL = {
  lanes: [0.75, 1.25, 1.75, 2.25], // shuttle lanes (v) on a 5×3 pitch …
  laneFrom: 1.2,
  laneTo: 3.8, // … run along u
  pairs: [
    [{ u: 1.5, v: 0.75 }, { u: 1.5, v: 2.25 }],
    [{ u: 2.5, v: 0.75 }, { u: 2.5, v: 2.25 }],
    [{ u: 3.5, v: 0.75 }, { u: 3.5, v: 2.25 }],
  ],
  keeper: { u: 0.6, v: 1.5 },
  shooters: [{ u: 1.7, v: 1.0 }, { u: 1.9, v: 1.5 }, { u: 1.7, v: 2.0 }, { u: 2.4, v: 1.2 }, { u: 2.4, v: 1.8 }],
  kindOf: { passing: 'pairs', defence: 'pairs', goalkeeping: 'keeper' }, // everything else (not Rest) is a shuttle
  runSpeed: 1.1, // tiles a second at 1×
  height: 120, // drawn height of a figure at zoom 1 (logical px)
};
