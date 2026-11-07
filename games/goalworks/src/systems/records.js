// Club records with their previous holder (Milestone 27). Tiny on purpose (no imports): transfers.js and the stadium can
// note a record without pulling in the achievements system.
//   data.records = { id: { value, text, day, prev: { value, text, day } | null } }
//   noteRecord(data, id, value, text, day) → true when it is a new record (the old one becomes prev)
export function noteRecord(data, id, value, text, day) {
  if (!(value > 0)) return false;
  const R = (data.records ??= {});
  const cur = R[id];
  if (cur && value <= cur.value) return false;
  R[id] = { value, text, day, prev: cur ? { value: cur.value, text: cur.text, day: cur.day } : null };
  return true;
}
