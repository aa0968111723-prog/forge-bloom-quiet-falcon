import type { TimeOfDay } from "./world";

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
      timeOfDay:
        parsed.timeOfDay === "day" || parsed.timeOfDay === "night" || parsed.timeOfDay === "sunset"
          ? parsed.timeOfDay
          : "sunset",
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
