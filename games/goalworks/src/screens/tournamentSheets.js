// The Tournaments screen (Milestone 21, bible §22; style guide §3 bottom sheets). From the Club Menu (Tournaments) — a cup's
// bracket is one more tap. Every one of the 16 with its art and where it stands: locked (its trigger), open (the next
// edition's date), queued (behind another cup's chain), in progress (your next tie), out, missed (C01 once the club has
// left the Regional League), won n times. A secret one shows as a dark silhouette and "???" until found; found, it shows
// its name and art. With ?debug=1: force each secret cup's trigger, open C15 / C16 (their real triggers are M28 / NG+).
//   createTournamentSheets({ sheet, assets, run, calendar, dateText, onOpenCup(id), onForce(id), debug })
//     → { openTournaments(), tournamentsMenu(), statusOf(data, id) }
import { THEME } from '../../../../core/Theme.js';
import { CUPS, CUP_ORDER, isSecretCup } from '../../data/cups.js';
import * as LG from '../systems/league.js';
import * as CUP from '../systems/cup.js';

const C = THEME.color;

// A dark silhouette of a cup's picture (a secret not yet found), made once from the loaded picture.
function silhouette(assets, art) {
  const key = `silhouette~${art}`;
  if (assets?.images?.has(key) || typeof document === 'undefined') return key;
  const img = assets?.images?.get(art);
  if (!img || !(img.naturalWidth || img.width)) return 'ui_28'; // (not loaded yet: the Rumours icon stands in)
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#2E2A26';
  g.fillRect(0, 0, w, h);
  c.naturalWidth = w;
  c.naturalHeight = h;
  assets.images.set(key, c);
  return key;
}

// Where a tournament stands for this club. → { state: 'secret' | 'locked' | 'missed' | 'open' | 'queued' | 'running' |
// 'out', line, found }
export function statusOf(data, id, dateText = (d) => `day ${d}`, calendar = null) {
  const cup = CUPS[id];
  const C = CUP.normaliseCups(data)[id];
  const L = LG.normaliseLeague(data);
  const secretFound = L.cupsOpen?.[id] != null || (cup.opens.secret ? data.secrets?.state?.[cup.opens.secret]?.found != null : !cup.opens.debug);
  const wins = C.wins ? ` · won ${C.wins}×` : '';
  if (isSecretCup(cup) && !secretFound && !C.editions) return { state: 'secret', line: 'A secret tournament. Nobody knows how to get in…', found: false };
  const running = LG.activeCups(data).some((c) => c.id === id);
  if (!running && !C.current) {
    if (id === 'C01' && L.tier !== 'regional' && !C.editions) return { state: 'missed', line: 'Missed: the club left the Regional League before it opened', found: true };
    if (!C.editions) return { state: 'locked', line: `Locked · ${cup.trigger}`, found: true };
    return { state: 'locked', line: `Not running now${wins}`, found: true };
  }
  const st = CUP.status(data, id);
  if (!st.running) return { state: 'open', line: `Open · the next edition ${dateText(st.nextStart)}${wins}`, found: true };
  if (st.out) return { state: 'out', line: `In progress · you are out this season${wins}`, found: true };
  if (st.next && (st.queued || st.next.day == null)) {
    const behind = LG.queuedBehind(data, id);
    return { state: 'queued', line: `Queued: starts after the ${behind?.name ?? 'match already booked'}${wins}`, found: true };
  }
  const day = calendar?.fixture?.cup?.id === id ? calendar.fixture.matchDay : st.next?.day;
  return { state: 'running', line: st.next ? `In progress · ${st.next.round} v ${CUP.teamName(data, st.next.opponent)}, ${dateText(day)}${wins}` : `In progress${wins}`, found: true };
}

export function createTournamentSheets({ sheet, assets, run, calendar = () => null, dateText = (d) => `day ${d}`, onOpenCup = () => {}, onForce = null, debug = false }) {
  const ACCENT = { secret: '#4B4540', locked: C.line, missed: C.bad, open: C.good, queued: C.purple, running: C.gold, out: C.progress };
  function tournamentsMenu() {
    const d = run();
    if (!d) return null;
    const rows = CUP_ORDER.map((id) => ({ id, cup: CUPS[id], st: statusOf(d, id, dateText, calendar()) }));
    const button = ({ id, cup, st }) => ({
      id: `cup:${id}`,
      label: st.state === 'secret' ? `${id} · ???` : `${id} · ${cup.name}`,
      sub: st.line,
      icon: st.state === 'secret' ? silhouette(assets, cup.art) : cup.art,
      accent: ACCENT[st.state] ?? C.progress,
      locked: st.state === 'secret',
      onTap: () => st.state !== 'secret' && onOpenCup(id),
    });
    const group = (title, ids, line) => {
      const list = rows.filter((r) => ids.includes(r.id));
      return list.length ? { title, ...(line ? { lines: [line] } : {}), columns: 1, buttons: list.map(button) } : null;
    };
    const live = rows.filter((r) => ['running', 'queued'].includes(r.st.state)).length;
    const sections = [
      group('League cups and open cups', ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'], 'One match every 7 days: a cup round is booked 7 days ahead, and a win books the next round 7 days after the result. A cup that opens while another is running waits its turn.'),
      group('Prestige', ['C08']),
      group('Secret tournaments', ['C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16'], 'Found by doing something special. Each runs once when found, then once a season.'),
    ].filter(Boolean);
    if (debug && onForce) sections.push({ title: 'Debug: open a secret tournament', columns: 4, buttons: ['C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16'].map((id) => ({ id: `debug:cup:${id}`, label: id, accent: C.gold, onTap: () => onForce(id) })) });
    return { title: 'Tournaments', subtitle: `${live ? `${live} running now · ` : ''}16 tournaments · tap one for its bracket`, art: CUPS.C04.art, accent: C.gold, sections };
  }
  function openTournaments() {
    sheet.open(() => tournamentsMenu());
  }
  return { openTournaments, tournamentsMenu, statusOf };
}
