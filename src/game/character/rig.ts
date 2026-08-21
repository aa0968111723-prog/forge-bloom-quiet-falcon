import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The student's armature.
 * ========================
 *
 * A real skeleton — `THREE.Bone` hierarchy, a `SkinnedMesh`, per-vertex skin
 * weights — authored in code rather than imported. Two reasons that is the
 * right call here: every other asset in this campus is procedural and
 * license-clean by construction, and a hand-built rig can be shaped to the
 * exact stylised proportions the scene already uses instead of dragging in a
 * differently-proportioned stock character.
 *
 * Geometry is authored directly in **bind space** (i.e. positioned where each
 * limb sits in the rest pose). `THREE.Skeleton` then derives its bone inverses
 * from the bones' rest world matrices, so no extra binding step is needed.
 *
 * Only the limbs and torso are skinned. The head, hair, face and backpack are
 * ordinary meshes parented to the `head` / `chest` bones: they move rigidly
 * with their bone, which is exactly correct and avoids pointless weight
 * painting on parts that never deform.
 */
export type BoneName =
  | "hips"
  | "spine"
  | "chest"
  | "neck"
  | "head"
  | "upperArmL"
  | "lowerArmL"
  | "upperArmR"
  | "lowerArmR"
  | "upperLegL"
  | "lowerLegL"
  | "footL"
  | "upperLegR"
  | "lowerLegR"
  | "footR";

/** Rest offsets, each relative to its parent bone, in metres. */
const SKELETON_DEF: { name: BoneName; parent: BoneName | null; offset: [number, number, number] }[] = [
  { name: "hips", parent: null, offset: [0, 0.86, 0] },
  { name: "spine", parent: "hips", offset: [0, 0.12, 0] },
  { name: "chest", parent: "spine", offset: [0, 0.16, 0] },
  { name: "neck", parent: "chest", offset: [0, 0.18, 0] },
  { name: "head", parent: "neck", offset: [0, 0.09, 0] },
  // Arms hang down the -Y axis, so a positive X rotation swings them forward.
  { name: "upperArmL", parent: "chest", offset: [-0.2, 0.13, 0] },
  { name: "lowerArmL", parent: "upperArmL", offset: [0, -0.2, 0] },
  { name: "upperArmR", parent: "chest", offset: [0.2, 0.13, 0] },
  { name: "lowerArmR", parent: "upperArmR", offset: [0, -0.2, 0] },
  { name: "upperLegL", parent: "hips", offset: [-0.085, -0.02, 0] },
  { name: "lowerLegL", parent: "upperLegL", offset: [0, -0.38, 0] },
  { name: "footL", parent: "lowerLegL", offset: [0, -0.38, 0] },
  { name: "upperLegR", parent: "hips", offset: [0.085, -0.02, 0] },
  { name: "lowerLegR", parent: "upperLegR", offset: [0, -0.38, 0] },
  { name: "footR", parent: "lowerLegR", offset: [0, -0.38, 0] },
];

export const BONE_ORDER: BoneName[] = SKELETON_DEF.map((b) => b.name);

export type Rig = {
  /** Add this to the scene; it is the skeleton's root bone. */
  root: THREE.Bone;
  bones: Record<BoneName, THREE.Bone>;
  skeleton: THREE.Skeleton;
};

/** Build a fresh armature. Each character instance needs its own. */
export function buildRig(): Rig {
  const bones = {} as Record<BoneName, THREE.Bone>;
  const ordered: THREE.Bone[] = [];
  for (const def of SKELETON_DEF) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(...def.offset);
    bones[def.name] = bone;
    ordered.push(bone);
    if (def.parent) bones[def.parent].add(bone);
  }
  const root = bones.hips;
  // Rest world matrices must be current before Skeleton derives its inverses.
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(ordered);
  return { root, bones, skeleton };
}

/** World-space rest position of a bone, for authoring geometry in bind space. */
function restPosition(bones: Record<BoneName, THREE.Bone>, name: BoneName): THREE.Vector3 {
  return new THREE.Vector3().setFromMatrixPosition(bones[name].matrixWorld);
}

const SKIN = new THREE.Color("#e9c9a8");
const HAIR = new THREE.Color("#2b2320");
const SHORTS = new THREE.Color("#8d8168");
const SHOE = new THREE.Color("#f2efe8");

