import { useTexture } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { MaterialContext, type TamkangMaterialSet } from "./context";
import { TAMKANG_MATERIALS, materialLoadPlan } from "./tamkang";

/**
 * Loads the Tamkang material library once, for the whole scene.
 *
 * Base colour is sRGB; normal / roughness / AO must stay linear or the lighting
 * comes out wrong. Which maps get fetched at all depends on the quality tier —
 * on mobile the normal and AO maps are skipped, which is where the download and
 * the VRAM actually go.
 */
export function TamkangMaterialsProvider({ children }: { children: ReactNode }) {
  const plan = useMemo(() => materialLoadPlan(quality().tier), []);
  const textures = useTexture(plan.urls) as THREE.Texture[];

  const set = useMemo(() => {
    const out = {} as TamkangMaterialSet;
    for (const entry of plan.entries) {
      const tex = textures[entry.index];
      if (!tex) continue;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = entry.kind === "basecolor" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      tex.anisotropy = quality().tier === "high" ? 8 : 4;
      tex.needsUpdate = true;
      const bucket = (out[entry.id] ??= { spec: TAMKANG_MATERIALS[entry.id], map: tex });
      if (entry.kind === "basecolor") bucket.map = tex;
      if (entry.kind === "normal") bucket.normalMap = tex;
      if (entry.kind === "roughness") bucket.roughnessMap = tex;
      if (entry.kind === "ao") bucket.aoMap = tex;
    }
    return out;
  }, [plan, textures]);

  return <MaterialContext.Provider value={set}>{children}</MaterialContext.Provider>;
}
