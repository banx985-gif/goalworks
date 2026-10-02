// The Staff sheets (Milestone 14, bible §12; style guide §3 bottom sheets). From the Club Menu (Staff), the Manager Office
// sheet, the hint line and a tap on a staff figure on the Club Complex.
//   Staff — the five roles, each with who holds it now (or "Nobody yet") and the candidates you can hire: portrait, name,
//     tier, trait, the effect in plain words, wage. Rare / Elite candidates show greyed with what opens them; Legendary /
//     Secret staff never appear (with ?debug=1 a preview section lists them, never hireable). Tap anyone → their card.
//   Staff card — portrait, role, tier, trait, the effect in plain words (and whether it works now or is stored for a later
//     system), wage, contract length, signing fee. Hired: where they work now, seasons left, Extend / Release (asks
//     first). A candidate: Hire, or Replace <name> when the role is taken (asks first, naming both and the cost).
//   createStaffSheets({ sheet, dialog, run, today, month, onChange, debug }) → { openStaff(), openCard(id), cardMenu(id) }
//     run() → the run save   today() → the club day   month() → the calendar month   onChange(why) → save now
import { THEME } from '../../../../core/Theme.js';
import { STAFF, STAFF_ROLES, STAFF_TIERS, STAFF_EFFECTS, STAFF_RULES, staffById, roleById } from '../../data/staff.js';
import * as ST from '../systems/staff.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const seasons = (n) => `${n} season${n === 1 ? '' : 's'}`;

