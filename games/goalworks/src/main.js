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
// Milestone 11: transfers, scouting and contracts (src/systems/transfers.js, negotiation.js, scouting.js; the sheets in
// src/screens/transferSheets.js). The world's players are kept in the run (the six Regional clubs' squads now change, regional
// free agents, the wider market); the Transfers sheet opens from the Manager Office, the Squad screen and the Scout Desk.
// Deals cost the placeholder Credits; contracts count down each season; each completed deal saves at once.
// Milestone 12: facilities and Build Mode (src/systems/facilities.js on core/FacilitySystem, data/facilities.js; the
// screen in src/screens/ClubScreen.js, the Shop and Facility Detail sheets in src/screens/buildSheets.js). Each run has
// its layout (data.facilities; a save from before gets the starting facilities placed once) and the ground grows with
// the Club Rank. Every build / move / sell saves at once; effects reach training, familiarity, recovery and scouting.
// Milestone 13: research (src/systems/research.js on core/ResearchSystem, data/research.js; the sheet in
// src/screens/researchSheets.js). Each run has its research (data.research: RP, the slot, progress, nodes done, unlocks;
// an older save starts with 0 RP and nothing researched, keeping the formations it uses). RP come each club day, from
// league results and firsts; the slot works one day a club day; a finished node shows "Research complete!" and its
// effects reach training, fatigue, scouting, tactics (the formation list) and the Shop (src/systems/effects.js).
// Milestone 12b: phone fixes. A phone's GPU can wipe every canvas made in code (memory pressure): core/CanvasLoss notices
// and the sprite cache, the cached floors and the kit-tinted pictures are made again (that was the "everything vanishes at
// one zoom", the floating heads and the invisible XI and ball). Size copies are never bigger than their picture
// (SpriteCache maxUpscale 1) and copies not drawn for a minute are let go, so the GPU holds far less.
// Milestone 12b, series common features §1–2: the Menu button (bottom row of the Club Complex → the Club Menu, core/ui/
// MenuSheet, rows in data/menu.js; each row opens the same sheet the art opens, MENU_OPEN), the next-step hint line
// (core/ui/HintLine, hintRules()), and the series Settings list (core/SeriesSettings + core/ui/SettingsSheet on
// core/Settings: this device, every club) — Graphics on core/FrameGovernor, Text size, Vibration on core/Haptics, Show Menu
// button / hints, and GOALWORKS' extras (match camera, Key Moment prompts, left-hand controls). The Match Setup picture is
// the opponent's crest.
// Milestone 12c (bible addendum, series common features §3–4): facility levels 1–3 (src/systems/facilities.js on
// core/FacilitySystem levels; Upgrade in the Facility Detail sheet, finished on the calendar, a level badge on the art) and
// items (src/systems/items.js on core/ItemSystem, data/items.js; the Club Store sheets in src/screens/itemSheets.js, icons
// on core/ui/ItemArt until Aaron's item_01–25 exist). Items come from league wins, the player of the match in big games,
// the week's best training and well-wishers — never a shop. The second research slot opens at Rank A + Analytics Lab
// level 2. Saved in the run: data.facilities.levels, data.items.
// Milestone 14: support staff (src/systems/staff.js on core/StaffModel + core/StaffSystem, data/staff.js; the sheets in
// src/screens/staffSheets.js). Five roles, one hire each: Start-tier staff from day one, Rare once the County offer is
// accepted, Elite at Club Rank B; Legendary / Secret never in normal play. Hire / replace / release from the Staff sheet
// (Club Menu → Staff, the Manager Office); wages weekly and contracts by the season (data.staff). Their effects join the
// shared effect query (src/systems/effects.js): training, familiarity, scouting (the hired Scout replaces the M11
// placeholder — an older save gets Mina Reed), fatigue, the Analyst's clue / preparation on Match Setup and settling in
// Manage. Each hired staff member works at their station on the Club Complex; tap them for their card.
// Milestone 15: the academy (src/systems/academy.js, data/academy.js; the sheets in src/screens/academySheets.js). One trials
// window a year (Month 3): 3–6 young players (15–18; the first trials take the M7 watch list) with a Youth Corner, more and
// better with the Academy Building / Elite Academy, their levels and research; hidden potential stored exactly and shown as
// a range (narrower with the Youth Coach, the Scout, facilities and research); sign up to 3 an intake into the academy's
// own places. Prospects train every day; promote (Prospect contract), release, loan, retrain or mentor them from the
// Academy sheet (Club Menu → Academy, the Youth Corner / Academy Building / Elite Academy). Saved in the run: data.academy
// (an older save: empty, its first trials at the next window). The Second Training Pitch now splits training into two
// groups (the Training screen), and the hint line says where to hire a Head Coach / a Scout.
// Milestone 16: careers (src/systems/careers.js, data/careers.js; the sheets in src/screens/hallOfFameSheets.js). Every
// match counts appearances, goals, assists and clean sheets; at the season's end the world's players grow (inside their
// club's band) and the old ones decline (from 30, keepers 33; the Strength Centre slows yours); players retire inside the
// bible's windows (yours announce it four weeks ahead: a banner, a "Last season" tag), each leaving a regen behind; a
// retired legend of yours goes into the Hall of Fame in the account save (Club Menu → Hall of Fame), which every club sees.
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
import { watchCanvasLoss, canvasLost, canvasLossCount } from '../../../core/CanvasLoss.js';
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
import { Settings } from '../../../core/Settings.js';
import { FrameGovernor } from '../../../core/FrameGovernor.js';
import { Haptics } from '../../../core/Haptics.js';
import { setTextScale } from '../../../core/Theme.js';
import { HintLine } from '../../../core/ui/HintLine.js';
import { menuSheet, registerMenuIcon } from '../../../core/ui/MenuSheet.js';
import { settingsSheet } from '../../../core/ui/SettingsSheet.js';
import { SETTINGS, SETTINGS_DEFAULTS, SETTINGS_KEY, TEXT_SCALE, SETTINGS_TEXT } from '../data/settings.js';
import { MENU_GROUPS, MENU_TEXT, NEXT_HINTS } from '../data/menu.js';
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
import * as TR from './systems/transfers.js';
import { createTransferSheets } from './screens/transferSheets.js';
import { AUTOSAVE_REASON } from '../data/transfers.js';
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
import { ensureSquad, xiForMatch, opponentSquad } from './systems/squad.js';
import { createMatchSetup } from './match/lineups.js';
import { createMatchWorld, restoreMatchWorld, matchResult, MODES } from './match/matchWorld.js';
import { createMatchDirector } from './match/matchDirector.js';
import { REGIONAL_CLUBS, clubById } from '../data/fixtures.js';
import { matchKits } from './match/kits.js';
import { COLOURS } from '../data/setup.js';
import { normaliseFacilities, createLayout, bonus as facilityBonus, facilityLevel } from './systems/facilities.js';
import { shopSheet, detailSheet } from './screens/buildSheets.js';
import { RANKS } from '../data/league.js';
import { normaliseResearch, createResearch, formationLock } from './systems/research.js';
import { createResearchSheets } from './screens/researchSheets.js';
import { createResearchBanner } from './ui/researchBanner.js';
import { createItems, itemName, typeById } from './systems/items.js';
import { createItemSheets } from './screens/itemSheets.js';
import { registerItemArt, itemIcon } from '../../../core/ui/ItemArt.js';
import { ITEM_TYPES, ITEM_GROUPS, ITEM_RARITIES, ITEM_RULES, ITEM_SOURCES, groupById } from '../data/items.js';
import { facilityById } from '../data/facilities.js';
import { normaliseStaff, staffDay, inRole as staffInRole, candidates as staffCandidates, eligibility as staffEligibility } from './systems/staff.js';
import * as AC from './systems/academy.js';
import { createAcademySheets } from './screens/academySheets.js';
import * as CA from './systems/careers.js';
import { createHallOfFameSheets } from './screens/hallOfFameSheets.js';
import { POSITIONS as POS_NAMES } from '../data/setup.js';
import { createStaffSheets } from './screens/staffSheets.js';
import { STAFF, staffById, roleById, STAFF_TIERS } from '../data/staff.js';
import { preparedFamiliarity, settleSec, weaknessClue, tacticalPrep } from './systems/effects.js';
const COL = THEME.color;
const C_GOLD = COL.gold;

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
assets.sprites.maxUpscale = 1; // (M12b) a copy never bigger than its picture: far less GPU memory under a zoomed camera
watchCanvasLoss(renderer.canvas ?? document.getElementById('game')); // (M12b) a wiped canvas → the caches are made again
const router = new ScreenRouter(bus, { roots: ['menu', 'test', 'club', 'match'] });
const dialog = new Dialog({ layout, assets }); // confirm boxes (delete / replace a slot)
const researchBanner = createResearchBanner({ layout, assets }); // (M13) "Research complete!"
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
let pruneT = 0;
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
    if ((pruneT += dt) >= 5) {
      assets.sprites.prune(pruneT, 60); // (M12b) let go of copies not drawn for a minute
      pruneT = 0;
    }
    router.update(dt);
    dialog.update(dt);
    sheet.update(dt);
    researchBanner.update(dt);
  },
  render: (alpha) => {
    const ctx = renderer.begin(COL.bg);
    router.render(ctx, alpha);
    sheet.render(ctx);
    researchBanner.render(ctx);
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
// Milestone 12b: the player's settings (core/Settings: this device, every club — never part of a slot). Graphics:
// core/FrameGovernor (Low = a steady 30 FPS; Auto drops to 30 when the phone struggles) — at 30 / with Reduced flashes,
// no goal confetti and the Club Complex figures stand still. Text size → every font. Vibration → core/Haptics.
const settings = new Settings({ key: SETTINGS_KEY, defaults: SETTINGS_DEFAULTS });
const govMode = () => settings.get('fpsMode') ?? 'auto';
const governor = new FrameGovernor({ mode: govMode(), bus, capFps: true });
loop.governor = governor;
const lowFx = () => (governor.state === 'half' && settings.get('fpsMode') !== 'high') || settings.get('reducedFlashes') === true;
const haptics = new Haptics({ enabled: () => settings.get('haptics') !== false });
function applySettings() {
  setTextScale(TEXT_SCALE[settings.get('textSize')] ?? 1);
  if (governor.mode !== govMode()) governor.setMode(govMode());
}
applySettings();
settings.onChange(() => applySettings());
registerMenuIcon(assets, MENU_TEXT.icon); // the series Menu icon, drawn by code
// (M12c) item icons: placeholders in their group colour inside the code-drawn rarity frame until Aaron's files exist —
// loaded quietly when they do (assets/images/items/item_01–25.png), no code change needed
registerItemArt(assets, { types: ITEM_TYPES, groups: ITEM_GROUPS, rarities: ITEM_RARITIES, storeIcon: ITEM_RULES.storeIcon });
for (let i = 1; i <= 25; i++) {
  const k = `item_${String(i).padStart(2, '0')}`;
  assets.loadOptional(k, `assets/images/items/${k}.png`);
}
// (M14) the staff portraits: loaded quietly (the Legendary / Secret ones only with ?debug=1 — never shown in normal play)
for (const s of STAFF) if (debug.enabled || STAFF_TIERS[s.tier].gate !== 'hidden') assets.loadOptional(s.art, `assets/images/staff/${s.art}.png`);
debug.log(`seeded rng check: ${rng.int(0, 9999)} (same every reload)`);
bus.on('assets:canvasLost', ({ reason, dropped }) => debug.log(`canvas loss (${reason}): caches remade, ${dropped} made pictures dropped`));

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
  TR.normaliseTransfers(data); // (an M10 save: the world's players are generated once — the clubs' squads, free agents, the market)
  if (!data.facilities) setTimeout(() => autosave.request('facility:start'), 0); // (an M11 save: the starting facilities, placed once)
  normaliseFacilities(data);
  normaliseResearch(data); // (an M12 save: 0 RP, nothing researched; the formations it already uses are kept)
  if (debug.enabled) {
    const why = TR.rosterProblem(data.squad.players);
    debug.log(why ? `squad: ${why}` : `squad: ${data.squad.players.length} + ${data.squad.watch.length} ok`);
  }
  if (!data.items) setTimeout(() => autosave.request('items:start'), 0); // (an M12 save: an empty Club Store, likes rolled once)
  // (an M13 save: no staff, except the M11 placeholder scout, who becomes SC01 Mina Reed)
  if (data.staff?.v !== 14) setTimeout(() => autosave.request('staff:start'), 0);
  normaliseStaff(data, data.calendar?.clock?.totalDays ?? 0);
  // (an M14 save: an empty academy; its first trials are at the next window)
  if (data.academy?.v !== 15) setTimeout(() => autosave.request('academy:start'), 0);
  AC.normaliseAcademy(data, data.calendar?.clock?.totalDays ?? 0);
  // (an M15 save: careers start now — every player's appearances count from today; ages carry on as before)
  if (!data.careers) setTimeout(() => autosave.request('careers:start'), 0);
  CA.normaliseCareers(data, data.calendar?.clock?.totalDays ?? 0);
  syncHallOfFame(data);
  open = { n, data, layout: createLayout(data, { bus }), research: createResearch(data, { bus }), items: createItems(data, { bus }), calendar: createCalendar({ bus, saved: data.calendar ?? null, flags: speedFlags(), isIssued: (o) => !!open && LG.isIssued(open.data, o) }), setupShown: false };
}
// Milestone 16: the run's Hall of Famers go into the account save (they survive new games and other slots). Checked when a
// club opens and when one is inducted, so a closed app can't lose one.
function syncHallOfFame(data) {
  if (!campaigns || !CA.syncAccountHof(account, data)) return;
  campaigns.slots.saveAccount(account).catch((err) => debug.log(`account save failed: ${err?.message ?? err}`));
  debug.log(`hall of fame: ${account.hallOfFame.length} in the account`);
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
  // (M13) the day's Research Points and a work day on the node in the slot (a node finished today counts from today)
  for (const n of open.research.day(c.clock.totalDays)) researchDone(n);
  const r = trainDay(open.data, { day: c.clock.totalDays, matchDay: c.atKickoff });
  for (const x of r.players) if (x.learned) academyEvent({ kind: 'learned', id: x.id, name: open.data.squad.players.find((p) => p.id === x.id)?.name ?? '', to: x.learned }); // (M15)
  for (const e of AC.academyDay(open.data, c.clock.totalDays)) academyEvent(e); // (M15) the trials, academy training, breakthroughs, the season's end
  open.items.noteTraining(r.players); // (M12c) the week's training effort (the great-session item)
  for (const u of open.layout.tickUpgrades(c.clock.totalDays)) upgradeDone(u); // (M12c) upgrades finished today
  itemArrived(open.items.day(c.clock.totalDays, c.clock.year)); // (M12c) the season's item points; now and then a well-wisher
  familiarityDay(open.data, r.kind); // (M9) the chosen formation / style grows on training days; the others fade
  LG.leagueDay(open.data, c.clock.totalDays); // (M10) clubs issue / expire challenges; the Promotion Match once unlocked
  for (const e of staffDay(open.data, c.clock.totalDays)) staffLeft(e); // (M14) staff wages each week; contracts at the season's end
  TR.transfersDay(open.data, c.clock.totalDays); // (M11) scouting, bids, loans, wages, the AI clubs' moves, the season's end
  for (const e of CA.careersDay(open.data, c.clock.totalDays)) careerEvent(e); // (M16) retirements announced / done, the Hall of Fame
  if (open.layout.sync()) debug.log(`the ground grows: ${open.layout.stage.name} ${open.layout.stage.cols}×${open.layout.stage.rows}`); // (M12) by the Club Rank
  // (M11) contracts ending: one warning a season, from Month 9
  const T = open.data.transfers;
  if (c.clock.month >= 9 && T.warnedYear !== c.clock.year && TR.expiring(open.data).some((p) => !p.founder)) {
    T.warnedYear = c.clock.year;
    if (router.currentName === 'club' && !sheet.active) transfersUi.openExpiring();
    else debug.log('contracts ending: see Transfers → Contracts');
  }
  if (debug.enabled && r.kind !== 'train') debug.log(`training: ${r.kind} (day ${c.clock.totalDays})`);
});
// Milestone 12c: the week's best training may earn an item.
bus.on('calendar:week', () => {
  if (!open?.items || router.currentName === 'match') return;
  itemArrived(open.items.weekEnd(open.calendar.today));
});
// Milestone 12c: an item arrived / an upgrade finished — the banner (the day's save keeps it).
function itemArrived(it) {
  if (!it || it.refused) return;
  const t = typeById(it.type);
  const src = ITEM_SOURCES[it.source];
  researchBanner.show({ id: `item:${it.uid}`, title: it.source === 'wellwisher' ? 'A gift for the club!' : 'Item earned!', line: itemName(it), gives: `+${ITEM_RARITIES[it.rarity].gain} ${t.stat} · ${src?.name ?? it.source} · in the Club Store`, icon: itemIcon(it.type, it.rarity), color: C_GOLD });
  debug.log(`item: ${itemName(it)} (${it.source})`);
}
// Milestone 15: the academy's news — the trials, a breakthrough, a position learned, a prospect too old for the academy.
function academyEvent(e) {
  const corner = AC.hasAcademyBuilding(open.data) ? 'Academy Building' : 'Youth Corner';
  const show = (title, line, gives, color = C_GOLD, icon = 'facility_f09') => researchBanner.show({ id: `academy:${e.kind}:${e.id ?? e.year}:${open?.calendar.today}`, title, line, gives, icon, color });
  if (e.kind === 'window' && !e.corner) show('Academy trials this month', 'No Youth Corner to hold them', 'Build one (Build → Shop) before the month ends', COL.bad);
  else if (e.kind === 'intake') show(e.golden ? 'A golden generation!' : 'Academy trials open!', `${e.n} young players at the ${corner}`, 'Sign up to 3 · Menu → Academy');
  else if (e.kind === 'breakthrough') show('Breakthrough!', e.name, 'He is beating his projected potential', COL.good);
  else if (e.kind === 'learned') show('Position learned', `${e.name} is now a ${POS_NAMES[e.to]?.name ?? e.to}`, 'Retraining complete', COL.progress, 'training_tactic_08');
  else if (e.kind === 'left') show('Left the academy', `${e.name} (${e.age})`, 'Too old for the academy: promote prospects by 19', COL.bad);
  debug.log(`academy: ${e.kind}${e.name ? ` ${e.name}` : ''}${e.n ? ` (${e.n})` : ''}`);
}
// Milestone 16: a player of yours announces his retirement (four weeks ahead), retires, goes into the Hall of Fame.
function careerEvent(e) {
  const id = `career:${e.kind}:${e.id}:${open?.calendar.today}`;
  if (e.kind === 'announce') researchBanner.show({ id, title: 'Last season', line: `${e.name} (${e.age}) will retire`, gives: 'At the end of the season · plan for his place', icon: 'ui_29', color: COL.bad });
  else if (e.kind === 'retired' && !e.hof) researchBanner.show({ id, title: 'Retired', line: `${e.name} has hung up his boots`, gives: 'Thanks for everything · Menu → Hall of Fame', icon: 'ui_29', color: COL.progress });
  else if (e.kind === 'hof') {
    researchBanner.show({ id, title: 'Into the Hall of Fame!', line: e.name, gives: e.reasons[0] ?? '', icon: 'trophy_17', color: C_GOLD });
    syncHallOfFame(open.data);
  }
  debug.log(`career: ${e.kind} ${e.name}`);
}
// Milestone 14: a staff contract ran out.
function staffLeft(e) {
  const def = staffById(e.id);
  researchBanner.show({ id: `staffLeft:${e.id}:${open?.calendar.today}`, title: 'Contract ended', line: `${e.name} has left the club`, gives: `Your ${roleById(def.role).name} role is free: hire someone in Staff`, icon: def.art, color: COL.bad });
  debug.log(`staff left: ${e.id}`);
}
function upgradeDone(u) {
  const it = open?.layout.item(u.uid);
  if (!it) return;
  researchBanner.show({ id: `level:${u.uid}:${u.level}`, title: 'Upgrade complete!', line: `${it.def.name} · level ${u.level}`, gives: `Its effect is now ×${[1, 1.5, 2][u.level - 1]}`, icon: it.def.art, color: C_GOLD });
  debug.log(`upgrade done: ${it.def.id} level ${u.level}`);
}
// Milestone 13: a node finished — the banner, and the day's save (or an explicit one) keeps it.
function researchDone(n) {
  researchBanner.show(n);
  debug.log(`research complete: ${n.id} ${n.name}`);
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
  settings.attachStore(adapter, 'settings'); // (M12b) the settings slot in the account store too
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
  onSettings: () => openSettings(), // (M12b) the series list
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
  sheet.open(matchSetupSheet({ calendar, clubName: () => open?.data.club.name ?? '', club: () => open?.data.club ?? null, kits: () => (open?.calendar.fixture ? fixtureKits(open.data.club, open.calendar.fixture.opponent) : null), onKickOff: (mode) => kickOff(mode), onPlayed: debug.enabled ? () => playPlaceholder() : null, resuming: () => savedMode(open?.data.match), clue: () => matchClue() }));
}

