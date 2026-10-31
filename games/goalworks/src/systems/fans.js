// Fan Trust (Milestone 23, bible §26): 0–100. It rises with results, youth minutes, derby wins (M22 bands), keeping
// favourites and club history, and falls with losses, selling favourites and derby defeats. It feeds the gate and merch
// (src/systems/finance.js) and the Fans voice (src/systems/verdicts.js); Del Price says a line (a News line, and an event
// for a banner) when it moves into another band. Plain functions over the run save; numbers in data/fans.js.
//   data.fans = { v: 1, trust, band, seasonStart: { year, trust }, log: [{ day, d, why }] }
//   normaliseFans(data)          an older save: 50 ± its results so far (no past moves invented)
//   trust(data) → 0–100          band(data) → FAN_BANDS entry
//   change(data, d, why, day) → events   (fanGrowthPct grows the rises; mediaPct a little more after big moments)
//   afterMatch(data, { fixture, score, xiIds, cup, promoted, crown, youth }, day) → events
//   noteSale(data, p, day) → events      a favourite sold or released
//   isFavourite(data, p)                 fansDay(data, day) → events (the weekly drift to the history level)
import { FAN_TRUST, FAN_BANDS, fanBand } from '../../data/fans.js';
import { cupById } from '../../data/cups.js';
import { leagueOfClub, news } from './league.js';
import { fansWeight } from './rivals.js';
import { effect } from './effects.js';

const YEAR = 336;
const WEEK = 7;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r1 = (v) => Math.round(v * 10) / 10;

function startTrust(data) {
  const clubs = Object.values(data.league?.clubs ?? {});
  const p = clubs.reduce((s, c) => s + (c.w ?? 0) + (c.d ?? 0) + (c.l ?? 0), 0);
  if (!p) return FAN_TRUST.start;
  const w = clubs.reduce((s, c) => s + (c.w ?? 0), 0);
  const l = clubs.reduce((s, c) => s + (c.l ?? 0), 0);
  const cups = Object.values(data.cups ?? {}).reduce((s, C) => s + (C && typeof C === 'object' ? C.wins ?? 0 : 0), 0);
  const o = FAN_TRUST.oldSave;
  return r1(FAN_TRUST.start + clamp(((w - l) / p) * o.spread + cups * o.perCup, -o.clamp, o.clamp));
}

export function normaliseFans(data) {
  if (!data.fans) {
    const t = startTrust(data);
    data.fans = { v: 1, trust: t, band: fanBand(t).id, seasonStart: null, log: [] };
  }
  data.fans.log ??= [];
  return data.fans;
}
export const trust = (data) => (data ? normaliseFans(data).trust : FAN_TRUST.start);
export const band = (data) => fanBand(trust(data));

export function change(data, d, why, day) {
  const F = normaliseFans(data);
  if (!d) return [];
  if (d > 0) d *= 1 + effect(data, 'fanGrowthPct') / 100;
  const before = F.trust;
  F.trust = r1(clamp(F.trust + d, 0, 100));
  const moved = r1(F.trust - before);
  if (moved) F.log = [...F.log, { day, d: moved, why }].slice(-30);
  return bandCheck(data, day);
}

// Favourites: one of the season's three best (Awards Night's list), a Star, or a long-serving player.
export function isFavourite(data, p) {
  if (!p || p.god || p.loan?.from && p.loan.from !== 'us') return false;
  const favs = data.verdicts?.season?.start?.favourites ?? [];
  const years = p.joinedDay != null ? ((data.league?.lastDay ?? 0) - p.joinedDay) / YEAR : 0;
  return favs.includes(p.id) || !!p.star || years >= FAN_TRUST.favouriteYears;
}
export function noteSale(data, p, day) {
  if (!isFavourite(data, p)) return [];
  return change(data, FAN_TRUST.favouriteSold, `${p.name} left the club`, day);
}

export function afterMatch(data, { fixture, score, cup = null, promoted = false, crown = false, youth = 0 }, day) {
  if (fixture?.cup && cupById(fixture.cup.id)?.friendly) return [];
  const R = FAN_TRUST.result;
  const tier = leagueOfClub(fixture.opponent?.id)?.tier ?? 1;
  const k = 1 + (tier - 1) * 0.05; // bigger matches, bigger feelings
  const res = score[0] > score[1] || (cup?.won && score[0] === score[1]) ? 'win' : score[0] < score[1] || (cup && !cup.won) ? 'loss' : 'draw';
  let d = R[res] * k + (res === 'win' && fixture.home ? R.homeWin : 0);
  const fw = fansWeight(data, fixture.opponent?.id, day); // (M22: 0 unless a rival, else the band's weight)
  if (fw) d += (res === 'win' ? FAN_TRUST.derby.win : res === 'loss' ? FAN_TRUST.derby.loss : 0) * fw;
  d += Math.min(FAN_TRUST.youthMax, youth * FAN_TRUST.youth);
  let big = 0;
  if (cup?.champion) big += FAN_TRUST.cupWon;
  if (promoted) big += FAN_TRUST.promoted;
  if (crown) big += FAN_TRUST.crown;
  if (big) big *= 1 + effect(data, 'mediaPct') / 100; // (R34 Media Training: better answers after big moments)
  return change(data, d + big, res === 'win' ? 'A win' : res === 'loss' ? 'A defeat' : 'A draw', day);
}

// The club's history level: what Fan Trust drifts back to (promotions, cups, Crown titles hold it up).
export function historyLevel(data) {
  const H = FAN_TRUST.history;
  const promotions = (data.clubHistory ?? []).filter((h) => /^Promoted to|^Earned promotion/.test(h.text)).length;
  const cups = Object.values(data.cups ?? {}).reduce((s, C) => s + (C && typeof C === 'object' ? C.wins ?? 0 : 0), 0);
  const crowns = (data.clubHistory ?? []).filter((h) => /^CROWN CHAMPIONS/.test(h.text)).length || (data.league?.crownTitle ? 1 : 0);
  return Math.min(H.cap, H.base + promotions * H.perPromotion + cups * H.perCup + crowns * H.perCrown);
}

export function fansDay(data, day) {
  const F = normaliseFans(data);
  const year = Math.floor(day / YEAR) + 1;
  if (F.seasonStart?.year !== year) F.seasonStart = { year, trust: F.trust };
  if (day <= 0 || day % WEEK !== 0) return [];
  const target = historyLevel(data);
  const d = r1((target - F.trust) * FAN_TRUST.drift);
  if (!d) return [];
  F.trust = r1(clamp(F.trust + d, 0, 100)); // (the drift is not a "rise": fanGrowthPct doesn't touch it)
  return bandCheck(data, day);
}
function bandCheck(data, day) {
  const F = data.fans;
  const b = fanBand(F.trust);
  if (b.id === F.band) return [];
  const up = FAN_BANDS.findIndex((x) => x.id === b.id) > FAN_BANDS.findIndex((x) => x.id === F.band);
  F.band = b.id;
  const line = up ? b.up : b.down;
  if (line) news(data, day, `Del Price: “${line}” (Fan Trust ${Math.round(F.trust)} · ${b.name})`, 'del_price');
  return [{ kind: 'fanBand', band: b.id, name: b.name, up, line, trust: F.trust }];
}
export const seasonGain = (data) => r1(trust(data) - (normaliseFans(data).seasonStart?.trust ?? trust(data)));
