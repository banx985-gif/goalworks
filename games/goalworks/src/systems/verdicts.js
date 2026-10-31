// Season verdicts (Milestone 21b): the season's tally, the yearly Awards Night on the last day of Month 12 (before the
// M16 retirements on the season's end), the Season Review from four named voices, the four awards, the Seasons list and
// Great Teams. Plain functions over the run save; the numbers and words are in data/verdicts.js. Nothing new is kept
// that the game didn't already have: the tally only counts what each of your matches and each club day already show.
//   data.verdicts = { v: 1, season: tally, seasons: [record], greatTeams: [entry], lastAwards: year, pending: year | null }
//   tally = { year, startDay, partial, start: { credits, facilities, tier, players: { id: overall }, favourites, xiAvg },
//             minCredits, p, w, d, l, gf, ga, cs, homeP, homeW, tiesWon, cupsWon, rivalW, rivalL, giants,
//             players: { id: { name, apps, goals, cs } }, apps, youthApps, fatSum, fatN }
//   record (a season on the Seasons list) = { year, partial, total, voices: [{ id, name, who, art, face, score, line }],
//             awards: [{ id, name, art, playerId, player, detail, item }], league, record, cupsWon, promoted, crown,
//             great, xi }
//   normaliseVerdicts(data, day)        an older save: the tally starts today (partial); no past season is invented
//   afterMatch(data, { fixture, score, scorers, cup, xiIds }, day)    one of your matches (a Showcase friendly: nothing)
//   verdictsDay(data, day, { items }) → [{ kind: 'awards', year, record }]   the day's tally; Awards Night on day 335
//   review(data, day) → { voices, total }      awardsNight(data, day, { items }) → record (also from ?debug=1)
//   syncAccountTeams(account, data) → changed (Great Teams are account-wide, like the M16 Hall of Fame)
import { VOICES, VOICE_LINES, band, AWARDS, AWARDS_DAY, GREAT_TEAMS, voiceById } from '../../data/verdicts.js';
import { leagueById } from '../../data/league.js';
import { clubById } from '../../data/fixtures.js';
import { cupById, US } from '../../data/cups.js';
import { SECRETS } from '../../data/secrets.js';
import { storyForClub } from '../../data/rivals.js';
import { fansWeight } from './rivals.js'; // (M22)
import { VOICE_FACES, SAM } from '../../data/cast.js'; // (M22b)
import { staffById } from '../../data/staff.js';
import { overall } from './players.js';
import { bestXI } from './squad.js';
import { strength } from './cup.js';
import { promotion, addHistory, leagueOfClub } from './league.js';
import { familiarity } from './tactics.js';
import { inRole } from './staff.js';
import * as BOARD from './board.js'; // (M23) the board's objectives and confidence
import { trust as fanTrust, band as fanBandOf } from './fans.js'; // (M23)
import { confidenceText } from '../../data/board.js';

const YEAR = 336;
const MONTH = 28;
const yearOf = (day) => Math.floor(day / YEAR) + 1; // (the club calendar's year: club day 0 = Year 1 · Month 1 · Day 1)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const tierOf = (id) => leagueById(id)?.tier ?? 1;

function facilityScore(data) {
  const F = data.facilities;
  if (!F?.placement) return 0;
  return F.placement.length + F.placement.reduce((s, p) => s + Math.max(0, (F.levels?.[p.uid]?.level ?? 1) - 1), 0);
}
const xiAverage = (players) => {
  const xi = bestXI(players).filter(Boolean);
  return xi.reduce((s, p) => s + overall(p), 0) / Math.max(1, xi.length);
};

function startSeason(data, day, partial = false) {
  const players = (data.squad?.players ?? []).filter((p) => !p.loan);
  const credits = data.league?.credits ?? 0;
  return {
    year: yearOf(day),
    startDay: day,
    partial,
    start: {
      credits,
      facilities: facilityScore(data),
      tier: data.league?.tier ?? 'regional',
      players: Object.fromEntries(players.map((p) => [p.id, overall(p)])),
      favourites: players.filter((p) => !p.god).sort((a, b) => overall(b) - overall(a)).slice(0, 3).map((p) => p.id),
      xiAvg: r1(xiAverage(players)),
    },
    minCredits: credits,
    p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, homeP: 0, homeW: 0,
    tiesWon: 0, cupsWon: [], rivalW: 0, rivalL: 0, giants: 0,
    players: {},
    apps: 0, youthApps: 0,
    fatSum: 0, fatN: 0,
  };
}

