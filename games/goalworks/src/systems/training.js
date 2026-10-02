// Training, fatigue, form and morale (Milestone 8, bible §5 perks / §13 / §18 / §19). Plain functions over the run save's
// squad (numbers in data/training.js). Nothing here touches the screen.
//   normaliseSquad(squad) / normaliseTraining(data)   give every player xp / fatigue / form / morale / risk / focus and
//                                                      the run its data.training (an M7 save starts everyone neutral)
//   dailyXp(p, training, founderId) → { total, factors, parts }    today's XP for one player (for the screen, too)
//   trainDay(data, { day, matchDay }) → { kind: 'train'|'dayoff'|'match', players }   one club day for the squad
//   applyMatch(data, { xiIds, score, scorers }) → after a match: fatigue for the XI, form, morale (results, minutes, role)
//   conditionFactor(p) → × on a player's match numbers from fatigue, form and morale (1 at neutral)
//   perkEffects(founderId) → the Founder perk's effects that are live now
// The Founder perk (data/setup.js FOUNDERS[].perk.effects) switches on here: dev* speed their own stats' XP for the whole
// squad, finishingDrillXpPct speeds Attack sessions, cleanSheetConfidencePct lifts morale after a clean sheet; effects
// whose systems are not built yet (familiarity, fans) stay stored with live: false.
// Milestone 12: facilities (src/systems/facilities.js bonus): facilityEffect = the Sports Science Lab's +% on every
// session; each session part gets its own facility's +% (Small Gym → Physical, Skills Cage → Technique …); the Recovery
// Pool and Nutrition Kitchen speed fatigue recovery, the Clubhouse lifts morale a little each day and rest days recover more.
// Milestone 13: research adds to the same keys (src/systems/effects.js effect = facilities + research): more XP by session,
// faster recovery, and trainingLoadPct (sessions tire players less).
// Milestone 14: the support staff add to the same query — the Head Coach's coachPct (coachEffect) and u21XpPct, the
// Physio's recoveryPct and fatigueGainPct (training load and match fatigue).
import { Rng } from '../../../../core/Rng.js';
import { CORE } from '../../data/players.js';
import { founderById } from '../../data/setup.js';
import { FOCUSES, focusById, DEFAULT_FOCUS, INTENSITY, DEFAULT_INTENSITY, XP, FATIGUE, FORM, MORALE, MATCH_CONDITION, PERKS } from '../../data/training.js';
import { overall } from './players.js';
import { effect as bonus } from './effects.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round1 = (v) => Math.round(v * 10) / 10;

export function normalisePlayer(p) {
  p.xp ??= Object.fromEntries(CORE.map((k) => [k, 0]));
  p.fatigue ??= FATIGUE.start;
  p.form ??= 0;
  p.morale ??= MORALE.neutral;
  p.risk ??= 0;
  if (p.focus === undefined) p.focus = null; // individual focus: null = the team session only
  p.today ??= { xp: 0, kind: null };
  return p;
}
export function normaliseSquad(squad) {
  for (const p of [...(squad?.players ?? []), ...(squad?.watch ?? [])]) normalisePlayer(p);
  return squad;
}
export function normaliseTraining(data) {
  data.training ??= { focus: DEFAULT_FOCUS, intensity: DEFAULT_INTENSITY, lastDay: null, log: [] };
  normaliseSquad(data.squad);
  return data.training;
}

export function perkEffects(founderId) {
  return (founderById(founderId)?.perk.effects ?? []).filter((e) => e.live && PERKS[e.key]);
}
// XP multiplier the perk gives this stat of this player in this session.
function perkXp(effects, p, stat, focusId) {
  let m = 1;
  for (const e of effects) {
    const def = PERKS[e.key];
    if (def.kind !== 'xp') continue;
    if (def.positions && !def.positions.includes(p.position)) continue;
    if (def.stats && !def.stats.includes(stat)) continue;
    if (def.focus && def.focus !== focusId) continue;
    m *= 1 + e.value / 100;
  }
  return m;
}

const ageFactor = (age) => XP.age.find(([upTo]) => age <= upTo)[1];
const moraleFactor = (m) => XP.moraleLow + ((XP.moraleHigh - XP.moraleLow) * m) / 100;
const tiredFactor = (f) => (f <= XP.tiredFrom ? 1 : 1 - ((1 - XP.tiredMin) * (f - XP.tiredFrom)) / (100 - XP.tiredFrom));

