import type * as THREE from "three";

/**
 * Composable material patches.
 *
 * Several systems want to inject GLSL into the same built-in material — wind
 * sway into the vertex stage, toon banding and rim light into the fragment
 * stage, foliage translucency on top of that. `onBeforeCompile` is a single
 * slot, so patches register here instead and one installed hook runs them all,
 * in insertion order.
 *
 * `customProgramCacheKey` is derived from the patch set: two materials with
 * different patches must not share a compiled program.
 */
export type ShaderPatch = (shader: THREE.WebGLProgramParametersWithUniforms) => void;

type Patched = THREE.Material & {
  userData: { shaderPatches?: Map<string, ShaderPatch> };
};

export function addPatch<T extends THREE.Material>(
  material: T,
  key: string,
  patch: ShaderPatch,
): T {
  const mat = material as unknown as Patched;
  const patches = (mat.userData.shaderPatches ??= new Map());
  // Idempotent: re-applying the same patch key is a no-op, so shared
  // materials can be handed to the same system repeatedly.
  if (patches.has(key)) return material;
  patches.set(key, patch);
  mat.onBeforeCompile = (shader) => {
    for (const p of patches.values()) p(shader);
  };
  mat.customProgramCacheKey = () => [...patches.keys()].join("|");
  mat.needsUpdate = true;
  return material;
}

export function hasPatch(material: THREE.Material, key: string): boolean {
  return Boolean((material as unknown as Patched).userData.shaderPatches?.has(key));
}
