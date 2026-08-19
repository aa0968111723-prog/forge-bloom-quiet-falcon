import { useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import { RIVER_LEVEL, sampleTerrainElevation, terrainGrid } from "../world-data/elevation.ts";
import { LAWN_AREAS } from "../world-data/vegetation.ts";
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

/** Low-rise town blocks along the near river bank, silhouette only. */
function TownStrip() {
  const blocks = useMemo(() => {
    const out: { x: number; z: number; w: number; h: number; d: number }[] = [];
    for (let i = 0; i < 46; i++) {
      const z = -320 + i * 9.6;
      const jitter = Math.sin(i * 12.9898) * 43758.5453;
      const f = jitter - Math.floor(jitter);
      out.push({
        x: -168 - f * 26,
        z,
        w: 4.5 + f * 6,
        h: 3 + ((i * 7) % 5) * 2.2,
        d: 5 + ((i * 3) % 4) * 1.5,
      });
    }
    return out;
  }, []);
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, RIVER_LEVEL + b.h / 2 + 1.2, b.z]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          <meshStandardMaterial color={i % 3 ? "#9a948a" : "#8b8d92"} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
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

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial {...surface(mats["campus/grass"], { wetness })} vertexColors />
      </mesh>

      {/* The west vista the avenue is famous for; the river itself is the
          animated Water surface in world/Water.tsx. */}
      <group position={[0, RIVER_LEVEL, 0]}>
        {/*
          觀音山 in three overlapping haze layers: the reclining ridge line, a
          nearer shoulder, and low foothills. Fog does the aerial perspective;
          each layer is flatter and bluer than the last.
        */}
        {(
          [
            [-520, 96, -140, 210, 0.14, "#5e7263"],
            [-470, 58, 20, 140, -0.24, "#66796d"],
            [-430, 34, -260, 120, 0.32, "#6d7f74"],
            [-400, 24, 120, 96, 0.05, "#748577"],
          ] as const
        ).map(([x, h, z, r, rot, color]) => (
          <mesh key={`${x}-${z}`} position={[x, h / 2 - 2, z]} rotation={[0, rot, 0]} scale={[1, 1, 2.1]}>
            <coneGeometry args={[r, h, 9]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        ))}
        {/* 淡水市街: a strip of small blocks along the near shore. */}
        <TownStrip />
      </group>
    </group>
  );
}
