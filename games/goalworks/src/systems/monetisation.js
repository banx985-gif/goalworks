// GOALWORKS monetisation (Milestone 30, bible §35, series money rule 9): core/CommerceService, core/EntitlementService and
// core/AdService set up with data/monetisation.js, like BOTWORKS / CAREWORKS. One for the whole app (main.js); the open
// club is read through club() each time. No real store or ad network on the web: with no provider the store says it is
// unavailable and no ad ever shows; ?debug=1 passes core/FakeStoreProvider; the Android build passes PlayBillingProvider.
//
// Everything lives in the account save (bible §36): account.clubTokens and account.monetisation = { removeAds, processed,
// earned, ads, firstCompetitive, cosmetics: { owned, plate, fence } }. The club's own half is only data.monetisation =
// { ads } (rewarded ads used this game month).
//
//   createMonetisation({ bus, now, account(), club(), commit() }) → m
//     account() → the account object (main.js keeps it); club() → { data, today } of the open club, or null
//     commit() → Promise: the account saved (a purchase is granted, saved, then finished with the store)
//   m.setProvider(p) · await m.startup() (re-delivered purchases, a quiet store check)
//   m.tokens · m.removeAds · m.adFree · m.ownsCosmetic(id) · m.cosmetic(kind) → the trim in use, or null
//   m.earn(kind, key) → tokens given (0 if this key was paid before) — kinds: data EARN
//   m.tokenBlock(sink, ctx) · m.spend(sink, ctx) → { ok, reason }   sinks: marketRefresh · sponsorRefresh · cosmetic { id }
//   m.useCosmetic(id | null, kind)
//   m.placement(id) → { show, ok, label, sub } · await m.watch(id) → { ok, message }
//   await m.buy(key) / m.restore() / m.loadProducts() → the core results (plain messages)
//   m.interstitialBlock(ctx) · await m.afterResult({ competitive, decisionPending })  the only interstitial door
// Idempotency: a purchase is keyed by its store transaction id (CommerceService + EntitlementService, kept in the account),
// an earned grant by its key; a cancelled, failed or offline ad or purchase changes nothing. Nothing in the game rules reads
// this file: no src/systems file imports it (tests/goalworks/m30.test.mjs).
import { EntitlementService } from '../../../../core/EntitlementService.js';
import { AdService } from '../../../../core/AdService.js';
import { CommerceService } from '../../../../core/CommerceService.js';
import { PRODUCTS, EARN, TOKEN_SINKS, COSMETICS, cosmeticById, REWARDED, REWARDED_BY_ID, INTERSTITIAL_CAPS, STORE_MESSAGES, SHOP_TEXT } from '../../data/monetisation.js';
import { convenienceRefresh } from './transfers.js';
import { canRefreshOffer, refreshOffer } from './sponsors.js';

const HOUR = 3600 * 1000;
const KEEP_EARNED = 4000;
const MONTH = 28;

export const blankBlock = () => ({ removeAds: false, processed: [], earned: [], ads: null, firstCompetitive: false, cosmetics: { owned: [], plate: null, fence: null } });

export function normaliseBlock(acc) {
  const b = (acc.monetisation ??= blankBlock());
  b.processed ??= [];
  b.earned ??= [];
  b.cosmetics ??= { owned: [], plate: null, fence: null };
  b.cosmetics.owned ??= [];
  acc.clubTokens ??= 0;
  return b;
}

