// The Club Store sheets (Milestone 12c, bible addendum §B; style guide §3 bottom sheets). From the Club Menu, the Kit Room
// sheet, the hint line and Player Detail.
//   Club Store — every item the club holds (its framed icon, rarity, the stat it raises), how full the Store is, and
//     where the last items came from. Tap an item →
//   Item — what it does, then every player with the exact gain they'd get (rarity × ×1.5 loved / ×0.5 not keen, held
//     back by the tier cap or the season's item points), best first; Sell back for a few Credits. Tap a player → a confirm
//     box with the gain in full → Give (the item is used up).
//   Give to <player> (from Player Detail) — the same, the other way round: every item with what it would give them.
//   createItemSheets({ sheet, dialog, items, squad, onChange, today }) → { openClubStore(), openItem(uid), openGiveTo(id) }
import { THEME } from '../../../../core/Theme.js';
import { itemIcon } from '../../../../core/ui/ItemArt.js';
import { ITEM_RARITIES, ITEM_RULES, ITEM_SOURCES, groupById, RARITY_ORDER } from '../../data/items.js';
import { itemName, typeById } from '../systems/items.js';
import { CORE_NAMES } from '../../data/players.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');

export function createItemSheets({ sheet, dialog, items, squad, onChange = () => {} }) {
  const ui = { msg: null };
  const sorted = (I) => [...I.inventory].sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || a.type.localeCompare(b.type));
  const statLine = (it) => {
    const t = typeById(it.type);
    const g = groupById(t.group);
    return `+${ITEM_RARITIES[it.rarity].gain} ${t.stat} · ${g.name}${g.keepersOnly ? ' (keepers only)' : ''}`;
  };
  // The gain in words: 'ATK 52 → 55 (+3 · loves Attack ×1.5)' or why not.
  const gainText = (pv, g) => {
    if (!pv.ok) return pv.why;
    const why = pv.like === 'love' ? ` · loves ${g.name} ×1.5` : pv.like === 'dislike' ? ` · not keen on ${g.name} ×0.5` : '';
    const held = pv.capped === 'tier' ? ' · held at the tier cap' : pv.capped === 'period' ? ' · held by the season’s item points' : '';
    return `${pv.stat} ${pv.now} → ${pv.now + pv.gain} (+${pv.gain}${why}${held})`;
  };

  function confirmGive(uid, p, back) {
    const I = items();
    const it = I?.sys.get(uid);
    if (!it) return;
    const g = groupById(typeById(it.type).group);
    const pv = I.preview(uid, p.id);
    if (!pv.ok) {
      ui.msg = `${p.name}: ${pv.why}`;
      return;
    }
    dialog.confirm({
      title: `Give ${itemName(it)} to ${p.name}?`,
      body: `${CORE_NAMES[pv.stat] ?? pv.stat}: ${gainText(pv, g)}.${pv.like === 'love' ? ` ${p.name.split(' ')[0]} loves it: morale +${ITEM_RULES.loveMorale}.` : ''} The item is used up; the gain is for good. ${p.name.split(' ')[0]} has ${I.pointsLeft(p.id) - pv.gain} item point${I.pointsLeft(p.id) - pv.gain === 1 ? '' : 's'} left this season after this.`,
      yes: 'Give',
      onYes: () => {
        const r = I.give(uid, p.id);
        ui.msg = r.ok ? `${p.name} got the ${itemName(it)}: ${r.stat} +${r.gain}.` : r.why;
        if (r.ok) onChange('item:given');
        back();
      },
    });
  }

  function storeMenu() {
    const I = items();
    if (!I) return null;
    const list = sorted(I);
    const sections = [];
    if (ui.msg) sections.push({ title: 'Latest', lines: [ui.msg] });
    sections.push({
      title: `Items · ${I.count} / ${I.max}`,
      lines: list.length ? ['Tap an item to give it to a player (or sell it back).'] : ['No items yet. They come from wins, the player of the match in big games, great training weeks and well-wishers — never from a shop.'],
      columns: 1,
      buttons: list.map((it) => ({ id: `item:${it.uid}`, label: itemName(it), sub: `${statLine(it)} · from ${ITEM_SOURCES[it.source]?.name ?? it.source}`, icon: itemIcon(it.type, it.rarity), accent: ITEM_RARITIES[it.rarity].color, onTap: () => openItem(it.uid) })),
    });
    const log = I.log.slice(-5).reverse();
    if (log.length) sections.push({ title: 'Where they came from', lines: log.map((l) => l.text) });
    sections.push({ title: 'How items work', lines: [`Giving an item raises one core stat for good. A player gets ×1.5 from a group they love (and a morale lift), ×0.5 from one they’re not keen on. At most ${ITEM_RULES.periodCap} item points a player each season, never past their tier cap. The Store holds ${I.max}; a bigger Kit Room holds more.`] });
    return { title: ITEM_RULES.storeName, subtitle: `${I.count} of ${I.max} · earned, never bought`, art: ITEM_RULES.storeIcon, accent: C.gold, sections };
  }

  function itemMenu(uid) {
    const I = items();
    const it = I?.sys.get(uid);
    if (!it) return { title: ITEM_RULES.storeName, subtitle: ui.msg ?? 'Given', accent: C.gold, sections: [{ columns: 1, buttons: [{ id: 'back', label: '‹ Back to the Club Store', accent: C.progress, onTap: () => openClubStore() }] }] };
    const t = typeById(it.type);
    const g = groupById(t.group);
    const rows = (squad() ?? [])
      .map((p) => ({ p, pv: I.preview(uid, p.id) }))
      .sort((a, b) => b.pv.ok - a.pv.ok || (b.pv.gain ?? 0) - (a.pv.gain ?? 0) || a.p.name.localeCompare(b.p.name));
    const value = I.sys.sellValue(uid);
    return {
      title: itemName(it),
      subtitle: statLine(it),
      art: itemIcon(it.type, it.rarity),
      accent: ITEM_RARITIES[it.rarity].color,
      tag: { text: ITEM_RARITIES[it.rarity].name.toUpperCase(), color: ITEM_RARITIES[it.rarity].color },
      sections: [
        ...(ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []),
        { title: 'Give it to', lines: ['The exact gain for each player (loved groups ×1.5).'], columns: 1, buttons: rows.map(({ p, pv }) => ({ id: `give:${p.id}`, label: `${p.name} · ${p.position}`, sub: `${gainText(pv, g)} · ${I.lovesText(p.id)}`, disabled: !pv.ok, accent: pv.like === 'love' ? C.good : C.action, onTap: () => confirmGive(uid, p, () => openClubStore()) })) },
        { columns: 2, buttons: [
          { id: 'item:sell', label: `Sell +${fmt(value)}`, sub: 'Credits back', accent: C.bad, onTap: () => dialog.confirm({ title: `Sell the ${itemName(it)}?`, body: `You get ${fmt(value)} Credits for it.`, yes: 'Sell', danger: true, onYes: () => {
            const v = I.sell(uid);
            ui.msg = v != null ? `Sold the ${itemName(it)} for ${fmt(v)} Credits.` : null;
            onChange('item:sold');
            openClubStore();
          } }) },
          { id: 'back', label: '‹ Club Store', accent: C.progress, onTap: () => openClubStore() },
        ] },
      ],
    };
  }

  function giveToMenu(id) {
    const I = items();
    const p = (squad() ?? []).find((x) => x.id === id);
    if (!I || !p) return null;
    const rows = sorted(I).map((it) => ({ it, g: groupById(typeById(it.type).group), pv: I.preview(it.uid, id) })).sort((a, b) => b.pv.ok - a.pv.ok || (b.pv.gain ?? 0) - (a.pv.gain ?? 0));
    return {
      title: `Give to ${p.name}`,
      subtitle: `${I.lovesText(id)} · ${I.pointsLeft(id)} item points left this season`,
      art: ITEM_RULES.storeIcon,
      accent: C.gold,
      sections: [
        ...(ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []),
        { title: `Club Store · ${I.count} / ${I.max}`, lines: rows.length ? [] : ['The Club Store is empty.'], columns: 1, buttons: rows.map(({ it, g, pv }) => ({ id: `giveitem:${it.uid}`, label: itemName(it), sub: gainText(pv, g), icon: itemIcon(it.type, it.rarity), disabled: !pv.ok, accent: pv.like === 'love' ? C.good : C.action, onTap: () => confirmGive(it.uid, p, () => openGiveTo(id)) })) },
      ],
    };
  }

  function openClubStore() {
    sheet.open(storeMenu);
  }
  function openItem(uid) {
    sheet.open(() => itemMenu(uid));
  }
  function openGiveTo(id) {
    sheet.open(() => giveToMenu(id));
  }
  return {
    openClubStore() {
      ui.msg = null;
      openClubStore();
    },
    openItem(uid) {
      ui.msg = null;
      openItem(uid);
    },
    openGiveTo(id) {
      ui.msg = null;
      openGiveTo(id);
    },
    get message() {
      return ui.msg;
    },
  };
}
