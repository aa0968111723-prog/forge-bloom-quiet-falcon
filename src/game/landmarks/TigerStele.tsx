import { useMemo, type JSX } from "react";
import { surface, useTamkangMaterials } from "../materials/context";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { TIGER_STELE } from "../world-data/landmarks.ts";
import { makeSignTexture, useFontTick } from "../world/labels";

type MaterialProps = JSX.IntrinsicElements["meshStandardMaterial"];

/** A low bronze crouch. The head points along local +Z. Estimated, not a portrait. */
function CrouchingTiger({ material }: { material: MaterialProps }) {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.5, 3, 8]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 0.4, 0.4]} castShadow>
        <sphereGeometry args={[0.14, 10, 8]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 0.32, -0.46]} rotation={[Math.PI / 2.5, 0, 0]} castShadow>
        <coneGeometry args={[0.07, 0.34, 6]} />
        <meshStandardMaterial {...material} />
      </mesh>
    </group>
  );
}

/**
 * 五虎碑: a stone tablet ringed by five crouching silhouettes.
 * The whole ring stands on one pad, north of 紹謨紀念體育館.
 */
export function TigerStele({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const fontTick = useFontTick();
  const plaque = useMemo(
    () => makeSignTexture("五虎崗傳奇", { fg: "#f3eee4", bg: "#3a2c1c", width: 640, height: 180 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild after fonts load
    [fontTick],
  );
  const y = sampleGroundElevation(TIGER_STELE.x, TIGER_STELE.z);
  const stone = surface(mats["kenan/old-wall"], { wetness });
  const bronze = surface(mats["campus/bronze"], { wetness });
  const radius = TIGER_STELE.pad / 2;

  return (
    <group position={[TIGER_STELE.x, y, TIGER_STELE.z]}>
      <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.36, 24]} />
        <meshStandardMaterial {...stone} />
      </mesh>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.86, 2.05, 0.28]} />
        <meshStandardMaterial {...stone} />
      </mesh>
      <mesh position={[0, 1.55, -0.18]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.72, 0.22]} />
        <meshStandardMaterial map={plaque} roughness={0.6} />
      </mesh>
      {Array.from({ length: 5 }, (_, i) => {
        const yaw = Math.PI + (i * 2 * Math.PI) / 5;
        return (
          <group
            key={i}
            position={[Math.sin(yaw) * 0.95, 0.36, Math.cos(yaw) * 0.95]}
            rotation={[0, yaw, 0]}
          >
            <CrouchingTiger material={bronze} />
          </group>
        );
      })}
    </group>
  );
}