export function createMonetisation({ bus = null, now = () => Date.now(), account = () => ({}), club = () => null, commit = async () => {} } = {}) {
  const acc = () => account() ?? {};
  const block = () => normaliseBlock(acc());
  const entitlements = new EntitlementService({ now, bus });
  // the account's processed transaction ids and Remove Ads, kept in step with the account object (it is replaced on load)
  let loadedFor = null;
  function sync() {
    const a = acc();
    if (loadedFor === a) return;
    loadedFor = a;
    const b = block();
    entitlements.load({ removeAds: b.removeAds });
    entitlements.loadProcessed(b.processed);
    ads.loadAccount(b.ads);
    b.ads ??= ads.serializeAccount(); // (when this install was first seen: kept from now on)
  }
  function writeBack() {
    const b = block();
    b.removeAds = entitlements.removeAds;
    b.processed = entitlements.serializeProcessed();
    b.ads = ads.serializeAccount();
  }
  const ads = new AdService({ caps: INTERSTITIAL_CAPS, placements: REWARDED, now, adFree: () => entitlements.adFree(), bus });
  const commerce = new CommerceService({
    products: PRODUCTS,
    entitlements,
    grant: (p) => addTokens(p.grant?.tokens ?? 0),
    commit: async () => {
      writeBack();
      await commit();
    },
    messages: STORE_MESSAGES,
    now,
    bus,
  });
  bus?.on?.('commerce:purchased', () => ads.notePurchase());

  function addTokens(n) {
    const a = acc();
    normaliseBlock(a);
    a.clubTokens = Math.max(0, Math.round(a.clubTokens + n));
    return n;
  }

  // --- earned in play -------------------------------------------------------------------------------------------------
  function earn(kind, key) {
    sync();
    const n = EARN[kind] ?? 0;
    if (!n || !key) return 0;
    const b = block();
    const k = `${kind}:${key}`;
    if (b.earned.includes(k)) return 0;
    b.earned.push(k);
    if (b.earned.length > KEEP_EARNED) b.earned.splice(0, b.earned.length - KEEP_EARNED);
    addTokens(n);
    bus?.emit?.('tokens:earned', { kind, key, n });
    return n;
  }

  // --- spending (the only things Club Tokens buy) ---------------------------------------------------------------------
  function sinkTarget(sink, ctx = {}) {
    const c = club();
    if (sink === 'marketRefresh') return c?.data?.transfers ? null : SHOP_TEXT.noClub;
    if (sink === 'sponsorRefresh') {
      if (!c?.data) return SHOP_TEXT.noClub;
      return canRefreshOffer(c.data, c.today) ? null : 'No other sponsor to call yet';
    }
    if (sink === 'cosmetic') {
      const cm = cosmeticById(ctx.id);
      if (!cm) return 'Not a cosmetic';
      return ownsCosmetic(cm.id) ? 'Already yours' : null;
    }
    return 'Club Tokens can’t buy that';
  }
  function tokenBlock(sink, ctx = {}) {
    const s = TOKEN_SINKS[sink];
    if (!s) return 'Club Tokens can’t buy that';
    const why = sinkTarget(sink, ctx);
    if (why) return why;
    if ((acc().clubTokens ?? 0) < s.cost) return `Needs ${s.cost} Club Tokens`;
    return null;
  }
  function apply(sink, ctx = {}) {
    const c = club();
    if (sink === 'marketRefresh') return convenienceRefresh(c.data, c.today);
    if (sink === 'sponsorRefresh') return refreshOffer(c.data, c.today);
    if (sink === 'cosmetic') {
      const b = block();
      b.cosmetics.owned.push(ctx.id);
      b.cosmetics[cosmeticById(ctx.id).kind] = ctx.id; // worn straight away
      return true;
    }
    return null;
  }
  function spend(sink, ctx = {}) {
    sync();
    const why = tokenBlock(sink, ctx);
    if (why) return { ok: false, reason: why };
    apply(sink, ctx);
    addTokens(-TOKEN_SINKS[sink].cost);
    bus?.emit?.('tokens:spent', { sink, cost: TOKEN_SINKS[sink].cost });
    return { ok: true, reason: null };
  }

  // --- cosmetics --------------------------------------------------------------------------------------------------------
  const ownsCosmetic = (id) => block().cosmetics.owned.includes(id);
  function useCosmetic(id, kind) {
    const b = block();
    if (id === null) {
      b.cosmetics[kind] = null;
      return { ok: true, reason: null };
    }
    const cm = cosmeticById(id);
    if (!cm || !ownsCosmetic(id)) return { ok: false, reason: 'Not yours yet' };
    b.cosmetics[cm.kind] = id;
    return { ok: true, reason: null };
  }
  const cosmetic = (kind) => cosmeticById(block().cosmetics[kind]) ?? null;

  // --- rewarded ads -------------------------------------------------------------------------------------------------------
  function scopeOf(id) {
    const p = REWARDED_BY_ID[id];
    if (!p || p.limit.per === 'realHours') return null;
    const c = club();
    if (!c?.data) return undefined;
    return `${c.data.seed}:${Math.floor((c.today ?? 0) / MONTH)}`;
  }
  function runAds() {
    const c = club();
    if (!c?.data) return null;
    c.data.monetisation ??= { ads: null };
    return c.data.monetisation;
  }
  function adTarget(id) {
    if (id === 'tokenGift') return null;
    if (id === 'marketRefresh') return sinkTarget('marketRefresh');
    if (id === 'sponsorRefresh') return sinkTarget('sponsorRefresh');
    return 'unknown';
  }
  function usedText(p) {
    if (p.limit.per !== 'realHours') return 'Used this month';
    const at = ads.nextFreeAt(p.id);
    const h = at ? Math.max(1, Math.ceil((at - now()) / HOUR)) : p.limit.hours;
    return `Used today: again in about ${h} hour${h === 1 ? '' : 's'}`;
  }
  function placement(id) {
    sync();
    const p = REWARDED_BY_ID[id];
    if (!p) return { show: false, ok: false, label: '', sub: '' };
    const r = runAds();
    if (r) ads.loadRun(r.ads);
    const why = adTarget(id);
    const scope = scopeOf(id);
    let [ok, sub] = [true, p.blurb];
    if (why) [ok, sub] = [false, why];
    else if (ads.limitBlock(id, scope)) [ok, sub] = [false, usedText(p)];
    else if (ads.showing) [ok, sub] = [false, SHOP_TEXT.adBusy];
    else if (!ads.available) [ok, sub] = [false, SHOP_TEXT.adUnavailable];
    return { show: true, ok, label: `${SHOP_TEXT.adTag}: ${p.name}`, sub };
  }
  async function watch(id) {
    sync();
    const p = REWARDED_BY_ID[id];
    if (!p) return { ok: false, message: 'Unknown ad' };
    const r = runAds();
    if (r) ads.loadRun(r.ads);
    const why = adTarget(id);
    if (why) return { ok: false, message: why };
    const res = await ads.rewarded(id, scopeOf(id), () => {
      if (adTarget(id)) return false;
      if (id === 'tokenGift') return addTokens(p.reward.tokens);
      return apply(id) ?? false;
    });
    if (r) r.ads = ads.serializeRun();
    writeBack();
    if (res.ok) await commit();
    if (res.ok) return { ok: true, message: id === 'tokenGift' ? `+${p.reward.tokens} Club Tokens` : id === 'marketRefresh' ? 'The transfer market has new faces' : 'Celeste has a new sponsor on the phone' };
    const msg = { cancelled: 'The ad was closed early: nothing given, nothing used.', failed: 'The ad did not play: nothing used.', offline: 'No ad to show right now (offline?): nothing used.' }[res.status] ?? (res.reason === 'limit reached' ? usedText(p) : res.reason ?? 'No ad right now');
    return { ok: false, message: msg };
  }

  // --- interstitials: only after a competitive match result, never before the first one is over -----------------------
  function interstitialBlock({ decisionPending = false } = {}) {
    sync();
    if (!block().firstCompetitive) return 'before the first competitive match is over';
    return ads.interstitialBlock('matchResult', { decisionPending });
  }
  // Called at each match result. The first competitive result only marks the account (no ad on that one).
  async function afterResult({ competitive = false, decisionPending = false } = {}) {
    sync();
    const b = block();
    if (!competitive) return { shown: false, reason: 'not a competitive match' };
    if (!b.firstCompetitive) {
      b.firstCompetitive = true;
      await commit();
      return { shown: false, reason: 'the first competitive match' };
    }
    const why = interstitialBlock({ decisionPending });
    if (why) return { shown: false, reason: why };
    const res = await ads.interstitial('matchResult', { decisionPending });
    writeBack();
    if (res.shown) await commit();
    return res;
  }

  const api = {
    commerce,
    ads,
    entitlements,
    PRODUCTS,
    COSMETICS,
    get tokens() {
      return acc().clubTokens ?? 0;
    },
    get removeAds() {
      sync();
      return entitlements.removeAds;
    },
    get adFree() {
      sync();
      return entitlements.adFree();
    },
    get providerId() {
      return commerce.provider?.id ?? 'none';
    },
    setProvider(p) {
      commerce.setProvider(p);
      ads.setProvider(p && typeof p.show === 'function' ? p : null);
    },
    reload() {
      loadedFor = null;
      sync();
    },
    async startup() {
      sync();
      const r = await commerce.processPending();
      await commerce.recheck();
      writeBack();
      await commit();
      return r;
    },
    earn,
    tokenBlock,
    spend,
    ownsCosmetic,
    useCosmetic,
    cosmetic,
    placement,
    watch,
    interstitialBlock,
    afterResult,
    noteResume: () => ads.noteResume(),
    async loadProducts() {
      sync();
      return commerce.loadProducts();
    },
    price: (key) => commerce.price(key),
    async buy(key) {
      sync();
      const r = await commerce.buy(key);
      writeBack();
      return r;
    },
    async restore() {
      sync();
      const r = await commerce.restore();
      writeBack();
      return r;
    },
  };
  return api;
}
