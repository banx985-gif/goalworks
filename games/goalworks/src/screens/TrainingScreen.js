// The Training screen (Milestone 8, bible §13): reached from the Training Pitch sheet and from the Squad screen (the
// temporary Team button). Top: today's team session focus (the ten Batch 5 training icons, Rest / Recovery last) and the
// intensity (Light / Normal / Heavy — Heavy is overtraining: more XP, much more fatigue). Below: every senior player with
// fatigue, form and morale bars, today's XP and his individual focus (tap the focus button → a sheet to pick one, or
// "Team session only"). Tap a player's name → the Player Detail sheet. Drag scrolls. ‹ Back returns where it came from.
//   createTrainingScreen({ layout, assets, sheet, club, onBack, onPlayer })   club() → the open campaign or null
import { THEME, font } from '../../../../core/Theme.js';
import { ScrollPanel } from '../../../../core/ui/ScrollPanel.js';
import { drawButton, hitRect, isPressed } from '../../../../core/ui/Button.js';
import { card, text } from '../../../../core/ui/Kit.js';
import { POSITIONS } from '../../data/setup.js';
import { POSITION_ORDER } from '../../data/players.js';
import { FOCUSES, focusById, INTENSITY, FATIGUE, FORM } from '../../data/training.js';
import { overall } from '../systems/players.js';
import { normaliseTraining, dailyXp } from '../systems/training.js';

const C = THEME.color;
const S = THEME.size;
const PAD = 24;
const ROW_H = 222;
const GAP = 14;
const BH = THEME.button.minH;

