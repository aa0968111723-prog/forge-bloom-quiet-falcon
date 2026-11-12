import { factOf, REPAIR_COST, WRENCH_RESTORE } from "./catalog.ts";
import { gearBonus, maxDurability } from "./gear.ts";
import type { GearInstance, GearQuality, Loadout } from "./types.ts";

export type CraftPlan =
  | { ok: true; cost: Record<string, number>; quality: GearQuality; station: string }
  | { ok: false; reason: string };

const RECIPES: Record<string, { cost: Record<string, number>; station: "research" | "supply"; page?: string }> = {
  "field-lamp": { cost: { notes: 4, parts: 3, copper: 2 }, station: "research", page: "recipe-lamp" },
  "survey-lens": { cost: { notes: 3, glass: 2 }, station: "research", page: "recipe-lens" },
  "repair-wrench": { cost: { parts: 4, copper: 2 }, station: "research" },
  "gather-hook": { cost: { parts: 3, cloth: 1 }, station: "research" },
  "focus-charm": { cost: { herb: 3, ink: 1 }, station: "research" },
  "stride-wrap": { cost: { cloth: 3, herb: 1 }, station: "research" },
  "ward-pin": { cost: { copper: 2, chalk: 2 }, station: "research" },
  "field-pack": { cost: { cloth: 4, parts: 2 }, station: "research" },
  "research-satchel": { cost: { notes: 6, ink: 2 }, station: "research" },
  "supply-pouch": { cost: { cloth: 2, herb: 2 }, station: "supply" },
  "anomaly-case": { cost: { resin: 2, glass: 2, credit: 1 }, station: "research" },
  bandage: { cost: { cloth: 1, herb: 1 }, station: "supply" },
  "lamp-oil": { cost: { resin: 1 }, station: "research" },
  mint: { cost: { herb: 1, tea: 1 }, station: "supply" },
};

export function craftRecipe(id: string) {
  return RECIPES[id] ?? null;
}

export function craftIds() {
  return Object.keys(RECIPES);
}

export function planCraft(input: {
  id: string;
  quality: GearQuality;
  count: (id: string) => number;
  loadout: Loadout;
  nearResearch: boolean;
  nearSupply: boolean;
}): CraftPlan {
  const fact = factOf(input.id);
  const recipe = RECIPES[input.id];
  if (!fact || !recipe) return { ok: false, reason: "沒有這個配方。" };
  if (fact.maxStack === 1 && input.count(input.id) > 0)
    return { ok: false, reason: "已經帶著這件裝備。" };
  if (recipe.page && input.count(recipe.page) <= 0)
    return { ok: false, reason: "還沒有對應的配方頁。" };
  if (recipe.station === "research" && !input.nearResearch)
    return { ok: false, reason: "需要站在研究桌旁。" };
  if (recipe.station === "supply" && !input.nearSupply)
    return { ok: false, reason: "需要站在補給站旁。" };
  const bonus = gearBonus(input.loadout, [], (id) => input.count(id) > 0);
  const cost: Record<string, number> = {};
  for (const [id, amount] of Object.entries(recipe.cost)) {
    let need = amount;
    if (id === "notes") need = Math.max(1, amount - bonus.craftNotesOff);
    if (need > 0) cost[id] = need;
  }
  if (input.quality === "fine") {
    if (!fact.durability) return { ok: false, reason: "這件物品沒有精工耐久。" };
    cost.credit = (cost.credit ?? 0) + 1;
  }
  for (const [id, amount] of Object.entries(cost)) {
    if (input.count(id) < amount) return { ok: false, reason: "材料不足，沒有扣除。" };
  }
  return { ok: true, cost, quality: input.quality, station: recipe.station };
}

export function planRepair(input: {
  loadout: Loadout;
  gear: readonly GearInstance[];
  owned: (id: string) => boolean;
  building: { hp: number; max: number } | null;
}): { ok: true; next: number } | { ok: false; reason: string } {
  if (input.loadout.tool !== "repair-wrench" || !input.owned("repair-wrench"))
    return { ok: false, reason: "先裝備修復扳手。" };
  const row = input.gear.find((entry) => entry.itemId === "repair-wrench");
  const durability = row?.durability ?? maxDurability("repair-wrench", "plain");
  if (durability < REPAIR_COST) return { ok: false, reason: "扳手耐久不足，沒有消耗。" };
  if (!input.building) return { ok: false, reason: "附近沒有需要修復的設施。" };
  if (input.building.hp >= input.building.max) return { ok: false, reason: "設施是滿的，沒有消耗耐久。" };
  return { ok: true, next: durability - REPAIR_COST };
}

export function planWrenchService(gear: readonly GearInstance[], parts: number) {
  const row = gear.find((entry) => entry.itemId === "repair-wrench");
  if (!row) return { ok: false as const, reason: "沒有修復扳手。" };
  const max = maxDurability(row.itemId, row.quality);
  if (row.durability >= max) return { ok: false as const, reason: "扳手是滿的，沒有消耗零件。" };
  if (parts < 1) return { ok: false as const, reason: "沒有構築零件，沒有消耗。" };
  return { ok: true as const, next: Math.min(max, row.durability + WRENCH_RESTORE) };
}
