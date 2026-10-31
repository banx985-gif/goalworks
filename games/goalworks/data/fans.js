// Fan Trust (Milestone 23, bible §26 / §29): 0–100, how much the supporters believe in the club. Plain data; the rules live
// in src/systems/fans.js. It feeds the matchday gate and merch (data/finance.js), the Fans voice at Awards Night and Del
// Price's lines (data/cast.js) when it moves into another band.
//   result: by result, × the opponent's league tier factor; home wins count a little more
//   derby: a rival result (M22 bands: × the band's fans weight); youth: per XI player 21 or under (at most youthMax)
//   favourite sold: a favourite (one of the season's three best, a Star, or 3+ seasons at the club) sold or released
//   events: a cup won, a promotion, the Crown title
//   drift: each week Fan Trust moves this share of the way to the club's history level (base + history, at most cap) —
//          club history holds it up, and it never sticks at 100
export const FAN_TRUST = {
  start: 50,
  result: { win: 0.9, draw: 0.1, loss: -1.4, homeWin: 0.3 },
  derby: { win: 2, loss: -2.5 },
  youth: 0.15,
  youthMax: 0.6,
  favouriteSold: -6,
  favouriteYears: 3,
  cupWon: 4,
  promoted: 6,
  crown: 10,
  drift: 0.05,
  history: { base: 40, perPromotion: 4, perCup: 1.5, perCrown: 8, cap: 75 },
  // an older save: 50 ± its results so far (win share − loss share × spread), plus a little for cups won
  oldSave: { spread: 25, perCup: 1, clamp: 20 },
};

// The bands (Del Price says a line when Fan Trust moves into another one).
export const FAN_BANDS = [
  { id: 'angry', name: 'Angry', min: 0, colour: '#C0392B', up: null, down: 'The terraces are turning, boss. They want answers.' },
  { id: 'restless', name: 'Restless', min: 20, colour: '#E67E22', up: 'The mood is lifting a bit. Keep it going.', down: 'People are grumbling in the stands. A few results would help.' },
  { id: 'steady', name: 'Steady', min: 40, colour: '#6B7B8C', up: 'The fans are back on side. Steady as she goes.', down: 'The buzz has gone a bit flat. They want something to cheer.' },
  { id: 'happy', name: 'Happy', min: 60, colour: '#27AE60', up: 'The Supporters’ Club is buzzing. Ticket queues round the block!', down: 'Still happy, but the singing is quieter than it was.' },
  { id: 'adoring', name: 'Adoring', min: 80, colour: '#D4A017', up: 'They adore this team. I have never heard the ground so loud!', down: null },
];
export const fanBand = (v) => [...FAN_BANDS].reverse().find((b) => v >= b.min) ?? FAN_BANDS[0];
