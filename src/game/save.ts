import { coerceTimeOfDay, type TimeOfDay } from "./world-data/lighting.ts";
import { coerceBuildings, type PlacedStructure } from "./building.ts";
import { coerceDepartmentId } from "./departments.ts";
import {
  coerceInventory,
  DEFAULT_CAPACITY,
  type Inventory,
  type InventoryItem,
} from "./inventory.ts";

export const SAVE_VERSION = 2;
const KEY = "tamkang-world-v1";

/** Player-chosen graphics settings; "auto" defers to device detection. */
export type GraphicsPref = {
  tier: "auto" | "high" | "low";
  postFx: boolean;
};

export type SaveBlob = {
  version: number;
  visited: string[];
  timeOfDay: TimeOfDay;
  muted: boolean;
  graphics: GraphicsPref;
  inventory: InventoryItem[];
  inventoryCapacity: number;
  departmentId: string | null;
  buildings: PlacedStructure[];
};

export const SAVE_DEFAULTS = {
  timeOfDay: "sunset" as TimeOfDay,
  muted: false,
  graphics: { tier: "auto" as const, postFx: true },
};

const defaults: SaveBlob = {
  version: SAVE_VERSION,
  visited: [],
  timeOfDay: SAVE_DEFAULTS.timeOfDay,
  muted: SAVE_DEFAULTS.muted,
  graphics: { ...SAVE_DEFAULTS.graphics },
  inventory: [],
  inventoryCapacity: DEFAULT_CAPACITY,
  departmentId: null,
  buildings: [],
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Migrate a parsed blob (including pilgrimage-only v1 saves) into the current shape. */
export function normalizeSave(raw: unknown): SaveBlob {
  const parsed = asRecord(raw) ?? {};
  const graphicsRaw = asRecord(parsed.graphics);
  const capacityRaw = parsed.inventoryCapacity;
  const capacity =
    typeof capacityRaw === "number" && Number.isFinite(capacityRaw)
      ? Math.max(0, Math.floor(capacityRaw))
      : DEFAULT_CAPACITY;
  const inventory = coerceInventory(parsed.inventory, capacity);
  return {
    version: SAVE_VERSION,
    visited: Array.isArray(parsed.visited)
      ? parsed.visited.filter((id): id is string => typeof id === "string")
      : [],
    timeOfDay: coerceTimeOfDay(parsed.timeOfDay) ?? defaults.timeOfDay,
    muted: Boolean(parsed.muted),
    graphics: {
      tier:
        graphicsRaw?.tier === "high" || graphicsRaw?.tier === "low" ? graphicsRaw.tier : "auto",
      postFx: graphicsRaw?.postFx === false ? false : true,
    },
    inventory: inventory.items,
    inventoryCapacity: inventory.capacity,
    departmentId: coerceDepartmentId(parsed.departmentId),
    buildings: coerceBuildings(parsed.buildings),
  };
}

export function serializeSave(blob: SaveBlob): string {
  return JSON.stringify({ ...blob, version: SAVE_VERSION });
}

export function inventoryFromSave(blob: SaveBlob): Inventory {
  return coerceInventory(blob.inventory, blob.inventoryCapacity);
}

export function loadLocal(): SaveBlob {
  try {
    if (typeof localStorage === "undefined") return { ...defaults };
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return normalizeSave(JSON.parse(raw));
  } catch {
    return { ...defaults };
  }
}

export function saveLocal(blob: SaveBlob) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, serializeSave({ ...blob, version: SAVE_VERSION }));
  } catch {
    /* quota / private mode */
  }
}
