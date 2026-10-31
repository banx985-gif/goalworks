// The leagues (Milestone 10: Regional; Milestone 17: County, bible §7 / §8 / §21 / §22): challenge opportunities, results,
// reputation and Club Rank, Credits (a placeholder), each league's record, the promotion path to the next tier and the
// league's cup. Plain functions over the run save (data.league); numbers and the one-definition-per-tier LEAGUES in
// data/league.js, clubs in data/fixtures.js, cups in data/cups.js (run by src/systems/cup.js).
//   normaliseLeague(data)                       data.league in its shape (an older save starts fresh: no record, rep 0;
//                                                an M10–M16 save is in the Regional League)
//   leagueOf(data) → LEAGUES entry               your league now (data.league.tier); clubsOf(data) its clubs
//   leagueDay(data, day) → cup events            a club day: momentum fades, offers expire, the league's cup moves on (your
//                                                tie issued a week ahead), the promotion step is issued once unlocked,
//                                                clubs may issue challenges
//   openOffers(data) → [offer]                   offer = { id, clubId, issuedDay, until (null: stays), home, promotion,
//                                                cup?: { id, edition, round, name } }
//   cupOffer(data) → the open cup tie offer       (it takes the week's slot: the game commits it as soon as it can)
//   calendarOffer(offer) → the calendar's offer   { source: 'league', opponent, offerId, home, promotion, cup? }
//   isIssued(data, calOffer) → bool              the calendar's gate: only an issued, open offer can become a fixture
//   accept(data, offerId, calendar) → { ok, why, fixture }    decline(data, offerId, day)
//   recordResult(data, fixture, score, day) → summary (credits, reputation, rank, promotion news, the cup tie)
//   reputation(data) → { history, momentum, total }   rankOf(total) → RANKS entry   rank(data)
//   record(data, leagueId?) → { clubs: { id: { w, d, l } }, wins, distinct, beaten: [ids] }   (default: your league)
//   promotion(data, leagueId?) → { distinct, wins, need, rankOk, met, cupWon, unlocked, won, offer, via, county }
//   acceptOffer(data, leagueId?, day?) — the promotion offer accepted: Regional → you move up to County (A10);
//                                        County → recorded, "National League coming soon" (A11)
//   acceptCounty(data) = acceptOffer(data, 'regional')      catchUp(data, day): an older save that accepted the County
//                                                           offer before M17 moves up now (a News line)
//   previewReward(data, clubId, score, promotion) → what a result would give (the result screen, before Continue)
import { Rng } from '../../../../core/Rng.js';
import { REGIONAL_CLUBS, clubById } from '../../data/fixtures.js';
import { ISSUE, RANKS, REPUTATION, CREDITS, LEAGUES, leagueById, COMING, ACHIEVEMENTS, STADIUM_FLAGS, AFTER_TITLE } from '../../data/league.js';
import { cupById, CUPS, CUP_ORDER, ALL_CUPS } from '../../data/cups.js';
import * as CUP from './cup.js';
import { incomeMult } from './gods.js';

const round1 = (v) => Math.round(v * 10) / 10;
const blankClub = () => ({ w: 0, d: 0, l: 0, meetings: 0, cooldownUntil: 0 });

export function normaliseLeague(data) {
  data.league ??= {
    v: 10,
    offers: [], // open and accepted offers
    nextId: 1,
    clubs: Object.fromEntries(REGIONAL_CLUBS.map((c) => [c.id, blankClub()])),
    rep: { history: 0, momentum: 0 },
    credits: 0, // PLACEHOLDER until the money ledger (Milestone 23)
    promotion: { unlocked: false, won: false, county: null, retryAt: 0, matches: 0 }, // (Regional → County, M10)
    lastDay: null,
  };
  const L = data.league;
  for (const c of REGIONAL_CLUBS) L.clubs[c.id] ??= blankClub();
  L.tier ??= 'regional'; // (M17) your league now
  for (const id of leagueById(L.tier).clubs) L.clubs[id] ??= blankClub(); // (each league's record is kept for good)
  L.progress ??= {}; // (M17) the promotion state of the leagues above Regional, by league id
  L.news ??= []; // (M17) League sheet news lines (there is no Inbox yet)
  return L;
}

