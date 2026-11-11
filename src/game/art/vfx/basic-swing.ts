/**
 * The basic attack slash.
 *
 * The attack clip (0.46 s) chambers the right arm at 0.07 s and carries it
 * across to the left by 0.25 s. This pose follows that window. It does not
 * use `attackFx.range`: the slash is an arm's length in front of the body,
 * not a disc the size of the hit test.
 *
 * Character right is local -X. Parent yaw already maps local -Z to the way
 * the player faces, so a positive yaw offset turns the blade toward the right.
 */
import * as THREE from "three";

export const BASIC_SWING_DURATION = 0.46;
const CHAMBER = 0.06;
const FOLLOW = 0.25;
/** Local X of the blade: character right, then character left. */
const X_RIGHT = -0.55;
const X_LEFT = 0.48;

export type SwingPose = { visible: boolean; x: number; z: number; roll: number; opacity: number };

/** Local -Z is in front of the chest. The chamber used to sit in the torso plane. */
const Z_CHAMBER = -0.72;
const Z_FOLLOW = -0.38;

export function basicSwingPose(age: number, reduced: boolean): SwingPose {
  const visible = age >= 0 && age < BASIC_SWING_DURATION;
  if (!visible) return { visible: false, x: X_LEFT, z: Z_FOLLOW, roll: 0.2, opacity: 0 };
  const u = reduced ? 1 : THREE.MathUtils.clamp((age - CHAMBER) / (FOLLOW - CHAMBER), 0, 1);
  // Local +X is the character's left. The swipe starts on the right.
  const x = X_RIGHT + (X_LEFT - X_RIGHT) * u;
  const z = Z_CHAMBER + (Z_FOLLOW - Z_CHAMBER) * u;
  const roll = 0.25 - u * 0.5;
  const fadeIn = reduced ? 1 : THREE.MathUtils.clamp(age / 0.04, 0, 1);
  const fadeOut = 1 - THREE.MathUtils.smoothstep(age, 0.3, BASIC_SWING_DURATION);
  return { visible: true, x, z, roll, opacity: fadeIn * fadeOut * (reduced ? 0.4 : 0.9) };
}

/** A short blade, about the length of a forearm. Built once. */
export function basicSwingGeometry(detailed: boolean) {
  const arc = new THREE.TorusGeometry(0.46, detailed ? 0.04 : 0.055, detailed ? 6 : 4, detailed ? 14 : 8, 1.5);
  // Stand the arc upright in front of the chest.
  arc.rotateX(Math.PI / 2);
  return arc;
}
