import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type StudentProps = {
  speed?: number;
  speedRef?: { current: number };
  accent?: string;
  castShadow?: boolean;
};

/**
 * A Tamkang student, stylised: tee in the accent colour, khaki shorts,
 * sneakers, backpack. Same animation rig and props as before — only the
 * proportions and dressing changed, so Player and Npcs are untouched.
 */
export function Student({ speed = 0, speedRef, accent = "#1a3f6d", castShadow = true }: StudentProps) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const s = Math.min((speedRef?.current ?? speed * 4.6) / 4.6, 1.4);
    const swing = Math.sin(clock.elapsedTime * (6 + s * 6)) * s * 0.55;
    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.7;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.7;
    if (body.current) body.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 8)) * s * 0.04;
  });

  return (
    <group>
      <group ref={body}>
        {/* Head: face, hair cap, fringe. */}
        <mesh position={[0, 1.5, 0.015]} castShadow={castShadow}>
          <sphereGeometry args={[0.148, 16, 14]} />
          <meshStandardMaterial color="#e9c9a8" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.56, -0.03]} castShadow={castShadow}>
          <sphereGeometry args={[0.152, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshStandardMaterial color="#2b2320" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.585, 0.075]} rotation={[0.5, 0, 0]} castShadow={false}>
          <sphereGeometry args={[0.105, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4]} />
          <meshStandardMaterial color="#2b2320" roughness={0.75} />
        </mesh>
        {/* Neck + tee. */}
        <mesh position={[0, 1.36, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.08, 8]} />
          <meshStandardMaterial color="#e9c9a8" roughness={0.62} />
        </mesh>
        <mesh position={[0, 1.14, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[0.155, 0.3, 6, 12]} />
          <meshStandardMaterial color={accent} roughness={0.72} />
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
        {/* Arms: sleeve + skin, hinged at the shoulder. */}
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side < 0 ? leftArm : rightArm}
            position={[side * 0.21, 1.27, 0]}
          >
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
