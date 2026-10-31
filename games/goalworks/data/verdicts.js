// Season verdicts (Milestone 21b, SERIES_KAIROSOFT_LESSONS "verdict moment", bible §29 board / media folded in): the
// yearly Awards Night (Month 12, its last day, before the M16 retirements), the Season Review from four named voices
// (each /10, a total /40), the four awards, the Great Teams page and a Hall of Famer's heir. The rules live in
// src/systems/verdicts.js; nothing here is a new resource — every number reads what the game already keeps.
//
// Each voice: base + its parts, each part capped, rounded to a whole number and kept 1–10. (docs/DECISIONS.md, M21b)
//   board  — league progress (the promotion conditions of your league, or promoted / Crown title this season: full),
//            Credits never below zero this season + ending at least where it started, facilities built / levelled,
//            (M23) the board's two objectives (src/systems/board.js; no Emergency Credit this season counts as 'never below
//            zero'), and Board Confidence in its words
//   fans   — win rate, cup ties and cups won, rival results (the clubs with a rivalry id), home form, the three
//            favourites (best overall at the season's start) still at the club, (M23) Fan Trust
//   press  — goals a match, Stars in the squad + big signings (new this season, at least the XI's average), giant-killings
//            (a win against a side 3+ overall stronger or from a higher league), secret cups found this season
//   coach  — youth minutes (XI appearances by players 21 or under), overall gained by the squad, familiarity of the
//            formation / style in use, freshness (the squad's average fatigue this season; injuries arrive in M25)

export const AWARDS_DAY = 335; // the last day of Month 12 (club days 0–335 of each season; the season's end is day 336)

export const VOICES = [
  {
    id: 'board', name: 'The Board', who: 'Edith Marlow, Chair of the Board', art: 'ui_05', colour: '#1B2A4A',
    base: 2,
    parts: { progress: 3.5, money: 1.5, facilities: 1.5, objectives: 1.5 }, // (M23: objectives from the others' share)
    perFacility: 0.5, // a build or a level-up
  },
  {
    id: 'fans', name: 'The Fans', who: 'Del Price, Supporters’ Club', art: 'ui_23', colour: '#D0322B',
    base: 1,
    parts: { wins: 3.5, cups: 2, rivals: 1, home: 0.75, favourites: 0.75, trust: 1 }, // (M23: Fan Trust from the others' share)
    winsFull: 0.65, // the win rate that scores the whole part
    homeFull: 0.65,
    perTie: 0.5, perCup: 1, perRival: 0.5,
  },
  {
    id: 'press', name: 'The Press', who: 'The Evening Whistle', art: 'ui_19', colour: '#7B3FC4',
    base: 1.5,
    parts: { goals: 3, stars: 2, giants: 2, secrets: 1.5 },
    goalsFull: 2, // goals a match for the whole part
    perStar: 0.5, perSigning: 0.5, perGiant: 0.4, perSecret: 0.75,
    giantGap: 3, // a giant-killing: their XI at least this much stronger (average overall), or a club from a higher league
  },
  {
    id: 'coach', name: 'Your Head Coach', who: 'Head Coach', art: 'ui_08', colour: '#2E8B57',
    base: 1.5,
    parts: { youth: 3, growth: 3, familiarity: 1.5, fitness: 1 },
    youthFull: 0.25, // share of XI appearances by players 21 or under
    youthAge: 21,
    growthFull: 2.5, // overall points gained per squad player who played
    fitnessZero: 50, // average fatigue at which the part is 0 (0 fatigue: the whole part)
    standIn: 'Assistant Coach (no Head Coach hired)',
  },
];
export const voiceById = (id) => VOICES.find((v) => v.id === id) ?? null;

// What each voice says: low (1–4), fair (5–7), high (8–10). {x} words come from the season (verdicts.js lines()).
export const VOICE_LINES = {
  board: {
    low: 'The Board expected more. {progress}. {money}. {objectives}',
    mid: 'A steady year in the boardroom. {progress}. {money}. {objectives}',
    high: 'The Board is delighted. {progress}. {money}. {objectives}',
  },
  fans: {
    low: '{record}. The terraces were quiet this year. {trust}',
    mid: '{record}. {cups} The fans want a bit more. {trust}',
    high: '{record}! {cups} The Supporters’ Club is singing your name. {trust}',
  },
  press: {
    low: '“{goals} — a season the back pages forgot.”',
    mid: '“{goals}. {extra}”',
    high: '“{goals}! {extra} What a story.”',
  },
  coach: {
    low: '{youth}. The squad didn’t grow much this year.',
    mid: '{youth}. {growth}. Good work on the training ground.',
    high: '{youth}. {growth}. This squad is getting better every week.',
  },
};
export const band = (score) => (score >= 8 ? 'high' : score >= 5 ? 'mid' : 'low');

// The awards: each gives reputation (history × your league's tier) and one item (M12c pool; source 'award').
//   pick: 'goals' | 'cleanSheets' (keepers) | 'young' (21 or under: growth × 2 + appearances × 0.5) | 'manager' (review 32+)
export const AWARDS = [
  { id: 'boot', name: 'Golden Boot', art: 'trophy_10', pick: 'goals', history: 40, weights: { common: 20, rare: 50, elite: 25, legendary: 5 } },
  { id: 'glove', name: 'Golden Glove', art: 'trophy_11', pick: 'cleanSheets', history: 40, weights: { common: 20, rare: 50, elite: 25, legendary: 5 } },
  { id: 'young', name: 'Young Player of the Season', art: 'trophy_12', pick: 'young', history: 40, maxAge: 21, weights: { common: 20, rare: 50, elite: 25, legendary: 5 } },
  { id: 'manager', name: 'Manager of the Season', art: 'trophy_13', pick: 'manager', history: 100, minReview: 32, weights: { common: 0, rare: 40, elite: 45, legendary: 15 } },
];
export const awardById = (id) => AWARDS.find((a) => a.id === id) ?? null;

// Great Teams (account-wide, like the M16 Hall of Fame): a season that won a promotion, a major cup (C03–C08), the Crown
// title, or scored 34+ in the review.
export const GREAT_TEAMS = { majorCups: ['C03', 'C04', 'C05', 'C06', 'C07', 'C08'], minReview: 34, max: 80 };

// A Hall of Famer's heir (the "Mk II" idea): his regen gets this much more potential (within the caps; above 99 only for a
// Star), always goes to your academy trials ("the heir to …") and keeps the legend's trait.
export const HEIR = { potential: 5 };

export const VERDICT_TEXT = {
  title: 'Awards Night',
  seasons: 'Seasons',
  seasonsEmpty: 'The first Awards Night is on the last day of Month 12.',
  greatTeams: 'Great Teams',
  greatTeamsEmpty: 'A season joins here by winning a promotion, a major cup or the Crown title, or scoring 34+ / 40 in the review.',
};
