import { useMemo } from "react";
import { surface, useTamkangMaterials, type TamkangMaterialSet } from "../materials/context";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { PATH_AREAS, PATH_SEGMENTS, type PathSurface } from "../world-data/paths.ts";
import type { TamkangMaterialId } from "../materials/tamkang";
import { groundDiscGeometry, groundRectGeometry, ribbonGeometry } from "./geometry";

/**
 * Roads, walks and paved areas.
 *
 * Every surface follows the ground instead of being a flat slab, which matters
 * on this campus: the avenue falls ~3 m over its length and the slope aprons sit
 * on a hillside. Material boundaries are the strongest silent locator in the
 * scene, so each surface type gets its own map set (stone slab, asphalt, plaza
 * tile, brick sidewalk, washed concrete).
 */
const SURFACE_MATERIAL: Record<PathSurface, TamkangMaterialId> = {
  "stone-slab": "lantern/stone-slab",
  "washed-concrete": "kenan/wet-concrete",
  asphalt: "lantern/asphalt",
  sidewalk: "lantern/sidewalk",
  "plaza-tile": "campus/plaza-tile",
  gravel: "campus/soil",
};

/** Paving sits a few centimetres above the soil it is laid on. */
const LIFT = 0.06;

function surfaceOf(mats: TamkangMaterialSet, s: PathSurface) {
  return mats[SURFACE_MATERIAL[s]];
}

export function Paths({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();

  const segments = useMemo(
    () =>
      PATH_SEGMENTS.map((seg) => {
        const mat = surfaceOf(mats, seg.surface);
        return {
          seg,
          mat,
          geo: ribbonGeometry(seg.points, seg.width, sampleGroundElevation, LIFT, mat.spec.tile),
          kerbs: seg.kerb
            ? ([-1, 1] as const).map((side) =>
                kerbRibbon(seg.points, seg.width, side, mats["lantern/kerb"].spec.tile),
              )
            : null,
          tactile: seg.tactile
            ? ribbonGeometry(seg.points, 0.6, sampleGroundElevation, LIFT + 0.02, mats["lantern/tactile-paving"].spec.tile, 2)
            : null,
        };
      }),
    [mats],
  );

  const areas = useMemo(
    () =>
      PATH_AREAS.map((area) => {
        const mat = surfaceOf(mats, area.surface);
        const geo =
          area.shape === "circle"
            ? groundDiscGeometry(area.center[0], area.center[1], area.radius, sampleGroundElevation, LIFT, mat.spec.tile)
            : groundRectGeometry(
                area.center[0],
                area.center[1],
                area.size[0],
                area.size[1],
                sampleGroundElevation,
                LIFT,
                mat.spec.tile,
              );
        return { area, mat, geo };
      }),
    [mats],
  );

  return (
    <group>
      {areas.map(({ area, mat, geo }) => (
        <mesh key={area.id} geometry={geo} receiveShadow>
          <meshStandardMaterial {...surface(mat, { wetness })} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      ))}
      {segments.map(({ seg, mat, geo, kerbs, tactile }) => (
        <group key={seg.id}>
          <mesh geometry={geo} receiveShadow>
            <meshStandardMaterial {...surface(mat, { wetness })} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
          {kerbs?.map((k, i) => (
            <mesh key={i} geometry={k} receiveShadow castShadow>
              <meshStandardMaterial {...surface(mats["lantern/kerb"], { wetness })} />
            </mesh>
          ))}
          {tactile && (
            <mesh geometry={tactile} receiveShadow>
              <meshStandardMaterial
                {...surface(mats["lantern/tactile-paving"], { wetness })}
                polygonOffset
                polygonOffsetFactor={-4}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/** Kerb line running along one side of a path, raised 12 cm above the surface. */
function kerbRibbon(
  points: readonly (readonly [number, number])[],
  width: number,
  side: -1 | 1,
  tile: number,
) {
  const offset: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    offset.push([points[i][0] - tz * (width / 2 + 0.14) * side, points[i][1] + tx * (width / 2 + 0.14) * side]);
  }
  return ribbonGeometry(offset, 0.3, (x, z) => sampleGroundElevation(x, z) + 0.09, LIFT, tile, 3);
}