export function normaliseVerdicts(data, day = data?.calendar?.clock?.totalDays ?? 0) {
  if (!data.verdicts) data.verdicts = { v: 1, season: startSeason(data, day, day % YEAR !== 0), seasons: [], greatTeams: [], lastAwards: 0, pending: null };
  const V = data.verdicts;
  V.seasons ??= [];
  V.greatTeams ??= [];
  V.lastAwards ??= 0;
  V.pending ??= null;
  if (!V.season || V.season.year !== yearOf(day)) V.season = startSeason(data, day, false);
  return V;
}

// --- one of your matches -------------------------------------------------------------------------------------------------
export function afterMatch(data, { fixture, score = [0, 0], scorers = [], cup = null, xiIds = [] }, day) {
  if (fixture?.cup && cupById(fixture.cup.id)?.friendly) return; // (the Summer Showcase is a friendly)
  const S = normaliseVerdicts(data, day).season;
  const [us, them] = score;
  const oppId = fixture?.opponent?.id;
  const won = us > them || (us === them && !!cup?.won);
  const lost = us < them || (us === them && cup && !cup.won);
  S.p++;
  if (won) S.w++;
  else if (lost) S.l++;
  else S.d++;
  S.gf += us;
  S.ga += them;
  if (them === 0) S.cs++;
  if (fixture?.home !== false) {
    S.homeP++;
    if (won) S.homeW++;
  }
  if (cup?.won) S.tiesWon++;
  if (cup?.champion && !S.cupsWon.includes(cup.cup)) S.cupsWon.push(cup.cup);
  // (M22) a rival result counts by its band at kickoff (Cool 0.5 … Blood Feud 2; a result recorded without the league —
  // a test — counts a story rival as 1, as in M21b)
  const rw = oppId ? (data.rivals?.last?.clubId === oppId && data.rivals.last.day === day ? fansWeight(data, oppId, day) : clubById(oppId)?.rivalry || storyForClub(oppId) ? 1 : 0) : 0;
  if (rw) {
    if (won) S.rivalW = Math.round((S.rivalW + rw) * 10) / 10;
    if (lost) S.rivalL = Math.round((S.rivalL + rw) * 10) / 10;
  }
  // a giant-killing: their XI clearly stronger, or a club from a league above yours
  if (won && oppId) {
    const higher = tierOf(leagueOfClub(oppId)?.id) > tierOf(data.league?.tier);
    if (higher || strength(data, oppId) - strength(data, US) >= voiceById('press').giantGap) S.giants++;
  }
  const inXi = new Set(xiIds);
  const coach = voiceById('coach');
  for (const p of data.squad.players) {
    if (!inXi.has(p.id)) continue;
    const t = (S.players[p.id] ??= { name: p.name, apps: 0, goals: 0, cs: 0 });
    t.apps++;
    if (them === 0 && p.position === 'GK') t.cs++;
    S.apps++;
    if (p.age <= coach.youthAge) S.youthApps++;
  }
  const byName = new Map(data.squad.players.filter((p) => inXi.has(p.id)).map((p) => [p.name, p]));
  for (const s of scorers) {
    if (s.team !== 0 || s.own) continue;
    const p = byName.get(s.name);
    if (p) S.players[p.id].goals++;
  }
}

