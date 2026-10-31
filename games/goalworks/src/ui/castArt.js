// The chibi cast's pictures (Milestone 22b; data/cast.js). One lookup for every place a cast member is drawn, so the
// series walking sprite sheets drop in later with no other code change:
//   castSprite(id) → { kind: 'sheet', key, still } (its walking sheet; still: the filed stand-in, if any — portraits keep
//                    using it) | { kind: 'still', key } (the filed 512×512 stand-in) | null (nothing filed: draw nothing)
//   drawCast(ctx, assets, id, rect, { crop: 'head' | 'full' }) → true if something was drawn
//   castGlyph(assets, id) → a sheet line's glyph (ctx, x, y, size): the face before the line's text (null if no picture)
//   recolourCast(img, { clothes, hair, skin }, chibi) → a canvas: the picture with its clothes / hair / skin recoloured by
//     colour-range masks (data/cast.js CAST_MASKS), cached per picture + palette (never redone every frame)
//   fanPalette(rng, kit, opponentKit) → { clothes, hair, skin } (most in your home colours, a few plain, some away)
// Named characters always use their fixed colouring: recolourCast is for the unnamed fans only.
// Milestone 24: the series walking sheets (assets/images/cast/sprites, 128 px web copies — tools/gw_sprite_web.mjs; the
// layout is read from their sprites.json, never hard-coded):
//   setSpriteLayout(json, dir) → registers every sheet: CAST_SHEETS (slot id → sheet), sheetKey(chibiNo | 'bolt' …)
//   sheetManifest() → { key: path } (main.js loads them behind the first screen)
//   drawSheetFrame(ctx, img, anim, facing, t, x, y, h, { mirror, alpha, rowOf }) — one frame by time t, feet at (x, y)
//   recolourSheet(img, palette, chibi, key) → { canvas, rowOf }: the fan rows (front idle / walk / cheer, back walk)
//     recoloured with the sprite masks (data/cast.js CAST_SPRITE_MASKS), cached (made once per palette, never every frame)
import { CAST, castById, CAST_MASKS, CAST_SPRITE_MASKS, FAN_HAIR, FAN_SKIN, PLAIN_CLOTHES, FANS } from '../../data/cast.js';

// The walking sheets: slot id → { key } (set by setSpriteLayout once sprites.json is read).
export const CAST_SHEETS = {};
// The layout (sprites.json): rows by "facing:anim" → { row, frames, fps }; the sheets by chibi number / god name.
export const SPRITES = { layout: null, rows: {}, columns: 8, byChibi: {}, byGod: {}, paths: {} };
const numberOf = (id) => Number(/^chibi_(\d+)_/.exec(id)?.[1] ?? NaN);
export function setSpriteLayout(json, dir = 'assets/images/cast/sprites/') {
  SPRITES.layout = json;
  SPRITES.columns = json.columns ?? 8;
  SPRITES.rows = Object.fromEntries((json.rows ?? []).map((r) => [`${r.facing}:${r.anim}`, r]));
  SPRITES.byChibi = {};
  SPRITES.byGod = {};
  SPRITES.paths = {};
  for (const id of json.characters ?? []) {
    const key = `walk_${id}`;
    SPRITES.paths[key] = `${dir}${id}_sheet.png`;
    const n = numberOf(id);
    if (Number.isFinite(n)) SPRITES.byChibi[n] = key;
    else if (id.startsWith('god_')) SPRITES.byGod[id.slice(4)] = key;
  }
  for (const c of CAST) if (SPRITES.byChibi[c.chibi]) CAST_SHEETS[c.id] = { key: SPRITES.byChibi[c.chibi] };
  return SPRITES;
}
// A sheet's key: a chibi number (13) or a god's sheet name ('bolt'). null: no such sheet.
export const sheetKey = (who) => (typeof who === 'number' ? SPRITES.byChibi[who] : SPRITES.byGod[who]) ?? null;
export const sheetManifest = () => ({ ...SPRITES.paths });
// Where the feet are in a frame (sprites.json anchor: "feet at about y=236-247 and x=130-150" of 256).
export const FEET = { x: 140 / 256, y: 242 / 256 };
// The head-and-shoulders part of a 512×512 stand-in (feet on the shared baseline, arms out).
const HEAD = { x: 0.18, y: 0.02, w: 0.64, h: 0.62 };

