// The Secret Engine's counters and measures (Milestone 28, bible §32): every number the 60 secrets need, kept exactly — per
// run (data.secrets.track.m28) or per account (account.secretCounts) as the bible says. M27's counters are reused where they
// exist (data.achv.track: wins, pure wins, academy starters …; careers; cups; research; facilities).
//   normaliseM28(T) — the run's counters (an older save: 0, except what the history proves)
//   afterMatchM28(data, args, day, account) — one of your matches: args = { fixture, score, scorers, cup, xiIds, subIds,
//     incidents, stats, manualShare, formation, tactics, home, pst, captainId }
//   dayM28(data, account, day) — the club day: Elite academy players, scouting, mastery days, a perfect-recovery year …
//   M28_MEASURES — key → (data, account) → number (merged into secrets.js MEASURES)
import { ALL_CUPS, US } from '../../data/cups.js';
import { FACILITIES, RANK_ORDER } from '../../data/facilities.js';
import { overall } from './players.js';
import { strength } from './cup.js';
import { rank as clubRank } from './league.js';
import { distinctTrophies } from './records.js';
import { STORY_RIVALS } from '../../data/rivals.js';

const YEAR = 336;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const ELITE = 85;
const MASTERY = { GK: 'goalkeeping', DF: 'defence', MF: 'passing', WG: 'technique', FW: 'attack' };
export const M28_RULES = { underdogGap: 15, handsOnShare: 0.2, beautiful: { possession: 0.65, shots: 15 }, masteryDays: 60, perfectRecoveryMatches: 20, legendApps: 150 };

export function normaliseM28(T, data = null) {
  if (T.m28?.v === 28) return T.m28;
  const fresh = !T.m28;
  const M = Object.assign({ v: 28 }, T.m28 ?? {});
  const z = { oneGoalWins: 0, cleanSheetWins: 0, runCleanSheets: 0, runGoals: 0, runAssists: 0, wingWins: 0, scoringRun: 0, bestScoringRun: 0, lastDitchWins: 0, homeWinRun: 0, bestHomeWinRun: 0, bigMargin: 0, beautifulLoss: 0, lossArmed: 0, tenMenEarly: 0, underdogWins: 0, handsOnWins: 0, subGoals: 0, captainMoraleBest: 0 };
  for (const [k, v] of Object.entries(z)) M[k] ??= v;
  M.players ??= {}; // id → { lateWinners, penSaves, throughAssists, bigChances, bigScored, goals, captainStarts }
  M.keyPassWins ??= []; // key passes in each of the last 10 wins
  M.identities ??= {}; // possession | counter | press | direct | balanced → wins
  M.focusDays ??= {}; // training focus → club days in it
  M.scoutedAreas ??= [];
  M.signedScouted ??= 0;
  M.eliteAcademy ??= []; // ids of academy players who reached Elite this run
  M.goldenIntakes ??= {}; // intake year → ids at Elite
  M.recovery ??= { y: 0, matches: 0, recurring: 0, hurt: [] };
  M.perfectRecovery ??= 0;
  M.tierSignings ??= 0;
  M.promotedNoSigning ??= 0;
  M.regionalNoSigning ??= 0;
  M.identity ??= null; // the club's name / colours / crest at the start (From Mud to Crown)
  if (fresh && data) {
    // an older save: what the history proves — the run's goals and assists (careers), the identity as it is now
    M.runGoals = (data.squad?.players ?? []).reduce((n, p) => n + (p.career?.goals ?? 0), 0) + (data.careers?.retired ?? []).reduce((n, e) => n + (e.goals ?? 0), 0);
    M.runAssists = (data.squad?.players ?? []).reduce((n, p) => n + (p.career?.assists ?? 0), 0) + (data.careers?.retired ?? []).reduce((n, e) => n + (e.assists ?? 0), 0);
  }
  if (data && !M.identity) M.identity = identityOf(data);
  T.m28 = M;
  return M;
}
export const identityOf = (data) => JSON.stringify([data.club?.name ?? '', data.club?.colours ?? null, data.club?.badge ?? null]);
const pl = (M, id) => (M.players[id] ??= { lateWinners: 0, penSaves: 0, throughAssists: 0, bigChances: 0, bigScored: 0, goals: 0, captainStarts: 0 });

// The winning goal's scorer (ours that put us ahead for good) → { name, minute } | null
function winner(scorers) {
  const theirs = scorers.filter((g) => g.team !== 0).length;
  const ours = scorers.filter((g) => g.team === 0);
  return ours.length > theirs ? ours[theirs] : null;
}

