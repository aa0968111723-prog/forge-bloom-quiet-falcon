/**
 * Shared creature building blocks: a named bone rig and pose-keyed clips.
 *
 * Creatures are one skinned mesh each; parts are rigidly (or softly) weighted
 * to a handful of bones. Clips are pose keys eased with smoothstep and baked
 * at 30 fps, plus a position (and optional uniform scale) track on the body
 * bone so creatures can hop, crouch and crumple.
 */
import * as THREE from "three";
import type { V3 } from "../../shared/builder.ts";

export type CreatureBone = { name: string; parent: string | null; offset: readonly number[] };

export function creatureRig(defs: readonly CreatureBone[]) {
  const bones: Record<string, THREE.Bone> = {};
  const ordered: THREE.Bone[] = [];
  for (const def of defs) {
    const bone = new THREE.Bone();
    bone.name = def.name;
    bone.position.set(def.offset[0], def.offset[1], def.offset[2]);
    bones[def.name] = bone;
    ordered.push(bone);
    if (def.parent) bones[def.parent].add(bone);
  }
  ordered[0].updateMatrixWorld(true);
  const names = defs.map((d) => d.name);
  return {
    bones,
    root: ordered[0],
    skeleton: new THREE.Skeleton(ordered),
    names,
    index: (name: string) => names.indexOf(name),
    at: (name: string) => new THREE.Vector3().setFromMatrixPosition(bones[name].matrixWorld),
  };
}

export type CreatureKey = { t: number; pose: Record<string, V3>; bodyY?: number; scale?: number };

/** Bake pose keys into a clip; `body` gets a position track at `base` + bodyY. */
export function creatureClip(name: string, duration: number, keys: CreatureKey[], body: { bone: string; base: number }) {
  const FPS = 30;
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const ease = (x: number) => x * x * (3 - 2 * x);
  const n = Math.max(2, Math.round(duration * FPS));
  const times = Array.from({ length: n + 1 }, (_, i) => (duration * i) / n);
  const bones = new Set<string>();
  keys.forEach((k) => Object.keys(k.pose).forEach((b) => bones.add(b)));
  const at = (t: number) => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i];
    const b2 = keys[i + 1];
    return { a, b: b2, u: ease(Math.min(1, Math.max(0, (t - a.t) / (b2.t - a.t || 1)))) };
  };
  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of bones) {
    const values: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (const t of times) {
      const { a, b: b2, u } = at(t);
      const ea = a.pose[bone] ?? [0, 0, 0];
      const eb = b2.pose[bone] ?? [0, 0, 0];
      e.set(ea[0] + (eb[0] - ea[0]) * u, ea[1] + (eb[1] - ea[1]) * u, ea[2] + (eb[2] - ea[2]) * u);
      q.setFromEuler(e);
      if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      values.push(q.x, q.y, q.z, q.w);
      prev = q.clone();
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  const bodyY = (k: CreatureKey) => k.bodyY ?? 0;
  const scale = (k: CreatureKey) => k.scale ?? 1;
  tracks.push(
    new THREE.VectorKeyframeTrack(
      `${body.bone}.position`,
      times,
      times.flatMap((t) => {
        const { a, b: b2, u } = at(t);
        return [0, body.base + bodyY(a) + (bodyY(b2) - bodyY(a)) * u, 0];
      }),
    ),
  );
  if (keys.some((k) => k.scale !== undefined)) {
    tracks.push(
      new THREE.VectorKeyframeTrack(
        `${body.bone}.scale`,
        times,
        times.flatMap((t) => {
          const { a, b: b2, u } = at(t);
          const s = scale(a) + (scale(b2) - scale(a)) * u;
          return [s, s, s];
        }),
      ),
    );
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

/** Looping keys from a pose function of phase (0..2π), closed on the first key. */
export function loopKeys(period: number, count: number, pose: (phase: number) => { pose: Record<string, V3>; bodyY?: number }): CreatureKey[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const phase = (i / count) * Math.PI * 2;
    const p = pose(phase);
    return { t: (period * i) / count, pose: p.pose, bodyY: p.bodyY };
  });
}

/** Six-cell grid helper for 512² creature atlases (128 px cells). */
export const creatureCell = (x: number, y: number, w = 1, h = 1) => ({ x: x * 128, y: y * 128, w: w * 128, h: h * 128 });