/**
 * A capsule spanning two rest points, skinned to `bone` and blending to
 * `parentBone` near the proximal end so elbows and knees crease instead of
 * shearing.
 */
function limb(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  boneIndex: number,
  parentIndex: number,
  color: THREE.Color,
  /** Fraction of the limb over which the parent's influence falls off. */
  blend = 0.34,
): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10);
  // CapsuleGeometry runs along +Y centred on the origin; stand it between the
  // two points.
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  geo.applyQuaternion(quat);
  geo.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  applySkin(geo, from, dir, length, boneIndex, parentIndex, blend);
  paint(geo, color);
  return geo;
}

/** Per-vertex skin indices/weights, blended along the limb's own axis. */
function applySkin(
  geo: THREE.BufferGeometry,
  from: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  boneIndex: number,
  parentIndex: number,
  blend: number,
) {
  const pos = geo.attributes.position;
  const indices = new Uint16Array(pos.count * 4);
  const weights = new Float32Array(pos.count * 4);
  const axis = dir.clone().normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(from);
    // 0 at the joint this limb pivots on, 1 at its far end.
    const t = length > 0 ? THREE.MathUtils.clamp(v.dot(axis) / length, 0, 1) : 1;
    const w = blend > 0 ? THREE.MathUtils.smoothstep(t, 0, blend) : 1;
    indices[i * 4] = boneIndex;
    indices[i * 4 + 1] = parentIndex;
    weights[i * 4] = w;
    weights[i * 4 + 1] = 1 - w;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
}

function paint(geo: THREE.BufferGeometry, color: THREE.Color) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
}

/** Rigid part: every vertex fully weighted to one bone. */
function rigid(
  geo: THREE.BufferGeometry,
  boneIndex: number,
  color: THREE.Color,
): THREE.BufferGeometry {
  const count = geo.attributes.position.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
  geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(weights, 4));
  paint(geo, color);
  return geo;
}

/**
 * Skinned body geometry in bind space: torso, arms, legs, feet.
 * `accent` colours the shirt, which is how NPCs are told apart.
 */
export function buildBodyGeometry(rig: Rig, accent: string): THREE.BufferGeometry {
  const idx = (name: BoneName) => BONE_ORDER.indexOf(name);
  const p = (name: BoneName) => restPosition(rig.bones, name);
  const shirt = new THREE.Color(accent);
  const parts: THREE.BufferGeometry[] = [];

  // Torso: hips → chest, then chest → neck, so the spine can bend.
  parts.push(limb(p("hips"), p("chest"), 0.17, idx("spine"), idx("hips"), shirt, 0.5));
  parts.push(limb(p("chest"), p("neck"), 0.163, idx("chest"), idx("spine"), shirt, 0.5));

  for (const side of ["L", "R"] as const) {
    const upperArm = `upperArm${side}` as BoneName;
    const lowerArm = `lowerArm${side}` as BoneName;
    const upperLeg = `upperLeg${side}` as BoneName;
    const lowerLeg = `lowerLeg${side}` as BoneName;
    const foot = `foot${side}` as BoneName;

    // Sleeve down to the elbow, bare forearm below it.
    parts.push(limb(p(upperArm), p(lowerArm), 0.063, idx(upperArm), idx("chest"), shirt));
    const wrist = p(lowerArm).clone().add(new THREE.Vector3(0, -0.2, 0));
    parts.push(limb(p(lowerArm), wrist, 0.052, idx(lowerArm), idx(upperArm), SKIN));

    parts.push(limb(p(upperLeg), p(lowerLeg), 0.086, idx(upperLeg), idx("hips"), SHORTS));
    parts.push(limb(p(lowerLeg), p(foot), 0.058, idx(lowerLeg), idx(upperLeg), SKIN));

    // Sneaker: a box sitting at the ankle, extending forward.
    const shoe = new THREE.BoxGeometry(0.11, 0.09, 0.24);
    const ankle = p(foot);
    shoe.translate(ankle.x, ankle.y + 0.03, ankle.z + 0.045);
    parts.push(rigid(shoe, idx(foot), SHOE));
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error("failed to merge character geometry");
  merged.computeVertexNormals();
  return merged;
}

export { HAIR, SKIN };
