import { useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { AXIS, SCROLL_PLAZA_SIZE } from "../world-data/axis.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { useCampusSigns } from "../world/labels";

/**
 * 書卷廣場 (1986, 林貴榮) — 蛋捲廣場.
 *
 * Four rolled bamboo-scroll blades, one per character of 樸實剛毅, arranged so
 * you can walk between them; from above the group reads like a motor rotor,
 * which is the other half of the design's story. Each blade is a partial
 * cylinder — a rolled sheet, open on one side — standing on a low pad, not a
 * closed drum, and the opening is what makes the silhouette recognisable.
 */
const BLADE_HEIGHT = 7.2;
const BLADE_RADIUS = 1.35;

export function ScrollPlaza({ wetness }: { wetness: number }) {
  const mats = useTamkangMaterials();
  const signs = useCampusSigns();
  const ground = useMemo(() => sampleGroundElevation(0, AXIS.scrollPlazaZ), []);

  const bladeGeo = useMemo(() => {
    // A rolled sheet, not a drum: thin shell curled through ~430° so the outer
    // edge wraps past itself the way the concrete scrolls do. Built as a
    // spiral extrusion to keep the visible edge thin.
    const shape = new THREE.Shape();
    // ~250° of curl: enough to read as a rolled sheet, open enough that the
    // inner face and the free edge stay visible — the closed look of a full
    // wrap is exactly what makes it read as a silo instead of a scroll.
    const turns = Math.PI * 1.4;
    const steps = 40;
    const thickness = 0.13;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns;
      const r = BLADE_RADIUS - (t / turns) * 0.45;
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    for (let i = steps; i >= 0; i--) {
      const t = (i / steps) * turns;
      const r = BLADE_RADIUS - (t / turns) * 0.45 - thickness;
      shape.lineTo(Math.cos(t) * r, Math.sin(t) * r);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: BLADE_HEIGHT, bevelEnabled: false, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const blades = useMemo(
    () =>
      (
        [
          [-4.6, 4.6, 0.9],
          [4.6, 4.6, 2.5],
          [4.6, -4.6, 4.1],
          [-4.6, -4.6, 5.7],
        ] as const
      ).map(([dx, dz, rot]) => ({ dx, dz, rot })),
    [],
  );

  // The scrolls are pale, near-white concrete shells.
  const concrete = surface(mats["lantern/kerb"], { wetness, tint: "#f6f2e8" });

  return (
    <group position={[0, ground, AXIS.scrollPlazaZ]}>
      {/* Radial centre pad the four scrolls stand on — 俯瞰像馬達轉軸. */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[9.6, 9.8, 0.24, 36]} />
        <meshStandardMaterial {...surface(mats["campus/plaza-tile"], { wetness, tint: "#cfc7b4" })} />
      </mesh>
      {blades.map(({ dx, dz, rot }) => (
        <group key={`${dx}-${dz}`} position={[dx, 0.24, dz]} rotation={[0, rot, 0]}>
          <mesh geometry={bladeGeo} castShadow receiveShadow>
            <meshStandardMaterial {...concrete} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* Motto plate set into the paving at the centre of the group. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
        <planeGeometry args={[4.4, 1.05]} />
        <meshStandardMaterial map={signs.scroll} roughness={0.7} />
      </mesh>

      {/* Low retaining edge where the plaza meets the meadow to the west. */}
      <mesh position={[-SCROLL_PLAZA_SIZE[0] / 2 - 0.2, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.55, SCROLL_PLAZA_SIZE[1]]} />
        <meshStandardMaterial {...surface(mats["lantern/kerb"], { wetness })} />
      </mesh>
    </group>
  );
}
