// Code-drawn pieces for the menus, the slot cards and Club Setup (Milestone 0). Badges and kits are drawn in code until
// the badge / kit art (custom_01–20) is wired in; the Founders use their Batch 1 pictures; the dice come from the
// shared core/ui/SetupArt.
//   drawBadge(ctx, r, { shape, symbol, primary, secondary })   a club badge: shield in the primary colour, a secondary
//                                                              band / rim and the symbol, all fitted inside r
//   drawKit(ctx, r, primary, secondary)                        shirt + shorts + socks preview
//   drawFounder(ctx, assets, r, founder, ring)                 the Founder's head-and-shoulders crop from their art
//   diceButton(ctx, assets, r, label, opts)                    a button with the Random die beside its label
//   accentStrip(ctx, r, primary, secondary)                    the club-colour strip down a slot card's left edge
//   drawPitch(ctx, x, y, w, h)                                 mown pitch stripes (menu backdrops)
import { THEME, font, tint } from '../../../../core/Theme.js';
import { drawButton } from '../../../../core/ui/Button.js';
import { drawDice } from '../../../../core/ui/SetupArt.js';
import { colourById, POSITIONS } from '../../data/setup.js';

const C = THEME.color;
const TAU = Math.PI * 2;

// Each shield as a path in a 100 × 120 box.
function shieldPath(shape) {
  const p = new Path2D();
  switch (shape) {
    case 'round':
      p.moveTo(8, 8);
      p.lineTo(92, 8);
      p.lineTo(92, 62);
      p.arc(50, 62, 42, 0, Math.PI);
      p.closePath();
      break;
    case 'tall':
      p.moveTo(18, 4);
      p.lineTo(82, 4);
      p.lineTo(82, 70);
      p.quadraticCurveTo(82, 100, 50, 118);
      p.quadraticCurveTo(18, 100, 18, 70);
      p.closePath();
      break;
    case 'split':
      p.moveTo(6, 10);
      p.lineTo(50, 4);
      p.lineTo(94, 10);
      p.lineTo(94, 60);
      p.quadraticCurveTo(90, 98, 50, 116);
      p.quadraticCurveTo(10, 98, 6, 60);
      p.closePath();
      break;
    case 'diamond':
      p.moveTo(50, 2);
      p.lineTo(96, 60);
      p.lineTo(50, 118);
      p.lineTo(4, 60);
      p.closePath();
      break;
    case 'circle':
      p.arc(50, 60, 46, 0, TAU);
      break;
    case 'heater':
      p.moveTo(6, 6);
      p.quadraticCurveTo(50, 16, 94, 6);
      p.lineTo(94, 50);
      p.quadraticCurveTo(94, 96, 50, 116);
      p.quadraticCurveTo(6, 96, 6, 50);
      p.closePath();
      break;
    case 'castle':
      p.moveTo(6, 4);
      for (const [a, b] of [[6, 22], [22, 38], [38, 62], [62, 78], [78, 94]]) {
        p.lineTo(a, 18);
        p.lineTo(b, 18);
        p.lineTo(b, 4);
      }
      p.lineTo(94, 64);
      p.quadraticCurveTo(92, 100, 50, 116);
      p.quadraticCurveTo(8, 100, 6, 64);
      p.closePath();
      break;
    case 'hex':
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 6;
        const x = 50 + Math.cos(a) * 48;
        const y = 60 + Math.sin(a) * 56;
        if (i) p.lineTo(x, y);
        else p.moveTo(x, y);
      }
      p.closePath();
      break;
    case 'pennant':
      p.moveTo(6, 6);
      p.lineTo(94, 6);
      p.lineTo(94, 80);
      p.lineTo(50, 116);
      p.lineTo(6, 80);
      p.closePath();
      break;
    case 'oval':
      p.ellipse(50, 60, 40, 56, 0, 0, TAU);
      break;
    case 'banner':
      p.moveTo(8, 6);
      p.lineTo(92, 6);
      p.lineTo(92, 112);
      p.lineTo(50, 90);
      p.lineTo(8, 112);
      p.closePath();
      break;
    default: // classic
      p.moveTo(8, 6);
      p.lineTo(92, 6);
      p.lineTo(92, 54);
      p.bezierCurveTo(92, 88, 70, 104, 50, 116);
      p.bezierCurveTo(30, 104, 8, 88, 8, 54);
      p.closePath();
  }
  return p;
}

