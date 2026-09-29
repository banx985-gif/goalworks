// GOALWORKS — boot (Milestone 0: project shell + campaign slots + Club Setup).
// Starts the shared series engine from core/ (renderer, safe areas, fixed-step loop, input, router, assets, debug
// overlay, saves), shows the Banx Gamex studio splash while the pictures and saves load, then opens the Main Menu:
// Continue (the last-used slot) · Campaign Slots · New Game · Settings.
// New Game / an empty slot → Club Setup → START CLUB writes the slot's summary record and an empty campaign save
// (core/CampaignSlots, keys campaign_1 … campaign_4, account store goalworks:account) and opens the placeholder club
// complex. Starting into an occupied slot asks first, naming that slot's club and year.
// Milestone 1: the club screen is the real Club Complex (src/screens/ClubScreen.js): a small ground in the 3/4 view, the
// Training Pitch, Manager Office and Scout Desk, and the Founder walking between them; tap for their sheets.
// Milestone 2: each open club has a calendar (src/systems/calendar.js, on core/Clock): 2.5 s a day at 1×, Pause / 1× /
// 2× only while a valid fixture is pending / 4× locked; the temporary Test Challenge in the Manager Office sheet commits a
// fixture 7 days ahead; on kickoff day the calendar pauses and Match Setup opens (also after a reload). Saved by
// core/Autosave each day (so a reload resumes the same day), at each week, commit, kickoff and result, and when the app
// goes to the background. The account speed unlocks (permanent 2× / 4×) live in the account store; ?debug=1 can flip them.
// Add ?debug=1 for the FPS/state overlay, ?screen=test for the scaling / tap / asset-loader test screen.
import { THEME, font } from '../../../core/Theme.js';
import { EventBus } from '../../../core/EventBus.js';
import { Rng } from '../../../core/Rng.js';
import { Renderer } from '../../../core/Renderer.js';
import { UiLayout } from '../../../core/UiLayout.js';
import { Input } from '../../../core/Input.js';
import { ScreenRouter } from '../../../core/ScreenRouter.js';
import { AssetManager } from '../../../core/AssetManager.js';
import { FixedStepLoop } from '../../../core/FixedStepLoop.js';
import { DebugOverlay } from '../../../core/DebugOverlay.js';
import { SystemBack } from '../../../core/SystemBack.js';
import { createStorageAdapter } from '../../../core/StorageAdapter.js';
import { DataValidator } from '../../../core/DataValidator.js';
import { Autosave } from '../../../core/Autosave.js';
import { TextPrompt } from '../../../core/ui/TextPrompt.js';
import { BottomSheet } from '../../../core/ui/BottomSheet.js';
import { Dialog } from '../../../core/ui/Modal.js';
import { drawButton, hitRect, setPressPoint, clearPress } from '../../../core/ui/Button.js';
import { ASSETS } from '../data/assets.js';
import { SAVE } from '../data/save.js';
import { validateSetup } from '../data/setup.js';
import { createCampaigns } from './app/campaigns.js';
import { createSplashScreen } from './screens/SplashScreen.js';
import { createMenuScreen } from './screens/MenuScreen.js';
import { createSlotsScreen } from './screens/SlotsScreen.js';
import { createSetupScreen } from './screens/SetupScreen.js';
import { createClubScreen } from './screens/ClubScreen.js';
import { createTestScreen } from './screens/TestScreen.js';
import { fixturesSheet, matchSetupSheet } from './screens/fixtureSheets.js';
import { createCalendar } from './systems/calendar.js';
const COL = THEME.color;

const W = 1080;
const BASE_H = 1920; // 9:16; taller phones grow the height (see Renderer)
const MAX_H = 2640; // up to 9:22 fills edge to edge; taller still gets thin bars top and bottom
const PARAMS = new URLSearchParams(window.location.search);
const START_SCREEN = PARAMS.get('screen') === 'test' ? 'test' : 'menu';

