// The Club Token Shop (Milestone 30, bible §35; style guide §3 bottom sheets). Club Menu → Club Token Shop: the Token
// balance, what Tokens buy (a market refresh, a new sponsor offer, cosmetic trims), the optional rewarded ads, the Token
// packs and Remove Ads with the store's own prices, Restore Purchases, and in plain words what can never be bought.
// The rules are src/systems/monetisation.js; this only draws them and passes the taps on.
//   createShopSheets({ sheet, dialog, mon, onChange(why) }) → { openShop(), menu() }
//   button ids: shop:sink:<sink>, shop:cos:<id>, shop:ad:<placement>, shop:buy:<product>, shop:restore
import { THEME } from '../../../../core/Theme.js';
import { PRODUCTS, PACKS, TOKEN_SINKS, COSMETICS, NEVER_FOR_SALE, SHOP_TEXT, REWARDED } from '../../data/monetisation.js';

const C = THEME.color;

export function createShopSheets({ sheet, dialog, mon, onChange = () => {} }) {
  let storeState = null; // null = not asked yet; { ok, message }
  const ok = [{ id: 'ok', label: 'OK', accent: C.progress }];
  const say = (title, body) => dialog.show({ title, body, buttons: ok });
  function refreshStore() {
    mon.loadProducts().then((r) => {
      storeState = r;
      sheet.refresh?.();
    });
  }
  function sinkButton(sink, label, ctx = {}) {
    const s = TOKEN_SINKS[sink];
    const why = mon.tokenBlock(sink, ctx);
    return {
      id: sink === 'cosmetic' ? `shop:cos:${ctx.id}` : `shop:sink:${sink}`,
      label,
      sub: why ?? `${s.cost} Club Tokens · ${s.line}`,
      accent: C.gold,
      disabled: !!why,
      onTap: () => {
        const r = mon.spend(sink, ctx);
        if (!r.ok) return say(SHOP_TEXT.title, r.reason);
        onChange(`tokens:${sink}`);
        if (sink !== 'cosmetic') say(label, sink === 'marketRefresh' ? 'New faces are on the transfer market and the free-agent list.' : 'Celeste has a new sponsor on the phone: see Finances → Sponsors.');
      },
    };
  }
  function menu() {
    if (storeState === null) refreshStore();
    const sections = [
      { title: `Club Tokens: ${mon.tokens}`, lines: [SHOP_TEXT.subtitle, SHOP_TEXT.earnLine] },
      { title: 'Spend Club Tokens', columns: 2, buttons: [sinkButton('marketRefresh', TOKEN_SINKS.marketRefresh.name), sinkButton('sponsorRefresh', TOKEN_SINKS.sponsorRefresh.name)] },
    ];
    for (const kind of ['plate', 'fence']) {
      const wearing = mon.cosmetic(kind);
      sections.push({
        title: kind === 'plate' ? 'Name plate trims (looks only)' : 'Ground fence rails (looks only)',
        columns: 2,
        buttons: [
          { id: `shop:wear:${kind}:none`, label: `${wearing ? '' : '✓ '}Club colours`, sub: 'The standard look', accent: C.progress, selected: !wearing, onTap: () => (mon.useCosmetic(null, kind), onChange('cosmetic')) },
          ...COSMETICS.filter((c) => c.kind === kind).map((c) =>
            mon.ownsCosmetic(c.id)
              ? { id: `shop:cos:${c.id}`, label: `${wearing?.id === c.id ? '✓ ' : ''}${c.name}`, sub: 'Yours: tap to use it', accent: C.good, selected: wearing?.id === c.id, onTap: () => (mon.useCosmetic(c.id), onChange('cosmetic')) }
              : sinkButton('cosmetic', c.name, { id: c.id }),
          ),
        ],
      });
    }
    sections.push({
      title: 'Free with an ad (optional)',
      columns: 1,
      buttons: REWARDED.map((p) => {
        const pl = mon.placement(p.id);
        return {
          id: `shop:ad:${p.id}`,
          label: pl.label,
          sub: pl.sub,
          accent: C.purple,
          disabled: !pl.ok,
          onTap: async () => {
            const r = await mon.watch(p.id);
            if (r.ok) onChange(`ad:${p.id}`);
            say(r.ok ? 'Thanks for watching' : 'No reward this time', r.message);
          },
        };
      }),
    });
    const storeOk = storeState?.ok;
    const buy = (key) => ({
      id: `shop:buy:${key}`,
      label: PRODUCTS[key].entitlement === 'removeAds' && mon.removeAds ? '✓ Remove Ads (yours)' : PRODUCTS[key].name,
      sub: PRODUCTS[key].entitlement === 'removeAds' ? (mon.removeAds ? 'No full-screen ads, for good. Rewarded ads stay optional.' : `${mon.price(key) ?? '—'} · one time: no more full-screen ads`) : `${mon.price(key) ?? '—'} · ${PRODUCTS[key].grant.tokens} Club Tokens`,
      accent: C.action,
      disabled: !storeOk || (PRODUCTS[key].entitlement === 'removeAds' && mon.removeAds),
      onTap: async () => {
        const r = await mon.buy(key);
        if (r.ok) onChange(`purchase:${key}`);
        say(r.ok ? 'Thank you!' : 'Store', r.message);
      },
    });
    sections.push({ title: 'Buy (optional)', columns: 2, ...(storeOk ? {} : { lines: [storeState === null ? 'Asking the store…' : storeState.message ?? SHOP_TEXT.storeUnavailable] }), buttons: [...PACKS.map(buy), buy('gw_remove_ads'), { id: 'shop:restore', label: 'Restore purchases', sub: 'Remove Ads comes back on a new phone', accent: C.progress, onTap: async () => { const r = await mon.restore(); onChange('restore'); say('Restore purchases', r.message); } }] });
    sections.push({ title: 'Never for sale', lines: [NEVER_FOR_SALE.map((x) => x.name).join(' · ') + '.', SHOP_TEXT.honesty] });
    return { title: SHOP_TEXT.title, subtitle: `${mon.tokens} Club Tokens${mon.removeAds ? ' · ad-free' : ''}`, art: 'ui_24', accent: C.gold, sections };
  }
  function openShop() {
    storeState = null;
    sheet.open(() => menu());
  }
  return { openShop, menu };
}
