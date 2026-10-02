// Items (Milestone 12c, bible addendum §B; series common feature §4 on core/ItemSystem). Gifts and rewards the club
// receives and gives to a player: giving one uses it up and permanently raises one of the five core stats training raises.
// Plain data; the rules live in src/systems/items.js. Never sold in a shop, never for Club Tokens or real money.
//
// Keeper items: GOALWORKS has no Goalkeeping stat of its own (it is worked out from DEF / TEC / PHY, mostly DEF), so a
// keeper item raises DEF — the stat a keeper's Goalkeeping stands on — and only a keeper can be given one
// (docs/DECISIONS.md, 2 Oct).
export const ITEM_GROUPS = [
  { id: 'attack', name: 'Attack', stat: 'ATK', color: '#D0322B', shape: 'disc' },
  { id: 'technique', name: 'Technique', stat: 'TEC', color: '#7B3FC4', shape: 'blob' },
  { id: 'passing', name: 'Passing', stat: 'PAS', color: '#2E86C1', shape: 'book' },
  { id: 'defence', name: 'Defence', stat: 'DEF', color: '#1B2A4A', shape: 'helmet' },
  { id: 'physical', name: 'Physical', stat: 'PHY', color: '#2E8B57', shape: 'slab' },
  { id: 'goalkeeping', name: 'Goalkeeping', stat: 'DEF', color: '#E08A1E', shape: 'cup', keepersOnly: true },
];
export const groupById = (id) => ITEM_GROUPS.find((g) => g.id === id) ?? null;

const t = (n, name, group) => ({ id: `item_${String(n).padStart(2, '0')}`, name, group, stat: groupById(group).stat });
export const ITEM_TYPES = [
  t(1, 'Striker Boots', 'attack'), t(2, 'Finishing Ball', 'attack'), t(3, 'Target Net', 'attack'), t(4, 'Golden Laces', 'attack'),
  t(5, 'Skill Boots', 'technique'), t(6, 'Juggling Ball', 'technique'), t(7, 'Agility Ladder', 'technique'), t(8, 'Trick Trainer', 'technique'),
  t(9, 'Playmaker Boots', 'passing'), t(10, 'Passing Wall', 'passing'), t(11, 'Vision Goggles', 'passing'), t(12, 'Tactics Notebook', 'passing'),
  t(13, 'Shin Guards Pro', 'defence'), t(14, 'Tackle Boots', 'defence'), t(15, 'Marking Bibs', 'defence'), t(16, 'Defender’s Headband', 'defence'),
  t(17, 'Weighted Vest', 'physical'), t(18, 'Resistance Bands', 'physical'), t(19, 'Recovery Boots', 'physical'), t(20, 'Endurance Watch', 'physical'),
  t(21, 'Keeper Gloves', 'goalkeeping'), t(22, 'Reaction Ball', 'goalkeeping'), t(23, 'Diving Mat', 'goalkeeping'), t(24, 'Keeper Cap', 'goalkeeping'),
];
// Rarity: the stat points it gives, its sell-back price (placeholder Credits), how often it turns up, its frame colour.
export const ITEM_RARITIES = {
  common: { name: 'Common', gain: 1, sell: 40, weight: 60, color: '#9AA0A6', frame: 'thin' },
  rare: { name: 'Rare', gain: 2, sell: 100, weight: 28, color: '#2E86C1' },
  elite: { name: 'Elite', gain: 3, sell: 220, weight: 10, color: '#7B3FC4', gem: true },
  legendary: { name: 'Legendary', gain: 5, sell: 500, weight: 2, color: '#E0A800', gem: true },
};
export const RARITY_ORDER = ['common', 'rare', 'elite', 'legendary'];

export const ITEM_RULES = {
  storeName: 'Club Store',
  storeIcon: 'item_25',
  inventoryMax: 20, // + the Kit Room's level extra (storeSize)
  periodCap: 10, // item points a player can receive each season
  loveMult: 1.5, // rounded up
  dislikeMult: 0.5,
  loveMorale: 4, // a loved item lifts morale this much
  tierCap: { Standard: 80, Rare: 90 }, // an item never takes a stat past this (by the player's tier)
  dislikeChance: 0.35, // a generated player: chance of one group they're not keen on
};

// Who loves what: the group of the player's position, and the group their trait points to (Featured players get exactly
// these; a generated player gets their position's group, maybe their trait's, maybe one other — rolled once and saved).
export const POSITION_LOVES = { GK: 'goalkeeping', DF: 'defence', MF: 'passing', WG: 'technique', FW: 'attack' };
export const TRAIT_LOVES = {
  'Safe Hands': 'goalkeeping', 'Sweeper Keeper': 'passing', 'Calm Under Pressure': 'technique',
  'Hard Tackler': 'defence', Marker: 'defence', 'Aerial Strong': 'physical', 'Cover Defender': 'physical', Leader: 'physical',
  'Simple Passer': 'passing', 'Engine Room': 'physical', 'Tempo Setter': 'passing', 'Press Resistant': 'technique', 'Box to Box': 'physical',
  'Quick Feet': 'technique', 'Early Cross': 'passing', 'Cut Inside': 'attack', Trickster: 'technique',
  Poacher: 'attack', 'Near Post': 'attack', 'First Time Finish': 'attack',
};

// Where items come from. live: wired now; otherwise a hook that switches on with its milestone (grant() refuses it
// until then). Nothing here is a shop.
export const ITEM_SOURCES = {
  win: { live: true, name: 'Match win' },
  potm: { live: true, name: 'Player of the match' },
  training: { live: true, name: 'Great training session' },
  wellwisher: { live: true, name: 'Well-wisher' },
  sponsor: { live: false, name: 'Sponsor gift', waits: 'M23' },
  fans: { live: false, name: 'Fan gift', waits: 'M23 / M24' },
  tournament: { live: false, name: 'Tournament prize', waits: 'M24' },
  achievement: { live: false, name: 'Achievement', waits: 'M27' },
};
export const ITEM_DROPS = {
  // a win: chance from the opponent's strength (Regional 0.88 … 1.09); stronger clubs give better rarities
  win: { chance: [0.3, 0.55], strength: [0.88, 1.09], weights: { weak: { common: 64, rare: 28, elite: 7, legendary: 1 }, strong: { common: 45, rare: 35, elite: 16, legendary: 4 } } },
  // a big game (the Promotion Match, or a win against a club of strength 1.0 or more): the player of the match's item
  potm: { bigStrength: 1.0, weights: { common: 30, rare: 45, elite: 20, legendary: 5 } },
  // each week: the player with the best training of the week, if it was a real effort
  training: { chance: 0.5, minXp: 6, weights: { common: 70, rare: 25, elite: 5, legendary: 0 } },
  // a few times a season (a season = 336 club days)
  wellwisher: { perDay: 4 / 336, weights: { common: 55, rare: 32, elite: 11, legendary: 2 }, givers: ['A local bakery', 'A former player', 'A lifelong supporter', 'The village pub', 'A school football club', 'The corner shop'] },
};
