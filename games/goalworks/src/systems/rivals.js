// Rivals (Milestone 22, bible §23 / §30 / §32; Kairosoft gap 5): the rivalry meter, its bands and what they change, the
// story rivals RV01–RV07 (RV08 data only), dynamic rivals, the rival managers' News lines, the SEC-RIVAL-02…04 tallies
// and the late twist (Premier clubs counter your most-used formation). Numbers and lines in data/rivals.js. Plain
// functions over the run save; no import of league.js (league.js calls in here), so there is no import loop.
//   data.rivals = { v: 22, clubs: { id: { meter, story, dynamic, permanent, formed, since, lastMet, h2h: [{ day, score,
//                   res, big }], bigs: ['W' | 'L' | 'D'] } }, used: [{ f, b }], last, popups: [{ kind, clubId?, day }],
//                   chain: [{ day, text, face }], twist: day | null, ghost: day | null,
//                   track: { derbyRun, bestDerbyRun, born: clubId | null, poached: [{ clubId, name, day }] }, atmosphere }
//   normaliseRivals(data, day)              story rivals start when their league is reached (an older save: from its
//                                           league, plus a little for the meetings it already had)
//   bandOf(meter) · isRival(data, id) · info(data, id) → { clubId, story, dynamic, meter, band, banner, manager, … }
//   rewardMods(data, clubId, res) → { mult, dip }           (league.previewReward)
//   cooldownMult(data, clubId)                               (league.recordResult: the rematch cooldown)
//   afterResult(data, fixture, score, day, cup) → summary    (league.recordResult, a competitive match)
//   noteTransfer(data, clubId, p, kind, day)                 (transfers: a player signed from / sold to a club)
//   rivalsDay(data, day) → events                            (league.leagueDay: the monthly fade, News chains, the twist)
//   matchMods(data, fixture, day) → { rival, banner, intensity: [us, them], cardRisk, counter, roar }
//   counterFor(data, clubId, day) → the late twist's counter or null      applyIntensity(xi, pct)
//   fansWeight(data, clubId, day)                            (verdicts: the Fans voice weighs a rival result by band)
//   rivalsList(data) → the Rivals screen's rows              ghostSide(data) → RV08's plan (data only)
//   popups(data) / takePopup(data) — the queued one-tap pop-ups ("New rivalry!", the late twist)
import { Rng } from '../../../../core/Rng.js';
import { METER, BANDS, EFFECTS, STORY_RIVALS, storyById, storyForClub, LINES, POACH_CHAIN, TWIST, COUNTERS } from '../../data/rivals.js';
import { clubById } from '../../data/fixtures.js';
import { leagueById, LEAGUES } from '../../data/league.js';
import { cupById } from '../../data/cups.js';
import { overall } from './players.js';

const YEAR = 336;
const MONTH = 28;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const clamp = (v) => Math.max(0, Math.min(METER.max, v));
const bandIdx = (id) => BANDS.findIndex((b) => b.id === id);
const leagueOfClub = (id) => LEAGUES.find((l) => l.clubs.includes(id)) ?? null;
const tierNow = (data) => leagueById(data.league?.tier ?? 'regional')?.tier ?? 1;
const blank = (day) => ({ meter: 0, story: null, dynamic: false, permanent: false, formed: null, since: day, lastMet: null, h2h: [], bigs: [] });

export const bandOf = (meter) => [...BANDS].reverse().find((b) => meter >= b.min) ?? BANDS[0];
const atLeast = (meter, id) => bandIdx(bandOf(meter).id) >= bandIdx(id);

function news(data, day, text, face = null) {
  data.league.news = [...(data.league.news ?? []), { day, text, ...(face ? { face } : {}) }].slice(-20);
}
function history(data, day, text) {
  data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text }].slice(-60);
}

