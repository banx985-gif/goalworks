// Match kits and the kit clash check (Milestone 6). Pure: no pictures, so Node checks every colour pair.
//   colourDistance(hexA, hexB)        CIE76 ΔE in Lab (how far apart two colours look)
//   clashes(hexA, hexB)               closer than CLASH_DE: they can't share a pitch
//   matchKits(home, away)             home / away: { primary, secondary } palette ids (data/setup.js COLOURS) →
//     { home: kit, away: kit }        kit = { shirt, shorts, keeper, change } — hexes; keeper is its KEEPER_COLOURS id's hex
//   The home side always wears its first kit (shirt = primary, shorts = secondary). If the away shirt clashes, the away
//   side switches to its second colour (shirt = secondary, shorts = primary); if that clashes too it wears white (or,
//   when white is taken, the palette colour furthest from the home shirt), change = true. Each keeper takes the first
//   KEEPER_COLOURS entry clear of both outfield shirts (the away keeper also clear of the home keeper).
import { COLOURS, colourById } from '../../data/setup.js';
import { CLASH_DE, KEEPER_COLOURS } from '../../data/kits.js';

function lab(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export function colourDistance(a, b) {
  const A = lab(a);
  const B = lab(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}
export const clashes = (a, b) => colourDistance(a, b) < CLASH_DE;

function keeperFor(avoid) {
  return (KEEPER_COLOURS.find((k) => avoid.every((h) => !clashes(k.hex, h))) ?? KEEPER_COLOURS[0]).hex;
}

export function matchKits(home, away) {
  const hp = colourById(home.primary).hex;
  const hs = colourById(home.secondary).hex;
  const ap = colourById(away.primary).hex;
  const as = colourById(away.secondary).hex;
  let shirt = ap;
  let shorts = as;
  let change = false;
  if (clashes(ap, hp)) {
    change = true;
    if (!clashes(as, hp)) [shirt, shorts] = [as, ap];
    else {
      const white = colourById('white').hex;
      shirt = !clashes(white, hp) ? white : COLOURS.map((c) => c.hex).reduce((best, h) => (colourDistance(h, hp) > colourDistance(best, hp) ? h : best));
      shorts = !clashes(ap, shirt) ? ap : as;
    }
  }
  const hk = keeperFor([hp, shirt]);
  const ak = keeperFor([hp, shirt, hk]);
  return {
    home: { shirt: hp, shorts: hs, keeper: hk, change: false },
    away: { shirt, shorts, keeper: ak, change },
  };
}

// A kit for a side that only has one colour (a Milestone 3–5 save): its shirt, white or dark shorts, and a keeper clear
// of it and of the colours in avoid.
export function kitFromColour(hex, avoid = []) {
  const shorts = colourDistance(hex, '#F7F7F2') < CLASH_DE ? '#222222' : '#F7F7F2';
  return { shirt: hex, shorts, keeper: keeperFor([hex, ...avoid]), change: false };
}
