import * as THREE from "three";
import { addPatch } from "./shader-patch";

/**
 * Global wind.
 *
 * One shared clock uniform drives every swaying thing in the scene — tree
 * canopies, shrubs, grass — so gusts feel coherent instead of per-object
 * random. Materials opt in via {@link applyWind}, which injects a vertex-stage
 * sway into any built-in material without forking it: displacement grows with
 * height above the model's base, phase comes from the instance's world
 * position so a row of trees never swings in lockstep.
 */
export const WIND = {
  time: { value: 0 },
  /** Global strength multiplier; presets can calm or drive the wind. */
  strength: { value: 1 },
};

export function tickWind(delta: number) {
  WIND.time.value += delta;
}

export type WindProfile = {
  /** Peak horizontal displacement at the top of the model, metres. */
  amplitude: number;
  /** Local height where sway starts (the trunk below stays rigid). */
  base: number;
  /** Local height of full sway. */
  top: number;
};

/**
 * Patch a material so its vertices sway. Safe on shared materials only if all
 * users want the same profile — clone first otherwise.
 */
export function applyWind(material: THREE.Material, profile: WindProfile) {
  return addPatch(material, "wind", (shader) => {
    shader.uniforms.uWindTime = WIND.time;
    shader.uniforms.uWindStrength = WIND.strength;
    shader.uniforms.uWindAmp = { value: profile.amplitude };
    shader.uniforms.uWindBase = { value: profile.base };
    shader.uniforms.uWindTop = { value: profile.top };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uWindTime;
        uniform float uWindStrength;
        uniform float uWindAmp;
        uniform float uWindBase;
        uniform float uWindTop;
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        #include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 windAnchor = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 windAnchor = vec2(modelMatrix[3][0], modelMatrix[3][2]);
          #endif
          float windPhase = dot(windAnchor, vec2(0.043, 0.037));
          float sway = sin(uWindTime * 1.5 + windPhase)
                     + 0.45 * sin(uWindTime * 2.63 + windPhase * 1.7 + 1.3);
          float lift = 0.18 * sin(uWindTime * 0.9 + windPhase * 0.6);
          float h = smoothstep(uWindBase, uWindTop, transformed.y);
          transformed.xz += vec2(0.86, 0.5) * sway * uWindAmp * uWindStrength * h;
          transformed.y += lift * uWindAmp * uWindStrength * h * 0.3;
        }
        `,
      );
  });
}
