// The fixture sheets (standard bottom sheets, style guide §3):
//   leagueSheet — Milestone 10 (replaces M2's temporary Fixtures / Test Challenge sheet): from the Manager Office and the
//                   Squad screen. The open challenges (crest, club, strength hint, reward, home / away, "available until",
//                   Accept — locked with the reason while a match is pending — and Decline), the scheduled match, Club
//                   Rank + reputation + the Credits placeholder, the Regional record (per club W/D/L, total wins, distinct
//                   clubs beaten, the promotion conditions), the County offer once won, and each club's status (wants more
//                   reputation / cooling down / challenging). ?debug=1 adds the account speed toggles.
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
import { sourceById, SPEED_FLAGS, clubById } from '../../data/fixtures.js';
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

// the strength hint: a word for the club's strength (data/fixtures.js 0.88 … 1.09)
const strengthHint = (k) => (k < 0.9 ? 'Easy' : k < 0.95 ? 'Steady' : k < 0.99 ? 'Even' : k < 1.03 ? 'Tough' : k < 1.07 ? 'Strong' : 'Strongest');
// leagueSheet({ calendar, league: () => api }) where api = { offers, accepted, record, reputation, rank, promotion,
// promotionOpponent, credits, clubState(id), onAccept(offerId), onDecline(offerId), onCounty(yes) }
export function leagueSheet({ calendar, league, debugFlags = null, message = () => null }) {
  return () => {
    const cal = calendar();
    const L = league();
    if (!cal || !L) return null;
    const f = cal.fixture;
    const rk = L.rank();
    const rp = L.reputation();
    const pr = L.promotion();
    const rec = L.record();
    const sections = [];
    sections.push({
      title: `Club Rank ${rk.id} · ${rk.line}`,
      lines: [`Reputation ${Math.round(rp.total)} (history ${Math.round(rp.history)} + form ${Math.round(rp.momentum)})`, `Credits ${L.credits().toLocaleString('en-GB')} (placeholder until the club's money arrives)`],
    });
    if (f) sections.push({ title: f.promotion ? 'Scheduled: Promotion Match' : 'Scheduled', lines: [`${f.opponent.name} · ${f.home === false ? 'away' : 'home'} · ${dateText(cal, f.matchDay)} (${cal.atKickoff ? 'today' : `in ${plural(cal.daysToMatch, 'day')}`})`] });
    const offers = L.offers();
    const msg = message();
    sections.push({
      title: 'Challenges',
      lines: [
        ...(offers.length ? [] : ['No club is challenging you right now. Challenges come and go; check back in a few days.']),
        ...(f && offers.length ? ['One match per 7 days: accept the next once this one is played.'] : []),
        ...(msg ? [msg] : []),
      ],
      columns: 1,
      buttons: offers.flatMap((o) => {
        const c = L.club(o.clubId);
        const r = L.rewardOf(o.clubId, o.promotion);
        const can = cal.canCommit(L.calendarOffer(o));
        return [
          {
            id: `accept:${o.clubId}`,
            label: `${o.promotion ? 'PROMOTION MATCH · ' : ''}${c.name}`,
            sub: `${strengthHint(c.strength)} · ${o.home ? 'home' : `away at ${c.ground}`} · win: ${r.credits} Cr, +${r.rep} rep · ${o.until == null ? 'open until played' : `until ${dateText(cal, o.until)}`}`,
            icon: c.crest,
            accent: o.promotion ? C.purple : C.good,
            locked: !can.ok,
            onTap: () => can.ok && L.onAccept(o.id),
          },
          ...(o.promotion ? [] : [{ id: `decline:${o.clubId}`, label: `Decline ${c.name}`, accent: C.progress, locked: false, onTap: () => L.onDecline(o.id) }]),
        ];
      }),
    });
    const county = pr.county;
    if (county === 'offered' || county === 'accepted') {
      sections.push({
        title: 'County promotion offer',
        lines: county === 'accepted' ? ['Accepted. County League coming soon — you stay in the Regional League until it opens.'] : ['You won the Promotion Match: the County League wants you.'],
        buttons: county === 'offered' ? [{ id: 'county:accept', label: 'Accept County offer', accent: C.purple, onTap: () => L.onCounty(true) }, { id: 'county:later', label: 'Later', accent: C.progress, onTap: () => L.onCounty(false) }] : [],
      });
    }
    sections.push({
      title: 'Regional record',
      lines: [
        `${rec.wins} Regional wins (${pr.need.wins} needed) · ${rec.distinct} of 6 clubs beaten (${pr.need.distinct} needed)`,
        pr.won ? 'Promotion Match won.' : pr.unlocked ? `Promotion Match unlocked: against ${L.promotionOpponent().name}.` : 'Promotion Match: beat 4 different clubs and win 8 Regional matches to unlock it.',
      ],
    });
    sections.push({
      title: 'Clubs',
      lines: L.clubs().map((c) => {
        const r = rec.clubs[c.id];
        return `${c.name} ${strengthHint(c.strength)} · W${r.w} D${r.d} L${r.l} · ${L.clubState(c.id)}`;
      }),
    });
    if (debugFlags) {
      const flags = cal.flags;
      sections.push({
        title: 'Account speed unlocks (debug)',
        lines: ['Nothing sets these in the game yet.'],
        buttons: Object.entries(SPEED_FLAGS).map(([id, def]) => ({ id: `flag_${id}`, label: `${def.label}: ${flags[id] ? 'ON' : 'off'}`, selected: !!flags[id], onTap: () => debugFlags(id) })),
      });
    }
    return { title: 'Regional League', subtitle: `Challenges from the six Regional clubs · Rank ${rk.id}`, art: 'facility_f03', accent: C.good, tag: { text: `RANK ${rk.id}`, color: C.good }, sections };
  };
}

