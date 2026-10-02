// The Club Complex (Milestone 1, bible §6; rebuilt on the facility layout in Milestone 12): the club's ground on a hidden
// grid in the 3/4 dollhouse view. Grass, the worn paths (gate → every facility), the fence and the trees are drawn by
// code; every facility is its art at one scale (data/facilities.js ART_LOOK). The run's Founder walks the loop pitch →
// office → scout desk → pitch, and the squad walk to the place for their session today and drill there
// (src/systems/complexWorld.js). Drag pans, pinch / wheel zooms (clamped to the ground); tapping the Founder or a
// facility opens its sheet (Milestone 12: the Facility Detail sheet — picture, effect, unlock, who is using it, Move /
// Sell). ‹ Menu (or Back) returns to the Main Menu.
// Milestone 2: under the top row, the calendar in simple code text (date + speed), the speed buttons (Pause · 1× · 2×
// only while a valid fixture is pending · 4× locked) and "Next match: … in N days". People walk at the calendar's speed
// (and stand still while it is paused). On match day the shortcut becomes Match Setup.
// Milestone 6: props by their facilities (cones, mannequins, the ball rack by the pitch, a laptop by the Scout Desk, a
// folder by the Office; data/complex.js PROPS), the club flag by the gate, fence rails in the club colours, the
// Founder's gentle walking bob (core/CharacterMotion).
// Milestone 7: Team (bottom left) opens the Squad screen. Milestone 8: the squad drill on a training pitch by today's
// team focus (shuttle runs, pairs, keepers in front of goal — data/complex.js DRILL); resting players stand by the
// Clubhouse (since M12: the Recovery Pool / Clubhouse they walk to).
// Milestone 12: Build Mode (long press on empty grass, or Build in the bottom row): a banner with Shop and Done; Shop
// (main's sheet, src/screens/buildSheets.js) or Move gives a ghost — its footprint green where it may stand, red with
// the reason where it may not; drag the ghost (or drag any facility straight away) to move it; tap a facility to pick
// it, then Move or Sell (50% back, after a confirm). The ground grows with the Club Rank; the camera keeps its spot.
// Milestone 12b: the Menu button at the right end of the bottom row (Settings → Show Menu button; it opens the Club Menu,
// main's sheet) and the next-step hint line just under the calendar strip (core/ui/HintLine; tapping it opens the right
// sheet). Low graphics: the figures stand still instead of bobbing.
// Milestone 12c: the Facility Detail sheet's Upgrade (paid now, finished on the calendar) and a code-drawn level badge
// (1 / 2 / 3, an arrow while an upgrade is under way) on every facility that levels.
//   createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug, calendar, onMatchSetup, extraSections,
//                      onTeam, onShop, detailSheet, confirm, onLayoutChanged, showMenu, onNavMenu, hint, lowFx, staffSheet })
// Milestone 14: the hired staff stand and work at their stations (src/systems/complexWorld.js), drawn like the Founder
// (core/CharacterMotion: a walking bob, a small working tilt), with a name tag in their role colour; tapping one opens
// their Staff card (staffSheet(staffId) → the sheet menu, from main).
//     club() → { n, data, layout } or null     calendar() → the open club's calendar or null
//     extraSections(defId, station) → more Facility Detail sections (Training, League …)
//     onShop() opens the Shop sheet          detailSheet(station, api) → the Facility Detail sheet menu
//     confirm({ title, body, yes, danger, onYes })    onLayoutChanged(reason) → save
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
import { rank as clubRank } from '../systems/league.js';
import { founderById, colourById, POSITIONS } from '../../data/setup.js';
import { COMPLEX, TREES, PROPS, PERSON, LOOK as L, DRILL } from '../../data/complex.js';
import { facilityById, ART_LOOK, ART_TWEAK, PITCHES } from '../../data/facilities.js';
import { FRONT_BODIES, KEEPER_BODIES, BODY_ART } from '../../data/kits.js';
import { bodyKey, headOf } from '../ui/kitArt.js';
import { kitFromColour } from '../match/kits.js';
import { createComplexWorld } from '../systems/complexWorld.js';
import { roleById } from '../../data/staff.js';
import { createDrawAudit } from '../ui/drawAudit.js';
import { flagKey } from '../ui/kitArt.js';

const C = THEME.color;
const S = THEME.size;
// Sprite detail steps: the smallest step at or above the camera zoom, so pictures are cached near the size they are
// drawn (a few cached sizes per picture, remade once when a pinch crosses a step).
const DETAIL_STEPS = [0.35, 0.5, 0.7, 1.0, 1.4];
const detailFor = (zoom) => DETAIL_STEPS.find((d) => d >= zoom - 1e-3) ?? DETAIL_STEPS[DETAIL_STEPS.length - 1];
const TOP_OVERHANG = 420; // room above the grid's back corner for a building's roof and the pitch's floodlights
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

