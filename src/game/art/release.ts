import * as THREE from "three";

/**
 * Drop what one mounted art instance owns: its material clones and the bone
 * textures of its cloned skeletons. Geometry and atlas textures stay in the
 * loader cache. Several meshes can share one skeleton, so each is disposed once.
 */
export function releaseArtInstance(root: THREE.Object3D, materials: THREE.Material[]) {
  materials.forEach((m) => m.dispose());
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh && mesh.skeleton) skeletons.add(mesh.skeleton);
  });
  skeletons.forEach((s) => s.dispose());
}