export const leagueOf = (data) => leagueById(normaliseLeague(data).tier);
export const clubsOf = (data, id = leagueOf(data).id) => leagueById(id).clubs.map((c) => clubById(c));
export const leagueOfClub = (clubId) => LEAGUES.find((l) => l.clubs.includes(clubId)) ?? null;
export function news(data, day, text) {
  const L = normaliseLeague(data);
  L.news = [...L.news, { day, text }].slice(-20);
}
// (M18) A line in the club's history (promotions, cups won — the Hall of Fame sheet shows it).
const YEAR = 336;
const yearOfDay = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
// (M20) The clubs of your league beaten this season (C07's door): data.league.season = { year, league, beaten }.
export function seasonBeaten(data, day) {
  const S = normaliseLeague(data).season;
  return S && S.year === yearOfDay(day) && S.league === data.league.tier ? S.beaten : [];
}
function noteSeasonWin(data, clubId, day) {
  const L = normaliseLeague(data);
  const year = yearOfDay(day);
  if (!L.season || L.season.year !== year || L.season.league !== L.tier) L.season = { year, league: L.tier, beaten: [] };
  if (leagueById(L.tier).clubs.includes(clubId) && !L.season.beaten.includes(clubId)) L.season.beaten.push(clubId);
}
export function addHistory(data, day, text) {
  data.clubHistory = [...(data.clubHistory ?? []), { day, year: Math.floor((Math.max(1, day) - 1) / YEAR) + 1, text }].slice(-60);
}

// (M18) The cups running now: open ones (a league cup while that is your league; a Rank cup once the club has reached that
// rank, for good) start an edition each season; a league cup you have just left plays out the edition under way (your tie
// in it still counts) but starts no new one. → [{ id, startNew }]
export function activeCups(data) {
  const L = normaliseLeague(data);
  const out = [];
  for (const cup of Object.values(ALL_CUPS)) {
    if (cup.opens.month) { // (M21b) the Summer Showcase: always on; its edition starts in its month (cup.js)
      out.push({ id: cup.id, startNew: true });
      continue;
    }
    // (a Rank cup, or (M20) a cup unlocked by a season's results: open for good once unlocked)
    // (M21) C01: in its league once it has opened there (2 wins); C08 (wonAll), a found secret cup, a debug cup: for good
    const forGood = cup.opens.rank || cup.opens.seasonBeaten || cup.opens.wonAll || cup.opens.secret || cup.opens.debug;
    const open = forGood ? L.cupsOpen?.[cup.id] != null : cup.opens.wins ? cup.opens.league === L.tier && L.cupsOpen?.[cup.id] != null : cup.opens.league === L.tier; // (any day it opened, 0 included)
    if (open) out.push({ id: cup.id, startNew: true });
    else if (data.cups?.[cup.id]?.current) out.push({ id: cup.id, startNew: false });
  }
  return out;
}

export const reputation = (data) => {
  const r = normaliseLeague(data).rep;
  return { history: r.history, momentum: r.momentum, total: round1(r.history + r.momentum) };
};
export const rankOf = (total) => [...RANKS].reverse().find((r) => total >= r.min);
export const rank = (data) => rankOf(reputation(data).total);
const rankAtLeast = (data, id) => !id || RANKS.findIndex((r) => r.id === rank(data).id) >= RANKS.findIndex((r) => r.id === id);

export function record(data, id = leagueOf(data).id) {
  const L = normaliseLeague(data);
  const ids = leagueById(id).clubs;
  const of = (c) => L.clubs[c] ?? blankClub();
  const beaten = ids.filter((c) => of(c).w > 0);
  return {
    clubs: Object.fromEntries(ids.map((c) => [c, { w: of(c).w, d: of(c).d, l: of(c).l }])),
    wins: ids.reduce((s, c) => s + of(c).w, 0),
    distinct: beaten.length,
    beaten,
  };
}