export function afterMatchM28(data, { fixture, score, scorers = [], cup = null, xiIds = [], subIds = [], incidents = [], stats = null, manualShare = 0, tactics = null, pst = null, captainId = null }, day, T, account = null) {
  const M = normaliseM28(T, data);
  const [us, them] = score;
  const won = us > them || (cup?.won && us === them);
  const lost = us < them || (cup && !cup.won && us === them);
  const byName = new Map(data.squad.players.map((p) => [p.name, p.id]));
  const home = fixture?.home !== false && !fixture?.cup;
  // goals, assists, the scoring run, clean sheets
  M.runGoals += us;
  M.runAssists += scorers.filter((g) => g.team === 0 && g.assist).length;
  if (them === 0) M.runCleanSheets++;
  M.scoringRun = us > 0 ? M.scoringRun + 1 : 0;
  M.bestScoringRun = Math.max(M.bestScoringRun, M.scoringRun);
  for (const g of scorers) {
    if (g.team !== 0 || g.own) continue;
    const id = byName.get(g.name);
    if (id) pl(M, id).goals++;
    if (g.sub) M.subGoals++;
    if (g.setPiece === 'direct' && account) {
      account.secretCounts ??= {};
      account.secretCounts.fkGoals = (account.secretCounts.fkGoals ?? 0) + 1;
    }
  }
  // the match's per-player tallies (the engine's world.pst, '0:<id>' for ours)
  for (const [k, t] of Object.entries(pst ?? {})) {
    if (!k.startsWith('0:')) continue;
    const P = pl(M, k.slice(2));
    P.penSaves += t.penSaves ?? 0;
    P.throughAssists += t.throughAssists ?? 0;
    P.bigChances += t.bigChances ?? 0;
    P.bigScored += t.bigScored ?? 0;
  }
  if (captainId) pl(M, captainId).captainStarts++;
  // the result
  if (won) {
    if (us - them === 1) M.oneGoalWins++;
    if (them === 0) M.cleanSheetWins++;
    M.bigMargin = Math.max(M.bigMargin, us - them);
    const w = us > them ? winner(scorers) : null;
    if (w && w.minute >= 86) {
      const id = byName.get(w.name);
      if (id) pl(M, id).lateWinners++;
    }
    if ((tactics?.focus === 'left' || tactics?.focus === 'right')) M.wingWins++;
    const ident = tactics?.press === 'high' && (tactics?.build ?? 'balanced') === 'balanced' ? 'press' : tactics?.build ?? 'balanced';
    M.identities[ident] = (M.identities[ident] ?? 0) + 1;
    if (incidents.some((e) => e.type === 'red' && e.team === 0 && e.minute < 60)) M.tenMenEarly++;
    if (incidents.some((e) => e.type === 'lastDitch' && e.team === 0)) M.lastDitchWins++;
    if (manualShare === 0 && fixture?.opponent?.id && strength(data, fixture.opponent.id) - strength(data, US) >= M28_RULES.underdogGap) M.underdogWins++;
    if (manualShare > 0 && manualShare <= M28_RULES.handsOnShare) M.handsOnWins++;
    M.keyPassWins = [...M.keyPassWins, stats?.keyPasses ?? 0].slice(-10);
    if (M.lossArmed) M.beautifulLoss = 1;
  }
  // Beautiful Loss: a defeat while dominating arms it; the next match won fires it (anything else disarms)
  M.lossArmed = lost && stats && (stats.possession ?? 0) >= M28_RULES.beautiful.possession && (stats.shots ?? 0) >= M28_RULES.beautiful.shots ? 1 : 0;
  if (home) {
    M.homeWinRun = won ? M.homeWinRun + 1 : 0;
    M.bestHomeWinRun = Math.max(M.bestHomeWinRun, M.homeWinRun);
  }
  // injuries for the year's recovery record (a player hurt twice in one year: recurring)
  const y = yearOf(day);
  rollRecovery(M, y);
  M.recovery.matches++;
  for (const e of incidents) if (e.type === 'injury' && e.team === 0 && e.id) {
    if (M.recovery.hurt.includes(e.id)) M.recovery.recurring++;
    else M.recovery.hurt.push(e.id);
  }
}
function rollRecovery(M, y) {
  if (M.recovery.y === y) return;
  if (M.recovery.y && M.recovery.matches >= M28_RULES.perfectRecoveryMatches && M.recovery.recurring === 0) M.perfectRecovery = 1;
  M.recovery = { y, matches: 0, recurring: 0, hurt: [] };
}

