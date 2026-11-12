import { AXIS } from "./axis.ts";
import { LIBRARY } from "./landmarks.ts";

/**
 * Forecourt ramp up to the library plinth. The north end stops just outside
 * the south wall. Rise and run are estimated, not a measured slope.
 */
export const LIBRARY_RAMP = {
  x: LIBRARY.center[0] - 20,
  z: LIBRARY.center[1] + LIBRARY.length / 2 + 7.4,
  length: 14,
  width: 1.6,
  rise: 1.05,
  skirt: 0.5,
  lip: 0.02,
} as const;

/** Walking height above the plaza. Zero outside the deck and its side skirts. */
export function libraryRampLift(x: number, z: number): number {
  const dx = Math.abs(x - LIBRARY_RAMP.x);
  const dz = z - LIBRARY_RAMP.z;
  const halfL = LIBRARY_RAMP.length / 2;
  const halfW = LIBRARY_RAMP.width / 2;
  if (dz > halfL || dz < -halfL) return 0;
  if (dx > halfW + LIBRARY_RAMP.skirt) return 0;
  const along = (halfL - dz) / LIBRARY_RAMP.length;
  const deck = LIBRARY_RAMP.lip + (LIBRARY_RAMP.rise - LIBRARY_RAMP.lip) * along;
  if (dx <= halfW) return deck;
  return deck * (1 - (dx - halfW) / LIBRARY_RAMP.skirt);
}

type Vec3 = [number, number, number];

/** Local triangles. +Z is the low south end, -Z is the high north end. */
export function libraryRampTriangles(): Vec3[][] {
  const { width, length, rise, skirt, lip } = LIBRARY_RAMP;
  const hw = width / 2;
  const hl = length / 2;
  const sw: Vec3 = [-hw, lip, hl];
  const se: Vec3 = [hw, lip, hl];
  const nw: Vec3 = [-hw, rise, -hl];
  const ne: Vec3 = [hw, rise, -hl];
  const osw: Vec3 = [-hw - skirt, 0, hl];
  const ose: Vec3 = [hw + skirt, 0, hl];
  const onw: Vec3 = [-hw - skirt, 0, -hl];
  const one: Vec3 = [hw + skirt, 0, -hl];
  const floorW: Vec3 = [-hw, 0, -hl];
  const floorE: Vec3 = [hw, 0, -hl];
  return [
    [sw, se, ne],
    [sw, ne, nw],
    [osw, sw, nw],
    [osw, nw, onw],
    [se, ose, one],
    [se, one, ne],
    [nw, ne, floorE],
    [nw, floorE, floorW],
  ];
}
