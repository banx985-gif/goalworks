// The stadium lot and the walking people on the Club Complex (Milestone 24), drawn for src/screens/ClubScreen.js.
//   • The stadium stands on a lot beside the ground's right-hand fence (data/stadium.js LOT; the stage's own size): its
//     stage picture (stages/club_stage_0N), the expansion pieces built round it (stadium/stadium_expansion_NN), a piece
//     still being built faded with its days left, and while a stage is being built a badge with the days left.
//   • The walking people (src/systems/walkers.js): their sheet's frame for the way they face (front / back, mirrored for
//     the other two diagonals), a soft shadow, the gods' small gold glow; fans recoloured into their palette (made once per
//     palette, at most one a frame — src/ui/castArt.js recolourSheet; the plain sheet until it is ready).
//   createComplexExtras({ assets, view: () => ({ iso, HW, HH, CELL }) })
//     → { lot(cols, rows, data), outsideItems(data, lot), drawStadium(ctx, it), drawPiece(ctx, it), drawWalker(ctx, w, opts),
//         stadiumRect(lot, data), tick() }
import { STAGES, PIECES, LOT, pieceById } from '../../data/stadium.js';
import * as STAD from '../systems/stadium.js';
import { sheetKey, drawSheetFrame, recolourSheet, recolouredSheet } from './castArt.js';

export const WALKER = { height: 185, shadow: 0.2 }; // a frame's drawn height at zoom 1 (one scale for every character)

export function createComplexExtras({ assets, view }) {
  const queue = []; // fans waiting for their recoloured sheet
  const queued = new Set();

  function lot(cols, rows, data) {
    const st = data ? STAD.stageNow(data) : STAGES[0];
    return { c0: cols + LOT.gap, r0: rows + LOT.front - st.lot, size: st.lot, stage: st };
  }
  // The stage picture: as wide as the lot's diamond × LOT.artWidth, the lot's front corner LOT.foot down the picture.
  function stadiumRect(L) {
    const { iso, HW } = view();
    const w = L.size * 2 * HW * LOT.artWidth;
    const h = w / assets.aspect(L.stage.art);
    const cx = iso.corner(L.c0 + L.size / 2, L.r0 + L.size / 2).x;
    const front = iso.corner(L.c0 + L.size, L.r0 + L.size).y;
    return { x: cx - w / 2, y: front - h * LOT.foot, w, h };
  }
  function pieceRect(L, def) {
    const { iso, HW } = view();
    const c = L.c0 + def.at.u * L.size;
    const r = L.r0 + def.at.v * L.size;
    const w = def.size * HW * 1.25;
    const h = w / assets.aspect(def.art);
    const f = iso.corner(c, r);
    return { x: f.x - w / 2, y: f.y - h * 0.82, w, h, col: c, row: r };
  }
  // The stadium and the pieces of its stage built (or being built) — drawn after the front fence, in front of it.
  function outsideItems(data, L) {
    const S = STAD.normaliseStadium(data);
    const P = S.project;
    const out = [{ kind: 'stadium', id: 'stadium', lot: L, depth: (L.c0 + L.r0 + L.size) * 1 }];
    for (const def of PIECES) {
      const built = S.pieces[def.id] != null;
      const building = P?.kind === 'piece' && P.id === def.id;
      if (!built && !building) continue;
      if (def.stage !== S.stage) continue; // (an older stage's piece is part of the bigger ground now: it still counts, unseen)
      const r = pieceRect(L, def);
      out.push({ kind: 'piece', id: def.id, def, lot: L, building, doneDay: building ? P.doneDay : null, col: r.col, row: r.row });
    }
    return out;
  }
  function drawStadium(ctx, it) {
    const r = stadiumRect(it.lot);
    assets.draw(ctx, it.lot.stage.art, r.x, r.y, r.w, r.h);
  }
  function drawPiece(ctx, it) {
    const r = pieceRect(it.lot, it.def);
    ctx.save();
    if (it.building) ctx.globalAlpha = 0.5;
    assets.draw(ctx, it.def.art, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  // --- walkers --------------------------------------------------------------------------------------------------------
  const keyOf = (w) => sheetKey(w.who);
  function sheetFor(w) {
    const key = keyOf(w);
    const img = key ? assets.get(key) : null;
    if (!img) return null;
    if (!w.palette) return { img };
    const done = recolouredSheet(w.palette, w.chibi, key);
    if (done) return { img: done.canvas, rowOf: done.rowOf };
    const qk = `${key}|${JSON.stringify(w.palette)}`;
    if (!queued.has(qk)) {
      queued.add(qk);
      queue.push({ img, palette: w.palette, chibi: w.chibi, key });
    }
    return { img }; // (the plain sheet until its colours are ready)
  }
  // One recolour a frame at most (each is ~0.5 M pixels; made once per palette, then cached).
  function tick() {
    const job = queue.shift();
    if (job) recolourSheet(job.img, job.palette, job.chibi, job.key);
  }
  function drawWalker(ctx, w, { still = false } = {}) {
    const s = sheetFor(w);
    if (!s) return false;
    const { iso, HW, HH, CELL } = view();
    const f = iso.toWorld(w.x * CELL, w.y * CELL);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, w.alpha ?? 1));
    if (w.glow) {
      // a god: a small gold glow round the feet
      const g = ctx.createRadialGradient(f.x, f.y - 20, 4, f.x, f.y - 20, HW * 0.5);
      g.addColorStop(0, 'rgba(255, 214, 90, 0.75)');
      g.addColorStop(1, 'rgba(255, 214, 90, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 20, HW * 0.5, HH * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(40, 70, 30, 0.2)';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, HW * WALKER.shadow, HH * WALKER.shadow, 0, 0, Math.PI * 2);
    ctx.fill();
    const anim = still && w.anim === 'walk' ? 'idle' : w.anim;
    drawSheetFrame(ctx, s.img, anim, w.facing ?? 'front', still ? 0 : w.t, f.x, f.y, WALKER.height, { mirror: !!w.mirror, rowOf: s.rowOf ?? null });
    ctx.restore();
    return true;
  }
  return { lot, outsideItems, stadiumRect, pieceRect, drawStadium, drawPiece, drawWalker, tick, pending: () => queue.length };
}
export { pieceById };