// (M14) the Analyst's line on Match Setup: the opponent clue (Match Notes) and the match preparation
function matchClue() {
  const f = open?.calendar.fixture;
  if (!f) return null;
  const c = weaknessClue(open.data, f.opponent.id);
  const prep = tacticalPrep(open.data);
  if (!c && !prep) return null;
  return `${c ? `${c.by}: ${c.text}.` : `${staffInRole(open.data, 'AN')?.name}:`}${prep ? ` Preparation +${prep}%.` : ''}`;
}
// --- Milestone 3: the match -------------------------------------------------------------------------------------
let match = null; // { world, director, mode: 'fixture'|'test' } — the match on screen
// The mode a saved match was left in (null: no match under way).
const savedMode = (m) => (m ? m.director?.userMode ?? m.start ?? (m.play ? 'play' : 'watch') : null);
// (M12b) a club's Key Moment prompts follow Settings → Key Moment prompts (switching them in a match changes the setting)
const prefs = () => (open ? { keyMoments: settings.get('keyMoments') !== false } : (testPrefs ??= { keyMoments: PARAMS.get('km') === '1' }));
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
      if (why === 'prompts') {
        if (open) settings.set('keyMoments', d.prompts);
        else prefs().keyMoments = d.prompts;
      }
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
    // (M11) the club's own squad as it is now (it signs and sells); a club the world does not know: generated as before
    away: xiForMatch(data.transfers?.clubs?.[fixture.opponent.id]?.players ?? opponentSquad({ seed: `${data.seed}:${fixture.id}`, clubId: fixture.opponent.id }).players, { formation: opponentSide(fixture.opponent.id).formation }),
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
    setup.familiarity = [preparedFamiliarity(open.data, ours.familiarity), null]; // (M14) the Analyst's match preparation
    setup.settle = [settleSec(open.data), 0]; // (M14) Manage changes settle over this many match seconds (Live Read: faster)
    const world = createMatchWorld(setup, { start: mode });
    open.data.match = { fixtureId: f.id, ...world.serialize(), director: createMatchDirector(world, { prompts: prefs().keyMoments !== false, camera: settings.get('matchCamera') ?? 'full' }).serialize() };
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
  if (league) open.research.match({ clubId: fx.opponent.id, score: r.score, promotion: !!fx.promotion }, open.calendar.today); // (M13) RP
  open.layout.sync(); // (M12) a new Club Rank grows the ground
  // Milestone 8: the XI tire; form and morale follow the result, minutes and roles
  const xiIds = world.setup.home.players.map((p) => p.id).filter(Boolean);
  if (open.data.squad) applyMatch(open.data, { xiIds, score: r.score, scorers: r.scorers });
  if (open.data.squad) CA.recordMatch(open.data, { xiIds, score: r.score, scorers: r.scorers }); // (M16) career stats, club records
  if (open.data.transfers) TR.afterMatch(open.data, xiIds); // (M11) a promised role not met: morale
  // (M9) familiarity: the formation / style the match started in
  if (world.setup.formation) familiarityMatch(open.data, pairKey(world.setup.formation[0], world.setup.tactics?.[0]?.build ?? 'balanced'));
  // (M12c) a win: maybe an item; in a big game the player of the match's item
  const won = league && r.score[0] > r.score[1] ? open.items.afterWin({ clubId: fx.opponent.id, promotion: !!fx.promotion, xiIds, scorers: r.scorers, day: open.calendar.today }) : [];
  open.data.match = null;
  match = null;
  open.setupShown = false;
  open.calendar.playResult({ score: r.score, scorers: r.scorers });
  debug.log(`full time: ${r.score.join('–')}`);
  router.go('club');
  for (const it of won) itemArrived(it);
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
        { title: 'Formation', columns: 4, buttons: FORMATIONS.map((x) => {
          const lock = match.mode === 'fixture' && open && x.id !== fm.id ? formationLock(open.data, x.id) : null; // (M13) R25 Formation Library
          return { id: `m:formation:${x.id}`, label: `${x.id === fm.id ? '✓ ' : ''}${x.name}`, selected: x.id === fm.id, locked: !!lock, accent: COL.progress, onTap: () => !lock && dd.setFormation(x.id) };
        }) },
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
    const rp = open.research.previewMatch({ clubId: fx.opponent.id, score: world.score, promotion: !!fx.promotion }); // (M13)
    return [`${fx.promotion ? 'Promotion Match · ' : ''}+${p.credits} Credits (placeholder) · reputation ${rep >= 0 ? '+' : ''}${Math.round(rep)} · +${rp} RP`, fx.promotion && p.res === 'win' ? 'Promotion earned: the County offer is waiting.' : null].filter(Boolean);
  },
  held: () => sheet.active, // (the match waits while a sheet is open over it)
  leftHanded: () => settings.get('leftHanded') === true, // (M12b)
  lowFx,
});
function playPlaceholder() {
  const r = open?.calendar.playResult();
  if (!r?.ok) return;
  open.setupShown = false;
  sheet.close();
}
const squadScreen = createSquadScreen({ layout, assets, sheet, club: () => open, onBack: () => router.go('club'), onTraining: () => openTraining('squad'), onTactics: () => openTactics('squad'), onLeague: () => openLeague(), onTransfers: () => transfersUi.openTransfers('market'), onContract: (id) => transfersUi.openOwn(id), detailExtra: (p) => playerItemsSection(p) });
// Milestone 11: the Transfers sheets (every finished deal saves at once, bible §36).
const transfersUi = createTransferSheets({
  sheet,
  assets,
  dialog,
  run: () => open?.data ?? null,
  today: () => open?.calendar.today ?? 0,
  dateText: (day) => {
    const d = open?.calendar.clock.dateOf(day);
    return d ? `Year ${d.year} · Month ${d.month} · Day ${d.day}` : '';
  },
  onDeal: () => autosave.request(AUTOSAVE_REASON),
});
// Milestone 13: the Research sheet (starting / stopping a node saves at once).
const researchUi = createResearchSheets({ sheet, research: () => open?.research ?? null, onChange: (why) => autosave.request(why) });
let trainingBack = 'club';
function openTraining(from = 'club') {
  trainingBack = from;
  if (open) (open.data.prefs ??= {}).trainingSeen = true; // (M12b) the "set training" hint has done its job
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
  onResearch: () => researchUi.openResearch(), // (M13)
  // (M12) Build Mode: the Shop, the Facility Detail sheet, the sell confirm; every change saves at once
  onShop: () => openShop(),
  detailSheet: (st, api) => detailSheet(st, api),
  confirm: (o) => dialog.confirm(o),
  onLayoutChanged: (why) => {
    debug.log(`${why}: ${open?.data.league.credits} Credits`);
    autosave.request(why);
  },
  extraSections: (defId) => facilitySections(defId),
  staffSheet: (id) => staffUi.cardMenu(id), // (M14) a tap on a staff figure
  // (M12b) the Menu button and the hint line
  showMenu: () => settings.get('showMenu') !== false,
  onNavMenu: () => openNavMenu(),
  menuIcon: MENU_TEXT.icon,
  hint: { get current() { return hintLine.current; }, update: (dt) => hintLine.update(dt), render: (ctx) => hintLine.render(ctx), handleTap: (p) => hintLine.handleTap(p) },
  lowFx,
});
// What a facility's sheet opens (the old station sheets' rows): a training pitch → Training; the Manager Office → League,
// Tactics, Transfers, (M13) Research; the Video Room and Analytics Lab → Research; the Scout Desk → Scout Reports; (M12) the Tactics Board Room → Tactics, the Recruitment Office → Transfers.
// (M12b) Each sheet says what the place is for and offers its main action as a named button.
function facilitySections(defId) {
  const training = { title: 'What it’s for', lines: ['The team trains here every club day: set the session, its intensity and each player’s focus.'], buttons: [{ id: 'training', label: 'Set training', accent: COL.action, onTap: () => openTraining('club') }] };
  const office = { title: 'What it’s for', lines: ['Where you run the club: find a match, set tactics, do transfers and contracts.'], columns: 2, buttons: [{ id: 'league', label: 'Find a match', accent: COL.good, onTap: () => openLeague() }, { id: 'contracts', label: 'Contracts', accent: COL.gold, onTap: () => transfersUi.openTransfers('mine') }] };
  const league = { title: 'Regional League', lines: ['Challenges, your Club Rank and the road to County.'], buttons: [{ id: 'league', label: 'League', accent: COL.good, onTap: () => openLeague() }] };
  const tactics = { title: 'Tactics', lines: ['Formation, team instructions, roles and familiarity.'], buttons: [{ id: 'tactics', label: 'Tactics', accent: COL.purple, onTap: () => openTactics('club') }] };
  const transfers = { title: 'Transfers', lines: ['Market, free agents, loans and your contracts.'], buttons: [{ id: 'transfers', label: 'Transfers', accent: COL.gold, onTap: () => transfersUi.openTransfers('market') }] };
  const research = { title: 'Research', lines: ['Research Points, the research slot and the 36 nodes in six branches.'], buttons: [{ id: 'research', label: 'Research', accent: COL.progress, onTap: () => researchUi.openResearch() }] };
  const staff = { title: 'Staff', lines: ['Hire a head coach, scout, physio, youth coach and analyst.'], buttons: [{ id: 'staff', label: 'Staff', accent: COL.purple, icon: 'ui_02', onTap: () => staffUi.openStaff() }] };
  const scout = { title: 'What it’s for', lines: ['Send the scout to a region; reports list players with their stats as ranges.'], buttons: [{ id: 'scoutReports', label: 'Scout players', accent: COL.gold, onTap: () => transfersUi.openTransfers('scout') }] };
  const kit = { title: 'What it’s for', lines: ['The kit and equipment live here — and the Club Store: items the club has earned, to give to players.'], buttons: [{ id: 'clubStore', label: 'Club Store', sub: open?.items ? `${open.items.count} of ${open.items.max} items` : '', icon: ITEM_RULES.storeIcon, accent: COL.gold, onTap: () => itemsUi.openClubStore() }] };
  // (M15) the academy at the Youth Corner / Academy Building / Elite Academy; where to hire a Head Coach and a Scout
  const academy = { title: 'Academy', lines: [AC.hasCorner(open?.data) ? `${AC.academyCount(open.data)} of ${AC.placesOf(open.data)} places · the trials every Month 3` : 'The trials need a Youth Corner.'], buttons: [{ id: 'academy', label: 'Academy', sub: 'Trials, prospects, promote, loan, retrain, mentor', icon: 'ui_12', accent: COL.good, onTap: () => academyUi.openAcademy() }] };
  const hireIf = (role, line, label) => (open && !staffInRole(open.data, role) ? [{ title: line, columns: 1, buttons: [{ id: `hire${role}`, label, sub: 'Staff · see the candidates', icon: 'ui_02', accent: COL.purple, onTap: () => openStaffRole(role) }] }] : []);
  const coachHire = hireIf('HC', 'No Head Coach yet: training runs without one', 'Hire a Head Coach');
  const scoutHire = hireIf('SC', 'No scout yet: nobody can go out to find players', 'Hire a scout');
  const youthHire = hireIf('YC', 'No Youth Coach yet: potential is hard to read', 'Hire a Youth Coach');
  return { F01: [training, ...coachHire], F11: [training], F03: [office, staff, tactics, transfers, research], F04: [scout, ...scoutHire], F06: [kit], F08: [tactics], F09: [academy, ...youthHire], F14: [academy, ...youthHire], F26: [academy, ...youthHire], F13: [research], F24: [research], F25: [transfers] }[defId] ?? [];
}
// (M15) Hiring for one role: the first candidate who can be hired now (their card: Hire), else the Staff sheet.
function openStaffRole(role) {
  const d = open?.data;
  if (!d) return;
  const def = staffCandidates(d, role).find((x) => staffEligibility(d, x).ok);
  if (def) staffUi.openCard(def.id);
  else staffUi.openStaff();
}

