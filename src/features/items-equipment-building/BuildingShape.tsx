import type { BuildKind } from "../../game/rpg/data";

/**
 * One silhouette per facility. The pad stays in BuildingModel so the ghost
 * tint strings remain there. Counts are listed in MESH_PARTS.
 */
export function BuildingShape({
  kind,
  color,
  ghost,
}: {
  kind: BuildKind;
  color: string;
  ghost: boolean;
}) {
  const mat = { color, transparent: ghost, opacity: ghost ? 0.52 : 1, roughness: 0.72 };
  if (kind === "desk") {
    return (
      <group>
        <mesh position={[0, 1, 0]} castShadow>
          <boxGeometry args={[2.6, 0.16, 1.6]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        {[-1, 1].map((x) => (
          <mesh key={x} position={[x, 0.55, 0]}>
            <boxGeometry args={[0.18, 0.9, 1.1]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        ))}
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[0.7, 0.2, 0.5]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#eee1bd"} />
        </mesh>
      </group>
    );
  }
  if (kind === "barrier") {
    return (
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[3, 1.6, 0.7]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    );
  }
  if (kind === "lantern") {
    return (
      <group>
        <mesh position={[0, 1.5, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 3, 8]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 3.1, 0]}>
          <boxGeometry args={[0.75, 0.7, 0.75]} />
          <meshStandardMaterial {...mat} emissive={color} emissiveIntensity={ghost ? 0.2 : 1.4} />
        </mesh>
        <mesh position={[0, 3.55, 0]}>
          <coneGeometry args={[0.7, 0.35, 4]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      </group>
    );
  }
  if (kind === "turret") {
    return (
      <group>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[0.6, 0.8, 1.7, 8]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 2.1, -0.25]}>
          <boxGeometry args={[0.5, 0.5, 1.6]} />
          <meshStandardMaterial {...mat} emissive={color} emissiveIntensity={ghost ? 0.15 : 0.4} />
        </mesh>
      </group>
    );
  }
  if (kind === "research") {
    return (
      <group>
        <mesh position={[0, 0.95, 0]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[2, 0.12, 1.15]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[0.28, 0.8, 0.9]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[-0.45, 1.22, 0.05]}>
          <boxGeometry args={[0.42, 0.28, 0.34]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#f4efe2"} />
        </mesh>
        <mesh position={[0.5, 1.28, -0.05]}>
          <sphereGeometry args={[0.12, 10, 8]} />
          <meshStandardMaterial {...mat} emissive={color} emissiveIntensity={ghost ? 0.1 : 0.35} />
        </mesh>
      </group>
    );
  }
  if (kind === "supply") {
    return (
      <group>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.15, 0.8, 0.9]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 1.15, 0]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[1.7, 0.08, 1.15]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#efe6cf"} />
        </mesh>
        <mesh position={[0, 0.7, 0.48]}>
          <boxGeometry args={[0.55, 0.12, 0.08]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#f4f7f2"} />
        </mesh>
      </group>
    );
  }
  if (kind === "board") {
    return (
      <group>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 1.4, 6]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 1.55, 0]} castShadow>
          <boxGeometry args={[2.2, 1.15, 0.08]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#f7f1e1"} />
        </mesh>
        <mesh position={[0.35, 1.7, 0.06]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#355c50"} />
        </mesh>
      </group>
    );
  }
  if (kind === "rest") {
    return (
      <group>
        <mesh position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.7, 0.16, 0.55]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 0.85, 0.28]}>
          <boxGeometry args={[1.7, 0.7, 0.12]} />
          <meshStandardMaterial {...mat} />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <boxGeometry args={[1.35, 0.08, 0.4]} />
          <meshStandardMaterial {...mat} color={ghost ? color : "#efe6cf"} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      {[-0.28, 0, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.7, x === 0 ? 0.22 : -0.08]} rotation={[0.35, 0, x * 0.4]}>
          <cylinderGeometry args={[0.04, 0.06, 1.3, 5]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ))}
      <mesh position={[0, 1.45, 0]}>
        <octahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial {...mat} emissive={color} emissiveIntensity={ghost ? 0.2 : 0.85} />
      </mesh>
    </group>
  );
}
