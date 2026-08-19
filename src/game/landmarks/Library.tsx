import { useMemo } from "react";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS } from "../world-data/axis.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { LIBRARY } from "../world-data/landmarks.ts";
import { quality } from "../quality";
import { worldUvBox } from "../world/geometry";
import { useCampusSigns } from "../world/labels";
import { ReadingGirl } from "./sculpture";

/**
 * 覺生紀念圖書館 — nine storeys, built along the hill.
 *
 * Recognition rests on three things rather than on detail: the horizontal
 * banding of nine continuous window bands, the mass stepping back as it climbs
 * (順山勢而建), and a deep recessed entrance under the second floor facing
 * 書卷廣場. 「閱讀的女孩」 sits on a bench in the forecourt.
 */
const FLOOR = LIBRARY.floorHeight;

export function Library({ wetness, lampsOn }: { wetness: number; lampsOn: boolean }) {
  const mats = useTamkangMaterials();
  const signs = useCampusSigns();
  const q = quality();
  const ground = useMemo(() => sampleGroundElevation(LIBRARY.center[0], LIBRARY.center[1]), []);

  const geos = useMemo(() => {
    const facadeTile = mats["library/facade"].spec.tile;
    return {
      // Three stacked masses, each set back from the one below.
      lower: worldUvBox(LIBRARY.width, FLOOR * 3, LIBRARY.length, facadeTile),
      middle: worldUvBox(LIBRARY.width - 8, FLOOR * 3, LIBRARY.length - 5, facadeTile),
      upper: worldUvBox(LIBRARY.width - 18, FLOOR * 3, LIBRARY.length - 9, facadeTile),
      base: worldUvBox(LIBRARY.width + 5, 1.1, LIBRARY.length + 5, mats["campus/plaza-tile"].spec.tile),
    };
  }, [mats]);

  const facade = surface(mats["library/facade"], { wetness });
  const glass = surface(mats["library/glass"], {
    wetness,
    emissive: lampsOn ? "#ffe6b4" : "#000000",
    emissiveIntensity: lampsOn ? 0.42 : 0,
  });

  /** Continuous glazing band wrapping one mass at one floor. */
  const band = (w: number, d: number, y: number, key: string) => (
    <group key={key} position={[0, y, 0]}>
      {(
        [
          [0, d / 2 + 0.06, 0, w],
          [0, -d / 2 - 0.06, Math.PI, w],
          [w / 2 + 0.06, 0, Math.PI / 2, d],
          [-w / 2 - 0.06, 0, -Math.PI / 2, d],
        ] as const
      ).map(([px, pz, rot, len], i) => (
        <mesh key={i} position={[px, 0, pz]} rotation={[0, rot, 0]}>
          <planeGeometry args={[len - 2.2, FLOOR * 0.56]} />
          <meshStandardMaterial {...glass} />
        </mesh>
      ))}
    </group>
  );

  return (
    <group position={[LIBRARY.center[0], ground, LIBRARY.center[1]]}>
      <mesh geometry={geos.base} position={[0, 0.55, 0]} receiveShadow castShadow>
        <meshStandardMaterial {...surface(mats["campus/plaza-tile"], { wetness })} />
      </mesh>

      <mesh geometry={geos.lower} position={[0, 1.1 + FLOOR * 1.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...facade} />
      </mesh>
      <mesh geometry={geos.middle} position={[0, 1.1 + FLOOR * 4.5, -1.5]} castShadow receiveShadow>
        <meshStandardMaterial {...facade} />
      </mesh>
      <mesh geometry={geos.upper} position={[0, 1.1 + FLOOR * 7.5, -3]} castShadow receiveShadow>
        <meshStandardMaterial {...facade} />
      </mesh>

      {/* Nine window bands, one per storey, following the setbacks. */}
      {Array.from({ length: LIBRARY.floors }).map((_, f) => {
        const y = 1.1 + f * FLOOR + FLOOR * 0.55;
        if (f < 3) return band(LIBRARY.width, LIBRARY.length, y, `b${f}`);
        if (f < 6) return band(LIBRARY.width - 8, LIBRARY.length - 5, y, `b${f}`);
        return band(LIBRARY.width - 18, LIBRARY.length - 9, y, `b${f}`);
      })}

      {/* Recessed entrance facing 書卷廣場, under a deep canopy. */}
      <group position={[-8, 0, LIBRARY.length / 2]}>
        <mesh position={[0, 1.1 + FLOOR * 0.9, -1.4]} receiveShadow>
          <boxGeometry args={[16, FLOOR * 1.8, 3]} />
          <meshStandardMaterial {...surface(mats["library/facade"], { wetness, tint: "#8f8b84" })} />
        </mesh>
        <mesh position={[0, 1.1 + FLOOR * 0.85, 0.6]}>
          <planeGeometry args={[14, FLOOR * 1.6]} />
          <meshStandardMaterial {...glass} />
        </mesh>
        <mesh position={[0, 1.1 + FLOOR * 1.85, 1.8]} castShadow>
          <boxGeometry args={[18, 0.5, 5]} />
          <meshStandardMaterial {...surface(mats["library/facade"], { wetness, tint: "#d6d2c8" })} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 8, 1.1 + FLOOR * 0.9, 3.4]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, FLOOR * 1.8, 12]} />
            <meshStandardMaterial {...surface(mats["library/facade"], { wetness, tint: "#e2ded4" })} />
          </mesh>
        ))}
      </group>

      {/* 館名 on the entrance wall. */}
      <mesh position={[6, 1.1 + FLOOR * 2.1, LIBRARY.length / 2 + 0.1]}>
        <planeGeometry args={[9, 1.6]} />
        <meshStandardMaterial map={signs.library} roughness={0.55} />
      </mesh>

      {q.tier === "high" && (
        <group position={[-2 - LIBRARY.center[0], 0, AXIS.libraryFrontZ + 6.4 - LIBRARY.center[1]]}>
          <ReadingGirl material={surface(mats["campus/bronze"], { wetness })} />
        </group>
      )}
    </group>
  );
}
