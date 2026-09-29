// Studio splash (Milestone 0): the Banx Gamex logo (art/branding, Aaron's art — shown as painted, never redrawn) on
// black for a moment while the game's pictures and saves load, then the Main Menu. It fades in, holds and fades out;
// a tap skips the rest once loading is done. If the logo can't load, the studio name shows in code text instead.
import { font } from '../../../../core/Theme.js';

const FADE_IN = 0.45;
const HOLD = 1.5;
const FADE_OUT = 0.4;
export const SPLASH_SECONDS = FADE_IN + HOLD + FADE_OUT;

// load(): a promise for everything the game needs before the menu; done(): leave the splash.
export function createSplashScreen({ renderer, assets, load, done }) {
  let t = 0;
  let ready = false;
  let leaving = false;
  let loadProgress = 0;

  const alpha = () => {
    if (t < FADE_IN) return t / FADE_IN;
    if (t < FADE_IN + HOLD) return 1;
    return Math.max(0, 1 - (t - FADE_IN - HOLD) / FADE_OUT);
  };
  const leave = () => {
    if (leaving) return;
    leaving = true;
    done();
  };

  return {
    get ready() {
      return ready;
    },
    get time() {
      return t;
    },
    enter() {
      t = 0;
      ready = false;
      leaving = false;
      loadProgress = 0;
      load((p) => (loadProgress = p)).finally(() => (ready = true));
    },
    update(dt) {
      // The logo holds (does not fade out) until loading is done.
      if (!ready && t + dt > FADE_IN + HOLD) t = Math.max(t, FADE_IN + HOLD);
      else t += dt;
      if (ready && t >= SPLASH_SECONDS) leave();
    },
    onTap() {
      if (ready) leave();
    },
    onBack() {
      return false;
    },
    render(ctx) {
      const W = renderer.width;
      const H = renderer.height;
      ctx.fillStyle = '#000000';
      ctx.fillRect(-4000, -4000, W + 8000, H + 8000);
      ctx.save();
      ctx.globalAlpha = alpha();
      const w = Math.min(W - 80, 1000);
      const r = { x: (W - w) / 2, y: H / 2 - (w * 2) / 3 / 2 - 40, w, h: (w * 2) / 3 };
      if (assets.has('studioLogo')) assets.drawContained(ctx, 'studioLogo', r);
      else if (!assets.isPending('studioLogo')) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = font(110, true);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BANX GAMEX', W / 2, H / 2 - 40, W - 80);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = font(30, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('presents', W / 2, r.y + r.h + 50);
      ctx.restore();
      // a thin loading line only while something is still on its way after the hold
      if (!ready && t >= FADE_IN + HOLD) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(W / 2 - 240, H - 220, 480, 10);
        ctx.fillStyle = '#9BE36A';
        ctx.fillRect(W / 2 - 240, H - 220, 480 * loadProgress, 10);
      }
    },
  };
}