const bus = new EventBus();
const rng = new Rng('goalworks-m0');
const renderer = new Renderer(document.getElementById('game'), { width: W, height: BASE_H, maxHeight: MAX_H, maxDpr: 2, bus });
const layout = new UiLayout(renderer);
bus.on('renderer:resize', () => layout.refresh());
const input = new Input(renderer, bus);
const assets = new AssetManager({ bus });
const router = new ScreenRouter(bus, { roots: ['menu', 'test', 'club'] });
const dialog = new Dialog({ layout, assets }); // confirm boxes (delete / replace a slot)
const sheet = new BottomSheet({ layout, assets });
const textPrompt = new TextPrompt({ renderer });
bus.on('screen:change', () => textPrompt.close());
bus.on('screen:change', () => sheet.close());
bus.on('renderer:resize', () => textPrompt.close());

// Sprites are cached at the screen's real pixel size: remake them when that changes.
assets.setPixelScale(renderer.pixelScale);
bus.on('renderer:resize', () => {
  assets.setPixelScale(renderer.pixelScale);
  debug.top = debugTop();
});

// Pressed button look: any button under a finger that is down.
bus.on('input:down', (p) => setPressPoint(p, renderer.pixelScale));
bus.on('input:up', () => clearPress());
bus.on('input:dragstart', () => clearPress());

const onTestScreen = () => router.currentName === 'test';
const loop = new FixedStepLoop({
  stepHz: 60,
  bus,
  update: (dt) => {
    if (open && router.currentName === 'club') {
      open.calendar.update(dt); // the club calendar only runs while the club is on screen
      open.data.playSec = (open.data.playSec ?? 0) + dt;
      if (open.calendar.atKickoff && !open.setupShown && !clubScreen.buildMode) openMatchSetup(); // kickoff day (also right after a reload)
    }
    autosave.tick(dt);
    router.update(dt);
    dialog.update(dt);
    sheet.update(dt);
  },
  render: (alpha) => {
    const ctx = renderer.begin(COL.bg);
    router.render(ctx, alpha);
    sheet.render(ctx);
    dialog.render(ctx);
    if (onTestScreen()) drawButton(ctx, pauseButton(), loop.paused ? 'RESUME' : 'PAUSE', { selected: loop.paused });
    if (loop.paused) drawPaused(ctx);
    debug.compact = sheet.active || !onTestScreen(); // one FPS line on the menus, the full box on the test screen
    debug.render(ctx);
  },
});
const debugTop = () => layout.safeRect.h - 600;
const debug = new DebugOverlay({ loop, renderer, layout, input, bus, top: debugTop(), maxLines: 3 });
bus.on('loop:pause', () => input.reset());
debug.log(`seeded rng check: ${rng.int(0, 9999)} (same every reload)`);

// ---------------------------------------------------------------------------
// Pause: the test screen's button pauses the whole loop (P / Space too); while paused any tap resumes. Hiding the app
// pauses the loop (core).
const pauseButton = () => layout.anchor('top-right', 240, THEME.button.minH, 80);
router.modal = {
  get active() {
    return loop.paused || dialog.active;
  },
  onTap: (p) => (loop.paused ? loop.resume('tap') : dialog.onTap(p)),
  onDown: (p) => dialog.active && dialog.onDown?.(p),
  onUp: (p) => dialog.active && dialog.onUp?.(p),
  onBack: () => (loop.paused ? loop.resume('back') : dialog.onBack()),
};
window.addEventListener('keydown', (e) => {
  if (e.key !== 'p' && e.key !== 'P' && e.key !== ' ') return;
  if (textPrompt.active || dialog.active || !onTestScreen()) return;
  loop.togglePause();
});
function drawPaused(ctx) {
  const H = renderer.height;
  ctx.fillStyle = COL.overlay;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.chip;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 300, H / 2 - 90, 600, 220, THEME.panel.radius);
  ctx.fill();
  ctx.fillStyle = COL.textOnDark;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(96, true);
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = font(THEME.size.body);
  ctx.fillText('tap to resume', W / 2, H / 2 + 80);
}

