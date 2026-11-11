import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { applyToon } from "../world/stylize";
import { ART_MANIFEST, type ArtId } from "./art-manifest.gen";
import { disposeOwnedArt, skeletonsIn } from "./instance";

/**
 * Runtime side of the art pipeline: stable asset id → exported GLB.
 *
 * URLs carry the content hash, so a re-export is never served stale. Each
 * mounted instance gets its own skeleton and material clones; geometry and
 * atlas textures stay shared in the loader cache. Unmounting disposes the
 * cloned materials and each skeleton's bone texture.
 */
export function artUrl(id: ArtId): string {
  return ART_MANIFEST[id].url;
}

export function preloadArt(id: ArtId) {
  useGLTF.preload(artUrl(id));
}

export type ArtInstance = {
  root: THREE.Object3D;
  clips: THREE.AnimationClip[];
};

export function useArtModel(id: ArtId): ArtInstance {
  const gltf = useGLTF(artUrl(id));
  const gl = useThree((s) => s.gl);
  const instance = useMemo(() => {
    const root = cloneSkinned(gltf.scene);
    const owned: THREE.Material[] = [];
    const anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Skinned bounds lag the pose; culling them pops limbs at the frame edge.
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
      const material = (mesh.material as THREE.MeshStandardMaterial).clone();
      if (material.map) material.map.anisotropy = anisotropy;
      applyToon(material);
      mesh.material = material;
      owned.push(material);
    });
    return { root, clips: gltf.animations, owned, skeletons: skeletonsIn(root) };
  }, [gltf, gl]);
  useEffect(() => () => disposeOwnedArt(instance.owned, instance.skeletons), [instance]);
  return instance;
}

/** Load failures, kept for the QA seam and for the one-time notice. */
export const artFailures: { id: string; message: string }[] = [];
