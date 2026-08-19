import type * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS } from "../world-data/axis.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { KENAN, KENAN_LANDING_Z } from "../world-data/kenan.ts";
import { useCampusSigns } from "./labels";

/**
 * Named signage along the corridor: the 克難坡 name posts at the bottom and the
 * landing, the 宮燈大道 marker, the campus gate arch at the 水源街 entrance and
 * a wayfinding board at 書卷廣場. Physical sign posts come from the props pass;
 * these are the ones that carry real text.
 */
function SignBoard({
  map,
  position,
  rotationY = 0,
  size = [1.2, 0.44],
  postHeight = 1.5,
}: {
  map: THREE.Texture;
  position: [number, number, number];
  rotationY?: number;
  size?: [number, number];
  postHeight?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, postHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.14, postHeight, 0.14]} />
        <meshStandardMaterial color="#6d5f4c" roughness={0.75} />
      </mesh>
      <mesh position={[0, postHeight + size[1] / 2 - 0.04, 0]}>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.06]} />
        <meshStandardMaterial color="#4a3f30" roughness={0.7} />
      </mesh>
      <mesh position={[0, postHeight + size[1] / 2 - 0.04, 0.035]}>
        <planeGeometry args={size} />
        <meshStandardMaterial map={map} roughness={0.55} />
      </mesh>
    </group>
  );
}

export function Signage({ wetness }: { wetness: number }) {
  const signs = useCampusSigns();
  const mats = useTamkangMaterials();
  const gateY = sampleGroundElevation(0, AXIS.gateZ + 6);

  return (
    <group>
      {/* 校門: gate arch over the entrance walk off 水源街. */}
      <group position={[0, gateY, AXIS.gateZ + 6]}>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 4.6, 2.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.0, 5.2, 1.0]} />
            <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
          </mesh>
        ))}
        <mesh position={[0, 5.5, 0]} castShadow>
          <boxGeometry args={[10.6, 1.0, 1.2]} />
          <meshStandardMaterial {...surface(mats["kenan/retaining-wall"], { wetness })} />
        </mesh>
        <mesh position={[0, 5.5, 0.62]}>
          <planeGeometry args={[4.8, 0.72]} />
          <meshStandardMaterial map={signs.gate} roughness={0.5} />
        </mesh>
      </group>

      {/* 克難坡 name posts: bottom entrance pair + landing marker. */}
      <SignBoard
        map={signs.kenan}
        position={[-5.2, sampleGroundElevation(-5.2, KENAN.bottomZ + 3), KENAN.bottomZ + 3]}
        rotationY={Math.PI / 8}
        size={[1.05, 0.42]}
      />
      <SignBoard
        map={signs.kenanSteps}
        position={[5.2, sampleGroundElevation(5.2, KENAN.bottomZ + 4), KENAN.bottomZ + 4]}
        rotationY={-Math.PI / 8}
        size={[1.35, 0.4]}
      />
      <SignBoard
        map={signs.kenan}
        position={[-5.4, sampleGroundElevation(-5.4, KENAN_LANDING_Z[0] - 3), KENAN_LANDING_Z[0] - 3]}
        rotationY={Math.PI / 2.4}
        size={[0.95, 0.38]}
        postHeight={1.2}
      />

      {/* 宮燈大道 marker at the avenue's south end. */}
      <SignBoard
        map={signs.avenue}
        position={[-4.4, sampleGroundElevation(-4.4, AXIS.avenueSouthZ - 3), AXIS.avenueSouthZ - 3]}
        rotationY={Math.PI / 6}
        size={[1.3, 0.42]}
      />

      {/* Wayfinding to the library at the north end of the avenue. */}
      <SignBoard
        map={signs.wayfinding}
        position={[5.0, sampleGroundElevation(5.0, AXIS.avenueNorthZ - 4), AXIS.avenueNorthZ - 4]}
        rotationY={-Math.PI / 7}
        size={[1.15, 0.42]}
        postHeight={1.9}
      />
    </group>
  );
}