export function drawBadge(ctx, r, { shape = 'classic', symbol = 'ball', primary = 'green', secondary = 'white' } = {}) {
  const p1 = colourById(primary);
  const p2 = colourById(secondary);
  const k = Math.min(r.w / 100, r.h / 120);
  const path = shieldPath(shape);
  ctx.save();
  ctx.translate(r.x + (r.w - 100 * k) / 2, r.y + (r.h - 120 * k) / 2);
  ctx.scale(k, k);
  // soft shadow, field, a secondary band across the upper third, then the rim
  ctx.save();
  ctx.translate(3, 4);
  ctx.fillStyle = C.shade;
  ctx.fill(path);
  ctx.restore();
  ctx.fillStyle = p1.hex;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = p2.hex;
  if (shape === 'split') ctx.fillRect(50, 0, 50, 120);
  else ctx.fillRect(0, 22, 100, 14);
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = p2.hex;
  ctx.lineWidth = 7;
  ctx.stroke(path);
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 3;
  ctx.stroke(path);
  // the symbol, in the secondary colour with a dark outline (on a split badge it sits on a disc so it reads on both halves)
  if (shape === 'split') {
    ctx.fillStyle = p1.hex;
    ctx.strokeStyle = p2.hex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(50, 66, 25, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  drawSymbol(ctx, symbol, 50, 66, 22, p2.hex, p1.hex);
  ctx.restore();
}

// A symbol centred on cx, cy, about s units from centre to edge. fill = its colour; back = the field behind it.
function drawSymbol(ctx, id, cx, cy, s, fill, back) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const shape = (draw) => {
    ctx.beginPath();
    draw();
    ctx.fill();
    ctx.stroke();
  };
  switch (id) {
    case 'crown':
      shape(() => {
        ctx.moveTo(-s, s * 0.6);
        ctx.lineTo(-s, -s * 0.5);
        ctx.lineTo(-s * 0.5, s * 0.05);
        ctx.lineTo(0, -s * 0.8);
        ctx.lineTo(s * 0.5, s * 0.05);
        ctx.lineTo(s, -s * 0.5);
        ctx.lineTo(s, s * 0.6);
        ctx.closePath();
      });
      break;
    case 'star':
      shape(() => {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? s * 0.45 : s;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
      });
      break;
    case 'tower':
      shape(() => {
        ctx.moveTo(-s * 0.6, s);
        ctx.lineTo(-s * 0.5, -s * 0.5);
        ctx.lineTo(-s * 0.7, -s * 0.5);
        ctx.lineTo(-s * 0.7, -s);
        for (const x of [-0.35, 0, 0.35]) {
          ctx.lineTo(s * (x - 0.12), -s);
          ctx.lineTo(s * (x - 0.12), -s * 0.8);
          ctx.lineTo(s * (x + 0.12), -s * 0.8);
          ctx.lineTo(s * (x + 0.12), -s);
        }
        ctx.lineTo(s * 0.7, -s);
        ctx.lineTo(s * 0.7, -s * 0.5);
        ctx.lineTo(s * 0.5, -s * 0.5);
        ctx.lineTo(s * 0.6, s);
        ctx.closePath();
      });
      ctx.fillStyle = back;
      ctx.fillRect(-s * 0.15, s * 0.4, s * 0.3, s * 0.6);
      break;
    case 'bridge':
      shape(() => {
        ctx.moveTo(-s, s * 0.7);
        ctx.lineTo(-s, -s * 0.1);
        ctx.lineTo(s, -s * 0.1);
        ctx.lineTo(s, s * 0.7);
        ctx.lineTo(s * 0.6, s * 0.7);
        ctx.arc(0, s * 0.7, s * 0.6, 0, Math.PI, true);
        ctx.closePath();
      });
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.1);
      ctx.quadraticCurveTo(0, -s * 1.1, s, -s * 0.1);
      ctx.stroke();
      break;
    case 'bolt':
      shape(() => {
        ctx.moveTo(s * 0.2, -s);
        ctx.lineTo(-s * 0.6, s * 0.15);
        ctx.lineTo(-s * 0.05, s * 0.15);
        ctx.lineTo(-s * 0.3, s);
        ctx.lineTo(s * 0.6, -s * 0.2);
        ctx.lineTo(s * 0.05, -s * 0.2);
        ctx.closePath();
      });
      break;
    case 'bird':
      shape(() => {
        ctx.moveTo(-s, -s * 0.3);
        ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, 0, s * 0.35);
        ctx.quadraticCurveTo(s * 0.4, -s * 0.2, s, -s * 0.3);
        ctx.quadraticCurveTo(s * 0.5, s * 0.25, 0, s * 0.8);
        ctx.quadraticCurveTo(-s * 0.5, s * 0.25, -s, -s * 0.3);
        ctx.closePath();
      });
      break;
    case 'tree':
      shape(() => ctx.rect(-s * 0.15, s * 0.1, s * 0.3, s * 0.9));
      shape(() => {
        ctx.arc(0, -s * 0.25, s * 0.55, 0, TAU);
        ctx.moveTo(-s * 0.35 + s * 0.45, s * 0.05);
        ctx.arc(-s * 0.35, s * 0.05, s * 0.45, 0, TAU);
        ctx.moveTo(s * 0.35 + s * 0.45, s * 0.05);
        ctx.arc(s * 0.35, s * 0.05, s * 0.45, 0, TAU);
      });
      break;
    case 'anchor': {
      ctx.strokeStyle = C.outline;
      const anchorLines = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.65);
        ctx.lineTo(0, s * 0.9);
        ctx.moveTo(-s * 0.45, -s * 0.35);
        ctx.lineTo(s * 0.45, -s * 0.35);
        ctx.moveTo(-s * 0.85, s * 0.3);
        ctx.quadraticCurveTo(-s * 0.7, s * 0.95, 0, s * 0.9);
        ctx.quadraticCurveTo(s * 0.7, s * 0.95, s * 0.85, s * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -s * 0.8, s * 0.18, 0, TAU);
        ctx.stroke();
      };
      ctx.lineWidth = s * 0.28;
      anchorLines();
      ctx.strokeStyle = fill;
      ctx.lineWidth = s * 0.14;
      anchorLines();
      break;
    }
    case 'wheel':
      shape(() => ctx.arc(0, 0, s, 0, TAU));
      ctx.fillStyle = back;
      shape(() => ctx.arc(0, 0, s * 0.62, 0, TAU));
      ctx.fillStyle = fill;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / 6);
        ctx.fillRect(-s * 0.09, -s * 0.62, s * 0.18, s * 0.62);
        ctx.restore();
      }
      shape(() => ctx.arc(0, 0, s * 0.22, 0, TAU));
      break;
    case 'key':
      shape(() => {
        ctx.arc(0, -s * 0.5, s * 0.45, 0, TAU);
      });
      ctx.fillStyle = back;
      shape(() => ctx.arc(0, -s * 0.5, s * 0.18, 0, TAU));
      ctx.fillStyle = fill;
      shape(() => {
        ctx.rect(-s * 0.12, -s * 0.08, s * 0.24, s * 1.05);
        ctx.rect(s * 0.12, s * 0.5, s * 0.35, s * 0.18);
        ctx.rect(s * 0.12, s * 0.78, s * 0.28, s * 0.18);
      });
      break;
    case 'wave':
      for (const dy of [-0.45, 0.05, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(-s, s * dy);
        ctx.bezierCurveTo(-s * 0.5, s * (dy - 0.4), -s * 0.5, s * (dy + 0.4), 0, s * dy);
        ctx.bezierCurveTo(s * 0.5, s * (dy - 0.4), s * 0.5, s * (dy + 0.4), s, s * dy);
        ctx.lineWidth = s * 0.3;
        ctx.strokeStyle = C.outline;
        ctx.stroke();
        ctx.lineWidth = s * 0.16;
        ctx.strokeStyle = fill;
        ctx.stroke();
      }
      break;
    default: {
      // ball: white with dark patches, whatever the club colours
      ctx.fillStyle = '#FFFFFF';
      shape(() => ctx.arc(0, 0, s, 0, TAU));
      ctx.fillStyle = C.outline;
      const pent = (x, y, rr) => {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * TAU) / 5;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      };
      pent(0, 0, s * 0.36);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, TAU);
        ctx.clip();
        pent(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95, s * 0.3);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