// The sheet is asked before the screen; the test screen's pause button before both.
router.layers.push(
  {
    get active() {
      return onTestScreen();
    },
    handleInput: (hook, p) => {
      if (hook !== 'onTap' || !hitRect(p, pauseButton())) return false;
      loop.pause('button');
      return true;
    },
  },
  {
    get active() {
      return sheet.active;
    },
    handleInput: (hook, p) => sheet.handleInput(hook, p),
    onBack: () => sheet.onBack(),
  },
);

// Back (phone/browser Back, Esc, "‹ Back"): resume a paused loop, close the dialog / sheet, or go back a screen.
// Returns false at the Main Menu with nothing open, so the next Back leaves the app.
function back() {
  if (loop.paused) {
    loop.resume('back');
    return true;
  }
  return router.back();
}
const systemBack = new SystemBack({ onBack: back });
bus.on('input:up', () => systemBack.rearm()); // re-arm after any tap, in case a Back at the menu let it go

let campaigns = null;
let open = null; // { n, data, calendar, setupShown } — the campaign on screen
let account = {}; // the account store (core/CampaignSlots): speedUnlocks { perm2x, perm4x } for now
const speedFlags = () => (account.speedUnlocks ??= { perm2x: false, perm4x: false });

// A campaign's calendar from its save (a save from before Milestone 2 starts on Year 1 · Month 1 · Day 1).
function openRun(n, data) {
  open = { n, data, calendar: createCalendar({ bus, saved: data.calendar ?? null, flags: speedFlags() }), setupShown: false };
}
// The run save: the calendar written into the campaign data (and the date on the slot card).
function saveRun() {
  const o = open;
  if (!o) return Promise.resolve();
  const c = o.calendar.clock;
  o.data = { ...o.data, calendar: o.calendar.serialize(), date: { year: c.year, month: c.month, day: c.day } };
  return campaigns.save(o.n, o.data);
}
// Autosave (core/Autosave) at the bible §36 boundaries that exist now: each in-game week, match commitment, pre-kickoff,
// match result — plus each day and the app going to the background, so a reload comes back on the same day.
const autosave = new Autosave({
  bus,
  triggers: ['clock:day', 'calendar:week', 'fixture:committed', 'fixture:kickoff', 'fixture:result'],
  save: () => saveRun(),
  stamp: () => (open ? JSON.stringify(open.calendar.serialize()) : null),
  running: () => !!open && router.currentName === 'club' && !open.calendar.clock.paused,
  enabled: () => !!open,
});
autosave.installBackground();
bus.on('autosave:failed', ({ error }) => debug.log(`save failed: ${error?.message ?? error}`));
bus.on('fixture:committed', ({ fixture }) => debug.log(`fixture: ${fixture.opponent.name} on day ${fixture.matchDay}`));
bus.on('fixture:kickoff', ({ fixture }) => debug.log(`kickoff: ${fixture.opponent.name}`));
bus.on('fixture:result', ({ fixture }) => debug.log(`result: ${fixture.opponent.name} — Match played`));

async function prepareSaves() {
  const adapter = await createStorageAdapter({ dbName: SAVE.dbName, prefix: SAVE.localPrefix });
  campaigns = createCampaigns({ adapter, save: SAVE, bus });
  if (debug.enabled && PARAMS.get('reset') === '1') for (const n of campaigns.slots.numbers()) await campaigns.slots.remove(n);
  await campaigns.refresh();
  account = await campaigns.slots.loadAccount();
  speedFlags();
  if (debug.enabled) {
    const r = validateSetup(new DataValidator()).report();
    debug.log(r.ok ? `setup lists: ${r.counts.checks} checks passed` : `setup data: ${r.errors.join('; ')}`);
    if (!r.ok) console.error('[GOALWORKS] setup data', r.errors);
  }
}
const cards = () => campaigns?.cards ?? [];

