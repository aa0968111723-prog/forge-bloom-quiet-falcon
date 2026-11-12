import {
  ZERO_MODIFIERS,
  departmentById,
  skillModifiers,
  type SkillModifiers,
} from "../../departments.ts";
import { catalogIdFor } from "../../contracts/departments.ts";
import { collegeOf, learnCurrentRanks } from "./tree.ts";
import {
  EMPTY_BAG,
  freshGrowthState,
  type GrowthState,
  type MaterialBag,
  type XpSource,
} from "./types.ts";

const XP_SOURCES: readonly XpSource[] = ["explore", "combat", "quest"];

/** Same amount store.discover adds the first time a site is found. */
export const DISCOVER_XP = 12;

const MOD_KEYS = Object.keys(ZERO_MODIFIERS) as (keyof SkillModifiers)[];

const MOD_LABELS: Record<keyof SkillModifiers, string> = {
  inventoryCapacityBonus: "背包加成",
  attackBonus: "攻擊",
  examAttackBonus: "考試攻擊",
  reportAttackBonus: "報告攻擊",
  anomalyAttackBonus: "異象攻擊",
  defenseBonus: "防禦",
  maxHpBonus: "體力",
  buildRangeBonus: "建造距離",
  healOnUse: "使用回血",
};

export function resolveCatalogDepartmentId(saved: string | null | undefined): string | null {
  return catalogIdFor(saved);
}

export function compareDepartments(a: string, b: string) {
  const leftMods = skillModifiers(a);
  const rightMods = skillModifiers(b);
  const delta = { ...ZERO_MODIFIERS };
  for (const key of MOD_KEYS) delta[key] = rightMods[key] - leftMods[key];
  const left = departmentById(a);
  const right = departmentById(b);
  return {
    a: {
      id: a,
      name: left?.name ?? null,
      collegeId: left?.collegeId ?? null,
      modifiers: leftMods,
    },
    b: {
      id: b,
      name: right?.name ?? null,
      collegeId: right?.collegeId ?? null,
      modifiers: rightMods,
    },
    delta,
    lines: MOD_KEYS.map((key) => ({
      key,
      label: MOD_LABELS[key],
      left: leftMods[key],
      right: rightMods[key],
      delta: delta[key],
    })),
    sameCollege: Boolean(left && right && left.collegeId === right.collegeId),
    identical: MOD_KEYS.every((key) => delta[key] === 0),
  };
}

export function previewConfirm(state: GrowthState, departmentId: string): GrowthState {
  if (state.confirmed) return state;
  if (!departmentById(departmentId)) return state;
  if (state.pendingId === departmentId) return state;
  return { ...state, pendingId: departmentId };
}

export function cancelDepartment(state: GrowthState): GrowthState {
  if (state.pendingId === null) return state;
  return { ...state, pendingId: null };
}

export function commitDepartment(state: GrowthState): GrowthState {
  if (state.confirmed) return state;
  if (!state.pendingId || !departmentById(state.pendingId)) return state;
  const departmentId = state.pendingId;
  const next: GrowthState = {
    ...state,
    departmentId,
    catalogDepartmentId: departmentId,
    legacyDepartmentId: state.legacyDepartmentId,
    pendingId: null,
    confirmed: true,
  };
  return learnCurrentRanks(next);
}

function nonNegative(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

function readRank(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  const rank = Math.floor(value);
  if (rank < 1) return 1;
  if (rank > 5) return 5;
  return rank;
}

function readVersion(value: unknown): 1 | 2 {
  return value === 1 ? 1 : 2;
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function investedForRank(rank: number): MaterialBag {
  const steps = Math.max(0, rank - 1);
  const sum = (steps * (steps + 1)) / 2;
  return { notes: sum * 5, credit: sum };
}

function readBag(value: unknown): MaterialBag | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!("notes" in record) && !("credit" in record)) return null;
  return { notes: nonNegative(record.notes), credit: nonNegative(record.credit) };
}

function bagFromSlots(raw: Record<string, unknown>): MaterialBag {
  const explicit = readBag(raw.materials) ?? readBag(raw.bag);
  if (explicit) return explicit;
  const bag = { ...EMPTY_BAG };
  const lists = [raw.slots, raw.inventory];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const slot of list) {
      if (!slot || typeof slot !== "object") continue;
      const record = slot as Record<string, unknown>;
      const id = record.itemId ?? record.id;
      const qty = record.quantity ?? record.count;
      if (id === "notes") bag.notes += nonNegative(qty);
      if (id === "credit") bag.credit += nonNegative(qty);
    }
  }
  return bag;
}

