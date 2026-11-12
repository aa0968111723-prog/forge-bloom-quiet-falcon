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
