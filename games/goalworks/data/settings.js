// Settings (Milestone 12b, series common feature §2): the series list (core/SeriesSettings — same entries, order and names
// as Robot Workshop, RACEWORKS, DEVWORKS and CAREWORKS) on core/Settings, kept on this device under SETTINGS_KEY (and in
// the account store) — never in a campaign slot, so every club on this device shares them. GOALWORKS' own extras come
// after Help / Privacy / Credits. (M32) the sound switches drive src/app/sound.js; the accessibility extras below (bible §39)
// change only how the game looks, sounds and feels in your hands — never a result, so nothing they touch can block an
// achievement or a secret (tests/goalworks/m32.test.mjs).
import { seriesSettings, SERIES_SETTINGS_DEFAULTS, TEXT_SCALE } from '../../../core/SeriesSettings.js';

const onOff = [{ id: false, label: 'Off' }, { id: true, label: 'On' }];
export const SETTINGS = seriesSettings({
  lines: {
    muted: 'All sound effects on or off: the crowd, the whistle, the ball, the club and the big moments.',
    showHints: 'A line under the date saying what to do next; tap it to go there.',
  },
  extras: [
    { id: 'matchCamera', label: 'Match camera', group: 'In the match', options: [{ id: 'full', label: 'Full pitch' }, { id: 'follow', label: 'Follow' }, { id: 'close', label: 'Close' }], line: 'The camera a new match starts with (Watch and Manage). You can still change it during the match.' },
    { id: 'keyMoments', label: 'Key Moment prompts', group: 'In the match', options: onOff, line: 'In Watch and Manage, offer a short jump into Play at the big chances.' },
    { id: 'leftHanded', label: 'Left-hand controls', group: 'In the match', options: onOff, line: 'Play mode: the buttons on the left and the stick on the right.' },
    // (M32) Play controls (bible §39); aim assist and auto-switch are kept with each match from its kickoff
    { id: 'stickSize', label: 'Stick size', group: 'In the match', options: [{ id: 'small', label: 'Small' }, { id: 'normal', label: 'Normal' }, { id: 'large', label: 'Large' }], line: 'Play mode: how big the movement stick is.' },
    { id: 'aimAssist', label: 'Aim assist', group: 'In the match', options: [{ id: 0, label: 'Off' }, { id: 1, label: 'Low' }, { id: 2, label: 'Medium' }, { id: 3, label: 'High' }], line: 'Play mode: your shots lean towards the corner the keeper can’t reach. How well a shot comes off is still the player’s own.' },
    { id: 'autoSwitch', label: 'Auto-switch', group: 'In the match', options: [{ id: 'off', label: 'Off' }, { id: 'low', label: 'Low' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }], line: 'Play mode: how readily control jumps to the player nearest the ball when you lose it. Off: only the Switch button.' },
    { id: 'reducedMotion', label: 'Reduced motion', group: 'Feel and look', options: onOff, line: 'No zooming pop-ups or bouncing banners; the big moments simply appear.' },
    { id: 'highContrast', label: 'High-contrast pitch', group: 'Feel and look', options: onOff, line: 'Bolder rings round the player you control, the ball carrier and the ball.' },
    { id: 'kitCheck', label: 'Colour-blind kit check', group: 'Feel and look', options: onOff, line: 'Kits that look alike to a red-blind or green-blind viewer count as a clash: the away side changes kit.' },
    // (M24) the walking people on the club complex (Graphics: Low also means fewer)
    { id: 'walkers', label: 'Walking people', group: 'At the club', options: [{ id: 'all', label: 'All' }, { id: 'fewer', label: 'Fewer' }, { id: 'off', label: 'Off' }], line: 'The workers, fans and visitors walking round the club. Fewer or Off keeps an older phone smooth (Graphics: Low also means fewer).' },
  ],
});
export const SETTINGS_DEFAULTS = { ...SERIES_SETTINGS_DEFAULTS, matchCamera: 'full', keyMoments: true, leftHanded: false, walkers: 'all', stickSize: 'normal', aimAssist: 0, autoSwitch: 'normal', reducedMotion: false, highContrast: false, kitCheck: false };
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
  legalBody: 'GOALWORKS keeps your clubs on this device. It has no account and collects no personal data of its own. Every club and player is fictional. GOALWORKS has optional ads and optional purchases (Club Tokens and Remove Ads); nothing for sale changes a match, a player or a secret.',
  credits: 'Credits',
  creditsLine: 'The people behind GOALWORKS',
  creditsBody: 'GOALWORKS — a Canvas Management Series game by Aaron (Banx Games). Art by Aaron; code by Claude Code. The Works Gods — Bolt, Jinx, Zip, Kaching and Havoc — a Banx Games series cast. Thanks for playing!',
  display: 'Display test',
  displayLine: 'The screen-shape and tap test (for checking a new phone)',
};
