// The academy (Milestone 15, bible §10 / §12 Youth Coach): the yearly intake of young players, their hidden potential
// (stored exactly, shown as a range), and the prospects' life in the academy — daily training on the Milestone 8 rules,
// promotion to the senior squad on a Prospect contract (M11), release, a youth loan (M11 loans), retraining to a new
// position and a mentor from the senior squad. Plain functions over the run save (data.academy; numbers in data/academy.js).
//   data.academy = { v: 15, players: [prospect], intake: null | { year, opens, closes, candidates: [player] | null,
//                    signed: [id], golden }, history: [{ year, count, signed: [name], golden, missed }], log, nextId,
//                    focus (the academy session), startDay (no window before it: an older save's first intake is the
//                    next window), lastDay, lastYear }
//   a prospect / candidate is a player (src/systems/players.js) with potential { low, high (the range shown), exact (the
//   hidden potential: his training ceiling) } and youth { projected (the exact roll at the trials), breakthrough (0 … 5,
//   how far he has beaten it), intakeYear, joinedDay, fromWatch }; contract { role: 'Academy', salary 0 }.
//   newAcademy(day) · normaliseAcademy(data, day) → data.academy
//   windowOf(day) → { year, opens, closes }      hasCorner(data) · placesOf(data) · academyCount(data)
//   accuracy(data, p, day) → 0 … 1    rangeOf(data, p, day) → { low, high, width, label }   (the projection's range)
//   generateIntake(data, year) → { candidates, golden }  (seeded by the run and the year; the first takes the watch list)
//   sign · promote · release · loanOut · setRetrain · setMentor · setFocus · setAcademyFocus → { ok, why }
//   canPromote / canLoan / canSign → a plain reason or null      mentorsFor(data, p) → seniors who could mentor him
//   academyDay(data, day) → events: window | intake | closed | missed | breakthrough | learned | left
//   validateAcademy(data) → [] or what is wrong (tests, ?debug=1)
// Milestone 16: the regens of your retired players (data.careers.academyRegens) come to the next trials first, each with
// the retiree's position and a share of his quality as the projection (youth.regenOf: whose).
import { Rng } from '../../../../core/Rng.js';
import { INTAKE, POTENTIAL, YOUTH_SCALE, BREAKTHROUGH, REVEAL, LABELS, PLACES, ACADEMY_XP, DEFAULT_ACADEMY_FOCUS, MENTOR, AGES, YOUTH_LOAN } from '../../data/academy.js';
import { FEATURED_NAMES, POSITION_ORDER } from '../../data/players.js';
import { FOCUSES, FATIGUE } from '../../data/training.js';
import { LOAN, POOL, SQUAD_RULES } from '../../data/transfers.js';
import { generatePlayer, overall } from './players.js';
import { salaryFor } from './squad.js';
import { normalisePlayer, dailyXp, gainXp, retrainDay, normaliseTraining } from './training.js';
import { effect } from './effects.js';
import { facilityLevel } from './facilities.js';
import { inRole } from './staff.js';
import { squadCount, freeShirt, log as transferLog, ownerName } from './transfers.js';
import { takeAcademyRegens } from './careers.js';

const YEAR = 336;
const MONTH = 28;
const ACADEMY_FACS = ['F09', 'F14', 'F26'];

export const newAcademy = (day = 0) => ({ v: 15, players: [], intake: null, history: [], log: [], nextId: 1, focus: DEFAULT_ACADEMY_FOCUS, startDay: day, lastDay: null, lastYear: 0 });
export function normaliseAcademy(data, day = 0) {
  if (data.academy?.v !== 15) data.academy = newAcademy(day); // (an M14 save: empty, first trials at the next window)
  for (const p of data.academy.players) normalisePlayer(p);
  return data.academy;
}

