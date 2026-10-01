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
// Milestone 3: Match Setup's Kick off opens the 11 v 11 match (src/match/, src/screens/MatchScreen.js), Watch only. The
// match seed and both line-ups are fixed when it is created and saved in the campaign (data.match = { fixtureId, setup,
// steps }); a reload replays it to the same step. At full time Continue sends the score back to the calendar.
// Milestone 4: Match Setup offers Kick off · Watch (the default) or Kick off · Play (src/match/manualControl.js, the
// touch controls in src/screens/matchControls.js). A Play match saves its input log with it (data.match.play), so a
// reload replays it to the same moment too.
// Milestone 5: Kick off · Watch / Manage / Play; the Mode button switches freely mid-match (src/match/matchDirector.js,
// src/screens/matchModeUi.js), Manage gives the four team commands, and Key Moments offer a short jump into Play. The
// match save is data.match = { fixtureId, setup, steps, start, timeline, play, director } — the mode / command timeline
// and the director's state (mode, speed, camera, a Key Moment in progress) — so a reload resumes exactly where it was.
// The club remembers its team commands (data.tactics, used at the next kickoff) and the Key Moments setting
// (data.prefs.keyMoments).
// Milestone 6: kits and club colours. Kick off hands both clubs' colours (the opponent's from data/fixtures.js), our
// badge and their crest to the match set-up, which runs the kit clash check (src/match/kits.js); Match Setup shows both
// kits before kickoff. Club Setup gains the kit pattern (saved as data.club.kit). The Club Complex flies the club flag.
// Milestone 7: every run has its squad (src/systems/squad.js: the Founder + 17 generated players, a 3-person watch list,
// basic contracts) in data.squad — a save from before gets one generated once from its Founder. The Club Complex's
// temporary Team button opens the Squad screen (src/screens/SquadScreen.js). Kick off plays the best XI by position
// against a generated opponent side of the same level; the match reads the players' real ratings.
// Milestone 8: training every club day (src/systems/training.js on the calendar's clock:day: the team focus, individual
// focuses, XP into the core stats, fatigue, form and morale drifting; no training on match days or the weekly day off);
// after a match, fatigue for the XI and form / morale from the result, minutes and role. The Training screen
// (src/screens/TrainingScreen.js) opens from the Training Pitch sheet and the Squad screen. Condition feeds the match.
// Milestone 9: the club's tactics (src/systems/tactics.js: formation, seven team instructions, roles, hand-picked players,
// familiarity per formation + build style) go into each fixture; the opponent plays its own formation / style
// (data/tactics.js CLUB_TACTICS). Changes in Manage (formation, instructions, roles) are remembered for the next match.
// Familiarity grows on training days and matches in the chosen pair and fades for the others. The Tactics screen
// (src/screens/TacticsScreen.js) opens from the Squad screen and the Manager Office; Manage opens a Tactics sheet.
// Milestone 10: the Regional League (src/systems/league.js) replaces the Test Challenge. Each club day the six Regional
// clubs may issue challenges (by reputation and cooldown); the League sheet (Manager Office, Squad screen) lists them and
// Accept is the M2 commitment — the calendar only takes a challenge the league issued. A result adds to the Regional
// record, reputation (Club Rank E–S) and the Credits placeholder (shown on the result screen); 4 distinct clubs beaten +
// 8 Regional wins unlock the Promotion Match, and winning it brings the County promotion offer (County League: M17).
// Add ?debug=1 for the FPS/state overlay, ?screen=test for the scaling / tap / asset-loader test screen, ?screen=match
// (&seed=…, &mode=watch|manage|play, &km=1 for Key Moment prompts, &stats=35,70 for flat home,away test stats) for a
// test match between two test teams (never saved). With ?debug=1, &safe=phone|tablet stands in a notch and home bar (safe-area insets) on any screen.
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
import { leagueSheet, countyOfferSheet, matchSetupSheet } from './screens/fixtureSheets.js';
import * as LG from './systems/league.js';
import { REGIONAL_CLUBS as LEAGUE_CLUBS } from '../data/fixtures.js';
import { createCalendar } from './systems/calendar.js';
import { createMatchScreen } from './screens/MatchScreen.js';
import { createSquadScreen } from './screens/SquadScreen.js';
import { createTrainingScreen } from './screens/TrainingScreen.js';
import { trainDay, applyMatch, normaliseTraining } from './systems/training.js';
import { normaliseTactics, familiarityDay, familiarityMatch, teamSide, opponentSide, setRole as setClubRole } from './systems/tactics.js';
import { pairKey, FORMATIONS, formationById, rolesForSlot, ROLES } from '../data/tactics.js';
import { TACTICS } from '../data/match.js';
import { POSITIONS } from '../data/setup.js';
import { createTacticsScreen } from './screens/TacticsScreen.js';
import { ensureSquad, validateSquad, xiForMatch, opponentSquad } from './systems/squad.js';
import { createMatchSetup } from './match/lineups.js';
import { createMatchWorld, restoreMatchWorld, matchResult, MODES } from './match/matchWorld.js';
import { createMatchDirector } from './match/matchDirector.js';
import { REGIONAL_CLUBS, clubById } from '../data/fixtures.js';
import { matchKits } from './match/kits.js';
import { COLOURS } from '../data/setup.js';
const COL = THEME.color;

