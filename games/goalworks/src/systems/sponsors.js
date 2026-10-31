// Sponsors (Milestone 23, bible §24): the ten sponsors' unlocks, Celeste Moore's offers (one at a time, a one-tap sheet),
// up to three active deals in their slots (shirt, sleeve, stadium), each deal's bounded objectives, the end-of-deal bonus and
// re-signing, and the benefits through the shared effect query. Missing an objective lowers the bonus and the chance to
// re-sign — never anything worse. Plain functions over the run save; the numbers and words are in data/sponsors.js.
//   data.sponsors = { v: 1, unlocked: { id: day }, offers: [offer], active: [deal], history: [row], cooldown: { id: day },
//                     nextOfferDay, interest: n, lastDay }
//   offer = { uid, id, day, until, stipend, seasons, objectives: [{ id, need }], resign }
//   deal  = { uid, id, slot, start, end, stipend, seasons, objectives: [{ id, need, have }], fanStart, tierStart }
//   normaliseSponsors(data, day)     an older save: no deals, no past sponsors invented; unlocks are read from today
//   sponsorsDay(data, day) → events  unlocks, stipends (weekly), the signing budget (season start), deals ending, offers
//   accept(data, uid, day) / decline(data, uid, day) → { ok, why, replaced }
//   afterMatch(data, { fixture, score, xiIds, cup }, day)   the deals' counters; a cup won → sponsor interest
//   sponsorBonus(data, key) → the active deals' benefit for that effect key (effects.js adds it)
//   weeklyStipends(data) → Credits a week now · stipendOf(data, deal) · objectiveLine(o) · forceUnlock(data, id, day)
import { Rng } from '../../../../core/Rng.js';
import { SPONSORS, SPONSOR_SLOTS, OBJECTIVES, SPONSOR_RULES, SPONSOR_TEXT, sponsorById } from '../../data/sponsors.js';
import { RANKS, leagueById } from '../../data/league.js';
import { cupById } from '../../data/cups.js';
import { rank as clubRank, news } from './league.js';
import { godBonus } from './gods.js';
import { post } from './finance.js';
import { effect } from './effects.js';
import { trust } from './fans.js';

const YEAR = 336;
const WEEK = 7;
const rankIdx = (id) => RANKS.findIndex((r) => r.id === id);
const tierOf = (data) => leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;
const idx = (id) => SPONSORS.findIndex((s) => s.id === id);
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
export const objectiveById = (id) => OBJECTIVES.find((o) => o.id === id) ?? null;

export function normaliseSponsors(data, day = data.league?.lastDay ?? 0) {
  data.sponsors ??= { v: 1, unlocked: {}, offers: [], active: [], history: [], cooldown: {}, nextOfferDay: (day ?? 0) + SPONSOR_RULES.firstOfferDay, interest: 0, nextUid: 1 };
  const S = data.sponsors;
  for (const k of ['offers', 'active', 'history']) S[k] ??= [];
  S.unlocked ??= {};
  S.cooldown ??= {};
  S.nextUid ??= 1;
  return S;
}

// Wins in every competitive match so far (the league records; cups count through them).
const totalWins = (data) => Object.values(data.league?.clubs ?? {}).reduce((s, c) => s + (c.w ?? 0), 0);
export function unlockedNow(data, def) {
  const u = def.unlock;
  if (u.wins) return totalWins(data) >= u.wins;
  if (u.rank) return rankIdx(clubRank(data).id) >= rankIdx(u.rank) || (!!data.unlocks?.eliteSponsor && ['B', 'A'].includes(u.rank)); // (C12's prize: the Elite sponsors early)
  if (u.league) return tierOf(data) >= (leagueById(u.league)?.tier ?? 99);
  if (u.secret) return data.secrets?.state?.[u.secret]?.found != null;
  return false;
}

