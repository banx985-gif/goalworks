// Zone AI for the match (Milestone 3, bible §16): every player holds a zone from the 4-4-2 that slides with the ball;
// the nearest one or two of each side go for a loose ball or press the carrier. No pathfinding — players steer straight
// at their target and push apart as simple circles. Decisions are staggered: a player re-thinks its support run every
// TUNING.decideEvery seconds (offset by shirt number), the ball carrier every ownerDecideEvery; the team's chasers are
// re-picked every few steps. Actions (pass, shoot, tackle, keeper save) succeed from simple stat + pressure numbers.
// Everything random comes from world.rng, in a fixed order, so the match is the same every time for the same seed.
import { PITCH, MATCH_TIME } from '../../data/match.js';
import { predictBall, rollDistance, ballSpeed } from './ballPhysics.js';

const W = PITCH.w;
const H = PITCH.h;
const DT = MATCH_TIME.step;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DECIDE_STEPS = (T) => Math.max(1, Math.round(T.decideEvery / DT));
const OWNER_STEPS = (T) => Math.max(1, Math.round(T.ownerDecideEvery / DT));
const ROLE_A = { DF: [38, 97], MF: [20, 90], FW: [6, 72] }; // how far up / back each line may slide (team frame)

export const speedOf = (p, T) => T.speed.base + (T.speed.pace * p.stats.pace) / 100;

// Opponents close to p: 0 (free) … ~2+ (swarmed).
export function pressureOn(world, p) {
  const R = world.T.pressure.radius;
  let s = 0;
  for (const o of world.players) {
    if (o.team === p.team) continue;
    const d = dist(o, p);
    if (d < R) s += 1 - d / R;
  }
  return s;
}

// --- the zone: where a player stands when nothing else calls ---------------------------------------------------------
function anchor(world, p) {
  const T = world.T;
  const ball = world.ball;
  const own = world.owner ? world.owner.team === p.team : world.lastTouch === p.team;
  if (p.role === 'GK') return keeperSpot(world, p);
  const ballA = world.aOf(p.team, ball.y);
  let a = p.fy * H + (ballA - 58) * T.shape.followY;
  if (own) a -= T.shape.depth * T.shape.attackPush * (p.role === 'DF' ? 0.6 : 1);
  const [lo, hi] = ROLE_A[p.role];
  a = clamp(a + p.offA, lo, hi);
  const bx = world.dir(p.team) < 0 ? ball.x : W - ball.x; // ball across, in the team's view
  const fx = clamp((p.fx * W + (bx - W / 2) * T.shape.shiftX + p.offX) / W, 0.04, 0.96);
  return world.toWorld(p.team, fx, a);
}

// The keeper stands on the line from the goal to the ball, a few metres out.
function keeperSpot(world, p) {
  const g = world.ownGoal(p.team);
  const b = world.ball;
  const d = Math.max(0.01, dist(g, b));
  const out = clamp(d * 0.12, 1.2, 5.5);
  return { x: g.x + ((b.x - g.x) / d) * out, y: g.y + ((b.y - g.y) / d) * out };
}

// Where a player can meet the rolling ball soonest (cheap: a few look-ahead points).
function meetBall(world, p) {
  const T = world.T;
  const v = speedOf(p, T);
  for (let t = 0; t <= 2.4; t += 0.2) {
    const q = predictBall(world.ball, t, T.ball);
    if (dist(p, q) / v <= t + 0.1) return q;
  }
  return predictBall(world.ball, 2.4, T.ball);
}

