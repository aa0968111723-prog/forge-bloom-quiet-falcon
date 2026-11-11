import { CAMPUS_SITES } from "./campus.ts";
import { zoneOfPermanentId, type ZoneId } from "../world-data/registry/index.ts";

/** Short map names. These are district labels, not surveyed boundaries. */
export const ZONE_MARK: Record<ZoneId, { label: string; color: string }> = {
  "axis-54": { label: "軸線", color: "#e7d7a1" },
  "library-55": { label: "書圖", color: "#8fd0c6" },
  "stem-56": { label: "理工", color: "#9eb6e8" },
  "teaching-57": { label: "教學", color: "#e7b08a" },
  "culture-58": { label: "文藝", color: "#e3a3c4" },
  "sports-59": { label: "運動", color: "#b7d38a" },
  "life-60": { label: "生活", color: "#d7c2ef" },
};

export const ZONE_MARK_ORDER = Object.keys(ZONE_MARK) as ZoneId[];

export function zoneMark(id: string) {
  const zone = zoneOfPermanentId(id);
  return zone ? ZONE_MARK[zone] : null;
}

/** Nearest campus site's district. Zone boxes overlap, so this does not claim a boundary. */
export function zoneNear(x: number, z: number): ZoneId | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const site of CAMPUS_SITES) {
    const d = (site.x - x) ** 2 + (site.z - z) ** 2;
    if (d < bestD) {
      best = site.id;
      bestD = d;
    }
  }
  return best ? zoneOfPermanentId(best) : null;
}
