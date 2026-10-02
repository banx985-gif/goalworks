// Support staff (Milestone 14, bible §12): hiring, replacing and releasing the 25 named staff (data/staff.js), their
// contracts and wages, and what the hired staff add to the club's effects. The roster runs on core/StaffModel (each hire
// is a StaffModel: id, role, tier, the trait, the weekly wage, the contract in counters) and core/StaffSystem (the trait
// effects summed over the roster — groupEffect). Plain functions over the run save (data.staff); nothing here draws.
//   newStaff() → the empty data.staff for a new club        normaliseStaff(data, day) → data.staff (an older save: none,
//                                                             except the M11 placeholder scout, who becomes SC01 Mina Reed)
//   staffBonus(data, key) → what the hired staff add to an effect key (src/systems/effects.js adds it to facilities +
//                           research)
//   hired(data) → [StaffModel]   inRole(data, role) → StaffModel | null   isHired(data, id)
//   eligibility(data, def) → { ok, why, hidden }   candidates(data, role, { debug }) → [def] (Legendary / Secret: debug only)
//   hire(data, id, day, { replace }) → { ok, why, replaced }   release(data, id, day) → { ok, why, cost }
//   extend(data, id) → { ok, why, cost }   hireCost(data, id) / releaseCost(data, id) / extendCost(data, id)
//   staffDay(data, day) → [{ kind: 'left', id, name }]  weekly wages; at the season's end contracts count down and end
//   scoutName(data) → the hired scout's name, null with no scout (undefined for a save without staff at all)
import { Rng } from '../../../../core/Rng.js';
import { StaffModel } from '../../../../core/StaffModel.js';
import { StaffSystem } from '../../../../core/StaffSystem.js';
import { STAFF, STAFF_ROLES, STAFF_TIERS, STAFF_RULES, GATE_TEXT, staffById, roleById } from '../../data/staff.js';
import { RANK_ORDER } from '../../data/facilities.js';
import { rank as clubRank, normaliseLeague } from './league.js';

const WEEK = 7;
const YEAR = 336;

// core/StaffSystem's trait table: one trait per staff member, carrying their effects (the key → value pairs).
const traitId = (def) => `${def.id}:${def.trait}`;
const TRAITS = Object.fromEntries(STAFF.map((d) => [traitId(d), { name: d.trait, effects: Object.fromEntries(d.effects.map((e) => [e.key, e.value])) }]));
const ROLES = Object.fromEntries(STAFF_ROLES.map((r) => [r.id, { name: r.name }]));
const TIERS = Object.fromEntries(Object.keys(STAFF_TIERS).map((t) => [t, { traitSlots: 1 }]));

export const newStaff = () => ({ v: 14, hired: [], log: [], rev: 0, lastDay: null });

// One StaffSystem per data.staff, remade when the roster changes (rev): the shared effect query reads it every club day.
const systems = new WeakMap();
function systemOf(data) {
  const st = data?.staff;
  if (!st) return null;
  let s = systems.get(st);
  if (!s || s.rev !== st.rev || s.list !== st.hired) {
    const sys = new StaffSystem({ rng: new Rng('goalworks-staff'), statKeys: [], roles: ROLES, tiers: TIERS, traits: TRAITS });
    sys.load(st.hired);
    s = { rev: st.rev, list: st.hired, sys };
    systems.set(st, s);
  }
  return s.sys;
}

export function normaliseStaff(data, day = 0) {
  if (data.staff?.v === 14) return data.staff;
  data.staff = newStaff();
  // (a save from before Milestone 14: the Founder-era scout everyone had becomes Mina Reed, on a Standard contract, free)
  if (data.transfers) addHire(data, staffById('SC01'), day, 'Your scout is now Mina Reed (Standard scout, Local Eye).');
  return data.staff;
}

export const hired = (data) => systemOf(data)?.staff ?? [];
export const isHired = (data, id) => !!data?.staff?.hired.some((s) => s.id === id);
export const inRole = (data, role) => hired(data).find((s) => s.role === role) ?? null;
export const staffBonus = (data, key) => {
  const sys = systemOf(data);
  return sys && sys.staff.length ? sys.groupEffect(sys.staff, key) : 0;
};
export const scoutName = (data) => (data?.staff ? inRole(data, 'SC')?.name ?? null : undefined);
export const wageBill = (data) => hired(data).reduce((s, x) => s + x.salary, 0);
const credits = (data) => normaliseLeague(data).credits;
const pay = (data, n) => (data.league.credits = Math.round(credits(data) - n));
function note(data, text) {
  const st = data.staff;
  st.log = [...(st.log ?? []), text].slice(-12);
}

// Can this staff member be hired now? hidden: Legendary / Secret (never in normal play).
export function eligibility(data, def) {
  const tier = STAFF_TIERS[def.tier];
  if (tier.gate === 'hidden') return { ok: false, hidden: true, why: `Locked: ${tier.unlock}` };
  if (tier.gate === 'county' && normaliseLeague(data).promotion.county !== 'accepted') return { ok: false, why: GATE_TEXT.county };
  if (tier.gate === 'rankB' && RANK_ORDER.indexOf(clubRank(data).id) < RANK_ORDER.indexOf('B')) return { ok: false, why: GATE_TEXT.rankB };
  return { ok: true };
}
export function candidates(data, role, { debug = false } = {}) {
  return STAFF.filter((d) => d.role === role && !isHired(data, d.id) && (debug || !eligibility(data, d).hidden));
}

