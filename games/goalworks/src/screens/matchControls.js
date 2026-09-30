// Play-mode touch controls for the match screen (Milestone 4, bible §17), in a band along the bottom of the safe area,
// below the pitch:
//   left  — the virtual stick: a round pad appears where the left thumb lands (anywhere in the left half of the band)
//           and follows that one finger; drag to move. At rest a faint pad shows where it lives.
//   right — round buttons: Shoot (Tackle when we don't have the ball), Pass (hold, then release = a lofted through
//           ball / cross — a ring fills while held), Sprint (its ring is the stamina bar), Switch.
//   top of the band — who you control, the stamina bar and the last action ("Tackle won!").
// Every finger belongs to what it first touched: a finger that lands on a button is only ever that button, the stick
// only ever follows its own finger, so a button press can never move the stick (and the other way round).
// Desktop stand-in: arrows / WASD move, J = Pass (hold for a through ball), K = Shoot / Tackle, Shift = Sprint,
// L = Switch. The key names show on the buttons until a finger touches the screen.
//   createMatchControls({ layout, input }) → controls
//     controls.band() → the band rect   controls.buttonRect(id) → { x, y, w, h } (tests)   controls.stickHome()
//     controls.onDown(p) / onMove(p) / onUp(p) — pointer events (logical)      controls.attachKeys() / detachKeys()
//     controls.frame() → { mx, my, btn } for this step (short taps are latched until the step has seen them)
//     controls.release() — drop every finger and key   controls.render(ctx, world)
import { THEME, tint, shade } from '../../../../core/Theme.js';
import { text } from '../../../../core/ui/Kit.js';
import { BTN } from '../match/manualControl.js';

const C = THEME.color;
const S = THEME.size;
export const BAND_H = 560; // the controls band (logical px)
const INFO_H = 78; // its top row: who is controlled, stamina
const STICK_R = 130; // pad radius; a full push is this far from the centre
const KNOB_R = 58;
const BUTTONS = [
  // offsets from the band's bottom-right corner
  { id: 'action', dx: -150, dy: -160, r: 112 },
  { id: 'pass', dx: -385, dy: -118, r: 102 },
  { id: 'sprint', dx: -150, dy: -398, r: 86 },
  { id: 'switch', dx: -372, dy: -352, r: 78 },
];
const BIT = { pass: BTN.pass, action: BTN.action, sprint: BTN.sprint, switch: BTN.switch };
const KEYS = { j: 'pass', k: 'action', shift: 'sprint', l: 'switch' };
const KEY_LABEL = { pass: 'J', action: 'K', sprint: 'Shift', switch: 'L' };

