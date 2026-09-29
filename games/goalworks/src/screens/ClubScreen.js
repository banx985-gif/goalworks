// The Club Complex (Milestone 1, bible §6): a small grassroots ground on a hidden 14×18 grid in the 3/4 dollhouse view.
// Grass, gravel paths, the fence and a few trees are drawn by code; the Starter Training Pitch, Manager Office and
// Scout Desk are their art at one scale. The run's Founder walks the loop pitch → office → scout desk → pitch along the
// paths (src/systems/complexWorld.js). Drag pans, pinch / wheel zooms (clamped to the ground); tapping the Founder or a
// station opens its bottom sheet (header + what is happening now). A temporary Training Pitch shortcut opens the same
// sheet as tapping the pitch. A long press on empty grass enters a placeholder Build Mode (banner + Done). ‹ Menu (or
// Back) returns to the Main Menu.
// Plan space lives in the world; only drawing and tapping go through the IsoProjection here.
//   createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug })   club() → { n, data } or null
import { THEME, font } from '../../../../core/Theme.js';
import { IsoProjection } from '../../../../core/IsoProjection.js';
import { Camera } from '../../../../core/Camera.js';
import { WorldGestures } from '../../../../core/WorldGestures.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { Selection } from '../../../../core/Selection.js';
import { isoPath } from '../../../../core/IsoRoom.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { founderById, colourById, POSITIONS } from '../../data/setup.js';
import { COMPLEX, STATIONS, PATHS, TREES, GATE_COL, PERSON, LOOK as L } from '../../data/complex.js';
import { createComplexWorld } from '../systems/complexWorld.js';

const C = THEME.color;
const S = THEME.size;
// Sprite detail steps: the smallest step at or above the camera zoom, so pictures are cached near the size they are
// drawn (a few cached sizes per picture, remade once when a pinch crosses a step).
const DETAIL_STEPS = [0.5, 0.7, 1.0, 1.4];
const detailFor = (zoom) => DETAIL_STEPS.find((d) => d >= zoom - 1e-3) ?? DETAIL_STEPS[DETAIL_STEPS.length - 1];
const TOP_OVERHANG = 360; // room above the grid's back corner for the pitch's floodlights

