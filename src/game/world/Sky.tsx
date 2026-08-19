import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";

/**
 * Stylised sky.
 *
 * A single shader dome replaces the flat-colour sphere: vertical gradient from
 * a warm horizon band up to the zenith, a soft glow around the sun's azimuth,
 * and a faint haze ring at the horizon. This is where most of the "open world"
 * reading comes from — the ground geometry is unchanged, but the world stops
 * looking like it is inside a box.
 *
 * Colours come from the active lighting preset, lerped smoothly when the
 * preset changes so the day/sunset switch feels like weather, not a page load.
 */
const SKY_TINTS: Record<TimeOfDay, { zenith: string; horizon: string; glow: string; glowStrength: number }> = {
  day: { zenith: "#4f8fc4", horizon: "#cfe3e8", glow: "#fff2cf", glowStrength: 0.5 },
  cloudy: { zenith: "#95a3ad", horizon: "#cdd4d8", glow: "#dfe4e8", glowStrength: 0.18 },
  sunset: { zenith: "#5a6b96", horizon: "#ffb168", glow: "#ffd9a0", glowStrength: 1.0 },
  night: { zenith: "#060b16", horizon: "#16223a", glow: "#8ea4c4", glowStrength: 0.22 },
  wet: { zenith: "#7e8b94", horizon: "#c2cacd", glow: "#d8dde0", glowStrength: 0.15 },
};

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    // Strip the view translation so the dome is pinned to the camera, and
    // write depth = far so everything in the world draws over it.
    mat4 viewNoTranslate = mat4(mat3(viewMatrix));
    vec4 clip = projectionMatrix * viewNoTranslate * vec4(position, 1.0);
    gl_Position = clip.xyww;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform vec3 uSunDir;
  uniform float uGlowStrength;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, -0.08, 1.0);
    // Horizon band is widest near h=0 and compresses upward.
    float t = pow(1.0 - clamp(h, 0.0, 1.0), 2.2);
    vec3 col = mix(uZenith, uHorizon, t);
    // Sun glow: tight forward lobe plus a broad ambient halo.
    float sunDot = clamp(dot(dir, normalize(uSunDir)), 0.0, 1.0);
    float glow = pow(sunDot, 18.0) * 0.85 + pow(sunDot, 3.5) * 0.35;
    col = mix(col, uGlow, clamp(glow * uGlowStrength, 0.0, 1.0));
    // Faint haze right at the horizon line.
    float haze = smoothstep(0.05, 0.0, abs(dir.y)) * 0.25;
    col = mix(col, uHorizon, haze);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Sky({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const target = useMemo(() => {
    const preset = TIME_PRESETS[timeOfDay];
    const tints = SKY_TINTS[timeOfDay];
    return {
      zenith: new THREE.Color(tints.zenith),
      horizon: new THREE.Color(tints.horizon),
      glow: new THREE.Color(tints.glow),
      sunDir: new THREE.Vector3(...preset.sunPos).normalize(),
      glowStrength: tints.glowStrength,
    };
  }, [timeOfDay]);

  const uniforms = useMemo(
    () => ({
      uZenith: { value: target.zenith.clone() },
      uHorizon: { value: target.horizon.clone() },
      uGlow: { value: target.glow.clone() },
      uSunDir: { value: target.sunDir.clone() },
      uGlowStrength: { value: target.glowStrength },
    }),
    // Initialised once; per-frame lerp below carries preset changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((_, delta) => {
    const u = uniforms;
    const k = 1 - Math.exp(-2.4 * delta);
    (u.uZenith.value as THREE.Color).lerp(target.zenith, k);
    (u.uHorizon.value as THREE.Color).lerp(target.horizon, k);
    (u.uGlow.value as THREE.Color).lerp(target.glow, k);
    (u.uSunDir.value as THREE.Vector3).lerp(target.sunDir, k).normalize();
    u.uGlowStrength.value += (target.glowStrength - u.uGlowStrength.value) * k;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1, 32, 20]} />
      <shaderMaterial
        ref={material}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Stylised clouds: a handful of flat, layered puff clusters drifting slowly.
 * Instanced, unlit-looking (emissive-ish basic material), cheap.
 */
const dummy = new THREE.Object3D();

export function Clouds({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const q = quality();
  const drift = useRef(0);

  const puffs = useMemo(() => {
    const out: { x: number; y: number; z: number; s: number; squash: number }[] = [];
    const clusters = timeOfDay === "cloudy" || timeOfDay === "wet" ? 14 : 8;
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let c = 0; c < clusters; c++) {
      const cx = (rand() - 0.5) * 1600;
      const cz = (rand() - 0.5) * 1600;
      const cy = 150 + rand() * 90;
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        out.push({
          x: cx + (rand() - 0.5) * 90,
          y: cy + (rand() - 0.5) * 14,
          z: cz + (rand() - 0.5) * 60,
          s: 26 + rand() * 34,
          squash: 0.28 + rand() * 0.12,
        });
      }
    }
    return out;
  }, [timeOfDay]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    puffs.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.s, p.s * p.squash, p.s * 0.8);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [puffs]);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    // One slow global drift: move the whole cloud field, wrap at the edge.
    drift.current = (drift.current + delta * 1.6) % 1600;
    mesh.position.x = drift.current > 800 ? drift.current - 1600 : drift.current;
    void state;
  });

  if (q.tier === "low" && timeOfDay !== "cloudy") return null;
  const cloudColor =
    timeOfDay === "sunset" ? "#ffd9b8" : timeOfDay === "night" ? "#2a3550" : "#ffffff";
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 7]} />
      <meshBasicMaterial color={cloudColor} transparent opacity={0.82} fog={false} />
    </instancedMesh>
  );
}
