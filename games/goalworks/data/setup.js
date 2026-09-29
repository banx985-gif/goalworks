// Club Setup lists (Milestone 0, bible §5). Plain data only: names and the home area are flavour (the area's towns feed
// Random club names), colours and badges are cosmetic, and the Founder perks are text until Milestone 7 applies them.
// Every club, town and person here is made up — no real club names, crests or players.

export const NAME_MAX = { club: 24, manager: 16 };

// Made-up club names for Random when no area town is used (bible §5: fictional club names only).
export const CLUB_NAMES = [
  'Banx Park Rangers', 'Kestrel Heath', 'Old Mill Athletic', 'Copper Lane Rovers', 'Harrowby Swifts',
  'Larkfield Town', 'Greystone Wanderers', 'Brookhollow United', 'Ashcombe Albion', 'Redbank Harriers',
  'Oakridge Borough', 'Willowmere Athletic', 'Stonebridge Rovers', 'Fernwood Town', 'Marlow Heath United',
  'Thornbury Swifts', 'Elmstead Wanderers', 'Quarry End Athletic', 'Linford Rangers', 'Cobble Street FC',
  'Hawksmoor Town', 'Sandy Lane United', 'Birchcroft Albion', 'Foxhollow Rovers', 'Kingsmead Harriers',
];

// Club-name endings used with a home-area town for Random ("Saltcliff Rovers").
export const CLUB_SUFFIXES = ['Town', 'United', 'Rovers', 'Athletic', 'Wanderers', 'Albion', 'Rangers', 'Harriers', 'Borough', 'Swifts', 'FC', 'Heath'];

// Manager first names for Random. Shown as "Club Manager <name>".
export const MANAGER_NAMES = [
  'Aaron', 'Priya', 'Owen', 'Leila', 'Marcus', 'Hana', 'Tomas', 'Grace', 'Idris', 'Mei', 'Callum', 'Amara',
  'Jonas', 'Sofia', 'Kofi', 'Elena', 'Rafi', 'Bea', 'Declan', 'Noor', 'Luca', 'Tess', 'Arjun', 'Freya',
];

// The 12 home areas (bible §5): fictionalised regional origins, flavour and name pools only. towns: made-up places
// for Random club names (and later, generated players' home towns).
export const HOME_AREAS = [
  { id: 'fen', name: 'Fenmarsh', line: 'Flat fen country, big skies and dykes', towns: ['Fenmarsh', 'Reedham Cross', 'Dyke End', 'Wetherby Fen'] },
  { id: 'border', name: 'Borderhill', line: 'Rough border hills and old castles', towns: ['Borderhill', 'Castleford Gap', 'Kirkhope', 'Tarnside'] },
  { id: 'moor', name: 'Highmoor', line: 'Wild moorland villages and stone walls', towns: ['Highmoor', 'Heatherby', 'Stonegill', 'Crag Top'] },
  { id: 'valley', name: 'Riverdale Valleys', line: 'Mining and chapel towns down green valleys', towns: ['Riverdale', 'Pontmere', 'Glynbrook', 'Coalbrook'] },
  { id: 'coast', name: 'Saltcliff Coast', line: 'Harbour towns, piers and sea air', towns: ['Saltcliff', 'Gullhaven', 'Portwick', 'Seabright'] },
  { id: 'mid', name: 'Midshire', line: 'Busy central towns, canals and workshops', towns: ['Midshire', 'Canal Heath', 'Brackley Cross', 'Forgeton'] },
  { id: 'cape', name: 'Westmoor Cape', line: 'Cliffs, coves and far-west fishing villages', towns: ['Westmoor', 'Covehaven', 'Tinmouth', 'Penwarra'] },
  { id: 'lakes', name: 'Northfell Lakes', line: 'Lakes, fells and slate villages', towns: ['Northfell', 'Mereside', 'Slatebeck', 'Fellgate'] },
  { id: 'mills', name: 'Redrose Mills', line: 'Mill towns, terraces and chimneys', towns: ['Redrose', 'Millbridge', 'Loomley', 'Spindleton'] },
  { id: 'dales', name: 'Whitedale Ridings', line: 'Dales farms and market towns', towns: ['Whitedale', 'Ridings Cross', 'Barnsdale', 'Wolds End'] },
  { id: 'estuary', name: 'Estuary Flats', line: 'Marsh towns and a wide river mouth', towns: ['Estuary', 'Mudford', 'Tidewell', 'Oysterham'] },
  { id: 'iron', name: 'Ironvale', line: 'Steelworks, bridges and furnace towns', towns: ['Ironvale', 'Anvil Row', 'Smeltham', 'Bridgeworks'] },
];
export const areaById = (id) => HOME_AREAS.find((a) => a.id === id) ?? HOME_AREAS[0];

