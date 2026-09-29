// Main Menu (Milestone 0): a mown pitch with the GOALWORKS name drawn in code, then Continue (the last-used slot;
// hidden when there is no club yet), Campaign Slots, New Game and Settings (a placeholder sheet).
// Layout and tapping share one pass (lay out → draw and/or hit-test), so they can never disagree.
import { THEME, font } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { drawPitch, drawBadge } from '../ui/clubArt.js';

const C = THEME.color;
const S = THEME.size;
const BTN_H = 130;
const GAP = 28;

// continueInfo(): { n, summary } of the last-used slot, or null.
export function createMenuScreen({ renderer, layout, continueInfo, onContinue, onSlots, onNewGame, onSettings }) {
  const rects = {};

  function pass(ctx, tap) {
    for (const k of Object.keys(rects)) delete rects[k];
    const sr = layout.safeRect;
    const cx = sr.x + sr.w / 2;
    const li = continueInfo();
    let hit = null;
    const rows = [
      li && ['continue', 'Continue', () => onContinue(li.n), C.action],
      ['slots', 'Campaign Slots', onSlots, C.progress],
      ['new', 'New Game', onNewGame, li ? C.progress : C.action],
      ['settings', 'Settings', onSettings, C.progress],
    ].filter(Boolean);
    const blockH = 400 + 60 + rows.length * (BTN_H + GAP) + (li ? 150 : 0);
    let y = sr.y + Math.max(60, (sr.h - blockH) / 2 - 40);
    if (ctx) drawTitle(ctx, cx, y, sr.w);
    y += 400 + 60;
    const bw = Math.min(sr.w - 120, 820);
    for (const [id, label, fn, accent] of rows) {
      const r = { x: cx - bw / 2, y, w: bw, h: BTN_H };
      rects[id] = r;
      if (ctx) drawButton(ctx, r, label, { accent, font: font(id === 'continue' ? 44 : S.button, true) });
      if (tap && !hit && hitRect(tap, r)) hit = fn;
      y += BTN_H;
      if (id === 'continue') {
        if (ctx) {
          const m = li.summary;
          const chip = { x: cx - bw / 2, y: y + 14, w: bw, h: 110 };
          ctx.fillStyle = C.chip;
          ctx.beginPath();
          ctx.roundRect(chip.x, chip.y, chip.w, chip.h, 24);
          ctx.fill();
          drawBadge(ctx, { x: chip.x + 16, y: chip.y + 8, w: 80, h: 94 }, m);
          text(ctx, m.club, chip.x + 116, chip.y + 18, { size: S.body, bold: true, color: C.textOnDark, maxWidth: chip.w - 136 });
          text(ctx, `Slot ${li.n} · Club Manager ${m.manager} · Year ${m.year}, Month ${m.month}`, chip.x + 116, chip.y + 62, { size: S.small, color: C.textOnDark, maxWidth: chip.w - 136 });
        }
        y += 150;
      }
      y += GAP;
    }
    return hit;
  }

  function drawTitle(ctx, cx, y, w) {
    // a centre circle and halfway line behind the name
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, y + 200, 170, 0, Math.PI * 2);
    ctx.moveTo(cx - w, y + 200);
    ctx.lineTo(cx + w, y + 200);
    ctx.stroke();
    ctx.font = font(150, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#1B3A22';
    ctx.strokeText('GOALWORKS', cx, y + 200, w - 80);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('GOALWORKS', cx, y + 200, w - 80);
    ctx.restore();
    const tag = 'From a muddy local pitch to the Crown Premier League.';
    ctx.font = font(S.body, true);
    const tw = Math.min(ctx.measureText(tag).width, w - 120) + 48;
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(cx - tw / 2, y + 330, tw, 64, 32);
    ctx.fill();
    text(ctx, tag, cx, y + 362, { size: S.body, bold: true, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: w - 120 });
  }

  return {
    onTap(p) {
      pass(null, p)?.();
    },
    onBack() {
      return false; // the Main Menu is a root: the next Back leaves the app
    },
    render(ctx) {
      drawPitch(ctx, -2000, -2000, renderer.width + 4000, renderer.height + 4000);
      pass(ctx, null);
    },
    // Screen rect of a button (tests): 'continue', 'slots', 'new', 'settings'.
    rectOf(id) {
      pass(null, null);
      return rects[id] ?? null;
    },
  };
}
