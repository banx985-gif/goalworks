// The Works Gods wired into the club's own systems (Milestone 20b): signing through the squad / staff rules, releasing
// through the tactics purge. src/systems/gods.js stays plain (the effect query reads it); this file joins it to staff.js and
// transfers.js, for main.js and the tests.
//   signGod(data, id, day, account, { force }) → { ok, why, accountChanged }      releaseGod(data, id, day) → { ok, why }
import { SQUAD_RULES } from '../../data/transfers.js';
import { sign, release } from './gods.js';
import { hire, release as releaseStaff } from './staff.js';
import { freeShirt, purgeTactics } from './transfers.js';

const hooks = {
  squadMax: SQUAD_RULES.max,
  freeShirt: (data) => freeShirt(data),
  // Bolt takes the Physio seat: whoever holds it now is released first (their release pay too), his own fee is nothing
  appointStaff: (data, id, day) => hire(data, id, day, { replace: true }),
  releaseStaff: (data, id, day) => releaseStaff(data, id, day),
  purge: (data, pid) => purgeTactics(data, pid),
};

export const signGod = (data, id, day, account = null, opts = {}) => sign(data, id, day, account, { ...opts, hooks });
export const releaseGod = (data, id, day) => release(data, id, day, hooks);
