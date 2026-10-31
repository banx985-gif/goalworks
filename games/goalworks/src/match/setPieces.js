// Fouls, cards, injuries, substitutes, set pieces, penalties and shoot-outs in the match (Milestone 25, bible §19 / §20).
// Everything random comes from world.rng in a fixed order, and a human's penalty aim or keeper's dive arrives as a logged
// timeline command, so a saved match still replays to exactly the same moment. The numbers are data/matchRules.js.
//   foulOnTackle(world, tackler, carrier, won) → true when the referee gives a foul (matchAI.tackle: the AI's and a manual
//     tackle go through the same model — bible "reckless manual tackling uses the same foul model")
//   overuseMinute(world) — once a match minute: a knock for a player who started tired (setup risk)
//   tackleKnock(world, victim) — a clean tackle that won the ball, now and then a knock
//   awardRestart(world, kind, team, x, y) — a free kick / penalty / corner: a set piece, or a plain restart
//   stepSpecial(world, dt) → true while a stoppage, a set piece or the shoot-out has the match (matchWorld.step)
//   penaltyInput(world, cmd) — the human's aim / dive (timeline commands ['pen', ax, ay, power] / ['dive', dir, timing])
//   startShootout(world) — five each, then sudden death (cup ties level at full time)
//   takerFor(world, team, kind) — the designated taker if he is on the pitch, else the next best by the stats
//   penaltyChance(...) — the pure model (the tests and the shoot-out measure read it)
import { PITCH, MATCH_TIME } from '../../data/match.js';
import { INJURY, SEVERITY, DISCIPLINE as D, SET_PIECES as SP, routineById, ROUTINES, SET_PIECE_TRAITS, SUBS } from '../../data/matchRules.js';
import { GODS } from '../../data/gods.js';

const W = PITCH.w;
const H = PITCH.h;
const DT = MATCH_TIME.step;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const JINX = GODS.GOD2;
const traitFx = (p, k) => (p?.trait ? SET_PIECE_TRAITS[p.trait]?.[k] ?? 0 : 0);

// --- helpers --------------------------------------------------------------------------------------------------------------
const side = (world, team) => world.players.filter((p) => p.team === team);
const ownGoalY = (world, team) => world.ownGoal(team).y;
const inOwnBox = (world, team, x, y) => Math.abs(x - W / 2) < PITCH.boxW / 2 && Math.abs(y - ownGoalY(world, team)) < PITCH.boxD;
const STAT_FOR = { pen: (p) => p.stats.shooting * 0.7 + p.stats.passing * 0.3, fk: (p) => p.stats.shooting * 0.55 + p.stats.passing * 0.45, cornerL: (p) => p.stats.passing, cornerR: (p) => p.stats.passing };
export function takerFor(world, team, kind) {
  const want = world.setup.takers?.[team]?.[kind] ?? null;
  const list = side(world, team).filter((p) => p.role !== 'GK');
  if (want) {
    const p = list.find((q) => q.id === want || q.name === want);
    if (p) return p;
  }
  return list.slice().sort((a, b) => STAT_FOR[kind](b) - STAT_FOR[kind](a) || a.i - b.i)[0] ?? side(world, team)[0];
}
const spBonus = (world, team) => (world.setup.setPiece?.[team] ?? 0) / 100;
// How organised a side is when defending a set piece (and how disciplined in its own box): the better its defenders, the
// fewer box fouls, corners conceded and headers lost — SET_PIECES.level.ref ÷ its outfield's average tackling (Regional
// ~1.1, Premier ~0.67), worked out once a match. Without it the top flight, where open play is tight, would see half its
// goals from set pieces.
export function setPieceLevel(world, team) {
  world.spLevel ??= [null, null];
  if (world.spLevel[team] == null) {
    const out = world.all.filter((p) => p.team === team && p.role !== 'GK');
    const avg = out.reduce((n, p) => n + p.stats.tackling, 0) / Math.max(1, out.length);
    world.spLevel[team] = clamp(SP.level.ref / Math.max(1, avg), SP.level.min, SP.level.max);
  }
  return world.spLevel[team];
}

// --- incidents (the club reads them: src/systems/medical.js) ----------------------------------------------------------------
function incident(world, e) {
  const rec = { ...e, minute: world.minute };
  world.incidents.push(rec);
  world.event({ ...e });
  return rec;
}

