import { useMemo } from "react";
import { surface, useTamkangMaterials } from "../materials/context";
import { SHEPHERD } from "../world-data/landmarks.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { makeSignTexture, useFontTick } from "../world/labels";
import { BronzeFigure } from "./sculpture";

/**
 * 牧羊草坪上的「唱自己的歌」。
 *
 * A standing silhouette on a low stone pad, not a portrait. The pad is the
 * collider. The stamp stays on the grass to the south.
 */
export function ShepherdMeadow({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const fontTick = useFontTick();
  const plaque = useMemo(
    () => makeSignTexture("唱自己的歌", { fg: "#f3eee4", bg: "#3a2c1c", width: 640, height: 160 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild after fonts load
    [fontTick],
  );
  const y = sampleGroundElevation(SHEPHERD.x, SHEPHERD.z);
  const stone = surface(mats["kenan/old-wall"], { wetness });
  const bronze = surface(mats["campus/bronze"], { wetness });

  return (
    <group position={[SHEPHERD.x, y, SHEPHERD.z]}>
      <mesh position={[0, 0.21, 0]} castShadow receiveShadow>
        <boxGeometry args={[SHEPHERD.pad, 0.42, SHEPHERD.pad]} />
        <meshStandardMaterial {...stone} />
      </mesh>
      <group position={[0, 0.42, 0]}>
        <BronzeFigure scale={1.15} material={bronze} />
      </group>
      <mesh position={[0, 0.72, SHEPHERD.pad / 2 + 0.02]}>
        <planeGeometry args={[1.15, 0.28]} />
        <meshStandardMaterial map={plaque} roughness={0.6} />
      </mesh>
    </group>
  );
}
