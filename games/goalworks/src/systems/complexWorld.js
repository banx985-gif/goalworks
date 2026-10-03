// The club complex world (Milestone 1; Milestone 12: built from the club's facility layout). The hidden grid is the
// ground of the stage the club has reached (data/facilities.js STAGES); facilities block their tiles and every free tile
// is walkable grass, so people go round the facilities, never through them. The Founder walks their loop (data/complex.js
// ROUTE: training pitch → manager office → scout desk → back to the pitch); the squad walks to the place for each
// player's session today (data/facilities.js FOCUS_PLACES: the gym for Physical, the finishing range for Attack, a
// training pitch for the rest …) and drills there, or rests at the Recovery Pool / Clubhouse. At most PEOPLE.max walkers
// (bible §41), the Founder included. Plan space only — the screen projects it. Nothing here is saved: everyone starts at
// their place each time the club opens.
//   createComplexWorld({ founder, layout?, run? }) → world
//     founder: the run's Founder (data/setup.js FOUNDERS entry)   layout: src/systems/facilities.js createLayout (a fresh
//     start layout if left out)   run() → the run save (squad, training) or null (no squad walking)
//   world.refreshLayout() after Build Mode changes the layout (or the ground grows): everyone re-paths
// Milestone 14: each hired staff member (run().staff, src/systems/staff.js) is a figure (kind 'staff') who walks in at the
// gate and works at their station — the coach at the Training Pitch, the scout at the Scout Desk, the physio at the Medical
// Room, the youth coach at the Youth Corner, the analyst at the Video Room / Analytics Lab / Tactics Board Room (the first
// built; otherwise the Clubhouse). They are in world.people (drawn and tapped like the Founder) and count in the walker cap.
// Milestone 15: up to FIGURES academy players (run().academy) train at the Academy Building (else the Youth Corner) as walkers
// (w.youth), and with a Second Training Pitch, group 2 trains on it (training.group2) — all inside the walker cap.
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { COMPLEX, ROUTE, BUSY, PERSON, PEOPLE, DRILL } from '../../data/complex.js';
import { FOCUS_PLACES, REST_PLACES, PITCHES, capacityOf } from '../../data/facilities.js';
import { focusById } from '../../data/training.js';
import { createLayout } from './facilities.js';
import { STAFF_FALLBACK_STATION, roleById } from '../../data/staff.js';
import { stationFor } from './staff.js';
import { FIGURES as ACADEMY_FIGURES } from '../../data/academy.js';
import { secondGroupOpen } from './training.js';

const CELL = COMPLEX.cellSize;

