// The chibi cast's pictures (Milestone 22b; data/cast.js). One lookup for every place a cast member is drawn, so the
// series walking sprite sheets drop in later with no other code change:
//   castSprite(id) → { kind: 'sheet', key, frames } (a walking sheet, once the series makes them — none yet) |
//                    { kind: 'still', key } (the filed 512×512 stand-in) | null (nothing filed: draw nothing)
//   drawCast(ctx, assets, id, rect, { crop: 'head' | 'full' }) → true if something was drawn
//   castGlyph(assets, id) → a sheet line's glyph (ctx, x, y, size): the face before the line's text (null if no picture)
//   recolourCast(img, { clothes, hair, skin }, chibi) → a canvas: the picture with its clothes / hair / skin recoloured by
//     colour-range masks (data/cast.js CAST_MASKS), cached per picture + palette (never redone every frame)
//   fanPalette(rng, kit, opponentKit) → { clothes, hair, skin } (most in your home colours, a few plain, some away)
// Named characters always use their fixed colouring: recolourCast is for the unnamed fans only.
import { CAST, castById, CAST_MASKS, FAN_HAIR, FAN_SKIN, PLAIN_CLOTHES, FANS } from '../../data/cast.js';

// The walking sheets (series, later): id → { key, frames }. Empty until SERIES_CHIBI_CAST's sheets exist.
export const CAST_SHEETS = {};
// The head-and-shoulders part of a 512×512 stand-in (feet on the shared baseline, arms out).
const HEAD = { x: 0.18, y: 0.02, w: 0.64, h: 0.62 };

export function castSprite(id) {
  const sheet = CAST_SHEETS[id];
  if (sheet) return { kind: 'sheet', ...sheet };
  const c = castById(id);
  return c?.still ? { kind: 'still', key: c.still } : null;
}
// Every filed still (the asset list loads them).
export const castStills = () => CAST.filter((c) => c.still).map((c) => c.still);

function imageOf(assets, key) {
  const img = assets?.images?.get?.(key);
  return img && (img.naturalWidth || img.width) ? img : null;
}
export function drawCast(ctx, assets, id, rect, { crop = 'full' } = {}) {
  const sp = castSprite(id);
  if (!sp) return false;
  const img = imageOf(assets, sp.key);
  if (!img) return false;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const src = crop === 'head' ? { x: HEAD.x * iw, y: HEAD.y * ih, w: HEAD.w * iw, h: HEAD.h * ih } : { x: 0, y: 0, w: iw, h: ih };
  const k = Math.min(rect.w / src.w, rect.h / src.h);
  const w = src.w * k;
  const h = src.h * k;
  ctx.drawImage(img, src.x, src.y, src.w, src.h, rect.x + (rect.w - w) / 2, rect.y + rect.h - h, w, h); // (feet / chin on the box's floor)
  return true;
}
export function castGlyph(assets, id) {
  if (!id || !castSprite(id)) return null;
  return (ctx, x, y, size) => {
    const s = size * 1.25;
    ctx.save();
    ctx.fillStyle = '#FFF4DE';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.clip();
    drawCast(ctx, assets, id, { x: x + size / 2 - s / 2, y: y + size / 2 - s / 2, w: s, h: s }, { crop: 'head' });
    ctx.restore();
  };
}

// --- recolouring ----------------------------------------------------------------------------------------------------------
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function rgbHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0;
  let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, s, l];
}
function hslRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255));
}
const inHue = (h, [a, b]) => (a <= b ? h >= a && h <= b : h >= a || h <= b);
// Is this pixel (hue, sat, light at share-of-picture u, v) inside the mask?
export const inMask = (m, h, s, l, u, v) => !!m && u >= m.x0 && u <= m.x1 && v >= m.y0 && v <= m.y1 && inHue(h, m.h) && s >= m.s[0] && s <= m.s[1] && l >= m.l[0] && l <= m.l[1];
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// One pixel's new colour (pure: the node tests run it without a canvas). palette: { clothes: '#hex', hair: { hex, dl },
// skin: { dl, dh } } (any may be left out: that part keeps its colour). → [r, g, b] or null (unchanged)
export function recolourPixel(r, g, b, u, v, palette, chibi) {
  const [h, s, l] = rgbHsl(r, g, b);
  const cm = CAST_MASKS.clothes[chibi];
  if (palette.clothes && inMask(cm, h, s, l, u, v)) {
    const [th, ts, tl] = rgbHsl(...hexRgb(palette.clothes));
    // keep the picture's shading around the new colour's own lightness (a white or navy shirt reads as one)
    const mid = (cm.l[0] + cm.l[1]) / 2;
    return hslRgb(th, ts, clamp01(tl + (l - mid) * 0.8));
  }
  const sides = CAST_MASKS.hairSides;
  if (palette.hair && (inMask(CAST_MASKS.hair, h, s, l, u, v) || (inMask(sides, h, s, l, u, v) && (u < sides.eyes[0] || u > sides.eyes[1])))) {
    const [th, ts] = rgbHsl(...hexRgb(palette.hair.hex));
    return hslRgb(th, Math.min(ts, 0.7), clamp01(l + (palette.hair.dl ?? 0)));
  }
  if (palette.skin && inMask(CAST_MASKS.skin, h, s, l, u, v)) return hslRgb(h + (palette.skin.dh ?? 0), s, clamp01(l + (palette.skin.dl ?? 0)));
  return null;
}

const cache = new Map();
const keyOf = (src, palette, chibi) => `${src}|${chibi}|${palette.clothes ?? ''}|${palette.hair?.hex ?? ''}${palette.hair?.dl ?? ''}|${palette.skin?.dl ?? ''}${palette.skin?.dh ?? ''}`;
// img: a loaded picture (or canvas); key: its asset key / path (the cache's name for it). → a canvas (browser only)
export function recolourCast(img, palette, chibi, key = img?.src ?? 'cast') {
  const k = keyOf(key, palette, chibi);
  if (cache.has(k)) return cache.get(k);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, w, h);
  const d = id.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 8) continue;
      const out = recolourPixel(d[i], d[i + 1], d[i + 2], x / w, y / h, palette, chibi);
      if (out) [d[i], d[i + 1], d[i + 2]] = out;
    }
  }
  g.putImageData(id, 0, 0);
  c.naturalWidth = w;
  c.naturalHeight = h;
  cache.set(k, c);
  return c;
}
export const recolourCacheSize = () => cache.size;

// A fan's palette: most in your home kit's colours, a few plain, some away fans in the opponent's; hair and skin varied.
// rng: core/Rng. kit / opponentKit: hex colours [primary, secondary].
export function fanPalette(rng, kit, opponentKit = null) {
  const r = rng.next();
  const away = opponentKit && r > FANS.homeShare + FANS.plainShare;
  const clothes = r < FANS.homeShare ? kit[rng.next() < 0.75 ? 0 : 1] : away ? opponentKit[0] : rng.pick(PLAIN_CLOTHES);
  return { clothes, hair: rng.pick(FAN_HAIR), skin: rng.pick(FAN_SKIN), away: !!away };
}