// --- the club day ------------------------------------------------------------------------------------------------------------
export function verdictsDay(data, day, { items = null } = {}) {
  const V = normaliseVerdicts(data, day);
  const S = V.season;
  S.minCredits = Math.min(S.minCredits, data.league?.credits ?? 0);
  const fresh = (data.squad?.players ?? []).filter((p) => !p.loan && p.fatigue != null);
  if (fresh.length) {
    S.fatSum = r1(S.fatSum + fresh.reduce((s, p) => s + p.fatigue, 0) / fresh.length);
    S.fatN++;
  }
  const events = [];
  // (an older save that loaded during Month 12 waits for next year's: its first Awards Night is the next full Month 12)
  const tooLate = S.partial && S.startDay % YEAR >= AWARDS_DAY - MONTH + 1;
  if (day % YEAR === AWARDS_DAY && V.lastAwards < S.year && !tooLate) {
    const record = awardsNight(data, day, { items });
    events.push({ kind: 'awards', year: record.year, record });
  }
  return events;
}

// --- the Season Review ---------------------------------------------------------------------------------------------------------
function promotedThisSeason(data, S) {
  const L = data.league ?? {};
  return tierOf(L.tier) > tierOf(S.start.tier);
}
const crownThisSeason = (data, S) => data.league?.crownTitle?.year != null && Math.floor(data.league.crownTitle.day / YEAR) + 1 === S.year;
function secretsFoundThisSeason(data, S) {
  const st = data.secrets?.state ?? {};
  return SECRETS.filter((s) => st[s.id]?.found != null && st[s.id].found >= S.startDay).length;
}
function squadNow(data) {
  return (data.squad?.players ?? []).filter((p) => !p.loan);
}
// The parts of each voice (numbers before rounding) and the words for its line.
export function voiceParts(data, day) {
  const S = normaliseVerdicts(data, day).season;
  const lg = leagueById(data.league?.tier ?? 'regional');
  const squad = squadNow(data);
  const here = new Set(squad.map((p) => p.id));
  const out = {};
  // the Board
  {
    const v = voiceById('board');
    const promoted = promotedThisSeason(data, S);
    const crown = crownThisSeason(data, S);
    let frac = 1;
    if (!promoted && !crown) {
      const st = promotion(data, lg.id);
      frac = st.won ? 1 : (Math.min(1, st.distinct / Math.max(1, st.need.distinct)) + Math.min(1, st.wins / Math.max(1, st.need.wins)) + (st.rankOk ? 1 : 0)) / 3;
    }
    const credits = data.league?.credits ?? 0;
    const black = S.minCredits >= 0 && !(data.finance?.emergency?.years ?? []).includes(S.year); // (M23) Emergency Credit this season: not in the black
    const money = (black ? 1 : 0) + (credits >= S.start.credits ? 0.5 : 0); // (M23: of its 1.5 — in the black 1, grown 0.5)
    const built = Math.max(0, facilityScore(data) - S.start.facilities);
    const objs = BOARD.evaluate(data, S); // (M23)
    const objMet = objs.filter((o) => o.met).length;
    const conf = BOARD.normaliseBoard(data).confidence;
    out.board = {
      parts: { progress: v.parts.progress * frac, money: Math.min(v.parts.money, money), facilities: Math.min(v.parts.facilities, built * v.perFacility), objectives: objs.length ? (v.parts.objectives * objMet) / objs.length : v.parts.objectives }, // (no objectives set — an older save's first season: never held against you)
      words: {
        progress: crown ? 'The Crown title is ours' : promoted ? `Promoted to the ${lg.name}` : frac >= 1 ? 'Every promotion condition is met' : `Promotion conditions ${Math.round(frac * 100)}% of the way`,
        money: black ? `The books stayed in the black${credits >= S.start.credits ? ` and grew to ${fmt(credits)} Credits` : ''}` : `The board had to lend an Emergency Credit this year`,
        objectives: `${objs.length ? `Objectives: ${objMet} of ${objs.length} met${objs.length ? ` (${objs.map((o) => `${o.line}: ${o.met ? 'yes' : 'no'}`).join('; ')})` : ''}.` : 'No objectives set this season.'} ${confidenceText(conf)} (Board Confidence ${Math.round(conf)}).`,
      },
      objectives: objs,
    };
  }
  // the Fans
  {
    const v = voiceById('fans');
    const rate = S.p ? S.w / S.p : 0;
    const home = S.homeP ? S.homeW / S.homeP : 0;
    const favs = S.start.favourites.length ? S.start.favourites.filter((id) => here.has(id)).length / S.start.favourites.length : 1;
    out.fans = {
      parts: {
        wins: v.parts.wins * Math.min(1, rate / v.winsFull),
        cups: Math.min(v.parts.cups, S.tiesWon * v.perTie + S.cupsWon.length * v.perCup),
        rivals: clamp((S.rivalW - S.rivalL) * v.perRival, -v.parts.rivals, v.parts.rivals),
        home: v.parts.home * Math.min(1, home / v.homeFull),
        favourites: v.parts.favourites * favs,
        trust: v.parts.trust * Math.min(1, fanTrust(data) / 100), // (M23)
      },
      words: {
        record: `${S.w} won, ${S.d} drawn, ${S.l} lost`,
        cups: S.cupsWon.length ? `The ${cupById(S.cupsWon[0])?.name ?? 'cup'} came home.` : S.tiesWon ? `${S.tiesWon} cup tie${S.tiesWon === 1 ? '' : 's'} won.` : '',
        trust: `Fan Trust ${Math.round(fanTrust(data))} (${fanBandOf(data).name}).`, // (M23)
      },
    };
  }
  // the Press
  {
    const v = voiceById('press');
    const gpm = S.p ? S.gf / S.p : 0;
    const stars = squad.filter((p) => p.star).length;
    const signings = squad.filter((p) => (p.joinedDay ?? -1) >= S.startDay && p.origin !== 'academy' && !p.youth && !p.god && overall(p) >= S.start.xiAvg).length;
    const secrets = secretsFoundThisSeason(data, S);
    const extra = [S.giants ? `${S.giants} giant-killing${S.giants === 1 ? '' : 's'}` : '', signings ? `${signings} big signing${signings === 1 ? '' : 's'}` : '', stars ? `${stars} Star${stars === 1 ? '' : 's'} in the squad` : '', secrets ? 'and a secret uncovered' : ''].filter(Boolean);
    out.press = {
      parts: { goals: v.parts.goals * Math.min(1, gpm / v.goalsFull), stars: Math.min(v.parts.stars, stars * v.perStar + signings * v.perSigning), giants: Math.min(v.parts.giants, S.giants * v.perGiant), secrets: Math.min(v.parts.secrets, secrets * v.perSecret) },
      words: { goals: `${S.gf} goal${S.gf === 1 ? '' : 's'} in ${S.p} match${S.p === 1 ? '' : 'es'}`, extra: extra.length ? `${extra.join(', ')}.` : 'Quiet on the transfer front.' },
    };
  }
  // your Head Coach
  {
    const v = voiceById('coach');
    const share = S.apps ? S.youthApps / S.apps : 0;
    const gains = squad.filter((p) => S.start.players[p.id] != null && (S.players[p.id]?.apps ?? 0) > 0).map((p) => overall(p) - S.start.players[p.id]);
    const gain = gains.length ? gains.reduce((s, x) => s + x, 0) / gains.length : 0;
    const fam = familiarity(data) ?? 0;
    const fat = S.fatN ? S.fatSum / S.fatN : 0;
    out.coach = {
      parts: { youth: v.parts.youth * Math.min(1, share / v.youthFull), growth: v.parts.growth * clamp(gain / v.growthFull, 0, 1), familiarity: v.parts.familiarity * clamp(fam / 100, 0, 1), fitness: v.parts.fitness * clamp(1 - fat / v.fitnessZero, 0, 1) },
      words: { youth: `${Math.round(share * 100)}% of the minutes went to players ${v.youthAge} or under`, growth: `The squad gained ${r1(Math.max(0, gain))} overall a player` },
      gain,
    };
  }
  return out;
}
const fill = (tpl, words) => tpl.replace(/\{(\w+)\}/g, (_, k) => words[k] ?? '').replace(/\s+/g, ' ').replace(/\s\./g, '.').trim();
// The four voices, each /10 (a whole number, 1–10), and the total /40.
export function review(data, day) {
  const parts = voiceParts(data, day);
  const hc = inRole(data, 'HC');
  const voices = VOICES.map((v) => {
    const x = parts[v.id];
    const raw = v.base + Object.values(x.parts).reduce((s, n) => s + n, 0);
    const score = clamp(Math.round(raw), 1, 10);
    const coach = v.id === 'coach';
    return {
      id: v.id,
      name: v.name,
      who: coach ? (hc ? `${hc.name}, Head Coach` : SAM.standIn) : v.who, // (M22b) Sam Okafor stands in
      face: coach && hc ? null : VOICE_FACES[v.id] ?? null, // (M22b) the chibi beside the voice (a hired coach keeps his own portrait)
      art: coach && hc ? staffById(hc.id)?.art ?? v.art : v.art,
      colour: v.colour,
      score,
      raw: r1(raw),
      parts: Object.fromEntries(Object.entries(x.parts).map(([k, n]) => [k, r1(n)])),
      line: fill(VOICE_LINES[v.id][band(score)], x.words),
    };
  });
  return { voices, total: voices.reduce((s, v) => s + v.score, 0), parts };
}

