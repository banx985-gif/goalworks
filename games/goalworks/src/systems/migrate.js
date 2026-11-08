// The save migration chain (Milestone 33, bible §36): one versioned chain from every past save to now, run by core
// SaveStore on every load (migrateSave: one step per version, each returning a new record).
//   version 0  a record from before Milestone 22's layout (the old single key): carried up as it is
//   version 1  every GOALWORKS save from M0 to M30. Its shape grew milestone by milestone without a version bump, so step
//              1 → 2 reads which blocks the save has and brings each one up to date with the same normalise functions
//              the game has always run when a club opens (M7 squad … M28 secrets; each fills in only what is missing
//              and never invents a past: see the notes beside each in src/main.js openRun)
//   version 2  Milestone 33: the current shape (data.shape = SAVE_SHAPE)
// Plain functions; the open club still runs the same normalise calls (they are idempotent), so a save that was already
// up to date is unchanged.
//   SAVE_VERSION · SAVE_SHAPE · SAVE_MIGRATIONS · bringUpToDate(data) → data (a copy) · validateRun(data) / validateAccount(a)
import * as LG from './league.js';
import * as TR from './transfers.js';
import { normaliseTraining } from './training.js';
import { normaliseTactics } from './tactics.js';
import { ensureSquad } from './squad.js';
import { normaliseFacilities } from './facilities.js';
import { normaliseResearch } from './research.js';
import { normaliseStaff } from './staff.js';
import * as AC from './academy.js';
import * as CA from './careers.js';
import * as VD from './verdicts.js';
import * as GD from './gods.js';
import * as SE from './secrets.js';
import * as FIN from './finance.js';
import * as STAD from './stadium.js';
import * as MED from './medical.js';
import * as FAN from './fans.js';
import * as SP from './sponsors.js';
import * as BOARD from './board.js';
import * as ACH from './achievements.js';

export const SAVE_VERSION = 2;
export const SAVE_SHAPE = 33;

const clone = (o) => JSON.parse(JSON.stringify(o));

// Every block a save of any age may be missing, in the order the game has always filled them (src/main.js openRun).
export function bringUpToDate(src) {
  const data = clone(src);
  const day = () => data.calendar?.clock?.totalDays ?? 0;
  LG.normaliseLeague(data); // (an M9 save: no Regional record yet)
  ensureSquad(data); // (before M7: the squad generated once from its Founder)
  normaliseTraining(data); // (M7)
  normaliseTactics(data); // (M8)
  TR.normaliseTransfers(data); // (M10)
  normaliseFacilities(data); // (M11)
  normaliseResearch(data); // (M12)
  normaliseStaff(data, day()); // (M13)
  AC.normaliseAcademy(data, day()); // (M14)
  CA.normaliseCareers(data, day()); // (M15)
  VD.normaliseVerdicts(data, day()); // (M21)
  GD.normaliseGods(data); // (M20)
  SE.normaliseSecrets(data); // (M20b; M28 renames the M21 cup ids)
  FIN.normaliseFinance(data, day()); // (M22b)
  STAD.normaliseStadium(data); // (M23)
  MED.normaliseMedical(data); // (M24)
  FAN.normaliseFans(data);
  SP.normaliseSponsors(data, day());
  BOARD.normaliseBoard(data);
  ACH.normaliseAchievements(data); // (M26)
  data.shape = SAVE_SHAPE;
  return data;
}

export const SAVE_MIGRATIONS = {
  0: (record) => ({ ...record }),
  1: (record) => ({ ...record, data: bringUpToDate(record.data) }),
};

// The game's check on a loaded copy (core SaveStore validate): a copy whose checksum is fine but whose data is not a
// GOALWORKS club is skipped like a damaged one (the load falls back to the copy before it).
export function validateRun(data) {
  const p = [];
  if (!data || typeof data !== 'object') return ['not an object'];
  if (!data.club || typeof data.club.name !== 'string' || !data.club.name) p.push('no club');
  // (a club just started is saved before its squad is generated: the blocks are checked only when they are there)
  if (data.squad != null && !Array.isArray(data.squad.players)) p.push('bad squad');
  if (data.league != null && !Number.isFinite(data.league.credits)) p.push('bad Credits');
  if (data.calendar != null && typeof data.calendar !== 'object') p.push('bad calendar');
  return p;
}
export function validateAccount(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return ['not an object'];
  const p = [];
  if (a.clubTokens != null && !(Number.isFinite(a.clubTokens) && a.clubTokens >= 0)) p.push('bad Club Tokens');
  if (a.prestigeTokens != null && !Number.isFinite(a.prestigeTokens)) p.push('bad Prestige Tokens');
  if (a.hallOfFame != null && !Array.isArray(a.hallOfFame)) p.push('bad Hall of Fame');
  return p;
}
