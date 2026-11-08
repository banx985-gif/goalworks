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
// (M28) The full Secret Engine: the bible's 60 (data/secrets60.js) on this same checker — exact counters (secretMeasures.js:
// per run in data.secrets.track.m28, per account in account.secretCounts / account.recruited), clue stages at a third and
// two thirds, the archive (archive()), every reward (a Legendary / Secret player's arrival — a 56-day window, back next
// season if missed — a cup, a sponsor, RV08, a secret facility, an ability, Prestige Tokens, a named unlock, a run flag).
// An NG+ secret (secret.ng) stays silent until the run's NG+ level is high enough (data.ng.level: M29). M21's cup ids
// SEC-CUP-C09 … C14 are renamed SEC-CUP-01 … 06 in old saves. forceSecret(data, id, day, account): ?debug=1 and the tests.
// (M21) The secret tournaments' triggers (since M28 SEC-CUP-01 … 06) on the same checker: run tallies (higher-tier
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
import { measures as RIVAL_MEASURES, secretPrize, unlockGhost } from './rivals.js'; // (M22) SEC-RIVAL-02 … 04; (M28) RV08
import { BIBLE_IDS } from '../../data/secrets.js';
import { OLD_CUP_IDS, FOUNDER_SIGNATURE } from '../../data/secrets60.js';
import { M28_MEASURES, prefixed, normaliseM28, afterMatchM28, dayM28, bibleFound } from './secretMeasures.js'; // (M28)
import { grant as grantAbility, normaliseAbilities, captainOf, related } from './abilities.js';
import { overall as overallOf } from './players.js';

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
  for (const [old, now] of Object.entries(OLD_CUP_IDS)) {
    // (M28) M21's cup secret ids → the bible's (found stays found)
    if (S.state[old]) S.state[now] ??= S.state[old];
    delete S.state[old];
    for (const r of S.rumours ?? []) if (r.id === old) r.id = now;
  }
  for (const s of SECRETS) S.state[s.id] ??= { clue: 0, found: null };
  normaliseM28(T, data); // (M28)
  S.players ??= { offers: [], returnAt: {} }; // (M28) Legendary / Secret players at the gates
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
  ...RIVAL_MEASURES, // (M22) rivalryBorn, derbyRun, poachedCaptain
  ...M28_MEASURES, // (M28) the 60's counters
  secretsFound: (data, account) => bibleFound(data, account, BIBLE_IDS),
  otherSecrets: (data, account) => bibleFound(data, account, BIBLE_IDS.filter((id) => id !== 'SEC-NGP-05')),
};
// (tests only) a fixed value for some measures: the trigger tests set every condition at / one short of its need
let OVERRIDE = null;
export const __setMeasureOverride = (m) => (OVERRIDE = m);
const measure = (key, data, account) => (OVERRIDE && key in OVERRIDE ? OVERRIDE[key] : MEASURES[key] ? MEASURES[key](data, account) : prefixed(key, data, account) ?? 0);
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

const KEEP_KEYS = ['sameIdentity', 'positiveCredits', 'ngLevel'];
export function progress(data, secret, account = null) {
  const rows = secret.conditions.map((c) => {
    const value = measure(c.key, data, account);
    return { ...c, value, met: value >= c.need, frac: Math.max(0, Math.min(1, value / c.need)) };
  });
  // (M28) a "keep it so" condition (true from the start: the same identity, positive finances, the NG+ level) is no progress
  const prog = rows.filter((r) => !KEEP_KEYS.includes(r.key));
  const frac = prog.length ? prog.reduce((s, r) => s + r.frac, 0) / prog.length : rows.every((r) => r.met) ? 1 : 0;
  return { rows, frac, met: rows.every((r) => r.met) };
}