export const hireCost = (id) => STAFF_TIERS[staffById(id).tier].fee;
export function releaseCost(data, id) {
  const s = hired(data).find((x) => x.id === id);
  return s ? s.salary * STAFF_RULES.releaseWeeks : 0;
}
export const extendCost = (id) => Math.round(STAFF_TIERS[staffById(id).tier].fee * STAFF_RULES.extendFeeShare);

function addHire(data, def, day, text) {
  const tier = STAFF_TIERS[def.tier];
  const m = StaffModel.fromDefinition({ id: def.id, name: def.name, role: def.role, tier: def.tier, traits: [traitId(def)], salary: tier.wage, art: def.art, stats: {} });
  m.activity = 'working';
  m.assigned = true;
  m.counters = { years: tier.years, hiredDay: day };
  data.staff.hired = [...data.staff.hired, m.toJSON()];
  data.staff.rev = (data.staff.rev ?? 0) + 1;
  note(data, text);
  return m;
}
function removeHire(data, id) {
  data.staff.hired = data.staff.hired.filter((s) => s.id !== id);
  data.staff.rev = (data.staff.rev ?? 0) + 1;
}

// Hire one (one per role: with { replace: true } whoever holds the role now is released first, their release pay too).
export function hire(data, id, day, { replace = false } = {}) {
  normaliseStaff(data, day);
  const def = staffById(id);
  if (!def) return { ok: false, why: 'Unknown staff member.' };
  if (isHired(data, id)) return { ok: false, why: `${def.name} already works here.` };
  const el = eligibility(data, def);
  if (!el.ok) return { ok: false, why: el.why };
  const cur = inRole(data, def.role);
  if (cur && !replace) return { ok: false, why: `${cur.name} is your ${roleById(def.role).name}: replace them first.` };
  const cost = hireCost(id) + (cur ? releaseCost(data, cur.id) : 0);
  if (credits(data) < cost) return { ok: false, why: `Needs ${cost.toLocaleString('en-GB')} Credits (you have ${credits(data).toLocaleString('en-GB')}).` };
  if (cur) release(data, cur.id, day, { keepTask: true });
  pay(data, hireCost(id));
  addHire(data, def, day, `${def.name} joined as ${roleById(def.role).name} (${def.tier}) for ${hireCost(id).toLocaleString('en-GB')} Credits.`);
  return { ok: true, replaced: cur?.id ?? null, cost };
}

// Release: the club pays releaseWeeks of their wage. A scout who leaves with no replacement drops the report under way.
export function release(data, id, day, { keepTask = false } = {}) {
  const s = hired(data).find((x) => x.id === id);
  if (!s) return { ok: false, why: 'Not on the staff.' };
  const cost = releaseCost(data, id);
  pay(data, Math.min(cost, Math.max(0, credits(data)))); // (never below zero: what can't be paid is written off)
  removeHire(data, id);
  if (s.role === 'SC' && !keepTask && data.transfers?.scouting?.task) data.transfers.scouting.task = null;
  note(data, `${s.name} left the club (release pay ${cost.toLocaleString('en-GB')} Credits).`);
  return { ok: true, cost };
}

export function extend(data, id) {
  const raw = data.staff?.hired.find((x) => x.id === id);
  if (!raw) return { ok: false, why: 'Not on the staff.' };
  const cost = extendCost(id);
  if (credits(data) < cost) return { ok: false, why: `Needs ${cost.toLocaleString('en-GB')} Credits.` };
  pay(data, cost);
  raw.counters = { ...raw.counters, years: (raw.counters?.years ?? 0) + STAFF_TIERS[raw.tier].years };
  data.staff.rev = (data.staff.rev ?? 0) + 1;
  note(data, `${raw.name} signed on for ${STAFF_TIERS[raw.tier].years} more seasons (${cost.toLocaleString('en-GB')} Credits).`);
  return { ok: true, cost };
}
export const yearsLeft = (data, id) => data.staff?.hired.find((x) => x.id === id)?.counters?.years ?? 0;
// In the last season of the contract, from the warning month on.
export const endingSoon = (data, id, month) => yearsLeft(data, id) <= 1 && month >= STAFF_RULES.warnMonth;

// One club day: weekly wages out of Credits (never below zero), and at the season's end every contract counts down —
// those that reach zero leave.
export function staffDay(data, day) {
  const st = normaliseStaff(data, day);
  if (st.lastDay === day) return [];
  st.lastDay = day;
  const out = [];
  if (day > 0 && day % WEEK === 0 && st.hired.length) {
    const bill = wageBill(data);
    if (credits(data) < bill) {
      data.league.credits = 0;
      note(data, 'Staff wages ran short this week.');
    } else pay(data, bill);
  }
  if (day > 0 && day % YEAR === 0) {
    for (const raw of st.hired.slice()) {
      raw.counters = { ...raw.counters, years: (raw.counters?.years ?? 1) - 1 };
      if (raw.counters.years > 0) continue;
      removeHire(data, raw.id);
      if (raw.role === 'SC' && data.transfers?.scouting?.task) data.transfers.scouting.task = null;
      note(data, `${raw.name}'s contract ended: they have left the club.`);
      out.push({ kind: 'left', id: raw.id, name: raw.name });
    }
    st.rev = (st.rev ?? 0) + 1;
  }
  return out;
}

// Where a role works on the Club Complex: the first of its stations on the ground (by facility id order of the role's
// list), else the Clubhouse. items: the layout's placed facilities ({ uid, def }).
export function stationFor(role, items) {
  for (const id of roleById(role)?.stations ?? []) {
    const it = items.find((x) => x.def.id === id);
    if (it) return it;
  }
  return null;
}
