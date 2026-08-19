import { createContext, useContext } from "react";
import * as THREE from "three";
import { TAMKANG_MATERIALS, type TamkangMaterialId, type TamkangMaterialSpec } from "./tamkang";

/**
 * Shared context + accessors for the Tamkang material library.
 *
 * Exactly one texture object exists per map, shared by every mesh that uses it —
 * geometry carries the world-scale UVs instead (see world/geometry.ts), so
 * nothing needs a per-mesh texture clone.
 */
export type TamkangMaterial = {
  spec: TamkangMaterialSpec;
  map: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
};

export type TamkangMaterialSet = Record<TamkangMaterialId, TamkangMaterial>;

export const MaterialContext = createContext<TamkangMaterialSet | null>(null);

export function useTamkangMaterials(): TamkangMaterialSet {
  const set = useContext(MaterialContext);
  if (!set) throw new Error("useTamkangMaterials must be used inside <TamkangMaterialsProvider>");
  return set;
}

export { TAMKANG_MATERIALS };

export type SurfaceOptions = {
  /** 0..1 from the lighting preset; darkens albedo and drops roughness. */
  wetness?: number;
  /** Multiplied into the base colour. */
  tint?: string;
  emissive?: string;
  emissiveIntensity?: number;
  /** Extra roughness offset, added after the wet adjustment. */
  roughnessBias?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
};

const WET_TINT = new THREE.Color("#7d8288");

/**
 * Props for a `<meshStandardMaterial>` driven by a Tamkang material.
 *
 * After-rain response is physical rather than decorative: the surface gets
 * darker (water fills the pores) and smoother (a thin film flattens the
 * microsurface), scaled by how absorbent that material is.
 */
export function surface(mat: TamkangMaterial, opts: SurfaceOptions = {}) {
  const wet = (opts.wetness ?? 0) * (mat.spec.wetResponse ?? 0.6);
  const base = new THREE.Color(opts.tint ?? "#ffffff");
  if (wet > 0) base.lerp(WET_TINT, wet * 0.45);
  return {
    map: mat.map,
    normalMap: mat.normalMap,
    roughnessMap: mat.roughnessMap,
    aoMap: mat.aoMap,
    aoMapIntensity: mat.aoMap ? 0.85 : 0,
    color: base,
    roughness: Math.max(0.05, 1 - wet * 0.55 + (mat.spec.roughnessBias ?? 0) + (opts.roughnessBias ?? 0)),
    metalness: mat.spec.metalness ?? 0,
    normalScale: new THREE.Vector2(1, 1),
    emissive: new THREE.Color(opts.emissive ?? "#000000"),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  };
}
