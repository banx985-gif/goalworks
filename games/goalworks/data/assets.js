// GOALWORKS image list: key → path (relative to index.html). Batch art is added here milestone by milestone; anything
// missing draws the placeholder box, never crashes.
import { FOUNDERS } from './setup.js';

const art = (folder, key) => [key, `assets/images/${folder}/${key}.png`];

export const ASSETS = {
  // Milestone 0: the studio logo (splash) and the five Founders' Batch 1 pictures (setup cards, slot cards, confirm).
  studioLogo: 'assets/branding/banx_gamex_logo.png',
  ...Object.fromEntries(FOUNDERS.map((f) => art('players', f.art))),
  // Milestone 1: the club complex's three stations (Batch 2 facilities).
  ...Object.fromEntries(['facility_f01', 'facility_f03', 'facility_f04'].map((k) => art('facilities', k))),
  // Milestone 0 loader test (?screen=test): the placeholder PWA icon as a real image, and one deliberately missing file.
  m0Real: 'assets/branding/pwa/icon-192.png',
  m0Missing: 'assets/m0-missing-test.png',
};
