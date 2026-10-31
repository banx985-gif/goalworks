// Awards Night (Milestone 21b): the full-screen ceremony on the last day of Month 12. One tap moves to the next step
// (the four voices revealed one at a time with their /10 and line, the total /40, then each award with its trophy); "Skip
// all" (or Back) closes it at once. Everything was already decided and saved by src/systems/verdicts.js: this only shows
// it. main.js opens it from its pop-up queue (never on top of a dialog or another pop-up) and pauses the calendar meanwhile.
//   createAwardsNight({ layout, assets }) → { open(record, { club, onClose }), close(), active, step, steps, next(), skip(),
//     update(dt), render(ctx), onTap(p), onBack(), skipRect(), nextRect() }
import { THEME, font } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text, para } from '../../../../core/ui/Kit.js';
import { itemName } from '../systems/items.js';
import { leagueById } from '../../data/league.js';
import { cupById } from '../../data/cups.js';

const C = THEME.color;
const S = THEME.size;
const STAGE = '#1F1A33';
const STAGE_HI = '#3A2F5C';
const GOLD = '#F2C14E';
const COUNT = 0.7; // seconds for a score to count up

const verdictWord = (t) => (t >= 38 ? 'A legendary season!' : t >= 32 ? 'A great season!' : t >= 24 ? 'A solid season' : t >= 16 ? 'A mixed season' : 'A season to forget');

