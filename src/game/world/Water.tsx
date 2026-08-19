import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RIVER_LEVEL } from "../world-data/elevation.ts";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";
import { WORLD_BOUNDS } from "../world-data/origin.ts";

/**
 * The Tamsui River as a living surface: two layers of scrolling procedural
 * waves, fresnel toward the sky colour, and a specular streak under the sun —
 * the golden path across the water that makes the sunset view from 宮燈大道
 * read like the postcard. One quad, one cheap shader, no reflections.
 */
const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSkyTint;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uCamPos;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  varying vec3 vWorld;

  // Cheap value noise.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    // Two scales of drifting ripple distort the normal slightly.
    float n1 = noise(vWorld.xz * 0.045 + vec2(uTime * 0.05, uTime * 0.02));
    float n2 = noise(vWorld.xz * 0.18 - vec2(uTime * 0.09, uTime * 0.04));
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.24 + (n2 - 0.5) * 0.1, 1.0, (n2 - 0.5) * 0.24));

    vec3 view = normalize(uCamPos - vWorld);
    float fresnel = pow(1.0 - max(dot(view, normal), 0.0), 2.4);
    vec3 col = mix(uDeep, uSkyTint, clamp(0.22 + fresnel * 0.7, 0.0, 1.0));

    // Sun streak: reflect the view ray and glint toward the sun.
    vec3 r = reflect(-view, normal);
    float spec = pow(max(dot(r, normalize(uSunDir)), 0.0), 90.0);
    col += uSunColor * spec * 1.4;
    // Wave sparkle.
    col += uSunColor * smoothstep(0.72, 0.98, n2) * 0.06;

    float dist = length(uCamPos - vWorld);
    float fogF = smoothstep(uFogNear, uFogFar, dist);
    gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
  }
`;

export function Water({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const preset = TIME_PRESETS[timeOfDay];

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#28495c") },
      uSkyTint: { value: new THREE.Color("#87bede") },
      uSunColor: { value: new THREE.Color("#fff2cf") },
      uSunDir: { value: new THREE.Vector3(-1, 0.3, 0.2) },
      uCamPos: { value: new THREE.Vector3() },
      uFogColor: { value: new THREE.Color("#c9d6d8") },
      uFogNear: { value: 200 },
      uFogFar: { value: 700 },
    }),
    [],
  );

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uCamPos.value.copy(state.camera.position);
    const k = 1 - Math.exp(-2.2 * delta);
    (uniforms.uSkyTint.value as THREE.Color).lerp(new THREE.Color(preset.sky), k);
    (uniforms.uSunColor.value as THREE.Color).lerp(new THREE.Color(preset.sun), k);
    (uniforms.uSunDir.value as THREE.Vector3).lerp(new THREE.Vector3(...preset.sunPos).normalize(), k);
    (uniforms.uFogColor.value as THREE.Color).lerp(new THREE.Color(preset.fog), k);
    uniforms.uFogNear.value += (preset.fogNear - uniforms.uFogNear.value) * k;
    uniforms.uFogFar.value += (preset.fogFar - uniforms.uFogFar.value) * k;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[-250, RIVER_LEVEL, -120]}
    >
      <planeGeometry args={[260, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ + 340]} />
      <shaderMaterial ref={material} vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} />
    </mesh>
  );
}
