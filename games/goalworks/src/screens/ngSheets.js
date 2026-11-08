// The New Game+ sheet (Milestone 29, bible §33; style guide §3 bottom sheets). From the ending (or Menu → New Game+ in the
// postgame): pick the NG+ level (up to the one this account has opened), the Legacy Player (a Hall of Famer, any club),
// from NG+2 the Legacy Support Staff, and the slot: an empty one, or one to replace (asked first). The save this NG+ comes
// from is never offered: the parent slot is kept as it is. Start → Club Setup for the new club, then the NG+ run.
//   createNgSheets({ sheet, run, account, slotCards, parentSlot, staffName, onStart }) → { openNg() }
//     onStart({ level, slot, legacyUid, legacyStaff, replacing })
import { THEME } from '../../../../core/Theme.js';
import { NG } from '../../data/ending.js';
import { ngChoices } from '../systems/ending.js';

const C = THEME.color;

export function createNgSheets({ sheet, run = () => null, account = () => ({}), slotCards = () => [], parentSlot = () => null, staffName = (id) => id, onStart = () => {} }) {
  const pick = { level: 1, uid: null, staff: null, slot: null };
  function menu() {
    const acc = account();
    const top = Math.max(0, Math.min(NG.maxLevel, acc?.ngUnlocked ?? 0));
    if (!top) return { title: 'New Game+', subtitle: 'Finish Year 25 to open it', art: 'ui_28', accent: C.purple, sections: [{ title: 'Locked', lines: ['New Game+ opens after the Year 25 ending.'] }] };
    pick.level = Math.min(Math.max(1, pick.level), top);
    const ch = ngChoices(run(), acc, pick.level);
    if (pick.uid && !ch.players.some((p) => p.uid === pick.uid)) pick.uid = null;
    if (pick.staff && !ch.staff.includes(pick.staff)) pick.staff = null;
    const parent = parentSlot();
    const cards = slotCards();
    if (pick.slot === parent) pick.slot = null;
    pick.slot ??= cards.find((c) => c.empty && c.n !== parent)?.n ?? null;
    const sections = [
      { title: 'Level', columns: 3, buttons: [1, 2, 3].map((l) => ({ id: `ng:level:${l}`, label: `NG+${l}`, sub: l <= top ? (l === 1 ? 'Stronger rivals' : l === 2 ? '+ Legacy staff' : 'The deepest secrets') : 'Locked', accent: C.purple, selected: pick.level === l, disabled: l > top, onTap: () => (pick.level = l) })) },
      {
        title: 'Legacy Player (from the Hall of Fame)',
        columns: 1,
        ...(ch.players.length
          ? { buttons: ch.players.map((p) => ({ id: `ng:player:${p.uid}`, label: `${pick.uid === p.uid ? '✓ ' : ''}${p.name}`, sub: `${p.position} · ${p.tier ?? ''} · ${p.club}${p.peak ? ` · peak ${p.peak}` : ''}`, accent: C.gold, selected: pick.uid === p.uid, onTap: () => (pick.uid = pick.uid === p.uid ? null : p.uid) })) }
          : { lines: ['Nobody in the Hall of Fame yet: this run starts without a Legacy Player.'] }),
      },
    ];
    if (NG.legacyStaff[pick.level]) sections.push({ title: 'Legacy Support Staff', columns: 2, ...(ch.staff.length ? { buttons: ch.staff.map((id) => ({ id: `ng:staff:${id}`, label: `${pick.staff === id ? '✓ ' : ''}${staffName(id)}`, accent: C.progress, selected: pick.staff === id, onTap: () => (pick.staff = pick.staff === id ? null : id) })) } : { lines: ['No staff hired in this save to bring.'] }) });
    sections.push({
      title: 'Slot (this save is kept as it is)',
      columns: 2,
      buttons: cards.map((c) => ({ id: `ng:slot:${c.n}`, label: `Slot ${c.n}`, sub: c.n === parent ? 'This save (kept)' : c.empty ? 'Empty' : `Replace: ${c.summary?.club ?? 'a save'}`, accent: c.empty ? C.good : C.bad, selected: pick.slot === c.n, disabled: c.n === parent, onTap: () => (pick.slot = c.n) })),
    });
    const card = cards.find((c) => c.n === pick.slot);
    sections.push({ title: '', columns: 1, buttons: [{ id: 'ng:start', label: `Start NG+${pick.level}`, sub: pick.slot ? `In Slot ${pick.slot}${card && !card.empty ? ' (replaces it: asked first)' : ''}, then set up the new club` : 'Pick a slot first', accent: C.action, disabled: !pick.slot, onTap: () => onStart({ level: pick.level, slot: pick.slot, legacyUid: pick.uid, legacyStaff: NG.legacyStaff[pick.level] ? pick.staff : null, replacing: card && !card.empty ? card.summary : null }) }] });
    return { title: 'New Game+', subtitle: `NG+${pick.level}: AI clubs a notch stronger, rivals hotter${pick.level >= 2 ? ', Ghost Eleven stronger' : ''}. Achievements, secrets, tokens and speed carry over.`, art: 'ui_28', accent: C.purple, sections };
  }
  function openNg() {
    sheet.open(() => menu());
  }
  return { openNg, menu, pick };
}
