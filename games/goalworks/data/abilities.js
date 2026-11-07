// Abilities (Milestone 26, bible §14): all 40, the Featured Players' traits (§9), the slot rules, learning and evolution.
// Plain data; the rules live in src/systems/abilities.js (the club: slots, learning, evolution) and src/match/abilityFx.js
// (the match: one lookup the engine reads, the way facilities and staff go through effects.js).
//
// Each ability: id, name, tier (Standard | Rare | Elite | Legendary | Secret), kind ('football' | 'personality': which slot
// it can sit in), pos (the positions that can learn it; Featured / innate traits ignore this), group (the training focus
// that teaches it), fx { key: value } (the engine numbers, see FX_KEYS), team: true (counts once per team however many
// players have it), plain (the effect in plain words, for the player card), and maybe evolve { to, need } (it upgrades
// into `to` once every need is met; secret: the SEC-ABL secret that has to be found first — M28).
//
// The bible's effects name things the engine doesn't model one-to-one. Each maps to the nearest real number (FX_KEYS says
// where it plugs in; every mapping is listed in DECISIONS, M26).
export const ABILITY_TIERS = ['Standard', 'Rare', 'Elite', 'Legendary', 'Secret'];
export const PRESTIGE = new Set(['Legendary', 'Secret']);

// The engine numbers an ability can change (value: a share, 0.08 = 8%, unless it says otherwise) and where each plugs in.
export const FX_KEYS = {
  dribbleTurn: 'carrier acceleration while dribbling (turns) × (1 + v)',
  catch: 'keeper holds a save (rather than parrying) × (1 + v)',
  tackle: 'chance a tackle wins the ball × (1 + v)',
  foulAdd: 'foul chance on his tackles + v (absolute)',
  shortPass: 'error angle on his ground passes × (1 − v)',
  boxRun: 'length of his support runs forward × (1 + v)',
  release: 'steps before the carrier first plays it (crosses, passes) × (1 − v)',
  marking: 'pressure he puts on a nearby carrier × (1 + v)',
  stamina: 'club fatigue from a match (and the Play sprint bar) × (1 − v)',
  nearPost: 'shot error from inside 12 m × (1 − v)',
  pressure: 'pressure he feels on the ball × (1 − v)',
  header: 'his score in a header duel (corners, wide free kicks) × (1 + v)',
  possession: 'team: tackles against our carriers and our pass error × (1 − v)',
  insideRun: 'his support runs pulled towards the middle by v of the way',
  finesse: 'his shot error × (1 − v)',
  rush: 'keeper speed coming off his line × (1 + v)',
  recovery: 'speed running back while the other side has the ball × (1 + v)',
  pressLoss: 'tackles in his first half second on the ball, and a hard ball miscontrolled × (1 − v)',
  trickster: 'club morale + v after a match where he beat a tackle',
  firstTime: 'error on a shot within half a second of receiving × (1 − v)',
  transitionRun: 'length of his support runs forward × (1 + v) (Box to Box)',
  leader: 'team: morale lost after a match × (1 − v) for his team-mates',
  reach: 'keeper save reach × (1 + v)',
  oneVOne: 'his failure chance when he is the only defender on the carrier × (1 − v)',
  through: 'error on his forward passes × (1 − v)',
  burst: 'speed in the first 3 seconds of a run × (1 + v)',
  finishing: 'his shot error × (1 − v)',
  standFoul: 'foul chance on his non-reckless tackles × (1 − v)',
  pressCost: 'club fatigue from a match when the team pressed (Mid or High) × (1 − v)',
  loneDribble: 'tackles against him when only one defender is on him × (1 − v)',
  bigMatch: 'all match numbers × (1 + v) in a final or a promotion game',
  captain: 'team: morale under neutral counts v points higher in the match while he captains',
  penKick: 'penalty model: + v to the taker (M25 Penalty King / Ice Cold hook)',
  penSave: 'penalty model: + v to the keeper (M25 Penalty King / Penalty Reader hook)',
  shootout: 'penalty model: + v to the taker in a shoot-out (M25 Ice Cold hook)',
  ironCaptain: 'his tackle chance × (1 + v) while his side leads after 75′',
  threadNeedle: 'pressure on his passes × (1 − v); a pass lane scores v more',
  ghost: 'seconds a defender who failed to tackle him waits before the next try (+ v)',
  pressureCap: 'the pressure on his shots is capped at v (the bible\'s 5% penalty cap)',
  lastStand: 'keeper save chance × (1 + v) from 80′ while level or ahead',
  cleanTackle: 'his first won tackle in each v-minute spell cannot be a foul',
  transition: 'team: pressure felt × (1 − v) for 4 s after winning the ball',
  blink: 'one off-ball burst every v sim seconds: 1 s at the God of Speed\'s acceleration',
  impossible: 'shot error × (1 − v) on a manual shot or an AI big chance',
};