// --- Awards Night ------------------------------------------------------------------------------------------------------------
function pickWinner(data, S, award, parts) {
  const squad = squadNow(data);
  const t = (p) => S.players[p.id] ?? { apps: 0, goals: 0, cs: 0 };
  if (award.pick === 'goals') {
    const p = squad.filter((x) => t(x).goals > 0).sort((a, b) => t(b).goals - t(a).goals || t(a).apps - t(b).apps || (a.id < b.id ? -1 : 1))[0];
    return p ? { p, detail: `${t(p).goals} goal${t(p).goals === 1 ? '' : 's'} in ${t(p).apps} match${t(p).apps === 1 ? '' : 'es'}` } : null;
  }
  if (award.pick === 'cleanSheets') {
    const p = squad.filter((x) => x.position === 'GK' && t(x).cs > 0).sort((a, b) => t(b).cs - t(a).cs || t(b).apps - t(a).apps || (a.id < b.id ? -1 : 1))[0];
    return p ? { p, detail: `${t(p).cs} clean sheet${t(p).cs === 1 ? '' : 's'} in ${t(p).apps} match${t(p).apps === 1 ? '' : 'es'}` } : null;
  }
  if (award.pick === 'young') {
    const gain = (p) => (S.start.players[p.id] != null ? overall(p) - S.start.players[p.id] : 0);
    const score = (p) => gain(p) * 2 + t(p).apps * 0.5;
    const p = squad.filter((x) => x.age <= award.maxAge && t(x).apps > 0).sort((a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1))[0];
    return p ? { p, detail: `Age ${p.age} · ${t(p).apps} match${t(p).apps === 1 ? '' : 'es'} · overall ${gain(p) >= 0 ? '+' : ''}${gain(p)} this season` } : null;
  }
  return null;
}
// An item for the award (the winner's loved group when he has one); given to him at once — if his season's item points are
// used up it waits for him in the Club Store. The manager's goes to the Club Store. → { name, uid, given } | null
function awardItem(items, award, p, day) {
  if (!items) return null;
  const group = p ? items.likesOf(p.id)?.loves?.[0] ?? null : null;
  const it = items.grant('award', { weights: award.weights, group, note: `${award.name}${p ? ` · ${p.name}` : ''}`, overflow: !!p }, day); // (a full Club Store never costs a winner his item)
  if (!it || it.refused) return { refused: it?.refused ?? 'No item' };
  let given = false;
  if (p) given = !!items.give(it.uid, p.id)?.ok;
  return { uid: it.uid, type: it.type, rarity: it.rarity, given };
}

