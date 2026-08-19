import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

/**
 * One draw call for any number of axis-posed rectangles (window bands, lattice
 * panes, glazing strips). A unit plane is scaled per instance, so panes of any
 * size across any number of buildings batch together as long as they share a
 * material.
 */
export type PlaneItem = {
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
};

const dummy = new THREE.Object3D();

export function InstancedPlanes({
  items,
  children,
  castShadow = false,
}: {
  items: PlaneItem[];
  /** exactly one material element */
  children: ReactNode;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      dummy.position.set(...it.position);
      dummy.rotation.set(0, it.rotationY, 0);
      dummy.scale.set(it.width, it.height, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={castShadow}>
      {children}
    </instancedMesh>
  );
}
