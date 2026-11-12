/** Shared RPG cloud-save contract. Safe to import from the browser and from Node. */

export const CLOUD_SCHEMA_VERSION = 1;
export const CLOUD_CONTENT_VERSION = 2;
export const RPG_LOCAL_SAVE_KEY = "tamkang-rpg-v2";
export const CLOUD_META_PREFIX = "tamkang-cloud-save-meta:";
export const CLOUD_QUEUE_PREFIX = "tamkang-cloud-save-queue:";
export const CLOUD_RECEIPT_PREFIX = "tamkang-cloud-save-receipt:";
export const CLOUD_ACTIVE_USER_KEY = "tamkang-cloud-save-active-user";
export const MAX_SAVE_BYTES = 262_144;
export const SAVE_HISTORY_LIMIT = 8;
export const MAX_BUILDINGS = 48;
/** Supply nodes plus one cooldown for every built station. */
export const MAX_HARVEST_KEYS = MAX_BUILDINGS + 64;
export const MAX_SLOTS = 24;
/** A full campus snapshot: facilities, bags, narrative maps, loot, and one variety board. */
export const MAX_DOCUMENT_KEYS = 8_000;

export const CONTENT_EFFECTS = [
  "heal",
  "focus",
  "damage",
  "capacity",
  "build_range",
  "grant_item",
] as const;

export type ContentEffectType = (typeof CONTENT_EFFECTS)[number];

export const BUNDLED_CONTENT_MANIFEST = {
  manifestVersion: 1,
  schemaVersion: CLOUD_SCHEMA_VERSION,
  contentVersion: CLOUD_CONTENT_VERSION,
  saveSchema: "rpg-save-v2",
  effects: CONTENT_EFFECTS,
  source: "bundle",
} as const;

export type ContentManifest = {
  manifestVersion: number;
  schemaVersion: number;
  contentVersion: number;
  saveSchema: string;
  effects: readonly string[];
  source: "bundle" | "server";
};

const LESSONS = new Set(["department", "move", "supply", "attack", "skill", "done"]);
const TIMES = new Set(["day", "cloudy", "sunset", "night", "wet"]);
const ID_PATTERN = /^[a-z0-9:_-]{1,64}$/;
const UNSAFE_KEY = new Set(["__proto__", "prototype", "constructor", "script", "eval"]);

export type SaveDocument = Record<string, unknown>;

export type ValidationResult =
  { ok: true; document: SaveDocument } | { ok: false; code: string; message: string };

function hasRpgProgress(doc: Record<string, unknown>): boolean {
  return ["hp", "xp", "slots", "inventory", "skillRank", "claimed"].some((key) => key in doc);
}

export function classifySaveDocument(
  input: unknown,
): "rpg-v2" | "legacy-pilgrimage" | "legacy-rpg" | "invalid" {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "invalid";
  const doc = input as Record<string, unknown>;
  if (
    doc.version === CLOUD_CONTENT_VERSION &&
    Array.isArray(doc.slots) &&
    Array.isArray(doc.buildings) &&
    typeof doc.hp === "number" &&
    Number.isFinite(doc.hp)
  ) {
    return "rpg-v2";
  }
  if (hasRpgProgress(doc) && doc.version !== CLOUD_CONTENT_VERSION) return "legacy-rpg";
  if (
    doc.version === 1 ||
    "playSeconds" in doc ||
    (Array.isArray(doc.visited) && !("slots" in doc))
  ) {
    return "legacy-pilgrimage";
  }
  return "invalid";
}

