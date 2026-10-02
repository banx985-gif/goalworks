// Facilities and Build Mode rules (Milestone 12, bible §27). The layout is core/FacilitySystem (footprints, overlap, the
// walkway check — every facility keeps a free tile next to it that can be walked to from the gate — the 50% sell value,
// save) on the club's ground, which grows with the Club Rank (data/facilities.js STAGES). GOALWORKS' own rules on top:
// unlocks by rank (F34 / F35 secret: hidden), one of each facility, the core four can be moved but not sold, and every
// purchase is paid in the placeholder Credits (data.league.credits) — never below zero. Pure rules on the run save, no
// drawing or walking.
//   normaliseFacilities(data) → data.facilities { v, placement, nextUid, names, stage, log }  (a new club and an older
//                               save get the starting facilities placed once)
//   bonus(data, key) → the summed effect of every facility built (the one shared effect query)
//   stageIndex(data) · stageOf(data) · unlockOf(data, defId) → { ok, hidden, reason }
//                               (Milestone 13: a research unlock — data.research.unlocks, type 'facility' — opens it at any rank)
//   createLayout(data, { bus }) → layout: check / place / move / sell / canSell / shop / findSpot / sync / items
// Milestone 12c: levels 1–3 (data/facilities.js LEVELS, on core/FacilitySystem levels; saved as data.facilities.levels by
// uid, so a move keeps the level and a sale takes it). bonus() counts each facility × its level's multiplier.
//   facilityLevel(data, defId) → 0 (not built) | 1–3   (the secrets' "level 3", the second research slot)
//   layout.levelInfo(uid) → { level, max, mult, pending, next: { level, cost, days, rank } | null, block, invested }
//   layout.upgrade(uid, today) → { ok, reason, to, doneDay } (pays now)   layout.tickUpgrades(today) → [{ uid, level }]
import { FacilitySystem } from '../../../../core/FacilitySystem.js';
import { FACILITIES, facilityById, STAGES, RANK_ORDER, START_LAYOUT, gateOf, EFFECT_KEYS, LEVELS } from '../../data/facilities.js';
import { normaliseLeague, rank as clubRank } from './league.js';

const DEFS = Object.fromEntries(FACILITIES.map((f) => [f.id, { id: f.id, name: f.name, cost: f.cost, w: f.w, h: f.h, effects: f.effects }]));
// (M12c) one copy's multiplier for one effect at a level (as core/FacilitySystem works it out)
const effectMult = (e, level) => (e.scale === false ? 1 : (e.levelMult ?? LEVELS.mult)[level - 1] ?? 1);
const levelOfUid = (F, uid) => F.levels?.[uid]?.level ?? 1;
const REASONS = {
  outside: 'Outside the ground',
  locked: 'Outside the ground',
  overlap: 'Overlaps the {name}',
  door: 'Keep the gate clear — everyone comes in there',
  fixed: 'Outside the ground',
  blocked: 'That would cut off the {name} — every facility needs a way in',
  unknown: 'Unknown facility',
};
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

export function normaliseFacilities(data) {
  if (!data.facilities || data.facilities.v !== 12) {
    data.facilities = {
      v: 12,
      placement: START_LAYOUT.map((p, i) => ({ uid: i + 1, def: p.def, col: p.col, row: p.row, rot: 0 })),
      nextUid: START_LAYOUT.length + 1,
      names: Object.fromEntries(START_LAYOUT.map((p, i) => [i + 1, p.name]).filter(([, n]) => n)),
      stage: 0,
      log: [], // the last builds / moves / sales (newest last)
    };
  }
  const F = data.facilities;
  F.stage = Math.max(F.stage ?? 0, rankStage(data));
  return F;
}

// The stage the Club Rank asks for now (the stored stage never goes back down).
function rankStage(data) {
  if (!data.league) return 0;
  return Math.max(0, RANK_ORDER.indexOf(clubRank(data).id));
}
export const stageIndex = (data) => normaliseFacilities(data).stage;
export const stageOf = (data) => STAGES[Math.min(STAGES.length - 1, stageIndex(data))];

// The one effect query: other systems ask "how much X do the facilities give now?" (0 without any).
export function bonus(data, key) {
  const F = data?.facilities;
  if (!F?.placement) return 0;
  let v = 0;
  for (const p of F.placement) for (const e of DEFS[p.def]?.effects ?? []) if (e.key === key) v += e.value * effectMult(e, levelOfUid(F, p.uid));
  return v;
}
// (M12c) The level of a facility on the ground (0 when it isn't built). One of each, so its only copy.
export function facilityLevel(data, defId) {
  const F = data?.facilities;
  const p = F?.placement?.find((x) => x.def === defId);
  return p ? levelOfUid(F, p.uid) : 0;
}
// A percentage effect as a multiplier (recoveryPct 13 → 1.13).
export const bonusFactor = (data, key) => 1 + bonus(data, key) / 100;

