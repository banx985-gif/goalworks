// The match world (Milestone 3, bible §16): one pitch, 22 players, one ball, the score and the match clock. A pure,
// seeded simulation: step() always advances exactly one TIME.step of match time, and every random choice comes from the
// match's own Rng, so the same setup + the same number of steps gives exactly the same match. That is how a reload
// resumes a match: the save holds { setup, steps } and restore() replays the steps headlessly.
//   createMatchWorld(setup) → world        setup: lineups.js createMatchSetup()
//   world.step()   world.run(n)   world.done   world.minute   world.serialize() → { setup, steps }
//   restoreMatchWorld(saved) → a world at exactly the saved step
// Phases: 'restart' (kickoff / throw-in / goal kick / corner — a quick placement, then the taker plays), 'play',
// 'goal' (the celebration pause before the kickoff), 'halftime', 'fulltime'.
// Teams: 0 = home, 1 = away. Home attacks up the screen (towards y = 0) in the first half; sides swap at half time.
import { Rng } from '../../../../core/Rng.js';
import { PITCH, MATCH_TIME, FORMATION_442, TUNING } from '../../data/match.js';
import { createBall, stopBall, stepBall, crossing } from './ballPhysics.js';
import { think, moveOwner, movePlayers, keeperStep, tryControl } from './matchAI.js';

const W = PITCH.w;
const H = PITCH.h;

