// The Transfers sheets (Milestone 11, standard bottom sheets, style guide §3). From the Manager Office, the Squad screen's
// Transfers button and the Scout Desk (Scout Reports). Tabs: Scouting (send the scout, the reports) · Market (Regional
// and wider-market players) · Free (free agents) · Loans · Contracts (your squad's contracts, bids for your players,
// loans, arrivals, recent deals). Players you do not own show stats as ranges and potential as a label + range (narrower
// the more your scout has watched them); generated players wear the code-drawn kit silhouette in their club's colours.
//   createTransferSheets({ sheet, assets, dialog, run, today, dateText, onDeal }) →
//     { openTransfers(tab?), openPlayer(id), openOwn(id), openTalk(kind, id), openBid(id), openExpiring() }
//   run() → the open campaign data or null; today() → the club day; onDeal(reason) → autosave (bible §36)
import { THEME } from '../../../../core/Theme.js';
import * as TR from '../systems/transfers.js';
import * as SC from '../systems/scouting.js';
import { SCOUTING, CONTRACT_TERMS, SQUAD_RULES } from '../../data/transfers.js';
import { CORE, ROLES } from '../../data/players.js';
import { POSITIONS } from '../../data/setup.js';
import { clubById, REGIONAL_CLUBS } from '../../data/fixtures.js';
import { overall } from '../systems/players.js';
import { silhouetteKey } from '../ui/kitArt.js';
import { scoutingFac } from '../systems/effects.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const tick = (on, label) => `${on ? '✓ ' : ''}${label}`;
const KIND_NAMES = { transfer: 'Transfer', free: 'Free transfer', loan: 'Loan', loanOption: 'Loan with option', pre: 'Pre-contract', renew: 'Renew contract' };
const TABS = [
  { id: 'scout', label: 'Scouting' },
  { id: 'market', label: 'Market' },
  { id: 'free', label: 'Free' },
  { id: 'loans', label: 'Loans' },
  { id: 'mine', label: 'Contracts' },
];

