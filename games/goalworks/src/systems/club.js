// A new GOALWORKS campaign and its slot summary (Milestone 0). The campaign save holds the club identity chosen in
// Club Setup and the date; the calendar, squad, league and the rest join it milestone by milestone (bible §36).
import { founderById, colourById, areaById, shapeById, symbolById, POSITIONS, FOUNDER_FLAG } from '../../data/setup.js';

export function newCampaign(setup, now = Date.now()) {
  const founder = founderById(setup.founder);
  if (!founder) throw new Error(`Unknown founder ${setup.founder}`);
  if (setup.primary === setup.secondary) throw new Error('Club colours must differ');
  return {
    club: {
      name: setup.club,
      manager: setup.manager,
      area: areaById(setup.area).id,
      colours: { primary: colourById(setup.primary).id, secondary: colourById(setup.secondary).id },
      badge: { shape: shapeById(setup.shape).id, symbol: symbolById(setup.symbol).id },
      founder: { id: founder.id, [FOUNDER_FLAG]: true }, // history counters join in later milestones
      createdAt: now,
    },
    seed: `goalworks-${now}`,
    date: { year: 1, month: 1, day: 1 },
    playSec: 0,
    ngPlus: 0,
  };
}

// The small record the slot screen reads (bible §5 "Four campaign slots"). League, rank, play time, NG+ and grade stay
// zero / hidden on the card until those systems exist.
export function slotSummary(data) {
  const c = data.club;
  const founder = founderById(c.founder.id);
  return {
    club: c.name,
    manager: c.manager,
    area: c.area,
    primary: c.colours.primary,
    secondary: c.colours.secondary,
    shape: c.badge.shape,
    symbol: c.badge.symbol,
    founderId: founder?.id ?? c.founder.id,
    founderName: founder?.name ?? c.founder.id,
    founderPosition: founder ? POSITIONS[founder.position].name : '',
    year: data.date.year,
    month: data.date.month,
    league: null,
    rank: null,
    ngPlus: data.ngPlus ?? 0,
    playSec: data.playSec ?? 0,
    grade: null,
  };
}

// Older saves moved up to date on load (none yet: version 1 is the first).
export const SAVE_MIGRATIONS = {};

// "Club Manager Aaron — Banx Park Rangers".
export const managerLine = (manager, club) => `Club Manager ${manager || '…'} — ${club || '…'}`;
