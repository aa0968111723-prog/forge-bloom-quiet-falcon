import { KENAN, KENAN_TOP_APRON_Z, KENAN_TOP_Z, KENAN_TOTAL_RISE } from "./kenan.ts";
import { sampleCurve, type ControlPoint } from "./math.ts";

/**
 * The v1 reality corridor: 校門 → 克難坡 → 驚聲銅像廣場 → 宮燈教室 → 宮燈大道 →
 * 海豚里程碑 → 書卷廣場 → 覺生紀念圖書館.
 *
 * The whole axis is modelled as one straight north–south line at x = 0
 * (REF_AXIS_STRAIGHT_ASSUMPTION). Named stations live here so landmarks,
 * elevation, paths, vegetation and props all agree on where each place starts
 * and ends instead of each file carrying its own magic numbers.
 *
 * Distances that came from published figures:
 *   - 宮燈大道 ≈ 200 m  (REF_LANTERN_AVENUE_LENGTH)
 *   - 克難坡 132 × 0.32 m tread + 6 m landing = 48.24 m of run
 * Everything else is a plausible spacing and tagged `estimated` in landmarks.ts.
 */

/** 驚聲銅像廣場 sits at the world origin; this is its finished ground level. */
export const PLAZA_ELEVATION = KENAN_TOTAL_RISE + 0.216;

/** Radius of the circular plaza at the head of the slope. */
export const PLAZA_RADIUS = 11;

/**
 * Stone drum under the plaza flagpole, west of the statue.
 * Bottom diameter matches the cylinder in ChingshengPlaza.
 */
export const PLAZA_FLAGPOLE = {
  x: -PLAZA_RADIUS + 2.4,
  z: -3.5,
  base: 1.9,
} as const;

/** Published length of 宮燈大道. */
export const AVENUE_LENGTH = 200;

export const AXIS = {
  /** South edge of the bottom apron — the 坡底 entrance line off 水源街. */
  gateZ: KENAN.bottomZ + KENAN.bottomApronDepth,
  /** Bottom-most tread nosing. */
  slopeBottomZ: KENAN.bottomZ,
  /** Back of the top tread. */
  slopeTopZ: KENAN_TOP_Z,
  /** Where the top apron hands over to the plaza. */
  plazaSouthZ: KENAN_TOP_APRON_Z,
  plazaCenterZ: 0,
  plazaNorthZ: -PLAZA_RADIUS,
  /** South end of the paved avenue. */
  avenueSouthZ: -14,
  /** North end of the paved avenue, 200 m later. */
  avenueNorthZ: -14 - AVENUE_LENGTH,
  /** Centre of the 海豚里程碑 roundabout. */
  dolphinZ: -226,
  /** Centre of 書卷廣場. */
  scrollPlazaZ: -272,
  /** Front (south) face of 覺生紀念圖書館. */
  libraryFrontZ: -300,
  /** Centre of the library block. */
  libraryCenterZ: -321,
  northLimitZ: -365,
} as const;

/** Building faces along 宮燈大道 stand this far off the centreline. */
export const AVENUE_BUILDING_SETBACK = 10.5;
/** Paved width of the avenue walk itself (kerb to kerb). */
export const AVENUE_PAVED_WIDTH = 6.0;
/** Planting strip either side of the paving. */
export const AVENUE_PLANTING_WIDTH = 2.6;

/** Radius of the dolphin roundabout island. */
export const DOLPHIN_ISLAND_RADIUS = 9;

/**
 * Leave the dolphin ring through the gap between the north-east bollards,
 * then run north of the ring before turning back to the avenue centre.
 */
const DOLPHIN_EXIT_ANGLE = (126 * Math.PI) / 180;
const DOLPHIN_EXIT_RADIUS = DOLPHIN_ISLAND_RADIUS + 1.5;
export const DOLPHIN_BOLLARD_EXIT: readonly [number, number] = [
  Math.sin(DOLPHIN_EXIT_ANGLE) * DOLPHIN_EXIT_RADIUS,
  AXIS.dolphinZ + Math.cos(DOLPHIN_EXIT_ANGLE) * DOLPHIN_EXIT_RADIUS,
];
export const DOLPHIN_BOLLARD_NORTH: readonly [number, number] = [
  DOLPHIN_BOLLARD_EXIT[0],
  AXIS.dolphinZ - DOLPHIN_ISLAND_RADIUS - 2,
];
/** Stay on the slope centre until the north plaza lamp is beside the path. */
export const PAST_PLAZA_LAMP: readonly [number, number] = [0, 16];
/** East of the road lamp that sits on the dolphin-to-scroll diagonal. */
export const SCROLL_LAMP_PASS: readonly [number, number] = [6.2, -238];
/** 書卷廣場 overall paved size (east–west × north–south). */
export const SCROLL_PLAZA_SIZE: readonly [number, number] = [48, 44];

