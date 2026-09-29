// The club calendar and fixture scheduler (Milestone 2, bible §3 / §21), on the series Clock (core/Clock.js).
//   createCalendar({ bus, saved, flags, sources }) → cal
//     saved   a campaign's calendar save (cal.serialize()), or null for Year 1 · Month 1 · Day 1
//     flags   the account's speed unlocks { perm2x, perm4x } (the same object is read live, so a change counts at once)
//     sources the fixture sources that count (default data/fixtures.js FIXTURE_SOURCES; tests pass their own)
// Rules:
//   • Pause and 1× always; 2× only while a valid fixture is pending (or with perm2x); 4× only with perm4x.
//   • A fixture only comes from an offer made by a live recognised source (the Test Challenge now). commit(offer) sets
//     matchDay = today + 7. While a fixture is pending a second commit is refused (one match per 7 days).
//   • Kickoff day: the calendar pauses by itself and stays paused until playResult(). After the result temporary 2×
//     closes (2× drops to 1×) unless another valid fixture is already pending (e.g. the next round of a tournament chain).
// Bus events (as well as the clock's own clock:day / clock:month / clock:year / clock:speed):
//   calendar:week {…now}   fixture:committed {fixture}   fixture:kickoff {fixture}   fixture:result {fixture, result}
import { Clock } from '../../../../core/Clock.js';
import { CALENDAR, FIXTURE_SOURCES, REGIONAL_CLUBS, clubById } from '../../data/fixtures.js';
import { chainFixture, chainResult } from './tournamentChain.js';

const HISTORY_KEEP = 30;

