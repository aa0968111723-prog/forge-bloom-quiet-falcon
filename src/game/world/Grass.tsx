import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { quality } from "../quality";
import { useGame } from "../store";
import { AXIS, corridorHalfWidth } from "../world-data/axis.ts";
import { COLLIDERS } from "../world-data/colliders.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { hash2 } from "../world-data/math.ts";
import { pavedAt } from "../world-data/paths.ts";
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";
import { WIND } from "./wind";

/**
 * Interactive grass.
 *
 * Instanced tapered blades over the lawns beside the pilgrimage route, in
 * z-chunks so frustum culling works along the 400 m corridor. The shader does
 * three things: a root-to-tip colour ramp lit against the sun direction, the
 * shared global wind sway, and a bend away from the player's feet that eases
 * back as they pass — the walk across 書卷廣場's lawn should leave a wake.
 *
 * Placement is deterministic hash sampling: never on paving, never inside a
 * building, only within `NEAR` of the corridor where the player can actually
 * see individual blades. Density and chunk count come from the quality tier.
 */
const CHUNK = 60;
const NEAR = 34;

const VERT = /* glsl */ `
  uniform float uWindTime;
  uniform float uWindStrength;
  uniform vec3 uPlayer;
  varying float vTip;
  varying vec3 vWorld;

  void main() {
    vTip = position.y;
    vec4 world = instanceMatrix * vec4(position, 1.0);
    // The instance matrix already carries yaw + scale; world.xz is the root.
    vec2 root = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
    float phase = dot(root, vec2(0.31, 0.27));
    float h = position.y * position.y; // bend grows quadratically to the tip

    // Wind: coherent gusts with a small chaotic ripple.
    float sway = sin(uWindTime * 1.9 + phase) + 0.6 * sin(uWindTime * 3.7 + phase * 2.3);
    world.x += sway * 0.09 * uWindStrength * h;
    world.z += sway * 0.05 * uWindStrength * h;

    // Player bend: push blades radially away, strongest at the tip.
    vec2 away = world.xz - uPlayer.xz;
    float d = length(away);
    float press = smoothstep(1.35, 0.15, d);
    if (press > 0.0 && d > 0.001) {
      world.xz += normalize(away) * press * 0.42 * h;
      world.y -= press * 0.12 * h;
    }

    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTipColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uCamPos;
  varying float vTip;
  varying vec3 vWorld;

  void main() {
    vec3 col = mix(uBase, uTipColor, vTip);
    float dist = length(uCamPos - vWorld);
    float fogF = smoothstep(uFogNear, uFogFar, dist);
    gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
  }
`;

/** Tapered blade: 4 verts, 2 tris, y in 0..1 (scaled per instance). */
function bladeGeometry() {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -0.03, 0, 0, 0.03, 0, 0, -0.007, 1, 0, 0.007, 1, 0,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 2, 1, 3]);
  return geo;
}

type Chunk = { key: string; center: THREE.Vector3; matrices: THREE.Matrix4[] };

