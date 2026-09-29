// The Milestone 2 placeholder sheets (standard bottom sheets, style guide §3):
//   fixturesSheet — from the Manager Office: the temporary "Test Challenge" row (the league stands in until Milestone 10)
//                   with Commit; the refusal reason while a match is pending. ?debug=1 adds the account speed toggles.
//   matchSetupSheet — opens by itself on kickoff day: the opponent and Kick off (Milestone 3: the 11 v 11 match; its
//                   score goes back to the calendar at full time). ?debug=1 keeps the Milestone 2 "Match played" skip.
// Both are builder functions for sheet.open(), rebuilt every frame so the countdown stays live.
import { THEME } from '../../../../core/Theme.js';
import { sourceById, SPEED_FLAGS } from '../../data/fixtures.js';

const C = THEME.color;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const dateText = (cal, day) => {
  const d = cal.clock.dateOf(day);
  return `Year ${d.year} · Month ${d.month} · Day ${d.day}`;
};

export function fixturesSheet({ calendar, onCommit, debugFlags = null, message = () => null }) {
  return () => {
    const cal = calendar();
    if (!cal) return null;
    const offer = cal.testChallenge();
    const can = cal.canCommit(offer);
    const f = cal.fixture;
    const src = sourceById('test');
    // Pending: the scheduled match and why Commit is locked. Otherwise: the offer on the table.
    const lines = f
      ? [`Scheduled: ${f.opponent.name} on ${dateText(cal, f.matchDay)} (${cal.atKickoff ? 'today' : `in ${plural(cal.daysToMatch, 'day')}`}).`, can.why]
      : [`Opponent: ${offer.opponent.name} (Regional League)`, 'Kickoff is 7 days after you commit.'];
    if (!f && !can.ok) lines.push(can.why);
    const msg = message();
    if (msg) lines.push(msg);
    const sections = [
      { title: 'Test Challenge', lines, buttons: [{ id: 'commit', label: 'Commit to match', locked: !can.ok, accent: C.good, onTap: () => can.ok && onCommit(offer) }], columns: 1 },
      { title: 'Temporary', lines: [src.line, 'Only league, tournament and event fixtures count. There are no free friendlies.'] },
    ];
    if (debugFlags) {
      const flags = cal.flags;
      sections.push({
        title: 'Account speed unlocks (debug)',
        lines: ['Nothing sets these in the game yet.'],
        buttons: Object.entries(SPEED_FLAGS).map(([id, def]) => ({ id: `flag_${id}`, label: `${def.label}: ${flags[id] ? 'ON' : 'off'}`, selected: !!flags[id], onTap: () => debugFlags(id) })),
      });
    }
    return { title: 'Fixtures', subtitle: 'Placeholder until the league arrives', art: 'facility_f03', accent: C.progress, tag: { text: 'TEST' }, sections };
  };
}

export function matchSetupSheet({ calendar, clubName, onKickOff, onPlayed = null, resuming = () => false }) {
  return () => {
    const cal = calendar();
    const f = cal?.fixture;
    if (!f || !cal.atKickoff) return null;
    const src = sourceById(f.source);
    return {
      title: 'Match Setup',
      subtitle: `${clubName()} vs ${f.opponent.name}`,
      art: 'facility_f01',
      accent: C.action,
      tag: { text: 'MATCH DAY', color: C.action },
      sections: [
        { title: 'Fixture', lines: [`Opponent: ${f.opponent.name}`, `Kickoff: ${dateText(cal, f.matchDay)}`, `From: ${src?.name ?? f.source}${src?.temporary ? ' (temporary)' : ''}`] },
        {
          title: 'Match',
          lines: ['Watch the match: 11 v 11, about 5 minutes.', 'The calendar waits here until the result is in.'],
          buttons: [
            { id: 'kickoff', label: resuming() ? 'Resume match' : 'Kick off', sub: 'Watch · 1× / 2×', accent: C.good, onTap: () => onKickOff() },
            ...(onPlayed ? [{ id: 'played', label: 'Match played (debug)', sub: 'Skip: commit a placeholder result', accent: C.progress, onTap: () => onPlayed() }] : []),
          ],
          columns: 1,
        },
      ],
    };
  };
}