// A league's promotion state: the Regional one is M10's data.league.promotion (its offer is `county`); the others live in
// data.league.progress[id] (their offer is `offer`).
function progressOf(data, id) {
  const L = normaliseLeague(data);
  if (id === 'regional') return L.promotion;
  return (L.progress[id] ??= { unlocked: false, won: false, offer: null, via: null, retryAt: 0, matches: 0 });
}
const offerOf = (id, P) => (id === 'regional' ? P.county : P.offer);
function setOffer(id, P, v) {
  if (id === 'regional') P.county = v;
  else P.offer = v;
}
const cupWon = (data, cupId) => !!cupId && (data.cups?.[cupId]?.wins ?? 0) > 0;

export function promotion(data, id = leagueOf(data).id) {
  const L = normaliseLeague(data);
  const rule = leagueById(id).promotion;
  const P = progressOf(data, id);
  const r = record(data, id);
  const rankOk = rankAtLeast(data, rule.rank);
  const finalCup = rule.final?.cup ?? null;
  // (M20) the title chain counts a club only once it has been beaten `timesEach` times (all six, twice each)
  const times = rule.timesEach ?? 1;
  const distinct = Object.values(r.clubs).filter((c) => c.w >= times).length;
  return {
    league: id,
    distinct,
    wins: r.wins,
    need: { distinct: rule.distinct, wins: rule.wins, ...(rule.rank ? { rank: rule.rank } : {}), ...(times > 1 ? { timesEach: times } : {}) },
    rankOk,
    met: distinct >= rule.distinct && r.wins >= rule.wins && rankOk,
    title: !!rule.final?.title, // (M20) the Crown Title Match
    crownTitle: L.crownTitle ?? null,
    cup: finalCup,
    cupWon: cupWon(data, finalCup),
    playoff: !!rule.final?.playoff,
    unlocked: P.unlocked,
    won: P.won,
    offer: offerOf(id, P),
    via: P.via ?? (P.won && rule.final === 'match' ? 'match' : null),
    rival: rule.final?.rival ?? null, // (M18) the Promotion Decider's opponent
    stepName: rule.stepName,
    to: rule.to,
    county: L.promotion.county, // (M10: the County offer — null, 'offered' or 'accepted')
  };
}

// Clubs that will deal with you now (your reputation meets their requirement), in your league.
export const unlockedClubs = (data) => clubsOf(data).filter((c) => reputation(data).total >= c.rep);
// The promotion step's opponent: Regional — the highest unlocked club (the Promotion Match); County — the league's
// strongest club (the Promotion Playoff); (M18) National — the designated rival (the Promotion Decider, RV03).
export function promotionOpponent(data) {
  const lg = leagueOf(data);
  const clubs = clubsOf(data);
  if (lg.promotion.final === 'match') return unlockedClubs(data).slice(-1)[0] ?? clubs[0];
  if (lg.promotion.final.rival) return clubById(lg.promotion.final.rival);
  if (lg.promotion.final.fallback) return clubById(lg.promotion.final.fallback); // (M19: the one-off Promotion Final)
  if (lg.promotion.final.title) return clubs.slice().sort((a, b) => CUP.strength(data, b.id) - CUP.strength(data, a.id))[0]; // (M20: the strongest squad now)
  return clubs.slice().sort((a, b) => b.strength - a.strength)[0];
}
// How the promotion step was won: 'match' | 'playoff' | 'decider' (the cup is 'cup', set where it happens).
const stepVia = (lg) => (lg.promotion.final === 'match' ? 'match' : lg.promotion.final.rival ? 'decider' : lg.promotion.final.promotionFinal ? 'final' : lg.promotion.final.title ? 'title' : 'playoff');
// (M19) Still in an edition of that cup: it has a tie for you to play.
const aliveIn = (data, cupId) => {
  const cur = data.cups?.[cupId]?.current;
  return !!cur && !cur.done && !cur.out && !!CUP.ourTieIn(cur);
};
// (M19) Is this fixture the Promotion Final? The final of the league's promotion cup while the other conditions are met.
export function isPromotionFinal(data, fixture) {
  if (!fixture?.cup) return false;
  const lg = leagueOf(data);
  const fin = lg.promotion.final;
  if (!fin?.promotionFinal || fixture.cup.id !== fin.cup) return false;
  return fixture.cup.round === cupById(fin.cup).rounds.length - 1 && promotion(data, lg.id).met;
}