// --- fouls and cards ------------------------------------------------------------------------------------------------------
export function foulOnTackle(world, p, owner, won) {
  if (world.phase !== 'play' || world.special) return false;
  const rng = world.rng;
  const t = world.tactics[p.team];
  let chance = won ? D.foulWon : D.foulFail;
  chance += Math.max(0, owner.stats.dribbling - p.stats.tackling) * D.skill;
  const d = dist(p, owner) || 1;
  const closing = ((p.vx - owner.vx) * (owner.x - p.x) + (p.vy - owner.vy) * (owner.y - p.y)) / d;
  const ov = Math.hypot(owner.vx, owner.vy);
  const behind = ov > 2 ? (owner.vx * (p.x - owner.x) + owner.vy * (p.y - owner.y)) / (ov * d) : 0;
  const top = world.T.speed.base + (world.T.speed.pace * p.stats.pace) / 100; // (relative to his own top speed: a Premier sprint is no more reckless than a Regional one)
  const reckless = closing > top * D.reckless.speed || behind < D.reckless.behind;
  if (reckless) chance += D.reckless.add;
  if (inOwnBox(world, p.team, owner.x, owner.y)) chance *= D.inBox * (D.inBoxLine[t.line] ?? 1) * setPieceLevel(world, p.team);
  if (p.yellow) chance *= D.booked;
  chance *= (D.pressMult[t.press] ?? 1) * (D.mentalityMult[t.mentality] ?? 1);
  if (rng.next() >= chance) return false;
  // the foul: the carrier keeps the ball for his side (a free kick or a penalty)
  world.stats[p.team].fouls = (world.stats[p.team].fouls ?? 0) + 1;
  const dogso = clearRun(world, owner);
  card(world, p, reckless, dogso);
  const hurt = world.rng.next() < (reckless ? INJURY.onReckless : INJURY.onFoul) * (owner.risk ?? 1);
  if (hurt) injure(world, owner, reckless ? 'a reckless tackle' : 'a foul');
  const pen = inOwnBox(world, p.team, owner.x, owner.y);
  world.event({ type: 'foul', team: p.team, by: p.name, on: owner.name, pen, reckless });
  if (world.owner === owner) world.release(owner);
  queueRestart(world, pen ? 'pen' : 'fk', owner.team, owner.x, owner.y);
  return true;
}
// Was the carrier through on goal (nobody but the keeper goal-side, inside 30 m)?
function clearRun(world, o) {
  const g = world.goalOf(o.team);
  if (dist(o, g) > 30) return false;
  const myA = world.aOf(o.team, o.y);
  return !world.players.some((q) => q.team !== o.team && q.role !== 'GK' && world.aOf(o.team, q.y) < myA - 0.5);
}
// The referee: a straight red, a yellow (a second yellow is a red), or a word. A Fierce or Blood Feud derby: stricter
// (setup.rivalry.cardRisk, M22).
function card(world, p, reckless, dogso) {
  const rng = world.rng;
  const strict = 1 + (world.setup.rivalry?.cardRisk ?? 0);
  const red = (reckless ? D.recklessRed : D.straightRed) + (dogso ? D.danger : 0);
  if (rng.next() < red * strict) return sendOff(world, p, true);
  const y = ((reckless ? D.recklessYellow : D.yellow) + (dogso ? D.danger * 2 : 0)) * (p.yellow ? D.bookedYellow : 1);
  if (rng.next() < y * strict) {
    if (p.yellow) return sendOff(world, p, false);
    p.yellow = true;
    incident(world, { type: 'yellow', team: p.team, by: p.name, id: p.id ?? null });
  }
}
function sendOff(world, p, straight) {
  incident(world, { type: 'red', team: p.team, by: p.name, id: p.id ?? null, straight, second: !straight });
  if (p.role === 'GK') {
    // a keeper sent off: a bench keeper comes on for an outfield player (a change used), else an outfielder goes in goal
    const bench = world.bench[p.team];
    const gk = world.subsLeft[p.team] > 0 ? bench.findIndex((b) => b.position === 'GK') : -1;
    const out = side(world, p.team).filter((q) => q !== p && q.role !== 'GK').sort((a, b) => world.aOf(p.team, a.y) - world.aOf(p.team, b.y))[0]; // (the one furthest forward)
    if (gk >= 0 && out) {
      world._remove(out);
      incident(world, { type: 'sub', team: p.team, off: out.name, offId: out.id ?? null, on: bench[gk].name, onId: bench[gk].id ?? null, why: 'keeper' });
      becomes(world, p, bench.splice(gk, 1)[0]);
      world.subsLeft[p.team]--;
      return;
    }
    world._remove(p);
    const stand = side(world, p.team).filter((q) => q.role !== 'GK').sort((a, b) => dist(a, world.ownGoal(p.team)) - dist(b, world.ownGoal(p.team)))[0];
    if (stand) stand.role = 'GK';
    return;
  }
  world._remove(p);
}
// A bench player takes over a player's place on the pitch (his slot, his spot): the object keeps its slot, takes the new man.
function becomes(world, p, b) {
  Object.assign(p, { name: b.name, shirt: b.shirt, stats: { ...b.stats }, id: b.id ?? null, position: b.position ?? p.position, god: b.god ?? null, trait: b.trait ?? null, risk: b.risk ?? 1, yellow: false, hurt: false, manual: !!p.manual, sub: true, cool: 0.5 }); // (Play: the man coming on keeps the control mark)
  if (p.position === 'GK') p.role = 'GK';
}

