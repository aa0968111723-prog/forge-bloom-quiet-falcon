import { useMemo } from "react";
import { surface, useTamkangMaterials } from "../materials/context";
import { SECONDARY_STRUCTURES, structureGroundY } from "../world-data/zones/secondary.ts";
import { InstancedPlanes, type PlaneItem } from "./InstancedPlanes";
import { useCampusSigns } from "./labels";
import { worldUvBox } from "./geometry";

/**
 * Out-of-scope context buildings (REF_SECONDARY_ZONE_PLACEHOLDER).
 *
 * These are the pre-v1 landmarks re-seated onto the real-scale ground so the
 * corridor doesn't float in a void: 驚聲大樓 west of 書卷廣場, 商管大樓 and the
 * gym on the east campus, the ship-shaped 海事博物館, 覺軒, a volleyball court.
 * Deliberately simple massing — calibrating them is future work, and pretending
 * otherwise would dilute what "reality zone" means.
 */
export function ContextStructures({ wetness, lampsOn }: { wetness: number; lampsOn: boolean }) {
  const mats = useTamkangMaterials();
  const signs = useCampusSigns();

  const items = useMemo(
    () =>
      SECONDARY_STRUCTURES.map((s) => ({
        s,
        y: structureGroundY(s),
        geo:
          s.kind === "court"
            ? null
            : worldUvBox(s.size[0], s.size[1], s.size[2], mats["library/facade"].spec.tile),
      })),
    [mats],
  );

  const facade = surface(mats["library/facade"], { wetness });
  // Muted, dark-tinted glazing: these towers are background context, and at
  // 300 m bright bands read as zebra stripes against the facade.
  const glass = surface(mats["library/glass"], {
    wetness,
    tint: "#5b656b",
    emissive: lampsOn ? "#ffe6b4" : "#000000",
    emissiveIntensity: lampsOn ? 0.35 : 0,
  });

  // Every tower's glazing bands in one instanced draw. Rotated buildings get
  // their band positions computed in world space here.
  const glazing = useMemo(() => {
    const out: PlaneItem[] = [];
    for (const { s, y } of items) {
      if (s.kind === "court" || s.kind === "ship" || s.kind === "pavilion") continue;
      const floors = s.floors ?? 6;
      for (let f = 0; f < floors; f++) {
        const fy = y + ((f + 0.55) * s.size[1]) / floors;
        for (const side of [1, -1] as const) {
          const lz = side * (s.size[2] / 2 + 0.05);
          const wx = s.position[0] + Math.sin(s.rotationY) * lz;
          const wz = s.position[1] + Math.cos(s.rotationY) * lz;
          out.push({
            position: [wx, fy, wz],
            rotationY: s.rotationY + (side > 0 ? 0 : Math.PI),
            width: s.size[0] - 3,
            height: (s.size[1] / floors) * 0.34,
          });
        }
      }
    }
    return out;
  }, [items]);

  return (
    <group>
      <InstancedPlanes items={glazing}>
        <meshStandardMaterial {...glass} />
      </InstancedPlanes>
      {items.map(({ s, y, geo }) => {
        if (s.kind === "court") {
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} receiveShadow>
                <planeGeometry args={[s.size[0], s.size[2]]} />
                <meshStandardMaterial color="#5d8a52" roughness={0.9} />
              </mesh>
              <mesh position={[0, 1.15, 0]}>
                <boxGeometry args={[0.06, 2.3, s.size[2] * 0.6]} />
                <meshStandardMaterial color="#f3eee4" />
              </mesh>
            </group>
          );
        }
        if (s.kind === "ship") {
          // 海事博物館: white hull, superstructure, bow towards the road.
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, s.size[1] * 0.28, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], s.size[1] * 0.56, s.size[2]]} />
                <meshStandardMaterial color="#eef1f4" roughness={0.55} />
              </mesh>
              <mesh position={[s.size[0] * 0.56, s.size[1] * 0.24, 0]} rotation={[0, 0, -0.5]} castShadow>
                <coneGeometry args={[s.size[2] * 0.5, s.size[0] * 0.24, 4]} />
                <meshStandardMaterial color="#eef1f4" roughness={0.55} />
              </mesh>
              <mesh position={[-4, s.size[1] * 0.72, 0]} castShadow>
                <boxGeometry args={[s.size[0] * 0.4, s.size[1] * 0.34, s.size[2] * 0.7]} />
                <meshStandardMaterial color="#dfe4e8" roughness={0.5} />
              </mesh>
              <mesh position={[2, s.size[1] * 0.98, 0]} castShadow>
                <cylinderGeometry args={[0.5, 0.7, s.size[1] * 0.3, 10]} />
                <meshStandardMaterial color="#1a3f6d" roughness={0.5} />
              </mesh>
              <mesh position={[0, 4.2, s.size[2] / 2 + 0.08]}>
                <planeGeometry args={[9, 1.5]} />
                <meshStandardMaterial map={signs.museum} roughness={0.55} />
              </mesh>
            </group>
          );
        }
        if (s.kind === "pavilion") {
          // 覺軒: low garden pavilion with a green tiled roof.
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]}>
              <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0] * 0.72, 3.4, s.size[2] * 0.72]} />
                <meshStandardMaterial {...surface(mats["palace/red-wall"], { wetness })} />
              </mesh>
              <mesh position={[0, 3.9, 0]} castShadow>
                <coneGeometry args={[s.size[0] * 0.58, 1.9, 4]} />
                <meshStandardMaterial {...surface(mats["palace/green-roof-tile"], { wetness })} />
              </mesh>
            </group>
          );
        }
        return (
          <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
            <mesh geometry={geo!} position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
              <meshStandardMaterial {...facade} />
            </mesh>
            {s.kind === "hip-roof-block" && (
              <mesh position={[0, s.size[1] + 1.1, 0]} castShadow>
                <coneGeometry args={[Math.hypot(s.size[0], s.size[2]) * 0.42, 2.6, 4]} />
                <meshStandardMaterial {...surface(mats["palace/green-roof-tile"], { wetness })} />
              </mesh>
            )}
            {s.id === "gymnasium" && (
              <mesh position={[0, 3.2, s.size[2] / 2 + 0.12]}>
                <planeGeometry args={[8.5, 1.4]} />
                <meshStandardMaterial map={signs.gym} roughness={0.55} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
