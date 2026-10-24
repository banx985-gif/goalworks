// The Works Gods' sheets (Milestone 20b; style guide §3 bottom sheets and the one-tap dialog).
//   God card — the god's art, a gold DIVINE tag, the blessing in plain words, a player's stat bars (gold past 99), where he
//     is (at the club / waiting at the gates until … / gone until the season's end), and Sign / Appoint / Release.
//   Arrival — a one-tap dialog ("A strange figure is waiting at the club gates…"): Meet them (the card) or Later. Several
//     arrivals queue and show one at a time (pump(), from main.js when the club is free).
//   Rumours — the clues heard (newest first), the gods waiting at the gates, the secrets found with their exact conditions;
//     with ?debug=1 a button per god forces his arrival.
//   createGodSheets({ sheet, dialog, run, account, today, dateText, signGod, releaseGod, onChange, debug })
//     → { openCard(id), cardMenu(id), openRumours(), rumoursMenu(), queueArrival(id), pump(), pending }
import { THEME } from '../../../../core/Theme.js';
import { GODS, GOD_IDS, DIVINE, godById } from '../../data/gods.js';
import { secretForGod } from '../../data/secrets.js';
import { CORE } from '../../data/players.js';
import { roleById } from '../../data/staff.js';
import { POSITIONS } from '../../data/setup.js';
import * as G from '../systems/gods.js';
import { overall } from '../systems/players.js';
import * as SE from '../systems/secrets.js';

const C = THEME.color;
const GOLD = DIVINE.colour;
const CORE_NAMES = { ATK: 'Attack', TEC: 'Technique', PAS: 'Passing', DEF: 'Defence', PHY: 'Physical' };
const roleText = (g) => (g.kind === 'staff' ? `Divine ${roleById(g.role)?.name ?? 'staff'}` : g.kind === 'chairman' ? 'Honorary Chairman' : g.wildcard ? 'Wildcard (any outfield position)' : g.position === 'GK' ? 'Goalkeeper' : 'Forward');

