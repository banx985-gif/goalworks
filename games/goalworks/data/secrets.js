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
  giantGap: 6, // (M21, Cowork: was 10) Jinx's giant-killing final: their team rating at least this much above yours
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
// (M21) The secret tournaments' triggers (bible §22, C09–C14): registered here so the Secret Engine (M28) finds them. No
// clue stages; found → the cup opens (a one-tap pop-up reveals its name and art) and runs at once, then once a season.
const cupSecret = (cupId, name, conditions) => ({ id: `SEC-CUP-${cupId}`, name, kind: 'tournament', reward: { cup: cupId }, conditions, clues: [] });
SECRETS.push(
  cupSecret('C09', 'Giant killers', [{ key: 'giantRun', need: 3, text: 'Beat 3 clubs from a higher tier in one cup run' }]),
  cupSecret('C10', 'The youth', [{ key: 'academyWins', need: 6, text: 'Win 6 matches each starting 5 or more academy players' }]),
  cupSecret('C11', 'Redemption', [{ key: 'redemption', need: 3, text: 'Lose a cup final, then win your next 3 matches' }]),
  cupSecret('C12', 'Iron XI', [{ key: 'unbeatenRun', need: 10, text: '10 competitive matches unbeaten' }]),
  cupSecret('C13', 'Clean sheets', [{ key: 'cleanSheets8', need: 6, text: '6 clean sheets in 8 matches' }]),
  cupSecret('C14', 'Comebacks', [{ key: 'comebacks', need: 3, text: 'Win 3 matches after trailing by 2 or more' }]),
);
// (M22) The rivalry secrets (bible §32 SEC-RIVAL-02 … 04) on the same checker, so the Secret Engine (M28) finds them.
// SEC-RIVAL-01 (Ghost Eleven) is M28's. No clue stages. Prizes (src/systems/rivals.js secretPrize): 02 — that dynamic
// rivalry becomes permanent; 03 — a rivalry atmosphere bonus (+2% to your XI at home in a rivalry match); 04 — a News chain.
const rivalSecret = (id, name, prize, conditions, line) => ({ id, name, kind: 'rivalry', reward: { rival: prize }, conditions, clues: [], line });
SECRETS.push(
  rivalSecret('SEC-RIVAL-02', 'Rivalry Born', 'permanent', [{ key: 'rivalryBorn', need: 1, text: 'Face the same non-story club in 3 finals or promotion matches, the first two split 1–1' }], 'Three big games, one each, then the decider: this rivalry is for good.'),
  rivalSecret('SEC-RIVAL-03', 'Derby Fever', 'atmosphere', [{ key: 'derbyRun', need: 5, text: 'Win 5 rivalry matches in a row' }], 'The whole town is buzzing: your ground roars louder for every rivalry match (+2% at home).'),
  rivalSecret('SEC-RIVAL-04', 'Poached Captain', 'newsChain', [{ key: 'poachedCaptain', need: 1, text: 'Sign a rival club’s captain after beating that rival 3 times' }], 'You took their captain. The papers will be full of it for weeks.'),
);
// (M23) The secret sponsors (bible §32 SEC-SPON-01 / 02): registered here so the Secret Engine (M28) finds them, with the
// bible's exact requirements as their words. Their real triggers are M28's: until then the one measure, m28, is always 0, so
// only ?debug=1 (Finances → Debug) can unlock SP09 Legacy Athletic / SP10 Zero Eleven. No clue stages.
const sponsorSecret = (id, name, sponsor, text) => ({ id, name, kind: 'sponsor', reward: { sponsor }, conditions: [{ key: 'm28', need: 1, text }], clues: [] });
SECRETS.push(
  sponsorSecret('SEC-SPON-01', 'Legacy Athletic', 'SP09', 'Win C10; develop 2 academy players to Elite; Fan Trust 90+'),
  sponsorSecret('SEC-SPON-02', 'Zero Eleven', 'SP10', 'NG+2; win C15; recruit 3 Secret players; Global Reputation max tier'),
);
export const secretById = (id) => SECRETS.find((s) => s.id === id) ?? null;
export const secretForGod = (godId) => SECRETS.find((s) => s.reward.god === godId) ?? null;
