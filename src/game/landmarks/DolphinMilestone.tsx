import { useMemo } from "react";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS, DOLPHIN_ISLAND_RADIUS } from "../world-data/axis.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { worldUvBox } from "../world/geometry";
import { useCampusSigns } from "../world/labels";
import { Dolphin } from "./sculpture";

/**
 * 海豚里程碑 — the roundabout that closes the north end of 宮燈大道.
 *
 * Two dolphins arcing out of a low plinth, the plinth carrying 張創辦人's
 * 立足淡江，放眼世界 on the side that faces back down the avenue. The kerbed
 * grass island under it is what makes it read as a traffic roundabout and not a
 * plaza sculpture.
 */
export function DolphinMilestone({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const signs = useCampusSigns();
  const ground = useMemo(() => sampleGroundElevation(0, AXIS.dolphinZ), []);
  const plinth = useMemo(() => worldUvBox(2.8, 1.1, 2.8, mats["kenan/old-wall"].spec.tile), [mats]);
  const bronze = surface(mats["campus/bronze"], { wetness });

  return (
    <group position={[0, ground, AXIS.dolphinZ]}>
      {/* Kerbed island. */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[DOLPHIN_ISLAND_RADIUS, DOLPHIN_ISLAND_RADIUS, 0.2, 40]} />
        <meshStandardMaterial {...surface(mats["campus/grass"], { wetness })} />
      </mesh>
      <mesh position={[0, 0.14, 0]} receiveShadow castShadow>
        <cylinderGeometry
          args={[DOLPHIN_ISLAND_RADIUS + 0.16, DOLPHIN_ISLAND_RADIUS + 0.16, 0.28, 40, 1, true]}
        />
        <meshStandardMaterial {...surface(mats["lantern/kerb"], { wetness })} />
      </mesh>

      <mesh geometry={plinth} position={[0, 0.75, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
      </mesh>
      {/* Dedication faces south, back down the avenue. */}
      <mesh position={[0, 0.86, 1.42]}>
        <planeGeometry args={[2.4, 0.44]} />
        <meshStandardMaterial map={signs.dolphin} roughness={0.6} />
      </mesh>

      <group position={[0, 1.3, 0]}>
        <group position={[-0.35, 0.9, 0.1]}>
          <Dolphin sign={-1} material={bronze} />
        </group>
        <group position={[0.5, 1.15, -0.25]} scale={0.82}>
          <Dolphin sign={1} material={bronze} />
        </group>
        {/* Wave base tying the two together. */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <sphereGeometry args={[1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2.6]} />
          <meshStandardMaterial {...bronze} />
        </mesh>
      </group>
    </group>
  );
}
