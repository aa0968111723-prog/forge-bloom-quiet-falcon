import type * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { CAMPUS_GATE, textSigns } from "../world-data/landmarks.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
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
  const gateY = sampleGroundElevation(0, CAMPUS_GATE.z);

  return (
    <group>
      {/* 校門: gate arch over the entrance walk off 水源街. */}
      <group position={[0, gateY, CAMPUS_GATE.z]}>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * CAMPUS_GATE.halfSpan, 2.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[CAMPUS_GATE.pier, 5.2, CAMPUS_GATE.pier]} />
            <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
          </mesh>
        ))}
        <mesh position={[0, 5.5, 0]} castShadow>
          <boxGeometry args={[CAMPUS_GATE.halfSpan * 2 + CAMPUS_GATE.pier + 0.4, 1.0, 1.2]} />
          <meshStandardMaterial {...surface(mats["kenan/retaining-wall"], { wetness })} />
        </mesh>
        <mesh position={[0, 5.5, 0.62]}>
          <planeGeometry args={[4.8, 0.72]} />
          <meshStandardMaterial map={signs.gate} roughness={0.5} />
        </mesh>
      </group>

      {textSigns().map((sign) => (
        <SignBoard
          key={sign.id}
          map={signs[sign.map]}
          position={[sign.x, sampleGroundElevation(sign.x, sign.z), sign.z]}
          rotationY={sign.rot}
          size={[sign.boardW, sign.boardH]}
          postHeight={sign.postHeight}
        />
      ))}
    </group>
  );
}
