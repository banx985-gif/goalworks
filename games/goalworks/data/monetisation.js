// Club Tokens, Remove Ads and the optional ads (Milestone 30, bible §35, SERIES_KAIROSOFT_LESSONS rule 9). Plain data; the
// rules live in src/systems/monetisation.js on core/CommerceService, core/EntitlementService and core/AdService.
//
// The series money rules beat the bible where they differ: Club Tokens buy an ordinary transfer-market refresh, a new
// sponsor offer and cosmetic trims — never a research speed-up, a training refresh / reroll, a Legendary or Secret
// player, a secret ability, a promotion, a secret trigger, Prestige Tokens, a win, a goal or a result. No stamina, no
// gacha, no subscription. Prices always come from the store (the debug store's are only stand-ins).

// The store's products. Token packs are consumable (bought again and again, never restored); Remove Ads is a one-time
// purchase (restored on a new phone). Keys = the Play product ids.
export const PRODUCTS = {
  gw_tokens_small: { kind: 'consumable', name: 'A bag of Club Tokens', grant: { tokens: 80 }, price: '£0.99' },
  gw_tokens_medium: { kind: 'consumable', name: 'A crate of Club Tokens', grant: { tokens: 260 }, price: '£2.99' },
  gw_tokens_large: { kind: 'consumable', name: 'A vault of Club Tokens', grant: { tokens: 700 }, price: '£6.99' },
  gw_remove_ads: { kind: 'nonConsumable', entitlement: 'removeAds', name: 'Remove Ads', price: '£2.99' },
};
export const PACKS = ['gw_tokens_small', 'gw_tokens_medium', 'gw_tokens_large'];

// Club Tokens earned in play (slowly): each once per key (an achievement once per account; a secret, an Awards Night,
// a sponsor deal once per club).
export const EARN = {
  achievement: 3,
  secret: 5,
  awardsNight: 4,
  sponsorAllMet: 2, // a deal ended with every objective met
};

// What Club Tokens buy: the only spends there are (anything else is refused, src/systems/monetisation.js spend()).
export const TOKEN_SINKS = {
  marketRefresh: { name: 'Refresh the transfer market', cost: 20, line: 'New faces on the market and free-agent lists (talks you have open are kept)' },
  sponsorRefresh: { name: 'A new sponsor offer', cost: 25, line: 'Celeste calls another sponsor now instead of waiting' },
  cosmetic: { name: 'A cosmetic trim', cost: 60, line: 'Looks only: changes nothing on the pitch' },
};

// The cosmetic trims (looks only). plate: the club name plate's border (the badge theme); fence: the ground's top rail
// (the stadium theme). Kit themes wait for the kit clash checker (M32) so a trim can never make two kits alike.
export const COSMETICS = [
  { id: 'plate_gold', kind: 'plate', name: 'Gold plate trim', colour: '#E8B520', ink: '#7A5A00' },
  { id: 'plate_silver', kind: 'plate', name: 'Silver plate trim', colour: '#C9D1DA', ink: '#5B6670' },
  { id: 'plate_neon', kind: 'plate', name: 'Neon plate trim', colour: '#39F0C8', ink: '#0B6B57' },
  { id: 'fence_gold', kind: 'fence', name: 'Gold fence rail', colour: '#E8B520' },
  { id: 'fence_white', kind: 'fence', name: 'Painted white rail', colour: '#F4F6F8' },
  { id: 'fence_navy', kind: 'fence', name: 'Navy rail', colour: '#24356B' },
];
export const cosmeticById = (id) => COSMETICS.find((c) => c.id === id) ?? null;

// What can never be bought (shown on the Shop sheet, and checked by tests/goalworks/m30.test.mjs).
export const NEVER_FOR_SALE = [
  { id: 'researchSpeedUp', name: 'Research speed-ups' },
  { id: 'trainingReroll', name: 'Training refreshes or rerolls' },
  { id: 'legendary', name: 'Legendary or Secret players' },
  { id: 'secretAbility', name: 'Secret abilities' },
  { id: 'promotion', name: 'Promotions' },
  { id: 'secretTrigger', name: 'Secret triggers or tournaments' },
  { id: 'prestigeTokens', name: 'Prestige Tokens' },
  { id: 'results', name: 'Wins, goals or results' },
  { id: 'stamina', name: 'Energy or stamina' },
  { id: 'gacha', name: 'Random prize packs' },
];

// Rewarded ads (always optional). per 'realHours': counted against real time on this account; 'month': once per game
// month of the open club.
export const REWARDED = [
  { id: 'tokenGift', name: '+5 Club Tokens', reward: { tokens: 5 }, limit: { per: 'realHours', count: 3, hours: 24 }, blurb: 'Watch a short ad for 5 Club Tokens (3 a day)' },
  { id: 'marketRefresh', name: 'Free market refresh', limit: { per: 'month', count: 1 }, blurb: 'Watch a short ad to refresh the transfer market (once a month)' },
  { id: 'sponsorRefresh', name: 'Free sponsor offer', limit: { per: 'month', count: 1 }, blurb: 'Watch a short ad for a new sponsor offer (once a month)' },
];
export const REWARDED_BY_ID = Object.fromEntries(REWARDED.map((p) => [p.id, p]));

// Interstitials: only after a match result (never mid-match or with a decision waiting), never before the first
// competitive match has finished, and capped per hour. Remove Ads switches them off for good.
export const INTERSTITIAL_CAPS = { firstInstallQuietMin: 10, minGapMin: 15, maxPerHour: 2, afterResumeQuietSec: 60, afterPurchaseQuietMin: 10, breakPoints: ['matchResult'] };

export const STORE_MESSAGES = {
  purchased: 'Thank you! Your purchase is ready.',
  restored: 'Purchases restored.',
  nothingToRestore: 'Nothing to restore: Remove Ads has not been bought on this account. (Token packs are used up, so they never come back.)',
};
export const SHOP_TEXT = {
  title: 'Club Token Shop',
  subtitle: 'Optional. Nothing here buys wins, players, secrets or results.',
  honesty: 'GOALWORKS is free to play with optional ads and optional purchases (Club Tokens and Remove Ads). Everything in the game can be earned by playing; nothing for sale changes a match.',
  earnLine: `Earn Club Tokens by playing: ${EARN.achievement} for an achievement, ${EARN.secret} for a secret, ${EARN.awardsNight} each Awards Night, ${EARN.sponsorAllMet} for a sponsor deal with every objective met.`,
  noClub: 'Open a club first',
  adTag: 'Watch an ad',
  adUnavailable: 'No ad to show right now',
  adBusy: 'An ad is already playing',
  storeUnavailable: 'The store is not available right now. Nothing was charged.',
};