export const openOffers = (data) => normaliseLeague(data).offers.filter((o) => o.state === 'open');
export const acceptedOffer = (data) => normaliseLeague(data).offers.find((o) => o.state === 'accepted') ?? null;
export const cupOffer = (data) => openOffers(data).find((o) => o.cup) ?? null;

function issue(data, club, day, promo = false, cup = null, cupHome = true) {
  const L = normaliseLeague(data);
  L.clubs[club.id] ??= blankClub();
  const o = { id: `o${L.nextId++}`, clubId: club.id, issuedDay: day, until: promo || cup ? null : day + ISSUE.openDays, home: cup ? cupHome : L.clubs[club.id].meetings % 2 === 0, promotion: promo, state: 'open' };
  if (cup) o.cup = { ...cup };
  L.offers.push(o);
  return o;
}

// The conditions met → Regional: the Promotion Match unlocks; County: the offer at once if the cup has been won, else the
// Promotion Playoff unlocks. → 'unlocked' | 'offered' | null
function checkPromotion(data) {
  const lg = leagueOf(data);
  const rule = lg.promotion;
  const P = progressOf(data, lg.id);
  if (P.won || offerOf(lg.id, P)) return null;
  const st = promotion(data, lg.id);
  if (!st.met) return null;
  if (rule.final !== 'match' && rule.final.playoff && st.cupWon) { // (County: the Shield won counts; M19's Trophy doesn't — its final must be the Promotion Final)
    P.won = true;
    P.via = 'cup';
    setOffer(lg.id, P, 'offered');
    const L = data.league;
    L.offers = L.offers.filter((o) => !(o.promotion && o.state === 'open')); // (no playoff needed now)
    return 'offered';
  }
  if (!P.unlocked) {
    P.unlocked = true;
    return 'unlocked';
  }
  return null;
}

// (M21) The cups' day (bible §3 chaining): every running cup moves on, and your next tie is issued for the cup whose turn it
// is — none while another cup tie is waiting to be played (its chain), then the cups still mid-run, then the queue in the
// order their editions started. Also called right after your cup result, so the next round is issued the same day (the
// game commits it at once: 7 days after the result). → cup events
export function cupQueue(data) {
  const run = activeCups(data).map((c) => c.id).filter((id) => CUP.waitingFor(data.cups?.[id]?.current));
  const begun = (id) => (data.cups[id].current.round > 0 || data.cups[id].current.rounds[0].some((t) => t.winner) ? 0 : 1);
  return run.sort((a, b) => begun(a) - begun(b) || data.cups[a].current.startDay - data.cups[b].current.startDay || CUP_ORDER.indexOf(a) - CUP_ORDER.indexOf(b));
}
export const chainHolder = (data) => normaliseLeague(data).offers.find((o) => o.cup && (o.state === 'open' || o.state === 'accepted'))?.cup.id ?? null;
export function cupsDay(data, day) {
  const L = normaliseLeague(data);
  const events = [];
  for (const { id, startNew } of activeCups(data)) {
    events.push(
      ...CUP.cupDay(data, id, day, {
        startNew,
        issueTie: (clubId, ref, home) => issue(data, clubById(clubId), day, false, ref, home),
        hasTie: (ref) => L.offers.some((o) => o.cup?.id === ref.id && o.cup.edition === ref.edition && o.cup.round === ref.round),
        canIssue: (cid) => !chainHolder(data) && cupQueue(data)[0] === cid,
      }),
    );
  }
  // (a cup that queued earlier in the pass may now be first: one more pass issues it)
  for (const { id, startNew } of activeCups(data)) {
    if (chainHolder(data)) break;
    events.push(...CUP.cupDay(data, id, day, { startNew, issueTie: (clubId, ref, home) => issue(data, clubById(clubId), day, false, ref, home), canIssue: (cid) => !chainHolder(data) && cupQueue(data)[0] === cid }));
  }
  return events;
}
// (M21) Which cup a queued one waits behind (its name for "Queued: starts after the …"), or null.
export function queuedBehind(data, cupId) {
  const held = chainHolder(data);
  if (held && held !== cupId) return cupById(held);
  const q = cupQueue(data);
  return q.length && q[0] !== cupId ? cupById(q[0]) : null;
}

