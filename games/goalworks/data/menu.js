// The Club Menu (Milestone 12b, series common feature §1; core/ui/MenuSheet): every GOALWORKS screen in plain words, with
// its icon and a one-line "what this is for". A row opens the very same sheet / screen tapping the art (or a bottom-row
// button) opens (src/main.js MENU_OPEN: one code path). A row that can't be used yet is greyed with the reason
// (main.js menuState). Plain data only.
const row = (id, label, line, icon) => ({ id, label, line, icon });
export const MENU_GROUPS = [
  { title: 'League & Matches', rows: [
    row('league', 'Find a match', 'Regional clubs challenge you: accept one to fix a match day', 'ui_19'),
    row('matchSetup', 'Match Setup', 'Today is match day: pick Watch, Manage or Play and kick off', 'ui_30'),
  ] },
  { title: 'Team', rows: [
    row('squad', 'Team / Squad', 'Your players: stats, form, fitness, contracts', 'ui_01'),
    row('training', 'Training', 'The team session, intensity and each player’s focus', 'ui_08'),
    row('tactics', 'Tactics', 'Formation, team instructions, roles and familiarity', 'ui_07'),
    row('staff', 'Staff', 'Hire a head coach, scout, physio, youth coach and analyst', 'ui_02'), // (Milestone 14)
    row('transfers', 'Transfers & Scouting', 'Buy, sell and loan players; send the scout out', 'ui_10'),
    row('clubStore', 'Club Store', 'Items the club has earned: give one to a player to raise a stat for good', 'item_25'),
  ] },
  { title: 'Club', rows: [
    row('build', 'Build / Facilities', 'Build, move, sell and upgrade facilities on your ground', 'ui_03'),
    row('research', 'Research', 'Spend Research Points on better training, scouting and tactics', 'ui_26'),
  ] },
  { title: 'More', rows: [
    row('settings', 'Settings', 'Sound, graphics, text size, the Menu button and hints', 'gw_ui_menu'),
    row('mainMenu', 'Save and main menu', 'Saves the club, then back to the title screen', 'ui_05'),
  ] },
];
export const MENU_TEXT = { title: 'Club Menu', subtitle: 'Every screen at the club. Tapping the art works too.', button: 'Menu', icon: 'gw_ui_menu' }; // gw_ui_menu: drawn by code (core/ui/MenuSheet registerMenuIcon)

// The next-step hint line under the date (core/ui/HintLine). main.js says when each holds and what it opens; the first
// that holds is shown. Quiet while a sheet is open, in Build Mode, or with Settings → hints off. A stand-in until the
// first-time guide (Milestone 34).
export const NEXT_HINTS = {
  matchDay: 'Match day! Tap to kick off',
  firstMatch: 'Tap here (or Menu → Find a match) to find your first match',
  offers: (n) => `${n} club${n === 1 ? ' wants' : 's want'} a match: tap to pick one`,
  training: (n) => `Your next match is in ${n} day${n === 1 ? '' : 's'}: tap to set training`,
  items: (n) => `${n} item${n === 1 ? '' : 's'} in the Club Store: tap to give one to a player`,
  research: 'Research is idle: tap to start a node',
  staff: 'No staff yet: tap to hire a coach, a scout or a physio',
  upgrade: (name) => `The ${name} can be upgraded: tap to see it`,
};
