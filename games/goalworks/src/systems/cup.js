// The tournament engine (Milestone 17 → Milestone 21, bible §3 / §22): one reusable knockout for all 16 tournaments (data
// in data/cups.js). Plain functions over the run save (data.cups). The league (src/systems/league.js) runs it: it calls
// cupDay each club day for every cup that is running, picks which cup holds the chain (the rest queue), turns your tie into
// a fixture offer (the tie takes the week's slot) and hands your result back with recordOurTie.
//   data.cups = { v: 21, C01: { editions, current, last, nextStart, wins, history } … }
//     an edition = { edition, year, startDay, teams, rounds: [[tie]], round, tieDay, issued, queued, out, done, champion }
//     a tie = { a, b, day, score: [a, b] | null, pens: [a, b] | null, winner: id | null }  ('us' is your club)
// (M21) Bible §3 chaining: your tie for a round is issued when it is this cup's turn (canIssue: no other cup tie is
// waiting — the cup holding the chain goes first, then the queue in the order editions started); the game commits it at
// once, so it is played 7 days later (entering → Round 1 in 7 days; a win → the next round 7 days after the result). The
// other ties of the round are played the same day as yours (recordOurTie). Out of it, the rest of the edition plays a
// round every 7 days without you. An edition that never got its first tie before its season ended is skipped.
//   normaliseCups(data)
//   cupDay(data, cupId, day, { issueTie(clubId, ref, home), hasTie(ref), startNew, canIssue(cupId) }) → events
//     [{ kind: 'start' | 'round' | 'champion' | 'skipped', cup, … }]
//   recordOurTie(data, ref, score, day) → { won, pens, final, champion, prize, roundName, out, events }
//   status(data, cupId) → what the sheets show (the edition now or the last one, your next tie, queued, wins so far)
//   simTie(data, cup, tie, rng) / strength(data, id) / pensFor(data, ref)   (the AI-vs-AI sim and your shoot-out)
import { Rng } from '../../../../core/Rng.js';
import { ALL_CUPS, cupById, US } from '../../data/cups.js';
import { leagueById, LEAGUES } from '../../data/league.js';
import { clubById, ALL_CLUBS } from '../../data/fixtures.js';
import { bestXI, opponentSquad } from './squad.js';
import { overall } from './players.js';
import { shootoutChance } from './gods.js';

const YEAR = 336;
const GAP = 7; // (bible §3: one match per seven days)
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const yearStart = (y) => (y - 1) * YEAR + 1;
// (M21b) the club calendar's own month (club day 0 = Year 1 · Month 1 · Day 1), for the Summer Showcase's window
const clockMonth = (day) => Math.floor((day % YEAR) / 28) + 1;
const clockYear = (day) => Math.floor(day / YEAR);
// (M21b) when a cup's next edition may open: a windowed cup (the Showcase) next year's window, the rest next season's start
const nextOpen = (cup, cur, fallback) => (cup.window ? (clockYear(cur.startDay) + 1) * YEAR + (cup.window.month - 1) * 28 : fallback);
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

export function normaliseCups(data) {
  data.cups ??= { v: 17 };
  for (const id of Object.keys(ALL_CUPS)) data.cups[id] ??= { editions: 0, current: null, last: null, nextStart: 0, wins: 0, history: [] };
  data.cups.v = 21;
  return data.cups;
}

// A side's strength: its best XI's average overall (your club: your squad; an AI club: its squad in the world).
export function strength(data, id) {
  const players = id === US ? data.squad?.players ?? [] : data.transfers?.clubs?.[id]?.players ?? opponentSquad({ seed: `${data.seed}:cup`, clubId: id }).players;
  return avg(bestXI(players).filter(Boolean).map((p) => overall(p)));
}

