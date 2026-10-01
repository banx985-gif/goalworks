// "Research complete!" (Milestone 13): a bright banner across the club for a few seconds when a node finishes — the
// Research icon, the node and what it gives. Several in a row wait their turn. It never takes a tap.
//   createResearchBanner({ layout, assets }) → { show(node), update(dt), render(ctx), active, current, shown }
import { THEME, font } from '../../../../core/Theme.js';
import { RESEARCH_ICON } from '../../data/research.js';

const C = THEME.color;
const LIFE = 4.2; // seconds on screen

export function createResearchBanner({ layout, assets }) {
  const queue = [];
  let cur = null; // { node, t }
  const shown = []; // every node shown (tests)

  const rect = () => {
    const sr = layout.safeRect;
    const w = Math.min(940, sr.w - 48);
    return { x: sr.x + (sr.w - w) / 2, y: sr.y + sr.h * 0.3, w, h: 230 };
  };

  return {
    show(node) {
      if (node) queue.push(node);
    },
    get active() {
      return !!cur || queue.length > 0;
    },
    get current() {
      return cur?.node ?? null;
    },
    get shown() {
      return shown.map((n) => n.id);
    },
    update(dt) {
      if (!cur && queue.length) {
        cur = { node: queue.shift(), t: 0 };
        shown.push(cur.node);
      }
      if (cur && (cur.t += dt) >= LIFE) cur = null;
    },
    render(ctx) {
      if (!cur) return;
      const r = rect();
      const a = Math.min(1, cur.t / 0.25, (LIFE - cur.t) / 0.5);
      const slide = (1 - Math.min(1, cur.t / 0.25)) * -40;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.roundRect(r.x + 6, r.y + slide + 10, r.w, r.h, 36);
      ctx.fill();
      ctx.fillStyle = C.panel;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y + slide, r.w, r.h, 36);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = C.gold;
      ctx.stroke();
      const s = r.h - 50;
      assets.draw(ctx, RESEARCH_ICON, r.x + 26, r.y + slide + 25, s, s);
      const tx = r.x + 26 + s + 24;
      const tw = r.x + r.w - 30 - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.purple;
      ctx.font = font(THEME.size.heading, true);
      ctx.fillText('Research complete!', tx, r.y + slide + 58, tw);
      ctx.fillStyle = C.text;
      ctx.font = font(THEME.size.body, true);
      ctx.fillText(`${cur.node.id} ${cur.node.name}`, tx, r.y + slide + 118, tw);
      ctx.fillStyle = C.textMuted;
      ctx.font = font(THEME.size.small);
      ctx.fillText(cur.node.gives, tx, r.y + slide + 172, tw);
      ctx.restore();
    },
  };
}