// --- thinking (called every step; the expensive parts are staggered) -------------------------------------------------
export function think(world) {
  const T = world.T;
  const rng = world.rng;
  const s = world.steps;

  if (world.phase === 'goal') {
    // walk back towards the kickoff shape
    for (const p of world.players) {
      const a = p.role === 'GK' ? H - 1.5 : Math.max(p.fy * H, H / 2 + 2);
      const w = world.toWorld(p.team, p.fx, a);
      p.mode = 'shape';
      p.tx = w.x;
      p.ty = w.y;
    }
    return;
  }

  // Chasers: each side's nearest outfield players to the ball (every 6 steps).
  if (s % 6 === 0 || world.restartGo) pickChasers(world);

  // The restart taker plays at once when the pause ends.
  if (world.restartGo && world.owner) {
    world.restartGo = false;
    ownerDecide(world, world.owner, world.restart?.type ?? null);
    world.restart = null;
  }

  const N = DECIDE_STEPS(T);
  for (const p of world.players) {
    if (p === world.owner) continue;
    // Support runs: a new offset now and then (staggered by index).
    if ((s + p.i * 5) % N === 0) {
      const own = world.owner ? world.owner.team === p.team : false;
      if (own && p.role !== 'GK') {
        const run = p.role === 'FW' ? 10 : p.role === 'MF' ? 6 : 2;
        p.offA = -rng.range(0, run);
        p.offX = rng.range(-5, 5);
      } else {
        p.offA = 0;
        p.offX = rng.range(-2, 2);
      }
    }
    // Tackling: a presser in reach has a go now and then.
    if (p.mode === 'press' && world.owner && world.owner.team !== p.team && p.cool <= 0 && world.phase === 'play' && (s + p.i) % 9 === 0) {
      if (dist(p, world.owner) < T.tackle.reach) tackle(world, p, world.owner);
    }
    target(world, p);
  }

  // The ball carrier decides every ownerDecideEvery (after a short first touch).
  const o = world.owner;
  if (o && world.phase === 'play') {
    const held = s - world.ownerSince;
    const M = OWNER_STEPS(T);
    if (held >= 8 && held % M === 0) ownerDecide(world, o, null);
  }
}

function pickChasers(world) {
  const T = world.T;
  const ball = world.ball;
  for (const team of [0, 1]) {
    const list = [];
    for (const p of world.players) if (p.team === team && p.role !== 'GK' && p !== world.owner) list.push({ p, d: dist(p, ball) });
    list.sort((a, b) => a.d - b.d || a.p.i - b.p.i);
    world.chasers[team] = list.slice(0, T.chasers).map((e) => e.p);
  }
}

// Where each non-carrier heads this step.
function target(world, p) {
  const ball = world.ball;
  const owner = world.owner;
  if (p.role === 'GK') {
    p.mode = 'keeper';
    const k = keeperSpot(world, p);
    // a loose ball in its own box: go and claim it
    if (!owner && inOwnBox(world, p, ball) && ball.z < 2.4) {
      const q = meetBall(world, p);
      p.tx = q.x;
      p.ty = q.y;
      return;
    }
    if (!world.shot || world.shot.resolved) {
      p.tx = k.x;
      p.ty = k.y;
    }
    return;
  }
  if (world.phase === 'restart') {
    // everybody takes up their zone; the takers' opponents keep 5 m off
    const a = anchor(world, p);
    p.mode = 'shape';
    p.tx = a.x;
    p.ty = a.y;
    if (world.restart && world.restart.team !== p.team && dist(a, ball) < 6) {
      const d = Math.max(0.01, dist(a, ball));
      p.tx = ball.x + ((a.x - ball.x) / d) * 6;
      p.ty = ball.y + ((a.y - ball.y) / d) * 6;
    }
    return;
  }
  const chasers = world.chasers[p.team];
  const rank = chasers.indexOf(p);
  const intended = world.pass && world.pass.to === p;
  if (!owner) {
    if (intended || rank === 0 || (rank === 1 && world.lastTouch !== p.team)) {
      p.mode = 'ball';
      const q = meetBall(world, p);
      p.tx = q.x;
      p.ty = q.y;
      return;
    }
  } else if (owner.team !== p.team) {
    if (rank === 0) {
      p.mode = 'press';
      p.tx = owner.x + owner.vx * 0.25;
      p.ty = owner.y + owner.vy * 0.25;
      return;
    }
    if (rank === 1) {
      p.mode = 'cover';
      const g = world.ownGoal(p.team);
      const d = Math.max(0.01, dist(g, owner));
      p.tx = owner.x + ((g.x - owner.x) / d) * 5;
      p.ty = owner.y + ((g.y - owner.y) / d) * 5;
      return;
    }
  }
  p.mode = 'shape';
  const a = anchor(world, p);
  p.tx = a.x;
  p.ty = a.y;
}

