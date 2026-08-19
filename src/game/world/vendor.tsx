import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { applyWind, type WindProfile } from "./wind";

/**
 * Instanced rendering for vendored CC0 GLB/GLTF models.
 *
 * A GLB with N primitives becomes N InstancedMeshes, so a hundred trees of one
 * species cost two or three draw calls, same as the primitive blobs they
 * replace. Each primitive's local transform inside the model is baked into
 * every instance matrix, and instance placement uses foot position + uniform
 * scale + yaw, which is exactly what the placement data provides.
 *
 * Assets and licenses: public/models/vendor/ATTRIBUTION.md.
 */
export type VendorInstance = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
};

/** Recolours applied after load, keyed by material name in the file. */
export type VendorTint = Record<string, string>;

/** Wind profiles keyed by material name — foliage sways, trunks stay rigid. */
export type VendorWind = Record<string, WindProfile>;

type Prim = { geometry: THREE.BufferGeometry; material: THREE.Material; local: THREE.Matrix4 };

const dummy = new THREE.Object3D();
const tmpMat = new THREE.Matrix4();

function usePrimitives(url: string, tint?: VendorTint, wind?: VendorWind): Prim[] {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const prims: Prim[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const source = mesh.material as THREE.MeshStandardMaterial;
      let material: THREE.Material = source;
      const wanted = tint?.[source.name];
      const windProfile = wind?.[source.name];
      if (wanted || windProfile) {
        // Clone before modifying: the loader caches materials per URL.
        const clone = source.clone();
        if (wanted) clone.color = new THREE.Color(wanted);
        if (windProfile) applyWind(clone, windProfile);
        material = clone;
      }
      prims.push({ geometry: mesh.geometry, material, local: mesh.matrixWorld.clone() });
    });
    return prims;
  }, [gltf, tint, wind]);
}

function PrimLayer({
  prim,
  instances,
  castShadow,
}: {
  prim: Prim;
  instances: VendorInstance[];
  castShadow: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((inst, i) => {
      dummy.position.set(inst.x, inst.y, inst.z);
      dummy.rotation.set(0, inst.rotationY, 0);
      dummy.scale.setScalar(inst.scale);
      dummy.updateMatrix();
      tmpMat.multiplyMatrices(dummy.matrix, prim.local);
      mesh.setMatrixAt(i, tmpMat);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances, prim]);
  return (
    <instancedMesh
      ref={ref}
      args={[prim.geometry, prim.material, instances.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** Every instance of one vendored model, batched by primitive. */
export function VendorModel({
  url,
  instances,
  tint,
  wind,
  castShadow = true,
}: {
  url: string;
  instances: VendorInstance[];
  tint?: VendorTint;
  wind?: VendorWind;
  castShadow?: boolean;
}) {
  const prims = usePrimitives(url, tint, wind);
  if (instances.length === 0) return null;
  return (
    <group>
      {prims.map((prim, i) => (
        <PrimLayer key={i} prim={prim} instances={instances} castShadow={castShadow} />
      ))}
    </group>
  );
}
