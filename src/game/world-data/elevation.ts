import { AXIS, PLAZA_ELEVATION, corridorHalfWidth, corridorTransition } from "./axis.ts";
import { KENAN, kenanRampElevation, kenanStepElevation } from "./kenan.ts";
import { clamp01, sampleCurve, smoothstep, type ControlPoint } from "./math.ts";
import { WORLD_BOUNDS } from "./origin.ts";

/**
 * Calibrated campus elevation.
 * =============================
 *
 * Two surfaces are exposed, and the difference matters:
 *
 *  - {@link sampleGroundElevation} — the surface the *player* stands on. Inside
 *    克難坡 it returns the true stepped tread profile, so feet land on treads
 *    and the 132 steps are felt, not faked.
 *  - {@link sampleTerrainElevation} — the surface the *terrain mesh* is built
 *    from. Inside 克難坡 it returns a smooth ramp that the tread geometry sits
 *    on top of, so a 2 m terrain grid never pokes through a 0.32 m tread.
 *
 * Everywhere else the two are identical.
 *
 * Structure of the model, from authoritative to invented:
 *   1. 克難坡 tread profile        — derived from KENAN (kenan.ts)
 *   2. plateau spine control points — REF_PLATEAU_ASSUMPTION, `estimated`
 *   3. hillside banks off the slope — REF_PLATEAU_ASSUMPTION, `estimated`
 *   4. river fall to the west / ridge rise to the east — silhouette only
 *   5. low-frequency undulation     — cosmetic, never inside the corridor
 */

/** Local datum note, surfaced in Reality Compare Mode. */
export const ELEVATION_DATUM =
  "y = 0 是克難坡坡底鋪面；本層高程皆為相對高度，不代表海拔。";

/** Water surface of the Tamsui River, relative to the datum. */
export const RIVER_LEVEL = -14;

/** Grade at which the hillside climbs away from the slope's retaining walls. */
const BANK_GRADE = 0.42;
/** How far the ground behind a retaining wall stands above the tread. */
const BANK_LIP = 1.15;

/**
 * Elevation along the campus plateau centreline, north of 驚聲銅像廣場.
 * A 1.5% fall down 宮燈大道, then a slight rise towards the library.
 */
const PLATEAU_SPINE: readonly ControlPoint[] = [
  [AXIS.plazaSouthZ, PLAZA_ELEVATION],
  [AXIS.plazaNorthZ, PLAZA_ELEVATION],
  [AXIS.avenueSouthZ, PLAZA_ELEVATION - 0.03],
  [AXIS.avenueSouthZ - 100, 20.1],
  [AXIS.avenueNorthZ, 18.6],
  [AXIS.dolphinZ, 18.5],
  [AXIS.dolphinZ - 24, 18.9],
  [AXIS.scrollPlazaZ, 19.3],
  [AXIS.libraryFrontZ, 19.7],
  [AXIS.libraryCenterZ, 20.1],
  [AXIS.northLimitZ, 20.4],
];

/** Centreline elevation of the man-made corridor (stepped variant). */
export function spineGroundElevation(z: number): number {
  const stair = kenanStepElevation(z, PLAZA_ELEVATION);
  if (stair !== null) return stair;
  if (z > AXIS.plazaSouthZ) return 0; // 水源街 approach, south of the slope
  return sampleCurve(PLATEAU_SPINE, z);
}

/** Centreline elevation of the man-made corridor (smooth variant). */
export function spineRampElevation(z: number): number {
  const stair = kenanRampElevation(z, PLAZA_ELEVATION);
  if (stair !== null) return stair;
  if (z > AXIS.plazaSouthZ) return 0;
  return sampleCurve(PLATEAU_SPINE, z);
}

/** Fall towards the Tamsui River on the west edge of the map. */
function westFall(x: number): number {
  if (x > -118) return 0;
  const t = clamp01((-118 - x) / 88);
  return -Math.pow(t, 1.6) * (PLAZA_ELEVATION - RIVER_LEVEL + 2);
}

/** Rise onto the 五虎崗 ridge on the east edge of the map. */
function eastRise(x: number): number {
  if (x < 92) return 0;
  return smoothstep(92, 200, x) * 9;
}

