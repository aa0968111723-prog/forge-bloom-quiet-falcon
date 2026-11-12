import {
  BASE_CARRY,
  BASE_SLOTS,
  EMPTY_LOADOUT,
  ENGINE_SLOTS,
  PACK_CARRY,
  PACK_SLOTS,
  POCKET_MAX,
  POCKET_STEP,
  type GearInstance,
  type GearQuality,
  type Loadout,
  type QuarantineSlot,
} from "./types.ts";

export { ENGINE_SLOTS, POCKET_MAX, POCKET_STEP };
import { factOf, slotOf } from "./catalog.ts";

export type Bonus = {
  light: number;
  survey: number;
  gather: number;
  focusPerSec: number;
  moveScale: number;
  dodgeFocus: number;
  mitigation: number;
  attack: number;
  carry: number;
  craftNotesOff: number;
  bandageBonus: number;
  mintBonus: number;
  blackoutSlow: number;
  lampSlow: number;
};

export const EMPTY_BONUS: Bonus = {
  light: 0,
  survey: 0,
  gather: 0,
  focusPerSec: 0,
  moveScale: 1,
  dodgeFocus: 0,
  mitigation: 0,
  attack: 0,
  carry: BASE_CARRY,
  craftNotesOff: 0,
  bandageBonus: 0,
  mintBonus: 0,
  blackoutSlow: 1,
  lampSlow: 1,
};

export function instanceFor(gear: readonly GearInstance[], itemId: string) {
  return gear.find((row) => row.itemId === itemId) ?? null;
}

export function maxDurability(itemId: string, quality: GearQuality) {
  const fact = factOf(itemId);
  if (!fact?.durability) return 0;
  return quality === "fine" ? fact.durability.fine : fact.durability.plain;
}

/** One instance per item id. A second call does not stack another copy. */
export function ensureInstance(
  gear: readonly GearInstance[],
  itemId: string,
  quality: GearQuality,
): GearInstance[] {
  if (gear.some((row) => row.itemId === itemId)) return [...gear];
  const max = maxDurability(itemId, quality);
  if (max <= 0 && !slotOf(itemId)) return [...gear];
  return [
    ...gear,
    {
      id: `gear-${itemId}`,
      itemId,
      durability: max,
      quality,
    },
  ];
}

export function withDurability(
  gear: readonly GearInstance[],
  itemId: string,
  next: number,
): GearInstance[] {
  return gear.map((row) =>
    row.itemId === itemId
      ? { ...row, durability: Math.max(0, Math.min(maxDurability(itemId, row.quality), next)) }
      : row,
  );
}

function worn(loadout: Loadout, itemId: string | null, owned: (id: string) => boolean) {
  return Boolean(itemId && owned(itemId) && loadoutHas(loadout, itemId));
}

function loadoutHas(loadout: Loadout, itemId: string) {
  return loadout.tool === itemId || loadout.accessory === itemId || loadout.pack === itemId;
}

function liveDurability(gear: readonly GearInstance[], itemId: string) {
  const row = instanceFor(gear, itemId);
  if (!row) return maxDurability(itemId, "plain");
  if (maxDurability(itemId, row.quality) <= 0) return 1;
  return row.durability;
}

/**
 * Bonuses come only from the three slots, once.
 * The badge's life and attack stay in lifeCap / basicAttackDamage.
 */
export function gearBonus(
  loadout: Loadout | null | undefined,
  gear: readonly GearInstance[] | null | undefined,
  owned: (id: string) => boolean,
): Bonus {
  const slots = loadout ?? EMPTY_LOADOUT;
  const rows = gear ?? [];
  const bonus: Bonus = { ...EMPTY_BONUS };
  const tool = worn(slots, slots.tool, owned) ? slots.tool : null;
  const accessory = worn(slots, slots.accessory, owned) ? slots.accessory : null;
  const pack = worn(slots, slots.pack, owned) ? slots.pack : null;
  if (tool === "field-lamp" && liveDurability(rows, "field-lamp") > 0) {
    bonus.light = 12;
    bonus.lampSlow = 0.6;
  }
  if (tool === "survey-lens") bonus.survey += 3;
  if (tool === "gather-hook" && liveDurability(rows, "gather-hook") > 0) bonus.gather = 1;
  if (accessory === "focus-charm") bonus.focusPerSec = 1.5;
  if (accessory === "stride-wrap") {
    bonus.moveScale = 1.12;
    bonus.dodgeFocus = 4;
  }
  if (accessory === "ward-pin") {
    bonus.mitigation = 3;
    bonus.attack = -2;
  }
  if (pack === "field-pack") bonus.carry = BASE_CARRY + PACK_CARRY;
  if (pack === "research-satchel") bonus.craftNotesOff = 1;
  if (pack === "supply-pouch") {
    bonus.bandageBonus = 8;
    bonus.mintBonus = 8;
  }
  if (pack === "anomaly-case") {
    bonus.blackoutSlow = 0.75;
    bonus.survey += 1;
  }
  return bonus;
}