// Is this facility in the Shop for this club? hidden: never shown (the secret two).
export function unlockOf(data, defId) {
  const f = facilityById(defId);
  if (!f) return { ok: false, hidden: true, reason: 'Unknown facility' };
  if (f.unlock === 'secret') return { ok: false, hidden: true, reason: 'Secret' };
  if (f.unlock === 'start') return { ok: true, hidden: false, reason: null };
  if (data?.research?.unlocks?.unlocked?.facility?.includes(defId)) return { ok: true, hidden: false, reason: null };
  const need = RANK_ORDER.indexOf(f.unlock);
  return need <= stageIndex(data) ? { ok: true, hidden: false, reason: null } : { ok: false, hidden: false, reason: `Needs Club Rank ${f.unlock}` };
}

// What an effect does now (the Facility Detail sheet and the Shop): 'Physical sessions: +5% XP' or
// 'Stored — injuries arrive in M25'.
export function effectLines(defId, level = 1) {
  const f = facilityById(defId);
  return (f?.effects ?? []).filter((e) => !e.extra || effectMult(e, level) > 0).map((e) => {
    const k = EFFECT_KEYS[e.key];
    const v = Math.round(e.value * effectMult(e, level) * 100) / 100;
    if (k?.live) return { live: true, text: k.where.replace('{v}', v) + (e.extra ? ` (level ${level})` : '') };
    return { live: false, text: `Stored until ${k?.what ?? 'its system'} arrive${k?.what?.endsWith('s') ? '' : 's'} (${k?.waits ?? 'later'})` };
  });
}