export function validateRpgDocument(input: unknown): ValidationResult {
  const kind = classifySaveDocument(input);
  if (kind === "legacy-pilgrimage") {
    return {
      ok: false,
      code: "legacy_pilgrimage",
      message: "這是舊巡禮存檔，不會寫入 RPG 雲端存檔。",
    };
  }
  if (kind === "legacy-rpg") {
    return {
      ok: false,
      code: "legacy_rpg",
      message:
        "這是舊版 RPG 存檔。請先在遊戲裡匯入，它會轉成現在的存檔，再上傳。雲端不會改寫本機，也不會寫入巡禮表。",
    };
  }
  if (kind !== "rpg-v2") {
    return {
      ok: false,
      code: "incompatible_content",
      message: "存檔內容版本不相容，已保留原本的雲端進度。",
    };
  }
  const walked = walkValue(input, 0, { keys: 0 });
  if (!walked.ok) return walked;
  const doc = input as SaveDocument;
  const bytes = new TextEncoder().encode(JSON.stringify(doc)).byteLength;
  if (bytes > MAX_SAVE_BYTES) {
    return { ok: false, code: "payload_too_large", message: "存檔超過大小上限。" };
  }
  const fields = checkFields(doc);
  if (!fields.ok) return fields;
  return { ok: true, document: doc };
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decideContentUpdate(input: {
  activeEvent: boolean;
  saveContentVersion: number;
  manifest: Pick<ContentManifest, "contentVersion">;
}): { use: "current" | "manifest"; reason: string } {
  if (input.activeEvent) return { use: "current", reason: "active_event" };
  if (input.manifest.contentVersion !== input.saveContentVersion) {
    return { use: "current", reason: "incompatible_content" };
  }
  return { use: "manifest", reason: "compatible" };
}

export function requestIdOk(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(value);
}

function walkValue(value: unknown, depth: number, budget: { keys: number }): ValidationResult {
  if (depth > 12) return { ok: false, code: "invalid_document", message: "存檔巢狀過深。" };
  if (value === null || typeof value === "boolean") return { ok: true, document: {} };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, code: "invalid_document", message: "存檔含有無法保存的數字。" };
    }
    return { ok: true, document: {} };
  }
  if (typeof value === "string") {
    if (value.length > 4_000) {
      return { ok: false, code: "invalid_document", message: "存檔文字超過長度上限。" };
    }
    if (value.startsWith("javascript:") || value.toLowerCase().includes("</script")) {
      return { ok: false, code: "unsafe_content", message: "存檔含有不允許的內容。" };
    }
    return { ok: true, document: {} };
  }
  if (Array.isArray(value)) {
    if (value.length > 200) {
      return { ok: false, code: "invalid_document", message: "存檔陣列超過長度上限。" };
    }
    for (const item of value) {
      const child = walkValue(item, depth + 1, budget);
      if (!child.ok) return child;
    }
    return { ok: true, document: {} };
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      budget.keys += 1;
      if (budget.keys > MAX_DOCUMENT_KEYS) {
        return { ok: false, code: "invalid_document", message: "存檔欄位過多。" };
      }
      if (UNSAFE_KEY.has(key)) {
        return { ok: false, code: "unsafe_content", message: "存檔含有不允許的欄位。" };
      }
      const child = walkValue(record[key], depth + 1, budget);
      if (!child.ok) return child;
    }
    return { ok: true, document: {} };
  }
  return { ok: false, code: "invalid_document", message: "存檔含有不允許的資料型別。" };
}

const TOP_LEVEL_KEYS = new Set([
  "version",
  "departmentId",
  "xp",
  "hp",
  "focus",
  "equipped",
  "loadout",
  "gear",
  "quarantine",
  "quarantineGear",
  "skillRank",
  "kills",
  "built",
  "boss",
  "gathered",
  "felled",
  "discoveries",
  "claimed",
  "buildings",
  "heldBuild",
  "slots",
  "harvested",
  "loot",
  "clock",
  "position",
  "pilgrimage",
  "lesson",
  "lessonAnchor",
  "interiorId",
  "floor",
  "narrative",
  "variety",
  "effects",
]);

