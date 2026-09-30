// Kits (Milestone 6, bible §5 "Club colours" / art list §1–2 "match sprites designed for code tinting"). Plain data: which
// painted colour in each picture becomes which club colour (core/ArtRecolor rules), the kit patterns of Club Setup, the
// keepers' colours and the clash rule. The rules live in src/match/kits.js (clash check, Node-tested) and src/ui/kitArt.js
// (the recoloured pictures).
//
// Match bodies (Batch 3): each outfield body is painted in one kit colour (shirt + socks) with white (or black) shorts
// and trim. `rules` pick those paints; `paint` says which club colour each takes: 'shirt' (the kit's first colour),
// 'shorts' (its second), 'keeper'. Skin, hair, boots and outlines match no rule, so they stay as painted; `open` drops
// thin lines (outline edges, boot stripes, studs) from the white / black areas.
// head: where the bald head sits (fractions of the picture: centre x, y and radius) — heads match_09–12 go on top.
// view: 'front' (running towards the camera / across) or 'back' (running away up the pitch; hair painted on).
// (keep: ellipses left as painted — the head's shine, boots, painted hair.)
const head = (x, y, r) => ({ x, y, rx: r * 1.1, ry: r * 1.1 });
const WHITE = (keep) => ({ neutral: true, maxChroma: 0.26, light: [0.42, 1], open: 5, keep });
const DARK = (keep) => ({ neutral: true, maxChroma: 0.14, light: [0.11, 0.42], open: 5, keep });

export const BODY_ART = {
  match_01: { view: 'front', rules: [{ hue: 356, full: 9, none: 15, minSat: 0.45 }, WHITE([head(0.615, 0.2, 0.185)])], paint: ['shirt', 'shorts'], head: { x: 0.615, y: 0.2, r: 0.185 } },
  match_02: { view: 'front', rules: [{ hue: 222, full: 14, none: 24, minSat: 0.35 }, WHITE([head(0.49, 0.215, 0.18)])], paint: ['shirt', 'shorts'], head: { x: 0.49, y: 0.215, r: 0.18 } },
  match_03: { view: 'front', rules: [{ hue: 48, full: 10, none: 16, minSat: 0.5 }, DARK([{ x: 0.14, y: 0.86, rx: 0.09, ry: 0.11 }, { x: 0.58, y: 0.76, rx: 0.08, ry: 0.1 }, head(0.525, 0.2, 0.2)])], paint: ['shirt', 'shorts'], head: { x: 0.525, y: 0.22, r: 0.18 } },
  match_04: { view: 'front', rules: [{ hue: 142, full: 14, none: 24, minSat: 0.3 }, WHITE([head(0.405, 0.22, 0.18)])], paint: ['shirt', 'shorts'], head: { x: 0.405, y: 0.22, r: 0.18 } },
  match_05: { view: 'back', rules: [{ neutral: true, maxChroma: 0.16, light: [0.6, 1], open: 4 }, DARK([{ x: 0.54, y: 0.85, rx: 0.1, ry: 0.1 }, { x: 0.5, y: 0.26, rx: 0.26, ry: 0.19 }])], paint: ['shirt', 'shorts'], head: null },
  match_06: { view: 'back', rules: [{ neutral: true, maxChroma: 0.16, light: [0.6, 1], open: 4 }, DARK([{ x: 0.35, y: 0.79, rx: 0.1, ry: 0.12 }, { x: 0.55, y: 0.76, rx: 0.07, ry: 0.07 }, { x: 0.5, y: 0.22, rx: 0.24, ry: 0.17 }])], paint: ['shirt', 'shorts'], head: null },
  match_07: { view: 'front', keeper: true, rules: [{ hue: 268, full: 16, none: 28, minSat: 0.3 }], paint: ['keeper'], head: { x: 0.52, y: 0.21, r: 0.185 } },
  match_08: { view: 'front', keeper: true, rules: [{ hue: 193, full: 12, none: 22, minSat: 0.3 }], paint: ['keeper'], head: { x: 0.53, y: 0.22, r: 0.18 } },
};
export const FRONT_BODIES = ['match_01', 'match_02', 'match_03', 'match_04'];
export const BACK_BODIES = ['match_05', 'match_06'];
export const KEEPER_BODIES = ['match_07', 'match_08'];
export const HEADS = ['match_09', 'match_10', 'match_11', 'match_12'];

