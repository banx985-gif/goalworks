// The Hall of Fame sheets (Milestone 16, bible §10 / §33 / §36; style guide §3 bottom sheets). From the Club Menu.
//   Hall of Fame — every Hall of Famer in the account save (this club's first, then the other clubs you have run: they
//     survive new games), this season's retirements ("Last season"), (M18) the club's history (promotions, cups won), the
//     club records, and the club's other retired players. The picture is the legend shirt display (trophy_18); every legend wears the plaque badge (trophy_17).
//   Legend card — portrait (a Founder's art) or the code-drawn silhouette in his club's colours, the plaque, why he is in,
//     years at the club, career totals, his best overall and his stats when he retired, staff-conversion eligibility.
//   (M20b) Secrets found — each secret found (this run, or any run in the account) with its exact conditions, so a later
//     run knows the recipe.
//   (M21b) Seasons — each Awards Night's Season Review (/40, the four voices, the awards, the league, the cups won) so the
//     player can look back; a season's card one tap more. Great Teams — the account's great seasons (a promotion, a major
//     cup, the Crown title or 34+ / 40) with the XI used most; one tap for the team sheet.
//   createHallOfFameSheets({ sheet, assets, entries, run, secrets, teams }) → { openHallOfFame(), openEntry(uid), hofMenu(),
//     openSeasons(), openSeason(year), openGreatTeams(), openTeam(uid) }
import { THEME } from '../../../../core/Theme.js';
import { POSITIONS } from '../../data/setup.js';
import { CORE, CORE_NAMES } from '../../data/players.js';
import { CAREER_TEXT, RECORD_KEYS } from '../../data/careers.js';
import { silhouetteKey } from '../ui/kitArt.js';
import { VERDICT_TEXT } from '../../data/verdicts.js';
import { leagueById } from '../../data/league.js';
import { cupById } from '../../data/cups.js';

const C = THEME.color;
const PLAQUE = 'trophy_17';
const SHIRTS = 'trophy_18';