// --- injuries -------------------------------------------------------------------------------------------------------------
function rollSeverity(rng) {
  let r = rng.next();
  for (const s of SEVERITY) {
    if (r < s.share) return s;
    r -= s.share;
  }
  return SEVERITY[0];
}
function injure(world, p, cause) {
  if (p.hurt || !world.players.includes(p)) return;
  p.hurt = true;
  const sev = rollSeverity(world.rng);
  const days = world.rng.int(sev.days[0], sev.days[1]);
  incident(world, { type: 'injury', team: p.team, by: p.name, id: p.id ?? null, sev: sev.id, days, cause });
  world.pendingOff.push(p);
}
export function tackleKnock(world, victim) {
  if (world.rng.next() < INJURY.onTackle * (victim.risk ?? 1)) {
    injure(world, victim, 'a heavy challenge');
    stopForInjury(world);
  }
}
// The referee stops the play for a hurt player (a dropped ball to the side that had it once he is seen to).
function stopForInjury(world) {
  if (world.phase !== 'play' || world.special) return;
  const o = world.owner;
  const team = o ? o.team : world.lastTouch ?? 0;
  if (o) world.release(o);
  queueRestart(world, 'drop', team, world.ball.x, world.ball.y);
}
// Once a match minute: a player who started tired (risk above 1) may pull up — the play stops for him.
export function overuseMinute(world) {
  for (const p of world.players) {
    if (p.hurt || (p.risk ?? 1) <= 1) continue;
    if (world.rng.next() < INJURY.overusePerMin * p.risk * p.risk) {
      injure(world, p, 'overuse');
      stopForInjury(world);
    }
  }
}
// The injured leave once the play stops: a change if one is left (the AI picks for both sides), else a man down.
function dealWithInjured(world) {
  for (const p of world.pendingOff.splice(0)) {
    if (!world.players.includes(p)) continue;
    const bench = world.bench[p.team];
    if (world.subsLeft[p.team] > 0 && bench.length) {
      const pos = p.role === 'GK' ? 'GK' : p.position;
      let j = bench.findIndex((b) => b.position === pos);
      if (j < 0 && p.role !== 'GK') j = bench.findIndex((b) => b.position !== 'GK');
      if (j >= 0) {
        const b = bench.splice(j, 1)[0];
        incident(world, { type: 'sub', team: p.team, off: p.name, offId: p.id ?? null, on: b.name, onId: b.id ?? null, why: 'injury' });
        world.subsLeft[p.team]--;
        becomes(world, p, b);
        continue;
      }
    }
    world._remove(p);
    if (p.role === 'GK') {
      const stand = side(world, p.team).filter((q) => q.role !== 'GK').sort((a, b) => dist(a, world.ownGoal(p.team)) - dist(b, world.ownGoal(p.team)))[0];
      if (stand) stand.role = 'GK';
    }
  }
}

// --- the restart after a stoppage ------------------------------------------------------------------------------------------
// kind: 'fk' | 'pen' | 'corner' | 'drop'. An injury first stops the play (the INJURED tag) for INJURY.pauseSec.
function queueRestart(world, kind, team, x, y) {
  world.special = { phase: world.pendingOff.length ? 'stoppage' : 'setup', left: world.pendingOff.length ? INJURY.pauseSec : 0, next: { kind, team, x: clamp(x, 1, W - 1), y: clamp(y, 1, H - 1) } };
  world.owner = null;
  world.pass = null;
  world.shot = null;
  world.ball.vx = world.ball.vy = world.ball.vz = 0;
  world.phase = 'stoppage';
}
export function awardRestart(world, kind, team, x, y) {
  queueRestart(world, kind, team, x, y);
}