function checkFields(doc: SaveDocument): ValidationResult {
  if (doc.version !== CLOUD_CONTENT_VERSION) {
    return { ok: false, code: "incompatible_content", message: "存檔內容版本不相容。" };
  }
  if (Object.keys(doc).some((key) => !TOP_LEVEL_KEYS.has(key))) {
    return { ok: false, code: "unsafe_content", message: "存檔含有白名單以外的欄位。" };
  }
  if (!finiteIn(doc.hp, 0, 100_000)) {
    return { ok: false, code: "invalid_document", message: "生命值不在允許範圍。" };
  }
  for (const key of ["xp", "focus"] as const) {
    if (key in doc && !finiteIn(doc[key], 0, 10_000_000)) {
      return { ok: false, code: "invalid_document", message: `${key} 不在允許範圍。` };
    }
  }
  if ("clock" in doc && !finiteIn(doc.clock, 0, 1e15)) {
    return { ok: false, code: "invalid_document", message: "時鐘不在允許範圍。" };
  }
  for (const key of ["skillRank", "kills", "built", "boss"] as const) {
    if (key in doc && !integerIn(doc[key], 0, 10_000_000)) {
      return { ok: false, code: "invalid_document", message: `${key} 不在允許範圍。` };
    }
  }
  if ("departmentId" in doc && doc.departmentId !== null) {
    if (typeof doc.departmentId !== "string" || doc.departmentId.length > 80) {
      return { ok: false, code: "invalid_document", message: "科系 id 不正確。" };
    }
  }
  if ("equipped" in doc && typeof doc.equipped !== "boolean") {
    return { ok: false, code: "invalid_document", message: "裝備狀態必須是布林值。" };
  }
  if (!Array.isArray(doc.slots) || doc.slots.length > MAX_SLOTS) {
    return { ok: false, code: "invalid_document", message: "背包槽位超過上限。" };
  }
  for (const slot of doc.slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) {
      return { ok: false, code: "invalid_document", message: "背包槽位格式不正確。" };
    }
    const row = slot as Record<string, unknown>;
    if (Object.keys(row).some((key) => key !== "itemId" && key !== "quantity")) {
      return { ok: false, code: "unsafe_content", message: "背包槽位含有白名單以外的欄位。" };
    }
    if (typeof row.itemId !== "string" || !ID_PATTERN.test(row.itemId)) {
      return { ok: false, code: "invalid_document", message: "物品 id 不在允許格式。" };
    }
    if (!integerIn(row.quantity, 0, 99)) {
      return { ok: false, code: "invalid_document", message: "物品數量不在允許範圍。" };
    }
  }
  if (!Array.isArray(doc.buildings) || doc.buildings.length > MAX_BUILDINGS) {
    return { ok: false, code: "invalid_document", message: "建築數量超過上限。" };
  }
  for (const building of doc.buildings) {
    if (!building || typeof building !== "object" || Array.isArray(building)) {
      return { ok: false, code: "invalid_document", message: "建築格式不正確。" };
    }
    const row = building as Record<string, unknown>;
    if (
      Object.keys(row).some((key) => !BUILDING_KEYS.includes(key as (typeof BUILDING_KEYS)[number]))
    ) {
      return { ok: false, code: "unsafe_content", message: "建築含有白名單以外的欄位。" };
    }
    if (typeof row.id !== "string" || row.id.length < 1 || row.id.length > 80) {
      return { ok: false, code: "invalid_document", message: "建築 id 不正確。" };
    }
    if (typeof row.kind !== "string" || !ID_PATTERN.test(row.kind)) {
      return { ok: false, code: "invalid_document", message: "建築種類不在允許格式。" };
    }
    for (const key of ["x", "z", "rotation"] as const) {
      if (
        typeof row[key] !== "number" ||
        !Number.isFinite(row[key]) ||
        Math.abs(row[key]) > 100_000
      ) {
        return { ok: false, code: "invalid_document", message: "建築座標不正確。" };
      }
    }
    if (!finiteIn(row.hp, 1, 100_000)) {
      return { ok: false, code: "invalid_document", message: "建築耐久不在允許範圍。" };
    }
  }
  if ("claimed" in doc) {
    if (!Array.isArray(doc.claimed) || doc.claimed.length > 100) {
      return { ok: false, code: "invalid_document", message: "任務領取紀錄格式不正確。" };
    }
    for (const id of doc.claimed) {
      if (typeof id !== "string" || !ID_PATTERN.test(id)) {
        return { ok: false, code: "invalid_document", message: "任務 id 不在允許格式。" };
      }
    }
  }
  if ("lesson" in doc && doc.lesson !== null && !LESSONS.has(String(doc.lesson))) {
    return { ok: false, code: "invalid_document", message: "教學進度不在允許清單。" };
  }
  if ("loadout" in doc) {
    const loadout = checkLoadout(doc.loadout);
    if (!loadout.ok) return loadout;
  }
  if ("gear" in doc) {
    const gear = checkGearList(doc.gear, "裝備實例");
    if (!gear.ok) return gear;
  }
  if ("quarantine" in doc) {
    const quarantine = checkQuarantine(doc.quarantine);
    if (!quarantine.ok) return quarantine;
  }
  if ("quarantineGear" in doc) {
    const quarantineGear = checkGearList(doc.quarantineGear, "隔離裝備", "kept");
    if (!quarantineGear.ok) return quarantineGear;
  }
  if ("heldBuild" in doc && doc.heldBuild != null) {
    const held = checkBuilding(doc.heldBuild);
    if (!held.ok) return held;
  }
  if ("effects" in doc) {
    const effects = checkEffects(doc.effects);
    if (!effects.ok) return effects;
  }
  if ("pilgrimage" in doc && doc.pilgrimage != null) {
    const pilgrimage = checkPilgrimage(doc.pilgrimage);
    if (!pilgrimage.ok) return pilgrimage;
  }
  if ("discoveries" in doc) {
    const discoveries = checkIdList(doc.discoveries, "發現紀錄", 100);
    if (!discoveries.ok) return discoveries;
  }
  if ("gathered" in doc) {
    const gathered = checkCountMap(doc.gathered, ["notes", "parts", "coffee", "tea"], "收集進度");
    if (!gathered.ok) return gathered;
  }
  if ("felled" in doc) {
    const felled = checkCountMap(doc.felled, ["quiz", "report", "exam", "final"], "擊退紀錄");
    if (!felled.ok) return felled;
  }
  if ("harvested" in doc) {
    const harvested = checkHarvested(doc.harvested);
    if (!harvested.ok) return harvested;
  }
  if ("loot" in doc) {
    const loot = checkLoot(doc.loot);
    if (!loot.ok) return loot;
  }
  if ("position" in doc && doc.position != null) {
    const position = checkPosition(doc.position);
    if (!position.ok) return position;
  }
  if ("lessonAnchor" in doc && doc.lessonAnchor != null) {
    const anchor = checkAnchor(doc.lessonAnchor);
    if (!anchor.ok) return anchor;
  }
  if ("interiorId" in doc && doc.interiorId != null) {
    if (typeof doc.interiorId !== "string" || !ID_PATTERN.test(doc.interiorId)) {
      return { ok: false, code: "invalid_document", message: "室內場景 id 不正確。" };
    }
  }
  if ("floor" in doc && !integerIn(doc.floor, 1, 30)) {
    return { ok: false, code: "invalid_document", message: "樓層不在允許範圍。" };
  }
  if ("narrative" in doc && doc.narrative != null) {
    const narrative = checkNarrative(doc.narrative);
    if (!narrative.ok) return narrative;
  }
  if ("variety" in doc && doc.variety != null) {
    const variety = checkVariety(doc.variety);
    if (!variety.ok) return variety;
  }
  return { ok: true, document: doc };
}

