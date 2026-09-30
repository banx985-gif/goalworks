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
//   createMatchScreen({ renderer, layout, assets, bus, input, live, onMenu, onContinue, onReplay, onProgress })
//     live() → { world, director, mode: 'fixture'|'test', hold } or null (hold: debug, the match stands still)
//     onProgress(world, reason) — after goals / every few s
import { THEME } from '../../../../core/Theme.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { PITCH, MATCH_ART } from '../../data/match.js';
import { createMatchControls } from './matchControls.js';
import { createModeUi } from './matchModeUi.js';

const C = THEME.color;
const S = THEME.size;
const MX = 3; // metres of grass beside the touchlines
const MY = 4.5; // … and behind the goal lines
const KY = 0.94; // the slight tilt: lengths look a touch shorter than widths
const BODY_M = 4.8; // how tall a body is drawn, in metres (bigger than life so it reads on a phone)
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

  const menuRect = () => ui.top().menu;
  const scoreRect = () => ui.top().score;
  const panelRect = () => {
    const sr = layout.safeRect;
    const w = Math.min(920, sr.w - 64);
    const h = 900;
    return { x: sr.x + (sr.w - w) / 2, y: sr.y + Math.max(60, (sr.h - h) / 2), w, h };
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
    const kw = areaW / (PITCH.w + MX * 2);
    k = cam === 'full' ? Math.min(kw, areaH / ((PITCH.h + MY * 2) * KY)) : cam === 'close' ? kw * CLOSE : kw;
    const pw = (PITCH.w + MX * 2) * k;
    const ph = (PITCH.h + MY * 2) * k * KY;
    pitchH = ph;
    pitchW = pw;
    scroll = cam !== 'full' && ph > areaH;
    scrollX = cam === 'close';
    ox = scrollX ? 16 - camX : (W - pw) / 2;
    oy = scroll ? top - camY : top + (areaH - ph) / 2;
    if (scroll || scrollX) follow(1);
    pitchLayer.resize(pw, ph);
    pitchLayer.setPixelScale(renderer.pixelScale);
    pitchLayer.invalidate();
  }
  const sx = (x) => ox + (x + MX) * k;
  const sy = (y) => oy + (y + MY) * k * KY;
  // The following camera: keep the ball near the middle of the view, never showing past the ends (with room for the top
  // goal); Close also follows across, never past the grass beside the touchlines.
  function follow(t) {
    const w = live()?.world;
    if (!w) return;
    if (scroll) {
      const top = scoreRect().y + scoreRect().h + 20;
      const viewH = area.bottom - top;
      const lo = -(PITCH.goalW / 0.7) * k * 0.45; // the top goal's picture stands out above the pitch
      const want = Math.max(lo, Math.min(pitchH - viewH, (w.ball.y + MY) * k * KY - viewH / 2));
      camY += (want - camY) * t;
      oy = top - camY;
    }
    if (scrollX) {
      const viewW = W - 32;
      const want = Math.max(0, Math.min(pitchW - viewW, (w.ball.x + MX) * k - viewW / 2));
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
    const lx = (x) => (x + MX) * k;
    const ly = (y) => (y + MY) * k * KY;
    const P = PITCH;
    g.fillStyle = '#4E9A3C';
    g.fillRect(0, 0, (P.w + MX * 2) * k, (P.h + MY * 2) * k * KY);
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
  function drawGoal(ctx, end) {
    // the picture's posts span about 70% of its width; its goal line is ~85% down it
    const w = (PITCH.goalW / 0.7) * k;
    const h = w;
    const x = sx(PITCH.w / 2) - w / 2;
    if (end) assets.draw(ctx, MATCH_ART.goal, x, sy(PITCH.h) - h * 0.2, w, h); // behind the bottom line, in front of play
    else assets.draw(ctx, MATCH_ART.goal, x, sy(0) - h * 0.85, w, h);
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
    ctx.fillStyle = team.colour.hex;
    ctx.strokeStyle = p === world.owner ? '#FFFFFF' : C.outline;
    ctx.lineWidth = p === world.owner ? 4 : 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.05 * k, 1.05 * k * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const s = BODY_M * k;
    const key = p.role === 'GK' ? team.keeper : team.body;
    if (p.face > 0) {
      ctx.save();
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      assets.draw(ctx, key, -s / 2, y - s * 0.92, s, s);
      ctx.restore();
    } else assets.draw(ctx, key, x - s / 2, y - s * 0.92, s, s);
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
    // team colour bars at each end
    for (const [t, x] of [[setup.home, r.x + 18], [setup.away, r.x + r.w - 34]]) {
      ctx.fillStyle = t.colour.hex;
      ctx.beginPath();
      ctx.roundRect(x, r.y + 22, 16, 64, 8);
      ctx.fill();
    }
    ctx.restore();
    // row 1: the score; row 2: the names either side of the clock
    const half = r.w / 2;
    text(ctx, `${world.score[0]} – ${world.score[1]}`, r.x + half, r.y + 54, { size: S.major, bold: true, align: 'center', baseline: 'middle' });
    const clock = world.phase === 'fulltime' ? 'FT' : world.phase === 'halftime' ? 'HT' : `${Math.min(world.half * 45, world.minute + 1)}'`;
    text(ctx, clock, r.x + half, r.y + 118, { size: S.small, bold: true, color: C.progress, align: 'center', baseline: 'middle' });
    const nameW = half - 48 - 52;
    text(ctx, setup.home.name, r.x + 48, r.y + 118, { size: S.small, bold: true, baseline: 'middle', maxWidth: nameW });
    text(ctx, setup.away.name, r.x + r.w - 48, r.y + 118, { size: S.small, bold: true, baseline: 'middle', align: 'right', maxWidth: nameW });
  }

  function drawBanner(ctx) {
    if (!banner) return;
    const a = Math.min(1, banner.t * 4, (banner.life - banner.t) * 4);
    const w = 700;
    const h = banner.sub ? 200 : 140;
    const x = (W - w) / 2;
    const y = scroll ? (area.top + area.bottom) / 2 - h / 2 : oy + ((PITCH.h + MY * 2) * k * KY) / 2 - h / 2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, THEME.panel.radius);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    text(ctx, banner.title, W / 2, y + (banner.sub ? 72 : h / 2), { size: S.major, bold: true, color: banner.color ?? C.textOnDark, align: 'center', baseline: 'middle', maxWidth: w - 40 });
    if (banner.sub) text(ctx, banner.sub, W / 2, y + 148, { size: S.body, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: w - 40 });
    ctx.restore();
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
    text(ctx, 'Full time', p.x + p.w / 2, p.y + 70, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
    const col = p.w / 2;
    text(ctx, home.name, p.x + col / 2, p.y + 160, { size: S.body, bold: true, align: 'center', baseline: 'middle', maxWidth: col - 40 });
    text(ctx, away.name, p.x + col + col / 2, p.y + 160, { size: S.body, bold: true, align: 'center', baseline: 'middle', maxWidth: col - 40 });
    text(ctx, String(world.score[0]), p.x + col / 2, p.y + 270, { size: 120, bold: true, color: C.text, align: 'center', baseline: 'middle' });
    text(ctx, String(world.score[1]), p.x + col + col / 2, p.y + 270, { size: 120, bold: true, color: C.text, align: 'center', baseline: 'middle' });
    text(ctx, '–', p.x + col, p.y + 270, { size: 96, bold: true, align: 'center', baseline: 'middle' });
    text(ctx, 'Goal scorers', p.x + p.w / 2, p.y + 380, { size: S.heading, bold: true, color: C.actionDark, align: 'center', baseline: 'middle' });
    for (const t of [0, 1]) {
      const list = world.scorers.filter((s) => s.team === t);
      const cx = p.x + col * t + col / 2;
      if (!list.length) text(ctx, '—', cx, p.y + 450, { size: S.body, color: C.textFaint, align: 'center', baseline: 'middle' });
      list.slice(0, 7).forEach((s, i) => text(ctx, `${s.name}${s.own ? ' (og)' : ''} ${s.minute}'`, cx, p.y + 450 + i * 46, { size: S.small, align: 'center', baseline: 'middle', maxWidth: col - 30 }));
      if (list.length > 7) text(ctx, `+${list.length - 7} more`, cx, p.y + 450 + 7 * 46, { size: S.small, color: C.textFaint, align: 'center', baseline: 'middle' });
    }
    for (const b of resultButtons()) drawButton(ctx, b.r, b.label, { accent: b.accent });
  }

  // Banners for new events (goal, half time).
  function readEvents(world) {
    while (lastEvent < world.events.length) {
      const e = world.events[lastEvent++];
      if (e.type === 'goal') {
        const team = e.team === 0 ? world.setup.home : world.setup.away;
        banner = { title: 'GOAL!', sub: `${e.by}${e.own ? ' (og)' : ''} ${e.minute + 1}' — ${team.name}`, t: 0, life: 2.4, color: '#FFD84A' };
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
      drawFlags(ctx, 0);
      drawGoal(ctx, 0);
      const teams = [world.setup.home, world.setup.away];
      const order = world.players.slice().sort((a, b) => a.y - b.y || a.i - b.i);
      let ballDrawn = false;
      for (const p of order) {
        if (!ballDrawn && world.ball.y < p.y) {
          drawBall(ctx, world.ball);
          ballDrawn = true;
        }
        drawPlayer(ctx, world, p, teams[p.team]);
      }
      if (!ballDrawn) drawBall(ctx, world.ball);
      drawGoal(ctx, 1);
      drawFlags(ctx, 1);
      if (clip) ctx.restore();
      if (world.control && !world.done) controls.render(ctx, world);
      drawHud(ctx, world);
      drawBanner(ctx);
      if (world.done) drawResult(ctx, world);
      else ui.render(ctx, world, lv.director, ballY());
    },
  };
  return screen;
}
