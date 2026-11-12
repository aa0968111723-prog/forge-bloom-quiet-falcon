import { create } from "zustand";
import { createInventory } from "@overworld-engine/inventory";
import { Vector3, Vehicle, SeekBehavior } from "yuka";
import { useGame } from "../store";
import {
  calmWindups,
  registerPlaySettle,
  safeSlopeStand,
  settlePlay,
} from "../activity";
import { LANDMARKS, SPAWN, WORLD_BOUNDS, terrainHeight } from "../world";
import {
  DEPARTMENTS,
  DISCIPLINES,
  ENCOUNTERS,
  ENEMY_TYPES,
  ITEMS,
  MISSIONS,
  RECIPES,
  type BuildKind,
  type EnemyKind,
} from "./data.ts";
import {
  approachStand,
  basicAttackDamage,
  canPay,
  FACILITY_CAP,
  levelForXp,
  lifeCap,
  clearSight,
  resolveBuildings,
  validatePlacement,
  withinAttack,
  BASIC_ATTACK_RANGE,
  findWalkablePath,
  type Building,
} from "./rules.ts";
import { BUILD_NEED_MATERIALS, BUILD_NEED_OUTDOORS } from "./buildcard.ts";
import {
  BAG_CAPACITY,
  judgePlacement,
  promptDecision,
  type PromptChoice,
  type PromptKind,
  type PromptSnap,
} from "./prompts.ts";
import { CAMPUS_SITES, SUPPLY_NODES, siteEntrance } from "./campus.ts";
import {
  acknowledgeAt,
  approachPlace,
  chooseAt,
  leaveAt,
  liveGrowth,
  readNarrativeSession,
  rewardDelta,
  talkAt,
} from "./narrative-bridge.ts";
import type { NarrativeSession, PlayUi } from "../../features/narrative/types.ts";
import { COFFEE_HEAL, FOCUS_CAP, itemVerdict, TEA_FOCUS } from "./itemdetail.ts";
import { loadLocal, saveLocal } from "../save";
import { coerceTimeOfDay } from "../world-data/lighting";
import { departmentById } from "../departments";
import { rpgIdFor } from "../contracts/departments.ts";
import { errandReward, stampSemester } from "../contracts/semester.ts";

export const RPG_SAVE_KEY = "tamkang-rpg-v2";
export type LessonMark =
  | "department"
  | "move"
  | "supply"
  | "attack"
  | "skill"
  | "done";
const LESSON_STEPS = [
  "department",
  "move",
  "supply",
  "attack",
  "skill",
] as const;
export const inventory = createInventory({ items: ITEMS, capacity: BAG_CAPACITY });
type Enemy = {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  hp: number;
  state: "idle" | "chase" | "windup" | "recover" | "dead";
  timer: number;
  hurt: number;
  anchorX: number;
  anchorZ: number;
};
export type RpgPanel =
  | "department"
  | "inventory"
  | "skills"
  | "build"
  | "journal"
  | "map"
  | "narrative"
  | "variety"
  | null;
export type Loot = {
  id: string;
  x: number;
  z: number;
  items: Record<string, number>;
};
export type AttackFx = {
  x: number;
  z: number;
  yaw: number;
  at: number;
  skill: boolean;
  color: string;
  range: number;
  /** Enemy ids whose health fell on this swing. Empty when the swing missed. */
  hits: string[];
};
type RpgState = {
  departmentId: string | null;
  xp: number;
  hp: number;
  focus: number;
  equipped: boolean;
  skillRank: number;
  kills: number;
  built: number;
  boss: number;
  discoveries: string[];
  claimed: string[];
  /** Narrative event memory. Rewards still land in xp, claimed, and the bag. */
  narrative: NarrativeSession;
  /** Dialogue shown while panel is "narrative". Not written by itself. */
  narrativeUi: PlayUi | null;
  buildings: Building[];
  harvested: Record<string, number>;
  loot: Loot[];
  panel: RpgPanel;
  buildKind: BuildKind | null;
  rotation: number;
  saved: "saved" | "pending" | "error";
  saveConflict: boolean;
  /** File text waiting for the replace confirmation. Not part of the save. */
  incomingSave: string | null;
  /** Title start cleared a hydrated major. Hold the file until a new major is chosen. */
  freshStart: boolean;
  /** First-play step. Missing on an old semester means the lesson is not forced. */
  lesson: LessonMark;
  lessonAnchor: { x: number; z: number } | null;
  /** Control reminder. Separate from the required sequence and not saved. */
  lessonReview: boolean;
  notice: string;
  noticeAt: number;
  clock: number;
  attackUntil: number;
  skillUntil: number;
  dodgeUntil: number;
  invulnerableUntil: number;
  attackFx: AttackFx | null;
  hurtUntil: number;
  anomaly: "quiet" | "deadline" | "blackout";
  enemies: Enemy[];
  interiorId: string | null;
  floor: number;
  checkpoint: { x: number; z: number; yaw: number } | null;
  continueGame: () => void;
  notify: (message: string) => void;
  setPanel: (panel: RpgPanel) => void;
  chooseDepartment: (id: string) => void;
  useItem: (id: string) => void;
  equip: () => void;
  upgrade: () => void;
  attack: (skill?: boolean) => void;
  dodge: () => boolean;
  place: (x: number, z: number) => boolean;
  chooseBuild: (kind: BuildKind) => void;
  cancelBuild: () => void;
  rotate: () => void;
  demolish: (id: string) => void;
  interact: () => boolean;
  commitPrompt: () => PromptKind | null;
  discover: (id: string) => void;
  claim: (id: string) => void;
  /** Open a campus narrative event at this site. False means the caller should enter. */
  openNarrative: (placeId: string) => boolean;
  narrativeTalk: () => void;
  narrativeChoose: (choiceId: string) => void;
  narrativeDismiss: () => void;
  narrativeEnter: () => void;
  respawn: () => void;
  exportSave: () => void;
  importSave: (text: string) => boolean;
  keepProgress: () => void;
  reloadProgress: () => void;
  enter: (id: string) => void;
  exit: () => void;
  changeFloor: (direction: number) => void;
  travel: (id: string) => void;
};
const finite = (v: unknown, fallback = 0, max = 1_000_000) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(0, v))
    : fallback;
