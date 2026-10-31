// Sponsor logos (Milestone 23). SP09 / SP10 have their logos (sponsor_secret_01 / _02); SP01–SP08 are looked for as
// assets/images/sponsors/sponsor_sp01.png … (data/assets.js OPTIONAL_ASSETS, loaded quietly) and, while a file is missing,
// drawn as a clean text badge: the sponsor's name on a shield in its colour (core/AssetManager setFallback — the real file
// wins the moment it loads, with no code change).
//   registerSponsorArt(assets) — call once at boot · drawSponsorBadge(ctx, def, x, y, w, h)
import { SPONSORS } from '../../data/sponsors.js';
import { OPTIONAL_ASSETS } from '../../data/assets.js';

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};

export function drawSponsorBadge(ctx, def, x, y, w, h) {
  const s = Math.min(w, h);
  const cx = x + w / 2;
  const top = y + (h - s) / 2;
  ctx.save();
  // the shield
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, top + s * 0.08);
  ctx.lineTo(cx + s * 0.42, top + s * 0.08);
  ctx.lineTo(cx + s * 0.42, top + s * 0.52);
  ctx.quadraticCurveTo(cx + s * 0.4, top + s * 0.82, cx, top + s * 0.94);
  ctx.quadraticCurveTo(cx - s * 0.4, top + s * 0.82, cx - s * 0.42, top + s * 0.52);
  ctx.closePath();
  ctx.fillStyle = def.colour;
  ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.05);
  ctx.strokeStyle = shade(def.colour, 0.55);
  ctx.stroke();
  // a light band across the top
  ctx.beginPath();
  ctx.rect(cx - s * 0.42, top + s * 0.08, s * 0.84, s * 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  // the name, one or two lines
  const words = def.name.split(' ');
  const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [def.name];
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.max(8, Math.round(s * (lines.length > 1 ? 0.15 : 0.18)));
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  lines.forEach((t, i) => ctx.fillText(t.toUpperCase(), cx, top + s * (lines.length > 1 ? 0.4 + i * 0.19 : 0.48), s * 0.76));
  ctx.restore();
}

export function registerSponsorArt(assets) {
  for (const def of SPONSORS) {
    const src = OPTIONAL_ASSETS[def.art];
    if (!src) continue;
    assets.setFallback(def.art, (ctx, x, y, w, h) => drawSponsorBadge(ctx, def, x, y, w, h), { aspect: 1 });
    assets.loadOptional(def.art, src);
  }
}
