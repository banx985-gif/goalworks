// The Finances screen and the money pop-ups (Milestone 23; style guide §3 bottom sheets). Club Menu → Finances (one tap;
// its tabs are inside the sheet, so everything is at most two taps deep):
//   Money — the balance, the wage bill against income, Emergency Credit, the 12-week balance chart (a bar a week), this
//     week / this season / last season by category, the latest ledger lines
//   Sponsors — the three slots (each deal: stipend, benefit, objectives with their progress, when it ends), Celeste's open
//     offer, every sponsor and its unlock ("???" for the secret two until found), past deals
//   Fans & Board — Fan Trust (bar, band, its latest moves, what moves it), the board's two objectives this season with how
//     they stand, past seasons' results (Board Confidence itself shows only in the Board voice at Awards Night)
// Pop-ups (one at a time, from main.js's queue when the club is free): Celeste Moore's offer sheet (Sign / Not now / Later),
// Edith Marlow's objectives sheet at the season's start (one tap), the board's rescue plan (sell · sponsor · not now).
//   createFinanceSheets({ sheet, assets, run, today, dateText, onChange, onSell, debug })
//     → { openFinances(tab?), financesMenu(tab?), openOffer(uid), offerMenu(uid), openBoardSheet(), openRescue() }
import { THEME } from '../../../../core/Theme.js';
import { FIN_CATS, finCat, FIN_TEXT } from '../../data/finance.js';
import { SPONSORS, SPONSOR_SLOTS, SPONSOR_TEXT, sponsorById } from '../../data/sponsors.js';
import { FAN_BANDS, FAN_TRUST } from '../../data/fans.js';
import { BOARD_TEXT } from '../../data/board.js';
import * as FIN from '../systems/finance.js';
import * as SP from '../systems/sponsors.js';
import * as FAN from '../systems/fans.js';
import * as BOARD from '../systems/board.js';
import { wageBill, wageSupport, wageCover } from '../systems/transfers.js';
import { wageBill as staffBill } from '../systems/staff.js';
import { castGlyph } from '../ui/castArt.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const signed = (n) => `${n >= 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
const YEAR = 336;

