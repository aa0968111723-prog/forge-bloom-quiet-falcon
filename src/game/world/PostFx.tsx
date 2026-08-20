import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { postFxEnabled } from "../quality";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";

/**
 * Restrained post-processing.
 *
 * Two effects only, and both are gated hard:
 *  - **Threshold bloom** high enough that it catches lantern glass, lit
 *    windows and the sun disc, and nothing else. The brief was explicit that
 *    over-blooming is worse than no bloom, so day sits near zero and only
 *    夜訪 / 夕照 (where practical lights actually dominate) get a visible lift.
 *  - **Vignette + a whisper of warm grade**, which quiets the frame edges so
 *    the eye goes down the avenue instead of to the corners.
 *
 * Disabled entirely on the low tier: a full-screen composer chain is the most
 * expensive thing we could hand a phone, and the scene is designed to look
 * correct without it.
 *
 * Tone mapping moves onto OutputPass here, because the composer renders to a
 * linear target — leaving it on the renderer would tone-map twice.
 */
const VIGNETTE = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uAmount: { value: 0.42 },
    uWarm: { value: new THREE.Color("#ffe6c4") },
    uWarmth: { value: 0.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform vec3 uWarm;
    uniform float uWarmth;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      // Radial falloff from the centre, eased so it never shows a hard ring.
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uAmount * 2.2;
      v = clamp(v, 0.0, 1.0);
      vec3 col = texel.rgb * mix(1.0, v, 0.85);
      // A trace of warmth in the highlights, well short of a filter look.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, col * uWarm, uWarmth * lum);
      gl_FragColor = vec4(col, texel.a);
    }
  `,
};

/** Bloom strength per weather. Day is deliberately almost nothing. */
const BLOOM: Record<TimeOfDay, { strength: number; threshold: number; radius: number }> = {
  day: { strength: 0.12, threshold: 0.95, radius: 0.3 },
  cloudy: { strength: 0.06, threshold: 0.98, radius: 0.25 },
  sunset: { strength: 0.3, threshold: 0.82, radius: 0.42 },
  night: { strength: 0.42, threshold: 0.62, radius: 0.5 },
  wet: { strength: 0.16, threshold: 0.9, radius: 0.35 },
};

/**
 * Gate component.
 *
 * This split is load-bearing, not stylistic: a `useFrame` with a render
 * priority takes over R3F's render loop for the whole canvas. If the effect
 * component mounted and then bailed out of its own callback, nothing would
 * draw at all — a black screen on exactly the low-tier devices that skip post.
 * So the hook must not exist unless it is going to render.
 */
export function PostFx({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  if (!postFxEnabled()) return null;
  return <PostFxComposer timeOfDay={timeOfDay} />;
}

function PostFxComposer({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const { gl, scene, camera, size } = useThree();
  const preset = TIME_PRESETS[timeOfDay];

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      BLOOM.day.strength,
      BLOOM.day.radius,
      BLOOM.day.threshold,
    );
    c.addPass(bloom);
    const vignette = new ShaderPass(VIGNETTE);
    c.addPass(vignette);
    const output = new OutputPass();
    c.addPass(output);
    return c;
  }, [gl, scene, camera, size.width, size.height]);

  useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());
  }, [composer, size.width, size.height, gl]);

  useEffect(() => {
    // The composer's OutputPass owns tone mapping; the renderer must not also
    // apply it or the image is mapped twice and goes flat.
    gl.toneMapping = THREE.NoToneMapping;
    return () => {
      gl.toneMapping = THREE.ACESFilmicToneMapping;
    };
  }, [gl]);

  useEffect(() => () => composer.dispose(), [composer]);

  useFrame((_, delta) => {
    const target = BLOOM[timeOfDay];
    for (const pass of composer.passes) {
      const bloom = pass as UnrealBloomPass;
      if (bloom instanceof UnrealBloomPass) {
        const k = 1 - Math.exp(-2 * delta);
        bloom.strength += (target.strength - bloom.strength) * k;
        bloom.threshold += (target.threshold - bloom.threshold) * k;
        bloom.radius += (target.radius - bloom.radius) * k;
      }
    }
    // Exposure still comes from the preset; apply it before the composer runs.
    gl.toneMappingExposure = preset.exposure;
    composer.render(delta);
  }, 1);

  return null;
}
