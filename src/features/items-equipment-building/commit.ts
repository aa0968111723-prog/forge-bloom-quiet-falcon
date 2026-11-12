export type BagLike = {
  slots: () => { itemId: string; quantity: number }[];
  remove: (id: string, quantity?: number) => boolean;
  clear: () => void;
  add: (id: string, quantity?: number) => { added: number };
};

function restore(bag: BagLike, before: { itemId: string; quantity: number }[]) {
  bag.clear();
  for (const slot of before) bag.add(slot.itemId, slot.quantity);
}

/**
 * Pays a whole cost or puts the bag back. A later failure must call undo
 * before anything else is written, so a retry cannot duplicate the payment.
 */
export function takeCost(
  bag: BagLike,
  cost: Record<string, number>,
): { ok: true; undo: () => void } | { ok: false; reason: string } {
  const before = bag.slots().map((slot) => ({ ...slot }));
  const undo = () => restore(bag, before);
  for (const [id, raw] of Object.entries(cost)) {
    if (!Number.isInteger(raw) || raw <= 0) {
      undo();
      return { ok: false, reason: "材料數量不正確，沒有扣除。" };
    }
    if (!bag.remove(id, raw)) {
      undo();
      return { ok: false, reason: "材料不足，沒有扣除。" };
    }
  }
  return { ok: true, undo };
}

export const REFUND_RATE = 0.5;

/** Half of each material, rounded down. A cost of 1 refunds 0. */
export function refundOf(cost: Record<string, number>) {
  const refund: Record<string, number> = {};
  for (const [id, raw] of Object.entries(cost)) {
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const back = Math.floor(raw * REFUND_RATE);
    if (back > 0) refund[id] = back;
  }
  return refund;
}