const LOADOUT_KEYS = ["tool", "accessory", "pack"] as const;
const GEAR_KEYS = ["id", "itemId", "durability", "quality"] as const;
const BUILDING_KEYS = ["id", "kind", "x", "z", "rotation", "hp"] as const;
const NARRATIVE_KEYS = [
  "version",
  "seed",
  "rngState",
  "minute",
  "placeId",
  "weather",
  "timeOfDay",
  "semester",
  "collegeId",
  "departmentId",
  "flags",
  "questNodes",
  "memory",
  "cooldowns",
  "mutexUntil",
  "mutexHolder",
  "recent",
  "fired",
  "resolved",
  "activeEventId",
  "mode",
] as const;
const VARIETY_KEYS = [
  "version",
  "rng",
  "recent",
  "resolved",
  "claims",
  "route",
  "active",
  "signals",
  "tutorialSeen",
] as const;
const COLLEGE_IDS = new Set([
  "liberal-arts",
  "science",
  "engineering",
  "business",
  "foreign-lang",
  "international",
  "education",
  "ai",
  "precision-health",
]);
const NARRATIVE_WEATHER = new Set(["clear", "rain", "dusk"]);
const NARRATIVE_TIME = new Set(["morning", "afternoon", "evening", "night"]);
const NARRATIVE_SEMESTER = new Set(["week-1", "midterm", "finals"]);
const VARIETY_PHASES = new Set([
  "briefing",
  "investigate",
  "puzzle",
  "fork",
  "escort",
  "combat",
  "route",
  "repair",
  "success",
  "failed",
  "aborted",
]);
const VARIETY_BOARDS = new Set(["investigate", "puzzle", "escort", "route", "repair", "combat"]);
const VARIETY_ROUTES = new Set(["peace", "combat", "field"]);

function checkLoadout(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "裝備欄格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => !LOADOUT_KEYS.includes(key as (typeof LOADOUT_KEYS)[number]))
  ) {
    return { ok: false, code: "unsafe_content", message: "裝備欄含有白名單以外的欄位。" };
  }
  for (const key of LOADOUT_KEYS) {
    if (!(key in row) || row[key] === null) continue;
    if (typeof row[key] !== "string" || !ID_PATTERN.test(row[key])) {
      return { ok: false, code: "invalid_document", message: "裝備欄物品 id 不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function keptItemId(value: unknown): boolean {
  return typeof value === "string" && value.length >= 1 && value.length <= 64;
}

function checkGearList(
  value: unknown,
  label: string,
  itemIds: "catalog" | "kept" = "catalog",
): ValidationResult {
  if (!Array.isArray(value) || value.length > 24) {
    return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
  }
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
    }
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).some((key) => !GEAR_KEYS.includes(key as (typeof GEAR_KEYS)[number]))) {
      return { ok: false, code: "unsafe_content", message: `${label}含有白名單以外的欄位。` };
    }
    if (typeof row.id !== "string" || row.id.length < 1 || row.id.length > 64) {
      return { ok: false, code: "invalid_document", message: `${label} id 不正確。` };
    }
    const itemOk =
      itemIds === "kept"
        ? keptItemId(row.itemId)
        : typeof row.itemId === "string" && ID_PATTERN.test(row.itemId);
    if (!itemOk) {
      return { ok: false, code: "invalid_document", message: `${label}物品 id 不正確。` };
    }
    if (!finiteIn(row.durability, 0, 100_000)) {
      return { ok: false, code: "invalid_document", message: `${label}耐久不在允許範圍。` };
    }
    if (row.quality !== "plain" && row.quality !== "fine") {
      return { ok: false, code: "invalid_document", message: `${label}品質不在允許清單。` };
    }
  }
  return { ok: true, document: {} };
}

function checkQuarantine(value: unknown): ValidationResult {
  if (!Array.isArray(value) || value.length > 24) {
    return { ok: false, code: "invalid_document", message: "隔離物品格式不正確。" };
  }
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, code: "invalid_document", message: "隔離物品格式不正確。" };
    }
    const row = entry as Record<string, unknown>;
    if (Object.keys(row).some((key) => key !== "itemId" && key !== "quantity")) {
      return { ok: false, code: "unsafe_content", message: "隔離物品含有白名單以外的欄位。" };
    }
    if (!keptItemId(row.itemId)) {
      return { ok: false, code: "invalid_document", message: "隔離物品 id 不正確。" };
    }
    if (!integerIn(row.quantity, 1, 99)) {
      return { ok: false, code: "invalid_document", message: "隔離物品數量不在允許範圍。" };
    }
  }
  return { ok: true, document: {} };
}

function checkBuilding(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "建築格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => !BUILDING_KEYS.includes(key as (typeof BUILDING_KEYS)[number]))
  ) {
    return { ok: false, code: "unsafe_content", message: "建築含有白名單以外的欄位。" };
  }
  if (typeof row.id !== "string" || row.id.length < 1 || row.id.length > 80) {
    return { ok: false, code: "invalid_document", message: "建築 id 不正確。" };
  }
  if (typeof row.kind !== "string" || !ID_PATTERN.test(row.kind)) {
    return { ok: false, code: "invalid_document", message: "建築種類不在允許格式。" };
  }
  for (const key of ["x", "z", "rotation"] as const) {
    if (
      typeof row[key] !== "number" ||
      !Number.isFinite(row[key]) ||
      Math.abs(row[key]) > 100_000
    ) {
      return { ok: false, code: "invalid_document", message: "建築座標不正確。" };
    }
  }
  if (!finiteIn(row.hp, 1, 100_000)) {
    return { ok: false, code: "invalid_document", message: "建築耐久不在允許範圍。" };
  }
  return { ok: true, document: {} };
}