// (M21) Who plays a secret cup: clubs drawn from your tier and the tier above (four of yours, three from above; at the top,
// six of yours and one from below).
function tierMix(data, rng, n) {
  const tier = leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;
  const at = (t) => LEAGUES.find((l) => l.tier === t)?.clubs ?? [];
  const mine = rng.shuffle(at(tier).slice());
  const above = rng.shuffle(at(tier + 1).slice());
  if (above.length) return [...mine.slice(0, n - 3), ...above.slice(0, 3)];
  return [...mine.slice(0, n - 1), ...rng.shuffle(at(tier - 1).slice()).slice(0, 1)];
}
// (M21b) The Summer Showcase's three: two from your league and one from the league above (at the top, one from below).
function around(data, rng) {
  const tier = leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;
  const at = (t) => LEAGUES.find((l) => l.tier === t)?.clubs ?? [];
  const other = at(tier + 1).length ? at(tier + 1) : at(tier - 1);
  return [...rng.shuffle(at(tier).slice()).slice(0, 2), ...rng.shuffle(other.slice()).slice(0, 1)];
}

function startEdition(data, cup, day) {
  const C = data.cups[cup.id];
  const rng = new Rng(`${data.seed}:cup:${cup.id}:${C.editions + 1}:draw`);
  const byStrength = (ids) => ids.map((id) => [id, strength(data, id)]).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const n = (cup.size ?? 8) - 1;
  let others;
  if (cup.teams.strongest) others = byStrength(ALL_CLUBS.map((c) => c.id)).slice(0, cup.teams.strongest); // (M18 C04)
  else if (cup.teams.pick) others = cup.teams.pick.flatMap((x) => byStrength(leagueById(x.league).clubs).slice(0, x.count)); // (M20 C07; M21 C01, C08)
  else if (cup.teams.tierMix) others = tierMix(data, rng, n); // (M21 C09–C14)
  else if (cup.teams.around) others = around(data, rng); // (M21b the Summer Showcase)
  else {
    const inv = cup.teams.invite;
    others = [...leagueById(cup.teams.league).clubs, ...(inv ? byStrength(leagueById(inv.league).clubs).slice(0, inv.count) : [])];
  }
  const teams = rng.shuffle([US, ...others.slice(0, n)]);
  const first = [];
  for (let i = 0; i < teams.length; i += 2) first.push({ a: teams[i], b: teams[i + 1], day: null, score: null, pens: null, winner: null });
  C.editions++;
  C.current = { edition: C.editions, year: yearOf(day), startDay: day, teams, rounds: [first], round: 0, tieDay: day + GAP, issued: -1, queued: false, out: false, done: false, champion: null };
  return C.current;
}

// An AI-vs-AI tie: the stronger XI is likelier to win, never certain; some go to penalties (a coin toss).
export function simTie(data, cup, tie, rng) {
  const sa = strength(data, tie.a);
  const sb = strength(data, tie.b);
  const pa = 1 / (1 + Math.exp(-(sa - sb) / cup.sim.scale));
  const aWins = rng.next() < pa;
  const g = rng.int(1, 3);
  if (rng.next() < cup.sim.drawChance) {
    const d = rng.int(0, 2);
    tie.score = [d, d];
    tie.pens = aWins ? [rng.int(4, 5), rng.int(2, 3)] : [rng.int(2, 3), rng.int(4, 5)];
  } else {
    const l = rng.int(0, g - 1);
    tie.score = aWins ? [g, l] : [l, g];
  }
  tie.winner = aWins ? tie.a : tie.b;
  return tie;
}
// The round's AI ties (not yet played), on `day`.
function simRound(data, cup, cur, day) {
  cur.rounds[cur.round].forEach((t, i) => {
    if (t.winner || t.a === US || t.b === US) return;
    t.day = day;
    simTie(data, cup, t, new Rng(`${data.seed}:cup:${cup.id}:${cur.edition}:${cur.round}:${i}`));
  });
}