const W = 1080;
const BASE_H = 1920; // 9:16; taller phones grow the height (see Renderer)
const MAX_H = 2640; // up to 9:22 fills edge to edge; taller still gets thin bars top and bottom
const PARAMS = new URLSearchParams(window.location.search);
const START_SCREEN = ['test', 'match'].includes(PARAMS.get('screen')) ? PARAMS.get('screen') : 'menu';
const SAFE_PARAM = PARAMS.get('debug') === '1' ? PARAMS.get('safe') : null;
const FORCE_INSETS = { phone: { top: 47, bottom: 34, left: 0, right: 0 }, tablet: { top: 24, bottom: 20, left: 0, right: 0 } }[SAFE_PARAM] ?? null;

const bus = new EventBus();
const rng = new Rng('goalworks-m0');
const renderer = new Renderer(document.getElementById('game'), { width: W, height: BASE_H, maxHeight: MAX_H, maxDpr: 2, bus });
const layout = new UiLayout(renderer, { forceInsets: FORCE_INSETS });
bus.on('renderer:resize', () => layout.refresh());
const input = new Input(renderer, bus);
const assets = new AssetManager({ bus });
const router = new ScreenRouter(bus, { roots: ['menu', 'test', 'club', 'match'] });
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
  LG.normaliseLeague(data); // (an M9 save: no Regional record yet, reputation 0)
  // (a save from before Milestone 7: its squad is generated once, from its Founder, and saved)
  if (ensureSquad(data)) setTimeout(() => autosave.request('squad:generated'), 0);
  normaliseTraining(data); // (an M7 save: the training plan and everyone's fatigue / form / morale start neutral)
  normaliseTactics(data); // (an M8 save: 4-4-2 Balanced, its M5 commands carried across, familiar with that pair only)
  if (debug.enabled) {
    const errs = validateSquad(data.squad, data.club.founder.id);
    debug.log(errs.length ? `squad: ${errs.join('; ')}` : `squad: ${data.squad.players.length} + ${data.squad.watch.length} ok`);
  }
  open = { n, data, calendar: createCalendar({ bus, saved: data.calendar ?? null, flags: speedFlags(), isIssued: (o) => !!open && LG.isIssued(open.data, o) }), setupShown: false };
}
// The run save: the calendar written into the campaign data (and the date on the slot card).
function saveRun() {
  const o = open;
  if (!o) return Promise.resolve();
  const c = o.calendar.clock;
  o.data = { ...o.data, calendar: o.calendar.serialize(), date: { year: c.year, month: c.month, day: c.day } };
  return campaigns.save(o.n, o.data);
}
// Milestone 8: each new club day the squad trains (or rests on match day / the day off). Registered before the autosave,
// so the day's save holds the day's training.
bus.on('clock:day', () => {
  if (!open?.data?.squad || router.currentName === 'match') return;
  const c = open.calendar;
  const r = trainDay(open.data, { day: c.clock.totalDays, matchDay: c.atKickoff });
  familiarityDay(open.data, r.kind); // (M9) the chosen formation / style grows on training days; the others fade
  LG.leagueDay(open.data, c.clock.totalDays); // (M10) clubs issue / expire challenges; the Promotion Match once unlocked
  if (debug.enabled && r.kind !== 'train') debug.log(`training: ${r.kind} (day ${c.clock.totalDays})`);
});
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
  if (data.match && resumeMatch()) return;
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
// Milestone 10: the League sheet (replaces M2's Fixtures / Test Challenge sheet), and the County offer.
let leagueMsg = null; // the last Accept's answer, shown in the sheet
const calendar = () => open?.calendar ?? null;
function leagueApi() {
  if (!open) return null;
  const d = open.data;
  return {
    offers: () => LG.openOffers(d),
    rank: () => LG.rank(d),
    reputation: () => LG.reputation(d),
    record: () => LG.record(d),
    promotion: () => LG.promotion(d),
    promotionOpponent: () => LG.promotionOpponent(d),
    credits: () => d.league.credits,
    clubs: () => LEAGUE_CLUBS,
    club: (id) => LEAGUE_CLUBS.find((c) => c.id === id),
    calendarOffer: LG.calendarOffer,
    rewardOf: (id, promo) => LG.previewReward(d, id, [1, 0], promo),
    clubState: (id) => {
      const c = LEAGUE_CLUBS.find((x) => x.id === id);
      const st = d.league.clubs[id];
      const today = open.calendar.today;
      if (LG.reputation(d).total < c.rep) return `wants reputation ${c.rep}`;
      if (LG.openOffers(d).some((o) => o.clubId === id)) return 'challenging you now';
      if (st.cooldownUntil > today) return `cooling down (${st.cooldownUntil - today} days)`;
      return 'may challenge you soon';
    },
    onAccept: (offerId) => {
      const r = LG.accept(d, offerId, open.calendar);
      leagueMsg = r.ok ? null : r.why;
      if (r.ok) debug.log(`challenge accepted: ${r.fixture.opponent.name} on day ${r.fixture.matchDay}`);
    },
    onDecline: (offerId) => LG.decline(d, offerId, open.calendar.today),
    onCounty: (yes) => answerCounty(yes),
  };
}
function openLeague() {
  leagueMsg = null;
  sheet.open(leagueSheet({ calendar, league: leagueApi, message: () => leagueMsg, debugFlags: debug.enabled ? (id) => toggleSpeedFlag(id) : null }));
}
function answerCounty(yes) {
  if (yes && open && LG.acceptCounty(open.data)) {
    debug.log('County offer accepted (County League: Milestone 17)');
    autosave.request('league:county');
  }
  sheet.close();
}
function openCountyOffer() {
  sheet.open(countyOfferSheet({ clubName: () => open?.data.club.name ?? '', onAnswer: (yes) => answerCounty(yes) }));
}
async function toggleSpeedFlag(id) {
  const f = speedFlags();
  f[id] = !f[id];
  if (open) open.calendar.flags = f;
  debug.log(`account ${id}: ${f[id]}`);
  await campaigns.slots.saveAccount(account);
}
// Both kits for Match Setup (the same clash check the match runs).
function fixtureKits(club, opp) {
  const sides = fixtureSides(club, opp);
  return { ...matchKits(sides.home.colours, sides.away.colours), sides };
}
function openMatchSetup() {
  if (!open?.calendar.atKickoff) return;
  open.setupShown = true;
  sheet.open(matchSetupSheet({ calendar, clubName: () => open?.data.club.name ?? '', club: () => open?.data.club ?? null, kits: () => (open?.calendar.fixture ? fixtureKits(open.data.club, open.calendar.fixture.opponent) : null), onKickOff: (mode) => kickOff(mode), onPlayed: debug.enabled ? () => playPlaceholder() : null, resuming: () => savedMode(open?.data.match) }));
}

