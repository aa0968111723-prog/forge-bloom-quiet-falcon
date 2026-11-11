import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import { RIVER_LEVEL, sampleTerrainElevation, terrainGrid } from "../world-data/elevation.ts";
import { LAWN_AREAS } from "../world-data/vegetation.ts";
import { VISTA_RIDGES, vistaTown } from "../world-data/vista.ts";
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

/** Far-bank town. One instanced draw; the blocks are not a walkable district. */
function TownStrip() {
  const mesh = useMemo(() => {
    const blocks = vistaTown();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), blocks.length);
    const color = new THREE.Color();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    blocks.forEach((b, i) => {
      p.set(b.x, b.h / 2 + 1.2, b.z);
      s.set(b.w, b.h, b.d);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
      color.set(b.tone ? "#9a948a" : "#8b8d92");
      inst.setColorAt(i, color);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    return inst;
  }, []);
  useEffect(() => () => {
    mesh.geometry.dispose();
    const material = mesh.material;
    if (!Array.isArray(material)) material.dispose();
  }, [mesh]);
  return <primitive object={mesh} />;
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
        {VISTA_RIDGES.map((ridge) => (
          <mesh
            key={`${ridge.x}-${ridge.z}`}
            position={[ridge.x, ridge.h / 2 - 2, ridge.z]}
            rotation={[0, ridge.rot, 0]}
            scale={[1, 1, 2.1]}
          >
            <coneGeometry args={[ridge.r, ridge.h, 9]} />
            <meshStandardMaterial color={ridge.color} roughness={1} />
          </mesh>
        ))}
        {/* 淡水市街: a strip of small blocks along the near shore. */}
        <TownStrip />
      </group>
    </group>
  );
}