// Kit patterns for Club Setup's preview (custom_13–20, painted in fixed colours). Each pattern's two main paints swap to
// the club's: rules[0] → primary, rules[1] → secondary. plain: the code-drawn kit (no art).
export const KIT_PATTERNS = [
  { id: 'plain', name: 'Plain', art: null },
  { id: 'trim', name: 'Trim', art: 'custom_13', rules: [{ hue: 218, full: 16, none: 28, minSat: 0.3 }, WHITE()] },
  { id: 'sash', name: 'Sash', art: 'custom_14', rules: [{ neutral: true, maxChroma: 0.12, light: [0.42, 1], open: 3 }, { hue: 356, full: 12, none: 22, minSat: 0.4 }] },
  { id: 'hoops', name: 'Hoops', art: 'custom_15', rules: [{ hue: 152, full: 14, none: 26, minSat: 0.3 }, { neutral: true, maxChroma: 0.12, light: [0.42, 1], open: 3 }] },
  { id: 'chevron', name: 'Chevron', art: 'custom_16', rules: [{ neutral: true, maxChroma: 0.12, light: [0.42, 1], open: 3 }, { hue: 214, full: 14, none: 26, minSat: 0.3 }] },
  { id: 'raglan', name: 'Raglan', art: 'custom_17', rules: [{ neutral: true, maxChroma: 0.12, light: [0.42, 1], open: 3 }, { hue: 210, full: 16, none: 28, minSat: 0.3 }] },
  // custom_18's red stripes fade out softly into the black: light club colours come out rough, so Stripes uses the
  // code-drawn kit (clean: false) and keeps its rules for a redraw.
  { id: 'stripes', name: 'Stripes', art: 'custom_18', clean: false, rules: [{ neutral: true, maxChroma: 0.12, light: [0.1, 0.34], open: 4 }, { hue: 358, full: 12, none: 22, minSat: 0.4 }] },
  { id: 'halves', name: 'Halves', art: 'custom_19', rules: [{ hue: 214, full: 14, none: 26, minSat: 0.3 }, { neutral: true, maxChroma: 0.12, light: [0.42, 1], open: 3 }] },
  { id: 'pinstripe', name: 'Pinstripe', art: 'custom_20', rules: [{ hue: 172, full: 12, none: 22, minSat: 0.25 }, { hue: 42, full: 14, none: 22, minSat: 0.25, light: [0.45, 0.95] }] },
];
export const patternById = (id) => KIT_PATTERNS.find((p) => p.id === id) ?? KIT_PATTERNS[0];

// Two shirts closer than this (CIE76 ΔE in Lab) are a clash: the away side changes. 48 splits the palette's look-alike
// pairs (navy/black 23, royal/purple 24, orange/gold 36, sky/teal 37, red/orange 38, green/teal 41, sky/white 43,
// royal/navy 44, claret/black 44, claret/navy 46, red/claret 47) from the pairs that read apart (white/teal 51 and up).
export const CLASH_DE = 48;

// Keepers wear their own colour, the first of these that stays clear of both outfield shirts (and, for the away keeper,
// of the home keeper too).
export const KEEPER_COLOURS = [
  { id: 'kpurple', name: 'Keeper Purple', hex: '#7B3FC4' },
  { id: 'kcyan', name: 'Keeper Cyan', hex: '#27B8D8' },
  { id: 'klime', name: 'Keeper Lime', hex: '#9BD633' },
  { id: 'kpink', name: 'Keeper Pink', hex: '#F0609E' },
  { id: 'kgrey', name: 'Keeper Grey', hex: '#8C929C' },
  { id: 'korange', name: 'Keeper Orange', hex: '#F28A1E' },
];

// No rule ever touches a body's bald head (its shine can look like a kit paint): the head circle is kept by every rule.
for (const d of Object.values(BODY_ART)) {
  if (!d.head) continue;
  const h = { x: d.head.x, y: d.head.y, rx: d.head.r * 1.1, ry: d.head.r * 1.1 };
  d.rules = d.rules.map((r) => ({ ...r, keep: [...(r.keep ?? []), h] }));
}