const A = (id, name, tier, kind, pos, group, fx, plain, more = {}) => ({ id, name, tier, kind, pos, group, fx, plain, ...more });
const ALL = ['GK', 'DF', 'MF', 'WG', 'FW'];
const OUT = ['DF', 'MF', 'WG', 'FW'];
export const ABILITIES = [
  A('AB01', 'Quick Feet', 'Standard', 'football', ['WG', 'FW', 'MF'], 'technique', { dribbleTurn: 0.08 }, 'Turns 8% sharper with the ball at his feet.', { evolve: { to: 'AB28', need: { beaten: 25, TEC: 72 } } }),
  A('AB02', 'Safe Hands', 'Standard', 'football', ['GK'], 'goalkeeping', { catch: 0.08 }, 'Holds on to 8% more of his saves.', { evolve: { to: 'AB21', need: { cleanSheets: 20, DEF: 78 } } }),
  A('AB03', 'Hard Tackler', 'Standard', 'football', ['DF', 'MF'], 'defence', { tackle: 0.08, foulAdd: 0.02 }, 'Tackles 8% harder, but fouls a little more.', { evolve: { to: 'AB22', need: { tacklesWon: 60, DEF: 80 } } }),
  A('AB04', 'Simple Passer', 'Standard', 'football', ['MF', 'DF'], 'passing', { shortPass: 0.08 }, 'Short passes 8% more accurate.', { evolve: { to: 'AB23', need: { assists: 15, PAS: 80 } } }),
  A('AB05', 'Poacher', 'Standard', 'football', ['FW', 'WG'], 'attack', { boxRun: 0.08 }, 'Gets into the box 8% more.', { evolve: { to: 'AB25', need: { goals: 25, ATK: 75 } } }),
  A('AB06', 'Early Cross', 'Standard', 'football', ['WG', 'DF', 'MF'], 'passing', { release: 0.1 }, 'Gets the ball away 10% quicker.'),
  A('AB07', 'Marker', 'Standard', 'football', ['DF', 'MF'], 'defence', { marking: 0.08 }, 'Sticks to his man: 8% more pressure on the ball.', { evolve: { to: 'AB26', need: { tacklesWon: 50, DEF: 78 } } }),
  A('AB08', 'Engine Room', 'Standard', 'football', OUT, 'physical', { stamina: 0.08 }, 'Tires 8% less from a match.', { evolve: { to: 'AB27', need: { apps: 60, PHY: 76 } } }),
  A('AB09', 'Near Post', 'Standard', 'football', ['FW', 'WG'], 'attack', { nearPost: 0.08 }, 'Finishes 8% better from close in.', { evolve: { to: 'AB18', need: { goals: 12, ATK: 66 } } }),
  A('AB10', 'Calm Under Pressure', 'Standard', 'personality', ALL, 'technique', { pressure: 0.08 }, 'Feels 8% less pressure on the ball.', { evolve: { to: 'AB29', need: { apps: 80 }, secret: 'SEC-ABL-01' } }),
  A('AB11', 'Aerial Strong', 'Rare', 'football', ['DF', 'FW'], 'physical', { header: 0.12 }, 'Wins 12% more in a header duel.'),
  A('AB12', 'Tempo Setter', 'Rare', 'football', ['MF'], 'passing', { possession: 0.04 }, 'The whole team keeps the ball 4% better while he plays (once a team).', { team: true }),
  A('AB13', 'Cut Inside', 'Rare', 'football', ['WG', 'FW'], 'attack', { insideRun: 0.15, finesse: 0.06 }, 'Cuts inside 15% more; shots 6% more precise.', { evolve: { to: 'AB24', need: { goals: 15, assists: 10, ATK: 82 } } }),
  A('AB14', 'Sweeper Keeper', 'Rare', 'football', ['GK'], 'goalkeeping', { rush: 0.12 }, 'Comes off his line 12% faster.'),
  A('AB15', 'Cover Defender', 'Rare', 'football', ['DF', 'MF'], 'defence', { recovery: 0.08 }, 'Runs back 8% faster.'),
  A('AB16', 'Press Resistant', 'Rare', 'football', ['MF', 'WG', 'FW'], 'technique', { pressLoss: 0.12 }, 'Loses the ball 12% less on his first touch under press.'),
  A('AB17', 'Trickster', 'Rare', 'football', ['WG', 'FW', 'MF'], 'technique', { trickster: 5 }, 'Beating a tackle lifts his morale +5 after the match.'),
  A('AB18', 'First Time Finish', 'Rare', 'football', ['FW', 'WG'], 'attack', { firstTime: 0.12 }, 'First-time shots 12% more accurate.', { evolve: { to: 'AB25', need: { goals: 30, ATK: 78 } } }),
  A('AB19', 'Box to Box', 'Rare', 'football', ['MF'], 'physical', { transitionRun: 0.1 }, 'Gets forward 10% more.'),
  A('AB20', 'Leader', 'Rare', 'personality', ALL, 'physical', { leader: 0.2 }, 'Team-mates lose 20% less morale after a bad result (once a team).', { team: true, evolve: { to: 'AB30', need: { apps: 100 } } }),
  A('AB21', 'Wall', 'Elite', 'football', ['GK'], 'goalkeeping', { reach: 0.1 }, 'Reaches 10% further for saves.'),
  A('AB22', 'Lockdown', 'Elite', 'football', ['DF'], 'defence', { oneVOne: 0.14 }, '14% fewer mistakes one-on-one.'),
  A('AB23', 'Visionary', 'Elite', 'football', ['MF', 'WG'], 'passing', { through: 0.14 }, 'Through balls 14% more accurate.', { evolve: { to: 'AB33', need: { assists: 40 }, secret: 'SEC-ABL-09' } }),
  A('AB24', 'Electric', 'Elite', 'football', ['WG', 'FW'], 'physical', { burst: 0.1 }, '10% faster in the first 3 seconds of a run.'),
  A('AB25', 'Predator', 'Elite', 'football', ['FW'], 'attack', { boxRun: 0.15, finishing: 0.08 }, 'Gets into the box 15% more; finishes 8% better.', { evolve: { to: 'AB35', need: { goals: 60 }, secret: 'SEC-ABL-10' } }),
  A('AB26', 'Perfect Timing', 'Elite', 'football', ['DF'], 'defence', { standFoul: 0.2 }, '20% fewer fouls from standing tackles.'),
  A('AB27', 'Press Master', 'Elite', 'football', ['MF', 'FW', 'WG'], 'physical', { pressCost: 0.15 }, 'Pressing tires him 15% less.'),
  A('AB28', 'One on One', 'Elite', 'football', ['WG', 'FW'], 'technique', { loneDribble: 0.12 }, '12% harder to tackle with one defender on him.'),
  A('AB29', 'Big Match Monster', 'Elite', 'personality', ALL, 'attack', { bigMatch: 0.05 }, '+5% to everything in finals and promotion games.'),
  A('AB30', 'Captain Fantastic', 'Elite', 'personality', OUT, 'physical', { captain: 5 }, 'As captain: low morale counts 5 points higher for the team (once a team).', { team: true }),
  A('AB31', 'Penalty King', 'Legendary', 'football', ['FW', 'GK'], 'setpieces', { penKick: 0.12, penSave: 0.1 }, 'Penalties: scores more; as keeper reads them better.'),
  A('AB32', 'Iron Captain', 'Legendary', 'football', ['DF'], 'defence', { ironCaptain: 0.08 }, 'Defends 8% better protecting a lead after 75′.'),
  A('AB33', 'Thread the Needle', 'Legendary', 'football', ['MF'], 'passing', { threadNeedle: 0.2 }, 'Through passes ignore 20% of the pressure.'),
  A('AB34', 'Ghost Step', 'Legendary', 'football', ['WG'], 'technique', { ghost: 0.15 }, 'A beaten defender is left 0.15 s behind.'),
  A('AB35', 'Ice Cold', 'Legendary', 'football', ['FW'], 'attack', { pressureCap: 0.1, penKick: 0.06, shootout: 0.06 }, 'Pressure barely touches his finishing; cool from the spot.'),
  A('AB36', 'Last Stand', 'Secret', 'football', ['GK'], 'goalkeeping', { lastStand: 0.18 }, 'Saves 18% more in the last 10′ when level or ahead.'),
  A('AB37', 'No Way Through', 'Secret', 'football', ['DF'], 'defence', { cleanTackle: 10 }, 'His first won tackle every 10′ is never a foul.'),
  A('AB38', 'Time Bender', 'Secret', 'football', ['MF'], 'passing', { transition: 0.12 }, 'The team plays 12% calmer just after winning the ball (once a team).', { team: true }),
  A('AB39', 'Blink Run', 'Secret', 'football', ['WG'], 'physical', { blink: 90 }, 'One instant burst off the ball every 90 seconds.'),
  A('AB40', 'Impossible Finish', 'Secret', 'football', ['FW'], 'attack', { impossible: 0.15 }, 'Big chances and perfect manual shots 15% more accurate.'),
];
export const abilityById = (id) => BY_ID[id] ?? null;

