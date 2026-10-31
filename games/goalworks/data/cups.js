// The tournaments (Milestone 17 → Milestone 21, bible §3 / §22): all 16 as data, the rules in src/systems/cup.js (one
// engine, grown from M17's simple cup).
//   id, name, art            bible §22 id, its name, its picture (assets/images/tournaments)
//   visibility               'visible' | 'prestige' (C08) | 'secret' (C09–C14: "???" until found) | 'secretPrestige'
//                            (C15 / C16: their real triggers are M28 / NG+; ?debug=1 opens them)
//   level, trigger           the bible's words for the Tournaments screen
//   opens                    when it starts running (an edition a season from then):
//                            { league } — while that is your league (it opens when you enter it); (M21) { league, wins }
//                            — in that league, from the day you have that many wins in it (C01); { rank } — from the first
//                            day the club reaches that Club Rank, in any league; { league, seasonBeaten } (M20 C07);
//                            (M21) { wonAll: [cup ids] } — once you have won each of them at least once (C08); { secret }
//                            — once that secret is found (data/secrets.js, C09–C14); { debug: true } — ?debug=1 only
//   size                     teams in the bracket (8: quarter-final, semi-final, final; 4: semi-final, final)
//   teams                    who plays: { league, invite: { league, count } } — you + every club of that league + the
//                            strongest squads of the invited league; { strongest: n } — you + the n strongest other clubs;
//                            { pick: [{ league, count }] } — you + the strongest of each; (M21) { tierMix: true } — you +
//                            clubs drawn from your tier and the tier above (C09–C14)
//   rounds                   the round names, first to last
//   sim                      AI-vs-AI ties: the stronger XI (average overall) wins with 1 / (1 + e^(−diff / scale));
//                            drawChance of them go to penalties (50/50)
//   prize                    for winning it: Credits + reputation (history / momentum) + flags (stored for the systems
//                            that use them: sponsors M23, abilities M26) + (M21) rumour (a clue line in the Rumours list;
//                            the real clue chains are M28) + tokens (Prestige Tokens, kept in the account for NG+, M29);
//                            every cup won writes a line in the club's history. roundWin: Credits for each tie you win
//                            before the final.
//   short, blurb             the sheets' words: "C02 · County cup", who plays
// (M21) Bible §3 chaining: entering books Round 1 seven days later, a win books the next round seven days after the result,
// a loss or the final ends the chain; the other ties of a round are played the same day as yours. One cup holds the chain
// at a time: another that opens meanwhile waits its turn (queued) and starts seven days after the chain ends; one still
// waiting when its season ends is skipped until next season. Knocked out = out until next season's edition. A draw in your
// tie is settled on penalties (50/50; Jinx: 75%).
const QF = ['Quarter-final', 'Semi-final', 'Final'];
const SIM = { scale: 5, drawChance: 0.22 };
const cup = (o) => ({ size: 8, rounds: QF, sim: SIM, prize: { credits: 0, history: 0, momentum: 0, flags: [] }, roundWin: { credits: 0 }, ...o });