// --- Milestone 12b: the Club Menu, the next-step hint line, Settings ---------------------------------------------------
// What each Menu row opens: the very same function the art / bottom row uses (one code path, two ways in).
const MENU_OPEN = {
  league: () => openLeague(),
  matchSetup: () => openMatchSetup(),
  squad: () => {
    sheet.close();
    router.go('squad');
  },
  training: () => openTraining('club'),
  tactics: () => openTactics('club'),
  transfers: () => transfersUi.openTransfers('market'),
  clubStore: () => openClubStore?.(),
  build: () => {
    sheet.close();
    clubScreen.setBuildMode(true);
  },
  research: () => researchUi.openResearch(),
  staff: () => staffUi.openStaff(), // (M14)
  academy: () => academyUi.openAcademy(), // (M15)
  hallOfFame: () => hofUi.openHallOfFame(), // (M16)
  settings: () => openSettings(),
  mainMenu: () => leaveClub(),
};
const matchesPlayed = (d) => Object.values(LG.record(d).clubs).reduce((n, c) => n + c.w + c.d + c.l, 0);
function menuState(id) {
  if (id === 'matchSetup') return open?.calendar.atKickoff ? { sub: `Today: ${open.calendar.fixture?.opponent.name ?? ''} · pick Watch, Manage or Play` } : { hidden: true };
  if (id === 'league') {
    const n = open ? LG.openOffers(open.data).length : 0;
    if (open?.calendar.fixture && !open.calendar.atKickoff) return { sub: `Next match: ${open.calendar.fixture.opponent.name} in ${open.calendar.daysToMatch} days` };
    return n ? { badge: n, sub: `${n} club${n === 1 ? ' wants' : 's want'} a match: accept one to fix a match day` } : {};
  }
  if (id === 'staff' && open?.data.staff) {
    const n = open.data.staff.hired.length;
    return { sub: n ? `${n} of 5 roles filled: tap to see them or hire more` : 'Nobody yet: hire a coach, a scout, a physio…' };
  }
  if (id === 'academy' && open?.data.academy) {
    const d = open.data;
    const I = d.academy.intake;
    if (I?.candidates && AC.intakeOpen(d, open.calendar.today)) return { badge: I.candidates.length || null, sub: `Trials open: ${I.candidates.length} young players · sign up to ${3 - I.signed.length}` };
    if (!AC.placesOf(d)) return { sub: 'No academy yet: build a Youth Corner first' };
    return { sub: `${AC.academyCount(d)} of ${AC.placesOf(d)} places · trials every Month 3` };
  }
  if (id === 'hallOfFame') {
    const n = account.hallOfFame?.length ?? 0;
    const leaving = open?.data.squad.players.filter((p) => p.retiring).length ?? 0;
    return { badge: leaving || null, sub: leaving ? `${leaving} player${leaving === 1 ? ' retires' : 's retire'} this season · ${n} legend${n === 1 ? '' : 's'}` : n ? `${n} legend${n === 1 ? '' : 's'} · club records` : 'Club legends and records' };
  }
  if (id === 'clubStore') return openClubStore && open?.items ? { badge: open.items.inventory.length || null } : { hidden: true };
  return {};
}
function openNavMenu() {
  if (!open) return;
  sheet.open(() => menuSheet({ title: MENU_TEXT.title, subtitle: MENU_TEXT.subtitle, art: MENU_TEXT.icon, accent: COL.progress, groups: MENU_GROUPS, open: (id) => MENU_OPEN[id]?.(), state: menuState }));
}
// The hint rules: the first that holds is shown (data/menu.js words).
function hintRules() {
  const d = () => open.data;
  const cal = () => open.calendar;
  return [
    { id: 'matchDay', text: NEXT_HINTS.matchDay, when: () => cal().atKickoff, open: () => openMatchSetup() },
    // (M15) the trials come once a year for a month: ahead of the everyday hints
    { id: 'trials', text: () => NEXT_HINTS.trials(d().academy.intake.candidates.length, 3 - d().academy.intake.signed.length), when: () => AC.intakeOpen(d(), cal().today) && d().academy.intake.candidates.length > 0 && d().academy.intake.signed.length < 3 && AC.academyCount(d()) < AC.placesOf(d()), open: () => academyUi.openAcademy() },
    { id: 'firstMatch', text: NEXT_HINTS.firstMatch, when: () => !cal().fixture && matchesPlayed(d()) === 0, open: () => openLeague() },
    { id: 'offers', text: () => NEXT_HINTS.offers(LG.openOffers(d()).length), when: () => !cal().fixture && LG.openOffers(d()).length > 0, open: () => openLeague() },
    { id: 'training', text: () => NEXT_HINTS.training(cal().daysToMatch), when: () => !!cal().fixture && !d().prefs?.trainingSeen, open: () => openTraining('club') },
    // (M15) where to hire: a Head Coach at the Training Pitch, a Scout at the Scout Desk (their sheets have the Hire button)
    { id: 'coach', text: NEXT_HINTS.coach, when: () => !!open.data.staff && !staffInRole(d(), 'HC'), open: () => clubScreen.openSheet('pitch') },
    { id: 'scout', text: NEXT_HINTS.scout, when: () => !!open.data.staff && !staffInRole(d(), 'SC'), open: () => clubScreen.openSheet('scout') },
    { id: 'items', text: () => NEXT_HINTS.items(open.items.inventory.length), when: () => !!openClubStore && !!open.items && open.items.inventory.length > 0, open: () => openClubStore() },
    { id: 'research', text: NEXT_HINTS.research, when: () => !open.research.current() && open.research.rp >= 40, open: () => researchUi.openResearch() },
  ];
}
const hintLine = new HintLine({
  rect: () => clubScreen.rectOf('hint'),
  rules: hintRules(),
  quiet: () => !open || router.currentName !== 'club' || sheet.active || clubScreen.buildMode || dialog.active || loop.paused || settings.get('showHints') === false,
});
// Settings: the series list in its order, Help / Privacy / Credits, then GOALWORKS' extras, then the display test.
// Reachable from the Main Menu (always) and the Club Menu.
function openSettings() {
  const ok = [{ id: 'ok', label: 'OK', accent: COL.progress }];
  sheet.open(() =>
    settingsSheet({
      settings,
      list: SETTINGS,
      text: SETTINGS_TEXT,
      art: MENU_TEXT.icon,
      icons: { help: 'ui_28', legal: 'ui_05', credits: 'ui_27' },
      onHelp: () => dialog.show({ title: SETTINGS_TEXT.help, body: SETTINGS_TEXT.helpBody, buttons: ok }),
      onLegal: () => dialog.show({ title: SETTINGS_TEXT.legal, body: SETTINGS_TEXT.legalBody, buttons: ok }),
      onCredits: () => dialog.show({ title: SETTINGS_TEXT.credits, body: SETTINGS_TEXT.creditsBody, buttons: ok }),
      after: [{ id: 'test', label: SETTINGS_TEXT.display, sub: SETTINGS_TEXT.displayLine, accent: COL.progress, onTap: () => router.go('test') }],
    }),
  );
}
// Milestone 12c: the Club Store (from the Club Menu, the Kit Room, the hint line and Player Detail).
const itemsUi = createItemSheets({ sheet, dialog, items: () => open?.items ?? null, squad: () => open?.data.squad?.players ?? [], onChange: (why) => autosave.request(why) });
const openClubStore = () => itemsUi.openClubStore();
// Milestone 14: the Staff sheets (every hire / release / extension saves at once).
const staffUi = createStaffSheets({
  sheet,
  dialog,
  run: () => open?.data ?? null,
  today: () => open?.calendar.today ?? 0,
  month: () => open?.calendar.clock.month ?? 1,
  onChange: (why) => {
    debug.log(`${why}: ${open?.data.league.credits} Credits`);
    autosave.request(why);
  },
  debug: debug.enabled,
  whereNow: (id) => {
    const f = clubScreen.world?.byId(`staff:${id}`);
    return f ? clubScreen.world.stateOf(f) : null;
  },
});
// Milestone 15: the Academy sheets (every signing / promotion / loan / release saves at once).
const academyUi = createAcademySheets({
  sheet,
  dialog,
  assets,
  run: () => open?.data ?? null,
  today: () => open?.calendar.today ?? 0,
  dateText: (day) => {
    const dd = open?.calendar.clock.dateOf(day);
    return dd ? `Year ${dd.year} · Month ${dd.month} · Day ${dd.day}` : '';
  },
  onChange: (why) => {
    debug.log(`${why}: academy ${open?.data.academy?.players.length}`);
    autosave.request(why);
  },
  onBuild: () => MENU_OPEN.build(),
  onYouthCoach: () => openStaffRole('YC'),
});
// Milestone 16: the Hall of Fame sheets (the account's legends; this club's records and retirements).
const hofUi = createHallOfFameSheets({ sheet, assets, entries: () => account.hallOfFame ?? [], run: () => open?.data ?? null });
// Player Detail's Items section: what they love, what they've had, Give an item.
function playerItemsSection(p) {
  const I = open?.items;
  if (!I || p.watch || !open.data.squad.players.includes(p)) return [];
  const got = I.received(p.id);
  return [{
    title: 'Items',
    lines: [I.lovesText(p.id), got.length ? `Received: ${got.map((g) => `${ITEM_RARITIES[g.rarity]?.name ?? ''} ${typeById(g.type)?.name ?? g.type} (+${g.gain} ${g.stat})`).join(', ')}` : 'No items received yet.', `${I.pointsLeft(p.id)} of ${ITEM_RULES.periodCap} item points left this season`],
    columns: 1,
    buttons: [{ id: 'giveItem', label: 'Give an item', sub: `${I.count} in the Club Store`, icon: ITEM_RULES.storeIcon, disabled: !I.count, accent: COL.gold, onTap: () => itemsUi.openGiveTo(p.id) }],
  }];
}

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