// The club day: Elite academy players (and their intakes), the captain's morale, training mastery days, the recovery year.
export function dayM28(data, account, day, T) {
  const M = normaliseM28(T, data);
  rollRecovery(M, yearOf(day));
  for (const p of data.squad?.players ?? []) {
    if (p.origin === 'academy' && overall(p) >= ELITE && !M.eliteAcademy.includes(p.id)) {
      M.eliteAcademy.push(p.id);
      const iy = p.youth?.intakeYear;
      if (iy != null) (M.goldenIntakes[iy] ??= []).push(p.id);
    }
    if (p.captain) M.captainMoraleBest = Math.max(M.captainMoraleBest, p.morale ?? 0);
    if (!p.god && (p.tier === 'Legendary' || p.tier === 'Secret') && p.featuredId && account) {
      account.recruited ??= {};
      account.recruited[p.featuredId] ??= day;
    }
  }
  const f = data.training?.focus;
  if (f) M.focusDays[f] = (M.focusDays[f] ?? 0) + 1;
  return M;
}
// (A signing, a scout report, a promotion: src/systems/secretNotes.js notes them.)

// Developed at the club (SEC-ABL-07): a signing who came in under 90; an academy or starting-squad player (never signed)
const developedHere = (p) => (p.joinOvr != null ? p.joinOvr < 90 : !p.joinedFrom);
const facLevel = (data, id) => Math.max(0, ...(data.facilities?.placement ?? []).filter((p) => p.def === id).map((p) => data.facilities.levels?.[p.uid]?.level ?? 1));
const M28 = (d) => d.secrets?.track?.m28 ?? normaliseM28((d.secrets ??= { track: {} }).track ??= {}, d);
const maxPlayer = (d, k) => Math.max(0, ...Object.values(M28(d).players).map((x) => x[k] ?? 0));
const cupWins = (d, id) => d.cups?.[id]?.wins ?? 0;
const recruited = (d, acc, fid) => (acc?.recruited?.[fid] != null || (d.squad?.players ?? []).some((p) => p.featuredId === fid) ? 1 : 0);
export function bibleFound(d, acc, ids) {
  const st = d.secrets?.state ?? {};
  return ids.filter((id) => st[id]?.found != null || acc?.gods?.found?.[id]).length;
}
export const M28_MEASURES = {
  ngLevel: (d) => d.ng?.level ?? 0,
  runCleanSheets: (d) => M28(d).runCleanSheets,
  oneGoalWins: (d) => M28(d).oneGoalWins,
  captainMorale: (d) => M28(d).captainMoraleBest,
  cleanSheetWins: (d) => M28(d).cleanSheetWins,
  keyPasses10: (d) => (M28(d).keyPassWins.length >= 10 ? M28(d).keyPassWins.reduce((a, b) => a + b, 0) : 0),
  runAssists: (d) => M28(d).runAssists,
  wingWins: (d) => M28(d).wingWins,
  scoringRun: (d) => M28(d).bestScoringRun,
  runGoals: (d) => M28(d).runGoals,
  playerRunGoals: (d) => maxPlayer(d, 'goals'),
  lateWinnerPlayer: (d) => maxPlayer(d, 'lateWinners'),
  fkGoalsAccount: (d, acc) => acc?.secretCounts?.fkGoals ?? 0,
  penSavesKeeper: (d) => maxPlayer(d, 'penSaves'),
  oneClubHeart: (d) => ((d.squad?.players ?? []).some((p) => !p.founder && (p.career?.apps ?? 0) >= M28_RULES.legendApps && yearOf(d.league?.lastDay ?? 1) - (p.joinedYear ?? yearOf(p.joinedDay ?? 1)) >= 12) ? 1 : 0),
  subGoals: (d) => M28(d).subGoals,
  lastDitchWins: (d) => M28(d).lastDitchWins,
  goldenTouch: (d) => ((d.squad?.players ?? []).some((p) => p.tier === 'Standard' && !p.god && overall(p) >= 90 && developedHere(p)) ? 1 : 0),
  captainStarts: (d) => maxPlayer(d, 'captainStarts'),
  cupsWon: (d) => Object.entries(d.cups ?? {}).filter(([id]) => ALL_CUPS[id] && !ALL_CUPS[id].friendly).reduce((n, [, C]) => n + (C?.wins ?? 0), 0),
  throughAssistsPlayer: (d) => maxPlayer(d, 'throughAssists'),
  bigChancesPlayer: (d) => Math.max(0, ...Object.values(M28(d).players).filter((x) => x.bigChances > 0 && x.bigScored / x.bigChances >= 0.7).map((x) => x.bigScored)),
  crownTitle: (d) => (d.league?.crownTitle || d.achievements?.A15 ? 1 : 0),
  hofPlayers: (d, acc) => (acc?.hallOfFame ?? []).filter((e) => e.uid?.startsWith(`${d.seed}:`)).length,
  retiredLegends: (d) => (d.careers?.retired ?? []).filter((e) => (e.apps ?? 0) >= M28_RULES.legendApps).length,
  legendsRecruited: (d) => (d.squad?.players ?? []).filter((p) => p.tier === 'Legendary' && !p.god).length + (M28(d).legendsLeft ?? 0),
  eliteAcademyCount: (d) => M28(d).eliteAcademy.length,
  homeWinRun: (d) => M28(d).bestHomeWinRun,
  perfectRecovery: (d) => M28(d).perfectRecovery,
  scoutedAreas: (d) => M28(d).scoutedAreas.length,
  signedScouted: (d) => M28(d).signedScouted,
  masteryGroups: (d) => Object.values(MASTERY).filter((f) => (M28(d).focusDays[f] ?? 0) >= M28_RULES.masteryDays).length,
  museumItems: (d) => distinctTrophies(d) + Object.keys(d.records ?? {}).length,
  bigMargin: (d) => M28(d).bigMargin,
  beautifulLoss: (d) => M28(d).beautifulLoss,
  tenMenEarly: (d) => M28(d).tenMenEarly,
  promotedNoSigning: (d) => M28(d).promotedNoSigning,
  regionalNoSigning: (d) => M28(d).regionalNoSigning,
  underdogWins: (d) => M28(d).underdogWins,
  handsOnWins: (d) => M28(d).handsOnWins,
  pureWins: (d) => d.achv?.track?.pureWins ?? 0,
  balanceIdentities: (d) => ['possession', 'counter', 'press', 'direct', 'balanced'].filter((k) => (M28(d).identities[k] ?? 0) >= 5).length,
  fanTrust: (d) => d.fans?.trust ?? 0,
  secretPlayers: (d, acc) => ['GK10', 'DF10', 'MF10', 'WG10', 'FW10'].filter((f) => recruited(d, acc, f)).length,
  beatRivals: (d) => Math.min(...['RV05', 'RV06', 'RV07'].map((rv) => d.league?.clubs?.[STORY_RIVALS.find((r) => r.id === rv)?.club]?.w ?? 0)), // (wins against each story rival's club)
  founderYears20: (d) => ((d.squad?.players ?? []).some((p) => p.founder) ? yearOf(d.league?.lastDay ?? 1) - 1 : 0),
  founderApps: (d) => (d.squad?.players ?? []).find((p) => p.founder)?.career?.apps ?? 0,
  sameIdentity: (d) => (M28(d).identity === identityOf(d) ? 1 : 0),
  goldenIntake: (d) => Math.max(0, ...Object.values(M28(d).goldenIntakes).map((x) => x.length)),
  legendStaff: (d) => (d.careers?.legacyStaff ?? []).length, // (careers.js: a 150+ appearance legend retires into the staff)
  campaignYear: (d) => yearOf(d.league?.lastDay ?? 1),
  positiveCredits: (d) => ((d.league?.credits ?? 0) > 0 ? 1 : 0),
  topTrophy: (d) => (d.league?.crownTitle || cupWins(d, 'C06') || cupWins(d, 'C07') || cupWins(d, 'C08') ? 1 : 0),
  legacyPlayer: (d) => (d.ng?.legacyPlayer ? 1 : 0),
  allFacilities: (d) => new Set((d.facilities?.placement ?? []).map((p) => p.def)).size,
  // (M29) Eleven Legends: the best eleven (by overall) average 90+, with 5+ of them home-grown (academy graduates)
  legendXi: (d) => {
    const xi = (d.squad?.players ?? []).filter((p) => !p.god).sort((a, b) => overall(b) - overall(a)).slice(0, 11);
    return xi.length === 11 && xi.reduce((n, p) => n + overall(p), 0) / 11 >= 90 && xi.filter((p) => p.origin === 'academy').length >= 5 ? 1 : 0;
  },
};
// cup:<id> (a cup won), facLevel:<id>, built:<id>, recruited:<featured id>, flag:<achievement> — read by name
export function prefixed(key, d, acc) {
  const [k, arg] = key.split(':');
  if (k === 'cup') return cupWins(d, arg);
  if (k === 'facLevel') return facLevel(d, arg);
  if (k === 'built') return (d.facilities?.placement ?? []).some((p) => p.def === arg) ? 1 : 0;
  if (k === 'recruited') return recruited(d, acc, arg);
  if (k === 'flag') return d.achievements?.[arg] || acc?.achievements?.[arg] ? 1 : 0;
  return null;
}
export { RANK_ORDER, clubRank, FACILITIES };