function knownDepartment(id: unknown) {
  return rpgIdFor(typeof id === "string" ? id : null);
}
export function readLesson(value: unknown, departmentId: string | null): LessonMark {
  if (
    value === "department" ||
    value === "move" ||
    value === "supply" ||
    value === "attack" ||
    value === "skill" ||
    value === "done"
  )
    return value;
  return departmentId ? "done" : "department";
}
function readAnchor(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const point = value as Record<string, unknown>;
  if (
    typeof point.x !== "number" ||
    typeof point.z !== "number" ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.z)
  )
    return null;
  return { x: point.x, z: point.z };
}
function narrativeField(text: string): unknown {
  try {
    const raw = JSON.parse(text) as { narrative?: unknown };
    return raw && typeof raw === "object" ? raw.narrative : undefined;
  } catch {
    return undefined;
  }
}
export function decodeSave(text: string): Record<string, unknown> {
  const raw = JSON.parse(text);
  if (
    !raw ||
    typeof raw !== "object" ||
    raw.version !== 2 ||
    !Array.isArray(raw.slots) ||
    typeof raw.hp !== "number" ||
    !Number.isFinite(raw.hp) ||
    !Array.isArray(raw.buildings)
  )
    throw new Error("無法辨識此存檔版本");
  return raw;
}
function loadSave() {
  try {
    const current = localStorage.getItem(RPG_SAVE_KEY);
    if (current) return decodeSave(current);
  } catch {
    /* Preserve a corrupt source for manual recovery. */
  }
  const legacy = loadLocal();
  if (!legacy.departmentId && !legacy.inventory.length) return {};
  const names: Record<string, string> = {
    數學系: "應用數學與數據科學學系",
    化學系: "化學學系",
  };
  const oldName = departmentById(legacy.departmentId)?.name;
  const departmentId =
    DEPARTMENTS.find(
      (d) => d.name === (oldName ? (names[oldName] ?? oldName) : ""),
    )?.id ?? null;
  const itemMap: Record<string, string> = {
    notes: "notes",
    pen: "notes",
    coffee: "coffee",
    brick: "parts",
    lantern: "parts",
    "stamp-ink": "notes",
    "first-aid": "coffee",
  };
  return {
    departmentId,
    hp: 100,
    focus: 100,
    slots: legacy.inventory.map((i) => ({
      itemId: itemMap[i.id],
      quantity: i.count,
    })),
    buildings: legacy.buildings.map((b) => ({
      id: b.id,
      kind:
        b.kind === "lamp-post"
          ? "lantern"
          : b.kind === "banner"
            ? "barrier"
            : "desk",
      x: b.x,
      z: b.z,
      rotation: 0,
      hp: 120,
    })),
  };
}
const saved = loadSave();
function keepClaim(id: string) {
  return MISSIONS.some((mission) => mission.id === id) || /^quest-[a-z0-9-]+$/.test(id);
}
function growthNow() {
  const s = useRpg.getState();
  return liveGrowth({
    departmentId: s.departmentId,
    xp: s.xp,
    claimed: s.claimed,
    discoveries: s.discoveries,
    slots: inventory.slots(),
    skillRank: s.skillRank,
    equipped: s.equipped,
    boss: s.boss,
    lesson: s.lesson,
  });
}
function restoreInventory(raw: unknown) {
  inventory.clear();
  if (Array.isArray(raw)) {
    for (const slot of raw.slice(0, 24))
      if (slot && ITEMS.some((i) => i.id === slot.itemId))
        inventory.add(slot.itemId, Math.floor(finite(slot.quantity, 0, 99)));
  } else {
    inventory.add("notes", 18);
    inventory.add("parts", 20);
    inventory.add("coffee", 4);
    inventory.add("tea", 3);
  }
}
restoreInventory(saved.slots);
function restoreBuildings(raw: unknown): Building[] {
  const result: Building[] = [];
  if (Array.isArray(raw))
    for (const b of raw.slice(0, FACILITY_CAP)) {
      if (
        !b ||
        typeof b.id !== "string" ||
        result.some((p) => p.id === b.id) ||
        !RECIPES.some((r) => r.id === b.kind)
      )
        continue;
      const rotation =
        (Math.round(finite(b.rotation, 0, Math.PI * 2) / (Math.PI / 2)) *
          Math.PI) /
        2;
      if (validatePlacement(b.kind, b.x, b.z, rotation, result, undefined, false))
        continue;
      result.push({
        id: b.id.slice(0, 80),
        kind: b.kind,
        x: b.x,
        z: b.z,
        rotation,
        hp: Math.max(
          1,
          finite(b.hp, 100, RECIPES.find((r) => r.id === b.kind)!.health),
        ),
      });
    }
  return result;
}
function strings(raw: unknown) {
  return Array.isArray(raw)
    ? [
        ...new Set(
          raw.filter(
            (s): s is string => typeof s === "string" && s.length < 100,
          ),
        ),
      ].slice(0, 100)
    : [];
}
function restoreHarvest(raw: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (raw && typeof raw === "object")
    for (const node of SUPPLY_NODES) {
      const t = (raw as Record<string, unknown>)[node.id];
      if (
        typeof t === "number" &&
        Number.isFinite(t) &&
        t > Date.now() &&
        t < Date.now() + 180_001
      )
        result[node.id] = t;
    }
  return result;
}
function restoreLoot(raw: unknown): Loot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 100)
    .filter(
      (l) =>
        l &&
        typeof l.id === "string" &&
        Number.isFinite(l.x) &&
        Number.isFinite(l.z) &&
        l.items &&
        typeof l.items === "object",
    )
    .map((l) => ({
      id: l.id,
      x: l.x,
      z: l.z,
      items: Object.fromEntries(
        ITEMS.map((i) => [
          i.id,
          Math.floor(finite(l.items[i.id], 0, 99)),
        ]).filter(([, n]) => Number(n) > 0),
      ),
    }));
}
function restorePosition(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (
    typeof p.x !== "number" ||
    typeof p.z !== "number" ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    p.x < WORLD_BOUNDS.minX + 8 ||
    p.x > WORLD_BOUNDS.maxX - 8 ||
    p.z < WORLD_BOUNDS.minZ + 8 ||
    p.z > WORLD_BOUNDS.maxZ - 8
  )
    return null;
  return {
    x: p.x,
    z: p.z,
    yaw: typeof p.yaw === "number" && Number.isFinite(p.yaw) ? p.yaw : 0,
  };
}
const BODY_RADIUS = 0.42;
function standAt(
  x: number,
  z: number,
  yaw: number,
  buildings: Building[],
) {
  const p = resolveBuildings(x, z, BODY_RADIUS, buildings);
  return { x: p.x, z: p.z, yaw };
}
function importedStand(raw: unknown, buildings: Building[]) {
  const restored = restorePosition(raw);
  if (restored) return standAt(restored.x, restored.z, restored.yaw, buildings);
  return standAt(SPAWN.x, SPAWN.z, 0, buildings);
}
function placeStand(stand: { x: number; z: number; yaw: number }) {
  useGame.setState({
    playerX: stand.x,
    playerZ: stand.z,
    playerYaw: stand.yaw,
    warp: stand,
    snapCam: true,
  });
}
const SAVE_TEXT_LIMIT = 1_000_000;
const SLOT_LIMIT = 24;
const BUILDING_LIMIT = FACILITY_CAP;
const LEGACY_ITEMS: Record<string, string> = {
  notes: "notes",
  pen: "notes",
  coffee: "coffee",
  brick: "parts",
  lantern: "parts",
  "stamp-ink": "notes",
  "first-aid": "coffee",
};
type ImportReason =
  | "json"
  | "version"
  | "negative"
  | "oversize"
  | "slots"
  | "buildings";
