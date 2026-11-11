/**
 * Student kit animation clips, sampled into quaternion tracks.
 *
 * Conventions for this rig (front = +Z, limbs hang -Y):
 *   leg/arm forward swing   rotation.x < 0
 *   knee flex               lowerLeg.x > 0
 *   elbow flex              lowerArm.x < 0
 *   left arm out (abduct)   upperArmL.z > 0   (right: < 0)
 *   torso lean forward      spine/chest.x > 0
 *   turn to the left        .y > 0
 *   look down               head.x > 0
 *
 * Gait clips are functions of phase so walk and run share a phase and blend
 * without the legs scissoring. One-shot actions are pose keys with eased
 * holds; the runtime decides which bones each action may override.
 */
import * as THREE from "three";
import type { BoneName } from "./spec.ts";
import { STUDENT_KIT } from "./spec.ts";

type E3 = [number, number, number];
export type Pose = Partial<Record<BoneName, E3>> & { hipsY?: number; hipsZ?: number };

const FPS = 30;
const TAU = Math.PI * 2;
const HIPS_REST = new THREE.Vector3(...(STUDENT_KIT.bones[0].offset as unknown as E3));

const q = new THREE.Quaternion();
const e = new THREE.Euler();

function quatTrack(bone: BoneName, times: number[], eulers: E3[]) {
  const values: number[] = [];
  let prev: THREE.Quaternion | null = null;
  for (const angles of eulers) {
    q.setFromEuler(e.set(angles[0], angles[1], angles[2], "XYZ"));
    // Keep consecutive keys on the same hemisphere so slerp never spins.
    if (prev && prev.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
    values.push(q.x, q.y, q.z, q.w);
    prev = q.clone();
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

function hipsTrack(times: number[], offsets: E3[]) {
  const values: number[] = [];
  for (const [x, y, z] of offsets) values.push(HIPS_REST.x + x, HIPS_REST.y + y, HIPS_REST.z + z);
  return new THREE.VectorKeyframeTrack("hips.position", times, values);
}

function sampleTimes(duration: number) {
  const n = Math.max(2, Math.round(duration * FPS));
  return Array.from({ length: n + 1 }, (_, i) => (duration * i) / n);
}

type Gait = {
  duration: number;
  swing: number;
  knee: number;
  armSwing: number;
  elbow: number;
  lean: number;
  bob: number;
  run: boolean;
};

function gaitClip(name: string, g: Gait) {
  const times = sampleTimes(g.duration);
  const tracks: THREE.KeyframeTrack[] = [];
  const phase = (t: number, off: number) => (t / g.duration + off) * TAU;
  for (const [side, off, sgn] of [
    ["L", 0, 1],
    ["R", 0.5, -1],
  ] as const) {
    tracks.push(
      quatTrack(
        `upperLeg${side}`,
        times,
        times.map((t) => [-Math.sin(phase(t, off)) * g.swing - (g.run ? 0.12 : 0.04), 0, sgn * 0.02]),
      ),
    );
    tracks.push(
      quatTrack(
        `lowerLeg${side}`,
        times,
        times.map((t) => {
          // Bend most while the leg swings through, stay nearly straight in stance.
          const s = Math.max(0, Math.sin(phase(t, off) + Math.PI * 0.55));
          return [g.knee * Math.pow(s, 1.25) + (g.run ? 0.22 : 0.07), 0, 0];
        }),
      ),
    );
    tracks.push(
      quatTrack(
        `foot${side}`,
        times,
        times.map((t) => [Math.sin(phase(t, off) + Math.PI * 0.4) * g.swing * 0.35 + (g.run ? 0.1 : 0), 0, 0]),
      ),
    );
    tracks.push(
      quatTrack(
        `upperArm${side}`,
        times,
        times.map((t) => [Math.sin(phase(t, off)) * g.armSwing - 0.05, 0, sgn * (g.run ? 0.14 : 0.08)]),
      ),
    );
    tracks.push(
      quatTrack(
        `lowerArm${side}`,
        times,
        times.map((t) => [-g.elbow - Math.max(0, -Math.sin(phase(t, off))) * g.elbow * 0.25, 0, 0]),
      ),
    );
    tracks.push(quatTrack(`hand${side}`, times, times.map(() => [0.1, sgn * -0.15, 0])));
  }
  tracks.push(quatTrack("spine", times, times.map((t) => [g.lean, Math.sin(phase(t, 0)) * 0.05, 0])));
  tracks.push(quatTrack("chest", times, times.map((t) => [g.lean * 0.35, Math.sin(phase(t, 0)) * 0.11, 0])));
  tracks.push(quatTrack("neck", times, times.map((t) => [-g.lean * 0.6, -Math.sin(phase(t, 0)) * 0.06, 0])));
  tracks.push(
    quatTrack(
      "hips",
      times,
      times.map((t) => [0, -Math.sin(phase(t, 0)) * 0.09, Math.sin(phase(t, 0)) * 0.025]),
    ),
  );
  tracks.push(
    hipsTrack(
      times,
      times.map((t) => {
        const s = Math.abs(Math.sin(phase(t, 0)));
        // Walk: highest while the legs pass under the body. Run: highest in flight.
        const y = g.run ? -g.bob * (1 - s) + g.bob * 0.4 : -g.bob * s + g.bob * 0.5;
        return [0, y - (g.run ? 0.025 : 0.008), 0];
      }),
    ),
  );
  return new THREE.AnimationClip(name, g.duration, tracks);
}

export function idleClip() {
  const duration = 4;
  const times = sampleTimes(duration);
  const p = (t: number) => (t / duration) * TAU;
  const tracks: THREE.KeyframeTrack[] = [
    quatTrack("spine", times, times.map((t) => [0.02 + Math.sin(p(t)) * 0.012, 0, 0])),
    quatTrack("chest", times, times.map((t) => [Math.sin(p(t)) * 0.02, 0, 0])),
    quatTrack("neck", times, times.map((t) => [-Math.sin(p(t)) * 0.015, Math.sin(p(t) * 0.5) * 0.07, 0])),
    quatTrack("head", times, times.map((t) => [0.02, Math.sin(p(t) * 0.5) * 0.04, Math.sin(p(t)) * 0.015])),
    quatTrack("hips", times, times.map((t) => [0, 0, Math.sin(p(t) * 0.5) * 0.018])),
    hipsTrack(times, times.map((t) => [Math.sin(p(t) * 0.5) * 0.006, Math.sin(p(t)) * 0.005, 0])),
  ];
  for (const [side, sgn] of [
    ["L", 1],
    ["R", -1],
  ] as const) {
    tracks.push(quatTrack(`upperArm${side}`, times, times.map((t) => [-0.05 + Math.sin(p(t) + sgn) * 0.02, 0, sgn * 0.06])));
    tracks.push(quatTrack(`lowerArm${side}`, times, times.map(() => [-0.22, 0, 0])));
    tracks.push(quatTrack(`hand${side}`, times, times.map(() => [0.06, sgn * -0.2, 0])));
    tracks.push(quatTrack(`upperLeg${side}`, times, times.map((t) => [0, 0, sgn * 0.015 + Math.sin(p(t) * 0.5) * 0.012])));
    tracks.push(quatTrack(`lowerLeg${side}`, times, times.map(() => [0.03, 0, 0])));
    tracks.push(quatTrack(`foot${side}`, times, times.map(() => [-0.02, 0, 0])));
  }
  return new THREE.AnimationClip("idle", duration, tracks);
}

export const walkClip = () =>
  gaitClip("walk", { duration: 0.92, swing: 0.62, knee: 0.95, armSwing: 0.5, elbow: 0.32, lean: 0.07, bob: 0.03, run: false });

export const runClip = () =>
  gaitClip("run", { duration: 0.64, swing: 0.84, knee: 1.45, armSwing: 0.8, elbow: 1.25, lean: 0.22, bob: 0.06, run: true });

/** Smootherstep easing between pose keys: snappy contact, soft settle. */
function ease(x: number) {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function poseClip(name: string, duration: number, keys: { t: number; pose: Pose }[]) {
  const times = sampleTimes(duration);
  const bones = new Set<BoneName>();
  for (const k of keys) for (const b of Object.keys(k.pose)) if (b !== "hipsY" && b !== "hipsZ") bones.add(b as BoneName);
  const at = (t: number) => {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const u = ease(Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1))));
    return { a: a.pose, b: b.pose, u };
  };
  const tracks: THREE.KeyframeTrack[] = [];
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  for (const bone of bones) {
    const values: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (const t of times) {
      const { a, b, u } = at(t);
      const ea = a[bone] ?? [0, 0, 0];
      const eb = b[bone] ?? [0, 0, 0];
      qa.setFromEuler(e.set(ea[0], ea[1], ea[2], "XYZ"));
      qb.setFromEuler(e.set(eb[0], eb[1], eb[2], "XYZ"));
      qa.slerp(qb, u);
      if (prev && prev.dot(qa) < 0) qa.set(-qa.x, -qa.y, -qa.z, -qa.w);
      values.push(qa.x, qa.y, qa.z, qa.w);
      prev = qa.clone();
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }
  if (keys.some((k) => k.pose.hipsY !== undefined || k.pose.hipsZ !== undefined)) {
    tracks.push(
      hipsTrack(
        times,
        times.map((t) => {
          const { a, b, u } = at(t);
          const y = (a.hipsY ?? 0) + ((b.hipsY ?? 0) - (a.hipsY ?? 0)) * u;
          const z = (a.hipsZ ?? 0) + ((b.hipsZ ?? 0) - (a.hipsZ ?? 0)) * u;
          return [0, y, z];
        }),
      ),
    );
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

/** Basic attack (J): a right-hand swipe right → left, 0.46 s like `attackUntil`. */
export const attackClip = () =>
  poseClip("attack", 0.46, [
    { t: 0, pose: {} },
    {
      t: 0.07,
      pose: {
        spine: [0.05, -0.22, 0],
        chest: [0.04, -0.5, 0],
        head: [0, 0.32, 0],
        upperArmR: [-0.75, 0, -1.05],
        lowerArmR: [-1.25, 0, 0],
        handR: [0, 0.2, -0.3],
        upperArmL: [-0.45, 0, 0.35],
        lowerArmL: [-1.0, 0, 0],
      },
    },
    {
      t: 0.15,
      pose: {
        spine: [0.1, 0.2, 0],
        chest: [0.08, 0.55, 0],
        head: [0, -0.3, 0],
        upperArmR: [-1.4, 0, 0.3],
        lowerArmR: [-0.12, 0, 0],
        handR: [0, 0.35, 0.2],
        upperArmL: [0.4, 0, 0.18],
        lowerArmL: [-1.25, 0, 0],
      },
    },
    {
      t: 0.25,
      pose: {
        spine: [0.08, 0.25, 0],
        chest: [0.05, 0.62, 0],
        head: [0, -0.32, 0],
        upperArmR: [-1.05, 0, 0.6],
        lowerArmR: [-0.45, 0, 0],
        handR: [0, 0.25, 0.25],
        upperArmL: [0.3, 0, 0.15],
        lowerArmL: [-1.1, 0, 0],
      },
    },
    { t: 0.46, pose: {} },
  ]);

/** Skill (Q), engineering: both palms slam the ground; full body. */
export const skillClip = () =>
  poseClip("skill", 0.6, [
    { t: 0, pose: {} },
    {
      t: 0.06,
      pose: {
        hipsY: -0.04,
        spine: [-0.18, 0, 0],
        chest: [-0.12, 0, 0],
        neck: [0.05, 0, 0],
        upperArmL: [-2.45, 0, 0.25],
        upperArmR: [-2.45, 0, -0.25],
        lowerArmL: [-0.45, 0, 0],
        lowerArmR: [-0.45, 0, 0],
        upperLegL: [-0.22, 0, 0.05],
        lowerLegL: [0.35, 0, 0],
        upperLegR: [0.12, 0, -0.05],
        lowerLegR: [0.28, 0, 0],
      },
    },
    {
      t: 0.15,
      pose: {
        hipsY: -0.27,
        spine: [0.55, 0, 0],
        chest: [0.32, 0, 0],
        neck: [-0.35, 0, 0],
        head: [-0.15, 0, 0],
        upperArmL: [-0.95, 0, 0.2],
        upperArmR: [-0.95, 0, -0.2],
        lowerArmL: [-0.12, 0, 0],
        lowerArmR: [-0.12, 0, 0],
        handL: [-0.6, 0, 0],
        handR: [-0.6, 0, 0],
        upperLegL: [-1.15, 0, 0.12],
        lowerLegL: [1.55, 0, 0],
        footL: [-0.38, 0, 0],
        upperLegR: [-0.35, 0, -0.12],
        lowerLegR: [1.45, 0, 0],
        footR: [0.25, 0, 0],
      },
    },
    {
      t: 0.27,
      pose: {
        hipsY: -0.24,
        spine: [0.48, 0, 0],
        chest: [0.28, 0, 0],
        neck: [-0.3, 0, 0],
        head: [-0.12, 0, 0],
        upperArmL: [-0.9, 0, 0.25],
        upperArmR: [-0.9, 0, -0.25],
        lowerArmL: [-0.2, 0, 0],
        lowerArmR: [-0.2, 0, 0],
        handL: [-0.5, 0, 0],
        handR: [-0.5, 0, 0],
        upperLegL: [-1.05, 0, 0.12],
        lowerLegL: [1.4, 0, 0],
        footL: [-0.32, 0, 0],
        upperLegR: [-0.32, 0, -0.12],
        lowerLegR: [1.32, 0, 0],
        footR: [0.22, 0, 0],
      },
    },
    { t: 0.6, pose: {} },
  ]);

/** Dodge (Space): a low dash, 0.45 s to match the i-frame window. */
export const dodgeClip = () =>
  poseClip("dodge", 0.45, [
    { t: 0, pose: {} },
    {
      t: 0.05,
      pose: { hipsY: -0.07, spine: [0.32, 0, 0], upperLegL: [-0.4, 0, 0], lowerLegL: [0.5, 0, 0], upperLegR: [0.25, 0, 0], lowerLegR: [0.5, 0, 0] },
    },
    {
      t: 0.13,
      pose: {
        hipsY: -0.15,
        spine: [0.68, 0, 0],
        chest: [0.18, 0, 0],
        neck: [-0.35, 0, 0],
        head: [-0.2, 0, 0],
        upperArmL: [0.95, 0, 0.32],
        upperArmR: [0.95, 0, -0.32],
        lowerArmL: [-0.45, 0, 0],
        lowerArmR: [-0.45, 0, 0],
        upperLegL: [-0.95, 0, 0],
        lowerLegL: [0.7, 0, 0],
        footL: [-0.2, 0, 0],
        upperLegR: [0.62, 0, 0],
        lowerLegR: [0.95, 0, 0],
        footR: [0.5, 0, 0],
      },
    },
    {
      t: 0.28,
      pose: {
        hipsY: -0.09,
        spine: [0.42, 0, 0],
        chest: [0.1, 0, 0],
        neck: [-0.2, 0, 0],
        upperArmL: [0.5, 0, 0.25],
        upperArmR: [0.5, 0, -0.25],
        lowerArmL: [-0.5, 0, 0],
        lowerArmR: [-0.5, 0, 0],
        upperLegL: [-0.5, 0, 0],
        lowerLegL: [0.5, 0, 0],
        upperLegR: [0.25, 0, 0],
        lowerLegR: [0.55, 0, 0],
      },
    },
    { t: 0.45, pose: {} },
  ]);

/** Hurt: flinch back with a guard, 0.4 s like `hurtUntil`. */
export const hurtClip = () =>
  poseClip("hurt", 0.4, [
    { t: 0, pose: {} },
    {
      t: 0.06,
      pose: {
        spine: [-0.32, 0.1, 0],
        chest: [-0.22, 0.12, 0],
        neck: [-0.18, 0, 0],
        head: [-0.18, -0.15, 0.08],
        upperArmL: [-0.85, 0, 0.6],
        upperArmR: [-0.85, 0, -0.6],
        lowerArmL: [-1.45, 0, 0],
        lowerArmR: [-1.45, 0, 0],
        handL: [0.3, 0, 0],
        handR: [0.3, 0, 0],
      },
    },
    {
      t: 0.17,
      pose: {
        spine: [-0.12, 0.04, 0],
        chest: [-0.08, 0.05, 0],
        head: [-0.05, -0.05, 0],
        upperArmL: [-0.45, 0, 0.35],
        upperArmR: [-0.45, 0, -0.35],
        lowerArmL: [-0.9, 0, 0],
        lowerArmR: [-0.9, 0, 0],
      },
    },
    { t: 0.4, pose: {} },
  ]);

/** Interact (E): reach out and press a stamp, 0.6 s. */
export const interactClip = () =>
  poseClip("interact", 0.6, [
    { t: 0, pose: {} },
    {
      t: 0.18,
      pose: {
        spine: [0.22, 0, 0],
        chest: [0.14, 0.1, 0],
        head: [0.3, 0, 0],
        upperArmR: [-1.2, 0, -0.08],
        lowerArmR: [-0.35, 0, 0],
        handR: [0.35, 0, 0],
        upperArmL: [-0.15, 0, 0.12],
        lowerArmL: [-0.4, 0, 0],
      },
    },
    {
      t: 0.32,
      pose: {
        spine: [0.26, 0, 0],
        chest: [0.16, 0.1, 0],
        head: [0.34, 0, 0],
        upperArmR: [-1.12, 0, -0.08],
        lowerArmR: [-0.2, 0, 0],
        handR: [0.75, 0, 0],
        upperArmL: [-0.15, 0, 0.12],
        lowerArmL: [-0.4, 0, 0],
      },
    },
    { t: 0.6, pose: {} },
  ]);

export function allClips() {
  return [idleClip(), walkClip(), runClip(), attackClip(), skillClip(), dodgeClip(), hurtClip(), interactClip()];
}

/** Bones each one-shot may override; the rest keep locomotion. */
export const ACTION_LAYERS: Record<string, "upper" | "full"> = {
  attack: "upper",
  interact: "upper",
  hurt: "upper",
  skill: "full",
  dodge: "full",
};

/**
 * Metres covered per gait cycle, used to lock cadence to ground speed.
 * Measured, not guessed: the planted foot's speed relative to the hips at one
 * cycle per second (scripts/art-pipeline.test.mjs re-measures it).
 */
export const STRIDE = { walk: 2.96, run: 5.8 };