/** Cosmetic undulation. Zero on the corridor, fades in over 22 m. */
function undulation(x: number, z: number): number {
  return (
    Math.sin(x * 0.021) * 0.55 +
    Math.cos(z * 0.017) * 0.45 +
    Math.sin((x + z) * 0.009) * 0.7
  );
}

/**
 * 牧羊草坪 — the grass bowl that falls away west of the library. Modelled as a
 * single shallow depression so the meadow reads as a slope you look down, which
 * is how it behaves in reality (REF_SECONDARY_ZONE_PLACEHOLDER: `estimated`).
 */
const MEADOW = { x: -58, z: -298, radius: 56, depth: 4.6 } as const;

function meadowBowl(x: number, z: number): number {
  const d = Math.hypot(x - MEADOW.x, z - MEADOW.z);
  if (d > MEADOW.radius) return 0;
  return -Math.cos((d / MEADOW.radius) * Math.PI * 0.5) * MEADOW.depth;
}

/** The natural landform, ignoring any man-made cut or fill. */
function landform(x: number, z: number, distOutside: number): number {
  let base = z > AXIS.plazaSouthZ ? PLAZA_ELEVATION : sampleCurve(PLATEAU_SPINE, z);
  // South of the slope foot the hill flank drops away towards 水源街.
  if (z > AXIS.gateZ + 8) base -= (z - (AXIS.gateZ + 8)) * 0.1;
  const ramp = smoothstep(0, 22, distOutside);
  base += undulation(x, z) * ramp;
  base += meadowBowl(x, z) * ramp;
  base += westFall(x);
  base += eastRise(x);
  return base;
}

function sample(x: number, z: number, stepped: boolean): number {
  const spine = stepped ? spineGroundElevation(z) : spineRampElevation(z);
  const hw = corridorHalfWidth(z);
  const outside = Math.abs(x) - hw;
  if (outside <= 0) return spine;

  const smoothSpine = spineRampElevation(z);
  let outer = landform(x, z, outside);
  if (z > AXIS.plazaSouthZ) {
    // Beside 克難坡 the ground is a cut hillside: it starts a wall-height above
    // the treads and climbs at BANK_GRADE until it meets the plateau.
    const bank = smoothSpine + BANK_LIP + outside * BANK_GRADE;
    outer = Math.min(outer, bank);
    outer = Math.max(outer, smoothSpine - 0.4);
  }
  const t = smoothstep(0, corridorTransition(z), outside);
  return spine + (outer - spine) * t;
}

/** Surface the player, props and vegetation sit on. Stepped inside 克難坡. */
export function sampleGroundElevation(x: number, z: number): number {
  return sample(x, z, true);
}

/** Surface the terrain mesh is built from. Smooth ramp inside 克難坡. */
export function sampleTerrainElevation(x: number, z: number): number {
  // Sink the ramp slightly so tread geometry always wins the depth test.
  const y = sample(x, z, false);
  return z > AXIS.plazaSouthZ && Math.abs(x) < KENAN.width / 2 + 0.1 ? y - 0.09 : y;
}

/**
 * Graded terrain grid: dense through the reality corridor, coarse out at the
 * silhouette. Returned as explicit coordinate lists so the mesh stays a single
 * crack-free surface instead of two meshes fighting at a seam.
 */
export function terrainGrid(step: number): { xs: number[]; zs: number[] } {
  const xs = gradedAxis(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX, [
    { from: -66, to: 66, step },
    { from: -150, to: 150, step: step * 3 },
  ], step * 9);
  const zs = gradedAxis(WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ, [
    { from: AXIS.northLimitZ, to: AXIS.gateZ + 26, step },
  ], step * 8);
  return { xs, zs };
}

function gradedAxis(
  min: number,
  max: number,
  bands: { from: number; to: number; step: number }[],
  coarse: number,
): number[] {
  const out: number[] = [];
  let v = min;
  const stepAt = (p: number) => {
    let s = coarse;
    for (const b of bands) if (p >= b.from && p <= b.to) s = Math.min(s, b.step);
    return s;
  };
  while (v < max) {
    out.push(v);
    v += stepAt(v);
  }
  out.push(max);
  return out;
}
