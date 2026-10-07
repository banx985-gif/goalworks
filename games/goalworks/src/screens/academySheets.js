// The Academy sheets (Milestone 15, bible §10; style guide §3 bottom sheets). From the Club Menu (Academy), the Youth
// Corner / Academy Building / Elite Academy sheets and the hint line.
//   Academy — the trials when they are open (the candidates with their potential as a range and a label; Sign, up to 3
//     from one intake), the academy session, the academy squad (each prospect's range, retraining, mentor, loan), how
//     potential is read now (the range's width and what narrows it) and the past intakes. No Youth Corner: what to build.
//   Prospect card — stats, the potential range + label (never the exact number), a breakthrough, training, and the
//     actions: Promote (Prospect contract), Loan out (a Regional club), Retrain (a new position), Mentor (a senior of the
//     same position), Individual focus, Release (asks first).
//   Candidate card — the trial player's stats, range and label, where he came from (the watch list), Sign.
//   createAcademySheets({ sheet, dialog, assets, run, today, dateText, onChange, onBuild, onYouthCoach })
//     → { openAcademy(), openProspect(id), openCandidate(id), academyMenu() }
import { THEME } from '../../../../core/Theme.js';
import { POSITIONS } from '../../data/setup.js';
import { CORE, CORE_NAMES, POSITION_ORDER } from '../../data/players.js';
import { FOCUSES, focusById } from '../../data/training.js';
import { INTAKE, AGES, ACADEMY_TEXT, REVEAL } from '../../data/academy.js';
import { REGIONAL_CLUBS } from '../../data/fixtures.js';
import { overall } from '../systems/players.js';
import { silhouetteKey } from '../ui/kitArt.js';
import { retrainRate } from '../systems/training.js';
import * as AC from '../systems/academy.js';
import { inRole } from '../systems/staff.js';

const C = THEME.color;
const days = (n) => `${n} day${n === 1 ? '' : 's'}`;