const inOwnBox = (world, p, b) => {
  const g = world.ownGoal(p.team);
  return Math.abs(b.x - W / 2) < PITCH.boxW / 2 && Math.abs(b.y - g.y) < PITCH.boxD;
};

// --- moving ------------------------------------------------------------------------------------------------------------
export function movePlayers(world, dt) {
  const T = world.T;
  for (const p of world.players) {
    if (p === world.owner) continue;
    steer(p, p.tx, p.ty, speedOf(p, T) * (p.cool > 0.4 && p.mode === 'press' ? 0.5 : 1), T.accel, dt);
  }
  separate(world);
}

function steer(p, tx, ty, vmax, accel, dt) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  let dvx = 0;
  let dvy = 0;
  if (d > 0.05) {
    const v = Math.min(vmax, d * 2.2); // ease in over the last couple of metres
    dvx = (dx / d) * v;
    dvy = (dy / d) * v;
  }
  const ax = dvx - p.vx;
  const ay = dvy - p.vy;
  const a = Math.hypot(ax, ay);
  const lim = accel * dt;
  const k = a > lim ? lim / a : 1;
  p.vx += ax * k;
  p.vy += ay * k;
  p.x = clamp(p.x + p.vx * dt, -1.5, W + 1.5);
  p.y = clamp(p.y + p.vy * dt, -1.5, H + 1.5);
  if (Math.abs(p.vx) > 0.3) p.face = p.vx > 0 ? 1 : -1;
}

// Simple circles: players never stand inside each other.
function separate(world) {
  const R2 = world.T.playerR * 2;
  const ps = world.players;
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R2 * R2 || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (R2 - d) / 2;
      const ux = dx / d;
      const uy = dy / d;
      const wa = a === world.owner ? 0.3 : 1;
      const wb = b === world.owner ? 0.3 : 1;
      a.x -= ux * push * wa;
      a.y -= uy * push * wa;
      b.x += ux * push * wb;
      b.y += uy * push * wb;
    }
}

// The carrier runs with the ball at their feet (hold: standing over a restart).
export function moveOwner(world, dt, hold) {
  const T = world.T;
  const p = world.owner;
  if (hold) {
    p.vx = p.vy = 0;
  } else {
    if (p.dribble == null) p.dribble = dribbleTarget(world, p);
    steer(p, p.dribble.x, p.dribble.y, speedOf(p, T) * T.dribble.speedFactor, T.accel, dt);
    p.x = clamp(p.x, 0.6, W - 0.6);
    p.y = clamp(p.y, 0.6, H - 0.6);
  }
  const v = Math.hypot(p.vx, p.vy);
  const ux = v > 0.2 ? p.vx / v : 0;
  const uy = v > 0.2 ? p.vy / v : -world.dir(p.team);
  const b = world.ball;
  b.x = clamp(p.x + ux * T.dribble.ahead, 0.2, W - 0.2);
  b.y = clamp(p.y + uy * T.dribble.ahead, 0.2, H - 0.2);
  b.z = 0;
  b.vx = p.vx;
  b.vy = p.vy;
  b.vz = 0;
}

// Run at goal, bending away from the nearest defender in front.
function dribbleTarget(world, p) {
  const g = world.goalOf(p.team);
  const d = Math.max(0.01, dist(g, p));
  let ux = (g.x - p.x) / d;
  let uy = (g.y - p.y) / d;
  let near = null;
  let nd = 8;
  for (const o of world.players) {
    if (o.team === p.team) continue;
    const od = dist(o, p);
    const ahead = (o.x - p.x) * ux + (o.y - p.y) * uy;
    if (ahead > 0 && od < nd) {
      nd = od;
      near = o;
    }
  }
  if (near) {
    const side = (near.x - p.x) * uy - (near.y - p.y) * ux > 0 ? 1 : -1; // which side of our line they stand
    const px = uy * side;
    const py = -ux * side;
    ux += px * 0.8;
    uy += py * 0.8;
    const n = Math.hypot(ux, uy);
    ux /= n;
    uy /= n;
  }
  return { x: clamp(p.x + ux * 7, 2, W - 2), y: clamp(p.y + uy * 7, 1, H - 1) };
}

