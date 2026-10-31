// The board (Milestone 23, bible §29): each season Edith Marlow (data/cast.js) sets 2 objectives — a one-tap sheet at the
// season's start; they are scored at Awards Night in the Board voice. Missing them lowers Board Confidence (0–100, shown
// only in the Board voice); the manager is never sacked. Long Emergency Credit debt brings the board's rescue offer.
// Plain data; the rules live in src/systems/board.js.
//   id, name, line(o): the words on the sheet · when(ctx): it can be picked now · need(ctx): the target
//   ctx = { data, top (no league above / the title already won), sponsorsUnlocked, trust, frac (promotion progress now) }
export const BOARD_OBJECTIVES = [
  { id: 'promotion', name: 'Promotion progress', line: (o) => (o.need >= 1 ? 'Meet every promotion condition this season' : `Get ${Math.round(o.need * 100)}% of the way through this league’s promotion conditions`), when: (c) => !c.top, need: (c) => Math.min(1, Math.round((c.frac + 0.35) * 20) / 20) },
  { id: 'wins', name: 'League form', line: (o) => `Win ${o.need} matches this season`, when: (c) => c.top, need: () => 15 },
  { id: 'cup', name: 'Cup progress', line: (o) => `Win ${o.need} cup ties this season`, when: () => true, need: (c) => (c.tier >= 3 ? 3 : 2) },
  { id: 'youth', name: 'Youth minutes', line: (o) => `Give ${o.need}% of the starts to players 21 or under`, when: () => true, need: () => 10 },
  { id: 'wages', name: 'Wage control', line: (o) => `Keep the wage bill under ${o.need}% of income`, when: () => true, need: () => 85 },
  { id: 'fans', name: 'Fan growth', line: (o) => (o.keep ? `Keep Fan Trust at ${o.need} or more` : `Raise Fan Trust by ${o.need}`), when: () => true, need: (c) => (c.trust >= 80 ? 80 : 5) },
  { id: 'facility', name: 'Facility upgrade', line: (o) => `Build or upgrade ${o.need} facilit${o.need === 1 ? 'y' : 'ies'}`, when: () => true, need: (c) => (c.tier >= 3 ? 2 : 1) },
  { id: 'sponsor', name: 'Sponsor target', line: (o) => `End the season with ${o.need} active sponsor${o.need === 1 ? '' : 's'}`, when: (c) => c.sponsorsUnlocked > 0, need: (c) => Math.min(3, Math.max(1, c.sponsorsUnlocked - 1)) },
];
export const boardObjective = (id) => BOARD_OBJECTIVES.find((o) => o.id === id) ?? null;

// Board Confidence: start, per objective met / missed, kept in 0–100. The rescue offer: data/finance.js EMERGENCY.
export const BOARD = {
  confidenceStart: 60,
  met: 6,
  missed: -8,
  laterRescue: -3,
  rescueAdvanceWeeks: 8, // the rescue sponsor deal pays this many weeks of its stipend at once
  bands: [
    { min: 0, text: 'The board is worried' },
    { min: 35, text: 'The board is watching closely' },
    { min: 60, text: 'The board backs you' },
    { min: 80, text: 'The board has total faith in you' },
  ],
};
export const confidenceText = (v) => [...BOARD.bands].reverse().find((b) => v >= b.min).text;

export const BOARD_TEXT = {
  who: 'Edith Marlow, Chair of the Board',
  sheetTitle: (year) => `Year ${year}: the board’s objectives`,
  sheetLine: 'Edith Marlow has set this season’s two targets. They are scored at Awards Night.',
  rescueTitle: 'The board has a rescue plan',
  rescueLine: (weeks, owed) => `We have been in debt for ${weeks} weeks (${Math.round(owed).toLocaleString('en-GB')} Credits owed). The board suggests one of these. Nothing is forced: the club carries on either way.`,
};
