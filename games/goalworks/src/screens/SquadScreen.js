// The Squad screen (Milestone 7): the 18-player senior squad and the 3-person youth watch list, reached from the Club
// Complex's temporary Team button (the real five-button bar comes later). One row per player: portrait (the Founder's
// art; a generated player's code-drawn silhouette in the kit colours), name, position, age, squad role and the
// positional overall. Tap a row → the Player Detail sheet: the five core stats as bars, the ten derived ratings, trait,
// contract, and the Founder tag. Drag scrolls. ‹ Club (or Back) returns to the Club Complex.
// Milestone 9: a row under the header — Tactics · Training (Milestone 10: · League).
// Milestone 8: a Training button opens the Training screen; each row shows fatigue; Player Detail gains a
// Condition section (fatigue, form, morale, injury risk stored for later) and the player's training.
//   createSquadScreen({ layout, assets, sheet, club, onBack, onTraining })   club() → the open campaign { data } or null
import { THEME } from '../../../../core/Theme.js';
import { ScrollPanel } from '../../../../core/ui/ScrollPanel.js';
import { drawButton, hitRect, isPressed } from '../../../../core/ui/Button.js';
import { card, text } from '../../../../core/ui/Kit.js';
import { POSITIONS, founderById, colourById } from '../../data/setup.js';
import { CORE, CORE_NAMES, DERIVED_KEYS, POSITION_ORDER } from '../../data/players.js';
import { derived, overall } from '../systems/players.js';
import { focusById, FATIGUE, FORM } from '../../data/training.js';
import { normaliseTraining } from '../systems/training.js';
import { drawSilhouette } from '../ui/clubArt.js';
import { silhouetteKey } from '../ui/kitArt.js';

const C = THEME.color;
const S = THEME.size;
const PAD = 24;
const ROW_H = 150;
const GAP = 14;

