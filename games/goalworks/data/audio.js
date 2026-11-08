// GOALWORKS' sounds (Milestone 32, bible §40): every one made in code from a recipe (core/SoundSynth through
// core/AudioManager) — original, no licensed chants, commentary or music. Aaron's sound folder (D:\Banx Games\sounds) has
// nothing football-like (fantasy, pirate and cartoon packs), so none is used; a real file dropped into assets/audio/<id>.mp3
// or .ogg later replaces its code-made sound with no code change (AudioManager's audio manifest). REAL_SOUNDS_LATER lists
// the ones that most need a real recording.
// Groups (AudioManager caps): ui · workshop (club / build) · competition (the match) · progression (stingers) · economy.

const n = (o) => ({ wave: 'noise', ...o });
// The crowd beds: filtered noise held as a loop, louder and brighter with a bigger crowd (bible §40 "by attendance tier").
const bed = (v, lp, lp2) => ({ gain: 0.5, loop: true, layers: [n({ d: 2.4, a: 0.3, v, lp, hold: true }), n({ d: 2.4, a: 0.3, v: v * 0.6, lp: lp2, hold: true }), { wave: 'sine', f: 140, d: 2.4, a: 0.3, v: v * 0.12, hold: true, vib: { rate: 0.7, depth: 0.4 } }] });

