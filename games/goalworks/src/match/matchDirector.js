// The match director (Milestone 5, bible §17): which mode the human is in (Watch / Manage / Play), the match speed and
// camera, the Manage commands, and Key Moments. It sits beside the world and never touches the football itself — a mode
// change or a team command goes into the world's timeline (world.command), so the saved match replays exactly.
//   createMatchDirector(world, { saved = null, prompts = true, speed = 1, camera = 'full', onChange })
//     d.userMode — the mode the human chose ('watch' | 'manage' | 'play'); d.mode — the mode on screen now (Play during
//     a Key Moment)   d.speed (1 | 2, Play is always 1×)   d.camera ('full' | 'follow' | 'close')   d.prompts (bool)
//     d.km — null, or { type, state: 'offer' | 'live', at, start, back, backSpeed, turn }: the Key Moment offered / played
//     d.setMode(m)  d.setTactic(key, value)  d.setSpeed(s)  d.setCamera(c)  d.setPrompts(on)  d.accept()  d.skip()
//     d.tick() — before each world.step(): false = don't step (a Key Moment is waiting for an answer, or the match is over)
//     d.secondsLeft — a live Key Moment's time left (to its longest)   d.serialize() → plain data for the match save
// A Key Moment is only looked for in Watch / Manage with prompts on: the match pauses on the offer; Play it switches to
// Play for at least KEY_MOMENTS.minSec of match play (to maxSec at most) and then hands back to the mode you were in —
// at the next dead ball or once the ball has clearly changed hands; Skip lets the AI play it out.
import { KEY_MOMENTS, MATCH_TIME, TACTICS } from '../../data/match.js';
import { MODES } from './matchWorld.js';
import { detectKeyMoment, momentSettled } from './keyMoments.js';

const K = KEY_MOMENTS;
const S = (sec) => Math.round(sec / MATCH_TIME.step);
export const CAMERAS = ['full', 'follow', 'close'];

export function createMatchDirector(world, { saved = null, prompts = true, speed = 1, camera = 'full', onChange = () => {} } = {}) {
  const team = world.team;
  const st = {
    userMode: world.mode,
    speed,
    camera,
    prompts,
    km: null,
    lastKm: -Infinity, // the step the last moment was offered / ended (the cooldown runs from it)
    offers: 0,
    seen: {},
    ...(saved ? JSON.parse(JSON.stringify(saved)) : {}), // (a copy: the live moment never writes into the save it came from)
  };
  if (st.lastKm == null) st.lastKm = -Infinity; // (JSON turns -Infinity into null)
  if (!MODES.includes(st.userMode)) st.userMode = world.mode;
  const changed = (why) => onChange(why);

  function end(why) {
    const km = st.km;
    st.km = null;
    st.lastKm = world.steps;
    if (!km || km.state !== 'live') return;
    if (world.mode !== km.back) world.command(['mode', km.back]);
    st.speed = km.backSpeed ?? 1;
    changed(`km:end:${why}`);
  }

  const d = {
    team,
    get userMode() {
      return st.userMode;
    },
    get mode() {
      return world.mode;
    },
    get speed() {
      return world.mode === 'play' ? 1 : st.speed;
    },
    get camera() {
      return st.camera;
    },
    get prompts() {
      return st.prompts;
    },
    get km() {
      return st.km;
    },
    get offers() {
      return st.offers;
    },
    get paused() {
      return st.km?.state === 'offer';
    },
    get secondsLeft() {
      const km = st.km;
      if (km?.state !== 'live') return 0;
      return Math.max(0, (S(K.maxSec) - (world.steps - km.start)) * MATCH_TIME.step);
    },
    tactics() {
      return world.tactics[team];
    },

    // --- the human's choices --------------------------------------------------------------------------------------------
    setMode(m) {
      if (!MODES.includes(m) || st.km?.state === 'offer') return false;
      if (st.km?.state === 'live') {
        // taking over by hand ends the moment (no hand-back)
        st.km = null;
        st.lastKm = world.steps;
      }
      st.userMode = m;
      if (world.mode !== m) world.command(['mode', m]);
      changed('mode');
      return true;
    },
    setTactic(key, value) {
      if (!TACTICS[key]?.options.includes(value) || world.tactics[team][key] === value) return false;
      world.command(['tac', team, key, value]);
      changed('tactic');
      return true;
    },
    setSpeed(s) {
      if (!MATCH_TIME.speeds.includes(s)) return;
      st.speed = s;
      changed('speed');
    },
    setCamera(c) {
      if (!CAMERAS.includes(c)) return;
      st.camera = c;
      changed('camera');
    },
    setPrompts(on) {
      st.prompts = !!on;
      if (!st.prompts && st.km?.state === 'offer') st.km = null; // (turned off with one waiting: the AI plays it)
      changed('prompts');
    },
    accept() {
      const km = st.km;
      if (km?.state !== 'offer') return false;
      km.state = 'live';
      km.start = world.steps;
      km.back = st.userMode;
      km.backSpeed = st.speed;
      km.turn = 0;
      if (world.mode !== 'play') world.command(['mode', 'play']);
      changed('km:play');
      return true;
    },
    skip() {
      if (st.km?.state !== 'offer') return false;
      st.km = null;
      st.lastKm = world.steps;
      changed('km:skip');
      return true;
    },

    // --- once per step, before the world steps ---------------------------------------------------------------------
    tick() {
      const km = st.km;
      if (world.done) {
        if (km) end('fulltime');
        return false;
      }
      if (km?.state === 'offer') return false;
      if (km?.state === 'live') {
        const played = world.steps - km.start;
        if (played >= S(K.maxSec)) end('time');
        else if (world.phase === 'halftime') end('half');
        else {
          const settled = momentSettled(world, km, team);
          if (played >= S(K.minSec) && settled) end('settled');
        }
        return true;
      }
      if (!st.prompts || st.userMode === 'play' || st.offers >= K.maxPerMatch) return true;
      const cool = world.steps - st.lastKm < S(K.cooldownSec);
      const type = detectKeyMoment(world, team, st.seen);
      if (!type || cool || K.types[type]?.hook) return true;
      st.km = { type, state: 'offer', at: world.steps };
      st.offers++;
      changed('km:offer');
      return false;
    },

    serialize() {
      return JSON.parse(JSON.stringify({ ...st, lastKm: Number.isFinite(st.lastKm) ? st.lastKm : null }));
    },
  };
  return d;
}
