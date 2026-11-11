import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "../store";
import { terrainHeight } from "../world";
import { ribbonGeometry } from "../world/geometry";
import {
  CAMPUS_ROADS,
  CAMPUS_SITES,
  SUPPLY_NODES,
  siteEntrance,
} from "./campus";
import { ENEMY_TYPES, RECIPES, type BuildKind } from "./data";
import { inventory, promptSnap, tickRpg, useRpg } from "./store";
import {
  buildSpot,
  lootClusters,
  pickupOutline,
  PLACE_GHOST_BLOCKED,
  PLACE_GHOST_READY,
  placeVerdict,
  promptDecision,
  promptLabels,
  type PromptLabel,
} from "./prompts";
import {
  findWalkablePath,
  clearSight,
  type Building,
} from "./rules";
import { quality } from "../quality";
import { signHost } from "./chrome";
import { detailedRoom, InteriorDetails, roomFinish } from "./InteriorDetails";
import { ROOM_TABLE_SIZE, ROOM_TABLES } from "./interior-layout";

/** Scene marker. Sentences the player must read stay on the DOM plaque. */
export function Sign({
  text,
  position,
  color = "#fff3d7",
  scale = 1,
}: {
  text: string;
  position: [number, number, number];
  color?: string;
  scale?: number;
}) {
  const sceneMarker = signHost().marker === "scene";
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(13,36,42,0.9)";
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 96, 16);
    ctx.fill();
    ctx.font = "600 36px 'Microsoft JhengHei', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 49, 480);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  if (!sceneMarker) return null;
  return (
    <sprite position={position} scale={[8 * scale, 1.5 * scale, 1]}>
      <spriteMaterial map={texture} color="#a8bfb1" transparent depthWrite={false} />
    </sprite>
  );
}
function Mob({
  enemy,
}: {
  enemy: ReturnType<typeof useRpg.getState>["enemies"][number];
}) {
  const ref = useRef<THREE.Group>(null),
    core = useRef<THREE.Mesh>(null),
    warning = useRef<THREE.Mesh>(null),
    bar = useRef<THREE.Mesh>(null);
  const barGroup = useRef<THREE.Group>(null);
  const type = ENEMY_TYPES[enemy.kind],
    size = type.radius,
    boss = enemy.kind === "final";
  useFrame(({ clock, camera }) => {
    if (!ref.current) return;
    const near =
      Math.hypot(camera.position.x - enemy.x, camera.position.z - enemy.z) < 90;
    ref.current.visible = enemy.hp > 0 && near && !useRpg.getState().interiorId;
    if (!ref.current.visible) return;
    const y = terrainHeight(enemy.x, enemy.z),
      t = clock.elapsedTime;
    ref.current.position.set(enemy.x, y, enemy.z);
    if (core.current) {
      core.current.position.y =
        size * 1.6 + Math.sin(t * 2 + enemy.anchorX) * 0.14;
      core.current.rotation.y = t * 0.6;
      const m = core.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = enemy.hurt > 0 ? 2 : 0.25;
    }
    if (warning.current) {
      warning.current.visible = enemy.state === "windup";
      const s = enemy.state === "windup" ? 1 - enemy.timer / type.windup : 0;
      warning.current.scale.setScalar(0.4 + s * 0.6);
    }
    if (bar.current) bar.current.scale.x = Math.max(0.001, enemy.hp / type.hp);
    if (barGroup.current) barGroup.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group
      ref={ref}
      position={[enemy.x, terrainHeight(enemy.x, enemy.z), enemy.z]}
    >
      <mesh
        ref={warning}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
        visible={false}
      >
        <ringGeometry args={[1.3, size + 2.5, 40]} />
        <meshBasicMaterial
          color="#f36b5d"
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={core} castShadow>
        {boss ? (
          <octahedronGeometry args={[size, 0]} />
        ) : enemy.kind === "quiz" ? (
          <boxGeometry args={[size * 1.4, size * 1.9, size * 0.35]} />
        ) : (
          <dodecahedronGeometry args={[size, 0]} />
        )}
        <meshStandardMaterial
          color={type.color}
          emissive={type.color}
          emissiveIntensity={0.25}
          roughness={0.4}
          metalness={0.25}
        />
        <mesh position={[0, 0, size * 0.75]}>
          <boxGeometry args={[size * 0.7, 0.08, 0.08]} />
          <meshBasicMaterial color="#ffe9c7" />
        </mesh>
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 2.1) * size,
            size * (0.8 + i * 0.45),
            Math.sin(i * 2.1) * size,
          ]}
          rotation={[i * 0.4, i, 0.4]}
        >
          <boxGeometry args={[size * 0.75, 0.05, size * 0.9]} />
          <meshStandardMaterial color="#e5dec9" roughness={0.8} />
        </mesh>
      ))}
      <Sign
        text={type.name}
        position={[0, size * 3.2 + 1, 0]}
        scale={boss ? 0.8 : 0.55}
      />
      <group ref={barGroup} position={[0, size * 3.2 + 0.1, 0]}>
        <mesh>
          <planeGeometry args={[2.4, 0.12]} />
          <meshBasicMaterial color="#203638" />
        </mesh>
        <mesh ref={bar} position={[0, 0, 0.02]}>
          <planeGeometry args={[2.4, 0.12]} />
          <meshBasicMaterial color={type.color} />
        </mesh>
      </group>
    </group>
  );
}
export function BuildingModel({
  kind,
  ghost = false,
  valid = true,
  tint,
}: {
  kind: BuildKind;
  ghost?: boolean;
  valid?: boolean;
  tint?: string;
}) {
  const spec = RECIPES.find((r) => r.id === kind)!;
  const color = ghost
    ? (tint ?? (valid ? PLACE_GHOST_READY : PLACE_GHOST_BLOCKED))
    : spec.color;
  const mat = {
    color,
    transparent: ghost,
    opacity: ghost ? 0.52 : 1,
    roughness: 0.7,
  };
  return (
    <group>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[spec.width + 0.3, 0.24, spec.depth + 0.3]} />
        <meshStandardMaterial {...mat} color={ghost ? color : "#405d58"} />
      </mesh>
      {kind === "desk" ? (
        <>
          <mesh position={[0, 1, 0]} castShadow>
            <boxGeometry args={[2.6, 0.16, 1.6]} />
            <meshStandardMaterial {...mat} />
          </mesh>
          {[-1, 1].map((x) => (
            <mesh key={x} position={[x, 0.55, 0]}>
              <boxGeometry args={[0.18, 0.9, 1.1]} />
              <meshStandardMaterial {...mat} />
            </mesh>
          ))}
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.5]} />
            <meshStandardMaterial color="#eee1bd" />
          </mesh>
        </>
      ) : kind === "barrier" ? (
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[3, 1.6, 0.7]} />
          <meshStandardMaterial {...mat} />
        </mesh>
      ) : kind === "lantern" ? (
        <>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.12, 3, 8]} />
            <meshStandardMaterial {...mat} />
          </mesh>
          <mesh position={[0, 3.1, 0]}>
            <boxGeometry args={[0.75, 0.7, 0.75]} />
            <meshStandardMaterial
              {...mat}
              emissive={color}
              emissiveIntensity={1.4}
            />
          </mesh>
          <mesh position={[0, 3.55, 0]}>
            <coneGeometry args={[0.7, 0.35, 4]} />
            <meshStandardMaterial {...mat} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.6, 0.8, 1.7, 8]} />
            <meshStandardMaterial {...mat} />
          </mesh>
          <mesh position={[0, 2.1, -0.25]}>
            <boxGeometry args={[0.5, 0.5, 1.6]} />
            <meshStandardMaterial
              {...mat}
              emissive={color}
              emissiveIntensity={0.4}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