const IMPORT_NOTICES: Record<ImportReason, string> = {
  json: "匯入失敗：存檔不是有效的 JSON。",
  version: "匯入失敗：無法辨識此存檔版本。",
  negative: "匯入失敗：數值或物品數量為負。",
  oversize: "匯入失敗：存檔超過大小上限。",
  slots: "匯入失敗：物品槽超過背包容量。",
  buildings: "匯入失敗：建築數量超過上限。",
};
const STORAGE_NOTICE = "匯入失敗：無法寫入儲存空間。";
type SaveSlot = { itemId: string; quantity: number };
type PreparedSave = {
  departmentId: string | null;
  xp: number;
  hp: number;
  focus: number;
  equipped: boolean;
  skillRank: number;
  kills: number;
  built: number;
  boss: number;
  discoveries: string[];
  claimed: string[];
  buildings: Building[];
  slots: SaveSlot[];
  harvested: Record<string, number>;
  loot: Loot[];
  clock: number;
  stand: { x: number; z: number; yaw: number };
  lesson: LessonMark;
  lessonAnchor: { x: number; z: number } | null;
  pilgrimage: {
    visited: string[];
    timeOfDay: ReturnType<typeof coerceTimeOfDay>;
    muted: boolean | null;
  } | null;
};
function negativeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value < 0;
}
function legacyDepartment(id: unknown) {
  return knownDepartment(id);
}
function readSlots(
  raw: unknown,
  idKey: "itemId" | "id",
  countKey: "quantity" | "count",
): { ok: true; slots: SaveSlot[] } | { ok: false; reason: ImportReason } {
  if (!Array.isArray(raw)) return { ok: false, reason: "version" };
  if (raw.length > SLOT_LIMIT) return { ok: false, reason: "slots" };
  const slots: SaveSlot[] = [];
  for (const slot of raw) {
    if (!slot || typeof slot !== "object") continue;
    const record = slot as Record<string, unknown>;
    const quantity = record[countKey];
    if (negativeNumber(quantity)) return { ok: false, reason: "negative" };
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0)
      continue;
    const mapped = LEGACY_ITEMS[String(record[idKey] ?? "")];
    const itemId =
      mapped ??
      (ITEMS.some((item) => item.id === record[idKey])
        ? (record[idKey] as string)
        : null);
    if (!itemId) continue;
    const max = ITEMS.find((item) => item.id === itemId)?.maxStack ?? 99;
    slots.push({ itemId, quantity: Math.min(max, Math.floor(quantity)) });
  }
  return { ok: true, slots };
}
function readBuildings(
  raw: unknown,
  legacy: boolean,
): { ok: true; buildings: Building[] } | { ok: false; reason: ImportReason } {
  if (!Array.isArray(raw)) return { ok: false, reason: "version" };
  if (raw.length > BUILDING_LIMIT) return { ok: false, reason: "buildings" };
  const mapped = raw.map((building) => {
    if (!building || typeof building !== "object") return building;
    const record = building as Record<string, unknown>;
    if (!legacy) return building;
    const kind =
      record.kind === "lamp-post"
        ? "lantern"
        : record.kind === "banner"
          ? "barrier"
          : "desk";
    return { ...record, kind, rotation: 0, hp: record.hp ?? 120 };
  });
  for (const building of mapped) {
    if (!building || typeof building !== "object") continue;
    if (negativeNumber((building as Record<string, unknown>).hp))
      return { ok: false, reason: "negative" };
  }
  return { ok: true, buildings: restoreBuildings(mapped) };
}
function optionalNumber(value: unknown, fallback: number, max = 1_000_000) {
  if (value === undefined) return { ok: true as const, value: fallback };
  if (negativeNumber(value)) return { ok: false as const, reason: "negative" as const };
  return { ok: true as const, value: finite(value, fallback, max) };
}
function prepareImport(
  text: string,
): { ok: true; save: PreparedSave } | { ok: false; reason: ImportReason } {
  if (text.length > SAVE_TEXT_LIMIT) return { ok: false, reason: "oversize" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false, reason: "version" };
  const record = raw as Record<string, unknown>;
  const legacy = record.version === 1;
  if (record.version !== 2 && !legacy) return { ok: false, reason: "version" };
  if (
    negativeNumber(record.hp) ||
    negativeNumber(record.xp) ||
    negativeNumber(record.focus) ||
    negativeNumber(record.skillRank) ||
    negativeNumber(record.kills) ||
    negativeNumber(record.built) ||
    negativeNumber(record.boss) ||
    negativeNumber(record.clock)
  )
    return { ok: false, reason: "negative" };
  if (!legacy && (typeof record.hp !== "number" || !Number.isFinite(record.hp)))
    return { ok: false, reason: "version" };
  const slots = readSlots(
    legacy ? (record.inventory ?? []) : record.slots,
    legacy ? "id" : "itemId",
    legacy ? "count" : "quantity",
  );
  if (!slots.ok) return slots;
  const buildings = readBuildings(legacy ? record.buildings ?? [] : record.buildings, legacy);
  if (!buildings.ok) return buildings;
  if (record.loot && lootNegative(record.loot))
    return { ok: false, reason: "negative" };
  const xp = optionalNumber(record.xp, 0);
  const focus = optionalNumber(record.focus, legacy ? 100 : 100, 100);
  const skillRank = optionalNumber(record.skillRank, 1, 5);
  const kills = optionalNumber(record.kills, 0);
  const built = optionalNumber(record.built, 0);
  const boss = optionalNumber(record.boss, 0, 1);
  const clock = optionalNumber(record.clock, 0);
  if (!xp.ok) return xp;
  if (!focus.ok) return focus;
  if (!skillRank.ok) return skillRank;
  if (!kills.ok) return kills;
  if (!built.ok) return built;
  if (!boss.ok) return boss;
  if (!clock.ok) return clock;
  const equipped =
    record.equipped === true && slots.slots.some((slot) => slot.itemId === "badge");
  const hp = optionalNumber(
    legacy ? (record.hp ?? 100) : record.hp,
    100,
    maxHp({ xp: xp.value, equipped }),
  );
  if (!hp.ok) return hp;
  const pilgrimageRaw = legacy
    ? record
    : record.pilgrimage && typeof record.pilgrimage === "object"
      ? (record.pilgrimage as Record<string, unknown>)
      : null;
  const pilgrimage = pilgrimageRaw
    ? {
        visited: strings(pilgrimageRaw.visited).filter((id) =>
          LANDMARKS.some((landmark) => landmark.id === id),
        ),
        timeOfDay: coerceTimeOfDay(pilgrimageRaw.timeOfDay),
        muted: typeof pilgrimageRaw.muted === "boolean" ? pilgrimageRaw.muted : null,
      }
    : null;
  const departmentId = legacyDepartment(record.departmentId);
  const lesson = readLesson(record.lesson, departmentId);
  const stand = importedStand(record.position, buildings.buildings);
  return {
    ok: true,
    save: {
      departmentId,
      xp: xp.value,
      hp: hp.value,
      focus: focus.value,
      equipped,
      skillRank: Math.max(1, Math.floor(skillRank.value)),
      kills: Math.floor(kills.value),
      built: Math.floor(built.value),
      boss: Math.floor(boss.value),
      discoveries: strings(record.discoveries).filter((id) =>
        CAMPUS_SITES.some((site) => site.id === id),
      ),
      claimed: strings(record.claimed).filter(keepClaim),
      buildings: buildings.buildings,
      slots: slots.slots,
      harvested: restoreHarvest(record.harvested),
      loot: restoreLoot(record.loot),
      clock: clock.value,
      stand,
      lesson,
      lessonAnchor:
        lesson === "move"
          ? readAnchor(record.lessonAnchor) ?? { x: stand.x, z: stand.z }
          : null,
      pilgrimage: pilgrimage
        ? {
            visited: pilgrimage.visited,
            timeOfDay: pilgrimage.timeOfDay,
            muted: pilgrimage.muted,
          }
        : null,
    },
  };
}
function lootNegative(raw: unknown) {
  if (!Array.isArray(raw)) return false;
  return raw.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const items = (entry as { items?: unknown }).items;
    if (!items || typeof items !== "object") return false;
    return Object.values(items as Record<string, unknown>).some(negativeNumber);
  });
}
function freshEnemies(boss = 0): Enemy[] {
  return ENCOUNTERS.map((s) => ({
    ...s,
    hp: s.kind === "final" && boss ? 0 : ENEMY_TYPES[s.kind].hp,
    state: s.kind === "final" && boss ? "dead" : "idle",
    timer: 0,
    hurt: 0,
    anchorX: s.x,
    anchorZ: s.z,
  }));
}
const maxHp = (s: Pick<RpgState, "xp" | "equipped">) => lifeCap(s.xp, s.equipped);
export { maxHp };
let previousPhase: "title" | "setup" | "playing" | "paused" | "codex" =
  "playing";
const LOOT_PILES = 100;
const LOOT_STACK = 99;

function grantList(items: Record<string, number>) {
  return ITEMS.flatMap((item) =>
    items[item.id] > 0 ? [`${item.name} ×${items[item.id]}`] : [],
  ).join("、");
}

/** One notice. An empty bag or ground group is omitted, not described as received. */
function intakeNotice(
  accepted: Record<string, number>,
  left: Record<string, number>,
  lead = "",
) {
  const lines: string[] = [];
  if (lead) lines.push(lead);
  const bagged = grantList(accepted);
  const ground = grantList(left);
  if (bagged) lines.push(`已入袋：${bagged}`);
  if (ground) lines.push(`留在地面：${ground}`);
  return lines.join("。");
}

function stash(loot: Loot[], x: number, z: number, items: Record<string, number>) {
  const next = loot.map((pile) => ({ ...pile, items: { ...pile.items } }));
  for (const [id, raw] of Object.entries(items)) {
    let remaining = Math.floor(raw);
    if (!Number.isFinite(remaining) || remaining <= 0) continue;
    if (!ITEMS.some((item) => item.id === id)) continue;
    while (remaining > 0) {
      let pile = next.find(
        (entry) =>
          Math.abs(entry.x - x) <= 0.05 &&
          Math.abs(entry.z - z) <= 0.05 &&
          (entry.items[id] ?? 0) < LOOT_STACK,
      );
      if (!pile) {
        if (next.length >= LOOT_PILES) break;
        pile = { id: crypto.randomUUID(), x, z, items: {} };
        next.push(pile);
      }
      const room = LOOT_STACK - (pile.items[id] ?? 0);
      const take = Math.min(room, remaining);
      pile.items[id] = (pile.items[id] ?? 0) + take;
      remaining -= take;
    }
  }
  return next;
}

function layRemainder(
  loot: Loot[],
  x: number,
  z: number,
  left: Record<string, number>,
) {
  return Object.keys(left).length ? stash(loot, x, z, left) : loot;
}
function mergeCounts(base: Record<string, number>, extra: Record<string, number>) {
  const out = { ...base };
  for (const [id, amount] of Object.entries(extra)) {
    if (amount > 0) out[id] = (out[id] ?? 0) + amount;
  }
  return out;
}
function errandState(s: RpgState, at: { x: number; z: number }, left: Record<string, number>) {
  const offer = errandReward(s.claimed);
  if (!offer) return null;
  const bonus = give({ notes: offer.notes });
  const claimed = [...s.claimed, offer.id];
  const spilled = mergeCounts(left, bonus.left);
  return {
    claimed,
    ...xpPatch(s, offer.xp),
    narrative: stampSemester(s.narrative, claimed),
    loot: layRemainder(s.loot, at.x, at.z, spilled),
    accepted: bonus.accepted,
    left: spilled,
  };
}

