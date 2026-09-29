// Club Setup (Milestone 0, bible §5 "Setup fields") for one campaign slot. Top to bottom, in the bible's order:
// Club Name (type it or Random), Manager Name (type it or Random; shown as "Club Manager <name>"), Home Area (1 of 12,
// flavour only — its towns feed Random club names), Club Colours (primary + secondary from the safe palette, or Random,
// with the badge + kit preview), Badge (1 of 12 shield shapes + 1 symbol, drawn in code), Choose Founding Player (five
// cards with their Batch 1 portrait, position, base trait and Founder Perk), then RANDOMISE ALL (every field stays
// editable after). "Review and start" opens the confirmation panel (club, manager, area, badge + colours, Founder +
// perk) with START CLUB. Drag scrolls. Layout and tapping share one pass, so they can never disagree.
import { THEME, font } from '../../../../core/Theme.js';
import { ScrollPanel } from '../../../../core/ui/ScrollPanel.js';
import { drawButton, hitRect } from '../../../../core/ui/Button.js';
import { card, text, para } from '../../../../core/ui/Kit.js';
import { pickName, pickIndex } from '../../../../core/NamePicker.js';
import {
  FOUNDERS, COLOURS, HOME_AREAS, BADGE_SHAPES, BADGE_SYMBOLS, CLUB_NAMES, CLUB_SUFFIXES, MANAGER_NAMES, NAME_MAX, POSITIONS,
  founderById, colourById, areaById, shapeById, symbolById,
} from '../../data/setup.js';
import { drawFounder, drawBadge, drawKit, diceButton } from '../ui/clubArt.js';
import { managerLine } from '../systems/club.js';

const C = THEME.color;
const S = THEME.size;
const PAD = 32;

export const defaultSetup = () => ({ club: '', manager: '', area: HOME_AREAS[0].id, primary: 'green', secondary: 'white', shape: BADGE_SHAPES[0].id, symbol: BADGE_SYMBOLS[0].id, founder: FOUNDERS[0].id });

// A made-up club name: usually one of the home area's towns + an ending ("Saltcliff Rovers"), sometimes a stock name.
export function randomClubName(areaId, not = null, random = Math.random) {
  for (let i = 0; i < 8; i++) {
    const name = random() < 0.7 ? `${pickName(areaById(areaId).towns, { random })} ${pickName(CLUB_SUFFIXES, { random })}` : pickName(CLUB_NAMES, { random });
    if (name !== not) return name;
  }
  return pickName(CLUB_NAMES, { not, random });
}