// Milestone 12: the Facility Shop (Build Mode's Shop button). Picking an open facility puts its ghost on the ground.
function openShop() {
  if (!open) return;
  sheet.open(shopSheet({ layout: () => open?.layout ?? null, credits: () => open?.data.league.credits ?? 0, rank: () => (open ? LG.rank(open.data).id : 'E'), onPick: (defId) => clubScreen.startBuild(defId) }));
}
// ?debug=1 (tests): a Club Rank for the open club (its reputation history set to that rank's minimum; the ground grows).
function setRank(id) {
  const r = RANKS.find((x) => x.id === id);
  if (!open || !r) return null;
  open.data.league.rep.history = r.min;
  open.data.league.rep.momentum = 0;
  open.layout.sync();
  return open.layout.stage;
}
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
  window.__gw = { renderer, layout, input, loop, router, assets, sheet, dialog, systemBack, textPrompt, splashScreen, menuScreen, slotsScreen, setupScreen, clubScreen, squadScreen, trainingScreen, openTraining, tacticsScreen, openTactics, openMatchTactics, playSlot, startClub, deleteSlot, openShop, setRank, facilityBonus, researchUi, researchBanner, get research() { return open?.research ?? null; }, newGame, openLeague, openCountyOffer, acceptChallenge, issueChallenge, transfers: transfersUi, TR, openMatchSetup, playPlaceholder, kickOff, startTestMatch, matchScreen, restoreMatchWorld, get match() { return match; }, toggleSpeedFlag, autosave, saveRun, canvasLost, canvasLossCount, itemsUi, staffUi, normaliseStaff, academyUi, AC, openStaffRole, hofUi, CA, syncHallOfFame, facilityLevel: (id) => (open ? facilityLevel(open.data, id) : 0), get items() { return open?.items ?? null; }, settings, governor, lowFx, haptics, hintLine, openNavMenu, MENU_OPEN, menuState, openSettings, get account() { return account; }, taps: [], get campaigns() { return campaigns; }, get open() { return open; } };
}

router.go('boot');
loop.start();
