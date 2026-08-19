import {
  AVENUE_PAVED_WIDTH,
  AVENUE_PLANTING_WIDTH,
  AXIS,
  DOLPHIN_ISLAND_RADIUS,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
} from "./axis.ts";
import { KENAN } from "./kenan.ts";
import type { Accuracy } from "./origin.ts";

/**
 * Roads, walks and paved areas along the v1 corridor.
 *
 * Surfaces are separated because they are the strongest silent cue for "where
 * am I": the avenue is stone slab, the roundabout is asphalt with a kerb, the
 * slope aprons are washed concrete, the library forecourt is large-format
 * paving. Getting the *material boundaries* right does more for recognition
 * than adding polygons.
 */
export type PathSurface =
  | "stone-slab" // 宮燈大道 石板
  | "washed-concrete" // 坡底/坡頂鋪面
  | "asphalt" // 車道
  | "sidewalk" // 人行道
  | "plaza-tile" // 廣場地磚
  | "gravel";

export type PathSegment = {
  id: string;
  points: [number, number][];
  width: number;
  surface: PathSurface;
  /** Raised kerb along both edges. */
  kerb?: boolean;
  /** Tactile paving strip down the centre (導盲磚). */
  tactile?: boolean;
  accuracy: Accuracy;
  referenceIds: string[];
};

export type PathArea = {
  id: string;
  surface: PathSurface;
  accuracy: Accuracy;
  referenceIds: string[];
} & (
  | { shape: "circle"; center: [number, number]; radius: number }
  | { shape: "rect"; center: [number, number]; size: [number, number] }
);

const AXIS_REFS = ["REF_AXIS_STRAIGHT_ASSUMPTION"];

export const PATH_SEGMENTS: PathSegment[] = [
  {
    id: "shuiyuan-street",
    points: [
      [-58, AXIS.gateZ + 21],
      [64, AXIS.gateZ + 19],
    ],
    width: 9,
    surface: "asphalt",
    kerb: true,
    accuracy: "estimated",
    referenceIds: [...AXIS_REFS, "REF_SECONDARY_ZONE_PLACEHOLDER"],
  },
  {
    id: "kenan-entry-walk",
    points: [
      [0, AXIS.gateZ + 19],
      [0, AXIS.gateZ + 1],
    ],
    width: 5.4,
    surface: "sidewalk",
    tactile: true,
    accuracy: "estimated",
    referenceIds: AXIS_REFS,
  },
  {
    id: "kenan-top-apron",
    points: [
      [0, AXIS.slopeTopZ],
      [0, AXIS.plazaSouthZ + 1],
    ],
    width: KENAN.width,
    surface: "washed-concrete",
    accuracy: "estimated",
    referenceIds: ["REF_KENAN_STEP_COUNT", ...AXIS_REFS],
  },
  {
    id: "lantern-avenue",
    points: [
      [0, AXIS.plazaNorthZ + 1],
      [0, AXIS.avenueNorthZ],
    ],
    width: AVENUE_PAVED_WIDTH,
    surface: "stone-slab",
    kerb: true,
    // The historic stone walk itself carries no tactile strip.
    accuracy: "mapped",
    referenceIds: ["REF_LANTERN_AVENUE_LENGTH", ...AXIS_REFS],
  },
  {
    id: "avenue-west-verge",
    points: [
      [-(AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH / 2), AXIS.avenueSouthZ],
      [-(AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH / 2), AXIS.avenueNorthZ],
    ],
    width: AVENUE_PLANTING_WIDTH,
    surface: "gravel",
    accuracy: "estimated",
    referenceIds: ["REF_PALACE_ARRANGEMENT"],
  },
  {
    id: "avenue-east-verge",
    points: [
      [AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH / 2, AXIS.avenueSouthZ],
      [AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH / 2, AXIS.avenueNorthZ],
    ],
    width: AVENUE_PLANTING_WIDTH,
    surface: "gravel",
    accuracy: "estimated",
    referenceIds: ["REF_PALACE_ARRANGEMENT"],
  },
  {
    id: "dolphin-north-road",
    points: [
      [0, AXIS.dolphinZ - DOLPHIN_ISLAND_RADIUS - 3],
      [0, AXIS.scrollPlazaZ + SCROLL_PLAZA_SIZE[1] / 2],
    ],
    width: 7,
    surface: "asphalt",
    kerb: true,
    accuracy: "estimated",
    referenceIds: AXIS_REFS,
  },
  {
    id: "dolphin-cross-road",
    points: [
      [-74, AXIS.dolphinZ - 2],
      [96, AXIS.dolphinZ + 4],
    ],
    width: 7.5,
    surface: "asphalt",
    kerb: true,
    accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
  },
  {
    id: "library-forecourt-walk",
    points: [
      [0, AXIS.scrollPlazaZ - SCROLL_PLAZA_SIZE[1] / 2],
      [10, AXIS.libraryFrontZ + 2],
    ],
    width: 8,
    surface: "plaza-tile",
    tactile: true,
    accuracy: "estimated",
    referenceIds: AXIS_REFS,
  },
  {
    id: "meadow-walk",
    points: [
      [-14, AXIS.scrollPlazaZ - 12],
      [-38, AXIS.libraryFrontZ + 6],
      [-58, -290],
    ],
    width: 3.4,
    surface: "washed-concrete",
    accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
  },
  {
    id: "east-service-road",
    points: [
      [96, AXIS.dolphinZ + 4],
      [132, -180],
      [146, -244],
    ],
    width: 7,
    surface: "asphalt",
    kerb: true,
    accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
  },
];

