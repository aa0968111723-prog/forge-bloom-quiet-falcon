import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type StudentProps = {
  speed?: number;
  speedRef?: { current: number };
  accent?: string;
  castShadow?: boolean;
  /** Head yaw/pitch offset in radians, relative to the body's facing. */
  lookRef?: { current: { yaw: number; pitch: number } };
};

/**
 * A Tamkang student, stylised for readability at third-person distance: clear
 * hair mass, painted face (eyes, brows, mouth — memorability lives here), tee
 * in the accent colour, khaki shorts, sneakers, canvas backpack.
 *
 * Animation is procedural and cheap: leg/arm swing driven by speed, a breath
 * cycle at idle, a lean into acceleration. The rig (refs + props) is the same
 * one Player and Npcs have always used.
 */
const FACE_CACHE = new Map<string, THREE.CanvasTexture>();

function faceTexture(): THREE.CanvasTexture {
  const key = "face";
  const hit = FACE_CACHE.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#e9c9a8";
    ctx.fillRect(0, 0, 128, 128);
    // Eyes: large, dark, slightly glossy — the anime read.
    for (const sx of [-1, 1]) {
      const x = 64 + sx * 20;
      ctx.fillStyle = "#232025";
      ctx.beginPath();
      ctx.ellipse(x, 66, 7.5, 10.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x - 2.4, 62, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Brow
      ctx.strokeStyle = "#4a3a30";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(x, 56, 9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    // Soft smile
    ctx.strokeStyle = "#a3654d";
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(64, 84, 8, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
    // Blush
    ctx.fillStyle = "rgba(228, 130, 110, 0.28)";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(64 + sx * 30, 80, 7, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  FACE_CACHE.set(key, t);
  return t;
}

export function Student({
  speed = 0,
  speedRef,
  accent = "#1a3f6d",
  castShadow = true,
  lookRef,
}: StudentProps) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const trunk = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const smoothSpeed = useRef(0);
  const face = useMemo(() => faceTexture(), []);

  useFrame(({ clock }, delta) => {
    const raw = Math.min((speedRef?.current ?? speed * 4.6) / 4.6, 1.4);
    // Smooth the drive signal so gait blends instead of snapping.
    smoothSpeed.current += (raw - smoothSpeed.current) * Math.min(1, delta * 7);
    const s = smoothSpeed.current;
    const t = clock.elapsedTime;
    const swing = Math.sin(t * (6 + s * 6)) * s * 0.62;

    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.75;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.75;

    if (body.current) {
      // Walk bob + idle breath.
      const bob = Math.abs(Math.sin(t * 8)) * s * 0.045;
      const breath = (1 - Math.min(1, s * 3)) * Math.sin(t * 1.7) * 0.008;
      body.current.position.y = bob + breath;
    }
    if (trunk.current) {
      // Lean forward with speed, sway with the stride.
      trunk.current.rotation.x = s * 0.1;
      trunk.current.rotation.z = Math.sin(t * (6 + s * 6)) * s * 0.035;
    }
    if (head.current) {
      // Glance toward whatever the player is near, with a little idle drift so
      // the character never looks frozen.
      const look = lookRef?.current;
      const idle = Math.sin(t * 0.42) * 0.09 * (1 - Math.min(1, s * 2));
      head.current.rotation.y = (look?.yaw ?? 0) + idle;
      head.current.rotation.x = look?.pitch ?? 0;
    }
  });

  return (
    <group ref={trunk}>
      <group ref={body}>
        {/* Head, pivoting at the neck so it can turn to look at things. */}
        <group ref={head} position={[0, 1.4, 0]}>
          {/* Sphere UV puts canvas-centre content at +X; -90° turns it to +Z. */}
          <mesh position={[0, 0.1, 0.015]} rotation={[0, -Math.PI / 2, 0]} castShadow={castShadow}>
            <sphereGeometry args={[0.15, 18, 16]} />
            <meshStandardMaterial map={face} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.155, -0.035]} castShadow={castShadow}>
            <sphereGeometry args={[0.157, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial color="#2b2320" roughness={0.6} />
          </mesh>
          {/* Fringe: three overlapping tufts instead of a helmet rim. */}
          {([-1, 0, 1] as const).map((k) => (
            <mesh
              key={k}
              position={[k * 0.062, 0.188, 0.088 - Math.abs(k) * 0.014]}
              rotation={[0.62, k * 0.28, 0]}
              castShadow={false}
            >
              <sphereGeometry args={[0.065, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
              <meshStandardMaterial color="#2b2320" roughness={0.6} />
            </mesh>
          ))}
          {/* Side hair covering the ears. */}
          {([-1, 1] as const).map((sx) => (
            <mesh key={sx} position={[sx * 0.132, 0.092, -0.01]} castShadow={false}>
              <sphereGeometry args={[0.052, 8, 8]} />
              <meshStandardMaterial color="#2b2320" roughness={0.6} />
            </mesh>
          ))}
        </group>
        {/* Neck + tee. */}
        <mesh position={[0, 1.36, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
          <meshStandardMaterial color="#e9c9a8" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.14, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[0.155, 0.3, 6, 12]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
        </mesh>
        {/* Collar detail. */}
        <mesh position={[0, 1.3, 0.02]} rotation={[0.4, 0, 0]}>
          <torusGeometry args={[0.075, 0.016, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#f2efe8" roughness={0.7} />
        </mesh>
        {/* Backpack. */}
        <mesh position={[0, 1.16, -0.17]} castShadow={castShadow}>
          <boxGeometry args={[0.24, 0.32, 0.13]} />
          <meshStandardMaterial color="#c9b48a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.28, -0.2]}>
          <boxGeometry args={[0.2, 0.09, 0.1]} />
          <meshStandardMaterial color="#b5a077" roughness={0.8} />
        </mesh>
        {([-1, 1] as const).map((sx) => (
          <mesh key={sx} position={[sx * 0.07, 1.18, -0.105]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.035, 0.3, 0.02]} />
            <meshStandardMaterial color="#8d7a56" roughness={0.8} />
          </mesh>
        ))}
        {/* Arms: sleeve + skin, hinged at the shoulder. */}
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side < 0 ? leftArm : rightArm} position={[side * 0.21, 1.27, 0]}>
            <mesh position={[0, -0.07, 0]} castShadow={castShadow}>
              <capsuleGeometry args={[0.055, 0.1, 4, 8]} />
              <meshStandardMaterial color={accent} roughness={0.72} />
            </mesh>
            <mesh position={[0, -0.24, 0]} castShadow={castShadow}>
              <capsuleGeometry args={[0.042, 0.2, 4, 8]} />
              <meshStandardMaterial color="#e9c9a8" roughness={0.62} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Legs: khaki shorts + skin + sneakers, hinged at the hip. */}
      {([-1, 1] as const).map((side) => (
        <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.085, 0.86, 0]}>
          <mesh position={[0, -0.14, 0]} castShadow={castShadow}>
            <capsuleGeometry args={[0.072, 0.16, 4, 8]} />
            <meshStandardMaterial color="#8d8168" roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.42, 0]} castShadow={castShadow}>
            <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
            <meshStandardMaterial color="#e9c9a8" roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.62, 0.04]} castShadow={castShadow}>
            <boxGeometry args={[0.11, 0.09, 0.24]} />
            <meshStandardMaterial color="#f2efe8" roughness={0.55} />
          </mesh>
        </group>
      ))}

      {/* Soft contact shadow blob. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.34, 14]} />
        <meshBasicMaterial color="#0d243f" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}
