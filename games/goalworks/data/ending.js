// The Year-25 ending and New Game+ (Milestone 29, bible §3 / §33 / §34). Plain data; the rules live in
// src/systems/ending.js, the ceremony in src/ui/endingCeremony.js.
//
// The ending: on the last day of Year 25 the campaign is graded on the bible's 8 parts, each 0–10 (80 in all). A part's
// score is how many of its 10 steps its measure has reached (steps: the value needed for 1 … 10 points). Each part has a
// voice from the cast (Rex hosts; Edith, Del, Priya and Sam speak) and four lines by score band.
// Grades on the total (+ bonuses): C / B / A / S / S+. S+ is rare (Kairosoft lesson): tuned with the auto player
// (25-year soaks, all five Founders; DECISIONS M29).
export const ENDING = {
  year: 25,
  day: 25 * 336, // the last day of Year 25 (the ceremony shows once the club is free)
  his05Bonus: 3, // SEC-HIS-05 Twenty-Five Years: "ending grade bonus"
  ngBonus: 2, // per NG+ level (max 3 levels): a harder run counts for more — the bible's NG+3 "score modifiers"
};
export const GRADES = [
  { id: 'S+', min: 72, line: 'A club for the ages. They will tell this story for a hundred years.' },
  { id: 'S', min: 60, line: 'An outstanding era. Few managers ever build something like this.' },
  { id: 'A', min: 48, line: 'A fine club, built to last. Proud days.' },
  { id: 'B', min: 34, line: 'A good, honest run. The club is better than you found it.' },
  { id: 'C', min: 0, line: 'A start. The foundations are there for whoever comes next.' },
];
export const gradeOf = (total) => GRADES.find((g) => total >= g.min) ?? GRADES[GRADES.length - 1];

// The 8 parts. measure: a key of src/systems/ending.js PART_MEASURES. steps: the value for 1 … 10 points.
const P = (id, name, voice, measure, steps, lines, what) => ({ id, name, voice, measure, steps, lines, what });
export const PARTS = [
  P('climb', 'League climb', 'rex_lamar', 'climb', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    ['We never really got going up the leagues.', 'A climb, but the summit was a long way off.', 'Up and up: the top flight in sight, or reached.', 'From the mud to the Crown. What a climb.'], 'Tiers climbed, the Crown Premier, the Crown title'),
  P('trophies', 'Trophies', 'rex_lamar', 'trophies', [2, 5, 9, 14, 20, 27, 35, 45, 57, 72],
    ['The trophy cabinet echoes.', 'A few nights to remember.', 'Silverware, and plenty of it.', 'They will need a bigger cabinet.'], 'Promotions, the title and every cup won'),
  P('development', 'Player development', 'sam_okafor', 'development', [2, 4, 7, 10, 14, 18, 23, 29, 36, 44],
    ['We bought more than we built.', 'Some lads came on a lot here.', 'Players arrived ordinary and left special.', 'A factory of top players. Every coach dreams of it.'], 'Players grown to 80+ here, Hall of Famers, the best overall'),
  P('academy', 'Academy', 'sam_okafor', 'academy', [1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
    ['The academy was quiet.', 'A few kids made the step up.', 'Home-grown players at the heart of the team.', 'A golden academy: the town’s own sons.'], 'Academy graduates, their games, the Elite ones'),
  P('facilities', 'Facilities and stadium', 'edith_marlow', 'facilities', [12, 18, 25, 32, 40, 48, 57, 67, 78, 90],
    ['The ground is much as we found it.', 'A proper club complex is taking shape.', 'Facilities to envy and a real stadium.', 'A complex and a stadium fit for champions.'], 'Facilities owned and upgraded, the stadium stage'),
  P('finances', 'Finances', 'edith_marlow', 'finances', [5000, 25000, 60000, 120000, 200000, 320000, 480000, 700000, 1000000, 1500000],
    ['The books keep me up at night.', 'We pay our way, just.', 'Healthy accounts. The Board sleeps well.', 'Rich, and run like a business. Superb.'], 'Credits in the bank at the end, never in the red'),
  P('fans', 'Fans and sponsors', 'del_price', 'fans', [20, 35, 50, 62, 74, 85, 96, 107, 118, 130],
    ['The stands were half empty, and so were we.', 'The fans are with you, mostly.', 'A loud, proud ground and good partners.', 'They adore you. The whole town wears the shirt.'], 'Fan Trust and elite sponsor deals'),
  P('records', 'Records and discovery', 'priya_shah', 'records', [4, 8, 13, 19, 26, 33, 41, 50, 60, 72],
    ['Not much for the record books.', 'A few headlines, a few secrets.', 'Records broken, secrets found: a great story.', 'Front pages for years. And what secrets!'], 'Achievements earned and secrets found'),
];
export const partById = (id) => PARTS.find((p) => p.id === id) ?? null;

// New Game+ (bible §33). level 1 … 3; a completion past NG+3 stays on NG+3 rules.
export const NG = {
  maxLevel: 3,
  aiLift: [0, 0.04, 0.07, 0.1], // the AI clubs' players: +% to every stat at the start of the run
  aiBand: [0, 2, 4, 6], // … and their growth band (careers.js): overall points higher
  rivalHeat: [0, 10, 20, 30], // a story rival's meter starts this much hotter
  ghostLift: [0, 0, 0.06, 0.1], // RV08 Ghost Eleven's players: +% (NG+2 "stronger")
  legacy: { age: 24, share: 0.82, cap: 80 }, // a Legacy Player: young-ish, his old stats × share, no stat above cap
  legacyPlayers: [0, 1, 1, 1],
  legacyStaff: [0, 0, 1, 1],
};
// The true ending (SEC-NGP-05 Beyond Football): its steps, one tap each.
export const TRUE_ENDING = [
  { face: 'rex_lamar', title: 'Beyond Football', line: 'Ladies and gentlemen… there is nothing left to find.' },
  { face: 'sam_okafor', title: 'Every secret', line: 'Fifty-nine secrets, five legends from the stars, and the World Club Masters. Boss, you did all of it.' },
  { face: 'edith_marlow', title: 'The Board', line: 'From a muddy pitch and a tea hut to the greatest club on earth. The Board has nothing more to ask.' },
  { face: 'del_price', title: 'The fans', line: 'They will sing about this club when we are all long gone.' },
  { face: 'priya_shah', title: 'The last word', line: 'The Evening Whistle prints its final edition on GOALWORKS: “The club that went beyond football.”' },
  { face: 'rex_lamar', title: 'Thank you for playing', line: 'GOALWORKS, by Banx Games. The club goes on: play on as long as you like.' },
];
