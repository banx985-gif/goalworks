// Negotiation (Milestone 11, bible §11): you make an offer, the other side accepts, rejects or counters — 1 to 3 counters
// at most (each talk draws its own limit), no agent minigame. Plain functions over a plain talk object (saved with the
// run, so closing the sheet and coming back does not reset the counters).
//   createTalk({ kind, ask, limit, side }) → talk
//       kind   'transfer' | 'free' | 'loan' | 'loanOption' | 'pre' | 'renew' | 'sale'
//       ask    what the other side wants: { fee, salary, bonus, years: [min, max] }   (a field they do not care about: 0 / null)
//       side   'seller' (they sell / the player signs: your offer must reach their ask) or 'buyer' (an AI club buying your
//              player: your asking fee must come down to what they will pay; ask.fee = their bid, ask.max = their limit)
//   respond(talk, offer) → { result: 'accept' | 'counter' | 'reject', terms?, why }   offer = { fee, salary, bonus, years }
//       accept   your offer meets every ask (a 'buyer' accepts an asking fee at or below its current bid)
//       counter  close enough: they move `meet` of the way towards you and the new ask is in terms (talk.counters + 1)
//       reject   too far apart (below walkAway of an ask), or the counters are used up — the talk is over
//   The counter terms always meet the (new) ask, so accepting them is always an accept.
import { NEGOTIATION } from '../../data/transfers.js';

const round = (v, step = 10) => Math.round(v / step) * step;

export function createTalk({ kind, ask, limit, side = 'seller' }) {
  const n = Math.max(NEGOTIATION.counters[0], Math.min(NEGOTIATION.counters[1], Math.round(limit)));
  return { kind, side, ask: { fee: 0, salary: 0, bonus: 0, years: null, max: 0, ...ask }, limit: n, counters: 0, state: 'open', last: null };
}

// What the other side would still say yes to (the talk's current ask), as a ready-made offer.
export function askTerms(talk, offer = {}) {
  const a = talk.ask;
  const years = a.years ? Math.max(a.years[0], Math.min(a.years[1], offer.years ?? a.years[0])) : offer.years ?? null;
  return { ...offer, fee: a.fee, salary: Math.max(offer.salary ?? 0, a.salary), bonus: Math.max(offer.bonus ?? 0, a.bonus), years };
}

export function respond(talk, offer) {
  if (talk.state !== 'open') return { result: 'reject', why: 'The talks are over.' };
  const r = talk.side === 'buyer' ? asBuyer(talk, offer) : asSeller(talk, offer);
  talk.last = { offer: { ...offer }, ...r };
  if (r.result !== 'counter') talk.state = r.result === 'accept' ? 'done' : 'over';
  return r;
}

// They sell (or the player signs): each money field must reach the ask; years must sit in the range the player wants.
function asSeller(talk, offer) {
  const a = talk.ask;
  const parts = [
    ['fee', a.fee, offer.fee ?? 0],
    ['salary', a.salary, offer.salary ?? 0],
    ['bonus', a.bonus, offer.bonus ?? 0],
  ].filter(([, want]) => want > 0);
  const short = parts.filter(([, want, got]) => got < want);
  const yearsOk = !a.years || (offer.years >= a.years[0] && offer.years <= a.years[1]);
  if (!short.length && yearsOk) return { result: 'accept', why: 'Deal agreed.' };
  const far = short.find(([, want, got]) => got < want * NEGOTIATION.walkAway);
  if (far) return { result: 'reject', why: `Too far apart on the ${far[0] === 'fee' ? 'fee' : far[0] === 'salary' ? 'wages' : 'signing bonus'}.` };
  if (talk.counters >= talk.limit) return { result: 'reject', why: 'That was their final answer.' };
  // counter: meet you part of the way on each short field, years into the range
  for (const [k, want, got] of short) a[k] = Math.max(got, round(want - NEGOTIATION.meet * (want - got)));
  talk.counters++;
  return { result: 'counter', terms: askTerms(talk, offer), why: counterWhy(short.map(([k]) => k), yearsOk) };
}

// An AI club buying your player: ask.fee = its current bid, ask.max = the most it will pay. Your asking fee (offer.fee).
function asBuyer(talk, offer) {
  const a = talk.ask;
  const want = offer.fee ?? 0;
  if (want <= a.fee) return { result: 'accept', why: 'They accept your price.', terms: { fee: want } };
  if (want * NEGOTIATION.walkAway > a.max) return { result: 'reject', why: 'Your price is far beyond what they will pay.' };
  if (talk.counters >= talk.limit) {
    if (want <= a.max) return { result: 'accept', why: 'They meet your price at the last.', terms: { fee: want } };
    return { result: 'reject', why: 'That was their final offer; they walk away.' };
  }
  a.fee = Math.min(a.max, Math.max(a.fee, round(a.fee + NEGOTIATION.meet * (Math.min(want, a.max) - a.fee))));
  talk.counters++;
  return { result: 'counter', terms: { fee: a.fee }, why: `They raise their bid to ${a.fee.toLocaleString('en-GB')} Credits.` };
}

function counterWhy(fields, yearsOk) {
  const names = fields.map((k) => (k === 'fee' ? 'the fee' : k === 'salary' ? 'wages' : 'the signing bonus'));
  if (!yearsOk) names.push('the contract length');
  return `They come back on ${names.join(' and ')}.`;
}
