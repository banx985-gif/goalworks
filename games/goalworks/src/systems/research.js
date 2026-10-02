// Research (Milestone 13, bible §28): the 36 nodes of data/research.js on core/ResearchSystem (one queue, daily
// progress, each node's unlock actions fired exactly once by core/UnlockRunner) and the Research Points that pay for
// them. GOALWORKS' own rules on top: the Club Manager runs the one slot (staff arrive in M14), a node costs RP to start
// and then takes its work days on the calendar (core workOf hook), Stop keeps the progress (restarting is free), RP come
// each club day (a base + the Video Room / Analytics Lab), from league results and from firsts.
//   normaliseResearch(data) → data.research { v, sys (core serialize), unlocks (UnlockRunner serialize), kept }
//                             (a new club and an older save start with 0 RP and nothing researched; an older save keeps
//                             the formations it already uses in kept.formations)
//   createResearch(data, { bus }) → research: start / stop / day / match / status / … (keeps data.research up to date)
//   rpPerDay(data)   formationLock(data, id) → null | reason   openFormations(data) → [ids]
// Effects of done nodes reach the systems through src/systems/effects.js effect(data, key).
// Milestone 12c: the second slot opens at Club Rank A + Analytics Lab level 2 (its Analytics Lab team works it); start()
// takes the first free open slot; current(i) / stop(i) name a slot; a slot whose rule stops holding closes, keeping progress.
import { ResearchSystem } from '../../../../core/ResearchSystem.js';
import { UnlockRunner } from '../../../../core/UnlockActions.js';
import { NODES, nodeById, QUEUES, MANAGER_WORKER, SLOT_WORKERS, RP, START_FORMATIONS, LIBRARY_FORMATIONS, BRANCHES, RESEARCH_EFFECTS } from '../../data/research.js';
import { RANK_ORDER } from '../../data/facilities.js';
import { FORMATIONS } from '../../data/tactics.js';
import { clubById } from '../../data/fixtures.js';
import { bonus as facilityBonus, facilityLevel } from './facilities.js';
import { rank as clubRank } from './league.js';

const fmt = (n) => Math.round(n).toLocaleString('en-GB');

// Formations an older save already uses: the chosen one, any with familiarity, roles or players set by hand.
function formationsInUse(data) {
  const t = data.tactics;
  if (!t || t.v !== 9) return [];
  const ids = new Set([t.formation, ...Object.keys(t.familiarity ?? {}).map((k) => k.split(':')[0]), ...Object.keys(t.roles ?? {}), ...Object.keys(t.lineup ?? {})]);
  return [...ids].filter((id) => LIBRARY_FORMATIONS.includes(id));
}

export function normaliseResearch(data) {
  if (!data.research || data.research.v !== 13) data.research = { v: 13, sys: null, unlocks: null, kept: { formations: formationsInUse(data) } };
  data.research.kept ??= { formations: [] };
  return data.research;
}

export const rpPerDay = (data) => RP.day + facilityBonus(data, 'rpDay');

// --- formations (R25 Formation Library) ----------------------------------------------------------------------------
const unlockedList = (data, type) => data?.research?.unlocks?.unlocked?.[type] ?? [];
export function formationLock(data, id) {
  if (START_FORMATIONS.includes(id)) return null;
  if (unlockedList(data, 'formation').includes(id)) return null;
  if (data?.research?.kept?.formations?.includes(id)) return null;
  return 'Needs R25 Formation Library (Research)';
}
export const openFormations = (data) => FORMATIONS.filter((f) => !formationLock(data, f.id)).map((f) => f.id);

// A queue rule: { rank, facility, level } — the Club Rank, and a facility built at that level or higher (M12c).
function ruleMet(data, rule) {
  if (!rule) return true;
  if (rule.rank && RANK_ORDER.indexOf(clubRank(data).id) < RANK_ORDER.indexOf(rule.rank)) return false;
  if (rule.facility && facilityLevel(data, rule.facility) < (rule.level ?? 1)) return false;
  return true;
}

// What a node gives, as stored effects wait for their systems: 'Stored until the academy arrives (M15)'.
export function storedNote(node) {
  const waits = node.effects.map((e) => RESEARCH_EFFECTS[e.key]).filter((k) => k && !k.live);
  if (!waits.length) return null;
  const k = waits[0];
  return `Stored until ${k.what} arrive${k.what.endsWith('s') ? '' : 's'} (${k.waits})`;
}