function checkEffects(value: unknown): ValidationResult {
  if (!Array.isArray(value) || value.length > 32) {
    return { ok: false, code: "invalid_document", message: "內容效果必須是白名單陣列。" };
  }
  for (const effect of value) {
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      return { ok: false, code: "invalid_document", message: "內容效果格式不正確。" };
    }
    const row = effect as Record<string, unknown>;
    const keys = Object.keys(row);
    if (keys.some((key) => !["type", "amount", "itemId"].includes(key))) {
      return { ok: false, code: "unsafe_content", message: "內容效果含有白名單以外的欄位。" };
    }
    if (typeof row.type !== "string" || !CONTENT_EFFECTS.includes(row.type as ContentEffectType)) {
      return { ok: false, code: "unsafe_content", message: "內容效果類型不在白名單。" };
    }
    if ("amount" in row && !integerIn(row.amount, 0, 100_000)) {
      return { ok: false, code: "invalid_document", message: "內容效果數值不正確。" };
    }
    if ("itemId" in row && (typeof row.itemId !== "string" || !ID_PATTERN.test(row.itemId))) {
      return { ok: false, code: "invalid_document", message: "內容效果物品 id 不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function checkPilgrimage(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "巡禮段落格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => key !== "visited" && key !== "timeOfDay" && key !== "muted")) {
    return { ok: false, code: "unsafe_content", message: "巡禮段落含有白名單以外的欄位。" };
  }
  if ("visited" in row) {
    if (!Array.isArray(row.visited) || row.visited.length > 32) {
      return { ok: false, code: "invalid_document", message: "巡禮地標格式不正確。" };
    }
    for (const id of row.visited) {
      if (typeof id !== "string" || id.length > 64) {
        return { ok: false, code: "invalid_document", message: "巡禮地標 id 不正確。" };
      }
    }
  }
  if ("timeOfDay" in row && row.timeOfDay != null && !TIMES.has(String(row.timeOfDay))) {
    return { ok: false, code: "invalid_document", message: "時段不在允許清單。" };
  }
  if ("muted" in row && typeof row.muted !== "boolean") {
    return { ok: false, code: "invalid_document", message: "靜音設定必須是布林值。" };
  }
  return { ok: true, document: {} };
}

function checkIdList(value: unknown, label: string, limit: number): ValidationResult {
  if (!Array.isArray(value) || value.length > limit) {
    return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
  }
  for (const id of value) {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      return { ok: false, code: "invalid_document", message: `${label} id 不正確。` };
    }
  }
  return { ok: true, document: {} };
}

function checkCountMap(value: unknown, keys: readonly string[], label: string): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
  }
  const row = value as Record<string, unknown>;
  const allowed = new Set(keys);
  if (Object.keys(row).some((key) => !allowed.has(key))) {
    return { ok: false, code: "unsafe_content", message: `${label}含有白名單以外的欄位。` };
  }
  for (const key of keys) {
    if (!(key in row)) continue;
    if (!integerIn(row[key], 0, 10_000_000)) {
      return { ok: false, code: "invalid_document", message: `${label}不在允許範圍。` };
    }
  }
  return { ok: true, document: {} };
}

function harvestKeyOk(key: string): boolean {
  if (UNSAFE_KEY.has(key)) return false;
  if (!key.startsWith("facility:")) return ID_PATTERN.test(key);
  const id = key.slice("facility:".length);
  return id.length >= 1 && id.length <= 80 && !UNSAFE_KEY.has(id);
}