// The round is over when every tie has a winner: the next round is drawn from the winners in bracket order (1v2, 3v4),
// or the edition ends. (M21) The next round is 7 days on (yours is issued at once by the league, if you are still in).
function advance(data, cup, day, events) {
  const C = data.cups[cup.id];
  const cur = C.current;
  if (!cur || cur.done) return;
  const ties = cur.rounds[cur.round];
  if (ties.some((t) => !t.winner)) return;
  if (cur.round === cup.rounds.length - 1) {
    cur.done = true;
    cur.champion = ties[0].winner;
    C.history = [...C.history, { edition: cur.edition, year: cur.year, champion: cur.champion, reached: reached(cup, cur) }].slice(-20);
    if (cur.champion === US) {
      C.wins++;
      C.lastWonDay = day;
    }
    C.last = cur;
    C.current = null;
    C.nextStart = nextOpen(cup, cur, Math.max(day + 1, yearStart(cur.year + 1)));
    events.push({ kind: 'champion', cup: cup.id, champion: cur.champion, edition: cur.edition });
    return;
  }
  const next = [];
  for (let i = 0; i < ties.length; i += 2) next.push({ a: ties[i].winner, b: ties[i + 1].winner, day: null, score: null, pens: null, winner: null });
  cur.rounds.push(next);
  cur.round++;
  cur.tieDay = day + GAP;
  events.push({ kind: 'round', cup: cup.id, round: cur.round, name: cup.rounds[cur.round] });
}
// How far you got in an edition: the round you went out in, 'won', or null (not in it).
function reached(cup, ed) {
  if (ed.champion === US) return 'won';
  for (let r = ed.rounds.length - 1; r >= 0; r--) if (ed.rounds[r].some((t) => t.a === US || t.b === US)) return cup.rounds[r];
  return null;
}

export const ourTieIn = (ed) => (ed && !ed.done ? ed.rounds[ed.round].find((t) => (t.a === US || t.b === US) && !t.winner) ?? null : null);
const oppOf = (t) => (t.a === US ? t.b : t.a);
const started = (cur) => cur.rounds[0].some((t) => t.winner) || cur.issued >= 0;
// (M21) Still waiting for your tie in this cup: in it, and that tie not yet issued.
export const waitingFor = (cur) => !!cur && !cur.done && !cur.out && !!ourTieIn(cur) && cur.issued !== cur.round;

// One club day of a cup: open an edition (once a season), issue your tie when it is this cup's turn, play the AI rounds
// once you are out, move the bracket on; an edition still waiting for its first tie when its season has ended is skipped.
export function cupDay(data, cupId, day, { issueTie, hasTie = () => true, startNew = true, canIssue = () => true, force = false } = {}) {
  const cup = cupById(cupId);
  const C = normaliseCups(data)[cupId];
  const events = [];
  // (M21b) a cup with a window (the Summer Showcase, Month 7) is skipped once its month is over
  const pastWindow = (cur) => !!cup.window && !cur.forced && (clockYear(day) > clockYear(cur.startDay) || clockMonth(day) > cup.window.month);
  if (C.current && !started(C.current) && (yearOf(day) > C.current.year || pastWindow(C.current))) {
    // (M21) its season ran out while it waited in the queue: skipped until next season
    const cur = C.current;
    C.history = [...C.history, { edition: cur.edition, year: cur.year, champion: null, reached: 'skipped' }].slice(-20);
    C.last = { ...cur, skipped: true };
    C.current = null;
    C.nextStart = nextOpen(cup, cur, Math.max(day, yearStart(cur.year + 1))); // (the new season's edition opens today)
    events.push({ kind: 'skipped', cup: cupId, edition: cur.edition, year: cur.year });
  }
  // (M21b) force: ?debug=1 draws a windowed cup (the Showcase) today, outside its month
  if (!C.current && startNew && (force || (day >= C.nextStart && (!cup.window || clockMonth(day) === cup.window.month)))) {
    startEdition(data, cup, day);
    if (force) C.current.forced = true;
    events.push({ kind: 'start', cup: cupId, edition: C.current.edition });
  }
  const cur = C.current;
  if (!cur || cur.done) return events;
  const mine = cur.out ? null : ourTieIn(cur);
  if (mine) {
    const ref = { id: cupId, edition: cur.edition, round: cur.round, name: cup.rounds[cur.round] };
    if (cur.issued === cur.round && !hasTie(ref)) cur.issued = -1; // (its offer went missing: issue it again)
    if (cur.issued !== cur.round) {
      if (canIssue(cupId)) {
        cur.issued = cur.round;
        cur.queued = false;
        cur.tieDay = day + GAP; // (the game commits it at once: played in 7 days, unless a match already booked comes first)
        issueTie?.(oppOf(mine), ref, cur.round !== 1);
      } else cur.queued = true;
    }
    return events; // (the round's other ties are played with yours)
  }
  if (day >= cur.tieDay) {
    simRound(data, cup, cur, day);
    advance(data, cup, day, events);
  }
  return events;
}

