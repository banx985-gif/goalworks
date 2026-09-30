// The Club Complex (Milestone 1, bible §6): a small grassroots ground on a hidden 14×18 grid in the 3/4 dollhouse view.
// Grass, gravel paths, the fence and a few trees are drawn by code; the Starter Training Pitch, Manager Office and
// Scout Desk are their art at one scale. The run's Founder walks the loop pitch → office → scout desk → pitch along the
// paths (src/systems/complexWorld.js). Drag pans, pinch / wheel zooms (clamped to the ground); tapping the Founder or a
// station opens its bottom sheet (header + what is happening now). A temporary Training Pitch shortcut opens the same
// sheet as tapping the pitch. A long press on empty grass enters a placeholder Build Mode (banner + Done). ‹ Menu (or
// Back) returns to the Main Menu.
// Milestone 2: under the top row, the calendar in simple code text (date + speed) until the real top bar arrives, the
// speed buttons (Pause · 1× · 2× only while a valid fixture is pending · 4× locked) and "Next match: … in N days". The
// Founder walks at the calendar's speed (and stands still while it is paused). On match day the shortcut becomes
// Match Setup. The Manager Office sheet gets the temporary Fixtures row (extraSections).
// Milestone 6: an art pass — early props on the grass off every walkway (cones, mannequins, the ball rack by the pitch, a
// laptop by the Scout Desk, a contract folder by the Office; data/complex.js PROPS), the club flag by the gate in the
// club colour with the badge on it, fence rails in the club colours, and the Founder walks with a gentle bob and breathes
// while standing (core/CharacterMotion; the bob only while actually walking, so they never glide).
// Milestone 7: a temporary Team button beside the shortcut opens the Squad screen (the five-button bar comes later).
// Milestone 8: squad players train on the pitch in a drill that follows today's team focus (shuttle runs between
// cones, passing / marking pairs, keepers in front of goal — data/complex.js DRILL), with core/CharacterMotion's bob; the
// players resting today (their own Rest focus, a Rest day, the day off) stand by the Clubhouse (facility_f02, scenery).
// Plan space lives in the world; only drawing and tapping go through the IsoProjection here.
//   createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug, calendar, onMatchSetup, extraSections, onTeam })
//     club() → { n, data } or null     calendar() → the open club's calendar (src/systems/calendar.js) or null
//     onMatchSetup() opens Match Setup     extraSections(stationId) → more sheet sections for that station
import { THEME, font } from '../../../../core/Theme.js';
import { IsoProjection } from '../../../../core/IsoProjection.js';
import { Camera } from '../../../../core/Camera.js';
import { WorldGestures } from '../../../../core/WorldGestures.js';
import { CachedLayer } from '../../../../core/CachedLayer.js';
import { Selection } from '../../../../core/Selection.js';
import { isoPath } from '../../../../core/IsoRoom.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { text } from '../../../../core/ui/Kit.js';
import { characterPose, drawCharacter } from '../../../../core/CharacterMotion.js';
import { drawClubFlag } from '../ui/kitArt.js';
import { drawBadge } from '../ui/clubArt.js';
import { founderById, colourById, POSITIONS } from '../../data/setup.js';
import { COMPLEX, STATIONS, PATHS, TREES, PROPS, GATE_COL, PERSON, LOOK as L, CLUBHOUSE, REST_SPOTS, DRILL } from '../../data/complex.js';
import { FRONT_BODIES, KEEPER_BODIES, BODY_ART } from '../../data/kits.js';
import { focusById } from '../../data/training.js';
import { bodyKey, headOf } from '../ui/kitArt.js';
import { kitFromColour } from '../match/kits.js';
import { createComplexWorld } from '../systems/complexWorld.js';

