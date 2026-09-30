// A "perfect input" player for Play mode (Milestone 4 tests, bible §17 ceiling): it reads the match and produces the same
// stick + button frames a human would — the AI's own best choice with the dice taken out, a pass aimed straight at the
// team-mate, shots at the corner away from the keeper, tackles the moment the carrier is in reach, sprint whenever it
// helps, Switch when a team-mate is much nearer. Its frames go through control.input() like a thumb's, so everything it
// does still runs through the stats (manualControl.js → pass / shoot / tackle).
//   createAutoPlayer(world, { react = 9, through = false }) → { frame() → { mx, my, btn } }
//     react: steps between carrier decisions. through: also play held (lofted) passes where the AI would loft — off by
//     default, because the ground pass is the better choice for this engine (tested: it wins more with it off).
import { BTN } from './manualControl.js';
import { chooseOption, pressureOn, dribbleTarget, meetBall } from './matchAI.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (from, to) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  return { mx: dx / d, my: dy / d };
};

export function createAutoPlayer(world, { react = 9, through = false } = {}) {
  const T = world.T;
  const C = T.control;
  let plan = []; // frames still to play (a hold, a press and its release)
  let next = 0; // the step of the next carrier decision
  let run = null; // where the carrier is running
  let prev = 0;
  const out = (f) => {
    prev = f.btn;
    return f;
  };
  const still = { mx: 0, my: 0, btn: 0 };

  function carrier(ctl, p) {
    const s = world.steps;
    const sprint = ctl.stamina > 0.45 ? BTN.sprint : 0;
    if (s - world.ownerSince < C.firstTouch || s < next) return run ? { ...toward(p, run), btn: sprint } : still;
    next = s + react;
    const best = chooseOption(world, p, null, pressureOn(world, p), () => 0, () => true);
    if (best.kind === 'shoot') {
      plan = [{ mx: 0, my: 0, btn: BTN.action }, still]; // no aim: the corner away from the keeper
      return plan.shift();
    }
    if (best.kind === 'pass' && best.to) {
      const q = best.to;
      const aim = toward(p, { x: q.x + q.vx * 0.35, y: q.y + q.vy * 0.35 });
      const loft = through && (best.lane < 1.5 || best.d > T.pass.loftOver);
      const hold = loft ? C.holdSteps + 1 : 1;
      plan = [];
      for (let i = 0; i < hold; i++) plan.push({ ...aim, btn: BTN.pass });
      plan.push({ ...aim, btn: 0 });
      run = null;
      return plan.shift();
    }
    run = dribbleTarget(world, p);
    return { ...toward(p, run), btn: sprint };
  }

  function defend(ctl, p, o) {
    const d = dist(p, o);
    // Switch when a team-mate is much nearer the carrier
    if (world.steps % react === 0 && d > 10) {
      for (const q of world.players)
        if (q.team === ctl.team && q.role !== 'GK' && q !== p && dist(q, o) < d - 8 && !(prev & BTN.switch)) return { mx: 0, my: 0, btn: BTN.switch };
    }
    const aim = toward(p, { x: o.x + o.vx * 0.25, y: o.y + o.vy * 0.25 });
    let btn = d > 3 && ctl.stamina > 0.3 ? BTN.sprint : 0;
    if (d <= T.tackle.reach && p.cool <= 0 && !(prev & BTN.action)) btn |= BTN.action;
    return { ...aim, btn };
  }

  function loose(ctl, p) {
    if (world.pass && world.pass.to === p) return still; // our pass: the AI meets it
    const q = meetBall(world, p);
    const d = dist(p, q);
    if (d < 0.3) return still;
    return { ...toward(p, q), btn: d > 3 && ctl.stamina > 0.5 ? BTN.sprint : 0 };
  }

  return {
    frame() {
      const ctl = world.control;
      if (plan.length) return out(plan.shift());
      const p = ctl?.player;
      if (!p || world.phase !== 'play') return out(still);
      const o = world.owner;
      if (o === p) return out(carrier(ctl, p));
      run = null;
      if (o && o.team !== ctl.team) return out(defend(ctl, p, o));
      if (o) return out(still); // our keeper has it
      return out(loose(ctl, p));
    },
  };
}