export function leagueDay(data, day) {
  const L = normaliseLeague(data);
  const lg = leagueOf(data);
  L.rep.momentum = round1(Math.max(0, L.rep.momentum - REPUTATION.fade));
  // expire offers left too long (that club waits a little before asking again)
  for (const o of L.offers) {
    if (o.state === 'open' && o.until != null && day > o.until) {
      o.state = 'expired';
      L.clubs[o.clubId].cooldownUntil = Math.max(L.clubs[o.clubId].cooldownUntil, day + ISSUE.declineCooldown);
    }
  }
  L.offers = L.offers.filter((o) => o.state === 'open' || o.state === 'accepted');
  // (M17) the cups: an edition a season, your tie issued a week ahead, the AI ties simulated on their day. (M18) A Rank cup
  // opens the first day the club reaches its rank, in any league; two of your ties never fall in one week.
  const events = [];
  for (const cup of Object.values(CUPS)) {
    if (L.cupsOpen?.[cup.id] != null) continue; // (opened already, on whatever day)
    const byRank = cup.opens.rank && rankAtLeast(data, cup.opens.rank);
    // (M20) C07: in its league, at least `seasonBeaten` different clubs of it beaten this season
    const bySeason = cup.opens.seasonBeaten && L.tier === cup.opens.league && seasonBeaten(data, day).length >= cup.opens.seasonBeaten;
    // (M21) C01: wins in its league; C08: each of its cups won at least once; C09–C14: their secret found
    const byWins = cup.opens.wins && L.tier === cup.opens.league && record(data, cup.opens.league).wins >= cup.opens.wins;
    const byWonAll = cup.opens.wonAll && cup.opens.wonAll.every((id) => (data.cups?.[id]?.wins ?? 0) > 0);
    const bySecret = cup.opens.secret && data.secrets?.state?.[cup.opens.secret]?.found != null;
    if (!byRank && !bySeason && !byWins && !byWonAll && !bySecret) continue;
    L.cupsOpen = { ...(L.cupsOpen ?? {}), [cup.id]: day };
    const C = CUP.normaliseCups(data)[cup.id];
    if (!C.current) C.nextStart = day; // (nothing can run before it unlocks: its first edition opens today)
    events.push({ kind: 'opened', cup: cup.id });
  }
  events.push(...cupsDay(data, day));
  for (const e of events.filter((x) => x.kind === 'skipped')) {
    const cup = cupById(e.cup);
    if (cup.window) news(data, day, `${cup.name} skipped this year: another cup run filled Month ${cup.window.month}. It comes back next Month ${cup.window.month}.`); // (M21b)
    else news(data, day, `${cup.name} skipped this season: it waited in the queue until the season ended. It opens again next season.`);
  }
  checkPromotion(data); // (M17) the County conditions include a Club Rank, which can move any day
  // the promotion step, once unlocked (it stays open until played; after a loss it comes back after a short wait)
  const P = progressOf(data, lg.id);
  // (M19) the one-off Promotion Final only while you are not still in an edition of the promotion cup (its final is the way
  // then), and only with the conditions met
  const fin = lg.promotion.final;
  const finalWay = fin?.promotionFinal ? !aliveIn(data, fin.cup) && promotion(data, lg.id).met : true;
  if (P.unlocked && !P.won && !offerOf(lg.id, P) && day >= P.retryAt && finalWay && !L.offers.some((o) => o.promotion)) {
    const opp = promotionOpponent(data);
    L.offers = L.offers.filter((o) => !(o.state === 'open' && o.clubId === opp.id && !o.cup)); // (it takes the place of that club's open challenge)
    issue(data, opp, day, true);
  }
  // ordinary challenges
  const rng = new Rng(`${data.seed}:league:${day}`);
  for (const c of clubsOf(data)) {
    const roll = rng.next(); // (one roll per club per day, always drawn: the same days give the same offers)
    if (reputation(data).total < c.rep || L.clubs[c.id].cooldownUntil > day || L.offers.some((o) => o.clubId === c.id)) continue;
    if (roll < ISSUE.chance) issue(data, c, day);
  }
  L.lastDay = day;
  return events;
}

