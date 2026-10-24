// A simple reusable knockout cup (Milestone 17, bible §22 — C02 County Shield; M18 C03 National Knockout and C04 Crown Cup;
// data in data/cups.js). Plain functions over the run save (data.cups); M21's full tournament engine extends this. The
// league (src/systems/league.js) runs it: it calls cupDay each club day for every cup that is open (data/cups.js `opens`),
// keeps two of your ties out of one week (separate), turns your tie into a fixture offer (the tie takes the week's slot)
// and hands your result back with recordOurTie.
//   data.cups = { v: 17, C02: { editions, current, last, nextStart, wins, history } }
//     an edition = { edition, year, startDay, teams, rounds: [[tie]], round, tieDay, issued, out, done, champion }
//     a tie = { a, b, day, score: [a, b] | null, pens: [a, b] | null, winner: id | null }  ('us' is your club)
//   normaliseCups(data)
//   cupDay(data, cupId, day, { issueTie(clubId, ref, home) }) → events [{ kind: 'start' | 'round' | 'champion' | 'out' }]
//   recordOurTie(data, ref, score, day) → { won, pens, final, champion, prize, roundName }
//   status(data, cupId) → what the sheets show (the edition now or the last one, your next tie, wins so far)
//   simTie(data, cup, tie, rng) / strength(data, id)   the AI-vs-AI sim (tests use them)
import { Rng } from '../../../../core/Rng.js';
import { CUPS, cupById, US } from '../../data/cups.js';
import { leagueById } from '../../data/league.js';
import { clubById, ALL_CLUBS } from '../../data/fixtures.js';
import { bestXI, opponentSquad } from './squad.js';
import { overall } from './players.js';

const YEAR = 336;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const yearStart = (y) => (y - 1) * YEAR + 1;
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

export function normaliseCups(data) {
  data.cups ??= { v: 17 };
  for (const id of Object.keys(CUPS)) data.cups[id] ??= { editions: 0, current: null, last: null, nextStart: 0, wins: 0, history: [] };
  return data.cups;
}

// A side's strength: its best XI's average overall (your club: your squad; an AI club: its squad in the world).
export function strength(data, id) {
  const players = id === US ? data.squad?.players ?? [] : data.transfers?.clubs?.[id]?.players ?? opponentSquad({ seed: `${data.seed}:cup`, clubId: id }).players;
  return avg(bestXI(players).filter(Boolean).map((p) => overall(p)));
}

function startEdition(data, cup, day) {
  const C = data.cups[cup.id];
  const rng = new Rng(`${data.seed}:cup:${cup.id}:${C.editions + 1}:draw`);
  const byStrength = (ids) => ids.map((id) => [id, strength(data, id)]).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  let others;
  if (cup.teams.strongest) others = byStrength(ALL_CLUBS.map((c) => c.id)).slice(0, cup.teams.strongest); // (M18 C04)
  else if (cup.teams.pick) others = cup.teams.pick.flatMap((x) => byStrength(leagueById(x.league).clubs).slice(0, x.count)); // (M20 C07)
  else {
    const inv = cup.teams.invite;
    others = [...leagueById(cup.teams.league).clubs, ...(inv ? byStrength(leagueById(inv.league).clubs).slice(0, inv.count) : [])];
  }
  const teams = rng.shuffle([US, ...others]);
  const first = [];
  for (let i = 0; i < teams.length; i += 2) first.push({ a: teams[i], b: teams[i + 1], day: null, score: null, pens: null, winner: null });
  C.editions++;
  C.current = { edition: C.editions, year: yearOf(day), startDay: day, teams, rounds: [first], round: 0, tieDay: day + cup.firstTieDays, issued: -1, out: false, done: false, champion: null };
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

// The round is over when every tie has a winner: the next round is drawn from the winners in bracket order (1v2, 3v4),
// or the edition ends.
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
    C.nextStart = Math.max(day + 1, yearStart(cur.year + 1));
    events.push({ kind: 'champion', cup: cup.id, champion: cur.champion, edition: cur.edition });
    return;
  }
  const next = [];
  for (let i = 0; i < ties.length; i += 2) next.push({ a: ties[i].winner, b: ties[i + 1].winner, day: null, score: null, pens: null, winner: null });
  cur.rounds.push(next);
  cur.round++;
  cur.tieDay = Math.max(cur.tieDay + cup.gapDays, day + 8); // (your tie is fixed 7 days ahead: room to issue it)
  events.push({ kind: 'round', cup: cup.id, round: cur.round, name: cup.rounds[cur.round] });
}
// How far you got in an edition: the round you went out in, 'won', or null (not in it).
function reached(cup, ed) {
  if (ed.champion === US) return 'won';
  for (let r = ed.rounds.length - 1; r >= 0; r--) if (ed.rounds[r].some((t) => t.a === US || t.b === US)) return cup.rounds[r];
  return null;
}

export const ourTieIn = (ed) => (ed ? ed.rounds[ed.round].find((t) => (t.a === US || t.b === US) && !t.winner) ?? null : null);
const oppOf = (t) => (t.a === US ? t.b : t.a);

