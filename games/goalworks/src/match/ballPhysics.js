// Ball physics for the match (Milestone 3, bible §16): bounded 2D movement on the pitch plus a height value for lofted
// balls. On the ground it rolls with friction; in the air it flies with gravity and bounces (losing speed) when it lands.
// It bounces off nothing: crossing a line is out of play (the match world decides the restart or the goal).
//   createBall() → { x, y, z, vx, vy, vz }
//   stepBall(ball, dt, T) — T: TUNING.ball
//   crossing(prev, ball, pitch) → null | { side: 'top'|'bottom'|'left'|'right', x, y, z } where it first left the pitch
export function createBall(x = 0, y = 0) {
  return { x, y, z: 0, vx: 0, vy: 0, vz: 0 };
}

export function stopBall(ball, x = ball.x, y = ball.y) {
  ball.x = x;
  ball.y = y;
  ball.z = 0;
  ball.vx = ball.vy = ball.vz = 0;
}

export function ballSpeed(ball) {
  return Math.hypot(ball.vx, ball.vy);
}

export function stepBall(ball, dt, T) {
  const airborne = ball.z > 0 || ball.vz > 0;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (airborne) {
    ball.vz -= T.gravity * dt;
    ball.z += ball.vz * dt;
    const k = Math.max(0, 1 - T.airDrag * dt);
    ball.vx *= k;
    ball.vy *= k;
    if (ball.z <= 0) {
      ball.z = 0;
      ball.vz = -ball.vz * T.bounce; // bounce, a little lower each time
      if (ball.vz < 1.2) ball.vz = 0; // settles into a roll
      ball.vx *= 0.8;
      ball.vy *= 0.8;
    }
    return;
  }
  // Rolling: a constant friction plus a little drag, until it stops.
  const s = Math.hypot(ball.vx, ball.vy);
  if (s === 0) return;
  const ns = Math.max(0, s - (T.rollDecel + T.rollDrag * s) * dt);
  const f = ns / s;
  ball.vx *= f;
  ball.vy *= f;
}

// Where the ball will be after t seconds if nobody touches it (rolling approximation; used by the AI to meet it).
export function predictBall(ball, t, T) {
  let s = Math.hypot(ball.vx, ball.vy);
  if (s < 0.01) return { x: ball.x, y: ball.y };
  // Integrate the roll in coarse steps (cheap, good enough to aim a run).
  const dx = ball.vx / s;
  const dy = ball.vy / s;
  let d = 0;
  const h = 0.1;
  for (let u = 0; u < t && s > 0; u += h) {
    d += s * h;
    s = Math.max(0, s - (T.rollDecel + T.rollDrag * s) * h);
  }
  return { x: ball.x + dx * d, y: ball.y + dy * d };
}

// Distance a rolling ball travels before it stops, from speed v.
export function rollDistance(v, T) {
  let s = v;
  let d = 0;
  const h = 0.05;
  while (s > 0) {
    d += s * h;
    s = Math.max(0, s - (T.rollDecel + T.rollDrag * s) * h);
  }
  return d;
}

export function crossing(prev, ball, pitch) {
  if (ball.y < 0 && prev.y >= 0) return at(prev, ball, 'y', 0, 'top');
  if (ball.y > pitch.h && prev.y <= pitch.h) return at(prev, ball, 'y', pitch.h, 'bottom');
  if (ball.x < 0 && prev.x >= 0) return at(prev, ball, 'x', 0, 'left');
  if (ball.x > pitch.w && prev.x <= pitch.w) return at(prev, ball, 'x', pitch.w, 'right');
  return null;
}
function at(a, b, axis, v, side) {
  const t = (v - a[axis]) / (b[axis] - a[axis] || 1e-9);
  return { side, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
