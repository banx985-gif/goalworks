// GOALWORKS image list: key → path (relative to index.html). Batch art is added here milestone by milestone; anything
// missing draws the placeholder box, never crashes.
import { FOUNDERS } from './setup.js';
import { REGIONAL_CLUBS } from './fixtures.js';

const art = (folder, key) => [key, `assets/images/${folder}/${key}.png`];

export const ASSETS = {
  // Milestone 0: the studio logo (splash) and the five Founders' Batch 1 pictures (setup cards, slot cards, confirm).
  studioLogo: 'assets/branding/banx_gamex_logo.png',
  ...Object.fromEntries(FOUNDERS.map((f) => art('players', f.art))),
  // Milestone 1: the club complex's three stations (Batch 2 facilities).
  ...Object.fromEntries(['facility_f01', 'facility_f03', 'facility_f04'].map((k) => art('facilities', k))),
  // Milestone 3: the match — bodies, keepers, ball, goal and corner flag (Batch 3).
  ...Object.fromEntries(['match_01', 'match_02', 'match_03', 'match_04', 'match_07', 'match_08', 'match_13', 'match_15', 'match_16'].map((k) => art('match', k))),
  // Milestone 6: the rest of the match bodies (back views), the four heads, match scenery (sub board, referee, assistant,
  // dugout, tunnel), the kit patterns for Club Setup, the Regional clubs' crests and the Club Complex props.
  ...Object.fromEntries(['match_05', 'match_06', 'match_09', 'match_10', 'match_11', 'match_12', 'match_17', 'match_18', 'match_19', 'match_23', 'match_24'].map((k) => art('match', k))),
  ...Object.fromEntries(['custom_13', 'custom_14', 'custom_15', 'custom_16', 'custom_17', 'custom_18', 'custom_19', 'custom_20'].map((k) => art('custom', k))),
  ...Object.fromEntries(REGIONAL_CLUBS.map((c) => art('crests', c.crest))),
  ...Object.fromEntries(['prop_01', 'prop_02', 'prop_03', 'prop_11', 'prop_12', 'prop_25'].map((k) => art('props', k))),
  // Milestone 0 loader test (?screen=test): the placeholder PWA icon as a real image, and one deliberately missing file.
  m0Real: 'assets/branding/pwa/icon-192.png',
  m0Missing: 'assets/m0-missing-test.png',
};