export function createResearch(data, { bus = null } = {}) {
  const R = normaliseResearch(data);
  const runner = new UnlockRunner({ bus });
  runner.load(R.unlocks);
  const sys = new ResearchSystem({
    bus,
    nodes: NODES.map((n) => ({ ...n, actions: [{ type: 'research', id: n.id }, ...n.unlocks] })),
    queues: QUEUES,
    runner,
    staff: { get: (id) => SLOT_WORKERS.find((w) => w.id === id) ?? null },
    rules: { basePerDay: 1, statDivisor: 1 }, // one work day a club day
    hooks: { conditionMet: (rule) => ruleMet(data, rule), workerStat: () => 0, workOf: (n) => n.days },
  });
  sys.load(R.sys);
  const write = () => {
    R.sys = sys.serialize();
    R.unlocks = runner.serialize();
  };
  write();

  const api = {
    sys,
    runner,
    get rp() {
      return sys.rp;
    },
    get rpEarned() {
      return sys.rpEarned;
    },
    get done() {
      return [...sys.done];
    },
    get doneCount() {
      return sys.doneCount;
    },
    perDay: () => rpPerDay(data),
    // The node in slot i now (or null) and how far it is: { node, days, left, frac }.
    current(i = 0) {
      const id = sys.queues[i]?.nodeId;
      if (!id) return null;
      const n = nodeById(id);
      const workDone = Math.min(n.days, sys.progress[id] ?? 0);
      return { node: n, days: workDone, left: Math.max(0, n.days - workDone), frac: sys.fraction(id) };
    },
    // 'done' | 'active' | 'available' | 'locked'
    status: (id) => sys.status(id),
    paid: (id) => !!sys.paid[id],
    progressDays: (id) => Math.min(nodeById(id).days, sys.progress[id] ?? 0),
    missing: (id) => sys.missing(id),
    secondSlotOpen: () => sys.queueOpen(1),
    slotsOpen: () => QUEUES.filter((q, i) => sys.queueOpen(i)).length,
    // The first open slot with nothing in it (-1: none).
    freeSlot: () => QUEUES.findIndex((q, i) => sys.queueOpen(i) && !sys.queues[i]?.nodeId),
    // Can it start now? { ok, reason } in plain words.
    canStart(id) {
      const n = nodeById(id);
      if (!n) return { ok: false, reason: 'Unknown research' };
      const st = sys.status(id);
      if (st === 'done') return { ok: false, reason: 'Already researched' };
      if (st === 'active') return { ok: false, reason: 'Being researched now' };
      if (st === 'locked') return { ok: false, reason: `Needs ${sys.missing(id).nodes.map((r) => `${r} ${nodeById(r).name}`).join(', ')}` };
      if (api.freeSlot() < 0) {
        const cur = sys.queues[0]?.nodeId;
        if (api.slotsOpen() > 1) return { ok: false, reason: 'Both slots are busy — Stop one first' };
        return { ok: false, reason: `The slot is busy with ${cur} ${nodeById(cur).name} — Stop it first` };
      }
      if (!sys.paid[id] && sys.rp < sys.costOf(n)) return { ok: false, reason: `Needs ${fmt(sys.costOf(n))} RP (you have ${fmt(sys.rp)})` };
      return { ok: true, reason: null };
    },
    // Start a node in the first free slot: pays its RP the first time (a stopped node restarts free, keeping its progress).
    start(id) {
      const can = api.canStart(id);
      if (!can.ok) return can;
      const i = api.freeSlot();
      const r = sys.start(i, id, SLOT_WORKERS[i].id);
      write();
      return r.ok ? { ok: true, reason: null, slot: i } : { ok: false, reason: r.reason };
    },
    stop(i = 0) {
      const ok = sys.stop(i);
      write();
      return ok;
    },
    // One club day: the daily RP, then a work day on the node in the slot. → [nodes completed today]
    day(day) {
      sys.addRp(rpPerDay(data), 'Daily research', day);
      sys.closeLockedQueues(); // (M12c) the second slot closes if the rank or the Analytics Lab level is gone
      const before = sys.done.length;
      sys.dailyTick();
      const completed = sys.done.slice(before).map((id) => nodeById(id));
      write();
      return completed;
    },
    // What a league result would give (the result screen, before Continue): RP, nothing changed.
    previewMatch({ clubId, score, promotion = false }) {
      const [us, them] = score;
      const res = us > them ? 'win' : us < them ? 'loss' : 'draw';
      let rp = RP.result[res];
      if (res === 'win' && !(sys.firsts.win ?? []).includes(clubId)) rp += RP.firstWin;
      if (promotion && !(sys.firsts.promotion ?? []).includes('regional')) rp += RP.firstPromotion;
      return rp;
    },
    // A league result: RP for the result, the first win against each club, the first Promotion Match. → RP gained
    match({ clubId, score, promotion = false }, day) {
      const [us, them] = score;
      const res = us > them ? 'win' : us < them ? 'loss' : 'draw';
      const name = clubById(clubId)?.name ?? clubId;
      let got = sys.addRp(RP.result[res], `${res === 'win' ? 'Win' : res === 'draw' ? 'Draw' : 'Loss'} vs ${name}`, day);
      if (res === 'win' && sys.firstTime('win', clubId)) got += sys.addRp(RP.firstWin, `First win vs ${name}`, day);
      if (promotion && sys.firstTime('promotion', 'regional')) got += sys.addRp(RP.firstPromotion, 'First Promotion Match', day);
      write();
      return got;
    },
    recent: (n = 4) => sys.recent.slice(0, n),
    branchDone: (b) => NODES.filter((n) => n.branch === b && sys.isDone(n.id)).length,
    // (debug and tests) RP from nowhere, and finishing a node at once (its unlocks fire once, as in play).
    addRp(n, why = 'Debug') {
      const got = sys.addRp(n, why);
      write();
      return got;
    },
    complete(id) {
      const ok = sys.complete(id);
      write();
      return ok;
    },
  };
  return api;
}

export { BRANCHES, NODES };