// The session parts a player trains today: [{ focus, share }] (team only, or team + individual).
function partsOf(p, training) {
  const team = focusById(training.focus);
  if (!p.focus) return [{ focus: team, share: 1 }];
  return [{ focus: team, share: XP.teamShare }, { focus: focusById(p.focus), share: 1 - XP.teamShare }];
}

// fac: the run save whose facilities count (null: none, as before Milestone 12).
export function dailyXp(p, training, founderId = null, fac = null) {
  const intensity = INTENSITY[training.intensity] ?? INTENSITY.normal;
  const factors = {
    baseXP: XP.base,
    // (M14) the Head Coach: +% on every session, and more for players 21 and under (Development Mind)
    coachEffect: XP.coachEffect * (1 + (bonus(fac, 'coachPct') + (p.age <= 21 ? bonus(fac, 'u21XpPct') : 0)) / 100),
    facilityEffect: XP.facilityEffect * (1 + bonus(fac, 'xp:all') / 100),
    moraleFactor: moraleFactor(p.morale),
    ageFactor: ageFactor(p.age),
    workloadFactor: intensity.xp * tiredFactor(p.fatigue),
  };
  const total = Object.values(factors).reduce((a, b) => a * b, 1);
  const effects = founderId ? perkEffects(founderId) : [];
  const parts = partsOf(p, training).map(({ focus, share }) => {
    if (focus.rest) return { focus: focus.id, share, xp: 0, stats: {} };
    const keeperCut = focus.keepers && p.position !== 'GK' ? XP.outfieldKeeping : 1;
    const place = 1 + bonus(fac, `xp:${focus.id}`) / 100; // (M12) the facility for this kind of session
    const stats = {};
    for (const [k, w] of Object.entries(focus.stats)) stats[k] = total * share * keeperCut * w * place * perkXp(effects, p, k, focus.id);
    return { focus: focus.id, share, place, xp: Object.values(stats).reduce((a, b) => a + b, 0), stats };
  });
  return { total, factors, parts, xp: parts.reduce((a, x) => a + x.xp, 0) };
}

// XP for one point of a stat now: more as the overall closes on the hidden potential (its range's top).
export function pointCost(p) {
  const room = p.potential.high - overall(p);
  return XP.perPoint * (1 + XP.nearSlow * (1 - clamp(room / XP.nearRange, 0, 1)));
}
// Put XP into a stat; each full point raises it by one, never taking the overall past the potential. → points gained
function addXp(p, stat, xp) {
  p.xp[stat] = (p.xp[stat] ?? 0) + xp;
  let gained = 0;
  for (let guard = 0; guard < 20; guard++) {
    const cost = pointCost(p);
    if (p.xp[stat] < cost) break;
    if (overall(p) >= p.potential.high) {
      p.xp[stat] = cost; // at the ceiling: XP stops piling up
      break;
    }
    p.stats[stat]++;
    if (overall(p) > p.potential.high) {
      p.stats[stat]--;
      p.xp[stat] = cost;
      break;
    }
    p.xp[stat] -= cost;
    gained++;
  }
  return gained;
}

// (M14) × on fatigue built up (training load and matches): the Physio's fatigueGainPct (−8: 8% less)
const fatigueGain = (data) => Math.max(0, 1 + bonus(data, 'fatigueGainPct') / 100);
const riskOf = (f) => (f <= FATIGUE.riskFrom ? 0 : Math.round((1000 * FATIGUE.riskMax * (f - FATIGUE.riskFrom)) / (100 - FATIGUE.riskFrom)) / 1000);

