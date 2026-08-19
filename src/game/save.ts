import { coerceTimeOfDay, type TimeOfDay } from "./world";

export const SAVE_VERSION = 1;
const KEY = "tamkang-world-v1";

export type SaveBlob = {
  version: number;
  visited: string[];
  timeOfDay: TimeOfDay;
  muted: boolean;
};

const defaults: SaveBlob = {
  version: SAVE_VERSION,
  visited: [],
  timeOfDay: "sunset",
  muted: false,
};

export function loadLocal(): SaveBlob {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw) as Partial<SaveBlob>;
    return {
      ...defaults,
      ...parsed,
      version: SAVE_VERSION,
      visited: Array.isArray(parsed.visited) ? parsed.visited : [],
      // Saves written before the Reality Pass only knew day / sunset / night;
      // coerceTimeOfDay accepts those and rejects anything unknown.
      timeOfDay: coerceTimeOfDay(parsed.timeOfDay) ?? defaults.timeOfDay,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return { ...defaults };
  }
}

export function saveLocal(blob: SaveBlob) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...blob, version: SAVE_VERSION }));
  } catch {
    /* quota / private mode */
  }
}
