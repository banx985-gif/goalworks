// The small secret checker (Milestone 20b; the full Secret Engine, M28, grows from it). Secrets are data (data/secrets.js):
// conditions over named measures, two clue stages, a reward (a god's arrival). Plain functions over the run save
// (data.secrets) and the account record (account.gods: shared by all four slots).
//   data.secrets = { v: 1, track: { season: { year, cleanSheets, goals: { playerId: n } }, streak, bestStreak,
//                    shootouts: { 'C02:3': n }, bestShootouts, giantFinal, creditsPeak, defeatDay, readyDay: { id: day } },
//                    state: { id: { clue: 0 | 1 | 2, found: day | null } }, rumours: [{ day, id, stage, text }] }
//   MEASURES[key](data, account) → number                 progress(data, secret, account) → { rows, frac, met }
//   afterMatch(data, { fixture, score, scorers, cup }, day) — the season and run tallies (clean sheets, goals, the win
//     streak, shoot-outs in a cup run, a giant-killing final, a defeat)
//   secretsDay(data, day, account) → events [{ kind: 'clue' | 'arrival' | 'gone' | 'back', id, god, ... }, accountChanged]
//   rumours(data) → the Rumours list (newest first)      foundRecipes(data, account) → [{ id, name, god, conditions }]
//   forceArrival(data, godId, day) — ?debug=1 and the tests
// (M21) The secret tournaments' triggers (data/secrets.js SEC-CUP-C09 … C14) on the same checker: run tallies (higher-tier
// clubs beaten in one cup run, wins with 5+ academy players, wins straight after a lost cup final, the unbeaten run, clean
// sheets in the last 8, wins after trailing by 2+). Found → the cup opens (event 'cupFound'). forceCup(data, cupId, day).
import { SECRETS, SECRET_RULES, secretForGod } from '../../data/secrets.js';
import { GODS, GOD_IDS, godById } from '../../data/gods.js';
import { RANK_ORDER } from '../../data/facilities.js';
import { US, cupById } from '../../data/cups.js';
import { leagueById } from '../../data/league.js';
import { rank as clubRank, leagueOfClub } from './league.js';
import { strength, normaliseCups } from './cup.js';
import { godAtClub, normaliseGods, normaliseAccountGods, offerFor } from './gods.js';

const YEAR = 336;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;

export function normaliseSecrets(data) {
  data.secrets ??= { v: 1, track: {}, state: {}, rumours: [] };
  const S = data.secrets;
  S.track ??= {};
  const T = S.track;
  T.season ??= { year: 0, cleanSheets: 0, goals: {} };
  T.streak ??= 0;
  T.bestStreak ??= 0;
  T.shootouts ??= {};
  T.bestShootouts ??= 0;
  T.giantFinal ??= 0;
  T.creditsPeak ??= 0;
  T.defeatDay ??= null;
  T.readyDay ??= {};
  // (M21) the secret cups' tallies
  T.giantRuns ??= {};
  T.bestGiantRun ??= 0;
  T.academyWins ??= 0;
  T.redemption ??= { armed: false, run: 0, best: 0 };
  T.unbeaten ??= 0;
  T.bestUnbeaten ??= 0;
  T.last8 ??= [];
  T.bestClean8 ??= 0;
  T.comebacks ??= 0;
  S.state ??= {};
  for (const s of SECRETS) S.state[s.id] ??= { clue: 0, found: null };
  S.rumours ??= [];
  return S;
}

const seasonNow = (T, year) => (T.season.year === year ? T.season : { year, cleanSheets: 0, goals: {} });
const curYear = (data) => yearOf(data.league?.lastDay ?? data.calendar?.clock?.totalDays ?? 1);
const signedCount = (data, account, ids) => ids.filter((id) => account?.gods?.signed?.[id] || data.gods?.signedEver?.[id] != null).length;

