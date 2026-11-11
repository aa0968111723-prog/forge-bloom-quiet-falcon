import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "./store";
import { ENEMY_SPAWNS, type EnemySpawn } from "./world-data/encounters.ts";
import { sampleGroundElevation } from "./world-data/elevation.ts";

const COLOR = {
  exam: "#f3eee4",
  report: "#c45c4a",
  anomaly: "#7eb0c8",
} as const;

function Encounter({ spawn }: { spawn: EnemySpawn }) {
  const ref = useRef<THREE.Group>(null);
  const hp = useGame((s) => s.enemies[spawn.id] ?? 0);
  const y0 = sampleGroundElevation(spawn.x, spawn.z);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = y0 + 1.15 + Math.sin(t * 1.6 + spawn.x) * 0.12;
    ref.current.rotation.y = t * 0.7;
  });

  if (hp <= 0) return null;

  return (
    <group ref={ref} position={[spawn.x, y0 + 1.15, spawn.z]}>
      {spawn.kind === "anomaly" ? (
        <mesh>
          <icosahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial
            color={COLOR.anomaly}
            emissive="#5aa0c8"
            emissiveIntensity={0.85}
            roughness={0.3}
          />
        </mesh>
      ) : spawn.kind === "exam" ? (
        <mesh rotation={[0.3, 0.2, 0.1]}>
          <boxGeometry args={[0.7, 0.04, 0.95]} />
          <meshStandardMaterial color={COLOR.exam} roughness={0.55} />
        </mesh>
      ) : (
        <group>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.62, 0.08, 0.82]} />
            <meshStandardMaterial color={COLOR.report} roughness={0.6} />
          </mesh>
          <mesh position={[0.04, -0.02, 0.03]}>
            <boxGeometry args={[0.62, 0.08, 0.82]} />
            <meshStandardMaterial color="#e7e0d3" roughness={0.65} />
          </mesh>
        </group>
      )}
      <pointLight color={COLOR[spawn.kind]} intensity={2.2} distance={6} decay={2} />
    </group>
  );
}

export function Enemies() {
  return (
    <group>
      {ENEMY_SPAWNS.map((spawn) => (
        <Encounter key={spawn.id} spawn={spawn} />
      ))}
    </group>
  );
}
