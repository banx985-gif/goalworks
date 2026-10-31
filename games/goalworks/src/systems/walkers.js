// Walking people on the club complex (Milestone 24; the series chibi walking sheets, SERIES_CHIBI_SPRITES.md). Little
// decorative figures — never tapped, never saved, no stats — moving in plan space (tiles), on cached paths over the
// complex's walkable grid inside the ground (bible §27: every facility keeps a walkable way in) and along the road in front
// of it outside. The screen draws them (src/screens/ClubScreen.js with src/ui/castArt.js drawSheetFrame).
//   • club workers (data/cast.js): Big Tam mows the pitches and works at a build site, Kev Doyle carries kit between the
//     Clubhouse (the dressing rooms) and the pitches, Maureen Hale goes between the Manager Office and the gates, Old Walter
//     potters between the Clubhouse (the tea hut) and the stands;
//   • fans on a home match day: up the road from the left, past the club gates, into the stadium — how many by Club Rank,
//     Fan Trust and the expected crowd (fanCount; at most FANS.maxWalking, bible §41); most in your home colours, a few
//     plain, some away fans in the opponent's; after a win a few stay and cheer at the gates; after a derby loss fewer come;
//   • families on a Summer Showcase day; trial hopefuls on academy trial days (gate → the academy pitch → away);
//   • the signed gods (their own sheets, a small gold glow); the named faces when they are at the club: Edith on board
//     days, Celeste while an offer is open, Sam by the manager's office.
// Workers, gods and faces keep the calendar's pace (still while it is paused); fans, families and hopefuls are the day's
// event and walk in real time (a match day's calendar is stopped at kickoff).
//   createWalkers() → { sync(scene), update(dt, calendarSpeed), list, count(kind) }
//   scene: { day, data, grid, layout, cols, rows, stations: [{ def, uid, fp }], lot: { c0, r0, size }, match: { home,
//            friendly, opponent } | null, trials, board, offer, gods: [sheet names], cheer, att: { crowd, capacity }, level,
//            kit: [hex, hex], awayKit: [hex, hex] | null, upgrades: [uid], stadiumProject }
//   fanCount(data, att, level) → how many fans walk in (pure: the tests read it)
import { findPath } from '../../../../core/Pathing.js';
import { Rng } from '../../../../core/Rng.js';
import { CAST, FANS, TRIAL_HOPEFULS, castById } from '../../data/cast.js';
import { rank as clubRank } from './league.js';
import * as FAN from './fans.js';
import { fanPalette } from '../ui/castArt.js';

const PITCH_DEFS = ['F01', 'F11'];
export const WALK = {
  speed: 1.15, // tiles a second (the calendar's 1×)
  fanSpeed: [1.0, 1.45], // a fan's own pace (tiles a second, real time)
  roadOut: 1.7, // the road: this far in front of the ground's front edge (tiles)
  roadFrom: -5, // where the fans come from (col)
  familyGroups: 6, // Summer Showcase: families walking in (each 2–3 people)
  workStay: [5, 9], // seconds at a stop (calendar time)
  fade: 0.6, // seconds to fade in / out at the ends of the road
  levels: { all: 1, fewer: 0.35, off: 0 },
};

