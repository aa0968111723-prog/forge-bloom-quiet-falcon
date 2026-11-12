/**
 * One readout for the backpack detail and the coffee/tea decision.
 * Life cap and basic attack come from the same functions combat already uses.
 */
import { BANDAGE_HEAL, factOf, MINT_FOCUS } from "../../features/items-equipment-building/catalog";
import { CAMPUS_SITES, SUPPLY_NODES } from "./campus";
import { ENEMY_TYPES, ITEMS, MISSIONS } from "./data";
import { basicAttackDamage, lifeCap } from "./rules";

export const COFFEE_HEAL = 45;
export const TEA_FOCUS = 55;
export const FOCUS_CAP = 100;

export type ItemAction = "use" | "equip" | "unequip";
export type ItemMark = "ready" | "full" | "empty";

export type ItemVerdict = {
  allowed: boolean;
  reason: string;
  mark: ItemMark;
};

export type ItemDetailInput = {
  itemId: string;
  count: number;
  hp: number;
  focus: number;
  xp: number;
  equipped: boolean;
};

export type ItemDetail = {
  itemId: string;
  purpose: string;
  effect: string;
  quantity: number;
  clue: string;
  action: string;
  allowed: boolean;
  reason: string;
  lifeUnequipped: number;
  lifeEquipped: number;
  attackUnequipped: number;
  attackEquipped: number;
  lifeFrom: number;
  lifeTo: number;
  lifeDelta: number;
  attackFrom: number;
  attackTo: number;
  attackDelta: number;
  source: string;
  stack: string;
  weight: string;
};

const EMPTY_REASON = "背包裡沒有這個物品。";
const FULL_REASON = "狀態已滿，不需要消耗物品。";
const BADGE_REASON = "沒有五虎崗徽章，無法改變裝備。";

export function itemVerdict(input: {
  id: string;
  count: number;
  hp: number;
  maxLife: number;
  focus: number;
  action: ItemAction;
}): ItemVerdict {
  if (input.action === "equip" || input.action === "unequip") {
    if (input.count <= 0) return { allowed: false, reason: BADGE_REASON, mark: "empty" };
    return { allowed: true, reason: "", mark: "ready" };
  }
  const drink =
    input.id === "coffee" ||
    input.id === "tea" ||
    input.id === "mint" ||
    input.id === "bandage" ||
    input.id === "lamp-oil";
  if (!drink) {
    return { allowed: false, reason: "這件物品不能使用。", mark: "empty" };
  }
  if (input.count <= 0) return { allowed: false, reason: EMPTY_REASON, mark: "empty" };
  if ((input.id === "coffee" || input.id === "bandage") && input.hp >= input.maxLife) {
    return { allowed: false, reason: FULL_REASON, mark: "full" };
  }
  if ((input.id === "tea" || input.id === "mint") && input.focus >= FOCUS_CAP) {
    return { allowed: false, reason: FULL_REASON, mark: "full" };
  }
  return { allowed: true, reason: "", mark: "ready" };
}

