// The Research sheet (Milestone 13, standard bottom sheet, style guide §3): from the Research button in the bottom row,
// the Manager Office, the Video Room and the Analytics Lab. Header: RP, the daily rate and how many of the 36 are done.
// Six branch tabs (Training · Scouting · Academy · Medical · Tactics · Club); each starts with the slot — the node being
// researched with its progress and Stop, the locked second slot — then the branch's six nodes in tier order, each
// Done / Researching / Open / Locked with what it needs and what it gives. Tap an Open node to start it (its RP are
// paid then; a stopped node restarts free, keeping its progress).
//   createResearchSheets({ sheet, research, onChange }) → { openResearch(tab?), message }
//   research() → the open run's research (src/systems/research.js) or null; onChange(why) → autosave
import { THEME } from '../../../../core/Theme.js';
import { BRANCHES, NODES, nodeById, QUEUES, RESEARCH_ICON } from '../../data/research.js';
import { storedNote } from '../systems/research.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const STATUS = { done: '✓ Done', active: 'Researching', available: 'Open', locked: 'Locked' };

export function createResearchSheets({ sheet, research, onChange = () => {} }) {
  const ui = { msg: null };

  function slotSection(R) {
    const cur = R.current();
    const second = QUEUES[1];
    const secondBtn = { id: 'slot2', label: second.name, sub: R.secondSlotOpen() ? 'Open' : `Locked — ${second.lockedText}`, icon: RESEARCH_ICON, locked: !R.secondSlotOpen(), accent: C.progress, onTap: () => {} };
    if (!cur)
      return {
        title: 'Now researching',
        lines: ['Nothing in the research slot. Pick an Open node below to start it.'],
        buttons: [secondBtn],
      };
    const n = cur.node;
    return {
      title: 'Now researching',
      lines: [`${n.id} ${n.name} — ${n.gives}`],
      bars: [{ label: 'Progress', value: Math.round(cur.frac * 100), max: 100, color: C.purple, text: `${Math.floor(cur.days)} / ${n.days} days` }],
      buttons: [
        { id: 'stop', label: 'Stop', sub: 'Keeps the progress; restarting is free', accent: C.bad, onTap: () => {
          R.stop();
          ui.msg = `Stopped ${n.id} ${n.name}: ${Math.floor(cur.days)} of ${n.days} days kept.`;
          onChange('research:stop');
        } },
        secondBtn,
      ],
    };
  }

  function nodeButton(R, n) {
    const st = R.status(n.id);
    const parts = [STATUS[st]];
    if (st === 'locked') parts.push(R.canStart(n.id).reason);
    else if (st === 'available') {
      const can = R.canStart(n.id);
      if (R.paid(n.id)) parts.push(`paid · ${Math.floor(R.progressDays(n.id))} / ${n.days} days done`);
      else parts.push(`${fmt(n.cost)} RP · ${n.days} days`);
      if (!can.ok) parts.push(can.reason);
    } else if (st === 'active') parts.push(`${Math.floor(R.progressDays(n.id))} / ${n.days} days`);
    parts.push(n.gives);
    const note = storedNote(n);
    if (note) parts.push(note);
    const can = st === 'available' ? R.canStart(n.id) : null;
    return {
      id: `node:${n.id}`,
      label: `${n.id} · ${n.name}`,
      sub: parts.join(' · '),
      icon: n.icon,
      accent: st === 'done' ? C.good : st === 'active' ? C.purple : C.action,
      selected: st === 'done',
      locked: st === 'locked',
      disabled: st === 'available' && !can.ok,
      onTap: () => {
        if (st !== 'available') return;
        const r = R.start(n.id);
        ui.msg = r.ok ? `Started ${n.id} ${n.name}: ${n.days} work days.` : r.reason;
        if (r.ok) onChange('research:start');
      },
    };
  }

  function branchSections(R, b) {
    const nodes = NODES.filter((n) => n.branch === b.id);
    const recent = R.recent(4);
    return [
      ...(ui.msg ? [{ title: 'Latest', lines: [ui.msg] }] : []),
      slotSection(R),
      { title: `${b.name} · ${R.branchDone(b.id)} / ${nodes.length} done`, columns: 1, buttons: nodes.map((n) => nodeButton(R, n)) },
      ...(recent.length ? [{ title: 'Research Points', lines: recent.map((g) => `${g.amount > 0 ? '+' : ''}${g.amount} RP · ${g.reason}`) }] : []),
    ];
  }

  function build() {
    const R = research();
    if (!R) return null;
    return {
      title: 'Research',
      subtitle: `${fmt(R.rp)} RP · +${fmt(R.perDay())} RP a day · ${R.doneCount} / ${NODES.length} researched`,
      art: RESEARCH_ICON,
      accent: C.purple,
      tabs: BRANCHES.map((b) => ({ id: b.id, label: b.name, sections: branchSections(R, b) })),
    };
  }

  return {
    openResearch(tab = null) {
      ui.msg = null;
      const R = research();
      sheet.open(build, { tab: tab ?? R?.current()?.node.branch ?? BRANCHES[0].id });
    },
    get message() {
      return ui.msg;
    },
  };
}

export { nodeById };