export function createTransferSheets({ sheet, assets, dialog, run, today, dateText, onDeal = () => {} }) {
  const ui = { pos: 'any', region: 'free', scoutPos: 'any', msg: null, draft: null, ask: null };
  const data = () => run();
  const T = () => (data() ? TR.normaliseTransfers(data()) : null);
  const colsOf = (owner) => (owner === 'us' ? data().club.colours : owner === 'free' ? { primary: 'white', secondary: 'black' } : owner === 'market' ? { primary: 'navy', secondary: 'white' } : clubById(owner)?.colours ?? { primary: 'black', secondary: 'white' });
  const icon = (p, owner) => (p.founder && p.portrait ? p.portrait : silhouetteKey(assets, colsOf(owner).primary, colsOf(owner).secondary));
  const done = (r, then = () => openTransfers('mine')) => {
    if (r?.ok || r?.deal?.ok) {
      const last = T().log[T().log.length - 1];
      ui.msg = last ? last.text : 'Done.';
      onDeal();
      then();
    } else ui.msg = r?.why ?? r?.deal?.why ?? 'Not possible.';
  };
  const fac = () => scoutingFac(data()); // (M13) research: shorter reports / closer looks, more players (M12: facilities)
  const msgSection = () => (ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []);

  // A player you do not own: the scouting view (ranges, potential label).
  function playerSub(p, owner, extra = '') {
    const k = SC.knowledge(T(), p.id);
    const o = SC.overallRange(p, k);
    const pot = SC.potentialView(p, k);
    return `${p.position} · Age ${p.age} · OVR ${SC.rangeText(o)} · ${pot.label} · ${TR.ownerName(owner)}${extra}`;
  }
  const posFilter = (prefix = 'pos') => ({
    title: 'Position',
    columns: 6,
    buttons: ['any', 'GK', 'DF', 'MF', 'WG', 'FW'].map((x) => ({ id: `${prefix}:${x}`, label: tick(ui.pos === x, x === 'any' ? 'All' : x), accent: C.progress, onTap: () => (ui.pos = x) })),
  });
  const filtered = (list) => list.filter((x) => ui.pos === 'any' || x.p.position === ui.pos).slice(0, 24);
  const playerButtons = (list, extra) =>
    list.map(({ p, owner }) => ({ id: `player:${p.id}`, label: p.name, sub: playerSub(p, owner, extra(p, owner)), icon: icon(p, owner), accent: POSITIONS[p.position].colour, onTap: () => openPlayer(p.id) }));

  // --- the Transfers sheet -----------------------------------------------------------------------------------------------
  function scoutTab() {
    const S = SC.normaliseScouting(T());
    const day = today();
    const reports = S.reports.slice().reverse();
    return [
      ...msgSection(),
      {
        title: `Scout · ${SCOUTING.scout.name}`,
        lines: [SCOUTING.scout.title, S.task ? `Out now: ${SC.taskLine(S.task, day)}.` : `At the desk. A report takes ${SC.reportDays(fac())} days and lists ${SCOUTING.reportSize + fac().extra} players; reports last ${SCOUTING.expiresDays} days.`],
      },
      { title: 'Where to look', columns: 3, buttons: SCOUTING.regions.map((r) => ({ id: `region:${r.id}`, label: tick(ui.region === r.id, r.name), accent: C.progress, onTap: () => (ui.region = r.id) })) },
      { title: 'Position', columns: 6, buttons: SCOUTING.positions.map((x) => ({ id: `spos:${x}`, label: tick(ui.scoutPos === x, x === 'any' ? 'All' : x), accent: C.progress, onTap: () => (ui.scoutPos = x) })) },
      {
        buttons: [{ id: 'send', label: 'Send the scout', sub: `${SC.regionById(ui.region).name} · ${ui.scoutPos === 'any' ? 'any position' : ui.scoutPos} · ${SC.reportDays(fac())} days`, accent: C.action, locked: !!S.task, onTap: () => {
          const r = SC.sendScout(T(), { region: ui.region, position: ui.scoutPos }, today(), fac());
          ui.msg = r.ok ? `${SCOUTING.scout.name} is on his way: back in ${SC.reportDays(fac())} days.` : r.why;
          if (r.ok) onDeal();
        } }],
        columns: 1,
      },
      ...(reports.length
        ? reports.map((r) => ({
            title: `Report: ${SC.regionById(r.region).name} · ${r.position === 'any' ? 'any position' : r.position}`,
            lines: [`Until ${dateText(r.until)}.`, ...(r.ids.length ? [] : ['Nobody there fits right now: try another region or position.'])],
            columns: 1,
            buttons: playerButtons(r.ids.map((id) => TR.locate(data(), id)).filter((x) => x.p && x.owner !== 'us'), () => ''),
          }))
        : [{ title: 'Scout Reports', lines: ['No reports yet. Send the scout to a region.'] }]),
    ];
  }
  function mineTab() {
    const d = data();
    const day = today();
    const bids = TR.openBids(d);
    const exp = TR.expiring(d).filter((p) => !p.founder);
    const tt = T();
    const sorted = d.squad.players.slice().sort((a, b) => (a.contract?.years ?? 0) - (b.contract?.years ?? 0) || overall(b) - overall(a));
    return [
      ...msgSection(),
      {
        title: 'My Contracts',
        lines: [
          `Credits ${fmt(TR.credits(d))} (placeholder until the club's money arrives)`,
          `Wages ${fmt(TR.wageBill(d))} a week · board support ${fmt(TR.wageSupport(d))} a week (placeholder)`,
          `Squad ${TR.squadCount(d)} of ${SQUAD_RULES.max} (at least ${SQUAD_RULES.min}: 2 GK, 5 DF, 4 MF/WG, 3 FW/WG)`,
        ],
      },
      ...(bids.length
        ? [{ title: 'Offers for your players', columns: 1, buttons: bids.map((b) => {
            const p = d.squad.players.find((x) => x.id === b.playerId);
            return { id: `bid:${b.id}`, label: `${TR.ownerName(b.clubId)} bid ${fmt(b.talk.ask.fee)} for ${p?.name ?? '?'}`, sub: `Valued about ${fmt(p ? TR.valueOf(d, p, 'us') : 0)} · open ${Math.max(0, b.until - day)} more day${b.until - day === 1 ? '' : 's'}`, icon: p ? icon(p, 'us') : undefined, accent: C.gold, onTap: () => openBid(b.id) };
          }) }]
        : []),
      ...(exp.length ? [{ title: 'Final year: renew or they leave at the season’s end', columns: 1, buttons: exp.map((p) => ({ id: `own:${p.id}`, label: p.name, sub: `${p.position} · Age ${p.age} · OVR ${overall(p)} · ${fmt(p.contract.salary)} a week`, icon: icon(p, 'us'), accent: C.bad, onTap: () => openOwn(p.id) })) }] : []),
      ...(tt.loanedOut.length || d.squad.players.some((p) => p.loan) || tt.pending.length
        ? [{
            title: 'Loans and arrivals',
            lines: [
              ...d.squad.players.filter((p) => p.loan).map((p) => `${p.name}: on loan from ${TR.ownerName(p.loan.from)} until ${dateText(p.loan.until)}${p.loan.optionPrice ? ` · option ${fmt(p.loan.optionPrice)}` : ''}`),
              ...tt.loanedOut.map((l) => `${TR.locate(d, l.id).p?.name ?? '?'}: loaned to ${TR.ownerName(l.clubId)} until ${dateText(l.until)}`),
              ...tt.pending.map((x) => `${TR.locate(d, x.id).p?.name ?? '?'}: joins from ${TR.ownerName(x.from)} on ${dateText(x.joinDay)} (pre-contract)`),
            ],
          }]
        : []),
      { title: 'Squad contracts', columns: 1, buttons: sorted.map((p) => ({ id: `own:${p.id}`, label: `${p.name}${tt.listed.includes(p.id) ? ' · for sale' : ''}`, sub: `${p.position} · OVR ${overall(p)} · ${p.loan ? 'on loan' : `${p.contract.years} yr${p.contract.years === 1 ? '' : 's'}`} · ${fmt(p.contract.salary)}/wk · ${p.contract.role}`, icon: icon(p, 'us'), accent: p.founder ? C.purple : C.progress, onTap: () => openOwn(p.id) })) },
      { title: 'Recent deals', lines: tt.log.length ? tt.log.slice(-8).reverse().map((l) => `${dateText(l.day)}: ${l.text}`) : ['None yet.'] },
    ];
  }
  function transfersMenu() {
    if (!T()) return null;
    const d = data();
    const bids = TR.openBids(d).length;
    const exp = TR.expiring(d).filter((p) => !p.founder).length;
    const tabs = TABS.map((t) => ({ ...t, badge: t.id === 'mine' && bids + exp ? bids + exp : null }));
    const sections = {
      scout: scoutTab,
      market: () => [...msgSection(), { title: 'Market', lines: ['Regional club players and players beyond the region. Ranges narrow as your scout watches them.'] }, posFilter(), { columns: 1, buttons: playerButtons(filtered(TR.marketList(d)), (p, o) => ` · about ${fmt(TR.valueOf(d, p, o))} Cr`) }],
      free: () => [...msgSection(), { title: 'Free Agents', lines: ['Out of contract: no fee, just wages and a signing bonus.'] }, posFilter(), { columns: 1, buttons: playerButtons(filtered(TR.freeList(d)), (p) => ` · about ${fmt(p.contract.salary)}/wk`) }],
      loans: () => [...msgSection(), { title: 'Loans', lines: [`Half a season (${168} days). You pay his wages and a small fee; a loan with option fixes a price to buy him.`] }, posFilter('lpos'), { columns: 1, buttons: playerButtons(filtered(TR.loanable(d)), (p) => ` · ${fmt(p.contract.salary)}/wk`) }],
      mine: mineTab,
    };
    return {
      title: 'Transfers',
      subtitle: `Credits ${fmt(TR.credits(d))} · squad ${TR.squadCount(d)} / ${SQUAD_RULES.max}`,
      art: 'facility_f04',
      accent: C.gold,
      tag: { text: 'PLACEHOLDER CREDITS', color: C.gold },
      tabs: tabs.map((t) => ({ ...t, sections: sections[t.id]() })),
    };
  }
  function openTransfers(tab = 'market') {
    sheet.open(() => transfersMenu(), { tab });
  }

  // --- a player you could sign --------------------------------------------------------------------------------------------
  function playerMenu(id) {
    const d = data();
    if (!d) return null;
    const { p, owner } = TR.locate(d, id);
    if (!p) return { title: 'Gone', subtitle: 'This player has moved on.', art: 'facility_f04', sections: [{ buttons: [{ id: 'back', label: '‹ Transfers', accent: C.progress, onTap: () => openTransfers(ui.lastTab ?? 'market') }] }] };
    if (owner === 'us') return ownMenu(id);
    const tt = T();
    const k = SC.knowledge(tt, id);
    const day = today();
    const pot = SC.potentialView(p, k);
    const kinds = ['free', 'transfer', 'loan', 'loanOption', 'pre'].filter((kind) => !TR.canTalk(d, kind, p, owner, day));
    const why = owner === 'free' ? TR.canTalk(d, 'free', p, owner, day) : TR.canTalk(d, 'transfer', p, owner, day);
    return {
      title: p.name,
      subtitle: `${POSITIONS[p.position].name} · Age ${p.age} · ${p.tier} · ${TR.ownerName(owner)}`,
      art: icon(p, owner),
      accent: POSITIONS[p.position].colour,
      tag: { text: owner === 'free' ? 'FREE AGENT' : owner === 'market' ? 'MARKET' : 'REGIONAL' },
      sections: [
        ...msgSection(),
        {
          title: `Scouting · ${Math.round(k * 100)}% known`,
          lines: [`Overall ${SC.rangeText(SC.overallRange(p, k))} · Potential ${pot.label} (${pot.low}–${pot.high})`, `Trait: ${k >= 0.4 ? p.trait : 'scout him to find out'}`, ...CORE.map((s) => `${s}  ${SC.rangeText(SC.statRange(p, k, s))}`)],
          columns: 1,
          buttons: k < 1 ? [{ id: 'closer', label: 'Scout him closer', sub: `${SC.closerDaysOf(fac())} days: narrower ranges`, accent: C.progress, locked: !!tt.scouting.task, onTap: () => {
            const r = SC.lookCloser(tt, id, today(), fac());
            ui.msg = r.ok ? `${SCOUTING.scout.name} will watch ${p.name} for ${SC.closerDaysOf(fac())} days.` : r.why;
            if (r.ok) onDeal();
          } }] : [],
        },
        {
          title: 'Contract and value',
          lines: [owner === 'free' ? `Free agent · last wage about ${fmt(p.contract.salary)} a week` : `${p.contract.years} year${p.contract.years === 1 ? '' : 's'} left · ${fmt(p.contract.salary)} a week`, `Valued about ${fmt(TR.valueOf(d, p, owner))} Credits`, ...(why && !kinds.length ? [why] : [])],
        },
        {
          title: 'Make a deal',
          columns: 1,
          buttons: [
            ...kinds.map((kind) => ({ id: `deal:${kind}`, label: KIND_NAMES[kind], sub: kindSub(kind), accent: kind === 'pre' ? C.purple : kind.startsWith('loan') ? C.progress : C.action, onTap: () => openTalk(kind, id) })),
            { id: 'back', label: '‹ Transfers', accent: C.progress, onTap: () => openTransfers(ui.lastTab ?? 'market') },
          ],
        },
      ],
    };
  }
  const kindSub = (kind) =>
    ({
      free: 'No fee: wages and a signing bonus',
      transfer: 'A fee to his club, then his contract',
      loan: `Half a season: a small fee, you pay his wages`,
      loanOption: 'A loan with a fixed price to buy him',
      pre: 'Final contract year: he joins free at the season’s end',
    })[kind];
  function openPlayer(id) {
    ui.lastTab = sheet.tab ?? ui.lastTab;
    ui.msg = null;
    sheet.open(() => playerMenu(id));
  }

  // --- negotiation --------------------------------------------------------------------------------------------------------
  function talkMenu(kind, id) {
    const d = data();
    const talk = TR.talkOf(d, kind, id);
    const { p, owner } = TR.locate(d, id);
    if (!p || !ui.draft) return null;
    const o = ui.draft;
    const a = talk?.ask;
    const open = talk?.state === 'open';
    const loan = kind === 'loan' || kind === 'loanOption';
    const step = (v, pct, min) => Math.max(min, Math.round((v * pct) / min) * min);
    const bump = (key, dir, min) => () => (o[key] = Math.max(0, o[key] + dir * step(Math.max(o[key], a?.[key] ?? 0, min), 0.05, min)));
    const last = talk?.last;
    const sections = [
      ...msgSection(),
      {
        title: 'Their position',
        lines: [
          ...(a?.fee ? [`${loan ? 'Loan fee' : 'Fee'}: ${TR.ownerName(owner)} want ${fmt(a.fee)} Credits`] : []),
          ...(a?.salary ? [`Wages: he wants about ${fmt(a.salary)} a week as a ${talk.role}${o.role !== talk.role ? ` (more as a ${o.role})` : ''}`] : loan ? [`Wages: you pay his ${fmt(p.contract.salary)} a week`] : []),
          ...(a?.bonus ? [`Signing bonus: about ${fmt(a.bonus)}`] : []),
          ...(a?.years ? [`Contract: ${a.years[0]}–${a.years[1]} years`] : []),
          open ? `Counteroffers so far: ${talk.counters} (they counter 1–3 times at most, then it is a final answer)` : 'The talks are over.',
          ...(last ? [`Last answer: ${last.why}`] : []),
        ],
      },
    ];
    if (open) {
      sections.push(
        ...(a.fee ? [{ title: `${loan ? 'Loan fee' : 'Fee'}: ${fmt(o.fee)} Credits`, columns: 2, buttons: [{ id: 'fee-', label: '− Fee', accent: C.progress, onTap: bump('fee', -1, 10) }, { id: 'fee+', label: '+ Fee', accent: C.progress, onTap: bump('fee', 1, 10) }] }] : []),
        ...(!loan ? [{ title: `Wages: ${fmt(o.salary)} a week`, columns: 2, buttons: [{ id: 'sal-', label: '− Wages', accent: C.progress, onTap: bump('salary', -1, 10) }, { id: 'sal+', label: '+ Wages', accent: C.progress, onTap: bump('salary', 1, 10) }] }] : []),
        ...(a.bonus ? [{ title: `Signing bonus: ${fmt(o.bonus)}`, columns: 2, buttons: [{ id: 'bonus-', label: '− Bonus', accent: C.progress, onTap: bump('bonus', -1, 10) }, { id: 'bonus+', label: '+ Bonus', accent: C.progress, onTap: bump('bonus', 1, 10) }] }] : []),
        ...(kind !== 'loan' ? [{ title: kind === 'loanOption' ? 'Years if you buy him' : 'Years', columns: 5, buttons: [1, 2, 3, 4, 5].map((y) => ({ id: `years:${y}`, label: tick(o.years === y, String(y)), accent: C.progress, onTap: () => (o.years = y) })) }] : []),
        { title: 'Squad role', columns: 4, buttons: ROLES.map((r) => ({ id: `role:${r}`, label: tick(o.role === r, r), accent: C.progress, onTap: () => (o.role = r) })) },
        ...(!loan ? [{ title: 'Release clause', columns: 4, buttons: CONTRACT_TERMS.releaseClause.options.map((x) => ({ id: `clause:${x}`, label: tick(o.clause === x, x ? `×${x} value` : 'None'), accent: C.progress, onTap: () => (o.clause = x) })) }] : []),
        {
          columns: 1,
          buttons: [
            { id: 'offer', label: 'Make offer', sub: offerLine(kind, o), accent: C.action, onTap: () => offer(kind, id, o) },
            ...(last?.result === 'counter' ? [{ id: 'acceptCounter', label: 'Accept their terms', sub: offerLine(kind, last.terms), accent: C.good, onTap: () => done(TR.acceptCounter(d, kind, id, today())) }] : []),
            { id: 'walk', label: 'Walk away', accent: C.progress, onTap: () => {
              TR.walkAway(d, kind, id);
              kind === 'renew' ? openOwn(id) : openPlayer(id);
            } },
          ],
        },
      );
    } else sections.push({ columns: 1, buttons: [{ id: 'back', label: '‹ Back', accent: C.progress, onTap: () => (kind === 'renew' ? openOwn(id) : openPlayer(id)) }] });
    return { title: KIND_NAMES[kind], subtitle: `${p.name} · ${TR.ownerName(owner)} · Credits ${fmt(TR.credits(d))}`, art: icon(p, owner), accent: C.action, tag: { text: 'NEGOTIATION', color: C.action }, sections };
  }
  const offerLine = (kind, o) => [o.fee ? `${fmt(o.fee)} Cr` : null, kind.startsWith('loan') ? null : `${fmt(o.salary)}/wk`, o.bonus ? `bonus ${fmt(o.bonus)}` : null, o.years && kind !== 'loan' ? `${o.years} yr` : null, o.role].filter(Boolean).join(' · ');
  function offer(kind, id, o) {
    const r = TR.makeOffer(data(), kind, id, { ...o }, today());
    if (r.result === 'accept') return done(r.deal?.ok ? r : { ok: false, why: r.deal?.why });
    ui.msg = r.result === 'counter' ? r.why : r.result === 'refused' ? r.why : `${r.why} The talks are over for now.`;
    if (r.result === 'counter') Object.assign(o, { ...r.terms });
  }
  function openTalk(kind, id) {
    const r = TR.openTalk(data(), kind, id, today());
    if (!r.ok) {
      ui.msg = r.why;
      return;
    }
    ui.draft = TR.startingOffer(data(), r.talk);
    ui.msg = null;
    sheet.open(() => talkMenu(kind, id));
  }

  // --- your own player ----------------------------------------------------------------------------------------------------
  function ownMenu(id) {
    const d = data();
    const p = d.squad.players.find((x) => x.id === id);
    if (!p) return { title: 'Gone', subtitle: 'No longer in your squad.', art: 'facility_f04', sections: [{ buttons: [{ id: 'back', label: '‹ Contracts', accent: C.progress, onTap: () => openTransfers('mine') }] }] };
    const c = p.contract;
    const listed = T().listed.includes(id);
    const lock = p.founder ? 'The Founder stays with the club.' : p.loan ? `On loan from ${TR.ownerName(p.loan.from)}.` : null;
    return {
      title: p.name,
      subtitle: `${POSITIONS[p.position].name} · Age ${p.age} · OVR ${overall(p)} · valued about ${fmt(TR.valueOf(d, p, 'us'))} Credits`,
      art: icon(p, 'us'),
      accent: POSITIONS[p.position].colour,
      tag: p.founder ? { text: 'FOUNDER', color: C.purple } : { text: c.role.toUpperCase() },
      sections: [
        ...msgSection(),
        {
          title: 'Contract',
          lines: [
            p.loan ? `On loan from ${TR.ownerName(p.loan.from)} until ${dateText(p.loan.until)} · ${fmt(c.salary)} a week` : `${c.role} · ${c.years} year${c.years === 1 ? '' : 's'} left · ${fmt(c.salary)} a week${c.years <= 1 ? ' · final year: he leaves at the season’s end unless renewed' : ''}`,
            ...(c.clause ? [`Release clause ${fmt(c.clause)} Credits: a club that pays it can take him.`] : []),
            ...(c.promised ? [`Promised a ${c.role} role: he loses morale when left out.`] : []),
            `Morale ${Math.round(p.morale ?? 50)} · Potential ${p.potential.low}–${p.potential.high}`,
            ...(lock ? [lock] : []),
          ],
        },
        {
          columns: 1,
          buttons: [
            ...(!p.loan ? [{ id: 'renew', label: 'Renew contract', sub: 'Wages, years, role, clause', accent: C.action, onTap: () => openTalk('renew', id) }] : []),
            ...(p.loan?.optionPrice ? [{ id: 'option', label: `Buy him: ${fmt(p.loan.optionPrice)} Credits`, sub: 'Take the loan option', accent: C.good, onTap: () => done(TR.exerciseOption(d, id, today()), () => openOwn(id)) }] : []),
            ...(!lock
              ? [
                  { id: listed ? 'unlist' : 'list', label: listed ? 'Take off the transfer list' : 'List for sale', sub: listed ? 'No more bids' : 'Clubs make bids in the next days', accent: C.gold, onTap: () => {
                    const r = TR.listForSale(d, id, !listed);
                    ui.msg = r.ok ? (listed ? `${p.name} is off the list.` : `${p.name} is listed: bids will come in the Contracts tab.`) : r.why;
                    if (r.ok) onDeal();
                  } },
                  { id: 'loanout', label: 'Loan out', sub: 'Half a season at a Regional club', accent: C.progress, onTap: () => openLoanOut(id) },
                  { id: 'release', label: `Release (payout ${fmt(TR.releasePayout(p))})`, sub: `${CONTRACT_TERMS.payoutWeeksPerYear} weeks' wages per year left`, accent: C.bad, onTap: () => confirmRelease(id) },
                ]
              : []),
            { id: 'back', label: '‹ Contracts', accent: C.progress, onTap: () => openTransfers('mine') },
          ],
        },
      ],
    };
  }
  function openOwn(id) {
    ui.msg = null;
    sheet.open(() => ownMenu(id));
  }
  function confirmRelease(id) {
    const p = data().squad.players.find((x) => x.id === id);
    if (!p) return;
    const why = TR.rosterProblem(data().squad.players.filter((x) => x !== p));
    if (why) {
      ui.msg = why;
      return;
    }
    dialog.confirm({
      title: `Release ${p.name}?`,
      body: `He leaves now as a free agent. His payout is ${fmt(TR.releasePayout(p))} Credits.`,
      yes: 'Release',
      danger: true,
      onYes: () => done(TR.release(data(), id, today())),
    });
  }
  function openLoanOut(id) {
    const d = data();
    const p = d.squad.players.find((x) => x.id === id);
    sheet.open(() => ({
      title: 'Loan out',
      subtitle: `${p?.name ?? ''} · half a season · they pay his wages`,
      art: p ? icon(p, 'us') : 'facility_f04',
      accent: C.progress,
      sections: [
        ...msgSection(),
        { title: 'Which club?', columns: 1, buttons: [...REGIONAL_CLUBS.map((c) => ({ id: `club:${c.id}`, label: c.name, sub: `${T().clubs[c.id].players.length} players`, icon: c.crest, accent: C.progress, onTap: () => done(TR.loanOut(d, id, c.id, today())) })), { id: 'back', label: '‹ Back', accent: C.progress, onTap: () => openOwn(id) }] },
      ],
    }));
  }

  // --- a bid for your player ----------------------------------------------------------------------------------------------
  function openBid(bidId) {
    const d = data();
    const b0 = T().bids.find((x) => x.id === bidId);
    if (!b0) return;
    ui.ask = Math.round((b0.talk.ask.fee * 1.2) / 50) * 50;
    ui.msg = null;
    sheet.open(() => {
      const b = T().bids.find((x) => x.id === bidId);
      const p = d.squad.players.find((x) => x.id === b?.playerId);
      if (!b || !p) return { title: 'Bid', subtitle: 'This bid is over.', art: 'facility_f04', sections: [...msgSection(), { buttons: [{ id: 'back', label: '‹ Contracts', accent: C.progress, onTap: () => openTransfers('mine') }] }] };
      const open = b.talk.state === 'open';
      return {
        title: `Bid for ${p.name}`,
        subtitle: `${TR.ownerName(b.clubId)} · valued about ${fmt(TR.valueOf(d, p, 'us'))} Credits`,
        art: clubById(b.clubId)?.crest ?? 'facility_f04',
        accent: C.gold,
        tag: { text: 'OFFER', color: C.gold },
        sections: [
          ...msgSection(),
          { title: `Their bid: ${fmt(b.talk.ask.fee)} Credits`, lines: [`Counteroffers so far: ${b.talk.counters} (they raise 1–3 times at most).`, `Open until ${dateText(b.until)}.`] },
          ...(open
            ? [
                { title: `Your price: ${fmt(ui.ask)} Credits`, columns: 2, buttons: [{ id: 'ask-', label: '− Price', accent: C.progress, onTap: () => (ui.ask = Math.max(50, ui.ask - 100)) }, { id: 'ask+', label: '+ Price', accent: C.progress, onTap: () => (ui.ask += 100) }] },
                {
                  columns: 1,
                  buttons: [
                    { id: 'bidAccept', label: `Accept ${fmt(b.talk.ask.fee)}`, accent: C.good, onTap: () => done(TR.acceptBid(d, bidId, today())) },
                    { id: 'bidAsk', label: `Ask for ${fmt(ui.ask)}`, accent: C.action, onTap: () => {
                      const r = TR.respondBid(d, bidId, ui.ask, today());
                      if (r.deal) return done(r.deal);
                      ui.msg = r.why;
                    } },
                    { id: 'bidReject', label: 'Reject', accent: C.bad, onTap: () => {
                      TR.rejectBid(d, bidId);
                      ui.msg = 'Bid rejected.';
                      openTransfers('mine');
                    } },
                  ],
                },
              ]
            : [{ buttons: [{ id: 'back', label: '‹ Contracts', accent: C.progress, onTap: () => openTransfers('mine') }] }]),
        ],
      };
    });
  }

  // --- the season's warning: contracts ending ----------------------------------------------------------------------------
  function openExpiring() {
    const d = data();
    const exp = TR.expiring(d).filter((p) => !p.founder);
    if (!exp.length) return false;
    sheet.open(() => ({
      title: 'Contracts ending',
      subtitle: 'These players leave at the end of the season unless you renew them',
      art: 'facility_f03',
      accent: C.bad,
      tag: { text: 'FINAL YEAR', color: C.bad },
      sections: [
        { columns: 1, buttons: TR.expiring(d).filter((p) => !p.founder).map((p) => ({ id: `own:${p.id}`, label: p.name, sub: `${p.position} · Age ${p.age} · OVR ${overall(p)} · ${p.contract.role}`, icon: icon(p, 'us'), accent: C.bad, onTap: () => openOwn(p.id) })) },
        { buttons: [{ id: 'contracts', label: 'All contracts', accent: C.progress, onTap: () => openTransfers('mine') }], columns: 1 },
      ],
    }));
    return true;
  }

  return { openTransfers, openPlayer, openOwn, openTalk, openBid, openExpiring, ui };
}
