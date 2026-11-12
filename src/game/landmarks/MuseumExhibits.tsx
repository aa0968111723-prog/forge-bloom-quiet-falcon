import { sampleGroundElevation } from "../world-data/elevation.ts";
import { HULL_YAW, MUSEUM_EXHIBITS, type MuseumExhibit } from "../world-data/exhibits.ts";

type Paint = { color: string; roughness: number; metalness: number };

/**
 * Estimated fighter and helicopter silhouettes on the north side of the hull.
 * Rotors stay still. Nothing here is a measured airframe.
 */
function Jet({ material }: { material: Paint }) {
  return (
    <group>
      <mesh position={[0, 1.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[8.2, 1.05, 1.05]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[4.6, 1.1, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.46, 1.4, 10]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0.2, 1.28, 0]} castShadow>
        <boxGeometry args={[2.1, 0.12, 7.2]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[-3.7, 1.75, 0]} castShadow>
        <boxGeometry args={[0.12, 1.2, 0.72]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[1.2, 1.55, 0]} castShadow>
        <boxGeometry args={[1.05, 0.32, 0.52]} />
        <meshStandardMaterial color="#1c3a4a" roughness={0.28} metalness={0.15} />
      </mesh>
    </group>
  );
}

function Helicopter({ material }: { material: Paint }) {
  return (
    <group>
      <mesh position={[0.7, 1.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.5, 1.2, 1.3]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[-1.6, 1.15, 0]} castShadow>
        <boxGeometry args={[3.2, 0.26, 0.26]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0.6, 2.1, 0]} castShadow>
        <cylinderGeometry args={[3.05, 3.05, 0.06, 16]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[-3.15, 1.35, 0]} castShadow>
        <boxGeometry args={[0.08, 0.7, 0.7]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {[-0.42, 0.42].map((z) => (
        <mesh key={z} position={[0.6, 0.28, z]} castShadow>
          <boxGeometry args={[2.1, 0.08, 0.08]} />
          <meshStandardMaterial {...material} />
        </mesh>
      ))}
    </group>
  );
}

function Exhibit({ item, metal, olive }: { item: MuseumExhibit; metal: Paint; olive: Paint }) {
  const y = sampleGroundElevation(item.x, item.z);
  return (
    <group position={[item.x, y, item.z]} rotation={[0, HULL_YAW, 0]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[item.length * 0.62, 0.16, item.span * 0.5]} />
        <meshStandardMaterial color="#8a8478" roughness={0.9} />
      </mesh>
      {item.kind === "jet" ? <Jet material={metal} /> : <Helicopter material={olive} />}
    </group>
  );
}

export function MuseumExhibits({ wetness }: { wetness: number }) {
  const metal = { color: "#d5dbe0", roughness: Math.max(0.28, 0.48 - wetness * 0.2), metalness: 0.42 };
  const olive = { color: "#5f6a58", roughness: Math.max(0.4, 0.72 - wetness * 0.2), metalness: 0.18 };
  return (
    <group>
      {MUSEUM_EXHIBITS.map((item) => (
        <Exhibit key={item.id} item={item} metal={metal} olive={olive} />
      ))}
    </group>
  );
}
