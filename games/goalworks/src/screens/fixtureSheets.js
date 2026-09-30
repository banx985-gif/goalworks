// The Milestone 2 placeholder sheets (standard bottom sheets, style guide §3):
//   fixturesSheet — from the Manager Office: the temporary "Test Challenge" row (the league stands in until Milestone 10)
//                   with Commit; the refusal reason while a match is pending. ?debug=1 adds the account speed toggles.
//   matchSetupSheet — opens by itself on kickoff day: the opponent and Kick off (Milestone 3: the 11 v 11 match; its
//                   score goes back to the calendar at full time). ?debug=1 keeps the Milestone 2 "Match played" skip.
//                   Milestone 4: Kick off · Watch (first, the default) or Kick off · Play (you control our side);
//                   a match already under way shows one Resume button in the mode it was left in.
//                   Milestone 5: Kick off · Manage too (the team plays to your commands); the mode can change mid-match.
//                   Milestone 6: one Kits line under the fixture — each side's shirt / shorts (a small shirt in its colours
//                   before each) and "change" when the away side wears its second colour because the kits clash. (The
//                   Match section's line gave way to it, so all three Kick off buttons still fit a 9:16 phone.)
// Both are builder functions for sheet.open(), rebuilt every frame so the countdown stays live.
import { THEME, font } from '../../../../core/Theme.js';
import { sourceById, SPEED_FLAGS } from '../../data/fixtures.js';
import { COLOURS } from '../../data/setup.js';
import { KEEPER_COLOURS } from '../../data/kits.js';

const S = THEME.size;
const colourName = (hex) => [...COLOURS, ...KEEPER_COLOURS].find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? hex;
// A small shirt in the kit's colours (a sheet line glyph, size × size at x, y).
const shirtGlyph = (kit) => (ctx, x, y, size) => {
  const k = size / 34;
  ctx.translate(x, y + 1);
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 2.2;
  ctx.fillStyle = kit.shirt;
  ctx.beginPath();
  ctx.moveTo(9, 2);
  ctx.lineTo(1, 8);
  ctx.lineTo(4, 15);
  ctx.lineTo(9, 13);
  ctx.lineTo(9, 24);
  ctx.lineTo(25, 24);
  ctx.lineTo(25, 13);
  ctx.lineTo(30, 15);
  ctx.lineTo(33, 8);
  ctx.lineTo(25, 2);
  ctx.quadraticCurveTo(17, 7, 9, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = kit.shorts;
  ctx.beginPath();
  ctx.rect(9, 25, 16, 8);
  ctx.fill();
  ctx.stroke();
};

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

// resuming() → null (no match yet) | 'watch' | 'manage' | 'play' (the match under way).  onKickOff(mode)
// kits() → { home, away, sides } (src/match/kits.js matchKits + both sides' names) or null
export function matchSetupSheet({ calendar, clubName, kits = () => null, onKickOff, onPlayed = null, resuming = () => null }) {
  return () => {
    const cal = calendar();
    const f = cal?.fixture;
    if (!f || !cal.atKickoff) return null;
    const src = sourceById(f.source);
    const under = resuming();
    const kick = under
      ? [{ id: 'kickoff', label: 'Resume match', sub: under === 'play' ? 'Play · you control your side' : under === 'manage' ? 'Manage · your team commands' : 'Watch · 1× / 2×', accent: C.good, onTap: () => onKickOff(under) }]
      : [
          { id: 'kickoff', label: 'Kick off · Watch', sub: 'The team plays · 1× / 2×', accent: C.good, onTap: () => onKickOff('watch') },
          { id: 'kickoffManage', label: 'Kick off · Manage', sub: 'The team plays to your orders', accent: C.purple, onTap: () => onKickOff('manage') },
          { id: 'kickoffPlay', label: 'Kick off · Play', sub: 'You play: stick + Pass / Shoot / Tackle', accent: C.action, onTap: () => onKickOff('play') },
        ];
    return {
      title: 'Match Setup',
      subtitle: `${clubName()} vs ${f.opponent.name}`,
      art: 'facility_f01',
      accent: C.action,
      tag: { text: 'MATCH DAY', color: C.action },
      sections: [
        // (kept short so all three Kick off buttons fit on a 9:16 phone without scrolling)
        { title: 'Fixture', lines: [`${dateText(cal, f.matchDay)} · ${src?.name ?? f.source}${src?.temporary ? ' (temporary)' : ''}`, ...kitLine(kits())] },
        {
          title: 'Match · 11 v 11, about 5 minutes',
          buttons: [
            ...kick,
            ...(onPlayed ? [{ id: 'played', label: 'Match played (debug)', sub: 'Skip: commit a placeholder result', accent: C.progress, onTap: () => onPlayed() }] : []),
          ],
          columns: 1,
        },
      ],
    };
  };
}

// Both kits on one line: [shirt] Red / Navy  v  [shirt] Pitch Green / Gold (change). The glyph draws the whole line (the
// second shirt sits mid-line), so the sheet's own text is a blank.
function kitLine(k) {
  if (!k) return [];
  const a = `${colourName(k.home.shirt)} / ${colourName(k.home.shorts)}`;
  const b = `${colourName(k.away.shirt)} / ${colourName(k.away.shorts)}${k.away.change ? ' (change kit)' : ''}`;
  return [
    {
      text: ' ',
      kits: { home: a, away: b },
      glyph: (ctx, x, y, size) => {
        ctx.save();
        shirtGlyph(k.home)(ctx, x, y, size);
        ctx.restore();
        ctx.font = font(S.body);
        ctx.textBaseline = 'top';
        ctx.fillStyle = C.text;
        let tx = x + size + 10;
        ctx.fillText(a, tx, y);
        tx += ctx.measureText(a).width + 18;
        ctx.fillStyle = C.textMuted;
        ctx.fillText('v', tx, y);
        tx += ctx.measureText('v').width + 18;
        ctx.save();
        shirtGlyph(k.away)(ctx, tx, y, size);
        ctx.restore();
        ctx.fillStyle = C.text;
        ctx.fillText(b, tx + size + 10, y);
      },
    },
  ];
}