export const SOUNDS = {
  // --- the match ------------------------------------------------------------------------------------------------------
  whistle: { group: 'competition', recipe: { gain: 0.42, layers: [{ wave: 'square', f: 2750, d: 0.32, a: 0.01, v: 0.5, duty: 0.4, vib: { rate: 34, depth: 0.5 }, lp: 5200 }, { wave: 'sine', f: 2750, d: 0.32, a: 0.01, v: 0.5, vib: { rate: 34, depth: 0.5 } }] } },
  whistleEnd: { group: 'competition', recipe: { gain: 0.42, layers: [0, 0.42, 0.84].map((t, i) => ({ wave: 'square', f: 2750, t, d: i === 2 ? 0.75 : 0.3, a: 0.01, v: 0.5, duty: 0.4, vib: { rate: 34, depth: 0.5 }, lp: 5200 })) } },
  kick: { group: 'competition', vary: true, recipe: { gain: 0.5, layers: [{ wave: 'sine', f: 150, f2: 55, d: 0.12, a: 0.002, v: 0.9 }, n({ d: 0.05, a: 0.001, v: 0.5, lp: 2600 })] } },
  tackle: { group: 'competition', vary: true, recipe: { gain: 0.5, layers: [n({ d: 0.18, a: 0.003, v: 0.7, lp: 1400 }), { wave: 'sine', f: 95, f2: 50, d: 0.16, a: 0.002, v: 0.6 }] } },
  post: { group: 'competition', recipe: { gain: 0.45, layers: [{ wave: 'sine', f: 1180, d: 0.9, a: 0.001, v: 0.6, shape: 2.4 }, { wave: 'sine', f: 2330, d: 0.6, a: 0.001, v: 0.3, shape: 2.6 }, { wave: 'triangle', f: 3460, d: 0.35, a: 0.001, v: 0.15 }, n({ d: 0.04, v: 0.4, lp: 4000 })] } },
  net: { group: 'competition', recipe: { gain: 0.45, layers: [n({ d: 0.55, a: 0.02, v: 0.6, lp: 1800, shape: 1.2 }), n({ t: 0.05, d: 0.35, v: 0.3, lp: 600 })] } },
  crowdRoar: { group: 'competition', recipe: { gain: 0.6, layers: [n({ d: 2.6, a: 0.25, v: 0.8, lp: 2200, shape: 1.1 }), n({ d: 2.4, a: 0.35, v: 0.5, lp: 900 }), { wave: 'saw', f: 220, f2: 260, d: 2.2, a: 0.4, v: 0.05, lp: 700, vib: { rate: 5, depth: 0.8 } }] } },
  crowdGroan: { group: 'competition', recipe: { gain: 0.5, layers: [n({ d: 1.6, a: 0.12, v: 0.6, lp: 700, shape: 1.3 }), { wave: 'saw', f: 210, f2: 120, curve: 'lin', d: 1.4, a: 0.1, v: 0.08, lp: 500 }] } },
  crowdOoh: { group: 'competition', recipe: { gain: 0.45, layers: [n({ d: 1.1, a: 0.08, v: 0.5, lp: 1000 }), { wave: 'saw', f: 180, f2: 240, d: 0.9, a: 0.08, v: 0.06, lp: 600 }] } },
  // the beds: tier 1 (a few hundred) … tier 4 (a full stadium)
  crowd1: { group: 'competition', loop: true, volume: 0.35, recipe: bed(0.25, 500, 1100) },
  crowd2: { group: 'competition', loop: true, volume: 0.45, recipe: bed(0.4, 650, 1400) },
  crowd3: { group: 'competition', loop: true, volume: 0.55, recipe: bed(0.55, 800, 1800) },
  crowd4: { group: 'competition', loop: true, volume: 0.65, recipe: bed(0.7, 950, 2300) },
  card: { group: 'competition', recipe: { gain: 0.35, layers: [{ wave: 'square', f: 2750, d: 0.22, a: 0.01, v: 0.5, duty: 0.4, vib: { rate: 34, depth: 0.5 }, lp: 5200 }, { wave: 'square', f: 2750, t: 0.3, d: 0.22, a: 0.01, v: 0.5, duty: 0.4, vib: { rate: 34, depth: 0.5 }, lp: 5200 }] } },
  // --- the club ---------------------------------------------------------------------------------------------------------
  ambience: { group: 'workshop', loop: true, volume: 0.25, recipe: { gain: 0.3, loop: true, layers: [n({ d: 3, a: 0.4, v: 0.18, lp: 420, hold: true }), { wave: 'sine', f: 3100, f2: 3600, t: 0.6, d: 0.09, v: 0.06 }, { wave: 'sine', f: 3400, f2: 2900, t: 0.75, d: 0.08, v: 0.05 }, { wave: 'sine', f: 2800, f2: 3300, t: 2.1, d: 0.1, v: 0.05 }] } },
  build: { group: 'workshop', vary: true, recipe: { gain: 0.45, layers: [0, 0.22, 0.44].map((t) => ({ wave: 'sine', f: 320, f2: 140, t, d: 0.12, a: 0.002, v: 0.7 })).concat([n({ d: 0.6, v: 0.15, lp: 1200 })]) } },
  // --- the interface --------------------------------------------------------------------------------------------------
  uiClick: { group: 'ui', vary: true, recipe: { gain: 0.3, layers: [{ wave: 'triangle', f: 1200, f2: 900, d: 0.05, a: 0.002, v: 0.6 }] } },
  uiConfirm: { group: 'ui', recipe: { gain: 0.32, layers: [{ wave: 'triangle', f: 660, d: 0.09, v: 0.6 }, { wave: 'triangle', f: 990, t: 0.08, d: 0.14, v: 0.6 }] } },
  purchase: { group: 'economy', recipe: { gain: 0.35, layers: [{ wave: 'triangle', f: 880, d: 0.1, v: 0.6 }, { wave: 'triangle', f: 1320, t: 0.09, d: 0.12, v: 0.6 }, { wave: 'sine', f: 1760, t: 0.18, d: 0.3, v: 0.5 }] } },
  // --- stingers (the crowd ducks under them) -----------------------------------------------------------------------------
  promotion: { group: 'progression', recipe: { gain: 0.42, echo: { delay: 0.18, feedback: 0.25, mix: 0.25 }, layers: [60, 64, 67, 72].map((m, i) => ({ wave: 'triangle', f: 440 * Math.pow(2, (m - 69) / 12), t: i * 0.12, d: i === 3 ? 0.9 : 0.3, v: 0.6 })).concat([{ wave: 'sine', f: 130.8, t: 0.36, d: 1, v: 0.4 }]) } },
  trophy: { group: 'progression', recipe: { gain: 0.45, echo: { delay: 0.2, feedback: 0.3, mix: 0.3 }, layers: [[67, 0], [67, 0.14], [67, 0.28], [72, 0.42], [76, 0.62], [79, 0.82]].map(([m, t], i) => ({ wave: 'square', duty: 0.3, f: 440 * Math.pow(2, (m - 69) / 12), t, d: i === 5 ? 1.2 : 0.16, v: 0.45, lp: 3200 })).concat([{ wave: 'sine', f: 196, t: 0.82, d: 1.3, v: 0.5 }]) } },
  legend: { group: 'progression', recipe: { gain: 0.42, echo: { delay: 0.25, feedback: 0.35, mix: 0.35 }, layers: [57, 61, 64, 68].map((m, i) => ({ wave: 'sine', f: 440 * Math.pow(2, (m - 69) / 12), t: i * 0.18, d: 1.6 - i * 0.18, a: 0.08, v: 0.45, vib: { rate: 5, depth: 0.15 } })) } },
};

// Which crowd bed a match gets (M24's real attendance).
export const CROWD_TIERS = [
  { min: 0, id: 'crowd1' },
  { min: 1500, id: 'crowd2' },
  { min: 8000, id: 'crowd3' },
  { min: 25000, id: 'crowd4' },
];
export const crowdBedFor = (attendance) => CROWD_TIERS.filter((t) => (attendance ?? 0) >= t.min).at(-1).id;
export const DUCK = { level: 0.35, ms: 2200 }; // the crowd under a stinger: this share of its volume, for this long

// Every code-made sound waits for a real one; these matter most (in the log: "needs a real sound later").
export const REAL_SOUNDS_LATER = ['crowd1', 'crowd2', 'crowd3', 'crowd4', 'crowdRoar', 'crowdGroan', 'crowdOoh', 'whistle', 'whistleEnd', 'kick', 'net', 'post', 'tackle', 'ambience', 'build', 'promotion', 'trophy', 'legend'];
