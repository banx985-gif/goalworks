// The club complex world (Milestone 1): the hidden grid, the three stations and the Founder walking their loop
// (data/complex.js ROUTE: training pitch → manager office → scout desk → back to the pitch). Only the gravel paths are
// walkable, so the Founder goes round the stations, never through them. Plan space only — the screen projects it.
// Nothing here is saved: positions start fresh at the pitch each time the club opens.
//   createComplexWorld({ founder }) → world   founder: the run's Founder (data/setup.js FOUNDERS entry)
import { Grid } from '../../../../core/Grid.js';
import { Agent } from '../../../../core/Agent.js';
import { COMPLEX, STATIONS, ROUTE, PATHS, PERSON } from '../../data/complex.js';

export function createComplexWorld({ founder }) {
  const { cols, rows, cellSize } = COMPLEX;
  const grid = new Grid({ cols, rows, tileSize: cellSize });
  grid.blockRect(0, 0, cols, rows, true);
  for (const p of PATHS) grid.blockRect(p.col, p.row, p.w, p.h, false);

  const stations = STATIONS.map((def) => ({ kind: 'station', id: def.id, def, fp: def.fp }));
  const byStation = Object.fromEntries(stations.map((s) => [s.id, s]));

  const agent = new Agent({ id: 'founder', name: founder.name, speed: PERSON.speed, noPathTeleportSec: 1 });
  const player = { kind: 'player', id: 'founder', name: founder.name, founder, art: founder.art, agent, leg: 0, at: null, stayLeft: 0, laps: 0 };

  // Arrive at the current leg's station and stay a while; then walk to the next one.
  function arrive() {
    const leg = ROUTE[player.leg];
    player.at = leg.station;
    player.stayLeft = leg.stay;
    if (player.leg === 0) player.laps++; // the first stop counts as lap 1
  }
  function walkNext() {
    player.leg = (player.leg + 1) % ROUTE.length;
    player.at = null;
    const d = byStation[ROUTE[player.leg].station].def.door;
    agent.walkTo(grid, d.col, d.row, arrive);
  }
  const start = byStation[ROUTE[0].station].def.door;
  agent.placeAtTile(grid, start.col, start.row);
  arrive();

  const world = {
    grid,
    stations,
    player,
    people: [player],
    visits: [], // the stations reached, in order (tests)
    byId: (id) => (id === player.id ? player : (byStation[id] ?? null)),
    // What the Founder is doing now: "Training", "Walking to the manager office" …
    stateOf(it = player) {
      if (it.kind === 'station') {
        if (player.at === it.id) return `In use: ${player.name} — ${it.def.busy.toLowerCase()}`;
        const next = ROUTE[player.leg].station === it.id && !player.at;
        return next ? `${player.name} is on the way` : 'Free';
      }
      if (player.at) return byStation[player.at].def.busy;
      return ROUTE[player.leg].walking;
    },
    update(dt) {
      if (player.at) {
        player.stayLeft -= dt;
        if (player.stayLeft <= 0) walkNext();
      } else {
        const wasWalking = agent.state === 'walking';
        agent.update(dt, grid);
        if (wasWalking && player.at) world.visits.push(player.at);
      }
    },
  };
  return world;
}
