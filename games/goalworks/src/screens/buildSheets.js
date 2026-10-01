// Build Mode's sheets (Milestone 12, bible §27): the Shop and the Facility Detail sheet. Builders for core/ui/BottomSheet,
// re-read every frame, so Credits and the Club Rank are always current.
//   shopSheet({ layout, credits, rank, onPick }) → menu builder   (every facility normal play can see — F34 / F35 never —
//                                                                 by unlock tier: open ones with cost and effect; locked
//                                                                 ones greyed with the reason; built ones marked)
//   detailSheet(station, api) → menu                           (picture, name, effect, unlock, who is using it, Move / Sell)
import { THEME } from '../../../../core/Theme.js';
import { STAGES } from '../../data/facilities.js';
import { effectLines } from '../systems/facilities.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const TIERS = [
  { id: 'start', title: 'Starting facilities' },
  { id: 'E', title: 'Club Rank E' },
  { id: 'D', title: 'Club Rank D' },
  { id: 'C', title: 'Club Rank C' },
  { id: 'B', title: 'Club Rank B' },
  { id: 'A', title: 'Club Rank A' },
  { id: 'S', title: 'Club Rank S' },
];

export function shopSheet({ layout, credits, rank, onPick }) {
  return () => {
    const L = layout();
    if (!L) return null;
    const list = L.shop();
    const st = L.stage;
    const next = STAGES[L.stageIndex + 1];
    const sections = [
      {
        lines: [`${fmt(credits())} Credits · Club Rank ${rank()} · ${st.name} (${st.cols}×${st.rows})${next ? ` — the ground grows at Rank ${next.rank}` : ''}`, 'One of each. Selling gives half back.'],
      },
    ];
    for (const t of TIERS) {
      const items = list.filter((x) => x.def.unlock === t.id);
      if (!items.length) continue;
      sections.push({
        title: t.title,
        columns: 1,
        buttons: items.map((x) => ({
          id: `shop:${x.def.id}`,
          label: `${x.def.name}${x.built ? '  ✓ built' : ''}`,
          sub: !x.unlocked ? `${x.reason} · ${x.def.effect}` : x.built ? x.def.effect : `${fmt(x.def.cost)} Credits · ${x.def.effect}${x.canBuy ? '' : ` · ${x.reason}`}`,
          icon: x.def.art,
          locked: !x.unlocked,
          disabled: x.unlocked && !x.canBuy,
          accent: C.action,
          onTap: () => onPick(x.def.id),
        })),
      });
    }
    return { title: 'Facility Shop', subtitle: 'Pick a facility, then place it on the ground.', art: 'facility_f14', accent: C.gold, sections };
  };
}

export function detailSheet(st, api) {
  const def = st.def;
  const unlock = def.unlock === 'start' ? 'A starting facility' : `Unlocked at Club Rank ${def.unlock}`;
  const eff = effectLines(def.id);
  const sell = api.canSell;
  return {
    title: def.name,
    subtitle: def.effect,
    art: def.art,
    accent: C.progress,
    tag: { text: def.role.toUpperCase() },
    sections: [
      { title: 'Effect', lines: eff.map((e) => (e.live ? `✓ ${e.text}` : e.text)) },
      { title: 'Level / unlock', lines: [`Level 1 · ${unlock} · ${def.w}×${def.h} tiles · built for ${fmt(def.cost)} Credits`] },
      { title: 'Now', lines: [api.now, api.users.length ? `Using it: ${api.users.slice(0, 8).join(', ')}${api.users.length > 8 ? ` and ${api.users.length - 8} more` : ''}` : 'Nobody is using it right now.'] },
      ...api.extra,
      {
        title: 'Build',
        lines: sell.ok ? [`Sell it for ${fmt(sell.refund)} Credits (half its price).`] : [sell.reason],
        buttons: [
          { id: 'fac:move', label: 'Move', accent: C.action, onTap: api.onMove },
          { id: 'fac:sell', label: sell.ok ? `Sell +${fmt(sell.refund)}` : 'Sell', accent: C.bad, disabled: !sell.ok, onTap: api.onSell },
        ],
      },
    ],
  };
}
