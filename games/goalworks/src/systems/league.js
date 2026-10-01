// The Regional League (Milestone 10, bible §7 / §8 / §21): challenge opportunities, results, reputation and Club Rank,
// Credits (a placeholder), the Regional record and the Regional → County promotion path. Plain functions over the run
// save (data.league); numbers in data/league.js, clubs in data/fixtures.js REGIONAL_CLUBS.
//   normaliseLeague(data)                       data.league in its shape (an older save starts fresh: no record, rep 0)
//   leagueDay(data, day)                         a club day: momentum fades, offers expire, clubs may issue challenges,
//                                                the Promotion Match is issued once unlocked
//   openOffers(data) → [offer]                   offer = { id, clubId, issuedDay, until (null: stays), home, promotion }
//   calendarOffer(offer) → the calendar's offer   { source: 'league', opponent, offerId, home, promotion }
//   isIssued(data, calOffer) → bool              the calendar's gate: only an issued, open offer can become a fixture
//   accept(data, offerId, calendar) → { ok, why, fixture }    decline(data, offerId, day)
//   recordResult(data, fixture, score, day) → summary (credits, reputation, rank, promotion news)
//   reputation(data) → { history, momentum, total }   rankOf(total) → RANKS entry   rank(data)
//   record(data) → { clubs: { id: { w, d, l } }, wins, distinct, beaten: [ids] }
//   promotion(data) → { distinct, wins, unlocked, won, county: null | 'offered' | 'accepted' }   acceptCounty(data)
//   previewReward(data, clubId, score, promotion) → what a result would give (the result screen, before Continue)
import { Rng } from '../../../../core/Rng.js';
import { REGIONAL_CLUBS, clubById } from '../../data/fixtures.js';
import { ISSUE, RANKS, REPUTATION, CREDITS, PROMOTION } from '../../data/league.js';

const round1 = (v) => Math.round(v * 10) / 10;

export function normaliseLeague(data) {
  data.league ??= {
    v: 10,
    offers: [], // open and accepted offers
    nextId: 1,
    clubs: Object.fromEntries(REGIONAL_CLUBS.map((c) => [c.id, { w: 0, d: 0, l: 0, meetings: 0, cooldownUntil: 0 }])),
    rep: { history: 0, momentum: 0 },
    credits: 0, // PLACEHOLDER until the money ledger (Milestone 23)
    promotion: { unlocked: false, won: false, county: null, retryAt: 0, matches: 0 },
    lastDay: null,
  };
  for (const c of REGIONAL_CLUBS) data.league.clubs[c.id] ??= { w: 0, d: 0, l: 0, meetings: 0, cooldownUntil: 0 };
  return data.league;
}

export const reputation = (data) => {
  const r = normaliseLeague(data).rep;
  return { history: r.history, momentum: r.momentum, total: round1(r.history + r.momentum) };
};
export const rankOf = (total) => [...RANKS].reverse().find((r) => total >= r.min);
export const rank = (data) => rankOf(reputation(data).total);

export function record(data) {
  const L = normaliseLeague(data);
  const beaten = REGIONAL_CLUBS.filter((c) => L.clubs[c.id].w > 0).map((c) => c.id);
  return {
    clubs: Object.fromEntries(REGIONAL_CLUBS.map((c) => [c.id, { w: L.clubs[c.id].w, d: L.clubs[c.id].d, l: L.clubs[c.id].l }])),
    wins: REGIONAL_CLUBS.reduce((s, c) => s + L.clubs[c.id].w, 0),
    distinct: beaten.length,
    beaten,
  };
}
export function promotion(data) {
  const L = normaliseLeague(data);
  const r = record(data);
  return { distinct: r.distinct, wins: r.wins, need: { distinct: PROMOTION.distinct, wins: PROMOTION.wins }, unlocked: L.promotion.unlocked, won: L.promotion.won, county: L.promotion.county };
}

// Clubs that will deal with you now (your reputation meets their requirement).
export const unlockedClubs = (data) => REGIONAL_CLUBS.filter((c) => reputation(data).total >= c.rep);
// The Promotion Match opponent: the highest unlocked Regional club.
export const promotionOpponent = (data) => unlockedClubs(data).slice(-1)[0] ?? REGIONAL_CLUBS[0];

export const openOffers = (data) => normaliseLeague(data).offers.filter((o) => o.state === 'open');
export const acceptedOffer = (data) => normaliseLeague(data).offers.find((o) => o.state === 'accepted') ?? null;

function issue(data, club, day, promo = false) {
  const L = normaliseLeague(data);
  const o = { id: `o${L.nextId++}`, clubId: club.id, issuedDay: day, until: promo ? null : day + ISSUE.openDays, home: L.clubs[club.id].meetings % 2 === 0, promotion: promo, state: 'open' };
  L.offers.push(o);
  return o;
}