// After one of your matches (league or cup). cup: league.recordResult's cup summary ({ won, pens, final, champion, cup }).
// (M21b) A Summer Showcase friendly counts for none of them (it neither builds nor breaks a streak).
export function afterMatch(data, { fixture, score, scorers = [], cup = null, xiIds = [], subIds = [], incidents = [], stats = null, manualShare = 0, tactics = null, pst = null, captainId = null, account = null }, day) {
  if (fixture?.cup && cupById(fixture.cup.id)?.friendly) return;
  const T = normaliseSecrets(data).track;
  afterMatchM28(data, { fixture, score, scorers, cup, xiIds, subIds, incidents, stats, manualShare, tactics, pst, captainId }, day, T, account); // (M28)
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
  dayM28(data, account, day, S.track); // (M28)
  // (M28) a Legendary / Secret player's window closes: back after the season's end; back once it has come round again
  const P = S.players;
  for (const o of P.offers.slice()) {
    if (o.until > day) continue;
    P.offers = P.offers.filter((x) => x !== o);
    P.returnAt[o.fid] = (Math.floor(day / YEAR) + 1) * YEAR;
    events.push({ kind: 'playerGone', fid: o.fid, id: o.id });
  }
  for (const [fid, at] of Object.entries(P.returnAt)) {
    if (day < at || data.squad?.players.some((p) => p.featuredId === fid)) continue;
    delete P.returnAt[fid];
    const sec = SECRETS.find((x) => x.reward.player === fid);
    P.offers.push({ fid, day, until: day + SECRET_RULES.window, id: sec?.id ?? null, back: true });
    events.push({ kind: 'playerArrival', fid, id: sec?.id ?? null, back: true });
  }
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
    if (secret.ng && (data.ng?.level ?? 0) < secret.ng) continue; // (M28) an NG+ secret: silent until the run is NG+ that high
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
    if (!secret.reward.god && !secret.reward.cup && !(secret.reward.rival && secret.reward.rival !== 'ghost') && !(secret.reward.sponsor && !secret.kind)) {
      // (M28) the bible's secrets: their rewards
      accountChanged = foundSecret(data, secret, day, account, events) || accountChanged;
      continue;
    }
    if (secret.reward.rival) {
      // (M22) a rivalry secret: its prize now, a Rumours line, the recipe in the history and the account, a one-tap pop-up
      st.found = day;
      const club = secretPrize(data, secret.reward.rival, day);
      rumour(S, day, secret.id, 3, `${secret.name}! ${secret.line}`);
      data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Secret found: ${secret.name} (${secret.conditions.map((x) => x.text).join('; ')})` }].slice(-60);
      if (A && !A.found[secret.id]) {
        A.found[secret.id] = { day, rival: secret.reward.rival, conditions: secret.conditions.map((x) => x.text) };
        accountChanged = true;
      }
      (data.rivals.popups ??= []).push({ kind: 'secret', id: secret.id, day, ...(club ? { clubId: club } : {}) });
      events.push({ kind: 'rivalFound', id: secret.id, club });
      continue;
    }
    if (secret.reward.sponsor) {
      // (M23) a secret sponsor found (M28's real triggers; ?debug=1 forces it): the sponsor can make offers now
      st.found = day;
      rumour(S, day, secret.id, 3, `A secret sponsor: ${secret.name}!`);
      data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Secret found: ${secret.name} (${secret.conditions.map((x) => x.text).join('; ')})` }].slice(-60);
      if (A && !A.found[secret.id]) {
        A.found[secret.id] = { day, sponsor: secret.reward.sponsor, conditions: secret.conditions.map((x) => x.text) };
        accountChanged = true;
      }
      events.push({ kind: 'sponsorFound', sponsor: secret.reward.sponsor, id: secret.id });
      continue;
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