export function createStaffSheets({ sheet, dialog, run, today = () => 0, month = () => 1, onChange = () => {}, debug = false, whereNow = () => null }) {
  const ui = { msg: null };
  const credits = () => run()?.league?.credits ?? 0;
  const msgSection = () => (ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []);
  const stored = (def) => def.effects.map((e) => STAFF_EFFECTS[e.key]).filter((k) => k && !k.live);
  const workNote = (def) => {
    const w = stored(def);
    return w.length ? `Stored until ${w[0].what} arrive${w[0].what.endsWith('s') ? '' : 's'} (${w[0].waits})` : 'Works now';
  };
  const tierLine = (def) => `${def.tier} · ${def.trait} · ${fmt(STAFF_TIERS[def.tier].wage)} Cr a week`;

  function candidateButton(d, def) {
    const el = ST.eligibility(d, def);
    return {
      id: `staff:${def.id}`,
      label: def.name,
      sub: el.ok ? `${tierLine(def)} · ${def.plain}` : `${def.tier} · ${def.trait} · ${el.why}`,
      icon: def.art,
      accent: STAFF_TIERS[def.tier].colour,
      locked: !el.ok,
      cost: el.ok ? `${fmt(ST.hireCost(def.id))} Cr` : undefined,
      onTap: () => openCard(def.id),
    };
  }

  function staffMenu() {
    const d = run();
    if (!d) return null;
    ST.normaliseStaff(d, today());
    const roles = STAFF_ROLES.map((r) => {
      const cur = ST.inRole(d, r.id);
      const def = cur && staffById(cur.id);
      return {
        title: r.name,
        lines: [cur ? `${cur.name} (${cur.tier}): ${def.plain}` : `Nobody yet. ${r.line}`],
        columns: 1,
        buttons: [
          ...(cur ? [{ id: `staff:${cur.id}`, label: `${cur.name} · on the staff`, sub: `${tierLine(def)} · ${seasons(ST.yearsLeft(d, cur.id))} left${ST.endingSoon(d, cur.id, month()) ? ' · contract ends this season' : ''}`, icon: def.art, accent: C.good, onTap: () => openCard(cur.id) }] : []),
          ...ST.candidates(d, r.id).map((def2) => candidateButton(d, def2)),
        ],
      };
    });
    const preview = debug
      ? [{ title: 'Debug preview: Legendary / Secret (hidden in normal play)', columns: 1, buttons: STAFF.filter((x) => ST.eligibility(d, x).hidden).map((x) => ({ ...candidateButton(d, x), disabled: false, locked: false })) }] // (opens the card; Hire never shows)
      : [];
    return {
      title: 'Staff',
      subtitle: `${ST.hired(d).length} of 5 roles filled · wages ${fmt(ST.wageBill(d))} Cr a week · ${fmt(credits())} Credits`,
      art: 'ui_02',
      accent: C.purple,
      sections: [...msgSection(), ...roles, ...preview],
    };
  }
  function openStaff() {
    ui.msg = null;
    sheet.open(() => staffMenu());
  }

  function cardMenu(id) {
    const d = run();
    const def = staffById(id);
    if (!d || !def) return null;
    ST.normaliseStaff(d, today());
    const role = roleById(def.role);
    const tier = STAFF_TIERS[def.tier];
    const mine = ST.isHired(d, id);
    const el = ST.eligibility(d, def);
    const cur = ST.inRole(d, def.role);
    const sections = [
      ...msgSection(),
      { title: `Trait · ${def.trait}`, lines: [def.plain, `${workNote(def)} · ${def.effect}`] },
      { title: 'Contract', lines: [`Wage ${fmt(tier.wage)} Credits a week · ${seasons(tier.years)} · signing fee ${fmt(tier.fee)} Credits`, mine ? `${seasons(ST.yearsLeft(d, id))} left${ST.endingSoon(d, id, month()) ? ': ends at the end of this season' : ''}` : `Hireable: ${def.eligibility}`] },
    ];
    if (mine) {
      const where = whereNow(id);
      sections.unshift({ title: 'Now', lines: [where ?? `Working as your ${role.name}`] });
      sections.push({
        columns: 2,
        buttons: [
          { id: 'extend', label: 'Extend contract', sub: `+${seasons(tier.years)}`, cost: `${fmt(ST.extendCost(id))} Cr`, accent: C.progress, disabled: credits() < ST.extendCost(id), onTap: () => act(ST.extend(d, id), 'staff:extend') },
          { id: 'release', label: 'Release', sub: `${STAFF_RULES.releaseWeeks} weeks’ wages`, cost: `${fmt(ST.releaseCost(d, id))} Cr`, accent: C.bad, onTap: () => askRelease(id) },
        ],
      });
    } else if (el.ok) {
      const cost = ST.hireCost(id) + (cur ? ST.releaseCost(d, cur.id) : 0);
      const short = credits() < cost;
      sections.push({
        columns: 1,
        buttons: [
          cur
            ? { id: 'hire', label: `Replace ${cur.name}`, sub: short ? `Needs ${fmt(cost)} Credits` : `${cur.name} leaves (${fmt(ST.releaseCost(d, cur.id))} Cr release pay)`, cost: `${fmt(cost)} Cr`, accent: C.action, disabled: short, onTap: () => askReplace(id, cur) }
            : { id: 'hire', label: `Hire ${def.name}`, sub: short ? `Needs ${fmt(cost)} Credits` : `Signing fee · then ${fmt(tier.wage)} Cr a week`, cost: `${fmt(cost)} Cr`, accent: C.good, disabled: short, onTap: () => act(ST.hire(d, id, today()), 'staff:hire') },
        ],
      });
    } else sections.push({ title: el.hidden ? 'Hidden' : 'Not yet', lines: [el.why] });
    sections.push({ columns: 1, buttons: [{ id: 'staffList', label: '‹ All staff', accent: C.progress, onTap: () => openStaff() }] });
    return {
      title: def.name,
      subtitle: `${role.name} · ${def.tier}`,
      art: def.art,
      accent: role.colour,
      tag: { text: mine ? 'ON THE STAFF' : def.tier.toUpperCase(), color: mine ? C.good : tier.colour },
      sections,
    };
  }
  function openCard(id) {
    ui.msg = null;
    sheet.open(() => cardMenu(id));
  }

  function act(r, why) {
    ui.msg = r.ok ? run()?.staff?.log?.at(-1) ?? 'Done.' : r.why;
    if (r.ok) onChange(why);
  }
  function askRelease(id) {
    const d = run();
    const s = ST.hired(d).find((x) => x.id === id);
    if (!s) return;
    dialog.confirm({
      title: `Release ${s.name}?`,
      body: `${s.name} leaves the club today. The club pays ${STAFF_RULES.releaseWeeks} weeks’ wages: ${fmt(ST.releaseCost(d, id))} Credits.${s.role === 'SC' ? ' A scout report under way is dropped.' : ''}`,
      yes: 'Release',
      danger: true,
      onYes: () => {
        act(ST.release(run(), id, today()), 'staff:release');
        openStaff();
      },
    });
  }
  function askReplace(id, cur) {
    const def = staffById(id);
    const d = run();
    dialog.confirm({
      title: `Replace ${cur.name}?`,
      body: `${def.name} becomes your ${roleById(def.role).name}. ${cur.name} leaves (release pay ${fmt(ST.releaseCost(d, cur.id))} Credits); ${def.name}'s signing fee is ${fmt(ST.hireCost(id))} Credits.`,
      yes: 'Replace',
      danger: true,
      onYes: () => act(ST.hire(run(), id, today(), { replace: true }), 'staff:replace'),
    });
  }

  return { openStaff, openCard, cardMenu, staffMenu, get msg() { return ui.msg; } };
}