export function leagueDay(data, day) {
  const L = normaliseLeague(data);
  L.rep.momentum = round1(Math.max(0, L.rep.momentum - REPUTATION.fade));
  // expire offers left too long (that club waits a little before asking again)
  for (const o of L.offers) {
    if (o.state === 'open' && o.until != null && day > o.until) {
      o.state = 'expired';
      L.clubs[o.clubId].cooldownUntil = Math.max(L.clubs[o.clubId].cooldownUntil, day + ISSUE.declineCooldown);
    }
  }
  L.offers = L.offers.filter((o) => o.state === 'open' || o.state === 'accepted');
  // the Promotion Match, once unlocked (it stays open until played; after a loss it comes back after a short wait)
  if (L.promotion.unlocked && !L.promotion.won && day >= L.promotion.retryAt && !L.offers.some((o) => o.promotion)) {
    const opp = promotionOpponent(data);
    L.offers = L.offers.filter((o) => !(o.state === 'open' && o.clubId === opp.id)); // (it takes the place of that club's open challenge)
    issue(data, opp, day, true);
  }
  // ordinary challenges
  const rng = new Rng(`${data.seed}:league:${day}`);
  for (const c of REGIONAL_CLUBS) {
    const roll = rng.next(); // (one roll per club per day, always drawn: the same days give the same offers)
    if (reputation(data).total < c.rep || L.clubs[c.id].cooldownUntil > day || L.offers.some((o) => o.clubId === c.id)) continue;
    if (roll < ISSUE.chance) issue(data, c, day);
  }
  L.lastDay = day;
}

export const calendarOffer = (o) => {
  const c = clubById(o.clubId);
  return { source: 'league', opponent: { id: c.id, name: c.name }, offerId: o.id, home: o.home, promotion: !!o.promotion };
};
export function isIssued(data, calOffer) {
  if (calOffer?.source !== 'league') return false;
  const o = normaliseLeague(data).offers.find((x) => x.id === calOffer.offerId);
  return !!o && o.state === 'open' && o.clubId === calOffer.opponent?.id;
}

export function accept(data, offerId, calendar) {
  const o = openOffers(data).find((x) => x.id === offerId);
  if (!o) return { ok: false, why: 'That challenge is no longer open.', fixture: null };
  const r = calendar.commit(calendarOffer(o));
  if (r.ok) o.state = 'accepted';
  return r;
}
export function decline(data, offerId, day) {
  const L = normaliseLeague(data);
  const o = L.offers.find((x) => x.id === offerId && x.state === 'open' && !x.promotion);
  if (!o) return false;
  o.state = 'declined';
  L.clubs[o.clubId].cooldownUntil = Math.max(L.clubs[o.clubId].cooldownUntil, day + ISSUE.declineCooldown);
  L.offers = L.offers.filter((x) => x !== o);
  return true;
}

const resultOf = ([us, them]) => (us > them ? 'win' : us < them ? 'loss' : 'draw');

export function previewReward(data, clubId, score, promo = false) {
  const tier = clubById(clubId)?.reward ?? 1;
  const res = resultOf(score);
  let credits = CREDITS[res][tier];
  let history = res === 'loss' ? 0 : REPUTATION[res][tier].history;
  let momentum = res === 'loss' ? -Math.min(normaliseLeague(data).rep.momentum, REPUTATION.loss[tier]) : REPUTATION[res][tier].momentum;
  if (promo && res === 'win') {
    credits += CREDITS.promotionWin;
    history += REPUTATION.promotionWin.history;
    momentum += REPUTATION.promotionWin.momentum;
  }
  return { res, credits, history, momentum, rep: round1(history + momentum) };
}

export function recordResult(data, fixture, score, day) {
  const L = normaliseLeague(data);
  const club = clubById(fixture.opponent.id);
  if (!club) return null;
  const before = rank(data);
  const promo = !!fixture.promotion;
  const reward = previewReward(data, club.id, score, promo);
  const c = L.clubs[club.id];
  c[reward.res === 'win' ? 'w' : reward.res === 'draw' ? 'd' : 'l']++;
  c.meetings++;
  c.cooldownUntil = day + club.cooldown;
  L.rep.history = round1(L.rep.history + reward.history);
  L.rep.momentum = round1(Math.max(0, L.rep.momentum + reward.momentum));
  L.credits += reward.credits;
  L.offers = L.offers.filter((o) => o.state === 'open' && o.id !== fixture.offerId);
  let unlockedNow = false;
  if (promo) {
    L.promotion.matches++;
    if (reward.res === 'win') {
      L.promotion.won = true;
      L.promotion.county = 'offered';
    } else L.promotion.retryAt = day + PROMOTION.retryCooldown;
  } else if (!L.promotion.unlocked) {
    const p = record(data);
    if (p.distinct >= PROMOTION.distinct && p.wins >= PROMOTION.wins) {
      L.promotion.unlocked = true;
      unlockedNow = true;
    }
  }
  return { ...reward, club: club.id, rankBefore: before.id, rankAfter: rank(data).id, total: reputation(data).total, promotionUnlocked: unlockedNow, promotionWon: promo && reward.res === 'win' };
}

export function acceptCounty(data) {
  const L = normaliseLeague(data);
  if (!L.promotion.won) return false; // (never without the promotion match won — and that needs the other two conditions)
  L.promotion.county = 'accepted';
  return true;
}