// A reload while a club is open comes back to that club (this browser tab only).
const CLUB_KEY = 'goalworks:club';
function rememberClub(n) {
  try {
    if (n) sessionStorage.setItem(CLUB_KEY, String(n));
    else sessionStorage.removeItem(CLUB_KEY);
  } catch {}
}
function clubToResume() {
  try {
    const n = Number(sessionStorage.getItem(CLUB_KEY));
    return n && campaigns?.card(n)?.summary ? n : null;
  } catch {
    return null;
  }
}

async function playSlot(n) {
  let data = null;
  try {
    data = await campaigns.open(n);
  } catch (err) {
    console.error('[GOALWORKS] could not load slot', n, err);
  }
  if (!data) {
    debug.log(`slot ${n}: nothing to load`);
    await campaigns.refresh();
    router.go('slots', { mode: 'browse' });
    return;
  }
  openRun(n, data);
  debug.log(`slot ${n} opened: ${data.club.name}`);
  rememberClub(n);
  router.go('club');
}

async function startClub(n, setup) {
  await campaigns.refresh();
  const old = campaigns.card(n);
  const write = async () => {
    const data = await campaigns.start(n, setup);
    openRun(n, data);
    debug.log(`new club in slot ${n}: ${setup.club}, founder ${setup.founder}`);
    rememberClub(n);
    router.go('club');
  };
  if (old && !old.empty) {
    const was = old.summary ? `"${old.summary.club}" (Year ${old.summary.year}, Month ${old.summary.month})` : 'the save in it';
    dialog.confirm({
      title: `Replace Slot ${n}?`,
      body: `Slot ${n} holds ${was}. Starting "${setup.club}" here replaces it for good. Your account progress is kept.`,
      yes: 'Replace',
      danger: true,
      onYes: write,
    });
    return;
  }
  await write();
}

function deleteSlot(n) {
  const name = campaigns.card(n)?.summary?.club;
  dialog.confirm({
    title: `Delete Slot ${n}?`,
    body: name ? `"${name}" will be gone for good. This can't be undone.` : 'This save will be gone for good.',
    yes: 'Delete',
    danger: true,
    onYes: async () => {
      await campaigns.remove(n);
      if (open?.n === n) open = null;
      debug.log(`slot ${n} deleted`);
    },
  });
}

function newGame() {
  const n = campaigns.firstEmpty();
  if (n != null) router.go('setup', { slot: n });
  else router.go('slots', { mode: 'new', note: 'All 4 slots are full. Pick one to replace.' });
}
function setupFor(n) {
  const c = campaigns.card(n);
  router.go('setup', { slot: n, replacing: c?.summary ?? null });
}