// The County promotion offer (Milestone 10): opens once, after the Promotion Match is won.
export function countyOfferSheet({ clubName, onAnswer }) {
  return () => ({
    title: 'County promotion offer',
    subtitle: `${clubName()} — promotion earned`,
    art: 'facility_f03',
    accent: C.purple,
    tag: { text: 'PROMOTION', color: C.purple },
    sections: [
      { title: 'You won the Promotion Match', lines: ['Four Regional clubs beaten, eight Regional wins, and now the Promotion Match. The County League is offering you a place.', 'County League coming soon: accepting records it, and you keep playing the Regional League until it opens.'], buttons: [{ id: 'county:accept', label: 'Accept', accent: C.purple, onTap: () => onAnswer(true) }, { id: 'county:later', label: 'Later', accent: C.progress, onTap: () => onAnswer(false) }] },
    ],
  });
}

// resuming() → null (no match yet) | 'watch' | 'manage' | 'play' (the match under way).  onKickOff(mode)
// kits() → { home, away, sides } (src/match/kits.js matchKits + both sides' names) or null
export function matchSetupSheet({ calendar, clubName, kits = () => null, onKickOff, onPlayed = null, resuming = () => null, clue = () => null }) {
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
      title: f.promotion ? 'Promotion Match' : 'Match Setup',
      subtitle: `${clubName()} vs ${f.opponent.name}${f.home === false ? ' (away)' : ''}`,
      art: clubById(f.opponent.id)?.crest ?? 'facility_f01', // (M12b) the opponent's crest
      accent: C.action,
      tag: { text: 'MATCH DAY', color: C.action },
      sections: [
        // (kept short so all three Kick off buttons fit on a 9:16 phone without scrolling)
        { title: 'Fixture', lines: [`${dateText(cal, f.matchDay)} · ${src?.name ?? f.source}${src?.temporary ? ' (temporary)' : ''}`, ...kitLine(kits()), ...(clue() ? [clue()] : [])] }, // (M14) the Analyst's clue and preparation
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