function Placed({ building }: { building: Building }) {
  return (
    <group
      position={[building.x, terrainHeight(building.x, building.z), building.z]}
      rotation={[0, building.rotation, 0]}
    >
      <BuildingModel kind={building.kind} />
    </group>
  );
}
export function buildTarget() {
  const g = useGame.getState();
  return buildSpot(g.playerX, g.playerZ, g.playerYaw);
}
export function PromptMarks() {
  const [marks, setMarks] = useState<PromptLabel[]>([]);
  const sig = useRef("");
  useFrame(({ camera, size }) => {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const snap = promptSnap();
    const decision = promptDecision(snap);
    const labels = promptLabels(
      snap,
      {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        fx: forward.x,
        fy: forward.y,
        fz: forward.z,
        fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
        width: size.width,
        height: size.height,
      },
      decision,
    );
    const next = labels.filter((label) => label.shown);
    const key = next
      .map(
        (label) =>
          label.kind +
          ":" +
          label.id +
          label.text +
          label.anchor.x.toFixed(1) +
          label.anchor.z.toFixed(1),
      )
      .join("|");
    if (key === sig.current) return;
    sig.current = key;
    setMarks(next);
  });
  return (
    <group>
      {marks.map((label) => (
        <Sign
          key={`${label.kind}:${label.id}`}
          text={label.text}
          position={[label.anchor.x, label.anchor.y, label.anchor.z]}
          scale={label.scale}
        />
      ))}
    </group>
  );
}
function BuildGhost() {
  const kind = useRpg((s) => s.buildKind);
  const group = useRef<THREE.Group>(null);
  const sig = useRef("");
  const [shown, setShown] = useState<ReturnType<typeof placeVerdict> | null>(null);
  useFrame(() => {
    const live = useRpg.getState();
    const g = useGame.getState();
    if (!group.current || !live.buildKind) return;
    const verdict = placeVerdict({
      kind: live.buildKind,
      x: g.playerX,
      z: g.playerZ,
      yaw: g.playerYaw,
      rotation: live.rotation,
      buildings: live.buildings,
      count: (id) => inventory.count(id),
    });
    group.current.position.set(
      verdict.spot.x,
      terrainHeight(verdict.spot.x, verdict.spot.z),
      verdict.spot.z,
    );
    group.current.rotation.y = verdict.facing;
    group.current.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material?.transparent && material.color) material.color.set(verdict.color);
    });
    const key = [
      verdict.spot.x,
      verdict.spot.z,
      verdict.facing,
      verdict.words,
      verdict.color,
      verdict.width,
      verdict.depth,
    ].join(":");
    if (key === sig.current) return;
    sig.current = key;
    setShown(verdict);
  });
  if (!kind) return null;
  return (
    <group ref={group}>
      <BuildingModel
        kind={kind}
        ghost
        valid={shown?.legal ?? false}
        tint={shown?.color}
      />
      {shown ? (
        <Sign
          text={shown.words}
          position={[0, 4.2, 0]}
          color={shown.legal ? "#d7fff4" : "#ffd0c8"}
        />
      ) : null}
    </group>
  );
}
function Pulse() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const fx = useRpg.getState().attackFx,
      s = useRpg.getState();
    if (!ref.current) return;
    ref.current.visible = Boolean(fx && s.clock - fx.at < 0.3);
    if (!fx || !ref.current.visible) return;
    ref.current.position.set(fx.x, terrainHeight(fx.x, fx.z) + 0.3, fx.z);
    ref.current.scale.setScalar(((s.clock - fx.at) / 0.3) * fx.range);
    const m = ref.current.material as THREE.MeshBasicMaterial;
    m.color.set(fx.color);
    m.opacity = (1 - (s.clock - fx.at) / 0.3) * 0.7;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.8, 1, 48]} />
      <meshBasicMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
