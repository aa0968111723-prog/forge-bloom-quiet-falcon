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
export const MAX_SLOTS = 24;

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

export function classifySaveDocument(input: unknown): "rpg-v2" | "legacy-pilgrimage" | "invalid" {
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
  if (doc.version === 1) return "legacy-pilgrimage";
  if (Array.isArray(doc.visited) && !("slots" in doc) && !("buildings" in doc)) {
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
      if (budget.keys > 400) {
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

function checkFields(doc: SaveDocument): ValidationResult {
  if (doc.version !== CLOUD_CONTENT_VERSION) {
    return { ok: false, code: "incompatible_content", message: "存檔內容版本不相容。" };
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
  if ("effects" in doc) {
    const effects = checkEffects(doc.effects);
    if (!effects.ok) return effects;
  }
  if ("pilgrimage" in doc && doc.pilgrimage != null) {
    const pilgrimage = checkPilgrimage(doc.pilgrimage);
    if (!pilgrimage.ok) return pilgrimage;
  }
  return { ok: true, document: doc };
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

function finiteIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function integerIn(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
