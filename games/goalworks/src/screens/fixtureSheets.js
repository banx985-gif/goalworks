// The fixture sheets (standard bottom sheets, style guide §3):
//   leagueSheet — Milestone 10 (replaces M2's temporary Fixtures / Test Challenge sheet): from the Manager Office and the
//                   Squad screen. The open challenges (crest, club, strength hint, reward, home / away, "available until",
//                   Accept — locked with the reason while a match is pending — and Decline), the scheduled match, Club
//                   Rank + reputation + the Credits placeholder, the Regional record (per club W/D/L, total wins, distinct
//                   clubs beaten, the promotion conditions), the County offer once won, and each club's status (wants more
//                   reputation / cooling down / challenging). ?debug=1 adds the account speed toggles.
//                   Milestone 17: one sheet for whichever league the club is in (Regional or County): a cup tie first (it
//                   takes the week's slot), News, the promotion offer, the cup's summary, the record with the promotion
//                   conditions as ✓ / ✗, the clubs, and the record of the league you came from.
//   shieldSheet — Milestone 17: the County Shield bracket (each round's ties, penalties, who went through; past winners).
//   promotionOfferSheet — the promotion offer of any league (M10's County offer; M17 the National offer).
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
import { cupById } from '../../data/cups.js';
import { LEAGUES } from '../../data/league.js';

const leagueOfClub = (id) => LEAGUES.find((l) => l.clubs.includes(id)) ?? null;
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

