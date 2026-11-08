// The Year-25 ending and New Game+ (Milestone 29, bible §3 / §33 / §34).
//   gradeCampaign(data, account) → { parts: [{ id, name, voice, value, score, line, what }], base, bonus: { his05, ng },
//     total, grade, gradeLine }   (each part 0–10 from its measure and data/ending.js steps)
//   endingDay(data, account, day) → events [{ kind: 'ending' }] — on the last day of Year 25, once a run: the grade is kept
//     (data.ending, pending until the ceremony is seen), the account remembers it (account.endings), permanent 2× opens
//     (an NG+1 or later run's ending: 4×), and the next NG+ level opens (account.ngUnlocked). The run carries on (postgame).
//   ngLevel(data) · ngChoices(parent, account, level) → { players (Hall of Famers), staff (ever hired, gods too) }
//   applyNg(data, account, { level, parent, legacyUid, legacyStaff }) — a new run's NG+ set-up: data.ng, the Legacy Player
//     (and Legacy Support Staff from NG+2), the AI clubs a notch stronger. The parent run is never touched.
//   trueEndingDue(data) — SEC-NGP-05 found and its ending not yet seen
import { ENDING, GRADES, PARTS, NG, gradeOf } from '../../data/ending.js';
import { ALL_CUPS } from '../../data/cups.js';
import { FACILITIES } from '../../data/facilities.js';
import { STAGES } from '../../data/stadium.js';
import { ACHIEVEMENT_LIST } from '../../data/achievements.js';
import { BIBLE_SECRETS } from '../../data/secrets60.js';
import { sponsorById } from '../../data/sponsors.js';
import { overall, statCap } from './players.js';
import { normalisePlayer } from './training.js';
import { grant as grantAbility, normaliseAbilities } from './abilities.js';
import { salaryFor } from './squad.js';
import { forceHire } from './staff.js';

const YEAR = 336;
const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
const TIERS = ['regional', 'county', 'national', 'championship', 'premier'];
const NORMAL_FACILITIES = new Set(FACILITIES.filter((f) => f.unlock !== 'secret').map((f) => f.id));
const BIBLE_IDS = new Set(BIBLE_SECRETS.map((s) => s.id));
const ELITE_TIERS = ['Elite', 'Global', 'Secret', 'Secret prestige'];
export const ngLevel = (data) => Math.min(NG.maxLevel, data?.ng?.level ?? 0);

// --- the 8 parts' measures (plain reads of the run save) ------------------------------------------------------------------------
const developedHere = (p) => (p.joinOvr != null ? p.joinOvr < 80 : !p.joinedFrom);
export const PART_MEASURES = {
  // tiers climbed × 2, + 2 for the Crown title (10 = the Crown Premier and its title)
  climb: (d) => Math.max(0, TIERS.indexOf(d.league?.tier ?? 'regional')) * 2 + (d.league?.crownTitle ? 2 : 0),
  // promotions, the Crown title and every competitive cup won (each edition)
  trophies: (d) => ['A10', 'A11', 'A12', 'A13'].filter((id) => d.achievements?.[id]).length + (d.league?.crownTitle ? 1 : 0) + Object.entries(d.cups ?? {}).filter(([id]) => ALL_CUPS[id] && !ALL_CUPS[id].friendly).reduce((n, [, C]) => n + (C?.wins ?? 0), 0),
  // players grown to 80+ at the club (now or when they retired), Hall of Famers twice
  development: (d) => (d.squad?.players ?? []).filter((p) => !p.god && Math.max(p.peak ?? 0, overall(p)) >= 80 && developedHere(p)).length + (d.careers?.retired ?? []).filter((e) => (e.peak ?? 0) >= 80).length + 2 * (d.careers?.retired ?? []).filter((e) => e.hof).length,
  // academy graduates in the squad (×2), each Elite one (×5), the most in one XI (×2)
  academy: (d) => 2 * (d.squad?.players ?? []).filter((p) => p.origin === 'academy').length + 5 * (d.secrets?.track?.m28?.eliteAcademy?.length ?? 0) + 2 * (d.achv?.track?.academyStarters ?? 0),
  // normal facilities owned + their upgrades + 4 per stadium stage built
  facilities: (d) => {
    const pl = (d.facilities?.placement ?? []).filter((p) => NORMAL_FACILITIES.has(p.def));
    const owned = new Set(pl.map((p) => p.def)).size;
    const ups = pl.reduce((n, p) => n + Math.max(0, (d.facilities?.levels?.[p.uid]?.level ?? 1) - 1), 0);
    return owned + ups + 4 * Math.max(0, (d.stadium?.stage ?? 1) - 1);
  },
  finances: (d) => Math.max(0, d.league?.credits ?? 0),
  // Fan Trust + 10 per elite sponsor deal held (now or before)
  fans: (d) => {
    const S = d.sponsors;
    const deals = new Set([...(S?.history ?? []).map((h) => h.id), ...(S?.active ?? []).map((x) => x.id)].filter((id) => ELITE_TIERS.includes(sponsorById(id)?.tier))).size;
    return (d.fans?.trust ?? 0) + 10 * deals;
  },
  // achievements earned in this run + 2 per bible secret found in it
  records: (d) => ACHIEVEMENT_LIST.filter((a) => d.achievements?.[a.id]).length + 2 * Object.entries(d.secrets?.state ?? {}).filter(([id, st]) => BIBLE_IDS.has(id) && st.found != null).length,
};
const band = (score) => (score >= 9 ? 3 : score >= 7 ? 2 : score >= 4 ? 1 : 0);

