import { useMemo } from "react";
import * as THREE from "three";
import { surface, useTamkangMaterials, type TamkangMaterialSet } from "../materials/context";
import { AVENUE_PAVED_WIDTH } from "../world-data/axis.ts";
import { sampleGroundElevation } from "../world-data/elevation.ts";
import { PALACE, palaceHallZs } from "../world-data/landmarks.ts";
import { quality } from "../quality";
import { hipRoofGeometry, worldUvBox } from "../world/geometry";
import { useCampusSigns } from "../world/labels";

/**
 * 宮燈教室 (1954) — 碧瓦紅牆, the first permanent buildings on the Tamsui campus.
 *
 * Five halls a side face each other across 宮燈大道. What has to be right for
 * these to read as 宮燈教室 rather than "a red building":
 *   - a green glazed hip roof with real overhang and a raised ridge
 *   - an arcaded colonnade standing in front of the wall, so the facade is a
 *     band of shadow with red above and below it
 *   - vermilion columns, timber lattice windows, a pale stone plinth
 *   - the building line set back 10.5 m from the avenue centreline
 *
 * The far LOD drops the colonnade and window detail but keeps the roof
 * silhouette, which is the part you actually recognise down the avenue.
 */
type HallProps = {
  position: [number, number, number];
  /**
   * Which row this hall stands in: +1 east row, -1 west row. The avenue —
   * and therefore the colonnade, windows and name plate — is on the row's
   * *opposite* side, i.e. at local -facing·X.
   */
  facing: -1 | 1;
  wetness: number;
  detailed: boolean;
  mats: TamkangMaterialSet;
  nameMap: THREE.Texture;
  lampsOn: boolean;
};

const WALL_H = PALACE.storeys * PALACE.storeyHeight;
/** The glazed roof is roughly half the elevation of the real halls. */
const ROOF_RISE = 3.4;
const EAVE_OVERHANG = 1.5;