export function normaliseRivals(data, day = data.league?.lastDay ?? 0) {
  const fresh = !data.rivals;
  data.rivals ??= { v: 22, clubs: {}, used: [], last: null, popups: [], chain: [], twist: null, ghost: null, track: {} };
  const R = data.rivals;
  R.clubs ??= {};
  R.used ??= [];
  R.popups ??= [];
  R.chain ??= [];
  R.track ??= {};
  R.track.derbyRun ??= 0;
  R.track.bestDerbyRun ??= 0;
  R.track.born ??= null;
  R.track.poached ??= [];
  // a story rival starts once its league is reached (an older save, M21b or before: a little extra for meetings it has had)
  const old = fresh && (day > 0 || (data.league?.clubs && Object.values(data.league.clubs).some((c) => c.meetings > 0)));
  for (const r of STORY_RIVALS) {
    if (!r.club || leagueById(r.league).tier > tierNow(data)) continue;
    const c = (R.clubs[r.club] ??= blank(day));
    if (c.story) continue;
    const rec = data.league?.clubs?.[r.club];
    const extra = old && rec ? Math.min(20, 2 * (rec.w + rec.d + rec.l)) : 0;
    c.story = r.id;
    c.meter = clamp(Math.max(c.meter, r.start + extra));
    c.since = day;
  }
  return R;
}

export function isRival(data, clubId) {
  const c = normaliseRivals(data).clubs[clubId];
  return !!c && (!!c.story || c.dynamic);
}
// The manager who speaks for a club: a story rival's (data/rivals.js), else "the <club> manager".
function speaker(clubId) {
  const r = storyForClub(clubId);
  return r ? { name: r.manager, role: r.role, cast: r.cast ?? null } : { name: `The ${clubById(clubId)?.name ?? 'rival'} manager`, role: 'manager', cast: null };
}
export function info(data, clubId) {
  const R = normaliseRivals(data);
  const c = R.clubs[clubId];
  if (!c || (!c.story && !c.dynamic)) return null;
  const r = c.story ? storyById(c.story) : null;
  const band = bandOf(c.meter);
  return { clubId, id: c.story ?? 'DYN', story: c.story, dynamic: c.dynamic, permanent: c.permanent, meter: c.meter, band, banner: r?.banner ?? 'RIVALS', manager: speaker(clubId), style: r?.style ?? null, identity: r?.identity ?? 'Dynamic rival', formed: c.formed };
}

// (league.previewReward) Heated+: a win pays × winMult; a loss costs `dip` × the tier's momentum loss on top.
export function rewardMods(data, clubId, res) {
  const i = info(data, clubId);
  if (!i || !atLeast(i.meter, EFFECTS.rewardBand)) return { mult: 1, dip: 0 };
  return { mult: res === 'win' ? EFFECTS.winMult : 1, dip: res === 'loss' ? EFFECTS.lossDip : 0 };
}
export function cooldownMult(data, clubId) {
  const i = info(data, clubId);
  return i && atLeast(i.meter, EFFECTS.cooldownBand) ? EFFECTS.cooldownMult : 1;
}

const isFinal = (fixture) => !!fixture?.cup && fixture.cup.round === (cupById(fixture.cup.id)?.rounds.length ?? 0) - 1;
export const isBig = (fixture) => !!fixture?.promotion || isFinal(fixture);
function pick(list, seed) {
  return list[Math.floor(new Rng(seed).next() * list.length)];
}
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

