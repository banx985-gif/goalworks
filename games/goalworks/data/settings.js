// Settings (Milestone 12b, series common feature §2): the series list (core/SeriesSettings — same entries, order and names
// as Robot Workshop, RACEWORKS, DEVWORKS and CAREWORKS) on core/Settings, kept on this device under SETTINGS_KEY (and in
// the account store) — never in a campaign slot, so every club on this device shares them. GOALWORKS' own extras come
// after Help / Privacy / Credits. GOALWORKS has no sound yet: the sound switches are kept and read all the same.
import { seriesSettings, SERIES_SETTINGS_DEFAULTS, TEXT_SCALE } from '../../../core/SeriesSettings.js';

const onOff = [{ id: false, label: 'Off' }, { id: true, label: 'On' }];
export const SETTINGS = seriesSettings({
  lines: {
    muted: 'All music and sound effects on or off (the club’s sounds arrive in a later update).',
    showHints: 'A line under the date saying what to do next; tap it to go there.',
  },
  extras: [
    { id: 'matchCamera', label: 'Match camera', group: 'In the match', options: [{ id: 'full', label: 'Full pitch' }, { id: 'follow', label: 'Follow' }, { id: 'close', label: 'Close' }], line: 'The camera a new match starts with (Watch and Manage). You can still change it during the match.' },
    { id: 'keyMoments', label: 'Key Moment prompts', group: 'In the match', options: onOff, line: 'In Watch and Manage, offer a short jump into Play at the big chances.' },
    { id: 'leftHanded', label: 'Left-hand controls', group: 'In the match', options: onOff, line: 'Play mode: the buttons on the left and the stick on the right.' },
  ],
});
export const SETTINGS_DEFAULTS = { ...SERIES_SETTINGS_DEFAULTS, matchCamera: 'full', keyMoments: true, leftHanded: false };
export const SETTINGS_KEY = 'goalworks:settings';
export { TEXT_SCALE };
export const SETTINGS_TEXT = {
  title: 'Settings',
  subtitle: 'This device · every club',
  helpGroup: 'Help and about',
  help: 'Help / tutorial replay',
  helpLine: 'How to run the club. The first-time guide comes in a later update.',
  helpBody: 'Tap anything at the club — a facility, the Founder — to open it, or use the Menu button. Find a match: Menu → Find a match (or the Manager Office), accept a challenge, and on match day Match Setup opens. Set training at the Training Pitch. The line under the date always says what to do next.',
  legal: 'Privacy & legal',
  legalLine: 'How your clubs are kept',
  legalBody: 'GOALWORKS keeps your clubs on this device. It has no account and collects no personal data of its own. Every club and player is fictional.',
  credits: 'Credits',
  creditsLine: 'The people behind GOALWORKS',
  creditsBody: 'GOALWORKS — a Canvas Management Series game by Aaron (Banx Games). Art by Aaron; code by Claude Code. Thanks for playing!',
  display: 'Display test',
  displayLine: 'The screen-shape and tap test (for checking a new phone)',
};