export const PATH_AREAS: PathArea[] = [
  {
    id: "kenan-bottom-apron",
    shape: "rect",
    center: [0, KENAN.bottomZ + KENAN.bottomApronDepth / 2],
    size: [KENAN.bottomApronWidth, KENAN.bottomApronDepth],
    surface: "washed-concrete",
    accuracy: "estimated",
    referenceIds: ["REF_KENAN_STEP_COUNT"],
  },
  {
    id: "chingsheng-plaza",
    shape: "circle",
    center: [0, AXIS.plazaCenterZ],
    radius: PLAZA_RADIUS,
    surface: "plaza-tile",
    accuracy: "estimated",
    referenceIds: ["REF_CHINGSHENG_STATUE"],
  },
  {
    id: "dolphin-roundabout",
    shape: "circle",
    center: [0, AXIS.dolphinZ],
    radius: DOLPHIN_ISLAND_RADIUS + 3.4,
    surface: "asphalt",
    accuracy: "estimated",
    referenceIds: ["REF_DOLPHIN_MILESTONE"],
  },
  {
    id: "scroll-plaza",
    shape: "rect",
    center: [0, AXIS.scrollPlazaZ],
    size: SCROLL_PLAZA_SIZE as unknown as [number, number],
    surface: "plaza-tile",
    accuracy: "estimated",
    referenceIds: ["REF_SCROLL_PLAZA_1986"],
  },
  {
    id: "library-forecourt",
    shape: "rect",
    center: [12, AXIS.libraryFrontZ + 8],
    size: [58, 20],
    surface: "plaza-tile",
    accuracy: "estimated",
    referenceIds: ["REF_LIBRARY_NINE_FLOORS"],
  },
];

/** Squared distance from a point to a segment, in XZ. */
function segDist2(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  const cx = ax + dx * t;
  const cz = az + dz * t;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz);
}

/**
 * Whether a point lies under any paved surface (with a small margin). Used by
 * the terrain sampler to sink the soil beneath paving; build-time only, so the
 * linear scan over segments is fine.
 */
export function pavedAt(x: number, z: number, margin = 0.6): boolean {
  for (const area of PATH_AREAS) {
    if (area.shape === "circle") {
      const d = Math.hypot(x - area.center[0], z - area.center[1]);
      if (d < area.radius + margin) return true;
    } else {
      if (
        Math.abs(x - area.center[0]) < area.size[0] / 2 + margin &&
        Math.abs(z - area.center[1]) < area.size[1] / 2 + margin
      )
        return true;
    }
  }
  for (const seg of PATH_SEGMENTS) {
    const r = seg.width / 2 + margin;
    for (let i = 1; i < seg.points.length; i++) {
      const [ax, az] = seg.points[i - 1];
      const [bx, bz] = seg.points[i];
      if (segDist2(x, z, ax, az, bx, bz) < r * r) return true;
    }
  }
  return false;
}