// A set piece is set up: where everyone stands, who takes it, what kind it is.
function setUp(world) {
  const sp = world.special;
  const { kind, team, x, y } = sp.next;
  sp.next = null;
  dealWithInjured(world);
  const g = world.goalOf(team);
  const toGoal = Math.hypot(x - g.x, y - g.y);
  const attackA = world.aOf(team, y);
  if (kind === 'pen') return startPenalty(world, team, false);
  if (kind === 'corner') return startCross(world, team, x, y, 'corner');
  if (kind === 'fk' && toGoal < SP.freeKick.directRange && Math.abs(x - W / 2) < PITCH.boxW / 2 + 2) return startDirect(world, team, x, y);
  if (kind === 'fk' && attackA < 36 && Math.abs(x - W / 2) > W * SP.freeKick.wideX) return startCross(world, team, x, y, 'fk');
  // anything else: a plain restart (a free kick deep, or a dropped ball after an injury)
  world.special = null;
  world._setRestart(kind === 'drop' ? 'freekick' : 'freekick', team, x, y);
}

// --- crosses: corners and wide free kicks (routines) -----------------------------------------------------------------------
function startCross(world, team, x, y, from) {
  const routineId = world.setup.routine?.[team] ?? 'mixed';
  let r = routineById(routineId);
  if (r.id === 'mixed') r = ROUTINES[Math.floor(world.rng.next() * 4)];
  const left = x < W / 2;
  const taker = takerFor(world, team, from === 'corner' ? (world.dir(team) < 0 ? (left ? 'cornerL' : 'cornerR') : left ? 'cornerR' : 'cornerL') : 'fk');
  world.special = { phase: 'setpiece', kind: from === 'corner' ? 'corner' : 'cross', team, x, y, taker, routine: r.id, left: SP.pause, start: world.steps };
  world.phase = 'setpiece';
  world.event({ type: from === 'corner' ? 'corner' : 'freeKick', team, by: taker.name, routine: r.id, shooting: false });
  placeForCross(world, team, x, y, taker, r);
}
function placeForCross(world, team, x, y, taker, r) {
  const g = world.goalOf(team);
  const dir = Math.sign(g.y - H / 2) || -1; // the goal's side: −1 top, +1 bottom
  const spot = (across, depth) => ({ x: W / 2 + (across - 0.5) * PITCH.goalW * 2.2 * (x < W / 2 ? 1 : -1), y: g.y - dir * depth });
  taker.tx = taker.x = x;
  taker.ty = taker.y = y;
  const att = side(world, team).filter((p) => p !== taker && p.role !== 'GK');
  const def = side(world, 1 - team).filter((p) => p.role !== 'GK');
  att.forEach((p, i) => {
    const s = i < 5 ? spot(0.15 + (i % 5) * 0.18, 6 + (i % 3) * 2.5) : { x: W / 2 + (i - 7) * 6, y: g.y - dir * 30 };
    p.tx = s.x;
    p.ty = s.y;
  });
  def.forEach((p, i) => {
    const s = i < 7 ? spot(0.1 + (i % 7) * 0.13, 4 + (i % 2) * 2) : { x: W / 2 + (i - 8) * 8, y: g.y - dir * 24 };
    p.tx = s.x;
    p.ty = s.y;
  });
  const k = world.keeperOf(1 - team);
  if (k) {
    k.tx = W / 2;
    k.ty = g.y - dir * 0.8;
  }
  world.ball.x = x;
  world.ball.y = y;
  world.ball.z = 0;
}
// The delivery: an aerial contest between the best attacker the routine picks and the best defender, the keeper coming
// for it first. Won → a header / a first-time shot from the routine's spot; lost → cleared or claimed.
function takeCross(world) {
  const sp = world.special;
  const rng = world.rng;
  const { team, taker } = sp;
  const r = routineById(sp.routine);
  const att = side(world, team).filter((p) => p !== taker && p.role !== 'GK');
  const def = side(world, 1 - team).filter((p) => p.role !== 'GK');
  const k = world.keeperOf(1 - team);
  world.special = null;
  world.phase = 'play';
  if (r.id === 'short' || !att.length) {
    // short: the taker keeps it with a team-mate close by; the play goes on
    world.give(taker);
    world.restartGo = true;
    world.restart = { type: 'freekick', team, taker };
    return;
  }
  const head = (p) => p.stats.tackling * 0.3 + p.stats.pace * 0.2 + p.stats.shooting * 0.5 + (r.tall ? p.stats.tackling * 0.2 : 0);
  const dfn = (p) => p.stats.tackling * 0.7 + p.stats.pace * 0.3;
  const a = att.slice().sort((x, y) => head(y) - head(x) || x.i - y.i)[0];
  const d = def.slice().sort((x, y) => dfn(y) - dfn(x) || x.i - y.i)[0];
  const delivery = (taker.stats.passing - (k?.stats.keeping ?? taker.stats.passing)) / 400; // (relative: a great delivery against a great keeper is no edge)
  // the keeper comes and claims it
  if (k && rng.next() < SP.header.keeperClaim - delivery * 1.3) {
    world.event({ type: 'claim', team: k.team, by: k.name });
    world.give(k);
    return;
  }
  const block = SP.header.lineFx[world.tactics[1 - team].line] ?? 0; // a deep block crowds its own box (a high line leaves room)
  const win = SP.header.base * setPieceLevel(world, 1 - team) + r.headerBonus + spBonus(world, team) + delivery + ((head(a) - (d ? dfn(d) : 40)) * SP.header.perPoint) + block;
  const g = world.goalOf(team);
  const dir = Math.sign(g.y - H / 2) || -1;
  const across = r.aim ? r.aim.across : 0.5;
  const depth = r.aim ? r.aim.depth : 8;
  a.x = clamp(W / 2 + (across - 0.5) * PITCH.goalW * 2 * (sp.x < W / 2 ? 1 : -1) + rng.range(-1.5, 1.5), 2, W - 2);
  a.y = g.y - dir * (depth + rng.range(-1, 1));
  if (rng.next() < win) {
    // won: a header (or a first-time shot from the edge) at goal, through the engine's own shot and save
    world.event({ type: 'header', team, by: a.name, routine: r.id });
    world.shotKind = r.shot === 'volley' ? 'volley' : 'header';
    world.give(a);
    world.ball.x = a.x; // (the ball meets his head)
    world.ball.y = a.y;
    world.ball.z = 0;
    world.lastPass = { from: taker, to: a, step: world.steps, touches: 1 }; // (the delivery: the taker's assist if it goes in)
    world._shoot(a, r.shot === 'volley' ? 0.2 : 0.45);
    world.shot.setPiece = sp.kind;
    world.shotKind = null;
    return;
  }
  // lost: the defender heads it clear
  if (d) {
    d.x = a.x + rng.range(-0.8, 0.8);
    d.y = a.y + rng.range(-0.8, 0.8);
    world.give(d);
    world.ball.x = d.x;
    world.ball.y = d.y;
    world._clear(d);
  } else world.give(a);
}