function checkHarvested(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "採集時間格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length > MAX_HARVEST_KEYS) {
    return { ok: false, code: "invalid_document", message: "採集時間超過上限。" };
  }
  for (const key of keys) {
    if (!harvestKeyOk(key) || !finiteIn(row[key], 0, 1e15)) {
      return { ok: false, code: "invalid_document", message: "採集時間不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function checkLoot(value: unknown): ValidationResult {
  if (!Array.isArray(value) || value.length > 100) {
    return { ok: false, code: "invalid_document", message: "掉落物格式不正確。" };
  }
  for (const pile of value) {
    if (!pile || typeof pile !== "object" || Array.isArray(pile)) {
      return { ok: false, code: "invalid_document", message: "掉落物格式不正確。" };
    }
    const row = pile as Record<string, unknown>;
    if (
      Object.keys(row).some(
        (key) => key !== "id" && key !== "x" && key !== "z" && key !== "items" && key !== "quest",
      )
    ) {
      return { ok: false, code: "unsafe_content", message: "掉落物含有白名單以外的欄位。" };
    }
    if (typeof row.id !== "string" || row.id.length < 1 || row.id.length > 80) {
      return { ok: false, code: "invalid_document", message: "掉落物 id 不正確。" };
    }
    for (const key of ["x", "z"] as const) {
      if (
        typeof row[key] !== "number" ||
        !Number.isFinite(row[key]) ||
        Math.abs(row[key]) > 100_000
      ) {
        return { ok: false, code: "invalid_document", message: "掉落物座標不正確。" };
      }
    }
    if (!row.items || typeof row.items !== "object" || Array.isArray(row.items)) {
      return { ok: false, code: "invalid_document", message: "掉落物內容格式不正確。" };
    }
    const items = row.items as Record<string, unknown>;
    const itemIds = Object.keys(items);
    if (itemIds.length > 16) {
      return { ok: false, code: "invalid_document", message: "掉落物內容超過上限。" };
    }
    for (const itemId of itemIds) {
      if (!ID_PATTERN.test(itemId) || !integerIn(items[itemId], 1, 99)) {
        return { ok: false, code: "invalid_document", message: "掉落物物品不正確。" };
      }
    }
    if (!("quest" in row)) continue;
    if (!row.quest || typeof row.quest !== "object" || Array.isArray(row.quest)) {
      return { ok: false, code: "invalid_document", message: "委託掉落標記格式不正確。" };
    }
    const quest = row.quest as Record<string, unknown>;
    const questIds = Object.keys(quest);
    if (questIds.length > 16) {
      return { ok: false, code: "invalid_document", message: "委託掉落標記超過上限。" };
    }
    for (const itemId of questIds) {
      const held = items[itemId];
      if (
        !ID_PATTERN.test(itemId) ||
        typeof held !== "number" ||
        !integerIn(quest[itemId], 1, held)
      ) {
        return { ok: false, code: "invalid_document", message: "委託掉落標記不正確。" };
      }
    }
  }
  return { ok: true, document: {} };
}

function checkPosition(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "位置格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => key !== "x" && key !== "z" && key !== "yaw")) {
    return { ok: false, code: "unsafe_content", message: "位置含有白名單以外的欄位。" };
  }
  for (const key of ["x", "z", "yaw"] as const) {
    if (
      typeof row[key] !== "number" ||
      !Number.isFinite(row[key]) ||
      Math.abs(row[key]) > 100_000
    ) {
      return { ok: false, code: "invalid_document", message: "位置座標不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function checkAnchor(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "教學錨點格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => key !== "x" && key !== "z")) {
    return { ok: false, code: "unsafe_content", message: "教學錨點含有白名單以外的欄位。" };
  }
  for (const key of ["x", "z"] as const) {
    if (
      typeof row[key] !== "number" ||
      !Number.isFinite(row[key]) ||
      Math.abs(row[key]) > 100_000
    ) {
      return { ok: false, code: "invalid_document", message: "教學錨點座標不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function checkNarrative(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "敘事進度格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => !NARRATIVE_KEYS.includes(key as (typeof NARRATIVE_KEYS)[number]))
  ) {
    return { ok: false, code: "unsafe_content", message: "敘事進度含有白名單以外的欄位。" };
  }
  if (row.version !== 1) {
    return { ok: false, code: "invalid_document", message: "敘事進度版本不相容。" };
  }
  if (
    "seed" in row &&
    (typeof row.seed !== "string" || row.seed.length < 1 || row.seed.length >= 64)
  ) {
    return { ok: false, code: "invalid_document", message: "敘事種子不正確。" };
  }
  if ("rngState" in row && !finiteIn(row.rngState, 0, 2 ** 32 - 1)) {
    return { ok: false, code: "invalid_document", message: "敘事亂數不在允許範圍。" };
  }
  if ("minute" in row && !finiteIn(row.minute, 0, 1_000_000)) {
    return { ok: false, code: "invalid_document", message: "敘事時間不在允許範圍。" };
  }
  if (
    "placeId" in row &&
    row.placeId != null &&
    (typeof row.placeId !== "string" || !ID_PATTERN.test(row.placeId))
  ) {
    return { ok: false, code: "invalid_document", message: "敘事地點 id 不正確。" };
  }
  if ("weather" in row && !NARRATIVE_WEATHER.has(String(row.weather))) {
    return { ok: false, code: "invalid_document", message: "敘事天氣不在允許清單。" };
  }
  if ("timeOfDay" in row && !NARRATIVE_TIME.has(String(row.timeOfDay))) {
    return { ok: false, code: "invalid_document", message: "敘事時段不在允許清單。" };
  }
  if ("semester" in row && !NARRATIVE_SEMESTER.has(String(row.semester))) {
    return { ok: false, code: "invalid_document", message: "敘事學期不在允許清單。" };
  }
  if ("collegeId" in row && row.collegeId != null && !COLLEGE_IDS.has(String(row.collegeId))) {
    return { ok: false, code: "invalid_document", message: "敘事學院 id 不正確。" };
  }
  if ("departmentId" in row && row.departmentId != null) {
    if (typeof row.departmentId !== "string" || row.departmentId.length > 80) {
      return { ok: false, code: "invalid_document", message: "敘事科系 id 不正確。" };
    }
  }
  if ("flags" in row) {
    const flags = checkBoolMap(row.flags, "敘事旗標", 200);
    if (!flags.ok) return flags;
  }
  for (const key of ["questNodes", "memory", "mutexHolder"] as const) {
    if (!(key in row)) continue;
    const mapped = checkStringMap(row[key], "敘事紀錄", 200);
    if (!mapped.ok) return mapped;
  }
  for (const key of ["cooldowns", "mutexUntil"] as const) {
    if (!(key in row)) continue;
    const mapped = checkNumberMap(row[key], "敘事計時", 200);
    if (!mapped.ok) return mapped;
  }
  if ("recent" in row) {
    const recent = checkShortStrings(row.recent, "敘事近況", 3);
    if (!recent.ok) return recent;
  }
  for (const key of ["fired", "resolved"] as const) {
    if (!(key in row)) continue;
    const list = checkShortStrings(row[key], "敘事事件", 200);
    if (!list.ok) return list;
  }
  if (
    "activeEventId" in row &&
    row.activeEventId != null &&
    (typeof row.activeEventId !== "string" ||
      row.activeEventId.length < 1 ||
      row.activeEventId.length > 80)
  ) {
    return { ok: false, code: "invalid_document", message: "進行中的敘事事件 id 不正確。" };
  }
  if ("mode" in row && row.mode !== "exploring" && row.mode !== "in-event") {
    return { ok: false, code: "invalid_document", message: "敘事模式不在允許清單。" };
  }
  return { ok: true, document: {} };
}

function checkVariety(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法進度格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => !VARIETY_KEYS.includes(key as (typeof VARIETY_KEYS)[number]))
  ) {
    return { ok: false, code: "unsafe_content", message: "多樣玩法進度含有白名單以外的欄位。" };
  }
  if (row.version !== 1) {
    return { ok: false, code: "invalid_document", message: "多樣玩法進度版本不相容。" };
  }
  if ("rng" in row && !finiteIn(row.rng, 0, 2 ** 32 - 1)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法亂數不在允許範圍。" };
  }
  if ("recent" in row) {
    const recent = checkShortStrings(row.recent, "多樣玩法近況", 3);
    if (!recent.ok) return recent;
  }
  for (const key of ["resolved", "claims"] as const) {
    if (!(key in row)) continue;
    const list = checkShortStrings(row[key], "多樣玩法紀錄", 40);
    if (!list.ok) return list;
  }
  if ("route" in row && row.route != null && row.route !== "peace" && row.route !== "combat") {
    return { ok: false, code: "invalid_document", message: "多樣玩法路線不在允許清單。" };
  }
  if ("tutorialSeen" in row && typeof row.tutorialSeen !== "boolean") {
    return { ok: false, code: "invalid_document", message: "多樣玩法教學標記必須是布林值。" };
  }
  if ("signals" in row) {
    const signals = checkSignals(row.signals);
    if (!signals.ok) return signals;
  }
  if ("active" in row && row.active != null) {
    const active = checkVarietyRun(row.active);
    if (!active.ok) return active;
  }
  return { ok: true, document: {} };
}

function checkVarietyRun(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "進行中的多樣玩法格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  const keys = ["eventId", "phase", "route", "board", "failReason", "receipt", "tutorial", "caps"];
  if (Object.keys(row).some((key) => !keys.includes(key))) {
    return { ok: false, code: "unsafe_content", message: "進行中的多樣玩法含有白名單以外的欄位。" };
  }
  if (typeof row.eventId !== "string" || row.eventId.length < 1 || row.eventId.length > 80) {
    return { ok: false, code: "invalid_document", message: "多樣玩法事件 id 不正確。" };
  }
  if (typeof row.phase !== "string" || !VARIETY_PHASES.has(row.phase)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法階段不在允許清單。" };
  }
  if (row.route != null && (typeof row.route !== "string" || !VARIETY_ROUTES.has(row.route))) {
    return { ok: false, code: "invalid_document", message: "多樣玩法路線不在允許清單。" };
  }
  if (
    row.failReason != null &&
    (typeof row.failReason !== "string" || row.failReason.length > 80)
  ) {
    return { ok: false, code: "invalid_document", message: "多樣玩法失敗原因不正確。" };
  }
  if (row.receipt != null && (typeof row.receipt !== "string" || row.receipt.length > 80)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法回執不正確。" };
  }
  if (typeof row.tutorial !== "boolean") {
    return { ok: false, code: "invalid_document", message: "多樣玩法教學標記必須是布林值。" };
  }
  if (row.board != null) {
    const board = checkBoard(row.board);
    if (!board.ok) return board;
  }
  const caps = checkCaps(row.caps);
  if (!caps.ok) return caps;
  return { ok: true, document: {} };
}

function checkCaps(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法能力快照格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  const keys = ["equipped", "skillRank", "built", "collegeId", "discipline"];
  if (Object.keys(row).some((key) => !keys.includes(key))) {
    return { ok: false, code: "unsafe_content", message: "多樣玩法能力快照含有白名單以外的欄位。" };
  }
  if (typeof row.equipped !== "boolean") {
    return { ok: false, code: "invalid_document", message: "多樣玩法能力快照必須包含裝備狀態。" };
  }
  if (!integerIn(row.skillRank, 1, 5) || !integerIn(row.built, 0, 10_000_000)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法能力快照數值不正確。" };
  }
  if (row.collegeId != null && (typeof row.collegeId !== "string" || row.collegeId.length > 80)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法學院 id 不正確。" };
  }
  if (
    row.discipline != null &&
    (typeof row.discipline !== "string" || row.discipline.length > 80)
  ) {
    return { ok: false, code: "invalid_document", message: "多樣玩法學科 id 不正確。" };
  }
  return { ok: true, document: {} };
}

function checkBoard(value: unknown): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法盤面格式不正確。" };
  }
  const row = value as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length > 48) {
    return { ok: false, code: "invalid_document", message: "多樣玩法盤面欄位過多。" };
  }
  if (typeof row.board !== "string" || !VARIETY_BOARDS.has(row.board)) {
    return { ok: false, code: "invalid_document", message: "多樣玩法盤面類型不在允許清單。" };
  }
  if (
    row.board === "combat" &&
    row.combat != null &&
    row.combat !== "quiz" &&
    row.combat !== "report" &&
    row.combat !== "exam" &&
    row.combat !== "final"
  ) {
    return { ok: false, code: "invalid_document", message: "多樣玩法戰鬥類型不在允許清單。" };
  }
  return { ok: true, document: {} };
}

