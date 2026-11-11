import * as THREE from "three";
import type { V3 } from "../../shared/builder.ts";
import { STUDENT_KIT, type BoneName } from "./spec.ts";

export type KitRig = {
  root: THREE.Bone;
  bones: Record<BoneName, THREE.Bone>;
  skeleton: THREE.Skeleton;
  index: (name: BoneName) => number;
  /** World-space rest position of a bone. */
  at: (name: BoneName) => THREE.Vector3;
  /** World rest position offset by `d`, as a tuple for geometry authoring. */
  p: (name: BoneName, d?: V3) => V3;
};

export const BONE_NAMES = STUDENT_KIT.bones.map((b) => b.name) as BoneName[];

export function buildKitRig(): KitRig {
  const bones = {} as Record<BoneName, THREE.Bone>;
  const ordered: THREE.Bone[] = [];
  for (const def of STUDENT_KIT.bones) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...(def.offset as unknown as V3));
    bones[def.name] = bone;
    ordered.push(bone);
    if (def.parent) bones[def.parent as BoneName].add(bone);
  }
  const root = bones.hips;
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(ordered);
  const at = (name: BoneName) => new THREE.Vector3().setFromMatrixPosition(bones[name].matrixWorld);
  return {
    root,
    bones,
    skeleton,
    index: (name) => BONE_NAMES.indexOf(name),
    at,
    p: (name, d = [0, 0, 0]) => at(name).add(new THREE.Vector3(...d)).toArray() as V3,
  };
}

/** Bones animated by upper-body actions (attack, interact, hurt overlays). */
export const UPPER_BODY: BoneName[] = [
  "spine",
  "chest",
  "neck",
  "head",
  "upperArmL",
  "lowerArmL",
  "handL",
  "upperArmR",
  "lowerArmR",
  "handR",
];