function give(items: { [id: string]: number | undefined }) {
  const accepted: Record<string, number> = {};
  const left: Record<string, number> = {};
  for (const [id, amount] of Object.entries(items)) {
    if (typeof amount !== "number") continue;
    const n = Math.floor(amount);
    if (!Number.isFinite(n) || n <= 0) continue;
    const result = inventory.add(id, n);
    if (result.added > 0) accepted[id] = result.added;
    if (result.overflow > 0) left[id] = result.overflow;
  }
  return { accepted, left };
}
function xpPatch(s: RpgState, amount: number) {
  const xp = s.xp + amount;
  return {
    xp,
    ...(levelForXp(xp) > levelForXp(s.xp)
      ? { hp: maxHp({ ...s, xp }), focus: 100 }
      : {}),
  };
}
export const useRpg = create<RpgState>((set, get) => ({
  departmentId: legacyDepartment(saved.departmentId),
  xp: finite(saved.xp),
  hp: finite(saved.hp, 100, 400),
  focus: finite(saved.focus, 100, 100),
  equipped: saved.equipped === true && inventory.has("badge"),
  skillRank: Math.max(1, Math.floor(finite(saved.skillRank, 1, 5))),
  kills: Math.floor(finite(saved.kills)),
  built: Math.floor(finite(saved.built)),
  boss: Math.floor(finite(saved.boss, 0, 1)),
  discoveries: strings(saved.discoveries),
  claimed: strings(saved.claimed).filter(keepClaim),
  narrative: stampSemester(
    readNarrativeSession(
      saved && typeof saved === "object" && "narrative" in saved ? saved.narrative : undefined,
    ),
    strings(saved.claimed).filter(keepClaim),
  ),
  narrativeUi: null,
  buildings: restoreBuildings(saved.buildings),
  harvested: restoreHarvest(saved.harvested),
  loot: restoreLoot(saved.loot),
  panel: null,
  buildKind: null,
  rotation: 0,
  saved: "saved",
  saveConflict: false,
  incomingSave: null,
  freshStart: false,
  lesson: readLesson(saved.lesson, knownDepartment(saved.departmentId)),
  lessonAnchor:
    readLesson(saved.lesson, knownDepartment(saved.departmentId)) === "move"
      ? readAnchor(saved.lessonAnchor)
      : null,
  lessonReview: false,
  notice: "",
  noticeAt: 0,
  clock: finite(saved.clock),
  attackUntil: 0,
  skillUntil: 0,
  dodgeUntil: 0,
  invulnerableUntil: 0,
  attackFx: null,
  hurtUntil: 0,
  anomaly: "quiet",
  enemies: freshEnemies(finite(saved.boss, 0, 1)),
  interiorId: null,
  floor: 1,
  checkpoint: restorePosition(saved.position),
  continueGame: () => {
    const s = get();
    if (!s.departmentId) {
      s.setPanel("department");
      return;
    }
    let resume: { id: string; floor: number } | null = null;
    try {
      const text = localStorage.getItem(RPG_SAVE_KEY);
      if (text) resume = resumeInterior(decodeSave(text));
    } catch {
      resume = null;
    }
    const stand = s.checkpoint
      ? standAt(s.checkpoint.x, s.checkpoint.z, s.checkpoint.yaw, s.buildings)
      : null;
    settlePlay("relocate");
    if (resume) {
      set({ interiorId: resume.id, floor: resume.floor, buildKind: null });
      useGame.setState({
        phase: "playing",
        snapCam: true,
        plaqueId: null,
        hud: "none",
        warp: { x: 0, z: 4, yaw: 0 },
        playerX: 0,
        playerZ: 4,
        playerYaw: 0,
      });
      return;
    }
    useGame.setState({
      phase: "playing",
      snapCam: true,
      plaqueId: null,
      hud: "none",
      ...(stand
        ? {
            warp: stand,
            playerX: stand.x,
            playerZ: stand.z,
            playerYaw: stand.yaw,
          }
        : { warp: null }),
    });
  },
  notify: (notice) => set({ notice, noticeAt: performance.now() }),
  setPanel: (panel) => {
    if (panel) useGame.setState({ settingsOpen: false });
    if (panel && !get().panel) {
      previousPhase = useGame.getState().phase;
      if (document.pointerLockElement) document.exitPointerLock();
      if (previousPhase === "playing") useGame.getState().pause();
      else settlePlay("suspend");
    }
    if (!panel && get().panel && previousPhase === "playing")
      useGame.getState().resume();
    set({ panel, ...(panel ? { buildKind: null } : {}) });
  },
  chooseDepartment: (id) => {
    if (!DEPARTMENTS.some((d) => d.id === id)) return;
    if (get().departmentId) {
      get().notify("本學期已選定主修，可在技能頁查看能力。");
      return;
    }
    set({ departmentId: id, panel: null, freshStart: false });
    useGame.setState({ phase: "playing", snapCam: true });
    get().notify(
      "學期開始。J 普攻、Q 科系技能、空白鍵閃避；先到宮燈大道探索。",
    );
    noteLesson("department");
  },
  useItem: (id) => {
    const s = get();
    if (s.hp <= 0 || (id !== "coffee" && id !== "tea")) return;
    const verdict = itemVerdict({
      id,
      count: inventory.count(id),
      hp: s.hp,
      maxLife: maxHp(s),
      focus: s.focus,
      action: "use",
    });
    if (!verdict.allowed) {
      if (verdict.reason) s.notify(verdict.reason);
      return;
    }
    if (!inventory.remove(id, 1)) {
      s.notify(verdict.reason || "背包裡沒有這個物品。");
      return;
    }
    set(
      id === "coffee"
        ? { hp: Math.min(maxHp(s), s.hp + COFFEE_HEAL) }
        : { focus: Math.min(FOCUS_CAP, s.focus + TEA_FOCUS) },
    );
    s.notify(
      id === "coffee"
        ? `飲用咖啡，生命 +${COFFEE_HEAL}`
        : `飲用烏龍茶，專注 +${TEA_FOCUS}`,
    );
  },
  equip: () => {
    const s = get();
    const verdict = itemVerdict({
      id: "badge",
      count: inventory.count("badge"),
      hp: s.hp,
      maxLife: maxHp(s),
      focus: s.focus,
      action: s.equipped ? "unequip" : "equip",
    });
    if (!verdict.allowed) {
      if (verdict.reason) s.notify(verdict.reason);
      return;
    }
    const equipped = !s.equipped;
    set({ equipped, hp: Math.min(s.hp, maxHp({ ...s, equipped })) });
  },
  upgrade: () => {
    const s = get(),
      cost = { notes: 5 * s.skillRank, credit: s.skillRank };
    if (!s.departmentId || s.skillRank >= 5) return;
    if (levelForXp(s.xp) < s.skillRank + 1) {
      s.notify("提升角色等級後可繼續升級技能。");
      return;
    }
    if (!canPay(cost, inventory.count)) {
      s.notify("升級材料不足。");
      return;
    }
    Object.entries(cost).forEach(([id, n]) => inventory.remove(id, n));
    set({ skillRank: s.skillRank + 1 });
    s.notify("科系技能已強化！");
  },
  attack: (skill = false) => {
    const s = get(),
      g = useGame.getState();
    if (
      g.phase !== "playing" ||
      g.plaqueId ||
      s.panel ||
      s.hp <= 0 ||
      !s.departmentId ||
      s.buildKind ||
      s.interiorId
    )
      return;
    const department = DEPARTMENTS.find((d) => d.id === s.departmentId)!;
    const discipline = DISCIPLINES[department.discipline];
    if (s.clock < (skill ? s.skillUntil : s.attackUntil)) return;
    if (skill && s.focus < 22) {
      s.notify("專注不足，飲用烏龍茶或稍候恢復。");
      return;
    }
    const range = skill ? discipline.range : BASIC_ATTACK_RANGE;
    const damage = skill
      ? discipline.damage + (s.skillRank - 1) * 12
      : basicAttackDamage(s.xp, s.equipped);
    set({
      attackUntil: s.clock + 0.46,
      ...(skill
        ? {
            skillUntil: s.clock + discipline.cooldown,
            focus: Math.max(0, s.focus - 22),
          }
        : {}),
      attackFx: {
        x: g.playerX,
        z: g.playerZ,
        yaw: g.playerYaw,
        skill,
        color: discipline.color,
        range,
        at: s.clock,
        hits: [],
      },
    });
    const px = g.playerX,
      pz = g.playerZ;
    const legal = s.enemies.filter(
      (enemy) =>
        enemy.hp > 0 &&
        withinAttack(px, pz, g.playerYaw, enemy.x, enemy.z, range, skill) &&
        lineOfSight(px, pz, enemy.x, enemy.z),
    );
    const targets = skill
      ? legal
      : legal
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz),
          )
          .slice(0, 1);
    const hitIds: string[] = [];
    for (const enemy of targets) {
      const before = enemy.hp;
      hitEnemy(enemy, damage);
      if (enemy.hp < before) hitIds.push(enemy.id);
      if (skill && department.discipline === "engineering" && enemy.hp > 0) {
        const distance = Math.max(
          0.1,
          Math.hypot(enemy.x - px, enemy.z - pz),
        );
        const next = resolveBuildings(
          enemy.x + ((enemy.x - px) / distance) * 2,
          enemy.z + ((enemy.z - pz) / distance) * 2,
          ENEMY_TYPES[enemy.kind].radius,
          s.buildings,
        );
        enemy.x = next.x;
        enemy.z = next.z;
      }
    }
    const fx = get().attackFx;
    if (fx) set({ attackFx: { ...fx, hits: hitIds } });
    if (
      skill &&
      ["humanities", "international"].includes(department.discipline)
    )
      set({ focus: Math.min(100, get().focus + 12) });
    if (skill && ["business", "education"].includes(department.discipline))
      set({ hp: Math.min(maxHp(get()), get().hp + 20) });
    if (skill && department.discipline === "education")
      set({ focus: Math.min(100, get().focus + 10) });
    if (skill && department.discipline === "health")
      set({ hp: Math.min(maxHp(get()), get().hp + 40) });
    if (skill)
      s.notify(
        `${discipline.skill}${hitIds.length ? ` · 命中 ${hitIds.length} 個目標` : ""}`,
      );
    noteLesson(skill ? "skill" : "attack");
  },
  dodge: () => {
    const s = get();
    if (
      useGame.getState().phase !== "playing" ||
      s.hp <= 0 ||
      s.focus < 18 ||
      s.clock < s.dodgeUntil ||
      s.buildKind ||
      s.panel
    )
      return false;
    set({
      focus: s.focus - 18,
      dodgeUntil: s.clock + 1.25,
      invulnerableUntil: s.clock + 0.45,
    });
    return true;
  },
  chooseBuild: (buildKind) => {
    if (!get().departmentId || get().interiorId) {
      get().notify(BUILD_NEED_OUTDOORS);
      return;
    }
    get().setPanel(null);
    set({ buildKind, rotation: 0 });
  },
  cancelBuild: () => set({ buildKind: null }),
  rotate: () =>
    set({ rotation: (get().rotation + Math.PI / 2) % (Math.PI * 2) }),
  place: (x, z) => {
    const s = get(),
      g = useGame.getState();
    if (!s.buildKind || g.phase !== "playing" || s.hp <= 0) return false;
    const judge = judgePlacement(
      s.buildKind,
      x,
      z,
      s.rotation,
      s.buildings,
      { x: g.playerX, z: g.playerZ },
      inventory.count,
    );
    if (judge.reason === BUILD_NEED_MATERIALS) {
      s.notify(BUILD_NEED_MATERIALS);
      return false;
    }
    if (judge.reason) {
      s.notify(judge.reason);
      return false;
    }
    const recipe = RECIPES.find((r) => r.id === s.buildKind)!;
    Object.entries(judge.cost).forEach(([id, n]) => inventory.remove(id, n));
    set({
      buildings: [
        ...s.buildings,
        {
          id: crypto.randomUUID(),
          kind: s.buildKind,
          x,
          z,
          rotation: s.rotation,
          hp: recipe.health,
        },
      ],
      built: s.built + 1,
    });
    const settled = errandState(get(), { x, z }, {});
    if (settled) {
      const { accepted, left, ...patch } = settled;
      set(patch);
      s.notify(
        intakeNotice(accepted, left, `已建造${recipe.name}。這次放置把學期推進到期中，只記一次。`),
      );
    } else {
      set({ narrative: stampSemester(get().narrative, get().claimed) });
      s.notify(`已建造${recipe.name}，可繼續放置或按 Esc 結束。`);
    }
    return true;
  },
  demolish: (id) => {
    const s = get(),
      b = s.buildings.find((v) => v.id === id);
    if (!b) return;
    const recipe = RECIPES.find((r) => r.id === b.kind)!;
    const refund = Object.fromEntries(
      Object.entries(recipe.cost).map(([key, n]) => [key, Math.floor(n / 2)]),
    );
    const { accepted, left } = give(refund);
    const g = useGame.getState();
    set({
      buildings: s.buildings.filter((v) => v.id !== id),
      loot: layRemainder(s.loot, g.playerX, g.playerZ, left),
    });
    s.notify(intakeNotice(accepted, left, "設施已拆除，回收一半材料"));
  },
  interact: () => {
    const choice = promptDecision(promptSnap());
    if (
      !choice ||
      choice.kind === "place" ||
      choice.kind === "stamp" ||
      choice.kind === "open"
    )
      return false;
    runPrompt(choice);
    return true;
  },
  commitPrompt: () => {
    const choice = promptDecision(promptSnap());
    if (!choice) return null;
    runPrompt(choice);
    return choice.kind;
  },
  discover: (id) => {
    const s = get();
    if (!s.discoveries.includes(id)) {
      set({ discoveries: [...s.discoveries, id], ...xpPatch(s, 12) });
    }
  },
  claim: (id) => {
    const s = get(),
      m = MISSIONS.find((v) => v.id === id);
    if (!m || s.claimed.includes(id)) return;
    const progress =
      m.metric === "discoveries" ? s.discoveries.length : s[m.metric];
    if (progress < m.target) return;
    const { accepted, left } = give({ ...m.reward });
    const g = useGame.getState();
    const claimed = [...s.claimed, id];
    set({
      claimed,
      ...xpPatch(s, m.xp),
      loot: layRemainder(s.loot, g.playerX, g.playerZ, left),
      narrative: stampSemester(s.narrative, claimed),
    });
    s.notify(intakeNotice(accepted, left, `完成委託：${m.name}`));
  },
  openNarrative: (placeId) => {
    const s = get();
    const play = approachPlace(s.narrative, growthNow(), placeId, useGame.getState().timeOfDay);
    if (play.ui.phase !== "available") {
      set({ narrative: play.session });
      return false;
    }
    set({ narrative: play.session, narrativeUi: play.ui, panel: "narrative", buildKind: null });
    return true;
  },
  narrativeTalk: () => {
    const s = get();
    if (!s.narrativeUi || s.narrativeUi.phase !== "available") return;
    const play = talkAt({ session: s.narrative, growth: growthNow(), ui: s.narrativeUi });
    set({ narrative: play.session, narrativeUi: play.ui });
  },
  narrativeChoose: (choiceId) => {
    const s = get();
    if (!s.narrativeUi) return;
    const before = growthNow();
    const result = chooseAt({ session: s.narrative, growth: before, ui: s.narrativeUi }, choiceId);
    if (!result.ok) {
      set({ narrative: result.play.session, narrativeUi: result.play.ui });
      if (result.play.ui.notice) s.notify(result.play.ui.notice);
      return;
    }
    const delta = rewardDelta(before, result.play.growth);
    const questSkipped = result.skipped.some((item) => item.startsWith("quest-reward"));
    const ui = questSkipped ? result.play.ui : { ...result.play.ui, notice: null };
    const items: Record<string, number> = {};
    if (delta.notes > 0) items.notes = delta.notes;
    if (delta.credit > 0) items.credit = delta.credit;
    const paid = Object.keys(items).length ? give(items) : { accepted: {}, left: {} };
    const claimed = [...s.claimed];
    for (const id of delta.claimed) {
      if (!claimed.includes(id)) claimed.push(id);
    }
    const discoveries = [...s.discoveries];
    for (const id of delta.discoveries) {
      if (!discoveries.includes(id)) discoveries.push(id);
    }
    const g = useGame.getState();
    set({
      ...(delta.xp > 0 ? xpPatch(s, delta.xp) : {}),
      claimed,
      discoveries,
      loot: layRemainder(s.loot, g.playerX, g.playerZ, paid.left),
      narrative: stampSemester(result.play.session, claimed),
      narrativeUi: ui,
    });
    const note = ui.notice ?? ui.outcome ?? "這段對話結束了。";
    s.notify(Object.keys(paid.accepted).length ? intakeNotice(paid.accepted, paid.left, note) : note);
  },
  narrativeDismiss: () => {
    const s = get();
    if (!s.narrativeUi) {
      set({ panel: s.panel === "narrative" ? null : s.panel });
      return;
    }
    const play =
      s.narrativeUi.phase === "outcome"
        ? acknowledgeAt({ session: s.narrative, growth: growthNow(), ui: s.narrativeUi })
        : leaveAt({ session: s.narrative, growth: growthNow(), ui: s.narrativeUi });
    set({ narrative: play.session, narrativeUi: null, panel: null });
  },
  narrativeEnter: () => {
    const s = get();
    const placeId = s.narrative.placeId;
    get().narrativeDismiss();
    if (placeId) get().enter(placeId);
  },
  respawn: () => {
    const s = get();
    if (s.hp > 0) return;
    const stand = safeSlopeStand(
      s.buildings,
      s.enemies
        .filter((e) => e.hp > 0)
        .map((e) => ({
          x: e.anchorX,
          z: e.anchorZ,
          reach: ENEMY_TYPES[e.kind].radius + 2.5,
        })),
    );
    for (const e of s.enemies) {
      if (e.hp > 0) {
        e.x = e.anchorX;
        e.z = e.anchorZ;
        e.state = "idle";
        e.timer = 0;
      }
    }
    set({
      hp: maxHp(s),
      focus: 100,
      panel: null,
      buildKind: null,
      interiorId: null,
      floor: 1,
      attackUntil: 0,
      skillUntil: 0,
      dodgeUntil: 0,
      invulnerableUntil: 0,
      attackFx: null,
      hurtUntil: 0,
    });
    useGame.getState().restartSlope(stand);
    s.notify("已回到克難坡。背包與學期進度保留。");
  },
  enter: (id) => {
    const site = CAMPUS_SITES.find((p) => p.id === id);
    if (!site || get().hp <= 0) return;
    get().discover(id);
    if (site.form === "court") {
      get().notify("已抵達" + site.name + "，可自由探索這片戶外場地。");
      return;
    }
    settlePlay("relocate");
    set({ interiorId: id, floor: 1, buildKind: null });
    useGame.setState({
      warp: { x: 0, z: 4, yaw: 0 },
      snapCam: true,
      playerX: 0,
      playerZ: 4,
      playerYaw: 0,
      plaqueId: null,
      hud: "none",
    });
  },
  exit: () => {
    const site = CAMPUS_SITES.find((p) => p.id === get().interiorId);
    if (!site) return;
    const door = approachStand(site, get().buildings);
    settlePlay("relocate");
    set({ interiorId: null, floor: 1, buildKind: null });
    useGame.setState({
      warp: { ...door, yaw: Math.PI },
      snapCam: true,
      playerX: door.x,
      playerZ: door.z,
      playerYaw: Math.PI,
      plaqueId: null,
      hud: "none",
    });
  },
  changeFloor: (direction) => {
    const site = CAMPUS_SITES.find((p) => p.id === get().interiorId);
    if (!site) return;
    set({
      floor: Math.max(
        1,
        Math.min(site.floors, get().floor + Math.sign(direction)),
      ),
    });
  },
  travel: (id) => {
    const site = CAMPUS_SITES.find((p) => p.id === id);
    if (!site || get().hp <= 0) return;
    get().setPanel(null);
    settlePlay("relocate");
    set({ interiorId: null, floor: 1, buildKind: null });
    const door = approachStand(site, get().buildings);
    useGame.setState({
      warp: { ...door, yaw: 0 },
      phase: "playing",
      snapCam: true,
      playerX: door.x,
      playerZ: door.z,
      playerYaw: 0,
      plaqueId: null,
      hud: "none",
    });
    get().discover(id);
  },
  exportSave: () => {
    flushSave();
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "tamkang-world-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  keepProgress: () => acceptLocalSave(),
  reloadProgress: () => acceptForeignSave(),
  importSave: (text) => {
    const prepared = prepareImport(text);
    if (!prepared.ok) {
      get().notify(IMPORT_NOTICES[prepared.reason]);
      return false;
    }
    const save = prepared.save;
    const rpg = get();
    const game = useGame.getState();
    const priorSlots = inventory.slots().map((slot) => ({ ...slot }));
    const priorRpg = {
      departmentId: rpg.departmentId,
      xp: rpg.xp,
      equipped: rpg.equipped,
      hp: rpg.hp,
      focus: rpg.focus,
      skillRank: rpg.skillRank,
      kills: rpg.kills,
      built: rpg.built,
      boss: rpg.boss,
      discoveries: [...rpg.discoveries],
      claimed: [...rpg.claimed],
      buildings: rpg.buildings.map((building) => ({ ...building })),
      harvested: { ...rpg.harvested },
      loot: rpg.loot.map((drop) => ({ ...drop, items: { ...drop.items } })),
      clock: rpg.clock,
      attackUntil: rpg.attackUntil,
      skillUntil: rpg.skillUntil,
      dodgeUntil: rpg.dodgeUntil,
      invulnerableUntil: rpg.invulnerableUntil,
      checkpoint: rpg.checkpoint ? { ...rpg.checkpoint } : null,
      interiorId: rpg.interiorId,
      buildKind: rpg.buildKind,
      enemies: rpg.enemies.map((enemy) => ({ ...enemy })),
      lesson: rpg.lesson,
      lessonAnchor: rpg.lessonAnchor ? { ...rpg.lessonAnchor } : null,
      lessonReview: rpg.lessonReview,
      narrative: rpg.narrative,
      narrativeUi: rpg.narrativeUi,
    };
    const priorGame = {
      playerX: game.playerX,
      playerZ: game.playerZ,
      playerYaw: game.playerYaw,
      warp: game.warp ? { ...game.warp } : null,
      snapCam: game.snapCam,
      visited: [...game.visited],
      timeOfDay: game.timeOfDay,
      muted: game.muted,
    };
    const priorStored =
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(RPG_SAVE_KEY);
    const priorLegacy =
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem("tamkang-world-v1");
    const writeBack = (key: string, value: string | null) => {
      if (typeof localStorage === "undefined") return;
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        /* The failing write did not replace the previous text. */
      }
    };
    try {
      restoreInventory(save.slots);
      set({
        departmentId: save.departmentId,
        freshStart: false,
        lesson: save.lesson,
        lessonAnchor: save.lessonAnchor ? { ...save.lessonAnchor } : null,
        lessonReview: false,
        xp: save.xp,
        equipped: save.equipped,
        hp: save.hp,
        focus: save.focus,
        skillRank: save.skillRank,
        kills: save.kills,
        built: save.built,
        boss: save.boss,
        discoveries: save.discoveries,
        claimed: save.claimed,
        buildings: save.buildings,
        enemies: freshEnemies(save.boss),
        harvested: save.harvested,
        loot: save.loot,
        clock: save.clock,
        attackUntil: 0,
        skillUntil: 0,
        dodgeUntil: 0,
        invulnerableUntil: 0,
        checkpoint: save.stand,
        interiorId: null,
        buildKind: null,
        narrative: stampSemester(readNarrativeSession(narrativeField(text)), save.claimed),
        narrativeUi: null,
      });
      if (save.pilgrimage) {
        const current = loadLocal();
        const visited = save.pilgrimage.visited;
        const timeOfDay = save.pilgrimage.timeOfDay ?? current.timeOfDay;
        const muted =
          typeof save.pilgrimage.muted === "boolean"
            ? save.pilgrimage.muted
            : current.muted;
        useGame.setState({ visited, timeOfDay, muted });
        saveLocal({ ...current, visited, timeOfDay, muted });
      }
      placeStand(save.stand);
      clearSaveTimer();
      persistRpgSave();
      noteSaveSettled();
      set({ saved: "saved" });
      get().notify("存檔已匯入。");
      return true;
    } catch {
      try {
        restoreInventory(priorSlots);
        set(priorRpg);
        useGame.setState(priorGame);
        writeBack(RPG_SAVE_KEY, priorStored);
        writeBack("tamkang-world-v1", priorLegacy);
      } finally {
        clearSaveTimer();
        noteSaveSettled();
        set({ saved: "error" });
        get().notify(STORAGE_NOTICE);
      }
      return false;
    }
  },
}));

