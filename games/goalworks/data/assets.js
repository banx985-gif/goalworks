// GOALWORKS image list: key → path (relative to index.html). Batch art is added here milestone by milestone; anything
// missing draws the placeholder box, never crashes.
import { FOUNDERS } from './setup.js';
import { ALL_CLUBS } from './fixtures.js';
import { CUPS } from './cups.js';
import { FACILITIES } from './facilities.js';
import { GODS } from './gods.js';
import { CAST } from './cast.js';

const art = (folder, key) => [key, `assets/images/${folder}/${key}.png`];

export const ASSETS = {
  // Milestone 0: the studio logo (splash) and the five Founders' Batch 1 pictures (setup cards, slot cards, confirm).
  studioLogo: 'assets/branding/banx_gamex_logo.png',
  ...Object.fromEntries(FOUNDERS.map((f) => art('players', f.art))),
  // Milestone 1: the club complex's three stations; Milestone 12: all 35 facilities (Batches 2–3; F34 / F35 load too but
  // never appear in normal play).
  ...Object.fromEntries(FACILITIES.map((f) => art('facilities', f.art))),
  // Milestone 3: the match — bodies, keepers, ball, goal and corner flag (Batch 3).
  ...Object.fromEntries(['match_01', 'match_02', 'match_03', 'match_04', 'match_07', 'match_08', 'match_13', 'match_15', 'match_16'].map((k) => art('match', k))),
  // Milestone 6: the rest of the match bodies (back views), the four heads, match scenery (sub board, referee, assistant,
  // dugout, tunnel), the kit patterns for Club Setup, the Regional clubs' crests and the Club Complex props.
  ...Object.fromEntries(['match_05', 'match_06', 'match_09', 'match_10', 'match_11', 'match_12', 'match_17', 'match_18', 'match_19', 'match_23', 'match_24'].map((k) => art('match', k))),
  ...Object.fromEntries(['custom_13', 'custom_14', 'custom_15', 'custom_16', 'custom_17', 'custom_18', 'custom_19', 'custom_20'].map((k) => art('custom', k))),
  ...Object.fromEntries(ALL_CLUBS.map((c) => art('crests', c.crest))), // (M17: the County clubs' crests too)
  ...Object.fromEntries(['prop_01', 'prop_02', 'prop_03', 'prop_11', 'prop_12', 'prop_25'].map((k) => art('props', k))),
  // Milestone 8: the training focus icons (Batch 5).
  ...Object.fromEntries(Array.from({ length: 20 }, (_, i) => `training_tactic_${String(i + 1).padStart(2, '0')}`).map((k) => art('training', k))), // (11–20, the tactic icons: Milestone 9)
  // Milestone 13: the Research icon and the six branch icons (Batch 6 UI).
  // Milestone 12b: the Club Menu's icons (M14: Staff, ui_02; Team, Develop, Transfer, League, Match Play, Achievement, Rumour).
  ...Object.fromEntries(['ui_02', 'ui_26', 'ui_08', 'ui_09', 'ui_12', 'ui_13', 'ui_07', 'ui_05', 'ui_01', 'ui_03', 'ui_10', 'ui_19', 'ui_30', 'ui_27', 'ui_28'].map((k) => [k, `assets/images/ui/${k}.png`])),
  // Milestone 16: the Hall of Fame — its Menu icon, the plaque and the legend shirt display (Batch 6).
  ...Object.fromEntries(['ui_29'].map((k) => [k, `assets/images/ui/${k}.png`])),
  ...Object.fromEntries(['trophy_17', 'trophy_18'].map((k) => art('trophies', k))),
  // Milestone 20: the premier crown trophy (the Crown Champions sheet).
  ...Object.fromEntries(['trophy_07'].map((k) => art('trophies', k))),
  // Milestone 21b: Awards Night — the four award trophies and the Fans' voice (the Board, the Press and the stand-in coach
  // use ui_05 / ui_19 / ui_08, already loaded; the Showcase's gold cup is made in code from tournament_c01).
  ...Object.fromEntries(['trophy_10', 'trophy_11', 'trophy_12', 'trophy_13'].map((k) => art('trophies', k))),
  ui_23: 'assets/images/ui/ui_23.png',
  // Milestone 17: the cups' pictures (C02 County Shield).
  ...Object.fromEntries(Object.values(CUPS).map((c) => art('tournaments', c.art))),
  // Milestone 20b: the Works Gods (stand-ins from the base pictures; Cowork swaps in the GOALWORKS outfits under the same names).
  ...Object.fromEntries(Object.values(GODS).map((g) => art(g.kind === 'player' ? 'players' : 'staff', g.art))),
  // Milestone 22b: the chibi cast's nine filed faces (Cowork's stand-ins, 512×512; walking sheets come later).
  ...Object.fromEntries(CAST.filter((c) => c.still).map((c) => art('cast', c.still))),
  // Milestone 23: the Finance, Sponsor and Fans icons, and the two secret sponsors' logos. (SP01–SP08's logos are optional:
  // OPTIONAL_ASSETS below, loaded quietly if Aaron's files are there; until then a text badge drawn in code.)
  ...Object.fromEntries(['ui_22', 'ui_24'].map((k) => [k, `assets/images/ui/${k}.png`])),
  ...Object.fromEntries(['sponsor_secret_01', 'sponsor_secret_02'].map((k) => art('sponsors', k))),
  // Milestone 0 loader test (?screen=test): the placeholder PWA icon as a real image, and one deliberately missing file.
  m0Real: 'assets/branding/pwa/icon-192.png',
  m0Missing: 'assets/m0-missing-test.png',
};

// (M23) Pictures that may not exist yet: loaded quietly if they are there (core/AssetManager loadOptional — no warning, no
// placeholder box); while missing, the code draws its own stand-in (SP01–SP08: a text badge, src/ui/sponsorArt.js).
export const OPTIONAL_ASSETS = Object.fromEntries(['sp01', 'sp02', 'sp03', 'sp04', 'sp05', 'sp06', 'sp07', 'sp08'].map((n) => [`sponsor_${n}`, `assets/images/sponsors/sponsor_${n}.png`]));
