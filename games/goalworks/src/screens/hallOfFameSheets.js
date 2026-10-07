// The Hall of Fame sheets (Milestone 16, bible §10 / §33 / §36; style guide §3 bottom sheets). From the Club Menu.
//   Hall of Fame — every Hall of Famer in the account save (this club's first, then the other clubs you have run: they
//     survive new games), this season's retirements ("Last season"), the club records, and the club's other retired
//     players. The picture is the legend shirt display (trophy_18); every legend wears the plaque badge (trophy_17).
//   Legend card — portrait (a Founder's art) or the code-drawn silhouette in his club's colours, the plaque, why he is in,
//     years at the club, career totals, his best overall and his stats when he retired, staff-conversion eligibility.
//   createHallOfFameSheets({ sheet, assets, entries, run }) → { openHallOfFame(), openEntry(uid), hofMenu() }
import { THEME } from '../../../../core/Theme.js';
import { POSITIONS } from '../../data/setup.js';
import { CORE, CORE_NAMES } from '../../data/players.js';
import { CAREER_TEXT, RECORD_KEYS } from '../../data/careers.js';
import { silhouetteKey } from '../ui/kitArt.js';

const C = THEME.color;
const PLAQUE = 'trophy_17';
const SHIRTS = 'trophy_18';

export function createHallOfFameSheets({ sheet, assets, entries = () => [], run = () => null }) {
  const face = (e) => (e.founder && e.portrait ? e.portrait : silhouetteKey(assets, e.colours?.primary ?? 'green', e.colours?.secondary ?? 'white'));
  const years = (e) => (e.joinedYear === e.retiredYear ? `Year ${e.retiredYear}` : `Years ${e.joinedYear}–${e.retiredYear}`);
  const totals = (e) => `${e.apps} apps · ${e.goals} goals · ${e.assists} assists${e.position === 'GK' || e.position === 'DF' ? ` · ${e.cleanSheets} clean sheets` : ''}`;
  const legendButton = (e) => ({ id: `hof:${e.uid}`, label: e.name, sub: `${e.position} · ${e.club} · ${years(e)} · ${totals(e)}`, icon: face(e), iconBadge: PLAQUE, accent: POSITIONS[e.position]?.colour ?? C.gold, onTap: () => openEntry(e.uid) });

  function hofMenu() {
    const d = run();
    const all = entries() ?? [];
    const mine = d ? all.filter((e) => e.uid.startsWith(`${d.seed}:`)) : [];
    const others = all.filter((e) => !mine.includes(e));
    const sections = [];
    if (!all.length) sections.push({ title: 'No legends yet', lines: [CAREER_TEXT.hofEmpty] });
    if (mine.length) sections.push({ title: `${d.club?.name ?? 'This club'} · ${mine.length} legend${mine.length === 1 ? '' : 's'}`, columns: 1, buttons: mine.slice().reverse().map(legendButton) });
    if (others.length) sections.push({ title: `Your other clubs · ${others.length}`, lines: ['Kept in your account: they stay here whatever happens to their club’s slot.'], columns: 1, buttons: others.slice().reverse().map(legendButton) });
    if (d) {
      const leaving = d.squad.players.filter((p) => p.retiring);
      if (leaving.length) sections.push({ title: 'Last season', lines: leaving.map((p) => `${p.name} (${p.position}, ${p.age}) retires at the end of the season · ${p.career?.apps ?? 0} apps`) });
      const R = d.careers?.records ?? {};
      sections.push({ title: 'Club records', lines: RECORD_KEYS.map(({ key, name }) => (R[key] ? `${name}: ${R[key].value} · ${R[key].name}` : `${name}: nobody yet`)) });
      const retired = (d.careers?.retired ?? []).filter((e) => !e.hof);
      if (retired.length) sections.push({ title: 'Retired from the club', lines: retired.slice(-6).reverse().map((e) => `${e.name} (${e.position}) · ${years(e)} · ${totals(e)}${e.staffEligible ? ' · could join the staff one day' : ''}`) });
    }
    return { title: CAREER_TEXT.hofTitle, subtitle: CAREER_TEXT.hofSubtitle, art: SHIRTS, accent: C.gold, sections };
  }
  function openHallOfFame() {
    sheet.open(() => hofMenu());
  }

  function entryMenu(uid) {
    const e = (entries() ?? []).find((x) => x.uid === uid);
    if (!e) return { title: 'Not found', subtitle: '', art: SHIRTS, sections: [{ columns: 1, buttons: [{ id: 'back', label: '‹ Hall of Fame', accent: C.progress, onTap: () => openHallOfFame() }] }] };
    const pos = POSITIONS[e.position];
    return {
      title: e.name,
      subtitle: `${pos?.name ?? e.position} · ${e.club} · ${years(e)}`,
      art: face(e),
      badge: PLAQUE,
      accent: pos?.colour ?? C.gold,
      tag: { text: 'HALL OF FAME', color: C.gold },
      sections: [
        { title: 'Why he is here', lines: e.reasons },
        { title: 'At the club', lines: [`${years(e)} · retired at ${e.age}${e.founder ? ' · the club’s Founder' : ''}`, totals(e), `Best overall ${e.peak} · ${e.tier} · ${e.trait}`] },
        { title: 'When he retired', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: e.stats?.[k] ?? 0, max: 100, color: pos?.colour ?? C.gold })) },
        ...(e.staffEligible ? [{ title: 'After football', lines: ['Eligible to join a club’s support staff one day (later).'] }] : []),
        { columns: 1, buttons: [{ id: 'back', label: '‹ Hall of Fame', accent: C.progress, onTap: () => openHallOfFame() }] },
      ],
    };
  }
  function openEntry(uid) {
    sheet.open(() => entryMenu(uid));
  }

  return { openHallOfFame, openEntry, hofMenu, entryMenu };
}

