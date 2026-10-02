// Items (Milestone 12c, bible addendum §B) on core/ItemSystem: the Club Store (inventory with a size limit), each
// player's likes, giving an item (the exact gain shown first: rarity × ×1.5 loved / ×0.5 not keen, never past the
// player's tier cap or the season's item-point cap), selling one back for a few Credits, and where items come from.
// Only the sources in data/items.js ITEM_SOURCES marked live can add an item (grant() refuses the rest); nothing is ever
// bought. Rolls use a seeded random whose state is saved, so a reload never re-rolls.
//   normaliseItems(data) → data.items { v, sys (core serialize), rng, week, log }  (a new club and an older save start empty)
//   createItems(data, { bus }) → items: inventory · max · grant(source, opts, day) · preview(uid, id) · give(uid, id) ·
//     sell(uid) · likesOf(id) · lovesText(id) · received(id) · pointsLeft(id) · afterWin({ clubId, promotion, xiIds,
//     scorers, day }) · noteTraining(players) · weekEnd(day) · day(day, year) · log
import { ItemSystem } from '../../../../core/ItemSystem.js';
import { Rng } from '../../../../core/Rng.js';
import { ITEM_TYPES, ITEM_RARITIES, ITEM_RULES, ITEM_GROUPS, ITEM_SOURCES, ITEM_DROPS, POSITION_LOVES, TRAIT_LOVES, RARITY_ORDER, groupById } from '../../data/items.js';
import { clubById } from '../../data/fixtures.js';
import { bonus as facilityBonus } from './facilities.js';
import { normaliseLeague } from './league.js';

export function normaliseItems(data) {
  if (!data.items || data.items.v !== 12) data.items = { v: 12, sys: null, rng: null, week: {}, log: [] };
  data.items.week ??= {};
  data.items.log ??= [];
  return data.items;
}

const typeById = (id) => ITEM_TYPES.find((x) => x.id === id) ?? null;
export const itemName = (it) => `${ITEM_RARITIES[it.rarity]?.name ?? ''} ${typeById(it.type)?.name ?? it.type}`.trim();