export function createHallOfFameSheets({ sheet, assets, entries = () => [], run = () => null, secrets = () => [], teams = () => [] }) {
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
      // (M18) the club's history: promotions and cup wins (the C04 Crown Cup's "club history" prize)
      const H = d.clubHistory ?? [];
      if (H.length) sections.push({ title: 'Club history', lines: H.slice(-8).reverse().map((h) => `Year ${h.year}: ${h.text}`) });
      const R = d.careers?.records ?? {};
      sections.push({ title: 'Club records', lines: RECORD_KEYS.map(({ key, name }) => (R[key] ? `${name}: ${R[key].value} · ${R[key].name}` : `${name}: nobody yet`)) });
      const retired = (d.careers?.retired ?? []).filter((e) => !e.hof);
      if (retired.length) sections.push({ title: 'Retired from the club', lines: retired.slice(-6).reverse().map((e) => `${e.name} (${e.position}) · ${years(e)} · ${totals(e)}${e.staffEligible ? ' · could join the staff one day' : ''}`) });
    }
    // (M21b) the Seasons list and Great Teams, one tap each
    const seasons = d?.verdicts?.seasons ?? [];
    const great = teams() ?? [];
    sections.push({
      title: 'Season verdicts',
      columns: 1,
      buttons: [
        { id: 'seasons', label: `${VERDICT_TEXT.seasons} · ${seasons.length}`, sub: seasons.length ? `Last: Year ${seasons.at(-1).year} · ${seasons.at(-1).total} / 40` : VERDICT_TEXT.seasonsEmpty, icon: 'trophy_13', accent: C.gold, disabled: !d, onTap: () => openSeasons() },
        { id: 'greatTeams', label: `${VERDICT_TEXT.greatTeams} · ${great.length}`, sub: great.length ? `Last: ${great.at(-1).club}, Year ${great.at(-1).year}` : 'No great team yet', icon: SHIRTS, accent: C.gold, onTap: () => openGreatTeams() },
      ],
    });
    const found = secrets() ?? [];
    if (found.length) sections.push({ title: `Secrets found · ${found.length} of 5 Works Gods`, lines: found.map((x) => `${x.godName} (${x.name}): ${x.conditions.join('; ')}`) });
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
        ...(e.honours?.length ? [{ title: 'Honours', lines: e.honours.map((h) => `${h.name} · Year ${h.year}`) }] : []), // (M21b)
        { title: 'At the club', lines: [`${years(e)} · retired at ${e.age}${e.founder ? ' · the club’s Founder' : ''}`, totals(e), `Best overall ${e.peak} · ${e.tier} · ${e.trait}`] },
        { title: 'When he retired', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: e.stats?.[k] ?? 0, max: 99, color: pos?.colour ?? C.gold, star: 140 })) },
        ...(e.staffEligible ? [{ title: 'After football', lines: ['Eligible to join a club’s support staff one day (later).'] }] : []),
        { columns: 1, buttons: [{ id: 'back', label: '‹ Hall of Fame', accent: C.progress, onTap: () => openHallOfFame() }] },
      ],
    };
  }
  function openEntry(uid) {
    sheet.open(() => entryMenu(uid));
  }

  // --- (M21b) Seasons and Great Teams -------------------------------------------------------------------------------------
  const back = (label, fn) => ({ columns: 1, buttons: [{ id: 'back', label, accent: C.progress, onTap: fn }] });
  const recordText = (r) => `${r.p} played · ${r.w} won · ${r.d} drawn · ${r.l} lost · ${r.gf}–${r.ga}`;
  const shortVoice = (v) => `${v.name.replace(/^The |^Your /, '')} ${v.score}`;
  function seasonsMenu() {
    const list = (run()?.verdicts?.seasons ?? []).slice().reverse();
    return {
      title: VERDICT_TEXT.seasons,
      subtitle: 'Each Awards Night’s Season Review · newest first',
      art: 'trophy_13',
      accent: C.gold,
      sections: [
        list.length
          ? { columns: 1, buttons: list.map((x) => ({ id: `season:${x.year}`, label: `Year ${x.year} · ${x.total} / 40${x.great ? ' · Great Team' : ''}`, sub: `${leagueById(x.league)?.name ?? x.league} · ${x.voices.map(shortVoice).join(' · ')}${x.cupsWon.length ? ` · won ${x.cupsWon.map((id) => cupById(id)?.name ?? id).join(', ')}` : ''}`, icon: x.total >= 32 ? 'trophy_13' : 'trophy_17', accent: C.gold, onTap: () => openSeason(x.year) })) }
          : { title: 'No seasons yet', lines: [VERDICT_TEXT.seasonsEmpty] },
        back('‹ Hall of Fame', () => openHallOfFame()),
      ],
    };
  }
  function openSeasons() {
    sheet.open(() => seasonsMenu());
  }
  function seasonMenu(year) {
    const x = (run()?.verdicts?.seasons ?? []).find((y) => y.year === year);
    if (!x) return seasonsMenu();
    return {
      title: `Year ${x.year} · ${x.total} / 40`,
      subtitle: `${leagueById(x.league)?.name ?? x.league} · ${recordText(x.record)}${x.partial ? ' · a short first season' : ''}`,
      art: x.total >= 32 ? 'trophy_13' : 'trophy_17',
      accent: C.gold,
      ...(x.great ? { tag: { text: 'GREAT TEAM', color: C.gold } } : {}),
      sections: [
        { title: 'The Season Review', lines: x.voices.map((v) => `${v.name} (${v.who}) · ${v.score} / 10 — ${v.line}`) },
        { title: 'Awards', lines: x.awards.length ? x.awards.map((a) => `${a.name}: ${a.player} · ${a.detail}`) : ['No awards this season.'] },
        ...(x.honours?.length ? [{ title: 'Honours', lines: x.honours }] : []),
        ...(x.xi?.length ? [{ title: 'The XI used most', lines: x.xi.map((q) => `${q.position} · ${q.name} · OVR ${q.overall} · ${q.apps} apps`) }] : []),
        back('‹ Seasons', () => openSeasons()),
      ],
    };
  }
  function openSeason(year) {
    sheet.open(() => seasonMenu(year));
  }
  const teamFace = (t) => silhouetteKey(assets, t.colours?.primary ?? 'green', t.colours?.secondary ?? 'white');
  function greatTeamsMenu() {
    const list = (teams() ?? []).slice().reverse();
    return {
      title: VERDICT_TEXT.greatTeams,
      subtitle: 'Every club you have run · kept in your account',
      art: SHIRTS,
      accent: C.gold,
      sections: [
        list.length
          ? { columns: 1, buttons: list.map((t) => ({ id: `team:${t.uid}`, label: `${t.club} · Year ${t.year}`, sub: `${leagueById(t.league)?.name ?? t.league} · ${t.total} / 40 · ${t.honours.join(' · ')}`, icon: teamFace(t), iconBadge: PLAQUE, accent: C.gold, onTap: () => openTeam(t.uid) })) }
          : { title: 'No great team yet', lines: [VERDICT_TEXT.greatTeamsEmpty] },
        back('‹ Hall of Fame', () => openHallOfFame()),
      ],
    };
  }
  function openGreatTeams() {
    sheet.open(() => greatTeamsMenu());
  }
  function teamMenu(uid) {
    const t = (teams() ?? []).find((x) => x.uid === uid);
    if (!t) return greatTeamsMenu();
    return {
      title: `${t.club} · Year ${t.year}`,
      subtitle: `${leagueById(t.league)?.name ?? t.league} · Season Review ${t.total} / 40`,
      art: teamFace(t),
      badge: PLAQUE,
      accent: C.gold,
      tag: { text: 'GREAT TEAM', color: C.gold },
      sections: [
        { title: 'Honours', lines: t.honours.length ? t.honours : ['A great season.'] },
        ...(t.record ? [{ title: 'The season', lines: [recordText(t.record)] }] : []),
        { title: 'The XI used most', lines: t.xi.length ? t.xi.map((q) => `${q.position} · ${q.name} · OVR ${q.overall} · ${q.apps} apps`) : ['—'] },
        back('‹ Great Teams', () => openGreatTeams()),
      ],
    };
  }
  function openTeam(uid) {
    sheet.open(() => teamMenu(uid));
  }

  return { openHallOfFame, openEntry, hofMenu, entryMenu, openSeasons, openSeason, seasonsMenu, seasonMenu, openGreatTeams, greatTeamsMenu, openTeam, teamMenu };
}