// The Featured Players' bible traits that are not among the 40 (§9). Innate only: never learned, never generated; each
// maps to the nearest engine numbers like the 40 do.
export const FEATURED_TRAITS = [
  A('FT01', 'Quick Release', 'Standard', 'football', ['GK'], 'goalkeeping', { release: 0.12 }, 'Gets the ball out 12% quicker.'),
  A('FT02', 'Penalty Reader', 'Rare', 'football', ['GK'], 'goalkeeping', { penSave: 0.12 }, 'Reads penalties: saves more of them.'),
  A('FT03', 'High Claim', 'Rare', 'football', ['GK'], 'goalkeeping', { rush: 0.08, catch: 0.05 }, 'Comes for crosses and holds them.'),
  A('FT04', 'Big Presence', 'Rare', 'football', ['GK'], 'goalkeeping', { reach: 0.05 }, 'Fills the goal: 5% more reach.'),
  A('FT05', 'Ice Veins', 'Elite', 'football', ['GK'], 'goalkeeping', { lastStand: 0.08, penSave: 0.06 }, 'Calm late on and at penalties.'),
  A('FT06', 'Ball Winner', 'Rare', 'football', ['DF'], 'defence', { tackle: 0.1 }, 'Wins 10% more of his tackles.'),
  A('FT07', 'Deep Playmaker', 'Rare', 'football', ['MF'], 'passing', { through: 0.08, pressure: 0.05 }, 'Plays it forward from deep, calmly.'),
  A('FT08', 'Touchline Runner', 'Rare', 'football', ['WG'], 'physical', { transitionRun: 0.1, recovery: 0.05 }, 'Up and down the wing all match.'),
  A('FT09', 'Wide Press', 'Rare', 'football', ['WG'], 'defence', { marking: 0.08 }, 'Presses the full-back hard.'),
  A('FT10', 'Target Forward', 'Rare', 'football', ['FW'], 'physical', { header: 0.1 }, 'Wins 10% more in the air.'),
  A('FT11', 'Channel Runner', 'Rare', 'football', ['FW'], 'attack', { boxRun: 0.06, burst: 0.05 }, 'Runs the channels in behind.'),
  A('FT12', 'Pressing Forward', 'Rare', 'football', ['FW'], 'defence', { marking: 0.06, pressCost: 0.08 }, 'Presses from the front.'),
];
const BY_ID = Object.fromEntries([...ABILITIES, ...FEATURED_TRAITS].map((a) => [a.id, a]));
const BY_NAME = Object.fromEntries([...ABILITIES, ...FEATURED_TRAITS].map((a) => [a.name, a]));
export const abilityByName = (name) => BY_NAME[name] ?? (name === 'Big Match' ? BY_NAME['Big Match Monster'] : null);
export const ART = (id) => (/^AB\d\d$/.test(id) ? `ability_${id.toLowerCase()}` : null); // (the 40 have art; the Featured traits use the closest ability's)
export const ART_FOR = { FT01: 'AB06', FT02: 'AB31', FT03: 'AB14', FT04: 'AB21', FT05: 'AB36', FT06: 'AB03', FT07: 'AB23', FT08: 'AB19', FT09: 'AB07', FT10: 'AB11', FT11: 'AB24', FT12: 'AB27' };