// What a deal pays a week now: its agreed stipend × the research / Media Studio bonus × Kaching's +20% (M20b, stored till now).
export function stipendOf(data, deal) {
  const god = godBonus(data, 'sponsorPct'); // (Kaching: his own × 1.2, not added to the research share)
  const k = 1 + (effect(data, 'sponsorPct') - god + effect(data, 'sponsorFanPct') + effect(data, 'commercialPct')) / 100;
  return Math.round(deal.stipend * k * (1 + god / 100));
}
export const weeklyStipends = (data) => (data.sponsors?.active ?? []).reduce((s, d) => s + stipendOf(data, d), 0);

export function sponsorBonus(data, key) {
  const A = data?.sponsors?.active;
  if (!A?.length) return 0;
  let v = 0;
  for (const d of A) {
    const b = sponsorById(d.id)?.benefit;
    if (b?.key === key) v += b.value;
  }
  return v;
}

export const objectiveLine = (o) => objectiveById(o.id).text(o.need);
const measureOf = (o) => objectiveById(o.id).measure;

// The objectives for a new deal: one or two from the list that make sense now (no "move up" at the top league).
function pickObjectives(data, def, seasons, rng) {
  const top = !leagueById(data.league?.tier ?? 'regional')?.promotion?.to;
  const pool = OBJECTIVES.filter((o) => !(o.id === 'tier' && top) && !(o.id === 'cup' && idx(def.id) < 1));
  const n = def.tier === 'Local' ? 1 : rng.next() < 0.5 ? 1 : 2;
  const out = [];
  while (out.length < n && pool.length) {
    const o = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
    const per = o.need[Math.max(0, idx(def.id))];
    out.push({ id: o.id, need: o.id === 'tier' ? 1 : Math.max(1, Math.round(per * (o.id === 'fans' ? Math.min(2, seasons) : seasons))) });
  }
  return out;
}

function makeOffer(data, def, day, { resign = false, stipend = null } = {}) {
  const S = data.sponsors;
  const rng = new Rng(`${data.seed}:sponsor:${def.id}:${day}`);
  const interest = !resign && S.interest > 0;
  if (interest) S.interest = 0;
  const base = stipend ?? Math.round((def.stipend * (interest ? SPONSOR_RULES.interest : 1)) / 10) * 10;
  const o = { uid: S.nextUid++, id: def.id, day, until: day + SPONSOR_RULES.offerDays, stipend: base, seasons: def.seasons, objectives: pickObjectives(data, def, def.seasons, rng), resign, interest };
  S.offers.push(o);
  return o;
}

// The sponsor Celeste brings next: unlocked, not active, not resting, not already offered; the best-paying first. With all
// three slots full, only one that pays more than the deal ending soonest.
function nextCandidate(data, day) {
  const S = data.sponsors;
  const busy = new Set([...S.active.map((d) => d.id), ...S.offers.map((o) => o.id)]);
  const list = SPONSORS.filter((s) => S.unlocked[s.id] != null && !busy.has(s.id) && !(S.cooldown[s.id] > day)).sort((a, b) => b.stipend - a.stipend);
  if (!list.length) return null;
  if (S.active.length < SPONSOR_RULES.maxActive) return list[0];
  const weakest = S.active.slice().sort((a, b) => a.stipend - b.stipend)[0];
  return list[0].stipend > weakest.stipend * 1.2 ? list[0] : null;
}

function settle(data, deal, day, { early = false } = {}) {
  const S = data.sponsors;
  const def = sponsorById(deal.id);
  const met = deal.objectives.filter((o) => progressOf(data, deal, o).met).length;
  const of = deal.objectives.length;
  const share = of ? met / of : 1;
  const bonus = early ? 0 : Math.round(stipendOf(data, deal) * SPONSOR_RULES.bonusWeeks * share);
  if (bonus) post(data, bonus, 'sponsors', `${def.name}: end-of-deal bonus (${met} of ${of} objectives)`, day);
  S.active = S.active.filter((d) => d !== deal);
  const row = { id: deal.id, start: deal.start, end: day, met, of, bonus, early };
  let resigned = null;
  if (!early) {
    const chance = share >= 1 ? SPONSOR_RULES.resign.all : met > 0 ? SPONSOR_RULES.resign.some : SPONSOR_RULES.resign.none;
    const rng = new Rng(`${data.seed}:sponsor:resign:${deal.uid}`);
    if (rng.next() < chance) resigned = makeOffer(data, def, day, { resign: true, stipend: Math.round((deal.stipend * (share >= 1 ? 1.1 : 1)) / 10) * 10 });
    else S.cooldown[deal.id] = day + SPONSOR_RULES.cooldownDays;
  }
  row.resignOffered = !!resigned;
  S.history = [...S.history, row].slice(-12);
  return { kind: 'ended', id: deal.id, met, of, bonus, resign: resigned?.uid ?? null, early };
}