// Shirt (primary body, secondary sleeves and collar), shorts (secondary) and socks (primary with a secondary top), in r.
// look 'stripes' (Milestone 6): diagonal secondary stripes across the shirt — the code-drawn stand-in for the Stripes
// pattern, whose art can't be recoloured cleanly.
export function drawKit(ctx, r, primary, secondary, look = 'plain') {
  const p1 = colourById(primary).hex;
  const p2 = colourById(secondary).hex;
  const k = Math.min(r.w / 100, r.h / 140);
  ctx.save();
  ctx.translate(r.x + (r.w - 100 * k) / 2, r.y + (r.h - 140 * k) / 2);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 3;
  const fillStroke = (path, colour) => {
    ctx.fillStyle = colour;
    ctx.fill(path);
    ctx.stroke(path);
  };
  const sleeves = new Path2D();
  sleeves.moveTo(26, 8);
  sleeves.lineTo(4, 22);
  sleeves.lineTo(12, 40);
  sleeves.lineTo(26, 34);
  sleeves.closePath();
  sleeves.moveTo(74, 8);
  sleeves.lineTo(96, 22);
  sleeves.lineTo(88, 40);
  sleeves.lineTo(74, 34);
  sleeves.closePath();
  fillStroke(sleeves, p2);
  const body = new Path2D();
  body.moveTo(26, 8);
  body.lineTo(40, 4);
  body.quadraticCurveTo(50, 12, 60, 4);
  body.lineTo(74, 8);
  body.lineTo(76, 70);
  body.lineTo(24, 70);
  body.closePath();
  fillStroke(body, p1);
  if (look === 'stripes') {
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = p2;
    for (const o of [-10, 12, 34]) {
      ctx.beginPath();
      ctx.moveTo(24 + o, 70);
      ctx.lineTo(24 + o + 10, 70);
      ctx.lineTo(76 + o + 10, 4);
      ctx.lineTo(76 + o, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.stroke(body);
  }
  const collar = new Path2D();
  collar.moveTo(40, 4);
  collar.quadraticCurveTo(50, 16, 60, 4);
  collar.quadraticCurveTo(50, 10, 40, 4);
  fillStroke(collar, p2);
  const shorts = new Path2D();
  shorts.moveTo(26, 74);
  shorts.lineTo(74, 74);
  shorts.lineTo(78, 102);
  shorts.lineTo(54, 102);
  shorts.lineTo(50, 90);
  shorts.lineTo(46, 102);
  shorts.lineTo(22, 102);
  shorts.closePath();
  fillStroke(shorts, p2);
  for (const x of [30, 58]) {
    const sock = new Path2D();
    sock.rect(x, 106, 12, 30);
    fillStroke(sock, p1);
    const top = new Path2D();
    top.rect(x, 106, 12, 7);
    fillStroke(top, p2);
  }
  ctx.restore();
}

// The Founder's portrait: the face crop of their Batch 1 picture on a soft position-coloured card.
export function drawFounder(ctx, assets, r, founder, ring = null) {
  ctx.save();
  ctx.fillStyle = C.panelAlt;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 22);
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (founder) {
    const pos = POSITIONS[founder.position];
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, tint(pos.colour, 0.55));
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    assets.drawCrop(ctx, founder.art, founder.face, r);
    // position tag in the corner
    const tw = r.w * 0.36;
    const th = Math.max(26, r.h * 0.17);
    ctx.fillStyle = pos.colour;
    ctx.beginPath();
    ctx.roundRect(r.x + r.w - tw - 6, r.y + r.h - th - 6, tw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(Math.max(18, th * 0.62), true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(founder.position, r.x + r.w - tw / 2 - 6, r.y + r.h - th / 2 - 5, tw - 8);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 22);
  ctx.strokeStyle = ring ?? C.line;
  ctx.lineWidth = ring ? 7 : 3;
  ctx.stroke();
  ctx.restore();
}

export function diceButton(ctx, assets, r, label, opts = {}) {
  drawButton(ctx, r, '', opts);
  ctx.save();
  ctx.font = opts.font ?? font(THEME.size.button, true);
  const tw = label ? Math.min(ctx.measureText(label).width, r.w - 110) : 0;
  const dice = Math.min(64, r.h * 0.55);
  const x0 = r.x + r.w / 2 - (dice + (label ? 16 + tw : 0)) / 2;
  const cy = r.y + (r.h - THEME.button.lip) / 2;
  drawDice(ctx, assets, { x: x0, y: cy - dice / 2, w: dice, h: dice }, { color: C.outline });
  if (label) {
    ctx.fillStyle = opts.disabled ? C.textFaint : C.textOnAction;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + dice + 16, cy + 1, r.w - 110);
  }
  ctx.restore();
}

export function accentStrip(ctx, r, primary, secondary) {
  const x = r.x + 10;
  const y = r.y + 18;
  const h = r.h - 36;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, 22, h, 11);
  ctx.clip();
  ctx.fillStyle = colourById(primary).hex;
  ctx.fillRect(x, y, 22, h);
  ctx.fillStyle = colourById(secondary).hex;
  for (let sy = y + 14; sy < y + h; sy += 44) ctx.fillRect(x, sy, 22, 16);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(x, y, 22, h, 11);
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawPitch(ctx, x, y, w, h, band = 120) {
  ctx.fillStyle = '#3A9A4A';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#43A653';
  for (let sy = Math.floor(y / band) * band; sy < y + h; sy += band * 2) ctx.fillRect(x, sy, w, band);
}