registerPlaySettle((kind) => {
  if (kind === "suspend") return;
  const s = useRpg.getState();
  calmWindups(s.enemies);
  useRpg.setState({
    attackUntil: 0,
    skillUntil: 0,
    dodgeUntil: 0,
    invulnerableUntil: 0,
    attackFx: null,
    hurtUntil: 0,
    buildKind: null,
    ...(kind === "downed" ? { panel: null } : {}),
    ...(kind === "relocate" ? { interiorId: null, floor: 1 } : {}),
  });
});

function lineOfSight(ax: number, az: number, bx: number, bz: number) {
  return clearSight(ax, az, bx, bz, useRpg.getState().buildings);
}
export function promptSnap(): PromptSnap {
  const s = useRpg.getState();
  const g = useGame.getState();
  return {
    phase: g.phase,
    hp: s.hp,
    panel: s.panel,
    plaqueId: g.plaqueId,
    interiorId: s.interiorId,
    buildKind: s.buildKind,
    rotation: s.rotation,
    playerX: g.playerX,
    playerZ: g.playerZ,
    playerYaw: g.playerYaw,
    buildings: s.buildings,
    loot: s.loot.map((pile) => ({
      id: pile.id,
      x: pile.x,
      z: pile.z,
      items: { ...pile.items },
    })),
    harvested: s.harvested,
    now: Date.now(),
    visited: g.visited,
    slots: inventory.slots().map((slot) => ({
      itemId: slot.itemId,
      quantity: slot.quantity,
    })),
    capacity: BAG_CAPACITY,
    count: (id) => inventory.count(id),
  };
}
function runPrompt(choice: PromptChoice) {
  const s = useRpg.getState();
  if (choice.kind === "exit") {
    s.exit();
    return;
  }
  if (choice.kind === "notes") {
    useRpg.setState({
      hp: Math.min(maxHp(s), s.hp + 10),
      focus: Math.min(100, s.focus + 15),
    });
    s.notify("整理課堂筆記，恢復生命與專注。");
    return;
  }
  if (choice.kind === "pickup") {
    const drop = s.loot.find((pile) => pile.id === choice.targetId);
    if (!drop) return;
    const { accepted, left } = give(drop.items);
    if (Object.keys(accepted).length > 0) {
      useRpg.setState({
        loot: Object.keys(left).length
          ? s.loot.map((pile) =>
              pile.id === drop.id ? { ...pile, items: left } : pile,
            )
          : s.loot.filter((pile) => pile.id !== drop.id),
      });
    }
    s.notify(intakeNotice(accepted, left));
    return;
  }
  if (choice.kind === "supply") {
    const node = SUPPLY_NODES.find((item) => item.id === choice.targetId);
    if (!node) return;
    const { accepted, left } = give({ ...node.items });
    const settled = errandState(s, node, left);
    if (settled) {
      const { accepted: bonus, left: spilled, ...patch } = settled;
      useRpg.setState({
        harvested: { ...s.harvested, [node.id]: Date.now() + 180_000 },
        ...patch,
      });
      s.notify(
        intakeNotice(
          mergeCounts(accepted, bonus),
          spilled,
          "找到校園物資。這次補給把學期推進到期中，只記一次。",
        ),
      );
    } else {
      useRpg.setState({
        harvested: { ...s.harvested, [node.id]: Date.now() + 180_000 },
        loot: layRemainder(s.loot, node.x, node.z, left),
        narrative: stampSemester(s.narrative, s.claimed),
      });
      s.notify(intakeNotice(accepted, left, "找到校園物資"));
    }
    return;
  }
  if (choice.kind === "enter" || choice.kind === "arrive") {
    if (!s.openNarrative(choice.targetId)) s.enter(choice.targetId);
    return;
  }
  if (choice.kind === "place") {
    s.place(choice.x, choice.z);
    return;
  }
  if (choice.kind === "stamp") {
    useGame.getState().stamp(choice.targetId);
    return;
  }
  useGame.getState().openPlaque(choice.targetId);
}
export function hitEnemy(e: Enemy, damage: number) {
  if (e.hp <= 0) return;
  e.hp = Math.max(0, e.hp - damage);
  e.hurt = 0.2;
  if (e.hp > 0) return;
  e.state = "dead";
  e.timer = 100;
  const s = useRpg.getState(),
    d = ENEMY_TYPES[e.kind];
  useRpg.setState({
    kills: s.kills + 1,
    boss: e.kind === "final" ? 1 : s.boss,
    ...xpPatch(s, d.xp),
    loot: stash(s.loot, e.x, e.z, { ...d.reward }),
  });
  s.notify(`擊退${d.name} · +${d.xp} 經驗，按 E 拾取掉落物`);
  if (e.kind === "final") useGame.setState({ settingsOpen: false });
}
const seekers = new Map<string, { vehicle: Vehicle; target: Vector3 }>();
const routes = new Map<
  string,
  {
    next: number;
    targetX: number;
    targetZ: number;
    path: [number, number][];
    structures: number;
  }