// --- the facilities -------------------------------------------------------------------------------------------------------
export const hasCorner = (data) => facilityLevel(data, 'F09') > 0;
export const hasAcademyBuilding = (data) => facilityLevel(data, 'F14') > 0;
const levelsAbove1 = (data) => ACADEMY_FACS.reduce((n, id) => n + Math.max(0, facilityLevel(data, id) - 1), 0);
// The academy's places: the best academy facility on the ground (+1 for each of its levels above 1). 0: no academy yet.
export function placesOf(data) {
  for (const id of ['F26', 'F14', 'F09']) {
    const lv = facilityLevel(data, id);
    if (lv) return PLACES[id] + PLACES.perLevel * (lv - 1);
  }
  return 0;
}
// Academy loans out (they come back to the academy).
export const academyLoans = (data) => (data.transfers?.loanedOut ?? []).filter((l) => l.academy);
export const academyCount = (data) => (data.academy?.players.length ?? 0) + academyLoans(data).length;
// An academy player out on loan: { p, clubId, until }.
export function loanedOut(data) {
  const out = [];
  for (const l of academyLoans(data)) {
    const p = data.transfers.clubs[l.clubId]?.players.find((x) => x.id === l.id);
    if (p) out.push({ p, clubId: l.clubId, until: l.until });
  }
  return out;
}

// --- the window -----------------------------------------------------------------------------------------------------------
export function windowOf(day) {
  const year = Math.floor(day / YEAR) + 1;
  const opens = (year - 1) * YEAR + (INTAKE.month - 1) * MONTH;
  return { year, opens, closes: opens + MONTH - 1 };
}
// The next window that will open for this academy (an older save: never the one already under way when it was opened).
export function nextWindow(data, day) {
  const A = data.academy;
  let w = windowOf(day);
  if (A.intake && A.intake.year === w.year) return w;
  if (day > w.closes || w.opens < (A.startDay ?? 0) || A.lastYear >= w.year) w = windowOf(w.opens + YEAR);
  return w;
}

