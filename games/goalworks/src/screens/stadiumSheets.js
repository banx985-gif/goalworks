// The Stadium screen (Milestone 24; style guide §3 bottom sheets). Club Menu → Stadium, or tap the stadium beside the
// ground — one tap; building is the second:
//   Now — the stage (its picture), the capacity, the last home crowd, the next home match's expected crowd, the upkeep
//   Under way — a stage or piece being built, with the days left
//   Next stage — what it holds, what it costs, how long it takes, what it needs (Build)
//   Expansion pieces — the three of each stage reached (Build, or why not), then the stages to come
//   How the crowd works — the demand rules in one line
//   createStadiumSheets({ sheet, assets, run, today, dateText, onChange, debug }) → { openStadium(), stadiumMenu() }
import { THEME } from '../../../../core/Theme.js';
import { STAGES, PIECES, GIVES_TEXT, STAGE_NEEDS, STADIUM_TEXT, ATTENDANCE } from '../../data/stadium.js';
import * as STAD from '../systems/stadium.js';

const C = THEME.color;
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const givesText = (g) => Object.entries(g).map(([k, v]) => GIVES_TEXT[k]?.(v) ?? '').filter(Boolean).join(' · ');

export function createStadiumSheets({ sheet, assets, run, today = () => 0, dateText = (d) => `day ${d}`, onChange = () => {}, debug = false }) {
  const ui = { msg: null };

  function stadiumMenu() {
    const d = run();
    if (!d) return null;
    const S = STAD.normaliseStadium(d);
    const st = STAD.stageNow(d);
    const cap = STAD.capacity(d);
    const avg = STAD.attendance(d, null, today());
    const out = [];
    if (ui.msg) out.push({ title: 'Latest', lines: [ui.msg] });
    out.push({
      title: `Stage ${st.id} of ${STAGES.length} · ${st.name}`,
      lines: [
        { text: 'Capacity', right: `${fmt(cap)} seats` },
        S.last ? { text: `Last home crowd (${dateText(S.last.day)})`, right: `${STADIUM_TEXT.crowdLine(S.last.crowd, S.last.capacity)}${S.last.soldOut ? ` · ${STADIUM_TEXT.soldOut}` : ''}`, color: S.last.soldOut ? C.good : C.text } : { text: 'Last home crowd', right: 'No home match yet' },
        { text: 'An ordinary home match now', right: `${fmt(avg.crowd)} expected${avg.soldOut ? ` · ${STADIUM_TEXT.soldOut}` : ''}` },
        { text: 'Upkeep a week (stage + pieces)', right: `${fmt(STAD.upkeepOf(d))} Credits` },
      ],
      bars: [{ label: 'How full', value: Math.round(avg.fill * 100), max: 100, color: avg.soldOut ? C.good : C.progress, text: avg.soldOut ? `Sold out (${fmt(avg.demand)} want to come)` : `${Math.round(avg.fill * 100)}%` }],
    });
    const P = STAD.project(d);
    if (P) {
      const left = Math.max(0, P.doneDay - today());
      const total = Math.max(1, P.doneDay - P.start);
      out.push({ title: 'Under way', titleDot: C.action, lines: [STADIUM_TEXT.busy(P.name, dateText(P.doneDay))], bars: [{ label: P.name, value: total - left, max: total, color: C.action, text: `${left} day${left === 1 ? '' : 's'} left` }] });
    }
    const n = STAD.nextStage(d);
    if (n) {
      const c = STAD.canBuildStage(d);
      out.push({
        title: `Next stage: ${n.stage.name}`,
        lines: [`${fmt(n.stage.capacity)} seats (now ${fmt(st.capacity)}) · its upkeep ${fmt(n.stage.upkeep)} a week · ${n.weeks} weeks to build`, n.open ? `Open: you reached the ${STAGE_NEEDS[n.stage.id]}.` : { text: STADIUM_TEXT.needsLeague(STAGE_NEEDS[n.stage.id]), color: C.textFaint }],
        columns: 1,
        buttons: [{ id: 'stadium:stage', label: `Build the ${n.stage.name}`, sub: c.ok ? `${fmt(n.cost)} Credits · ready in ${n.weeks} weeks` : c.why, icon: n.stage.art, accent: C.good, disabled: n.open && !c.ok, locked: !n.open, onTap: () => buildStage() }],
      });
    } else out.push({ title: 'Every stage built', lines: ['The Crown Stadium stands: the biggest ground in the land.'] });
    for (const s of STAGES.filter((x) => x.id <= S.stage)) {
      out.push({
        title: `${s.name}: expansion pieces`,
        columns: 1,
        buttons: STAD.piecesOf(d, s.id).map((x) => ({ id: `stadium:${x.def.id}`, label: x.def.name, sub: x.built ? `Built · ${givesText(x.def.gives)}` : x.building ? `Being built · ready ${dateText(S.project.doneDay)}` : `${fmt(x.def.cost)} Credits · ${givesText(x.def.gives)}${x.ok ? '' : ` · ${x.why}`}`, icon: x.def.art, accent: x.built ? C.good : C.gold, disabled: !x.built && !x.ok, onTap: () => (x.built ? null : buyPiece(x.def.id)) })),
      });
    }
    const later = STAGES.filter((x) => x.id > S.stage);
    if (later.length) out.push({ title: 'Pieces to come', lines: later.map((s) => ({ text: `${s.name}: ${PIECES.filter((p) => p.stage === s.id).map((p) => p.name).join(', ')}`, color: C.textFaint })) });
    out.push({ title: 'How the crowd works', lines: [`Who wants to come grows with your league, Club Rank and Fan Trust; derbies, big clubs and cup rounds draw more (a final ${Math.round((ATTENDANCE.final - 1) * 100)}% more). The crowd never passes the capacity: a full ground is sold out, and tickets go for ${Math.round((ATTENDANCE.soldOut - 1) * 100)}% more. The gate is the crowd × your league’s ticket price.`, 'Stages and pieces are paid when they start (frozen while the club owes an Emergency Credit); one project at a time.'] });
    if (debug) out.push({ title: 'Debug', columns: 2, buttons: [
      { id: 'debug:stage', label: 'Next stage now', sub: 'Free, no wait', accent: C.purple, onTap: () => { STAD.forceStage(d, S.stage + 1); ui.msg = `${STAD.stageNow(d).name} (debug).`; onChange('stadium:debug:stage'); } },
      { id: 'debug:finish', label: 'Finish the project', sub: 'Tomorrow', accent: C.purple, onTap: () => { if (S.project) S.project.doneDay = today() + 1; onChange('stadium:debug:finish'); } },
    ] });
    return { title: STADIUM_TEXT.title, subtitle: STADIUM_TEXT.subtitle, art: st.art, accent: C.good, tag: { text: `STAGE ${st.id}`, color: C.good }, sections: out };
  }
  function buildStage() {
    const d = run();
    const r = STAD.buildStage(d, today());
    ui.msg = r.ok ? `Building the ${r.name}: ready ${dateText(r.doneDay)}` : r.why;
    if (r.ok) onChange('stadium:stage');
  }
  function buyPiece(id) {
    const d = run();
    const r = STAD.buyPiece(d, id, today());
    ui.msg = r.ok ? `Building the ${r.name.toLowerCase()}: ready ${dateText(r.doneDay)}` : r.why;
    if (r.ok) onChange(`stadium:${id}`);
  }
  function openStadium() {
    ui.msg = null;
    sheet.open(() => stadiumMenu());
  }
  return { openStadium, stadiumMenu };
}
