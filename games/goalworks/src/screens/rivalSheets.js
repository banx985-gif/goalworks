// The Rivals screen (Milestone 22, bible §23 / §30; style guide §3 bottom sheets). From the Club Menu (Rivals) — a rival's
// card is one tap more. Each rival with its crest, band and meter, the head-to-head record, the last five results and its
// style; dynamic rivals under the story ones; RV08 Ghost Eleven as a "???" row (?debug=1 can unlock the row: its real
// trigger is SEC-RIVAL-01, M28); the story rivals still to meet, by league.
//   createRivalSheets({ sheet, run, debug, onUnlockGhost }) → { openRivals(), openRival(clubId), rivalsMenu() }
import { THEME } from '../../../../core/Theme.js';
import { BANDS, STORY_RIVALS, TWIST } from '../../data/rivals.js';
import * as RIV from '../systems/rivals.js';

const C = THEME.color;
const RES = { W: 'W', D: 'D', L: 'L' };
const form = (last5) => (last5.length ? last5.map((r) => RES[r]).join(' ') : 'none yet');
const h2hText = (h) => `W${h.w} D${h.d} L${h.l}`;

export function createRivalSheets({ sheet, run, debug = false, onUnlockGhost = null }) {
  function rivalsMenu() {
    const d = run();
    if (!d) return null;
    const list = RIV.rivalsList(d);
    const button = (r) => ({
      id: `rival:${r.clubId}`,
      label: `${r.rv ? `${r.rv} · ` : ''}${r.name} · ${r.band.name} ${r.meter}`,
      sub: `H2H ${h2hText(r.h2h)} · last 5: ${form(r.last5)} · ${r.style}`,
      icon: r.crest,
      accent: r.band.colour,
      onTap: () => openRival(r.clubId),
    });
    const story = list.rows.filter((r) => r.rv);
    const dyn = list.rows.filter((r) => !r.rv);
    const sections = [
      { title: 'Story rivals', lines: story.length ? [] : ['No rival yet.'], columns: 1, buttons: story.map(button) },
    ];
    if (dyn.length) sections.push({ title: 'Dynamic rivals', lines: ['Born of big matches: finals and promotion games.'], columns: 1, buttons: dyn.map(button) });
    const g = list.ghost;
    sections.push({
      title: 'Secret',
      columns: 1,
      buttons: [{ id: 'rival:RV08', label: g.unlocked ? `RV08 · ${g.name}` : 'RV08 · ???', sub: g.unlocked ? `${g.style} · plays your ${g.plan.formation.split('').join('-')} with a ${g.plan.build} build · its matches come with the Secret Engine` : 'Nobody has seen them play…', icon: 'ui_28', accent: '#4B4540', locked: !g.unlocked, onTap: () => {} }],
    });
    if (list.upcoming.length) sections.push({ title: 'Still to meet', lines: list.upcoming.map((u) => `${u.rv}: waits in the ${u.league}`) });
    sections.push({ title: 'How rivalry works', lines: [`Meter 0–100: ${BANDS.map((b) => `${b.name} ${b.min}+`).join(' · ')}. Meetings, finals, big wins and transfers between you raise it; a month apart lowers it.`, 'Heated+: wins pay +50% reputation and Credits, and they challenge you more often. Fierce+: both teams play harder (+3%).'] });
    if (debug && onUnlockGhost && !g.unlocked) sections.push({ title: 'Debug', columns: 1, buttons: [{ id: 'debug:ghost', label: 'Unlock the RV08 row', sub: 'Its real trigger is SEC-RIVAL-01 (M28)', accent: C.gold, onTap: () => onUnlockGhost() }] });
    return { title: 'Rivals', subtitle: `${list.rows.length} rival${list.rows.length === 1 ? '' : 's'} · tap one for its card`, art: story[0]?.crest ?? 'ui_19', accent: C.bad, sections };
  }
  function rivalMenu(clubId) {
    const d = run();
    if (!d) return null;
    const r = RIV.rivalsList(d).rows.find((x) => x.clubId === clubId);
    if (!r) return rivalsMenu();
    const c = d.rivals.clubs[clubId];
    const recent = c.h2h.slice(-5).reverse().map((x) => `${x.res === 'W' ? 'Won' : x.res === 'L' ? 'Lost' : 'Drew'} ${x.score[0]}–${x.score[1]}${x.big ? ' (a big match)' : ''}`);
    return {
      title: r.name,
      subtitle: `${r.rv ? `${r.rv} · ` : ''}${r.identity} · ${r.band.name}`,
      art: r.crest,
      accent: r.band.colour,
      tag: { text: r.band.name.toUpperCase(), color: r.band.colour },
      onBack: () => openRivals(),
      backLabel: '‹ Rivals',
      sections: [
        { title: 'Rivalry', bars: [{ label: 'Meter', value: r.meter, max: 100, color: r.band.colour, text: `${r.meter} · ${r.band.name}` }], lines: [`Style: ${r.style}`, `${STORY_RIVALS.find((x) => x.club === clubId)?.role === 'chairman' ? 'Chairman' : 'Manager'}: ${r.manager}`, ...(r.permanent ? ['A rivalry for good (Rivalry Born)'] : r.dynamic ? ['Fades if the meter drops under 30'] : [])] },
        { title: 'Head to head', lines: [`All competitions: ${h2hText(r.h2h)}`, ...(recent.length ? recent : ['Results from Milestone 22 on are listed here.'])] },
      ],
    };
  }
  function openRivals() {
    sheet.open(() => rivalsMenu());
  }
  function openRival(clubId) {
    sheet.open(() => rivalMenu(clubId));
  }
  return { openRivals, openRival, rivalsMenu, twistLine: TWIST.newsLine };
}