const C = THEME.color;
const S = THEME.size;
// Sprite detail steps: the smallest step at or above the camera zoom, so pictures are cached near the size they are
// drawn (a few cached sizes per picture, remade once when a pinch crosses a step).
const DETAIL_STEPS = [0.5, 0.7, 1.0, 1.4];
const detailFor = (zoom) => DETAIL_STEPS.find((d) => d >= zoom - 1e-3) ?? DETAIL_STEPS[DETAIL_STEPS.length - 1];
const TOP_OVERHANG = 360; // room above the grid's back corner for the pitch's floodlights

export function createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug = null, calendar = () => null, onMatchSetup = () => {}, extraSections = () => [], onTeam = () => {} }) {
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
    if (it.kind === 'tree' || it.kind === 'prop') return (it.col + it.row) * CELL;
    if (it.kind === 'drill') return it.depth;
    if (it.kind === 'clubhouse') return (CLUBHOUSE.col + CLUBHOUSE.w / 2 + CLUBHOUSE.row + CLUBHOUSE.h / 2) * CELL;
    return (it.fp.col + it.fp.w / 2 + it.fp.row + it.fp.h / 2) * CELL;
  };
  const selection = new Selection(bus, { boundsOf: tapRect, depthOf: (it) => depthOf(it) + (it.kind === 'player' ? 100000 : 0), minHitSize: 90 });
  const trees = TREES.map((t) => ({ kind: 'tree', ...t }));
  const props = PROPS.map((p) => ({ kind: 'prop', ...p }));
  let fenceFor = ''; // the club colours the cached back fence was drawn in
  let time = 0;
  const pose = { bob: 0, tilt: 0, flip: 1 };
  let drillTime = 0;
  const drillPose = { bob: 0, tilt: 0, flip: 1 };

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
  // Milestone 7: the bottom row is Team (left) and the shortcut (right).
  const bottomW = () => Math.min(500, (layout.safeRect.w - 48 - 20) / 2);
  const shortcutRect = () => {
    const sr = layout.safeRect;
    const w = bottomW();
    return { x: sr.x + sr.w / 2 + 10, y: sr.y + sr.h - 24 - 130, w, h: 130 };
  };
  const teamRect = () => {
    const sr = layout.safeRect;
    const w = bottomW();
    return { x: sr.x + sr.w / 2 - 10 - w, y: sr.y + sr.h - 24 - 130, w, h: 130 };
  };
  // The calendar strip (Milestone 2): date + speed text, the four speed buttons, the next-match line.
  const calRect = () => {
    const m = menuRect();
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: m.y + m.h + 16, w: sr.w - 48, h: 256 };
  };
  const SPEEDS = [0, 1, 2, 4];
  const speedRect = (s) => {
    const r = calRect();
    const gap = 14;
    const w = (r.w - 32 - gap * 3) / 4;
    const i = SPEEDS.indexOf(s);
    return { x: r.x + 16 + i * (w + gap), y: r.y + 72, w, h: THEME.button.minH };
  };
  let note = null; // { text, t } — why a speed tap was refused, shown for a moment on the next-match line
  const bannerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: sr.w - 48, h: 190 };
  };
  const doneRect = () => {
    const b = bannerRect();
    return { x: b.x + b.w - 250, y: b.y + (b.h - 120) / 2, w: 226, h: 120 };
  };
  const onUi = (p) => (buildMode ? hitRect(p, bannerRect()) : hitRect(p, menuRect()) || hitRect(p, plateRect()) || hitRect(p, calRect()) || hitRect(p, shortcutRect()) || hitRect(p, teamRect()));
  const overSheet = (p) => sheet.active && p.y >= sheet.rect().y;

  // The camera sees the ground between the calendar strip and the shortcut; grass fills the rest.
  function fitView() {
    const top = calRect();
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
      sections: [{ title: 'Now', lines: [world.stateOf(it)] }, ...extraSections(it.id)],
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
    // Tests: who is drilling / resting now ({ kind, focus, pitch: [ids], resting: [ids] }).
    drillState() {
      const items = drillItems();
      return { kind: drillKind(), focus: club()?.data.training?.focus ?? null, pitch: items.filter((i) => !i.resting && !i.cone).map((i) => i.id), resting: items.filter((i) => i.resting).map((i) => i.id) };
    },
    // Tests: the Founder's pose this frame ({ bob, tilt, flip }) and the props.
    get founderPose() {
      return { ...pose };
    },
    props,
    get buildMode() {
      return buildMode;
    },
    get slot() {
      return slotN;
    },
    openSheet,
    // Tests: 'menu', 'plate', 'shortcut', 'done', 'banner'.
    rectOf(id) {
      return { menu: menuRect(), plate: plateRect(), shortcut: shortcutRect(), team: teamRect(), done: doneRect(), banner: bannerRect(), calendar: calRect(), speed0: speedRect(0), speed1: speedRect(1), speed2: speedRect(2), speed4: speedRect(4) }[id] ?? null;
    },
    // The words on the calendar strip (tests): { date, speed, next }.
    calendarText() {
      return calendarLines();
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
      const cols = `${o.data.club.colours.primary}/${o.data.club.colours.secondary}`;
      if (cols !== fenceFor) {
        fenceFor = cols;
        groundLayer.invalidate(); // the back fence wears the club colours
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
      world?.update(dt * (calendar()?.clock.speed ?? 1)); // the Founder keeps the calendar's pace; still while paused
      time += dt;
      drillTime += dt * (calendar()?.clock.paused ? 0 : calendar()?.clock.speed ?? 1); // the drill runs with the calendar
      if (note && (note.t -= dt) <= 0) note = null;
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
      if (hitRect(p, teamRect())) {
        onTeam();
        return log('team');
      }
      if (hitRect(p, shortcutRect())) {
        if (calendar()?.atKickoff) {
          onMatchSetup();
          return log('matchSetup');
        }
        openSheet('pitch');
        return log('shortcut');
      }
      if (hitRect(p, plateRect())) return log(null);
      if (hitRect(p, calRect())) {
        const s = SPEEDS.find((sp) => hitRect(p, speedRect(sp)));
        const cal = calendar();
        if (s == null || !cal) return log(null);
        const r = cal.setSpeed(s);
        note = r.ok ? null : { text: r.why, t: 2.5 };
        debug?.log(r.ok ? `speed ${s}×` : `speed ${s}× refused: ${r.why}`);
        return log(`speed${s}`);
      }
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
      const items = [...world.stations, ...trees, ...props, { kind: 'clubhouse' }, ...drillItems(), ...world.people].sort((a, b) => depthOf(a) - depthOf(b));
      for (const it of items) {
        if (it.kind === 'station') {
          const r = artRect(it);
          assets.draw(ctx, it.def.art, r.x, r.y, r.w, r.h);
        } else if (it.kind === 'tree') drawTree(ctx, it);
        else if (it.kind === 'prop') drawProp(ctx, it);
        else if (it.kind === 'clubhouse') drawClubhouse(ctx);
        else if (it.kind === 'drill') drawDrill(ctx, it);
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
        drawCalendar(ctx);
        drawButton(ctx, teamRect(), 'Team', { accent: C.purple });
        if (calendar()?.atKickoff) drawButton(ctx, shortcutRect(), 'Match Setup', { accent: C.good });
        else drawButton(ctx, shortcutRect(), 'Training Pitch', { accent: C.action });
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
    const c = club()?.data.club;
    const top = c ? colourById(c.colours.primary).hex : L.fenceRail;
    const cap = c ? colourById(c.colours.secondary).hex : L.fencePost;
    for (let t = a; t < b; t++) {
      if (t === skip) continue;
      for (const h of [fenceH * 0.45, fenceH * 0.85]) {
        g.strokeStyle = h > fenceH * 0.5 ? top : L.fenceRail; // the top rail in the club's first colour
        g.lineWidth = 7;
        line(g, P(t, h), P(t + 1, h));
      }
    }
    g.strokeStyle = L.fencePost;
    g.lineWidth = 9;
    for (let t = a; t <= b; t++) line(g, P(t, 0), P(t, fenceH));
    g.fillStyle = cap; // post caps in the second colour
    g.strokeStyle = L.outline;
    g.lineWidth = 2;
    for (let t = a; t <= b; t++) {
      const p = P(t, fenceH);
      g.beginPath();
      g.arc(p.x, p.y, 6.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
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
  // The Founder: their picture facing the way they walk, a soft shadow, a gentle bob while walking (only while the
  // calendar runs, so a paused Founder stands still rather than stepping on the spot) and a slow breath while standing.
  function drawPlayer(ctx, p) {
    const r = personRect(p);
    const walking = p.agent.state === 'walking' && p.agent.path.length > 0 && !calendar()?.clock.paused;
    const sx = walking ? screenDir(p) : p.faceLast ?? 1;
    p.faceLast = sx;
    const f = feetOf(p);
    ctx.save();
    ctx.fillStyle = L.fenceShade;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, HW * 0.42, HH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    characterPose({ state: walking ? 'walking' : 'idle', facing: sx }, time, 1, pose);
    drawCharacter(ctx, assets, p.art, r.x + r.w / 2, r.y + r.h, r.w, r.h, pose);
  }
  // --- Milestone 8: the drill and the Clubhouse -------------------------------------------------------------------------
  const PITCH_DEPTH = (STATIONS[0].fp.col + STATIONS[0].fp.w / 2 + STATIONS[0].fp.row + STATIONS[0].fp.h / 2) * CELL;
  // Is the whole squad off today (a Rest session, the day off or match day)?
  function drillKind() {
    const d = club()?.data;
    const tr = d?.training;
    if (!d?.squad || !tr) return 'none';
    const today = d.squad.players[0]?.today?.kind;
    if (today === 'dayoff' || today === 'match' || focusById(tr.focus).rest) return 'rest';
    return DRILL.kindOf[tr.focus] ?? 'shuttle';
  }
  // The figures now: up to DRILL.maxOnPitch training (the XI first, the Founder walks on his own) and up to
  // DRILL.maxResting by the Clubhouse. Positions are plan units; everyone faces and bobs as they move.
  function drillItems() {
    const d = club()?.data;
    if (!d?.squad) return [];
    const kind = drillKind();
    const byShirt = d.squad.players.filter((p) => !p.founder).slice().sort((a, b) => (a.shirt ?? 99) - (b.shirt ?? 99));
    const rests = (p) => kind === 'rest' || p.focus === 'rest';
    const training = byShirt.filter((p) => !rests(p)).slice(0, DRILL.maxOnPitch);
    const resting = byShirt.filter(rests).slice(0, DRILL.maxResting);
    const out = [];
    const at = (col, row) => ({ x: col * CELL, y: row * CELL });
    training.forEach((p, i) => {
      let pos;
      let walking = false;
      let face = 1;
      if (kind === 'shuttle') {
        const lane = DRILL.lanes[i % DRILL.lanes.length] + Math.floor(i / DRILL.lanes.length) * 0.5;
        const span = DRILL.laneTo - DRILL.laneFrom;
        const t = drillTime * DRILL.runSpeed + i * 0.9;
        const k = (t % (span * 2)) / span; // 0 → 2 and back
        const u = k <= 1 ? k : 2 - k;
        pos = at(DRILL.laneFrom + span * u, lane);
        walking = !calendar()?.clock.paused;
        face = k <= 1 ? 1 : -1; // plan +col is screen right-down
      } else if (kind === 'pairs') {
        const pair = DRILL.pairs[Math.floor(i / 2) % DRILL.pairs.length];
        const spot = pair[i % 2];
        const sway = Math.sin(drillTime * 2 + i) * 0.15;
        pos = at(spot.col, spot.row + sway);
        face = i % 2 ? -1 : 1;
      } else {
        const spot = p.position === 'GK' ? DRILL.keeper : DRILL.shooters[i % DRILL.shooters.length];
        pos = at(spot.col + (p.position === 'GK' ? Math.sin(drillTime * 1.6) * 0.8 : 0), spot.row);
        walking = p.position === 'GK' && !calendar()?.clock.paused;
      }
      out.push({ kind: 'drill', id: p.id, p, ...pos, walking, face, resting: false, depth: Math.max(PITCH_DEPTH + 1, pos.x + pos.y) });
    });
    // cones (prop_01) at both ends of each shuttle lane in use
    if (kind === 'shuttle')
      DRILL.lanes.slice(0, Math.min(DRILL.lanes.length, training.length)).forEach((lane, j) => {
        for (const col of [DRILL.laneFrom - 0.25, DRILL.laneTo + 0.25]) {
          const pos = at(col, lane);
          out.push({ kind: 'drill', id: `cone${j}:${col}`, cone: true, ...pos, depth: PITCH_DEPTH + 0.5 + (pos.x + pos.y) / 1e4 });
        }
      });
    resting.forEach((p, i) => {
      const spot = REST_SPOTS[i % REST_SPOTS.length];
      const pos = at(spot.col, spot.row);
      out.push({ kind: 'drill', id: p.id, p, ...pos, walking: false, face: i % 2 ? -1 : 1, resting: true, depth: pos.x + pos.y });
    });
    return out;
  }
  // A figure: the match body in the club kit (keepers in their colour) with a head, on a soft shadow, bobbing.
  function drawDrill(ctx, it) {
    const c = club()?.data.club;
    if (!c) return;
    if (it.cone) {
      const f = iso.toWorld(it.x, it.y);
      assets.draw(ctx, 'prop_01', f.x - 22, f.y - 40, 44, 44);
      return;
    }
    const kit = kitFromColour(colourById(c.colours.primary).hex);
    kit.shorts = colourById(c.colours.secondary).hex;
    const gk = it.p.position === 'GK';
    const body = gk ? KEEPER_BODIES[0] : FRONT_BODIES[(it.p.shirt ?? 0) % FRONT_BODIES.length];
    const key = bodyKey(assets, body, kit);
    const f = iso.toWorld(it.x, it.y);
    const h = DRILL.height;
    ctx.save();
    ctx.fillStyle = L.fenceShade;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, HW * 0.3, HH * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    characterPose({ state: it.walking ? 'walking' : it.resting ? 'idle' : 'working', facing: it.face }, time, (it.p.shirt ?? 0) + 3, drillPose);
    drawCharacter(ctx, assets, key, f.x, f.y + h * 0.06, h, h, drillPose);
    const head = BODY_ART[body]?.head;
    if (head && assets.has(headOf({ name: c.name }, it.p))) {
      // the head, on the body's bald head (mirrored with it)
      const hs = h * head.r * 2.55;
      ctx.save();
      ctx.translate(f.x, f.y + h * 0.06 + drillPose.bob);
      if (drillPose.tilt) ctx.rotate(drillPose.tilt);
      if (drillPose.flip < 0) ctx.scale(-1, 1);
      assets.draw(ctx, headOf({ name: c.name }, it.p), -h / 2 + head.x * h - hs / 2, -h + head.y * h - hs * 0.56, hs, hs);
      ctx.restore();
    }
  }
  function drawClubhouse(ctx) {
    const { col, row, w: fw, h: fh, look, art } = CLUBHOUSE;
    const w = (fw + fh) * HW * look.width;
    const h = w / assets.aspect(art);
    const cx = iso.corner(col + fw / 2, row + fh / 2).x;
    const front = iso.corner(col + fw, row + fh).y;
    assets.draw(ctx, art, cx - w / 2, front - h * look.foot, w, h);
  }

  // A prop: its picture standing at its spot (on a small table for the laptop and folder); the flag in club colours.
  function drawProp(ctx, it) {
    const f = iso.corner(it.col, it.row);
    const c = club()?.data.club;
    if (it.flag) {
      if (c) drawClubFlag(ctx, assets, f.x, f.y, it.h, c);
      return;
    }
    let y = f.y;
    if (it.table) {
      const tw = it.h * 1.5;
      const th = it.h * 0.55;
      ctx.save();
      ctx.fillStyle = L.fenceShade;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, tw * 0.55, tw * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = L.fencePost;
      ctx.strokeStyle = L.outline;
      ctx.lineWidth = 3;
      for (const dx of [-0.36, 0.36]) {
        ctx.beginPath();
        ctx.rect(f.x + dx * tw - 4, f.y - th, 8, th);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = L.fenceRail;
      ctx.beginPath();
      ctx.roundRect(f.x - tw / 2, f.y - th - 12, tw, 16, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      y = f.y - th - 6;
    }
    const w = it.h * assets.aspect(it.art);
    assets.draw(ctx, it.art, f.x - w / 2, y - it.h * 0.92, w, it.h);
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
  // The club's name on a plate in its colours (with its badge), beside ‹ Menu.
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
    const bh = r.h - 16;
    drawBadge(ctx, { x: r.x + 14, y: r.y + 8, w: bh * 0.84, h: bh }, { ...c.badge, primary: c.colours.primary, secondary: c.colours.secondary });
    const tx = r.x + 14 + bh * 0.84 + 12;
    text(ctx, c.name, tx + (r.x + r.w - 20 - tx) / 2, r.y + r.h / 2, { size: S.body, bold: true, color: prim.ink, align: 'center', baseline: 'middle', maxWidth: r.x + r.w - 20 - tx });
  }
  // The calendar strip's words: the date, the speed, and the next match (or why a speed was refused).
  function calendarLines() {
    const cal = calendar();
    if (!cal) return null;
    const c = cal.clock;
    const f = cal.fixture;
    let next = 'No match scheduled';
    if (f && cal.atKickoff) next = `Match day: ${f.opponent.name}`;
    else if (f) next = `Next match: ${f.opponent.name} in ${cal.daysToMatch} day${cal.daysToMatch === 1 ? '' : 's'}`;
    return { date: `Year ${c.year} · Month ${c.month} · Day ${c.day}`, speed: c.paused ? 'Paused' : `${c.speed}×`, next, note: note?.text ?? null };
  }
  function drawCalendar(ctx) {
    const t = calendarLines();
    if (!t) return;
    const cal = calendar();
    const r = calRect();
    ctx.save();
    ctx.fillStyle = C.panel;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = THEME.panel.line;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, THEME.panel.radius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, t.date, r.x + 28, r.y + 38, { size: S.body, bold: true, baseline: 'middle', maxWidth: r.w - 260 });
    text(ctx, t.speed, r.x + r.w - 28, r.y + 38, { size: S.body, bold: true, color: cal.clock.paused ? C.bad : C.progress, align: 'right', baseline: 'middle' });
    for (const s of SPEEDS) {
      const label = s === 0 ? 'Pause' : `${s}×`;
      const locked = s !== 0 && !cal.clock.canUseSpeed(s);
      const temp = s === 2 && cal.temporary2x && !locked;
      drawButton(ctx, speedRect(s), label, { accent: temp ? C.good : C.progress, selected: cal.clock.speed === s, locked });
    }
    const lineY = r.y + 72 + THEME.button.minH + 38;
    if (t.note) text(ctx, t.note, r.x + 28, lineY, { size: S.small, bold: true, color: C.bad, baseline: 'middle', maxWidth: r.w - 56 });
    else text(ctx, t.next + (cal.temporary2x && !cal.atKickoff ? '  ·  2× open until kickoff' : ''), r.x + 28, lineY, { size: S.small, bold: !!cal.fixture, color: cal.fixture ? C.text : C.textFaint, baseline: 'middle', maxWidth: r.w - 56 });
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