// One club day of a cup (only while you are in its league): open an edition, issue your tie a week ahead, sim the AI ties
// on their day, move the bracket on.
export function cupDay(data, cupId, day, { issueTie, hasTie = () => true, startNew = true } = {}) {
  const cup = cupById(cupId);
  const C = normaliseCups(data)[cupId];
  const events = [];
  if (!C.current && startNew && day >= C.nextStart) {
    startEdition(data, cup, day);
    events.push({ kind: 'start', cup: cupId, edition: C.current.edition });
  }
  const cur = C.current;
  if (!cur || cur.done) return events;
  const mine = ourTieIn(cur);
  const ref = (r) => ({ id: cupId, edition: cur.edition, round: r });
  if (mine && cur.issued === cur.round && !hasTie(ref(cur.round))) cur.issued = -1; // (its offer went missing: issue it again)
  if (mine && cur.issued !== cur.round && day >= cur.tieDay - 7) {
    cur.issued = cur.round;
    issueTie?.(oppOf(mine), { id: cupId, edition: cur.edition, round: cur.round, name: cup.rounds[cur.round] }, cur.round !== 1);
  }
  if (day >= cur.tieDay) {
    cur.rounds[cur.round].forEach((t, i) => {
      if (t.winner || t.a === US || t.b === US) return;
      t.day = cur.tieDay;
      simTie(data, cup, t, new Rng(`${data.seed}:cup:${cupId}:${cur.edition}:${cur.round}:${i}`));
    });
  }
  advance(data, cup, day, events);
  return events;
}

// (M18) Two of your cup ties never in one week: going through the cups in order, a cup whose next tie for you is not yet
// issued and falls within 7 days of another cup's tie for you moves its whole round back a week (its AI ties too).
// Called by the league before each day's cupDay. → [cup ids moved]
export function separate(data, cupIds) {
  const moved = [];
  const mine = (id) => {
    const cur = data.cups?.[id]?.current;
    return cur && !cur.done && ourTieIn(cur) ? cur : null;
  };
  for (const id of cupIds) {
    const cur = mine(id);
    if (!cur || cur.issued === cur.round) continue;
    for (let guard = 0; guard < 8; guard++) {
      const clash = cupIds.some((o) => o !== id && mine(o) && Math.abs(mine(o).tieDay - cur.tieDay) < 7 && (mine(o).issued === mine(o).round || cupIds.indexOf(o) < cupIds.indexOf(id)));
      if (!clash) break;
      cur.tieDay += 7;
      if (!moved.includes(id)) moved.push(id);
    }
  }
  return moved;
}

// Your tie's shootout after a draw (a coin toss, the same every time for that tie: the result screen shows it before
// Continue records it). → { won, pens: [yours, theirs] }
export function pensFor(data, ref) {
  const rng = new Rng(`${data.seed}:cup:${ref.id}:${ref.edition}:${ref.round}:pens`);
  const won = rng.next() < 0.5;
  return { won, pens: won ? [rng.int(4, 5), rng.int(2, 3)] : [rng.int(2, 3), rng.int(4, 5)] };
}
// Your tie's result (the 90 minutes; a draw goes to penalties). → { won, pens, final, champion, prize, roundName, out }
export function recordOurTie(data, ref, score, day) {
  const cup = cupById(ref.id);
  const C = normaliseCups(data)[ref.id];
  const cur = C.current;
  if (!cur || cur.edition !== ref.edition || cur.round !== ref.round) return null;
  const t = ourTieIn(cur);
  if (!t) return null;
  const usA = t.a === US;
  let won = score[0] > score[1];
  let pens = null;
  if (score[0] === score[1]) ({ won, pens } = pensFor(data, ref));
  t.day = day;
  t.score = usA ? [score[0], score[1]] : [score[1], score[0]];
  t.pens = pens ? (usA ? pens : [pens[1], pens[0]]) : null;
  t.winner = won ? US : oppOf(t);
  const roundName = cup.rounds[cur.round];
  const final = cur.round === cup.rounds.length - 1;
  if (!won) cur.out = true;
  const events = [];
  advance(data, cup, day, events);
  const champion = won && final;
  return { won, pens, final, champion, out: !won, roundName, prize: champion ? cup.prize : won ? cup.roundWin : null, cup: cup.id, events };
}

// What the Shield sheet shows: the edition now (or the last one), your next tie, wins so far.
export function status(data, cupId) {
  const cup = cupById(cupId);
  const C = normaliseCups(data)[cupId];
  const ed = C.current ?? C.last;
  const mine = ourTieIn(C.current);
  return {
    cup,
    edition: ed,
    running: !!C.current,
    roundName: C.current ? cup.rounds[C.current.round] : null,
    next: mine && !C.current.out ? { opponent: oppOf(mine), day: C.current.tieDay, round: cup.rounds[C.current.round], home: C.current.round !== 1 } : null,
    out: !!C.current?.out,
    wins: C.wins,
    nextStart: C.current ? null : C.nextStart,
    history: C.history,
  };
}
export const teamName = (data, id) => (id === US ? data.club?.name ?? 'Your club' : clubById(id)?.name ?? id);