// The measures a condition can name (a number: the condition is met at value ≥ need).
export const MEASURES = {
  rank: (data) => RANK_ORDER.indexOf(clubRank(data).id),
  facilitiesL3: (data) => {
    const F = data.facilities;
    return F?.placement ? F.placement.filter((p) => (F.levels?.[p.uid]?.level ?? 1) >= 3).length : 0;
  },
  researchDone: (data) => data.research?.sys?.done?.length ?? 0,
  seasonCleanSheets: (data) => seasonNow(normaliseSecrets(data).track, curYear(data)).cleanSheets,
  cupShootouts: (data) => normaliseSecrets(data).track.bestShootouts,
  giantFinal: (data) => normaliseSecrets(data).track.giantFinal,
  premier: (data) => (data.league?.tier === 'premier' ? 1 : 0),
  seasonTopScorer: (data) => Math.max(0, ...Object.values(seasonNow(normaliseSecrets(data).track, curYear(data)).goals)),
  bigWinStreak: (data) => normaliseSecrets(data).track.bestStreak,
  creditsHeld: (data) => Math.max(normaliseSecrets(data).track.creditsPeak, data.league?.credits ?? 0),
  crownCupWon: (data) => data.cups?.C04?.wins ?? 0,
  godsSigned: (data, account) => signedCount(data, account, ['GOD1', 'GOD2', 'GOD3', 'GOD4']),
  crownTitles: (data, account) => Math.max(account?.gods?.titleRuns?.length ?? 0, data.league?.crownTitle ? 1 : 0),
  // (M21) the secret tournaments
  giantRun: (data) => normaliseSecrets(data).track.bestGiantRun,
  academyWins: (data) => normaliseSecrets(data).track.academyWins,
  redemption: (data) => normaliseSecrets(data).track.redemption.best,
  unbeatenRun: (data) => normaliseSecrets(data).track.bestUnbeaten,
  cleanSheets8: (data) => normaliseSecrets(data).track.bestClean8,
  comebacks: (data) => normaliseSecrets(data).track.comebacks,
};
// (M21) Did you trail by 2 or more at any point? (the goals in order: team 0 is yours; an own goal counts for the side it
// went to)
export function trailedBy2(scorers) {
  let diff = 0;
  let low = 0;
  for (const g of scorers) {
    diff += g.team === 0 ? 1 : -1;
    low = Math.min(low, diff);
  }
  return low <= -2;
}
const tierOf = (id) => leagueById(id)?.tier ?? 0;

export function progress(data, secret, account = null) {
  const rows = secret.conditions.map((c) => {
    const value = MEASURES[c.key](data, account);
    return { ...c, value, met: value >= c.need, frac: Math.max(0, Math.min(1, value / c.need)) };
  });
  const frac = rows.reduce((s, r) => s + r.frac, 0) / rows.length;
  return { rows, frac, met: rows.every((r) => r.met) };
}

