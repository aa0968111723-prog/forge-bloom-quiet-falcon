import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { surface, useTamkangMaterials } from "../materials/context";
import { quality } from "../quality";
import {
  GATE_PIER_WIDTH,
  SECONDARY_STRUCTURES,
  contextShowsDetail,
  activityProfile,
  glazingBand,
  linkedHallProfile,
  studioProfile,
  structureGroundY,
  watchPostProfile,
} from "../world-data/zones/secondary.ts";
import { type PlaneItem } from "./InstancedPlanes";
import { makeSignTexture, useCampusSigns, useFontTick } from "./labels";
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
type GlazingItem = PlaneItem & { anchorX: number; anchorZ: number };

const glazingDummy = new THREE.Object3D();

function LodGlazing({
  items,
  children,
}: {
  items: GlazingItem[];
  children: ReactNode;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    items.forEach((it, i) => {
      glazingDummy.position.set(...it.position);
      glazingDummy.rotation.set(0, it.rotationY, 0);
      glazingDummy.scale.set(it.width, it.height, 1);
      glazingDummy.updateMatrix();
      mesh.setMatrixAt(i, glazingDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const tier = quality().tier === "low" ? "low" : "high";
    items.forEach((it, i) => {
      const show = contextShowsDetail(camera.position.x, camera.position.z, it.anchorX, it.anchorZ, tier);
      glazingDummy.position.set(...it.position);
      glazingDummy.rotation.set(0, it.rotationY, 0);
      glazingDummy.scale.set(show ? it.width : 0, show ? it.height : 0, 1);
      glazingDummy.updateMatrix();
      mesh.setMatrixAt(i, glazingDummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  if (items.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      {children}
    </instancedMesh>
  );
}

export function ContextStructures({
  wetness,
  lampsOn,
}: {
  wetness: number;
  lampsOn: boolean;
}) {
  const mats = useTamkangMaterials();
  const root = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    const tier = quality().tier === "low" ? "low" : "high";
    root.current?.traverse((obj) => {
      if (obj.name !== "context-detail") return;
      const x = obj.userData.x as number;
      const z = obj.userData.z as number;
      obj.visible = contextShowsDetail(camera.position.x, camera.position.z, x, z, tier);
    });
  });
  const signs = useCampusSigns();
  const fontTick = useFontTick();
  const nameplates = useMemo(() => {
    const m: Record<string, ReturnType<typeof makeSignTexture>> = {};
    for (const s of SECONDARY_STRUCTURES) {
      if (s.kind === "court") continue;
      m[s.id] = makeSignTexture(s.name, { width: 900, height: 180 });
    }
    return m;
    // Rebuild after webfonts land.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontTick]);

  const items = useMemo(
    () =>
      SECONDARY_STRUCTURES.map((s) => ({
        s,
        y: structureGroundY(s),
        geo:
          s.kind === "court"
            ? null
            : worldUvBox(
                s.size[0],
                s.size[1],
                s.size[2],
                mats["library/facade"].spec.tile,
              ),
      })),
    [mats],
  );

  const facade = surface(mats["library/facade"], { wetness });
  useEffect(
    () => () => {
      for (const t of Object.values(nameplates)) t.dispose();
    },
    [nameplates],
  );
  useEffect(
    () => () => {
      for (const item of items) item.geo?.dispose();
    },
    [items],
  );
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
    const out: GlazingItem[] = [];
    for (const { s, y } of items) {
      if (
        s.kind === "court" ||
        s.kind === "ship" ||
        s.kind === "pavilion" ||
        s.kind === "gate" ||
        s.kind === "forum-hall" ||
        s.kind === "stand" ||
        s.kind === "shed" ||
        s.kind === "studio-block" ||
        s.kind === "activity-hall" ||
        s.kind === "watch-post"
      )
        continue;
      const floors = s.floors ?? 6;
      for (let f = 0; f < floors; f++) {
        const fy = y + ((f + 0.55) * s.size[1]) / floors;
        for (const side of [1, -1] as const) {
          const band = glazingBand(s.kind, s.size, floors, f, side);
          const wx = s.position[0] + Math.sin(s.rotationY) * band.lz;
          const wz = s.position[1] + Math.cos(s.rotationY) * band.lz;
          out.push({
            position: [wx, fy, wz],
            rotationY: s.rotationY + (side > 0 ? 0 : Math.PI),
            width: band.width,
            height: (s.size[1] / floors) * 0.34,
            anchorX: s.position[0],
            anchorZ: s.position[1],
          });
        }
      }
    }
    return out;
  }, [items]);

  return (
    <group ref={root}>
      <LodGlazing items={glazing}>
        <meshStandardMaterial {...glass} />
      </LodGlazing>
      {items.map(({ s, y, geo }) => {
        if (s.kind === "court") {
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]}>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.05, 0]}
                receiveShadow
              >
                <planeGeometry args={[s.size[0], s.size[2]]} />
                <meshStandardMaterial
                  color={s.id === "parking" ? "#59666b" : "#5d8a52"}
                  roughness={0.9}
                />
              </mesh>
              {(s.id === "volleyball-court" || s.id === "wuhu-courts") && (
                <mesh position={[0, 1.15, 0]}>
                  <boxGeometry args={[0.06, 2.3, s.size[2] * 0.6]} />
                  <meshStandardMaterial color="#f3eee4" />
                </mesh>
              )}
              {s.id === "track" && (
                <>
                  <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.09, 0]}
                    scale={[s.size[0] * 0.46, s.size[2] * 0.46, 1]}
                  >
                    <ringGeometry args={[0.76, 1, 72]} />
                    <meshStandardMaterial color="#b77861" roughness={0.95} />
                  </mesh>
                  {[0.81, 0.87, 0.93].map((r) => (
                    <mesh
                      key={r}
                      rotation={[-Math.PI / 2, 0, 0]}
                      position={[0, 0.1, 0]}
                      scale={[s.size[0] * 0.46, s.size[2] * 0.46, 1]}
                    >
                      <ringGeometry args={[r, r + 0.005, 72]} />
                      <meshBasicMaterial color="#e4d2ac" />
                    </mesh>
                  ))}
                </>
              )}
              {s.id === "parking" &&
                Array.from({ length: 12 }, (_, i) => (
                  <mesh
                    key={i}
                    position={[-s.size[0] / 2 + 4 + i * 4.5, 0.1, 0]}
                  >
                    <boxGeometry args={[0.12, 0.02, s.size[2] * 0.75]} />
                    <meshBasicMaterial color="#e1d9b8" />
                  </mesh>
                ))}
            </group>
          );
        }
        if (s.kind === "ship") {
          // 海事博物館: white hull, superstructure, bow towards the road.
          return (
            <group
              key={s.id}
              position={[s.position[0], y, s.position[1]]}
              rotation={[0, s.rotationY, 0]}
            >
              <mesh
                position={[0, s.size[1] * 0.28, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[s.size[0], s.size[1] * 0.56, s.size[2]]} />
                <meshStandardMaterial color="#eef1f4" roughness={0.55} />
              </mesh>
              <mesh
                position={[s.size[0] * 0.56, s.size[1] * 0.24, 0]}
                rotation={[0, 0, -0.5]}
                castShadow
              >
                <coneGeometry args={[s.size[2] * 0.5, s.size[0] * 0.24, 4]} />
                <meshStandardMaterial color="#eef1f4" roughness={0.55} />
              </mesh>
              <mesh position={[-4, s.size[1] * 0.72, 0]} castShadow>
                <boxGeometry
                  args={[s.size[0] * 0.4, s.size[1] * 0.34, s.size[2] * 0.7]}
                />
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
        if (s.kind === "gate") {
          const pier = GATE_PIER_WIDTH;
          const offset = (s.size[0] - pier) / 2;
          const height = 4.2;
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]}>
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * offset, height / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[pier, height, s.size[2]]} />
                  <meshStandardMaterial {...surface(mats["palace/red-wall"], { wetness })} />
                </mesh>
              ))}
              <mesh position={[0, height + 0.28, 0]} castShadow>
                <boxGeometry args={[s.size[0] + 0.4, 0.55, s.size[2] + 0.6]} />
                <meshStandardMaterial {...surface(mats["palace/green-roof-tile"], { wetness })} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, height + 0.28, s.size[2] / 2 + 0.36]}
                >
                  <planeGeometry args={[Math.min(4.2, s.size[0] * 0.55), 0.7]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "linked-hall") {
          const profile = linkedHallProfile(s.size);
          const baseH = profile.baseH;
          const upperH = Math.max(1, s.size[1] - baseH);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], baseH, s.size[2]]} />
                <meshStandardMaterial color="#7f96a0" roughness={0.35} metalness={0.08} />
              </mesh>
              <mesh position={[0, baseH + upperH / 2, profile.upperZ]} castShadow receiveShadow>
                <boxGeometry args={[profile.upperWidth, upperH, profile.upperDepth]} />
                <meshStandardMaterial color="#f3f0e8" roughness={0.84} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, baseH * 0.55, s.size[2] / 2 + 0.12]}
                >
                  <planeGeometry args={[Math.min(8.5, s.size[0] * 0.7), 1.4]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "forum-hall") {
          const glassH = Math.max(2.6, s.size[1] * 0.46);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />
                <meshStandardMaterial color="#efe8dc" roughness={0.84} />
              </mesh>
              <mesh position={[0, glassH / 2, s.size[2] / 2 + 0.08]} castShadow>
                <boxGeometry args={[s.size[0] * 0.72, glassH, 0.28]} />
                <meshStandardMaterial color="#8ea6ae" roughness={0.28} metalness={0.12} />
              </mesh>
              <mesh position={[0, s.size[1] + 0.28, 0]} castShadow>
                <boxGeometry args={[s.size[0] + 2.4, 0.42, s.size[2] + 2.4]} />
                <meshStandardMaterial color="#d7d0c2" roughness={0.8} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, glassH + 0.9, s.size[2] / 2 + 0.28]}
                >
                  <planeGeometry args={[Math.min(10, s.size[0] * 0.55), 1.3]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "studio-block") {
          const profile = studioProfile(s.size);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />
                <meshStandardMaterial color="#d5cfc4" roughness={0.86} />
              </mesh>
              <mesh position={[0, profile.glassH / 2, profile.glassZ]} castShadow>
                <boxGeometry args={[profile.glassW, profile.glassH, 0.22]} />
                <meshStandardMaterial color="#7f96a0" roughness={0.28} metalness={0.1} />
              </mesh>
              <mesh
                position={[0, profile.canopyY, s.size[2] / 2 + profile.canopyDepth / 2 - 0.2]}
                castShadow
              >
                <boxGeometry args={[s.size[0] * 0.92, 0.22, profile.canopyDepth]} />
                <meshStandardMaterial color="#8a8174" roughness={0.82} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, s.size[1] + profile.monitorH / 2, profile.monitorZ]}
                castShadow
              >
                <boxGeometry args={[profile.monitorW, profile.monitorH, profile.monitorD]} />
                <meshStandardMaterial color="#efe8dc" roughness={0.8} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, profile.canopyY + 1.2, profile.glassZ + 0.2]}
                >
                  <planeGeometry args={[Math.min(8, s.size[0] * 0.5), 1.15]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "stand") {
          const deckH = 1.25;
          const roofY = 3.15;
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, deckH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], deckH, s.size[2]]} />
                <meshStandardMaterial color="#c4b49a" roughness={0.9} />
              </mesh>
              <mesh position={[0, deckH + 1.15, -s.size[2] * 0.28]} castShadow receiveShadow>
                <boxGeometry args={[7.2, 2.3, 3.2]} />
                <meshStandardMaterial color="#f3eee4" roughness={0.84} />
              </mesh>
              <mesh position={[0, roofY, s.size[2] * 0.08]} castShadow>
                <boxGeometry args={[s.size[0] * 0.86, 0.22, s.size[2] * 0.7]} />
                <meshStandardMaterial color="#8d734c" roughness={0.8} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh key={side} position={[side * (s.size[0] * 0.34), roofY / 2, s.size[2] * 0.28]} castShadow>
                  <boxGeometry args={[0.28, roofY, 0.28]} />
                  <meshStandardMaterial color="#6d5a46" roughness={0.86} />
                </mesh>
              ))}
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, deckH + 0.7, s.size[2] / 2 + 0.08]}
                >
                  <planeGeometry args={[Math.min(8, s.size[0] * 0.7), 0.9]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "shed") {
          const bodyH = Math.max(3.4, s.size[1] * 0.72);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], bodyH, s.size[2]]} />
                <meshStandardMaterial color="#9aa3a8" roughness={0.78} />
              </mesh>
              <mesh position={[0, bodyH + 0.7, 0]} castShadow>
                <boxGeometry args={[s.size[0] * 0.84, 1.35, 3.4]} />
                <meshStandardMaterial color="#6d767c" roughness={0.62} />
              </mesh>
              <mesh position={[s.size[0] * 0.36, bodyH + 0.85, 0]} castShadow>
                <boxGeometry args={[4.2, 2.4, 4.2]} />
                <meshStandardMaterial color="#5e676d" roughness={0.7} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, bodyH * 0.55, s.size[2] / 2 + 0.08]}
                >
                  <planeGeometry args={[Math.min(9, s.size[0] * 0.45), 1.2]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "media-hall") {
          const baseH = Math.max(2.8, s.size[1] * 0.36);
          const upperH = Math.max(1, s.size[1] - baseH);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], baseH, s.size[2]]} />
                <meshStandardMaterial color="#3e4650" roughness={0.72} />
              </mesh>
              <mesh position={[0, baseH + upperH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], upperH, s.size[2]]} />
                <meshStandardMaterial color="#e6e0d4" roughness={0.84} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[s.size[0] * 0.28, s.size[1] + 2.1, 0]}
                castShadow
              >
                <boxGeometry args={[0.45, 4.2, 0.45]} />
                <meshStandardMaterial color="#2c3338" roughness={0.55} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, baseH + 1.2, s.size[2] / 2 + 0.08]}
                >
                  <planeGeometry args={[Math.min(9, s.size[0] * 0.6), 1.2]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "auditorium") {
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh geometry={geo!} position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#5c534c" roughness={0.84} />
              </mesh>
              <mesh position={[s.size[0] * 0.28, s.size[1] + 2.2, -s.size[2] * 0.12]} castShadow>
                <boxGeometry args={[8.5, 4.4, s.size[2] * 0.42]} />
                <meshStandardMaterial color="#d9d2c6" roughness={0.8} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, 3.4, s.size[2] / 2 + 0.08]}
                >
                  <planeGeometry args={[Math.min(9, s.size[0] * 0.55), 1.2]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "activity-hall") {
          const profile = activityProfile(s.size);
          const upperH = Math.max(1, s.size[1] - profile.lobbyH);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, profile.lobbyH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], profile.lobbyH, s.size[2]]} />
                <meshStandardMaterial color="#c9bfb0" roughness={0.84} />
              </mesh>
              <mesh position={[0, profile.lobbyH + upperH / 2, -0.4]} castShadow receiveShadow>
                <boxGeometry args={[profile.upperW, upperH, profile.upperD]} />
                <meshStandardMaterial color="#f4efe6" roughness={0.86} />
              </mesh>
              <mesh position={[0, profile.lobbyH / 2, profile.glassZ]} castShadow>
                <boxGeometry args={[profile.glassW, profile.lobbyH * 0.72, 0.22]} />
                <meshStandardMaterial color="#7f96a0" roughness={0.28} metalness={0.1} />
              </mesh>
              <mesh
                position={[0, profile.lobbyH, s.size[2] / 2 + profile.canopyDepth / 2 - 0.15]}
                castShadow
              >
                <boxGeometry args={[s.size[0] * 0.78, 0.22, profile.canopyDepth]} />
                <meshStandardMaterial color="#8a8174" roughness={0.82} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, profile.lobbyH * 0.55, profile.glassZ + 0.16]}
                >
                  <planeGeometry args={[Math.min(9, s.size[0] * 0.45), 1.15]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "watch-post") {
          const profile = watchPostProfile(s.size);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], s.size[1], s.size[2]]} />
                <meshStandardMaterial color="#6e756f" roughness={0.84} />
              </mesh>
              <mesh position={[0, s.size[1] * 0.58, profile.glassZ]} castShadow>
                <boxGeometry args={[profile.glassW, profile.glassH, 0.16]} />
                <meshStandardMaterial color="#9eb4b8" roughness={0.22} metalness={0.12} />
              </mesh>
              <mesh position={[profile.mastX, s.size[1] + profile.mastH / 2, -s.size[2] * 0.2]} castShadow>
                <boxGeometry args={[0.22, profile.mastH, 0.22]} />
                <meshStandardMaterial color="#3e4442" roughness={0.7} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[profile.mastX, s.size[1] + profile.mastH, -s.size[2] * 0.2]}
                castShadow
              >
                <boxGeometry args={[0.7, 0.16, 0.7]} />
                <meshStandardMaterial color="#d7dde0" roughness={0.45} metalness={0.2} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, s.size[1] * 0.58, profile.glassZ + 0.14]}
                >
                  <planeGeometry args={[Math.min(6.4, s.size[0] * 0.7), 0.7]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "study-block") {
          const baseH = Math.max(2.4, s.size[1] * 0.18);
          const upperH = Math.max(1, s.size[1] - baseH);
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0], baseH, s.size[2]]} />
                <meshStandardMaterial color="#6d5a46" roughness={0.9} />
              </mesh>
              <mesh position={[0, baseH + upperH / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0] - 0.35, upperH, s.size[2] - 0.35]} />
                <meshStandardMaterial color="#e4ddd0" roughness={0.82} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, s.size[1] + 0.28, 0]}
                castShadow
              >
                <boxGeometry args={[s.size[0] + 0.5, 0.45, s.size[2] + 0.5]} />
                <meshStandardMaterial color="#8d734c" roughness={0.8} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, baseH + 1.6, s.size[2] / 2 + 0.12]}
                >
                  <planeGeometry args={[Math.min(8.5, s.size[0] * 0.7), 1.4]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "intl-dorm") {
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh geometry={geo!} position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#d5ddd6" roughness={0.82} />
              </mesh>
              <mesh position={[0, 2.1, s.size[2] / 2 + 0.06]} castShadow>
                <boxGeometry args={[s.size[0] * 0.62, 3.4, 0.22]} />
                <meshStandardMaterial color="#8ea4aa" roughness={0.3} metalness={0.08} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, s.size[1] + 0.35, 0]}
                castShadow
              >
                <boxGeometry args={[s.size[0] + 0.8, 0.55, s.size[2] + 0.8]} />
                <meshStandardMaterial color="#6d7c78" roughness={0.8} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, 4.2, s.size[2] / 2 + 0.2]}
                >
                  <planeGeometry args={[Math.min(9, s.size[0] * 0.62), 1.2]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "dorm-block" || s.kind === "lab-block" || s.kind === "sport-hall") {
          const wall = s.kind === "dorm-block" ? "#d2b48c" : s.kind === "lab-block" ? "#a9b7be" : "#7d9a84";
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh geometry={geo!} position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <meshStandardMaterial color={wall} roughness={0.86} />
              </mesh>
              {s.kind === "dorm-block" && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, s.size[1] + 1.1, 0]}
                  castShadow
                >
                  <boxGeometry args={[s.size[0] * 0.72, 2.2, s.size[2] * 0.72]} />
                  <meshStandardMaterial color="#b08968" roughness={0.84} />
                </mesh>
              )}
              {s.kind === "lab-block" && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[s.size[0] * 0.22, s.size[1] + 1.3, 0]}
                  castShadow
                >
                  <boxGeometry args={[s.size[0] * 0.28, 2.6, s.size[2] * 0.34]} />
                  <meshStandardMaterial color="#6d7c84" roughness={0.7} />
                </mesh>
              )}
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, 3.2, s.size[2] / 2 + 0.12]}
                >
                  <planeGeometry args={[Math.min(8.5, s.size[0] * 0.7), 1.4]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "white-block") {
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]} rotation={[0, s.rotationY, 0]}>
              <mesh geometry={geo!} position={[0, s.size[1] / 2, 0]} castShadow receiveShadow>
                <meshStandardMaterial color="#f3f0e8" roughness={0.88} />
              </mesh>
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, s.size[1] + 0.45, 0]}
                castShadow
              >
                <boxGeometry args={[s.size[0] + 0.6, 0.7, s.size[2] + 0.6]} />
                <meshStandardMaterial color="#8e8882" roughness={0.9} />
              </mesh>
              {nameplates[s.id] && (
                <mesh
                  name="context-detail"
                  userData={{ x: s.position[0], z: s.position[1] }}
                  position={[0, 2.4, s.size[2] / 2 + 0.12]}
                >
                  <planeGeometry args={[Math.min(6, s.size[0] * 0.7), 1.1]} />
                  <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
                </mesh>
              )}
            </group>
          );
        }
        if (s.kind === "pavilion") {
          // 覺軒: low garden pavilion with a green tiled roof.
          return (
            <group key={s.id} position={[s.position[0], y, s.position[1]]}>
              <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
                <boxGeometry args={[s.size[0] * 0.72, 3.4, s.size[2] * 0.72]} />
                <meshStandardMaterial
                  {...surface(mats["palace/red-wall"], { wetness })}
                />
              </mesh>
              <mesh position={[0, 3.9, 0]} castShadow>
                <coneGeometry args={[s.size[0] * 0.58, 1.9, 4]} />
                <meshStandardMaterial
                  {...surface(mats["palace/green-roof-tile"], { wetness })}
                />
              </mesh>
            </group>
          );
        }
        return (
          <group
            key={s.id}
            position={[s.position[0], y, s.position[1]]}
            rotation={[0, s.rotationY, 0]}
          >
            <mesh
              geometry={geo!}
              position={[0, s.size[1] / 2, 0]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial {...facade} />
            </mesh>
            {s.kind === "hip-roof-block" && (
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, s.size[1] + 1.1, 0]}
                castShadow
              >
                <coneGeometry
                  args={[Math.hypot(s.size[0], s.size[2]) * 0.42, 2.6, 4]}
                />
                <meshStandardMaterial
                  {...surface(mats["palace/green-roof-tile"], { wetness })}
                />
              </mesh>
            )}
            {nameplates[s.id] && (
              <mesh
                name="context-detail"
                userData={{ x: s.position[0], z: s.position[1] }}
                position={[0, 3.2, s.size[2] / 2 + 0.12]}
              >
                <planeGeometry args={[Math.min(8.5, s.size[0] * 0.7), 1.4]} />
                <meshStandardMaterial map={nameplates[s.id]} roughness={0.55} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