export function createAwardsNight({ layout, assets }) {
  let rec = null;
  let opts = {};
  let steps = [];
  let i = 0;
  let t = 0;

  function build(r) {
    const out = [{ kind: 'intro' }];
    r.voices.forEach((v, n) => out.push({ kind: 'voice', v, n }));
    out.push({ kind: 'total' });
    for (const a of r.awards) out.push({ kind: 'award', a });
    if (r.great) out.push({ kind: 'great' });
    return out;
  }
  const area = () => layout.safeRect;
  const skipRect = () => {
    const a = area();
    return { x: a.x + a.w - 300, y: a.y + 30, w: 270, h: THEME.button.minH };
  };
  const nextRect = () => {
    const a = area();
    const w = Math.min(760, a.w - 80);
    return { x: a.x + (a.w - w) / 2, y: a.y + a.h - 200, w, h: 140 };
  };
  function close(skipped = false) {
    if (!rec) return;
    const cb = opts.onClose;
    rec = null;
    steps = [];
    cb?.({ skipped });
  }
  const api = {
    get active() {
      return !!rec;
    },
    get step() {
      return rec ? steps[i]?.kind ?? null : null;
    },
    get index() {
      return i;
    },
    get steps() {
      return steps.map((s) => s.kind);
    },
    open(record, o = {}) {
      if (!record) return false;
      rec = record;
      opts = o;
      steps = build(record);
      i = 0;
      t = 0;
      return true;
    },
    close,
    next() {
      if (!rec) return;
      if (i >= steps.length - 1) close(false);
      else {
        i++;
        t = 0;
      }
    },
    skip() {
      close(true);
    },
    update(dt) {
      if (rec) t += dt;
    },
    onTap(p) {
      if (!rec) return false;
      if (hitRect(p, skipRect())) api.skip();
      else api.next();
      return true;
    },
    onBack() {
      if (!rec) return false;
      api.skip();
      return true;
    },
    skipRect,
    nextRect,
    render(ctx) {
      if (!rec) return;
      const W = layout.renderer?.width ?? 1080;
      const H = layout.renderer?.height ?? 1920;
      const a = area();
      ctx.save();
      ctx.fillStyle = STAGE;
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, a.y + a.h * 0.38, 40, W / 2, a.y + a.h * 0.38, a.h * 0.55);
      g.addColorStop(0, STAGE_HI);
      g.addColorStop(1, STAGE);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const cx = a.x + a.w / 2;
      const pad = 60;
      const tw = a.w - pad * 2;
      text(ctx, 'AWARDS NIGHT', a.x + pad, a.y + 60, { size: S.heading, bold: true, color: GOLD, maxWidth: tw - 300 });
      text(ctx, `Year ${rec.year} · ${opts.club ?? ''}`, a.x + pad, a.y + 120, { size: S.small, color: C.textOnDark, maxWidth: tw - 300 });
      drawButton(ctx, skipRect(), 'Skip all', { accent: C.progress });
      // the step dots
      const n = steps.length;
      const dotGap = Math.min(54, (tw - 40) / Math.max(1, n));
      const dx0 = cx - ((n - 1) * dotGap) / 2;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = k === i ? GOLD : k < i ? '#8C7BB8' : '#4A4068';
        ctx.beginPath();
        ctx.arc(dx0 + k * dotGap, a.y + 220, k === i ? 13 : 9, 0, Math.PI * 2);
        ctx.fill();
      }
      const s = steps[i];
      const artBox = Math.min(520, a.w - 200);
      const artY = a.y + 290;
      const count = (target) => Math.round(target * Math.min(1, t / COUNT));
      const so = rec.voices.slice(0, s.kind === 'voice' ? s.n : 0).reduce((x, v) => x + v.score, 0);
      let y = artY + artBox + 40;
      if (s.kind === 'intro') {
        assets.drawContained(ctx, 'trophy_13', { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, 'The Season Review', cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 90;
        const r = rec.record;
        y += para(ctx, `${leagueById(rec.league)?.name ?? ''} · ${r.p} matches: ${r.w} won, ${r.d} drawn, ${r.l} lost · ${r.gf} scored, ${r.ga} conceded`, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
        y += 20;
        para(ctx, `Four voices give their verdict, each out of 10. Then the awards.${rec.partial ? ' (A short season: the review counts from the day this save was first opened in this version.)' : ''}`, a.x + pad, y, tw, { size: S.small, color: '#C9BFE3', align: 'center' });
      } else if (s.kind === 'voice') {
        const v = s.v;
        assets.drawContained(ctx, v.art, { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, v.name, cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 76;
        text(ctx, v.who, cx, y, { size: S.body, color: '#C9BFE3', align: 'center', maxWidth: tw });
        y += 70;
        text(ctx, `${count(v.score)} / 10`, cx, y, { size: 120, bold: true, color: GOLD, align: 'center' });
        y += 150;
        if (t >= COUNT * 0.6) y += para(ctx, v.line, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
        text(ctx, `Review so far: ${so + (t >= COUNT ? v.score : 0)} / 40`, cx, nextRect().y - 70, { size: S.small, color: '#C9BFE3', align: 'center' });
      } else if (s.kind === 'total') {
        assets.drawContained(ctx, rec.total >= 32 ? 'trophy_13' : 'trophy_17', { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, `${count(rec.total)} / 40`, cx, y + 10, { size: 140, bold: true, color: GOLD, align: 'center' });
        y += 190;
        text(ctx, verdictWord(rec.total), cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 90;
        para(ctx, rec.voices.map((v) => `${v.name.replace(/^The |^Your /, '')} ${v.score}`).join(' · '), a.x + pad, y, tw, { size: S.body, color: '#C9BFE3', align: 'center' });
      } else if (s.kind === 'award') {
        const aw = s.a;
        assets.drawContained(ctx, aw.art, { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, aw.name, cx, y, { size: S.title, bold: true, color: GOLD, align: 'center', maxWidth: tw });
        y += 80;
        text(ctx, aw.player, cx, y, { size: S.heading, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 70;
        y += para(ctx, aw.detail, a.x + pad, y, tw, { size: S.body, color: '#C9BFE3', align: 'center' });
        y += 16;
        const it = aw.item && !aw.item.refused ? `${itemName(aw.item)} ${aw.id === 'manager' ? 'for the Club Store' : aw.item.given ? `given to ${aw.player}` : 'waiting in the Club Store'}` : aw.item?.refused ? `no item: ${aw.item.refused}` : '';
        para(ctx, `+${aw.reputation} reputation${it ? ` · ${it}` : ''}`, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
      } else if (s.kind === 'great') {
        assets.drawContained(ctx, 'trophy_18', { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, 'A Great Team!', cx, y, { size: S.title, bold: true, color: GOLD, align: 'center', maxWidth: tw });
        y += 90;
        y += para(ctx, rec.honours.join(' · ') || (rec.cupsWon ?? []).map((id) => cupById(id)?.name).join(' · '), a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
        y += 20;
        para(ctx, 'This season and its XI join the Great Teams page in the Hall of Fame.', a.x + pad, y, tw, { size: S.small, color: '#C9BFE3', align: 'center' });
      }
      const last = i >= steps.length - 1;
      drawButton(ctx, nextRect(), last ? 'Done' : s.kind === 'intro' ? 'Begin ›' : 'Next ›', { accent: last ? C.good : C.action });
      ctx.font = font(S.small);
      ctx.restore();
    },
  };
  return api;
}