// --- the carrier's choice: shoot, pass or run -----------------------------------------------------------------------
function ownerDecide(world, p, restartType) {
  const T = world.T;
  const rng = world.rng;
  const g = world.goalOf(p.team);
  const dG = dist(p, g);
  const press = pressureOn(world, p);
  p.dribble = null;

  // Shoot?
  let best = { kind: 'dribble', score: -Infinity };
  if (!restartType && p.role !== 'GK' && dG < T.shot.range) {
    const angle = Math.abs(p.x - W / 2) / Math.max(1, Math.abs(p.y - g.y)); // wide angles are poor
    let sc = Math.pow(1 - dG / T.shot.range, 1.1) * 1.35 + T.shot.eager + (dG < 12 ? T.shot.closeBonus : 0) - press * 0.12 - Math.max(0, angle - 0.9) * 0.6;
    sc += rng.range(-0.15, 0.15);
    best = { kind: 'shoot', score: sc };
  }
  // Run with it?
  if (!restartType && p.role !== 'GK') {
    let space = 10;
    for (const o of world.players) if (o.team !== p.team) space = Math.min(space, dist(o, p));
    const sc = 0.3 + (space / 10) * 0.45 - press * 0.25 + (p.role === 'FW' || p.role === 'MF' ? 0.05 : -0.1) + rng.range(-0.12, 0.12);
    if (sc > best.score) best = { kind: 'dribble', score: sc };
  }
  // Pass? (every team-mate, scored on progress, how free they are and how clear the lane is)
  const myA = world.aOf(p.team, p.y);
  for (const q of world.players) {
    if (q.team !== p.team || q === p) continue;
    const d = dist(p, q);
    if (d < 4 || d > 45) continue;
    if (q.role === 'GK' && (restartType || rng.next() < 0.8)) continue;
    const progress = (myA - world.aOf(q.team, q.y)) / 25;
    let free = 8;
    let lane = 5;
    for (const o of world.players) {
      if (o.team === p.team) continue;
      free = Math.min(free, dist(o, q));
      lane = Math.min(lane, segDist(o, p, q));
    }
    let sc = 0.45 * progress + 0.5 * (free / 8) + 0.35 * (lane / 5) - d / 90 + rng.range(-0.18, 0.18);
    if (restartType === 'corner') sc += inBoxOf(world, p.team, q) ? 1 : -1;
    if (restartType === 'goalkick') sc += q.role === 'MF' || q.role === 'FW' ? 0.4 : 0;
    if (restartType === 'kickoff') sc += progress < 0 ? 0.6 : -0.6;
    if (sc > best.score) best = { kind: 'pass', score: sc, to: q, lane, d };
  }
  // Under real pressure a keeper or defender clears it long instead of running.
  if (best.kind === 'dribble' && (p.role === 'GK' || restartType)) best.kind = 'pass';

  if (best.kind === 'shoot') return shoot(world, p, press);
  if (best.kind === 'pass' && best.to) return pass(world, p, best.to, press, best.lane < 1.5 || best.d > T.pass.loftOver || restartType === 'corner' || restartType === 'goalkick');
  if (best.kind === 'pass') return clear(world, p);
  p.dribble = dribbleTarget(world, p);
}

const inBoxOf = (world, team, q) => {
  const g = world.goalOf(team);
  return Math.abs(q.x - W / 2) < PITCH.boxW / 2 && Math.abs(q.y - g.y) < PITCH.boxD;
};

// Distance from point o to segment a–b.
function segDist(o, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = dx * dx + dy * dy || 1;
  const t = clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / L, 0, 1);
  return Math.hypot(o.x - (a.x + dx * t), o.y - (a.y + dy * t));
}

// A small random angle: skill and pressure widen it.
function aimError(world, baseDeg, skill, press) {
  const r = world.rng.next() + world.rng.next() - 1; // −1 … 1, peaked at 0
  return ((baseDeg * (1.5 - skill / 100) * (1 + press * 0.5)) * Math.PI) / 180 * r;
}

