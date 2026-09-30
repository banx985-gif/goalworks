// The match screen (Milestone 3, Watch only): the whole pitch top-down with a slight tilt, drawn by code (stripes,
// lines, boxes, arcs, spots) into a cached layer; the goals, corner flags, 22 bodies and the ball are the Batch 3 match
// art. A plain team-colour ring under each player tells the sides apart (kit tinting is Milestone 6). Top: ‹ Menu, the
// score and the match clock. Bottom: 1× / 2× match speed. GOAL / half time banners; at full time the result panel
// (final score and scorers) with Continue (or, on the ?screen=match test, Play again / Menu).
// Milestone 4 — Play (a world with world.control): the speed buttons give way to the touch controls (matchControls.js)
// in a band along the bottom; the pitch fills the width above them and the camera follows the ball up and down. The
// player you control wears a bright yellow ring and a marker. Play runs at 1×; each loop step feeds that step's stick and
// buttons to the match before it steps, so the input is part of the seeded, replayable match.
// Milestone 5 — Watch / Manage / Play (matchModeUi.js): the Mode button (top right) switches freely mid-match; Watch and
// Manage have 1× / 2× and a camera (Full pitch / Follow / Close, following the ball); Manage adds the team-commands panel
// above them, so the pitch always sits clear of it. The director (match/matchDirector.js) decides each step whether the
// match may step — a Key Moment offer pauses it until Play it / Skip — and the screen feeds Play's input only in Play.
// Milestone 6 — first art / phone feel: the plain team-colour rings give way to the bodies wearing the kits (both sides'
// colours from the kit clash check, src/match/kits.js; recoloured copies of the art, src/ui/kitArt.js) with the four
// heads spread across each side; a player running up the pitch shows a back-view body. The keepers wear their own
// colours. A stand band runs round the pitch with the crowd in the clubs' colours (matchCrowd.js: a painted strip + 80
// fans who jump when a goal goes in). The referee follows play, the two assistants run their touchlines, and the
// dugouts, tunnel and fourth official's sub board stand by the left touchline.
// Milestone 7: the goals are drawn in code, square on each goal line (the angled goal picture match_15 looked crooked on
// the flat pitch and is kept for menus only): posts on the line, the crossbar raised by the tilt, a mesh net behind. The scoreboard and the result panel carry both badges (our code-drawn badge, the opponent's
// crest) and the kit colours; a goal pops a short banner in the scorer's colours and a little confetti (core/VfxSystem,
// 120 particles at most).
//   createMatchScreen({ renderer, layout, assets, bus, input, live, onMenu, onContinue, onReplay, onProgress })
//     live() → { world, director, mode: 'fixture'|'test', hold } or null (hold: debug, the match stands still)
//     onProgress(world, reason) — after goals / every few s
import { THEME } from '../../../../core/Theme.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { VfxSystem } from '../../../../core/VfxSystem.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { PITCH, MATCH_ART } from '../../data/match.js';
import { BODY_ART, FRONT_BODIES, BACK_BODIES, KEEPER_BODIES } from '../../data/kits.js';
import { bodyKey, headOf } from '../ui/kitArt.js';
import { kitFromColour } from '../match/kits.js';
import { drawBadge } from '../ui/clubArt.js';
import { createMatchControls } from './matchControls.js';
import { createModeUi } from './matchModeUi.js';
import { createCrowd } from './matchCrowd.js';

const C = THEME.color;
const S = THEME.size;
const MX = 3; // metres of grass beside the touchlines
const MY = 4.5; // … and behind the goal lines
const CX = 2.6; // the stand band beyond the grass at the sides (Milestone 6 crowd)…
const CY = 3.2; // … and at the ends
const KY = 0.94; // the slight tilt: lengths look a touch shorter than widths
const BODY_M = 5.0; // how tall a body is drawn, in metres (bigger than life so it reads on a phone)
const NET_D = 2.0; // how deep the goal net runs behind the line (m)
const RISE = 0.5; // the tilt: a height of h metres draws h × RISE metres up the screen (the crossbar)
const MAX_CONFETTI = 120;
// Scenery by the left touchline in the bottom half (the left assistant runs the top half): pitch metres x, foot y, size.
const MID = PITCH.h / 2;
const SCENERY = [
  { art: 'match_23', x: -3.05, y: MID + 7, size: 5 }, // dugouts either side of the tunnel
  { art: 'match_23', x: -3.05, y: MID + 25, size: 5 },
  { art: 'match_24', x: -3.4, y: MID + 16, size: 4.6 }, // the tunnel
  { art: 'match_17', x: -1.2, y: MID + 18.5, size: 2.8 }, // the fourth official's sub board
];
const APRON = { from: MID + 1, to: MID + 28 }; // no stand behind the dugouts and tunnel
const CY_MAX = 16; // on a tall screen the end stands grow (up to this deep) to fill the room above and below the pitch
const BALL_M = 2.0;
const LINE = '#F4F8EE';
const MINE = '#FFE14A'; // the ring under the player you control
const CLOSE = 1.35; // the Close camera: this much nearer than Follow