function PalaceHall({ position, facing, wetness, detailed, mats, nameMap, lampsOn }: HallProps) {
  // Long axis runs along Z (parallel to the avenue); depth is across X.
  const width = PALACE.hallWidth;
  const depth = PALACE.hallDepth;

  const geos = useMemo(() => {
    const redTile = mats["palace/red-wall"].spec.tile;
    const roofTile = mats["palace/green-roof-tile"].spec.tile;
    return {
      wall: worldUvBox(depth, WALL_H, width, redTile),
      plinth: worldUvBox(depth + 0.7, 0.55, width + 0.7, mats["kenan/old-wall"].spec.tile),
      // 歇山-style hip roof with a real overhang and a slight eave kick.
      roof: hipRoofGeometry(depth, width, EAVE_OVERHANG, ROOF_RISE, roofTile),
      ridge: worldUvBox(0.55, 0.5, width - depth * 0.9 + 1.2, roofTile),
      column: new THREE.CylinderGeometry(0.17, 0.2, WALL_H + 0.1, 10),
    };
  }, [mats, depth, width]);

  const red = surface(mats["palace/red-wall"], { wetness });
  const roofMat = surface(mats["palace/green-roof-tile"], { wetness });
  const wood = surface(mats["palace/wood-column"], { wetness });
  const lattice = surface(mats["palace/lattice-window"], {
    wetness,
    emissive: lampsOn ? "#ffd8a0" : "#000000",
    emissiveIntensity: lampsOn ? 0.5 : 0,
  });

  // The avenue side of this hall.
  const front = -facing;
  const colonnadeX = front * (depth / 2 + 1.55);

  return (
    <group position={position}>
      <mesh geometry={geos.plinth} position={[0, 0.27, 0]} receiveShadow castShadow>
        <meshStandardMaterial {...surface(mats["kenan/old-wall"], { wetness })} />
      </mesh>
      <mesh geometry={geos.wall} position={[0, 0.55 + WALL_H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...red} />
      </mesh>

      {/* 白色簷口帶 under the eave, the way the real halls are trimmed. */}
      <mesh position={[0, 0.55 + WALL_H - 0.22, 0]} castShadow>
        <boxGeometry args={[depth + 0.24, 0.44, width + 0.24]} />
        <meshStandardMaterial color="#e8e2d2" roughness={0.7} />
      </mesh>
      {/* Eave fascia: closes the roof underside seen from the colonnade. */}
      <mesh position={[0, 0.55 + WALL_H + 0.16, 0]}>
        <boxGeometry args={[depth + EAVE_OVERHANG * 2 - 0.2, 0.3, width + EAVE_OVERHANG * 2 - 0.2]} />
        <meshStandardMaterial color="#3c6b50" roughness={0.6} />
      </mesh>
      {/* 碧瓦: hip roof + ridge. The roof is half the building's presence. */}
      <mesh geometry={geos.roof} position={[0, 0.55 + WALL_H, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...roofMat} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geos.ridge} position={[0, 0.55 + WALL_H + ROOF_RISE + 0.15, 0]} castShadow>
        <meshStandardMaterial {...roofMat} />
      </mesh>

      {/* Lattice windows along the avenue face, white-framed. */}
      {Array.from({ length: 7 }).map((_, bay) => (
        <group
          key={`w${bay}`}
          position={[front * (depth / 2 + 0.03), 0.55 + WALL_H * 0.55, -width / 2 + 2.2 + bay * ((width - 4.4) / 6)]}
          rotation={[0, front > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
        >
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[2.3, 2.15]} />
            <meshStandardMaterial color="#e8e2d2" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[2.05, 1.9]} />
            <meshStandardMaterial {...lattice} />
          </mesh>
        </group>
      ))}

      {detailed && (
        <group>
          {/* 迴廊: colonnade in front of the wall, with its own roof slab. */}
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh
              key={`c${i}`}
              geometry={geos.column}
              position={[colonnadeX, 0.55 + (WALL_H - 0.4) / 2, -width / 2 + 1.6 + i * ((width - 3.2) / 7)]}
              castShadow
            >
              <meshStandardMaterial {...wood} />
            </mesh>
          ))}
          <mesh
            position={[front * (depth / 2 + 0.85), 0.55 + WALL_H + 0.1, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[3.4, 0.34, width + 0.4]} />
            <meshStandardMaterial {...roofMat} />
          </mesh>
          {/* Colonnade floor, one step up off the avenue. */}
          <mesh position={[front * (depth / 2 + 0.85), 0.4, 0]} receiveShadow>
            <boxGeometry args={[3.6, 0.3, width + 0.4]} />
            <meshStandardMaterial {...surface(mats["campus/plaza-tile"], { wetness })} />
          </mesh>
          {/* 門牌 hung from the colonnade fascia over the centre bay. */}
          <mesh
            position={[front * (depth / 2 + 2.35), 0.55 + WALL_H - 0.45, 0]}
            rotation={[0, front > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
          >
            <planeGeometry args={[2.6, 0.62]} />
            <meshStandardMaterial map={nameMap} roughness={0.55} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function PalaceClassrooms({ wetness, lampsOn }: { wetness: number; lampsOn: boolean }) {
  const mats = useTamkangMaterials();
  const signs = useCampusSigns();
  const q = quality();
  const zs = useMemo(() => palaceHallZs(), []);

  return (
    <group>
      {zs.map((z, i) =>
        ([-1, 1] as const).map((facing) => (
          <PalaceHall
            key={`${facing}-${z}`}
            position={[facing * PALACE.offsetX, sampleGroundElevation(facing * PALACE.offsetX, z), z]}
            facing={facing}
            wetness={wetness}
            // The two nearest pairs to the plaza carry full detail; on mobile only
            // the first pair does, which is what you are standing next to.
            detailed={q.tier === "high" ? i < 4 : i < 1}
            mats={mats}
            nameMap={signs.palace}
            lampsOn={lampsOn}
          />
        )),
      )}
      {/* Kerb-height step from the avenue paving up to the colonnade floor. */}
      {zs.map((z) =>
        ([-1, 1] as const).map((facing) => (
          <mesh
            key={`step${facing}-${z}`}
            position={[
              facing * (AVENUE_PAVED_WIDTH / 2 + 3.2),
              sampleGroundElevation(facing * PALACE.offsetX, z) + 0.14,
              z,
            ]}
            receiveShadow
          >
            <boxGeometry args={[1.6, 0.28, PALACE.hallWidth + 0.4]} />
            <meshStandardMaterial {...surface(mats["lantern/kerb"], { wetness })} />
          </mesh>
        )),
      )}
    </group>
  );
}