// The safe kit palette (bible §5 "Club colours"). ink = the colour text / a symbol takes when drawn on it.
export const COLOURS = [
  { id: 'green', name: 'Pitch Green', hex: '#2E8B3E', ink: '#FFFFFF' },
  { id: 'royal', name: 'Royal Blue', hex: '#2154B8', ink: '#FFFFFF' },
  { id: 'sky', name: 'Sky Blue', hex: '#6CB8E8', ink: '#16324A' },
  { id: 'red', name: 'Red', hex: '#D0322B', ink: '#FFFFFF' },
  { id: 'claret', name: 'Claret', hex: '#7A1F3D', ink: '#FFFFFF' },
  { id: 'orange', name: 'Orange', hex: '#F2862B', ink: '#2A1A0A' },
  { id: 'gold', name: 'Gold', hex: '#F2C230', ink: '#2A2100' },
  { id: 'purple', name: 'Purple', hex: '#6A3FB5', ink: '#FFFFFF' },
  { id: 'navy', name: 'Navy', hex: '#1B2A4A', ink: '#FFFFFF' },
  { id: 'black', name: 'Black', hex: '#222222', ink: '#FFFFFF' },
  { id: 'white', name: 'White', hex: '#F7F7F2', ink: '#222222' },
  { id: 'teal', name: 'Teal', hex: '#1E9C96', ink: '#FFFFFF' },
];
export const colourById = (id) => COLOURS.find((c) => c.id === id) ?? COLOURS[0];

// The 12 original badge shield shapes and 12 symbols (bible §5 "Badge template"). Drawn in code (src/ui/clubArt.js)
// until the badge art (custom_01–12) is wired in.
export const BADGE_SHAPES = [
  { id: 'classic', name: 'Classic' },
  { id: 'round', name: 'Round' },
  { id: 'tall', name: 'Tall' },
  { id: 'split', name: 'Split' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'circle', name: 'Circle' },
  { id: 'heater', name: 'Heater' },
  { id: 'castle', name: 'Castle' },
  { id: 'hex', name: 'Hexagon' },
  { id: 'pennant', name: 'Pennant' },
  { id: 'oval', name: 'Oval' },
  { id: 'banner', name: 'Banner' },
];
export const BADGE_SYMBOLS = [
  { id: 'ball', name: 'Ball' },
  { id: 'crown', name: 'Crown' },
  { id: 'star', name: 'Star' },
  { id: 'tower', name: 'Tower' },
  { id: 'bridge', name: 'Bridge' },
  { id: 'bolt', name: 'Bolt' },
  { id: 'bird', name: 'Bird' },
  { id: 'tree', name: 'Oak' },
  { id: 'anchor', name: 'Anchor' },
  { id: 'wheel', name: 'Wheel' },
  { id: 'key', name: 'Key' },
  { id: 'wave', name: 'Waves' },
];
export const shapeById = (id) => BADGE_SHAPES.find((s) => s.id === id) ?? BADGE_SHAPES[0];
export const symbolById = (id) => BADGE_SYMBOLS.find((s) => s.id === id) ?? BADGE_SYMBOLS[0];

export const POSITIONS = {
  GK: { name: 'Goalkeeper', colour: '#E0A21B' },
  DF: { name: 'Defender', colour: '#2F6FD0' },
  MF: { name: 'Midfielder', colour: '#2E8B57' },
  WG: { name: 'Winger', colour: '#D2447E' },
  FW: { name: 'Forward', colour: '#C8402F' },
};

