// The cups (Milestone 17, bible §22): a simple reusable knockout — data only here, the rules in src/systems/cup.js. M21's
// full tournament engine extends this (more cups, other formats) rather than replacing it.
//   id, name, art            bible §22 id, its name, its picture (assets/images/tournaments)
//   opens                    when it starts running for good (M18): { league } — while that is your league (it opens when
//                            you enter it); { rank } — from the first day the club reaches that Club Rank, in any league
//   teams                    who plays: { league, invite: { league, count } } — you + every club of that league + the
//                            strongest squads of the invited league; { strongest: n } (M18) — you + the n strongest other
//                            clubs in the world when the edition starts
//   rounds                   the round names, first to last (8 teams → quarter-final, semi-final, final)
//   firstTieDays / gapDays   the first tie this many days after the edition opens, then one round every gapDays (each
//                            tie a normal fixture on the M2 rules: it takes the week's slot — your tie is fixed 7 days
//                            ahead and no league challenge can be accepted in its place). (M18) Two of your cup ties never
//                            fall in the same week: the later cup's round moves back a week.
//   sim                      AI-vs-AI ties: the stronger XI (average overall) wins with 1 / (1 + e^(−diff / scale));
//                            drawChance of them go to penalties (50/50)
//   prize                    for winning it: Credits + reputation (history / momentum) + flags (sponsor interest — the
//                            sponsors are M23); (M18) every cup won also writes a line in the club's history (the Hall
//                            of Fame sheet — the C04 "club history" prize; promotions write one too); roundWin: Credits
//                            for each tie you win before the final
//   short, blurb             (M18) the sheets' words: "C02 · County cup", who plays
//   An edition a season: the next opens on Day 1 of the following year (or as soon as the last one ends, if later).
//   Knocked out = out until next season's edition. A draw in your tie is settled on penalties (50/50).
export const CUPS = {
  C02: {
    id: 'C02',
    name: 'County Shield',
    art: 'tournament_c02',
    opens: { league: 'county' },
    league: 'county',
    teams: { league: 'county', invite: { league: 'regional', count: 1 } },
    rounds: ['Quarter-final', 'Semi-final', 'Final'],
    firstTieDays: 14,
    gapDays: 28,
    sim: { scale: 5, drawChance: 0.22 },
    prize: { credits: 3000, history: 180, momentum: 40, flags: ['sponsorInterest'] },
    roundWin: { credits: 500 },
    short: 'County cup',
    blurb: 'you, the six County clubs and one invited Regional club',
  },
  // (M18) bible §22: opens when you enter the National League; "major reputation"
  C03: {
    id: 'C03',
    name: 'National Knockout',
    art: 'tournament_c03',
    opens: { league: 'national' },
    league: 'national',
    teams: { league: 'national', invite: { league: 'county', count: 1 } },
    rounds: ['Quarter-final', 'Semi-final', 'Final'],
    firstTieDays: 14,
    gapDays: 28,
    sim: { scale: 5, drawChance: 0.22 },
    prize: { credits: 5000, history: 450, momentum: 80, flags: [] },
    roundWin: { credits: 800 },
    short: 'National cup',
    blurb: 'you, the six National clubs and one invited County club',
  },
  // (M19) bible §22: opens when you enter the Championship; "promotion reputation". Its final is also the Promotion Final
  // once the other Championship conditions are met (data/league.js).
  C05: {
    id: 'C05',
    name: 'Championship Trophy',
    art: 'tournament_c05',
    opens: { league: 'championship' },
    league: 'championship',
    teams: { league: 'championship', invite: { league: 'national', count: 1 } },
    rounds: ['Quarter-final', 'Semi-final', 'Final'],
    firstTieDays: 14,
    gapDays: 28,
    sim: { scale: 5, drawChance: 0.22 },
    prize: { credits: 7000, history: 650, momentum: 110, flags: [] },
    roundWin: { credits: 1100 },
    short: 'Championship cup',
    blurb: 'you, the six Championship clubs and one invited National club',
  },
  // (M18) bible §22: any tier, opens at Rank C; "large prize + club history". The first tie comes three weeks in, so it
  // seldom meets a league cup's quarter-final in the same week (and if it does, it moves back a week).
  C04: {
    id: 'C04',
    name: 'Crown Cup',
    art: 'tournament_c04',
    opens: { rank: 'C' },
    league: null,
    teams: { strongest: 7 },
    rounds: ['Quarter-final', 'Semi-final', 'Final'],
    firstTieDays: 21,
    gapDays: 28,
    sim: { scale: 5, drawChance: 0.22 },
    prize: { credits: 8000, history: 300, momentum: 60, flags: [] },
    roundWin: { credits: 1200 },
    short: 'Open cup · any league',
    blurb: 'you and the seven strongest clubs in the land',
  },
};
export const cupById = (id) => CUPS[id] ?? null;
export const US = 'us'; // your club in a bracket

export const CUP_FLAGS = { sponsorInterest: { name: 'Sponsor interest', line: 'Sponsors have noticed the club (sponsors arrive in M23).' } };
