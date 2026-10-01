// The match screen's mode layer (Milestone 5, bible §17), drawn around the pitch so it never covers the ball:
//   top right   — the Mode button (WATCH / MANAGE / PLAY); it opens the mode picker: Watch · Manage · Play and the
//                 Key Moments On / Off setting (the match waits while the picker is open)
//   bottom      — Watch / Manage: 1× · 2× · Camera (Full → Follow → Close). Manage adds the team-commands panel above it:
//                 Mentality, Press, Tempo, Width — three choices each, the one in force in graphite — and (Milestone 9) a
//                 Tactics button on the bar: the full sheet (formation, all seven instructions, roles; the match waits).
//   Key Moment  — the offer panel (title, one line, Play it · Skip) at the end of the screen away from the ball; while a
//                 moment is played, a chip under the score counts down.
//   createModeUi({ layout, renderer }) → ui
//     ui.top() → { menu, score, mode } rects      ui.pitchBottom(mode) → where the pitch area must end (Watch / Manage)
//     ui.rects(director, ballY) → { id: rect } for every control on screen now (tests + taps)
//     ui.tap(p, director) → true when it used the tap      ui.render(ctx, world, director, ballY)
import { THEME, font } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { TACTICS, KEY_MOMENTS, MATCH_TIME, QUICK_TACTICS } from '../../data/match.js';
import { CAMERAS } from '../match/matchDirector.js';

const C = THEME.color;
const S = THEME.size;
const BH = THEME.button.minH;
const MODE_NAME = { watch: 'Watch', manage: 'Manage', play: 'Play' };
const MODE_LINE = { watch: 'The team plays · camera and 1× / 2×', manage: 'The team plays to your orders', play: 'You play: stick + Pass / Shoot / Tackle' };
const CAMERA_NAME = { full: 'Full pitch', follow: 'Follow', close: 'Close' };
const TAC_KEYS = QUICK_TACTICS; // (Milestone 9: the four quick ones stay below the pitch; the full set is in the Tactics sheet)

