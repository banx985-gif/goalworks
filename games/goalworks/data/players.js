// Players (Milestone 7, bible §5 / §9 / §10 / §11). Plain data; the rules live in src/systems/players.js and squad.js.
//
// Five core stats ATK / TEC / PAS / DEF / PHY (bible §9). Everything else is worked out from them:
//   DERIVED  ten ratings, each a weighted sum of the core stats (GOALKEEPING is only a keeper's real skill: outfield
//            players get a fraction of it)
//   OVERALL  positional, not an average: each position weighs the derived ratings it needs, so a keeper can be elite
//            with low ATK and a winger with low DEF
//   MATCH    the six numbers the match engine reads (pace, passing, shooting, tackling, dribbling, keeping — the Milestone 3
//            engine, tuned around 50) from the derived ratings
// All the weights are here so they can be tuned in one place.

export const CORE = ['ATK', 'TEC', 'PAS', 'DEF', 'PHY'];
export const CORE_NAMES = { ATK: 'Attack', TEC: 'Technique', PAS: 'Passing', DEF: 'Defending', PHY: 'Physical' };
export const POSITION_ORDER = ['GK', 'DF', 'MF', 'WG', 'FW'];

export const DERIVED = {
  Pace: { PHY: 0.55, ATK: 0.3, TEC: 0.15 },
  Finishing: { ATK: 0.7, TEC: 0.2, PHY: 0.1 },
  Dribbling: { TEC: 0.55, ATK: 0.3, PHY: 0.15 },
  Vision: { PAS: 0.7, TEC: 0.3 },
  Tackling: { DEF: 0.75, PHY: 0.25 },
  Heading: { PHY: 0.45, DEF: 0.3, ATK: 0.25 },
  Stamina: { PHY: 0.8, DEF: 0.1, PAS: 0.1 },
  Goalkeeping: { DEF: 0.6, TEC: 0.25, PHY: 0.15 },
  'Set Pieces': { TEC: 0.5, PAS: 0.35, ATK: 0.15 },
  Composure: { TEC: 0.4, PAS: 0.3, DEF: 0.15, PHY: 0.15 },
};
export const DERIVED_KEYS = Object.keys(DERIVED);
export const OUTFIELD_KEEPING = 0.35; // an outfield player's Goalkeeping is this share of the formula

export const OVERALL = {
  GK: { Goalkeeping: 0.7, Composure: 0.12, Vision: 0.08, Stamina: 0.05, Heading: 0.05 },
  DF: { Tackling: 0.4, Heading: 0.2, Composure: 0.15, Pace: 0.15, Vision: 0.1 },
  MF: { Vision: 0.35, Composure: 0.2, Dribbling: 0.15, Stamina: 0.15, Tackling: 0.15 },
  WG: { Pace: 0.35, Dribbling: 0.3, Finishing: 0.15, Vision: 0.1, Stamina: 0.1 },
  FW: { Finishing: 0.45, Composure: 0.15, Dribbling: 0.15, Pace: 0.15, Heading: 0.1 },
};
// Playing out of position (best XI): a player's overall at the slot's position, times this.
export const OUT_OF_POSITION = { near: 0.93, far: 0.8, keeper: 0.45 };
export const NEAR = { DF: ['MF'], MF: ['DF', 'WG'], WG: ['MF', 'FW'], FW: ['WG'] };

export const MATCH = {
  pace: { Pace: 1 },
  passing: { Vision: 0.7, Composure: 0.3 },
  shooting: { Finishing: 0.8, Composure: 0.2 },
  tackling: { Tackling: 1 },
  dribbling: { Dribbling: 0.8, Composure: 0.2 },
  keeping: { Goalkeeping: 1 },
};

