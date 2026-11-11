import * as THREE from "three";

/** Skeletons this instance owns. Geometry and atlas textures stay shared. */
export function skeletonsIn(root: THREE.Object3D): THREE.Skeleton[] {
  const skeletons: THREE.Skeleton[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;
    if (!skeletons.includes(mesh.skeleton)) skeletons.push(mesh.skeleton);
  });
  return skeletons;
}

/** Drop materials and bone textures this mount allocated. Safe to call twice. */
export function disposeOwnedArt(materials: THREE.Material[], skeletons: THREE.Skeleton[]) {
  for (const material of materials) material.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}