export function createFinanceSheets({ sheet, assets, run, today = () => 0, dateText = (d) => `day ${d}`, onChange = () => {}, onSell = null, debug = false }) {
  const ui = { tab: 'money', msg: null };
  const face = (id, text) => (castGlyph(assets, id) ? { text, glyph: castGlyph(assets, id) } : text);
  const msgSection = () => (ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []);

  // A season's (or week's) lines by category: income first, then costs, then the net.
  function catLines(t) {
    const rows = [];
    for (const c of FIN_CATS) {
      const v = t.byCat[c.id];
      if (!v) continue;
      const net = v.in - v.out;
      if (net) rows.push({ text: c.name, right: signed(net), color: net >= 0 ? C.good : C.bad });
    }
    if (!rows.length) return ['Nothing yet.'];
    rows.push({ text: `Income ${fmt(t.income)} · costs ${fmt(t.costs)}`, right: signed(t.net), color: t.net >= 0 ? C.good : C.bad });
    return rows;
  }

  function moneySections(d) {
    const F = FIN.normaliseFinance(d, today());
    const year = FIN.yearOf(today());
    const week = FIN.weekOf(today());
    const bill = wageBill(d) + staffBill(d);
    const income = FIN.weeklyIncomeEstimate(d, { support: wageSupport(d) });
    const E = F.emergency;
    const out = [...msgSection()];
    out.push({
      title: 'Now',
      lines: [
        { text: 'Credits', right: fmt(d.league.credits) },
        { text: 'Wage bill a week (squad + staff)', right: fmt(bill) },
        { text: 'Regular income a week (board, sponsors, merch, matchdays)', right: fmt(income) },
        bill > income ? { text: 'The wages are more than the regular income: the club is losing money each week.', color: C.bad } : { text: 'The regular income covers the wages.', color: C.good },
      ],
      bars: [{ label: 'Wages / income', value: Math.min(150, income ? Math.round((bill / income) * 100) : 0), max: 100, color: bill > income ? C.bad : C.good, text: income ? `${Math.round((bill / income) * 100)}%` : '—' }],
    });
    if (E.owed > 0) out.push({ title: 'Emergency Credit', titleDot: C.bad, lines: [{ text: `Owed to the board: ${fmt(E.owed)} Credits (${E.weeks} week${E.weeks === 1 ? '' : 's'} in debt). It is repaid from income each week.`, color: C.bad }, FIN_TEXT.buildBlocked(E.owed)] });
    const pts = F.chart.slice(-12);
    const top = Math.max(1, ...pts.map((p) => p.bal));
    out.push({ title: 'Balance, last 12 weeks', bars: pts.map((p) => ({ label: `Week ${(p.week % 48) + 1}`, value: Math.max(0, p.bal), max: top, color: C.progress, text: fmt(p.bal) })) });
    out.push({ title: 'This week', lines: catLines(FIN.weekTotals(d, week)) });
    out.push({ title: `This season (Year ${year})`, lines: catLines(FIN.seasonTotals(d, year)) });
    if (F.seasons[year - 1]) out.push({ title: `Last season (Year ${year - 1})`, lines: catLines(FIN.seasonTotals(d, year - 1)) });
    else out.push({ title: 'Last season', lines: [F.startDay > 0 ? 'The ledger started this season (an older save starts it from the day it loaded).' : 'Your first season.'] });
    out.push({ title: 'Latest', lines: F.lines.slice(-8).reverse().map((l) => ({ text: `${dateText(l.day)} · ${l.note || finCat(l.cat)?.name}`, right: signed(l.n), color: l.n >= 0 ? C.good : C.bad })) });
    if (debug) out.push({ title: 'Debug', columns: 2, buttons: [
      { id: 'debug:debt', label: 'Spend 60,000', sub: 'Test the Emergency Credit', accent: C.bad, onTap: () => { FIN.post(d, -60000, 'other', 'Debug spend', today()); ui.msg = 'Spent 60,000 Credits (debug).'; onChange('finance:debug:debt'); } },
      { id: 'debug:rescue', label: 'Board rescue now', sub: 'Adds debt if there is none', accent: C.bad, onTap: () => { if (!d.finance.emergency.owed) FIN.post(d, -60000, 'other', 'Debug spend', today()); d.finance.emergency.weeks = Math.max(d.finance.emergency.weeks, 30); d.finance.emergency.lastRescueWeek = -99; for (let k = 0; k < 40 && !BOARD.pendingRescue(d); k++) BOARD.rescueRoll(d, today() + k * 7); onChange('finance:debug:rescue'); if (BOARD.pendingRescue(d)) openRescue(); } },
    ] });
    return out;
  }

  function dealButton(d, deal) {
    const def = sponsorById(deal.id);
    const left = Math.max(0, deal.end - today());
    return {
      title: `${SPONSOR_SLOTS.find((s) => s.id === deal.slot)?.name ?? ''} sponsor · ${def.name}`,
      lines: [
        { text: `${def.tier} · ${def.benefit.text}`, right: `${fmt(SP.stipendOf(d, deal))} a week` },
        `Ends ${dateText(deal.end)} (${Math.ceil(left / YEAR * 10) / 10} seasons left)`,
      ],
      bars: deal.objectives.map((o) => {
        const p = SP.progressOf(d, deal, o);
        return { label: SP.objectiveLine(o), value: Math.min(p.need, p.have), max: Math.max(1, p.need), color: p.met ? C.good : C.progress, text: p.met ? 'Met' : `${p.have} / ${p.need}` };
      }),
    };
  }
  function sponsorSections(d) {
    const S = SP.normaliseSponsors(d, today());
    const out = [...msgSection()];
    out.push({ title: 'How sponsors work', lines: [face('celeste_moore', 'Celeste Moore brings the offers. Up to 3 deals at once: shirt, sleeve and stadium. Each pays every week and gives a benefit. Meet the objectives for an end-of-deal bonus and a better chance they re-sign — missing one never hurts the club.')] });
    for (const sl of SPONSOR_SLOTS) {
      const deal = S.active.find((x) => x.slot === sl.id);
      out.push(deal ? dealButton(d, deal) : { title: `${sl.name} sponsor`, lines: ['Empty: Celeste is looking.'] });
    }
    if (S.offers.length) out.push({ title: 'Offers on the table', columns: 1, buttons: S.offers.map((o) => ({ id: `offer:${o.uid}`, label: `${sponsorById(o.id).name}${o.resign ? ' (re-sign)' : ''}`, sub: `${fmt(o.stipend)} a week · ${o.seasons} season${o.seasons === 1 ? '' : 's'} · until ${dateText(o.until)}`, icon: sponsorById(o.id).art, accent: C.good, onTap: () => openOffer(o.uid) })) });
    out.push({
      title: 'All sponsors',
      lines: SPONSORS.map((s) => {
        const open = S.unlocked[s.id] != null;
        const secret = !!s.unlock.secret;
        if (secret && !open) return { text: `${s.id} · ??? · a secret sponsor`, color: C.textFaint };
        return { text: `${s.id} · ${s.name} (${s.tier}) · ${open ? s.benefit.text : `unlock: ${s.unlockText}`}`, right: open ? `${fmt(s.stipend)}/wk` : 'locked', color: open ? C.text : C.textFaint };
      }),
    });
    if (S.history.length) out.push({ title: 'Past deals', lines: S.history.slice(-6).reverse().map((h) => `${sponsorById(h.id)?.name}: ${h.early ? 'replaced early' : `${h.met} of ${h.of} objectives · bonus ${fmt(h.bonus)}${h.resignOffered ? ' · offered to re-sign' : ''}`}`) });
    if (debug) out.push({ title: 'Debug: Celeste brings an offer now', columns: 5, buttons: SPONSORS.map((s) => ({ id: `debug:sp:${s.id}`, label: s.id, accent: s.unlock.secret ? C.purple : C.gold, onTap: () => { const o = SP.forceOffer(d, s.id, today()); onChange(`sponsor:debug:${s.id}`); openOffer(o.uid); } })) });
    return out;
  }

  function fansSections(d) {
    const F = FAN.normaliseFans(d);
    const b = FAN.band(d);
    const out = [...msgSection()];
    out.push({
      title: 'Fan Trust',
      lines: [face('del_price', `Del Price, Supporters’ Club: the fans are ${b.name.toLowerCase()}.`)],
      bars: [{ label: 'Fan Trust', value: Math.round(F.trust), max: 100, color: b.colour, text: `${Math.round(F.trust)} · ${b.name}` }],
    });
    out.push({ title: 'Latest moves', lines: F.log.length ? F.log.slice(-6).reverse().map((l) => ({ text: `${dateText(l.day)} · ${l.why}`, right: `${l.d > 0 ? '+' : ''}${l.d}`, color: l.d >= 0 ? C.good : C.bad })) : ['Nothing yet this season.'] });
    out.push({ title: 'What moves it', lines: [`Up: wins (home wins more), derby wins, young players in the XI, cups, promotions. Down: defeats, derby defeats, selling a favourite (${FAN_TRUST.favouriteSold}). Each week it drifts back towards the club’s history level (${Math.round(FAN.historyLevel(d))}).`, `It fills the ground (the gate), sells shirts (merch) and speaks in the Fans voice at Awards Night. Bands: ${FAN_BANDS.map((x) => `${x.name} ${x.min}+`).join(' · ')}.`] });
    const B = BOARD.normaliseBoard(d);
    const rows = BOARD.evaluate(d, d.verdicts?.season ?? null);
    out.push({ title: `The board’s objectives (Year ${B.year ?? FIN.yearOf(today())})`, lines: [face('edith_marlow', rows.length ? 'Edith Marlow: scored at Awards Night, in the Board voice.' : 'Edith Marlow sets two objectives at the start of each season.')], bars: rows.map((r) => ({ label: r.line, value: r.met ? 1 : 0, max: 1, color: r.met ? C.good : C.progress, text: r.met ? 'On track' : 'Not yet' })) });
    if (B.results.length) out.push({ title: 'Past seasons', lines: B.results.slice(-5).reverse().map((r) => `Year ${r.year}: ${r.met} of ${r.of} met`) });
    return out;
  }

  function financesMenu(tab = ui.tab) {
    const d = run();
    if (!d) return null;
    return {
      title: FIN_TEXT.title,
      subtitle: FIN_TEXT.subtitle,
      art: 'ui_24',
      accent: C.gold,
      tabs: [
        { id: 'money', label: 'Money', sections: moneySections(d) },
        { id: 'sponsors', label: 'Sponsors', badge: SP.openOffers(d).length || null, sections: sponsorSections(d) },
        { id: 'fans', label: 'Fans & Board', sections: fansSections(d) },
      ],
    };
  }
  function openFinances(tab = 'money') {
    ui.msg = null;
    ui.tab = tab;
    sheet.open(() => financesMenu());
    sheet.setTab?.(tab);
  }

  // --- Celeste's offer -------------------------------------------------------------------------------------------------
  function offerMenu(uid) {
    const d = run();
    const o = d ? SP.offerByUid(d, uid) : null;
    if (!o) return financesMenu('sponsors');
    const def = sponsorById(o.id);
    const sl = SP.slotFor(d, o);
    return {
      title: SPONSOR_TEXT.offerTitle(def.name),
      subtitle: `${def.tier} sponsor · ${SPONSOR_TEXT.rep}`,
      art: def.art,
      accent: def.colour,
      tag: o.resign ? { text: 'RE-SIGN', color: C.good } : o.interest ? { text: 'CUP BONUS', color: C.gold } : null,
      sections: [
        { title: 'Celeste Moore', lines: [face('celeste_moore', o.resign ? `They loved working with us. ${def.name} want to go again.` : o.interest ? `${SPONSOR_TEXT.interestLine}` : SPONSOR_TEXT.offerLine)] },
        { title: 'The deal', lines: [{ text: 'Weekly stipend', right: `${fmt(o.stipend)} Credits` }, { text: 'Length', right: `${o.seasons} season${o.seasons === 1 ? '' : 's'}` }, { text: `Benefit: ${def.benefit.text}` }, { text: `Slot: ${SPONSOR_SLOTS.find((s) => s.id === sl.slot).name}${sl.replaces ? ` (replaces ${sponsorById(sl.replaces.id).name}, ending soonest — no penalty)` : ''}` }] },
        { title: 'Objectives (over the whole deal)', lines: [...o.objectives.map((x) => `• ${SP.objectiveLine(x)}`), 'Met: a bonus at the end and a good chance they re-sign. Missed: a smaller bonus. Nothing worse.'] },
        { columns: 2, buttons: [
          { id: 'sponsorSign', label: 'Sign', sub: `${fmt(o.stipend)} a week`, accent: C.good, onTap: () => act(uid, true) },
          { id: 'sponsorDecline', label: 'Not now', sub: 'Celeste will look elsewhere', accent: C.bad, onTap: () => act(uid, false) },
        ] },
        { lines: [`The offer stays open until ${dateText(o.until)}: close this to decide later (Finances → Sponsors).`] },
      ],
    };
  }
  function act(uid, yes) {
    const d = run();
    const o = SP.offerByUid(d, uid);
    const name = o ? sponsorById(o.id).name : '';
    const r = yes ? SP.accept(d, uid, today()) : SP.decline(d, uid, today());
    ui.msg = r.ok ? (yes ? `${name} signed!${r.replaced ? ` (${sponsorById(r.replaced).name}’s deal ended early.)` : ''}` : `You turned down ${name}.`) : r.why;
    if (r.ok) onChange(yes ? `sponsor:sign:${o.id}` : `sponsor:decline:${o.id}`);
    openFinances('sponsors');
  }
  function openOffer(uid) {
    ui.msg = null;
    sheet.open(() => offerMenu(uid));
  }

  // --- Edith's objectives (one tap) ---------------------------------------------------------------------------------------
  function boardMenu() {
    const d = run();
    if (!d) return null;
    const B = BOARD.normaliseBoard(d);
    return {
      title: BOARD_TEXT.sheetTitle(B.year ?? FIN.yearOf(today())),
      subtitle: BOARD_TEXT.who,
      art: 'ui_05',
      accent: '#1B2A4A',
      sections: [
        { title: 'Edith Marlow', lines: [face('edith_marlow', BOARD_TEXT.sheetLine)] },
        { title: 'This season', lines: B.objectives.map((o, i) => `${i + 1}. ${BOARD.lineOf(o)}`) },
        { lines: ['Missing them makes the board less sure of you — they never sack you.'] },
        { columns: 1, buttons: [{ id: 'boardOk', label: 'Understood', accent: C.progress, onTap: () => { B.toShow = null; onChange('board:seen'); sheet.close(); } }] },
      ],
    };
  }
  function openBoardSheet() {
    sheet.open(() => boardMenu());
  }

  // --- the rescue plan --------------------------------------------------------------------------------------------------
  function rescueMenu() {
    const d = run();
    const R = d ? BOARD.pendingRescue(d) : null;
    if (!R) return financesMenu('money');
    const buttons = [];
    if (R.playerId) buttons.push({ id: 'rescueSell', label: `Sell ${R.playerName}`, sub: `A quick sale: ${fmt(R.fee)} Credits`, accent: C.gold, onTap: () => rescue('sell') });
    if (R.sponsor) buttons.push({ id: 'rescueSponsor', label: `Sign ${sponsorById(R.sponsor).name}`, sub: `${fmt(R.advance)} Credits up front`, accent: C.good, onTap: () => rescue('sponsor') });
    buttons.push({ id: 'rescueLater', label: 'Not now', sub: 'The board is disappointed, nothing more', accent: C.progress, onTap: () => rescue('later') });
    return {
      title: BOARD_TEXT.rescueTitle,
      subtitle: BOARD_TEXT.who,
      art: 'ui_24',
      accent: C.bad,
      sections: [{ title: 'Edith Marlow', lines: [face('edith_marlow', BOARD_TEXT.rescueLine(R.weeks, R.owed))] }, { columns: 1, buttons }],
    };
  }
  function rescue(choice) {
    const d = run();
    const r = BOARD.rescueAccept(d, choice, today(), { sell: onSell });
    ui.msg = r.ok ? (choice === 'later' ? 'The board will wait.' : 'Done: the money goes to the Emergency Credit first.') : r.why;
    onChange(`board:rescue:${choice}`);
    openFinances('money');
  }
  function openRescue() {
    sheet.open(() => rescueMenu());
  }

  return { openFinances, financesMenu, openOffer, offerMenu, openBoardSheet, boardMenu, openRescue, rescueMenu };
}