// (M28) A bible secret found: the reward(s), a Rumours line, the recipe in the history and the account. → account changed?
function foundSecret(data, secret, day, account, events) {
  const S = normaliseSecrets(data);
  const A = account ? normaliseAccountGods(account) : null;
  const st = S.state[secret.id];
  st.found = day;
  st.clue = Math.max(st.clue, secret.clues.length ? 2 : 0);
  const r = secret.reward;
  const recipe = secret.conditions.map((x) => x.text);
  let acc = false;
  rumour(S, day, secret.id, 3, `Secret found: ${secret.name}!`);
  data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Secret found: ${secret.name} (${recipe.join('; ')})`, type: 'secret' }].slice(-120);
  if (A && !A.found[secret.id]) {
    A.found[secret.id] = { day, conditions: recipe, kind: secret.kind };
    acc = true;
  }
  if (r.player) {
    S.players.offers = [...S.players.offers.filter((o) => o.fid !== r.player), { fid: r.player, day, until: day + SECRET_RULES.window, id: secret.id }];
    events.push({ kind: 'playerArrival', fid: r.player, id: secret.id });
  }
  if (r.cup) openCup(data, r.cup, day);
  if (r.sponsor) events.push({ kind: 'sponsorFound', sponsor: r.sponsor, id: secret.id });
  if (r.rival === 'ghost') unlockGhost(data, day);
  if (r.facility) events.push({ kind: 'facilityFound', facility: r.facility, id: secret.id });
  if (r.unlock) (S.unlocks ??= {})[secret.id] = r.unlock;
  if (r.flag) (S.flags ??= {})[r.flag] = day;
  if (r.tokens && account) {
    account.prestigeTokens = (account.prestigeTokens ?? 0) + r.tokens;
    acc = true;
  }
  if (r.grant) grantReward(data, secret, r.grant);
  events.push({ kind: 'secretFound', id: secret.id, name: secret.name });
  return acc;
}
// (M28) An ability reward (M26 slot rules): Captain Fantastic to the captain, the Founder's signature ability, Golden Touch's
// open signature slot, Penalty Wall's keeper (Penalty Reader as his innate trait if the slot is free, else a named note).
function grantReward(data, secret, g) {
  const squad = data.squad?.players ?? [];
  const M = data.secrets.track.m28;
  if (g.who === 'captain') {
    const cap = captainOf(squad.filter((p) => !p.god));
    if (cap) S_note(data, secret.id, cap, grantOver(cap, g.ability));
  } else if (g.who === 'founder') {
    const f = squad.find((p) => p.founder);
    if (f) S_note(data, secret.id, f, grantOver(f, FOUNDER_SIGNATURE[data.club?.founder?.id] ?? 'AB33', { open: true })); // (the top of his own line)
  } else if (g.open === 'goldenTouch') {
    const p = squad.find((q) => q.tier === 'Standard' && !q.god && overallOf(q) >= 90 && (q.joinOvr != null ? q.joinOvr < 90 : !q.joinedFrom));
    if (p) {
      normaliseAbilities(p).sigOpen = true;
      S_note(data, secret.id, p, { ok: true });
    }
  } else if (g.who === 'penKeeper') {
    const best = Object.entries(M?.players ?? {}).sort((a, b) => (b[1].penSaves ?? 0) - (a[1].penSaves ?? 0))[0];
    const k = best && squad.find((p) => p.id === best[0]);
    if (k) S_note(data, secret.id, k, normaliseAbilities(k).innate ? { ok: false } : grantAbility(k, g.trait, { slot: 'innate' }));
  }
}
// An ability reward over a weaker form of it: as an evolution does (M26), the weaker form leaves its slot for it (the
// captain's Leader → Captain Fantastic; MF01's Simple Passer → Thread the Needle); the slot rules still decide.
function grantOver(p, id, opts = {}) {
  const A = normaliseAbilities(p);
  const weaker = (x) => x && x !== id && related(x, id);
  if (!grantAbility(JSON.parse(JSON.stringify(p)), id, opts).ok && [A.personality, A.innate, ...A.learned].some(weaker)) {
    if (weaker(A.personality)) A.personality = null;
    if (weaker(A.innate)) A.innate = null;
    A.learned = A.learned.filter((x) => !weaker(x));
  }
  return grantAbility(p, id, opts);
}
function S_note(data, id, p, res) {
  (data.secrets.grants ??= {})[id] = { id: p.id, name: p.name, ok: !!res?.ok };
}
// (M28) Sign a Legendary / Secret player who is at the gates (the arrival window). → the player, or null
export function signPlayer(data, fid, makePlayer, account = null) {
  const S = normaliseSecrets(data);
  const o = S.players.offers.find((x) => x.fid === fid);
  if (!o || data.squad.players.some((p) => p.featuredId === fid)) return null;
  const p = makePlayer(fid);
  data.squad.players.push(p);
  S.players.offers = S.players.offers.filter((x) => x !== o);
  if (account) (account.recruited ??= {})[fid] = data.league?.lastDay ?? 0;
  return p;
}
export const playerOffers = (data) => normaliseSecrets(data).players.offers.slice();
// (M28) ?debug=1 and the tests: a secret found now, its reward as in play
export function forceSecret(data, id, day, account = null) {
  const sec = SECRETS.find((x) => x.id === id);
  if (!sec) return null;
  normaliseSecrets(data);
  if (sec.reward.god) return forceArrival(data, sec.reward.god, day);
  if (sec.reward.cup) {
    forceCup(data, sec.reward.cup, day);
    return true;
  }
  const events = [];
  foundSecret(data, sec, day, account, events);
  return events;
}
// (M28) The Secrets Archive: every secret by group — found (the exact recipe), on its way (the clue reached), or a silhouette.
export function archive(data, account = null) {
  const S = data ? normaliseSecrets(data) : null;
  return SECRETS.map((s) => {
    const here = S?.state[s.id]?.found ?? null;
    const ever = account?.gods?.found?.[s.id] ?? null;
    const found = here != null || !!ever;
    const clue = S?.state[s.id]?.clue ?? 0;
    const locked = s.ng && (data?.ng?.level ?? 0) < s.ng;
    return { id: s.id, name: found ? s.name : '???', kind: s.kind ?? 'god', found, here, recipe: found ? s.conditions.map((c) => c.text) : null, clue: !found && clue ? s.clues[clue - 1] : null, ng: s.ng ?? 0, locked, progress: found || !data ? 1 : progress(data, s, account).frac };
  });
}
export const rumours = (data) => normaliseSecrets(data).rumours.slice().reverse();
// The secrets found (this run, or by any run in the account), with their exact conditions — for the Hall of Fame.
export function foundRecipes(data, account = null) {
  const S = data ? normaliseSecrets(data) : null;
  return SECRETS.filter((s) => S?.state[s.id]?.found != null || account?.gods?.found?.[s.id]).map((s) => ({ id: s.id, name: s.name, god: s.reward.god ?? null, cup: s.reward.cup ?? null, godName: s.reward.god ? godById(s.reward.god).name : s.reward.cup ? cupById(s.reward.cup).name : s.name, conditions: s.conditions.map((c) => c.text), here: S?.state[s.id]?.found ?? null }));
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