// After one of your competitive matches (league.recordResult; a friendly never comes here). cup: the cup summary (a draw
// won on penalties is a win here). → { clubId, rival, bandBefore, bandAfter, meter, formed, line }
export function afterResult(data, fixture, score, day, cup = null) {
  const R = normaliseRivals(data, day);
  const id = fixture.opponent.id;
  const c = (R.clubs[id] ??= blank(day));
  const rival = !!c.story || c.dynamic;
  const bandBefore = bandOf(c.meter);
  const [us, them] = score;
  const res = us > them || (cup?.won && us === them) ? 'W' : us < them || (cup && !cup.won) ? 'L' : 'D';
  const big = isBig(fixture);
  let d = 0;
  if (rival || big) d += METER.meeting;
  if (big) d += METER.big;
  if (rival && Math.abs(us - them) >= METER.bigMargin) d += METER.bigWin;
  c.meter = clamp(c.meter + d);
  c.lastMet = day;
  c.h2h = [...c.h2h, { day, score: [us, them], res, big }].slice(-10);
  // (SEC-RIVAL-02) a non-story club met in a third final / promotion match with the first two split 1–1
  if (big) {
    if (!c.story && c.bigs.length === 2 && c.bigs.includes('W') && c.bigs.includes('L')) R.track.born ??= id;
    c.bigs = [...c.bigs, res].slice(-10);
  }
  // (SEC-RIVAL-03) rivalry matches won in a row
  if (rival) {
    R.track.derbyRun = res === 'W' ? R.track.derbyRun + 1 : 0;
    R.track.bestDerbyRun = Math.max(R.track.bestDerbyRun, R.track.derbyRun);
  }
  // (the late twist) the formation and build you played, the last TWIST.window competitive matches
  if (data.tactics?.formation) R.used = [...R.used, { f: data.tactics.formation, b: data.tactics.instr?.build ?? 'balanced' }].slice(-TWIST.window);
  R.last = { clubId: id, day, rival, band: bandBefore.id };
  let formed = false;
  if (!c.story && !c.dynamic && c.meter >= METER.dynamicAt) {
    c.dynamic = true;
    c.formed = day;
    formed = true;
    R.popups.push({ kind: 'formed', clubId: id, day });
    const name = clubById(id)?.name ?? id;
    news(data, day, fill(LINES.formed, { club: `The ${name}`.replace('The The', 'The'), us: data.club?.name ?? 'You' }));
    history(data, day, `A new rivalry: ${name}`);
  }
  let line = null;
  if (rival) {
    const sp = speaker(id);
    const list = res === 'W' ? LINES.ourWin : res === 'L' ? LINES.ourLoss : LINES.draw;
    line = fill(pick(list, `${data.seed}:rival:after:${id}:${day}`), { m: sp.name, club: clubById(id)?.name ?? '', us: data.club?.name ?? 'your lot' });
    news(data, day, line, sp.cast);
  }
  return { clubId: id, rival, res, bandBefore: bandBefore.id, bandAfter: bandOf(c.meter).id, meter: c.meter, formed, line };
}

// The rival manager's line before a rivalry match (main.js: on kickoff day, once per fixture).
export function beforeLine(data, fixture) {
  if (!fixture || !isRival(data, fixture.opponent.id)) return null;
  const sp = speaker(fixture.opponent.id);
  return { text: fill(pick(LINES.before, `${data.seed}:rival:before:${fixture.id}`), { m: sp.name, club: clubById(fixture.opponent.id)?.name ?? '', us: data.club?.name ?? 'your lot' }), face: sp.cast };
}
export function preMatchNews(data, fixture, day) {
  const R = normaliseRivals(data, day);
  const l = beforeLine(data, fixture);
  if (!l || R.lastBefore === fixture.id) return l;
  R.lastBefore = fixture.id;
  news(data, day, l.text, l.face);
  return l;
}

// A club's captain: its best player now (the bible gives clubs no captain field; DECISIONS, M22).
export function captainOf(data, clubId) {
  const list = data.transfers?.clubs?.[clubId]?.players ?? [];
  return list.reduce((best, p) => (!best || overall(p) > overall(best) || (overall(p) === overall(best) && (p.age ?? 0) > (best.age ?? 0)) ? p : best), null);
}
// A player signed from a club (kind 'in', called before he leaves it) or sold to one ('out'). A rival: +10. (SEC-RIVAL-04)
// a rival's captain signed after beating that rival 3+ times.
export function noteTransfer(data, clubId, p, kind, day) {
  if (!clubId || !clubById(clubId) || !data.league) return;
  const R = normaliseRivals(data, day);
  if (!isRival(data, clubId)) return;
  const c = R.clubs[clubId];
  c.meter = clamp(c.meter + METER.transfer);
  if (kind === 'in' && captainOf(data, clubId)?.id === p.id && (data.league.clubs?.[clubId]?.w ?? 0) >= 3) R.track.poached = [...R.track.poached, { clubId, name: p.name, day }].slice(-10);
}