// --- direct free kicks ---------------------------------------------------------------------------------------------------
function startDirect(world, team, x, y) {
  const taker = takerFor(world, team, 'fk');
  world.special = { phase: 'setpiece', kind: 'direct', team, x, y, taker, left: SP.pause, start: world.steps };
  world.phase = 'setpiece';
  world.event({ type: 'freeKick', team, by: taker.name, shooting: true });
  taker.tx = taker.x = x;
  taker.ty = taker.y = y;
  const g = world.goalOf(team);
  // the wall: three defenders 9 m towards goal
  const dx = g.x - x;
  const dy = g.y - y;
  const n = Math.hypot(dx, dy) || 1;
  side(world, 1 - team).filter((p) => p.role !== 'GK').slice(0, 3).forEach((p, i) => {
    p.tx = x + (dx / n) * 9 + (-dy / n) * (i - 1) * 0.7;
    p.ty = y + (dy / n) * 9 + (dx / n) * (i - 1) * 0.7;
  });
  world.ball.x = x;
  world.ball.y = y;
  world.ball.z = 0;
}
function takeDirect(world) {
  const sp = world.special;
  const rng = world.rng;
  const { team, taker } = sp;
  world.special = null;
  world.phase = 'play';
  world.give(taker);
  world.ball.x = taker.x;
  world.ball.y = taker.y;
  // Play: your free kick is yours to take (the stick aims, Shoot shoots; the wall stands)
  if (world.mode === 'play' && team === world.team) return;
  // the wall blocks a share (a better taker clears it more often)
  if (rng.next() < SP.freeKick.wall - (taker.stats.shooting - 50) / 500) {
    const wall = side(world, 1 - team).filter((p) => p.role !== 'GK').sort((a, b) => dist(a, taker) - dist(b, taker))[0];
    world.event({ type: 'wall', team: 1 - team, by: wall?.name ?? '' });
    world.release(taker);
    const b = world.ball;
    b.vx = rng.range(-6, 6);
    b.vy = (world.goalOf(team).y > H / 2 ? -1 : 1) * rng.range(2, 6);
    b.vz = 2;
    if (wall) {
      world.lastTouch = wall.team;
      world.lastToucher = wall;
    }
    return;
  }
  world.shotKind = 'freeKick';
  world._shoot(taker, Math.max(0, 0.15 - spBonus(world, team) - SP.freeKick.directSkill * (taker.stats.shooting - 50) / 100));
  world.shot.setPiece = 'freeKick';
  world.shotKind = null;
}

