// The Tactics screen (Milestone 9, bible §15): from the Squad screen (the temporary Team button) and the Manager Office.
// Top to bottom: the eight formations; tactical familiarity for the chosen formation + build style (a bar); the XI on a
// code-drawn pitch (formation lines are code — art list §2): each slot a disc with the shirt, the player and his role —
// drag a player (from the bench below, or another slot) onto a slot to put him there, tap a slot to set its role (or,
// with a bench player selected by a tap, to put him there); the bench (the rest of the squad) with Auto-pick XI; then the
// seven team instructions. Everything is saved in the run (src/systems/tactics.js) and used at the next kickoff.
//   createTacticsScreen({ layout, assets, sheet, club, onBack, onPlayer })   club() → the open campaign or null
import { THEME, font } from '../../../../core/Theme.js';
import { ScrollPanel } from '../../../../core/ui/ScrollPanel.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { card, text } from '../../../../core/ui/Kit.js';
import { POSITIONS, colourById } from '../../data/setup.js';
import { TACTICS } from '../../data/match.js';
import { FORMATIONS, formationById, ROLES, rolesForSlot, FAMILIARITY } from '../../data/tactics.js';
import { POSITION_ORDER } from '../../data/players.js';
import { overall } from '../systems/players.js';
import { normaliseTactics, familiarity, rolesOf, xiIds, setFormation, setInstruction, setRole, placePlayer, clearLineup } from '../systems/tactics.js';
import { formationLock } from '../systems/research.js';

const C = THEME.color;
const S = THEME.size;
const PAD = 24;
const GAP = 14;
const BH = THEME.button.minH;
const DISC = 58;