export const calendarOffer = (o) => {
  const c = clubById(o.clubId);
  return { source: 'league', opponent: { id: c.id, name: c.name }, offerId: o.id, home: o.home, promotion: !!o.promotion, ...(o.cup ? { cup: { ...o.cup } } : {}) };
};
export function isIssued(data, calOffer) {
  if (calOffer?.source !== 'league') return false;
  const o = normaliseLeague(data).offers.find((x) => x.id === calOffer.offerId);
  return !!o && o.state === 'open' && o.clubId === calOffer.opponent?.id;
}

export function accept(data, offerId, calendar) {
  const o = openOffers(data).find((x) => x.id === offerId);
  if (!o) return { ok: false, why: 'That challenge is no longer open.', fixture: null };
  const tie = o.cup ? null : cupOffer(data);
  if (tie) return { ok: false, why: `${cupById(tie.cup.id).name} week: your ${tie.cup.name.toLowerCase()} against ${clubById(tie.clubId).name} takes this slot.`, fixture: null };
  const r = calendar.commit(calendarOffer(o));
  if (r.ok) o.state = 'accepted';
  return r;
}
export function decline(data, offerId, day) {
  const L = normaliseLeague(data);
  const o = L.offers.find((x) => x.id === offerId && x.state === 'open' && !x.promotion && !x.cup);
  if (!o) return false;
  o.state = 'declined';
  L.clubs[o.clubId].cooldownUntil = Math.max(L.clubs[o.clubId].cooldownUntil, day + ISSUE.declineCooldown);
  L.offers = L.offers.filter((x) => x !== o);
  return true;
}

// (M21b) A Summer Showcase tie: a friendly — never a competitive match (no league record, no promotion wins, no reward).
export const isFriendly = (fixture) => !!fixture?.cup && !!cupById(fixture.cup.id)?.friendly;
const resultOf = ([us, them]) => (us > them ? 'win' : us < them ? 'loss' : 'draw');

export function previewReward(data, clubId, score, promo = false, friendly = false) {
  const tier = clubById(clubId)?.reward ?? 1;
  const res = resultOf(score);
  if (friendly) return { res, credits: 0, history: 0, momentum: 0, rep: 0 }; // (M21b) the Showcase pays only its prize
  let credits = CREDITS[res][tier];
  let history = res === 'loss' ? 0 : REPUTATION[res][tier].history;
  let momentum = res === 'loss' ? -Math.min(normaliseLeague(data).rep.momentum, REPUTATION.loss[tier]) : REPUTATION[res][tier].momentum;
  if (promo && res === 'win') {
    const b = (leagueOfClub(clubId) ?? LEAGUES[0]).promotion.bonus; // (the Promotion Match / Playoff of that club's league)
    credits += b.credits;
    history += b.history;
    momentum += b.momentum;
  }
  credits = Math.round(credits * incomeMult(data)); // (M20b) Kaching's Golden touch: +20% match income
  return { res, credits, history, momentum, rep: round1(history + momentum) };
}

