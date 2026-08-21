import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STRIDE_LENGTH, TIME_SCALE_RANGE, idleClip, runClip, walkClip } from "./clips";

/**
 * Speed-driven animation blending.
 *
 * Three actions run continuously with weights that sum to one, rather than
 * discrete state transitions with `crossFadeTo`. Continuous weights are the
 * right model here because the controller's speed is itself continuous and can
 * hover anywhere — a state machine would thrash at the walk/run boundary,
 * whereas a weight ramp simply sits half-way and looks like a jog.
 *
 * Foot sliding is handled by driving each gait's `timeScale` from ground speed
 * over its stride length, so a step lands roughly where the foot is planted.
 * Both gaits share one phase clock so their legs stay in sync while blended;
 * without that they would scissor through each other mid-cross-fade.
 */
const WALK_FULL = 2.2; // m/s at which the walk is at full weight
const RUN_START = 4.2; // m/s where the run begins to take over
const RUN_FULL = 6.6; // m/s at which the run is at full weight

export type AnimationHandles = {
  mixer: THREE.AnimationMixer | null;
};

/** Live blend weights, exposed for the headless animation test. */
export type BlendWeights = { idle: number; walk: number; run: number; walkRate: number };

export function useCharacterAnimation(
  root: THREE.Object3D | null,
  speedRef: { current: number } | undefined,
  fallbackSpeed: number,
  /** Called each frame with the current blend, for test instrumentation. */
  onBlend?: (weights: BlendWeights) => void,
): AnimationHandles {
  const clips = useMemo(() => ({ idle: idleClip(), walk: walkClip(), run: runClip() }), []);
  const state = useRef<{
    mixer: THREE.AnimationMixer;
    idle: THREE.AnimationAction;
    walk: THREE.AnimationAction;
    run: THREE.AnimationAction;
  } | null>(null);

  useEffect(() => {
    if (!root) return;
    const mixer = new THREE.AnimationMixer(root);
    const idle = mixer.clipAction(clips.idle);
    const walk = mixer.clipAction(clips.walk);
    const run = mixer.clipAction(clips.run);
    for (const action of [idle, walk, run]) {
      action.play();
      action.setEffectiveWeight(0);
      action.enabled = true;
    }
    idle.setEffectiveWeight(1);
    state.current = { mixer, idle, walk, run };
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      state.current = null;
    };
  }, [root, clips]);

  useFrame((_, rawDelta) => {
    const s = state.current;
    if (!s) return;
    const delta = Math.min(rawDelta, 0.08);
    const speed = speedRef?.current ?? fallbackSpeed;

    // Weights: idle → walk → run, each fading in as the previous saturates.
    const moving = THREE.MathUtils.smoothstep(speed, 0.15, WALK_FULL);
    const running = THREE.MathUtils.smoothstep(speed, RUN_START, RUN_FULL);
    const idleW = 1 - moving;
    const runW = moving * running;
    const walkW = moving * (1 - running);

    s.idle.setEffectiveWeight(idleW);
    s.walk.setEffectiveWeight(walkW);
    s.run.setEffectiveWeight(runW);

    // Cadence from ground speed, clamped so nothing ever becomes a blur.
    const clamp = (v: number) =>
      THREE.MathUtils.clamp(v, TIME_SCALE_RANGE.min, TIME_SCALE_RANGE.max);
    s.walk.timeScale = clamp(speed / STRIDE_LENGTH.walk);
    s.run.timeScale = clamp(speed / STRIDE_LENGTH.run);

    // Keep the two gaits phase-locked: while both have weight, the run follows
    // the walk's normalised phase so the legs never scissor through each other.
    if (walkW > 0.001 && runW > 0.001) {
      const walkPhase = (s.walk.time % clips.walk.duration) / clips.walk.duration;
      s.run.time = walkPhase * clips.run.duration;
    }

    onBlend?.({ idle: idleW, walk: walkW, run: runW, walkRate: s.walk.timeScale });
    s.mixer.update(delta);
  });

  return { mixer: state.current?.mixer ?? null };
}
