// GOALWORKS' sound and touch feedback (Milestone 32, bible §39 / §40) on core/AudioManager (every sound made in code from
// data/audio.js until a real file replaces it) and core/Haptics. Follows the shared Settings: sound on / off, effects and
// music volumes and their mutes, haptics on / off. Nothing here is read by any game rule.
//   createSound({ audio, haptics, settings }) → s
//     s.applySettings()                   the volumes / mutes from Settings (main.js calls it on every change)
//     s.play(id)                           one sound (data/audio.js SOUNDS)
//     s.stinger(id)                        promotion / trophy / legend: the crowd ducks under it (DUCK)
//     s.screen(name)                       the screen now on show: the club's ambience on the club, quiet elsewhere
//     s.matchFrame(world, { attendance })  called every frame on the match screen: the crowd bed for this crowd (from its
//                                          kickoff attendance), whistles, kicks, tackles, the post, the net, roars and groans,
//                                          and the haptics for goals, cards and the final whistle, from the match's own events
//                                          and counters (the engine is never touched); a new or reloaded match starts clean
//     s.matchEnd()                         the bed stops
//     s.purchase()                         a purchase finished: a chime and a buzz
//     s.tap()                              a tap on a sheet or dialog: a soft click
//   s.log → the last sounds asked for (tests: which sounds played when) · s.buzzes → haptic levels asked for
import { SOUNDS, crowdBedFor, DUCK } from '../../data/audio.js';

export function createSound({ audio, haptics = null, settings }) {
  const log = [];
  const buzzes = [];
  let bed = null; // the crowd bed's sound id while a match is on
  let watch = null; // { world, events, stats } — what the last frame saw
  let duckUntil = 0;
  let where = null;
  const note = (id) => {
    log.push(id);
    if (log.length > 60) log.shift();
  };
  const buzz = (level) => {
    buzzes.push(level);
    if (buzzes.length > 30) buzzes.shift();
    haptics?.[level]?.();
  };
  function play(id) {
    if (!SOUNDS[id]) return false;
    note(id);
    return audio.play(id);
  }
  function setBedLevel(share) {
    const l = bed && audio.loops.get('crowd');
    if (!l?.gain || !audio.ctx) return;
    const t = audio.ctx.currentTime;
    const base = SOUNDS[bed].volume ?? 0.5;
    try {
      l.gain.gain.cancelScheduledValues?.(t);
      l.gain.gain.setValueAtTime(l.gain.gain.value, t);
      l.gain.gain.linearRampToValueAtTime(base * share, t + 0.25);
    } catch {
      /* the device refused: leave it */
    }
  }
  function stinger(id) {
    duckUntil = Date.now() + DUCK.ms;
    setBedLevel(DUCK.level);
    buzz('strong');
    return play(id);
  }
  function startBed(id) {
    if (bed === id) return;
    if (bed) audio.stopLoop('crowd');
    bed = id;
    note(id);
    audio.startLoop(id, 'crowd');
  }
  function matchEnd() {
    if (bed) audio.stopLoop('crowd');
    bed = null;
    watch = null;
  }
  function screen(name) {
    if (name === where) return;
    where = name;
    if (name === 'club') {
      note('ambience');
      audio.startLoop('ambience', 'ambience');
    } else audio.stopLoop('ambience');
    if (name !== 'match') matchEnd();
  }
  // The match's sounds, from its events and counters since the last frame.
  function matchFrame(world, { attendance = 0 } = {}) {
    if (!world) return;
    if (!watch || watch.world !== world) {
      // a new match (or one resumed from its save): start from where it is now, never replay what has happened
      watch = { world, events: world.events.length, stats: world.stats.map((s) => ({ ...s })), whistled: world.steps > 0 };
      startBed(crowdBedFor(attendance));
    }
    if (duckUntil && Date.now() > duckUntil) {
      duckUntil = 0;
      setBedLevel(1);
    }
    if (!watch.whistled && world.steps > 0) {
      watch.whistled = true;
      play('whistle'); // kickoff
    }
    while (watch.events < world.events.length) {
      const e = world.events[watch.events++];
      if (e.type === 'goal') {
        play('net');
        play(e.team === 0 ? 'crowdRoar' : 'crowdGroan');
        buzz(e.team === 0 ? 'strong' : 'medium');
      } else if (e.type === 'post') {
        play('post');
        play('crowdOoh');
      } else if (e.type === 'miss' || e.type === 'save' || e.type === 'block') {
        if (e.team === 0 || e.type !== 'miss') play('crowdOoh');
      } else if (e.type === 'yellow' || e.type === 'red') {
        play('card');
        buzz(e.type === 'red' ? 'medium' : 'light');
      } else if (e.type === 'penalty' || e.type === 'half') play('whistle');
      else if (e.type === 'full') {
        play('whistleEnd');
        buzz('medium');
      }
    }
    // kicks and tackles from the match's own counters (passes, shots, tackles)
    for (let t = 0; t < 2; t++) {
      const now = world.stats[t];
      const was = watch.stats[t];
      if (now.passes > was.passes || now.shots > was.shots) play('kick');
      if (now.tackles > was.tackles) play('tackle');
      watch.stats[t] = { ...now };
    }
  }
  function applySettings() {
    const pct = (v, d) => Math.max(0, Math.min(100, Number(v ?? d))) / 100;
    audio.setMuted(settings.get('muted') === true);
    audio.setVolumes({ sfx: settings.get('sfxMuted') === true ? 0 : pct(settings.get('sfx'), 100), music: settings.get('musicMuted') === true ? 0 : pct(settings.get('music'), 75) });
  }
  return {
    log,
    buzzes,
    get bed() {
      return bed;
    },
    applySettings,
    play,
    stinger,
    screen,
    matchFrame,
    matchEnd,
    purchase() {
      buzz('medium');
      return play('purchase');
    },
    tap() {
      return play('uiClick');
    },
    build() {
      buzz('light');
      return play('build');
    },
  };
}