// --- reading potential (bible §10: a range, narrower with better staff, facilities and research) --------------------------
export function accuracy(data, p, day = 0) {
  const R = REVEAL;
  let a = R.base;
  if (inRole(data, 'YC')) a += R.youthCoach;
  a += (R.revealScale * effect(data, 'youthRevealPct')) / 100;
  if (inRole(data, 'SC')) a += R.scout;
  a += (R.localEye * Math.min(100, effect(data, 'localPotentialPct'))) / 100;
  a += R.scoutingPct * effect(data, 'scoutingPct');
  if (effect(data, 'youthTrials') > 0) a += R.youthTrials;
  if (hasAcademyBuilding(data)) a += R.academyFull;
  if (facilityLevel(data, 'F26') > 0) a += R.elite;
  a += R.perLevel * levelsAbove1(data);
  const joined = p?.youth?.joinedDay;
  if (joined != null) a += R.perSeason * Math.min(R.seasonsMax, Math.floor(Math.max(0, day - joined) / YEAR));
  return Math.max(0, Math.min(1, Math.round(a * 1000) / 1000));
}
export const widthOf = (a) => Math.round(REVEAL.minWidth + (REVEAL.maxWidth - REVEAL.minWidth) * (1 - a));
// Where the projection sits inside its range: a steady number per player, never re-rolled.
function hash01(id, key) {
  let h = 2166136261;
  for (const ch of `${id}:${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h % 1000) / 999;
}
export const labelOf = (mid) => LABELS.find(([upTo]) => mid <= upTo)[1];
// The range shown (around the projection — a breakthrough beats it), never below his overall now.
export function rangeOf(data, p, day = 0) {
  const width = widthOf(accuracy(data, p, day));
  const proj = p.youth?.projected ?? p.potential.exact ?? p.potential.high;
  const ovr = overall(p);
  // (a range that would start below his overall now slides up — the same width, so it gives nothing away)
  const low = Math.min(99 - width, Math.max(1, Math.min(ovr, 99), proj - Math.round(width * hash01(p.id, 'ypot'))));
  const high = Math.min(99, low + width);
  return { low, high, width, label: labelOf(Math.round((low + high) / 2)) };
}
function refreshRange(data, p, day) {
  const r = rangeOf(data, p, day);
  p.potential.low = r.low;
  p.potential.high = r.high;
}

// --- the intake -----------------------------------------------------------------------------------------------------------
function usedNames(data) {
  const T = data.transfers;
  const A = data.academy;
  return new Set([
    ...FEATURED_NAMES,
    ...(data.squad?.players ?? []).map((p) => p.name),
    ...(data.squad?.watch ?? []).map((p) => p.name),
    ...(A?.players ?? []).map((p) => p.name),
    ...(A?.intake?.candidates ?? []).map((p) => p.name),
    ...(T ? [...Object.values(T.clubs).flatMap((c) => c.players), ...T.free, ...T.market].map((p) => p.name) : []),
  ]);
}
export function intakeSize(data, rng) {
  let n = rng.int(...INTAKE.count);
  if (hasAcademyBuilding(data)) n += INTAKE.academyFull;
  n += effect(data, 'youthIntakeSize');
  if (effect(data, 'youthTrials') > 0 && rng.next() < INTAKE.trialsChance) n++;
  for (const id of ['F09', 'F14']) for (let lv = 2; lv <= facilityLevel(data, id); lv++) if (rng.next() < INTAKE.levelChance) n++;
  return Math.max(INTAKE.min, Math.min(INTAKE.max, n));
}
// The mean projection at the trials now (before a golden intake's boost).
export function potentialMean(data) {
  const P = POTENTIAL;
  return P.mean + (hasAcademyBuilding(data) ? P.academyFull : 0) + P.youthPotential * effect(data, 'youthPotential') + P.perLevel * levelsAbove1(data);
}
function rollPotential(data, rng, golden) {
  const z = (rng.next() + rng.next() + rng.next() - 1.5) * 2; // a bell: sd 1
  return Math.round(potentialMean(data) + (golden ? POTENTIAL.golden.boost : 0) + POTENTIAL.sd * z);
}
function youthBits(p, projected, year, extra = {}) {
  p.potential = { low: projected, high: projected, exact: projected };
  p.youth = { projected, breakthrough: 0, intakeYear: year, joinedDay: null, ...extra };
  p.contract = { role: 'Academy', salary: 0, years: 0 };
  p.shirt = null;
  p.watch = false;
  p.origin = 'academy';
  p.retrain = null;
  p.mentor = null;
  normalisePlayer(p);
  return p;
}
function newCandidate(data, rng, used, year, golden, regen = null) {
  const A = data.academy;
  const position = regen?.position ?? rng.pick(INTAKE.positions);
  const age = rng.int(...INTAKE.ages);
  let proj = regen ? regen.potential : rollPotential(data, rng, golden);
  const tier = proj >= POTENTIAL.rareFrom ? 'Rare' : 'Standard';
  const p = generatePlayer(rng, { id: `y${A.nextId++}`, position, tier, ageRange: [age, age], area: data.club?.area ?? 'fen', usedNames: used });
  const k = YOUTH_SCALE[age] ?? 0.9; // a youngster has not grown into an adult's stats yet
  for (const s of Object.keys(p.stats)) p.stats[s] = Math.max(8, Math.round(p.stats[s] * k));
  proj = Math.min(POTENTIAL.cap, Math.max(proj, overall(p) + POTENTIAL.room));
  return youthBits(p, proj, year, regen ? { regenOf: regen.of } : {});
}
// The trial players for this year's intake (seeded by the run and the year). The first intake takes the M7 watch list
// (they leave the watch list now) and still has at least one new face.
export function generateIntake(data, year) {
  const A = data.academy;
  const rng = new Rng(`${data.seed}:academy:intake:${year}`);
  const n = intakeSize(data, rng);
  const golden = effect(data, 'goldenGeneration') > 0 && rng.next() < POTENTIAL.golden.chance;
  const used = usedNames(data);
  const out = [];
  const watch = data.squad?.watch ?? [];
  if (watch.length) {
    for (const p of watch.slice(0, INTAKE.max - INTAKE.newFromWatch)) {
      const proj = Math.min(POTENTIAL.cap, Math.max(Math.round((p.potential.low + p.potential.high) / 2), overall(p) + POTENTIAL.room));
      out.push(youthBits(p, proj, year, { fromWatch: true }));
    }
    data.squad.watch = [];
  }
  // (M16) the regens of your retired players come to these trials first (they take the places of new faces)
  for (const r of takeAcademyRegens(data, Math.min(n, INTAKE.max) - out.length)) out.push(newCandidate(data, rng, used, year, false, r));
  const fresh = Math.max(INTAKE.newFromWatch * (out.length ? 1 : 0), n - out.length);
  for (let i = 0; i < fresh && out.length < INTAKE.max; i++) out.push(newCandidate(data, rng, used, year, golden));
  return { candidates: out, golden };
}

// --- the actions ------------------------------------------------------------------------------------------------------------
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const findHome = (data, id) => data.academy?.players.find((p) => p.id === id) ?? null;
function note(data, text) {
  const A = data.academy;
  A.log = [...(A.log ?? []), text].slice(-20);
}
export const intakeOpen = (data, day) => {
  const I = data.academy?.intake;
  return !!I?.candidates && day >= I.opens && day <= I.closes;
};
export function canSign(data, id, day) {
  const I = data.academy?.intake;
  if (!intakeOpen(data, day)) return 'The trials are closed.';
  if (!I.candidates.some((p) => p.id === id)) return 'That player is no longer at the trials.';
  if (I.signed.length >= INTAKE.signMax) return `You have signed ${INTAKE.signMax} from these trials: that is the most from one intake.`;
  const places = placesOf(data);
  if (academyCount(data) >= places) return places ? `The academy is full (${places} places, counting loans out). Promote, release or loan someone first.` : 'No academy yet: build a Youth Corner.';
  return null;
}
export function sign(data, id, day) {
  const why = canSign(data, id, day);
  if (why) return { ok: false, why };
  const A = data.academy;
  const I = A.intake;
  const p = I.candidates.find((x) => x.id === id);
  I.candidates = I.candidates.filter((x) => x !== p);
  I.signed.push(p.id);
  p.youth.joinedDay = day;
  A.players.push(p);
  refreshRange(data, p, day);
  note(data, `${p.name} (${p.position}, ${p.age}) signed from the Year ${I.year} trials.`);
  return { ok: true, autosave: true };
}

export function canPromote(data, p) {
  if (!p) return 'Not at the academy.';
  if (p.age < AGES.promoteMin) return `Too young for the senior squad: ${AGES.promoteMin} at the earliest.`;
  if (data.transfers && squadCount(data) >= SQUAD_RULES.max) return `Your senior squad is full (${SQUAD_RULES.max}, counting loans out and players still to arrive). Sell, release or loan someone first.`;
  return null;
}
// Promotion: a Prospect contract (M11) and a shirt; the range he showed at the academy is the range the club knows him by
// (his exact potential stays hidden — and still his ceiling).
export function promote(data, id, day) {
  const p = findHome(data, id);
  const why = canPromote(data, p);
  if (why) return { ok: false, why };
  const A = data.academy;
  refreshRange(data, p, day);
  const rng = new Rng(`${data.seed}:promote:${id}:${day}`);
  A.players = A.players.filter((x) => x !== p);
  p.contract = { salary: salaryFor(p, 'Prospect'), years: rng.int(3, 5), role: 'Prospect', bonus: 0, clause: null, promised: false, signedDay: day };
  p.shirt = data.transfers ? freeShirt(data) : null;
  p.mentor = null;
  p.joinedDay = day;
  p.origin = 'academy';
  p.youth.promotedDay = day;
  data.squad.players.push(p);
  note(data, `${p.name} promoted to the senior squad (Prospect, ${p.contract.years} years, ${fmt(p.contract.salary)} a week).`);
  if (data.transfers) transferLog(data, day, `${p.name} promoted from the academy: Prospect contract, ${p.contract.years} years.`);
  return { ok: true, autosave: true };
}

// Out of the academy for good: an 18-year-old or older joins the free agents (anyone may sign him); a younger one joins a
// local club's youth set-up and leaves the game.
function leave(data, p, day) {
  p.mentor = null;
  p.retrain = null;
  if (p.age >= 18 && data.transfers) {
    p.contract = { salary: salaryFor(p, 'Rotation'), years: 0, role: 'Rotation' };
    p.origin = 'released';
    p.releasedBy = 'us';
    p.leftDay = day;
    p.shirt = null;
    p.loan = null;
    data.transfers.free.push(p);
    return 'free';
  }
  return 'gone';
}
export function release(data, id, day) {
  const p = findHome(data, id);
  if (!p) return { ok: false, why: 'Not at the academy.' };
  const A = data.academy;
  A.players = A.players.filter((x) => x !== p);
  const to = leave(data, p, day);
  note(data, `${p.name} released from the academy${to === 'free' ? ' (a free agent now)' : ''}.`);
  return { ok: true, autosave: true };
}

export function canLoan(data, p, clubId) {
  if (!p) return 'Not at the academy.';
  if (p.age < AGES.loanMin) return `Too young for a loan: ${AGES.loanMin} at the earliest.`;
  const club = data.transfers?.clubs?.[clubId];
  if (!club) return 'Pick a club.';
  if (club.players.length >= POOL.clubSquad[1]) return `${ownerName(clubId)} have no room in their squad.`;
  const avg = club.players.reduce((s, x) => s + overall(x), 0) / club.players.length;
  if (overall(p) < avg - YOUTH_LOAN.gap) return `${ownerName(clubId)} do not want him yet: not ready for their squad.`;
  return null;
}
// A youth loan (the M11 loans): half a season at a Regional club, no fee either way; he comes back to the academy.
export function loanOut(data, id, clubId, day) {
  const p = findHome(data, id);
  const why = canLoan(data, p, clubId);
  if (why) return { ok: false, why };
  const A = data.academy;
  const T = data.transfers;
  A.players = A.players.filter((x) => x !== p);
  p.mentor = null;
  p.loan = { from: 'us', until: day + LOAN.days, academy: true };
  T.clubs[clubId].players.push(p);
  T.loanedOut.push({ id, clubId, until: day + LOAN.days, academy: true });
  note(data, `${p.name} loaned to ${ownerName(clubId)} until day ${day + LOAN.days}.`);
  transferLog(data, day, `${p.name} (academy) loaned to ${ownerName(clubId)} until day ${day + LOAN.days}.`);
  return { ok: true, autosave: true };
}

// Retraining (M8 Position Learning): to = a position, or null to stop.
export function setRetrain(data, id, to) {
  const p = findHome(data, id) ?? data.squad.players.find((x) => x.id === id);
  if (!p) return { ok: false, why: 'Not at the club.' };
  if (to == null) {
    p.retrain = null;
    return { ok: true, autosave: true };
  }
  if (!POSITION_ORDER.includes(to)) return { ok: false, why: 'Pick a position.' };
  if (to === p.position) return { ok: false, why: `He already plays ${to}.` };
  p.retrain = { to, progress: 0 };
  note(data, `${p.name} starts retraining as a ${to}.`);
  return { ok: true, autosave: true };
}

// Mentoring: a senior player of the same position, one prospect each.
export function mentorsFor(data, p) {
  const busy = new Set((data.academy?.players ?? []).filter((x) => x !== p && x.mentor).map((x) => x.mentor));
  return data.squad.players.filter((s) => s.position === p.position && !s.loan && !busy.has(s.id)).sort((a, b) => overall(b) - overall(a));
}
export function setMentor(data, id, seniorId) {
  const p = findHome(data, id);
  if (!p) return { ok: false, why: 'Not at the academy.' };
  if (seniorId == null) {
    p.mentor = null;
    return { ok: true, autosave: true };
  }
  const s = mentorsFor(data, p).find((x) => x.id === seniorId);
  if (!s) return { ok: false, why: 'A mentor must be a senior player of the same position who is not already mentoring.' };
  p.mentor = s.id;
  note(data, `${s.name} mentors ${p.name}.`);
  return { ok: true, autosave: true };
}
export const mentorOf = (data, p) => (p.mentor ? data.squad.players.find((s) => s.id === p.mentor) ?? null : null);

const FOCUS_IDS = new Set(FOCUSES.map((f) => f.id));
export function setFocus(data, id, focus) {
  const p = findHome(data, id);
  if (!p) return { ok: false, why: 'Not at the academy.' };
  p.focus = focus && FOCUS_IDS.has(focus) ? focus : null;
  return { ok: true };
}
export function setAcademyFocus(data, focus) {
  if (!FOCUS_IDS.has(focus)) return { ok: false, why: 'Pick a session.' };
  data.academy.focus = focus;
  return { ok: true };
}

// --- a club day -------------------------------------------------------------------------------------------------------------
// The academy's XP multiplier for a prospect: the Academy Building, academy facility levels, the Youth Coach, research and
// a mentor.
export function xpMultOf(data, p) {
  let pct = effect(data, 'academyXpPct') + effect(data, 'youthXpPct') + ACADEMY_XP.perLevel * levelsAbove1(data);
  if (hasAcademyBuilding(data)) pct += ACADEMY_XP.academyFull;
  if (mentorOf(data, p)) pct += MENTOR.xpPct + effect(data, 'mentorPct');
  return 1 + pct / 100;
}
// One academy training day for a prospect (share: 1 at the academy, loanShare out on loan). → { xp, learned }
export function trainProspect(data, p, share = 1) {
  const A = data.academy;
  const session = { focus: A.focus, intensity: 'normal' };
  const d = dailyXp(p, session, data.club?.founder?.id ?? null, null);
  const k = xpMultOf(data, p) * share;
  for (const part of d.parts) for (const [s, v] of Object.entries(part.stats)) gainXp(p, s, v * k);
  p.today = { xp: Math.round(d.xp * k * 10) / 10, kind: 'train', gains: {} };
  const learned = share === 1 ? retrainDay(p, d.parts, data) : null;
  return { xp: d.xp * k, learned };
}

export function academyDay(data, day) {
  const A = normaliseAcademy(data, day);
  if (A.lastDay === day) return [];
  A.lastDay = day;
  normaliseTraining(data);
  const events = [];
  const rng = new Rng(`${data.seed}:academy:${day}`);
  // the window: opens on Day 1 of the trials month (an older save: from the next one), candidates once a Youth Corner stands
  const w = windowOf(day);
  if (!A.intake && A.lastYear < w.year && day >= w.opens && day <= w.closes && w.opens >= (A.startDay ?? 0)) {
    A.intake = { year: w.year, opens: w.opens, closes: w.closes, candidates: null, signed: [], golden: false };
    A.lastYear = w.year;
    events.push({ kind: 'window', year: w.year, corner: hasCorner(data) });
  }
  const I = A.intake;
  if (I && !I.candidates && day <= I.closes && hasCorner(data)) {
    const g = generateIntake(data, I.year);
    I.candidates = g.candidates;
    I.golden = g.golden;
    I.count = g.candidates.length;
    events.push({ kind: 'intake', year: I.year, n: g.candidates.length, golden: g.golden });
  }
  if (I && day > I.closes) {
    A.history = [...A.history, { year: I.year, count: I.count ?? 0, signed: I.signed.map((id) => A.players.find((p) => p.id === id)?.name ?? data.squad.players.find((p) => p.id === id)?.name ?? id), golden: !!I.golden, missed: !I.candidates }].slice(-30);
    events.push({ kind: I.candidates ? 'closed' : 'missed', year: I.year });
    A.intake = null;
  }
  // mentors who are no longer seniors of the same position stop
  for (const p of A.players) {
    const m = mentorOf(data, p);
    if (p.mentor && (!m || m.position !== p.position || m.loan)) p.mentor = null;
  }
  // training (the weekly day off as the seniors')
  if (day % FATIGUE.weekOff !== 0) {
    for (const p of A.players) {
      const r = trainProspect(data, p, 1);
      if (r.learned) events.push({ kind: 'learned', id: p.id, name: p.name, to: r.learned });
    }
    for (const { p } of loanedOut(data)) trainProspect(data, p, ACADEMY_XP.loanShare);
  } else for (const p of A.players) p.today = { xp: 0, kind: 'dayoff', gains: {} };
  // a rare breakthrough (Day 1 of every month): he beats his projection, never by more than BREAKTHROUGH.max in all
  if (day > 0 && day % MONTH === 0) {
    const chance = BREAKTHROUGH.chance * (hasAcademyBuilding(data) ? BREAKTHROUGH.academyFull : 1);
    for (const p of A.players) {
      const roll = rng.next();
      const left = BREAKTHROUGH.max - p.youth.breakthrough;
      if (roll >= chance || left <= 0) continue;
      const by = Math.min(left, rng.int(...BREAKTHROUGH.step));
      p.youth.breakthrough += by;
      p.potential.exact = Math.min(99, p.youth.projected + p.youth.breakthrough);
      events.push({ kind: 'breakthrough', id: p.id, name: p.name, by });
      note(data, `Breakthrough: ${p.name} is beating his projection.`);
    }
  }
  // the season's end: a year older (those out on loan age with their club); too old for the academy → he leaves
  if (day > 0 && day % YEAR === 0) {
    for (const p of A.players) p.age += 1;
    for (const p of A.players.filter((x) => x.age > AGES.maxAge)) {
      A.players = A.players.filter((x) => x !== p);
      const to = leave(data, p, day);
      note(data, `${p.name} left the academy at ${p.age}${to === 'free' ? ' (a free agent now)' : ''}.`);
      events.push({ kind: 'left', id: p.id, name: p.name, age: p.age });
    }
  }
  for (const p of [...A.players, ...(A.intake?.candidates ?? [])]) refreshRange(data, p, day);
  return events;
}

// --- checks -------------------------------------------------------------------------------------------------------------
export function validateAcademy(data) {
  const A = data.academy;
  const errors = [];
  if (!A) return ['no academy'];
  const all = [...A.players, ...(A.intake?.candidates ?? [])];
  for (const p of all) {
    const y = p.youth;
    if (!y || !Number.isFinite(y.projected)) errors.push(`${p.name}: no projection`);
    else {
      if (y.breakthrough < 0 || y.breakthrough > BREAKTHROUGH.max) errors.push(`${p.name}: breakthrough ${y.breakthrough}`);
      if (p.potential.exact !== Math.min(99, y.projected + y.breakthrough)) errors.push(`${p.name}: exact potential ${p.potential.exact} ≠ ${y.projected} + ${y.breakthrough}`);
    }
    if (!(p.potential.low <= p.potential.high)) errors.push(`${p.name}: range`);
    if (overall(p) > p.potential.exact) errors.push(`${p.name}: overall above his potential`);
    if (p.portrait) errors.push(`${p.name}: a portrait`);
    if (FEATURED_NAMES.includes(p.name)) errors.push(`${p.name}: a Featured name`);
  }
  for (const p of A.players) if (p.age < INTAKE.ages[0] || p.age > AGES.maxAge) errors.push(`${p.name}: age ${p.age} in the academy`);
  for (const p of A.intake?.candidates ?? []) if (p.age < INTAKE.ages[0] || p.age > INTAKE.ages[1]) errors.push(`${p.name}: age ${p.age} at the trials`);
  const ids = [...all, ...(data.squad?.players ?? []), ...(data.squad?.watch ?? [])].map((p) => p.id);
  if (new Set(ids).size !== ids.length) errors.push('ids repeat');
  if (A.intake && A.intake.signed.length > INTAKE.signMax) errors.push('signed more than the most from one intake');
  return errors;
}