// the strength hint: a word for the club's strength within its league (data/fixtures.js: Regional 0.88 … 1.09; M17 County
// 1.16 … 1.32 — the same six words, so a County "Easy" is still far above any Regional club)
const HINTS = ['Easy', 'Steady', 'Even', 'Tough', 'Strong', 'Strongest'];
// (M18) the club's place in its own league, weakest → strongest (every league's clubs are listed in that order)
const strengthHint = (club) => HINTS[Math.max(0, leagueOfClub(club.id)?.clubs.indexOf(club.id) ?? 2)] ?? 'Even';
const tick = (ok) => (ok ? '✓' : '✗');
// leagueSheet({ calendar, league: () => api }) where api = { league (the LEAGUES entry), offers, record, reputation, rank,
// promotion, promotionOpponent, credits, clubs, club(id), clubState(id), news, cup (the cup's status or null), past
// (earlier leagues' records), onAccept(offerId), onDecline(offerId), onOffer(yes), onShield() }
// (M17) One sheet for every league: its challenges (a cup tie first: it takes the week's slot), the promotion offer, its
// cup, its record with the promotion conditions as ticks, its clubs, and the record of the league you came from.
export function leagueSheet({ calendar, league, debugFlags = null, message = () => null }) {
  return () => {
    const cal = calendar();
    const L = league();
    if (!cal || !L) return null;
    const lg = L.league();
    const f = cal.fixture;
    const rk = L.rank();
    const rp = L.reputation();
    const pr = L.promotion();
    const rec = L.record();
    const cup = L.cup?.() ?? null;
    const sections = [];
    sections.push({
      title: `Club Rank ${rk.id} · ${rk.line}`,
      lines: [`Reputation ${Math.round(rp.total)} (history ${Math.round(rp.history)} + form ${Math.round(rp.momentum)})`, `Credits ${L.credits().toLocaleString('en-GB')} (placeholder until the club's money arrives)`],
    });
    if (f) sections.push({ title: f.cup ? `Scheduled: ${cupById(f.cup.id)?.name ?? 'Cup'} ${f.cup.name.toLowerCase()}` : f.promotion ? `Scheduled: ${lg.promotion.stepName}` : 'Scheduled', lines: [`${f.opponent.name} · ${f.home === false ? 'away' : 'home'} · ${dateText(cal, f.matchDay)} (${cal.atKickoff ? 'today' : `in ${plural(cal.daysToMatch, 'day')}`})`] });
    const offers = L.offers().slice().sort((a, b) => !!b.cup - !!a.cup);
    const tie = offers.find((o) => o.cup);
    const msg = message();
    const promoWord = lg.promotion.stepName.toUpperCase();
    sections.push({
      title: 'Challenges',
      lines: [
        ...(offers.length ? [] : ['No club is challenging you right now. Challenges come and go; check back in a few days.']),
        ...(tie ? [`${cupById(tie.cup.id)?.name ?? 'Cup'} week: the tie is fixed as soon as no match is pending, and no challenge can take its slot.`] : []),
        ...(f && offers.length && !tie ? ['One match per 7 days: accept the next once this one is played.'] : []),
        ...(msg ? [msg] : []),
      ],
      columns: 1,
      buttons: offers.flatMap((o) => {
        const c = L.club(o.clubId);
        const r = L.rewardOf(o.clubId, o.promotion);
        const can = cal.canCommit(L.calendarOffer(o));
        const blocked = !o.cup && !!tie;
        return [
          {
            id: o.cup ? `cup:${o.clubId}` : `accept:${o.clubId}`,
            label: `${o.cup ? `${(cupById(o.cup.id)?.name ?? 'Cup').toUpperCase()} ·${o.cup.name.toUpperCase()} · ` : o.promotion ? `${promoWord} · ` : ''}${c.name}`,
            sub: `${strengthHint(c)} · ${o.home ? 'home' : `away at ${c.ground}`} · win: ${r.credits} Cr, +${r.rep} rep · ${o.cup ? 'knockout: lose and you are out' : o.until == null ? 'open until played' : `until ${dateText(cal, o.until)}`}`,
            icon: c.crest,
            accent: o.cup ? C.gold : o.promotion ? C.purple : C.good,
            locked: !can.ok || blocked,
            onTap: () => can.ok && !blocked && L.onAccept(o.id),
          },
          ...(o.promotion || o.cup ? [] : [{ id: `decline:${o.clubId}`, label: `Decline ${c.name}`, accent: C.progress, locked: false, onTap: () => L.onDecline(o.id) }]),
        ];
      }),
    });
    const news = L.news?.() ?? [];
    if (news.length) sections.push({ title: 'News', lines: news.slice(-3).reverse().map((n) => `${dateText(cal, n.day)}: ${n.text}`) });
    // the promotion offer (Regional → County; County → National)
    const nextName = L.nextName(pr.to);
    if (pr.offer === 'offered' || pr.offer === 'accepted') {
      sections.push({
        title: `${nextName} promotion offer`,
        lines: pr.offer === 'accepted' ? [`Accepted. ${nextName} coming soon — you stay in the ${lg.name} until it opens.`] : [`${pr.via === 'cup' ? `You won the ${cup?.cup.name ?? 'cup'}` : `You won the ${lg.promotion.stepName}`}: the ${nextName} wants you.`],
        buttons: pr.offer === 'offered' ? [{ id: 'offer:accept', label: `Accept ${nextName} offer`, accent: C.purple, onTap: () => L.onOffer(true) }, { id: 'offer:later', label: 'Later', accent: C.progress, onTap: () => L.onOffer(false) }] : [],
      });
    }
    for (const st of L.cups?.() ?? (cup ? [cup] : [])) sections.push(shieldSummary(cal, st, L)); // (M18: every cup running)
    sections.push({ title: `${lg.short} record`, lines: recordLines(lg, rec, pr, rk, L, cup) });
    sections.push({
      title: 'Clubs',
      lines: L.clubs().map((c) => {
        const r = rec.clubs[c.id];
        const twice = lg.promotion.timesEach ? ` · beaten ${Math.min(r.w, lg.promotion.timesEach)}/${lg.promotion.timesEach}` : ''; // (M20) times beaten, out of 2
        return `${c.name} ${strengthHint(c)} · W${r.w} D${r.d} L${r.l}${twice} · ${L.clubState(c.id)}`;
      }),
    });
    for (const p of L.past?.() ?? []) sections.push({ title: `${p.league.short} record (kept)`, lines: [`${p.record.wins} wins · ${p.record.distinct} of ${p.league.clubs.length} clubs beaten · promoted`] });
    if (debugFlags) {
      const flags = cal.flags;
      sections.push({
        title: 'Account speed unlocks (debug)',
        lines: ['Nothing sets these in the game yet.'],
        buttons: Object.entries(SPEED_FLAGS).map(([id, def]) => ({ id: `flag_${id}`, label: `${def.label}: ${flags[id] ? 'ON' : 'off'}`, selected: !!flags[id], onTap: () => debugFlags(id) })),
      });
    }
    if (pr.crownTitle) sections.unshift({ title: 'Crown Champions', lines: [`Won the Crown Title Match ${dateText(cal, pr.crownTitle.day)}.`, 'Prestige tournaments, Secret players and New Game+ are coming later.'] }); // (M20)
    return { title: lg.name, subtitle: `Challenges from the six ${lg.short} clubs · Rank ${rk.id}`, art: 'facility_f03', accent: C.good, tag: { text: pr.crownTitle ? 'CHAMPIONS' : `RANK ${rk.id}`, color: pr.crownTitle ? C.gold : C.good }, sections };
  };
}