export function castSprite(id) {
  const sheet = CAST_SHEETS[id];
  if (sheet) return { kind: 'sheet', ...sheet, still: castById(id)?.still ?? null };
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
  // (M24) a portrait keeps the filed still; a cast member with only a walking sheet shows its first front frame
  const still = sp.kind === 'still' ? sp.key : sp.still;
  const img = imageOf(assets, still ?? sp.key);
  if (!img) return false;
  const fs = still ? 0 : (img.naturalWidth || img.width) / SPRITES.columns;
  const iw = still ? img.naturalWidth || img.width : fs;
  const ih = still ? img.naturalHeight || img.height : fs;
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
export function recolourPixel(r, g, b, u, v, palette, chibi, masks = CAST_MASKS) {
  const [h, s, l] = rgbHsl(r, g, b);
  const cm = masks.clothes[chibi];
  if (palette.clothes && inMask(cm, h, s, l, u, v)) {
    const [th, ts, tl] = rgbHsl(...hexRgb(palette.clothes));
    // keep the picture's shading around the new colour's own lightness (a white or navy shirt reads as one)
    const mid = (cm.l[0] + cm.l[1]) / 2;
    return hslRgb(th, ts, clamp01(tl + (l - mid) * 0.8));
  }
  const sides = masks.hairSides;
  if (palette.hair && (inMask(masks.hair, h, s, l, u, v) || (inMask(sides, h, s, l, u, v) && (u < sides.eyes[0] || u > sides.eyes[1])))) {
    const [th, ts] = rgbHsl(...hexRgb(palette.hair.hex));
    return hslRgb(th, Math.min(ts, 0.7), clamp01(l + (palette.hair.dl ?? 0)));
  }
  if (palette.skin && inMask(masks.skin, h, s, l, u, v)) return hslRgb(h + (palette.skin.dh ?? 0), s, clamp01(l + (palette.skin.dl ?? 0)));
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

// --- the walking sheets (Milestone 24) ------------------------------------------------------------------------------------
// One frame of a sheet (or a recoloured fan canvas, rowOf: its own row map), by time t: the anim's frames at its fps,
// looping. Feet at (x, y); h: the frame's drawn height (every character at one scale, so sizes compare truly). mirror:
// flipped left-right (the other two diagonals). → true if drawn
export function drawSheetFrame(ctx, img, anim, facing, t, x, y, h, { mirror = false, alpha = 1, rowOf = null } = {}) {
  const spec = SPRITES.rows[`${facing}:${anim}`] ?? SPRITES.rows[`${facing}:idle`];
  if (!img || !spec) return false;
  const iw = img.naturalWidth || img.width;
  if (!iw) return false;
  const fs = iw / SPRITES.columns;
  const row = rowOf ? rowOf[`${facing}:${anim}`] ?? rowOf[`${facing}:walk`] ?? 0 : spec.row;
  const f = Math.floor(Math.max(0, t) * (spec.fps ?? 8)) % Math.max(1, spec.frames);
  const k = h / fs;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(img, f * fs, row * fs, fs, fs, -FEET.x * fs * k, -FEET.y * fs * k, fs * k, fs * k);
  ctx.restore();
  return true;
}
// The fan rows a recoloured copy keeps (walking in, standing, cheering at the gates; walking away, seen from behind).
export const FAN_ROWS = ['front:idle', 'front:walk', 'front:cheer', 'back:walk'];
const sheetCache = new Map();
export const recolouredSheet = (palette, chibi, key) => sheetCache.get(`sheet|${keyOf(key, palette, chibi)}`) ?? null;
export function recolourSheet(img, palette, chibi, key = img?.src ?? 'sheet') {
  const k = `sheet|${keyOf(key, palette, chibi)}`;
  if (sheetCache.has(k)) return sheetCache.get(k);
  const iw = img.naturalWidth || img.width;
  const fs = iw / SPRITES.columns;
  const c = document.createElement('canvas');
  c.width = iw;
  c.height = fs * FAN_ROWS.length;
  const g = c.getContext('2d', { willReadFrequently: true });
  const rowOf = {};
  FAN_ROWS.forEach((name, i) => {
    rowOf[name] = i;
    g.drawImage(img, 0, SPRITES.rows[name].row * fs, iw, fs, 0, i * fs, iw, fs);
  });
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  const W = c.width;
  FAN_ROWS.forEach((name, i) => {
    const masks = name.startsWith('back') ? CAST_SPRITE_MASKS.back : CAST_SPRITE_MASKS.front;
    for (let y = i * fs; y < (i + 1) * fs; y++) {
      const v = (y - i * fs) / fs;
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        if (d[p + 3] < 8) continue;
        const out = recolourPixel(d[p], d[p + 1], d[p + 2], (x % fs) / fs, v, palette, chibi, masks);
        if (out) [d[p], d[p + 1], d[p + 2]] = out;
      }
    }
  });
  g.putImageData(id, 0, 0);
  const res = { canvas: c, rowOf };
  sheetCache.set(k, res);
  return res;
}
export const recolourSheetCacheSize = () => sheetCache.size;
