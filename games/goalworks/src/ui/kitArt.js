// Kit colours on Aaron's art (Milestone 6). Never drawn over: a recoloured copy of the real picture is made once per
// picture and colour (core/ArtRecolor, rules in data/kits.js) and kept in the asset store under its own key, so it is
// drawn and size-cached like any other image.
//   bodyKey(assets, body, kit)                 the image key for a match body in a kit (kit: { shirt, shorts, keeper }
//                                              hexes); the plain body until its picture has loaded
//   patternKey(assets, patternId, p1, p2)      a kit pattern (custom_13–20) in two palette colours, or null when the
//                                              pattern is drawn in code (Plain, or a pattern marked clean: false)
//   drawKitPreview(ctx, assets, r, { pattern, primary, secondary })   the pattern art, else the code-drawn kit
//   flagKey(assets, primary)                   the club flag (prop_25) in the club's first colour
//   drawClubFlag(ctx, assets, x, y, h, club)   the flag on its pole, feet at x, y, h tall, with the club badge on it
//   headOf(team, player)                       which head (match_09–12) a player wears: spread across the side
import { createRecolor } from '../../../../core/ArtRecolor.js';
import { BODY_ART, HEADS, patternById } from '../../data/kits.js';
import { colourById } from '../../data/setup.js';
import { drawBadge, drawKit, drawSilhouette } from './clubArt.js';

const MAX = 256; // recolour on a half-size copy: bodies and previews never draw bigger than this on screen
const recolors = new Map(); // art key → createRecolor(...) (measured once per picture)
const FLAG_RULES = [{ hue: 222, full: 16, none: 28, minSat: 0.3 }];

function recolorFor(assets, key, rules) {
  if (recolors.has(key)) return recolors.get(key);
  const img = assets.get(key);
  if (!img) return null; // not loaded yet: try again next time
  const r = createRecolor(img, rules, { maxSize: MAX });
  recolors.set(key, r);
  return r;
}
function tinted(assets, art, rules, colours) {
  const key = `${art}~${colours.map((c) => (c ?? '-').replace('#', '')).join('~')}`;
  if (assets.images.has(key)) return key;
  const r = recolorFor(assets, art, rules);
  if (!r) return art;
  assets.images.set(key, r.paint(colours));
  return key;
}

export function bodyKey(assets, body, kit) {
  const def = BODY_ART[body];
  if (!def || !kit) return body;
  return tinted(assets, body, def.rules, def.paint.map((p) => kit[p]));
}

export function patternKey(assets, patternId, primary, secondary) {
  const p = patternById(patternId);
  if (!p.art || p.clean === false) return null;
  return tinted(assets, p.art, p.rules, [colourById(primary).hex, colourById(secondary).hex]);
}

export function drawKitPreview(ctx, assets, r, { pattern = 'plain', primary, secondary }) {
  const key = patternKey(assets, pattern, primary, secondary);
  if (key && assets.has(key) && key !== patternById(pattern).art) {
    const s = Math.min(r.w, r.h);
    assets.draw(ctx, key, r.x + (r.w - s) / 2, r.y + (r.h - s) / 2, s, s);
  } else drawKit(ctx, r, primary, secondary, patternById(pattern).id === 'stripes' ? 'stripes' : 'plain');
}

export const flagKey = (assets, primary) => tinted(assets, 'prop_25', FLAG_RULES, [colourById(primary).hex]);

// The flag's cloth sits at about x 0.18–0.9, y 0.14–0.8 of the picture; the badge goes in its middle.
export function drawClubFlag(ctx, assets, x, y, h, club) {
  const key = flagKey(assets, club.colours.primary);
  const w = h;
  assets.draw(ctx, key, x - w * 0.14, y - h * 0.94, w, h);
  const bh = h * 0.34;
  drawBadge(ctx, { x: x - w * 0.14 + w * 0.52 - bh * 0.42, y: y - h * 0.94 + h * 0.28, w: bh * 0.84, h: bh }, { ...club.badge, primary: club.colours.primary, secondary: club.colours.secondary });
}

// A player's head: spread over the four so a side mixes them, the same every time for the same side and shirt.
export function headOf(team, player) {
  let hsh = 0;
  for (const ch of String(team.name)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return HEADS[(hsh + player.shirt * 3) % HEADS.length];
}

// A generated player's silhouette as an image (for the Player Detail sheet's picture), made once per club colours.
export function silhouetteKey(assets, primary, secondary) {
  const key = `silhouette~${primary}~${secondary}`;
  if (assets.images.has(key) || typeof document === 'undefined') return key;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  drawSilhouette(c.getContext('2d'), { x: 8, y: 8, w: 240, h: 240 }, primary, secondary);
  c.naturalWidth = c.naturalHeight = 256;
  assets.images.set(key, c);
  return key;
}