// Your tie's shootout after a draw (a coin toss, the same every time for that tie: the result screen shows it before
// Continue records it). (M20b) With Jinx in goal you win about 75% (the same one draw, a different line). → { won, pens: [yours, theirs] }
export function pensFor(data, ref) {
  const rng = new Rng(`${data.seed}:cup:${ref.id}:${ref.edition}:${ref.round}:pens`);
  const won = rng.next() < shootoutChance(data);
  return { won, pens: won ? [rng.int(4, 5), rng.int(2, 3)] : [rng.int(2, 3), rng.int(4, 5)] };
}
// Your tie's result (the 90 minutes; a draw goes to penalties). (M21) The round's other ties are played today too. → { won,
// pens, final, champion, prize, roundName, out, events }
// (M25) pens: the match's own shoot-out [ours, theirs] (src/match/setPieces.js); without one (a test, the auto player's
// older harness) the seeded coin toss as before.
export function recordOurTie(data, ref, score, day, shootout = null) {
  const cup = cupById(ref.id);
  const C = normaliseCups(data)[ref.id];
  const cur = C.current;
  if (!cur || cur.edition !== ref.edition || cur.round !== ref.round) return null;
  const t = ourTieIn(cur);
  if (!t) return null;
  const usA = t.a === US;
  let won = score[0] > score[1];
  let pens = null;
  if (score[0] === score[1]) ({ won, pens } = shootout ? { won: shootout[0] > shootout[1], pens: [...shootout] } : pensFor(data, ref));
  t.day = day;
  t.score = usA ? [score[0], score[1]] : [score[1], score[0]];
  t.pens = pens ? (usA ? pens : [pens[1], pens[0]]) : null;
  t.winner = won ? US : oppOf(t);
  const roundName = cup.rounds[cur.round];
  const final = cur.round === cup.rounds.length - 1;
  if (!won) cur.out = true;
  simRound(data, cup, cur, day);
  const events = [];
  advance(data, cup, day, events);
  const champion = won && final;
  return { won, pens, final, champion, out: !won, roundName, prize: champion ? cup.prize : won ? cup.roundWin : null, cup: cup.id, events };
}

// What a cup's sheet shows: the edition now (or the last one), your next tie, queued, wins so far.
export function status(data, cupId) {
  const cup = cupById(cupId);
  const C = normaliseCups(data)[cupId];
  const ed = C.current ?? C.last;
  const mine = C.current && !C.current.out ? ourTieIn(C.current) : null;
  return {
    cup,
    edition: ed,
    running: !!C.current,
    roundName: C.current ? cup.rounds[C.current.round] : null,
    next: mine ? { opponent: oppOf(mine), day: C.current.issued === C.current.round ? C.current.tieDay : null, round: cup.rounds[C.current.round], home: C.current.round !== 1 } : null,
    queued: !!mine && !!C.current.queued,
    out: !!C.current?.out,
    wins: C.wins,
    editions: C.editions,
    opened: data.league?.cupsOpen?.[cupId] != null || (!!cup.opens.league && !cup.opens.wins && !cup.opens.seasonBeaten && data.league?.tier === cup.opens.league), // (M21)
    nextStart: C.current ? null : C.nextStart,
    history: C.history,
    prizeK: cup.tierScale ? leagueById(data.league?.tier ?? 'regional')?.tier ?? 1 : 1, // (M21b) the Showcase's prize × your league's tier
  };
}
export const teamName = (data, id) => (id === US ? data.club?.name ?? 'Your club' : clubById(id)?.name ?? id);
