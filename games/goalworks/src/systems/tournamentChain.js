// Tournament chaining hook (Milestone 2, bible §3 "Tournament chaining") — data only, no tournament screens yet.
// A chain is plain save-friendly data:
//   { id, name, rounds, round, status: 'active' | 'won' | 'lost', opponents: [{ id, name }] (one per round),
//     nextMatchDay (day number, or null when the chain has ended), results: [{ round, won, day }] }
// Rules: entry schedules Round 1 seven days later; a win schedules the next round seven days after the result; a loss
// ends the chain; winning the final ends the chain. The calendar (calendar.js) turns chainFixture() into its pending
// fixture, so while a chain is active there is always a fixture pending and no second commit fits in between.
import { CALENDAR } from '../../data/fixtures.js';

const GAP = CALENDAR.matchGapDays;

export function enterChain({ id, name = id, opponents, entryDay }) {
  if (!opponents?.length) throw new Error('A tournament chain needs at least one round');
  return { id, name, rounds: opponents.length, round: 1, status: 'active', opponents: opponents.map((o) => ({ id: o.id, name: o.name })), nextMatchDay: entryDay + GAP, results: [] };
}

// The chain after the current round's result (a new object; the old one is left as it was).
export function chainResult(chain, { won, day }) {
  if (chain.status !== 'active') return chain;
  const results = [...chain.results, { round: chain.round, won: !!won, day }];
  if (!won) return { ...chain, results, status: 'lost', nextMatchDay: null };
  if (chain.round >= chain.rounds) return { ...chain, results, status: 'won', nextMatchDay: null };
  return { ...chain, results, round: chain.round + 1, nextMatchDay: day + GAP };
}

// The offer for the chain's next round (calendar.commit / the calendar's own scheduling), or null once it has ended.
export function chainFixture(chain) {
  if (!chain || chain.status !== 'active') return null;
  return { source: 'tournament', opponent: chain.opponents[chain.round - 1], chain, matchDay: chain.nextMatchDay };
}