// After one of your matches (league or cup). cup: league.recordResult's cup summary ({ won, pens, final, champion, cup }).
// (M21b) A Summer Showcase friendly counts for none of them (it neither builds nor breaks a streak).
export function afterMatch(data, { fixture, score, scorers = [], cup = null, xiIds = [] }, day) {
  if (fixture?.cup && cupById(fixture.cup.id)?.friendly) return;
  const T = normaliseSecrets(data).track;
  const year = yearOf(day);
  if (T.season.year !== year) T.season = { year, cleanSheets: 0, goals: {} };
  const [us, them] = score;
  if (them === 0) T.season.cleanSheets++;
  const byName = new Map(data.squad.players.map((p) => [p.name, p.id]));
  const inXi = new Set(xiIds);
  for (const s of scorers) {
    if (s.team !== 0 || s.own) continue;
    const id = byName.get(s.name);
    if (id && (!xiIds.length || inXi.has(id))) T.season.goals[id] = (T.season.goals[id] ?? 0) + 1;
  }
  T.streak = us - them >= 2 ? T.streak + 1 : 0;
  T.bestStreak = Math.max(T.bestStreak, T.streak);
  const lost = us < them || (cup && !cup.won && us === them);
  if (lost) T.defeatDay = day;
  if (cup && fixture?.cup) {
    const key = `${fixture.cup.id}:${fixture.cup.edition}`;
    if (cup.pens && cup.won) T.shootouts[key] = (T.shootouts[key] ?? 0) + 1;
    T.bestShootouts = Math.max(T.bestShootouts, ...Object.values(T.shootouts), 0);
    T.shootouts = Object.fromEntries(Object.entries(T.shootouts).slice(-12));
    // a giant-killing final: their team rating at least SECRET_RULES.giantGap (M21: 6, was 10) above yours
    if (cup.champion && strength(data, fixture.opponent.id) - strength(data, US) >= SECRET_RULES.giantGap) T.giantFinal = 1;
    // (M21 C09) a club from a higher tier beaten in this cup run
    const theirs = leagueOfClub(fixture.opponent.id)?.tier ?? 0;
    if (cup.won && theirs > tierOf(data.league?.tier)) {
      T.giantRuns[key] = (T.giantRuns[key] ?? 0) + 1;
      T.bestGiantRun = Math.max(T.bestGiantRun, T.giantRuns[key]);
      T.giantRuns = Object.fromEntries(Object.entries(T.giantRuns).slice(-12));
    }
  }
  const won = us > them || (cup?.won && us === them);
  // (M21 C10) a win starting 5+ academy players
  if (won && data.squad.players.filter((p) => inXi.has(p.id) && p.origin === 'academy').length >= 5) T.academyWins++;
  // (M21 C11) a lost cup final arms it; then wins in a row (anything else disarms it)
  const R = T.redemption;
  if (cup?.final && !cup.won) Object.assign(R, { armed: true, run: 0 });
  else if (R.armed) {
    if (won) {
      R.run++;
      R.best = Math.max(R.best, R.run);
    } else Object.assign(R, { armed: false, run: 0 });
  }
  // (M21 C12) unbeaten (a cup tie lost on penalties counts as a defeat)
  T.unbeaten = lost ? 0 : T.unbeaten + 1;
  T.bestUnbeaten = Math.max(T.bestUnbeaten, T.unbeaten);
  // (M21 C13) clean sheets in the last 8
  T.last8 = [...T.last8, them === 0 ? 1 : 0].slice(-8);
  T.bestClean8 = Math.max(T.bestClean8, T.last8.reduce((a, b) => a + b, 0));
  // (M21 C14) a win after trailing by 2+
  if (won && trailedBy2(scorers)) T.comebacks++;
}

function rumour(S, day, id, stage, text) {
  S.rumours = [...S.rumours, { day, id, stage, text }].slice(-40);
}

function openArrival(data, secret, day, { back = false } = {}) {
  const G = normaliseGods(data);
  const god = secret.reward.god;
  G.offers = [...G.offers.filter((o) => o.god !== god), { god, day, until: day + SECRET_RULES.window, secret: secret.id, back }];
  delete G.returnAt[god];
}