// How far a deal's objective has got. → { have, need, met }
export function progressOf(data, deal, o) {
  const m = measureOf(o);
  const c = deal.counts ?? {};
  let have = 0;
  if (m === 'fanGain') have = Math.max(0, Math.round(trust(data) - (deal.fanStart ?? 50)));
  else if (m === 'tierUp') have = tierOf(data) > (deal.tierStart ?? 1) ? 1 : 0;
  else have = c[m] ?? 0;
  return { have, need: o.need, met: have >= o.need };
}

export function sponsorsDay(data, day) {
  const S = normaliseSponsors(data, day);
  if (S.lastDay === day) return [];
  S.lastDay = day;
  const events = [];
  for (const def of SPONSORS) {
    if (S.unlocked[def.id] != null || !unlockedNow(data, def)) continue;
    S.unlocked[def.id] = day;
    events.push({ kind: 'unlocked', id: def.id });
    if (S.nextOfferDay > day + SPONSOR_RULES.firstOfferDay) S.nextOfferDay = day + SPONSOR_RULES.firstOfferDay; // (Celeste calls soon after)
  }
  // deals ending
  for (const d of S.active.slice()) if (d.end <= day) events.push(settle(data, d, day));
  // stipends each week; Ironbank's transfer budget at the deal's start and each season's start
  if (day > 0 && day % WEEK === 0) for (const d of S.active) post(data, stipendOf(data, d), 'sponsors', `${sponsorById(d.id).name} stipend`, day);
  if (day > 0 && day % YEAR === 0) for (const d of S.active) payBudget(data, d, day);
  // offers that run out
  for (const o of S.offers.slice()) {
    if (o.until > day) continue;
    S.offers = S.offers.filter((x) => x !== o);
    S.cooldown[o.id] = day + SPONSOR_RULES.offerGap;
  }
  // Celeste's next offer (one open at a time)
  if (!S.offers.length && day >= S.nextOfferDay) {
    const def = nextCandidate(data, day);
    if (def) {
      const o = makeOffer(data, def, day);
      S.nextOfferDay = day + SPONSOR_RULES.offerGap;
      news(data, day, `${def.name} want to sponsor the club: ${fmt(o.stipend)} Credits a week for ${o.seasons} season${o.seasons === 1 ? '' : 's'}. Expect my call.`, 'celeste_moore');
      events.push({ kind: 'offer', uid: o.uid, id: def.id });
    }
  }
  for (const o of S.offers) if (o.resign && !o.shown) {
    o.shown = true;
    events.push({ kind: 'offer', uid: o.uid, id: o.id, resign: true });
  }
  return events;
}

function payBudget(data, deal, day) {
  const b = sponsorById(deal.id)?.benefit;
  if (b?.key !== 'signingBudget') return;
  post(data, stipendOf(data, deal) * b.value, 'sponsors', `${sponsorById(deal.id).name}: transfer budget`, day);
}

export const openOffers = (data) => normaliseSponsors(data).offers.slice();
export const offerByUid = (data, uid) => normaliseSponsors(data).offers.find((o) => o.uid === uid) ?? null;
// The slot a new deal would take, and the deal it would replace (all three full: the one ending soonest).
export function slotFor(data, offer) {
  const S = normaliseSponsors(data);
  const def = sponsorById(offer.id);
  const free = SPONSOR_SLOTS.map((s) => s.id).filter((id) => !S.active.some((d) => d.slot === id));
  if (free.length) return { slot: free.includes(def.slot) ? def.slot : free[0], replaces: null };
  const r = S.active.slice().sort((a, b) => a.end - b.end)[0];
  return { slot: r.slot, replaces: r };
}