export function createMatchScreen({ renderer, layout, assets, bus = null, input = null, live, onMenu, onContinue, onReplay = null, onProgress = () => {} }) {
  const W = renderer.width;
  let k = 10; // pixels per metre
  let ox = 0;
  let oy = 0;
  let area = { top: 0, bottom: 0 }; // where the pitch is shown
  let pitchH = 0; // the pitch picture's height (px)
  let pitchW = 0;
  let cy = CY; // how deep the end stands are now (metres)
  let camY = 0; // Play / Follow / Close: how far down the pitch picture the view starts (follows the ball)
  let camX = 0; // Close: … and how far across
  let scroll = false;
  let scrollX = false;
  let shown = ''; // the mode + camera the layout was fitted for
  let offMove = null;
  const controls = createMatchControls({ layout, input });
  const ui = createModeUi({ layout, renderer });
  const playing = () => !!live()?.world?.control;
  const camera = () => (playing() ? 'follow' : live()?.director?.camera ?? 'full');
  let lastEvent = 0;
  let banner = null; // { title, sub, t }
  let progressT = 0;
  const crowd = createCrowd();
  let crowdFor = ''; // the match the crowd was laid out for
  const vfx = new VfxSystem({ assets, width: W, height: renderer.height, maxParticles: MAX_CONFETTI, lowMaxParticles: MAX_CONFETTI / 2, font: THEME.family });
  const officials = { ref: { x: PITCH.w / 2 - 6, y: MID + 4, face: 1 }, a1: { x: -1.3, y: MID / 2, face: 1 }, a2: { x: PITCH.w + 1.3, y: MID * 1.5, face: -1 } };
  const backView = []; // per player: showing the back-view body (running up the pitch)
  // A team's kit: from the set-up, or (a Milestone 3–5 save) made from its one colour.
  const oldKits = new WeakMap();
  const kitOf = (team) => team.kit ?? oldKits.get(team) ?? (oldKits.set(team, kitFromColour(team.colour.hex)), oldKits.get(team));

  const menuRect = () => ui.top().menu;
  const scoreRect = () => ui.top().score;
  const panelRect = () => {
    const sr = layout.safeRect;
    const w = Math.min(920, sr.w - 64);
    const h = Math.min(1000, sr.h - 80);
    return { x: sr.x + (sr.w - w) / 2, y: sr.y + Math.max(40, (sr.h - h) / 2), w, h };
  };
  const resultButtons = () => {
    const p = panelRect();
    const y = p.y + p.h - 40 - THEME.button.minH;
    const lv = live();
    if (lv?.mode === 'test') {
      const w = (p.w - 80 - 24) / 2;
      return [
        { id: 'replay', label: 'Play again', r: { x: p.x + 40, y, w, h: THEME.button.minH }, accent: C.action },
        { id: 'menu', label: 'Menu', r: { x: p.x + 40 + w + 24, y, w, h: THEME.button.minH }, accent: C.progress },
      ];
    }
    return [{ id: 'continue', label: 'Continue', r: { x: p.x + 40, y, w: p.w - 80, h: THEME.button.minH }, accent: C.good }];
  };

  // Fit the pitch between the score row and the bottom controls: Full pitch shows it all; Follow (and Play) fills the width
  // and scrolls up and down with the ball; Close is nearer still and follows across too.
  function fit() {
    const play = playing();
    const cam = camera();
    const top = scoreRect().y + scoreRect().h + 20;
    const bottom = play ? controls.band().y - 12 : ui.pitchBottom(live()?.director?.mode);
    const areaW = W - 32;
    const areaH = bottom - top;
    area = { top: cam !== 'full' ? scoreRect().y + scoreRect().h + 8 : top, bottom };
    // Full pitch shows the stands all round; Follow / Close fit the grass to the width (the side stands run off the edges)
    const kw = areaW / (PITCH.w + MX * 2 + (cam === 'full' ? CX * 2 : 0));
    k = cam === 'full' ? Math.min(kw, areaH / ((PITCH.h + (MY + CY) * 2) * KY)) : cam === 'close' ? kw * CLOSE : kw;
    const room = cam === 'full' ? areaH - (PITCH.h + (MY + CY) * 2) * k * KY : 0;
    cy = CY + Math.min(CY_MAX - CY, Math.max(0, room / 2 / (k * KY)));
    const pw = (PITCH.w + (MX + CX) * 2) * k;
    const ph = (PITCH.h + (MY + cy) * 2) * k * KY;
    pitchH = ph;
    pitchW = pw;
    scroll = cam !== 'full' && ph > areaH;
    scrollX = cam === 'close';
    ox = scrollX ? 16 - camX : (W - pw) / 2;
    oy = scroll ? top - camY : top + (areaH - ph) / 2;
    if (scroll || scrollX) follow(1);
    layoutCrowd();
    pitchLayer.resize(pw, ph);
    pitchLayer.setPixelScale(renderer.pixelScale);
    pitchLayer.invalidate();
  }
  const sx = (x) => ox + (x + MX + CX) * k;
  const sy = (y) => oy + (y + MY + cy) * k * KY;
  // Layer coordinates (the cached pitch picture's own px) of pitch metres.
  const lx = (x) => (x + MX + CX) * k;
  const ly = (y) => (y + MY + cy) * k * KY;
  // The stand bands round the grass, and the crowd laid out in them in both sides' colours.
  function layoutCrowd() {
    const w = live()?.world;
    const pw = (PITCH.w + (MX + CX) * 2) * k;
    const ph = (PITCH.h + (MY + cy) * 2) * k * KY;
    const side = CX * k;
    const end = cy * k * KY;
    const bands = [
      { side: 'top', x: 0, y: 0, w: pw, h: end },
      { side: 'bottom', x: 0, y: ph - end, w: pw, h: end },
      { side: 'left', x: 0, y: end, w: side, h: ph - end * 2 },
      { side: 'right', x: pw - side, y: end, w: side, h: ph - end * 2 },
    ];
    crowd.layout({
      bands,
      k,
      ky: KY,
      seed: w?.setup.seed ?? 'crowd',
      home: w ? kitOf(w.setup.home) : { shirt: '#888888', shorts: '#F7F7F2' },
      away: w ? kitOf(w.setup.away) : { shirt: '#888888', shorts: '#F7F7F2' },
      gaps: [{ side: 'left', from: ly(APRON.from) - end, to: ly(APRON.to) - end }],
    });
    crowdFor = w ? w.setup.seed : '';
  }
  // The following camera: keep the ball near the middle of the view, never showing past the ends (with room for the top
  // goal); Close also follows across, never past the grass beside the touchlines.
  function follow(t) {
    const w = live()?.world;
    if (!w) return;
    if (scroll) {
      const top = scoreRect().y + scoreRect().h + 20;
      const viewH = area.bottom - top;
      const lo = Math.min(0, ly(-NET_D) - PITCH.goalH * RISE * k); // (the top goal's net and crossbar stand above the line)
      const want = Math.max(lo, Math.min(pitchH - viewH, ly(w.ball.y) - viewH / 2));
      camY += (want - camY) * t;
      oy = top - camY;
    }
    if (scrollX) {
      const viewW = W - 32;
      const want = Math.max(0, Math.min(pitchW - viewW, lx(w.ball.x) - viewW / 2));
      camX += (want - camX) * t;
      ox = 16 - camX;
    }
  }
  // Mode or camera changed (a tap, a Key Moment starting or ending): fit again, and hook the Play keys up or down.
  function syncMode() {
    const sig = `${playing()}:${camera()}:${live()?.director?.mode}`;
    if (sig === shown) return;
    const wasPlay = shown.startsWith('true');
    shown = sig;
    fit();
    const play = playing();
    if (play && !wasPlay) {
      controls.release();
      controls.attachKeys();
      offMove = bus?.on('input:move', (p) => controls.onMove(p)) ?? null;
    } else if (!play && wasPlay) {
      controls.detachKeys();
      controls.release();
      offMove?.();
      offMove = null;
    }
  }

  // --- the pitch (cached) ----------------------------------------------------------------------------------------------
  const pitchLayer = new CachedLayer({ width: 10, height: 10, draw: drawPitch });
  function drawPitch(g) {
    const P = PITCH;
    // the stands and the painted crowd, then the grass inside them
    crowd.drawStrip(g);
    g.fillStyle = '#9AA3AE'; // a concrete apron behind the dugouts and tunnel
    g.fillRect(0, ly(APRON.from), lx(-MX), ly(APRON.to) - ly(APRON.from));
    g.fillStyle = '#4E9A3C';
    g.fillRect(lx(-MX), ly(-MY), (P.w + MX * 2) * k, (P.h + MY * 2) * k * KY);
    // an advertising-free hoarding line round the grass in the home side's colour
    const home = live()?.world?.setup.home;
    g.strokeStyle = home?.kit?.shirt ?? home?.colour?.hex ?? '#2E3A2A';
    g.lineWidth = Math.max(3, 0.28 * k);
    g.strokeRect(lx(-MX), ly(-MY), (P.w + MX * 2) * k, (P.h + MY * 2) * k * KY);
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = i % 2 ? '#5DAE48' : '#54A441';
      g.fillRect(lx(0), ly((P.h / bands) * i), P.w * k, (P.h / bands) * k * KY + 0.5);
    }
    g.strokeStyle = LINE;
    g.lineWidth = Math.max(2, 0.14 * k);
    g.lineJoin = 'round';
    const rect = (x, y, w, h) => g.strokeRect(lx(x), ly(y), w * k, h * k * KY);
    rect(0, 0, P.w, P.h);
    g.beginPath();
    g.moveTo(lx(0), ly(P.h / 2));
    g.lineTo(lx(P.w), ly(P.h / 2));
    g.stroke();
    const ellipse = (cx, cy, r, a0 = 0, a1 = Math.PI * 2) => {
      g.beginPath();
      g.ellipse(lx(cx), ly(cy), r * k, r * k * KY, 0, a0, a1);
      g.stroke();
    };
    ellipse(P.w / 2, P.h / 2, P.circleR);
    const spot = (x, y) => {
      g.fillStyle = LINE;
      g.beginPath();
      g.ellipse(lx(x), ly(y), 0.35 * k, 0.35 * k * KY, 0, 0, Math.PI * 2);
      g.fill();
    };
    spot(P.w / 2, P.h / 2);
    for (const end of [0, 1]) {
      const y0 = end ? P.h : 0;
      const s = end ? -1 : 1;
      rect((P.w - P.boxW) / 2, end ? P.h - P.boxD : 0, P.boxW, P.boxD);
      rect((P.w - P.sixW) / 2, end ? P.h - P.sixD : 0, P.sixW, P.sixD);
      spot(P.w / 2, y0 + s * P.spotD);
      // the D: the part of the circle round the spot that is outside the box
      const a = Math.acos((P.boxD - P.spotD) / P.circleR);
      if (end) ellipse(P.w / 2, y0 - P.spotD, P.circleR, -Math.PI / 2 - a, -Math.PI / 2 + a);
      else ellipse(P.w / 2, y0 + P.spotD, P.circleR, Math.PI / 2 - a, Math.PI / 2 + a);
      // corner arcs
      for (const cx of [0, P.w]) {
        const a0 = end ? (cx ? Math.PI : -Math.PI / 2) : cx ? Math.PI / 2 : 0;
        ellipse(cx, y0, 1, a0, a0 + Math.PI / 2);
      }
    }
  }

  // --- drawing the play ----------------------------------------------------------------------------------------------
  // A goal square on its line: the net behind (a mesh box NET_D deep), then the frame — two posts on the line and the
  // crossbar raised by the tilt. The top goal is drawn before the players (they stand in front of it); the bottom one after
  // them (its frame is nearer the camera than anyone on the pitch).
  function drawGoal(ctx, end) {
    const y0 = end ? PITCH.h : 0;
    const back = end ? PITCH.h + NET_D : -NET_D;
    const xl = sx(PITCH.w / 2 - PITCH.goalW / 2);
    const xr = sx(PITCH.w / 2 + PITCH.goalW / 2);
    const up = PITCH.goalH * RISE * k; // screen px the crossbar stands above the posts' feet
    const gy = sy(y0);
    const by = sy(back);
    const top = (y) => y - up;
    // the net: the back and the two sides, filled faintly, then a mesh
    ctx.save();
    ctx.lineJoin = 'round';
    const box = new Path2D();
    box.moveTo(xl, gy);
    box.lineTo(xl, top(gy));
    box.lineTo(xr, top(gy));
    box.lineTo(xr, gy);
    box.lineTo(xr, by);
    box.lineTo(xr, top(by) + up * 0.35); // the back of the net droops a little
    box.lineTo(xl, top(by) + up * 0.35);
    box.lineTo(xl, by);
    box.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill(box);
    ctx.save();
    ctx.clip(box);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, 0.05 * k);
    const step = 0.5 * k;
    const y1 = Math.min(top(gy), top(by)) - 2;
    const y2 = Math.max(gy, by) + 2;
    ctx.beginPath();
    for (let x = xl; x <= xr + 0.5; x += step) {
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    for (let y = y1; y <= y2; y += step * 0.8) {
      ctx.moveTo(xl, y);
      ctx.lineTo(xr, y);
    }
    ctx.stroke();
    ctx.restore();
    // the net's frame lines at the back
    ctx.strokeStyle = 'rgba(235,240,232,0.9)';
    ctx.lineWidth = Math.max(1.5, 0.08 * k);
    ctx.beginPath();
    ctx.moveTo(xl, by);
    ctx.lineTo(xr, by);
    ctx.moveTo(xl, top(by) + up * 0.35);
    ctx.lineTo(xr, top(by) + up * 0.35);
    ctx.moveTo(xl, top(gy));
    ctx.lineTo(xl, top(by) + up * 0.35);
    ctx.moveTo(xr, top(gy));
    ctx.lineTo(xr, top(by) + up * 0.35);
    ctx.stroke();
    // the frame: posts and crossbar, white with a dark edge
    const frame = new Path2D();
    frame.moveTo(xl, gy);
    frame.lineTo(xl, top(gy));
    frame.lineTo(xr, top(gy));
    frame.lineTo(xr, gy);
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = Math.max(4, 0.3 * k);
    ctx.stroke(frame);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2.5, 0.2 * k);
    ctx.stroke(frame);
    ctx.restore();
  }
  function drawFlags(ctx, end) {
    const h = 2.4 * k;
    for (const x of [0, PITCH.w]) assets.draw(ctx, MATCH_ART.flag, sx(x) - h * 0.35, sy(end ? PITCH.h : 0) - h * 0.92, h * 0.7, h);
  }
  function drawPlayer(ctx, world, p, team) {
    const x = sx(p.x);
    const y = sy(p.y);
    if (p.manual) {
      ctx.save();
      ctx.strokeStyle = MINE;
      ctx.lineWidth = Math.max(5, 0.3 * k);
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 * k, 1.6 * k * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // a soft shadow at the feet (the ball carrier's ringed in white)
    ctx.fillStyle = 'rgba(20,40,10,0.32)';
    ctx.beginPath();
    ctx.ellipse(x, y, 1.0 * k, 1.0 * k * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p === world.owner) {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(3, 0.2 * k);
      ctx.stroke();
    }
    const s = BODY_M * k;
    const body = bodyFor(p, team);
    const key = bodyKey(assets, body, kitOf(team));
    const head = BODY_ART[body]?.head;
    ctx.save();
    ctx.translate(x, 0);
    if (p.face > 0) ctx.scale(-1, 1);
    assets.draw(ctx, key, -s / 2, y - s * 0.92, s, s);
    if (head) {
      // the head picture over the bald head of the body
      const hs = s * head.r * 2.55;
      assets.draw(ctx, headOf(team, p), -s / 2 + head.x * s - hs / 2, y - s * 0.92 + head.y * s - hs * 0.56, hs, hs);
    }
    ctx.restore();
    if (p.manual) {
      // a marker over their head
      const my = y - s * 0.92 - 10;
      ctx.save();
      ctx.fillStyle = MINE;
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 16, my - 22);
      ctx.lineTo(x + 16, my - 22);
      ctx.lineTo(x, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  // Which body a player wears now: the keepers theirs (home match_07, away match_08); outfield players one of the four
  // front bodies by shirt, or a back view while running up the pitch (with a little give, so it doesn't flicker).
  function bodyFor(p, team) {
    if (p.role === 'GK') return KEEPER_BODIES[p.team];
    if (backView[p.i] ? p.vy > -0.4 : p.vy < -1.4) backView[p.i] = !backView[p.i];
    return backView[p.i] ? BACK_BODIES[p.shirt % BACK_BODIES.length] : FRONT_BODIES[(p.shirt + p.team) % FRONT_BODIES.length];
  }
  // The referee and assistants (art as painted; visual only — they never touch the match): feet at o.x, o.y.
  function drawOfficial(ctx, o, art, size) {
    const x = sx(o.x);
    const y = sy(o.y);
    const s = size * k;
    ctx.fillStyle = 'rgba(20,40,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.9 * k, 0.45 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(x, 0);
    if (o.face < 0) ctx.scale(-1, 1);
    assets.draw(ctx, art, -s / 2, y - s * 0.92, s, s);
    ctx.restore();
  }
  function drawScenery(ctx, it) {
    const s = it.size * k;
    assets.draw(ctx, it.art, sx(it.x) - s / 2, sy(it.y) - s * 0.9, s, s);
  }
  // The officials follow play: the referee a few metres off the ball on the diagonal, each assistant level with it on
  // their half of a touchline.
  function moveOfficials(world, dt, snap = false) {
    const b = world.ball;
    const clamp = (v, a, z) => Math.max(a, Math.min(z, v));
    const t = snap ? 1 : Math.min(1, dt * 1.6);
    const go = (o, tx, ty) => {
      const dx = (tx - o.x) * t;
      if (Math.abs(dx) > 0.02) o.face = dx > 0 ? 1 : -1;
      o.x += dx;
      o.y += (ty - o.y) * t;
    };
    go(officials.ref, clamp(b.x + (b.x < PITCH.w / 2 ? 9 : -9), 4, PITCH.w - 4), clamp(b.y + 7, 6, PITCH.h - 6));
    go(officials.a1, -1.3, clamp(b.y, 3, MID));
    go(officials.a2, PITCH.w + 1.3, clamp(b.y, MID, PITCH.h - 3));
  }

  function drawBall(ctx, b) {
    const x = sx(b.x);
    const y = sy(b.y);
    const r = BALL_M * k;
    ctx.fillStyle = 'rgba(20,40,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    assets.draw(ctx, MATCH_ART.ball, x - r / 2, y - r * 0.75 - b.z * k * 0.9, r, r);
  }

  function drawHud(ctx, world) {
    const setup = world.setup;
    drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
    const r = scoreRect();
    ctx.save();
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = THEME.panel.line;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, THEME.panel.radius);
    ctx.fill();
    ctx.stroke();
    // kit bars at each end (shirt over shorts)
    for (const [t, x] of [[setup.home, r.x + 18], [setup.away, r.x + r.w - 34]]) kitBar(ctx, t, x, r.y + 20, 16, r.h - 40);
    ctx.restore();
    // row 1: the badges either side of the score; row 2: the names either side of the clock
    const half = r.w / 2;
    const bs = 84;
    teamBadge(ctx, setup.home, { x: r.x + half - 118 - bs / 2, y: r.y + 12, w: bs, h: bs });
    teamBadge(ctx, setup.away, { x: r.x + half + 118 - bs / 2, y: r.y + 12, w: bs, h: bs });
    text(ctx, `${world.score[0]} – ${world.score[1]}`, r.x + half, r.y + 54, { size: S.major, bold: true, align: 'center', baseline: 'middle' });
    const clock = world.phase === 'fulltime' ? 'FT' : world.phase === 'halftime' ? 'HT' : `${Math.min(world.half * 45, world.minute + 1)}'`;
    text(ctx, clock, r.x + half, r.y + 118, { size: S.small, bold: true, color: C.progress, align: 'center', baseline: 'middle' });
    const nameW = half - 48 - 52;
    text(ctx, setup.home.name, r.x + 48, r.y + 118, { size: S.small, bold: true, baseline: 'middle', maxWidth: nameW });
    text(ctx, setup.away.name, r.x + r.w - 48, r.y + 118, { size: S.small, bold: true, baseline: 'middle', align: 'right', maxWidth: nameW });
  }

  // A team's badge: the club's code-drawn badge, an opponent's crest art, or a plain disc in its colour.
  function teamBadge(ctx, team, r) {
    if (team.crest && assets.has(team.crest)) assets.drawContained(ctx, team.crest, r);
    else if (team.badge && team.colours) drawBadge(ctx, r, { ...team.badge, primary: team.colours.primary, secondary: team.colours.secondary });
    else {
      ctx.save();
      ctx.fillStyle = team.colour.hex;
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  // A small upright bar in the kit: shirt colour over shorts colour.
  function kitBar(ctx, team, x, y, w, h) {
    const kit = kitOf(team);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, w / 2);
    ctx.clip();
    ctx.fillStyle = kit.shirt;
    ctx.fillRect(x, y, w, h * 0.62);
    ctx.fillStyle = kit.shorts;
    ctx.fillRect(x, y + h * 0.62, w, h * 0.38);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, w / 2);
    ctx.stroke();
    ctx.restore();
  }

  // The banner: GOAL! pops in (a quick overshoot) on a strip in the scorer's kit, with their badge; half time fades.
  function drawBanner(ctx) {
    if (!banner) return;
    const a = Math.max(0, Math.min(1, banner.t * 6, (banner.life - banner.t) * 4));
    const w = 760;
    const h = banner.sub ? 210 : 140;
    const x = (W - w) / 2;
    const y = scroll ? (area.top + area.bottom) / 2 - h / 2 : oy + pitchH / 2 - h / 2;
    const t = banner.t;
    const pop = banner.team != null ? (t < 0.14 ? 0.6 + (t / 0.14) * 0.5 : t < 0.26 ? 1.1 - ((t - 0.14) / 0.12) * 0.1 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, y + h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-W / 2, -(y + h / 2));
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, THEME.panel.radius);
    ctx.fill();
    if (banner.team != null) {
      const team = banner.team === 0 ? live()?.world.setup.home : live()?.world.setup.away;
      if (team) {
        const kit = kitOf(team);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, THEME.panel.radius);
        ctx.clip();
        ctx.fillStyle = kit.shirt;
        ctx.fillRect(x, y, w, 18);
        ctx.fillStyle = kit.shorts;
        ctx.fillRect(x, y + h - 18, w, 18);
        ctx.restore();
        teamBadge(ctx, team, { x: x + 24, y: y + 30, w: 110, h: 110 });
        teamBadge(ctx, team, { x: x + w - 134, y: y + 30, w: 110, h: 110 });
      }
    }
    const tw = banner.team != null ? w - 300 : w - 40;
    text(ctx, banner.title, W / 2, y + (banner.sub ? 78 : h / 2), { size: S.major, bold: true, color: banner.color ?? C.textOnDark, align: 'center', baseline: 'middle', maxWidth: tw });
    if (banner.sub) text(ctx, banner.sub, W / 2, y + 156, { size: S.body, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: w - 60 });
    ctx.restore();
  }
  // Confetti from both sides of the banner, 60 a side (120 at most on screen).
  function goalPop() {
    const y = scroll ? (area.top + area.bottom) / 2 : oy + pitchH / 2;
    vfx.confetti('screen', W * 0.2, y, { count: MAX_CONFETTI / 2, speed: 700, spreadX: 60 });
    vfx.confetti('screen', W * 0.8, y, { count: MAX_CONFETTI / 2, speed: 700, spreadX: 60 });
  }

  function drawResult(ctx, world) {
    const H = renderer.height;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, W, H);
    const p = panelRect();
    ctx.save();
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = THEME.panel.line;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, THEME.panel.radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const { home, away } = world.setup;
    text(ctx, 'Full time', p.x + p.w / 2, p.y + 64, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
    const col = p.w / 2;
    for (const [t, team] of [[0, home], [1, away]]) {
      const cx = p.x + col * t + col / 2;
      teamBadge(ctx, team, { x: cx - 55, y: p.y + 104, w: 110, h: 110 });
      kitBar(ctx, team, cx - 100, p.y + 118, 18, 84);
      kitBar(ctx, team, cx + 82, p.y + 118, 18, 84);
      text(ctx, team.name, cx, p.y + 248, { size: S.body, bold: true, align: 'center', baseline: 'middle', maxWidth: col - 40 });
      text(ctx, String(world.score[t]), cx, p.y + 350, { size: 120, bold: true, color: C.text, align: 'center', baseline: 'middle' });
    }
    text(ctx, '–', p.x + col, p.y + 350, { size: 96, bold: true, align: 'center', baseline: 'middle' });
    text(ctx, 'Goal scorers', p.x + p.w / 2, p.y + 456, { size: S.heading, bold: true, color: C.actionDark, align: 'center', baseline: 'middle' });
    for (const t of [0, 1]) {
      const list = world.scorers.filter((s) => s.team === t);
      const cx = p.x + col * t + col / 2;
      if (!list.length) text(ctx, '—', cx, p.y + 524, { size: S.body, color: C.textFaint, align: 'center', baseline: 'middle' });
      list.slice(0, 5).forEach((s, i) => text(ctx, `${s.name}${s.own ? ' (og)' : ''} ${s.minute}'`, cx, p.y + 524 + i * 46, { size: S.small, align: 'center', baseline: 'middle', maxWidth: col - 30 }));
      if (list.length > 5) text(ctx, `+${list.length - 5} more`, cx, p.y + 524 + 5 * 46, { size: S.small, color: C.textFaint, align: 'center', baseline: 'middle' });
    }
    for (const b of resultButtons()) drawButton(ctx, b.r, b.label, { accent: b.accent });
  }

  // Banners for new events (goal, half time).
  function readEvents(world) {
    while (lastEvent < world.events.length) {
      const e = world.events[lastEvent++];
      if (e.type === 'goal') {
        const team = e.team === 0 ? world.setup.home : world.setup.away;
        banner = { title: 'GOAL!', sub: `${e.by}${e.own ? ' (og)' : ''} ${e.minute + 1}' — ${team.name}`, t: 0, life: 2.2, color: '#FFD84A', team: e.team };
        crowd.cheer(e.team);
        goalPop();
        onProgress(world, 'match:goal');
      } else if (e.type === 'half') {
        banner = { title: 'Half time', sub: `${world.score[0]} – ${world.score[1]}`, t: 0, life: 2.4 };
        onProgress(world, 'match:half');
      } else if (e.type === 'full') onProgress(world, 'match:full');
    }
  }

  const ballY = () => {
    const w = live()?.world;
    return w ? sy(w.ball.y) : null;
  };

  const screen = {
    get k() {
      return k;
    },
    get banner() {
      return banner;
    },
    crowd,
    vfx,
    officials,
    // Tests: which body / head picture a player is drawn with now.
    lookOf(p) {
      const team = [live().world.setup.home, live().world.setup.away][p.team];
      const body = bodyFor(p, team);
      return { body, key: bodyKey(assets, body, kitOf(team)), head: BODY_ART[body]?.head ? headOf(team, p) : null };
    },
    // Tests: 'menu', 'score', 'mode', the result panel's buttons ('panel' is the result panel), in Play 'band',
    // 'stickZone', 'pass', 'action', 'sprint', 'switch', and whatever the mode layer shows now ('speed1', 'speed2',
    // 'camera', 'tac:<key>:<value>', 'pick:<watch|manage|play|km|close>', 'km:play', 'km:skip').
    rectOf(id) {
      const lv = live();
      const fixed = { panel: panelRect(), band: controls.band(), stickZone: controls.stickZone() }[id];
      const m = lv?.director ? ui.rects(lv.director, ballY())[id] : { menu: menuRect(), score: scoreRect() }[id];
      return m ?? fixed ?? controls.buttonRect(id) ?? resultButtons().find((b) => b.id === id)?.r ?? null;
    },
    controls,
    ui,
    get view() {
      return { top: area.top, bottom: area.bottom, k, scroll, scrollX, camY, camX, camera: camera() };
    },
    toScreen: (x, y) => ({ x: sx(x), y: sy(y) }),
    enter() {
      camY = 0;
      camX = 0;
      shown = '';
      ui.closePicker();
      syncMode();
      const w = live()?.world;
      lastEvent = w ? w.events.length : 0; // no banners for what happened before a reload
      banner = null;
      progressT = 0;
      vfx.clear();
      backView.length = 0;
      if (w) moveOfficials(w, 0, true);
      // make both kits' pictures now (a screen change), not on the first frames of play
      if (w) [w.setup.home, w.setup.away].forEach((t, i) => [...FRONT_BODIES, ...BACK_BODIES, KEEPER_BODIES[i]].forEach((b) => bodyKey(assets, b, kitOf(t))));
      if (w && crowdFor !== w.setup.seed) fit(); // (a new match with the same camera: lay its crowd out again)
    },
    exit() {
      controls.detachKeys();
      controls.release();
      offMove?.();
      offMove = null;
      shown = '';
      ui.closePicker();
    },
    resize() {
      fit();
    },
    update(dt) {
      const lv = live();
      if (!lv) return;
      const world = lv.world;
      const d = lv.director;
      syncMode();
      if (world.control) controls.sweep();
      if (!world.done && !ui.pickerOpen && !lv.hold) {
        // one match step per loop step at 1×, two at 2× (Play: 1×, and this step's stick and buttons go in first); the
        // director may hold the match (a Key Moment offer) or change the mode between steps
        for (let i = 0; i < d.speed; i++) {
          if (!d.tick()) break;
          syncMode();
          if (world.control) world.control.input(controls.frame());
          world.step();
        }
        if (world.done) d.tick(); // (a moment still on at full time hands back)
        progressT += dt;
        if (progressT >= 3) {
          progressT = 0;
          onProgress(world, 'match:progress');
        }
      }
      syncMode();
      ui.update(dt);
      if (scroll || scrollX) follow(Math.min(1, dt * 4));
      readEvents(world);
      moveOfficials(world, dt);
      crowd.update(dt);
      vfx.update(dt);
      if (banner) {
        banner.t += dt;
        if (banner.t > banner.life) banner = null;
      }
    },
    onBack() {
      onMenu();
      return true;
    },
    onDown(p) {
      const lv = live();
      const w = lv?.world;
      if (w?.control && !w.done && !ui.pickerOpen && !lv.director?.paused) controls.onDown(p);
    },
    onUp(p) {
      controls.onUp(p);
    },
    onTap(p) {
      const lv = live();
      if (!lv) return;
      if (lv.world.done) {
        const b = resultButtons().find((x) => hitRect(p, x.r));
        if (b?.id === 'continue') onContinue(lv.world);
        else if (b?.id === 'replay') onReplay?.();
        else if (b?.id === 'menu') onMenu();
        return;
      }
      if (controls.owns(p.id)) return; // (a finger still down on a control)
      if (!ui.pickerOpen && !lv.director.paused && hitRect(p, menuRect())) return onMenu();
      ui.tap(p, lv.director, ballY());
      syncMode();
    },
    render(ctx) {
      ctx.fillStyle = '#2F6B2A';
      ctx.fillRect(0, 0, W, renderer.height);
      const lv = live();
      if (!lv) {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        return;
      }
      const world = lv.world;
      const clip = scroll || scrollX;
      if (clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, area.top, W, area.bottom - area.top);
        ctx.clip();
      }
      pitchLayer.render(ctx, ox, oy);
      crowd.drawLive(ctx, ox, oy);
      drawFlags(ctx, 0);
      drawGoal(ctx, 0);
      const teams = [world.setup.home, world.setup.away];
      // everyone on the grass, back to front: players, the officials and the scenery by the touchline
      const order = [
        ...world.players.map((p) => ({ y: p.y, i: p.i, p })),
        { y: officials.ref.y, i: 100, o: officials.ref, art: 'match_18', size: BODY_M },
        { y: officials.a1.y, i: 101, o: officials.a1, art: 'match_19', size: BODY_M * 0.95 },
        { y: officials.a2.y, i: 102, o: officials.a2, art: 'match_19', size: BODY_M * 0.95 },
        ...SCENERY.map((it, n) => ({ y: it.y, i: 110 + n, it })),
      ].sort((a, b) => a.y - b.y || a.i - b.i);
      let ballDrawn = false;
      for (const e of order) {
        if (!ballDrawn && world.ball.y < e.y) {
          drawBall(ctx, world.ball);
          ballDrawn = true;
        }
        if (e.p) drawPlayer(ctx, world, e.p, teams[e.p.team]);
        else if (e.o) drawOfficial(ctx, e.o, e.art, e.size);
        else drawScenery(ctx, e.it);
      }
      if (!ballDrawn) drawBall(ctx, world.ball);
      drawGoal(ctx, 1);
      drawFlags(ctx, 1);
      if (clip) ctx.restore();
      if (world.control && !world.done) controls.render(ctx, world);
      drawHud(ctx, world);
      drawBanner(ctx);
      vfx.render(ctx, 'screen');
      if (world.done) drawResult(ctx, world);
      else ui.render(ctx, world, lv.director, ballY());
    },
  };
  return screen;
}