// The late twist: on from TWIST.year, once in the Crown Premier.
export const twistOn = (data, day) => yearOf(day) >= TWIST.year && data.league?.tier === TWIST.league;
// Your most-used formation over the last matches → { f, b, share } (null: none used in at least TWIST.share of them).
export function mostUsed(data) {
  const used = normaliseRivals(data).used;
  if (!used.length) return null;
  const n = {};
  for (const u of used) n[u.f] = (n[u.f] ?? 0) + 1;
  const [f, k] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  const builds = {};
  for (const u of used.filter((x) => x.f === f)) builds[u.b] = (builds[u.b] ?? 0) + 1;
  const b = Object.entries(builds).sort((x, y) => y[1] - x[1])[0][0];
  return { f, b, share: k / Math.max(used.length, TWIST.window / 2) };
}
// A Premier club's counter (null when the twist is off, the club isn't a Crown Premier club, you aren't predictable, or it
// is a meeting it doesn't counter you in: every other one). playing: you are playing the formation it prepared for.
export function counterFor(data, clubId, day = data.league?.lastDay ?? 0) {
  if (!data?.league || !twistOn(data, day) || leagueOfClub(clubId)?.id !== TWIST.league) return null;
  const m = mostUsed(data);
  if (!m || m.share < TWIST.share) return null;
  const c = COUNTERS[m.f];
  if (!c || (data.league.clubs?.[clubId]?.meetings ?? 0) % TWIST.every !== 0) return null;
  const { formation, ...instr } = c;
  return { target: m.f, share: m.share, formation, instr, playing: data.tactics?.formation === m.f };
}

// What a fixture's rivalry and the late twist change in the match. → { rival, banner, intensity: [us, them], cardRisk,
// counter (the late twist: their shape is in opponentSide), roar }
export function matchMods(data, fixture, day = data.league?.lastDay ?? 0) {
  const i = fixture ? info(data, fixture.opponent.id) : null;
  const counter = fixture ? counterFor(data, fixture.opponent.id, day) : null;
  const fierce = !!i && atLeast(i.meter, EFFECTS.intensityBand);
  const fever = !!i && fixture.home !== false && data.rivals?.atmosphere != null; // (SEC-RIVAL-03)
  return {
    rival: i,
    banner: i?.banner ?? null,
    intensity: [(fierce ? EFFECTS.intensity : 0) + (fever ? EFFECTS.derbyFever : 0), fierce ? EFFECTS.intensity : 0],
    shared: fierce ? EFFECTS.intensity : 0, // (both sides: the same points, applyMatchMods)
    ours: fever ? EFFECTS.derbyFever : 0, // (your XI only: Derby Fever)
    cardRisk: fierce ? EFFECTS.cardRisk : 0, // (stored for M25)
    counter,
    roar: i ? EFFECTS.crowdRoar : 1,
  };
}
export function applyIntensity(xi, pct) {
  if (!pct) return xi;
  for (const p of xi) for (const k of Object.keys(p.stats ?? {})) p.stats[k] = Math.round(p.stats[k] * (1 + pct));
  return xi;
}
const meanStat = (xi) => {
  const v = xi.flatMap((p) => Object.values(p.stats ?? {}));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};
// Both XIs (yours is home: team 0) for a match with these mods. The shared Fierce+ boost is the same number of points for
// both sides — +3% of the weaker XI's average — because a percentage would give the stronger side more (DECISIONS, M22).
export function applyMatchMods(ours, theirs, m) {
  if (m.shared) {
    const pts = Math.max(1, Math.round(m.shared * Math.min(meanStat(ours), meanStat(theirs))));
    for (const p of [...ours, ...theirs]) for (const k of Object.keys(p.stats ?? {})) p.stats[k] += pts;
  }
  applyIntensity(ours, m.ours);
}

// (verdicts.afterMatch) the Fans voice: a rival result counts by the band it had at kickoff.
export function fansWeight(data, clubId, day) {
  const L = data.rivals?.last;
  if (!L || L.clubId !== clubId || L.day !== day || !L.rival) return 0;
  return BANDS[bandIdx(L.band)]?.fans ?? 1;
}

// One club day (league.leagueDay): story rivals of a newly reached league start, the monthly fade, dynamic rivals that
// cool off, the SEC-RIVAL-04 News chain, the late twist's first warning. → events [{ kind, … }]
export function rivalsDay(data, day) {
  const R = normaliseRivals(data, day);
  const events = [];
  if (day > 0 && day % MONTH === 0) {
    for (const [id, c] of Object.entries(R.clubs)) {
      if (c.meter <= 0 || (c.lastMet != null && day - c.lastMet < MONTH)) continue;
      c.meter = clamp(c.meter + METER.monthly);
      if (c.dynamic && !c.permanent && c.meter < METER.fadeBelow) {
        c.dynamic = false;
        news(data, day, fill(LINES.faded, { club: clubById(id)?.name ?? id }));
        events.push({ kind: 'faded', clubId: id });
      }
    }
  }
  for (const n of R.chain.filter((x) => x.day <= day)) news(data, n.day, n.text, n.face);
  R.chain = R.chain.filter((x) => x.day > day);
  if (R.twist == null && twistOn(data, day)) {
    R.twist = day;
    news(data, day, TWIST.newsLine);
    R.popups.push({ kind: 'twist', day });
    events.push({ kind: 'twist' });
  }
  return events;
}

