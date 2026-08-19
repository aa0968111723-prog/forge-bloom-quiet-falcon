import type { JSX } from "react";

/** Shared material props coming out of `surface()`. */
type MaterialProps = JSX.IntrinsicElements["meshStandardMaterial"];

/**
 * Standing bronze figure, used for 驚聲銅像 and 唱自己的歌.
 *
 * Deliberately a simplified massing rather than a portrait: the silhouette (long
 * gown, arms down, slight forward lean) is what reads at the 8–15 m these are
 * actually viewed from, and inventing facial detail would be pretending to a
 * fidelity the reference does not support.
 */
export function BronzeFigure({
  scale = 1,
  material,
}: {
  scale?: number;
  material: MaterialProps;
}) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <capsuleGeometry args={[0.23, 0.72, 4, 12]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 1.28, 0.02]} castShadow>
        <sphereGeometry args={[0.16, 14, 12]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {([-1, 1] as const).map((s) => (
        <mesh key={s} position={[s * 0.26, 0.68, 0.03]} rotation={[0.16, 0, s * 0.1]} castShadow>
          <capsuleGeometry args={[0.07, 0.6, 3, 8]} />
          <meshStandardMaterial {...material} />
        </mesh>
      ))}
      {/* Gown flaring to the base. */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.34, 0.44, 14]} />
        <meshStandardMaterial {...material} />
      </mesh>
    </group>
  );
}

/**
 * Bust on a self-base: head, shoulders, chest cut in the classical bust line.
 * Used for 驚聲銅像 — the real memorial is a bust on a tall pedestal, not a
 * full standing figure.
 */
export function BronzeBust({ scale = 1, material }: { scale?: number; material: MaterialProps }) {
  return (
    <group scale={scale}>
      {/* chest, cut to a taper */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.2, 0.42, 12]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {/* shoulders */}
      <mesh position={[0, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.16, 0.4, 4, 10]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {/* neck + head */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 0.14, 10]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 0.74, 0.01]} castShadow>
        <sphereGeometry args={[0.17, 14, 12]} />
        <meshStandardMaterial {...material} />
      </mesh>
    </group>
  );
}

/**
 * One dolphin of the 海豚里程碑 group: a body arcing through a leap, built from
 * a tapered torus segment so the silhouette actually curves, with snout, dorsal
 * fin and tail flukes at the ends of the arc.
 */
export function Dolphin({
  sign,
  material,
}: {
  sign: number;
  material: MaterialProps;
}) {
  // Arc rises through ~150°; the head end points up-and-forward.
  const R = 1.05;
  return (
    <group rotation={[0, sign > 0 ? 0.5 : -0.4, sign * 0.18]}>
      <mesh rotation={[0, 0, Math.PI * 0.12]} castShadow>
        <torusGeometry args={[R, 0.26, 10, 20, Math.PI * 0.86]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {/* Head + snout at the rising end of the arc. */}
      <group position={[Math.cos(Math.PI * 0.98) * R, Math.sin(Math.PI * 0.98) * R, 0]} rotation={[0, 0, Math.PI * 0.55]}>
        <mesh castShadow>
          <sphereGeometry args={[0.3, 12, 10]} />
          <meshStandardMaterial {...material} />
        </mesh>
        <mesh position={[0, 0.38, 0]} castShadow>
          <coneGeometry args={[0.16, 0.42, 10]} />
          <meshStandardMaterial {...material} />
        </mesh>
      </group>
      {/* Dorsal fin on the back of the arc. */}
      <mesh position={[Math.cos(Math.PI * 0.5) * (R + 0.26), Math.sin(Math.PI * 0.5) * (R + 0.26), 0]} rotation={[0, 0, Math.PI]} castShadow>
        <coneGeometry args={[0.14, 0.5, 4]} />
        <meshStandardMaterial {...material} />
      </mesh>
      {/* Tail flukes at the water end. */}
      <group position={[Math.cos(Math.PI * 0.14) * R, Math.sin(Math.PI * 0.14) * R - 0.06, 0]} rotation={[0, 0, -Math.PI * 0.32]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.34, 0.2, 3]} />
          <meshStandardMaterial {...material} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * 「閱讀的女孩」 on a bench in front of the library: seated figure, open book.
 */
export function ReadingGirl({ material }: { material: MaterialProps }) {
  return (
    <group>
      <mesh position={[0, 0.62, 0]} rotation={[0.2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 4, 10]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 1.02, 0.06]} castShadow>
        <sphereGeometry args={[0.13, 12, 10]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 0.42, 0.24]} rotation={[Math.PI / 2.4, 0, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.4, 3, 8]} />
        <meshStandardMaterial {...material} />
      </mesh>
      <mesh position={[0, 0.72, 0.3]} rotation={[-0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.22]} />
        <meshStandardMaterial color="#e8e2d4" roughness={0.8} />
      </mesh>
    </group>
  );
}
