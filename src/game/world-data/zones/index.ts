import { AXIS, SCROLL_PLAZA_SIZE } from "../axis.ts";
import { KENAN, KENAN_APRON_SOUTH_Z } from "../kenan.ts";
import type { Accuracy } from "../origin.ts";

/**
 * Campus zones.
 *
 * A zone is the unit of reality work and of streaming: `detail: "reality"`
 * zones were calibrated in Reality Pass v1 and get full geometry, curated
 * planting and props; `detail: "context"` zones keep their pre-v1 silhouette
 * and are explicitly out of scope (REF_SECONDARY_ZONE_PLACEHOLDER).
 */
export type ZoneDetail = "reality" | "context" | "backdrop";

export type Zone = {
  id: string;
  name: string;
  nameEn: string;
  detail: ZoneDetail;
  /** Axis-aligned XZ bounds. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Draw distance beyond which this zone's props may be skipped, in metres. */
  propRange: number;
  accuracy: Accuracy;
};

export const ZONES: Zone[] = [
  {
    id: "kenan",
    name: "克難坡",
    nameEn: "Ke-nan Slope",
    detail: "reality",
    bounds: { minX: -46, maxX: 46, minZ: AXIS.plazaSouthZ, maxZ: KENAN_APRON_SOUTH_Z + 26 },
    propRange: 160,
    accuracy: "estimated",
  },
  {
    id: "plaza",
    name: "驚聲銅像廣場",
    nameEn: "Ching-sheng Plaza",
    detail: "reality",
    bounds: { minX: -34, maxX: 34, minZ: AXIS.avenueSouthZ, maxZ: AXIS.plazaSouthZ },
    propRange: 180,
    accuracy: "estimated",
  },
  {
    id: "avenue",
    name: "宮燈大道",
    nameEn: "Lantern Avenue",
    detail: "reality",
    bounds: { minX: -44, maxX: 44, minZ: AXIS.avenueNorthZ, maxZ: AXIS.avenueSouthZ },
    propRange: 200,
    accuracy: "estimated",
  },
  {
    id: "dolphin",
    name: "海豚里程碑",
    nameEn: "Dolphin Milestone",
    detail: "reality",
    bounds: {
      minX: -40,
      maxX: 40,
      minZ: AXIS.scrollPlazaZ + SCROLL_PLAZA_SIZE[1] / 2,
      maxZ: AXIS.avenueNorthZ,
    },
    propRange: 170,
    accuracy: "estimated",
  },
  {
    id: "scroll",
    name: "書卷廣場",
    nameEn: "Scroll Plaza",
    detail: "reality",
    bounds: {
      minX: -46,
      maxX: 46,
      minZ: AXIS.libraryFrontZ,
      maxZ: AXIS.scrollPlazaZ + SCROLL_PLAZA_SIZE[1] / 2,
    },
    propRange: 190,
    accuracy: "estimated",
  },
  {
    id: "library",
    name: "覺生紀念圖書館與牧羊草坪",
    nameEn: "Library & Shepherd's Meadow",
    detail: "reality",
    bounds: { minX: -110, maxX: 70, minZ: AXIS.northLimitZ, maxZ: AXIS.libraryFrontZ },
    propRange: 200,
    accuracy: "estimated",
  },
  {
    id: "east",
    name: "東校園",
    nameEn: "East Campus",
    detail: "context",
    bounds: { minX: 70, maxX: 205, minZ: AXIS.northLimitZ, maxZ: 60 },
    propRange: 120,
    accuracy: "estimated",
  },
  {
    id: "west-slope",
    name: "西坡與淡水河",
    nameEn: "West Slope & Tamsui River",
    detail: "backdrop",
    bounds: { minX: -230, maxX: -110, minZ: AXIS.northLimitZ, maxZ: 110 },
    propRange: 80,
    accuracy: "estimated",
  },
];

export const ZONE_BY_ID: Record<string, Zone> = Object.fromEntries(ZONES.map((z) => [z.id, z]));

export function zoneAt(x: number, z: number): Zone | null {
  for (const zone of ZONES) {
    const b = zone.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return zone;
  }
  return null;
}

/** Total length of the calibrated corridor, gate to library front. */
export const REALITY_CORRIDOR_LENGTH = KENAN.bottomZ + KENAN.bottomApronDepth - AXIS.libraryFrontZ;