// The five Founders as real players (bible §9 rows exactly: tier, level, ATK/TEC/PAS/DEF/PHY, trait). Their Founder perk
// is data/setup.js FOUNDERS[].perk (effects come with training in Milestone 8). Age: they are young featured players.
export const FOUNDER_PLAYERS = {
  GK01: { name: 'Eli Mercer', position: 'GK', tier: 'Standard', level: 1, stats: { ATK: 26, TEC: 42, PAS: 38, DEF: 58, PHY: 54 }, trait: 'Safe Hands', age: 21 },
  DF01: { name: 'Mason Hale', position: 'DF', tier: 'Standard', level: 1, stats: { ATK: 42, TEC: 44, PAS: 39, DEF: 61, PHY: 58 }, trait: 'Hard Tackler', age: 20 },
  MF01: { name: 'Milo Hart', position: 'MF', tier: 'Standard', level: 1, stats: { ATK: 44, TEC: 55, PAS: 60, DEF: 42, PHY: 52 }, trait: 'Simple Passer', age: 20 },
  WG01: { name: 'Zoe Lane', position: 'WG', tier: 'Standard', level: 1, stats: { ATK: 61, TEC: 55, PAS: 48, DEF: 32, PHY: 54 }, trait: 'Quick Feet', age: 19 },
  FW01: { name: 'Leo Mercer', position: 'FW', tier: 'Standard', level: 1, stats: { ATK: 52, TEC: 56, PAS: 44, DEF: 28, PHY: 57 }, trait: 'Poacher', age: 21 },
};

// The 50 Featured Players' names (art list Batch 1): a generated player never takes one, nor one of their surnames.
export const FEATURED_NAMES = [
  'Eli Mercer', 'Noah Pike', 'Theo Ward', 'Jai Foster', 'Luca Webb', 'Finn Cross', 'Rafi Stone', 'Cass Vale', 'Marco Crown', 'Zero Vale',
  'Mason Hale', 'Arun Reed', 'Ben Cole', 'Niko Grant', 'Joel Moss', 'Oscar Lane', 'Dax Stone', 'Kei North', 'Rex Barr', 'Atlas Venn',
  'Milo Hart', 'Tariq Bell', 'Kai Rowan', 'Emi Ward', 'Soren Vale', 'Priya Nash', 'Juno Park', 'Ren Mori', 'Silas Quill', 'Nova Rune',
  'Zoe Lane', 'Mae Cross', 'Ari Quinn', 'Lena Pike', 'Cleo West', 'Hana Reed', 'Tess Voss', 'Yara Flux', 'Sora Jet', 'Vega Rush',
  'Leo Mercer', 'Sam Vale', 'Nia Hart', 'Jax Cole', 'Talia North', 'Omar Flint', 'Cass Stone', 'Aria Knox', 'Rex Vantage', 'Orion Zero',
];

// Generated players (bible §10). A Standard level-1 player of each position starts from BASE (the §9 Standard rows), each
// level adds LEVEL_STEP of it, Rare adds RARE_BONUS, then every stat is jittered by up to ±JITTER.
export const GEN = {
  base: {
    GK: { ATK: 27, TEC: 44, PAS: 39, DEF: 59, PHY: 55 },
    DF: { ATK: 43, TEC: 45, PAS: 40, DEF: 62, PHY: 59 },
    MF: { ATK: 45, TEC: 56, PAS: 61, DEF: 43, PHY: 53 },
    WG: { ATK: 63, TEC: 56, PAS: 49, DEF: 33, PHY: 55 },
    FW: { ATK: 53, TEC: 57, PAS: 45, DEF: 29, PHY: 58 },
  },
  levelStep: 0.06,
  rareBonus: 0.04,
  jitter: 0.08,
  // Regional quality: Standard or Rare only (§5: no generated starter above Rare)
  rareChance: 0.18,
  levels: { Standard: [1, 3], Rare: [4, 5] },
  seniorAge: [18, 34], // the ordinary transfer pool (§10)
  youthAge: [15, 18], // the reserve / youth watch list (academy intake ages)
  // potential (hidden, a range): about growthPerYear per year under peakAge, the range ±spread
  potential: { peakAge: 27, growthPerYear: [1.0, 2.2], spread: 4, cap: { Standard: 74, Rare: 84 } },
};