function buildChunks(density: number): Chunk[] {
  const chunks = new Map<string, Chunk>();
  const step = 0.44 / Math.sqrt(density);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const zMin = AXIS.northLimitZ + 10;
  const zMax = AXIS.gateZ + 18;
  for (let z = zMin; z < zMax; z += step) {
    const hw = corridorHalfWidth(z);
    for (let x = -hw - NEAR; x < hw + NEAR; x += step) {
      // Grass grows on the open ground beside the corridor and on its grassy
      // shoulders, never through paving or buildings; the steep 克難坡 banks
      // keep it too (they read as planted slopes).
      const jx = x + (hash2(x, z, 5) - 0.5) * step;
      const jz = z + (hash2(x, z, 9) - 0.5) * step;
      if (pavedAt(jx, jz, 0.35)) continue;
      if (Math.abs(jx) < 4.6 && jz > AXIS.slopeTopZ - 1 && jz < AXIS.gateZ) continue; // stair treads + walls
      if (COLLIDERS.some((b) => jx > b.minX - 0.4 && jx < b.maxX + 0.4 && jz > b.minZ - 0.4 && jz < b.maxZ + 0.4)) continue;
      if (hash2(x, z, 13) > 0.9) continue;
      const y = sampleGroundElevation(jx, jz);
      const scale = 0.15 + hash2(x, z, 17) * 0.18;
      q.setFromAxisAngle(up, hash2(x, z, 21) * Math.PI);
      m.compose(new THREE.Vector3(jx, y, jz), q, new THREE.Vector3(1, scale, 1));
      const key = `${Math.floor(jx / CHUNK)}:${Math.floor(jz / CHUNK)}`;
      let chunk = chunks.get(key);
      if (!chunk) {
        chunk = { key, center: new THREE.Vector3(), matrices: [] };
        chunks.set(key, chunk);
      }
      chunk.matrices.push(m.clone());
    }
  }
  for (const chunk of chunks.values()) {
    for (const mat of chunk.matrices) {
      chunk.center.add(new THREE.Vector3().setFromMatrixPosition(mat));
    }
    chunk.center.divideScalar(chunk.matrices.length);
  }
  return [...chunks.values()];
}

function GrassChunk({
  chunk,
  geometry,
  uniforms,
}: {
  chunk: Chunk;
  geometry: THREE.BufferGeometry;
  uniforms: Record<string, THREE.IUniform>;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        side: THREE.DoubleSide,
      }),
    [uniforms],
  );
  return (
    <instancedMesh
      ref={(mesh) => {
        if (!mesh || mesh.userData.filled) return;
        mesh.userData.filled = true;
        chunk.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }}
      args={[geometry, material, chunk.matrices.length]}
      frustumCulled
    />
  );
}

export function Grass({ timeOfDay }: { timeOfDay: TimeOfDay }) {
  const q = quality();
  const preset = TIME_PRESETS[timeOfDay];
  const geometry = useMemo(() => bladeGeometry(), []);
  const chunks = useMemo(
    () => buildChunks(q.tier === "high" ? 1 : 0.28),
    [q.tier],
  );

  const uniforms = useMemo(
    () => ({
      uWindTime: WIND.time,
      uWindStrength: WIND.strength,
      uPlayer: { value: new THREE.Vector3() },
      uBase: { value: new THREE.Color("#46672f") },
      uTipColor: { value: new THREE.Color("#94b558") },
      uFogColor: { value: new THREE.Color(preset.fog) },
      uFogNear: { value: preset.fogNear },
      uFogFar: { value: preset.fogFar },
      uCamPos: { value: new THREE.Vector3() },
    }),
    // Single uniform set shared by all chunks; preset changes lerp below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const tipTargets: Record<TimeOfDay, [string, string]> = useMemo(
    () => ({
      day: ["#46672f", "#94b558"],
      cloudy: ["#3f5a30", "#7a944e"],
      sunset: ["#4a5528", "#a08a48"],
      night: ["#18231a", "#2e4029"],
      wet: ["#3a5630", "#6c8a49"],
    }),
    [],
  );

  useFrame((state, delta) => {
    const s = useGame.getState();
    uniforms.uPlayer.value.set(s.playerX, 0, s.playerZ);
    uniforms.uCamPos.value.copy(state.camera.position);
    const k = 1 - Math.exp(-2.0 * delta);
    const [base, tip] = tipTargets[timeOfDay];
    (uniforms.uBase.value as THREE.Color).lerp(new THREE.Color(base), k);
    (uniforms.uTipColor.value as THREE.Color).lerp(new THREE.Color(tip), k);
    (uniforms.uFogColor.value as THREE.Color).lerp(new THREE.Color(preset.fog), k);
    uniforms.uFogNear.value += (preset.fogNear - uniforms.uFogNear.value) * k;
    uniforms.uFogFar.value += (preset.fogFar - uniforms.uFogFar.value) * k;
  });

  return (
    <group>
      {chunks.map((chunk) => (
        <GrassChunk key={chunk.key} chunk={chunk} geometry={geometry} uniforms={uniforms} />
      ))}
    </group>
  );
}