// The league's record and its promotion conditions (Regional: wins and clubs beaten, then the Promotion Match; County:
// all six beaten + the Club Rank, then the cup or the Promotion Playoff — each a ✓ / ✗ line).
function recordLines(lg, rec, pr, rk, L, cup) {
  const n = lg.clubs.length;
  if (lg.promotion.final === 'match') {
    return [
      `${rec.wins} ${lg.short} wins (${pr.need.wins} needed) · ${rec.distinct} of ${n} clubs beaten (${pr.need.distinct} needed)`,
      pr.won ? 'Promotion Match won.' : pr.unlocked ? `Promotion Match unlocked: against ${L.promotionOpponent().name}.` : `Promotion Match: beat ${pr.need.distinct} different clubs and win ${pr.need.wins} ${lg.short} matches to unlock it.`,
    ];
  }
  // (M19) Championship: 14 wins + all six beaten + Rank B, then the C05 Promotion Final (or the one-off fallback)
  // (M20) the Crown Premier title chain: 18 wins + every club beaten twice + Rank A, then the Crown Title Match
  if (lg.promotion.final.title) {
    const t = pr.need.timesEach ?? 2;
    const short = lg.clubs.filter((id) => rec.clubs[id].w < t).map((id) => `${L.club(id).name} ${rec.clubs[id].w}/${t}`);
    const opp = L.promotionOpponent()?.name ?? 'the strongest club';
    return [
      `${tick(rec.wins >= pr.need.wins)} ${pr.need.wins} ${lg.short} wins (${rec.wins} so far, cup ties included)`,
      `${tick(pr.distinct >= pr.need.distinct)} Beat all ${pr.need.distinct} ${lg.short} clubs ${t === 2 ? 'twice' : `${t} times`} (${pr.distinct} of ${n}${short.length ? `; still to go: ${short.join(', ')}` : ''})`,
      `${tick(pr.rankOk)} Club Rank ${pr.need.rank} or better (now ${rk.id})`,
      pr.crownTitle ? '✓ Crown Title Match won: Crown Champions!' : pr.unlocked ? `✗ Win the Crown Title Match against ${opp} (it is waiting for you)` : `✗ Then win the Crown Title Match against the strongest ${lg.short} club`,
    ];
  }
  if (lg.promotion.final.promotionFinal) {
    const fin = lg.promotion.final;
    const cupName = cupById(fin.cup).name;
    const notYet = lg.clubs.filter((id) => !rec.beaten.includes(id)).map((id) => L.club(id).name);
    const finalLine = pr.won
      ? '✓ Promotion Final won'
      : pr.met
        ? `✗ Win the Promotion Final: the ${cupName} final${pr.unlocked && L.offers().some((o) => o.promotion) ? `, or the one-off final against ${L.club(fin.fallback).name} (it is waiting for you)` : ` (once you are out of this season's ${cupName}: a one-off final against ${L.club(fin.fallback).name})`}`
        : `✗ Then win the Promotion Final (the ${cupName} final, once the rest is met)${pr.cupWon ? ` · ${cupName} won before: a cup win, not the final` : ''}`;
    return [
      `${tick(rec.wins >= pr.need.wins)} ${pr.need.wins} ${lg.short} wins (${rec.wins} so far, ${cupName} ties included)`,
      `${tick(rec.distinct >= pr.need.distinct)} Beat all ${pr.need.distinct} ${lg.short} clubs at least once (${rec.distinct} of ${n}${notYet.length ? `; not yet ${notYet.join(', ')}` : ''})`,
      `${tick(pr.rankOk)} Club Rank ${pr.need.rank} or better (now ${rk.id})`,
      finalLine,
    ];
  }
  // (M18) National: 12 wins + 5 different clubs + Rank C, then the Promotion Decider against the rival (RV03)
  if (lg.promotion.final.rival) {
    const rival = L.club(lg.promotion.final.rival).name;
    const notYet = lg.clubs.filter((id) => !rec.beaten.includes(id)).map((id) => L.club(id).name);
    return [
      `${tick(rec.wins >= pr.need.wins)} ${pr.need.wins} ${lg.short} wins (${rec.wins} so far)`,
      `${tick(rec.distinct >= pr.need.distinct)} Beat ${pr.need.distinct} different ${lg.short} clubs (${rec.distinct} of ${n}${notYet.length ? `; not yet ${notYet.join(', ')}` : ''})`,
      `${tick(pr.rankOk)} Club Rank ${pr.need.rank} or better (now ${rk.id})`,
      pr.won ? `✓ Promotion Decider won against ${rival}` : pr.unlocked ? `✗ Beat ${rival} in the Promotion Decider (it is waiting for you)` : `✗ Then beat ${rival}, your promotion rival, in the Promotion Decider`,
    ];
  }
  const cupName = cup?.cup.name ?? 'the cup';
  const finalLine = pr.won
    ? `✓ ${pr.via === 'cup' ? `${cupName} won` : 'Promotion Playoff won'}`
    : pr.cupWon
      ? `✓ ${cupName} won · the offer comes once the rest is met`
      : pr.unlocked
        ? `✗ Win the ${cupName} or the Promotion Playoff against ${L.promotionOpponent().name} (it is waiting for you)`
        : `✗ Win the ${cupName} — or, once the rest is met, the Promotion Playoff`;
  return [
    `${rec.wins} ${lg.short} wins · W/D/L counts league challenges and ${cupName} ties`,
    `${tick(rec.distinct >= pr.need.distinct)} Beat all ${pr.need.distinct} ${lg.short} clubs at least once (${rec.distinct} of ${pr.need.distinct}${rec.distinct < n ? `: not yet ${lg.clubs.filter((id) => !rec.beaten.includes(id)).map((id) => L.club(id).name).join(', ')}` : ''})`,
    `${tick(pr.rankOk)} Club Rank ${pr.need.rank} or better (now ${rk.id})`,
    finalLine,
  ];
}

// The cup's summary inside the League sheet: where it stands and a button to the bracket.
function shieldSummary(cal, st, L) {
  const lines = [];
  if (st.running && st.out) lines.push(`Knocked out this season. The next ${st.cup.name} opens next season.`);
  else if (st.next) lines.push(`${st.next.round} against ${L.club(st.next.opponent)?.name ?? st.next.opponent} · about ${dateText(cal, st.next.day)} (${st.next.home ? 'home' : 'away'})`);
  else if (st.running) lines.push(`${st.roundName}: you are through, waiting for the other ties.`);
  else if (st.nextStart != null) lines.push(`${st.edition?.champion ? `Last winner: ${st.edition.champion === 'us' ? 'your club!' : L.club(st.edition.champion)?.name}. ` : ''}The next ${st.cup.name} opens ${dateText(cal, st.nextStart)}.`);
  lines.push(`Won ${st.wins} time${st.wins === 1 ? '' : 's'} · prize ${st.cup.prize.credits.toLocaleString('en-GB')} Credits + ${prizeWords(st.cup)}`);
  const id = st.cup.id === 'C02' ? 'shield' : `cup:${st.cup.id}`; // (M17's button id kept for the Shield)
  return { title: st.cup.name, lines, columns: 1, buttons: [{ id, label: `${st.cup.name} bracket`, sub: 'Quarter-final · semi-final · final', icon: st.cup.art, accent: C.gold, onTap: () => L.onShield(st.cup.id) }] };
}
// What a cup's prize gives besides Credits (data/cups.js prize).
const prizeWords = (cup) => [cup.prize.history >= 400 ? 'major reputation' : 'reputation', ...(cup.prize.flags?.includes('sponsorInterest') ? ['sponsor interest'] : []), ...(cup.id === 'C04' ? ['a place in club history'] : [])].join(' + ');

// (M17) The cup bracket sheet: each round's ties (scores, penalties, who went through), your next tie, past winners.
// shieldSheet({ calendar, status: () => cup.js status, name(id), crest(id), onBack })
export function shieldSheet({ calendar, status, name, onBack = null }) {
  return () => {
    const cal = calendar();
    const st = status();
    if (!cal || !st) return null;
    const ed = st.edition;
    const sections = [];
    const head = [];
    if (!ed) head.push(st.cup.opens.rank ? `The first ${st.cup.name} opens when the club reaches Rank ${st.cup.opens.rank}.` : `The first ${st.cup.name} opens when you enter the ${st.cup.opens.league[0].toUpperCase()}${st.cup.opens.league.slice(1)} League.`);
    else if (st.running) head.push(st.out ? 'You are out: the other ties are played out without you.' : st.next ? `Your ${st.next.round.toLowerCase()}: ${name(st.next.opponent)}, about ${dateText(cal, st.next.day)}.` : `${st.roundName}: through! Waiting for the other ties.`);
    else head.push(`Season ${ed.year} edition finished — winner: ${name(ed.champion)}${ed.champion === 'us' ? '!' : '.'}${st.nextStart != null ? ` The next opens ${dateText(cal, st.nextStart)}.` : ''}`);
    head.push(`8 teams: ${st.cup.blurb}. One tie about every 4 weeks; a draw goes to penalties. Win it: ${st.cup.prize.credits.toLocaleString('en-GB')} Credits + ${prizeWords(st.cup)}.`);
    sections.push({ title: ed ? `Season ${ed.year} · edition ${ed.edition}` : st.cup.name, lines: head });
    if (ed) {
      st.cup.rounds.forEach((rn, r) => {
        const ties = ed.rounds[r];
        if (!ties) {
          sections.push({ title: rn, lines: [r === st.cup.rounds.length - 1 ? 'The two semi-final winners.' : 'The winners of the round before.'] });
          return;
        }
        sections.push({
          title: `${rn}${ties.every((t) => t.winner) ? '' : ed.round === r ? ` · ${dateText(cal, ed.tieDay)}` : ''}`,
          lines: ties.map((t) => {
            const a = name(t.a);
            const b = name(t.b);
            if (!t.winner) return `${a} v ${b}`;
            const pens = t.pens ? ` (${t.pens[0]}–${t.pens[1]} pens)` : '';
            return `${t.winner === t.a ? '✓ ' : ''}${a} ${t.score[0]}–${t.score[1]} ${b}${t.winner === t.b ? ' ✓' : ''}${pens}`;
          }),
        });
      });
    }
    if (st.history.length) sections.push({ title: 'Past winners', lines: st.history.slice(-5).reverse().map((h) => `Season ${h.year}: ${name(h.champion)}${h.reached && h.reached !== 'won' ? ` · you went out in the ${h.reached.toLowerCase()}` : ''}`) });
    if (onBack) sections.push({ columns: 1, buttons: [{ id: 'back', label: '‹ League', accent: C.progress, onTap: () => onBack() }] });
    return { title: st.cup.name, subtitle: `${st.cup.id} · ${st.cup.short} · ${st.wins ? `won ${st.wins}×` : 'not won yet'}`, art: st.cup.art, accent: C.gold, tag: { text: 'CUP', color: C.gold }, sections };
  };
}

// The promotion offer (Milestone 10: County; M17 any league): opens once, after the promotion step is won.
// promotionOfferSheet({ clubName, league (LEAGUES entry you are leaving), nextName, via, nextBuilt, onAnswer })
export function promotionOfferSheet({ clubName, league, nextName, via, nextBuilt, onAnswer }) {
  return () => {
    const lg = league();
    const why = lg.promotion.final.promotionFinal
      ? `${lg.promotion.wins} ${lg.short} wins, all six ${lg.short} clubs beaten, Club Rank ${lg.promotion.rank} or better, and the Promotion Final won. The ${nextName} is offering you a place.`
      : lg.promotion.final.rival
      ? `${lg.promotion.wins} ${lg.short} wins, ${lg.promotion.distinct} different ${lg.short} clubs beaten, Club Rank ${lg.promotion.rank} or better, and your rival beaten in the Promotion Decider. The ${nextName} is offering you a place.`
      : lg.promotion.final === 'match'
        ?`Four ${lg.short} clubs beaten, eight ${lg.short} wins, and now the Promotion Match. The ${nextName} is offering you a place.`
        : `All six ${lg.short} clubs beaten, Club Rank ${lg.promotion.rank} or better, and ${via() === 'cup' ? `the ${cupById(lg.promotion.final.cup)?.name} won` : `the ${lg.promotion.stepName} won`}. The ${nextName} is offering you a place.`;
    const what = nextBuilt ? `Accept and you move up at once: the ${nextName}'s clubs start challenging you, and your ${lg.short} record is kept.` : `${nextName} coming soon: accepting records it, and you keep playing the ${lg.name} until it opens.`;
    return {
      title: `${nextName} promotion offer`,
      subtitle: `${clubName()} — promotion earned`,
      art: 'facility_f03',
      accent: C.purple,
      tag: { text: 'PROMOTION', color: C.purple },
      sections: [{ title: via() === 'cup' ? 'Shield winners!' : `You won the ${lg.promotion.stepName}`, lines: [why, what], buttons: [{ id: 'offer:accept', label: 'Accept', accent: C.purple, onTap: () => onAnswer(true) }, { id: 'offer:later', label: 'Later', accent: C.progress, onTap: () => onAnswer(false) }] }],
    };
  };
}

// resuming() → null (no match yet) | 'watch' | 'manage' | 'play' (the match under way).  onKickOff(mode)
// kits() → { home, away, sides } (src/match/kits.js matchKits + both sides' names) or null
// (M19) promotionFinal() → true when today's cup final is also the Promotion Final (a banner line and the title say so)
export function matchSetupSheet({ calendar, clubName, kits = () => null, onKickOff, onPlayed = null, resuming = () => null, clue = () => null, promotionFinal = () => false }) {
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
      title: f.cup ? (promotionFinal() ? 'Promotion Final' : `${cupById(f.cup.id)?.name ?? 'Cup'} · ${f.cup.name}`) : f.promotion ? leagueOfClub(f.opponent.id)?.promotion.stepName ?? 'Promotion Match' : 'Match Setup', // (M17: a cup tie, the playoff; M18 the Decider; M19 the Trophy's final as the Promotion Final)
      subtitle: `${promotionFinal() ? `${cupById(f.cup.id)?.name} final · ` : ''}${clubName()} vs ${f.opponent.name}${f.home === false ? ' (away)' : ''}`,
      art: clubById(f.opponent.id)?.crest ?? 'facility_f01', // (M12b) the opponent's crest
      accent: C.action,
      tag: promotionFinal() ? { text: 'PROMOTION FINAL', color: C.purple } : { text: 'MATCH DAY', color: C.action },
      sections: [
        // (kept short so all three Kick off buttons fit on a 9:16 phone without scrolling)
        { title: promotionFinal() ? 'Fixture · win it and the Crown Premier League wants you' : 'Fixture', lines: [`${dateText(cal, f.matchDay)} · ${f.cup ? 'Knockout tie: a draw goes to penalties' : src?.name ?? f.source}${src?.temporary ? ' (temporary)' : ''}`, ...kitLine(kits()), ...(clue() ? [clue()] : [])] }, // (M14) the Analyst's clue and preparation
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
