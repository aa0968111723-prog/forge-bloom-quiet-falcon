import { useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import { RIVER_LEVEL, sampleTerrainElevation, terrainGrid } from "../world-data/elevation.ts";
import { LAWN_AREAS } from "../world-data/vegetation.ts";
import { WORLD_BOUNDS } from "../world-data/origin.ts";
import { gridSurfaceGeometry } from "./geometry";

/**
 * Campus ground.
 *
 * One graded mesh covers the whole map: ~2 m spacing through the calibrated
 * corridor (so 克難坡's banks and the avenue's fall actually read) grading out to
 * ~18 m at the silhouette. A single surface means no seam to crack open between
 * a detailed foreground and a coarse background.
 *
 * Surface variation is vertex colour rather than extra draw calls: steep faces
 * tint towards bare soil, mown areas towards lawn green. The grass material's
 * UVs are in metres, so the blade scale stays constant everywhere.
 */
function lawnWeight(x: number, z: number): number {
  let w = 0;
  for (const area of LAWN_AREAS) {
    const d = Math.hypot(x - area.center[0], z - area.center[1]);
    if (d < area.radius) w = Math.max(w, 1 - d / area.radius);
  }
  return w;
}

export function Terrain({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const q = quality();

  const geometry = useMemo(() => {
    const { xs, zs } = terrainGrid(q.terrainStep);
    const geo = gridSurfaceGeometry(xs, zs, sampleTerrainElevation, mats["campus/grass"].spec.tile);

    // Slope-aware tint. Normals are already computed by gridSurfaceGeometry.
    const normal = geo.attributes.normal as THREE.BufferAttribute;
    const position = geo.attributes.position as THREE.BufferAttribute;
    const colours = new Float32Array(position.count * 3);
    // Kept close to neutral: the grass basecolor map already carries the hue,
    // and stacking a saturated tint on top is what made v0 look like a lawn ad.
    const grass = new THREE.Color("#a9b494");
    const lawn = new THREE.Color("#b9c49a");
    const soil = new THREE.Color("#8a7a5c");
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const steep = 1 - Math.min(1, Math.max(0, normal.getY(i)));
      c.copy(grass);
      c.lerp(lawn, lawnWeight(position.getX(i), position.getZ(i)) * 0.8);
      c.lerp(soil, Math.min(1, steep * 2.6));
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
    return geo;
  }, [mats, q.terrainStep]);

  const riverGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(240, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ + 320);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial {...surface(mats["campus/grass"], { wetness })} vertexColors />
      </mesh>

      {/* Tamsui River, and 觀音山 across the water — silhouette only. */}
      <mesh geometry={riverGeo} position={[-250, RIVER_LEVEL, -120]} receiveShadow>
        <meshStandardMaterial color="#456f84" roughness={0.14} metalness={0.35} />
      </mesh>
      <group position={[0, RIVER_LEVEL, 0]}>
        {(
          [
            [-470, 78, -180, 150, 0.2],
            [-540, 52, 30, 110, -0.3],
            [-430, 36, 150, 84, 0.1],
            [-500, 28, -330, 92, 0.4],
          ] as const
        ).map(([x, h, z, r, rot]) => (
          <mesh key={`${x}-${z}`} position={[x, h / 2, z]} rotation={[0, rot, 0]}>
            <coneGeometry args={[r, h, 7]} />
            <meshStandardMaterial color="#54655a" roughness={0.95} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
