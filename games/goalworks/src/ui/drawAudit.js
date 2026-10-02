// What was drawn last frame, and whether its picture really has something in it (Milestone 12b). On Aaron's phone whole
// facilities, the squad's bodies, our XI and the ball "vanished": they were drawn, but from canvases the GPU had wiped
// (see core/CanvasLoss). A screen notes each thing it draws (id → image key); report() checks every expected id was drawn
// this frame from a picture — and its size-cached copies — with visible pixels.
//   const audit = createDrawAudit(assets)
//   audit.begin()  (start of a frame) · audit.note(id, key) (each thing drawn)
//   audit.report(ids) → { ok, drawn, missing: [id], blank: [{ id, key }] }
const SIDE = 24;
let probe = null;

// Share of a picture's pixels that are not see-through (on a small copy).
export function visibleShare(img) {
  if (!img || typeof document === 'undefined') return 0;
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  probe.canvas.width = probe.canvas.height = SIDE;
  probe.clearRect(0, 0, SIDE, SIDE);
  try {
    probe.drawImage(img, 0, 0, SIDE, SIDE);
  } catch {
    return 0;
  }
  const px = probe.getImageData(0, 0, SIDE, SIDE).data;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 16) n++;
  return n / (SIDE * SIDE);
}

export function createDrawAudit(assets) {
  let seen = new Map();
  return {
    begin() {
      seen = new Map();
    },
    note(id, key) {
      seen.set(id, key);
    },
    get seen() {
      return seen;
    },
    report(ids) {
      const missing = [];
      const blank = [];
      const checked = new Map(); // key → ok (several players share a body)
      for (const id of ids) {
        const key = seen.get(id);
        if (key == null) {
          missing.push(id);
          continue;
        }
        if (!checked.has(key)) {
          const img = assets.get(key);
          const copies = [...(assets.sprites.byKey.get(key)?.values() ?? [])];
          checked.set(key, !!img && visibleShare(img) > 0.02 && copies.every((c) => visibleShare(c) > 0.02));
        }
        if (!checked.get(key)) blank.push({ id, key });
      }
      return { ok: !missing.length && !blank.length, drawn: seen.size, missing, blank };
    },
  };
}