function checkSignals(value: unknown): ValidationResult {
  if (!Array.isArray(value) || value.length > 20) {
    return { ok: false, code: "invalid_document", message: "多樣玩法訊號超過上限。" };
  }
  for (const signal of value) {
    if (!signal || typeof signal !== "object" || Array.isArray(signal)) {
      return { ok: false, code: "invalid_document", message: "多樣玩法訊號格式不正確。" };
    }
    const row = signal as Record<string, unknown>;
    if (
      Object.keys(row).some(
        (key) => key !== "type" && key !== "eventId" && key !== "route" && key !== "questId",
      )
    ) {
      return { ok: false, code: "unsafe_content", message: "多樣玩法訊號含有白名單以外的欄位。" };
    }
    if (row.type !== "variety.resolved") {
      return { ok: false, code: "unsafe_content", message: "多樣玩法訊號類型不在白名單。" };
    }
    if (typeof row.eventId !== "string" || row.eventId.length < 1 || row.eventId.length > 80) {
      return { ok: false, code: "invalid_document", message: "多樣玩法訊號事件 id 不正確。" };
    }
    if (typeof row.route !== "string" || !VARIETY_ROUTES.has(row.route)) {
      return { ok: false, code: "invalid_document", message: "多樣玩法訊號路線不在允許清單。" };
    }
    if (typeof row.questId !== "string" || !ID_PATTERN.test(row.questId)) {
      return { ok: false, code: "invalid_document", message: "多樣玩法訊號任務 id 不正確。" };
    }
  }
  return { ok: true, document: {} };
}

