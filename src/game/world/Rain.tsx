import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { quality } from "../quality";
import { useRpg } from "../rpg/store";
import type { TimeOfDay } from "../world-data/lighting.ts";
import { rainStreaks } from "./rain-count.ts";

const SPAN = 18;
const HEIGHT = 16;

/**
 * Rain only while the wet preset is on, and only outdoors.
 * Streaks follow the camera. Reduced motion holds them still.
 */
export function Rain({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const interior = useRpg((s) => s.interiorId);
  const camera = useThree((s) => s.camera);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const reduced = useRef(false);
  const tier = quality().tier;
  const count = rainStreaks(tier);
  const seeds = useMemo(() => {
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const zs = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      xs[i] = (Math.random() - 0.5) * SPAN;
      ys[i] = Math.random() * HEIGHT;
      zs[i] = (Math.random() - 0.5) * SPAN;
    }
    return { xs, ys, zs };
  }, [count]);
  useEffect(() => {
    reduced.current =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const inst = mesh.current;
    if (!inst) return;
    const fall = reduced.current ? 0 : Math.min(dt, 0.05) * 14;
    const { xs, ys, zs } = seeds;
    for (let i = 0; i < count; i++) {
      let y = ys[i] - fall;
      if (y < -2) y += HEIGHT;
      ys[i] = y;
      dummy.position.set(camera.position.x + xs[i], camera.position.y + y - 4, camera.position.z + zs[i]);
      dummy.rotation.set(0.08, 0, 0.12);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });
  if (timeOfDay !== "wet" || interior) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <boxGeometry args={[0.035, 0.72, 0.035]} />
      <meshBasicMaterial color="#e4eef3" transparent opacity={0.55} depthWrite={false} />
    </instancedMesh>
  );
}
