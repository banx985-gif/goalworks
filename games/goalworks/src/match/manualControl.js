// Play mode (Milestone 4, bible §17): the human controls one player of their team, Whole Team style — the ball carrier
// while the team has the ball (and the receiver of its pass while the ball is on its way), the nearest outfield player
// to the ball when it doesn't; Switch moves to the next one. The keeper stays AI (keeper Rush is later).
// The stick and buttons choose *what* and *where*; how well it comes off is the M3 engine's own pass() / shoot() /
// tackle() from the player's stats and the pressure on them (bible §16), so a weak player stays weak by hand.
//
// Input is part of the seeded simulation: the screen (or a test's auto player) calls control.input(frame) before each
// world.step(); every change of frame is logged against the step it applies to. The save holds that log, so a reload
// replays the same match exactly (restoreMatchWorld), and nothing here reads real time.
//   createControl(world, { team = 0, inputs = [] }) → control     (matchWorld does this for a Play match)
//   control.input({ mx, my, btn })   mx, my: the stick, −1 … 1 in pitch directions (x right, y down the screen)
//                                    btn: BTN bits held now (Pass, Shoot/Tackle, Sprint, Switch)
//   control.player — who is controlled   control.stamina 0 … 1   control.passHold — steps Pass has been held
//   control.last — { kind, ok, step } the latest action, for the screen   control.serialize() → { team, inputs }
import { PITCH, MATCH_TIME } from '../../data/match.js';
import { speedOf, pressureOn, steerVel, pass, shoot, tackle } from './matchAI.js';