export function createCalendar({ bus = null, saved = null, flags = {}, sources = FIXTURE_SOURCES } = {}) {
  const sourceOf = (id) => sources.find((s) => s.id === id) ?? null;
  let fixture = null; // { id, source, opponent: { id, name }, committedDay, matchDay, chain? }
  let chain = null; // an active tournament chain (tournamentChain.js), or null
  let history = []; // [{ id, source, opponent, matchDay, playedDay, result }]
  let nextId = 1;

  // The clock reports to us first (so kickoff pauses it inside the very day step that reaches it), then to the game.
  const relay = {
    emit(ev, data) {
      if (ev === 'clock:day') onDay();
      bus?.emit(ev, data);
    },
  };
  const clock = new Clock({ bus: relay, daysPerMonth: CALENDAR.daysPerMonth, monthsPerYear: CALENDAR.monthsPerYear, secondsPerDay: CALENDAR.secondsPerDay, speeds: CALENDAR.speeds });
  const atKickoff = () => !!fixture && clock.totalDays >= fixture.matchDay;
  clock.speedAllowed = (s) => {
    if (atKickoff()) return false; // match day: nothing moves until the result
    if (s === 1) return true;
    if (s === 2) return !!flags.perm2x || !!fixture;
    if (s === 4) return !!flags.perm4x;
    return false;
  };

  function onDay() {
    if (clock.totalDays % CALENDAR.weekDays === 0) bus?.emit('calendar:week', clock.now());
    if (atKickoff()) {
      clock.dayProgress = 0;
      clock.pause();
      bus?.emit('fixture:kickoff', { fixture });
    }
  }

  // A speed that is no longer allowed drops to the fastest one that is (2× → 1×), also as the speed Resume returns to.
  function settleSpeed() {
    if (!clock.canUseSpeed(clock.lastSpeed)) clock.lastSpeed = clock.usableSpeed(clock.lastSpeed) || 1;
    if (!clock.paused && !clock.canUseSpeed(clock.speed)) clock.setSpeed(clock.usableSpeed(clock.speed));
  }

  // Is this offer one that counts? { ok, why }
  function validOffer(offer) {
    const src = sourceOf(offer?.source);
    if (!src) return { ok: false, why: 'Only league, tournament and event fixtures count.' };
    if (!src.live) return { ok: false, why: `${src.name}s are not open yet.` };
    if (offer.source === 'tournament') {
      if (!offer.chain || offer.chain.status !== 'active') return { ok: false, why: 'That tournament is not running.' };
    } else if (!clubById(offer.opponent?.id)) return { ok: false, why: 'Unknown opponent.' };
    return { ok: true, why: null };
  }

  function place(offer, matchDay) {
    fixture = {
      id: `fx${nextId++}`,
      source: offer.source,
      opponent: { id: offer.opponent.id, name: offer.opponent.name },
      committedDay: clock.totalDays,
      matchDay,
    };
    if (offer.chain) fixture.chain = { id: offer.chain.id, round: offer.chain.round };
    return fixture;
  }

  const cal = {
    clock,
    get fixture() {
      return fixture;
    },
    get chain() {
      return chain;
    },
    get history() {
      return history;
    },
    get flags() {
      return flags;
    },
    set flags(f) {
      flags = f ?? {};
      settleSpeed();
    },
    get today() {
      return clock.totalDays;
    },
    get atKickoff() {
      return atKickoff();
    },
    // Days until kickoff (0 on match day), or null with no fixture.
    get daysToMatch() {
      return fixture ? Math.max(0, fixture.matchDay - clock.totalDays) : null;
    },
    // 2× is open only because of the pending fixture (not a permanent unlock).
    get temporary2x() {
      return !flags.perm2x && !!fixture;
    },

    // The Test Challenge (temporary league stand-in): the next Regional League club in turn.
    testChallenge() {
      const opp = REGIONAL_CLUBS[history.filter((h) => h.source === 'test').length % REGIONAL_CLUBS.length];
      return { source: 'test', opponent: { id: opp.id, name: opp.name } };
    },

    canCommit(offer) {
      if (fixture) return { ok: false, why: `A match is already scheduled: ${fixture.opponent.name} in ${cal.daysToMatch} day${cal.daysToMatch === 1 ? '' : 's'}. One match per 7 days.` };
      return validOffer(offer);
    },
    // Commit to a valid fixture: kickoff is exactly 7 days from today. → { ok, why, fixture }
    commit(offer) {
      const can = cal.canCommit(offer);
      if (!can.ok) return { ...can, fixture: null };
      if (offer.source === 'tournament') chain = offer.chain;
      place(offer, clock.totalDays + CALENDAR.matchGapDays);
      bus?.emit('fixture:committed', { fixture });
      return { ok: true, why: null, fixture };
    },

    // Kickoff day only: record the result. Milestone 3 passes the match's score ([ours, theirs]) and scorers; with no
    // score it is the Milestone 2 placeholder "Match played" (tests may pass { won } for a tournament chain).
    // The calendar then runs again; temporary 2× closes unless another valid fixture was scheduled.
    playResult({ won = null, score = null, scorers = null } = {}) {
      if (!atKickoff()) return { ok: false, why: 'No match today.' };
      const played = fixture;
      if (score) won = score[0] > score[1];
      if (won == null) won = true;
      const text = score ? `${score[0] > score[1] ? 'Won' : score[0] < score[1] ? 'Lost' : 'Drew'} ${score[0]}–${score[1]}` : 'Match played';
      const result = { text, won, ...(score ? { score: [...score] } : {}) };
      const entry = { id: played.id, source: played.source, opponent: played.opponent, matchDay: played.matchDay, playedDay: clock.totalDays, result: result.text };
      if (score) Object.assign(entry, { score: [...score], scorers: (scorers ?? []).map((s) => ({ ...s })) });
      history.push(entry);
      if (history.length > HISTORY_KEEP) history = history.slice(-HISTORY_KEEP);
      fixture = null;
      if (played.chain && chain?.id === played.chain.id) {
        chain = chainResult(chain, { won, day: clock.totalDays });
        const next = chainFixture(chain);
        if (next && validOffer(next).ok) place(next, next.matchDay);
        if (chain.status !== 'active') chain = null;
      }
      settleSpeed();
      clock.resume();
      bus?.emit('fixture:result', { fixture: played, result });
      return { ok: true, why: null, result, next: fixture };
    },

    // Speed buttons: 0 (pause), 1, 2, 4. → { ok, why }
    setSpeed(s) {
      const why = cal.speedWhy(s);
      if (why) return { ok: false, why };
      clock.setSpeed(s);
      return { ok: true, why: null };
    },
    // Why a speed can't be used now (null when it can).
    speedWhy(s) {
      if (atKickoff() && s !== 0) return 'Match day: play the match first.';
      if (clock.canUseSpeed(s)) return null;
      if (s === 2) return '2× opens while a match is scheduled.';
      if (s === 4) return '4× unlocks after finishing NG+1 once.';
      return 'Not available.';
    },

    // Call every simulation step with real seconds.
    update(dt) {
      if (atKickoff()) return;
      clock.update(dt);
    },

    serialize() {
      return { clock: clock.serialize(), fixture: fixture && structuredClone(fixture), chain: chain && structuredClone(chain), history: history.map((h) => ({ ...h })), nextId };
    },
  };

  if (saved) {
    fixture = saved.fixture ?? null;
    chain = saved.chain ?? null;
    history = saved.history ?? [];
    nextId = saved.nextId ?? 1;
    if (saved.clock) clock.load(saved.clock);
    if (atKickoff()) {
      clock.speed = 0; // a reload on match day comes back paused, to Match Setup
      clock.dayProgress = 0;
    }
    settleSpeed();
  }
  return cal;
}
