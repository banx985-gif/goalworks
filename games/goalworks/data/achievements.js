// Visible achievements, records, club history and the trophy cabinet (Milestone 27, bible §31 / §33). Plain data; the
// rules live in src/systems/achievements.js.
//
// Each achievement: id, name, line (the requirement in plain words), measure (what it counts: a key of MEASURES in the
// system) and need (the count that earns it; 1 = a yes / no), reward { credits } or { rep } (small: logged in DECISIONS).
// Achievements are account-wide (bible §33): once earned, kept for good in every slot and new game.
// A41 Pantheon (M20b) is a Works-series bonus on top of the 40.
const A = (id, name, line, measure, need, reward) => ({ id, name, line, measure, need, reward });
export const ACHIEVEMENT_LIST = [
  A('A01', 'First Whistle', 'Win your first competitive match', 'wins', 1, { credits: 200 }),
  A('A02', 'Three on the Bounce', 'Win 3 competitive matches in a row', 'winRun', 3, { credits: 300 }),
  A('A03', 'Five Alive', 'Win 5 competitive matches in a row', 'winRun', 5, { credits: 500 }),
  A('A04', 'Ten Unbeaten', 'Go 10 competitive matches unbeaten', 'unbeaten', 10, { credits: 600 }),
  A('A05', 'Clean Start', 'Keep your first clean sheet', 'cleanSheets', 1, { credits: 200 }),
  A('A06', 'Goal Rush', 'Score 5 or more in one match', 'mostScored', 5, { credits: 400 }),
  A('A07', 'Late Drama', 'Score a winner after 85′', 'lateWinners', 1, { credits: 400 }),
  A('A08', 'Comeback', 'Win after trailing by 2', 'comebacks', 1, { credits: 600 }),
  A('A09', 'Ten Men', 'Win after one of yours is sent off', 'tenMenWins', 1, { credits: 500 }),
  A('A10', 'Regional Kings', 'Clear Regional promotion', 'flag:A10', 1, { rep: 20 }),
  A('A11', 'County Kings', 'Clear County promotion', 'flag:A11', 1, { rep: 30 }),
  A('A12', 'National Kings', 'Clear National promotion', 'flag:A12', 1, { rep: 40 }),
  A('A13', 'Championship Kings', 'Clear Championship promotion', 'flag:A13', 1, { rep: 50 }),
  A('A14', 'Top Flight', 'Reach the Crown Premier League', 'flag:A14', 1, { rep: 50 }),
  A('A15', 'Crown Champions', 'Win the top-flight title chain', 'flag:A15', 1, { rep: 100 }),
  A('A16', 'Cup Winner', 'Win your first cup', 'cupsWon', 1, { credits: 800 }),
  A('A17', 'Five Crowns', 'Win the Five Crowns (C08)', 'fiveCrowns', 1, { rep: 100 }),
  A('A18', 'Youth Debut', 'Start an academy player', 'academyStarters', 1, { credits: 300 }),
  A('A19', 'Youth XI', 'Start 5 academy players in one match', 'academyStarters', 5, { credits: 800 }),
  A('A20', 'Wonderkid', 'Develop an academy player to an Elite rating (overall 85)', 'eliteAcademy', 1, { rep: 40 }),
  A('A21', 'One Club', 'Keep your Founder at the club for 15 years', 'founderYears', 15, { rep: 50 }),
  A('A22', 'Club Legend', 'One player makes 200 appearances', 'mostApps', 200, { credits: 1000 }),
  A('A23', 'Century', 'One player scores 100 goals', 'mostGoals', 100, { credits: 1000 }),
  A('A24', 'Wall', 'One keeper keeps 50 clean sheets', 'keeperCleanSheets', 50, { credits: 1000 }),
  A('A25', 'Assist King', 'One player makes 75 assists', 'mostAssists', 75, { credits: 1000 }),
  A('A26', 'Record Sale', 'Sell a player for a record-tier fee (25,000 Credits)', 'bestSale', 25000, { rep: 30 }),
  A('A27', 'Free Bargain', 'Sign a free agent who becomes Elite (overall 85)', 'eliteFree', 1, { rep: 30 }),
  A('A28', 'Home Grown', 'Win a cup with 6 academy players in the match squad', 'homeGrownCup', 1, { rep: 40 }),
  A('A29', 'Full House', 'Own every normal facility', 'facilitiesOwned', 33, { rep: 50 }),
  A('A30', 'Research Club', 'Complete all 36 visible research', 'researchDone', 36, { rep: 50 }),
  A('A31', 'Packed Ground', 'Sell out the biggest normal stadium (the Crown Stadium)', 'topSellOut', 1, { rep: 50 }),
  A('A32', 'Fan Favourite', 'Reach the top Fan Trust band (Adoring)', 'fanTop', 1, { rep: 40 }),
  A('A33', 'Sponsor Magnet', 'Hold 3 elite sponsor deals (over all your clubs)', 'eliteDeals', 3, { rep: 40 }),
  A('A34', 'Tactical Mind', 'Win using 6 different formations', 'formationsWon', 6, { credits: 800 }),
  A('A35', 'Player Manager', 'Win 25 matches with manual Play used', 'manualWins', 25, { credits: 1000 }),
  A('A36', 'Pure Manager', 'Win 25 matches without manual Play', 'pureWins', 25, { credits: 1000 }),
  A('A37', 'Penalty Nerves', 'Win a shoot-out', 'shootoutWins', 1, { credits: 400 }),
  A('A38', 'Perfect Season', 'Finish a campaign year unbeaten in competitive matches (10+ played)', 'perfectSeasons', 1, { rep: 80 }),
  A('A39', 'Legend Hunter', 'Recruit a Legendary player', 'legendSigned', 1, { rep: 60 }),
  A('A40', 'Beyond the Crown', 'Unlock your first prestige competition', 'prestigeOpen', 1, { rep: 60 }),
  A('A41', 'Pantheon', 'Sign all five Works Gods (a Works series bonus)', 'flag:A41', 1, { rep: 100 }),
];
export const achievementById = (id) => ACHIEVEMENT_LIST.find((a) => a.id === id) ?? null;
export const ACHV_RULES = {
  eliteOverall: 85, // "Elite rating" (A20 / A27): an overall a generated Standard / Rare player can't be born with
  recordFee: 25000, // A26's record-tier fee
  lateMinute: 86, // A07: the winning goal from 86′ on ("after 85′")
  perfectMin: 10, // A38: at least this many competitive matches in the year
  eliteSponsorTiers: ['Elite', 'Global', 'Secret', 'Secret prestige'],
  prestigeCups: ['prestige', 'secret', 'secretPrestige'], // A40: the cups' visibility that counts as prestige
  icon: 'ui_27', // the Club Menu's Achievement icon (M12b art)
};

