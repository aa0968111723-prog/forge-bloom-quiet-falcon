import { slotOf } from "../../features/items-equipment-building/catalog";
import type { Loadout } from "../../features/items-equipment-building/types";
import { ITEMS } from "./data";

export type PackFilter = "all" | "consumable" | "material" | "equipment" | "rare";
export type PackSort = "stored" | "name" | "quantity";

export type PackSlot = { itemId: string; quantity: number };

export type PackRow = {
  index: number;
  itemId: string;
  icon: string;
  name: string;
  quantity: number;
  category: string;
  usable: boolean;
  state: string;
};

export type PackViewOptions = {
  filter: PackFilter;
  sort: PackSort;
  hp: number;
  maxHp: number;
  focus: number;
  equipped: boolean;
  loadout?: Loadout;
};

const FILTER_CATEGORY: Record<Exclude<PackFilter, "all">, string> = {
  consumable: "consumable",
  material: "material",
  equipment: "equipment",
  rare: "rare",
};

function itemUsable(
  id: string,
  category: string,
  options: PackViewOptions,
): boolean {
  if (id === "coffee") return options.hp < options.maxHp;
  if (id === "tea") return options.focus < 100;
  if (category === "equipment") return true;
  return false;
}

function stateLabel(
  id: string,
  category: string,
  usable: boolean,
  options: PackViewOptions,
): string {
  if (id === "badge") return options.equipped ? "已裝備" : "可裝備";
  if (category === "equipment") {
    const slot = slotOf(id);
    if (slot && options.loadout?.[slot] === id) return "已裝備";
    return "可裝備";
  }
  if (category === "consumable") return usable ? "可使用" : "不可用";
  return "不可用";
}

/** Display rows for the backpack. Storage indexes stay on the rows; nothing is rewritten. */
export function packView(
  slots: readonly PackSlot[],
  options: PackViewOptions,
): PackRow[] {
  const rows: PackRow[] = [];
  slots.forEach((slot, index) => {
    const item = ITEMS.find((entry) => entry.id === slot.itemId);
    if (!item) return;
    if (
      options.filter !== "all" &&
      item.category !== FILTER_CATEGORY[options.filter]
    )
      return;
    const usable = itemUsable(item.id, item.category, options);
    rows.push({
      index,
      itemId: item.id,
      icon: item.icon,
      name: item.name,
      quantity: slot.quantity,
      category: item.category,
      usable,
      state: stateLabel(item.id, item.category, usable, options),
    });
  });
  if (options.sort === "stored") return rows;
  const ordered = [...rows];
  if (options.sort === "name") {
    ordered.sort(
      (a, b) => a.name.localeCompare(b.name, "zh-Hant") || a.index - b.index,
    );
  } else {
    ordered.sort((a, b) => b.quantity - a.quantity || a.index - b.index);
  }
  return ordered;
}