export function createLayout(data, { bus = null } = {}) {
  const F = normaliseFacilities(data);
  let fs = null;
  let builtFor = -1;
  let rev = 0; // bumped on every change (the world and the screen redraw / re-path when it moves)

  // The FacilitySystem for the current stage (rebuilt when the ground grows; placements keep their tiles).
  function build() {
    const st = STAGES[F.stage];
    fs = new FacilitySystem({ bus, defs: DEFS, area: { cols: st.cols, rows: st.rows }, entrance: gateOf(st), sellRefundPct: 50, reasons: REASONS, levels: { max: LEVELS.max, mult: LEVELS.mult } });
    fs.load({ placement: F.placement, nextUid: F.nextUid, levels: F.levels ?? {} });
    builtFor = F.stage;
    rev++;
  }
  build();
  const write = () => {
    const s = fs.serialize();
    F.placement = s.placement;
    F.nextUid = s.nextUid;
    F.levels = s.levels ?? {};
    rev++;
  };
  const note = (what) => {
    F.log = [...(F.log ?? []), what].slice(-20);
  };
  const credits = () => normaliseLeague(data).credits;

  const layout = {
    get fs() {
      return fs;
    },
    get stage() {
      return STAGES[F.stage];
    },
    get stageIndex() {
      return F.stage;
    },
    get gate() {
      return gateOf(STAGES[F.stage]);
    },
    get version() {
      return rev;
    },
    // Every facility on the ground: { uid, def (data entry), col, row, w, h, name (pitch / office / scout / clubhouse) }.
    get items() {
      return fs.placed.map((p) => ({ uid: p.uid, def: facilityById(p.def), col: p.col, row: p.row, w: DEFS[p.def].w, h: DEFS[p.def].h, name: F.names?.[p.uid] ?? null }));
    },
    item(uid) {
      return layout.items.find((x) => x.uid === uid) ?? null;
    },
    byName(name) {
      const uid = Object.entries(F.names ?? {}).find(([, n]) => n === name)?.[0];
      return uid ? layout.item(Number(uid)) : null;
    },
    ofDef(defId) {
      return layout.items.filter((x) => x.def.id === defId);
    },
    has: (defId) => fs.has(defId),
    // The ground grows if the rank has risen (call each club day and after a result). → true if it grew.
    sync() {
      normaliseFacilities(data);
      if (F.stage === builtFor) return false;
      build();
      note({ kind: 'grow', stage: F.stage });
      bus?.emit('facility:ground', { stage: STAGES[F.stage] });
      return true;
    },
    check(defId, col, row, uid = null) {
      return fs.check(defId, col, row, 0, uid);
    },
    // Can it be bought now? (unlocked, not already built, the Credits are there) → { ok, reason }
    canBuy(defId) {
      const f = facilityById(defId);
      const u = unlockOf(data, defId);
      if (!u.ok) return { ok: false, reason: u.reason };
      if (fs.has(defId)) return { ok: false, reason: 'Already built' };
      if (credits() < f.cost) return { ok: false, reason: `Not enough Credits: ${fmt(f.cost)} needed, ${fmt(credits())} available` };
      return { ok: true, reason: null };
    },
    // Buy and place. Credits never go below zero.
    place(defId, col, row) {
      const can = layout.canBuy(defId);
      if (!can.ok) return can;
      const r = fs.place(defId, col, row);
      if (!r.ok) return r;
      data.league.credits = Math.round(credits() - facilityById(defId).cost);
      write();
      note({ kind: 'build', def: defId, col, row });
      return { ok: true, reason: null, uid: r.item.uid };
    },
    move(uid, col, row) {
      const r = fs.move(uid, col, row);
      if (!r.ok) return r;
      write();
      note({ kind: 'move', uid, col, row });
      return { ok: true, reason: null };
    },
    canSell(uid) {
      const it = fs.get(uid);
      if (!it) return { ok: false, reason: 'Nothing there' };
      const f = facilityById(it.def);
      if (f.core) return { ok: false, reason: `The club can't run without its ${f.name}` };
      return { ok: true, reason: null, refund: fs.sellValue(it) };
    },
    sell(uid) {
      const can = layout.canSell(uid);
      if (!can.ok) return can;
      const r = fs.remove(uid);
      data.league.credits = Math.round(credits() + r.refund);
      if (F.names) delete F.names[uid];
      write();
      note({ kind: 'sell', def: r.item.def, refund: r.refund });
      return { ok: true, reason: null, refund: r.refund, def: r.item.def };
    },
    sellValue: (defId) => Math.floor(facilityById(defId).cost / 2),
    // --- (M12c) levels ---
    level: (uid) => fs.level(uid),
    levelInfo(uid) {
      const it = fs.get(uid);
      if (!it) return null;
      const def = facilityById(it.def);
      const level = fs.level(uid);
      const pending = fs.upgradePending(uid);
      const scaled = def.effects.some((e) => e.scale !== false && !e.extra) || def.effects.some((e) => e.extra);
      const info = { level, max: def.noLevels ? 1 : LEVELS.max, mult: LEVELS.mult[level - 1], scaled, pending, invested: fs.invested(uid), next: null, block: null };
      if (def.noLevels) {
        info.block = 'This facility doesn’t level';
        return info;
      }
      if (level >= LEVELS.max) return info;
      const to = level + 1;
      info.next = { level: to, cost: Math.round(def.cost * LEVELS.costShare[to - 1]), days: LEVELS.days[to - 1], rank: LEVELS.rank[to - 1], mult: LEVELS.mult[to - 1] };
      const rk = clubRank(data).id;
      if (pending) info.block = `Upgrading to level ${pending.to}: ready on day ${pending.doneDay}`;
      else if (info.next.rank && RANK_ORDER.indexOf(rk) < RANK_ORDER.indexOf(info.next.rank)) info.block = `Level ${to} needs Club Rank ${info.next.rank}`;
      else if (credits() < info.next.cost) info.block = `Not enough Credits: ${fmt(info.next.cost)} needed, ${fmt(credits())} available`;
      return info;
    },
    upgrade(uid, today) {
      const info = layout.levelInfo(uid);
      if (!info) return { ok: false, reason: 'Nothing there' };
      if (!info.next) return { ok: false, reason: info.block ?? 'Top level' };
      if (info.block) return { ok: false, reason: info.block };
      const r = fs.startUpgrade(uid, { cost: info.next.cost, today, days: info.next.days });
      if (!r.ok) return { ok: false, reason: r.why };
      data.league.credits = Math.round(credits() - info.next.cost);
      write();
      note({ kind: 'upgrade', uid, to: info.next.level, cost: info.next.cost });
      return { ok: true, reason: null, to: info.next.level, doneDay: r.doneDay, cost: info.next.cost };
    },
    tickUpgrades(today) {
      const done = fs.tickUpgrades(today);
      if (done.length) {
        write();
        for (const d of done) note({ kind: 'levelUp', uid: d.uid, level: d.level });
      }
      return done;
    },
    levelOfDef: (defId) => fs.levelOfDef(defId),
    findSpot(defId, near = null, uid = null) {
      return fs.findSpot(defId, 0, near, uid);
    },
    // The Shop: every facility normal play can see (F34 / F35 never), by unlock tier.
    shop() {
      return FACILITIES.filter((f) => !unlockOf(data, f.id).hidden).map((f) => {
        const u = unlockOf(data, f.id);
        const built = fs.has(f.id);
        const can = layout.canBuy(f.id);
        return { def: f, unlocked: u.ok, built, canBuy: can.ok, reason: can.reason };
      });
    },
    // Walking: free tiles reachable from the gate, the best free tiles beside a facility, a pathing Grid.
    isOpenCell: (c, r) => fs.isOpenCell(c, r),
    accessCells: (uid) => fs.accessCells(uid),
    nearestOpen: (c, r, taken) => fs.nearestOpen(c, r, taken),
    buildGrid: (grid) => fs.buildGrid(grid),
    serialize: () => ({ ...F, placement: F.placement.map((p) => ({ ...p })) }),
  };
  return layout;
}