>();
let accum = 0,
  supportAccum = 0;
export function tickRpg(delta: number) {
  const g = useGame.getState(),
    s = useRpg.getState();
  if (
    g.phase !== "playing" ||
    s.panel ||
    g.plaqueId ||
    !s.departmentId ||
    s.hp <= 0 ||
    g.benchmarkId
  )
    return;
  accum += Math.min(delta, 0.08);
  if (accum < 0.05) return;
  const dt = Math.min(accum, 0.1);
  accum = 0;
  const clock = s.clock + dt;
  const cycle = clock % 300,
    anomaly =
      cycle > 240
        ? Math.floor(clock / 300) % 2
          ? "blackout"
          : "deadline"
        : "quiet";
  let hp = Math.min(maxHp(s), s.hp),
    focus = Math.min(100, s.focus + dt * 3.2);
  let structuresDamaged = false;
  if (s.interiorId) {
    useRpg.setState({ clock, focus, hp: Math.min(maxHp(s), hp + dt * 2) });
    return;
  }
  if (anomaly !== s.anomaly && anomaly !== "quiet")
    s.notify(
      anomaly === "deadline"
        ? "截止日異象：60 秒內異象加速，閃避預警攻擊！"
        : "停電異象：60 秒內校園陷入暗幕，宮燈可減速敵人。",
    );
  for (const e of s.enemies) {
    e.hurt = Math.max(0, e.hurt - dt);
    const type = ENEMY_TYPES[e.kind];
    if (e.hp <= 0) {
      if (e.kind === "final" && s.boss) continue;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.hp = type.hp;
        e.x = e.anchorX;
        e.z = e.anchorZ;
        e.state = "idle";
      }
      continue;
    }
    const distance = Math.hypot(e.x - g.playerX, e.z - g.playerZ);
    if (distance > 60) {
      e.state = "idle";
      continue;
    }
    if (e.state === "windup") {
      e.timer -= dt;
      if (e.timer <= 0) {
        if (
          distance < type.radius + 2.5 &&
          clock > useRpg.getState().invulnerableUntil &&
          lineOfSight(e.x, e.z, g.playerX, g.playerZ)
        ) {
          hp = Math.max(0, hp - type.damage);
          useRpg.setState({
            invulnerableUntil: clock + 0.7,
            hurtUntil: clock + 0.4,
          });
        }
        const target = s.buildings.find(
          (b) => Math.hypot(b.x - e.x, b.z - e.z) < 3.3,
        );
        if (target) {
          target.hp -= type.damage * 2;
          structuresDamaged = true;
        }
        e.state = "recover";
        e.timer = 1.1;
      }
      continue;
    }
    if (e.state === "recover") {
      e.timer -= dt;
      if (e.timer <= 0) e.state = "chase";
      continue;
    }
    const barrier = s.buildings.find(
      (b) => Math.hypot(b.x - e.x, b.z - e.z) < 3.0,
    );
    if (
      (distance < type.radius + 2 &&
        lineOfSight(e.x, e.z, g.playerX, g.playerZ)) ||
      (distance < 24 && barrier)
    ) {
      e.state = "windup";
      e.timer = type.windup;
      continue;
    }
    const homeDistance = Math.hypot(e.x - e.anchorX, e.z - e.anchorZ);
    const chase = distance < 23 && homeDistance < 38;
    if (!chase && homeDistance < 1) {
      e.state = "idle";
      continue;
    }
    e.state = "chase";
    let seeker = seekers.get(e.id);
    if (!seeker) {
      const vehicle = new Vehicle(),
        target = new Vector3();
      vehicle.steering.add(new SeekBehavior(target));
      seeker = { vehicle, target };
      seekers.set(e.id, seeker);
    }
    const { vehicle, target } = seeker;
    const slow = s.buildings.some(
      (b) => b.kind === "lantern" && Math.hypot(b.x - e.x, b.z - e.z) < 12,
    )
      ? 0.55
      : 1;
    vehicle.position.set(e.x, 0, e.z);
    vehicle.maxSpeed = type.speed * slow * (anomaly === "deadline" ? 1.4 : 1);
    const tx = chase ? g.playerX : e.anchorX,
      tz = chase ? g.playerZ : e.anchorZ;
    let route = routes.get(e.id);
    if (
      !route ||
      route.next < clock ||
      route.structures !== s.buildings.length ||
      Math.hypot(route.targetX - tx, route.targetZ - tz) > 4
    ) {
      const endpoint = resolveBuildings(tx, tz, type.radius, s.buildings);
      route = {
        next: clock + 1.5,
        targetX: tx,
        targetZ: tz,
        structures: s.buildings.length,
        path: findWalkablePath(
          { x: e.x, z: e.z },
          endpoint,
          type.radius,
          s.buildings,
        ),
      };
      routes.set(e.id, route);
    }
    while (
      route.path.length > 1 &&
      Math.hypot(e.x - route.path[0][0], e.z - route.path[0][1]) < 1.3
    )
      route.path.shift();
    const waypoint = route.path[0];
    target.set(waypoint?.[0] ?? e.x, 0, waypoint?.[1] ?? e.z);
    vehicle.update(dt);
    const next = resolveBuildings(
      vehicle.position.x,
      vehicle.position.z,
      type.radius,
      s.buildings,
    );
    if (
      Math.abs(terrainHeight(next.x, next.z) - terrainHeight(e.x, e.z)) < 0.7
    ) {
      e.x = next.x;
      e.z = next.z;
    }
  }
  supportAccum += dt;
  if (supportAccum > 1) {
    supportAccum = 0;
    for (const b of s.buildings) {
      if (
        b.kind === "desk" &&
        Math.hypot(b.x - g.playerX, b.z - g.playerZ) < 6
      ) {
        hp = Math.min(maxHp(s), hp + 5);
        focus = Math.min(100, focus + 8);
      }
      if (b.kind === "turret") {
        const target = s.enemies.find(
          (e) =>
            e.hp > 0 &&
            Math.hypot(b.x - e.x, b.z - e.z) < 15 &&
            lineOfSight(b.x, b.z - 1.6, e.x, e.z),
        );
        if (target) hitEnemy(target, 18);
      }
    }
  }
  const buildings = s.buildings.filter((b) => b.hp > 0);
  useRpg.setState({
    clock,
    hp,
    focus,
    anomaly,
    ...(buildings.length !== s.buildings.length || structuresDamaged
      ? { buildings: [...buildings] }
      : {}),
  });
  if (hp <= 0) {
    if (document.pointerLockElement) document.exitPointerLock();
    settlePlay("downed");
    useGame.setState({ warp: null, hud: "none", plaqueId: null });
    s.notify("你被學期壓力擊倒了。可保留進度重新出發。");
    flushSave();
  }
}
function resumeInterior(raw: Record<string, unknown> | null | undefined) {
  if (!raw || typeof raw.interiorId !== "string") return null;
  const site = CAMPUS_SITES.find((p) => p.id === raw.interiorId);
  if (!site || site.form === "court") return null;
  const floor =
    typeof raw.floor === "number" && Number.isFinite(raw.floor)
      ? Math.floor(raw.floor)
      : 1;
  return { id: site.id, floor: Math.max(1, Math.min(site.floors, floor)) };
}
function snapshot() {
  const s = useRpg.getState();
  const g = useGame.getState(),
    site = CAMPUS_SITES.find((p) => p.id === s.interiorId),
    outside = site ? siteEntrance(site) : null;
  const onTitle = g.phase === "title";
  const position =
    !onTitle && outside
      ? { ...outside, yaw: Math.PI }
      : onTitle && s.checkpoint
        ? { x: s.checkpoint.x, z: s.checkpoint.z, yaw: s.checkpoint.yaw }
        : { x: g.playerX, z: g.playerZ, yaw: g.playerYaw };
  return {
    version: 2,
    departmentId: s.departmentId,
    xp: s.xp,
    hp: s.hp,
    focus: s.focus,
    equipped: s.equipped,
    skillRank: s.skillRank,
    kills: s.kills,
    built: s.built,
    boss: s.boss,
    discoveries: s.discoveries,
    claimed: s.claimed,
    buildings: s.buildings,
    slots: inventory.slots(),
    harvested: s.harvested,
    loot: s.loot,
    clock: s.clock,
    position,
    pilgrimage: { visited: g.visited, timeOfDay: g.timeOfDay, muted: g.muted },
    lesson: s.lesson,
    lessonAnchor: s.lesson === "move" ? s.lessonAnchor : null,
    interiorId: s.interiorId,
    floor: s.interiorId ? s.floor : 1,
    narrative: s.narrative,
  };
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
let foreignText: string | null = null;
let lastWritten: string | null = null;
const SAVE_DELAY = 1800;
function clearSaveTimer() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
}
function noteSaveSettled() {
  dirty = false;
}
function persistRpgSave() {
  if (typeof localStorage === "undefined") return;
  const text = JSON.stringify(snapshot());
  localStorage.setItem(RPG_SAVE_KEY, text);
  lastWritten = text;
}
export function noteLesson(
  reason: "department" | "move" | "supply" | "attack" | "skill",
) {
  const current = useRpg.getState().lesson;
  if (current !== reason) return;
  const index = LESSON_STEPS.indexOf(current);
  const next = LESSON_STEPS[index + 1] ?? "done";
  const pose = useGame.getState();
  useRpg.setState({
    lesson: next,
    lessonAnchor: next === "move" ? { x: pose.playerX, z: pose.playerZ } : null,
    lessonReview: false,
  });
}
export function loadSavedLesson() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RPG_SAVE_KEY);
  } catch {
    raw = null;
  }
  if (raw) {
    try {
      const record = decodeSave(raw);
      const departmentId = knownDepartment(record.departmentId);
      const lesson = readLesson(record.lesson, departmentId);
      useRpg.setState({
        lesson,
        lessonAnchor:
          lesson === "move"
            ? readAnchor(record.lessonAnchor)
            : null,
        lessonReview: false,
      });
      return;
    } catch {
      /* A corrupt file is not a stored semester. */
    }
  }
  useRpg.setState({
    lesson: "department",
    lessonAnchor: null,
    lessonReview: false,
    departmentId: null,
    panel: null,
    freshStart: false,
  });
}
export function flushSave() {
  clearSaveTimer();
  if (typeof localStorage === "undefined" || foreignText) return;
  if (useRpg.getState().freshStart) return;
  try {
    persistRpgSave();
    noteSaveSettled();
    useRpg.setState({ saved: "saved" });
  } catch {
    dirty = true;
    useRpg.setState({ saved: "error" });
  }
}
function scheduleSave() {
  dirty = true;
  if (foreignText) return;
  if (saveTimer) clearTimeout(saveTimer);
  if (useRpg.getState().saved !== "pending")
    useRpg.setState({ saved: "pending" });
  saveTimer = setTimeout(flushSave, SAVE_DELAY);
}
function acceptLocalSave() {
  foreignText = null;
  useRpg.setState({ saveConflict: false });
  flushSave();
}
function acceptForeignSave() {
  const text = foreignText;
  if (!text) return;
  foreignText = null;
  const ok = useRpg.getState().importSave(text);
  if (!ok) {
    foreignText = text;
    useRpg.setState({ saveConflict: true });
    useGame.setState({ settingsOpen: false });
    return;
  }
  useRpg.setState({ saveConflict: false });
}
function onForeignSave(event: StorageEvent) {
  if (event.key !== RPG_SAVE_KEY || typeof event.newValue !== "string") return;
  if (event.newValue === lastWritten) return;
  foreignText = event.newValue;
  clearSaveTimer();
  useRpg.setState({ saveConflict: true });
  useGame.setState({ settingsOpen: false });
}
inventory.store.subscribe(scheduleSave);
useRpg.subscribe((s, prev) => {
  if (
    s.departmentId !== prev.departmentId ||
    s.xp !== prev.xp ||
    s.hp !== prev.hp ||
    s.buildings !== prev.buildings ||
    s.claimed !== prev.claimed ||
    s.discoveries !== prev.discoveries ||
    s.equipped !== prev.equipped ||
    s.skillRank !== prev.skillRank ||
    s.harvested !== prev.harvested ||
    s.loot !== prev.loot ||
    s.lesson !== prev.lesson ||
    s.lessonAnchor !== prev.lessonAnchor ||
    s.narrative !== prev.narrative
  )
    scheduleSave();
});
useGame.subscribe((s, prev) => {
  if (s.phase === "title") return;
  if (
    s.playerX === prev.playerX &&
    s.playerZ === prev.playerZ &&
    s.playerYaw === prev.playerYaw
  )
    return;
  scheduleSave();
});
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushSave);
  window.addEventListener("storage", onForeignSave);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flushSave();
  });
}
