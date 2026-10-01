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
// Milestone 4 (Play): createMatchWorld(setup, { play: { team, inputs } }) adds world.control (manualControl.js) — the
// human's stick and buttons, logged per step. A Play match saves { setup, steps, play } and replays the same way; a Watch
// match (no play) never creates a control, so it runs exactly as in Milestone 3.
// Milestone 5 (Watch / Manage / Play, mode switching): world.command(['mode', m]) and world.command(['tac', team, key,
// value]) change the match between two steps. Each command is logged in world.timeline against the step it applies to
// and applied at once; a replay applies it at the start of that step, so the saved match { setup, steps, start,
// timeline, play: { team, inputs } } replays to exactly the same moment. Play creates the control (manualControl.js)
// and leaves it again; one input log (world.inputs) runs through every Play stint. The clock, score, positions and dice
// carry straight on — nothing is ever reset. The team commands change world.fx[team] (data/match.js TACTIC_FX), which the
// zone AI reads; the Balanced / Normal defaults leave the Milestone 3 match untouched.
// Milestone 9 (bible §15): each side plays a formation (setup.formation[team], data/tactics.js FORMATIONS: slots with their
// line, zone box and default role) with a player role per slot (setup.roles[team][slot], ROLES: small nudges the zone AI
// reads from p.nudge), seven team instructions (TACTICS; the M5 names still read across) and a tactical familiarity
// (setup.familiarity[team]: { 'formation:build': 0–100 } — below FAMILIARITY.comfortable the pair's positioning drifts
// and its errors grow; no map = fully familiar). world.command(['formation', team, id]) re-fits the eleven on the pitch to
// the new slots (by natural position, then nearest spot); world.command(['role', team, slot, roleId]) changes one role.
// Both are logged in the timeline like the M5 commands. A 4-4-2 on the defaults with its default roles is the M3 match.
import { Rng } from '../../../../core/Rng.js';
import { PITCH, MATCH_TIME, FORMATION_442, TUNING, TACTICS, TACTIC_FX, FX_BASE, TACTIC_ALIASES } from '../../data/match.js';
import { formationById, FORMATIONS, ROLES, rolesForSlot, FAMILIARITY, pairKey } from '../../data/tactics.js';
import { createBall, stopBall, stepBall, crossing } from './ballPhysics.js';
import { think, moveOwner, movePlayers, keeperStep, tryControl } from './matchAI.js';
import { createControl } from './manualControl.js';

const W = PITCH.w;
const H = PITCH.h;

export const MODES = ['watch', 'manage', 'play'];

// A command in the M5 names (pressing / Normal, width / Normal) → the bible's (press / Mid, width / Balanced).
export function tacticAlias(key, value) {
  const a = TACTIC_ALIASES[key];
  return a ? [a.key, a.values[value] ?? value] : [key, value];
}
// The team's commands (any left out stay at the default; M5 names read across) → { mentality, tempo, press, … }.
export function tacticsOf(t = {}) {
  const src = {};
  for (const [k, v] of Object.entries(t ?? {})) {
    const [kk, vv] = tacticAlias(k, v);
    src[kk] = vv;
  }
  return Object.fromEntries(Object.entries(TACTICS).map(([k, def]) => [k, def.options.includes(src[k]) ? src[k] : def.def]));
}
// Instructions combine: offsets add, factors multiply, the rest (press style, hold, zone…) the last one set wins. One
// option on its own gives exactly its TACTIC_FX numbers. famPen: the familiarity penalty 0 (none) … 1 (a new pair).
const ADD = new Set(['line', 'shot', 'drop', 'dribble', 'passBias', 'zip', 'shield', 'defLine', 'loft']);
const MUL = new Set(['runs', 'push', 'progress', 'decide', 'err', 'spread', 'spreadOff', 'shift', 'crowd', 'shotErr']);
export function fxOf(tactics, famPen = 0) {
  const fx = { ...FX_BASE };
  for (const [k, v] of Object.entries(tactics)) {
    for (const [key, val] of Object.entries(TACTIC_FX[k]?.[v] ?? {})) {
      if (ADD.has(key)) fx[key] = fx[key] - FX_BASE[key] + val;
      else if (MUL.has(key)) fx[key] = (fx[key] / FX_BASE[key]) * val;
      else fx[key] = val;
    }
  }
  if (famPen > 0) {
    // an unfamiliar formation / style: slower decisions, wider errors, the pressure felt more, and (matchAI) drift
    fx.famPen = famPen;
    fx.decide *= 1 + FAMILIARITY.decide * famPen;
    fx.err *= 1 + FAMILIARITY.errMax * famPen;
    fx.shotErr *= 1 + FAMILIARITY.errMax * famPen;
    fx.crowd *= 1 + FAMILIARITY.crowd * famPen;
  }
  return fx;
}
// The penalty for playing a pair this unfamiliar (0 at or above FAMILIARITY.comfortable, 1 at 0).
export const famPenalty = (value) => (value >= FAMILIARITY.comfortable ? 0 : Math.round((1 - value / FAMILIARITY.comfortable) * 1000) / 1000);
// A role's nudges for the AI (null for a role with none — the M3 defaults).
export function nudgeOf(roleId) {
  const r = ROLES[roleId];
  if (!r) return null;
  const { name, group, ...n } = r;
  return Object.keys(n).length ? n : null;
}
// Fit eleven players to a formation's slots: the scarce slots first, each from its natural position (then the nearest
// line), ties to the player standing nearest the slot's spot. players: [{ position, fx, fy }] → slot index per player.
export function fitToSlots(players, formationId) {
  const slots = formationById(formationId).slots;
  const order = slots.map((_, i) => i).sort((a, b) => ({ GK: 0, FW: 1, DF: 2, WG: 3, MF: 4 })[slots[a].pos] - ({ GK: 0, FW: 1, DF: 2, WG: 3, MF: 4 })[slots[b].pos] || a - b);
  const near = { GK: [], DF: ['MF', 'WG'], MF: ['DF', 'WG', 'FW'], WG: ['MF', 'FW', 'DF'], FW: ['WG', 'MF'] };
  const left = new Set(players.map((_, i) => i));
  const out = new Array(players.length).fill(null);
  for (const si of order) {
    const sl = slots[si];
    const allowed = (p) => sl.pos === 'GK' || p.position !== 'GK' || [...left].every((i) => players[i].position === 'GK'); // a keeper plays in goal unless only keepers are left
    let pick = null;
    for (const want of [[sl.pos], near[sl.pos], ['GK', 'DF', 'MF', 'WG', 'FW']]) {
      let best = Infinity;
      for (const i of left) {
        const p = players[i];
        if (!want.includes(p.position) || !allowed(p)) continue;
        const d = Math.hypot(p.fx - sl.fx, p.fy - sl.fy);
        if (d < best) [best, pick] = [d, i];
      }
      if (pick != null) break;
    }
    if (pick == null) pick = [...left][0];
    left.delete(pick);
    out[pick] = si;
  }
  return out;
}