// Traits a generated player may have (bible §14 Standard / Rare abilities that fit the position).
export const TRAITS = {
  GK: { Standard: ['Safe Hands', 'Calm Under Pressure'], Rare: ['Sweeper Keeper'] },
  DF: { Standard: ['Hard Tackler', 'Marker', 'Calm Under Pressure'], Rare: ['Aerial Strong', 'Cover Defender', 'Leader'] },
  MF: { Standard: ['Simple Passer', 'Engine Room', 'Calm Under Pressure'], Rare: ['Tempo Setter', 'Press Resistant', 'Box to Box'] },
  WG: { Standard: ['Quick Feet', 'Early Cross'], Rare: ['Cut Inside', 'Trickster'] },
  FW: { Standard: ['Poacher', 'Near Post'], Rare: ['First Time Finish'] },
};

// The starting squad (bible §5): 18 seniors (the Founder + 17 generated) in one of these shapes (GK, DF, MF, WG, FW),
// each giving at least 2 GK, 6 DF, 5 MID/WNG and 5 FWD/WNG (a winger counted once); plus 3 on the youth watch list.
export const SQUAD = {
  size: 18,
  watch: 3,
  shapes: [
    { GK: 2, DF: 6, MF: 4, WG: 3, FW: 3 },
    { GK: 2, DF: 6, MF: 5, WG: 2, FW: 3 },
    { GK: 2, DF: 6, MF: 4, WG: 2, FW: 4 },
    { GK: 2, DF: 6, MF: 3, WG: 3, FW: 4 },
  ],
  need: { GK: 2, DF: 6, midWing: 5, fwdWing: 5 },
};

// Contracts (bible §11): salary a week, 1–5 years, a squad role. No negotiation yet.
export const ROLES = ['Prospect', 'Rotation', 'Starter', 'Star'];
export const CONTRACT = {
  salary: { Standard: { base: 180, perOvr: 10 }, Rare: { base: 380, perOvr: 16 } }, // base + perOvr × (overall − 40), to the nearest 10
  roleBonus: { Prospect: 0.7, Rotation: 1, Starter: 1.15, Star: 1.4 },
  years: { Prospect: [3, 5], Rotation: [1, 3], Starter: [2, 4], Star: [3, 5] },
  prospectAge: 21, // a squad player this young who is not in the best XI is a Prospect
};

