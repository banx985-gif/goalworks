// The Achievements sheets (Milestone 27, bible §31; style guide §3 bottom sheets). From the Club Menu (one tap), each page
// one more tap:
//   Achievements — all 41 (the 40 + A41 Pantheon) in five groups: name, the requirement in plain words, earned (the year
//     and club) or the count so far; a bar each for the counting ones under way. Tap one: its card (reward, progress).
//   Records — the club's records (biggest win, longest unbeaten run, record crowd, sale, signing, goals in a season) and the
//     career records, each with the previous record under it.
//   History — the club's timeline (year, icon, a short line), filterable by type.
//   Trophy cabinet — every trophy won, how many times and the years.
//   createAchievementSheets({ sheet, run, account }) → { openAchievements(), openAchievement(id), openRecords(),
//     openHistory(type), openTrophies() }
import { THEME } from '../../../../core/Theme.js';
import { ACHV_RULES, HISTORY_TYPES, achievementById } from '../../data/achievements.js';
import * as ACH from '../systems/achievements.js';

const C = THEME.color;
const GROUPS = [
  { title: 'Matches', ids: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09', 'A37', 'A38'] },
  { title: 'Promotions and cups', ids: ['A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17', 'A28', 'A40'] },
  { title: 'Players', ids: ['A18', 'A19', 'A20', 'A21', 'A22', 'A23', 'A24', 'A25', 'A26', 'A27', 'A39'] },
  { title: 'The club', ids: ['A29', 'A30', 'A31', 'A32', 'A33'] },
  { title: 'The manager', ids: ['A34', 'A35', 'A36', 'A41'] },
];
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const rewardText = (a) => (a.reward.credits ? `+${fmt(a.reward.credits)} Credits` : `+${a.reward.rep} reputation`);

export function createAchievementSheets({ sheet, run = () => null, account = () => ({}) }) {
  const status = (x) => (x.earned ? `Earned${x.earned.year ? ` · Year ${x.earned.year}` : ''}${x.earned.club && x.earned.club !== run()?.club?.name ? ` · ${x.earned.club}` : ''}` : x.need > 1 ? `${fmt(Math.min(x.value, x.need))} / ${fmt(x.need)}` : 'Not yet');
  function openAchievements() {
    sheet.open(() => {
      const d = run();
      if (!d) return null;
      const all = ACH.list(d, account());
      const byId = Object.fromEntries(all.map((x) => [x.id, x]));
      const got = all.filter((x) => x.earned).length;
      const sections = [
        {
          title: 'More',
          columns: 3,
          buttons: [
            { id: 'ach:records', label: 'Records', icon: 'trophy_17', accent: C.gold, onTap: () => openRecords() },
            { id: 'ach:history', label: 'History', icon: 'ui_29', accent: C.progress, onTap: () => openHistory() },
            { id: 'ach:trophies', label: 'Trophies', icon: 'trophy_09', accent: C.gold, onTap: () => openTrophies() },
          ],
        },
      ];
      for (const g of GROUPS) {
        const xs = g.ids.map((id) => byId[id]).filter(Boolean);
        const going = xs.filter((x) => !x.earned && x.need > 1 && x.value > 0);
        sections.push({
          title: `${g.title} · ${xs.filter((x) => x.earned).length} / ${xs.length}`,
          columns: 1,
          buttons: xs.map((x) => ({ id: `ach:${x.id}`, label: `${x.earned ? '✓ ' : ''}${x.name}`, sub: `${x.line} · ${status(x)}`, icon: x.earned ? 'trophy_09' : ACHV_RULES.icon, accent: x.earned ? C.gold : C.line, onTap: () => openAchievement(x.id) })),
          bars: going.map((x) => ({ label: x.name, value: Math.min(x.value, x.need), max: x.need, color: C.progress, text: `${fmt(Math.min(x.value, x.need))} / ${fmt(x.need)}` })),
        });
      }
      return { title: 'Achievements', subtitle: `${got} of ${all.length} earned · kept for good in every slot`, art: ACHV_RULES.icon, accent: C.gold, sections };
    });
  }
  function openAchievement(id) {
    sheet.open(() => {
      const d = run();
      const a = achievementById(id);
      if (!d || !a) return null;
      const x = ACH.progressOf(d, account(), a);
      return {
        title: a.name,
        subtitle: a.id === 'A41' ? 'A Works series bonus' : a.id,
        art: x.earned ? 'trophy_09' : ACHV_RULES.icon,
        accent: C.gold,
        sections: [
          { title: 'To earn it', lines: [a.line] },
          { title: x.earned ? 'Earned' : 'So far', lines: [status({ ...a, ...x })], bars: a.need > 1 && !x.earned ? [{ label: 'Progress', value: Math.min(x.value, a.need), max: a.need, color: C.progress, text: `${fmt(Math.min(x.value, a.need))} / ${fmt(a.need)}` }] : [] },
          { title: 'Reward', lines: [rewardText(a)] },
          { title: '', columns: 1, buttons: [{ id: 'ach:back', label: 'All achievements', accent: C.progress, onTap: () => openAchievements() }] },
        ],
      };
    });
  }
  function openRecords() {
    sheet.open(() => {
      const d = run();
      if (!d) return null;
      const r = ACH.recordRows(d);
      const rows = (list) => list.flatMap((x) => (x.now ? [`${x.name}: ${x.now.text}${x.now.day ? ` (Year ${Math.floor((x.now.day - 1) / 336) + 1})` : ''}`, ...(x.now.prev ? [{ text: `   previous record: ${x.now.prev.text}`, color: C.textMuted }] : [])] : [{ text: `${x.name}: none yet`, color: C.textMuted }]));
      return {
        title: 'Records',
        subtitle: d.club?.name ?? '',
        art: 'trophy_17',
        accent: C.gold,
        sections: [
          { title: 'Club records', lines: rows(r.club) },
          { title: 'Career records (at the club)', lines: rows(r.careers) },
          { title: '', columns: 1, buttons: [{ id: 'rec:back', label: 'Achievements', accent: C.progress, onTap: () => openAchievements() }] },
        ],
      };
    });
  }
  function openHistory(type = null) {
    sheet.open(() => {
      const d = run();
      if (!d) return null;
      const lines = ACH.historyOf(d, type);
      return {
        title: 'Club history',
        subtitle: type ? HISTORY_TYPES[type].name : `${lines.length} moments`,
        art: 'ui_29',
        accent: C.progress,
        sections: [
          { title: 'Show', columns: 4, buttons: [{ id: 'hist:all', label: 'All', selected: !type, accent: C.progress, onTap: () => openHistory(null) }, ...Object.entries(HISTORY_TYPES).map(([k, t]) => ({ id: `hist:${k}`, label: t.name, selected: type === k, accent: C.progress, onTap: () => openHistory(k) }))] },
          lines.length
            ? { title: 'Timeline', columns: 1, buttons: lines.map((h, i) => ({ id: `histline:${i}`, label: `Year ${h.year}: ${h.text}`, sub: HISTORY_TYPES[h.type]?.name ?? 'Club', icon: HISTORY_TYPES[h.type]?.icon ?? 'ui_29', accent: C.line, onTap: () => {} })) }
            : { title: 'Timeline', lines: ['Nothing here yet.'] },
        ],
      };
    });
  }
  function openTrophies() {
    sheet.open(() => {
      const d = run();
      if (!d) return null;
      const t = ACH.trophies(d);
      return {
        title: 'Trophy cabinet',
        subtitle: t.length ? `${t.reduce((n, x) => n + x.count, 0)} trophies · ${t.length} kinds` : 'Empty for now',
        art: 'trophy_09',
        accent: C.gold,
        sections: [t.length ? { title: 'Won', columns: 1, buttons: t.map((x) => ({ id: `troph:${x.key}`, label: `${x.name} × ${x.count}`, sub: x.years?.length ? `Year${x.years.length === 1 ? '' : 's'} ${x.years.join(', ')}` : 'Won', icon: x.art, accent: C.gold, onTap: () => {} })) } : { title: 'Won', lines: ['Win a promotion, a cup or an award and it goes in here.'] }],
      };
    });
  }
  return { openAchievements, openAchievement, openRecords, openHistory, openTrophies };
}