// How many fans walk in on a home match day: Club Rank's base (data/cast.js FANS.byRank) × Fan Trust × the expected crowd
// (bigger stages, bigger crowds) × the dip after a derby loss; at most FANS.maxWalking (80), at least 4.
export function fanCount(data, att, level = 'all') {
  const k = WALK.levels[level] ?? 1;
  if (!k) return 0;
  const base = FANS.byRank[clubRank(data).id] ?? FANS.byRank.E;
  const trustK = 0.6 + (0.8 * FAN.trust(data)) / 100;
  const attK = Math.max(0.5, Math.min(1.8, Math.sqrt((att?.crowd ?? 1500) / 8000)));
  const dip = data.stadium?.dip ?? 1;
  const n = Math.min(FANS.maxWalking, Math.max(4, Math.round(base * trustK * attK * dip)));
  return Math.max(1, Math.round(n * k)); // (Fewer: about a third of them)
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tileC = (t) => ({ x: t.col + 0.5, y: t.row + 0.5 });

export function createWalkers() {
  const people = new Map(); // id → walker
  let rng = new Rng('walkers');
  let sceneKey = '';
  let pathFor = ''; // the grid the cached paths were found on
  let S = null; // the scene now
  let spawnIn = 0; // seconds to the next fan
  let familySerial = 0;
  let familyIn = 0; // seconds to the next family group
  let fanSerial = 0;

  // --- places ---------------------------------------------------------------------------------------------------------
  const stationOf = (defs) => S.stations.find((s) => defs.includes(s.def.id)) ?? null;
  const doorOf = (st) => {
    if (!st) return S.layout.gate;
    return S.layout.accessCells(st.uid)[0] ?? S.layout.nearestOpen(st.fp.col + Math.floor(st.fp.w / 2), st.fp.row + st.fp.h) ?? S.layout.gate;
  };
  const gateIn = () => tileC(S.layout.gate); // the gate tile, inside the ground
  const gateOut = () => ({ x: S.layout.gate.col + 0.5, y: S.rows + 0.55 }); // just outside it
  const road = (col) => ({ x: col, y: S.rows + WALK.roadOut });
  const entrance = () => ({ x: S.lot.c0 + S.lot.size * 0.45, y: S.lot.r0 + S.lot.size - 0.35 }); // (the stadium's front-left face)
  const outsideTo = (pts) => [gateOut(), ...pts];

  // A grid path between two tiles as points (cached per layout version; none: straight there).
  const cache = new Map();
  function gridPath(from, to) {
    const key = `${from.col},${from.row}>${to.col},${to.row}`;
    if (!cache.has(key)) {
      const tiles = S.grid ? findPath(S.grid, from, to) : null;
      cache.set(key, tiles ? tiles.map(tileC) : [tileC(to)]);
    }
    return cache.get(key).map((p) => ({ ...p }));
  }
  const tileOf = (w) => ({ col: Math.max(0, Math.min(S.cols - 1, Math.floor(w.x))), row: Math.max(0, Math.min(S.rows - 1, Math.floor(w.y))) });
  const inside = (p) => p.x >= 0 && p.y >= 0 && p.x < S.cols && p.y < S.rows;

  // --- routes: a list of stops; each stop is { to: () => tile | 'out:<point list>', stay, anim, spot } -------------------
  // Go to a tile on the ground (from inside or out), or out of the gate to outside points.
  function goTo(w, target) {
    if (target.outside) {
      const pts = target.points();
      w.path = inside(w) ? [...gridPath(tileOf(w), S.layout.gate), ...outsideTo(pts)] : pts;
    } else {
      const t = target.tile();
      const spot = target.spot?.() ?? null;
      const leg = inside(w) ? gridPath(tileOf(w), t) : [gateOut(), ...gridPath(S.layout.gate, t)];
      w.path = spot ? [...leg, spot] : leg;
    }
  }
  const at = (defs, extra = {}) => ({ tile: () => doorOf(stationOf(defs)), ...extra });
  // a spot on an open-air place (a pitch): somewhere along its lines
  const onPitch = (defs) => () => {
    const st = stationOf(defs);
    if (!st) return null;
    return { x: st.fp.col + 0.6 + rng.next() * (st.fp.w - 1.2), y: st.fp.row + 0.6 + rng.next() * (st.fp.h - 1.2) };
  };
  const atStadium = () => ({ outside: true, points: () => [road(S.layout.gate.col + 0.5), road(entrance().x), { x: entrance().x, y: S.lot.r0 + S.lot.size + 0.3 }] });

  function workerRoute(id) {
    if (id === 'big_tam') {
      return () => {
        const site = S.stadiumProject ? atStadium() : S.upgrades.length ? { tile: () => doorOf(S.stations.find((s) => s.uid === S.upgrades[0])) } : null;
        const legs = [at(PITCH_DEFS, { spot: onPitch(PITCH_DEFS), anim: 'work' }), at(PITCH_DEFS, { spot: onPitch(PITCH_DEFS), anim: 'work' })];
        if (stationOf(['F11'])) legs.push(at(['F11'], { spot: onPitch(['F11']), anim: 'work' }));
        if (site) legs.push({ ...site, anim: 'work' });
        return legs;
      };
    }
    if (id === 'kev_doyle') return () => [at(['F02'], { anim: 'work' }), at(['F06', 'F02'], { anim: 'work' }), at(PITCH_DEFS, { anim: 'work' })];
    if (id === 'maureen_hale') return () => [at(['F03'], { anim: 'work' }), { tile: () => S.layout.gate, anim: 'idle' }];
    if (id === 'old_walter') return () => [at(['F10', 'F02'], { anim: 'work' }), { ...atStadium(), anim: 'idle' }, at(['F02'], { anim: 'idle' })];
    return () => [at(['F02'])];
  }
  const wander = () => () => {
    const pick = S.stations[Math.floor(rng.next() * S.stations.length)];
    return [{ tile: () => doorOf(pick), anim: 'idle' }];
  };

  // --- walkers --------------------------------------------------------------------------------------------------------
  function add(w) {
    people.set(w.id, { t: rng.next() * 3, anim: 'idle', facing: 'front', mirror: false, alpha: 1, path: [], stay: 0, legs: null, leg: -1, ...w });
    return people.get(w.id);
  }
  // A resident (worker, god, face): placed at its first stop's tile now, then on its route.
  function resident(id, who, kind, route, extra = {}) {
    if (people.has(id)) return;
    const w = add({ id, who, kind, route, calendar: true, ...extra });
    const first = route()[0];
    const t = first?.tile?.() ?? S.layout.gate;
    Object.assign(w, tileC(t));
    w.stay = rng.next() * 4;
  }
  function nextLeg(w) {
    const legs = w.legs?.length ? w.legs : (w.legs = w.route());
    w.leg = (w.leg + 1) % legs.length;
    if (w.leg === 0) w.legs = w.route(); // (the route is looked at again each lap: a build site may have started)
    const L = w.legs[w.leg];
    w.target = L;
    goTo(w, L);
  }
  // A visitor on the road (fan, family, hopeful): walks its points, then is gone.
  function visitor(id, who, kind, points, extra = {}) {
    const w = add({ id, who, kind, calendar: false, speed: WALK.fanSpeed[0] + rng.next() * (WALK.fanSpeed[1] - WALK.fanSpeed[0]), ...extra });
    Object.assign(w, points[0]);
    w.path = points.slice(1).map((p) => ({ ...p }));
    w.alpha = 0;
    return w;
  }
  const jig = (p, a = 0.35) => ({ x: p.x + (rng.next() - 0.5) * a, y: p.y + (rng.next() - 0.5) * a });
  function fanPoints() {
    const e = entrance();
    return [road(WALK.roadFrom - rng.next() * 2), jig(road(S.layout.gate.col + 0.5)), jig(road(e.x)), { x: e.x + (rng.next() - 0.5) * 0.6, y: S.lot.r0 + S.lot.size - 0.9 }].map((p, i) => (i === 0 ? { x: p.x, y: p.y + (rng.next() - 0.5) * 0.5 } : p));
  }
  const FAN_BASE = FANS.base;
  function spawnFan(progress = 0) {
    const chibi = FAN_BASE[Math.floor(rng.next() * FAN_BASE.length)];
    const palette = fanPalette(rng, S.kit, S.awayKit);
    const w = visitor(`fan:${fanSerial++}`, chibi, 'fan', fanPoints(), { palette, chibi });
    if (progress > 0) advance(w, progress * 26);
    return w;
  }
  function spawnFamily(progress = 0) {
    const group = [FANS.family[familySerial++ % 2], ...[1, 18].slice(0, 1 + Math.floor(rng.next() * 2))]; // (a grandparent — 25, or 26 recoloured — by turns, with one or two young fans)
    const pts = fanPoints();
    const ws = group.map((chibi, i) => {
      const palette = chibi === 25 ? null : fanPalette(rng, S.kit, null); // (25 keeps her look; 26, 01, 18 recoloured)
      return visitor(`family:${fanSerial++}`, chibi, 'family', pts.map((p, k) => (k ? { x: p.x - i * 0.32, y: p.y + i * 0.18 } : { x: p.x - i * 0.5, y: p.y })), { palette, chibi, speed: 0.95 });
    });
    if (progress > 0) for (const w of ws) advance(w, progress * 24);
  }
  function spawnHopeful(i) {
    const chibi = TRIAL_HOPEFULS[i % TRIAL_HOPEFULS.length];
    const st = stationOf(['F14', 'F09', 'F01']);
    const door = doorOf(st);
    const pts = [road(WALK.roadFrom - rng.next() * 3), road(S.layout.gate.col + 0.5), gateOut(), ...gridPath(S.layout.gate, door)];
    const w = visitor(`trial:${fanSerial++}`, chibi, 'trial', pts, { chibi, speed: 1.1 + rng.next() * 0.2, then: 'stay' });
    w.home = door;
    return w;
  }
  // Walk a visitor forward by s seconds at once (the scene opened with the stream already flowing).
  function advance(w, s) {
    for (let k = 0; k < s * 4 && w.path.length; k++) step(w, 0.25);
    w.alpha = 1;
  }

  // --- the day's cast -------------------------------------------------------------------------------------------------
  function sync(scene) {
    S = scene;
    const lvl = WALK.levels[S.level] ?? 1;
    if (`${S.layout.version}|${S.cols}x${S.rows}|${S.lot.size}` !== pathFor) {
      pathFor = `${S.layout.version}|${S.cols}x${S.rows}|${S.lot.size}`;
      cache.clear();
      for (const w of people.values()) if (w.calendar) {
        w.legs = null;
        w.leg = -1;
        w.path = [];
        if (!inside(w) || S.grid?.isBlocked(Math.floor(w.x), Math.floor(w.y))) Object.assign(w, tileC(S.layout.gate)); // (the ground changed under them)
      }
    }
    const key = `${S.day}|${S.level}|${S.match ? `${S.match.opponent}:${S.match.home}` : '-'}|${S.trials}|${S.board}|${S.offer}|${S.gods.join(',')}|${S.cheer}`;
    if (key === sceneKey) return;
    const newDay = sceneKey.split('|')[0] !== String(S.day);
    sceneKey = key;
    if (newDay) rng = new Rng(`walkers:${S.day}`);
    const want = new Set();
    // workers
    if (lvl > 0) for (const c of CAST.filter((x) => x.group === 'worker')) {
      want.add(`w:${c.id}`);
      resident(`w:${c.id}`, c.chibi, 'worker', workerRoute(c.id), { name: c.name });
    }
    // gods (their own sheets)
    if (lvl > 0) for (const g of S.gods) {
      want.add(`g:${g}`);
      resident(`g:${g}`, g, 'god', g === 'kaching' ? () => [at(['F03'], { anim: 'idle' }), at(['F02'], { anim: 'idle' })] : wander(), { glow: true });
    }
    // the named faces at the club
    if (lvl > 0) {
      const faces = [['sam_okafor', true, () => [at(['F03'], { anim: 'work' }), at(['F08', 'F04', 'F03'], { anim: 'idle' })]], ['edith_marlow', S.board, () => [at(['F03'], { anim: 'idle' }), { tile: () => S.layout.gate, anim: 'idle' }]], ['celeste_moore', S.offer, () => [at(['F03'], { anim: 'idle' }), at(['F02'], { anim: 'idle' }), { tile: () => S.layout.gate, anim: 'idle' }]]];
      for (const [id, here, route] of faces) if (here) {
        want.add(`f:${id}`);
        resident(`f:${id}`, castById(id).chibi, 'face', route, { name: castById(id).name });
      }
    }
    // the residents who left; the visitors of another day
    for (const [id, w] of people) {
      if (w.calendar && !want.has(id)) people.delete(id);
      if (!w.calendar && newDay) people.delete(id);
    }
    // a lower setting (or a smaller crowd) takes the extra visitors away at once
    if (!lvl) for (const [id, w] of people) if (!w.calendar) people.delete(id);
    const cap = S.match?.home && !S.match.friendly ? fanCount(S.data, S.att, S.level) : 0;
    const fansNow = [...people.values()].filter((w) => w.kind === 'fan');
    for (const w of fansNow.slice(cap)) people.delete(w.id);
    // match day: the stream starts already flowing
    if (S.match?.home && !S.match.friendly) {
      const n = fanCount(S.data, S.att, S.level);
      const have = [...people.values()].filter((w) => w.kind === 'fan').length;
      for (let i = have; i < n; i++) spawnFan(rng.next());
    }
    if (S.match?.friendly && lvl > 0) for (let i = 0; i < Math.round(WALK.familyGroups * lvl); i++) spawnFamily(rng.next());
    if (S.cheer && lvl > 0) cheerers(Math.round(FANS.cheerAfterWin * Math.max(lvl, 0.5)));
    if (S.trials && lvl > 0 && ![...people.values()].some((w) => w.kind === 'trial')) for (let i = 0; i < Math.max(2, Math.round(TRIAL_HOPEFULS.length * lvl)); i++) advance(spawnHopeful(i), rng.next() * 20);
  }
  function cheerers(n) {
    if ([...people.values()].some((w) => w.kind === 'cheer')) return;
    for (let i = 0; i < n; i++) {
      const chibi = FAN_BASE[Math.floor(rng.next() * FAN_BASE.length)];
      const g = S.layout.gate.col + 0.5;
      const w = add({ id: `cheer:${fanSerial++}`, who: chibi, chibi, kind: 'cheer', calendar: false, palette: fanPalette(rng, S.kit, null), anim: 'cheer', facing: 'front', mirror: rng.next() < 0.5 });
      Object.assign(w, { x: g - 1.3 + (i % 4) * 0.75 + rng.next() * 0.2, y: S.rows + 0.95 + Math.floor(i / 4) * 0.5 + rng.next() * 0.15 });
    }
  }

  // --- moving ---------------------------------------------------------------------------------------------------------
  function face(w, dx, dy) {
    // plan → screen: col goes lower right, row lower left. front faces down-left, back up-right (mirror for the others)
    const sx = dx - dy;
    const sy = dx + dy;
    if (Math.abs(sx) + Math.abs(sy) < 1e-6) return;
    w.facing = sy > 0 ? 'front' : 'back';
    w.mirror = w.facing === 'front' ? sx > 0 : sx < 0;
  }
  function step(w, dt) {
    let left = dt * (w.speed ?? WALK.speed);
    while (left > 0 && w.path.length) {
      const p = w.path[0];
      const d = dist(w, p);
      if (d <= left) {
        face(w, p.x - w.x, p.y - w.y);
        w.x = p.x;
        w.y = p.y;
        w.path.shift();
        left -= d;
      } else {
        face(w, p.x - w.x, p.y - w.y);
        w.x += ((p.x - w.x) / d) * left;
        w.y += ((p.y - w.y) / d) * left;
        left = 0;
      }
    }
  }
  function update(dt, speed) {
    if (!S) return;
    for (const [id, w] of people) {
      const pace = w.calendar ? dt * speed : dt;
      w.t += w.calendar && speed === 0 ? dt * 0.5 : dt; // (a paused worker still breathes)
      if (w.kind === 'cheer') continue;
      if (w.calendar) {
        if (!pace) {
          if (!w.path.length) w.anim = w.target?.anim ?? 'idle';
          else w.anim = 'idle';
          continue;
        }
        if (w.path.length) {
          w.anim = 'walk';
          step(w, pace);
        } else if (w.stay > 0) {
          w.stay -= pace;
          w.anim = w.target?.anim ?? 'idle';
          if (w.anim === 'work' || w.anim === 'idle') w.facing = 'front';
        } else {
          nextLeg(w);
          w.stay = WALK.workStay[0] + rng.next() * (WALK.workStay[1] - WALK.workStay[0]);
        }
        continue;
      }
      // a visitor: walk on; fade in at the start of the road, out at the stadium (or away again)
      w.alpha = Math.min(1, w.alpha + dt / WALK.fade);
      if (w.path.length) {
        w.anim = 'walk';
        step(w, pace);
      } else if (w.kind === 'trial' && w.then === 'stay') {
        w.then = 'leave';
        w.stay = 6 + rng.next() * 6;
      } else if (w.kind === 'trial' && w.then === 'leave' && w.stay > 0) {
        w.stay -= dt;
        w.anim = 'idle';
        w.facing = 'front';
        if (w.stay <= 0) {
          w.path = [...gridPath(tileOf(w), S.layout.gate), gateOut(), road(S.layout.gate.col + 0.5), road(WALK.roadFrom - 3)];
          w.then = 'gone';
        }
      } else {
        w.alpha -= (2 * dt) / WALK.fade;
        if (w.alpha <= 0) people.delete(id);
      }
    }
    // the stream of fans keeps coming all match day
    if (S.match?.home && !S.match.friendly) {
      const n = fanCount(S.data, S.att, S.level);
      const fans = [...people.values()].filter((w) => w.kind === 'fan').length;
      spawnIn -= dt;
      if (fans < n && spawnIn <= 0) {
        spawnFan(0);
        spawnIn = 22 / Math.max(1, n);
      }
    }
    // a Summer Showcase: the families keep coming too (a group at a time)
    if (S.match?.friendly && (WALK.levels[S.level] ?? 1) > 0) {
      const groups = Math.round(WALK.familyGroups * (WALK.levels[S.level] ?? 1));
      const people_ = [...people.values()].filter((w) => w.kind === 'family').length;
      familyIn -= dt;
      if (people_ < groups * 2 && familyIn <= 0) {
        spawnFamily(0);
        familyIn = 4;
      }
    }
    if (S.trials && (WALK.levels[S.level] ?? 1) > 0) {
      const hopefuls = [...people.values()].filter((w) => w.kind === 'trial').length;
      if (hopefuls < Math.max(2, Math.round(TRIAL_HOPEFULS.length * (WALK.levels[S.level] ?? 1)))) spawnHopeful(fanSerial);
    }
  }
  return {
    sync,
    update,
    get list() {
      return [...people.values()];
    },
    count: (kind) => [...people.values()].filter((w) => !kind || w.kind === kind).length,
    reset() {
      people.clear();
      sceneKey = '';
      pathFor = '';
    },
  };
}