export function createClubScreen({ renderer, layout, assets, bus, sheet, club, onMenu, debug = null, calendar = () => null, onMatchSetup = () => {}, extraSections = () => [], onTeam = () => {}, onResearch = () => {}, onShop = () => {}, detailSheet = null, confirm = null, onLayoutChanged = () => {}, showMenu = () => false, onNavMenu = () => {}, menuIcon = null, hint = null, lowFx = () => false, staffSheet = null }) {
  const W = renderer.width;
  const { cellSize: CELL, margin, fenceH } = COMPLEX;
  const { halfW: HW, halfH: HH } = COMPLEX.view;
  // The ground's size (cols × rows) is the club's stage; everything projected hangs off it.
  let cols = 11;
  let rows = 12;
  let iso = null;
  let worldW = 0;
  let worldH = 0;
  const camera = new Camera({ viewW: W, viewH: renderer.height, worldW: 100, worldH: 100 });
  camera.minZoom = COMPLEX.zoom.min;
  camera.maxZoom = COMPLEX.zoom.max;
  const groundLayer = new CachedLayer({ width: 100, height: 100, draw: drawGround });
  const groundScale = () => Math.min(renderer.pixelScale * detailFor(camera.zoom), Math.sqrt(COMPLEX.floorMaxPixels / (worldW * worldH)));
  function setGround(c, r) {
    // keep the camera on the same plan spot when the ground grows
    const mid = iso ? iso.toPlan(camera.x + camera.visibleW / 2, camera.y + camera.visibleH / 2) : null;
    cols = c;
    rows = r;
    iso = new IsoProjection({ tileSize: CELL, halfW: HW, halfH: HH, originX: margin + rows * HW, originY: margin + TOP_OVERHANG });
    worldW = (cols + rows) * HW + margin * 2;
    worldH = (cols + rows) * HH + TOP_OVERHANG + margin * 2;
    camera.minZoom = Math.min(COMPLEX.zoom.min, (W / worldW) * 1.05); // (pinch out far enough to see the whole ground)
    camera.setWorld(worldW, worldH);
    groundLayer.resize(worldW, worldH);
    groundLayer.invalidate();
    if (mid) {
      const w = iso.toWorld(mid.x, mid.y);
      camera.centerOn(w.x, w.y);
    }
  }
  setGround(cols, rows);

  let world = null;
  let slotN = null;
  let founder = null;
  let layoutSeen = -1; // the layout version the ground picture and the tap list were made for

  // --- where things are drawn (projected world) ------------------------------------------------------------------
  const lookOf = (def) => ({ ...ART_LOOK, ...(ART_TWEAK[def.id] ?? {}) });
  // A facility's art: its width follows its footprint's diamond (one scale for all), the footprint's front corner sits
  // at look.foot down the picture.
  const artRectFp = (def, fp) => {
    const look = lookOf(def);
    const w = (fp.w + fp.h) * HW * look.width;
    const h = w / assets.aspect(def.art);
    const cx = iso.corner(fp.col + fp.w / 2, fp.row + fp.h / 2).x;
    const front = iso.corner(fp.col + fp.w, fp.row + fp.h).y;
    return { x: cx - w / 2, y: front - h * look.foot, w, h };
  };
  const artRect = (st) => artRectFp(st.def, st.fp);
  const feetOf = (p) => iso.toWorld(p.agent.x, p.agent.y);
  const personRect = (p) => {
    const f = feetOf(p);
    const h = PERSON.height;
    const w = h * assets.aspect(p.art);
    return { x: f.x - w / 2, y: f.y - h * PERSON.feet, w, h };
  };
  // The Founder is tapped on their body (the picture's transparent sides left out); a facility on its art, less the
  // empty corners of the square picture.
  const tapRect = (it) => {
    if (it.kind === 'player' || it.kind === 'staff') {
      const r = personRect(it);
      return { x: r.x + r.w * 0.24, y: r.y + r.h * 0.05, w: r.w * 0.52, h: r.h * (PERSON.feet - 0.05) };
    }
    const r = artRect(it);
    const foot = lookOf(it.def).foot;
    return { x: r.x + r.w * 0.1, y: r.y + r.h * 0.12, w: r.w * 0.8, h: r.h * (foot - 0.12) };
  };
  // Draw order: plan x + y (further back first); a facility by its footprint's middle.
  const depthOf = (it) => {
    if (it.kind === 'player' || it.kind === 'walker' || it.kind === 'staff') return it.agent.x + it.agent.y;
    if (it.kind === 'tree' || it.kind === 'prop') return (it.col + it.row) * CELL;
    if (it.kind === 'drill') return it.depth;
    return (it.fp.col + it.fp.w / 2 + it.fp.row + it.fp.h / 2) * CELL;
  };
  const selection = new Selection(bus, { boundsOf: tapRect, depthOf: (it) => depthOf(it) + (it.kind === 'player' ? 100000 : it.kind === 'staff' ? 50000 : 0), minHitSize: 90 });
  let time = 0;
  const audit = createDrawAudit(assets); // (M12b) every facility, prop and figure drawn from a picture with something in it
  const pose = { bob: 0, tilt: 0, flip: 1 };
  const staffPose = { bob: 0, tilt: 0, flip: 1 }; // (M14; the Founder's pose stays readable for the tests)
  let staffSeen = -1; // the world's staffVersion the tap list was made for
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
  // The bottom row: Team · Build · Research (Milestone 13) · the shortcut (Training Pitch, or Match Setup on match day)
  // · (M12b) Menu, a square-ish icon button at the right end while Settings → Show Menu button is on.
  // The five-button bar replaces it later.
  const BOTTOM_N = 4;
  const MENU_W = 170;
  const bottomW = () => {
    const room = layout.safeRect.w - 48 - (showMenu() ? MENU_W + 20 : 0);
    return Math.min(400, (room - 20 * (BOTTOM_N - 1)) / BOTTOM_N);
  };
  const bottomRect = (i) => {
    const sr = layout.safeRect;
    const w = bottomW();
    const total = w * BOTTOM_N + 20 * (BOTTOM_N - 1) + (showMenu() ? MENU_W + 20 : 0);
    const x0 = sr.x + sr.w / 2 - total / 2;
    if (i === BOTTOM_N) return { x: x0 + BOTTOM_N * (w + 20), y: sr.y + sr.h - 24 - 130, w: MENU_W, h: 130 };
    return { x: x0 + i * (w + 20), y: sr.y + sr.h - 24 - 130, w, h: 130 };
  };
  const navRect = () => (showMenu() ? bottomRect(BOTTOM_N) : null);
  // (M12b) the next-step hint line: just under the calendar strip, over the top of the ground
  const hintRect = () => {
    const r = calRect();
    return { x: r.x + 12, y: r.y + r.h + 14, w: r.w - 24, h: 84 };
  };
  const hintOn = () => !buildMode && !!hint?.current;
  const teamRect = () => bottomRect(0);
  const buildRect = () => bottomRect(1);
  const researchRect = () => bottomRect(2);
  const shortcutRect = () => bottomRect(3);
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
  // Build Mode's banner: title + Credits, a message line, and its buttons along the bottom.
  const bannerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: sr.w - 48, h: 340 };
  };
  const onUi = (p) => (buildMode ? hitRect(p, bannerRect()) : (hintOn() && hitRect(p, hintRect())) || hitRect(p, navRect()) || hitRect(p, menuRect()) || hitRect(p, plateRect()) || hitRect(p, calRect()) || hitRect(p, shortcutRect()) || hitRect(p, teamRect()) || hitRect(p, buildRect()) || hitRect(p, researchRect()));
  const overSheet = (p) => sheet.active && p.y >= sheet.rect().y;

  // The camera sees the ground between the calendar strip and the bottom row; grass fills the rest.
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
    const g = world?.layout.gate ?? { col: 5, row: 11 };
    const c = iso.cellCenter(Math.min(cols / 2, g.col), rows * 0.55); // the middle of the ground, nearer the gate
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
  const planAt = (sx, sy) => {
    const w = camera.screenToWorld(sx, sy);
    return iso.toPlan(w.x, w.y);
  };
  const cellAt = (sx, sy) => {
    const plan = planAt(sx, sy);
    const c = { col: Math.floor(plan.x / CELL), row: Math.floor(plan.y / CELL) };
    return world?.grid.inBounds(c.col, c.row) ? c : null;
  };
  const stationAtCell = (c) => (c ? world.stations.find((s) => c.col >= s.fp.col && c.col < s.fp.col + s.fp.w && c.row >= s.fp.row && c.row < s.fp.row + s.fp.h) ?? null : null);

  // --- sheets: the Founder's, and the Facility Detail sheet --------------------------------------------------------
  function menuFor(it) {
    if (it.kind === 'staff') return staffSheet ? staffSheet(it.staffId) : { title: it.name, subtitle: world.stateOf(it), art: it.art, sections: [] };
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
    const users = [...world.staffAt(it.uid).map((f) => `${f.name} (${roleById(f.role)?.name ?? 'staff'})`), ...world.usersOf(it.uid).map((w) => w.p.name)];
    if (world.player.at === it.id || (!world.player.at && world.stateOf(it).includes('on the way'))) users.unshift(`${world.player.name} (Founder)`);
    const api = {
      now: world.stateOf(it),
      users,
      onMove: () => {
        sheet.close();
        startMove(it.uid);
      },
      onSell: () => askSell(it.uid),
      canSell: world.layout.canSell(it.uid),
      extra: extraSections(it.def.id, it),
      level: world.layout.levelInfo(it.uid), // (M12c)
      upgradeMsg,
      onUpgrade: () => {
        const r = world.layout.upgrade(it.uid, calendar()?.today ?? 0);
        upgradeMsg = r.ok ? null : r.reason;
        if (r.ok) {
          layoutChanged('facility:upgrade');
          debug?.log(`upgrade ${it.def.id} → level ${r.to} on day ${r.doneDay}`);
        }
      },
    };
    if (detailSheet) return detailSheet(it, api);
    return { title: it.def.name, subtitle: it.def.effect, art: it.def.art, accent: C.progress, tag: { text: it.def.role.toUpperCase() }, sections: [{ title: 'Now', lines: [api.now] }, ...api.extra] };
  }
  let upgradeMsg = null;
  function openSheet(id) {
    const it = world?.byId(id);
    if (!it) return;
    upgradeMsg = null;
    selection.select(it);
    sheet.open(() => (world?.byId(id) === it || (it.kind === 'station' && world?.byUid(it.uid)) ? menuFor(it.kind === 'station' ? world.byUid(it.uid) : it) : it.kind === 'staff' && staffSheet ? staffSheet(it.staffId) : null));
    debug?.log(`sheet: ${id}`);
  }

  // The tap list: every facility and the Founder (redone when the layout changes).
  function syncSelection() {
    for (const it of [...selection.items]) selection.remove(it);
    for (const it of [...world.stations, ...world.people]) selection.add(it);
    layoutSeen = world.layout.version;
    staffSeen = world.staffVersion;
    groundLayer.invalidate();
    paths = null;
  }
  // The layout changed (Build Mode, or the ground grew): the world re-paths, the ground is redrawn.
  function layoutChanged(reason) {
    const st = world.layout.stage;
    if (st.cols !== cols || st.rows !== rows) setGround(st.cols, st.rows);
    world.refreshLayout();
    syncSelection();
    if (reason) onLayoutChanged(reason);
  }

  // --- Build Mode (Milestone 12) -------------------------------------------------------------------------------------
  // ghost: { defId, uid (a facility being moved) | null (a new one), col, row, res ({ ok, reason }) }
  // picked: the uid of the facility tapped in Build Mode (Move / Sell in the banner)
  // press / drag: a finger that went down on the ghost or a facility (dragging it moves it, not the camera)
  const B = { ghost: null, picked: null, press: null, drag: null, msg: null };
  const say = (t, bad = false) => (B.msg = { text: t, bad, t: 4 });
  function ghostAt(col, row) {
    const g = B.ghost;
    const def = facilityById(g.defId);
    g.col = Math.max(0, Math.min(cols - def.w, col));
    g.row = Math.max(0, Math.min(rows - def.h, row));
    g.res = world.layout.check(g.defId, g.col, g.row, g.uid);
    B.msg = null; // (the banner shows whether it fits here now)
    if (g.res.ok && g.uid == null) {
      const can = world.layout.canBuy(g.defId);
      if (!can.ok) g.res = can;
    }
  }
  function centerOnCells(col, row, w, h) {
    const c = iso.corner(col + w / 2, row + h / 2);
    camera.centerOn(c.x, c.y);
  }
  // From the Shop: a ghost of the new facility at the nearest free spot to the middle of the view.
  function startBuild(defId) {
    if (!world) return;
    sheet.close();
    screen.setBuildMode(true);
    const def = facilityById(defId);
    const mid = planAt(W / 2, camera.viewY + camera.viewH / 2);
    const near = { col: Math.floor(mid.x / CELL), row: Math.floor(mid.y / CELL) };
    const at = world.layout.findSpot(defId, near) ?? { col: Math.max(0, near.col - 1), row: Math.max(0, near.row - 1) };
    B.picked = null;
    B.ghost = { defId, uid: null };
    ghostAt(at.col, at.row);
    centerOnCells(B.ghost.col, B.ghost.row, def.w, def.h);
    say(B.ghost.res.ok ? 'Drag it where you want it, then Place.' : B.ghost.res.reason, !B.ghost.res.ok);
    debug?.log(`build: ${defId}`);
  }
  function startMove(uid) {
    const it = world?.layout.item(uid);
    if (!it) return;
    screen.setBuildMode(true);
    B.picked = null;
    B.ghost = { defId: it.def.id, uid };
    ghostAt(it.col, it.row);
    say('Drag it to its new spot, then Move here.');
  }
  // Place the ghost (a new facility: pay for it) or finish moving it.
  function commitGhost() {
    const g = B.ghost;
    if (!g) return false;
    const def = facilityById(g.defId);
    const r = g.uid == null ? world.layout.place(g.defId, g.col, g.row) : world.layout.move(g.uid, g.col, g.row);
    if (!r.ok) {
      say(r.reason, true);
      return false;
    }
    B.ghost = null;
    layoutChanged(g.uid == null ? 'facility:built' : 'facility:moved');
    say(g.uid == null ? `${def.name} built (−${fmt(def.cost)} Credits).` : `${def.name} moved.`);
    debug?.log(`${g.uid == null ? 'built' : 'moved'} ${g.defId} at ${g.col},${g.row}`);
    return true;
  }
  function askSell(uid) {
    const it = world?.layout.item(uid);
    if (!it) return;
    const can = world.layout.canSell(uid);
    if (!can.ok) {
      say(can.reason, true);
      return;
    }
    const doSell = () => {
      const r = world.layout.sell(uid);
      if (!r.ok) return say(r.reason, true);
      sheet.close();
      if (B.picked === uid) B.picked = null;
      layoutChanged('facility:sold');
      say(`${it.def.name} sold (+${fmt(r.refund)} Credits).`);
      debug?.log(`sold ${it.def.id} +${r.refund}`);
    };
    if (confirm) confirm({ title: `Sell the ${it.def.name}?`, body: `You get ${fmt(can.refund)} Credits back (half of ${fmt(it.def.cost)}). Its effect stops at once.`, yes: 'Sell', danger: true, onYes: doSell });
    else doSell();
  }
  // The banner's buttons for what Build Mode is doing now.
  function bannerButtons() {
    const b = bannerRect();
    const list = [];
    if (B.ghost) {
      const g = B.ghost;
      const def = facilityById(g.defId);
      list.push({ id: 'place', label: g.uid == null ? `Place · ${fmt(def.cost)}` : 'Move here', accent: C.good, disabled: !g.res?.ok, onTap: () => commitGhost() });
      list.push({ id: 'cancel', label: 'Cancel', accent: C.progress, onTap: () => (B.ghost = null) });
    } else if (B.picked != null) {
      const can = world.layout.canSell(B.picked);
      list.push({ id: 'move', label: 'Move', accent: C.action, onTap: () => startMove(B.picked) });
      list.push({ id: 'sell', label: can.ok ? `Sell +${fmt(can.refund)}` : 'Sell', accent: C.bad, disabled: !can.ok, onTap: () => askSell(B.picked) });
      list.push({ id: 'done', label: 'Done', accent: C.good, onTap: () => screen.setBuildMode(false) });
    } else {
      list.push({ id: 'shop', label: 'Shop', accent: C.action, onTap: () => onShop() });
      list.push({ id: 'done', label: 'Done', accent: C.good, onTap: () => screen.setBuildMode(false) });
    }
    const gap = 20;
    const bw = Math.min(330, (b.w - 48 - gap * (list.length - 1)) / list.length);
    const x0 = b.x + b.w - 24 - (bw * list.length + gap * (list.length - 1));
    list.forEach((x, i) => (x.rect = { x: x0 + i * (bw + gap), y: b.y + b.h - 24 - 120, w: bw, h: 120 }));
    return list;
  }
  function bannerText() {
    if (B.msg) return { text: B.msg.text, color: B.msg.bad ? '#FFB4A8' : C.textOnDark };
    if (B.ghost) {
      const r = B.ghost.res;
      return { text: r?.ok ? 'Fits here. Drag to move it.' : r?.reason ?? '', color: r?.ok ? '#B8F5BE' : '#FFB4A8' };
    }
    if (B.picked != null) {
      const it = world.layout.item(B.picked);
      return { text: `${it?.def.name ?? ''} — drag it to move, or Move / Sell`, color: C.textOnDark };
    }
    return { text: `Tap a facility to move or sell it · Shop to build · ${world.layout.stage.name} ${cols}×${rows}`, color: C.textOnDark };
  }
  // A tap in Build Mode: the banner's buttons, then the ghost (move it to the tapped spot), then a facility (pick it).
  function buildTap(p) {
    const btn = bannerButtons().find((x) => hitRect(p, x.rect));
    if (btn) {
      if (!btn.disabled) btn.onTap();
      return btn.id;
    }
    if (hitRect(p, bannerRect())) return 'banner';
    if (!screen.inView(p.x, p.y)) return null;
    const c = cellAt(p.x, p.y);
    if (B.ghost) {
      if (!c) return null;
      const def = facilityById(B.ghost.defId);
      ghostAt(c.col - Math.floor(def.w / 2), c.row - Math.floor(def.h / 2));
      B.msg = null;
      return 'ghost';
    }
    const picked = pickAt(p.x, p.y);
    const st = picked?.kind === 'station' ? picked : stationAtCell(c);
    B.picked = st ? st.uid : null;
    B.msg = null;
    return st ? `pick:${st.id}` : null;
  }
  // What a finger pressed in Build Mode: the ghost, or a facility (dragging either moves it).
  function grabAt(p) {
    const c = cellAt(p.x, p.y);
    const plan = planAt(p.x, p.y);
    if (B.ghost) {
      const def = facilityById(B.ghost.defId);
      const g = B.ghost;
      const inFp = plan.x >= g.col * CELL && plan.x < (g.col + def.w) * CELL && plan.y >= g.row * CELL && plan.y < (g.row + def.h) * CELL;
      const w = camera.screenToWorld(p.x, p.y);
      const ar = artRectFp(def, { col: g.col, row: g.row, w: def.w, h: def.h });
      if (inFp || hitRect(w, { x: ar.x + ar.w * 0.15, y: ar.y + ar.h * 0.2, w: ar.w * 0.7, h: ar.h * 0.65 })) return { kind: 'ghost', at: { col: g.col, row: g.row }, plan };
      return null;
    }
    const picked = pickAt(p.x, p.y);
    const st = picked?.kind === 'station' ? picked : stationAtCell(c);
    return st ? { kind: 'facility', uid: st.uid, at: { col: st.fp.col, row: st.fp.row }, plan } : null;
  }
  function dragGhostTo(p) {
    const d = B.drag;
    const plan = planAt(p.x, p.y);
    const col = d.at.col + Math.round((plan.x - d.plan.x) / CELL);
    const row = d.at.row + Math.round((plan.y - d.plan.y) / CELL);
    if (col !== B.ghost.col || row !== B.ghost.row) ghostAt(col, row);
  }

  const screen = {
    camera,
    get iso() {
      return iso;
    },
    selection,
    taps,
    get world() {
      return world;
    },
    // Tests: who is drilling / resting now ({ kind, focus, pitch: [ids], resting: [ids] }).
    drillState() {
      const ws = world?.walkers ?? [];
      const onPitch = ws.filter((w) => PITCHES.includes(world.byUid(w.uid)?.def.id) && !w.resting);
      const resting = ws.filter((w) => w.resting);
      const first = onPitch[0];
      const kind = !ws.length ? 'none' : !onPitch.length && resting.length ? 'rest' : drillKindOf(first?.focus);
      return { kind, focus: club()?.data.training?.focus ?? null, pitch: onPitch.map((w) => w.id), resting: resting.map((w) => w.id) };
    },
    // Tests: the Founder's pose this frame ({ bob, tilt, flip }) and the props shown.
    get founderPose() {
      return { ...pose };
    },
    get props() {
      return propsNow();
    },
    get buildMode() {
      return buildMode;
    },
    get build() {
      return B;
    },
    get slot() {
      return slotN;
    },
    get ground() {
      return { cols, rows };
    },
    get upgradeMsg() {
      return upgradeMsg;
    },
    // (M12c) Tests: where a facility's level badge is on screen (null if not shown)
    levelBadgePoint(uid) {
      const st = world?.byUid(uid);
      if (!st) return null;
      const r = artRect(st);
      return camera.worldToScreen(r.x + r.w * 0.5, r.y + r.h * 0.16);
    },
    openSheet,
    openFacility(uid) {
      const st = world?.byUid(uid);
      if (st) openSheet(st.id);
    },
    startBuild,
    startMove,
    askSell,
    commitGhost,
    ghostTo: (col, row) => B.ghost && ghostAt(col, row), // (tests)
    bannerButtonsForTests: () => (buildMode ? bannerButtons().map((x) => ({ id: x.id, label: x.label, disabled: !!x.disabled, rect: x.rect })) : []),
    bannerTextForTests: () => (buildMode ? bannerText().text : null),
    // Tests: 'menu', 'plate', 'shortcut', 'team', 'build', 'research', 'done', 'banner', calendar rects. (The plate shows the Club Rank.)
    rectOf(id) {
      const bb = buildMode ? bannerButtons().find((x) => x.id === id) : null;
      if (bb) return bb.rect;
      return { hint: hintRect(), nav: navRect(), menu: menuRect(), plate: plateRect(), shortcut: shortcutRect(), team: teamRect(), build: buildRect(), research: researchRect(), banner: bannerRect(), calendar: calRect(), speed0: speedRect(0), speed1: speedRect(1), speed2: speedRect(2), speed4: speedRect(4) }[id] ?? null;
    },
    // The words on the calendar strip (tests): { date, speed, next }.
    calendarText() {
      return calendarLines();
    },
    // Screen point on the Founder's body or a facility's art (tests): the visible middle of what a finger would tap.
    screenPointOf(id) {
      const it = world.byId(id);
      const r = tapRect(it);
      return camera.worldToScreen(r.x + r.w / 2, r.y + r.h * 0.55);
    },
    screenPointOfCell(col, row) {
      const w = iso.cellCenter(col, row);
      return camera.worldToScreen(w.x, w.y);
    },
    // (M12b) Tests: was everything on the ground drawn last frame — every facility, prop, squad figure and the Founder —
    // each from a picture (and size copy) with visible pixels? → { ok, drawn, missing: [id], blank: [{ id, key }] }
    drawAudit() {
      if (!world) return null;
      const ids = [...world.stations.filter((st) => st.uid !== (B.ghost?.uid ?? null)).map((st) => `f:${st.uid}`), ...propsNow().map((pr) => `prop:${pr.at}:${pr.u}:${pr.v}`), ...world.walkers.map((w) => `d:${w.id}`), ...world.people.map((p) => `p:${p.id}`)];
      return audit.report(ids);
    },
    // Tests: centre the camera on a block of tiles.
    centerOnCells,
    inView(sx, sy) {
      return sx >= 0 && sx <= W && sy >= camera.viewY && sy <= camera.viewY + camera.viewH;
    },
    cellAt,
    pickAt,

    setBuildMode(on) {
      if (buildMode === on) return;
      buildMode = on;
      Object.assign(B, { ghost: null, picked: null, press: null, drag: null, msg: null });
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
      // A new world when another club is opened (positions start fresh); the same slot reopened keeps its view.
      if (!world || slotN !== o.n || founder !== f || world.layout !== o.layout) {
        const sameSlot = slotN === o.n;
        founder = f;
        const st = o.layout.stage;
        if (st.cols !== cols || st.rows !== rows || !world) setGround(st.cols, st.rows);
        world = createComplexWorld({ founder: f, layout: o.layout, run: () => club()?.data ?? null });
        syncSelection();
        slotN = o.n;
        if (!sameSlot) screen.viewSet = false;
      }
      fenceFor = null; // (the back fence wears the club colours)
      groundLayer.invalidate();
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
      if (world) {
        const st = world.layout.stage;
        if (st.cols !== cols || st.rows !== rows || world.layout.version !== layoutSeen) layoutChanged(null); // (the ground grew)
      }
      const speed = calendar()?.clock.paused ? 0 : calendar()?.clock.speed ?? 1;
      world?.update(dt * (calendar() ? speed : 1)); // people keep the calendar's pace; still while paused
      if (world && world.staffVersion !== staffSeen) {
        // (M14) staff hired / released: the tap list follows (a selected figure who left is let go)
        for (const it of [...selection.items]) if (it.kind === 'staff') selection.remove(it);
        for (const f of world.staff) selection.add(f);
        staffSeen = world.staffVersion;
      }
      time += dt;
      drillTime += dt * speed; // the drill runs with the calendar
      if (note && (note.t -= dt) <= 0) note = null;
      if (B.msg && (B.msg.t -= dt) <= 0) B.msg = null;
      if (!sheet.active && selection.selected) selection.clear();
      hint?.update(dt);
    },
    onBack() {
      if (buildMode && B.ghost) B.ghost = null;
      else if (buildMode && B.picked != null) B.picked = null;
      else if (buildMode) screen.setBuildMode(false);
      else onMenu();
      return true;
    },

    onDown(p) {
      if (overSheet(p) || onUi(p)) return; // the buttons, the banner and the sheet never pan or pinch the ground
      if (buildMode && !gestures.fingers) {
        const g = grabAt(p);
        if (g) {
          B.press = { id: p.id, ...g }; // (a drag from here moves the ghost / the facility)
          return;
        }
      }
      gestures.down(p);
    },
    onUp(p) {
      if (B.press?.id === p.id && !B.drag) B.press = null;
      gestures.up(p);
    },
    onDragStart(p) {
      if (B.press && B.press.id === p.id && world) {
        const g = B.press;
        if (g.kind === 'facility') {
          B.picked = null;
          B.ghost = { defId: world.layout.item(g.uid).def.id, uid: g.uid };
          ghostAt(g.at.col, g.at.row);
        }
        B.drag = { id: p.id, at: { col: B.ghost.col, row: B.ghost.row }, plan: g.plan, fromFacility: g.kind === 'facility' };
        B.press = null;
        B.msg = null;
        return;
      }
      gestures.dragStart(p);
    },
    onDrag(p) {
      if (B.drag && B.drag.id === p.id && B.ghost) return dragGhostTo(p);
      gestures.drag(p);
    },
    onDragEnd(p) {
      if (B.drag && B.drag.id === p.id) {
        const from = B.drag.fromFacility;
        B.drag = null;
        // a facility dragged straight away moves when let go somewhere it fits
        if (from && B.ghost?.uid != null && B.ghost.res?.ok) {
          const it = world.layout.item(B.ghost.uid);
          if (it && (it.col !== B.ghost.col || it.row !== B.ghost.row)) commitGhost();
          else B.ghost = null;
        }
        return;
      }
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
      if (buildMode) return log(buildTap(p));
      if (hintOn() && hint.handleTap(p)) return log(`hint:${hint.current?.id ?? ''}`); // (M12b)
      if (hitRect(p, navRect())) {
        onNavMenu(); // (M12b) the Club Menu
        return log('nav');
      }
      if (hitRect(p, menuRect())) {
        onMenu();
        return log('menu');
      }
      if (hitRect(p, teamRect())) {
        onTeam();
        return log('team');
      }
      if (hitRect(p, buildRect())) {
        screen.setBuildMode(true);
        return log('build');
      }
      if (hitRect(p, researchRect())) {
        onResearch();
        return log('research');
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
    // Long press on empty grass → Build Mode. On the Founder or a facility it opens their sheet, like a tap.
    onHold(p) {
      if (!world || gestures.multiTouch || gestures.fingers > 1 || buildMode || onUi(p) || overSheet(p)) return;
      if (!screen.inView(p.x, p.y)) return;
      const picked = pickAt(p.x, p.y);
      if (picked) openSheet(picked.id);
      else if (cellAt(p.x, p.y) && !stationAtCell(cellAt(p.x, p.y))) screen.setBuildMode(true);
    },

    render(ctx) {
      ctx.fillStyle = L.outside;
      ctx.fillRect(0, 0, W, renderer.height);
      if (!world) {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        return;
      }
      const cc = club()?.data.club;
      const fence = cc ? `${cc.colours.primary}/${cc.colours.secondary}` : '';
      if (fence !== fenceFor) {
        fenceFor = fence;
        groundLayer.invalidate();
      }
      audit.begin();
      camera.apply(ctx);
      groundLayer.setPixelScale(groundScale());
      groundLayer.renderView(ctx, { x: camera.x, y: camera.y, w: camera.visibleW, h: camera.visibleH });
      assets.detail = detailFor(camera.zoom);
      if (buildMode) drawBuildGrass(ctx);
      drawSelectionMark(ctx);
      const hidden = B.ghost?.uid ?? null; // (a facility being moved is drawn as its ghost)
      const items = [...world.stations.filter((s) => s.uid !== hidden), ...treesNow(), ...propsNow(), ...drillItems(), ...world.people].sort((a, b) => depthOf(a) - depthOf(b));
      for (const it of items) {
        if (it.kind === 'station') {
          const r = artRect(it);
          assets.draw(ctx, it.def.art, r.x, r.y, r.w, r.h);
          audit.note(`f:${it.uid}`, it.def.art);
        } else if (it.kind === 'tree') drawTree(ctx, it);
        else if (it.kind === 'prop') drawProp(ctx, it);
        else if (it.kind === 'drill') drawDrill(ctx, it);
        else drawPlayer(ctx, it);
      }
      drawFrontFence(ctx);
      if (buildMode) drawPicked(ctx);
      if (buildMode && B.ghost) drawGhost(ctx);
      assets.detail = 1;
      camera.restore(ctx);
      if (!buildMode || !B.ghost) for (const st of world.stations) drawLevelBadge(ctx, st);
      for (const p of world.people) drawTag(ctx, p);
      if (buildMode) drawBanner(ctx);
      else {
        drawButton(ctx, menuRect(), '‹ Menu', { accent: C.progress });
        drawPlate(ctx);
        drawCalendar(ctx);
        drawButton(ctx, teamRect(), 'Team', { accent: C.purple });
        drawButton(ctx, buildRect(), 'Build', { accent: C.gold });
        drawButton(ctx, researchRect(), 'Research', { accent: C.progress });
        if (calendar()?.atKickoff) drawButton(ctx, shortcutRect(), 'Match Setup', { accent: C.good });
        else drawButton(ctx, shortcutRect(), showMenu() ? 'Training' : 'Training Pitch', { accent: C.action });
        if (showMenu()) drawNavButton(ctx, navRect());
        if (hintOn()) hint.render(ctx);
      }
    },
  };
  let fenceFor = null; // the club colours the cached back fence was drawn in

  // --- the worn paths: from the gate to the front of every facility (shortest walks over free tiles) ----------------
  let paths = null; // Set of "c,r"
  function pathCells() {
    if (paths) return paths;
    paths = new Set();
    if (!world) return paths;
    const Lay = world.layout;
    const g = Lay.gate;
    const prev = new Map([[`${g.col},${g.row}`, null]]);
    const queue = [g];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      for (const [dc, dr] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
        const n = { col: c.col + dc, row: c.row + dr };
        const k = `${n.col},${n.row}`;
        if (prev.has(k) || !Lay.isOpenCell(n.col, n.row)) continue;
        prev.set(k, `${c.col},${c.row}`);
        queue.push(n);
      }
    }
    paths.add(`${g.col},${g.row}`);
    for (const s of world.stations) {
      const d = Lay.accessCells(s.uid)[0];
      for (let k = d ? `${d.col},${d.row}` : null; k && !paths.has(k); k = prev.get(k)) paths.add(k);
    }
    return paths;
  }

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
  // Grass in mown stripes, the worn paths, soft shade under the facilities and the back fence — drawn once into the
  // cached layer (again when the layout changes).
  function drawGround(g) {
    g.fillStyle = L.outside;
    g.fillRect(0, 0, worldW, worldH);
    g.lineJoin = 'round';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) patch(g, iso.outline(c, r), Math.floor(c / 2) % 2 ? L.grassA : L.grassB);
    g.strokeStyle = L.grassLine;
    g.lineWidth = 1.2;
    for (let c = 0; c <= cols; c += 2) line(g, iso.corner(c, 0), iso.corner(c, rows));
    // Paths: gravel with a darker edge, joined across neighbouring tiles.
    const P = pathCells();
    const has = (c, r) => P.has(`${c},${r}`);
    for (const pass of [0, 1]) {
      const inset = pass ? 0.2 : 0.1;
      const fill = pass ? L.path : L.pathEdge;
      for (const k of P) {
        const [c, r] = k.split(',').map(Number);
        patch(g, iso.outline(c + inset, r + inset, 1 - inset * 2, 1 - inset * 2), fill);
        if (has(c + 1, r)) patch(g, iso.outline(c + 1 - inset, r + inset, inset * 2, 1 - inset * 2), fill);
        if (has(c, r + 1)) patch(g, iso.outline(c + inset, r + 1 - inset, 1 - inset * 2, inset * 2), fill);
      }
    }
    // The gate: the path runs out through the front fence.
    const gt = world?.layout.gate;
    if (gt) patch(g, [iso.corner(gt.col + 0.2, rows - 0.2), iso.corner(gt.col + 0.8, rows - 0.2), iso.corner(gt.col + 0.8, rows + 0.9), iso.corner(gt.col + 0.2, rows + 0.9)], L.path);
    // Soft shade under the facilities (the art has its own base; this just seats it on the grass).
    for (const st of world?.stations ?? []) patch(g, iso.outline(st.fp.col - 0.05, st.fp.row - 0.05, st.fp.w + 0.1, st.fp.h + 0.1), L.fenceShade);
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
        line(g, P(t, h), P(t + 0.5, h));
        line(g, P(t + 0.5, h), P(t + 1, h));
      }
    }
    g.strokeStyle = L.fencePost;
    g.lineWidth = 9;
    for (let t = a; t <= b; t += 0.5) line(g, P(t, 0), P(t, fenceH));
    g.fillStyle = cap; // post caps in the second colour
    g.strokeStyle = L.outline;
    g.lineWidth = 2;
    for (let t = a; t <= b; t += 0.5) {
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
    fence(ctx, 'row', rows, 0, cols, world?.layout.gate.col ?? null);
  }
  // Trees just outside the back fence (they move out with it when the ground grows).
  let treeList = null;
  let treeFor = '';
  function treesNow() {
    if (treeFor !== `${cols}x${rows}`) {
      treeFor = `${cols}x${rows}`;
      treeList = [];
      let i = 0;
      for (let c = 0.8; c < cols; c += TREES.every) treeList.push({ kind: 'tree', col: c + TREES.jitter[i++ % TREES.jitter.length], row: -TREES.out, r: TREES.r * (1 + (i % 3) * 0.15) });
      for (let r = 1.2; r < rows; r += TREES.every) treeList.push({ kind: 'tree', col: -TREES.out, row: r + TREES.jitter[i++ % TREES.jitter.length], r: TREES.r * (1 + (i % 3) * 0.15) });
    }
    return treeList;
  }
  // Props beside the facility they belong to; left out where a facility, a worn path or the gate is.
  function propsNow() {
    if (!world) return [];
    const P = pathCells();
    const out = [];
    for (const pr of PROPS) {
      let base = null;
      if (pr.at === 'gate') base = world.layout.gate;
      else {
        const st = world.stations.find((s) => s.def.id === pr.at);
        if (st) base = { col: st.fp.col, row: st.fp.row };
      }
      if (!base) continue;
      const col = base.col + pr.u;
      const row = base.row + pr.v;
      const c = Math.floor(col);
      const r = Math.floor(row);
      if (c < 0 || r < 0 || c >= cols || (r >= rows && !pr.flag)) continue;
      if (!pr.flag && (P.has(`${c},${r}`) || stationAtCell({ col: c, row: r }))) continue;
      if (pr.flag && stationAtCell({ col: c, row: Math.min(r, rows - 1) })) continue;
      out.push({ kind: 'prop', ...pr, col, row });
    }
    return out;
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
    const staff = p.kind === 'staff';
    const sx = walking ? screenDir(p) : p.faceLast ?? 1;
    p.faceLast = sx;
    const f = feetOf(p);
    ctx.save();
    ctx.fillStyle = L.fenceShade;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, HW * 0.21, HH * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const ps = staff ? staffPose : pose;
    const working = staff && p.phase === 'at' && !calendar()?.clock.paused;
    characterPose({ state: lowFx() ? 'idle' : walking ? 'walking' : working ? 'working' : 'idle', facing: sx }, lowFx() ? 0 : time, staff ? 7 + p.staffId.charCodeAt(0) + Number(p.staffId.slice(2)) : 1, ps);
    drawCharacter(ctx, assets, p.art, r.x + r.w / 2, r.y + r.h, r.w, r.h, ps);
    audit.note(`p:${p.id}`, p.art);
  }
  // --- the squad: walking to their places and drilling there (Milestones 8 / 12) ----------------------------------------
  const drillKindOf = (focus) => (focus === 'rest' ? 'rest' : DRILL.kindOf[focus] ?? 'shuttle');
  // The figures now: every walker (on the way, or at his place: on a pitch in the drill of his session, on another
  // open-air place jogging a short lane, at a building standing at its front), plus the cones of each shuttle drill.
  function drillItems() {
    if (!world) return [];
    const out = [];
    const paused = !!calendar()?.clock.paused;
    const shuttles = new Map(); // pitch uid → lanes in use
    const pitchIdx = new Map(); // pitch uid → walkers there so far
    for (const w of world.walkers) {
      const st = world.byUid(w.uid);
      let pos = { x: w.agent.x, y: w.agent.y };
      let walking = !paused && (w.phase === 'path' || w.phase === 'enter' || w.phase === 'exit');
      let face = w.faceLast ?? 1;
      let depth = null;
      if (walking) {
        face = screenDirOf(w);
        w.faceLast = face;
      } else if (w.phase === 'at' && st?.def.open) {
        const { col, row } = st.fp;
        const at = (u, v) => ({ x: (col + u) * CELL, y: (row + v) * CELL });
        if (PITCHES.includes(st.def.id) && !w.resting) {
          const i = pitchIdx.get(st.uid) ?? 0;
          pitchIdx.set(st.uid, i + 1);
          const kind = drillKindOf(w.focus);
          if (kind === 'shuttle') {
            const lane = DRILL.lanes[i % DRILL.lanes.length] + Math.floor(i / DRILL.lanes.length) * 0.22;
            const span = DRILL.laneTo - DRILL.laneFrom;
            const t = drillTime * DRILL.runSpeed + i * 0.9;
            const k = (t % (span * 2)) / span; // 0 → 2 and back
            const u = k <= 1 ? k : 2 - k;
            pos = at(DRILL.laneFrom + span * u, Math.min(st.fp.h - 0.3, lane));
            walking = !paused;
            face = k <= 1 ? 1 : -1; // plan +col is screen right-down
            shuttles.set(st.uid, Math.max(shuttles.get(st.uid) ?? 0, Math.min(DRILL.lanes.length, i + 1)));
          } else if (kind === 'pairs') {
            const pair = DRILL.pairs[Math.floor(i / 2) % DRILL.pairs.length];
            const spot = pair[i % 2];
            const sway = Math.sin(drillTime * 2 + i) * 0.12;
            const extra = Math.floor(i / (DRILL.pairs.length * 2)) * 0.35;
            pos = at(spot.u + sway + extra, spot.v);
            face = i % 2 ? -1 : 1;
          } else {
            const gk = w.p.position === 'GK';
            const spot = gk ? DRILL.keeper : DRILL.shooters[i % DRILL.shooters.length];
            pos = at(spot.u, spot.v + (gk ? Math.sin(drillTime * 1.6) * 0.5 : Math.floor(i / DRILL.shooters.length) * 0.3));
            walking = gk && !paused;
          }
          depth = Math.max(depthOf(st) + 1, pos.x + pos.y);
        } else if (!w.resting) {
          // another open-air place: a short jog back and forth around his spot
          const t = drillTime * 0.8 + (w.slot ?? 0) * 1.3;
          const k = (t % 2) - 1;
          pos = { x: w.spot.x + Math.abs(k) * CELL * 0.5 - CELL * 0.25, y: w.spot.y };
          walking = !paused;
          face = Math.floor(t) % 2 ? -1 : 1;
          depth = Math.max(depthOf(st) + 1, pos.x + pos.y);
        } else depth = Math.max(depthOf(st) + 1, pos.x + pos.y);
      }
      out.push({ kind: 'drill', id: w.id, p: w.p, ...pos, walking, face, resting: w.resting && w.phase === 'at', working: w.phase === 'at' && !w.resting, depth: depth ?? pos.x + pos.y });
    }
    // cones (prop_01) at both ends of each shuttle lane in use
    for (const [uid, n] of shuttles) {
      const st = world.byUid(uid);
      DRILL.lanes.slice(0, n).forEach((lane, j) => {
        for (const u of [DRILL.laneFrom - 0.2, DRILL.laneTo + 0.2]) {
          const pos = { x: (st.fp.col + u) * CELL, y: (st.fp.row + lane) * CELL };
          out.push({ kind: 'drill', id: `cone${uid}:${j}:${u}`, cone: true, ...pos, depth: depthOf(st) + 0.5 + (pos.x + pos.y) / 1e4 });
        }
      });
    }
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
    ctx.ellipse(f.x, f.y, HW * 0.15, HH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    characterPose({ state: lowFx() ? 'idle' : it.walking ? 'walking' : it.working ? 'working' : 'idle', facing: it.face }, lowFx() ? 0 : time, (it.p.shirt ?? 0) + 3, drillPose);
    drawCharacter(ctx, assets, key, f.x, f.y + h * 0.06, h, h, drillPose);
    audit.note(`d:${it.id}`, key);
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

  // A prop: its picture standing at its spot (on a small table for the laptop and folder); the flag in club colours.
  function drawProp(ctx, it) {
    const f = iso.corner(it.col, it.row);
    const c = club()?.data.club;
    const id = `prop:${it.at}:${it.u}:${it.v}`;
    if (it.flag) {
      if (c) {
        drawClubFlag(ctx, assets, f.x, f.y, it.h, c);
        audit.note(id, flagKey(assets, c.colours.primary));
      }
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
    audit.note(id, it.art);
  }
  // Which way the next step goes on screen: plan x grows to the right, plan y to the left.
  function screenDir(p) {
    const n = p.agent.path[0];
    if (!n) return p.faceLast ?? 1;
    const sx = n.x - p.agent.x - (n.y - p.agent.y);
    return Math.abs(sx) < 0.5 ? (p.faceLast ?? 1) : sx > 0 ? 1 : -1;
  }
  function screenDirOf(w) {
    const n = w.phase === 'path' ? w.agent.path[0] : w.phase === 'exit' ? w.exit : w.spot;
    if (!n) return w.faceLast ?? 1;
    const sx = n.x - w.agent.x - (n.y - w.agent.y);
    return Math.abs(sx) < 0.5 ? (w.faceLast ?? 1) : sx > 0 ? 1 : -1;
  }
  function drawSelectionMark(ctx) {
    const it = selection.selected;
    if (!it) return;
    ctx.save();
    ctx.strokeStyle = C.progress;
    ctx.lineWidth = 6;
    if (it.kind === 'player' || it.kind === 'staff') {
      const f = feetOf(it);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, HW * 0.28, HH * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      isoPath(ctx, iso.outline(it.fp.col, it.fp.row, it.fp.w, it.fp.h));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Build Mode: every free tile outlined (the gate tile marked), and the picked facility's footprint.
  function drawBuildGrass(ctx) {
    const gt = world.layout.gate;
    ctx.save();
    ctx.lineWidth = 1.5;
    world.grid.forEachTile((c, r) => {
      if (stationAtCell({ col: c, row: r })) return;
      isoPath(ctx, iso.outline(c, r, 1, 1));
      ctx.fillStyle = c === gt.col && r === gt.row ? 'rgba(255, 210, 63, 0.45)' : L.buildTint;
      ctx.fill();
      ctx.strokeStyle = L.buildLine;
      ctx.stroke();
    });
    ctx.restore();
  }
  function drawPicked(ctx) {
    const st = B.picked != null ? world.byUid(B.picked) : null;
    if (!st || B.ghost) return;
    ctx.save();
    isoPath(ctx, iso.outline(st.fp.col, st.fp.row, st.fp.w, st.fp.h));
    ctx.strokeStyle = L.picked;
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();
  }
  // The ghost: its footprint green (it fits) or red (it doesn't), its picture faded on top.
  function drawGhost(ctx) {
    const g = B.ghost;
    const def = facilityById(g.defId);
    const ok = !!g.res?.ok;
    ctx.save();
    isoPath(ctx, iso.outline(g.col, g.row, def.w, def.h));
    ctx.fillStyle = ok ? L.ok : L.bad;
    ctx.fill();
    ctx.strokeStyle = ok ? L.okLine : L.badLine;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalAlpha = 0.72;
    const r = artRectFp(def, { col: g.col, row: g.row, w: def.w, h: def.h });
    assets.draw(ctx, def.art, r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  // (M12c) A facility's level: a round badge near the top of its picture, a fixed size on screen (smaller when zoomed far
  // out); an orange ring and an arrow while an upgrade is under way.
  function drawLevelBadge(ctx, st) {
    const info = world.layout.levelInfo(st.uid);
    if (!info || info.max <= 1) return;
    const r = artRect(st);
    const p = camera.worldToScreen(r.x + r.w * 0.5, r.y + r.h * 0.16);
    if (p.y < camera.viewY || p.y > camera.viewY + camera.viewH || p.x < 0 || p.x > W) return;
    const rad = camera.zoom < 0.4 ? 20 : 28;
    ctx.save();
    ctx.fillStyle = info.level >= 3 ? C.gold : info.level === 2 ? C.progress : C.panel;
    ctx.strokeStyle = info.pending ? C.action : C.outline;
    ctx.lineWidth = info.pending ? 7 : 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, info.pending ? `${info.level}↑` : String(info.level), p.x, p.y + 1, { size: rad > 24 ? S.small : 26, bold: true, color: info.level === 1 ? C.text : C.textOnDark, align: 'center', baseline: 'middle' });
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
    const role = p.kind === 'staff' ? roleById(p.role) : null; // (M14) staff wear their role colour
    ctx.fillStyle = role?.colour ?? colourById(club()?.data.club.colours.primary)?.hex ?? C.progress;
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, TAG_H, TAG_H / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = role ? '#FFFFFF' : colourById(club()?.data.club.colours.primary)?.ink ?? '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, s.x, y + TAG_H / 2 + 1);
    ctx.restore();
  }
  // (M12b) The Menu button: the series three-bar icon over the word Menu.
  function drawNavButton(ctx, r) {
    drawButton(ctx, r, '', { accent: C.progress });
    const s = 62;
    if (menuIcon) assets.draw(ctx, menuIcon, r.x + r.w / 2 - s / 2, r.y + 12, s, s);
    text(ctx, 'Menu', r.x + r.w / 2, r.y + r.h - 34, { size: S.small, bold: true, color: C.textOnAction, align: 'center', baseline: 'middle', maxWidth: r.w - 12 });
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
    // (M10) the Club Rank chip on the right
    const rk = club()?.data.league ? clubRank(club().data).id : 'E';
    const chip = { x: r.x + r.w - 20 - 120, y: r.y + 18, w: 120, h: r.h - 36 };
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = C.outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(chip.x, chip.y, chip.w, chip.h, chip.h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    text(ctx, `Rank ${rk}`, chip.x + chip.w / 2, chip.y + chip.h / 2 + 1, { size: S.small, bold: true, color: C.text, align: 'center', baseline: 'middle', maxWidth: chip.w - 12 });
    const tx = r.x + 14 + bh * 0.84 + 12;
    const tr = chip.x - 12;
    text(ctx, c.name, tx + (tr - tx) / 2, r.y + r.h / 2, { size: S.body, bold: true, color: prim.ink, align: 'center', baseline: 'middle', maxWidth: tr - tx });
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
  // Build Mode's banner: "Build Mode" (or what is being placed / moved), the Credits, a message line, its buttons.
  function drawBanner(ctx) {
    const b = bannerRect();
    ctx.save();
    ctx.fillStyle = C.chip;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, THEME.panel.radius);
    ctx.fill();
    ctx.restore();
    const g = B.ghost;
    const title = g ? `${g.uid == null ? 'Build' : 'Move'}: ${facilityById(g.defId).name}` : 'Build Mode';
    const cr = `${fmt(club()?.data.league?.credits ?? 0)} Credits`;
    ctx.save();
    ctx.font = font(S.body, true);
    const crW = ctx.measureText(cr).width;
    ctx.restore();
    text(ctx, title, b.x + 36, b.y + 58, { size: S.title, bold: true, color: C.textOnDark, baseline: 'middle', maxWidth: b.w - crW - 110 });
    text(ctx, cr, b.x + b.w - 36, b.y + 58, { size: S.body, bold: true, color: C.gold, align: 'right', baseline: 'middle' });
    const t = bannerText();
    text(ctx, t.text, b.x + 36, b.y + 128, { size: S.small, bold: true, color: t.color, baseline: 'middle', maxWidth: b.w - 72 });
    for (const x of bannerButtons()) drawButton(ctx, x.rect, x.label, { accent: x.accent, disabled: !!x.disabled });
  }

  return screen;
}
