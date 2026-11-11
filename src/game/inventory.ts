/**
 * Backpack inventory. Pure data and functions — no React, no Three.js — so
 * node:test can drive add / list / remove / use without a browser.
 *
 * Capacity is the total item count (sum of stacks). Overflow is rejected;
 * nothing is silently dropped.
 */

export const ITEM_IDS = [
  "notes",
  "pen",
  "coffee",
  "lantern",
  "brick",
  "stamp-ink",
  "first-aid",
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export type InventoryItem = { id: ItemId; count: number };

export type Inventory = {
  items: InventoryItem[];
  capacity: number;
};

export const ITEM_CATALOG: Record<ItemId, { name: string; nameEn: string }> = {
  notes: { name: "筆記", nameEn: "Notes" },
  pen: { name: "鋼筆", nameEn: "Fountain pen" },
  coffee: { name: "黑咖啡", nameEn: "Black coffee" },
  lantern: { name: "宮燈", nameEn: "Lantern" },
  brick: { name: "紅磚", nameEn: "Red brick" },
  "stamp-ink": { name: "蓋章墨", nameEn: "Stamp ink" },
  "first-aid": { name: "保健箱", nameEn: "First aid" },
};

/** Items the player can consume from the backpack. */
export const USABLE_ITEMS: readonly ItemId[] = ["coffee", "first-aid", "notes"];

export const DEFAULT_CAPACITY = 12;

export type InventoryFail = "overflow" | "missing" | "unknown";

export type InventoryOk = { ok: true; inventory: Inventory };
export type InventoryErr = { ok: false; reason: InventoryFail };
export type InventoryResult = InventoryOk | InventoryErr;

export function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && (ITEM_IDS as readonly string[]).includes(value);
}

export function emptyInventory(capacity = DEFAULT_CAPACITY): Inventory {
  return { items: [], capacity: Math.max(0, Math.floor(capacity)) };
}

export function usedSlots(inv: Inventory): number {
  let n = 0;
  for (const it of inv.items) n += it.count;
  return n;
}

/** Copy of stacks with count > 0, in insertion order. */
export function listItems(inv: Inventory): InventoryItem[] {
  return inv.items.filter((it) => it.count > 0).map((it) => ({ id: it.id, count: it.count }));
}

export function itemCount(inv: Inventory, id: ItemId): number {
  for (const it of inv.items) if (it.id === id) return it.count;
  return 0;
}

function clone(inv: Inventory): Inventory {
  return { capacity: inv.capacity, items: inv.items.map((it) => ({ id: it.id, count: it.count })) };
}

export function addItem(inv: Inventory, id: ItemId, count = 1): InventoryResult {
  if (!isItemId(id)) return { ok: false, reason: "unknown" };
  const n = Math.floor(count);
  if (n <= 0) return { ok: true, inventory: clone(inv) };
  if (usedSlots(inv) + n > inv.capacity) return { ok: false, reason: "overflow" };
  const next = clone(inv);
  const row = next.items.find((it) => it.id === id);
  if (row) row.count += n;
  else next.items.push({ id, count: n });
  return { ok: true, inventory: next };
}

export function removeItem(inv: Inventory, id: ItemId, count = 1): InventoryResult {
  if (!isItemId(id)) return { ok: false, reason: "unknown" };
  const n = Math.floor(count);
  if (n <= 0) return { ok: true, inventory: clone(inv) };
  const have = itemCount(inv, id);
  if (have < n) return { ok: false, reason: "missing" };
  const next = clone(inv);
  const row = next.items.find((it) => it.id === id);
  if (!row) return { ok: false, reason: "missing" };
  row.count -= n;
  next.items = next.items.filter((it) => it.count > 0);
  return { ok: true, inventory: next };
}

/** Consume one item. Same as remove of count 1; callers apply side effects. */
export function useItem(inv: Inventory, id: ItemId): InventoryResult {
  return removeItem(inv, id, 1);
}

export function withCapacity(inv: Inventory, capacity: number): Inventory {
  return { items: listItems(inv), capacity: Math.max(0, Math.floor(capacity)) };
}

const STARTER: readonly [ItemId, number][] = [
  ["notes", 3],
  ["pen", 2],
  ["coffee", 1],
  ["brick", 4],
  ["first-aid", 1],
];

export function starterInventory(capacity = DEFAULT_CAPACITY): Inventory {
  let inv = emptyInventory(capacity);
  for (const [id, n] of STARTER) {
    const r = addItem(inv, id, n);
    if (r.ok) inv = r.inventory;
  }
  return inv;
}

export function coerceInventory(raw: unknown, capacity = DEFAULT_CAPACITY): Inventory {
  const cap = typeof capacity === "number" && Number.isFinite(capacity) ? Math.max(0, Math.floor(capacity)) : DEFAULT_CAPACITY;
  const inv = emptyInventory(cap);
  if (!raw || typeof raw !== "object") return inv;
  const items = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];
  let next = inv;
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const id = (row as { id?: unknown }).id;
    const count = (row as { count?: unknown }).count;
    if (!isItemId(id)) continue;
    const n = typeof count === "number" && Number.isFinite(count) ? Math.floor(count) : 0;
    if (n <= 0) continue;
    const r = addItem(next, id, n);
    if (r.ok) next = r.inventory;
  }
  return next;
}