// --- penalties (and the shoot-out's kicks) -----------------------------------------------------------------------------------
// The model (pure): aim ax −1 (left) … +1 (right) across the goal, ay 0 (low) … 1 (high), power 0–1; the keeper's dive −1 /
// 0 / +1 and timing 0–1 (0.5 is perfect). → { goal, save, miss } probabilities that sum to 1.
export function penaltyChance({ ax, ay, power }, { dir, timing }, { shooter = 50, keeper = 50, shooterBonus = 0, keeperBonus = 0 } = {}) {
  // (relative: the taker's shooting against the keeper's keeping — a Premier taker against a Premier keeper is an even contest)
  const s = ((shooter - keeper) / 2) * SP.penalty.skill + shooterBonus;
  const k = ((keeper - shooter) / 2) * SP.penalty.keeper + keeperBonus;
  const over = Math.max(0, Math.abs(ax) - SP.aimEdge) * 2.4 + Math.max(0, ay - SP.aimEdge) * 2.4;
  let miss = clamp(SP.penalty.miss + over * (power > SP.overPower ? 2.2 : 1) + Math.max(0, power - SP.overPower) * 0.5 - s * 0.4, 0.01, 0.95);
  const shotSide = ax < -0.33 ? -1 : ax > 0.33 ? 1 : 0;
  const right = dir === shotSide;
  const timeOff = Math.abs(timing - 0.5);
  let save;
  if (right) save = clamp(0.62 - Math.abs(ax) * 0.32 - ay * 0.12 - (power - 0.6) * 0.3 + k - s * 0.5 - Math.max(0, timeOff - 0.2) * 1.2, 0.03, 0.9);
  else save = clamp(0.02 + k * 0.15 + (shotSide === 0 && dir !== 0 ? 0.04 : 0), 0, 0.3);
  save = Math.min(save, 1 - miss);
  return { goal: Math.max(0, 1 - miss - save), save, miss };
}
const aiKick = (rng) => {
  const r = rng.next();
  const sideK = r < 0.45 ? -1 : r < 0.9 ? 1 : 0;
  return { ax: sideK === 0 ? rng.range(-0.25, 0.25) : sideK * rng.range(0.45, 0.85), ay: rng.range(0.05, 0.7), power: rng.range(0.6, 0.9) };
};
const aiDive = (rng, keeper) => {
  const r = rng.next();
  const jinx = keeper?.god === 'GOD2';
  return { dir: r < 0.45 ? -1 : r < 0.9 ? 1 : 0, timing: 0.5 + rng.range(-0.18, 0.18) * (jinx ? 0.5 : 1), read: jinx ? JINX.blessing.readPen ?? 0.35 : 0 };
};
function startPenalty(world, team, shootout) {
  const taker = shootout ? shootout.taker : takerFor(world, team, 'pen');
  const k = world.keeperOf(1 - team);
  const g = shootout ? { x: W / 2, y: H } : world.goalOf(team); // (the shoot-out at the bottom end: the board sits at the top)
  const dir = Math.sign(g.y - H / 2) || -1;
  const spot = { x: W / 2, y: g.y - dir * PITCH.spotD };
  world.special = { phase: 'setpiece', kind: 'pen', team, taker, keeper: k, goal: g, spot, left: shootout ? SP.shootoutPause : SP.pause, wait: 0, shootout: !!shootout, kick: null, dive: null, start: world.steps };
  if (!shootout) world.phase = 'setpiece';
  if (!shootout) world.event({ type: 'penalty', team, by: taker.name });
  // everyone out of the box (the shoot-out: everyone in the centre circle)
  for (const p of world.players) {
    if (p === taker || p === k) continue;
    if (shootout) {
      p.tx = W / 2 + ((p.i % 11) - 5) * 1.4;
      p.ty = H / 2 + (p.team ? 2 : -2);
    } else if (Math.abs(p.y - g.y) < PITCH.boxD + 2) {
      p.tx = clamp(p.x, 4, W - 4);
      p.ty = g.y - dir * (PITCH.boxD + 3 + (p.i % 3));
    }
  }
  taker.x = taker.tx = spot.x + 0.6;
  taker.y = taker.ty = spot.y - dir * 1.4;
  if (k) {
    k.x = k.tx = W / 2;
    k.y = k.ty = g.y - dir * 0.3;
  }
  world.ball.x = spot.x;
  world.ball.y = spot.y;
  world.ball.z = 0;
  world.ball.vx = world.ball.vy = world.ball.vz = 0;
}
// Who decides this kick by hand: in Play, the human's taker (aim + power) or the human's keeper (dive + timing).
const humanKicks = (world, sp) => world.mode === 'play' && sp.team === world.team;
const humanDives = (world, sp) => world.mode === 'play' && sp.team !== world.team && !!sp.keeper;
export function penaltyInput(world, cmd) {
  const sp = world.special;
  if (!sp || sp.kind !== 'pen' || sp.flight) return;
  if (cmd[0] === 'pen' && humanKicks(world, sp)) sp.kick = { ax: clamp(cmd[1], -1, 1), ay: clamp(cmd[2], 0, 1), power: clamp(cmd[3], 0, 1) };
  if (cmd[0] === 'dive' && humanDives(world, sp)) sp.dive = { dir: Math.sign(cmd[1]), timing: clamp(cmd[2], 0, 1), read: 0 };
}
const WAIT_MAX = 12; // seconds a Play kick / dive waits for the human before the AI takes it
function takePenalty(world) {
  const sp = world.special;
  const rng = world.rng;
  const { taker, keeper } = sp;
  const kick = sp.kick ?? aiKick(rng);
  let dive = sp.dive ?? aiDive(rng, keeper);
  // Jinx in goal reads the taker now and then (her blessing: ~75% shoot-outs won — tuned in m25.test.mjs)
  if (!sp.dive && dive.read && rng.next() < dive.read) dive = { ...dive, dir: kick.ax < -0.33 ? -1 : kick.ax > 0.33 ? 1 : 0 };
  const bonus = { shooter: taker.stats.shooting, keeper: keeper?.stats.keeping ?? 20, shooterBonus: spBonus(world, sp.team) + traitFx(taker, 'pen') + (sp.shootout ? traitFx(taker, 'shootout') : 0), keeperBonus: traitFx(keeper, 'saves') + (keeper?.god === 'GOD2' ? JINX.blessing.penSave ?? 0.08 : 0) };
  const pc = penaltyChance(kick, dive, bonus);
  const r = rng.next();
  let result = r < pc.goal ? 'goal' : r < pc.goal + pc.save ? 'save' : 'miss';
  // (M20b) Jinx in goal: about 1 in 10 that would beat her hits the post (a match penalty; the shoot-out has its own reading)
  if (result === 'goal' && !sp.shootout && keeper?.god === 'GOD2' && keeper.position === 'GK' && rng.next() < JINX.blessing.post) {
    result = 'miss';
    world.event({ type: 'post', team: sp.team, by: taker.name, keeper: keeper.name });
  }
  // the flight: the ball to its spot in the goal (or wide / over), the keeper the way he dived
  const g = sp.goal;
  const dir = Math.sign(g.y - H / 2) || -1;
  const tx = result === 'miss' ? W / 2 + (Math.abs(kick.ax) > 0.6 ? Math.sign(kick.ax || 1) * (PITCH.goalW / 2 + 1.2) : kick.ax * PITCH.goalW * 0.4) : W / 2 + kick.ax * (PITCH.goalW / 2 - 0.4);
  const tz = result === 'miss' && Math.abs(kick.ax) <= 0.6 ? PITCH.goalH + 0.8 : 0.2 + kick.ay * (PITCH.goalH - 0.6);
  sp.flight = { t: 0, dur: 0.45, from: { x: sp.spot.x, y: sp.spot.y }, to: { x: tx, y: g.y + dir * 0.4, z: tz }, result, kick, dive, saveAt: result === 'save' ? 0.75 : null };
  world.event({ type: 'penKick', team: sp.team, by: taker.name, keeper: keeper?.name ?? '', result, shootout: sp.shootout, kick, dive });
}
function flyPenalty(world, dt) {
  const sp = world.special;
  const f = sp.flight;
  f.t += dt / f.dur;
  const u = Math.min(1, f.t);
  const stopAt = f.saveAt ?? 1;
  const v = Math.min(u, stopAt);
  const b = world.ball;
  b.x = f.from.x + (f.to.x - f.from.x) * v;
  b.y = f.from.y + (f.to.y - f.from.y) * v;
  b.z = f.to.z * Math.sin(v * Math.PI * 0.5);
  if (sp.keeper) {
    const kx = W / 2 + f.dive.dir * (PITCH.goalW / 2 - 0.8) * Math.min(1, u * 1.6);
    sp.keeper.x = sp.keeper.tx = kx;
  }
  if (u < 1) return;
  // done: the result
  const team = sp.team;
  world.special = null;
  if (sp.shootout) return shootoutKickDone(world, f.result === 'goal');
  if (f.result === 'goal') {
    world.shot = { team, by: sp.taker, step: world.steps, resolved: true, setPiece: 'penalty' };
    world.lastTouch = team;
    world.lastToucher = sp.taker;
    world._goal(team, { x: b.x, y: b.y, z: b.z });
    return;
  }
  world.phase = 'play';
  if (f.result === 'save' && sp.keeper) {
    world.stats[sp.keeper.team].saves++;
    world.event({ type: 'save', team: sp.keeper.team, by: sp.keeper.name, pen: true });
    world.give(sp.keeper);
    return;
  }
  // wide or over: a goal kick
  world._setRestart('goalkick', 1 - team, W / 2 + (b.x < W / 2 ? -5 : 5), sp.goal.y === 0 ? PITCH.sixD : H - PITCH.sixD);
}

