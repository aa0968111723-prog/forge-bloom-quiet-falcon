import { LANDMARKS } from "../world-data/landmarks.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";

/** Pilgrimage stamp rings at each landmark's interact point. */
export function StampRings() {
  return (
    <group>
      {LANDMARKS.map((l) => {
        const y = sampleGroundElevation(l.interact.x, l.interact.z);
        return (
          <mesh
            key={l.id}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[l.interact.x, y + 0.09, l.interact.z]}
          >
            <ringGeometry args={[0.7, 0.92, 24]} />
            <meshStandardMaterial color="#1a3f6d" roughness={0.45} metalness={0.12} />
          </mesh>
        );
      })}
    </group>
  );
}