export function createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug = null }) {
  const W = renderer.width;
  const { cols, rows, cellSize: CELL, margin, fenceH } = COMPLEX;
  const { halfW: HW, halfH: HH } = COMPLEX.view;
  const iso = new IsoProjection({ tileSize: CELL, halfW: HW, halfH: HH, originX: margin + rows * HW, originY: margin + TOP_OVERHANG });
  const worldW = (cols + rows) * HW + margin * 2;
  const worldH = (cols + rows) * HH + TOP_OVERHANG + margin * 2;
  const camera = new Camera({ viewW: W, viewH: renderer.height, worldW, worldH });
  camera.minZoom = COMPLEX.zoom.min;
  camera.maxZoom = COMPLEX.zoom.max;
  const groundLayer = new CachedLayer({ width: worldW, height: worldH, draw: drawGround });
  const groundCap = Math.sqrt(COMPLEX.floorMaxPixels / (worldW * worldH));
  const groundScale = () => Math.min(renderer.pixelScale * detailFor(camera.zoom), groundCap);

  let world = null;
  let slotN = null;
  let founder = null;

  // --- where things are drawn (projected world) ------------------------------------------------------------------
  // A station's art: its width follows its footprint's diamond, and the footprint's front corner sits at look.foot.
  const artRect = (st) => {
    const { fp, look, art } = st.def;
    const w = (fp.w + fp.h) * HW * look.width;
    const h = w / assets.aspect(art);
    const cx = iso.corner(fp.col + fp.w / 2, fp.row + fp.h / 2).x;
    const front = iso.corner(fp.col + fp.w, fp.row + fp.h).y;
    const y = front - h * look.foot;
    return { x: cx - w / 2, y, w, h };
  };
  const feetOf = (p) => iso.toWorld(p.agent.x, p.agent.y);
  const personRect = (p) => {
    const f = feetOf(p);
    const h = PERSON.height;
    const w = h * assets.aspect(p.art);
    return { x: f.x - w / 2, y: f.y - h * PERSON.feet, w, h };
  };
  // The Founder is tapped on their body (the picture's transparent sides left out); a station on its art, less the
  // empty corners of the square picture.
  const tapRect = (it) => {
    if (it.kind === 'player') {
      const r = personRect(it);
      return { x: r.x + r.w * 0.24, y: r.y + r.h * 0.05, w: r.w * 0.52, h: r.h * (PERSON.feet - 0.05) };
    }
    const r = artRect(it);
    const foot = it.def.look.foot;
    return { x: r.x + r.w * 0.08, y: r.y + r.h * 0.1, w: r.w * 0.84, h: r.h * (foot - 0.1) };
  };
  // Draw order: plan x + y (further back first); a station by its footprint's middle.
  const depthOf = (it) => {
    if (it.kind === 'player') return it.agent.x + it.agent.y;
    if (it.kind === 'tree') return (it.col + it.row) * CELL;
    return (it.fp.col + it.fp.w / 2 + it.fp.row + it.fp.h / 2) * CELL;
  };
  const selection = new Selection(bus, { boundsOf: tapRect, depthOf: (it) => depthOf(it) + (it.kind === 'player' ? 100000 : 0), minHitSize: 90 });
  const trees = TREES.map((t) => ({ kind: 'tree', ...t }));

  // --- UI rects (screen) -----------------------------------------------------------------------------------------
  let buildMode = false;
  const menuRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 220, h: 110 };
  };
  const plateRect = () => {
    const m = menuRect();
    const sr = layout.safeRect;
    return { x: m.x + m.w + 20, y: m.y, w: sr.x + sr.w - 24 - (m.x + m.w + 20), h: m.h };
  };
  // The temporary shortcut (Milestone 1): opens the Training Pitch sheet, like tapping the pitch. The five-button bar
  // replaces it later.
  const shortcutRect = () => {
    const sr = layout.safeRect;
    const w = Math.min(560, sr.w - 48);
    return { x: sr.x + (sr.w - w) / 2, y: sr.y + sr.h - 24 - 130, w, h: 130 };
  };
  const bannerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: sr.w - 48, h: 190 };
  };
  const doneRect = () => {
    const b = bannerRect();
    return { x: b.x + b.w - 250, y: b.y + (b.h - 120) / 2, w: 226, h: 120 };
  };
  const onUi = (p) => (buildMode ? hitRect(p, bannerRect()) : hitRect(p, menuRect()) || hitRect(p, plateRect()) || hitRect(p, shortcutRect()));
  const overSheet = (p) => sheet.active && p.y >= sheet.rect().y;

  // The camera sees the ground between the top row (‹ Menu, club name) and the shortcut; grass fills the rest.
  function fitView() {
    const top = menuRect();
    const bottom = shortcutRect();
    camera.viewX = 0;
    camera.viewY = top.y + top.h + 12;
    camera.setView(W, bottom.y - 12 - camera.viewY);
  }
  function resetView() {
    fitView();
    camera.zoom = COMPLEX.zoom.start;
    const c = iso.cellCenter(7, 8.5); // the crossroads of the paths, the pitch above and the office to the right
    camera.centerOn(c.x, c.y);
  }

  // --- gestures and taps -----------------------------------------------------------------------------------------
  let active = false;
  const gestures = new WorldGestures({ camera, bus, isActive: () => active });
  const taps = []; // recent taps and what they hit (tests / debug)
  const pickAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    return selection.pick(w.x, w.y);
  };
  const cellAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    const plan = iso.toPlan(w.x, w.y);
    const c = { col: Math.floor(plan.x / CELL), row: Math.floor(plan.y / CELL) };
    return world?.grid.inBounds(c.col, c.row) ? c : null;
  };

  // --- sheets (style guide §3: header only for now — picture, name, one line, and what is happening now) ----------
  function menuFor(it) {
    const clubColour = colourById(club()?.data.club.colours.primary)?.hex ?? C.progress;
    if (it.kind === 'player') {
      const pos = POSITIONS[founder.position]?.name ?? founder.position;
      return {
        title: founder.name,
        subtitle: `${pos} · Founder`,
        art: founder.art,
        accent: clubColour,
        tag: { text: 'FOUNDER', color: C.purple },
        sections: [{ title: 'Now', lines: [world.stateOf(it)] }],
      };
    }
    return {
      title: it.def.name,
      subtitle: it.def.line,
      art: it.def.art,
      accent: C.progress,
      tag: { text: it.def.role.toUpperCase() },
      sections: [{ title: 'Now', lines: [world.stateOf(it)] }],
    };
  }
  function openSheet(id) {
    const it = world?.byId(id);
    if (!it) return;
    selection.select(it);
    sheet.open(() => (world?.byId(id) === it ? menuFor(it) : null));
    debug?.log(`sheet: ${id}`);
  }

  const screen = {
    camera,
    iso,
    selection,
    taps,
    get world() {
      return world;
    },
    get buildMode() {
      return buildMode;
    },
    get slot() {
      return slotN;
    },
    openSheet,
    // Tests: 'menu', 'plate', 'shortcut', 'done', 'banner'.
    rectOf(id) {
      return { menu: menuRect(), plate: plateRect(), shortcut: shortcutRect(), done: doneRect(), banner: bannerRect() }[id] ?? null;
    },
    // Screen point on the Founder's body or a station's art (tests): the visible middle of what a finger would tap.
    screenPointOf(id) {
      const it = world.byId(id);
      const r = tapRect(it);
      return camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.55);
    },
    screenPointOfCell(col, row) {
      const w = iso.cellCenter(col, row);
      return camera.worldToScreen(w.x, w.y);
    },
    inView(sx, sy) {
      return sx >= 0 && sx <= W && sy >= camera.viewY && sy <= camera.viewY + camera.viewH;
    },
    cellAt,
    pickAt,

    setBuildMode(on) {
      if (buildMode === on) return;
      buildMode = on;
      if (on) {
        sheet.close();
        selection.clear();
      }
      debug?.log(`Build Mode ${on ? 'on' : 'off'}`);
    },

    enter() {
      active = true;
      const o = club();
      if (!o) return;
      const f = founderById(o.data.club.founder.id);
      // A new world when another club is opened (positions start at the pitch); the same slot reopened keeps its view.
      if (!world || slotN !== o.n || founder !== f) {
        const sameSlot = slotN === o.n;
        founder = f;
        world = createComplexWorld({ founder: f });
        for (const it of [...selection.items]) selection.remove(it);
        for (const it of [...world.stations, ...world.people]) selection.add(it);
        slotN = o.n;
        if (!sameSlot) screen.viewSet = false;
      }
      screen.resize();
      if (!screen.viewSet) {
        screen.viewSet = true;
        resetView();
      }
    },
    exit() {
      active = false;
      gestures.reset();
      screen.setBuildMode(false);
      selection.clear();
    },
    resize() {
      camera.pixelScale = renderer.pixelScale;
      groundLayer.setPixelScale(groundScale());
      const cx = camera.x + camera.visibleW / 2;
      const cy = camera.y + camera.visibleH / 2;
      fitView();
      camera.centerOn(cx, cy);
    },
    update(dt) {
      world?.update(dt);
      if (!sheet.active && selection.selected) selection.clear();
    },
    onBack() {
      if (buildMode) screen.setBuildMode(false);
      else onMenu();
      return true;
    },

    onDown(p) {
      if (overSheet(p) || onUi(p)) return; // the buttons, the banner and the sheet never pan or pinch the ground
      gestures.down(p);
    },
    onUp(p) {
      gestures.up(p);
    },
    onDragStart(p) {
      gestures.dragStart(p);
    },
    onDrag(p) {
      gestures.drag(p);
    },
    onDragEnd(p) {
      gestures.dragEnd(p);
    },
    onWheel(p) {
      gestures.wheel(p);
    },
    onTap(p) {
      if (!world || gestures.multiTouch) return;
      const log = (picked) => {
        taps.push({ x: p.x, y: p.y, picked });
        if (taps.length > 50) taps.shift();
      };
      if (buildMode) {
        if (hitRect(p, doneRect())) screen.setBuildMode(false);
        return log(hitRect(p, doneRect()) ? 'done' : null);
      }
      if (hitRect(p, menuRect())) {
        onMenu();
        return log('menu');
      }
      if (hitRect(p, shortcutRect())) {
        openSheet('pitch');
        return log('shortcut');
      }
      if (hitRect(p, plateRect())) return log(null);
      const picked = pickAt(p.x, p.y);
      if (picked) openSheet(picked.id);
      else selection.clear();
      log(picked?.id ?? null);
    },
    // Long press on empty grass → Build Mode. On the Founder or a station it opens their sheet, like a tap.
    onHold(p) {
      if (!world || gestures.multiTouch || gestures.fingers > 1 || buildMode || onUi(p) || overSheet(p)) return;
      if (!screen.inView(p.x, p.y)) return;
      const picked = pickAt(p.x, p.y);
      if (picked) openSheet(picked.id);
      else if (cellAt(p.x, p.y)) screen.setBuildMode(true);
    },

    render(ctx) {
      ctx.fillStyle = L.outside;
      ctx.fillRect(0, 0, W, renderer.height);
      if (!world) {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        return;
      }
      camera.apply(ctx);
      groundLayer.setPixelScale(groundScale());
      groundLayer.renderView(ctx, { x: camera.x, y: camera.y, w: camera.visibleW, h: camera.visibleH });
      assets.detail = detailFor(camera.zoom);
      if (buildMode) drawBuildGrass(ctx);
      drawSelectionMark(ctx);
      const items = [...world.stations, ...trees, ...world.people].sort((a, b) => depthOf(a) - depthOf(b));
      for (const it of items) {
        if (it.kind === 'station') {
          const r = artRect(it);
          assets.draw(ctx, it.def.art, r.x, r.y, r.w, r.h);
        } else if (it.kind === 'tree') drawTree(ctx, it);
        else drawPlayer(ctx, it);
      }
      drawFrontFence(ctx);
      assets.detail = 1;
      camera.restore(ctx);
      for (const p of world.people) drawTag(ctx, p);
      if (buildMode) drawBanner(ctx);
      else {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        drawPlate(ctx);
        drawButton(ctx, shortcutRect(), 'Training Pitch', { accent: C.action });
      }
    },
  };

  // --- drawing ---------------------------------------------------------------------------------------------------
  function patch(g, pts, fill, stroke = null, lw = 2) {
    isoPath(g, pts);
    g.fillStyle = fill;
    g.fill();
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lw;
      g.stroke();
    }
  }
  // Grass in mown stripes, the gravel paths and the back fence — drawn once into the cached layer.
  function drawGround(g) {
    g.fillStyle = L.outside;
    g.fillRect(0, 0, worldW, worldH);
    g.lineJoin = 'round';
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) patch(g, iso.outline(c, r), Math.floor(c / 2) % 2 ? L.grassA : L.grassB);
    g.strokeStyle = L.grassLine;
    g.lineWidth = 1.2;
    for (let c = 0; c <= cols; c += 2) line(g, iso.corner(c, 0), iso.corner(c, rows));
    // Paths: gravel with a darker edge.
    for (const p of PATHS) patch(g, iso.outline(p.col + 0.08, p.row + 0.08, p.w - 0.16, p.h - 0.16), L.pathEdge);
    for (const p of PATHS) patch(g, iso.outline(p.col + 0.16, p.row + 0.16, p.w - 0.32, p.h - 0.32), L.path);
    // The gate: the long path runs out through the front fence.
    patch(g, [iso.corner(GATE_COL + 0.16, rows - 0.2), iso.corner(GATE_COL + 0.84, rows - 0.2), iso.corner(GATE_COL + 0.84, rows + 0.9), iso.corner(GATE_COL + 0.16, rows + 0.9)], L.path);
    // Soft shade under the stations (the art has its own base; this just seats it on the grass).
    for (const st of STATIONS) patch(g, iso.outline(st.fp.col - 0.05, st.fp.row - 0.05, st.fp.w + 0.1, st.fp.h + 0.1), L.fenceShade);
    // The back fence along row 0 and col 0.
    fence(g, 'row', 0, 0, cols);
    fence(g, 'col', 0, 0, rows);
  }
  function line(g, a, b) {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
  // A post-and-rail fence along a grid edge: dir 'row' runs along a row line (col a → b), 'col' along a col line.
  // skip: one gap left open for a gate (its two posts stay).
  function fence(g, dir, at, a, b, skip = null) {
    const P = (t, up) => {
      const p = dir === 'row' ? iso.corner(t, at) : iso.corner(at, t);
      return { x: p.x, y: p.y - up };
    };
    g.save();
    g.lineCap = 'round';
    for (let t = a; t < b; t++) {
      if (t === skip) continue;
      for (const h of [fenceH * 0.45, fenceH * 0.85]) {
        g.strokeStyle = L.fenceRail;
        g.lineWidth = 7;
        line(g, P(t, h), P(t + 1, h));
      }
    }
    g.strokeStyle = L.fencePost;
    g.lineWidth = 9;
    for (let t = a; t <= b; t++) line(g, P(t, 0), P(t, fenceH));
    g.restore();
  }
  // The front fence (col = cols, and row = rows with the gate) goes over everything on the ground.
  function drawFrontFence(ctx) {
    fence(ctx, 'col', cols, 0, rows);
    fence(ctx, 'row', rows, 0, cols, GATE_COL);
  }
  function drawTree(ctx, t) {
    const f = iso.corner(t.col, t.row);
    const r = t.r * HW;
    ctx.save();
    ctx.fillStyle = L.fenceShade;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = L.trunk;
    ctx.strokeStyle = L.outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(f.x - r * 0.14, f.y - r * 1.1, r * 0.28, r * 1.1, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = L.crown;
    ctx.beginPath();
    ctx.arc(f.x, f.y - r * 1.55, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = L.crownLight;
    ctx.beginPath();
    ctx.arc(f.x - r * 0.25, f.y - r * 1.8, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // The Founder: their picture, facing the way they walk (no bob, sway or shadow yet).
  function drawPlayer(ctx, p) {
    const r = personRect(p);
    const sx = p.agent.state === 'walking' && p.agent.path.length ? screenDir(p) : p.faceLast ?? 1;
    p.faceLast = sx;
    if (sx > 0) return void assets.draw(ctx, p.art, r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.translate(r.x + r.w / 2, 0);
    ctx.scale(-1, 1);
    assets.draw(ctx, p.art, -r.w / 2, r.y, r.w, r.h);
    ctx.restore();
  }
  // Which way the next step goes on screen: plan x grows to the right, plan y to the left.
  function screenDir(p) {
    const n = p.agent.path[0];
    const sx = n.x - p.agent.x - (n.y - p.agent.y);
    return Math.abs(sx) < 0.5 ? (p.faceLast ?? 1) : sx > 0 ? 1 : -1;
  }
  function drawSelectionMark(ctx) {
    const it = selection.selected;
    if (!it) return;
    ctx.save();
    ctx.strokeStyle = C.progress;
    ctx.lineWidth = 6;
    if (it.kind === 'player') {
      const f = feetOf(it);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, HW * 0.55, HH * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      isoPath(ctx, iso.outline(it.fp.col, it.fp.row, it.fp.w, it.fp.h));
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawBuildGrass(ctx) {
    const onStation = (c, r) => STATIONS.some((s) => c >= s.fp.col && c < s.fp.col + s.fp.w && r >= s.fp.row && r < s.fp.row + s.fp.h);
    ctx.save();
    ctx.lineWidth = 1.5;
    world.grid.forEachTile((c, r) => {
      if (onStation(c, r)) return;
      isoPath(ctx, iso.outline(c, r, 1, 1));
      ctx.fillStyle = L.buildTint;
      ctx.fill();
      ctx.strokeStyle = L.buildLine;
      ctx.stroke();
    });
    ctx.restore();
  }
  // The name tag over the Founder: a fixed size on screen at every zoom (text 28).
  const TAG_H = 48;
  function drawTag(ctx, p) {
    const r = personRect(p);
    const s = camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.02);
    if (s.y < camera.viewY || s.y > camera.viewY + camera.viewH) return;
    const label = p.name.split(' ')[0];
    ctx.save();
    ctx.font = font(PERSON.tagSize, true);
    const w = ctx.measureText(label).width + 36;
    const x = s.x - w / 2;
    const y = s.y - TAG_H - 4;
    ctx.fillStyle = colourById(club()?.data.club.colours.primary)?.hex ?? C.progress;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, TAG_H, TAG_H / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colourById(club()?.data.club.colours.primary)?.ink ?? '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.x, y + TAG_H / 2 + 1);
    ctx.restore();
  }
  // The club's name on a plate in its colours, beside ‹ Menu.
  function drawPlate(ctx) {
    const c = club()?.data.club;
    if (!c) return;
    const r = plateRect();
    const prim = colourById(c.colours.primary);
    ctx.save();
    ctx.fillStyle = prim.hex;
    ctx.strokeStyle = colourById(c.colours.secondary).hex;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 28);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, c.name, r.x + r.w / 2, r.y + r.h / 2, { size: S.body, bold: true, color: prim.ink, align: 'center', baseline: 'middle', maxWidth: r.w - 40 });
  }
  function drawBanner(ctx) {
    const b = bannerRect();
    ctx.save();
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, THEME.panel.radius);
    ctx.fill();
    ctx.restore();
    const tw = doneRect().x - b.x - 60;
    text(ctx, 'Build Mode', b.x + 36, b.y + 62, { size: S.title, bold: true, color: C.textOnDark, baseline: 'middle', maxWidth: tw });
    text(ctx, 'Nothing to build yet. Tap Done to leave.', b.x + 36, b.y + 132, { size: S.small, color: C.textOnDark, baseline: 'middle', maxWidth: tw });
    drawButton(ctx, doneRect(), 'Done', { accent: C.good });
  }

  return screen;
}