export function awardsNight(data, day, { items = null } = {}) {
  const V = normaliseVerdicts(data, day);
  const S = V.season;
  const L = data.league;
  const tier = tierOf(L?.tier);
  const rv = review(data, day);
  const board = BOARD.settle(data, S, day); // (M23) the board's objectives scored, confidence moves (after the review read them)
  const awards = [];
  for (const award of AWARDS) {
    let p = null;
    let detail = '';
    if (award.pick === 'manager') {
      if (rv.total < award.minReview) continue;
      detail = `Season Review ${rv.total} / 40`;
    } else {
      const w = pickWinner(data, S, award, rv.parts);
      if (!w) continue;
      ({ p, detail } = w);
    }
    if (L) L.rep.history = r1(L.rep.history + award.history * tier);
    const item = awardItem(items, award, p, day);
    if (p) p.honours = [...(p.honours ?? []), { id: award.id, name: award.name, year: S.year }];
    awards.push({ id: award.id, name: award.name, art: award.art, playerId: p?.id ?? null, player: p ? p.name : data.club?.manager ?? 'You', position: p?.position ?? null, detail, reputation: award.history * tier, item });
  }
  const promoted = promotedThisSeason(data, S);
  const crown = crownThisSeason(data, S);
  const majors = S.cupsWon.filter((id) => GREAT_TEAMS.majorCups.includes(id));
  // the XI used most this season (appearances), best first
  const squad = squadNow(data);
  const xi = squad.filter((p) => (S.players[p.id]?.apps ?? 0) > 0).sort((a, b) => S.players[b.id].apps - S.players[a.id].apps || overall(b) - overall(a)).slice(0, 11).map((p) => ({ id: p.id, name: p.name, position: p.position, overall: overall(p), apps: S.players[p.id].apps }));
  const great = promoted || crown || majors.length > 0 || rv.total >= GREAT_TEAMS.minReview;
  const honours = [...(crown ? ['Crown Champions'] : []), ...(promoted ? [`Promoted to the ${leagueById(L.tier).name}`] : []), ...S.cupsWon.map((id) => `${cupById(id)?.name ?? id} winners`), ...(rv.total >= GREAT_TEAMS.minReview ? [`Season Review ${rv.total} / 40`] : [])];
  const record = {
    year: S.year,
    partial: !!S.partial,
    total: rv.total,
    voices: rv.voices.map(({ id, name, who, art, face, colour, score, line, parts }) => ({ id, name, who, art, face, colour, score, line, parts })), // (M22b) face: the chibi beside the voice
    awards,
    league: L?.tier ?? 'regional',
    record: { p: S.p, w: S.w, d: S.d, l: S.l, gf: S.gf, ga: S.ga },
    cupsWon: S.cupsWon.slice(),
    promoted,
    crown,
    great,
    honours,
    xi,
    board: { met: board.met, of: board.of, rows: board.rows.map(({ id, line, met }) => ({ id, line, met })) }, // (M23)
  };
  V.seasons = [...V.seasons, record].slice(-40);
  V.lastAwards = S.year;
  V.pending = S.year;
  if (great) {
    V.greatTeams = [...V.greatTeams, { uid: `${data.seed}:${S.year}`, club: data.club?.name ?? '', colours: { ...(data.club?.colours ?? { primary: 'green', secondary: 'white' }) }, crest: data.club?.badge ?? null, year: S.year, league: record.league, total: rv.total, honours, xi, record: record.record }].slice(-GREAT_TEAMS.max);
  }
  const named = awards.filter((a) => a.id !== 'manager').map((a) => `${a.name}: ${a.player}`);
  addHistory(data, day, `Awards Night: Season Review ${rv.total} / 40${named.length ? ` · ${named.join(' · ')}` : ''}${awards.some((a) => a.id === 'manager') ? ' · Manager of the Season' : ''}`);
  return record;
}

export const seasonsOf = (data) => (data?.verdicts?.seasons ?? []).slice().reverse();
export const pendingAwards = (data) => {
  const V = data?.verdicts;
  return V?.pending != null ? V.seasons.find((s) => s.year === V.pending) ?? null : null;
};
export function clearPending(data) {
  if (data?.verdicts) data.verdicts.pending = null;
}
// Great Teams into the account save (they survive new games and other slots). → true when the account changed
export function syncAccountTeams(account, data) {
  account.greatTeams ??= [];
  const have = new Set(account.greatTeams.map((e) => e.uid));
  let changed = false;
  for (const e of data?.verdicts?.greatTeams ?? []) {
    if (have.has(e.uid)) continue;
    account.greatTeams.push({ ...e, inducted: Date.now() });
    changed = true;
  }
  if (account.greatTeams.length > GREAT_TEAMS.max) account.greatTeams = account.greatTeams.slice(-GREAT_TEAMS.max);
  return changed;
}