const supplyBox = new THREE.BoxGeometry(0.85, 0.8, 0.65);
const supplyLid = new THREE.BoxGeometry(0.9, 0.08, 0.7);
const supplyEdges = new THREE.EdgesGeometry(supplyBox);
const lootGem = new THREE.OctahedronGeometry(0.45);
const lootEdges = new THREE.EdgesGeometry(lootGem);
const groundRing = new THREE.RingGeometry(0.62, 0.86, 24);

function SupplyCrate({ node }: { node: (typeof SUPPLY_NODES)[number] }) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const body = useRef<THREE.MeshStandardMaterial>(null);
  const lid = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ camera }) => {
    const host = group.current;
    if (!host) return;
    const cooled = (useRpg.getState().harvested[node.id] ?? 0) >= Date.now();
    const dist = Math.hypot(camera.position.x - node.x, camera.position.z - node.z);
    const player = useGame.getState();
    const sight = clearSight(
      player.playerX,
      player.playerZ,
      node.x,
      node.z,
      useRpg.getState().buildings,
    );
    const pose = pickupOutline(dist, cooled, sight);
    host.visible = pose.mesh;
    if (ring.current) ring.current.visible = pose.outline;
    if (edges.current) edges.current.visible = pose.outline;
    const ringMat = ring.current?.material;
    if (ringMat && !Array.isArray(ringMat))
      (ringMat as THREE.MeshBasicMaterial).color.set(cooled ? "#c4b49a" : "#7ddac3");
    const edgeMat = edges.current?.material;
    if (edgeMat && !Array.isArray(edgeMat))
      (edgeMat as THREE.LineBasicMaterial).color.set(cooled ? "#8a8172" : "#214644");
    body.current?.color.set(cooled ? "#8d8478" : "#cfb381");
    body.current?.emissive.set(cooled ? "#000000" : "#b8934f");
    if (body.current) body.current.emissiveIntensity = cooled ? 0 : 0.15;
    lid.current?.color.set(cooled ? "#6d6a62" : "#3d7976");
  });
  return (
    <group
      ref={group}
      visible={false}
      position={[node.x, terrainHeight(node.x, node.z), node.z]}
    >
      <mesh position={[0, 0.5, 0]} geometry={supplyBox}>
        <meshStandardMaterial ref={body} color="#cfb381" emissive="#b8934f" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.92, 0]} geometry={supplyLid}>
        <meshStandardMaterial ref={lid} color="#3d7976" />
      </mesh>
      <lineSegments ref={edges} geometry={supplyEdges} position={[0, 0.5, 0]}>
        <lineBasicMaterial color="#214644" />
      </lineSegments>
      <mesh
        ref={ring}
        geometry={groundRing}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
      >
        <meshBasicMaterial color="#7ddac3" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function LootPile({
  cluster,
}: {
  cluster: ReturnType<typeof lootClusters<{ id: string; x: number; z: number }>>[number];
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const scale = 1 + Math.min(0.45, (cluster.members.length - 1) * 0.05);
  useFrame(({ camera }) => {
    const host = group.current;
    if (!host) return;
    const dist = Math.hypot(
      camera.position.x - cluster.x,
      camera.position.z - cluster.z,
    );
    const player = useGame.getState();
    const sight = clearSight(
      player.playerX,
      player.playerZ,
      cluster.x,
      cluster.z,
      useRpg.getState().buildings,
    );
    const pose = pickupOutline(dist, false, sight);
    host.visible = pose.mesh;
    if (ring.current) ring.current.visible = pose.outline;
    if (edges.current) edges.current.visible = pose.outline;
  });
  return (
    <group
      ref={group}
      visible={false}
      position={[cluster.x, terrainHeight(cluster.x, cluster.z), cluster.z]}
    >
      <group scale={scale} position={[0, 0.65, 0]} rotation={[0.4, 0.7, 0.3]}>
        <mesh geometry={lootGem}>
          <meshStandardMaterial color="#f8d58b" emissive="#f8d58b" emissiveIntensity={0.9} />
        </mesh>
        <lineSegments ref={edges} geometry={lootEdges}>
          <lineBasicMaterial color="#fff6d8" />
        </lineSegments>
      </group>
      <mesh
        ref={ring}
        geometry={groundRing}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
      >
        <meshBasicMaterial color="#f8d58b" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Supplies() {
  const loot = useRpg((s) => s.loot);
  const clusters = useMemo(() => lootClusters(loot), [loot]);
  return (
    <group>
      {SUPPLY_NODES.map((node) => (
        <SupplyCrate key={node.id} node={node} />
      ))}
      {clusters.map((cluster) => (
        <LootPile
          key={cluster.members.map((pile) => pile.id).join("~")}
          cluster={cluster}
        />
      ))}
    </group>
  );
}
function Door({ site }: { site: (typeof CAMPUS_SITES)[number] }) {
  const ref = useRef<THREE.Group>(null);
  const door = siteEntrance(site),
    y = terrainHeight(door.x, door.z);
  useFrame(({ camera }) => {
    if (ref.current)
      ref.current.visible =
        Math.hypot(camera.position.x - door.x, camera.position.z - door.z) < 85;
  });
  return (
    <group ref={ref} position={[door.x, y, door.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.15, 0]}>
        <ringGeometry args={[0.8, 1.1, 24]} />
        <meshBasicMaterial color="#92d9c0" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
export function CampusExtension() {
  const roads = useMemo(
    () =>
      [
        ...CAMPUS_ROADS,
        ...CAMPUS_SITES.map((s) => {
          const door = siteEntrance(s);
          const routeX = [61, 195, 331, 390, 490, -95].sort(
            (a, b) => Math.abs(a - door.x) - Math.abs(b - door.x),
          )[0];
          return findWalkablePath(door, { x: routeX, z: door.z }, 1.1);
        }),
      ]
        .filter((points) => points.length >= 2)
        .map((points) => ribbonGeometry(points, 2, terrainHeight, 0.08, 3)),
    [],
  );
  useEffect(() => () => roads.forEach((g) => g.dispose()), [roads]);
  return (
    <group>
      {roads.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial color="#ab9b82" roughness={0.95} />
        </mesh>
      ))}
      {CAMPUS_SITES.map((s) => (
        <Door key={s.id} site={s} />
      ))}
    </group>
  );
}
export function Interior() {
  const id = useRpg((s) => s.interiorId),
    floor = useRpg((s) => s.floor),
    site = CAMPUS_SITES.find((s) => s.id === id)!;
  const room = detailedRoom(site.id);
  const finish = room ? roomFinish(room) : undefined;
  const color =
    finish?.wall ??
    (site.theme === "lab"
      ? "#8aafba"
      : site.theme === "arts"
        ? "#bb9a8a"
        : site.theme === "sport"
          ? "#719b8a"
          : "#b7aa91");
  return (
    <group>
      <color attach="background" args={["#91aabd"]} />
      <ambientLight intensity={room ? 0.35 : 0.8} />
      <hemisphereLight args={["#e8f1ee", "#756552", room ? 0.9 : 1.1]} />
      <directionalLight
        position={[5, 9, 4]}
        color={room ? "#fff0d7" : "#ffffff"}
        intensity={1.8}
        castShadow
      />
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[20, 0.24, 16]} />
        <meshStandardMaterial color={finish?.floor ?? "#c8bca2"} roughness={0.85} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 9.6, 2.2, 0]}>
          <boxGeometry args={[0.3, 4.4, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 2.2, -7.6]}>
        <boxGeometry args={[20, 4.4, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {[-1, 1].map((x) => (
        <mesh key={x} position={[x * 6, 2.2, 7.6]}>
          <boxGeometry args={[7, 4.4, 0.3]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, -7.35]}>
        <boxGeometry args={[6, 1.8, 0.1]} />
        <meshStandardMaterial color={room === "museum" ? "#1f3846" : "#2b5551"} />
      </mesh>
      {room && <InteriorDetails room={room} floor={floor} />}
      {!room &&
        site.theme !== "sport" &&
        ROOM_TABLES.map(({ x, z }) => (
            <group key={x + ":" + z} position={[x, 0, z]}>
              <mesh position={[0, site.theme === "dorm" ? 0.55 : 0.85, 0]}>
                <boxGeometry args={[ROOM_TABLE_SIZE.width, 0.15, ROOM_TABLE_SIZE.depth]} />
                <meshStandardMaterial
                  color={site.theme === "dorm" ? "#89aeb0" : "#9e805c"}
                />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[1.4, 0.5, 0.65]} />
                <meshStandardMaterial color="#627e78" />
              </mesh>
              {site.theme === "lab" ? (
                <mesh position={[0, 1.25, 0]}>
                  <boxGeometry args={[0.65, 0.65, 0.12]} />
                  <meshStandardMaterial
                    color="#2f5968"
                    emissive="#71c4d5"
                    emissiveIntensity={0.3}
                  />
                </mesh>
              ) : (
                <mesh
                  position={[
                    site.theme === "dorm" ? -0.6 : 0,
                    site.theme === "dorm" ? 0.72 : 1,
                    0,
                  ]}
                >
                  <boxGeometry args={[0.5, 0.12, 0.4]} />
                  <meshStandardMaterial color="#f2e3bc" />
                </mesh>
              )}
            </group>
        ))}
      {site.id === "library" && <LibraryShelves floor={floor} />}
      {site.theme === "sport" && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <ringGeometry args={[1.7, 1.77, 40]} />
            <meshBasicMaterial color="#e9dbb1" />
          </mesh>
          <mesh position={[0, 0.03, 0]}>
            <boxGeometry args={[17, 0.02, 0.06]} />
            <meshBasicMaterial color="#e9dbb1" />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 8, 0, 0]}>
              <mesh position={[0, 2.3, 0]}>
                <boxGeometry args={[0.1, 4.6, 0.1]} />
                <meshStandardMaterial color="#607d79" />
              </mesh>
              <mesh position={[0, 3.3, 0]}>
                <boxGeometry args={[0.12, 1.2, 2]} />
                <meshStandardMaterial color="#e6e1cd" />
              </mesh>
              <mesh
                position={[-side * 0.5, 3, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[0.45, 0.04, 6, 20]} />
                <meshStandardMaterial color="#bb7754" />
              </mesh>
            </group>
          ))}
        </>
      )}
      <Sign
        text={site.name + " · " + floor + " 樓"}
        position={[0, 4.5, -6]}
        scale={1.2}
      />
    </group>
  );
}
function LibraryShelves({ floor }: { floor: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    let i = 0;
    const m = new THREE.Matrix4(),
      color = new THREE.Color();
    const colors = ["#879b86", "#b79472", "#738b9c", "#b8ab84", "#9d7f83"];
    for (const side of [-1, 1])
      for (let row = 0; row < 4; row++)
        for (let n = 0; n < 20; n++) {
          m.makeTranslation(side * 9.1, 0.5 + row * 0.8, -5 + n * 0.24);
          ref.current.setMatrixAt(i, m);
          ref.current.setColorAt(
            i,
            color.set(colors[(n + row + floor) % colors.length]),
          );
          i++;
        }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [floor]);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, 160]}>
        <boxGeometry args={[0.3, 0.5, 0.17]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      {[-1, 1].flatMap((side) =>
        [0.15, 0.95, 1.75, 2.55, 3.35].map((y) => (
          <mesh key={side + ":" + y} position={[side * 9.1, y, -2.7]}>
            <boxGeometry args={[0.55, 0.12, 5.2]} />
            <meshStandardMaterial color="#7e7359" />
          </mesh>
        )),
      )}
    </group>
  );
}
function BaseLights() {
  const lights = useRef<(THREE.PointLight | null)[]>([]),
    acc = useRef(1);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.3) return;
    acc.current = 0;
    const g = useGame.getState(),
      s = useRpg.getState();
    const on =
      g.timeOfDay === "night" ||
      g.timeOfDay === "sunset" ||
      g.timeOfDay === "wet" ||
      s.anomaly === "blackout";
    const near = s.buildings
      .filter((b) => b.kind === "lantern")
      .sort(
        (a, b) =>
          Math.hypot(a.x - g.playerX, a.z - g.playerZ) -
          Math.hypot(b.x - g.playerX, b.z - g.playerZ),
      )
      .slice(0, quality().tier === "low" ? 1 : 2);
    for (let i = 0; i < 2; i++) {
      const l = lights.current[i],
        b = near[i];
      if (!l) continue;
      l.intensity = on && b ? 5 : 0;
      if (b) l.position.set(b.x, terrainHeight(b.x, b.z) + 3.1, b.z);
    }
  });
  return (
    <group>
      {[0, 1].map((i) => (
        <pointLight
          key={i}
          ref={(l) => {
            lights.current[i] = l;
          }}
          color="#f1c58c"
          intensity={0}
          distance={16}
          decay={2}
        />
      ))}
    </group>
  );
}
export function AdventureSystems() {
  const enemies = useRpg((s) => s.enemies),
    buildings = useRpg((s) => s.buildings),
    interior = useRpg((s) => s.interiorId);
  useFrame((_, delta) => tickRpg(delta));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.repeat ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      )
        return;
      const s = useRpg.getState(),
        g = useGame.getState();
      const panels = {
        KeyI: "inventory",
        KeyK: "skills",
        KeyB: "build",
        KeyM: "map",
        KeyL: "journal",
      } as const;
      if (e.code in panels && g.phase !== "title") {
        e.preventDefault();
        const p = panels[e.code as keyof typeof panels];
        s.setPanel(s.panel === p ? null : p);
      }
      if (g.phase !== "playing" || s.panel || g.plaqueId) return;
      if (["KeyJ", "KeyQ", "KeyR", "Digit1", "Digit2"].includes(e.code))
        e.preventDefault();
      if (e.code === "KeyJ") s.attack();
      if (e.code === "KeyQ") s.attack(true);
      if (e.code === "KeyR" && s.buildKind) s.rotate();
      if (e.code === "Digit1") s.useItem("coffee");
      if (e.code === "Digit2") s.useItem("tea");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  if (interior) return null;
  return (
    <group>
      {enemies.map((enemy) => (
        <Mob key={enemy.id} enemy={enemy} />
      ))}
      {buildings.map((building) => (
        <Placed key={building.id} building={building} />
      ))}
      <Supplies />
      <BuildGhost />
      <Pulse />
      <BaseLights />
    </group>
  );
}
