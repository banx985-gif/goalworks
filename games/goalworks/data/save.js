// Where and how GOALWORKS saves (Milestone 0, bible §5 / §36). Its own database, so it never meets another series
// game's saves. Four campaign slots on core/CampaignSlots (keys campaign_1 … campaign_4, each its own rolling
// SaveSlot, plus a small summary record per slot that the slot screen reads without loading the campaign). The
// account store (achievements, tokens, Hall of Fame … later) is its own key, never touched by a slot overwrite/delete.
export const SAVE = {
  dbName: 'goalworks',
  localPrefix: 'goalworks:',
  count: 4,
  prefix: 'campaign_',
  accountKey: 'goalworks:account',
  version: 1,
};