export function createTrainingScreen({ layout, assets, sheet, club, onBack, onPlayer = () => {} }) {
  const headerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 220, h: BH };
  };
  const panelRect = () => {
    const h = headerRect();
    const sr = layout.safeRect;
    const y = h.y + h.h + 20;
    return { x: sr.x + 16, y, w: sr.w - 32, h: sr.y + sr.h - 24 - y };
  };
  const scroll = new ScrollPanel({ getRect: panelRect });
  const data = () => club()?.data ?? null;
  const training = () => (data() ? normaliseTraining(data()) : null);
  const players = () => (data()?.squad.players ?? []).slice().sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || (a.shirt ?? 99) - (b.shirt ?? 99));

  function bar(ctx, x, y, w, label, value, min, max, color, centre = false) {
    text(ctx, label, x, y + 14, { size: S.small, color: C.textMuted, baseline: 'middle' });
    const bx = x;
    const by = y + 32;
    const bh = 16;
    ctx.save();
    ctx.fillStyle = C.panelAlt;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, bh, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    const t = (value - min) / (max - min);
    if (centre) {
      const mid = bx + w / 2;
      const end = bx + w * t;
      ctx.fillRect(Math.min(mid, end), by + 2, Math.abs(end - mid), bh - 4);
    } else {
      ctx.beginPath();
      ctx.roundRect(bx + 2, by + 2, Math.max(0, (w - 4) * t), bh - 4, 6);
      ctx.fill();
    }
    ctx.restore();
  }

  // One pass over the content (content coordinates): draws with ctx, returns what a tap hit, records rects by id.
  function pass(ctx, tap = null, rects = null) {
    const w = panelRect().w;
    const cw = w - PAD * 2;
    let y = PAD;
    let hit = null;
    const tr = training();
    if (!tr) return { height: y, hit };
    const box = (r, what, id) => {
      if (rects && id) rects[id] = r;
      if (tap && !hit && hitRect(tap, r)) hit = what;
    };
    // --- the team session focus ---
    if (ctx) {
      text(ctx, 'Team session', PAD, y, { size: S.heading, bold: true, maxWidth: cw * 0.6 });
      text(ctx, focusById(tr.focus).name, PAD + cw, y + 10, { size: S.small, bold: true, color: C.actionDark, align: 'right', maxWidth: cw * 0.4 });
    }
    y += 70;
    const cols = 5;
    const tw = (cw - GAP * (cols - 1)) / cols;
    const th = 176;
    FOCUSES.forEach((f, i) => {
      const r = { x: PAD + (i % cols) * (tw + GAP), y: y + Math.floor(i / cols) * (th + GAP), w: tw, h: th };
      const on = tr.focus === f.id;
      if (ctx) {
        card(ctx, r, on ? 'selected' : 'normal', { radius: 20 });
        if (isPressed(ctx, r)) {
          ctx.fillStyle = 'rgba(40, 30, 20, 0.14)';
          ctx.beginPath();
          ctx.roundRect(r.x, r.y, r.w, r.h, 20);
          ctx.fill();
        }
        const s = Math.min(r.w - 24, r.h - 70);
        assets.drawContained(ctx, f.art, { x: r.x + (r.w - s) / 2, y: r.y + 8, w: s, h: s });
        text(ctx, f.name.replace(' / Recovery', ''), r.x + r.w / 2, r.y + r.h - 30, { size: S.small, bold: on, align: 'center', baseline: 'middle', color: on ? C.good : C.text, maxWidth: r.w - 12 });
      }
      box(r, { kind: 'team', id: f.id }, `focus:${f.id}`);
    });
    y += 2 * (th + GAP);
    const fdef = focusById(tr.focus);
    if (ctx && fdef.placeholder) text(ctx, `${fdef.name} gains its full meaning later (Milestone ${fdef.placeholder.slice(1)}); for now it trains a little of everything.`, PAD, y, { size: S.small, color: C.textMuted, maxWidth: cw });
    if (ctx && fdef.rest) text(ctx, 'Rest day: no XP, extra recovery for everyone.', PAD, y, { size: S.small, color: C.textMuted, maxWidth: cw });
    y += 50;
    // --- intensity ---
    if (ctx) text(ctx, 'Intensity', PAD, y, { size: S.heading, bold: true });
    y += 64;
    const iw = (cw - GAP * 2) / 3;
    Object.entries(INTENSITY).forEach(([id, def], i) => {
      const r = { x: PAD + i * (iw + GAP), y, w: iw, h: BH };
      if (ctx) drawButton(ctx, r, def.name, { accent: id === 'heavy' ? C.bad : id === 'light' ? C.good : C.progress, selected: tr.intensity === id });
      box(r, { kind: 'intensity', id }, `intensity:${id}`);
    });
    y += BH + 20;
    if (ctx) text(ctx, tr.intensity === 'heavy' ? 'Heavy: +25% XP but fatigue builds fast — rest tired players.' : tr.intensity === 'light' ? 'Light: less XP, less fatigue.' : 'Normal: steady XP and fatigue.', PAD, y, { size: S.small, color: tr.intensity === 'heavy' ? C.bad : C.textMuted, maxWidth: cw });
    y += 60;
    // --- the players ---
    if (ctx) {
      text(ctx, 'Players', PAD, y, { size: S.heading, bold: true });
      text(ctx, 'fatigue · form · morale · XP today', PAD + cw, y + 10, { size: S.small, color: C.textMuted, align: 'right', maxWidth: cw * 0.6 });
    }
    y += 70;
    for (const p of players()) {
      const r = { x: PAD, y, w: cw, h: ROW_H };
      const fb = { x: r.x + r.w - 250 - 16, y: r.y + 16, w: 250, h: BH };
      if (ctx) {
        card(ctx, r, p.founder ? 'selected' : 'normal', { radius: 22 });
        const pos = POSITIONS[p.position];
        ctx.save();
        ctx.fillStyle = pos.colour;
        ctx.beginPath();
        ctx.roundRect(r.x + 16, r.y + 20, 76, 44, 22);
        ctx.fill();
        ctx.restore();
        text(ctx, p.position, r.x + 54, r.y + 43, { size: S.small, bold: true, color: '#FFFFFF', align: 'center', baseline: 'middle' });
        text(ctx, `${p.name}`, r.x + 108, r.y + 32, { size: S.body, bold: true, baseline: 'middle', maxWidth: fb.x - r.x - 124 });
        const xpNow = dailyXp(p, tr, data().club.founder.id).xp;
        const last = p.today?.kind === 'train' ? `+${Math.round(p.today.xp)} XP today` : p.today?.kind === 'match' ? 'Match day' : p.today?.kind === 'dayoff' ? 'Day off' : `~${Math.round(xpNow)} XP a day`;
        text(ctx, `OVR ${overall(p)} · Age ${p.age} · ${last}`, r.x + 108, r.y + 72, { size: S.small, color: C.textMuted, baseline: 'middle', maxWidth: fb.x - r.x - 124 });
        const ind = p.focus ? focusById(p.focus).name.replace(' / Recovery', '') : 'Team only';
        drawButton(ctx, fb, ind, { accent: p.focus === 'rest' ? C.good : p.focus ? C.purple : C.progress, font: font(S.small, true) });
        const bw = (r.w - 32 - GAP * 2) / 3;
        const by = r.y + 138;
        bar(ctx, r.x + 16, by, bw, `Fatigue ${Math.round(p.fatigue)}`, p.fatigue, 0, 100, p.fatigue > FATIGUE.riskFrom ? C.bad : p.fatigue > 50 ? C.gold : C.good);
        bar(ctx, r.x + 16 + bw + GAP, by, bw, `Form ${p.form > 0 ? '+' : ''}${p.form.toFixed(1)}`, p.form, FORM.min, FORM.max, p.form >= 0 ? C.good : C.bad, true);
        bar(ctx, r.x + 16 + (bw + GAP) * 2, by, bw, `Morale ${Math.round(p.morale)}`, p.morale, 0, 100, C.progress);
      }
      box(fb, { kind: 'individual', id: p.id }, `ind:${p.id}`);
      box(r, { kind: 'player', id: p.id }, `row:${p.id}`);
      y += ROW_H + GAP;
    }
    return { height: y + PAD, hit };
  }

  // The individual-focus picker (a standard sheet).
  function pickIndividual(p) {
    sheet.open(() => ({
      title: `${p.name}: individual focus`,
      subtitle: `Team session: ${focusById(training().focus).name}. An individual focus takes ${Math.round((1 - 0.6) * 100)}% of the day.`,
      art: focusById(p.focus ?? training().focus).art,
      accent: C.purple,
      sections: [
        {
          title: `Fatigue ${Math.round(p.fatigue)} · Form ${p.form.toFixed(1)} · Morale ${Math.round(p.morale)}`,
          buttons: [
            { id: 'ind:none', label: `${!p.focus ? '✓ ' : ''}Team session only`, selected: !p.focus, accent: C.progress, onTap: () => ((p.focus = null), sheet.close()) },
            ...FOCUSES.map((f) => ({ id: `ind:${f.id}`, label: `${p.focus === f.id ? '✓ ' : ''}${f.name}`, icon: f.art, selected: p.focus === f.id, accent: f.rest ? C.good : C.purple, onTap: () => ((p.focus = f.id), sheet.close()) })),
          ],
        },
      ],
    }));
  }

  const screen = {
    // Tests: 'back', 'focus:<id>', 'intensity:<id>', 'ind:<playerId>', 'row:<playerId>' → screen rect (null off the panel)
    rectOf(id) {
      if (id === 'back') return headerRect();
      const rects = {};
      scroll.contentHeight = pass(null, null, rects).height;
      const r = rects[id];
      const pr = panelRect();
      if (!r) return null;
      const out = { x: pr.x + r.x, y: pr.y + r.y - scroll.scrollY, w: r.w, h: r.h };
      return out.y >= pr.y - 1 && out.y + out.h <= pr.y + pr.h + 1 ? out : null;
    },
    scrollTo(id) {
      const rects = {};
      scroll.contentHeight = pass(null, null, rects).height;
      if (rects[id]) {
        scroll.scrollY = rects[id].y - 40;
        scroll.clamp();
      }
    },
    pickIndividual: (id) => {
      const p = data()?.squad.players.find((x) => x.id === id);
      if (p) pickIndividual(p);
    },
    enter() {
      scroll.scrollY = 0;
    },
    onBack() {
      onBack();
      return true;
    },
    onDragStart: (p) => scroll.beginDrag(p),
    onDrag: (p) => scroll.drag(p),
    onDragEnd: (p) => scroll.endDrag(p),
    onUp: (p) => scroll.endDrag(p),
    onWheel(p) {
      scroll.scrollY += p.deltaY ?? p.dy ?? 0;
      scroll.clamp();
    },
    onTap(p) {
      if (hitRect(p, headerRect())) return void onBack();
      if (!scroll.contains(p)) return;
      const hit = pass(null, scroll.toContent(p)).hit;
      const tr = training();
      if (!hit || !tr) return;
      if (hit.kind === 'team') tr.focus = hit.id;
      else if (hit.kind === 'intensity') tr.intensity = hit.id;
      else if (hit.kind === 'individual') pickIndividual(data().squad.players.find((x) => x.id === hit.id));
      else if (hit.kind === 'player') onPlayer(hit.id);
    },
    render(ctx) {
      const hr = headerRect();
      const sr = layout.safeRect;
      drawButton(ctx, hr, '‹ Back', { accent: C.progress });
      const tr = training();
      text(ctx, 'Training', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 - 20, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
      text(ctx, tr ? `Daily · day off every ${FATIGUE.weekOff}th` : '', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 + 34, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: sr.w - 560 });
      const r = panelRect();
      ctx.fillStyle = C.panel;
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = THEME.panel.line;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, THEME.panel.radius);
      ctx.fill();
      ctx.stroke();
      scroll.begin(ctx);
      scroll.contentHeight = pass(ctx).height;
      scroll.end(ctx);
    },
  };
  return screen;
}
