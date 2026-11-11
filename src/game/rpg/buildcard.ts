import { ITEMS, RECIPES, type BuildKind } from "./data.ts";
import {
  canPay,
  FACILITY_CAP,
  FACILITY_CAP_NOTICE,
  footprint,
} from "./rules.ts";

/** chooseBuild refuses with this when there is no department or the player is indoors. */
export const BUILD_NEED_OUTDOORS = "請到校園戶外建造設施。";
/** place refuses with this after the spot is legal and the bag cannot pay. */
export const BUILD_NEED_MATERIALS = "建造材料不足，可探索校園或擊退異象取得。";

export type BuildMaterialView = {
  id: string;
  name: string;
  cost: number;
  held: number;
  short: number;
};

export type BuildCardView = {
  id: BuildKind;
  name: string;
  purpose: string;
  width: number;
  depth: number;
  size: string;
  durability: number;
  materials: BuildMaterialView[];
  shortage: BuildMaterialView[];
  shortageText: string;
  canPlace: boolean;
  hint: string | null;
  status: string;
};

export type BuildResourceView = {
  id: string;
  name: string;
  held: number;
};

export type BuildCardsView = {
  needsOutdoors: boolean;
  atCap: boolean;
  cap: number;
  count: number;
  resources: BuildResourceView[];
  cards: BuildCardView[];
};

/**
 * Recipe cards before a spot is chosen.
 * Reads live bag counts and does not add or remove items.
 * Size is the unrotated footprint. Durability is the health a new building records.
 * Slope, overlap, doors, and standing too close stay off the card.
 */
export function buildCards(input: {
  interiorId: string | null;
  departmentId: string | null;
  buildingCount: number;
  count: (id: string) => number;
}): BuildCardsView {
  const count = input.count;
  const needsOutdoors = !input.departmentId || Boolean(input.interiorId);
  const atCap = input.buildingCount >= FACILITY_CAP;
  const costIds = new Set(RECIPES.flatMap((recipe) => Object.keys(recipe.cost)));
  const resources = orderedIds(costIds).map((id) => ({
    id,
    name: itemName(id),
    held: count(id),
  }));
  const cards = RECIPES.map((recipe) => {
    const box = footprint(recipe.id, 0);
    const materials = orderedIds(new Set(Object.keys(recipe.cost))).map((id) => {
      const cost = recipe.cost[id];
      const held = count(id);
      return {
        id,
        name: itemName(id),
        cost,
        held,
        short: Math.max(0, cost - held),
      };
    });
    const shortage = materials.filter((material) => material.short > 0);
    const hint = needsOutdoors
      ? BUILD_NEED_OUTDOORS
      : atCap
        ? FACILITY_CAP_NOTICE
        : canPay(recipe.cost, count)
          ? null
          : BUILD_NEED_MATERIALS;
    return {
      id: recipe.id,
      name: recipe.name,
      purpose: recipe.description,
      width: box.width,
      depth: box.depth,
      size: `${box.width} × ${box.depth}`,
      durability: recipe.health,
      materials,
      shortage,
      shortageText: shortage.length
        ? shortage.map((material) => `${material.name} ${material.short}`).join("、")
        : "沒有缺額",
      canPlace: hint == null,
      hint,
      status: hint ?? "可以放置",
    };
  });
  return {
    needsOutdoors,
    atCap,
    cap: FACILITY_CAP,
    count: input.buildingCount,
    resources,
    cards,
  };
}

function orderedIds(ids: Set<string>) {
  const known = ITEMS.map((item) => item.id).filter((id) => ids.has(id));
  const rest = [...ids].filter((id) => !known.includes(id));
  return [...known, ...rest];
}

function itemName(id: string) {
  return ITEMS.find((item) => item.id === id)?.name ?? id;
}