// --- the shoot-out ----------------------------------------------------------------------------------------------------------
export function startShootout(world) {
  const order = (team) => {
    const list = side(world, team);
    const first = takerFor(world, team, 'pen');
    return [first, ...list.filter((p) => p !== first).sort((a, b) => (b.role === 'GK' ? -1 : 0) - (a.role === 'GK' ? -1 : 0) || b.stats.shooting - a.stats.shooting || a.i - b.i)];
  };
  world.pens = { score: [0, 0], taken: [0, 0], kicks: [], order: [order(0), order(1)], next: 0, done: false, winner: null };
  world.phase = 'shootout';
  world.event({ type: 'shootout' });
  nextKick(world);
}
function nextKick(world) {
  const P = world.pens;
  const team = P.next;
  const list = P.order[team];
  const taker = list[P.taken[team] % list.length];
  startPenalty(world, team, { taker });
}
function shootoutKickDone(world, scored) {
  const P = world.pens;
  const team = P.next;
  P.taken[team]++;
  if (scored) P.score[team]++;
  P.kicks.push({ team, scored });
  // decided? (five each, or one can't catch up; then sudden death after equal kicks)
  const [a, b] = P.score;
  const [ta, tb] = P.taken;
  const N = SP.pensEach;
  let over = false;
  if (ta <= N && tb <= N) over = a + (N - ta) < b || b + (N - tb) < a;
  if (!over && ta >= N && tb >= N && ta === tb && a !== b) over = true;
  if (over) {
    P.done = true;
    P.winner = a > b ? 0 : 1;
    world.event({ type: 'shootoutEnd', pens: [a, b], winner: P.winner });
    world.phase = 'fulltime';
    world.event({ type: 'full', score: [...world.score], pens: [a, b] });
    return;
  }
  P.next = 1 - team;
  nextKick(world);
}