export function createComplexWorld({ founder, layout = null, run = () => null }) {
  const L = layout ?? createLayout({});
  let grid = null;
  let stations = [];
  let byStation = {};
  let byUid = new Map();
  let builtFor = -1;

  // The grid and the stations (one per facility on the ground) for the layout as it is now.
  function syncLayout() {
    const st = L.stage;
    grid = new Grid({ cols: st.cols, rows: st.rows, tileSize: CELL });
    L.buildGrid(grid);
    stations = L.items.map((it) => ({ kind: 'station', id: it.name ?? `fac${it.uid}`, uid: it.uid, def: it.def, fp: { col: it.col, row: it.row, w: it.w, h: it.h } }));
    byStation = Object.fromEntries(stations.map((s) => [s.id, s]));
    byUid = new Map(stations.map((s) => [s.uid, s]));
    builtFor = L.version;
  }
  syncLayout();
  // The tile in front of a station where people stand to use it (free and reachable from the gate).
  const doorOf = (s) => L.accessCells(s.uid)[0] ?? L.nearestOpen(s.fp.col + Math.floor(s.fp.w / 2), s.fp.row + s.fp.h) ?? L.gate;
  const routeStation = (leg) => byStation[leg.station] ?? stations.find((s) => s.def.id === leg.def) ?? null;

  // --- the Founder -----------------------------------------------------------------------------------------------
  const agent = new Agent({ id: 'founder', name: founder.name, speed: PERSON.speed, noPathTeleportSec: 1 });
  const player = { kind: 'player', id: 'founder', name: founder.name, founder, art: founder.art, agent, leg: 0, at: null, stayLeft: 0, laps: 0 };
  function arrive() {
    const leg = ROUTE[player.leg];
    player.at = leg.station;
    player.stayLeft = leg.stay;
    if (player.leg === 0) player.laps++; // the first stop counts as lap 1
  }
  function walkLeg() {
    player.at = null;
    const s = routeStation(ROUTE[player.leg]);
    const d = s ? doorOf(s) : L.gate;
    agent.walkTo(grid, d.col, d.row, arrive);
  }
  function walkNext() {
    player.leg = (player.leg + 1) % ROUTE.length;
    walkLeg();
  }
  {
    const s = routeStation(ROUTE[0]);
    const d = s ? doorOf(s) : L.gate;
    agent.placeAtTile(grid, d.col, d.row);
    arrive();
  }

  // --- the squad -------------------------------------------------------------------------------------------------
  // walker: { kind: 'walker', id, p (squad player), agent, focus, uid (the place), slot (its index there), spot (plan
  //   point where he stands / drills), open (an open-air place: he goes onto it), resting, phase: 'path' | 'enter' | 'at' }
  const walkers = new Map();
  let planKey = '';

  // The plan for today: for each shown player, the place (facility uid) and his index there.
  // (M15) the academy's place: the Academy Building, else the Youth Corner (none built: no academy figures)
  const academyStation = () => stations.find((s) => s.def.id === 'F14') ?? stations.find((s) => s.def.id === 'F09') ?? null;
  const academyShown = (d) => (academyStation() ? (d?.academy?.players ?? []).slice(0, ACADEMY_FIGURES) : []);
  function planToday() {
    const d = run();
    const youth = academyShown(d);
    const players = (d?.squad?.players ?? []).filter((p) => !p.founder).slice().sort((a, b) => (a.shirt ?? 99) - (b.shirt ?? 99)).slice(0, Math.max(0, PEOPLE.max - 1 - staffFigs.size - youth.length));
    const group2 = secondGroupOpen(d) && stations.some((s) => s.def.id === 'F11') ? new Set(d.training?.group2?.ids ?? []) : new Set();
    const today = players[0]?.today?.kind;
    const team = d?.training?.focus ?? 'technique';
    const allRest = today === 'dayoff' || today === 'match' || !!focusById(team).rest;
    const used = new Map();
    const room = (s) => capacityOf(s.def) - (used.get(s.uid) ?? 0);
    const pick = (list, overflow) => {
      for (const id of list) for (const s of stations) if (s.def.id === id && room(s) > 0) return s;
      return stations.find((s) => overflow.includes(s.def.id)) ?? stations[0];
    };
    const out = [];
    for (const p of players) {
      const g2 = group2.has(p.id); // (M15) group 2: its own session on the Second Training Pitch
      const focus = allRest ? 'rest' : p.focus ?? (g2 ? d.training.group2.focus : team);
      const rest = focus === 'rest' || !!focusById(focus).rest;
      const keeperSession = focus === 'goalkeeping';
      let list = rest ? REST_PLACES : g2 && !p.focus ? ['F11', ...PITCHES] : keeperSession && p.position !== 'GK' ? FOCUS_PLACES.goalkeeping.filter((x) => PITCHES.includes(x)) : FOCUS_PLACES[focus] ?? PITCHES;
      // (M15) with a group 2 on the second pitch, group 1's team session keeps to the other places (the second pitch only as overflow)
      if (group2.size && !g2 && !rest && !p.focus) list = list.filter((x) => x !== 'F11');
      const s = pick(list, rest ? ['F02'] : PITCHES);
      const slot = used.get(s.uid) ?? 0;
      used.set(s.uid, slot + 1);
      out.push({ p, focus: rest ? 'rest' : focus, uid: s.uid, slot, resting: rest });
    }
    // (M15) the academy at its building: training (the seniors' day off is theirs too)
    const ys = academyStation();
    const academyRest = today === 'dayoff';
    youth.forEach((p, i) => out.push({ p, focus: academyRest ? 'rest' : p.focus ?? d.academy.focus ?? 'technique', uid: ys.uid, slot: (used.get(ys.uid) ?? 0) + i, resting: academyRest, youth: true }));
    return out;
  }
  // Where a player stands at his place: on an open-air space, a spot spread over it; at a building, a free tile in front.
  function spotOf(s, slot) {
    const { col, row, w, h } = s.fp;
    if (s.def.open) {
      const n = Math.max(1, capacityOf(s.def));
      const across = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
      const down = Math.ceil(n / across);
      const i = slot % n;
      const u = ((i % across) + 0.5) / across;
      const v = (Math.floor(i / across) + 0.5) / down;
      return { x: (col + 0.4 + u * (w - 0.8)) * CELL, y: (row + 0.4 + v * (h - 0.8)) * CELL, inside: true };
    }
    const cells = L.accessCells(s.uid);
    const c = cells[slot % Math.max(1, cells.length)] ?? doorOf(s);
    const k = Math.floor(slot / Math.max(1, cells.length));
    const jig = [[0, 0], [0.28, -0.22], [-0.26, 0.2], [0.22, 0.26], [-0.24, -0.25]][k % 5];
    return { x: (c.col + 0.5 + jig[0]) * CELL, y: (c.row + 0.5 + jig[1]) * CELL, inside: false, cell: c };
  }
  const entryCell = (s, spot) => {
    if (!spot.inside) return spot.cell;
    const cells = L.accessCells(s.uid);
    let best = cells[0] ?? doorOf(s);
    let bd = Infinity;
    for (const c of cells) {
      const dd = Math.hypot((c.col + 0.5) * CELL - spot.x, (c.row + 0.5) * CELL - spot.y);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    return best;
  };
  // Is this walker standing on a blocked tile (on an open-air place, or where a facility has just been built)?
  const onBlocked = (a) => {
    const t = a.tile(grid);
    return !t || grid.isBlocked(t.col, t.row);
  };
  // Send a walker to his place (or put him there at once: the club just opened). Someone standing on a blocked tile (an
  // open-air place, or where a facility was just built) first steps off to the nearest free tile.
  function assign(w, plan, instant) {
    const s = byUid.get(plan.uid);
    const onPlace = !instant && (w.phase === 'exit' || onBlocked(w.agent));
    Object.assign(w, { focus: plan.focus, uid: plan.uid, slot: plan.slot, resting: plan.resting, open: !!s.def.open, youth: !!plan.youth });
    w.spot = spotOf(s, plan.slot);
    if (instant) {
      w.agent.x = w.spot.x;
      w.agent.y = w.spot.y;
      w.agent.path = [];
      w.agent.setState('working');
      w.phase = 'at';
      return;
    }
    if (onPlace) {
      const t = L.nearestOpen(Math.floor(w.agent.x / CELL), Math.floor(w.agent.y / CELL)) ?? L.gate;
      w.phase = 'exit';
      w.exit = { x: (t.col + 0.5) * CELL, y: (t.row + 0.5) * CELL };
      w.agent.setState('walking');
      return;
    }
    walkOn(w, s);
  }
  function walkOn(w, s = byUid.get(w.uid)) {
    const e = entryCell(s, w.spot);
    w.phase = 'path';
    w.agent.walkTo(grid, e.col, e.row, () => {
      w.phase = w.spot.inside ? 'enter' : 'at';
      if (!w.spot.inside) {
        w.agent.x = w.spot.x;
        w.agent.y = w.spot.y;
      }
    });
  }
  function replan(instant = false) {
    const plans = planToday();
    const seen = new Set();
    for (const pl of plans) {
      seen.add(pl.p.id);
      let w = walkers.get(pl.p.id);
      const fresh = !w;
      if (!w) {
        w = { kind: 'walker', id: pl.p.id, p: pl.p, agent: new Agent({ id: pl.p.id, name: pl.p.name, speed: PERSON.speed * 0.9, noPathTeleportSec: 1 }) };
        walkers.set(pl.p.id, w);
        if (!instant) {
          const g = L.gate; // a new face comes in at the gate
          w.agent.placeAtTile(grid, g.col, g.row);
        }
      }
      w.p = pl.p;
      // (unchanged: the same place, slot and session, and that place has not moved)
      const s = byUid.get(pl.uid);
      const key = `${pl.uid}:${pl.slot}:${pl.focus}:${s.fp.col},${s.fp.row}`;
      if (!fresh && !instant && w.key === key) continue;
      w.key = key;
      assign(w, pl, instant);
    }
    for (const id of [...walkers.keys()]) if (!seen.has(id)) walkers.delete(id);
  }
  const keyNow = () => {
    const d = run();
    if (!d?.squad) return '';
    const ps = d.squad.players;
    const ys = academyShown(d); // (M15) the academy figures and group 2
    return `${builtFor}|${staffFigs.size}|${d.training?.focus}|${ps[0]?.today?.kind}|${ps.map((p) => `${p.id}:${p.focus ?? ''}`).join(',')}|${secondGroupOpen(d) ? `${d.training?.group2?.focus}:${(d.training?.group2?.ids ?? []).join(',')}` : ''}|${d.academy?.focus}:${ys.map((p) => `${p.id}:${p.focus ?? ''}`).join(',')}`;
  };

  // --- the staff (Milestone 14) ------------------------------------------------------------------------------------
  // fig: { kind: 'staff', id: 'staff:HC01', staffId, role, name, art, agent, uid (the station), phase: 'path' | 'at' }
  const staffFigs = new Map();
  let staffKey = null;
  const hiredNow = () => run()?.staff?.hired ?? [];
  const staffStation = (role) => stationFor(role, stations.map((s) => ({ uid: s.uid, def: s.def }))) ?? stations.find((s) => s.def.id === STAFF_FALLBACK_STATION) ?? stations[0];
  // Where they stand: the last free tile in front of the station (the first is the Founder's / the squad's way in).
  function staffSpot(st, k) {
    const cells = L.accessCells(st.uid);
    return cells.length ? cells[(cells.length - 1 - k + cells.length * 4) % cells.length] : doorOf(st);
  }
  function placeStaff(f, instant) {
    const st = byUid.get(staffStation(f.role)?.uid);
    if (!st) return;
    const sharing = [...staffFigs.values()].filter((o) => o !== f && o.uid === st.uid).length; // (two roles at the Clubhouse)
    f.uid = st.uid;
    const c = staffSpot(st, sharing);
    if (instant) {
      f.agent.placeAtTile(grid, c.col, c.row);
      f.phase = 'at';
      f.agent.setState('working');
      return;
    }
    if (onBlocked(f.agent)) {
      const t = L.nearestOpen(Math.floor(f.agent.x / CELL), Math.floor(f.agent.y / CELL)) ?? L.gate;
      f.agent.placeAtTile(grid, t.col, t.row);
    }
    f.phase = 'path';
    f.agent.walkTo(grid, c.col, c.row, () => {
      f.phase = 'at';
      f.agent.setState('working');
    });
  }
  // Hired / released since the last look: new faces walk in at the gate; the rest keep their place (all re-path when moved).
  function syncStaff(instant = false, relayout = false) {
    const list = hiredNow();
    const key = list.map((s) => s.id).join(',');
    if (key === staffKey && !relayout) return false;
    staffKey = key;
    const ids = new Set(list.map((s) => s.id));
    for (const id of [...staffFigs.keys()]) if (!ids.has(id)) staffFigs.delete(id);
    for (const s of list) {
      let f = staffFigs.get(s.id);
      if (!f) {
        f = { kind: 'staff', id: `staff:${s.id}`, staffId: s.id, role: s.role, name: s.name, art: s.art, agent: new Agent({ id: `staff:${s.id}`, name: s.name, speed: PERSON.speed * 0.85, noPathTeleportSec: 1 }), uid: null, phase: 'path' };
        staffFigs.set(s.id, f);
        if (!instant) f.agent.placeAtTile(grid, L.gate.col, L.gate.row);
        placeStaff(f, instant);
      } else if (relayout) placeStaff(f, false);
    }
    world.staffVersion++;
    return true;
  }

  const world = {
    staffVersion: 0, // (M14) bumps when the staff on the ground change (the screen redoes its tap list)
    get staff() {
      return [...staffFigs.values()];
    },
    get grid() {
      return grid;
    },
    get stations() {
      return stations;
    },
    layout: L,
    player,
    get people() {
      return [player, ...staffFigs.values()]; // (M14) the Founder and the staff
    },
    get walkers() {
      return [...walkers.values()];
    },
    visits: [], // the stations reached, in order (tests)
    byId: (id) => (id === player.id ? player : (byStation[id] ?? walkers.get(id) ?? [...staffFigs.values()].find((f) => f.id === id) ?? null)),
    // (M14) the staff working at a facility now
    staffAt: (uid) => [...staffFigs.values()].filter((f) => f.uid === uid),
    byUid: (uid) => byUid.get(uid) ?? null,
    // Who is at (or on the way to) a facility now: [walker].
    usersOf(uid) {
      return world.walkers.filter((w) => w.uid === uid);
    },
    // What the Founder is doing now: "Training", "Walking to the manager office" …; for a facility, who is using it.
    stateOf(it = player) {
      if (it.kind === 'station') {
        const leg = ROUTE.find((r) => r.station === it.id);
        if (leg) {
          if (player.at === it.id) return `In use: ${player.name} — ${BUSY[leg.def].toLowerCase()}`;
          if (ROUTE[player.leg].station === it.id && !player.at) return `${player.name} is on the way`;
        }
        const users = world.usersOf(it.uid);
        if (!users.length) return 'Free';
        const there = users.filter((w) => w.phase === 'at' || w.phase === 'enter').length;
        const what = users[0].resting ? 'resting' : `${focusById(users[0].focus).name} session`;
        return `In use: ${users.length} player${users.length === 1 ? '' : 's'} — ${what}${there < users.length ? ` (${users.length - there} on the way)` : ''}`;
      }
      if (it.kind === 'staff') {
        const where = byUid.get(it.uid)?.def.name ?? 'the ground';
        return it.phase === 'path' ? `Walking to the ${where}` : `${roleById(it.role)?.verb ?? 'Working'} at the ${where}`;
      }
      if (it.kind === 'walker') {
        const s = byUid.get(it.uid);
        const where = s?.def.name ?? 'the ground';
        if (it.phase === 'path') return `Walking to the ${where}`;
        return it.resting ? `Resting at the ${where}` : `${focusById(it.focus).name} at the ${where}`;
      }
      if (player.at) return BUSY[ROUTE.find((r) => r.station === player.at).def];
      return ROUTE[player.leg].walking;
    },
    // Build Mode changed the layout (or the ground grew): new grid, the Founder and the squad re-path from where they are.
    refreshLayout() {
      if (builtFor === L.version && grid.cols === L.stage.cols && grid.rows === L.stage.rows) return false;
      syncLayout();
      if (onBlocked(agent)) {
        const t = L.nearestOpen(Math.floor(agent.x / CELL), Math.floor(agent.y / CELL)) ?? L.gate; // (built over: step aside)
        agent.placeAtTile(grid, t.col, t.row);
      }
      if (player.at) {
        const s = routeStation(ROUTE[player.leg]);
        const d = s && doorOf(s);
        const t = agent.tile(grid);
        if (d && (!t || t.col !== d.col || t.row !== d.row)) {
          player.stayLeft = Math.max(player.stayLeft, 0.01);
          player.leg = (player.leg + ROUTE.length - 1) % ROUTE.length;
          walkNext(); // (the same stop again, from where he is)
        }
      } else walkLeg();
      syncStaff(false, true);
      replan(false);
      planKey = keyNow();
      return true;
    },
    update(dt) {
      if (builtFor !== L.version) world.refreshLayout();
      if (player.at) {
        player.stayLeft -= dt;
        if (player.stayLeft <= 0) walkNext();
      } else {
        const wasWalking = agent.state === 'walking';
        agent.update(dt, grid);
        if (wasWalking && player.at) world.visits.push(player.at);
      }
      syncStaff(!world.started);
      for (const f of staffFigs.values()) if (f.phase === 'path') f.agent.update(dt, grid);
      const k = keyNow();
      if (k !== planKey) {
        replan(planKey === '' && !world.started);
        planKey = k;
        world.started = true;
      }
      for (const w of walkers.values()) {
        if (w.phase === 'path') w.agent.update(dt, grid);
        else if (w.phase === 'enter' || w.phase === 'exit') {
          // the last few steps onto an open-air place, or off it (its tiles are blocked for the path finder)
          const to = w.phase === 'exit' ? w.exit : w.spot;
          const dx = to.x - w.agent.x;
          const dy = to.y - w.agent.y;
          const d = Math.hypot(dx, dy);
          const step = w.agent.speed * dt;
          if (Math.abs(dx) > 0.01) w.agent.facing = dx > 0 ? 1 : -1;
          if (d <= step) {
            w.agent.x = to.x;
            w.agent.y = to.y;
            if (w.phase === 'exit') walkOn(w);
            else {
              w.phase = 'at';
              w.agent.setState('working');
            }
          } else {
            w.agent.x += (dx / d) * step;
            w.agent.y += (dy / d) * step;
          }
        }
      }
    },
    // Tests: put everyone at their place now.
    settle() {
      syncStaff(true, true);
      for (const f of staffFigs.values()) placeStaff(f, true);
      replan(true);
      planKey = keyNow();
    },
    count: () => 1 + staffFigs.size + walkers.size,
  };
  // The first frame puts the squad straight at their places (the club just opened).
  world.started = false;
  return world;
}

export { DRILL };
