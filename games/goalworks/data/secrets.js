// Secrets (Milestone 20b: the five Works Gods' secrets, SEC-GOD-1 … SEC-GOD-5). Plain data for the small secret checker
// (src/systems/secrets.js) that the full Secret Engine (M28, 60 secrets) grows from. Each secret:
//   id, name, reward: { god } (the god's arrival)
//   conditions: [{ key, need, text }] — key names a measure in src/systems/secrets.js MEASURES (a number now, or the best
//     so far this run / season); a condition is met at value ≥ need. Progress = the average of min(1, value / need).
//   clues: [first, clearer] — the Rumours list shows the first at a third of the way there, the second at two thirds
//   arrival: { title, line } — the one-tap pop-up when every condition is met (a 56-day window to sign / appoint)
//   needs: ids of secrets / gods that must come first (Havoc), trigger: 'defeat' — he turns up after your next defeat
// The numbers are Cowork's starting picks (M20b card); the money one is a placeholder until the M23 / M35 money pass.

export const SECRET_RULES = {
  clueAt: [1 / 3, 2 / 3],
  window: 56, // days
};

export const SECRETS = [
  {
    id: 'SEC-GOD-1',
    name: 'The brass cog',
    reward: { god: 'GOD1' },
    conditions: [
      { key: 'rank', need: 4, text: 'Club Rank A' }, // (RANK_ORDER index: E 0 … A 4, S 5)
      { key: 'facilitiesL3', need: 12, text: '12 facilities at level III' },
      { key: 'researchDone', need: 24, text: '24 of the 36 research nodes done' },
    ],
    clues: [
      'The groundsman swears someone fixed the roller overnight… and left a brass cog behind.',
      'More brass cogs! One in the physio room, one in the boot room, one humming on the floodlight pole. Someone is tinkering.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A short, cheerful old god with a huge moustache and a glowing brass cog for a halo. “Heard your physio room squeaks,” says Bolt. “I can fix that.”' },
  },
  {
    id: 'SEC-GOD-2',
    name: 'The lucky cat',
    reward: { god: 'GOD2' },
    conditions: [
      { key: 'seasonCleanSheets', need: 20, text: '20 clean sheets in one season (all competitions)' },
      { key: 'cupShootouts', need: 3, text: '3 cup penalty shoot-outs won in one cup run' },
      { key: 'giantFinal', need: 1, text: 'A cup final won against a club whose team rating is at least 10 higher than yours' },
    ],
    clues: [
      'A cat was seen sitting in the goalmouth before the shoot-out. It winked.',
      'The cat is back, with one paw raised. A glowing six-sided die floated over the crossbar, then vanished.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A sly cat-eared goddess with one paw raised and a glowing die over her shoulder. “Nice goal you’ve got,” says Jinx. “Shame if nobody could score in it.”' },
  },
  {
    id: 'SEC-GOD-3',
    name: 'The golden blur',
    reward: { god: 'GOD3' },
    conditions: [
      { key: 'premier', need: 1, text: 'Be in the Crown Premier League' },
      { key: 'seasonTopScorer', need: 35, text: 'One player scores 35 goals in a season (all competitions)' },
      { key: 'bigWinStreak', need: 6, text: 'Win 6 matches in a row by 2 or more goals' },
    ],
    clues: [
      'Fans swear a golden blur ran the length of the pitch after the final whistle.',
      'Scorch marks in the shape of little wings on the touchline. The groundsman is not happy.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A wiry young god with lightning-bolt hair and wings on his boots skids to a stop. “Race you to the halfway line,” grins Zip. “Too late — I already won.”' },
  },
  {
    id: 'SEC-GOD-4',
    name: 'The gold coins',
    reward: { god: 'GOD4' },
    conditions: [
      { key: 'creditsHeld', need: 1000000, text: 'Hold 1,000,000 Credits at once' },
      { key: 'crownCupWon', need: 1, text: 'Win the Crown Cup (C04)' },
      { key: 'premier', need: 1, text: 'Be in the Crown Premier League' },
    ],
    clues: [
      'Someone left a single gold coin on every seat in the directors’ box.',
      'The coins are stacking up into a cushion. Somebody very round has been sitting on it.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A big, jolly god floats in on a cushion of gold coins, wearing a tiny crown. “Every great club needs a chairman,” booms Kaching. “Honorary, of course. I don’t do meetings.”' },
  },
  {
    id: 'SEC-GOD-5',
    name: 'The purple sparks',
    reward: { god: 'GOD5' },
    needs: ['GOD1', 'GOD2', 'GOD3', 'GOD4'],
    trigger: 'defeat',
    conditions: [
      { key: 'godsSigned', need: 4, text: 'Bolt, Jinx, Zip and Kaching each signed at least once (any slot, any run)' },
      { key: 'crownTitles', need: 1, text: 'The Crown title won at least once (any slot, any run)' },
    ],
    clues: [
      'The dressing-room lights keep flickering purple and green. Someone’s laughing.',
      'Odd socks everywhere, a cracked little crown in the kit bag, and sparks fizzing in the showers. Something is waiting for a bad day.',
    ],
    arrival: { title: 'Something’s not right in the dressing room…', line: 'After the defeat, a small impish god with one horn and a wonky halo is juggling three crackling sparks on the physio’s table. “Bad day?” says Havoc. “I can make it… interesting.”' },
  },
];
export const secretById = (id) => SECRETS.find((s) => s.id === id) ?? null;
export const secretForGod = (godId) => SECRETS.find((s) => s.reward.god === godId) ?? null;