export function createSetupScreen({ layout, assets, textPrompt, onBack, onStart }) {
  let slot = 1;
  let replacing = null; // the summary of the club this slot holds now (START asks before replacing it)
  let setup = null;
  let confirming = false;

  const headerRect = () => {
    const sr = layout.safeRect;
    return { x: sr.x + 24, y: sr.y + 24, w: 220, h: 110 };
  };
  const bottomRect = () => layout.anchor('bottom', layout.safeRect.w - 64, THEME.button.minH + 20, 24);
  const panelRect = () => {
    const h = headerRect();
    const sr = layout.safeRect;
    const y = h.y + h.h + 20;
    return { x: sr.x + 16, y, w: sr.w - 32, h: bottomRect().y - 16 - y };
  };
  const scroll = new ScrollPanel({ getRect: panelRect });
  const missing = () => [!setup.club.trim() && 'a club name', !setup.manager.trim() && "the manager's name"].filter(Boolean);

  const indexOf = (list, id) => list.findIndex((x) => x.id === id);
  const pickFrom = (list, id) => list[pickIndex(list.length, { not: indexOf(list, id) })].id;
  // Picking a primary equal to the secondary (or the other way round) swaps them, so the two always differ.
  const setColour = (which, id) => {
    const other = which === 'primary' ? 'secondary' : 'primary';
    if (setup[other] === id) setup[other] = setup[which];
    setup[which] = id;
  };
  const random = {
    area: () => (setup.area = pickFrom(HOME_AREAS, setup.area)),
    club: () => (setup.club = randomClubName(setup.area, setup.club)),
    manager: () => (setup.manager = pickName(MANAGER_NAMES, { not: setup.manager })),
    colours: () => {
      const a = pickFrom(COLOURS, setup.primary);
      let b = pickFrom(COLOURS, setup.secondary);
      while (b === a) b = COLOURS[pickIndex(COLOURS.length)].id;
      setup.primary = a;
      setup.secondary = b;
    },
    badge: () => {
      setup.shape = pickFrom(BADGE_SHAPES, setup.shape);
      setup.symbol = pickFrom(BADGE_SYMBOLS, setup.symbol);
    },
    founder: () => (setup.founder = pickFrom(FOUNDERS, setup.founder)),
  };
  const randomiseAll = () => Object.values(random).forEach((fn) => fn()); // area before club: the name uses its towns
  const badgeOf = (over = {}) => ({ shape: setup.shape, symbol: setup.symbol, primary: setup.primary, secondary: setup.secondary, ...over });

  // One pass over the scrolling content (content coordinates). Draws when ctx is given, returns the action under
  // `tap`, and records every tappable rect by id in `rects`.
  function pass(ctx, tap, rects = null) {
    const w = panelRect().w;
    const cw = w - PAD * 2;
    let y = PAD;
    let hit = null;
    const box = (r, fn, id) => {
      if (rects && id) rects[id] = r;
      if (tap && !hit && hitRect(tap, r)) hit = fn;
    };
    const heading = (n, label, sub = null) => {
      if (ctx) {
        text(ctx, `${n}. ${label}`, PAD, y, { size: S.heading, bold: true, maxWidth: sub ? cw * 0.55 : cw });
        if (sub) text(ctx, sub, PAD + cw, y + 10, { size: S.small, color: C.textMuted, align: 'right', maxWidth: cw * 0.43 });
      }
      y += 66;
    };
    const smallRandom = (id, fn) => {
      const r = { x: PAD + cw - 250, y: y - 76, w: 250, h: 70 };
      if (ctx) diceButton(ctx, assets, r, 'Random', { accent: C.progress, font: font(S.small, true) });
      box(r, fn, id);
    };
    // A grid of n tiles, cols across; draw(r, i, on) paints one.
    const grid = (items, cols, tileH, isOn, onPick, idPrefix, draw) => {
      const gap = 14;
      const tw = (cw - gap * (cols - 1)) / cols;
      items.forEach((it, i) => {
        const r = { x: PAD + (i % cols) * (tw + gap), y: y + Math.floor(i / cols) * (tileH + gap), w: tw, h: tileH };
        if (ctx) draw(r, it, isOn(it));
        box(r, () => onPick(it), `${idPrefix}:${it.id}`);
      });
      y += Math.ceil(items.length / cols) * (tileH + gap);
    };

    // A typed field with a Random button beside it.
    const field = (id, n, label, value, placeholder, max) => {
      heading(n, label);
      const f = { x: PAD, y, w: cw - 270, h: 110 };
      const rnd = { x: PAD + cw - 250, y, w: 250, h: 110 };
      if (ctx) {
        ctx.fillStyle = C.sheet;
        ctx.strokeStyle = value.trim() ? C.outline : C.action;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(f.x, f.y, f.w, f.h, 22);
        ctx.fill();
        ctx.stroke();
        text(ctx, value || placeholder, f.x + 28, f.y + f.h / 2, { size: S.heading, bold: !!value, color: value ? C.text : C.textFaint, baseline: 'middle', maxWidth: f.w - 56 });
        diceButton(ctx, assets, rnd, 'Random', { accent: C.progress });
      }
      box(f, () => edit(id, f, max, placeholder), id);
      box(rnd, random[id], `${id}Random`);
      y += 110 + 20;
    };
    field('club', 1, 'Club Name', setup.club, 'Tap to name your club', NAME_MAX.club);
    y += 16;
    field('manager', 2, 'Manager Name', setup.manager, 'Tap to type your name', NAME_MAX.manager);
    if (ctx) text(ctx, managerLine(setup.manager.trim(), setup.club.trim()), PAD, y, { size: S.body, color: C.actionDark, bold: true, maxWidth: cw });
    y += 50 + 30;

    // 3. Home Area: 12 tiles.
    heading(3, 'Home Area', 'flavour only');
    smallRandom('areaRandom', random.area);
    grid(HOME_AREAS, 3, 96, (a) => a.id === setup.area, (a) => (setup.area = a.id), 'area', (r, a, on) => {
      card(ctx, r, on ? 'selected' : 'normal', { radius: 20 });
      text(ctx, a.name, r.x + r.w / 2, r.y + r.h / 2, { size: S.small, bold: true, align: 'center', baseline: 'middle', color: on ? C.good : C.text, maxWidth: r.w - 20 });
    });
    if (ctx) text(ctx, areaById(setup.area).line, PAD, y + 4, { size: S.small, color: C.textMuted, maxWidth: cw });
    y += 60;

    // 4. Club Colours: primary and secondary rows, then the badge + kit preview.
    heading(4, 'Club Colours', 'cosmetic only');
    smallRandom('coloursRandom', random.colours);
    for (const which of ['primary', 'secondary']) {
      if (ctx) text(ctx, which === 'primary' ? `Primary · ${colourById(setup.primary).name}` : `Secondary · ${colourById(setup.secondary).name}`, PAD, y, { size: S.small, bold: true, color: C.textMuted });
      y += 44;
      grid(COLOURS, 6, 100, (c) => setup[which] === c.id, (c) => setColour(which, c.id), which, (r, c, on) => {
        ctx.fillStyle = c.hex;
        ctx.strokeStyle = C.outline;
        ctx.lineWidth = on ? 8 : 3;
        ctx.beginPath();
        ctx.roundRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12, 20);
        ctx.fill();
        ctx.stroke();
        if (on) text(ctx, '✓', r.x + r.w / 2, r.y + r.h / 2 + 2, { size: 52, bold: true, color: c.ink, align: 'center', baseline: 'middle' });
      });
      y += 10;
    }
    const pv = 260;
    if (ctx) {
      const pr = { x: PAD, y, w: cw, h: pv };
      card(ctx, pr, 'info');
      drawBadge(ctx, { x: pr.x + cw * 0.18 - 100, y: pr.y + 20, w: 200, h: pv - 40 }, badgeOf());
      drawKit(ctx, { x: pr.x + cw * 0.55 - 100, y: pr.y + 20, w: 200, h: pv - 40 }, setup.primary, setup.secondary);
      text(ctx, setup.club.trim() || 'Your Club', pr.x + cw * 0.84, pr.y + pv / 2 - 24, { size: S.small, bold: true, align: 'center', baseline: 'middle', maxWidth: cw * 0.28 });
      text(ctx, areaById(setup.area).name, pr.x + cw * 0.84, pr.y + pv / 2 + 20, { size: S.small, color: C.textMuted, align: 'center', baseline: 'middle', maxWidth: cw * 0.28 });
    }
    y += pv + 40;

    // 5. Badge: 12 shield shapes and a symbol, drawn in the club colours.
    heading(5, 'Badge', 'shape + symbol');
    smallRandom('badgeRandom', random.badge);
    grid(BADGE_SHAPES, 6, 150, (s) => s.id === setup.shape, (s) => (setup.shape = s.id), 'shape', (r, s, on) => {
      card(ctx, r, on ? 'selected' : 'normal', { radius: 20 });
      drawBadge(ctx, { x: r.x + 14, y: r.y + 10, w: r.w - 28, h: r.h - 20 }, badgeOf({ shape: s.id }));
    });
    if (ctx) text(ctx, `Shape · ${shapeById(setup.shape).name}`, PAD, y, { size: S.small, bold: true, color: C.textMuted });
    y += 54;
    grid(BADGE_SYMBOLS, 6, 130, (s) => s.id === setup.symbol, (s) => (setup.symbol = s.id), 'symbol', (r, s, on) => {
      card(ctx, r, on ? 'selected' : 'normal', { radius: 20 });
      drawBadge(ctx, { x: r.x + 8, y: r.y + 4, w: r.w - 16, h: r.h - 8 }, badgeOf({ shape: 'circle', symbol: s.id }));
    });
    if (ctx) text(ctx, `Symbol · ${symbolById(setup.symbol).name}`, PAD, y, { size: S.small, bold: true, color: C.textMuted });
    y += 70;

    // 6. Choose Founding Player: five cards.
    heading(6, 'Choose Founding Player', 'perk lasts the whole run');
    for (const f of FOUNDERS) {
      const on = setup.founder === f.id;
      const tw = cw - 230 - 40;
      const perkH = para(null, f.perk.text, 0, 0, tw, { size: S.small });
      const h = Math.max(240, 200 + perkH);
      const r = { x: PAD, y, w: cw, h };
      if (ctx) {
        card(ctx, r, on ? 'selected' : 'normal');
        drawFounder(ctx, assets, { x: r.x + 20, y: r.y + 20, w: 200, h: 200 }, f, on ? C.good : null);
        const tx = r.x + 250;
        let ty = r.y + 24;
        text(ctx, f.name, tx, ty, { size: S.heading, bold: true, maxWidth: tw - 160 });
        if (on) text(ctx, '✓ Founder', r.x + r.w - 24, ty + 6, { size: S.small, bold: true, color: C.good, align: 'right' });
        ty += 56;
        text(ctx, `${POSITIONS[f.position].name} · ${f.trait}`, tx, ty, { size: S.body, color: C.textMuted, maxWidth: tw });
        ty += 48;
        text(ctx, f.perk.name, tx, ty, { size: S.body, bold: true, color: C.purple, maxWidth: tw });
        ty += 46;
        para(ctx, f.perk.text, tx, ty, tw, { size: S.small });
      }
      box(r, () => (setup.founder = f.id), `founder:${f.id}`);
      y += h + 20;
    }
    y += 20;

    // RANDOMISE ALL.
    const all = { x: PAD, y, w: cw, h: 130 };
    if (ctx) diceButton(ctx, assets, all, 'RANDOMISE ALL', { accent: C.purple, font: font(S.button, true) });
    box(all, randomiseAll, 'randomAll');
    y += 130 + 16;
    if (ctx) text(ctx, 'Fills every field. You can still change any of them.', PAD + cw / 2, y, { size: S.small, color: C.textMuted, align: 'center', maxWidth: cw });
    y += 50;
    return { height: y + PAD, hit };
  }

  function edit(id, fieldContent, max, placeholder) {
    const pr = panelRect();
    const rect = { x: pr.x + fieldContent.x, y: pr.y + fieldContent.y - scroll.scrollY, w: fieldContent.w, h: fieldContent.h };
    textPrompt.open({ rect, value: setup[id], maxLength: max, placeholder, onDone: (v) => (setup[id] = v.trim().slice(0, max)) });
  }

  // --- the confirmation panel -------------------------------------------------------------------------------------
  const confirmLayout = () => {
    const sr = layout.safeRect;
    const w = Math.min(sr.w - 48, 1000);
    const h = Math.min(sr.h - 80, 1300);
    const x = sr.x + (sr.w - w) / 2;
    const y = sr.y + (sr.h - h) / 2;
    const start = { x: x + 40, y: y + h - 40 - 130, w: w - 80, h: 130 };
    const change = { x: x + 40, y: start.y - 24 - 110, w: w - 80, h: 110 };
    return { box: { x, y, w, h }, start, change };
  };
  function drawConfirm(ctx) {
    const L = confirmLayout();
    const b = L.box;
    const sr = layout.safeRect;
    ctx.fillStyle = C.overlay;
    ctx.fillRect(sr.x - 2000, sr.y - 2000, sr.w + 4000, sr.h + 4000);
    card(ctx, b, 'gold');
    const f = founderById(setup.founder);
    const room = L.change.y - b.y; // everything above the buttons
    const k = Math.min(1, room / 960);
    let y = b.y + 32 * k;
    text(ctx, 'Ready to found your club?', b.x + b.w / 2, y, { size: S.title, bold: true, align: 'center', maxWidth: b.w - 60 });
    y += 84 * k;
    const bh = 220 * k;
    drawBadge(ctx, { x: b.x + b.w * 0.3 - bh * 0.42, y, w: bh * 0.84, h: bh }, badgeOf());
    drawKit(ctx, { x: b.x + b.w * 0.62 - bh * 0.36, y, w: bh * 0.72, h: bh }, setup.primary, setup.secondary);
    y += bh + 24 * k;
    const ps = 180 * k;
    drawFounder(ctx, assets, { x: b.x + 40, y, w: ps, h: ps }, f, colourById(setup.primary).hex);
    const tx = b.x + 40 + ps + 30;
    const tw = b.x + b.w - 40 - tx;
    const rows = [
      ['Club', setup.club],
      ['Club Manager', setup.manager],
      ['Home Area', areaById(setup.area).name],
      ['Colours', `${colourById(setup.primary).name} / ${colourById(setup.secondary).name}`],
      ['Badge', `${shapeById(setup.shape).name} · ${symbolById(setup.symbol).name}`],
      ['Founder', `${f.name} (${f.position})`],
    ];
    let ry = y;
    for (const [key, v] of rows) {
      text(ctx, key, tx, ry, { size: S.small, color: C.textMuted });
      text(ctx, v, tx + tw, ry - 4, { size: S.body, bold: true, align: 'right', maxWidth: tw - 220 });
      ry += 46 * k;
    }
    y = Math.max(ry, y + ps) + 20 * k;
    text(ctx, `Founder Perk: ${f.perk.name}`, b.x + 40, y, { size: S.body, bold: true, color: C.purple, maxWidth: b.w - 80 });
    y += 48 * k;
    y += para(ctx, f.perk.text, b.x + 40, y, b.w - 80, { size: S.small });
    if (replacing) {
      y += 12;
      text(ctx, `Replaces Slot ${slot}: ${replacing.club} (Year ${replacing.year})`, b.x + 40, y, { size: S.small, bold: true, color: C.bad, maxWidth: b.w - 80 });
    }
    drawButton(ctx, L.change, 'Change something', { accent: C.progress });
    drawButton(ctx, L.start, 'START CLUB', { accent: colourById(setup.primary).id === 'white' ? C.good : colourById(setup.primary).hex, font: font(48, true) });
  }

  const screen = {
    get setup() {
      return setup;
    },
    get slot() {
      return slot;
    },
    get confirming() {
      return confirming;
    },
    get ready() {
      return missing().length === 0;
    },
    randomiseAll,
    enter(params = {}) {
      slot = params.slot ?? 1;
      replacing = params.replacing ?? null;
      confirming = false;
      setup = defaultSetup();
      scroll.scrollY = 0;
    },
    exit() {
      textPrompt.close();
    },
    onBack() {
      if (confirming) {
        confirming = false;
        return true;
      }
      onBack();
      return true;
    },
    onDragStart(p) {
      if (!confirming) scroll.beginDrag(p);
    },
    onDrag(p) {
      if (!confirming) scroll.drag(p);
    },
    onDragEnd(p) {
      scroll.endDrag(p);
    },
    onUp(p) {
      scroll.endDrag(p);
    },
    onWheel(p) {
      if (confirming) return;
      scroll.scrollY += p.deltaY ?? p.dy ?? 0;
      scroll.clamp();
    },
    onTap(p) {
      if (confirming) {
        const L = confirmLayout();
        if (hitRect(p, L.start)) {
          confirming = false;
          onStart(slot, { ...setup, club: setup.club.trim(), manager: setup.manager.trim() });
        } else if (hitRect(p, L.change) || !hitRect(p, L.box)) confirming = false;
        return;
      }
      if (hitRect(p, headerRect())) return void onBack();
      if (hitRect(p, bottomRect())) {
        if (screen.ready) {
          textPrompt.close();
          confirming = true;
        }
        return;
      }
      if (!scroll.contains(p)) return;
      pass(null, scroll.toContent(p)).hit?.();
    },
    render(ctx) {
      const hr = headerRect();
      const sr = layout.safeRect;
      drawButton(ctx, hr, '‹ Back', { accent: C.progress });
      text(ctx, 'Club Setup', sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 - 20, { size: S.title, bold: true, align: 'center', baseline: 'middle' });
      const sub = replacing ? `Campaign slot ${slot} · replaces ${replacing.club}` : `Campaign slot ${slot}`;
      text(ctx, sub, sr.x + sr.w / 2 + 60, hr.y + hr.h / 2 + 34, { size: S.small, bold: !!replacing, color: replacing ? C.bad : C.textMuted, align: 'center', baseline: 'middle', maxWidth: sr.w - 320 });
      const r = panelRect();
      ctx.fillStyle = C.panel;
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = THEME.panel.line;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, THEME.panel.radius);
      ctx.fill();
      ctx.stroke();
      scroll.begin(ctx);
      scroll.contentHeight = pass(ctx, null).height;
      scroll.end(ctx);
      const miss = missing();
      drawButton(ctx, bottomRect(), miss.length ? `Needs ${miss.join(' and ')}` : 'Review and start', { disabled: miss.length > 0, font: font(miss.length ? S.body : S.button, true) });
      if (confirming) drawConfirm(ctx);
    },
  };
  // Screen rect of a tappable thing (tests): 'randomAll', 'club', 'clubRandom', 'manager', 'area:coast', 'areaRandom',
  // 'primary:red', 'secondary:navy', 'coloursRandom', 'shape:hex', 'symbol:crown', 'badgeRandom', 'founder:WG01'…
  // plus 'review', 'start', 'change'.
  screen.rectOf = (what) => {
    if (what === 'review') return bottomRect();
    if (what === 'start' || what === 'change') return confirmLayout()[what];
    const rects = {};
    scroll.contentHeight = pass(null, null, rects).height;
    const r = rects[what];
    const pr = panelRect();
    return r ? { x: pr.x + r.x, y: pr.y + r.y - scroll.scrollY, w: r.w, h: r.h } : null;
  };
  screen.scrollTo = (what) => {
    const rects = {};
    scroll.contentHeight = pass(null, null, rects).height;
    const r = rects[what];
    if (r) {
      scroll.scrollY = r.y - 40;
      scroll.clamp();
    }
  };
  return screen;
}