export const BTN = { pass: 1, action: 2, sprint: 4, switch: 8 }; // action = Shoot with the ball, Tackle without
const Q = 16; // the stick is logged in 1/16ths
const W = PITCH.w;
const H = PITCH.h;
const DT = MATCH_TIME.step;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createControl(world, { team = 0, inputs = [] } = {}) {
  const T = world.T;
  const C = T.control;
  const log = inputs.map((e) => e.slice()); // [[step, qx, qy, btn]] — each change, from the step it applies
  let cursor = 0;
  let mx = 0;
  let my = 0;
  let btn = 0;
  let prevBtn = 0;
  let lastOwner = undefined;
  let pending = null; // an early Pass / Shoot waiting for the first touch: { kind, loft, p, until } (only for that player)
  let exhausted = false;

  const ctl = {
    team,
    player: null,
    stamina: 1,
    sprinting: false,
    passHold: 0,
    last: null,
    get stick() {
      return { x: mx, y: my };
    },
    get buttons() {
      return btn;
    },

    // The screen / auto player: this step's stick and buttons (logged only when they change).
    input(frame) {
      let x = clamp(frame.mx ?? 0, -1, 1);
      let y = clamp(frame.my ?? 0, -1, 1);
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      const qx = Math.round(x * Q);
      const qy = Math.round(y * Q);
      const b = (frame.btn ?? 0) & 15;
      const s = world.steps + 1; // the step this input applies to
      const tail = log[log.length - 1];
      if (tail && tail[1] === qx && tail[2] === qy && tail[3] === b) return;
      if (tail && tail[0] === s) {
        tail[1] = qx;
        tail[2] = qy;
        tail[3] = b;
      } else log.push([s, qx, qy, b]);
    },

    // Called by world.step() every step, before the AI thinks.
    pre() {
      const s = world.steps;
      while (cursor < log.length && log[cursor][0] <= s) {
        const e = log[cursor++];
        mx = e[1] / Q;
        my = e[2] / Q;
        btn = e[3];
      }
      const pressed = btn & ~prevBtn;
      const released = prevBtn & ~btn;
      prevBtn = btn;
      choose(pressed);
      const p = ctl.player;
      const play = world.phase === 'play';

      if (play && p) {
        if (released & BTN.pass) queue({ kind: 'pass', loft: ctl.passHold >= C.holdSteps, p });
        if (pressed & BTN.action) {
          if (world.owner === p) queue({ kind: 'shoot', p });
          else tryTackle(p);
        }
        if (pending && (s > pending.until || pending.p !== p)) pending = null;
        if (pending && world.owner === p && s - world.ownerSince >= C.firstTouch) {
          const a = pending;
          pending = null;
          if (a.kind === 'pass') doPass(p, a.loft);
          else doShoot(p);
        }
        if (world.owner !== p) choose(0); // the ball has gone: control follows it now (to the receiver of a pass)
      } else pending = null;
      ctl.passHold = btn & BTN.pass ? ctl.passHold + 1 : 0;

      // Sprint: a bar that drains while sprinting and refills otherwise; once empty it must refill a little first.
      const moving = Math.hypot(mx, my) >= C.dead;
      ctl.sprinting = !!(btn & BTN.sprint) && moving && play && !!p && !exhausted;
      if (ctl.sprinting) {
        ctl.stamina -= C.drain * DT;
        if (ctl.stamina <= 0) {
          ctl.stamina = 0;
          exhausted = true;
          ctl.sprinting = false;
        }
      } else {
        ctl.stamina = Math.min(1, ctl.stamina + C.refill * DT);
        if (exhausted && ctl.stamina >= C.recover) exhausted = false;
      }
    },

    // Movement for the controlled player (matchAI calls this). false = let the AI move them this step.
    drive(w, p, dt, withBall) {
      if (world.phase !== 'play') return false;
      if (!withBall && world.pass && world.pass.to === p) return false; // our pass on its way to them: the AI meets it
      const m = Math.hypot(mx, my);
      if (m < C.dead) {
        if (!withBall) return false; // stick at rest: the AI keeps them in the game
        steerVel(p, 0, 0, T.accel, dt); // the carrier stands on the ball
        return true;
      }
      const v = speedOf(p, T) * Math.min(1, m) * (withBall ? T.dribble.speedFactor : 1) * (ctl.sprinting ? C.sprint : 1) * (p.cool > 0.4 ? 0.5 : 1);
      steerVel(p, (mx / m) * v, (my / m) * v, T.accel, dt);
      return true;
    },

    serialize() {
      return { team, inputs: log.map((e) => e.slice()) };
    },
  };

  // --- who is controlled ----------------------------------------------------------------------------------------------
  const outfield = () => world.players.filter((q) => q.team === team && q.role !== 'GK');
  const byBall = () =>
    outfield()
      .map((q) => ({ q, d: dist(q, world.ball) }))
      .sort((a, b) => a.d - b.d || a.q.i - b.q.i)
      .map((e) => e.q);

  function choose(pressed) {
    const o = world.owner;
    let p = ctl.player;
    const ours = o && o.team === team;
    if (ours && o.role !== 'GK') p = o; // the ball carrier
    else if (world.pass && world.pass.team === team && world.pass.to && world.pass.to.role !== 'GK') p = world.pass.to; // our pass on its way
    else if (o !== lastOwner && !ours) p = byBall()[0]; // they won it, or it came loose: the nearest to the ball
    else if (pressed & BTN.switch && world.phase === 'play') {
      // the next best: the next one along from the current player, nearest the ball first
      const list = byBall();
      const at = list.indexOf(p);
      p = list[(at + 1) % list.length];
    }
    if (!p || p.role === 'GK') p = byBall()[0];
    lastOwner = o;
    if (p !== ctl.player) {
      if (ctl.player) ctl.player.manual = false;
      ctl.player = p;
    }
    p.manual = true;
  }

  // --- actions: the human picks, the stats decide ------------------------------------------------------------------------
  function queue(a) {
    pending = { ...a, until: world.steps + C.buffer };
  }

  // The direction the player means: the stick, else the way they are running, else at goal.
  function aimDir(p) {
    let dx = mx;
    let dy = my;
    if (Math.hypot(dx, dy) < C.dead) {
      if (Math.hypot(p.vx, p.vy) > 0.5) {
        dx = p.vx;
        dy = p.vy;
      } else {
        const g = world.goalOf(team);
        dx = g.x - p.x;
        dy = g.y - p.y;
      }
    }
    const n = Math.hypot(dx, dy) || 1;
    return { x: dx / n, y: dy / n };
  }

  function doPass(p, loft) {
    const u = aimDir(p);
    const cone = (C.coneDeg * Math.PI) / 180;
    let best = null;
    let bc = Infinity;
    for (const q of world.players) {
      if (q.team !== team || q === p) continue;
      const d = dist(p, q);
      if (d < 3 || d > 60) continue;
      const ang = Math.acos(clamp(((q.x - p.x) * u.x + (q.y - p.y) * u.y) / d, -1, 1));
      const cost = ang * 2.5 + d / 50 + (ang > cone ? 10 : 0);
      if (cost < bc) {
        bc = cost;
        best = q;
      }
    }
    if (!best) return;
    const press = pressureOn(world, p);
    if (loft) {
      // a through ball / cross: lofted into the space ahead of the receiver (less lead close to goal)
      const lead = clamp(world.aOf(team, best.y) - 8, 0, C.throughLead);
      const tx = clamp(best.x + best.vx * 0.35, 1, W - 1);
      const ty = clamp(best.y + world.dir(team) * lead, 1, H - 1);
      pass(world, p, best, press, true, { loft: true, tx, ty });
    } else pass(world, p, best, press, false, { loft: false });
    ctl.last = { kind: loft ? 'through' : 'pass', ok: true, step: world.steps };
  }

  function doShoot(p) {
    const k = world.keeperOf(1 - team);
    const half = PITCH.goalW / 2 - 0.55;
    // the stick across picks the side; with no aim, the corner away from the keeper
    const ax = Math.abs(mx) >= 0.25 ? Math.sign(mx) * Math.min(1, Math.abs(mx) / 0.7) : k.x > W / 2 ? -1 : 1;
    shoot(world, p, pressureOn(world, p), { x: W / 2 + ax * half, h: C.shotH });
    ctl.last = { kind: 'shoot', ok: true, step: world.steps };
  }

  function tryTackle(p) {
    const o = world.owner;
    if (!o || o.team === team || p.cool > 0) return;
    if (dist(p, o) <= T.tackle.reach) {
      const won = tackle(world, p, o);
      ctl.last = { kind: 'tackle', ok: won, step: world.steps };
    } else {
      p.cool = C.missCool; // a lunge at nothing
      ctl.last = { kind: 'tackle', ok: false, step: world.steps };
    }
  }

  return ctl;
}