export function createAcademySheets({ sheet, dialog, assets, run, today = () => 0, dateText = () => '', onChange = () => {}, onBuild = () => {}, onYouthCoach = () => {} }) {
  const ui = { msg: null };
  const msgSection = () => (ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []);
  const icon = () => {
    const c = run()?.club?.colours ?? { primary: 'green', secondary: 'white' };
    return silhouetteKey(assets, c.primary, c.secondary);
  };
  const rangeLine = (d, p) => {
    const r = AC.rangeOf(d, p, today());
    return `Potential ${r.low === r.high ? r.low : `${r.low}–${r.high}`} · ${r.label}`;
  };
  const playerSub = (d, p, extra = '') => `${p.position} · Age ${p.age} · OVR ${overall(p)} · ${rangeLine(d, p)}${extra}`;
  // the best academy facility on the ground (the Youth Corner when there is none)
  const art = (d) => `facility_${(['F26', 'F14', 'F09'].find((id) => d.facilities?.placement?.some((x) => x.def === id)) ?? 'F09').toLowerCase()}`;
  const home = (d, id) => d.academy?.players.find((p) => p.id === id) ?? null;

  // --- the Academy sheet -------------------------------------------------------------------------------------------------
  function academyMenu() {
    const d = run();
    if (!d) return null;
    const A = AC.normaliseAcademy(d, today());
    const day = today();
    const places = AC.placesOf(d);
    const sections = [...msgSection()];
    if (!AC.hasCorner(d) && !places) sections.push({ title: 'No academy yet', lines: [ACADEMY_TEXT.noCorner, ACADEMY_TEXT.trialsMonth], columns: 1, buttons: [{ id: 'build', label: 'Build a Youth Corner', sub: 'Build → Shop · Club Rank E', icon: 'facility_f09', accent: C.action, onTap: () => onBuild() }] });
    // the trials
    const I = A.intake;
    if (I?.candidates && AC.intakeOpen(d, day)) {
      const left = INTAKE.signMax - I.signed.length;
      sections.push({
        title: `Trials · Year ${I.year}${I.golden ? ' · a golden generation!' : ''}`,
        lines: [`${I.candidates.length} young player${I.candidates.length === 1 ? '' : 's'} at the trials · sign up to ${left} more · closes in ${days(I.closes - day + 1)}`, `Academy places: ${AC.academyCount(d)} of ${places} used`],
        columns: 1,
        buttons: I.candidates.map((p) => ({ id: `cand:${p.id}`, label: `${p.name}${p.youth.fromWatch ? ' · watch list' : ''}`, sub: playerSub(d, p), icon: icon(), accent: POSITIONS[p.position].colour, onTap: () => openCandidate(p.id) })),
      });
    } else if (I && !I.candidates) sections.push({ title: `Trials · Year ${I.year}`, lines: [`The trials are on until ${dateText(I.closes)}, but there is no Youth Corner to hold them.`, ACADEMY_TEXT.noCorner] });
    else {
      const w = AC.nextWindow(d, day);
      sections.push({ title: 'Trials', lines: [`Next trials: ${dateText(w.opens)} (in ${days(Math.max(0, w.opens - day))}).`, `${ACADEMY_TEXT.trialsMonth} Sign up to ${INTAKE.signMax} from each.`] });
    }
    // the session
    sections.push({ title: 'Academy session', lines: [`Every training day (the seniors’ day off is theirs too). ${inRole(d, 'YC') ? `${inRole(d, 'YC').name} runs it.` : 'No Youth Coach yet.'}`], columns: 1, buttons: [{ id: 'session', label: `Session: ${focusById(A.focus).name}`, sub: 'Tap to change the academy’s team session', icon: focusById(A.focus).art, accent: C.purple, onTap: () => openSessionPicker() }] });
    // the squad
    const away = AC.loanedOut(d);
    sections.push({
      title: `Academy squad · ${AC.academyCount(d)} of ${places} places`,
      lines: A.players.length || away.length ? [] : ['Nobody yet. Sign young players at the trials.'],
      columns: 1,
      buttons: [
        ...A.players.slice().sort((a, b) => POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position) || b.age - a.age).map((p) => ({
          id: `pro:${p.id}`,
          label: `${p.name}${p.retrain ? ` · → ${p.retrain.to}` : ''}${p.mentor ? ' · mentored' : ''}`,
          sub: playerSub(d, p, p.age >= AGES.maxAge ? ` · leaves at the season’s end unless promoted` : ''),
          icon: icon(),
          accent: POSITIONS[p.position].colour,
          onTap: () => openProspect(p.id),
        })),
        ...away.map(({ p, clubId, until }) => ({ id: `pro:${p.id}`, label: `${p.name} · on loan`, sub: `${p.position} · Age ${p.age} · OVR ${overall(p)} · at ${REGIONAL_CLUBS.find((c) => c.id === clubId)?.name ?? clubId} until ${dateText(until)}`, icon: icon(), accent: C.textMuted, disabled: true, onTap: () => {} })),
      ],
    });
    // how potential is read
    const a = AC.accuracy(d, null, day);
    sections.push({
      title: 'Reading potential',
      lines: [`New faces: ranges about ${AC.widthOf(a)} wide (narrowest ${REVEAL.minWidth}). ${!inRole(d, 'YC') ? ACADEMY_TEXT.noYouthCoach : `Youth Coach ${inRole(d, 'YC').name}.`}`, 'The Scout, an Academy Building, an Elite Academy, their levels and research narrow it; each season at the academy too. A rare breakthrough can beat the range.'],
      columns: 1,
      buttons: !inRole(d, 'YC') ? [{ id: 'hireYC', label: 'Hire a Youth Coach', sub: 'Staff · Youth Coach', icon: 'ui_02', accent: C.purple, onTap: () => onYouthCoach() }] : [],
    });
    if (A.history.length) sections.push({ title: 'Past trials', lines: A.history.slice(-4).reverse().map((h) => (h.missed ? `Year ${h.year}: missed (no Youth Corner)` : `Year ${h.year}: ${h.count} at the trials${h.golden ? ' (golden)' : ''} · signed ${h.signed.length ? h.signed.join(', ') : 'nobody'}`)) });
    return {
      title: 'Academy',
      subtitle: places ? `${AC.academyCount(d)} of ${places} places · ${inRole(d, 'YC') ? `Youth Coach ${inRole(d, 'YC').name}` : 'no Youth Coach'}` : 'Young players, 15–18 at the yearly trials',
      art: art(d),
      accent: C.good,
      sections,
    };
  }
  function openAcademy() {
    ui.msg = null;
    sheet.open(() => academyMenu());
  }

  // --- a trial player ----------------------------------------------------------------------------------------------------
  function candidateMenu(id) {
    const d = run();
    const p = d?.academy?.intake?.candidates?.find((x) => x.id === id);
    if (!p) return { title: 'Gone', subtitle: 'No longer at the trials.', art: 'facility_f09', sections: [...msgSection(), { columns: 1, buttons: [{ id: 'back', label: '‹ Academy', accent: C.progress, onTap: () => openAcademy() }] }] };
    const why = AC.canSign(d, id, today());
    const r = AC.rangeOf(d, p, today());
    return {
      title: p.name,
      subtitle: `${POSITIONS[p.position].name} · Age ${p.age} · ${p.tier} · Overall ${overall(p)}`,
      art: icon(),
      accent: POSITIONS[p.position].colour,
      tag: { text: 'AT THE TRIALS', color: C.good },
      sections: [
        ...msgSection(),
        { title: 'Potential', lines: [`${r.low}–${r.high} · ${r.label}`, `Read to about ±${Math.ceil(r.width / 2)}: the exact number stays hidden.`, ...(p.youth.fromWatch ? ['On your youth watch list since the club began.'] : []), ...(p.youth.regenOf ? [`A new face in the mould of ${p.youth.regenOf}, who retired from your club.`] : [])] }, // (M16) a regen
        { title: 'Core stats', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: p.stats[k], max: 100, color: POSITIONS[p.position].colour })) },
        { title: 'Trait', lines: [p.trait] },
        { columns: 1, buttons: [
          { id: 'sign', label: `Sign ${p.name}`, sub: why ?? `Joins the academy today · ${INTAKE.signMax - d.academy.intake.signed.length} signing${INTAKE.signMax - d.academy.intake.signed.length === 1 ? '' : 's'} left from these trials`, accent: C.good, disabled: !!why, onTap: () => act(AC.sign(run(), id, today()), 'academy:sign', () => openAcademy()) },
          { id: 'back', label: '‹ Academy', accent: C.progress, onTap: () => openAcademy() },
        ] },
      ],
    };
  }
  function openCandidate(id) {
    ui.msg = null;
    sheet.open(() => candidateMenu(id));
  }

  // --- a prospect --------------------------------------------------------------------------------------------------------
  function prospectMenu(id) {
    const d = run();
    const p = d ? home(d, id) : null;
    if (!p) return { title: 'Not at the academy', subtitle: 'Promoted, loaned out or gone.', art: 'facility_f09', sections: [...msgSection(), { columns: 1, buttons: [{ id: 'back', label: '‹ Academy', accent: C.progress, onTap: () => openAcademy() }] }] };
    const r = AC.rangeOf(d, p, today());
    const m = AC.mentorOf(d, p);
    const promoteWhy = AC.canPromote(d, p);
    const train = p.today?.kind === 'train' ? `+${Math.round(p.today.xp)} XP today` : p.today?.kind === 'dayoff' ? 'day off today' : 'trains every day';
    const rate = p.retrain ? retrainRate(p, [{ focus: p.focus ?? d.academy.focus, share: 1 }], d) : 0;
    const retrainLine = p.retrain ? `Retraining as a ${POSITIONS[p.retrain.to].name}: ${Math.round(p.retrain.progress * 100)}%${rate > 0 ? ` · about ${Math.ceil((1 - p.retrain.progress) / rate)} training days left` : ''}${(p.focus ?? d.academy.focus) === 'position' ? '' : ' (faster in Position Learning)'}` : null;
    return {
      title: p.name,
      subtitle: `${POSITIONS[p.position].name} · Age ${p.age} · ${p.tier} · Overall ${overall(p)}`,
      art: icon(),
      accent: POSITIONS[p.position].colour,
      tag: { text: 'ACADEMY', color: C.good },
      sections: [
        ...msgSection(),
        { title: 'Potential', lines: [`${r.low}–${r.high} · ${r.label}`, ...(p.youth.breakthrough > 0 ? [ACADEMY_TEXT.breakthrough(p.name)] : []), `Signed from the Year ${p.youth.intakeYear} trials${p.youth.fromWatch ? ' (the watch list)' : ''}.`] },
        { title: 'Training', lines: [`Academy session ${focusById(d.academy.focus).name}${p.focus ? ` + ${focusById(p.focus).name}` : ''} · ${train} · ×${AC.xpMultOf(d, p).toFixed(2)} academy XP`, ...(retrainLine ? [retrainLine] : []), m ? `Mentor: ${m.name} (${m.position}, OVR ${overall(m)})` : 'No mentor.', ...(p.age >= AGES.maxAge ? [`He is ${p.age}: he leaves the academy at the season’s end unless promoted.`] : [])] },
        { title: 'Core stats', bars: CORE.map((k) => ({ label: `${k} · ${CORE_NAMES[k]}`, value: p.stats[k], max: 100, color: POSITIONS[p.position].colour })) },
        { title: 'Trait', lines: [p.trait] },
        {
          title: 'Actions',
          columns: 2,
          buttons: [
            { id: 'promote', label: 'Promote', sub: promoteWhy ?? 'To the senior squad · Prospect contract', accent: C.good, disabled: !!promoteWhy, onTap: () => askPromote(id) },
            { id: 'loan', label: 'Loan out', sub: p.age < AGES.loanMin ? `From age ${AGES.loanMin}` : 'Half a season at a Regional club', accent: C.progress, disabled: p.age < AGES.loanMin, onTap: () => openLoan(id) },
            { id: 'retrain', label: p.retrain ? 'Retraining…' : 'Retrain', sub: p.retrain ? `→ ${p.retrain.to} · ${Math.round(p.retrain.progress * 100)}%` : 'Learn a new position', accent: C.purple, onTap: () => openRetrain(id) },
            { id: 'mentor', label: m ? 'Mentor…' : 'Mentor', sub: m ? m.name : `A senior ${p.position} · +XP`, accent: C.gold, onTap: () => openMentor(id) },
            { id: 'focus', label: 'Individual focus', sub: p.focus ? focusById(p.focus).name : 'Academy session only', accent: C.purple, onTap: () => openFocus(id) },
            { id: 'release', label: 'Release', sub: p.age >= 18 ? 'He becomes a free agent' : 'He joins a local club', accent: C.bad, onTap: () => askRelease(id) },
          ],
        },
        { columns: 1, buttons: [{ id: 'back', label: '‹ Academy', accent: C.progress, onTap: () => openAcademy() }] },
      ],
    };
  }
  function openProspect(id) {
    ui.msg = null;
    sheet.open(() => prospectMenu(id));
  }

  // --- pickers ---------------------------------------------------------------------------------------------------------------
  const back = (id) => ({ id: 'back', label: '‹ Back', accent: C.progress, onTap: () => openProspect(id) });
  function openLoan(id) {
    sheet.open(() => {
      const d = run();
      const p = home(d, id);
      if (!p) return prospectMenu(id);
      return {
        title: `Loan ${p.name}`,
        subtitle: 'Half a season at a Regional club: games for him, no fee either way. He comes back to the academy.',
        art: icon(),
        accent: C.progress,
        sections: [...msgSection(), { title: 'Which club?', columns: 1, buttons: [...REGIONAL_CLUBS.map((c) => {
          const why = AC.canLoan(d, p, c.id);
          return { id: `club:${c.id}`, label: c.name, sub: why ?? `${d.transfers.clubs[c.id].players.length} players · they would take him`, icon: c.crest, accent: C.progress, disabled: !!why, onTap: () => act(AC.loanOut(run(), id, c.id, today()), 'academy:loan', () => openAcademy()) };
        }), back(id)] }],
      };
    });
  }
  function openRetrain(id) {
    sheet.open(() => {
      const d = run();
      const p = home(d, id);
      if (!p) return prospectMenu(id);
      return {
        title: `Retrain ${p.name}`,
        subtitle: `Now ${POSITIONS[p.position].name}. Position Learning (the academy session or his own focus) teaches it fastest; a near position is quicker, in or out of goal slowest.`,
        art: 'training_tactic_08',
        accent: C.purple,
        sections: [...msgSection(), { columns: 1, buttons: [
          ...POSITION_ORDER.filter((x) => x !== p.position).map((to) => ({ id: `to:${to}`, label: `${p.retrain?.to === to ? '✓ ' : ''}${POSITIONS[to].name}`, sub: `As a ${to} now: OVR ${overall(p, to)}`, accent: POSITIONS[to].colour, selected: p.retrain?.to === to, onTap: () => act(AC.setRetrain(run(), id, to), 'academy:retrain', () => openProspect(id)) })),
          ...(p.retrain ? [{ id: 'to:none', label: 'Stop retraining', sub: 'Keeps his position', accent: C.bad, onTap: () => act(AC.setRetrain(run(), id, null), 'academy:retrain', () => openProspect(id)) }] : []),
          back(id),
        ] }],
      };
    });
  }
  function openMentor(id) {
    sheet.open(() => {
      const d = run();
      const p = home(d, id);
      if (!p) return prospectMenu(id);
      const list = AC.mentorsFor(d, p);
      return {
        title: `A mentor for ${p.name}`,
        subtitle: `A senior ${POSITIONS[p.position].name.toLowerCase()} takes him under his wing: more academy XP. One prospect each.`,
        art: icon(),
        accent: C.gold,
        sections: [...msgSection(), { columns: 1, lines: list.length ? [] : [`No senior ${p.position} is free to mentor.`], buttons: [
          ...list.map((s) => ({ id: `mentor:${s.id}`, label: `${p.mentor === s.id ? '✓ ' : ''}${s.name}`, sub: `${s.position} · Age ${s.age} · OVR ${overall(s)}`, accent: C.gold, selected: p.mentor === s.id, onTap: () => act(AC.setMentor(run(), id, s.id), 'academy:mentor', () => openProspect(id)) })),
          ...(p.mentor ? [{ id: 'mentor:none', label: 'No mentor', accent: C.bad, onTap: () => act(AC.setMentor(run(), id, null), 'academy:mentor', () => openProspect(id)) }] : []),
          back(id),
        ] }],
      };
    });
  }
  function openFocus(id) {
    sheet.open(() => {
      const d = run();
      const p = home(d, id);
      if (!p) return prospectMenu(id);
      return {
        title: `${p.name}: individual focus`,
        subtitle: `Academy session: ${focusById(d.academy.focus).name}. An individual focus takes 40% of the day.`,
        art: focusById(p.focus ?? d.academy.focus).art,
        accent: C.purple,
        sections: [{ columns: 1, buttons: [
          { id: 'ind:none', label: `${!p.focus ? '✓ ' : ''}Academy session only`, selected: !p.focus, accent: C.progress, onTap: () => act(AC.setFocus(run(), id, null), 'academy:focus', () => openProspect(id)) },
          ...FOCUSES.filter((f) => !f.rest).map((f) => ({ id: `ind:${f.id}`, label: `${p.focus === f.id ? '✓ ' : ''}${f.name}`, icon: f.art, selected: p.focus === f.id, accent: C.purple, onTap: () => act(AC.setFocus(run(), id, f.id), 'academy:focus', () => openProspect(id)) })),
          back(id),
        ] }],
      };
    });
  }
  function openSessionPicker() {
    sheet.open(() => {
      const d = run();
      if (!d) return null;
      return {
        title: 'Academy session',
        subtitle: 'What the academy trains every day. Position Learning moves retraining fastest.',
        art: focusById(d.academy.focus).art,
        accent: C.purple,
        sections: [{ columns: 1, buttons: [
          ...FOCUSES.filter((f) => !f.rest).map((f) => ({ id: `session:${f.id}`, label: `${d.academy.focus === f.id ? '✓ ' : ''}${f.name}`, icon: f.art, selected: d.academy.focus === f.id, accent: C.purple, onTap: () => act(AC.setAcademyFocus(run(), f.id), 'academy:session', () => openAcademy()) })),
          { id: 'back', label: '‹ Academy', accent: C.progress, onTap: () => openAcademy() },
        ] }],
      };
    });
  }

  // --- confirms and results ---------------------------------------------------------------------------------------------
  function act(r, why, then = null) {
    ui.msg = r.ok ? run()?.academy?.log?.at(-1) ?? 'Done.' : r.why;
    if (r.ok && r.autosave !== false) onChange(why);
    if (r.ok && then) {
      const m = ui.msg;
      then();
      ui.msg = m;
    }
  }
  function askPromote(id) {
    const d = run();
    const p = home(d, id);
    if (!p) return;
    dialog.confirm({
      title: `Promote ${p.name}?`,
      body: `${p.name} joins the senior squad on a Prospect contract (3–5 years, wages from this week). He leaves the academy for good.`,
      yes: 'Promote',
      onYes: () => act(AC.promote(run(), id, today()), 'academy:promote', () => openAcademy()),
    });
  }
  function askRelease(id) {
    const d = run();
    const p = home(d, id);
    if (!p) return;
    dialog.confirm({
      title: `Release ${p.name}?`,
      body: `${p.name} leaves the academy today${p.age >= 18 ? ' and becomes a free agent (any club may sign him)' : ' and joins a local club'}. This can't be undone.`,
      yes: 'Release',
      danger: true,
      onYes: () => act(AC.release(run(), id, today()), 'academy:release', () => openAcademy()),
    });
  }

  return { openAcademy, openProspect, openCandidate, academyMenu, prospectMenu, candidateMenu, get msg() { return ui.msg; } };
}