// (SEC-RIVAL-02 / 03 / 04 prizes, from the secret checker)
export function secretPrize(data, kind, day) {
  const R = normaliseRivals(data, day);
  if (kind === 'permanent') {
    const id = R.track.born;
    const c = id && R.clubs[id];
    if (c) {
      c.dynamic = true;
      c.permanent = true;
      c.formed ??= day;
      history(data, day, `Rivalry Born: the rivalry with ${clubById(id)?.name ?? id} is for good`);
      return id;
    }
  } else if (kind === 'atmosphere') {
    R.atmosphere ??= day;
  } else if (kind === 'newsChain') {
    const p = R.track.poached.slice(-1)[0];
    if (p) {
      const sp = speaker(p.clubId);
      const o = { p: p.name, club: clubById(p.clubId)?.name ?? '', us: data.club?.name ?? 'your club', m: sp.name };
      R.chain = [...R.chain, ...POACH_CHAIN.map((x) => ({ day: day + x.after, text: fill(x.text, o), face: x.text.includes('{m}') ? sp.cast : null }))];
    }
  }
  return null;
}
// The SEC-RIVAL measures (secrets.js MEASURES)
export const measures = {
  rivalryBorn: (data) => (normaliseRivals(data).track.born ? 1 : 0),
  derbyRun: (data) => normaliseRivals(data).track.bestDerbyRun,
  poachedCaptain: (data) => normaliseRivals(data).track.poached.length,
};

// The queued one-tap pop-ups (main.js shows one at a time, when the club is free).
export const popups = (data) => normaliseRivals(data).popups;
export function takePopup(data) {
  const R = normaliseRivals(data);
  return R.popups.shift() ?? null;
}

// RV08 Ghost Eleven's plan (data only until SEC-RIVAL-01, M28): your most-used formation, and the build that counters
// your style.
const BUILD_COUNTER = { possession: 'counter', counter: 'possession', direct: 'possession', balanced: 'direct' };
export function ghostSide(data) {
  const m = mostUsed(data) ?? { f: data.tactics?.formation ?? '442', b: data.tactics?.instr?.build ?? 'balanced' };
  return { formation: m.f, build: BUILD_COUNTER[m.b] ?? 'balanced' };
}
export function unlockGhost(data, day) {
  normaliseRivals(data, day).ghost ??= day;
}

// The Rivals screen: each rival (story ones in order, then dynamic ones), its meter, band, head-to-head and last five.
export function rivalsList(data) {
  const R = normaliseRivals(data);
  const rows = [];
  const row = (id, c, r) => {
    const rec = data.league?.clubs?.[id] ?? { w: 0, d: 0, l: 0 };
    return { clubId: id, rv: r?.id ?? null, name: clubById(id)?.name ?? id, crest: clubById(id)?.crest ?? 'ui_19', meter: c.meter, band: bandOf(c.meter), h2h: { w: rec.w, d: rec.d, l: rec.l }, last5: c.h2h.slice(-5).map((x) => x.res), style: r?.style ?? 'Dynamic rival: born of big matches', identity: r?.identity ?? (c.permanent ? 'Rivalry for good' : 'Dynamic rival'), manager: speaker(id).name, dynamic: c.dynamic, permanent: c.permanent };
  };
  for (const r of STORY_RIVALS.filter((x) => x.club)) if (R.clubs[r.club]?.story) rows.push(row(r.club, R.clubs[r.club], r));
  for (const [id, c] of Object.entries(R.clubs)) if (!c.story && c.dynamic) rows.push(row(id, c, null));
  const ghost = storyById('RV08');
  return { rows, ghost: { ...ghost, unlocked: R.ghost != null, plan: R.ghost != null ? ghostSide(data) : null }, upcoming: STORY_RIVALS.filter((r) => r.club && !R.clubs[r.club]?.story).map((r) => ({ rv: r.id, league: leagueById(r.league).name })) };
}