// One club day: credits peak, clue stages, arrivals (a 56-day window), windows that close, gods coming back after the
// season's end. → { events, accountChanged }
export function secretsDay(data, day, account = null) {
  const S = normaliseSecrets(data);
  const G = normaliseGods(data);
  const A = account ? normaliseAccountGods(account) : null;
  const events = [];
  let accountChanged = false;
  S.track.creditsPeak = Math.max(S.track.creditsPeak, data.league?.credits ?? 0);
  // the Crown title in the account (Havoc's door)
  if (A && data.league?.crownTitle && data.seed && !A.titleRuns.includes(data.seed)) {
    A.titleRuns = [...A.titleRuns, data.seed];
    accountChanged = true;
  }
  // windows that close: back after the next season's end
  for (const o of G.offers.slice()) {
    if (o.until > day) continue;
    G.offers = G.offers.filter((x) => x !== o);
    G.returnAt[o.god] = (Math.floor(day / YEAR) + 1) * YEAR;
    events.push({ kind: 'gone', god: o.god, id: o.secret });
  }
  // back after a season's end (a closed window, or released)
  for (const [god, at] of Object.entries(G.returnAt)) {
    if (day < at || godAtClub(data, god) || offerFor(data, god)) continue;
    const secret = secretForGod(god);
    if (!S.state[secret.id]?.found) continue;
    openArrival(data, secret, day, { back: true });
    events.push({ kind: 'arrival', god, id: secret.id, back: true });
  }
  for (const secret of SECRETS) {
    const st = S.state[secret.id];
    if (st.found) continue;
    if (secret.needs && secret.needs.some((g) => !(A?.signed?.[g] || G.signedEver[g] != null))) {
      // (Havoc: no clues at all until the other four have been signed somewhere)
      continue;
    }
    const pr = progress(data, secret, account);
    const stage = secret.clues.length ? SECRET_RULES.clueAt.filter((x) => pr.frac >= x - 1e-9).length : 0; // (M21: a secret cup has no clue stages)
    if (stage > st.clue && (!pr.met || secret.trigger === 'defeat')) { // (Havoc: his clues while he waits for a defeat)
      for (let k = st.clue; k < stage; k++) rumour(S, day, secret.id, k + 1, secret.clues[k]);
      st.clue = stage;
      events.push({ kind: 'clue', id: secret.id, stage, text: secret.clues[stage - 1] });
    }
    if (!pr.met) continue;
    if (secret.trigger === 'defeat') {
      S.track.readyDay[secret.id] ??= day;
      if (S.track.defeatDay == null || S.track.defeatDay < S.track.readyDay[secret.id]) continue; // the next defeat
    }
    if (secret.reward.cup) {
      // (M21) a secret tournament found: it opens now (its first edition today), the recipe in the history and the account
      st.found = day;
      openCup(data, secret.reward.cup, day);
      const c = cupById(secret.reward.cup);
      rumour(S, day, secret.id, 3, `A secret tournament: the ${c.name}!`);
      data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Secret found: the ${c.name} (${secret.conditions.map((x) => x.text).join('; ')})` }].slice(-60);
      if (A && !A.found[secret.id]) {
        A.found[secret.id] = { day, cup: secret.reward.cup, conditions: secret.conditions.map((x) => x.text) };
        accountChanged = true;
      }
      events.push({ kind: 'cupFound', cup: secret.reward.cup, id: secret.id });
      continue;
    }
    st.clue = 2;
    st.found = day;
    rumour(S, day, secret.id, 3, `${godById(secret.reward.god).name} has arrived!`);
    data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Secret found: ${secret.name} (${secret.conditions.map((c) => c.text).join('; ')})` }].slice(-60);
    if (A && !A.found[secret.id]) {
      A.found[secret.id] = { day, god: secret.reward.god, conditions: secret.conditions.map((c) => c.text) };
      accountChanged = true;
    }
    if (!godAtClub(data, secret.reward.god)) {
      openArrival(data, secret, day);
      events.push({ kind: 'arrival', god: secret.reward.god, id: secret.id });
    }
  }
  return { events, accountChanged };
}

export const rumours = (data) => normaliseSecrets(data).rumours.slice().reverse();
// The secrets found (this run, or by any run in the account), with their exact conditions — for the Hall of Fame.
export function foundRecipes(data, account = null) {
  const S = data ? normaliseSecrets(data) : null;
  return SECRETS.filter((s) => S?.state[s.id]?.found != null || account?.gods?.found?.[s.id]).map((s) => ({ id: s.id, name: s.name, god: s.reward.god ?? null, cup: s.reward.cup ?? null, godName: s.reward.god ? godById(s.reward.god).name : cupById(s.reward.cup).name, conditions: s.conditions.map((c) => c.text), here: S?.state[s.id]?.found ?? null }));
}

// ?debug=1 / tests: a god arrives now (his secret counts as found here, not in the account).
export function forceArrival(data, god, day) {
  const S = normaliseSecrets(data);
  const secret = secretForGod(god);
  S.state[secret.id] = { clue: 2, found: S.state[secret.id]?.found ?? day };
  openArrival(data, secret, day);
  return offerFor(data, god);
}
export const GOD_LIST = GOD_IDS.map((id) => GODS[id]);

// (M21) A tournament opens now (a found secret cup; ?debug=1 for C15 / C16): its first edition starts today.
export function openCup(data, cupId, day) {
  data.league.cupsOpen = { ...(data.league.cupsOpen ?? {}), [cupId]: data.league.cupsOpen?.[cupId] ?? day };
  const C = normaliseCups(data)[cupId];
  if (!C.current) C.nextStart = Math.min(C.nextStart ?? day, day);
}
// (M21) ?debug=1 / tests: a secret cup found now (this run only, not the account).
export function forceCup(data, cupId, day) {
  const S = normaliseSecrets(data);
  const secret = SECRETS.find((x) => x.reward.cup === cupId);
  if (secret) S.state[secret.id] = { clue: 0, found: S.state[secret.id]?.found ?? day };
  openCup(data, cupId, day);
}
