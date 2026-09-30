// The club complex (Milestone 1, bible §6): a small grassroots ground on a hidden 14×18 grid, seen in the 3/4 dollhouse
// view (the art's angle). Plan space: col runs to the lower right on screen, row to the lower left; one tile is
// cellSize plan units. Grass, gravel paths and the fence are drawn by code; the three stations are their Batch 2 art.
export const COMPLEX = {
  cols: 14,
  rows: 18,
  cellSize: 100, // plan units per tile (pathing and walking speed)
  view: { halfW: 72, halfH: 36 }, // one tile draws as a 144 × 72 diamond (2:1, the series art angle)
  margin: 140, // grass round the ground (the camera stops at the ground plus this)
  fenceH: 64, // drawn height of the perimeter fence
  zoom: { min: 0.45, max: 1.4, start: 0.8 }, // start close in (style guide §2); 0.45 shows the ground's full width
  floorMaxPixels: 7e6, // the cached ground picture is capped at this many device pixels
};

// The three M1 stations (style guide §3 roles). fp = footprint on the grid (blocked: nobody walks through a station);
// door = the tile in front of it where the Founder stands to use it (always on a path, on the side facing the viewer).
// look: width = art width as a share of the footprint's diamond width; foot = where the footprint's front corner sits in
// the picture (share of its height from the top).
export const STATIONS = [
  {
    id: 'pitch',
    name: 'Starter Training Pitch',
    role: 'Maker',
    line: 'Where the squad trains and gets sharper.',
    art: 'facility_f01',
    fp: { col: 1, row: 1, w: 7, h: 7 },
    door: { col: 4, row: 8 },
    look: { width: 1.1, foot: 0.86 },
    busy: 'Training',
  },
  {
    id: 'office',
    name: 'Manager Office',
    role: 'Front desk',
    line: 'Club business, contracts and signings.',
    art: 'facility_f03',
    fp: { col: 9, row: 2, w: 4, h: 4 },
    door: { col: 10, row: 6 },
    look: { width: 1.1, foot: 0.9 },
    busy: 'Meeting the manager',
  },
  {
    id: 'scout',
    name: 'Scout Desk',
    role: 'Specialist desk',
    line: 'Scouting reports on players worth signing.',
    art: 'facility_f04',
    fp: { col: 2, row: 11, w: 4, h: 4 },
    door: { col: 3, row: 15 },
    look: { width: 1.1, foot: 0.86 },
    busy: 'Reading scout reports',
  },
];

// The Founder's loop: pitch → office → scout desk → pitch, a short stop at each (game seconds).
export const ROUTE = [
  { station: 'pitch', stay: 7, walking: 'Walking to the training pitch' },
  { station: 'office', stay: 4, walking: 'Walking to the manager office' },
  { station: 'scout', stay: 4, walking: 'Walking to the scout desk' },
];

// Gravel paths (col, row, w, h in tiles). They are the only walkable tiles, so the Founder keeps to them and never
// crosses the grass or a station.
export const PATHS = [
  { col: 1, row: 9, w: 12, h: 1 }, // the main path across the ground
  { col: 8, row: 1, w: 1, h: 17 }, // the long path from the gate to the back
  { col: 4, row: 8, w: 1, h: 1 }, // pitch gate
  { col: 10, row: 6, w: 1, h: 3 }, // office door
  { col: 3, row: 15, w: 1, h: 2 }, // scout desk door
  { col: 3, row: 16, w: 5, h: 1 }, // scout desk to the long path
];

// The entrance gate in the front fence (lower-left edge, row = rows), at this col.
export const GATE_COL = 8;

// Code-drawn trees (decoration: on grass, never tapped). r = crown size (share of a tile).
export const TREES = [
  { col: 12, row: 0.6, r: 0.62 },
  { col: 12.6, row: 11, r: 0.7 },
  { col: 11, row: 15.4, r: 0.58 },
  { col: 0.4, row: 16.5, r: 0.64 },
  { col: 6.2, row: 11.2, r: 0.5 },
];

// Milestone 6 props (decoration on grass, off every walkway, never tapped): col / row = where the picture's feet stand
// (plan tiles), h = drawn height at zoom 1 (logical px). table: a small code-drawn table under it. flag: the club flag
// (prop_25 in the club colour, with the badge on it).
export const PROPS = [
  { art: 'prop_01', col: 7.35, row: 10.7, h: 64 }, // cones on the grass by the crossroads, below the pitch
  { art: 'prop_02', col: 6.4, row: 8.62, h: 96 }, // free-kick mannequins
  { art: 'prop_03', col: 0.55, row: 6.2, h: 92 }, // the ball rack by the pitch
  { art: 'prop_11', col: 5.3, row: 15.55, h: 54, table: true }, // the scout's laptop by the Scout Desk
  { art: 'prop_12', col: 11.75, row: 6.7, h: 46, table: true }, // a contract folder by the Manager Office
  { art: 'prop_25', col: 9.55, row: 17.3, h: 230, flag: true }, // the club flag by the gate
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
};