export function gradeCampaign(data, account = null) {
  const parts = PARTS.map((p) => {
    const value = PART_MEASURES[p.measure](data, account);
    const score = p.steps.filter((s) => value >= s).length;
    return { id: p.id, name: p.name, voice: p.voice, what: p.what, value, score, line: p.lines[band(score)] };
  });
  const base = parts.reduce((n, p) => n + p.score, 0);
  const bonus = { his05: data.secrets?.state?.['SEC-HIS-05']?.found != null ? ENDING.his05Bonus : 0, ng: ENDING.ngBonus * ngLevel(data) };
  const total = base + bonus.his05 + bonus.ng;
  const g = gradeOf(total);
  return { parts, base, bonus, total, grade: g.id, gradeLine: g.line };
}

// --- the ending day -------------------------------------------------------------------------------------------------------------------
export function endingDay(data, account, day) {
  if (day < ENDING.day || data.ending) return [];
  const g = gradeCampaign(data, account);
  const level = ngLevel(data);
  data.ending = { day, year: yearOf(day), ng: level, ...g, pending: true };
  data.clubHistory = [...(data.clubHistory ?? []), { day, year: yearOf(day), text: `Year ${ENDING.year}: the campaign graded ${g.grade} (${g.total} / 80)`, type: 'milestone' }].slice(-120);
  if (account) {
    account.endings = [...(account.endings ?? []), { grade: g.grade, total: g.total, ng: level, club: data.club?.name ?? '', seed: data.seed ?? null }].slice(-50);
    account.speedUnlocks ??= { perm2x: false, perm4x: false };
    account.speedUnlocks.perm2x = true; // (bible §3: completing Year 25 once)
    if (level >= 1) account.speedUnlocks.perm4x = true; // (completing NG+1 once)
    account.ngUnlocked = Math.max(account.ngUnlocked ?? 0, Math.min(NG.maxLevel, level + 1));
  }
  return [{ kind: 'ending', grade: g.grade, total: g.total }];
}
export const endingPending = (data) => !!data?.ending?.pending;
export const trueEndingDue = (data) => data?.secrets?.state?.['SEC-NGP-05']?.found != null && data.trueEnding?.seen == null; // (seen on day 0 counts too)

// --- New Game+ ----------------------------------------------------------------------------------------------------------------------
// The picks for a new NG+ run: Hall of Famers (any club, the account's), and support staff this account has hired (the
// parent run's, and the gods who served as staff).
export function ngChoices(parent, account, level) {
  const players = NG.legacyPlayers[level] ? (account?.hallOfFame ?? []).map((e) => ({ uid: e.uid, name: e.name, position: e.position, tier: e.tier, club: e.club, peak: e.peak ?? null })) : [];
  const ids = new Set([...(parent?.staff?.ever ?? []), ...(parent?.staff?.hired ?? []).map((m) => m.id)]);
  const staff = NG.legacyStaff[level] ? [...ids] : [];
  return { players, staff };
}
export function applyNg(data, account, { level, parent = null, legacyUid = null, legacyStaff = null } = {}) {
  const L = Math.max(1, Math.min(NG.maxLevel, level));
  data.ng = { level: L, parent, legacyPlayer: null, legacyStaff: null, completions: (account?.endings ?? []).filter((e) => e.ng >= NG.maxLevel).length };
  // the Legacy Player: young-ish at a fair level, his signature ability kept
  const e = legacyUid && NG.legacyPlayers[L] ? (account?.hallOfFame ?? []).find((x) => x.uid === legacyUid) : null;
  if (e) {
    const id = `lg${data.squad.nextId++}`;
    const stats = Object.fromEntries(Object.entries(e.stats ?? {}).map(([k, v]) => [k, Math.min(NG.legacy.cap, Math.round(v * NG.legacy.share))]));
    const p = { id, name: e.name, position: e.position, age: NG.legacy.age, tier: e.tier ?? 'Rare', level: 3, trait: e.trait ?? null, stats, form: 0, morale: 60, portrait: e.portrait ?? null, founder: false, featuredId: e.featuredId ?? null, legacy: e.uid, origin: 'legacy' };
    normalisePlayer(p);
    p.contract = { salary: salaryFor(p, 'Star'), years: 4, role: 'Star' };
    p.shirt = null;
    p.joinOvr = overall(p);
    if (e.signature) grantAbility(p, e.signature, { open: true });
    else normaliseAbilities(p);
    data.squad.players.push(p);
    data.ng.legacyPlayer = e.uid;
  }
  // the Legacy Support Staff (NG+2 on)
  if (legacyStaff && NG.legacyStaff[L] && forceHire(data, legacyStaff, 0, 'A familiar face joins the staff from your last club (Legacy Support Staff).')) data.ng.legacyStaff = legacyStaff;
  // the AI clubs a notch stronger (their growth band is NG-aware too: careers.js)
  const lift = NG.aiLift[L];
  for (const c of Object.values(data.transfers?.clubs ?? {})) for (const q of c.players ?? []) for (const k of Object.keys(q.stats)) q.stats[k] = Math.min(statCap(q), Math.round(q.stats[k] * (1 + lift)));
  return data.ng;
}
export { GRADES, PARTS };
