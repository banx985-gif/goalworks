// The four campaign slots (Milestone 0, bible §5 / §36) on core/CampaignSlots: the slot cards, Continue (the
// last-used slot), starting a club into a slot (START CLUB) and deleting one. Screens ask "are you sure" first; this
// module only does the writing. save(n, data) is the open slot's autosave (its campaign save and its summary record);
// older saves are moved up to date on load (SAVE_MIGRATIONS).
import { CampaignSlots } from '../../../../core/CampaignSlots.js';
import { newCampaign, slotSummary } from '../systems/club.js';
import { SAVE_MIGRATIONS, validateRun, validateAccount } from '../systems/migrate.js';

export function createCampaigns({ adapter, save, bus = null }) {
  // (M33, bible §36) every slot and the account keep their last 3 good copies (core SaveStore: write the next copy, read it
  // back and check it, only then is it the current one); a copy that is damaged, half-written or fails the game's check
  // is passed over for the newest good one. A newer game's save is never written over. An account no copy of which reads
  // is kept aside whole (quarantined) before a fresh one starts.
  const slots = new CampaignSlots({ adapter, count: save.count, prefix: save.prefix, accountKey: save.accountKey, version: save.version, migrations: SAVE_MIGRATIONS, describe: slotSummary, bus, validate: validateRun, refuseNewer: true, accountVersion: 1, accountValidate: validateAccount, quarantineAccount: true });
  let cards = slots.numbers().map((n) => ({ n, empty: true, summary: null, error: null }));
  let last = null;

  return {
    slots,
    get cards() {
      return cards;
    },
    // Continue: the last-used slot when it still holds a club, else none.
    get last() {
      return last != null && cards[last - 1]?.summary ? last : null;
    },
    card: (n) => cards[n - 1] ?? null,
    async refresh() {
      cards = await slots.summaries();
      last = await slots.lastUsed();
      return cards;
    },
    firstEmpty() {
      return cards.find((c) => c.empty)?.n ?? null;
    },
    // START CLUB: the summary record and a new campaign save into slot n (replacing what was there).
    async start(n, setup) {
      const data = newCampaign(setup);
      await slots.create(n, { data, summary: slotSummary(data) });
      await this.refresh();
      return data;
    },
    // (M33) what the last open / account load had to do: { fallback, damaged, savedAt } (a gentle message when it fell back)
    loadNote(n) {
      const L = n === 'account' ? slots.account.lastLoad : slots.slot(n).lastLoad;
      return L ? { fallback: !!L.fallback, damaged: L.damaged ?? [], savedAt: L.record?.savedAt ?? null } : null;
    },
    // (M33) Copy: slot n's club into slot m (an empty one; the screen asks first)
    async copy(n, m) {
      const data = await slots.load(n);
      if (!data) return false;
      await slots.create(m, { data, summary: slotSummary(data) });
      await this.refresh();
      return true;
    },
    async open(n) {
      const data = await slots.load(n);
      if (data) await slots.setLastUsed(n);
      last = data ? n : last;
      return data;
    },
    // The open campaign's autosave: its run save, then its summary record (so the slot card shows the new date).
    async save(n, data) {
      await slots.save(n, data);
      await slots.writeSummary(n, slotSummary(data));
      const c = cards[n - 1];
      if (c) cards[n - 1] = { ...c, empty: false, summary: slotSummary(data) };
    },
    async remove(n) {
      await slots.remove(n);
      await this.refresh();
    },
  };
}