// --- the step ----------------------------------------------------------------------------------------------------------------
// While a stoppage, a set piece or the shoot-out has the match: the players walk to their places, the clock is held.
export function stepSpecial(world, dt, move) {
  const sp = world.special;
  if (!sp) return false;
  move(dt);
  if (sp.phase === 'stoppage') {
    sp.left -= dt;
    if (sp.left <= 0) {
      sp.phase = 'setup';
      sp.left = 0;
    }
    return true;
  }
  if (sp.phase === 'setup') {
    setUp(world);
    return true;
  }
  // a set piece waiting to be taken
  if (sp.kind === 'pen') {
    if (sp.flight) {
      flyPenalty(world, dt);
      return true;
    }
    const waiting = (humanKicks(world, sp) && !sp.kick) || (humanDives(world, sp) && !sp.dive);
    if (waiting && sp.wait < WAIT_MAX) {
      sp.wait += dt;
      return true;
    }
    sp.left -= dt;
    if (sp.left <= 0) takePenalty(world);
    return true;
  }
  sp.left -= dt;
  if (sp.left > 0) return true;
  if (sp.kind === 'direct') takeDirect(world);
  else takeCross(world);
  return false;
}
// Is the human being asked for a penalty input right now? → 'kick' | 'dive' | null (the screen shows the aim / dive bar)
export function penaltyPrompt(world) {
  const sp = world.special;
  if (!sp || sp.kind !== 'pen' || sp.flight) return null;
  if (humanKicks(world, sp) && !sp.kick) return 'kick';
  if (humanDives(world, sp) && !sp.dive) return 'dive';
  return null;
}
export { SUBS };

// (?debug=1 / browser tests only) a card or a knock now, for a player on the pitch: kind 'yellow' | 'red' | 'injury'.
// Normal play never calls it.
export function forceIncident(world, kind, p) {
  if (!world.players.includes(p)) return false;
  if (kind === 'red') sendOff(world, p, true);
  else if (kind === 'yellow') card(world, p, false, false);
  else if (kind === 'injury') {
    injure(world, p, 'a foul');
    stopForInjury(world);
  }
  return true;
}