export const CUPS = {
  // (M21) bible §22: Regional Cup — opens after 2 Regional wins. "You plus the 5 other Regional clubs" read as the five
  // strongest Regional squads (there are six), plus 2 invited County clubs, so the bracket is 8.
  C01: cup({
    id: 'C01', name: 'Regional Cup', art: 'tournament_c01', visibility: 'visible', level: 'Regional League', trigger: 'Open after 2 Regional wins',
    opens: { league: 'regional', wins: 2 },
    league: 'regional',
    teams: { pick: [{ league: 'regional', count: 5 }, { league: 'county', count: 2 }] },
    prize: { credits: 1500, history: 90, momentum: 25, flags: [] },
    roundWin: { credits: 300 },
    short: 'Regional cup',
    blurb: 'you, five Regional clubs and two invited County clubs',
  }),
  C02: cup({
    id: 'C02', name: 'County Shield', art: 'tournament_c02', visibility: 'visible', level: 'County League', trigger: 'Enter the County League',
    opens: { league: 'county' },
    league: 'county',
    teams: { league: 'county', invite: { league: 'regional', count: 1 } },
    prize: { credits: 3000, history: 180, momentum: 40, flags: ['sponsorInterest'] },
    roundWin: { credits: 500 },
    short: 'County cup',
    blurb: 'you, the six County clubs and one invited Regional club',
  }),
  // (M18) "major reputation"
  C03: cup({
    id: 'C03', name: 'National Knockout', art: 'tournament_c03', visibility: 'visible', level: 'National League', trigger: 'Enter the National League',
    opens: { league: 'national' },
    league: 'national',
    teams: { league: 'national', invite: { league: 'county', count: 1 } },
    prize: { credits: 5000, history: 450, momentum: 80, flags: [] },
    roundWin: { credits: 800 },
    short: 'National cup',
    blurb: 'you, the six National clubs and one invited County club',
  }),
  // (M18) any tier, opens at Rank C; "large prize + club history"
  C04: cup({
    id: 'C04', name: 'Crown Cup', art: 'tournament_c04', visibility: 'visible', level: 'Any tier', trigger: 'Reach Club Rank C',
    opens: { rank: 'C' },
    league: null,
    teams: { strongest: 7 },
    prize: { credits: 8000, history: 300, momentum: 60, flags: [] },
    roundWin: { credits: 1200 },
    short: 'Open cup · any league',
    blurb: 'you and the seven strongest clubs in the land',
  }),
  // (M19) "promotion reputation"; its final is also the Promotion Final once the other Championship conditions are met
  C05: cup({
    id: 'C05', name: 'Championship Trophy', art: 'tournament_c05', visibility: 'visible', level: 'Championship League', trigger: 'Enter the Championship League',
    opens: { league: 'championship' },
    league: 'championship',
    teams: { league: 'championship', invite: { league: 'national', count: 1 } },
    prize: { credits: 7000, history: 650, momentum: 110, flags: [] },
    roundWin: { credits: 1100 },
    short: 'Championship cup',
    blurb: 'you, the six Championship clubs and one invited National club',
  }),
  // (M20) "elite prize"
  C06: cup({
    id: 'C06', name: 'Premier Cup', art: 'tournament_c06', visibility: 'visible', level: 'Crown Premier League', trigger: 'Enter the Crown Premier League',
    opens: { league: 'premier' },
    league: 'premier',
    teams: { league: 'premier', invite: { league: 'championship', count: 1 } },
    prize: { credits: 12000, history: 700, momentum: 120, flags: [] },
    roundWin: { credits: 1800 },
    short: 'Premier cup',
    blurb: 'you, the six Crown Premier clubs and one invited Championship club',
  }),
  // (M20) "top tier, finish top 3 equivalent": 4 different Premier clubs beaten in one season; "global reputation"
  C07: cup({
    id: 'C07', name: 'Continental Masters', art: 'tournament_c07', visibility: 'visible', level: 'Top tier', trigger: 'Beat 4 different Crown Premier clubs in one season',
    opens: { league: 'premier', seasonBeaten: 4 },
    league: null,
    teams: { pick: [{ league: 'premier', count: 5 }, { league: 'championship', count: 2 }] },
    prize: { credits: 15000, history: 1500, momentum: 200, flags: [] },
    roundWin: { credits: 2200 },
    short: 'Top-tier invitational',
    blurb: 'you, the five strongest Crown Premier clubs and the two strongest Championship clubs',
  }),
  // (M21) prestige: once C03, C04, C05, C06 and C07 have each been won; a final four against the strongest Premier sides
  C08: cup({
    id: 'C08', name: 'Five Crowns', art: 'tournament_c08', visibility: 'prestige', level: 'Top tier', trigger: 'Win each of C03–C07 at least once',
    opens: { wonAll: ['C03', 'C04', 'C05', 'C06', 'C07'] },
    league: null,
    size: 4,
    rounds: ['Semi-final', 'Final'],
    teams: { pick: [{ league: 'premier', count: 3 }] },
    prize: { credits: 20000, history: 1500, momentum: 200, flags: [], tokens: 1 },
    roundWin: { credits: 3000 },
    short: 'Prestige final four',
    blurb: 'you and the three strongest Crown Premier clubs',
  }),
  // (M21) the secret tournaments: "???" until found (their triggers are secrets SEC-CUP-C09 … C14, data/secrets.js); then
  // they run at once, and once a season after that. Opponents from your tier and the tier above.
  C09: cup({
    id: 'C09', name: 'Giant Killers Cup', art: 'tournament_c09', visibility: 'secret', level: 'Any', trigger: 'Beat 3 clubs from a higher tier in one cup run',
    opens: { secret: 'SEC-CUP-C09' }, league: null, teams: { tierMix: true },
    prize: { credits: 4000, history: 300, momentum: 60, flags: [], rumour: 'A Secret player was seen in the stands during your Giant Killers final. Nobody knows who invited them…' },
    roundWin: { credits: 600 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  C10: cup({
    id: 'C10', name: 'Youth Masters', art: 'tournament_c10', visibility: 'secret', level: 'Any', trigger: 'Win 6 matches each starting 5+ academy players',
    opens: { secret: 'SEC-CUP-C10' }, league: null, teams: { tierMix: true },
    prize: { credits: 3000, history: 400, momentum: 60, flags: ['youthPrestige'] },
    roundWin: { credits: 500 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  C11: cup({
    id: 'C11', name: 'Redemption Shield', art: 'tournament_c11', visibility: 'secret', level: 'Any', trigger: 'Lose a cup final, then win your next 3 matches',
    opens: { secret: 'SEC-CUP-C11' }, league: null, teams: { tierMix: true },
    prize: { credits: 3500, history: 300, momentum: 60, flags: ['evolutionBoost'] },
    roundWin: { credits: 500 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  C12: cup({
    id: 'C12', name: 'Iron XI Invitational', art: 'tournament_c12', visibility: 'secret', level: 'Any', trigger: '10 competitive matches unbeaten',
    opens: { secret: 'SEC-CUP-C12' }, league: null, teams: { tierMix: true },
    prize: { credits: 4000, history: 300, momentum: 60, flags: ['eliteSponsor'] },
    roundWin: { credits: 600 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  C13: cup({
    id: 'C13', name: 'Clean Sheet Classic', art: 'tournament_c13', visibility: 'secret', level: 'Any', trigger: '6 clean sheets in 8 matches',
    opens: { secret: 'SEC-CUP-C13' }, league: null, teams: { tierMix: true },
    prize: { credits: 3500, history: 300, momentum: 60, flags: [], rumour: 'An old keeper in a grey cap clapped every save in the Clean Sheet Classic. They say he was a Legend once.' },
    roundWin: { credits: 500 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  C14: cup({
    id: 'C14', name: 'Comeback Cup', art: 'tournament_c14', visibility: 'secret', level: 'Any', trigger: 'Win 3 matches after trailing by 2 or more',
    opens: { secret: 'SEC-CUP-C14' }, league: null, teams: { tierMix: true },
    prize: { credits: 3500, history: 300, momentum: 60, flags: [], rumour: 'A Legendary striker sent a note after the Comeback Cup: "Never give up. I never did." No name, just a boot print.' },
    roundWin: { credits: 500 },
    short: 'Secret cup', blurb: 'you and clubs drawn from your tier and the tier above',
  }),
  // (M21) secret prestige: data, art and brackets only — their real triggers (C08 + 35 secrets; C15 + top league + 50
  // secrets at NG+2) are M28 / NG+; ?debug=1 opens them
  C15: cup({
    id: 'C15', name: 'Legends Invitational', art: 'tournament_c15', visibility: 'secretPrestige', level: 'Postgame', trigger: 'Win the Five Crowns and discover 35 secrets (M28)',
    opens: { debug: true }, league: null, teams: { strongest: 7 },
    prize: { credits: 25000, history: 2000, momentum: 250, flags: ['prestigePlayers'] },
    roundWin: { credits: 3500 },
    short: 'Secret prestige', blurb: 'you and the seven strongest clubs in the world',
  }),
  C16: cup({
    id: 'C16', name: 'World Club Masters', art: 'tournament_c16', visibility: 'secretPrestige', level: 'NG+2', trigger: 'Win the Legends Invitational, the top league and discover 50 secrets (NG+)',
    opens: { debug: true }, league: null, teams: { strongest: 7 },
    prize: { credits: 30000, history: 2500, momentum: 300, flags: ['trueTrophy'] },
    roundWin: { credits: 4000 },
    short: 'Secret prestige', blurb: 'you and the seven strongest clubs in the world',
  }),
};
export const CUP_ORDER = Object.keys(CUPS);
// (M21b) The Summer Showcase: a fixed yearly pre-season event on the same engine — a 4-team friendly mini-cup each Month 7
// (window: it starts on the first club day of that month; if it has not got its first tie by the month's end it is
// skipped). You + three clubs from your league and the league around it (teams.around: two of yours + one from the league
// above; at the top, one from below). friendly: it never counts as a competitive match — no league record, no promotion
// wins, no secret / god tallies, no career or season stats, no match reward, items or Research Points (docs/DECISIONS.md).
// Its prize is scaled by your league's tier (tierScale: × 1 Regional … × 5 Premier). Not one of the 16 tournaments: it
// lives beside them (ALL_CUPS) and the Tournaments screen shows it in its own row.
export const FRIENDLIES = {
  SHOW: cup({
    // (art: made in code from baseArt with the gold tint, src/ui/kitArt.js registerTintedArt)
    id: 'SHOW', name: 'Summer Showcase', art: 'showcase_gold', baseArt: 'tournament_c01', tint: '#E0A800', visibility: 'friendly', friendly: true, level: 'Pre-season', trigger: 'Every Month 7',
    opens: { month: 7 }, window: { month: 7 }, league: null,
    size: 4,
    rounds: ['Semi-final', 'Final'],
    teams: { around: true },
    prize: { credits: 500, history: 0, momentum: 25, flags: [] },
    roundWin: { credits: 150 },
    tierScale: true,
    short: 'Pre-season friendly',
    blurb: 'you and three clubs from your league and the league around it',
  }),
};
export const ALL_CUPS = { ...CUPS, ...FRIENDLIES };
export const cupById = (id) => ALL_CUPS[id] ?? null;
export const isFriendlyCup = (id) => !!FRIENDLIES[id];
export const US = 'us'; // your club in a bracket
export const isSecretCup = (c) => c.visibility === 'secret' || c.visibility === 'secretPrestige';

export const CUP_FLAGS = {
  sponsorInterest: { name: 'Sponsor interest', line: 'Sponsors have noticed the club (sponsors arrive in M23).' },
  youthPrestige: { name: 'Youth prestige', line: 'Young players want to join: the academy is famous (stored for later milestones).' },
  evolutionBoost: { name: 'Ability evolution boost', line: 'Stored until abilities evolve (M26).' },
  eliteSponsor: { name: 'Elite sponsor', line: 'An elite sponsor is interested (sponsors arrive in M23).' },
  prestigePlayers: { name: 'Prestige players', line: 'Prestige players arrive with NG+ (M29).' },
  trueTrophy: { name: 'True prestige trophy', line: 'The rarest trophy in the game.' },
};
// The Tournaments screen's status words.
export const CUP_STATUS = { friendly: 'Every Month 7', locked: 'Locked', open: 'Open', queued: 'Queued', running: 'In progress', missed: 'Missed', found: 'Found' };