export function createMatchControls({ layout, input = null }) {
  const fingers = new Map(); // pointer id → { kind: 'stick' } | { kind: 'button', id }
  let stick = null; // { id, cx, cy, x, y } — the pad and where the finger is now
  let latched = 0; // buttons pressed since the last step (a very short tap still counts once)
  const keys = new Set();
  let touchSeen = false;

  const band = () => {
    const sr = layout.safeRect;
    return { x: sr.x, y: sr.y + sr.h - BAND_H, w: sr.w, h: BAND_H };
  };
  const stickZone = () => {
    const b = band();
    return { x: b.x, y: b.y + INFO_H, w: b.w * 0.5, h: b.h - INFO_H };
  };
  const stickHome = () => {
    const z = stickZone();
    return { x: z.x + 40 + STICK_R, y: z.y + z.h / 2 + 10 };
  };
  const buttons = () => {
    const b = band();
    return BUTTONS.map((d) => ({ ...d, x: b.x + b.w + d.dx, y: b.y + b.h + d.dy }));
  };
  const buttonAt = (p) => {
    let best = null;
    let bd = Infinity;
    for (const b of buttons()) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d <= b.r + 14 && d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  };
  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const heldBits = () => {
    let bits = 0;
    for (const f of fingers.values()) if (f.kind === 'button') bits |= BIT[f.id];
    for (const [k, id] of Object.entries(KEYS)) if (keys.has(k)) bits |= BIT[id];
    return bits;
  };
  const heldIds = () => new Set(Object.entries(BIT).filter(([, bit]) => heldBits() & bit).map(([id]) => id));

  // --- keyboard (the laptop stand-in) --------------------------------------------------------------------------------
  const keyName = (e) => (e.key === 'Shift' ? 'shift' : e.key.length === 1 ? e.key.toLowerCase() : e.key);
  const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd']);
  const onKeyDown = (e) => {
    const k = keyName(e);
    if (!MOVE_KEYS.has(k) && !KEYS[k]) return;
    e.preventDefault();
    if (!keys.has(k) && KEYS[k]) latched |= BIT[KEYS[k]];
    keys.add(k);
  };
  const onKeyUp = (e) => keys.delete(keyName(e));
  const onBlur = () => keys.clear();

  const controls = {
    band,
    stickHome,
    get stick() {
      return stick;
    },
    buttonRect(id) {
      const b = buttons().find((x) => x.id === id);
      return b ? { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 } : null;
    },
    stickZone,
    attachKeys() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
    },
    detachKeys() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      keys.clear();
    },

    // --- pointers: each finger belongs to what it first touched ---------------------------------------------------------
    onDown(p) {
      if (p.pointerType === 'touch' || p.pointerType === 'pen') touchSeen = true;
      const b = buttonAt(p);
      if (b) {
        fingers.set(p.id, { kind: 'button', id: b.id });
        latched |= BIT[b.id];
        return true;
      }
      if (!stick && inside(p, stickZone())) {
        // the pad appears under the thumb (kept whole inside the band)
        const z = stickZone();
        const cx = Math.max(z.x + STICK_R + 8, Math.min(z.x + z.w - STICK_R, p.x));
        const cy = Math.max(z.y + STICK_R, Math.min(z.y + z.h - STICK_R - 8, p.y));
        stick = { id: p.id, cx, cy, x: p.x, y: p.y };
        fingers.set(p.id, { kind: 'stick' });
        return true;
      }
      return inside(p, band()); // a touch on the band between buttons does nothing
    },
    onMove(p) {
      if (stick && p.id === stick.id) {
        stick.x = p.x;
        stick.y = p.y;
      }
    },
    onUp(p) {
      const f = fingers.get(p.id);
      if (!f) return false;
      fingers.delete(p.id);
      if (f.kind === 'stick') stick = null;
      return true;
    },
    // Fingers core/Input has forgotten (a cancelled touch, the app paused) are let go.
    sweep() {
      if (!input) return;
      for (const id of [...fingers.keys()])
        if (!input.pointers.has(id)) {
          if (stick?.id === id) stick = null;
          fingers.delete(id);
        }
    },
    release() {
      fingers.clear();
      stick = null;
      latched = 0;
      keys.clear();
    },
    owns: (id) => fingers.has(id),

    // This step's input for the match.
    frame() {
      let mx = 0;
      let my = 0;
      if (stick) {
        mx = (stick.x - stick.cx) / STICK_R;
        my = (stick.y - stick.cy) / STICK_R;
      } else {
        mx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
        my = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
      }
      const m = Math.hypot(mx, my);
      if (m > 1) {
        mx /= m;
        my /= m;
      }
      const btn = heldBits() | latched;
      latched = 0;
      return { mx, my, btn };
    },

    // --- drawing ------------------------------------------------------------------------------------------------------
    render(ctx, world) {
      const ctl = world.control;
      if (!ctl) return;
      const b = band();
      const held = heldIds();
      ctx.save();
      // the band: a soft dark strip so white controls read on the grass
      ctx.fillStyle = 'rgba(24,52,20,0.55)';
      ctx.beginPath();
      ctx.roundRect(b.x + 8, b.y, b.w - 16, b.h - 8, THEME.panel.radius);
      ctx.fill();
      ctx.restore();

      // top row: who you control · the last action · stamina
      const p = ctl.player;
      const rowY = b.y + INFO_H / 2 + 2;
      if (p) {
        ctx.save();
        ctx.fillStyle = '#FFE14A';
        ctx.beginPath();
        ctx.arc(b.x + 48, rowY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        text(ctx, `${p.shirt} · ${p.name}`, b.x + 76, rowY, { size: S.small, bold: true, color: C.textOnDark, baseline: 'middle', maxWidth: b.w * 0.42 });
      }
      const last = ctl.last;
      if (last && world.steps - last.step < 70) {
        const msg = last.kind === 'tackle' ? (last.ok ? 'Tackle won!' : 'Missed') : last.kind === 'shoot' ? 'Shot!' : last.kind === 'through' ? 'Through ball' : 'Pass';
        text(ctx, msg, b.x + b.w * 0.56, rowY, { size: S.small, bold: true, color: last.kind === 'tackle' && !last.ok ? '#FFB199' : '#FFE14A', align: 'center', baseline: 'middle' });
      }
      const barW = 230;
      const bx = b.x + b.w - 40 - barW;
      text(ctx, 'Sprint', bx - 14, rowY, { size: S.small, bold: true, color: C.textOnDark, align: 'right', baseline: 'middle' });
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.roundRect(bx, rowY - 14, barW, 28, 14);
      ctx.fill();
      ctx.fillStyle = ctl.stamina < 0.3 ? C.warn : C.progress;
      ctx.beginPath();
      ctx.roundRect(bx, rowY - 14, Math.max(14, barW * ctl.stamina), 28, 14);
      ctx.fill();
      ctx.restore();

      // the stick
      const home = stickHome();
      const cx = stick ? stick.cx : home.x;
      const cy = stick ? stick.cy : home.y;
      ctx.save();
      ctx.globalAlpha = stick ? 1 : 0.55;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, STICK_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      let kx = cx;
      let ky = cy;
      if (stick) {
        const dx = stick.x - cx;
        const dy = stick.y - cy;
        const d = Math.hypot(dx, dy);
        const k = d > STICK_R ? STICK_R / d : 1;
        kx = cx + dx * k;
        ky = cy + dy * k;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = C.outline;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(kx, ky, KNOB_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (!stick) text(ctx, touchSeen ? 'Move' : 'Move · WASD', cx, cy + STICK_R + 26, { size: S.small, bold: true, color: C.textOnDark, align: 'center', baseline: 'middle' });

      // the buttons
      const ours = world.owner ? world.owner.team === ctl.team : false;
      const withBall = world.owner === p;
      for (const bt of buttons()) {
        const down = held.has(bt.id);
        let label = { pass: 'Pass', action: withBall || ours ? 'Shoot' : 'Tackle', sprint: 'Sprint', switch: 'Switch' }[bt.id];
        let colour = { pass: C.good, action: label === 'Shoot' ? C.action : C.purple, sprint: C.progress, switch: '#4A4038' }[bt.id];
        const dim = (bt.id === 'switch' && ours) || (bt.id === 'pass' && !ours && !withBall);
        if (bt.id === 'pass' && ctl.passHold >= world.T.control.holdSteps) label = 'Through';
        ctx.save();
        ctx.globalAlpha = dim ? 0.5 : 1;
        const r = down ? bt.r * 0.94 : bt.r;
        if (!down) {
          ctx.fillStyle = shade(colour, 0.3);
          ctx.beginPath();
          ctx.arc(bt.x, bt.y + 7, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = down ? shade(colour, 0.2) : colour;
        ctx.strokeStyle = C.outline;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bt.x, bt.y + (down ? 5 : 0), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // rings: Pass fills while held (full = a through ball); Sprint shows the stamina left
        const ring = bt.id === 'pass' && ctl.passHold > 0 ? Math.min(1, ctl.passHold / world.T.control.holdSteps) : bt.id === 'sprint' ? ctl.stamina : 0;
        if (ring > 0) {
          ctx.strokeStyle = bt.id === 'pass' ? '#FFE14A' : tint(C.progress, 0.55);
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.arc(bt.x, bt.y + (down ? 5 : 0), r + 12, -Math.PI / 2, -Math.PI / 2 + ring * Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = dim ? 0.6 : 1;
        const ty = bt.y + (down ? 5 : 0);
        text(ctx, label, bt.x, touchSeen ? ty : ty - 12, { size: bt.r > 90 ? S.button : S.small, bold: true, color: C.textOnAction, align: 'center', baseline: 'middle', maxWidth: r * 1.8 });
        if (!touchSeen) text(ctx, KEY_LABEL[bt.id], bt.x, ty + 30, { size: S.small, bold: true, color: 'rgba(255,255,255,0.8)', align: 'center', baseline: 'middle' });
        ctx.restore();
      }
    },
  };
  return controls;
}