// start: 'watch' | 'manage' | 'play' (play = { team, inputs } is the Milestone 4 way of saying start: 'play').
// team: the side the human controls in Play. inputs / timeline: from a save (restoreMatchWorld).
export function createMatchWorld(setup, { play = null, start = play ? 'play' : 'watch', team = play?.team ?? 0, inputs = play?.inputs ?? [], timeline = [] } = {}) {
  const rng = new Rng(`${setup.seed}:match`);
  const teams = [setup.home, setup.away];
  const players = [];
  const formations = [0, 1].map((t) => (FORMATIONS.some((f) => f.id === setup.formation?.[t]) ? setup.formation[t] : '442'));
  teams.forEach((team, t) =>
    team.players.forEach((pl, idx) => {
      const fslot = formationById(formations[t]).slots[idx];
      const slot = formations[t] === '442' ? { ...FORMATION_442[idx], ...fslot, role: FORMATION_442[idx].role } : { ...fslot, role: fslot.line };
      const tRole = rolesForSlot(fslot).includes(setup.roles?.[t]?.[idx]) ? setup.roles[t][idx] : fslot.role;
      players.push({
        i: players.length,
        team: t,
        idx,
        role: slot.role,
        fx: slot.fx,
        fy: slot.fy,
        slot: idx, // Milestone 9: the formation slot he plays in (its zone, its role)
        zone: slot.zone ?? null,
        tRole,
        nudge: nudgeOf(tRole),
        position: pl.position ?? (slot.role === 'MF' && (slot.fx < 0.2 || slot.fx > 0.8) ? 'WG' : slot.role),
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
    control: null, // Play mode: the human's control (manualControl.js)
    mode: MODES.includes(start) ? start : 'watch',
    start: MODES.includes(start) ? start : 'watch',
    team, // the human's side
    inputs: inputs.map((e) => e.slice()), // the Play input log, across every Play stint
    timeline: timeline.map((e) => e.slice()), // [[step, 'mode', m] | [step, 'tac', team, key, value]]
    tactics: [0, 1].map((t) => tacticsOf(setup.tactics?.[t])),
    fx: null,
    formation: formations.slice(), // Milestone 9: each side's formation now
    possTeam: null, // who has had the ball last, and the step each side last won it (the counter)
    wonAt: [null, null],
    familiarity: [0, 1].map((t) => (setup.familiarity?.[t] ? { ...setup.familiarity[t] } : null)),
    // how familiar a side is with what it plays now (100 with no map: opponents and test sides)
    famOf(team) {
      const m = world.familiarity[team];
      return m ? m[pairKey(world.formation[team], world.tactics[team].build)] ?? 0 : 100;
    },

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
      applyDue();
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
      if (world.control) world.control.pre();

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
      const out = { setup: world.setup, steps: world.steps };
      if (world.timeline.length || world.start === 'manage') {
        out.start = world.start;
        out.timeline = world.timeline.map((e) => e.slice());
      }
      if (world.start === 'play' || world.control || world.inputs.length) out.play = { team: world.team, inputs: world.inputs.map((e) => e.slice()) };
      return out;
    },
    // Milestone 5: change the mode or a team command now (logged for the replay; applies from the next step).
    command(cmd) {
      const e = [world.steps + 1, ...cmd];
      if (!valid(e)) return false;
      world.timeline.push(e);
      applyDue();
      return true;
    },
    // (a restored world: commands given after its last step)
    catchUp() {
      applyDue();
    },

    // --- actions the AI calls -----------------------------------------------------------------------------------
    give(p) {
      if (world.pass && world.pass.team === p.team && world.pass.from !== p) world.stats[p.team].passesDone++;
      if (world.possTeam !== p.team) {
        // (M9) the moment a side wins the ball (a counter-attacking side breaks from here)
        world.possTeam = p.team;
        world.wonAt[p.team] = world.steps;
      }
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

  // --- Milestone 5: the timeline --------------------------------------------------------------------------------
  let tc = 0; // the next timeline entry to apply
  function valid(e) {
    if (e[1] === 'mode') return MODES.includes(e[2]);
    if (e[1] === 'tac') {
      const [k, v] = tacticAlias(e[3], e[4]);
      return (e[2] === 0 || e[2] === 1) && !!TACTICS[k]?.options.includes(v);
    }
    if (e[1] === 'formation') return (e[2] === 0 || e[2] === 1) && FORMATIONS.some((x) => x.id === e[3]);
    if (e[1] === 'role') {
      if (!(e[2] === 0 || e[2] === 1) || !Number.isInteger(e[3])) return false;
      const sl = formationById(world.formation[e[2]]).slots[e[3]];
      return !!sl && rolesForSlot(sl).includes(e[4]);
    }
    return false;
  }
  function applyDue() {
    while (tc < world.timeline.length && world.timeline[tc][0] <= world.steps + 1) apply(world.timeline[tc++]);
  }
  function apply(e) {
    if (!valid(e)) return;
    if (e[1] === 'mode') {
      const m = e[2];
      if (m === 'play' && !world.control) world.control = createControl(world, { team: world.team, log: world.inputs });
      else if (m !== 'play' && world.control) {
        world.control.detach();
        world.control = null;
      }
      world.mode = m;
    } else if (e[1] === 'tac') {
      const [k, v] = tacticAlias(e[3], e[4]);
      world.tactics[e[2]] = { ...world.tactics[e[2]], [k]: v };
      refreshFx(e[2]);
    } else if (e[1] === 'formation') {
      setFormation(e[2], e[3]);
      refreshFx(e[2]);
    } else if (e[1] === 'role') {
      const p = players.find((q) => q.team === e[2] && q.slot === e[3]);
      if (p) {
        p.tRole = e[4];
        p.nudge = nudgeOf(e[4]);
      }
    }
  }
  function refreshFx(team) {
    world.fx[team] = fxOf(world.tactics[team], famPenalty(world.famOf(team)));
  }
  // Re-fit a side to a new formation: each player takes a slot (fitToSlots), its spot, line, zone and default role.
  function setFormation(team, id) {
    if (world.formation[team] === id) return;
    world.formation[team] = id;
    const side = players.filter((p) => p.team === team);
    const fit = fitToSlots(side, id);
    const slots = formationById(id).slots;
    side.forEach((p, i) => {
      const fs = slots[fit[i]];
      const base = id === '442' ? FORMATION_442[fit[i]] : null;
      p.slot = fit[i];
      p.fx = base ? base.fx : fs.fx;
      p.fy = base ? base.fy : fs.fy;
      p.role = base ? base.role : fs.line;
      p.zone = fs.zone ?? null;
      p.tRole = fs.role;
      p.nudge = nudgeOf(fs.role);
    });
  }
  world.fx = [0, 1].map((t) => fxOf(world.tactics[t], famPenalty(world.famOf(t))));

  kickoff(0);
  if (world.start === 'play') world.control = createControl(world, { team: world.team, log: world.inputs });
  return world;
}

// A world at exactly the saved step (replayed headlessly from the fixed seed and line-ups — and the Play input log and
// the mode / team-command timeline).
export function restoreMatchWorld(saved) {
  const start = saved.start ?? (saved.play ? 'play' : 'watch');
  const w = createMatchWorld(saved.setup, { start, team: saved.play?.team ?? 0, inputs: saved.play?.inputs ?? [], timeline: saved.timeline ?? [] });
  w.run(saved.steps ?? 0);
  w.catchUp();
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
