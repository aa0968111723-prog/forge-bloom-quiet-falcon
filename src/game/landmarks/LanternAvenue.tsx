import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { propsOfKind } from "../world-data/props.ts";
import { worldUvCylinder } from "../world/geometry";

/**
 * 宮燈大道 — the lanterns themselves.
 *
 * The paving, kerbs and verges are drawn by `world/Paths`; this is the thing the
 * avenue is named after. Position data comes from `world-data/props`, so the
 * spacing is part of the reality data rather than a loop in a component.
 *
 * A lantern is: a stone base, a slim vermilion post, a small tiled cap, and a
 * warm glass box under it. They are staggered across the avenue — west side on
 * the 12 m grid, east side offset by half — which is what makes the receding
 * perspective read as a double row rather than a ladder.
 */
const dummy = new THREE.Object3D();

const POST_HEIGHT = 3.1;

export function LanternAvenue({ wetness, lampsOn }: { wetness: number; lampsOn: boolean }) {
  const mats = useTamkangMaterials();
  const q = quality();
  const lanterns = useMemo(() => propsOfKind("lantern-post"), []);

  const bases = useRef<THREE.InstancedMesh>(null);
  const posts = useRef<THREE.InstancedMesh>(null);
  const lamps = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);

  const geos = useMemo(
    () => ({
      // 宮燈: pale stone column on a stepped base, hexagonal cream lantern
      // head, small green glazed cap — the silhouette the avenue is named for.
      base: worldUvCylinder(0.3, 0.4, 0.55, 6, mats["kenan/old-wall"].spec.tile),
      post: worldUvCylinder(0.11, 0.15, POST_HEIGHT, 6, mats["kenan/retaining-wall"].spec.tile),
      lamp: new THREE.CylinderGeometry(0.34, 0.26, 0.72, 6),
      cap: new THREE.ConeGeometry(0.46, 0.34, 6),
    }),
    [mats],
  );

  useLayoutEffect(() => {
    const refs = [bases.current, posts.current, lamps.current, caps.current];
    if (refs.some((r) => !r)) return;
    const heights = [0.27, 0.55 + POST_HEIGHT / 2, 0.55 + POST_HEIGHT + 0.36, 0.55 + POST_HEIGHT + 0.85];
    lanterns.forEach((l, i) => {
      const ground = sampleGroundElevation(l.x, l.z);
      refs.forEach((mesh, m) => {
        dummy.position.set(l.x, ground + heights[m], l.z);
        dummy.rotation.set(0, m >= 2 ? Math.PI / 6 : 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh!.setMatrixAt(i, dummy.matrix);
      });
    });
    for (const mesh of refs) {
      mesh!.instanceMatrix.needsUpdate = true;
      mesh!.computeBoundingSphere();
    }
  }, [lanterns, geos]);

  return (
    <group>
      <instancedMesh ref={bases} args={[geos.base, undefined, lanterns.length]} castShadow receiveShadow>
        <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
      </instancedMesh>
      <instancedMesh ref={posts} args={[geos.post, undefined, lanterns.length]} castShadow>
        <meshStandardMaterial {...surface(mats["kenan/retaining-wall"], { wetness, tint: "#efe9db" })} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[geos.lamp, undefined, lanterns.length]}>
        <meshStandardMaterial
          color={lampsOn ? "#fff3d8" : "#f2ead6"}
          emissive={lampsOn ? "#ffc274" : "#000000"}
          emissiveIntensity={lampsOn ? 1.4 : 0}
          roughness={0.4}
        />
      </instancedMesh>
      <instancedMesh ref={caps} args={[geos.cap, undefined, lanterns.length]} castShadow>
        <meshStandardMaterial color="#2c5c40" roughness={0.42} />
      </instancedMesh>

      {/*
        A handful of real point lights at night, spread along the avenue rather
        than one per lantern — 34 shadowless point lights would cost more than
        the rest of the scene put together.
      */}
      {lampsOn &&
        lanterns
          .filter((_, i) => i % Math.ceil(lanterns.length / q.maxLampLights) === 0)
          .slice(0, q.maxLampLights)
          .map((l) => (
            <pointLight
              key={`${l.x}-${l.z}`}
              position={[l.x, sampleGroundElevation(l.x, l.z) + POST_HEIGHT + 0.6, l.z]}
              color="#ffbc74"
              intensity={9}
              distance={26}
              decay={2}
            />
          ))}
    </group>
  );
}
