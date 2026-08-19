import { useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS, PLAZA_ELEVATION, PLAZA_RADIUS } from "../world-data/axis.ts";
import { makeSignTexture, useFontTick } from "../world/labels";
import { worldUvBox } from "../world/geometry";
import { BronzeBust } from "./sculpture";

/**
 * 驚聲銅像廣場 — the first thing you see when you finish the slope.
 *
 * The plaza reads as three things at once and all three have to be present or a
 * Tamkang student will not recognise it: a circular paved disc, tiered seating
 * around its southern arc like a Roman theatre, and the bronze of 張驚聲 on a
 * plinth inscribed 功在作人 facing back down the slope.
 */
export function ChingshengPlaza({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const fontTick = useFontTick();
  // 「功在作人」 runs vertically down the pedestal face, as on the real stone.
  const inscription = useMemo(
    () => makeSignTexture("功在作人", { fg: "#2c2418", bg: "#ddd6c6", border: "#b8ae98", width: 160, height: 620, vertical: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild after fonts load
    [fontTick],
  );

  // Tiered seating: concentric rings stepping up on the plaza's south side,
  // where the ground already rises out of the slope cut.
  const tiers = useMemo(() => {
    const out: { radius: number; y: number; height: number }[] = [];
    for (let i = 0; i < 4; i++) {
      out.push({
        radius: PLAZA_RADIUS + 1.1 + i * 1.5,
        y: PLAZA_ELEVATION + i * 0.4,
        height: 0.4,
      });
    }
    return out;
  }, []);

  const plinthGeo = useMemo(() => worldUvBox(1.9, 0.6, 1.9, mats["kenan/old-wall"].spec.tile), [mats]);
  const stone = surface(mats["kenan/old-wall"], { wetness });
  const tile = surface(mats["campus/plaza-tile"], { wetness });

  return (
    <group position={[0, PLAZA_ELEVATION, AXIS.plazaCenterZ]}>
      {/* Stepped seating, open towards the avenue on the north side. */}
      {tiers.map((t, i) => (
        <mesh key={i} position={[0, t.y - PLAZA_ELEVATION + t.height / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry
            args={[t.radius, t.radius, t.height, 56, 1, true, Math.PI * 0.28, Math.PI * 1.44]}
          />
          <meshStandardMaterial {...tile} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/*
        驚聲銅像: a bronze BUST on a tall tapered stone pedestal — the
        silhouette every freshman meets at the top of the slope. Base step,
        tapering shaft with the vertical 功在作人 inscription facing south,
        cap, then the bust.
      */}
      <mesh geometry={plinthGeo} position={[0, 0.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...stone} />
      </mesh>
      <mesh position={[0, 1.55, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.72, 1.9, 4]} />
        <meshStandardMaterial {...surface(mats["kenan/retaining-wall"], { wetness, tint: "#ded7c6" })} />
      </mesh>
      <mesh position={[0, 2.62, 0]} castShadow>
        <boxGeometry args={[1.3, 0.24, 1.3]} />
        <meshStandardMaterial {...stone} />
      </mesh>
      {/* Vertical inscription on the south face. */}
      <mesh position={[0, 1.55, 0.755]} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.42, 1.62]} />
        <meshStandardMaterial map={inscription} roughness={0.65} />
      </mesh>
      <group position={[0, 2.74, 0]} rotation={[0, Math.PI, 0]}>
        <BronzeBust scale={1.1} material={surface(mats["campus/bronze"], { wetness })} />
      </group>

      {/* Flagpole on the plaza rim, as at the head of the slope. */}
      <group position={[-PLAZA_RADIUS + 2.4, 0, -3.5]}>
        <mesh position={[0, 0.28, 0]} receiveShadow>
          <cylinderGeometry args={[0.8, 0.95, 0.56, 12]} />
          <meshStandardMaterial {...stone} />
        </mesh>
        <mesh position={[0, 5.2, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 10, 8]} />
          <meshStandardMaterial color="#e4e0d6" roughness={0.4} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}