function checkBoolMap(value: unknown, label: string, limit: number): ValidationResult {
  const entries = mapEntries(value, label, limit);
  if (!entries.ok) return entries;
  for (const [, entry] of entries.pairs) {
    if (typeof entry !== "boolean") {
      return { ok: false, code: "invalid_document", message: `${label}必須是布林值。` };
    }
  }
  return { ok: true, document: {} };
}

function checkStringMap(value: unknown, label: string, limit: number): ValidationResult {
  const entries = mapEntries(value, label, limit);
  if (!entries.ok) return entries;
  for (const [, entry] of entries.pairs) {
    if (typeof entry !== "string" || entry.length >= 80) {
      return { ok: false, code: "invalid_document", message: `${label}內容不正確。` };
    }
  }
  return { ok: true, document: {} };
}

function checkNumberMap(value: unknown, label: string, limit: number): ValidationResult {
  const entries = mapEntries(value, label, limit);
  if (!entries.ok) return entries;
  for (const [, entry] of entries.pairs) {
    if (!finiteIn(entry, -1e12, 1e15)) {
      return { ok: false, code: "invalid_document", message: `${label}數值不正確。` };
    }
  }
  return { ok: true, document: {} };
}

function mapEntries(
  value: unknown,
  label: string,
  limit: number,
): { ok: true; pairs: [string, unknown][] } | { ok: false; code: string; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
  }
  const pairs = Object.entries(value as Record<string, unknown>);
  if (pairs.length > limit) {
    return { ok: false, code: "invalid_document", message: `${label}超過上限。` };
  }
  for (const [key] of pairs) {
    if (key.length < 1 || key.length >= 80) {
      return { ok: false, code: "invalid_document", message: `${label}鍵不正確。` };
    }
  }
  return { ok: true, pairs };
}

function checkShortStrings(value: unknown, label: string, limit: number): ValidationResult {
  if (!Array.isArray(value) || value.length > limit) {
    return { ok: false, code: "invalid_document", message: `${label}格式不正確。` };
  }
  for (const item of value) {
    if (typeof item !== "string" || item.length < 1 || item.length >= 80) {
      return { ok: false, code: "invalid_document", message: `${label}內容不正確。` };
    }
  }
  return { ok: true, document: {} };
}

function finiteIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function integerIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