export function createTacticsScreen({ layout, assets, sheet, club, onBack, onPlayer = () => {} }) {
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
  let selected = null; // a bench player picked by a tap, waiting for a slot
  let drag = null; // { id, from: 'bench'|slot, x, y } — a player being dragged (screen coords)
  let lastRects = {};

  const playerById = (id) => data()?.squad.players.find((p) => p.id === id) ?? null;
  const shortName = (p) => (p ? p.name.split(' ').slice(-1)[0] : '—');

  // One pass over the content (content coordinates): draws with ctx, records every rect by id (for taps, drags, tests).
  function pass(ctx, rects = {}) {
    const d = data();
    const w = panelRect().w;
    const cw = w - PAD * 2;
    let y = PAD;
    if (!d) return { height: y, rects };
    const t = normaliseTactics(d);
    const f = formationById(t.formation);
    const box = (id, r) => (rects[id] = r);
    // --- formations ---
    if (ctx) text(ctx, 'Formation', PAD, y, { size: S.heading, bold: true });
    y += 66;
    const fw = (cw - GAP * 3) / 4;
    FORMATIONS.forEach((fm, i) => {
      const r = { x: PAD + (i % 4) * (fw + GAP), y: y + Math.floor(i / 4) * (BH + GAP), w: fw, h: BH };
      if (ctx) drawButton(ctx, r, fm.name, { accent: C.progress, selected: t.formation === fm.id, locked: !!formationLock(d, fm.id) }); // (M13) locked until R25
      box(`formation:${fm.id}`, r);
    });
    y += 2 * (BH + GAP) + 6;
    // (M13) the formations still locked, and what opens them
    const shut = FORMATIONS.filter((fm) => formationLock(d, fm.id));
    if (shut.length) {
      if (ctx) text(ctx, `Locked until Research R25 Formation Library: ${shut.map((fm) => fm.name).join(', ')}`, PAD, y + 14, { size: S.small, color: C.textMuted, baseline: 'middle', maxWidth: cw });
      y += 56;
    }
    // --- familiarity ---
    const fam = familiarity(d);
    if (ctx) {
      text(ctx, `Familiarity · ${f.name} ${TACTICS.build.names[TACTICS.build.options.indexOf(t.instr.build)]}`, PAD, y + 14, { size: S.small, bold: true, baseline: 'middle', maxWidth: cw * 0.7 });
      text(ctx, `${Math.round(fam)} / 100`, PAD + cw, y + 14, { size: S.small, bold: true, color: fam < FAMILIARITY.comfortable ? C.bad : C.good, align: 'right', baseline: 'middle' });
      const by = y + 38;
      ctx.save();
      ctx.fillStyle = C.panelAlt;
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(PAD, by, cw, 22, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = fam < FAMILIARITY.comfortable ? C.gold : C.good;
      ctx.beginPath();
      ctx.roundRect(PAD + 2, by + 2, Math.max(0, (cw - 4) * (fam / 100)), 18, 9);
      ctx.fill();
      const cx = PAD + cw * (FAMILIARITY.comfortable / 100);
      ctx.fillStyle = C.outline;
      ctx.fillRect(cx - 1.5, by - 4, 3, 30);
      ctx.restore();
      text(ctx, fam < FAMILIARITY.comfortable ? 'Not settled yet: positions drift and mistakes grow. Training and matches in it help.' : 'Settled: no penalty.', PAD, by + 52, { size: S.small, color: C.textMuted, maxWidth: cw });
    }
    y += 110;
    // --- the pitch ---
    const ph = Math.round(cw * 1.05);
    const pr = { x: PAD, y, w: cw, h: ph };
    box('pitch', pr);
    const ids = xiIds(d);
    const roles = rolesOf(d);
    const colours = d.club.colours;
    const kit = colourById(colours.primary);
    if (ctx) {
      ctx.save();
      ctx.fillStyle = '#4E9A3C';
      ctx.beginPath();
      ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 20);
      ctx.fill();
      ctx.clip();
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#5DAE48' : '#54A441';
        ctx.fillRect(pr.x, pr.y + (pr.h / 8) * i, pr.w, pr.h / 8);
      }
      ctx.strokeStyle = 'rgba(244,248,238,0.9)';
      ctx.lineWidth = 4;
      const m = 18;
      ctx.strokeRect(pr.x + m, pr.y + m, pr.w - m * 2, pr.h - m * 2);
      ctx.beginPath();
      ctx.moveTo(pr.x + m, pr.y + m + (pr.h - m * 2) * 0.12);
      ctx.lineTo(pr.x + pr.w - m, pr.y + m + (pr.h - m * 2) * 0.12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pr.x + pr.w / 2, pr.y + m + (pr.h - m * 2) * 0.12, pr.w * 0.13, 0, Math.PI);
      ctx.stroke();
      const bw = pr.w * 0.56;
      ctx.strokeRect(pr.x + (pr.w - bw) / 2, pr.y + pr.h - m - pr.h * 0.16, bw, pr.h * 0.16);
      ctx.restore();
      // formation lines between the slots of each line (code-drawn)
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      const byLine = {};
      f.slots.forEach((sl, i) => (byLine[sl.line + Math.round(sl.fy * 10)] ??= []).push(i));
      for (const list of Object.values(byLine)) {
        if (list.length < 2) continue;
        const pts = list.map((i) => slotPoint(pr, f.slots[i])).sort((a, b) => a.x - b.x);
        ctx.beginPath();
        pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.stroke();
      }
      ctx.restore();
    }
    f.slots.forEach((sl, i) => {
      const c = slotPoint(pr, sl);
      const r = { x: c.x - DISC - 20, y: c.y - DISC, w: (DISC + 20) * 2, h: DISC * 2 + 40 };
      box(`slot:${i}`, r);
      if (!ctx) return;
      const p = playerById(ids[i]);
      const hand = t.lineup[t.formation]?.[i] === ids[i];
      const hot = drag && hitRect(toScreen(c), expand(toScreen(r), 0)) && drag.from !== i;
      ctx.save();
      ctx.fillStyle = kit.hex;
      ctx.strokeStyle = hot ? '#FFE14A' : selected ? '#FFFFFF' : C.outline;
      ctx.lineWidth = hot ? 8 : selected ? 5 : 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y - 14, DISC * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      text(ctx, p?.shirt ? String(p.shirt) : String(i + 1), c.x, c.y - 14, { size: S.body, bold: true, color: kit.ink, align: 'center', baseline: 'middle' });
      ctx.save();
      ctx.fillStyle = 'rgba(30,40,20,0.72)';
      ctx.beginPath();
      ctx.roundRect(c.x - DISC - 16, c.y + 30, (DISC + 16) * 2, 62, 14);
      ctx.fill();
      ctx.restore();
      text(ctx, `${shortName(p)}${hand ? ' ✎' : ''}`, c.x, c.y + 46, { size: S.small, bold: true, color: '#FFFFFF', align: 'center', baseline: 'middle', maxWidth: (DISC + 12) * 2 });
      text(ctx, ROLES[roles[i]].name, c.x, c.y + 76, { size: S.small, color: '#FFE9A8', align: 'center', baseline: 'middle', maxWidth: (DISC + 12) * 2 });
    });
    y += ph + 26;
    // --- the bench ---
    if (ctx) {
      text(ctx, 'Bench', PAD, y, { size: S.heading, bold: true });
      text(ctx, selected ? 'Now tap a slot (or drag)' : 'Drag onto a slot, or tap then tap a slot', PAD + cw, y + 10, { size: S.small, color: selected ? C.actionDark : C.textMuted, align: 'right', maxWidth: cw * 0.6 });
    }
    y += 66;
    const inXi = new Set(ids);
    const bench = d.squad.players.filter((p) => !inXi.has(p.id)).sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || overall(b) - overall(a));
    const bw2 = (cw - GAP) / 2;
    bench.forEach((p, i) => {
      const r = { x: PAD + (i % 2) * (bw2 + GAP), y: y + Math.floor(i / 2) * (BH + GAP), w: bw2, h: BH };
      box(`bench:${p.id}`, r);
      if (!ctx) return;
      card(ctx, r, selected === p.id ? 'selected' : 'normal', { radius: 20 });
      const pos = POSITIONS[p.position];
      ctx.save();
      ctx.fillStyle = pos.colour;
      ctx.beginPath();
      ctx.roundRect(r.x + 14, r.y + (r.h - 44) / 2, 70, 44, 22);
      ctx.fill();
      ctx.restore();
      text(ctx, p.position, r.x + 49, r.y + r.h / 2, { size: S.small, bold: true, color: '#FFFFFF', align: 'center', baseline: 'middle' });
      text(ctx, p.name, r.x + 96, r.y + 36, { size: S.small, bold: true, baseline: 'middle', maxWidth: r.w - 110 });
      text(ctx, `OVR ${overall(p)}${p.fatigue > 70 ? ' · tired' : ''}`, r.x + 96, r.y + 74, { size: S.small, color: p.fatigue > 70 ? C.bad : C.textMuted, baseline: 'middle', maxWidth: r.w - 110 });
    });
    y += Math.ceil(bench.length / 2) * (BH + GAP) + 6;
    const auto = { x: PAD, y, w: cw, h: BH };
    box('auto', auto);
    if (ctx) drawButton(ctx, auto, 'Auto-pick XI (best by position)', { accent: C.progress });
    y += BH + 40;
    // --- team instructions ---
    if (ctx) text(ctx, 'Team instructions', PAD, y, { size: S.heading, bold: true });
    y += 66;
    for (const [key, def] of Object.entries(TACTICS)) {
      if (ctx) text(ctx, def.label, PAD, y + 16, { size: S.small, bold: true, color: C.textMuted, baseline: 'middle' });
      y += 40;
      const n = def.options.length;
      const ow = (cw - GAP * (n - 1)) / n;
      def.options.forEach((o, i) => {
        const r = { x: PAD + i * (ow + GAP), y, w: ow, h: BH };
        box(`instr:${key}:${o}`, r);
        if (ctx) drawButton(ctx, r, def.names[i], { accent: C.purple, selected: t.instr[key] === o, font: font(S.small, true) });
      });
      y += BH + 16;
    }
    return { height: y + PAD, rects };
  }

  // A slot's spot on the pitch picture (the team attacks up: fy 0.44 … 0.96 fills the pitch top to bottom).
  function slotPoint(pr, sl) {
    return { x: pr.x + 40 + sl.fx * (pr.w - 80), y: pr.y + 60 + ((sl.fy - 0.4) / 0.58) * (pr.h - 150) };
  }
  const toScreen = (r) => {
    const pr = panelRect();
    return r.w != null ? { x: pr.x + r.x, y: pr.y + r.y - scroll.scrollY, w: r.w, h: r.h } : { x: pr.x + r.x, y: pr.y + r.y - scroll.scrollY };
  };
  const expand = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 });
  const rects = () => pass(null).rects;
  const hitId = (p, prefix) => {
    const rs = rects();
    const c = scroll.toContent(p);
    return Object.keys(rs).find((k) => k.startsWith(prefix) && hitRect(c, rs[k])) ?? null;
  };

  function pickRole(slot) {
    const d = data();
    const f = formationById(normaliseTactics(d).formation);
    const sl = f.slots[slot];
    const p = playerById(xiIds(d)[slot]);
    const now = rolesOf(d)[slot];
    sheet.open(() => ({
      title: `Slot ${slot + 1}: ${POSITIONS[sl.pos].name}`,
      subtitle: p ? `${p.name} · OVR ${overall(p)} at ${POSITIONS[p.position].name}` : 'Empty',
      art: p?.portrait ?? null,
      accent: C.purple,
      sections: [
        {
          title: 'Role',
          buttons: rolesForSlot(sl).map((r) => ({ id: `role:${r}`, label: `${now === r ? '✓ ' : ''}${ROLES[r].name}`, selected: now === r, accent: C.purple, onTap: () => (setRole(d, slot, r), sheet.close()) })),
        },
        ...(p ? [{ title: 'Player', buttons: [{ id: 'detail', label: 'Player details', accent: C.progress, onTap: () => onPlayer(p.id) }] }] : []),
      ],
    }));
  }

  const screen = {
    // Tests: 'back', 'formation:<id>', 'slot:<i>', 'bench:<playerId>', 'auto', 'instr:<key>:<value>' → screen rect (null
    // off the panel)
    rectOf(id) {
      if (id === 'back') return headerRect();
      const r = rects()[id];
      if (!r) return null;
      const out = toScreen(r);
      const pr = panelRect();
      return out.y >= pr.y - 1 && out.y + out.h <= pr.y + pr.h + 1 ? out : null;
    },
    // the centre of a slot's disc on screen (a drag target)
    slotCentre(i) {
      const d = data();
      const f = formationById(normaliseTactics(d).formation);
      const pr = rects().pitch;
      return toScreen(slotPoint(pr, f.slots[i]));
    },
    scrollTo(id) {
      const r = rects()[id];
      if (r) {
        scroll.scrollY = r.y - 40;
        scroll.clamp();
      }
    },
    get selected() {
      return selected;
    },
    get dragging() {
      return drag;
    },
    pickRole,
    enter() {
      scroll.scrollY = 0;
      selected = null;
      drag = null;
    },
    exit() {
      drag = null;
    },
    onBack() {
      onBack();
      return true;
    },
    // A drag that starts on a bench player or a slot moves that player; anywhere else it scrolls.
    onDragStart(p) {
      const start = { x: p.startX ?? p.x, y: p.startY ?? p.y, id: p.id };
      if (scroll.contains(start)) {
        const b = hitId(start, 'bench:');
        const sl = hitId(start, 'slot:');
        if (b) drag = { id: b.slice(6), from: 'bench', x: p.x, y: p.y };
        else if (sl) drag = { id: xiIds(data())[+sl.slice(5)], from: +sl.slice(5), x: p.x, y: p.y };
        if (drag) return;
      }
      scroll.beginDrag(p);
    },
    onDrag(p) {
      if (drag) {
        drag.x = p.x;
        drag.y = p.y;
        // near the panel's edges: scroll along
        const pr = panelRect();
        if (p.y < pr.y + 80) scroll.scrollY -= 18;
        else if (p.y > pr.y + pr.h - 80) scroll.scrollY += 18;
        scroll.clamp();
        return;
      }
      scroll.drag(p);
    },
    onDragEnd(p) {
      if (drag) {
        const sl = hitId(p, 'slot:');
        if (sl && drag.id) placePlayer(data(), +sl.slice(5), drag.id);
        drag = null;
        selected = null;
        return;
      }
      scroll.endDrag(p);
    },
    onUp(p) {
      if (!drag) scroll.endDrag(p);
    },
    onWheel(p) {
      scroll.scrollY += p.deltaY ?? p.dy ?? 0;
      scroll.clamp();
    },
    onTap(p) {
      if (hitRect(p, headerRect())) return void onBack();
      if (!scroll.contains(p)) return;
      const d = data();
      const id = Object.keys(lastRects = rects()).find((k) => hitRect(scroll.toContent(p), lastRects[k]) && k !== 'pitch');
      if (!id || !d) return;
      const [kind, a, b] = id.split(':');
      if (kind === 'formation') {
        if (formationLock(d, a)) return; // (M13) locked until R25 Formation Library
        setFormation(d, a);
        selected = null;
      } else if (kind === 'instr') setInstruction(d, a, b);
      else if (kind === 'auto') {
        clearLineup(d);
        selected = null;
      } else if (kind === 'bench') selected = selected === a ? null : a;
      else if (kind === 'slot') {
        if (selected) {
          placePlayer(d, +a, selected);
          selected = null;
        } else pickRole(+a);
      }
    },
    render(ctx) {
      const hr = headerRect();
      const sr = layout.safeRect;
      drawButton(ctx, hr, '‹ Back', { accent: C.progress });
      const d = data();
      const t = d ? normaliseTactics(d) : null;
      text(ctx, 'Tactics', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 - 20, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
      text(ctx, t ? `${formationById(t.formation).name} · used at the next kickoff` : '', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 + 34, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: sr.w - 560 });
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
      if (drag && d) {
        // the dragged player follows the finger
        const p = playerById(drag.id);
        const x = drag.x;
        const y = drag.y;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = colourById(d.club.colours.primary).hex;
        ctx.strokeStyle = '#FFE14A';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(x, y - 60, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        text(ctx, shortName(p), x, y - 60, { size: S.small, bold: true, color: colourById(d.club.colours.primary).ink, align: 'center', baseline: 'middle', maxWidth: 96 });
      }
    },
  };
  return screen;
}
