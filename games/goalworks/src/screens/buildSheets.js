// Build Mode's sheets (Milestone 12, bible §27): the Shop and the Facility Detail sheet. Builders for core/ui/BottomSheet,
// re-read every frame, so Credits and the Club Rank are always current.
//   shopSheet({ layout, credits, rank, onPick }) → menu builder   (every facility normal play can see — F34 / F35 never —
//                                                                 by unlock tier: open ones with cost and effect; locked
//                                                                 ones greyed with the reason; built ones marked)
//   detailSheet(station, api) → menu                           (picture, name, what it's for + its main action, effect,
//                                                                 level / Upgrade (M12c), who is using it, Move / Sell)
//   api: { now, users, onMove, onSell, canSell, extra, level (layout.levelInfo), onUpgrade, upgradeMsg }
import { THEME } from '../../../../core/Theme.js';
import { STAGES, LEVELS } from '../../data/facilities.js';
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

// (M12c) The Upgrade section: the level now, what the next level costs, needs and gives; Upgrade pays now and finishes on
// the calendar (the facility works at its old level meanwhile).
function upgradeSection(def, info, api) {
  if (!info) return null;
  const lines = [{ text: `Level ${info.level} of ${info.max}${info.max > 1 ? ` · its effect ×${info.mult}` : ''}`, color: C.actionDark }];
  if (info.pending) lines.push({ text: `Upgrading to level ${info.pending.to}: ready on day ${info.pending.doneDay}. It works at level ${info.level} until then.`, color: C.progress });
  if (info.invested) lines.push({ text: `Spent on upgrades: ${fmt(info.invested)} Credits (half comes back if it is sold)`, color: C.textMuted });
  if (api.upgradeMsg) lines.push({ text: api.upgradeMsg, color: C.bad });
  const nx = info.next;
  if (nx) {
    const better = effectLines(def.id, nx.level).filter((e) => e.live).map((e) => e.text);
    if (better.length) lines.push({ text: `At level ${nx.level}: ${better.join(' · ')}`, color: C.textMuted });
  }
  const buttons = nx && !info.pending
    ? [{ id: 'fac:upgrade', label: `Upgrade to level ${nx.level}`, sub: info.block ?? `${fmt(nx.cost)} Credits · ${nx.days} days${nx.rank ? ` · needs Rank ${nx.rank}` : ''}`, disabled: !!info.block, accent: C.action, onTap: api.onUpgrade }]
    : [];
  return { title: 'Level', lines, columns: 1, buttons };
}

export function detailSheet(st, api) {
  const def = st.def;
  const unlock = def.unlock === 'start' ? 'A starting facility' : `Unlocked at Club Rank ${def.unlock}`;
  const level = api.level?.level ?? 1;
  const eff = effectLines(def.id, level);
  const sell = api.canSell;
  return {
    title: def.name,
    subtitle: def.effect,
    art: def.art,
    accent: C.progress,
    tag: { text: def.role.toUpperCase() },
    sections: [
      ...api.extra, // (M12b) what it's for and its main action, first
      { title: 'Effect', lines: eff.map((e) => (e.live ? `✓ ${e.text}` : e.text)) },
      ...[upgradeSection(def, api.level, api)].filter(Boolean),
      { title: 'About', lines: [`${unlock} · ${def.w}×${def.h} tiles · built for ${fmt(def.cost)} Credits`] },
      { title: 'Now', lines: [api.now, api.users.length ? `Using it: ${api.users.slice(0, 8).join(', ')}${api.users.length > 8 ? ` and ${api.users.length - 8} more` : ''}` : 'Nobody is using it right now.'] },
      {
        title: 'Build',
        lines: sell.ok ? [`Sell it for ${fmt(sell.refund)} Credits (half of everything spent on it).`] : [sell.reason],
        buttons: [
          { id: 'fac:move', label: 'Move', accent: C.action, onTap: api.onMove },
          { id: 'fac:sell', label: sell.ok ? `Sell +${fmt(sell.refund)}` : 'Sell', accent: C.bad, disabled: !sell.ok, onTap: api.onSell },
        ],
      },
    ],
  };
}