export function createGodSheets({ sheet, dialog, run, account = () => null, today = () => 0, dateText = (d) => `day ${d}`, signGod, releaseGod, onChange = () => {}, debug = false }) {
  const ui = { msg: null };
  const queue = [];
  const msgSection = () => (ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []);

  function whereLine(d, id) {
    const g = godById(id);
    if (G.godAtClub(d, id)) return g.kind === 'player' ? 'In your squad.' : g.kind === 'staff' ? 'Working as your Divine Physio.' : 'In the Honorary Chairman’s seat.';
    const o = G.offerFor(d, id);
    if (o) return `Waiting at the club gates until ${dateText(o.until)} (${Math.max(0, o.until - today())} days).`;
    const back = d.gods?.returnAt?.[id];
    if (back) return `Gone for now: back after the season’s end (${dateText(back)}).`;
    return 'Not yet found. Listen out for rumours.';
  }

  function cardMenu(id) {
    const d = run();
    const g = godById(id);
    if (!d || !g) return null;
    G.normaliseGods(d);
    const here = G.godAtClub(d, id);
    const offer = G.offerFor(d, id);
    const p = g.kind === 'player' ? G.godPlayer(d, id) ?? G.makeGodPlayer(d, id, today()) : null;
    const sections = [
      ...msgSection(),
      { title: `Blessing · ${g.blessing.name}`, lines: [g.blessing.plain] },
      { title: 'Now', lines: [whereLine(d, id)] },
    ];
    if (p) {
      sections.push({ title: 'Core stats', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: p.stats[k], max: 99, color: POSITIONS[p.position]?.colour ?? C.progress, star: p.cap })) }); // (the gold band past 99 shows against his position colour)
      sections.push({ title: 'A god', lines: ['Ageless: never ages, declines or retires. Wages like the Secret tier: ' + `${p.contract.salary.toLocaleString('en-GB')} Credits a week.`] });
    } else if (g.kind === 'staff') sections.push({ title: 'A god', lines: [`Takes your Physio’s seat (your Physio leaves, with their release pay). Wage ${DIVINE.staffWage} Credits a week, no signing fee, and he never leaves on his own.`] });
    else sections.push({ title: 'A god', lines: ['His own seat on the Staff screen. No wage: he says money follows him around anyway.'] });
    if (here) {
      sections.push({ columns: 1, buttons: [{ id: 'godRelease', label: `Release ${g.name}`, sub: 'He leaves the game and comes back after the next season’s end', accent: C.bad, onTap: () => askRelease(id) }] });
    } else if (offer || debug) {
      const verb = g.kind === 'player' ? 'Sign' : 'Appoint';
      sections.push({ columns: 1, buttons: [{ id: 'godSign', label: `${verb} ${g.name}`, sub: offer ? `Free · the window closes ${dateText(offer.until)}` : 'Debug: no arrival yet', accent: GOLD, onTap: () => act(id, !offer) }] });
    }
    sections.push({ columns: 1, buttons: [{ id: 'rumours', label: '‹ Rumours', accent: C.progress, onTap: () => openRumours() }] });
    return {
      title: g.name,
      subtitle: `${g.title} · ${roleText(g)} · Divine${p ? ` · Overall ${overall(p)}` : ''}`,
      art: g.art,
      accent: GOLD,
      tag: { text: 'DIVINE', color: GOLD },
      sections,
    };
  }
  function openCard(id) {
    ui.msg = null;
    sheet.open(() => cardMenu(id));
  }
  function act(id, force) {
    if (force) SE.forceArrival(run(), id, today()); // (?debug=1: as if he had just arrived)
    const r = signGod(run(), id, today(), account());
    const g = godById(id);
    ui.msg = r.ok ? `${g.name} has joined the club!` : r.why;
    if (r.ok) onChange(`god:sign:${id}`, r);
  }
  function askRelease(id) {
    const g = godById(id);
    dialog.confirm({
      title: `Release ${g.name}?`,
      body: `${g.name} leaves today (never to another club). He comes back to the gates after the next season’s end.`,
      yes: 'Release',
      danger: true,
      onYes: () => {
        const r = releaseGod(run(), id, today());
        ui.msg = r.ok ? `${g.name} has gone… for now.` : r.why;
        if (r.ok) onChange(`god:release:${id}`, r);
        openCard(id);
      },
    });
  }

  // --- arrivals: one at a time ------------------------------------------------------------------------------------------
  function queueArrival(id, back = false) {
    if (!queue.some((q) => q.id === id)) queue.push({ id, back });
  }
  // Show the next arrival (main.js calls this when the club screen is free: no sheet, no dialog).
  function pump() {
    if (!queue.length || dialog.active) return false;
    const { id, back } = queue.shift();
    const d = run();
    if (!d || !G.offerFor(d, id)) return pump();
    const g = godById(id);
    const s = secretForGod(id);
    dialog.confirm({
      title: back ? `${g.name} is back at the gates` : s.arrival.title,
      body: `${back ? `${g.name}, ${g.title}, has come back.` : s.arrival.line} You have ${DIVINE.window} days to ${g.kind === 'player' ? 'sign' : 'appoint'} ${g.name === 'Jinx' ? 'her' : 'him'}.`,
      art: g.art,
      yes: 'Meet them',
      no: 'Later',
      onYes: () => openCard(id),
    });
    return true;
  }

  // --- Rumours ----------------------------------------------------------------------------------------------------------
  function rumoursMenu() {
    const d = run();
    if (!d) return null;
    G.normaliseGods(d);
    const heard = SE.rumours(d);
    const waiting = GOD_IDS.filter((id) => G.offerFor(d, id));
    const here = G.godsAtClub(d);
    const found = SE.foundRecipes(d, account());
    const sections = [...msgSection()];
    if (waiting.length) sections.push({ title: 'Waiting at the club gates', columns: 1, buttons: waiting.map((id) => ({ id: `god:${id}`, label: `${GODS[id].name}, ${GODS[id].title}`, sub: `${roleText(GODS[id])} · ${Math.max(0, G.offerFor(d, id).until - today())} days to ${GODS[id].kind === 'player' ? 'sign' : 'appoint'}`, icon: GODS[id].art, accent: GOLD, onTap: () => openCard(id) })) });
    if (here.length) sections.push({ title: 'At the club', columns: 1, buttons: here.map((id) => ({ id: `god:${id}`, label: `${GODS[id].name} · ${GODS[id].blessing.name}`, sub: `${roleText(GODS[id])} · tap for the blessing`, icon: GODS[id].art, accent: GOLD, onTap: () => openCard(id) })) });
    sections.push({ title: 'Rumours heard', lines: heard.length ? heard.slice(0, 12).map((r) => `${dateText(r.day)} · ${r.text}`) : ['Nothing yet. Strange things happen at clubs that climb high: keep an ear out.'] });
    if (found.length) sections.push({ title: 'Secrets found (the exact recipe)', lines: found.map((f) => `${f.godName} — ${f.conditions.join('; ')}`) });
    if (debug) sections.push({ title: 'Debug: force an arrival', columns: 3, buttons: GOD_IDS.map((id) => ({ id: `debug:god:${id}`, label: GODS[id].name, accent: GOLD, onTap: () => {
      SE.forceArrival(run(), id, today());
      onChange(`god:debug:${id}`);
      queueArrival(id);
      sheet.close();
      pump();
    } })) });
    return { title: 'Rumours', subtitle: 'Whispers around the club · M28 brings the full Rumour Archive', art: 'ui_28', accent: C.purple, sections };
  }
  function openRumours() {
    ui.msg = null;
    sheet.open(() => rumoursMenu());
  }

  return { openCard, cardMenu, openRumours, rumoursMenu, queueArrival, pump, get pending() { return queue.length; } };
}
