// The bible's 60 secrets (Milestone 28, bible §32), as data for the one secret checker (src/systems/secrets.js, grown from
// M20b's). data/secrets.js keeps the five Works Gods' secrets (extra series secrets on top of the 60) and pulls these in.
// Each: id (the bible's), name, kind (player | ability | tournament | facility | behaviour | sponsor | rivalry | history |
// ngplus), conditions [{ key, need, text }] (key: a measure in src/systems/secrets.js MEASURES; met at value ≥ need),
// clues [first, clearer] (shown at about a third and two thirds of the way: bible "silhouette / cryptic clue"), reward, and
// ng (the NG+ level it needs: 0 = any run; it switches on by itself once the run's NG+ level is that high — M29).
// Rewards: { player } (a Legendary / Secret Featured Player's arrival: a 56-day window, back next season if missed),
// { cup }, { sponsor }, { rival }, { facility } (unlocks a secret facility), { unlock: name } (a named unlock: an evolution
// path, a training, a cosmetic with no art yet …), { tokens } (Prestige Tokens, account), { grant } (an ability, M26 slot
// rules), { flag } (a run modifier). Several may combine.
const S = (id, name, kind, conditions, clues, reward, ng = 0) => ({ id, name, kind, conditions, clues, reward, ng });
const C = (key, need, text) => ({ key, need, text });
const NG = (n) => C('ngLevel', n, `New Game+ ${n}`);