export function createMatchWorld(setup) {
  const rng = new Rng(`${setup.seed}:match`);
  const teams = [setup.home, setup.away];
  const players = [];
  teams.forEach((team, t) =>
    team.players.forEach((pl, idx) => {
      const slot = FORMATION_442[idx];
      players.push({
        i: players.length,
        team: t,
        idx,
        role: slot.role,
        fx: slot.fx,
        fy: slot.fy,
        name: pl.name,
        shirt: pl.shirt,
        stats: pl.stats,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        tx: 0,
        ty: 0,
        mode: 'shape', // shape | ball | press | cover | owner | keeper
        offA: 0,
        offX: 0,
        cool: 0, // can't touch / tackle again yet
        face: 1,
      });
    }),
  );

  const world = {
    setup,
    rng,
    T: TUNING,
    pitch: PITCH,
    players,
    ball: createBall(W / 2, H / 2),
    owner: null,
    ownerSince: 0,
    lastTouch: 0,
    lastToucher: null,
    pass: null, // { from, to, team } — the intended receiver goes for the ball
    shot: null, // { team, by, step, resolved }
    steps: 0,
    half: 1,
    t: 0,
    phase: 'restart',
    phaseLeft: 1.0,
    restart: null, // { type: 'kickoff'|'throw'|'goalkick'|'corner', team, taker }
    score: [0, 0],
    scorers: [], // [{ team, name, minute }]
    stats: [0, 1].map(() => ({ shots: 0, onTarget: 0, saves: 0, passes: 0, passesDone: 0, tackles: 0, tacklesWon: 0, possessionSteps: 0 })),
    events: [], // goals, saves, shots, half/full time (for the screen's banners and the tests)
    chasers: [[], []],

    // Which way a team attacks now: -1 up the screen (towards y = 0), +1 down.
    dir(team) {
      return (team === 0) === (world.half === 1) ? -1 : 1;
    },
    // The team's own frame: a = distance from the goal it attacks (0 … H); x across as it sees it.
    aOf(team, y) {
      return world.dir(team) < 0 ? y : H - y;
    },
    toWorld(team, fx, a) {
      return world.dir(team) < 0 ? { x: fx * W, y: a } : { x: W - fx * W, y: H - a };
    },
    goalOf(team) {
      // the goal this team attacks
      return { x: W / 2, y: world.dir(team) < 0 ? 0 : H };
    },
    ownGoal(team) {
      return { x: W / 2, y: world.dir(team) < 0 ? H : 0 };
    },
    keeperOf(team) {
      return players[team * 11];
    },
    get minute() {
      return Math.min(45, Math.floor((world.t / MATCH_TIME.halfSec) * 45)) + (world.half - 1) * 45;
    },
    get done() {
      return world.phase === 'fulltime';
    },
    // Possession share so far (home), 0..1.
    get possession() {
      const a = world.stats[0].possessionSteps;
      const b = world.stats[1].possessionSteps;
      return a + b ? a / (a + b) : 0.5;
    },

    step() {
      if (world.phase === 'fulltime') return;
      const dt = MATCH_TIME.step;
      world.steps++;
      if (world.phase === 'halftime') {
        world.phaseLeft -= dt;
        if (world.phaseLeft <= 0) {
          world.half = 2;
          world.t = 0;
          kickoff(1);
        }
        return;
      }
      world.t += dt;
      if (world.owner) world.stats[world.owner.team].possessionSteps++;
      for (const p of players) if (p.cool > 0) p.cool -= dt;

      if (world.phase === 'restart' || world.phase === 'goal') {
        world.phaseLeft -= dt;
        think(world);
        movePlayers(world, dt);
        if (world.owner) moveOwner(world, dt, true);
        if (world.phaseLeft <= 0) {
          if (world.phase === 'goal') kickoff(world.restart.team);
          else {
            world.phase = 'play';
            world.restartGo = true; // the taker plays at once (matchAI)
          }
        }
      } else {
        think(world);
        movePlayers(world, dt);
        if (world.owner) moveOwner(world, dt, false);
        const prev = { x: world.ball.x, y: world.ball.y, z: world.ball.z };
        if (!world.owner) stepBall(world.ball, dt, TUNING.ball);
        keeperStep(world, dt);
        if (!world.owner) tryControl(world);
        const out = world.owner ? null : crossing(prev, world.ball, PITCH);
        if (out) ballOut(out);
      }
      if (world.t >= MATCH_TIME.halfSec && world.phase !== 'goal') endHalf();
    },
    run(n) {
      for (let k = 0; k < n && !world.done; k++) world.step();
    },
    serialize() {
      return { setup: world.setup, steps: world.steps };
    },

    // --- actions the AI calls -----------------------------------------------------------------------------------
    give(p) {
      if (world.pass && world.pass.team === p.team && world.pass.from !== p) world.stats[p.team].passesDone++;
      world.pass = null;
      world.shot = null;
      world.owner = p;
      p.dribble = null;
      world.ownerSince = world.steps;
      world.lastTouch = p.team;
      world.lastToucher = p;
      p.mode = 'owner';
      world.ball.z = 0;
      world.ball.vz = 0;
    },
    release(p) {
      world.owner = null;
      world.lastTouch = p.team;
      world.lastToucher = p;
      p.cool = 0.3;
      p.mode = 'shape';
    },
    event(e) {
      world.events.push({ ...e, minute: world.minute, step: world.steps });
    },
  };

  function placeAll() {
    for (const p of players) {
      const a = Math.max(p.fy * H, H / 2 + 1.5 + (p.role === 'FW' ? 0 : 2));
      const w = world.toWorld(p.team, p.fx, p.role === 'GK' ? H - 1.5 : a);
      p.x = p.tx = w.x;
      p.y = p.ty = w.y;
      p.vx = p.vy = 0;
      p.mode = 'shape';
      p.cool = 0;
      p.offA = p.offX = 0;
    }
  }

  function kickoff(team) {
    placeAll();
    stopBall(world.ball, W / 2, H / 2);
    const taker = players[team * 11 + 9]; // a forward
    taker.x = W / 2 + 0.6 * -world.dir(team);
    taker.y = H / 2 - world.dir(team) * 0.8;
    world.give(taker);
    world.pass = null;
    world.phase = 'restart';
    world.phaseLeft = 1.0;
    world.restart = { type: 'kickoff', team, taker };
  }

  function setRestart(type, team, x, y) {
    world.shot = null;
    world.pass = null;
    stopBall(world.ball, x, y);
    let taker;
    if (type === 'goalkick') taker = world.keeperOf(team);
    else {
      // the nearest outfield player of that team takes it
      let best = Infinity;
      for (const p of players)
        if (p.team === team && p.role !== 'GK') {
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < best) {
            best = d;
            taker = p;
          }
        }
    }
    taker.x = x;
    taker.y = y;
    taker.vx = taker.vy = 0;
    world.give(taker);
    world.phase = 'restart';
    world.phaseLeft = MATCH_TIME.restartPause;
    world.restart = { type, team, taker };
  }

  function ballOut(o) {
    const last = world.lastTouch;
    if (o.side === 'top' || o.side === 'bottom') {
      const endY = o.side === 'top' ? 0 : H;
      // the team attacking this end
      const attackers = world.goalOf(0).y === endY ? 0 : 1;
      if (Math.abs(o.x - W / 2) < PITCH.goalW / 2 && o.z < PITCH.goalH) {
        goal(attackers, o);
        return;
      }
      const defenders = 1 - attackers;
      if (world.shot && !world.shot.resolved) world.event({ type: 'miss', team: world.shot.team, by: world.shot.by.name });
      if (last === attackers) {
        const inY = endY === 0 ? PITCH.sixD : H - PITCH.sixD;
        setRestart('goalkick', defenders, W / 2 + (o.x < W / 2 ? -5 : 5), inY);
      } else {
        const cx = o.x < W / 2 ? 0.5 : W - 0.5;
        setRestart('corner', attackers, cx, endY === 0 ? 0.5 : H - 0.5);
      }
      return;
    }
    const x = o.side === 'left' ? 0.3 : W - 0.3;
    setRestart('throw', 1 - last, x, Math.max(1, Math.min(H - 1, o.y)));
  }

  function goal(team, o) {
    world.score[team]++;
    const by = world.lastToucher && world.lastToucher.team === team ? world.lastToucher : world.shot?.by ?? world.lastToucher;
    const own = by && by.team !== team;
    const entry = { team, name: by ? by.name : 'Unknown', minute: world.minute + 1, own };
    world.scorers.push(entry);
    world.event({ type: 'goal', team, by: entry.name, own, score: [...world.score] });
    // the ball rests in the net
    world.ball.x = o.x;
    world.ball.y = o.y < 1 ? -1.2 : H + 1.2;
    world.ball.z = 0;
    world.ball.vx = world.ball.vy = world.ball.vz = 0;
    world.owner = null;
    world.shot = null;
    world.pass = null;
    world.phase = 'goal';
    world.phaseLeft = MATCH_TIME.goalPause;
    world.restart = { type: 'kickoff', team: 1 - team, taker: null };
  }

  function endHalf() {
    if (world.half === 1) {
      world.event({ type: 'half' });
      world.phase = 'halftime';
      world.phaseLeft = MATCH_TIME.halfTimePause;
      world.owner = null;
      world.shot = null;
      world.pass = null;
      stopBall(world.ball, W / 2, H / 2);
      world.t = MATCH_TIME.halfSec;
    } else {
      world.event({ type: 'full', score: [...world.score] });
      world.phase = 'fulltime';
      world.t = MATCH_TIME.halfSec;
      world.owner = null;
    }
  }

  kickoff(0);
  return world;
}

// A world at exactly the saved step (replayed headlessly from the fixed seed and line-ups).
export function restoreMatchWorld(saved) {
  const w = createMatchWorld(saved.setup);
  w.run(saved.steps ?? 0);
  return w;
}

// The result record for the calendar / result screen.
export function matchResult(world) {
  const [h, a] = world.score;
  return {
    score: [h, a],
    scorers: world.scorers.map((s) => ({ ...s })),
    outcome: h > a ? 'won' : h < a ? 'lost' : 'drew',
    stats: world.stats.map((s) => ({ ...s })),
  };
}
