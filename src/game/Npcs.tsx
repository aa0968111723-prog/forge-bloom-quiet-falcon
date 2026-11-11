import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Student } from "./Student";
import { terrainHeight } from "./world";
import { ArtBoundary } from "./art/ArtBoundary";
import { NpcCharacter } from "./art/character/NpcCharacter";

/**
 * NPC walking loops on the real-scale campus. Students walk the avenue paving,
 * loop the colonnade side of 宮燈教室, cross 書卷廣場, and one climbs 克難坡
 * over and over the way freshmen are made to.
 */
const PATHS: [number, number][][] = [
  // 宮燈大道 down-and-back on the stone slab walk.
  [
    [1.4, -18],
    [1.4, -120],
    [1.4, -210],
    [-1.4, -210],
    [-1.4, -120],
    [-1.4, -18],
  ],
  // West colonnade of 宮燈教室: down the arcade, back up the verge.
  [
    [-8.6, -30],
    [-8.6, -180],
    [-5.2, -180],
    [-5.2, -30],
  ],
  // 書卷廣場 diamond, weaving between the scroll blades.
  [
    [0, -254],
    [10, -272],
    [0, -288],
    [-10, -272],
  ],
  // 圖書館 forecourt to the dolphin roundabout and back.
  [
    [10, -296],
    [8, -262],
    [6.6, -232],
    [8, -262],
  ],
  // 克難坡 climber: bottom apron to the plaza and back down.
  [
    [1.8, 82],
    [1.8, 40],
    [1.8, 24],
    [1.8, 40],
  ],
];

const ACCENTS = ["#1a3f6d", "#3d4f63", "#5b3d32", "#1a3f6d", "#2c4a3a"];

/**
 * Roster presets in char.npc-kit, one person per path above (same order).
 * See art/characters/npc-kit/roster.ts for who they are.
 */
const ROSTER = ["avenue-freshman", "colonnade-architect", "plaza-linguist", "library-researcher", "kenan-athlete"];

/** Beyond this the walker is not drawn; the campus is ~1 km across. */
const DRAW_RANGE = 140;

const QA = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qa") === "1";

function Walker({ path, accent, phase }: { path: [number, number][]; accent: string; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  const speed = 1.35 + (phase % 5) * 0.12;
  const distRef = useRef(0);
  const segs = useMemo(() => {
    const lengths: number[] = [];
    let total = 0;
    for (let i = 0; i < path.length; i++) {
      const a = path[i];
      const b = path[(i + 1) % path.length];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      lengths.push(d);
      total += d;
    }
    return { lengths, total };
  }, [path]);

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.08);
    distRef.current = (distRef.current + speed * dt) % segs.total;
    let remain = distRef.current;
    let idx = 0;
    while (remain > segs.lengths[idx] && idx < segs.lengths.length - 1) {
      remain -= segs.lengths[idx];
      idx += 1;
    }
    const a = path[idx];
    const b = path[(idx + 1) % path.length];
    const t = segs.lengths[idx] === 0 ? 0 : remain / segs.lengths[idx];
    const x = a[0] + (b[0] - a[0]) * t;
    const z = a[1] + (b[1] - a[1]) * t;
    const yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
    if (ref.current) {
      ref.current.position.set(x, terrainHeight(x, z), z);
      ref.current.rotation.y = yaw + Math.PI;
      ref.current.visible = Math.hypot(camera.position.x - x, camera.position.z - z) < DRAW_RANGE;
      if (QA) {
        const qa = (window.__npcQA ??= { walkers: [] });
        qa.walkers[phase] = { id: ROSTER[phase % ROSTER.length], x, y: ref.current.position.y, z, yaw: yaw + Math.PI };
      }
    }
  });

  // The previous procedural student remains the stand-in while the kit loads
  // and if it ever fails.
  const standIn = <Student speed={0.7} accent={accent} castShadow={false} />;
  return (
    <group ref={ref}>
      <ArtBoundary id="char.npc-kit" fallback={standIn}>
        <Suspense fallback={standIn}>
          <NpcCharacter presetId={ROSTER[phase % ROSTER.length]} speed={speed} />
        </Suspense>
      </ArtBoundary>
    </group>
  );
}

export function Npcs() {
  return (
    <>
      {PATHS.map((path, i) => (
        <Walker key={i} path={path} accent={ACCENTS[i] ?? "#1a3f6d"} phase={i} />
      ))}
    </>
  );
}
