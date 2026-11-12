import { sampleGroundElevation } from "./elevation.ts";
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

/** World-space samples. Each vertex sits on terrainHeight. */
export function libraryRampSamples(): Vec3[][] {
  const { x, z, length, width, skirt } = LIBRARY_RAMP;
  const halfL = length / 2;
  const halfW = width / 2;
  const xs = [x - halfW - skirt, x - halfW - skirt / 2, x - halfW, x, x + halfW, x + halfW + skirt / 2, x + halfW + skirt];
  const zs: number[] = [];
  for (let dz = -halfL; dz <= halfL + 1e-6; dz += 1) zs.push(z + dz);
  return zs.map((wz) =>
    xs.map((wx): Vec3 => [wx, sampleGroundElevation(wx, wz) + libraryRampLift(wx, wz), wz]),
  );
}

/** Triangles of the same surface the player walks. Normals point up. */
export function libraryRampTriangles(): Vec3[][] {
  const rows = libraryRampSamples();
  const triangles: Vec3[][] = [];
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < rows[j].length - 1; i++) {
      const p00 = rows[j][i];
      const p10 = rows[j][i + 1];
      const p01 = rows[j + 1][i];
      const p11 = rows[j + 1][i + 1];
      triangles.push([p00, p01, p11], [p00, p11, p10]);
    }
  }
  return triangles;
}

/** Height of the rendered triangle that covers this point, if one does. */
export function libraryRampMeshHeight(x: number, z: number): number | null {
  for (const [a, b, c] of libraryRampTriangles()) {
    const v0x = b[0] - a[0];
    const v0z = b[2] - a[2];
    const v1x = c[0] - a[0];
    const v1z = c[2] - a[2];
    const den = v0x * v1z - v1x * v0z;
    if (Math.abs(den) < 1e-8) continue;
    const v2x = x - a[0];
    const v2z = z - a[2];
    const bv = (v2x * v1z - v1x * v2z) / den;
    const bw = (v0x * v2z - v2x * v0z) / den;
    const bu = 1 - bv - bw;
    if (bu < -1e-4 || bv < -1e-4 || bw < -1e-4) continue;
    return bu * a[1] + bv * b[1] + bw * c[1];
  }
  return null;
}