export function recordResult(data, fixture, score, day) {
  const L = normaliseLeague(data);
  const club = clubById(fixture.opponent.id);
  if (!club) return null;
  const before = rank(data);
  const promo = !!fixture.promotion;
  const friendly = isFriendly(fixture); // (M21b)
  const reward = previewReward(data, club.id, score, promo, friendly);
  const promotionFinal = isPromotionFinal(data, fixture); // (M19: the conditions as they stood at kickoff)
  if (!friendly) { // (M21b) a friendly leaves the league record alone: no wins toward promotion
    const c = (L.clubs[club.id] ??= blankClub());
    c[reward.res === 'win' ? 'w' : reward.res === 'draw' ? 'd' : 'l']++;
    c.meetings++;
    if (!fixture.cup) c.cooldownUntil = day + club.cooldown; // (a cup tie leaves the league's rematch cooldown alone)
  }
  L.rep.history = round1(L.rep.history + reward.history);
  L.rep.momentum = round1(Math.max(0, L.rep.momentum + reward.momentum));
  L.credits += reward.credits;
  L.offers = L.offers.filter((o) => o.state === 'open' && o.id !== fixture.offerId);
  // (M17) a cup tie: the bracket moves on; a round won earns Credits, the cup itself its prize and flags
  let cup = null;
  if (fixture.cup) {
    cup = CUP.recordOurTie(data, fixture.cup, score, day);
    const pz = cup?.prize;
    if (pz) {
      const k = cupById(cup.cup)?.tierScale ? leagueOf(data).tier : 1; // (M21b) the Showcase's prize grows with your league
      L.credits += Math.round((pz.credits ?? 0) * k * incomeMult(data)); // (M20b) Kaching: +20% prize money
      L.rep.history = round1(L.rep.history + (pz.history ?? 0) * k);
      L.rep.momentum = round1(L.rep.momentum + (pz.momentum ?? 0) * k);
      for (const f of pz.flags ?? []) (data.unlocks ??= {})[f] ??= day;
      if (pz.rumour) { // (M21) a clue line in the Rumours list (the clue chains are M28)
        data.secrets ??= { v: 1, track: {}, state: {}, rumours: [] };
        data.secrets.rumours = [...(data.secrets.rumours ?? []), { day, id: `cup:${cup.cup}`, stage: 0, text: pz.rumour }].slice(-40);
      }
      if (pz.tokens) data.prestige = { ...(data.prestige ?? {}), tokens: (data.prestige?.tokens ?? 0) + pz.tokens }; // (M21 C08; the account keeps them for NG+)
    }
    if (cup?.champion) addHistory(data, day, `Won the ${cupById(cup.cup).name}`); // (M18: the C04 "club history" prize)
    if (cup) cup.events = [...(cup.events ?? []), ...cupsDay(data, day)]; // (M21) the next tie today: 7 days after the result
  }
  const lg = leagueOf(data);
  const P = progressOf(data, lg.id);
  if (reward.res === 'win' && !friendly) noteSeasonWin(data, club.id, day); // (M20) C07's door: different league clubs beaten this season
  let unlockedNow = false;
  let offerNow = null;
  let crownTitle = false;
  if (promo && lg.promotion.final.title) {
    // (M20) the Crown Title Match: won → the Crown title (no offer — there is no league above); lost / drawn → 28 days' wait
    P.matches++;
    if (reward.res === 'win') {
      P.won = true;
      P.via = 'title';
      L.crownTitle = { day, year: yearOfDay(day), opponent: club.id };
      achieve(data, lg.achievement, day);
      addHistory(data, day, `CROWN CHAMPIONS — won the Crown Title Match against the ${club.name}`);
      news(data, day, `Crown Champions! ${AFTER_TITLE}`);
      crownTitle = true;
    } else P.retryAt = day + lg.promotion.retryCooldown;
  } else if (promo) {
    P.matches++;
    if (reward.res === 'win') {
      P.won = true;
      P.via = stepVia(lg);
      setOffer(lg.id, P, 'offered');
      offerNow = lg.id;
    } else P.retryAt = day + lg.promotion.retryCooldown;
  } else if (promotionFinal && cup) {
    // (M19) the cup's final as the Promotion Final: won (penalties count) → the offer; lost → the same wait as a Decider
    if (cup.champion) {
      P.won = true;
      P.unlocked = true;
      P.via = 'final';
      setOffer(lg.id, P, 'offered');
      L.offers = L.offers.filter((o) => !(o.promotion && o.state === 'open'));
      offerNow = lg.id;
    } else P.retryAt = day + lg.promotion.retryCooldown;
  } else if (!friendly) {
    const ch = checkPromotion(data);
    if (ch === 'unlocked') unlockedNow = true;
    if (ch === 'offered') offerNow = lg.id;
  }
  return { ...reward, club: club.id, rankBefore: before.id, rankAfter: rank(data).id, total: reputation(data).total, promotionUnlocked: unlockedNow, promotionWon: (promo && reward.res === 'win') || (promotionFinal && !!cup?.champion), promotionFinal, offerNow, crownTitle, league: lg.id, cup };
}