export function createModeUi({ layout, renderer, onTactics = null }) {
  let picker = false;
  let flash = null; // { text, t } — a short note after a team command

  const sr = () => layout.safeRect;
  const top = () => {
    const r = sr();
    const menu = { x: r.x + 24, y: r.y + 24, w: 200, h: BH };
    const mode = { x: r.x + r.w - 24 - 220, y: r.y + 24, w: 220, h: BH };
    const x = menu.x + menu.w + 16;
    return { menu, mode, score: { x, y: r.y + 24, w: mode.x - 16 - x, h: 150 } };
  };
  const barY = () => sr().y + sr().h - 24 - BH;
  const bar = (manage = false) => {
    const r = sr();
    const ids = manage && onTactics ? ['speed1', 'speed2', 'camera', 'tactics'] : ['speed1', 'speed2', 'camera'];
    const ws = manage && onTactics ? [130, 130, 360, 240] : [150, 150, 340];
    const gap = manage && onTactics ? 16 : 20;
    let x = r.x + (r.w - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1))) / 2;
    const y = barY();
    const out = {};
    ids.forEach((id, i) => {
      out[id] = { x, y, w: ws[i], h: BH };
      x += ws[i] + gap;
    });
    return out;
  };
  const PANEL_H = 16 + 40 + BH + 14 + 40 + BH + 16;
  const panel = () => {
    const r = sr();
    return { x: r.x + 16, y: barY() - 18 - PANEL_H, w: r.w - 32, h: PANEL_H };
  };
  const segs = () => {
    const p = panel();
    const colW = (p.w - 16 * 3) / 2;
    const segW = (colW - 16) / 3;
    const out = [];
    TAC_KEYS.forEach((key, g) => {
      const gx = p.x + 16 + (g % 2) * (colW + 16);
      const gy = p.y + 16 + Math.floor(g / 2) * (40 + BH + 14);
      const def = TACTICS[key];
      out.push({ key, label: def.label, lx: gx + 6, ly: gy + 18, opts: def.options.map((v, i) => ({ id: `tac:${key}:${v}`, key, value: v, name: def.names[i], r: { x: gx + i * (segW + 8), y: gy + 40, w: segW, h: BH } })) });
    });
    return out;
  };
  const pitchBottom = (mode) => (mode === 'manage' ? panel().y - 12 : barY() - 20);

  // --- the mode picker ------------------------------------------------------------------------------------------------
  const pickerRects = () => {
    const r = sr();
    const w = Math.min(900, r.w - 64);
    const row = BH + 40 + 16;
    const h = 100 + row * 4 + BH + 40;
    const x = r.x + (r.w - w) / 2;
    const y = r.y + Math.max(40, (r.h - h) / 2);
    const out = { panel: { x, y, w, h } };
    ['watch', 'manage', 'play', 'km'].forEach((id, i) => (out[`pick:${id}`] = { x: x + 40, y: y + 100 + row * i, w: w - 80, h: BH }));
    out['pick:close'] = { x: x + 40, y: y + h - 40 - BH, w: w - 80, h: BH };
    return out;
  };

  // --- the Key Moment offer -------------------------------------------------------------------------------------------
  const promptRects = (ballY) => {
    const r = sr();
    const h = 400;
    const t = top();
    const atTop = ballY != null && ballY > r.y + r.h * 0.5; // the ball low on screen: the offer goes up top
    const y = atTop ? t.score.y + t.score.h + 20 : r.y + r.h - 24 - h;
    const x = r.x + 24;
    const w = r.w - 48;
    const bw = (w - 80 - 24) / 2;
    return { panel: { x, y, w, h }, 'km:play': { x: x + 40, y: y + h - 36 - BH, w: bw, h: BH }, 'km:skip': { x: x + 40 + bw + 24, y: y + h - 36 - BH, w: bw, h: BH } };
  };

  const ui = {
    top,
    pitchBottom,
    get pickerOpen() {
      return picker;
    },
    closePicker() {
      picker = false;
    },
    rects(d, ballY = null) {
      const out = { menu: top().menu, mode: top().mode, score: top().score };
      if (d.km?.state === 'offer') return Object.assign(out, promptRects(ballY));
      if (picker) return Object.assign(out, pickerRects());
      if (d.mode !== 'play') {
        Object.assign(out, bar(d.mode === 'manage'));
        if (d.mode === 'manage') {
          out.panel = panel();
          for (const g of segs()) for (const o of g.opts) out[o.id] = o.r;
        }
      }
      return out;
    },
    // (true: used; the caller does nothing more with this tap)
    tap(p, d, ballY = null) {
      if (d.km?.state === 'offer') {
        const r = promptRects(ballY);
        if (hitRect(p, r['km:play'])) d.accept();
        else if (hitRect(p, r['km:skip'])) d.skip();
        return true; // the offer is modal
      }
      if (picker) {
        const r = pickerRects();
        for (const m of ['watch', 'manage', 'play'])
          if (hitRect(p, r[`pick:${m}`])) {
            d.setMode(m);
            picker = false;
          }
        if (hitRect(p, r['pick:km'])) d.setPrompts(!d.prompts);
        else if (hitRect(p, r['pick:close']) || !hitRect(p, r.panel)) picker = false;
        return true;
      }
      if (hitRect(p, top().mode)) {
        picker = true;
        return true;
      }
      if (d.mode === 'play') return false;
      const b = bar(d.mode === 'manage');
      if (b.tactics && hitRect(p, b.tactics)) return onTactics(), true;
      if (hitRect(p, b.speed1)) return d.setSpeed(1), true;
      if (hitRect(p, b.speed2)) return d.setSpeed(2), true;
      if (hitRect(p, b.camera)) return d.setCamera(CAMERAS[(CAMERAS.indexOf(d.camera) + 1) % CAMERAS.length]), true;
      if (d.mode === 'manage') {
        for (const g of segs())
          for (const o of g.opts)
            if (hitRect(p, o.r)) {
              if (d.setTactic(o.key, o.value)) flash = { text: `${g.label}: ${o.name}`, t: 0 };
              return true;
            }
        if (hitRect(p, panel())) return true;
      }
      return false;
    },
    update(dt) {
      if (flash && (flash.t += dt) > 1.6) flash = null;
    },

    render(ctx, world, d, ballY = null) {
      const t = top();
      // the Mode button
      drawButton(ctx, t.mode, `${MODE_NAME[d.mode].toUpperCase()} ▾`, { accent: d.mode === 'play' ? C.action : d.mode === 'manage' ? C.purple : C.progress, font: font(S.small, true) });
      if (d.mode !== 'play') {
        const b = bar(d.mode === 'manage');
        for (const s of MATCH_TIME.speeds) drawButton(ctx, b[`speed${s}`], `${s}×`, { accent: C.progress, selected: d.speed === s, disabled: world.done });
        drawButton(ctx, b.camera, `Camera: ${CAMERA_NAME[d.camera]}`, { accent: C.progress, disabled: world.done });
        if (b.tactics) drawButton(ctx, b.tactics, 'Tactics', { accent: C.purple, disabled: world.done });
        if (d.mode === 'manage') drawManage(ctx, d);
      }
      if (d.km?.state === 'live') drawChip(ctx, d);
      if (flash) drawFlash(ctx);
      if (picker && !d.km) drawPicker(ctx, d);
      if (d.km?.state === 'offer') drawPrompt(ctx, d, ballY);
    },
  };

  function panelBox(ctx, r, fill = C.panel) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = THEME.panel.line;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, THEME.panel.radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawManage(ctx, d) {
    panelBox(ctx, panel());
    const tac = d.tactics();
    for (const g of segs()) {
      text(ctx, g.label, g.lx, g.ly, { size: S.small, bold: true, color: C.textMuted, baseline: 'middle' });
      for (const o of g.opts) {
        const on = tac[o.key] === o.value;
        const r = o.r;
        ctx.save();
        ctx.fillStyle = on ? C.outline : C.panelAlt;
        ctx.strokeStyle = on ? C.purple : C.line;
        ctx.lineWidth = on ? 5 : 3;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h - 6, 18);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        text(ctx, o.name, r.x + r.w / 2, r.y + (r.h - 6) / 2 + 1, { size: 30, bold: true, color: on ? C.textOnDark : C.text, align: 'center', baseline: 'middle', maxWidth: r.w - 14 });
      }
    }
  }

  function drawChip(ctx, d) {
    const t = top();
    const name = KEY_MOMENTS.types[d.km.type]?.title ?? 'Key Moment';
    const msg = `KEY MOMENT · ${name.replace(/!$/, '')} · ${Math.ceil(d.secondsLeft)} s`;
    const w = Math.min(sr().w - 48, 760);
    const x = sr().x + (sr().w - w) / 2;
    const y = t.score.y + t.score.h + 12;
    ctx.save();
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 64, 32);
    ctx.fill();
    ctx.restore();
    text(ctx, msg, x + w / 2, y + 33, { size: S.small, bold: true, color: '#FFE14A', align: 'center', baseline: 'middle', maxWidth: w - 30 });
  }

  function drawFlash(ctx) {
    const t = top();
    const w = 620;
    const x = sr().x + (sr().w - w) / 2;
    const y = t.score.y + t.score.h + 84;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1.6 - flash.t) * 4);
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 64, 32);
    ctx.fill();
    text(ctx, flash.text, x + w / 2, y + 33, { size: S.small, bold: true, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: w - 30 });
    ctx.restore();
  }

  function drawPicker(ctx, d) {
    const r = pickerRects();
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, renderer.width, renderer.height);
    panelBox(ctx, r.panel);
    text(ctx, 'Match mode', r.panel.x + r.panel.w / 2, r.panel.y + 56, { size: S.heading, bold: true, align: 'center', baseline: 'middle' });
    for (const m of ['watch', 'manage', 'play']) {
      const b = r[`pick:${m}`];
      drawButton(ctx, b, MODE_NAME[m], { accent: m === 'play' ? C.action : m === 'manage' ? C.purple : C.progress, selected: d.userMode === m });
      text(ctx, MODE_LINE[m], b.x + b.w / 2, b.y + b.h + 22, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: b.w });
    }
    const k = r['pick:km'];
    drawButton(ctx, k, `Key Moments: ${d.prompts ? 'On' : 'Off'}`, { accent: d.prompts ? C.good : C.progress });
    text(ctx, d.prompts ? 'Watch / Manage pause to offer big chances, corners, late attacks and defences.' : 'No prompts: the team plays every moment itself.', k.x + k.w / 2, k.y + k.h + 22, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: k.w });
    drawButton(ctx, r['pick:close'], 'Close', { accent: C.progress });
  }

  function drawPrompt(ctx, d, ballY) {
    const r = promptRects(ballY);
    const p = r.panel;
    const def = KEY_MOMENTS.types[d.km.type] ?? { title: 'Key Moment', line: '' };
    panelBox(ctx, p, C.panelGold);
    text(ctx, 'KEY MOMENT', p.x + p.w / 2, p.y + 44, { size: S.small, bold: true, color: C.actionDark, align: 'center', baseline: 'middle' });
    text(ctx, def.title, p.x + p.w / 2, p.y + 104, { size: S.title, bold: true, align: 'center', baseline: 'middle', maxWidth: p.w - 60 });
    text(ctx, def.line, p.x + p.w / 2, p.y + 168, { size: S.body, align: 'center', baseline: 'middle', maxWidth: p.w - 60 });
    text(ctx, 'Turn these off in Mode ▾', p.x + p.w / 2, p.y + 218, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle' });
    drawButton(ctx, r['km:play'], 'Play it', { accent: C.action });
    drawButton(ctx, r['km:skip'], 'Skip', { accent: C.progress });
  }

  return ui;
}