// Name pools per Home Area (made up; none of the Featured Players' names or surnames). A generated player takes a first
// name and a surname from the club's area; opponents from their own area.
export const AREA_NAMES = {
  fen: { first: ['Ashby', 'Tom', 'Callum', 'Reuben', 'Dylan', 'Ollie', 'Isaac', 'Jude'], last: ['Fenwick', 'Marsh', 'Reedman', 'Dykes', 'Holbeach', 'Tilney', 'Sutton', 'Crowland', 'Wisbey', 'Ely'] },
  border: { first: ['Callan', 'Rory', 'Fraser', 'Hamish', 'Brodie', 'Euan', 'Alasdair', 'Craig'], last: ['Armstrong', 'Elliot', 'Kerrigan', 'Tweedie', 'Hepburn', 'Liddell', 'Rutherford', 'Oliphant', 'Kerr', 'Douglass'] },
  moor: { first: ['Harvey', 'Alfie', 'Jack', 'Robbie', 'Ewan', 'Toby', 'Wilf', 'Archie'], last: ['Heathcote', 'Moorby', 'Stonehouse', 'Fairbairn', 'Thwaite', 'Garside', 'Beckwith', 'Holroyd', 'Crag', 'Ridsdale'] },
  valley: { first: ['Rhys', 'Owain', 'Dafydd', 'Gethin', 'Iwan', 'Aled', 'Huw', 'Emyr'], last: ['Pritchard', 'Morgan', 'Probert', 'Bevan', 'Llewellyn', 'Prosser', 'Jenkins', 'Maddox', 'Howells', 'Rees'] },
  coast: { first: ['Kieran', 'Jamie', 'Nathan', 'Sonny', 'Cody', 'Luke', 'Harry', 'Declan'], last: ['Saltern', 'Harbour', 'Penrose', 'Tidey', 'Seaton', 'Gullet', 'Quayle', 'Mariner', 'Shore', 'Wickett'] },
  mid: { first: ['Kyle', 'Liam', 'Aiden', 'Ryan', 'Dean', 'Josh', 'Connor', 'Danny'], last: ['Brackley', 'Canning', 'Forgan', 'Tipton', 'Wednesfield', 'Oldbury', 'Ashworth', 'Smedley', 'Hodgkins', 'Pinfold'] },
  cape: { first: ['Jago', 'Tristan', 'Kenan', 'Pascoe', 'Treve', 'Colan', 'Morvah', 'Denzel'], last: ['Trelawny', 'Penhale', 'Rosewarne', 'Tregear', 'Polglase', 'Nancarrow', 'Carne', 'Trevail', 'Hosking', 'Jewell'] },
  lakes: { first: ['Fergus', 'Ellis', 'Hugo', 'Arlo', 'Rowan', 'Brody', 'Magnus', 'Tam'], last: ['Grasmere', 'Keswick', 'Braithwaite', 'Tyson', 'Fell', 'Hodgson', 'Rigg', 'Postlethwaite', 'Birkett', 'Tarn'] },
  mills: { first: ['Billy', 'Frankie', 'Lewis', 'Mikey', 'Joe', 'Ste', 'Gaz', 'Benny'], last: ['Spindler', 'Loomis', 'Hargreaves', 'Butterworth', 'Ormerod', 'Greenhalgh', 'Duckworth', 'Pilling', 'Entwistle', 'Crompton'] },
  dales: { first: ['George', 'Fred', 'Albie', 'Stanley', 'Jonah', 'Bertie', 'Seth', 'Walt'], last: ['Dalesby', 'Wensley', 'Metcalfe', 'Kettlewell', 'Swaledale', 'Hebden', 'Airey', 'Calvert', 'Thistlethwaite', 'Raw'] },
  estuary: { first: ['Tyler', 'Mason', 'Reece', 'Jordan', 'Ricky', 'Leon', 'Kane', 'Tommy'], last: ['Mudford', 'Tidewell', 'Creek', 'Oysterby', 'Saltmarsh', 'Barkingside', 'Leigh', 'Canvey', 'Shoebury', 'Wharton'] },
  iron: { first: ['Wayne', 'Carl', 'Darren', 'Shane', 'Gav', 'Lee', 'Marc', 'Jay'], last: ['Anvil', 'Furnace', 'Smelton', 'Forgeman', 'Bessemer', 'Rivett', 'Slagg', 'Ironside', 'Coker', 'Puddler'] },
};
// A shared pool mixed in with every area's (so a squad of 21 needn't repeat a surname): about AREA_SHARE of names come
// from the area, the rest from here.
export const AREA_SHARE = 0.6;
export const SHARED_NAMES = {
  first: ['Adam', 'Charlie', 'Ethan', 'Freddie', 'Gabriel', 'Henry', 'Joseph', 'Lucas', 'Max', 'Noel', 'Patrick', 'Sebastian', 'Tobias', 'Vincent', 'Zach', 'Elliott'],
  last: ['Ashdown', 'Barlow', 'Carver', 'Denton', 'Eastwood', 'Fletcher', 'Goodwin', 'Hargrove', 'Ingram', 'Jarvis', 'Kemp', 'Lister', 'Mottram', 'Newbold', 'Oakes', 'Parr', 'Radley', 'Sadler', 'Thorne', 'Upton', 'Varley', 'Yates', 'Bramall', 'Cropper', 'Dunmore', 'Fowler', 'Gill', 'Hurst', 'Pendle', 'Wragg'],
};
// Opponents' areas (their names come from their own area's pool).
export const CLUB_AREAS = { REG01: 'fen', REG02: 'border', REG03: 'moor', REG04: 'valley', REG05: 'coast', REG06: 'mid' };