function namedCount(bag: object, itemId: string): number {
  const value = (bag as unknown as Record<string, unknown>)[itemId];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function acquisitionClue(itemId: string): string {
  for (const node of SUPPLY_NODES) {
    if (namedCount(node.items, itemId) <= 0) continue;
    const siteId = node.id.startsWith("supply-") ? node.id.slice("supply-".length) : node.id;
    const site = CAMPUS_SITES.find((entry) => entry.id === siteId);
    return `補給：${site?.name ?? node.id}`;
  }
  for (const mission of MISSIONS) {
    if (namedCount(mission.reward, itemId) > 0) return `委託：${mission.name}`;
  }
  for (const enemy of Object.values(ENEMY_TYPES)) {
    if (namedCount(enemy.reward, itemId) > 0) return `擊退：${enemy.name}`;
  }
  return "目前的補給、委託和敵人掉落都沒有這件物品。";
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

/** Purpose, effect, count, source, action, and the badge's before/after comparison. */
export function itemDetail(input: ItemDetailInput): ItemDetail {
  const item = ITEMS.find((entry) => entry.id === input.itemId);
  const lifeUnequipped = lifeCap(input.xp, false);
  const lifeEquipped = lifeCap(input.xp, true);
  const attackUnequipped = basicAttackDamage(input.xp, false);
  const attackEquipped = basicAttackDamage(input.xp, true);
  const lifeFrom = input.equipped ? lifeEquipped : lifeUnequipped;
  const lifeTo = input.equipped ? lifeUnequipped : lifeEquipped;
  const attackFrom = input.equipped ? attackEquipped : attackUnequipped;
  const attackTo = input.equipped ? attackUnequipped : attackEquipped;
  const lifeDelta = lifeTo - lifeFrom;
  const attackDelta = attackTo - attackFrom;
  const maxLife = input.equipped ? lifeEquipped : lifeUnequipped;
  const actionKind: ItemAction =
    item?.id === "badge" ? (input.equipped ? "unequip" : "equip") : "use";
  const verdict = itemVerdict({
    id: input.itemId,
    count: input.count,
    hp: input.hp,
    maxLife,
    focus: input.focus,
    action: actionKind,
  });
  const actionLabel =
    item?.id === "badge"
      ? input.equipped
        ? "卸下徽章"
        : "裝備徽章"
      : item?.category === "consumable"
        ? "使用物品"
        : "沒有主要動作";
  const passive =
    item?.id === "badge"
      ? false
      : item?.category !== "consumable";
  const fact = item ? factOf(item.id) : undefined;
  const reason = passive ? "這件物品沒有使用或裝備動作。" : verdict.reason;
  const allowed = passive ? false : verdict.allowed;
  let effect = "沒有立即效果。";
  if (item?.id === "coffee") {
    if (input.count <= 0) effect = "沒有冰咖啡，生命不會改變。";
    else if (input.hp >= maxLife) effect = "生命已滿，飲用不會消耗冰咖啡。";
    else effect = `飲用後生命 +${Math.min(COFFEE_HEAL, maxLife - input.hp)}，目前 ${input.hp} / ${maxLife}。`;
  } else if (item?.id === "tea") {
    if (input.count <= 0) effect = "沒有烏龍茶，專注不會改變。";
    else if (input.focus >= FOCUS_CAP) effect = "專注已滿，飲用不會消耗烏龍茶。";
    else effect = `飲用後專注 +${Math.min(TEA_FOCUS, FOCUS_CAP - input.focus)}，目前 ${input.focus} / ${FOCUS_CAP}。`;
  } else if (item?.id === "badge") {
    effect = `生命上限 ${lifeFrom} → ${lifeTo}（${signed(lifeDelta)}）。普攻 ${attackFrom} → ${attackTo}（${signed(attackDelta)}）。`;
  } else if (item?.id === "mint") {
    if (input.count <= 0) effect = "沒有薄荷冷茶，專注不會改變。";
    else if (input.focus >= FOCUS_CAP) effect = "專注已滿，飲用不會消耗薄荷冷茶。";
    else effect = `飲用後專注 +${Math.min(MINT_FOCUS, FOCUS_CAP - input.focus)}。`;
  } else if (item?.id === "bandage") {
    if (input.count <= 0) effect = "沒有布繃帶，生命不會改變。";
    else if (input.hp >= maxLife) effect = "生命已滿，使用不會消耗布繃帶。";
    else effect = `使用後生命 +${Math.min(BANDAGE_HEAL, maxLife - input.hp)}。`;
  } else if (item?.id === "lamp-oil") {
    effect = input.count <= 0 ? "沒有燈油。" : "有野外燈且未滿時，耐久 +40。否則不消耗。";
  } else if (item?.category === "equipment" || item?.category === "quest" || item?.category === "recipe") {
    effect = factOf(item.id)?.effect ?? effect;
  } else if (item?.category === "material") {
    effect = "沒有立即的生命或攻擊效果，可作為建造與技能材料。";
  } else if (item?.category === "rare") {
    effect = "沒有立即的生命或攻擊效果，可作為技能強化材料。";
  }
  return {
    itemId: input.itemId,
    purpose: item?.description ?? "沒有用途說明。",
    effect,
    quantity: input.count,
    clue: acquisitionClue(input.itemId),
    action: allowed ? actionLabel : `${actionLabel}：${reason}`,
    allowed,
    reason,
    lifeUnequipped,
    lifeEquipped,
    attackUnequipped,
    attackEquipped,
    lifeFrom,
    lifeTo,
    lifeDelta,
    attackFrom,
    attackTo,
    attackDelta,
    source: fact?.source ?? "沒有來源說明。",
    stack: fact ? `堆疊上限 ${fact.maxStack}` : "沒有堆疊說明。",
    weight: fact ? `重量 ${fact.weight}` : "沒有重量說明。",
  };
}
