// The placeholder "club complex" (Milestone 0): the open slot's club name, badge, kit colours, manager, home area and
// Founder on a mown pitch. The real club complex scene arrives in Milestone 1. ‹ Menu goes back to the Main Menu.
import { THEME } from '../../../../core/Theme.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { card, text } from '../../../../core/ui/Kit.js';
import { founderById, colourById, areaById } from '../../data/setup.js';
import { drawBadge, drawKit, drawFounder, drawPitch } from '../ui/clubArt.js';

const C = THEME.color;
const S = THEME.size;

// club(): the open campaign's club record ({ n, data }) or null.
export function createClubScreen({ renderer, layout, assets, club, onMenu }) {
  const menuRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 220, h: 110 };
  };
  return {
    onTap(p) {
      if (hitRect(p, menuRect())) onMenu();
    },
    onBack() {
      onMenu();
      return true;
    },
    rectOf(id) {
      return id === 'menu' ? menuRect() : null;
    },
    render(ctx) {
      drawPitch(ctx, -2000, -2000, renderer.width + 4000, renderer.height + 4000);
      const o = club();
      const sr = layout.safeRect;
      drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
      if (!o) return;
      const c = o.data.club;
      const badge = { shape: c.badge.shape, symbol: c.badge.symbol, primary: c.colours.primary, secondary: c.colours.secondary };
      const cx = sr.x + sr.w / 2;
      // name plate
      const plate = { x: sr.x + 40, y: sr.y + 170, w: sr.w - 80, h: 190 };
      ctx.fillStyle = colourById(c.colours.primary).hex;
      ctx.strokeStyle = colourById(c.colours.secondary).hex;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.roundRect(plate.x, plate.y, plate.w, plate.h, 30);
      ctx.fill();
      ctx.stroke();
      text(ctx, c.name, cx, plate.y + 70, { size: S.major, bold: true, color: colourById(c.colours.primary).ink, align: 'center', baseline: 'middle', maxWidth: plate.w - 60 });
      text(ctx, `Club Manager ${c.manager} · ${areaById(c.area).name}`, cx, plate.y + 142, { size: S.body, bold: true, color: colourById(c.colours.primary).ink, align: 'center', baseline: 'middle', maxWidth: plate.w - 60 });
      // badge and kit
      const top = plate.y + plate.h + 50;
      const bw = Math.min(380, sr.w * 0.36);
      drawBadge(ctx, { x: cx - bw - 30, y: top, w: bw, h: bw * 1.2 }, badge);
      drawKit(ctx, { x: cx + 30, y: top, w: bw, h: bw * 1.2 }, c.colours.primary, c.colours.secondary);
      // the Founder
      const f = founderById(c.founder.id);
      const fr = { x: sr.x + 40, y: top + bw * 1.2 + 50, w: sr.w - 80, h: 260 };
      card(ctx, fr, 'normal');
      drawFounder(ctx, assets, { x: fr.x + 20, y: fr.y + 20, w: 220, h: 220 }, f, colourById(c.colours.primary).hex);
      text(ctx, 'Founding Player', fr.x + 270, fr.y + 34, { size: S.small, bold: true, color: C.textMuted });
      text(ctx, f?.name ?? c.founder.id, fr.x + 270, fr.y + 80, { size: S.title, bold: true, maxWidth: fr.w - 300 });
      text(ctx, f ? `${f.trait} · ${f.perk.name}` : '', fr.x + 270, fr.y + 160, { size: S.body, color: C.purple, bold: true, maxWidth: fr.w - 300 });
      // what comes next
      const note = { x: sr.x + 40, y: fr.y + fr.h + 40, w: sr.w - 80, h: 150 };
      ctx.fillStyle = C.chip;
      ctx.beginPath();
      ctx.roundRect(note.x, note.y, note.w, note.h, 28);
      ctx.fill();
      text(ctx, `Year ${o.data.date.year} · Month ${o.data.date.month} · Slot ${o.n}`, cx, note.y + 48, { size: S.body, bold: true, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: note.w - 40 });
      text(ctx, 'Your club complex is being built (Milestone 1).', cx, note.y + 104, { size: S.small, color: C.textOnDark, align: 'center', baseline: 'middle', maxWidth: note.w - 40 });
    },
  };
}