function kick(world, p, dx, dy, speed, vz, err) {
  const d = Math.max(0.01, Math.hypot(dx, dy));
  const c = Math.cos(err);
  const s = Math.sin(err);
  const ux = (dx / d) * c - (dy / d) * s;
  const uy = (dx / d) * s + (dy / d) * c;
  world.release(p);
  const b = world.ball;
  b.vx = ux * speed;
  b.vy = uy * speed;
  b.vz = vz;
  b.z = vz > 0 ? 0.05 : 0;
}

function pass(world, p, q, press, lofted) {
  const T = world.T;
  const P = T.pass;
  // lead the receiver a little
  const lead = 0.35;
  const tx = q.x + q.vx * lead;
  const ty = q.y + q.vy * lead;
  const d = Math.hypot(tx - p.x, ty - p.y);
  const err = aimError(world, P.errDeg, p.stats.passing, press);
  world.stats[p.team].passes++;
  if (lofted && world.rng.next() < P.loftChance + (d > P.loftOver ? 0.3 : 0)) {
    const flight = 0.7 + d / 28;
    kick(world, p, tx - p.x, ty - p.y, (d / flight) * 1.02, (T.ball.gravity * flight) / 2, err);
  } else {
    // enough pace to arrive still rolling at ~5 m/s
    let v = P.minSpeed;
    while (v < P.maxSpeed && rollDistance(v, T.ball) < d + 6) v += 1;
    kick(world, p, tx - p.x, ty - p.y, v, 0, err);
  }
  world.pass = { from: p, to: q, team: p.team };
}

// Nobody on: hoof it up the pitch.
function clear(world, p) {
  const T = world.T;
  const g = world.goalOf(p.team);
  world.stats[p.team].passes++;
  const tx = W / 2 + world.rng.range(-18, 18);
  const ty = p.y + (g.y - p.y) * 0.5;
  const d = Math.hypot(tx - p.x, ty - p.y);
  const flight = 0.8 + d / 26;
  kick(world, p, tx - p.x, ty - p.y, d / flight, (T.ball.gravity * flight) / 2, aimError(world, 12, p.stats.passing, 0));
}

function shoot(world, p, press) {
  const T = world.T;
  const S = T.shot;
  const rng = world.rng;
  const g = world.goalOf(p.team);
  const d = dist(p, g);
  // aim for a spot inside the posts, low or high
  const tx = g.x + rng.range(-PITCH.goalW / 2 + 0.5, PITCH.goalW / 2 - 0.5);
  const h = rng.range(0.1, PITCH.goalH - 0.3);
  const speed = S.speed * rng.range(0.85, 1.12);
  const err = aimError(world, S.errDeg + d * S.errPerM, p.stats.shooting, press);
  const t = d / speed;
  const vz = Math.max(0, (h + 0.5 * T.ball.gravity * t * t) / t);
  kick(world, p, tx - p.x, g.y - p.y, speed, vz, err);
  world.stats[p.team].shots++;
  world.shot = { team: p.team, by: p, step: world.steps, resolved: false };
  // on target? (where it would cross the line, ignoring the keeper)
  const b = world.ball;
  const tt = (g.y - b.y) / (b.vy || 1e-6);
  const cx = b.x + b.vx * tt;
  const cz = b.z + b.vz * tt - 0.5 * T.ball.gravity * tt * tt;
  const on = tt > 0 && Math.abs(cx - W / 2) < PITCH.goalW / 2 && cz < PITCH.goalH;
  world.shot.onTarget = on;
  if (on) world.stats[p.team].onTarget++;
  world.event({ type: 'shot', team: p.team, by: p.name, onTarget: on });
}