export function createSquadScreen({ layout, assets, sheet, club, onBack, onTraining = () => {}, onTactics = () => {}, onLeague = () => {} }) {
  const rowY = () => layout.safeRect.y + 24 + THEME.button.minH + 14;
  const rowRect = (i) => {
    const sr = layout.safeRect;
    const w = (sr.w - 48 - 28) / 3;
    return { x: sr.x + 24 + i * (w + 14), y: rowY(), w, h: THEME.button.minH };
  };
  const tacticsRect = () => rowRect(0);
  const trainingRect = () => rowRect(1);
  const leagueRect = () => rowRect(2);
  const headerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 220, h: THEME.button.minH };
  };
  const panelRect = () => {
    const sr = layout.safeRect;
    const y = rowY() + THEME.button.minH + 16;
    return { x: sr.x + 16, y, w: sr.w - 32, h: sr.y + sr.h - 24 - y };
  };
  const scroll = new ScrollPanel({ getRect: panelRect });
  const squad = () => club()?.data.squad ?? null;
  const colours = () => club()?.data.club.colours ?? { primary: 'green', secondary: 'white' };
  const sorted = (list) => list.slice().sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || (a.shirt ?? 99) - (b.shirt ?? 99) || overall(b) - overall(a));

  function portrait(ctx, p, r) {
    ctx.save();
    ctx.fillStyle = C.panelAlt;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    ctx.clip();
    const f = p.founder ? founderById(p.featuredId) : null;
    if (f && p.portrait) assets.drawCrop(ctx, p.portrait, f.face, r);
    else drawSilhouette(ctx, { x: r.x + 6, y: r.y + 8, w: r.w - 12, h: r.h - 8 }, colours().primary, colours().secondary);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = p.founder ? C.purple : C.line;
    ctx.lineWidth = p.founder ? 5 : 3;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.stroke();
    ctx.restore();
  }

  function row(ctx, p, r) {
    card(ctx, r, p.founder ? 'selected' : 'normal', { radius: 22 });
    if (isPressed(ctx, r)) {
      ctx.fillStyle = 'rgba(40, 30, 20, 0.14)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 22);
      ctx.fill();
    }
    portrait(ctx, p, { x: r.x + 14, y: r.y + 14, w: r.h - 28, h: r.h - 28 });
    const tx = r.x + r.h + 4;
    const ovrW = 116;
    const tw = r.x + r.w - ovrW - 24 - tx;
    const pos = POSITIONS[p.position];
    // name (+ shirt), then position chip · age · role
    text(ctx, `${p.shirt ? `${p.shirt}. ` : ''}${p.name}`, tx, r.y + 40, { size: S.body, bold: true, baseline: 'middle', maxWidth: tw });
    ctx.save();
    ctx.fillStyle = pos.colour;
    ctx.beginPath();
    ctx.roundRect(tx, r.y + 78, 76, 44, 22);
    ctx.fill();
    ctx.restore();
    text(ctx, p.position, tx + 38, r.y + 101, { size: S.small, bold: true, color: '#FFFFFF', align: 'center', baseline: 'middle' });
    const role = p.founder ? `Founder · ${p.contract.role}` : p.contract.role;
    const tired = p.fatigue > FATIGUE.riskFrom ? ' · tired' : '';
    text(ctx, `Age ${p.age} · ${role}${tired}`, tx + 92, r.y + 101, { size: S.small, color: tired ? C.bad : C.textMuted, baseline: 'middle', maxWidth: tw - 92 });
    // the overall
    const o = { x: r.x + r.w - ovrW - 18, y: r.y + 20, w: ovrW, h: r.h - 40 };
    ctx.save();
    ctx.fillStyle = p.tier === 'Rare' ? C.panelGold : C.panelAlt;
    ctx.strokeStyle = p.tier === 'Rare' ? C.gold : C.line;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(o.x, o.y, o.w, o.h, 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, String(overall(p)), o.x + o.w / 2, o.y + o.h / 2 - 10, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
    text(ctx, 'OVR', o.x + o.w / 2, o.y + o.h - 20, { size: S.small, bold: true, color: C.textMuted, align: 'center', baseline: 'middle' });
  }

  // One pass over the list (content coordinates): draws with ctx, returns the player under tap, records rects by id.
  function pass(ctx, tap = null, rects = null) {
    const w = panelRect().w;
    const cw = w - PAD * 2;
    let y = PAD;
    let hit = null;
    const sq = squad();
    if (!sq) return { height: y, hit };
    const section = (title, sub, list) => {
      if (ctx) {
        text(ctx, title, PAD, y, { size: S.heading, bold: true, maxWidth: cw * 0.6 });
        text(ctx, sub, PAD + cw, y + 10, { size: S.small, color: C.textMuted, align: 'right', maxWidth: cw * 0.4 });
      }
      y += 70;
      for (const p of sorted(list)) {
        const r = { x: PAD, y, w: cw, h: ROW_H };
        if (ctx) row(ctx, p, r);
        if (rects) rects[p.id] = r;
        if (tap && !hit && hitRect(tap, r)) hit = p;
        y += ROW_H + GAP;
      }
      y += 20;
    };
    section('Senior squad', `${sq.players.length} players`, sq.players);
    section('Watch list', 'reserve / youth', sq.watch);
    return { height: y + PAD, hit };
  }

  // The Player Detail sheet.
  function detail(p) {
    const cols = colours();
    const pos = POSITIONS[p.position];
    const d = derived(p);
    const art = p.founder && p.portrait ? p.portrait : silhouetteKey(assets, cols.primary, cols.secondary);
    const c = p.contract;
    return {
      title: p.name,
      subtitle: `${pos.name} · Age ${p.age} · ${p.tier} · Level ${p.level} · Overall ${overall(p)}`,
      art,
      accent: pos.colour,
      tag: p.founder ? { text: 'FOUNDER', color: C.purple } : p.watch ? { text: 'WATCH LIST' } : { text: c.role.toUpperCase() },
      sections: [
        { title: 'Core stats', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: p.stats[k], max: 100, color: pos.colour })) },
        { title: 'Ratings', bars: DERIVED_KEYS.map((k) => ({ label: k, value: d[k], max: 100, color: C.progress })) },
        { title: 'Trait', lines: [p.trait, ...(p.founder ? [`Founder Perk: ${founderById(p.featuredId).perk.name} — ${founderById(p.featuredId).perk.text}`] : [])] },
        {
          title: 'Condition',
          bars: [
            { label: 'Fatigue', value: Math.round(p.fatigue ?? 0), max: 100, color: (p.fatigue ?? 0) > FATIGUE.riskFrom ? C.bad : C.good },
            { label: 'Form', value: (p.form ?? 0) - FORM.min, max: FORM.max - FORM.min, color: (p.form ?? 0) >= 0 ? C.good : C.bad, text: `${(p.form ?? 0) > 0 ? '+' : ''}${(p.form ?? 0).toFixed(1)}` },
            { label: 'Morale', value: Math.round(p.morale ?? 50), max: 100, color: C.progress },
          ],
          lines: p.watch ? ['On the watch list: not training with the squad.'] : [trainingLine(p), ...((p.risk ?? 0) > 0 ? [`Injury risk: ${Math.round(p.risk * 100)}% (injuries arrive later)`] : [])],
        },
        {
          title: 'Contract',
          lines: [`${c.role} · ${c.years} year${c.years === 1 ? '' : 's'} left · ${c.salary.toLocaleString('en-GB')} a week`, 'Potential: not scouted yet'],
        },
      ],
    };
  }
  function trainingLine(p) {
    const tr = club()?.data ? normaliseTraining(club().data) : null;
    const team = tr ? focusById(tr.focus).name : '—';
    const ind = p.focus ? ` + ${focusById(p.focus).name}` : '';
    const today = p.today?.kind === 'train' ? ` · +${Math.round(p.today.xp)} XP today` : p.today?.kind === 'match' ? ' · match day' : p.today?.kind === 'dayoff' ? ' · day off' : '';
    return `Training: ${team}${ind}${today}`;
  }
  function openDetail(p) {
    sheet.open(() => detail(p));
  }

  const screen = {
    openDetail: (id) => {
      const sq = squad();
      const p = [...(sq?.players ?? []), ...(sq?.watch ?? [])].find((x) => x.id === id);
      if (p) openDetail(p);
    },
    // Tests: 'back', 'training', or a player id → that row's screen rect (null while it is scrolled out of the panel).
    rectOf(id) {
      if (id === 'back') return headerRect();
      if (id === 'training') return trainingRect();
      if (id === 'tactics') return tacticsRect();
      if (id === 'league') return leagueRect();
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
      if (hitRect(p, trainingRect())) return void onTraining();
      if (hitRect(p, tacticsRect())) return void onTactics();
      if (hitRect(p, leagueRect())) return void onLeague();
      if (!scroll.contains(p)) return;
      const hit = pass(null, scroll.toContent(p)).hit;
      if (hit) openDetail(hit);
    },
    render(ctx) {
      const hr = headerRect();
      const sr = layout.safeRect;
      drawButton(ctx, hr, '‹ Club', { accent: C.progress });
      drawButton(ctx, trainingRect(), 'Training', { accent: C.action });
      drawButton(ctx, tacticsRect(), 'Tactics', { accent: C.purple });
      drawButton(ctx, leagueRect(), 'League', { accent: C.good });
      const sq = squad();
      const cl = club()?.data.club;
      text(ctx, 'Squad', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 - 20, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
      text(ctx, cl ? `${sq?.players.length ?? 0} + ${sq?.watch.length ?? 0} on the watch list` : '', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 + 34, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: sr.w - 320 });
      const r = panelRect();
      ctx.fillStyle = C.panel;
      ctx.strokeStyle = cl ? colourById(cl.colours.primary).hex : C.outline;
      ctx.lineWidth = THEME.panel.line + 2;
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
