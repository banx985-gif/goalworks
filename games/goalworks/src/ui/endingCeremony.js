// The Year-25 ending ceremony and the true ending (Milestone 29, bible §34 / SEC-NGP-05), in the Awards Night style
// (src/ui/awardsNight.js): full screen, one tap per step, "Skip all" (or Back) closes it. Rex Lamar hosts; Edith, Del,
// Priya and Sam speak their parts. Everything was graded and saved already (src/systems/ending.js): this only shows it.
//   Ending steps: the intro, the 8 parts (each with its voice, its score /10 counting up and a line), the total /80, the
//   grade (C … S+), then what comes next (the club carries on; New Game+ is open; 2× for good).
//   True ending steps: data/ending.js TRUE_ENDING, one voice each.
//   createEndingCeremony({ layout, assets }) → { open(ending, { club, onClose }), openTrue({ club, onClose }), close(),
//     active, step, steps, next(), skip(), update(dt), render(ctx), onTap(p), onBack(), skipRect(), nextRect() }
import { THEME, font } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text, para } from '../../../../core/ui/Kit.js';
import { drawCast } from './castArt.js';
import { HOST } from '../../data/cast.js';
import { TRUE_ENDING, ENDING } from '../../data/ending.js';

const C = THEME.color;
const S = THEME.size;
const STAGE = '#1F1A33';
const STAGE_HI = '#3A2F5C';
const GOLD = '#F2C14E';
const COUNT = 0.7; // seconds for a score to count up
const GRADE_COLOUR = { 'S+': '#FFD86B', S: GOLD, A: '#9FD18B', B: '#8CC4E8', C: '#C9BFE3' };

export function createEndingCeremony({ layout, assets }) {
  let rec = null;
  let mode = 'ending';
  let opts = {};
  let steps = [];
  let i = 0;
  let t = 0;

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
    cb?.({ skipped, mode });
  }
  function start(r, m, o) {
    rec = r;
    mode = m;
    opts = o;
    steps = m === 'true' ? TRUE_ENDING.map((s) => ({ kind: 'true', s })) : [{ kind: 'intro' }, ...r.parts.map((p) => ({ kind: 'part', p })), { kind: 'total' }, { kind: 'grade' }, { kind: 'next' }];
    i = 0;
    t = 0;
    return true;
  }
  const api = {
    get active() {
      return !!rec;
    },
    get mode() {
      return rec ? mode : null;
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
    open(ending, o = {}) {
      return ending ? start(ending, 'ending', o) : false;
    },
    openTrue(o = {}) {
      return start({ true: true }, 'true', o);
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
      text(ctx, mode === 'true' ? 'BEYOND FOOTBALL' : `THE YEAR ${ENDING.year} ENDING`, a.x + pad, a.y + 60, { size: S.heading, bold: true, color: GOLD, maxWidth: tw - 300 });
      text(ctx, opts.club ?? '', a.x + pad, a.y + 120, { size: S.small, color: C.textOnDark, maxWidth: tw - 300 });
      drawButton(ctx, skipRect(), 'Skip all', { accent: C.progress });
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
      // a cast member beside a picture (or alone, centred, when there is no picture); a face not loaded: the picture alone
      const withFace = (face, art) => {
        const fw = artBox * 0.62;
        const aw = artBox * 0.62;
        if (!art) return drawCast(ctx, assets, face, { x: cx - fw / 2, y: artY, w: fw, h: artBox });
        const x0 = cx - (fw + aw) / 2;
        if (!drawCast(ctx, assets, face, { x: x0, y: artY, w: fw, h: artBox })) return assets.drawContained(ctx, art, { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        assets.drawContained(ctx, art, { x: x0 + fw, y: artY + artBox - aw, w: aw, h: aw });
      };
      let y = artY + artBox + 40;
      const last = i >= steps.length - 1;
      if (s.kind === 'true') {
        withFace(s.s.face, i === steps.length - 1 ? 'trophy_09' : null);
        text(ctx, s.s.title, cx, y, { size: S.title, bold: true, color: GOLD, align: 'center', maxWidth: tw });
        y += 90;
        para(ctx, s.s.line, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
      } else if (s.kind === 'intro') {
        withFace(HOST, 'trophy_13');
        text(ctx, `Twenty-five years`, cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 90;
        para(ctx, `Your host, Rex Lamar: “A quarter of a century of ${opts.club ?? 'this club'}. Tonight the club is judged on eight things, each out of 10. Then the grade!”${rec.ng ? ` (New Game+ ${rec.ng})` : ''}`, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
      } else if (s.kind === 'part') {
        const p = s.p;
        withFace(p.voice, null);
        text(ctx, p.name, cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 70;
        text(ctx, p.what, cx, y, { size: S.small, color: '#C9BFE3', align: 'center', maxWidth: tw });
        y += 60;
        text(ctx, `${count(p.score)} / 10`, cx, y, { size: 120, bold: true, color: GOLD, align: 'center' });
        y += 150;
        if (t >= COUNT * 0.6) para(ctx, `“${p.line}”`, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
      } else if (s.kind === 'total') {
        assets.drawContained(ctx, 'trophy_13', { x: cx - artBox / 2, y: artY, w: artBox, h: artBox });
        text(ctx, `${count(rec.total)} / 80`, cx, y + 10, { size: 140, bold: true, color: GOLD, align: 'center' });
        y += 190;
        const bon = [rec.bonus?.his05 ? `+${rec.bonus.his05} Twenty-Five Years` : '', rec.bonus?.ng ? `+${rec.bonus.ng} New Game+ ${rec.ng}` : ''].filter(Boolean).join(' · ');
        para(ctx, `${rec.parts.map((p) => `${p.name} ${p.score}`).join(' · ')}${bon ? ` · ${bon}` : ''}`, a.x + pad, y, tw, { size: S.small, color: '#C9BFE3', align: 'center' });
      } else if (s.kind === 'grade') {
        withFace(HOST, rec.grade.startsWith('S') ? 'trophy_09' : 'trophy_17');
        text(ctx, rec.grade, cx, y + 40, { size: 200, bold: true, color: GRADE_COLOUR[rec.grade] ?? GOLD, align: 'center' });
        y += 220;
        para(ctx, rec.gradeLine, a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
      } else if (s.kind === 'next') {
        withFace('sam_okafor', 'ui_28');
        text(ctx, 'What now, boss?', cx, y, { size: S.title, bold: true, color: C.textOnDark, align: 'center', maxWidth: tw });
        y += 90;
        y += para(ctx, 'The club carries on: play as many more seasons as you like. 2× speed is yours for good, in every save.', a.x + pad, y, tw, { size: S.body, color: C.textOnDark, align: 'center' });
        y += 20;
        para(ctx, `New Game+ is open: a new club with a Legacy Player from your Hall of Fame, tougher rivals and deeper secrets. (This save stays as it is.)`, a.x + pad, y, tw, { size: S.small, color: '#C9BFE3', align: 'center' });
      }
      drawButton(ctx, nextRect(), last ? 'Done' : s.kind === 'intro' ? 'Begin ›' : 'Next ›', { accent: last ? C.good : C.action });
      ctx.font = font(S.small);
      ctx.restore();
    },
  };
  return api;
}