// The 50 Featured Players' traits (bible §9 exactly: the trait name, as the player carries it).
export const FEATURED_TRAIT_OF = {
  GK01: 'Safe Hands', GK02: 'Quick Release', GK03: 'Penalty Reader', GK04: 'Sweeper Keeper', GK05: 'High Claim', GK06: 'Big Presence', GK07: 'Wall', GK08: 'Ice Veins', GK09: 'Penalty King', GK10: 'Last Stand',
  DF01: 'Hard Tackler', DF02: 'Marker', DF03: 'Aerial Strong', DF04: 'Cover Defender', DF05: 'Ball Winner', DF06: 'Leader', DF07: 'Lockdown', DF08: 'Perfect Timing', DF09: 'Iron Captain', DF10: 'No Way Through',
  MF01: 'Simple Passer', MF02: 'Engine Room', MF03: 'Tempo Setter', MF04: 'Press Resistant', MF05: 'Deep Playmaker', MF06: 'Box to Box', MF07: 'Visionary', MF08: 'Press Master', MF09: 'Thread the Needle', MF10: 'Time Bender',
  WG01: 'Quick Feet', WG02: 'Early Cross', WG03: 'Cut Inside', WG04: 'Touchline Runner', WG05: 'Trickster', WG06: 'Wide Press', WG07: 'Electric', WG08: 'One on One', WG09: 'Ghost Step', WG10: 'Blink Run',
  FW01: 'Poacher', FW02: 'Near Post', FW03: 'Target Forward', FW04: 'Channel Runner', FW05: 'First Time Finish', FW06: 'Pressing Forward', FW07: 'Predator', FW08: 'Big Match', FW09: 'Ice Cold', FW10: 'Impossible Finish',
};