export function createItems(data, { bus = null } = {}) {
  const D = normaliseItems(data);
  const rng = new Rng(`${data.seed ?? 'club'}:items`);
  if (D.rng != null) rng.state = D.rng;
  const players = () => data.squad?.players ?? [];
  const person = (id) => players().find((p) => p.id === id) ?? null;
  const sys = new ItemSystem({
    types: ITEM_TYPES,
    rarities: ITEM_RARITIES,
    rules: { inventoryMax: ITEM_RULES.inventoryMax, periodCap: ITEM_RULES.periodCap, loveMult: ITEM_RULES.loveMult, dislikeMult: ITEM_RULES.dislikeMult, loveMorale: ITEM_RULES.loveMorale, periodWord: 'this season' },
    rng,
    bus,
    person,
    statOf: (p, stat) => p.stats[stat] ?? 0,
    statCap: (p) => ITEM_RULES.tierCap[p.tier] ?? ITEM_RULES.tierCap.Standard,
    raise: (p, stat, n) => (p.stats[stat] = Math.min(ITEM_RULES.tierCap[p.tier] ?? ITEM_RULES.tierCap.Standard, (p.stats[stat] ?? 0) + n)),
    morale: (p, n) => (p.morale = Math.min(100, Math.round(((p.morale ?? 50) + n) * 10) / 10)),
  });
  sys.load(D.sys);
  const write = () => {
    D.sys = sys.serialize();
    D.rng = rng.state;
  };
  const maxNow = () => ITEM_RULES.inventoryMax + facilityBonus(data, 'storeSize');

  // Likes: a Featured player (the Founder) from position + trait; anyone else rolled once from position (+ maybe trait,
  // maybe another) and saved.
  function ensureLikes() {
    let changed = false;
    for (const p of players()) {
      if (sys.likes[p.id]) continue;
      const pos = POSITION_LOVES[p.position] ?? 'physical';
      const tr = TRAIT_LOVES[p.trait] ?? null;
      let loves = [pos];
      let dislike = null;
      if (p.founder) {
        if (tr && tr !== pos) loves.push(tr);
      } else {
        const r = rng.next();
        if (tr && tr !== pos && r < 0.6) loves.push(tr);
        else if (r > 0.85) {
          const others = ITEM_GROUPS.map((g) => g.id).filter((g) => g !== pos && (g !== 'goalkeeping' || p.position === 'GK'));
          loves.push(others[Math.floor(rng.next() * others.length)]);
        }
        if (rng.next() < ITEM_RULES.dislikeChance) {
          const pool = ITEM_GROUPS.map((g) => g.id).filter((g) => !loves.includes(g) && g !== 'goalkeeping');
          dislike = pool[Math.floor(rng.next() * pool.length)];
        }
      }
      sys.setLikes(p.id, { loves: [...new Set(loves)], dislike });
      changed = true;
    }
    if (changed) write();
  }
  ensureLikes();

  const pickWeighted = (weights) => {
    const w = Object.fromEntries(RARITY_ORDER.map((k) => [k, weights[k] ?? 0]).filter(([, v]) => v > 0));
    return sys.rollRarity(w);
  };
  const note = (entry) => {
    D.log = [...D.log, entry].slice(-30);
  };

  const api = {
    sys,
    get inventory() {
      return sys.inventory;
    },
    get count() {
      return sys.inventory.length;
    },
    get max() {
      return maxNow();
    },
    get log() {
      return D.log;
    },
    ensureLikes,
    likesOf: (id) => sys.likesOf(id),
    lovesText(id) {
      const lk = sys.likesOf(id);
      const names = (ids) => ids.map((g) => groupById(g)?.name ?? g).join(', ');
      return `Loves: ${names(lk.loves) || '—'}${lk.dislike ? ` · Not keen on: ${names([lk.dislike])}` : ''}`;
    },
    received: (id) => sys.received[id] ?? [],
    pointsLeft: (id) => sys.pointsLeft(id),
    // An item from a source (live ones only). opts: { type, group, rarity, weights, note }. → the item, or { refused }
    grant(source, opts = {}, day = 0) {
      const src = ITEM_SOURCES[source];
      if (!src) return { refused: 'Unknown source' };
      if (!src.live && !opts.debug) return { refused: `${src.name}: not yet (${src.waits})` };
      sys.rules.inventoryMax = maxNow();
      const type = opts.type ?? sys.rollType(opts.group ? (t) => t.group === opts.group : null);
      const rarity = opts.rarity ?? pickWeighted(opts.weights ?? Object.fromEntries(RARITY_ORDER.map((k) => [k, ITEM_RARITIES[k].weight])));
      const it = sys.add(type, rarity, source, day);
      if (!it) {
        note({ day, source, text: `${src.name}: the Club Store was full — the item went elsewhere`, full: true });
        write();
        return { refused: 'The Club Store is full' };
      }
      note({ day, source, uid: it.uid, text: `${src.name}${opts.note ? ` (${opts.note})` : ''}: ${itemName(it)}` });
      write();
      return it;
    },
    // The exact gain before giving (keepers only for Goalkeeping items).
    preview(uid, id) {
      const it = sys.get(uid);
      const p = person(id);
      const g = groupById(typeById(it?.type)?.group);
      if (it && p && g?.keepersOnly && p.position !== 'GK') return { ok: false, why: 'Keepers only', stat: g.stat, gain: 0 };
      return sys.preview(uid, id);
    },
    give(uid, id) {
      const pv = api.preview(uid, id);
      if (!pv.ok) return pv;
      const r = sys.give(uid, id);
      write();
      return r;
    },
    // Sold back: the Credits go to the club. → Credits gained (null if no such item)
    sell(uid) {
      const v = sys.sell(uid);
      if (v == null) return null;
      const L = normaliseLeague(data);
      L.credits = Math.round(L.credits + v);
      write();
      return v;
    },
    // After a league win: a chance of an item (better against stronger clubs), and in a big game the player of the
    // match's item. → [items]
    afterWin({ clubId, promotion = false, xiIds = [], scorers = [], ourName = '', day = 0 }) {
      const out = [];
      const st = clubById(clubId)?.strength ?? 1;
      const W = ITEM_DROPS.win;
      const k = Math.max(0, Math.min(1, (st - W.strength[0]) / (W.strength[1] - W.strength[0])));
      if (rng.next() < W.chance[0] + (W.chance[1] - W.chance[0]) * k) {
        const weights = Object.fromEntries(RARITY_ORDER.map((r) => [r, W.weights.weak[r] + (W.weights.strong[r] - W.weights.weak[r]) * k]));
        const it = api.grant('win', { weights, note: `vs ${clubById(clubId)?.name ?? clubId}` }, day);
        if (!it.refused) out.push(it);
      }
      if (promotion || st >= ITEM_DROPS.potm.bigStrength) {
        const potm = playerOfTheMatch(xiIds, scorers, ourName);
        const it = api.grant('potm', { weights: ITEM_DROPS.potm.weights, note: potm?.name ?? 'the team' }, day);
        if (!it.refused) out.push(it);
      }
      return out;
    },
    // Each club day's training (from trainDay): the week's effort per player.
    noteTraining(list = []) {
      for (const x of list) if (x.xp > 0) D.week[x.id] = Math.round(((D.week[x.id] ?? 0) + x.xp) * 10) / 10;
    },
    // The end of a club week: the best session of the week may earn an item. → the item or null
    weekEnd(day = 0) {
      const best = Object.entries(D.week).sort((a, b) => b[1] - a[1])[0];
      D.week = {};
      let it = null;
      if (best && best[1] >= ITEM_DROPS.training.minXp && rng.next() < ITEM_DROPS.training.chance) {
        const p = person(best[0]);
        const r = api.grant('training', { weights: ITEM_DROPS.training.weights, note: p ? `${p.name}’s week` : 'the week' }, day);
        it = r.refused ? null : r;
      }
      write();
      return it;
    },
    // Each club day: the season's points start again in a new season; now and then a well-wisher. → the item or null
    day(day, season) {
      sys.newPeriod(`S${season}`);
      ensureLikes();
      let it = null;
      if (rng.next() < ITEM_DROPS.wellwisher.perDay) {
        const givers = ITEM_DROPS.wellwisher.givers;
        const r = api.grant('wellwisher', { weights: ITEM_DROPS.wellwisher.weights, note: givers[Math.floor(rng.next() * givers.length)] }, day);
        it = r.refused ? null : r;
      }
      write();
      return it;
    },
  };

  function playerOfTheMatch(xiIds, scorers, ourName) {
    const goals = new Map();
    for (const s of scorers) if (s.team === 0 && !s.own) goals.set(s.name, (goals.get(s.name) ?? 0) + 1);
    const top = [...goals.entries()].sort((a, b) => b[1] - a[1])[0];
    const xi = xiIds.map(person).filter(Boolean);
    if (top) return xi.find((p) => p.name === top[0]) ?? { name: top[0] };
    return xi.sort((a, b) => (b.form ?? 0) - (a.form ?? 0))[0] ?? null;
  }

  return api;
}

export { ITEM_TYPES, ITEM_RARITIES, ITEM_RULES, ITEM_GROUPS, ITEM_SOURCES, typeById };