export function accept(data, uid, day) {
  const S = normaliseSponsors(data, day);
  const o = S.offers.find((x) => x.uid === uid);
  if (!o) return { ok: false, why: 'That offer has gone.' };
  const def = sponsorById(o.id);
  const { slot, replaces } = slotFor(data, o);
  let replaced = null;
  if (replaces) {
    settle(data, replaces, day, { early: true });
    replaced = replaces.id;
  }
  S.offers = S.offers.filter((x) => x !== o);
  const deal = { uid: o.uid, id: o.id, slot, start: day, end: day + o.seasons * YEAR, stipend: o.stipend, seasons: o.seasons, objectives: o.objectives.map((x) => ({ ...x })), counts: { wins: 0, youthApps: 0, cleanSheets: 0, tiesWon: 0 }, fanStart: trust(data), tierStart: tierOf(data) };
  S.active.push(deal);
  payBudget(data, deal, day);
  news(data, day, `${def.name} signed: ${fmt(o.stipend)} Credits a week on the ${SPONSOR_SLOTS.find((s) => s.id === slot).name.toLowerCase()} for ${o.seasons} season${o.seasons === 1 ? '' : 's'}.`, 'celeste_moore');
  return { ok: true, deal, replaced };
}
export function decline(data, uid, day) {
  const S = normaliseSponsors(data, day);
  const o = S.offers.find((x) => x.uid === uid);
  if (!o) return { ok: false, why: 'That offer has gone.' };
  S.offers = S.offers.filter((x) => x !== o);
  S.cooldown[o.id] = day + SPONSOR_RULES.offerGap * 2;
  return { ok: true };
}

// After one of your matches: the deals' counters (a friendly counts for none); a cup won → the next offer is better.
export function afterMatch(data, { fixture, score, xiIds = [], cup = null, youth = 0 }, day) {
  if (fixture?.cup && cupById(fixture.cup.id)?.friendly) return;
  const S = normaliseSponsors(data, day);
  const win = score[0] > score[1] || (cup?.won && score[0] === score[1]);
  for (const d of S.active) {
    d.counts ??= { wins: 0, youthApps: 0, cleanSheets: 0, tiesWon: 0 };
    if (win) d.counts.wins++;
    if (score[1] === 0) d.counts.cleanSheets++;
    d.counts.youthApps += youth;
    if (cup?.won) d.counts.tiesWon++;
  }
  if (cup?.champion) {
    S.interest = (S.interest ?? 0) + 1;
    S.nextOfferDay = Math.min(S.nextOfferDay, day + 7);
  }
}

// ?debug=1 / tests: a sponsor unlocked now (SP09 / SP10's secrets: found in this run only, as the debug gods are).
export function forceUnlock(data, id, day) {
  const S = normaliseSponsors(data, day);
  const def = sponsorById(id);
  if (!def) return false;
  if (def.unlock.secret) {
    data.secrets ??= { v: 1, track: {}, state: {}, rumours: [] };
    data.secrets.state ??= {};
    data.secrets.state[def.unlock.secret] = { clue: 0, found: data.secrets.state[def.unlock.secret]?.found ?? day, debug: true };
  }
  S.unlocked[id] ??= day;
  S.cooldown[id] = 0;
  S.nextOfferDay = day;
  return true;
}
// ?debug=1 / tests: Celeste brings this sponsor's offer now.
export function forceOffer(data, id, day) {
  const S = normaliseSponsors(data, day);
  forceUnlock(data, id, day);
  S.offers = S.offers.filter((o) => o.id !== id);
  const o = makeOffer(data, sponsorById(id), day);
  return o;
}
export { SPONSOR_TEXT };