// One club day. Training days: XP, fatigue by the sessions' load × intensity, a little form either way. Every day:
// recovery, form and morale drift back. The weekly day off and match days don't train.
export function trainDay(data, { day, matchDay = false }) {
  const training = normaliseTraining(data);
  const squad = data.squad;
  const founderId = data.club?.founder?.id ?? null;
  const dayOff = !matchDay && day % FATIGUE.weekOff === 0;
  const kind = matchDay ? 'match' : dayOff ? 'dayoff' : 'train';
  const rng = new Rng(`${data.seed}:train:${day}`);
  const intensity = INTENSITY[training.intensity] ?? INTENSITY.normal;
  // (M12) facilities: faster recovery, more on rest days, a little morale every day
  const recover = 1 + bonus(data, 'recoveryPct') / 100;
  const restMore = 1 + bonus(data, 'restPct') / 100;
  const moraleDay = bonus(data, 'moraleDay');
  const loadCut = Math.max(0, 1 + bonus(data, 'trainingLoadPct') / 100) * fatigueGain(data); // (M13) research: sessions tire players less; (M14) the Physio's Load Manager
  const out = [];
  for (const p of squad.players) {
    let xp = 0;
    const gains = {};
    let restShare = kind === 'dayoff' ? 1 : 0;
    let load = 0;
    if (kind === 'train') {
      const d = dailyXp(p, training, founderId, data);
      for (const part of d.parts) {
        const f = focusById(part.focus);
        if (f.rest) restShare += part.share;
        load += f.load * part.share * intensity.load * loadCut;
        for (const [k, v] of Object.entries(part.stats)) {
          const g = addXp(p, k, v);
          if (g) gains[k] = (gains[k] ?? 0) + g;
        }
      }
      xp = d.xp;
      // a session moves form a little: better when fresh and not flogged, worse when tired
      const lean = (1 - p.fatigue / 100) * (intensity === INTENSITY.heavy ? 0.6 : 1) - 0.45;
      p.form += (rng.next() - 0.5 + lean * 0.5) * 2 * FORM.training * (1 - restShare);
    }
    p.fatigue = clamp(p.fatigue + load - FATIGUE.recoverDay * recover - FATIGUE.restExtra * restShare * recover * restMore, 0, 100);
    p.risk = riskOf(p.fatigue);
    p.form = clamp(p.form - Math.sign(p.form) * Math.min(Math.abs(p.form), FORM.drift), FORM.min, FORM.max);
    p.morale = clamp(p.morale - Math.sign(p.morale - MORALE.neutral) * Math.min(Math.abs(p.morale - MORALE.neutral), MORALE.drift) + moraleDay, 0, 100);
    p.fatigue = round1(p.fatigue);
    p.form = round1(p.form);
    p.morale = round1(p.morale);
    p.today = { xp: round1(xp), kind, gains };
    out.push({ id: p.id, xp, gains });
  }
  training.lastDay = day;
  training.log = [...(training.log ?? []), { day, kind, focus: training.focus, intensity: training.intensity, xp: round1(out.reduce((a, x) => a + x.xp, 0)) }].slice(-28);
  return { kind, players: out };
}

// After a match (our side = the home side of the fixture): the XI tire, form follows the result and goals, morale the
// result, minutes and squad role; the Founder Keeper's clean-sheet confidence lifts everyone.
export function applyMatch(data, { xiIds, score, scorers = [] }) {
  normaliseTraining(data);
  const [us, them] = score;
  const res = us > them ? 'win' : us < them ? 'loss' : 'draw';
  const clean = them === 0;
  const effects = perkEffects(data.club?.founder?.id);
  const cleanBoost = clean ? effects.filter((e) => PERKS[e.key].kind === 'cleanSheetMorale').reduce((a, e) => a + e.value, 0) : 0;
  const inXi = new Set(xiIds);
  const gain = fatigueGain(data); // (M14) the Physio's Load Manager
  const goals = {};
  for (const s of scorers) if (s.team === 0 && !s.own) goals[s.name] = (goals[s.name] ?? 0) + 1;
  for (const p of data.squad.players) {
    if (inXi.has(p.id)) {
      p.fatigue = clamp(p.fatigue + FATIGUE.match * gain, 0, 100);
      p.form += FORM[res] + FORM.goal * (goals[p.name] ?? 0) + (clean && (p.position === 'GK' || p.position === 'DF') ? FORM.cleanSheet : 0);
      p.morale += MORALE[res] + MORALE.played;
    } else p.morale += MORALE[res] + (MORALE.benched[p.contract?.role] ?? 0);
    p.morale += cleanBoost;
    p.fatigue = round1(p.fatigue);
    p.risk = riskOf(p.fatigue);
    p.form = round1(clamp(p.form, FORM.min, FORM.max));
    p.morale = round1(clamp(p.morale, 0, 100));
  }
  return { res, clean, cleanBoost };
}

export function conditionFactor(p) {
  const C = MATCH_CONDITION;
  const f = p.fatigue ?? 0;
  let fat = 1;
  if (f > C.fatigueHard) fat = Math.max(C.fatigueFloor, 1 - C.fatigueSoft - C.fatigueSteep * (f - C.fatigueHard));
  else if (f > C.fatigueFrom) fat = 1 - (C.fatigueSoft * (f - C.fatigueFrom)) / (C.fatigueHard - C.fatigueFrom);
  const form = 1 + (C.form * (p.form ?? 0)) / 10;
  const morale = 1 + (C.morale * ((p.morale ?? MORALE.neutral) - MORALE.neutral)) / 50;
  return fat * form * morale;
}

export { FOCUSES };
