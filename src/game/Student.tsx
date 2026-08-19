import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type StudentProps = {
  speed?: number;
  speedRef?: { current: number };
  accent?: string;
  castShadow?: boolean;
};

export function Student({ speed = 0, speedRef, accent = "#1a3f6d", castShadow = true }: StudentProps) {
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
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
        <mesh position={[0, 1.42, 0]} castShadow={castShadow}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#1a1714" roughness={0.8} />
        </mesh>
        <mesh position={[0, 1.38, 0.03]} castShadow={castShadow}>
          <sphereGeometry args={[0.145, 12, 12]} />
          <meshStandardMaterial color="#e2c2a4" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.08, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[0.18, 0.38, 4, 8]} />
          <meshStandardMaterial color={accent} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.98, 0.12]} castShadow={castShadow}>
          <boxGeometry args={[0.28, 0.22, 0.06]} />
          <meshStandardMaterial color="#f3eee4" roughness={0.7} />
        </mesh>
        <mesh ref={leftArm} position={[-0.24, 1.14, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[0.055, 0.32, 3, 6]} />
          <meshStandardMaterial color={accent} roughness={0.55} />
        </mesh>
        <mesh ref={rightArm} position={[0.24, 1.14, 0]} castShadow={castShadow}>
          <capsuleGeometry args={[0.055, 0.32, 3, 6]} />
          <meshStandardMaterial color={accent} roughness={0.55} />
        </mesh>
      </group>
      <mesh ref={leftLeg} position={[-0.09, 0.42, 0]} castShadow={castShadow}>
        <capsuleGeometry args={[0.065, 0.38, 3, 6]} />
        <meshStandardMaterial color="#2a2c32" roughness={0.7} />
      </mesh>
      <mesh ref={rightLeg} position={[0.09, 0.42, 0]} castShadow={castShadow}>
        <capsuleGeometry args={[0.065, 0.38, 3, 6]} />
        <meshStandardMaterial color="#2a2c32" roughness={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.38, 12]} />
        <meshBasicMaterial color="#0d243f" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}