/** Low west edge of 書卷廣場, where the paving meets the meadow. */
export const SCROLL_WEST_WALL = {
  x: -SCROLL_PLAZA_SIZE[0] / 2 - 0.2,
  z: AXIS.scrollPlazaZ,
  width: 0.4,
  depth: SCROLL_PLAZA_SIZE[1],
} as const;

/**
 * Half-width of the flat, walkable corridor at a given Z.
 *
 * Elevation blends from the corridor surface out to the surrounding landform
 * beyond this, so this is effectively "how wide the man-made ground is".
 */
const HALF_WIDTH_CURVE: readonly ControlPoint[] = [
  [AXIS.gateZ + 24, 7.0], // 水源街 approach
  [AXIS.gateZ, 6.5], // bottom entrance apron
  [AXIS.slopeBottomZ, 6.5],
  // Through the stair the "man-made" ground runs to the retaining wall's outer
  // face; the planted bank starts above the wall coping (elevation.ts).
  [AXIS.slopeBottomZ - 2, KENAN.width / 2 + KENAN.wallThickness],
  [AXIS.slopeTopZ, KENAN.width / 2 + KENAN.wallThickness],
  [AXIS.plazaSouthZ, PLAZA_RADIUS],
  [AXIS.plazaNorthZ, PLAZA_RADIUS],
  [AXIS.avenueSouthZ, AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH + 3.4],
  [AXIS.avenueNorthZ, AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH + 3.4],
  [AXIS.dolphinZ - DOLPHIN_ISLAND_RADIUS, DOLPHIN_ISLAND_RADIUS + 3.5],
  [AXIS.scrollPlazaZ + SCROLL_PLAZA_SIZE[1] / 2, SCROLL_PLAZA_SIZE[0] / 2],
  [AXIS.scrollPlazaZ - SCROLL_PLAZA_SIZE[1] / 2, SCROLL_PLAZA_SIZE[0] / 2],
  [AXIS.libraryFrontZ, 34],
  [AXIS.libraryCenterZ, 34],
  [AXIS.northLimitZ, 22],
];

export function corridorHalfWidth(z: number): number {
  return sampleCurve(HALF_WIDTH_CURVE, z);
}

/** How far the ground takes to blend from the corridor into the landform. */
export function corridorTransition(z: number): number {
  // Tight against the slope's retaining walls, generous on the open plateau.
  return z > AXIS.plazaSouthZ ? 2.4 : 9;
}

/**
 * The main pilgrimage route, south to north, as an XZ polyline. Used by the
 * traversal regression test and by NPC pathing.
 */
export const MAIN_ROUTE: readonly (readonly [number, number])[] = [
  [0, AXIS.gateZ + 8],
  [0, AXIS.slopeBottomZ],
  [0, AXIS.slopeTopZ],
  [0, AXIS.plazaSouthZ - 1],
  // Round the 驚聲銅像 plinth on the east side, the way the paving does.
  [5.6, AXIS.plazaCenterZ],
  // East of the south plaza bench, then back to the avenue centre.
  [2.2, -4],
  [2.2, -12],
  [0, AXIS.avenueSouthZ],
  [0, AXIS.avenueNorthZ],
  // Round the dolphin island rather than climbing over the plinth.
  [6.6, AXIS.dolphinZ],
  DOLPHIN_BOLLARD_EXIT,
  DOLPHIN_BOLLARD_NORTH,
  SCROLL_LAMP_PASS,
  [0, AXIS.scrollPlazaZ],
  // Leave 書卷廣場 between the northern pair of scroll blades, then cross
  // south of the library planters and finish between two troughs.
  [0, AXIS.scrollPlazaZ - 10],
  [11.7, AXIS.scrollPlazaZ - 10],
  [11.7, AXIS.libraryFrontZ + 6],
  [10, AXIS.libraryFrontZ + 6],
];