// Slots (bible §14): 1 personality trait, 1 innate football trait, up to 2 learned abilities, 1 signature slot (Legendary /
// Secret only, and only open for a Legendary / Secret player or after a secret / NG+ opens it).
export const SLOTS = { personality: 1, innate: 1, learned: 2, signature: 1 };
export const SLOT_NAMES = { personality: 'Personality', innate: 'Innate trait', learned: 'Learned', signature: 'Signature' };

// Generated players (bible §14 "by tier"): their innate trait is the M7 one (data/players.js TRAITS); on top, rolled once
// from their own seed (never the squad generator's dice): a learned ability by tier, a personality now and then. Never
// Legendary / Secret.
export const GENERATED = {
  learned: { Standard: [0.12, 0], Rare: [0.3, 0.06], Elite: [0.5, 0.15], Legendary: [0.5, 0.15], Secret: [0.5, 0.15] }, // [one, a second]
  eliteShare: { Standard: 0, Rare: 0.05, Elite: 0.3, Legendary: 0.3, Secret: 0.3 }, // the share of those learned that are Elite
  personality: 0.12,
};

// Learning (your players, on training days): a slow chance a day that grows with the matching session. Per day:
//   chance = base × (the share of today's sessions in the ability's group, or in Ability Development × abilityFocus)
//            × (1 + Head Coach coachPct / 100) × (1 + xp:ability research / 100) × tier factor
// Progress builds a little each training day (shown on the card as "learning … 40%"); at 1 the ability is learned. The
// target: the ability that fits him best that he doesn't have (his position, the group he trains most).
export const LEARN = {
  perDay: 0.0024, // progress a full matching-session day adds at talent 1 (≈ 1.5–2 seasons of it; a squad learns ~2–4 a season)
  headStart: 0.45, // a new target starts part way, by up to this (fixed from his id): not the whole squad in one week
  talent: [0.5, 1.6], // each player's own knack for it (fixed from his id): × this
  abilityFocus: 1.6, // Ability Development counts this much towards whatever he is learning
  otherShare: 0.15, // any other session still counts this much
  tier: { Standard: 1, Rare: 0.6, Elite: 0.3 },
  eliteFrom: 70, // an Elite ability is only learned by a player with an overall this high (else Standard / Rare)
  item: 0.08, // a loved item adds this much progress
  sponsor: 'xp:ability', // (the research / sponsor key that speeds it: R02 Position Coaching, SP09 Legacy Athletic)
};
// Evolution: checked once a week for your players. need: career counters (goals, assists, apps, cleanSheets) and match
// tallies (tacklesWon, beaten — p.abl.tally, from the match) and core stats at least this. Bonuses: C11's evolution boost,
// F34 Hall of Legends (each × EVOLVE.boost on the counters needed), HC04's extra check.
export const EVOLVE = { boost: 0.85 };

// A team's captain (the armband): picked on the player card; with none picked, the XI's Captain Fantastic / Leader, else
// the oldest of the best five by overall.
export const CAPTAIN = { auto: ['AB30', 'AB32', 'AB20'] };
