// The cups (Milestone 17, bible §22): a simple reusable knockout — data only here, the rules in src/systems/cup.js. M21's
// full tournament engine extends this (more cups, other formats) rather than replacing it.
//   id, name, art            bible §22 id, its name, its picture (assets/images/tournaments)
//   league                   it runs while this is your league (it opens when you enter that league)
//   teams                    you + every club of `teams.league` + `invite.count` invited clubs from `invite.league`
//                            (the strongest squads there when the edition starts)
//   rounds                   the round names, first to last (8 teams → quarter-final, semi-final, final)
//   firstTieDays / gapDays   the first tie this many days after the edition opens, then one round every gapDays (each
//                            tie a normal fixture on the M2 rules: it takes the week's slot — your tie is fixed 7 days
//                            ahead and no league challenge can be accepted in its place)
//   sim                      AI-vs-AI ties: the stronger XI (average overall) wins with 1 / (1 + e^(−diff / scale));
//                            drawChance of them go to penalties (50/50)
//   prize                    for winning it: Credits + reputation (history / momentum) + flags (sponsor interest — the
//                            sponsors are M23); roundWin: Credits for each tie you win before the final
//   An edition a season: the next opens on Day 1 of the following year (or as soon as the last one ends, if later).
//   Knocked out = out until next season's edition. A draw in your tie is settled on penalties (50/50).
export const CUPS = {
  C02: {
    id: 'C02',
    name: 'County Shield',
    art: 'tournament_c02',
    league: 'county',
    teams: { league: 'county', invite: { league: 'regional', count: 1 } },
    rounds: ['Quarter-final', 'Semi-final', 'Final'],
    firstTieDays: 14,
    gapDays: 28,
    sim: { scale: 5, drawChance: 0.22 },
    prize: { credits: 3000, history: 180, momentum: 40, flags: ['sponsorInterest'] },
    roundWin: { credits: 500 },
  },
};
export const cupById = (id) => CUPS[id] ?? null;
export const US = 'us'; // your club in a bracket

export const CUP_FLAGS = { sponsorInterest: { name: 'Sponsor interest', line: 'Sponsors have noticed the club (sponsors arrive in M23).' } };