// (M17) Moving up: your league becomes the next one. Its clubs' records start (the old league's stay in the history), the
// old league's open challenges go (a match already fixed still plays), its cup opens and its stadium flag is set.
function enterLeague(data, id, day, line) {
  const L = normaliseLeague(data);
  const lg = leagueById(id);
  L.tier = id;
  L.entered = { ...(L.entered ?? {}), [id]: day };
  for (const c of lg.clubs) L.clubs[c] ??= blankClub();
  L.offers = L.offers.filter((o) => o.state === 'accepted' || o.cup || lg.clubs.includes(o.clubId)); // (a cup tie still stands)
  if (lg.stadiumFlag) (data.unlocks ??= {})[lg.stadiumFlag] ??= day;
  if (lg.entered) achieve(data, lg.entered, day); // (M20) A14 Top Flight
  for (const cup of Object.values(CUPS).filter((c) => c.opens.league === id)) {
    const C = CUP.normaliseCups(data)[cup.id];
    C.nextStart = Math.max(C.nextStart ?? 0, day); // (its first edition opens now)
  }
  news(data, day, line);
  addHistory(data, day, `Promoted to the ${lg.name}`);
}
function achieve(data, id, day) {
  data.achievements ??= {};
  if (ACHIEVEMENTS[id] && !data.achievements[id]) data.achievements[id] = { day };
}

export function acceptOffer(data, id = leagueOf(data).id, day = normaliseLeague(data).lastDay ?? 0) {
  const lg = leagueById(id);
  const P = progressOf(data, id);
  if (!lg || offerOf(id, P) !== 'offered') return false; // (never without the promotion step won — and that needs the rest)
  setOffer(id, P, 'accepted');
  achieve(data, lg.achievement, day);
  const next = leagueById(lg.promotion.to);
  if (next) enterLeague(data, next.id, day, `Promoted: welcome to the ${next.name}.${next.cup ? ` The ${cupById(next.cup).name} opens now.` : ''}`);
  else {
    news(data, day, `${COMING[lg.promotion.to]?.name ?? 'The next league'} offer accepted: coming soon.`);
    addHistory(data, day, `Earned promotion to the ${COMING[lg.promotion.to]?.name ?? 'next league'}`); // (M19)
  }
  return true;
}
export const acceptCounty = (data) => acceptOffer(data, 'regional');

// (M17) An older save that accepted a promotion offer while the next league was "coming soon" moves up when it opens (M17:
// County; M18: National). → the league id it moved up to, or false
export function catchUp(data, day) {
  const L = normaliseLeague(data);
  let moved = false;
  for (let guard = 0; guard < LEAGUES.length; guard++) {
    const lg = leagueOf(data);
    const next = leagueById(lg.promotion.to);
    if (!next || offerOf(lg.id, progressOf(data, lg.id)) !== 'accepted') break;
    achieve(data, lg.achievement, day);
    enterLeague(data, next.id, day, `The ${next.name} is open: your club has moved up from the ${lg.name} (its record is kept).`);
    moved = next.id;
  }
  return moved;
}

export { STADIUM_FLAGS, ACHIEVEMENTS };
