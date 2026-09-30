// The basic crowd (Milestone 6, bible §41: at most 80 individual crowd sprites, the rest a repeating strip): a stand
// band round the pitch, drawn by code. Most fans are painted once into the pitch's cached layer (the strip); up to 80
// in the front rows are drawn every frame so they can jump — a light cheer bounce when a goal goes in (the scoring
// side's fans jump highest, everyone else bobs). Fans wear the clubs' colours: the home side's round most of the
// ground, the away side's behind the top goal.
//   const crowd = createCrowd()
//   crowd.layout({ bands, k, ky, seed, home, away, gaps })   bands: [{ x, y, w, h, side: 'left'|'right'|'top'|'bottom' }]
//                                   in layer px; k px per metre; ky the tilt; home / away: { shirt, shorts } hexes;
//                                   gaps: [{ side, from, to }] stretches (layer px along the band) left empty
//   crowd.drawStrip(g)              the stands and the painted fans (into the cached layer)
//   crowd.drawLive(ctx, ox, oy)     the 80 individuals, at the layer's screen position
//   crowd.cheer(team)  crowd.update(dt)   crowd.count → { strip, live }
import { Rng } from '../../../../core/Rng.js';

export const MAX_LIVE = 80;
const SKIN = ['#F2C29A', '#E0A57A', '#C98B5E', '#9A6440', '#6E4630'];
const COATS = ['#3B4252', '#E9E6DE', '#6B6F78', '#2A2F3A'];
const STEP_A = '#8E99A8';
const STEP_B = '#7F8A9A';
const EDGE = '#3A4150';

export function createCrowd() {
  let fans = []; // painted
  let live = []; // drawn each frame
  let bands = [];
  let k = 10;
  let ky = 1;
  let cheerT = 0;
  let cheerTeam = -1;
  let time = 0;

  function layout(o) {
    k = o.k;
    ky = o.ky;
    bands = o.bands;
    const rng = new Rng(`${o.seed}:crowd`);
    const pal = [o.home, o.away];
    const pick = (end) => {
      // behind the top goal: mostly away fans; elsewhere mostly home
      const r = rng.next();
      const team = end === 'top' ? (r < 0.7 ? 1 : 0) : r < 0.85 ? 0 : 1;
      const r2 = rng.next();
      const colour = r2 < 0.12 ? rng.pick(COATS) : r2 < 0.72 ? pal[team].shirt : pal[team].shorts;
      return { team, colour, skin: rng.pick(SKIN), phase: rng.next() * Math.PI * 2 };
    };
    const all = [];
    const step = 1.25 * k; // a fan every 1.25 m along a row
    for (const b of bands) {
      const along = b.side === 'left' || b.side === 'right' ? b.h : b.w;
      const deep = b.side === 'left' || b.side === 'right' ? b.w : b.h;
      const rows = Math.max(2, Math.floor(deep / (1.0 * k * (b.side === 'top' || b.side === 'bottom' ? ky : 1))));
      for (let row = 0; row < rows; row++) {
        const front = row === rows - 1; // the row nearest the pitch
        const off = row % 2 ? step / 2 : 0;
        for (let a = step / 2 + off; a < along - step / 3; a += step) {
          if (o.gaps?.some((g) => g.side === b.side && a > g.from && a < g.to)) continue;
          const depth = ((row + 0.6) / rows) * deep;
          let x;
          let y;
          if (b.side === 'left') [x, y] = [b.x + depth, b.y + a];
          else if (b.side === 'right') [x, y] = [b.x + b.w - depth, b.y + a];
          else if (b.side === 'top') [x, y] = [b.x + a, b.y + depth];
          else [x, y] = [b.x + a, b.y + b.h - depth];
          all.push({ x: x + (rng.next() - 0.5) * k * 0.2, y, front, ...pick(b.side) });
        }
      }
    }
    // the individuals: spread evenly through the front rows
    const fronts = all.filter((f) => f.front);
    const every = Math.max(1, Math.ceil(fronts.length / MAX_LIVE));
    const chosen = new Set(fronts.filter((_, i) => i % every === 0).slice(0, MAX_LIVE));
    live = [...chosen].sort((a, b) => a.y - b.y);
    fans = all.filter((f) => !chosen.has(f)).sort((a, b) => a.y - b.y);
  }

  function fan(g, f, lift, arms) {
    const r = 0.34 * k;
    const x = f.x;
    const y = f.y - lift;
    g.fillStyle = f.colour;
    g.beginPath();
    g.ellipse(x, y + r * 0.9, r * 1.25, r * 0.85, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (arms) {
      g.beginPath();
      g.moveTo(x - r * 0.9, y + r * 0.5);
      g.lineTo(x - r * 1.3, y - r * 0.9);
      g.moveTo(x + r * 0.9, y + r * 0.5);
      g.lineTo(x + r * 1.3, y - r * 0.9);
      g.save();
      g.strokeStyle = f.colour;
      g.lineWidth = Math.max(2, r * 0.45);
      g.lineCap = 'round';
      g.stroke();
      g.restore();
    }
    g.fillStyle = f.skin;
    g.beginPath();
    g.arc(x, y - r * 0.15, r * 0.62, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  const crowd = {
    layout,
    get count() {
      return { strip: fans.length, live: live.length };
    },
    get cheering() {
      return cheerT > 0;
    },
    cheer(team) {
      cheerTeam = team;
      cheerT = 2.6;
    },
    update(dt) {
      time += dt;
      if (cheerT > 0) cheerT = Math.max(0, cheerT - dt);
    },
    drawStrip(g) {
      // the stands: steps along each band
      for (const b of bands) {
        g.fillStyle = STEP_B;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = STEP_A;
        const vertical = b.side === 'left' || b.side === 'right';
        const n = 4;
        for (let i = 0; i < n; i += 2) {
          if (vertical) g.fillRect(b.x + (b.w / n) * i, b.y, b.w / n, b.h);
          else g.fillRect(b.x, b.y + (b.h / n) * i, b.w, b.h / n);
        }
      }
      g.save();
      g.strokeStyle = EDGE;
      g.lineWidth = Math.max(1, 0.05 * k);
      for (const f of fans) fan(g, f, 0, false);
      g.restore();
    },
    drawLive(ctx, ox, oy) {
      if (!live.length) return;
      const env = cheerT > 0 ? Math.min(1, cheerT / 0.6, (2.6 - cheerT) / 0.15) : 0;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = Math.max(1, 0.05 * k);
      for (const f of live) {
        const mine = f.team === cheerTeam;
        const hop = env > 0 ? Math.abs(Math.sin(time * (mine ? 9 : 5) + f.phase)) * (mine ? 0.55 : 0.18) * k * env : 0;
        fan(ctx, f, hop, env > 0 && mine);
      }
      ctx.restore();
    },
  };
  return crowd;
}