const menuScreen = createMenuScreen({
  renderer,
  layout,
  continueInfo: () => {
    const n = campaigns?.last;
    return n ? { n, summary: campaigns.card(n).summary } : null;
  },
  onContinue: (n) => playSlot(n),
  onSlots: () => router.go('slots', { mode: 'browse' }),
  onNewGame: () => newGame(),
  onSettings: () =>
    sheet.open(() => ({
      title: 'Settings',
      subtitle: 'Sound, text size and other options will live here.',
      accent: COL.progress,
      sections: [{ buttons: [{ id: 'test', label: 'Display test', accent: COL.progress, onTap: () => router.go('test') }] }],
    })),
});
const slotsScreen = createSlotsScreen({
  layout,
  assets,
  cards,
  last: () => campaigns?.last ?? null,
  onBack: () => router.go('menu'),
  onPlay: (n) => playSlot(n),
  onDelete: (n) => deleteSlot(n),
  onNewInSlot: (n) => setupFor(n),
});
function leaveSetup() {
  const to = router.backTarget;
  router.go(to?.name ?? 'menu', to?.params ?? {});
}
const setupScreen = createSetupScreen({ layout, assets, textPrompt, onBack: () => leaveSetup(), onStart: (n, setup) => startClub(n, setup) });
async function leaveClub() {
  if (open) await autosave.flush().catch(() => {});
  rememberClub(null);
  router.go('menu');
  await campaigns.refresh();
  open = null;
}
// Milestone 2 sheets: the Manager Office's temporary Fixtures row, and Match Setup on kickoff day.
let fixtureMsg = null; // the last commit's answer, shown in the Fixtures sheet
const calendar = () => open?.calendar ?? null;
function openFixtures() {
  fixtureMsg = null;
  sheet.open(
    fixturesSheet({
      calendar,
      message: () => fixtureMsg,
      onCommit: (offer) => {
        const r = open.calendar.commit(offer);
        fixtureMsg = r.ok ? null : r.why; // (on success the sheet shows the scheduled match itself)
      },
      debugFlags: debug.enabled ? (id) => toggleSpeedFlag(id) : null,
    }),
  );
}
async function toggleSpeedFlag(id) {
  const f = speedFlags();
  f[id] = !f[id];
  if (open) open.calendar.flags = f;
  debug.log(`account ${id}: ${f[id]}`);
  await campaigns.slots.saveAccount(account);
}
function openMatchSetup() {
  if (!open?.calendar.atKickoff) return;
  open.setupShown = true;
  sheet.open(matchSetupSheet({ calendar, clubName: () => open?.data.club.name ?? '', onPlayed: () => playPlaceholder() }));
}
function playPlaceholder() {
  const r = open?.calendar.playResult();
  if (!r?.ok) return;
  open.setupShown = false;
  sheet.close();
}
const clubScreen = createClubScreen({
  renderer,
  layout,
  assets,
  bus,
  sheet,
  club: () => open,
  onMenu: () => leaveClub(),
  debug,
  calendar,
  onMatchSetup: () => openMatchSetup(),
  extraSections: (id) => (id === 'office' ? [{ title: 'Fixtures', lines: ['Temporary Test Challenge until the league arrives.'], buttons: [{ id: 'fixtures', label: 'Fixtures (test)', accent: COL.action, onTap: () => openFixtures() }] }] : []),
});

// ---------------------------------------------------------------------------
// Splash (the boot screen): the studio logo while the images and the saves load, then the Main Menu (or the club a
// reload left open, or the test screen).
const splashScreen = createSplashScreen({
  renderer,
  assets,
  load: (onProgress) =>
    Promise.all([
      assets.loadImages(ASSETS, (done, total) => onProgress(done / total)).then((r) => debug.log(`assets: ${r.loaded} loaded, ${r.missing.length} missing`)),
      prepareSaves().catch((err) => console.error('[GOALWORKS] saves unavailable', err)),
    ]),
  done: () => {
    const n = START_SCREEN === 'menu' ? clubToResume() : null;
    if (n) playSlot(n);
    else router.go(START_SCREEN);
  },
});

// The Milestone 0 placeholder sheet (test screen).
const testSheet = () => ({
  title: 'Test sheet',
  subtitle: 'Placeholder bottom sheet for Milestone 0.',
  art: 'm0Real',
  sections: [
    {
      lines: ['Close it with ✕, by tapping above it, with Close, or with the phone Back button.'],
      buttons: [
        { id: 'menu', label: 'Main Menu', onTap: () => router.go('menu') },
        { id: 'close', label: 'Close', accent: COL.progress, onTap: () => sheet.close() },
      ],
    },
  ],
});

router
  .register('boot', splashScreen)
  .register('menu', menuScreen)
  .register('slots', slotsScreen)
  .register('setup', setupScreen)
  .register('club', clubScreen)
  .register('test', createTestScreen({ renderer, layout, assets, openSheet: () => sheet.open(testSheet), onTapLogged: (p) => window.__gw?.taps.push({ x: p.x, y: p.y }) }));

// ?debug=1: a test hook for automated checks.
if (debug.enabled) {
  window.__gw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, splashScreen, menuScreen, slotsScreen, setupScreen, clubScreen, playSlot, startClub, deleteSlot, newGame, openFixtures, openMatchSetup, playPlaceholder, toggleSpeedFlag, autosave, saveRun, get account() { return account; }, taps: [], get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