export const BIBLE_SECRETS = [
  // --- Players (Legendary L1–L5, Secret S1–S5) --------------------------------------------------------------------------
  S('SEC-PLY-L1', 'Marco Crown', 'player', [C('seasonCleanSheets', 12, 'Keep 12 clean sheets in one campaign year'), C('cup:C13', 1, 'Win the Clean Sheet Classic (C13)'), C('facLevel:F21', 3, 'Goalkeeper Zone at level 3')],
    ['A keeper in a gold-trimmed shirt was seen watching training from the car park.', 'He left a glove on the Goalkeeper Zone fence. It has a crown stitched on the cuff.'], { player: 'GK09' }),
  S('SEC-PLY-S1', 'Zero Vale', 'player', [NG(1), C('runCleanSheets', 25, '25 clean sheets in one run'), C('cup:C15', 1, 'Win the Legends Invitational (C15)'), C('recruited:GK09', 1, 'Marco Crown recruited (any run)')],
    ['Nobody has scored past the shadow keeper in the park for a year.', 'Zero, they call him. Zero goals, zero words.'], { player: 'GK10' }, 1),
  S('SEC-PLY-L2', 'Rex Barr', 'player', [C('oneGoalWins', 8, 'Win 8 matches by exactly one goal'), C('captainMorale', 80, 'Your captain at 80+ morale'), C('facLevel:F20', 3, 'Defensive Drill Yard at level 3')],
    ['Somebody keeps tidying the Defensive Drill Yard at dawn and leaving the cones in a perfect line.', 'A big man in an iron-grey armband asked the groundsman how tight your games have been.'], { player: 'DF09' }),
  S('SEC-PLY-S2', 'Atlas Venn', 'player', [NG(1), C('cleanSheetWins', 10, 'Win 10 matches without conceding'), C('recruited:DF09', 1, 'Rex Barr recruited (any run)'), C('secretsFound', 25, 'Discover 25 secrets')],
    ['A wall of a man walked through the training ground and the fence moved, not him.', 'They say Atlas only plays for a club that keeps its secrets.'], { player: 'DF10' }, 1),
  S('SEC-PLY-L3', 'Silas Quill', 'player', [C('keyPasses10', 60, '60 team key passes across 10 wins'), C('facLevel:F19', 3, 'Passing Grid at level 3'), C('cup:C07', 1, 'Win the Continental Masters (C07)')],
    ['Chalk lines appeared overnight on the Passing Grid: every one a perfect through ball.', 'A quiet midfielder with ink on his fingers wants to know how many chances your team makes.'], { player: 'MF09' }),
  S('SEC-PLY-S3', 'Nova Rune', 'player', [NG(2), C('unbeatenRun', 15, 'A 15-match unbeaten run'), C('recruited:MF09', 1, 'Silas Quill recruited (any run)'), C('cup:C15', 1, 'Win the Legends Invitational (C15)')],
    ['Runes glow on the centre circle after night games.', 'Time slows down when she has the ball, they whisper.'], { player: 'MF10' }, 2),
  S('SEC-PLY-L4', 'Sora Jet', 'player', [C('runAssists', 40, '40 assists in the current run'), C('wingWins', 5, 'Win 5 matches attacking down a wing (focus Left or Right)'), C('facLevel:F17', 3, 'Skills Cage at level 3')],
    ['A winger nobody can catch was seen racing the 4 o’clock train along the touchline.', 'Footprints in the Skills Cage, and none of them touch the cones.'], { player: 'WG09' }),
  S('SEC-PLY-S4', 'Vega Rush', 'player', [NG(2), C('scoringRun', 12, 'Score in 12 competitive matches in a row'), C('recruited:WG09', 1, 'Sora Jet recruited (any run)'), C('secretsFound', 40, 'Discover 40 secrets')],
    ['A streak of light crossed the pitch and the nets rippled on their own.', 'Vega only comes to a team that never stops scoring.'], { player: 'WG10' }, 2),
  S('SEC-PLY-L5', 'Rex Vantage', 'player', [C('runGoals', 100, 'Score 100 team goals in the current run'), C('cup:C14', 1, 'Win the Comeback Cup (C14)'), C('facLevel:F18', 3, 'Finishing Range at level 3')],
    ['Somebody has been hitting the crossbar on the Finishing Range. Every time. On purpose.', 'An ice-calm striker asked how many goals your club has scored. He did not blink.'], { player: 'FW09' }),
  S('SEC-PLY-S5', 'Orion Zero', 'player', [NG(3), C('cup:C16', 1, 'Win the World Club Masters (C16)'), C('recruited:FW09', 1, 'Rex Vantage recruited (any run)'), C('playerRunGoals', 50, 'One player scores 50 goals in a single run')],
    ['Stars line up over the stadium on cup nights.', 'Orion finishes what no one else can. He is waiting for a 50-goal man.'], { player: 'FW10' }, 3),
  // --- Abilities -------------------------------------------------------------------------------------------------------------
  S('SEC-ABL-01', 'Late Hero', 'ability', [C('lateWinnerPlayer', 5, 'One player scores 5 winners after 85′')], ['The kit man says one of your boys always finds a second wind at the end.', 'Late, later, latest: the fans have a song about him now.'], { unlock: 'Evolution: Calm Under Pressure → Big Match Monster' }),
  S('SEC-ABL-02', 'Dead Ball Master', 'ability', [C('fkGoalsAccount', 8, 'Score 8 direct free kicks (all your clubs)')], ['A ball keeps finding the top corner of the training goal from 25 yards.', 'Someone painted a target on the stanchion. It is worn through.'], { unlock: 'Dead Ball Master training (set-piece sessions +10%)', flag: 'deadBall' }),
  S('SEC-ABL-03', 'Penalty Wall', 'ability', [C('penSavesKeeper', 5, 'One keeper saves 5 penalties')], ['Your keeper has started guessing right. Every time.', 'Takers are looking at him before they run up. He smiles.'], { unlock: 'Penalty Wall (that keeper reads penalties better)', grant: { trait: 'FT02', who: 'penKeeper' } }),
  S('SEC-ABL-04', 'One Club Heart', 'ability', [C('oneClubHeart', 1, 'Keep one non-Founder player 12 years and 150 appearances')], ['One of your players has turned down every offer for years.', 'He has the club crest on his boots, his car and his dog.'], { unlock: 'One Club Heart (his morale never drops below neutral)', flag: 'oneClubHeart' }),
  S('SEC-ABL-05', 'Super Sub', 'ability', [C('subGoals', 10, 'Score 10 goals from substitutes')], ['Your bench is getting a reputation.', 'They warm up like they mean it. The opposition watches them more than the game.'], { unlock: 'Super Sub (substitutes come on sharper: +5% for their minutes)', flag: 'superSub' }),
  S('SEC-ABL-06', 'Last Ditch Hero', 'ability', [C('lastDitchWins', 8, 'Win 8 matches with a last-man tackle or a goal-line block')], ['A sliding tackle on the line has been played on loop in the clubhouse all week.', 'The physio has run out of grass-stain remover.'], { unlock: 'Last Ditch Hero (blocks +10%)', flag: 'lastDitch' }),
  S('SEC-ABL-07', 'Golden Touch', 'ability', [C('goldenTouch', 1, 'Develop a Standard player to 90+ overall')], ['A player nobody rated is suddenly the best on the pitch.', 'Gold dust on the training balls. Someone is turning ordinary into special.'], { unlock: 'Golden Touch: that player’s signature slot opens', grant: { open: 'goldenTouch' } }),
  S('SEC-ABL-08', 'Captain Fantastic', 'ability', [C('captainStarts', 100, 'The same captain starts 100 matches'), C('cupsWon', 3, 'The club wins 3 trophies')], ['The armband has never left his arm.', 'Trophies follow him. So does the team.'], { unlock: 'Captain Fantastic', grant: { ability: 'AB30', who: 'captain' } }),
  S('SEC-ABL-09', 'Impossible Pass', 'ability', [C('throughAssistsPlayer', 20, 'One midfielder sets up 20 goals with through balls')], ['Your midfielder keeps finding a pass that isn’t there.', 'The scouts call it the needle. Nobody else can see the gap.'], { unlock: 'Evolution: Visionary → Thread the Needle' }),
  S('SEC-ABL-10', 'Perfect Finisher', 'ability', [C('bigChancesPlayer', 20, 'One forward converts 20 big chances at 70%+')], ['Your striker never seems to rush a chance.', 'Ice in his veins, they say. One more season like this…'], { unlock: 'Evolution: Predator → Ice Cold' }),
  // --- Tournaments (01–06 were M21's SEC-CUP-C09 … C14) ----------------------------------------------------------------------
  S('SEC-CUP-01', 'Giant Killers Cup', 'tournament', [C('giantRun', 3, 'Beat 3 clubs from a higher tier in one cup run')], [], { cup: 'C09' }),
  S('SEC-CUP-02', 'Youth Masters', 'tournament', [C('academyWins', 6, 'Win 6 matches each starting 5 or more academy players')], [], { cup: 'C10' }),
  S('SEC-CUP-03', 'Redemption Shield', 'tournament', [C('redemption', 3, 'Lose a cup final, then win your next 3 matches')], [], { cup: 'C11' }),
  S('SEC-CUP-04', 'Iron XI', 'tournament', [C('unbeatenRun', 10, '10 competitive matches unbeaten')], [], { cup: 'C12' }),
  S('SEC-CUP-05', 'Clean Sheet Classic', 'tournament', [C('cleanSheets8', 6, '6 clean sheets in 8 matches')], [], { cup: 'C13' }),
  S('SEC-CUP-06', 'Comeback Cup', 'tournament', [C('comebacks', 3, 'Win 3 matches after trailing by 2 or more')], [], { cup: 'C14' }),
  S('SEC-CUP-07', 'Legends Invitational', 'tournament', [C('crownTitle', 1, 'Win the Crown title chain (postgame)'), C('cup:C08', 1, 'Win the Five Crowns (C08)'), C('secretsFound', 35, 'Discover 35 secrets')], ['Old legends are dusting off their boots.', 'An invitation in gold ink is on its way. It needs 35 signatures.'], { cup: 'C15' }),
  S('SEC-CUP-08', 'World Club Masters', 'tournament', [NG(2), C('cup:C15', 1, 'Win the Legends Invitational (C15)'), C('crownTitle', 1, 'Win the Crown title chain'), C('secretsFound', 50, 'Discover 50 secrets')], ['The best clubs on earth are watching you.', 'A globe-shaped trophy is being polished somewhere far away.'], { cup: 'C16' }, 2),
  // --- Facilities / research -----------------------------------------------------------------------------------------------------
  S('SEC-FAC-01', 'Hall of Legends', 'facility', [C('hofPlayers', 5, '5 Hall-of-Fame players from this club'), C('retiredLegends', 3, '3 retired club legends (150+ appearances)'), C('built:F31', 1, 'A Trophy Museum built')], ['The Trophy Museum’s back wall has five empty frames.', 'The old boys keep asking where their portraits will go.'], { facility: 'F34' }),
  S('SEC-FAC-02', 'Hidden Performance Lab', 'facility', [C('researchDone', 36, 'All 36 visible research done'), C('legendsRecruited', 2, 'Recruit 2 Legendary players'), C('rank', 5, 'Club Rank S')], ['A locked door appeared in the research block. It hums.', 'The hum is louder now. Something needs every answer and two legends.'], { facility: 'F35' }),
  S('SEC-FAC-03', 'Academy of Dreams', 'facility', [C('eliteAcademyCount', 3, 'Produce 3 Elite academy players (overall 85) in one run')], ['The academy kids talk about a dream they all had.', 'Three of them, they say. Three who make it to the very top.'], { unlock: 'Elite Academy +10% breakthrough', flag: 'academyDreams' }),
  S('SEC-FAC-04', 'Fortress Ground', 'facility', [C('homeWinRun', 15, 'Win 15 home matches in a row')], ['Visiting teams look nervous in the tunnel.', 'The stands shake. Nobody wins here.'], { unlock: 'Stadium atmosphere prestige upgrade (+3% at home)', flag: 'fortress' }),
  S('SEC-FAC-05', 'Perfect Recovery', 'facility', [C('perfectRecovery', 1, 'A full campaign year with no recurring injury and 20+ matches')], ['The physio has a calendar with no red crosses on it.', 'Nobody hurt twice all year. The medical team want a bonus.'], { unlock: 'Medical prestige upgrade (injuries heal 10% faster)', flag: 'perfectRecovery' }),
  S('SEC-FAC-06', 'World Network', 'facility', [C('scoutedAreas', 12, 'Scout players from 12 home areas'), C('signedScouted', 6, 'Sign 6 of them')], ['Postcards from scouts pile up in the office.', 'Every corner of the map has a pin in it now.'], { unlock: 'Elite Scouting Network prestige tier', flag: 'worldNetwork' }),
  S('SEC-FAC-07', 'Training Culture', 'facility', [C('masteryGroups', 5, 'All five positional groups complete mastery training (60 days each)')], ['The training ground has a rhythm now. Everyone knows the drill.', 'Five drills, five groups, all mastered.'], { unlock: 'Sports Science prestige boost (+5% all training)', flag: 'trainingCulture' }),
  S('SEC-FAC-08', 'Museum Full', 'facility', [C('museumItems', 12, 'Display 12 distinct trophies and records'), C('built:F31', 1, 'A Trophy Museum built')], ['The museum curator is running out of shelves.', 'Twelve plinths, and only a few still empty.'], { unlock: 'Secret museum room', tokens: 1 }),
  // --- Behaviour --------------------------------------------------------------------------------------------------------------
  S('SEC-BEH-01', 'Five Goal Storm', 'behaviour', [C('bigMargin', 5, 'Win by 5 or more')], ['The scoreboard operator asked for more digits.', ''], { unlock: 'A rare forward rumour', tokens: 0, flag: 'fiveGoalStorm' }),
  S('SEC-BEH-02', 'Beautiful Loss', 'behaviour', [C('beautifulLoss', 1, 'Lose with 65%+ possession and 15+ shots, then win the next match')], ['You dominated and lost. The fans clapped anyway.', ''], { unlock: 'Tactical resilience trait (the squad loses less morale after a defeat)', flag: 'resilience' }),
  S('SEC-BEH-03', 'Ten Men Standing', 'behaviour', [C('tenMenEarly', 1, 'Win after a red card before 60′')], ['Ten men, one heart, they sang.', ''], { unlock: 'Iron mentality club record' }),
  S('SEC-BEH-04', 'No Transfers', 'behaviour', [C('promotedNoSigning', 1, 'Earn promotion from a tier without signing a player while in it')], ['The scouts have been on holiday all season.', ''], { unlock: 'Academy / scout prestige clue' }),
  S('SEC-BEH-05', 'Underdog Manager', 'behaviour', [C('underdogWins', 1, 'Beat a club 15+ team-rating points stronger without manual Play')], ['Nobody gave you a chance. You did not need one.', ''], { unlock: 'Legendary coach clue' }),
  S('SEC-BEH-06', 'Hands On', 'behaviour', [C('handsOnWins', 10, 'Win 10 matches where manual Play is 20% or less of the match')], ['You stepped in just when it mattered.', ''], { unlock: 'Player-Manager record' }),
  S('SEC-BEH-07', 'Hands Off', 'behaviour', [C('pureWins', 20, 'Win 20 matches using Manage or Watch only')], ['From the dugout, arms folded.', ''], { unlock: 'Pure Manager record' }),
  S('SEC-BEH-08', 'Perfect Balance', 'behaviour', [C('balanceIdentities', 5, 'Win 5 matches each with possession, counter, press, direct and balanced play')], ['Five ways to win, and you know them all.', ''], { unlock: 'Adaptive tactics prestige clue' }),
  // --- Sponsors / rivals (SEC-RIVAL-02 … 04 were M22's; SEC-SPON-01 / 02 M23's) ------------------------------------------------------
  S('SEC-SPON-01', 'Legacy Athletic', 'sponsor', [C('cup:C10', 1, 'Win the Youth Masters (C10)'), C('eliteAcademyCount', 2, 'Develop 2 academy players to Elite (overall 85)'), C('fanTrust', 90, 'Fan Trust 90+')], [], { sponsor: 'SP09' }),
  S('SEC-SPON-02', 'Zero Eleven', 'sponsor', [NG(2), C('cup:C15', 1, 'Win the Legends Invitational (C15)'), C('secretPlayers', 3, 'Recruit 3 Secret players'), C('rank', 5, 'Global reputation: Club Rank S')], [], { sponsor: 'SP10' }, 2),
  S('SEC-RIVAL-01', 'Ghost Eleven', 'rivalry', [C('crownTitle', 1, 'Win the Crown title chain'), C('beatRivals', 2, 'Beat RV05, RV06 and RV07 at least twice each'), C('secretsFound', 30, 'Discover 30 secrets')], ['A team in grey kits trained on your pitch at midnight. Nobody let them in.', 'They copy everything you do. They are waiting for the champions.'], { rival: 'ghost' }),
  // (SEC-RIVAL-02 … 04 stay as M22 defined them in data/secrets.js)
  // --- History ----------------------------------------------------------------------------------------------------------------
  S('SEC-HIS-01', 'One Club Legend', 'history', [C('founderYears20', 20, 'Your Founder at the club for 20 years'), C('founderApps', 150, 'Your Founder plays 150+ matches')], ['The Founder’s shirt hangs in the dressing room like a flag.', 'Twenty years. One club. Something in him is waking up.'], { unlock: 'The Founder’s signature ability', grant: { ability: 'founderSignature', who: 'founder' } }),
  S('SEC-HIS-02', 'From Mud to Crown', 'history', [C('flag:A14', 1, 'Reach the Crown Premier League'), C('sameIdentity', 1, 'The same club name, colours and crest from the start')], ['The old mud-caked crest still hangs above the tunnel.', ''], { unlock: 'Prestige club crest frame' }),
  S('SEC-HIS-03', 'Golden Generation', 'history', [C('goldenIntake', 3, 'Three academy graduates from one intake reach Elite')], ['One trial day, one generation.', 'Three of them, all from the same year. Remember the date.'], { unlock: 'Golden Generation Hall-of-Fame record' }),
  S('SEC-HIS-04', 'Retired to Return', 'history', [C('legendStaff', 1, 'A 150+ appearance club legend retires and joins the staff')], ['An old favourite keeps turning up at training “just to help”.', ''], { unlock: 'Legacy mentor bonus (+3% training XP)', flag: 'legacyMentor' }),
  S('SEC-HIS-05', 'Twenty-Five Years', 'history', [C('campaignYear', 25, 'Reach Year 25'), C('positiveCredits', 1, 'With positive finances'), C('topTrophy', 1, 'And at least one top-tier trophy')], ['A quarter of a century. The club is planning a party.', ''], { unlock: 'Ending grade bonus', tokens: 3 }),
  // --- New Game+ --------------------------------------------------------------------------------------------------------------
  S('SEC-NGP-01', 'Back to Grassroots', 'ngplus', [NG(1), C('regionalNoSigning', 1, 'Win Regional promotion with only starting / generated Regional players')], ['Back where it all began.', ''], { tokens: 2, unlock: 'Heritage kit palette' }, 1),
  S('SEC-NGP-02', 'Legacy Captain', 'ngplus', [NG(1), C('legacyPlayer', 1, 'Carry a Hall-of-Fame player as your Legacy Player'), C('cup:C04', 1, 'Win the Crown Cup (C04)')], ['An old captain’s armband has been found in the kit room.', ''], { unlock: 'Legacy Captain ability (named)' }, 1),
  S('SEC-NGP-03', 'Perfect Club', 'ngplus', [NG(2), C('allFacilities', 35, 'All 35 facilities'), C('researchDone', 36, 'All 36 research'), C('secretsFound', 45, '45 secrets'), C('crownTitle', 1, 'A top-tier title')], ['Every building, every idea, every secret…', ''], { unlock: 'Prestige club complex skin' }, 2),
  S('SEC-NGP-04', 'Eleven Legends', 'ngplus', [NG(3), C('legendXi', 1, 'An XI averaging 90+ with 5+ home-grown players'), C('cup:C15', 1, 'Win the Legends Invitational (C15)')], ['Eleven names the town will never forget.', ''], { tokens: 5 }, 3),
  S('SEC-NGP-05', 'Beyond Football', 'ngplus', [NG(3), C('cup:C16', 1, 'Win the World Club Masters (C16)'), C('secretPlayers', 5, 'Recruit all 5 Secret players'), C('otherSecrets', 59, 'Discover all the other 59 secrets')], ['Beyond the crown, beyond the game…', 'Fifty-nine secrets, five legends from the stars, one last cup.'], { unlock: 'The true GOALWORKS ending' }, 3),
];
// M21's secret cup ids → the bible's (old saves migrate)
export const OLD_CUP_IDS = { 'SEC-CUP-C09': 'SEC-CUP-01', 'SEC-CUP-C10': 'SEC-CUP-02', 'SEC-CUP-C11': 'SEC-CUP-03', 'SEC-CUP-C12': 'SEC-CUP-04', 'SEC-CUP-C13': 'SEC-CUP-05', 'SEC-CUP-C14': 'SEC-CUP-06' };
// The Founder's signature ability (SEC-HIS-01): the top of his trait's line
export const FOUNDER_SIGNATURE = { GK01: 'AB36', DF01: 'AB32', MF01: 'AB33', WG01: 'AB34', FW01: 'AB35' };
export const SECRET_GROUPS = [
  { kind: 'player', name: 'Players' },
  { kind: 'ability', name: 'Abilities' },
  { kind: 'tournament', name: 'Tournaments' },
  { kind: 'facility', name: 'Facilities and research' },
  { kind: 'behaviour', name: 'Behaviour' },
  { kind: 'sponsor', name: 'Sponsors' },
  { kind: 'rivalry', name: 'Rivals' },
  { kind: 'history', name: 'History' },
  { kind: 'ngplus', name: 'New Game+' },
  { kind: 'god', name: 'Works Gods (series bonus)' },
];
// The run flags' effects (a found secret's reward, data.secrets.flags): read through src/systems/effects.js like a
// facility or research bonus. Flags with no row are named unlocks for now (their effect needs the match engine: DECISIONS).
export const FLAG_FX = {
  deadBall: { 'xp:setpieces': 10 }, // SEC-ABL-02 Dead Ball Master training: set-piece sessions +10%
  trainingCulture: { 'xp:all': 5 }, // SEC-FAC-07 Sports Science prestige boost: +5% all training
  legacyMentor: { 'xp:all': 3 }, // SEC-HIS-04 legacy mentor: +3% training XP
  perfectRecovery: { injuryRecoveryPct: 10 }, // SEC-FAC-05 Medical prestige upgrade: injuries heal 10% faster
  academyDreams: { youthPotential: 1 }, // SEC-FAC-03 Academy of Dreams: a better intake (one research-sized step)
  worldNetwork: { scoutingPct: 10 }, // SEC-FAC-06 Elite Scouting Network: +10% scouting knowledge
};
// (M21 → M28) The secret cups' clue prizes point at real clue chains: winning the cup moves that secret's clue on one stage
// (at least its first clue) in the Secrets Archive.
export const CUP_CLUES = { C09: 'SEC-PLY-S1', C13: 'SEC-PLY-L1', C14: 'SEC-PLY-L5' };