export function carryCap(loadout: Loadout | null | undefined, owned: (id: string) => boolean) {
  return gearBonus(loadout, [], owned).carry;
}

export function readPockets(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  const whole = Math.floor(value);
  const stepped = whole - (whole % POCKET_STEP);
  return Math.max(0, Math.min(POCKET_MAX, stepped));
}

/** One reading of the loadout. Wearing the pack twice does not add slots twice. */
export function slotCap(
  loadout: Loadout | null | undefined,
  pockets: number,
  owned: (id: string) => boolean,
) {
  const slots = loadout ?? EMPTY_LOADOUT;
  const wornPack = slots.pack === "field-pack" && owned("field-pack") ? PACK_SLOTS : 0;
  return Math.min(ENGINE_SLOTS, BASE_SLOTS + wornPack + readPockets(pockets));
}

function cleanId(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

/** Cloud saves reject durability outside 0..100000. Catalog rows still clamp to their own max. */
function bringDurability(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100_000, value));
}

export function readLoadout(input: {
  equipped: unknown;
  loadout: unknown;
  slots: readonly { itemId: string; quantity: number }[];
}): { loadout: Loadout; equipped: boolean } {
  const has = (id: string) => input.slots.some((slot) => slot.itemId === id && slot.quantity > 0);
  const raw = input.loadout;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const pick = (slot: "tool" | "accessory" | "pack") => {
      const id = cleanId(record[slot]);
      if (!id || !has(id) || slotOf(id) !== slot) return null;
      return id;
    };
    const loadout = { tool: pick("tool"), accessory: pick("accessory"), pack: pick("pack") };
    return { loadout, equipped: loadout.accessory === "badge" };
  }
  const equipped = input.equipped === true && has("badge");
  return {
    loadout: { tool: null, accessory: equipped ? "badge" : null, pack: null },
    equipped,
  };
}

export function readGear(raw: unknown): { gear: GearInstance[]; dropped: GearInstance[] } {
  if (!Array.isArray(raw)) return { gear: [], dropped: [] };
  const gear: GearInstance[] = [];
  const dropped: GearInstance[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const id = cleanId(record.id);
    const itemId = cleanId(record.itemId);
    if (!id || !itemId || !slotOf(itemId)) {
      if (id && itemId)
        dropped.push({
          id,
          itemId,
          durability: bringDurability(record.durability),
          quality: record.quality === "fine" ? "fine" : "plain",
        });
      continue;
    }
    if (gear.some((entry) => entry.id === id || entry.itemId === itemId)) continue;
    const quality: GearQuality = record.quality === "fine" ? "fine" : "plain";
    const max = maxDurability(itemId, quality);
    const durability =
      typeof record.durability === "number" && Number.isFinite(record.durability)
        ? Math.max(0, Math.min(max || 0, record.durability))
        : max;
    gear.push({ id, itemId, durability, quality });
  }
  return { gear, dropped };
}

function gearRow(raw: unknown): GearInstance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = cleanId(record.id);
  const itemId = cleanId(record.itemId);
  if (!id || !itemId) return null;
  return {
    id,
    itemId,
    durability: bringDurability(record.durability),
    quality: record.quality === "fine" ? "fine" : "plain",
  };
}

/** Instances kept aside because their item id is not in this catalog. */
export function readQuarantineGear(raw: unknown): GearInstance[] {
  if (!Array.isArray(raw)) return [];
  const rows: GearInstance[] = [];
  for (const row of raw) {
    const gear = gearRow(row);
    if (!gear) continue;
    if (rows.some((entry) => entry.id === gear.id || entry.itemId === gear.itemId)) continue;
    rows.push(gear);
  }
  return rows.slice(0, 24);
}

/** Saved quarantine stays. Newly rejected instances are added beside it. */
export function mergeQuarantineGear(saved: readonly GearInstance[], dropped: readonly GearInstance[]) {
  const rows = [...saved];
  for (const row of dropped) {
    if (rows.some((entry) => entry.id === row.id || entry.itemId === row.itemId)) continue;
    rows.push(row);
  }
  return rows.slice(0, 24);
}

export function readQuarantine(raw: unknown): QuarantineSlot[] {
  if (!Array.isArray(raw)) return [];
  const rows: QuarantineSlot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const itemId = cleanId(record.itemId);
    const quantity = record.quantity;
    if (!itemId || typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) continue;
    if (rows.some((entry) => entry.itemId === itemId)) continue;
    rows.push({ itemId, quantity: Math.min(99, Math.floor(quantity)) });
  }
  return rows.slice(0, 24);
}
