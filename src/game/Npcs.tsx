import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Student } from "./Student";
import { terrainHeight } from "./world";

const PATHS: [number, number][][] = [
  [
    [0, 40],
    [0, 22],
    [0, 8],
    [0, -12],
    [0, 8],
    [0, 22],
  ],
  [
    [-5.1, 36],
    [-5.1, 16],
    [5.1, 16],
    [5.1, 36],
  ],
  [
    [14, -28],
    [24, -2],
    [4, -14],
    [14, -28],
  ],
  [
    [48, -14],
    [46, 14],
    [36, 8],
    [48, -14],
  ],
  [
    [2.4, 74],
    [2.4, 52],
    [2.4, 44],
    [2.4, 52],
  ],
];

const ACCENTS = ["#1a3f6d", "#3d4f63", "#5b3d32", "#1a3f6d", "#2c4a3a"];

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

  useFrame((_, raw) => {
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
    }
  });

  return (
    <group ref={ref}>
      <Student speed={0.7} accent={accent} castShadow={false} />
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
