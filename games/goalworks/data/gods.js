// The Works Gods (Milestone 20b; series cast SERIES_WORKS_GODS.md): five new characters in a new tier above Secret,
// Divine. Three play (Jinx in goal, Zip up front, Havoc anywhere outfield), Bolt is the Divine Physio and Kaching sits in
// the one Honorary Chairman seat. Each arrives through his own secret (data/secrets.js, src/systems/secrets.js); the
// blessings are read by src/systems/gods.js. They never age, decline or retire, never go to an AI club and never join the
// free agents: a god you release leaves the game and comes back after the next season's end.
//   kind: 'player' (joins the squad, a Star: stats up to 140), 'staff' (the role's one seat), 'chairman' (his own seat)
//   blessing: { name, plain (the card's words), ...numbers }      art: the stand-in art (Cowork swaps the outfits in later)

export const DIVINE = {
  tier: 'Divine',
  colour: '#E8B923', // the gold badge and glow
  age: 27, // shown as "Ageless"; it never changes
  level: 30,
  wageTier: 'Secret', // (card: wages like the Secret tier) data/players.js CONTRACT.salary.Secret, role Star
  staffWage: 500, // Bolt: data/staff.js STAFF_TIERS.Secret.wage
  window: 56, // days to sign or appoint an arrived god; then he comes back after the next season's end
};

export const GODS = {
  GOD1: {
    id: 'GOD1',
    name: 'Bolt',
    title: 'God of Tinkering',
    kind: 'staff',
    role: 'PH',
    art: 'staff_god_bolt',
    blessing: {
      name: 'Patch-up',
      plain: 'Injured players recover 50% faster and get 30% fewer injuries (injuries arrive in M25). Facility upgrades finish 25% faster. As your Physio, fatigue recovers 10% faster and builds up 10% slower.',
    },
    // what he adds to the shared effect query (as a hired staff member: data/staff.js GOD1)
    effects: [
      { key: 'upgradeFasterPct', value: 25 },
      { key: 'injuryRecoveryPct', value: 50 },
      { key: 'injuryResistPct', value: 30 },
      { key: 'recoveryPct', value: 10 },
      { key: 'fatigueGainPct', value: -10 },
    ],
  },
  GOD2: {
    id: 'GOD2',
    name: 'Jinx',
    title: 'Goddess of Luck',
    kind: 'player',
    position: 'GK',
    trait: 'Lucky Bounce',
    stats: { ATK: 60, TEC: 112, PAS: 100, DEF: 136, PHY: 120 },
    art: 'player_god_jinx',
    blessing: {
      name: 'Lucky bounce',
      plain: 'About 1 in 10 shots that would beat her hit the post instead. While she is in goal your team wins penalty shoot-outs about 75% of the time.',
      post: 0.1,
      shootout: 0.75,
    },
  },
  GOD3: {
    id: 'GOD3',
    name: 'Zip',
    title: 'God of Speed',
    kind: 'player',
    position: 'FW',
    trait: 'Lightning Feet',
    stats: { ATK: 136, TEC: 122, PAS: 98, DEF: 55, PHY: 118 },
    art: 'player_god_zip',
    blessing: {
      name: 'Lightning feet',
      plain: 'The fastest player on the pitch: he hits top speed at once. The whole squad gets back 15% more energy between matches.',
      speedPct: 5, // above the fastest pace the engine allows anyone (STAR.engine.max)
      accelMult: 20, // "ignores the acceleration ramp" (bible AB39): at full speed in a twentieth of the usual time
      recoveryPct: 15,
    },
  },
  GOD4: {
    id: 'GOD4',
    name: 'Kaching',
    title: 'God of Fortune',
    kind: 'chairman',
    art: 'staff_god_kaching',
    blessing: {
      name: 'Golden touch',
      plain: '+20% on all match income and cup and league prize money. Later, +20% on sponsor payouts (sponsors arrive in M23).',
      incomePct: 20,
      sponsorPct: 20, // (waits for M23)
    },
  },
  GOD5: {
    id: 'GOD5',
    name: 'Havoc',
    title: 'God of Chaos',
    kind: 'player',
    position: 'MF', // stored as a midfielder; he plays any outfield slot with no out-of-position penalty (anyOutfield)
    wildcard: true,
    trait: 'Chaos Roll',
    stats: { ATK: 122, TEC: 130, PAS: 118, DEF: 96, PHY: 110 },
    art: 'player_god_havoc',
    blessing: {
      name: 'Chaos roll',
      plain: 'Before each match he plays: 70% the team gets +8% for that match, 30% a funny setback (−4%). Strong on average, but swingy. He plays any outfield position with no penalty.',
      good: 0.7,
      up: 0.08,
      down: -0.04,
    },
    setbacks: [
      'Havoc tied the kit man’s laces together. Nobody could find the match balls.',
      'Havoc swapped the tactics board for a drawing of a duck. The team is confused.',
      'Havoc filled the dressing-room showers with purple foam. Everyone is late out.',
      'Havoc taught the club mascot to moonwalk. The players can’t stop watching.',
      'Havoc hid every left boot in the trophy cabinet.',
    ],
    boosts: [
      'Havoc’s sparks crackle round the dressing room: the team is buzzing!',
      'Havoc juggles three sparks in the tunnel. The crowd roars and the team flies out.',
      'Havoc winks at the referee. Something feels lucky today.',
    ],
  },
};
export const GOD_IDS = Object.keys(GODS);
export const godById = (id) => GODS[id] ?? null;
export const PLAYER_GODS = GOD_IDS.filter((id) => GODS[id].kind === 'player');

// A41 Pantheon (account): all five gods signed or appointed at least once, in any slot or run.
export const PANTHEON = { id: 'A41', name: 'Pantheon', line: 'Sign all five Works Gods' };
export const CREDITS_LINE = 'The Works Gods — Bolt, Jinx, Zip, Kaching and Havoc — a Banx Games series cast';