function tackle(world, p, owner) {
  const T = world.T;
  const rng = world.rng;
  world.stats[p.team].tackles++;
  const chance = T.tackle.base + (p.stats.tackling - owner.stats.dribbling) / 200;
  if (rng.next() < chance) {
    world.stats[p.team].tacklesWon++;
    // the ball squirts loose; the tackler usually comes away with it
    world.release(owner);
    owner.cool = 0.6;
    const b = world.ball;
    const ang = rng.range(0, Math.PI * 2);
    const sp = rng.range(2, 5);
    b.vx = Math.cos(ang) * sp + (p.x - owner.x) * 0.8;
    b.vy = Math.sin(ang) * sp + (p.y - owner.y) * 0.8;
    b.vz = 0;
    world.lastTouch = p.team;
    world.lastToucher = p;
    p.cool = 0;
  } else {
    p.cool = T.tackle.cooldown;
  }
}

// --- the keeper, and taking a loose ball -------------------------------------------------------------------------------
export function keeperStep(world, dt) {
  const T = world.T;
  const K = T.keeper;
  const shot = world.shot;
  const b = world.ball;
  if (!shot || shot.resolved || world.owner) return;
  const k = world.keeperOf(1 - shot.team);
  const since = (world.steps - shot.step) * DT;
  // dive towards where the ball will cross the keeper's line
  if (since > K.react && Math.abs(b.vy) > 1) {
    const tt = (k.y - b.y) / b.vy;
    if (tt > 0) {
      const cx = clamp(b.x + b.vx * tt, W / 2 - PITCH.goalW / 2 - 1, W / 2 + PITCH.goalW / 2 + 1);
      const dx = cx - k.x;
      const step = K.dive * (1 + (k.stats.keeping - 50) / 200) * dt;
      k.x += clamp(dx, -step, step);
      k.tx = k.x;
    }
  }
  const d = Math.hypot(b.x - k.x, b.y - k.y);
  if (d < K.reach && b.z < 2.6) {
    shot.resolved = true;
    const sp = ballSpeed(b);
    const p = K.save + (k.stats.keeping - 50) / 200 - Math.max(0, (sp - 22) / 40) + (1 - d / K.reach) * 0.2 - (b.z > 1.8 ? 0.12 : 0);
    if (world.rng.next() < p) {
      world.stats[k.team].saves++;
      world.event({ type: 'save', team: k.team, by: k.name });
      if (world.rng.next() < K.hold) {
        world.give(k);
      } else {
        // parried away
        b.vx = world.rng.range(-7, 7);
        b.vy = -b.vy * 0.3;
        b.vz = 2.5;
        world.lastTouch = k.team;
        world.lastToucher = k;
        k.cool = 0.5;
      }
    } else k.cool = 0.5; // beaten: can't grab it on the way past
  }
}

export function tryControl(world) {
  const T = world.T;
  const b = world.ball;
  let best = null;
  let bd = Infinity;
  for (const p of world.players) {
    if (p.cool > 0) continue;
    const keeperBox = p.role === 'GK' && inOwnBox(world, p, b);
    const reach = keeperBox ? 1.4 : T.controlR;
    const hMax = keeperBox ? 2.5 : T.controlH;
    if (b.z > hMax) continue;
    const d = Math.hypot(b.x - p.x, b.y - p.y);
    if (d < reach && d < bd) {
      bd = d;
      best = p;
    }
  }
  if (!best) return;
  // A shot on the way in: the keeper's save is rolled in keeperStep, never a free catch here.
  if (world.shot && !world.shot.resolved && best.role === 'GK' && best.team !== world.shot.team) return;
  // (defenders may still block it)
  if (world.shot && !world.shot.resolved && best.team === world.shot.team && best !== world.shot.by) return;
  if (world.shot && !world.shot.resolved && best === world.shot.by) return;
  // A hard ball is sometimes miscontrolled.
  const sp = ballSpeed(b);
  if (best.role !== 'GK' && sp > 15 && world.rng.next() < 0.3) {
    b.vx *= -0.35;
    b.vy *= -0.35;
    world.lastTouch = best.team;
    world.lastToucher = best;
    best.cool = 0.25;
    if (world.shot) world.shot.resolved = true;
    return;
  }
  if (world.shot && !world.shot.resolved && best.role !== 'GK') world.event({ type: 'block', team: best.team, by: best.name });
  world.give(best);
}