// Choose Founding Player (bible §5): the five Standard featured players. art = their Batch 1 picture; face = the head
// and shoulders crop of it (fractions of the picture) used for portraits. Perks are text until Milestone 7: effects
// hold the numbers for then (live: false = its system is not built yet).
export const FOUNDERS = [
  {
    id: 'GK01', name: 'Eli Mercer', position: 'GK', trait: 'Safe Hands', art: 'player_gk01', face: { x: 0.21, y: 0.02, w: 0.5, h: 0.5 },
    perk: {
      name: 'Founder Keeper', text: '+5% GK development; +3% team confidence after a clean sheet',
      effects: [{ key: 'devGK', value: 5, live: false }, { key: 'cleanSheetConfidencePct', value: 3, live: false }],
    },
  },
  {
    id: 'DF01', name: 'Mason Hale', position: 'DF', trait: 'Hard Tackler', art: 'player_df01', face: { x: 0.32, y: 0.02, w: 0.5, h: 0.5 },
    perk: {
      name: 'Founder Defender', text: '+5% defending development; Familiar Back Line grows 5% faster',
      effects: [{ key: 'devDEF', value: 5, live: false }, { key: 'familiarBackLinePct', value: 5, live: false }],
    },
  },
  {
    id: 'MF01', name: 'Milo Hart', position: 'MF', trait: 'Simple Passer', art: 'player_mf01', face: { x: 0.27, y: 0.02, w: 0.5, h: 0.5 },
    perk: {
      name: 'Founder Playmaker', text: '+5% passing/technique development; tactical familiarity +3%',
      effects: [{ key: 'devPAS', value: 5, live: false }, { key: 'tacticalFamiliarityPct', value: 3, live: false }],
    },
  },
  {
    id: 'WG01', name: 'Zoe Lane', position: 'WG', trait: 'Quick Feet', art: 'player_wg01', face: { x: 0.26, y: 0.02, w: 0.52, h: 0.52 },
    perk: {
      name: 'Founder Winger', text: '+5% pace/technique development; fan excitement +3% after wins',
      effects: [{ key: 'devPAC', value: 5, live: false }, { key: 'winExcitementPct', value: 3, live: false }],
    },
  },
  {
    id: 'FW01', name: 'Leo Mercer', position: 'FW', trait: 'Poacher', art: 'player_fw01', face: { x: 0.36, y: 0.02, w: 0.5, h: 0.5 },
    perk: {
      name: 'Founder Striker', text: '+5% attack development; finishing drill XP +5%',
      effects: [{ key: 'devATT', value: 5, live: false }, { key: 'finishingDrillXpPct', value: 5, live: false }],
    },
  },
];
export const founderById = (id) => FOUNDERS.find((f) => f.id === id) ?? null;

// The chosen founder's permanent run-history flag.
export const FOUNDER_FLAG = 'foundingPlayer';

// The setup lists checked with core DataValidator (Node test, and at boot with ?debug=1).
export function validateSetup(v) {
  v.check(new Set(CLUB_NAMES).size === CLUB_NAMES.length, 'club names must be unique');
  v.check(CLUB_NAMES.every((n) => n.length <= NAME_MAX.club), `club names must fit ${NAME_MAX.club} letters`);
  v.check(new Set(MANAGER_NAMES).size === MANAGER_NAMES.length, 'manager names must be unique');
  v.check(MANAGER_NAMES.every((n) => n.length <= NAME_MAX.manager), `manager names must fit ${NAME_MAX.manager} letters`);
  v.check(HOME_AREAS.length === 12, 'there must be 12 home areas');
  v.uniqueIds('home area', HOME_AREAS);
  for (const a of HOME_AREAS) {
    v.check(a.name && a.line && a.towns?.length >= 3, `home area ${a.id} needs a name, a line and 3+ towns`);
    for (const t of a.towns) for (const s of CLUB_SUFFIXES) v.check(`${t} ${s}`.length <= NAME_MAX.club, `"${t} ${s}" is longer than ${NAME_MAX.club}`);
  }
  v.uniqueIds('colour', COLOURS);
  for (const c of COLOURS) v.check(/^#[0-9A-F]{6}$/i.test(c.hex) && /^#[0-9A-F]{6}$/i.test(c.ink), `colour ${c.id} needs hex and ink`);
  v.check(BADGE_SHAPES.length === 12, 'there must be 12 badge shapes');
  v.uniqueIds('badge shape', BADGE_SHAPES);
  v.check(BADGE_SYMBOLS.length >= 1, 'there must be badge symbols');
  v.uniqueIds('badge symbol', BADGE_SYMBOLS);
  v.check(FOUNDERS.length === 5, 'there must be five Founders');
  v.uniqueIds('founder', FOUNDERS);
  for (const f of FOUNDERS) {
    v.ref(`founder ${f.id}`, 'position', f.position, new Set(Object.keys(POSITIONS)));
    v.check(f.trait && f.perk?.name && f.perk.text?.includes('+5%'), `founder ${f.id} needs a trait and a +5% perk`);
    v.check(/^player_(gk|df|mf|wg|fw)\d\d$/.test(f.art), `founder ${f.id} art key`);
  }
  return v;
}