// --- Milestone 3: the match -------------------------------------------------------------------------------------
let match = null; // { world, director, mode: 'fixture'|'test' } — the match on screen
// The mode a saved match was left in (null: no match under way).
const savedMode = (m) => (m ? m.director?.userMode ?? m.start ?? (m.play ? 'play' : 'watch') : null);
const prefs = () => (open ? (open.data.prefs ??= { keyMoments: true }) : (testPrefs ??= { keyMoments: PARAMS.get('km') === '1' }));
let testPrefs = null; // (a ?screen=match test match: Key Moment prompts only with &km=1)
// The match on screen: the world and its director. match.speed reads / sets the director's speed; 0 (debug and tests
// only) holds the match still.
function liveMatch(world, mode, saved = null) {
  const m = {
    world,
    director: null,
    mode,
    hold: false,
    get speed() {
      return m.hold ? 0 : m.director.speed;
    },
    set speed(v) {
      m.hold = v === 0;
      if (v) m.director.setSpeed(v);
    },
  };
  match = m;
  m.director = directorFor(world, saved);
  return m;
}
// The director beside a world: saves after every change of mode, command or Key Moment; remembers the club's commands and
// the Key Moments setting.
function directorFor(world, saved = null) {
  const d = createMatchDirector(world, {
    saved,
    prompts: prefs().keyMoments !== false,
    onChange: (why) => {
      if (why === 'prompts') prefs().keyMoments = d.prompts;
      // the club remembers what it changed in Manage for the next match (M9: instructions, formation and roles)
      if ((why === 'tactic' || why === 'formation' || why === 'role') && open && match?.mode === 'fixture') {
        const t = normaliseTactics(open.data);
        t.instr = { ...world.tactics[0] };
        t.formation = world.formation[0];
        const roles = world.players.filter((p) => p.team === 0);
        for (const p of roles) setClubRole(open.data, p.slot, p.tRole);
      }
      if (why !== 'camera' && why !== 'speed') debug.log(`match: ${why}`);
      matchProgress(world, `match:${why}`);
    },
  });
  return d;
}
// The two sides of a fixture for the match set-up: our club (colours + badge) and the opponent (its kit colours and
// crest from data/fixtures.js; a club without colours gets one from its id, never our own colour).
function fixtureSides(club, opp) {
  const reg = clubById(opp.id);
  let colours = reg?.colours;
  if (!colours) {
    const list = COLOURS.filter((c) => c.id !== club.colours.primary && c.id !== 'white');
    let h = 0;
    for (const ch of String(opp.id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    colours = { primary: list[h % list.length].id, secondary: 'white' };
  }
  return {
    home: { name: club.name, colours: { ...club.colours }, badge: { ...club.badge } },
    away: { name: opp.name, colours: { ...colours }, crest: reg?.crest },
  };
}
// Milestone 7: both XIs for a fixture — ours from the squad, theirs generated at the same level (the same every time
// for this fixture).
function fixtureXIs(data, fixture) {
  return {
    home: teamSide(data).players, // (M9) in the club's formation, with its hand-picked players
    away: xiForMatch(opponentSquad({ seed: `${data.seed}:${fixture.id}`, clubId: fixture.opponent.id }).players, { formation: opponentSide(fixture.opponent.id).formation }),
  };
}
// Kick off: the seed and line-ups are fixed now and saved with the campaign; reopening resumes the same match.
// mode: 'watch' (the AI plays both sides), 'manage' (the AI plays to your team commands) or 'play' (you control our side;
// the input log is saved with the match). The club's last team commands carry into the new match.
function kickOff(mode = 'watch') {
  if (!MODES.includes(mode)) mode = 'watch';
  const f = open?.calendar.fixture;
  if (!f || !open.calendar.atKickoff) return;
  if (!open.data.match || open.data.match.fixtureId !== f.id) {
    const sides = fixtureSides(open.data.club, f.opponent);
    const xi = fixtureXIs(open.data, f);
    const setup = createMatchSetup({ seed: `${open.data.seed}:${f.id}`, home: { ...sides.home, players: xi.home }, away: { ...sides.away, players: xi.away } });
    // (M9) both sides' formations, instructions, our roles and familiarity
    const ours = teamSide(open.data);
    const theirs = opponentSide(f.opponent.id);
    setup.formation = [ours.formation, theirs.formation];
    setup.tactics = [ours.tactics, theirs.tactics];
    setup.roles = [ours.roles, []];
    setup.familiarity = [ours.familiarity, null];
    const world = createMatchWorld(setup, { start: mode });
    open.data.match = { fixtureId: f.id, ...world.serialize(), director: createMatchDirector(world, { prompts: prefs().keyMoments !== false }).serialize() };
    autosave.request('match:kickoff');
  }
  resumeMatch();
}
function resumeMatch() {
  const m = open?.data.match;
  if (!m || m.fixtureId !== open.calendar.fixture?.id) {
    if (open) open.data.match = null; // a match for a fixture that no longer exists
    return false;
  }
  const t0 = performance.now();
  liveMatch(restoreMatchWorld(m), 'fixture', m.director ?? null);
  debug.log(`match ${m.fixtureId} (${savedMode(m)}): resumed at step ${m.steps} (${Math.round(performance.now() - t0)} ms)`);
  sheet.close();
  router.go('match');
  return true;
}
function startTestMatch(seed = PARAMS.get('seed') ?? `test-${Date.now()}`, mode = MODES.includes(PARAMS.get('mode')) ? PARAMS.get('mode') : 'watch') {
  const [a, b] = [REGIONAL_CLUBS[0], REGIONAL_CLUBS[1]];
  const [hs, as] = (PARAMS.get('stats') ?? '').split(',').map((v) => (v ? Math.max(1, Math.min(99, Number(v) || 50)) : undefined));
  const setup = createMatchSetup({ seed, home: { name: a.name, colours: a.colours, crest: a.crest, stat: hs }, away: { name: b.name, colours: b.colours, crest: b.crest, stat: as } });
  liveMatch(createMatchWorld(setup, { start: mode }), 'test');
  debug.log(`test match (${mode}), seed ${seed}`);
  router.go('match');
}
function matchProgress(world, reason) {
  if (match?.mode !== 'fixture' || !open?.data.match || match.world !== world) return;
  // the whole match record: steps, the input log, the mode / command timeline and the director (a Key Moment in progress)
  open.data.match = { fixtureId: open.data.match.fixtureId, ...world.serialize(), director: match.director.serialize() };
  autosave.request(reason);
}
function matchFinished(world) {
  if (match?.mode !== 'fixture' || !open) return;
  const r = matchResult(world);
  // (M10) the Regional League: record, reputation, Credits, promotion — before the calendar closes the fixture
  const fx = open.calendar.fixture;
  const league = fx?.source === 'league' ? LG.recordResult(open.data, fx, r.score, open.calendar.today) : null;
  // Milestone 8: the XI tire; form and morale follow the result, minutes and roles
  if (open.data.squad) applyMatch(open.data, { xiIds: world.setup.home.players.map((p) => p.id).filter(Boolean), score: r.score, scorers: r.scorers });
  // (M9) familiarity: the formation / style the match started in
  if (world.setup.formation) familiarityMatch(open.data, pairKey(world.setup.formation[0], world.setup.tactics?.[0]?.build ?? 'balanced'));
  open.data.match = null;
  match = null;
  open.setupShown = false;
  open.calendar.playResult({ score: r.score, scorers: r.scorers });
  debug.log(`full time: ${r.score.join('–')}`);
  router.go('club');
  if (league?.promotionWon) setTimeout(() => openCountyOffer(), 0);
  else if (league?.promotionUnlocked) debug.log('Promotion Match unlocked');
}
async function leaveMatch() {
  if (match?.mode === 'fixture') {
    matchProgress(match.world, 'match:leave');
    match = null;
    await leaveClub();
  } else {
    match = null;
    router.go('menu');
  }
}
// Milestone 9: Manage's Tactics sheet — formation, all seven team instructions and each slot's role (the one in force
// ticked, as in the other games' sheets); the match waits while
// it is open; every change goes through the director (logged in the match timeline, remembered by the club).
function openMatchTactics() {
  const d = match?.director;
  if (!d) return;
  sheet.open(() => {
    const dd = match?.director;
    if (!dd) return null;
    const tac = dd.tactics();
    const fm = formationById(dd.formation());
    const roles = dd.rolesNow();
    const w = match.world;
    const names = w.players.filter((p) => p.team === 0).sort((a, b) => a.slot - b.slot).map((p) => p.name.split(' ').slice(-1)[0]);
    return {
      title: 'Tactics',
      subtitle: `${fm.name} · the match waits while this is open`,
      art: 'training_tactic_14',
      accent: COL.purple,
      sections: [
        { title: 'Formation', columns: 4, buttons: FORMATIONS.map((x) => ({ id: `m:formation:${x.id}`, label: `${x.id === fm.id ? '✓ ' : ''}${x.name}`, selected: x.id === fm.id, accent: COL.progress, onTap: () => dd.setFormation(x.id) })) },
        ...Object.entries(TACTICS).map(([k, def]) => ({ title: def.label, columns: def.options.length, buttons: def.options.map((o, i) => ({ id: `m:${k}:${o}`, label: `${tac[k] === o ? '✓ ' : ''}${def.names[i]}`, selected: tac[k] === o, accent: COL.purple, onTap: () => dd.setTactic(k, o) })) })),
        ...fm.slots.map((sl, i) => ({ title: `${i + 1}. ${names[i] ?? ''} · ${POSITIONS[sl.pos].name}`, columns: 3, buttons: rolesForSlot(sl).map((r) => ({ id: `m:role:${i}:${r}`, label: `${roles[i] === r ? '✓ ' : ''}${ROLES[r].name}`, selected: roles[i] === r, accent: COL.action, onTap: () => dd.setRole(i, r) })) })),
      ],
    };
  });
}
const matchScreen = createMatchScreen({
  renderer,
  layout,
  assets,
  bus,
  input,
  live: () => match,
  onMenu: () => leaveMatch(),
  onContinue: (world) => matchFinished(world),
  onReplay: () => startTestMatch(`test-${Date.now()}`, match?.director?.userMode ?? 'watch'),
  onProgress: (world, reason) => matchProgress(world, reason),
  onTactics: () => openMatchTactics(),
  // (M10) the rewards line on the result panel, before Continue records them
  resultLines: (world) => {
    if (match?.mode !== 'fixture' || !open) return null;
    const fx = open.calendar.fixture;
    if (fx?.source !== 'league') return null;
    const p = LG.previewReward(open.data, fx.opponent.id, world.score, fx.promotion);
    const rep = p.history + p.momentum;
    return [`${fx.promotion ? 'Promotion Match · ' : ''}+${p.credits} Credits (placeholder) · reputation ${rep >= 0 ? '+' : ''}${Math.round(rep)}`, fx.promotion && p.res === 'win' ? 'Promotion earned: the County offer is waiting.' : null].filter(Boolean);
  },
  held: () => sheet.active, // (the match waits while a sheet is open over it)
});
function playPlaceholder() {
  const r = open?.calendar.playResult();
  if (!r?.ok) return;
  open.setupShown = false;
  sheet.close();
}
const squadScreen = createSquadScreen({ layout, assets, sheet, club: () => open, onBack: () => router.go('club'), onTraining: () => openTraining('squad'), onTactics: () => openTactics('squad'), onLeague: () => openLeague() });
let trainingBack = 'club';
function openTraining(from = 'club') {
  trainingBack = from;
  sheet.close();
  router.go('training');
}
let tacticsBack = 'club';
function openTactics(from = 'club') {
  tacticsBack = from;
  sheet.close();
  router.go('tactics');
}
const tacticsScreen = createTacticsScreen({ layout, assets, sheet, club: () => open, onBack: () => router.go(tacticsBack), onPlayer: (id) => squadScreen.openDetail(id) });
const trainingScreen = createTrainingScreen({ layout, assets, sheet, club: () => open, onBack: () => router.go(trainingBack), onPlayer: (id) => squadScreen.openDetail(id) });
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
  onTeam: () => router.go('squad'),
  extraSections: (id) => (id === 'pitch' ? [{ title: 'Training', lines: ['Team session, intensity and individual focuses.'], buttons: [{ id: 'training', label: 'Training', accent: COL.action, onTap: () => openTraining('club') }] }] : id === 'office' ? [{ title: 'Regional League', lines: ['Challenges, your Club Rank and the road to County.'], buttons: [{ id: 'league', label: 'League', accent: COL.good, onTap: () => openLeague() }] }, { title: 'Tactics', lines: ['Formation, team instructions, roles and familiarity.'], buttons: [{ id: 'tactics', label: 'Tactics', accent: COL.purple, onTap: () => openTactics('club') }] }] : []),
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
    else if (START_SCREEN === 'match') startTestMatch();
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
  .register('match', matchScreen)
  .register('squad', squadScreen)
  .register('training', trainingScreen)
  .register('tactics', tacticsScreen)
  .register('test', createTestScreen({ renderer, layout, assets, openSheet: () => sheet.open(testSheet), onTapLogged: (p) => window.__gw?.taps.push({ x: p.x, y: p.y }) }));

// ?debug=1 (tests): accept a challenge from a club — if it has none open, it issues one first (as leagueDay would).
function issueChallenge(clubId = 'REG01') {
  if (!open) return null;
  const d = open.data;
  let o = LG.openOffers(d).find((x) => x.clubId === clubId);
  if (!o) {
    d.league.clubs[clubId].cooldownUntil = 0;
    d.league.offers.push({ id: `o${d.league.nextId++}`, clubId, issuedDay: open.calendar.today, until: open.calendar.today + 6, home: d.league.clubs[clubId].meetings % 2 === 0, promotion: false, state: 'open' });
    o = LG.openOffers(d).find((x) => x.clubId === clubId);
  }
  return o;
}
function acceptChallenge(clubId = 'REG01') {
  const o = issueChallenge(clubId);
  return o ? LG.accept(open.data, o.id, open.calendar) : { ok: false };
}
// ?debug=1: a test hook for automated checks.
if (debug.enabled) {
  window.__gw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, splashScreen, menuScreen, slotsScreen, setupScreen, clubScreen, squadScreen, trainingScreen, openTraining, tacticsScreen, openTactics, openMatchTactics, playSlot, startClub, deleteSlot, newGame, openLeague, openCountyOffer, acceptChallenge, issueChallenge, openMatchSetup, playPlaceholder, kickOff, startTestMatch, matchScreen, restoreMatchWorld, get match() { return match; }, toggleSpeedFlag, autosave, saveRun, get account() { return account; }, taps: [], get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
