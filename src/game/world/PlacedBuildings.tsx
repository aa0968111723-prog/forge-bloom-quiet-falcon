import { BUILD_CATALOG, type PlacedStructure } from "../building.ts";
import { useGame } from "../store";
import { sampleGroundElevation } from "../world-data/elevation.ts";

const COLOR: Record<PlacedStructure["kind"], string> = {
  booth: "#c45c4a",
  desk: "#7a5a3a",
  "lamp-post": "#3c4043",
  banner: "#1a3f6d",
};

function PlacedMesh({ s }: { s: PlacedStructure }) {
  const y = sampleGroundElevation(s.x, s.z);
  const h = BUILD_CATALOG[s.kind].height;
  if (s.kind === "lamp-post") {
    return (
      <group position={[s.x, y, s.z]}>
        <mesh position={[0, h / 2, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, h, 8]} />
          <meshStandardMaterial color={COLOR[s.kind]} roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, h, 0.2]}>
          <boxGeometry args={[0.32, 0.12, 0.5]} />
          <meshStandardMaterial color="#fff2c9" emissive="#ffe6b4" emissiveIntensity={0.6} />
        </mesh>
      </group>
    );
  }
  if (s.kind === "banner") {
    return (
      <group position={[s.x, y, s.z]}>
        <mesh position={[0, h / 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, h, 6]} />
          <meshStandardMaterial color="#6d5f4c" />
        </mesh>
        <mesh position={[0.35, h * 0.72, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.04]} />
          <meshStandardMaterial color={COLOR[s.kind]} roughness={0.65} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh position={[s.x, y + h / 2, s.z]} castShadow receiveShadow>
      <boxGeometry args={[s.width, h, s.depth]} />
      <meshStandardMaterial color={COLOR[s.kind]} roughness={0.7} />
    </mesh>
  );
}

export function PlacedBuildings() {
  const buildings = useGame((s) => s.buildings);
  return (
    <group>
      {buildings.map((s) => (
        <PlacedMesh key={s.id} s={s} />
      ))}
    </group>
  );
}