// Records (the Records page): the club's, kept with the previous holder. text: how the value reads.
export const CLUB_RECORDS = [
  { id: 'bigWin', name: 'Biggest win' },
  { id: 'unbeaten', name: 'Longest unbeaten run' },
  { id: 'crowd', name: 'Record crowd' },
  { id: 'sale', name: 'Record sale' },
  { id: 'signing', name: 'Record signing' },
  { id: 'seasonGoals', name: 'Most goals in a season (a player)' },
  { id: 'teamGoals', name: 'Most goals in a season (the team)' },
];
// Player career records come from M16's club records (data/careers.js RECORD_KEYS: apps, goals, assists, clean sheets).

// History: each line has a type (its icon and filter).
export const HISTORY_TYPES = {
  promotion: { name: 'Promotions', icon: 'trophy_01' },
  cup: { name: 'Cups', icon: 'trophy_02' },
  award: { name: 'Awards', icon: 'trophy_10' },
  stadium: { name: 'Stadium', icon: 'club_stage_01' },
  god: { name: 'Gods', icon: 'ui_28' },
  secret: { name: 'Secrets', icon: 'ui_28' },
  milestone: { name: 'Milestones', icon: 'trophy_14' },
  achievement: { name: 'Achievements', icon: 'ui_27' },
  club: { name: 'Club', icon: 'ui_29' },
};
// The old history lines (before M27 they had no type): read from their words.
export const HISTORY_GUESS = [
  [/^Promoted|promotion|CROWN CHAMPIONS/i, 'promotion'],
  [/^Won the /i, 'cup'],
];
// Milestone moments (a history line each, once).
export const MILESTONES = [
  { id: 'match100', measure: 'matches', at: 100, text: 'The club’s 100th competitive match' },
  { id: 'match500', measure: 'matches', at: 500, text: 'The club’s 500th competitive match' },
  { id: 'goal1000', measure: 'goals', at: 1000, text: 'The club’s 1,000th goal' },
  { id: 'firstStar', measure: 'starsSigned', at: 1, text: 'The first Star signed' },
  { id: 'firstSellOut', measure: 'sellOuts', at: 1, text: 'The first sell-out crowd' },
  { id: 'firstGod', measure: 'godsSigned', at: 1, text: 'A Works God joins the club' },
];

// The trophy cabinet: what each trophy looks like (art in assets/images/trophies; the secret cups use their own badge).
export const TROPHY_ART = { promotion: 'trophy_01', C01: 'trophy_02', C02: 'trophy_03', C03: 'trophy_04', C04: 'trophy_05', C05: 'trophy_06', C06: 'trophy_07', crown: 'trophy_07', C07: 'trophy_08', C08: 'trophy_09', boot: 'trophy_10', glove: 'trophy_11', young: 'trophy_12', manager: 'trophy_13' };