function readInvested(raw: Record<string, unknown>, rank: number): MaterialBag {
  const explicit = readBag(raw.invested) ?? readBag(raw.spentMaterials) ?? readBag(raw.materialsSpent);
  return explicit ?? investedForRank(rank);
}

/** Keep department, rank, and spent materials. Missing fields fall back. Version is not raised. */
export function readV2Progress(raw: unknown): GrowthState {
  const base = freshGrowthState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const record = raw as Record<string, unknown>;
  const savedDepartment =
    typeof record.departmentId === "string" && record.departmentId ? record.departmentId : null;
  const catalogDepartmentId = resolveCatalogDepartmentId(savedDepartment);
  const skillRank = readRank(record.skillRank);
  const discoveries = stringList(record.discoveries);
  const claimedQuests = stringList(record.claimed);
  const lesson = typeof record.lesson === "string" ? record.lesson : null;
  const boss = record.boss === 1 || record.boss === 1.0 ? 1 : nonNegative(record.boss) >= 1 ? 1 : 0;
  const xpEvents = new Set(stringList(record.xpEvents));
  for (const id of discoveries) xpEvents.add(`explore:${id}`);
  for (const id of claimedQuests) xpEvents.add(`quest:${id}`);
  const learned = stringList(record.learned);
  const spentRaw = record.spentPoints;
  const spentPoints =
    typeof spentRaw === "number" && Number.isFinite(spentRaw) && spentRaw >= 0
      ? Math.floor(spentRaw)
      : Math.max(0, skillRank - 1);
  const state: GrowthState = {
    ...base,
    version: readVersion(record.version),
    departmentId: savedDepartment,
    catalogDepartmentId,
    legacyDepartmentId: savedDepartment,
    pendingId: null,
    confirmed: Boolean(savedDepartment),
    initialized: false,
    skillRank,
    xp: nonNegative(record.xp),
    equipped: record.equipped === true,
    spentPoints,
    learned,
    invested: readInvested(record, skillRank),
    materials: bagFromSlots(record),
    xpEvents: [...xpEvents],
    claimedQuests,
    discoveries,
    mainDone: lesson === "done" || boss >= 1 || claimedQuests.includes("semester"),
    lesson,
    boss,
  };
  if (!collegeOf(state)) return state;
  return learnCurrentRanks(state);
}

export function grantXp(state: GrowthState, eventId: string, amount: number, source: XpSource): GrowthState {
  if (!XP_SOURCES.includes(source)) return state;
  if (typeof eventId !== "string" || !eventId.trim()) return state;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return state;
  const id = eventId.trim();
  if (state.xpEvents.includes(id)) return state;
  return {
    ...state,
    xp: state.xp + amount,
    xpEvents: [...state.xpEvents, id],
  };
}

export function replayFastTravel(state: GrowthState, siteId: string): GrowthState {
  if (typeof siteId !== "string" || !siteId.trim()) return state;
  return grantXp(state, `explore:${siteId.trim()}`, DISCOVER_XP, "explore");
}

export function grantCombatXp(state: GrowthState, enemyId: string, amount: number): GrowthState {
  if (typeof enemyId !== "string" || !enemyId.trim()) return state;
  return grantXp(state, `combat:${enemyId.trim()}`, amount, "combat");
}

export type QuestReward = {
  xp?: number;
  notes?: number;
  credit?: number;
};

/**
 * Quest payout for package D.
 * Coffee, badges, and other bag items stay on the existing claim path.
 * The same quest id pays xp and notes/credit only once.
 */
export function grantQuestReward(state: GrowthState, questId: string, reward: QuestReward): GrowthState {
  if (typeof questId !== "string" || !questId.trim()) return state;
  const id = `quest:${questId.trim()}`;
  if (state.xpEvents.includes(id) || state.claimedQuests.includes(questId.trim())) return state;
  const xp = typeof reward.xp === "number" && Number.isFinite(reward.xp) && reward.xp > 0 ? reward.xp : 0;
  const notes = typeof reward.notes === "number" && Number.isFinite(reward.notes) && reward.notes > 0 ? reward.notes : 0;
  const credit =
    typeof reward.credit === "number" && Number.isFinite(reward.credit) && reward.credit > 0 ? reward.credit : 0;
  if (xp === 0 && notes === 0 && credit === 0) return state;
  const withXp = xp > 0 ? grantXp(state, id, xp, "quest") : { ...state, xpEvents: [...state.xpEvents, id] };
  if (withXp === state && xp > 0) return state;
  return {
    ...withXp,
    claimedQuests: withXp.claimedQuests.includes(questId.trim())
      ? withXp.claimedQuests
      : [...withXp.claimedQuests, questId.trim()],
    materials: {
      notes: withXp.materials.notes + notes,
      credit: withXp.materials.credit + credit,
    },
  };
}
