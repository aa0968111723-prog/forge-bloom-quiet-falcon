import * as THREE from "three";
import { addPatch, hasPatch } from "./shader-patch";

/**
 * Stylised rendering.
 * =====================
 *
 * The campus keeps its PBR maps — the stone treads, glazed tiles and red
 * plaster still carry real roughness and normals — but the *lighting* is
 * re-shaped into an animation-film language:
 *
 *  - **Banded diffuse.** Direct sunlight is quantised into a few steps, with
 *    softened edges so it reads as painted shading rather than posterisation.
 *    Hue is preserved (only luminance is quantised), so a red wall stays red.
 *  - **Rim light.** A fresnel term tinted by the sky, which is what separates a
 *    character or a tree from the background and is most of why a stylised
 *    scene reads as "lit by an artist".
 *  - **Foliage translucency.** Leaves facing away from the camera let the sun
 *    through. At a low sun the whole canopy glows at its edges; this is the
 *    single strongest golden-hour cue there is.
 *
 * All three are injected into stock MeshStandardMaterial, so nothing about the
 * material library, instancing or shadow pipeline has to change.
 */
export const STYLE = {
  /** Number of shading bands on direct light. Higher = subtler. */
  toonSteps: { value: 4.0 },
  /** How much of the banding to blend in (0 = plain PBR, 1 = full cel). */
  toonMix: { value: 0.72 },
  rimColor: { value: new THREE.Color("#cfe4ef") },
  /** Rim intensity; sunset pushes this up. */
  rimStrength: { value: 0.4 },
  /** Fresnel start — lower widens the rim band. */
  rimStart: { value: 0.55 },
  /** World-space direction to the sun. */
  sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4) },
  /** Colour of light transmitted through leaves. */
  transColor: { value: new THREE.Color("#9ccb63") },
  /** Foliage transmission strength; peaks at low sun. */
  transStrength: { value: 0.5 },
};

const TOON_HEAD = /* glsl */ `
  uniform float uToonSteps;
  uniform float uToonMix;
  uniform vec3 uRimColor;
  uniform float uRimStrength;
  uniform float uRimStart;
`;

/**
 * Quantise direct diffuse luminance into bands, then add a fresnel rim.
 *
 * Injected at `lights_fragment_end` (after all light contributions are
 * accumulated but before they are combined) and at the output chunk for the
 * rim, which must sit on top of everything including fog-free emissive.
 */
function toonPatch(foliage: boolean) {
  return (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uToonSteps = STYLE.toonSteps;
    shader.uniforms.uToonMix = STYLE.toonMix;
    shader.uniforms.uRimColor = STYLE.rimColor;
    shader.uniforms.uRimStrength = STYLE.rimStrength;
    shader.uniforms.uRimStart = STYLE.rimStart;
    if (foliage) {
      shader.uniforms.uSunDir = STYLE.sunDir;
      shader.uniforms.uTransColor = STYLE.transColor;
      shader.uniforms.uTransStrength = STYLE.transStrength;
    }

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>\n${TOON_HEAD}${
        foliage
          ? /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uTransColor;
      uniform float uTransStrength;
      `
          : ""
      }`,
    );

    // Band the accumulated direct diffuse.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <lights_fragment_end>",
      /* glsl */ `
      #include <lights_fragment_end>
      {
        vec3 lit = reflectedLight.directDiffuse;
        float l = max(max(lit.r, lit.g), lit.b);
        if (l > 0.0001) {
          // Quantise brightness, keep hue: scale the colour by the ratio of
          // its banded luminance to its real one.
          float scaled = l * uToonSteps;
          float lower = floor(scaled);
          // Soften each step edge so the bands read as painted, not aliased.
          float band = (lower + smoothstep(0.35, 0.65, scaled - lower)) / uToonSteps;
          // Banding may only darken. Rounding a lit surface *up* pushes large
          // areas (paving, terrain) straight to white and blows the frame out.
          band = min(band, l);
          reflectedLight.directDiffuse = mix(lit, lit * (band / l), uToonMix);
        }
      }
      `,
    );

    // Rim light (and, for foliage, back-lit transmission) on the final colour.
    const rim = /* glsl */ `
      {
        vec3 V = normalize(vViewPosition);
        float fres = 1.0 - clamp(dot(V, normal), 0.0, 1.0);
        float rim = smoothstep(uRimStart, 1.0, fres) * uRimStrength;
        // Rim is a silhouette cue for upright objects. Ground planes are seen
        // at grazing angles everywhere, so an unconstrained fresnel turns every
        // floor into a white sheet: fade the rim out as the surface faces up.
        vec3 worldNormal = normalize(mat3(viewMatrix[0].xyz, viewMatrix[1].xyz, viewMatrix[2].xyz) * normal);
        rim *= 1.0 - smoothstep(0.35, 0.85, abs(worldNormal.y));
        outgoingLight += uRimColor * rim;
        ${
          foliage
            ? /* glsl */ `
        // Light coming through the leaf: strongest when the sun is roughly
        // behind what we are looking at.
        vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        float through = pow(clamp(dot(-V, sunV), 0.0, 1.0), 3.0);
        outgoingLight += uTransColor * through * uTransStrength;
        `
            : ""
        }
      }
    `;
    // three renamed this chunk; support both spellings.
    if (shader.fragmentShader.includes("#include <opaque_fragment>")) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `${rim}\n#include <opaque_fragment>`,
      );
    } else {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <output_fragment>",
        `${rim}\n#include <output_fragment>`,
      );
    }
  };
}

/** Materials that must stay untouched: sky, water, grass, HUD sprites. */
function skip(material: THREE.Material): boolean {
  return (
    (material as THREE.Material & { isShaderMaterial?: boolean }).isShaderMaterial === true ||
    (material as THREE.Material & { isMeshBasicMaterial?: boolean }).isMeshBasicMaterial === true
  );
}

/** Apply the stylised lighting model to one material. */
export function applyToon(material: THREE.Material, foliage = false): THREE.Material {
  if (skip(material) || hasPatch(material, "toon") || hasPatch(material, "toon-foliage")) {
    return material;
  }
  return addPatch(material, foliage ? "toon-foliage" : "toon", toonPatch(foliage));
}
