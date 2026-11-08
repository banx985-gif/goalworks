// Secrets (Milestone 20b: the five Works Gods' secrets, SEC-GOD-1 … SEC-GOD-5). Plain data for the small secret checker
// (src/systems/secrets.js) that the full Secret Engine (M28, 60 secrets) grows from. Each secret:
//   id, name, reward: { god } (the god's arrival)
//   conditions: [{ key, need, text }] — key names a measure in src/systems/secrets.js MEASURES (a number now, or the best
//     so far this run / season); a condition is met at value ≥ need. Progress = the average of min(1, value / need).
//   clues: [first, clearer] — the Rumours list shows the first at a third of the way there, the second at two thirds
//   arrival: { title, line } — the one-tap pop-up when every condition is met (a 56-day window to sign / appoint)
//   needs: ids of secrets / gods that must come first (Havoc), trigger: 'defeat' — he turns up after your next defeat
// The numbers are Cowork's starting picks (M20b card); the money one is a placeholder until the M23 / M35 money pass.

import { BIBLE_SECRETS } from './secrets60.js'; // (M28) the bible's 60

export const SECRET_RULES = {
  clueAt: [1 / 3, 2 / 3],
  window: 56, // days (a god's or (M28) a Legendary / Secret player's arrival)
  giantGap: 6, // (M21, Cowork: was 10) Jinx's giant-killing final: their team rating at least this much above yours
};

export const SECRETS = [
  {
    id: 'SEC-GOD-1',
    kind: 'god',
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
    kind: 'god',
    name: 'The lucky cat',
    reward: { god: 'GOD2' },
    conditions: [
      { key: 'seasonCleanSheets', need: 20, text: '20 clean sheets in one season (all competitions)' },
      { key: 'cupShootouts', need: 3, text: '3 cup penalty shoot-outs won in one cup run' },
      { key: 'giantFinal', need: 1, text: 'A cup final won against a club whose team rating is at least 6 higher than yours' },
    ],
    clues: [
      'A cat was seen sitting in the goalmouth before the shoot-out. It winked.',
      'The cat is back, with one paw raised. A glowing six-sided die floated over the crossbar, then vanished.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A sly cat-eared goddess with one paw raised and a glowing die over her shoulder. “Nice goal you’ve got,” says Jinx. “Shame if nobody could score in it.”' },
  },
  {
    id: 'SEC-GOD-3',
    kind: 'god',
    name: 'The golden blur',
    reward: { god: 'GOD3' },
    conditions: [
      { key: 'premier', need: 1, text: 'Be in the Crown Premier League' },
      { key: 'seasonTopScorer', need: 25, text: 'One player scores 25 goals in a season (all competitions)' }, // (M21, Cowork: was 35)
      { key: 'bigWinStreak', need: 5, text: 'Win 5 matches in a row by 2 or more goals' }, // (M21: was 6)
    ],
    clues: [
      'Fans swear a golden blur ran the length of the pitch after the final whistle.',
      'Scorch marks in the shape of little wings on the touchline. The groundsman is not happy.',
    ],
    arrival: { title: 'A strange figure is waiting at the club gates…', line: 'A wiry young god with lightning-bolt hair and wings on his boots skids to a stop. “Race you to the halfway line,” grins Zip. “Too late — I already won.”' },
  },
  {
    id: 'SEC-GOD-4',
    kind: 'god',
    name: 'The gold coins',
    reward: { god: 'GOD4' },
    conditions: [
      { key: 'creditsHeld', need: 1500000, text: 'Hold 1,500,000 Credits at once' }, // (M24: the stadium spends the top club's money — 3 of 5 soak Founders pass it; was 2,000,000 (M23), 250,000 (M21), 1,000,000 (M20b))
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
    kind: 'god',
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
// (M21) The secret tournaments (C09–C14) were SEC-CUP-C09 … C14: since M28 they are the bible's SEC-CUP-01 … 06 in
// data/secrets60.js (old saves are renamed: src/systems/secrets.js normaliseSecrets).
// (M22) The rivalry secrets (bible §32 SEC-RIVAL-02 … 04) on the same checker, so the Secret Engine (M28) finds them.
// SEC-RIVAL-01 (Ghost Eleven) is M28's. No clue stages. Prizes (src/systems/rivals.js secretPrize): 02 — that dynamic
// rivalry becomes permanent; 03 — a rivalry atmosphere bonus (+2% to your XI at home in a rivalry match); 04 — a News chain.
const rivalSecret = (id, name, prize, conditions, line) => ({ id, name, kind: 'rivalry', reward: { rival: prize }, conditions, clues: [], line });
SECRETS.push(
  rivalSecret('SEC-RIVAL-02', 'Rivalry Born', 'permanent', [{ key: 'rivalryBorn', need: 1, text: 'Face the same non-story club in 3 finals or promotion matches, the first two split 1–1' }], 'Three big games, one each, then the decider: this rivalry is for good.'),
  rivalSecret('SEC-RIVAL-03', 'Derby Fever', 'atmosphere', [{ key: 'derbyRun', need: 5, text: 'Win 5 rivalry matches in a row' }], 'The whole town is buzzing: your ground roars louder for every rivalry match (+2% at home).'),
  rivalSecret('SEC-RIVAL-04', 'Poached Captain', 'newsChain', [{ key: 'poachedCaptain', need: 1, text: 'Sign a rival club’s captain after beating that rival 3 times' }], 'You took their captain. The papers will be full of it for weeks.'),
);
// (M23) The secret sponsors (SEC-SPON-01 / 02) and (M28) every other bible secret: data/secrets60.js, with their real triggers.
SECRETS.push(...BIBLE_SECRETS);
// The bible's exactly-60 (the gods' five are extra series secrets on top)
export const BIBLE_IDS = SECRETS.filter((x) => x.kind !== 'god').map((x) => x.id);
export const secretById = (id) => SECRETS.find((s) => s.id === id) ?? null;
export const secretForGod = (godId) => SECRETS.find((s) => s.reward.god === godId) ?? null;
