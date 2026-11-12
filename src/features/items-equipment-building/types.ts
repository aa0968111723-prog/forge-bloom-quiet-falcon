/** Stable ids live on the catalog. Durability lives on an instance id. */

export type ItemCategory =
  | "material"
  | "consumable"
  | "equipment"
  | "rare"
  | "quest"
  | "recipe";

export type GearSlot = "tool" | "accessory" | "pack";

export type GearQuality = "plain" | "fine";

export type ItemFact = {
  id: string;
  name: string;
  icon: string;
  category: ItemCategory;
  description: string;
  maxStack: number;
  weight: number;
  slot: GearSlot | null;
  source: string;
  use: string;
  effect: string;
  durability: { plain: number; fine: number } | null;
  /** Quest and recipe pages cannot be discarded. */
  locked: boolean;
  /** Mission that can restore one copy after it is claimed. */
  mission: string | null;
};

export type Loadout = {
  tool: string | null;
  accessory: string | null;
  pack: string | null;
};

export type GearInstance = {
  id: string;
  itemId: string;
  durability: number;
  quality: GearQuality;
};

export type QuarantineSlot = { itemId: string; quantity: number };

export const EMPTY_LOADOUT: Loadout = { tool: null, accessory: null, pack: null };

export const BASE_CARRY = 80;
export const PACK_CARRY = 48;

/** The bag everyone starts with. */
export const BASE_SLOTS = 24;
/** Extra slots while the field pack is worn. Unequipping does not delete items. */
export const PACK_SLOTS = 4;
/** Cloth sewn on at a supply station. Permanent, and still the same bag. */
export const POCKET_STEP = 4;
export const POCKET_MAX = 8;
export const ENGINE_SLOTS = BASE_SLOTS + PACK_SLOTS + POCKET_MAX;
