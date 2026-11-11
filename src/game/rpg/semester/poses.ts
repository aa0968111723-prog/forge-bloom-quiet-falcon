import { DISCIPLINES, type Discipline } from "../data.ts";
import { FIXED_DT } from "../physics/index.ts";
import {
  STRIDE_LENGTH,
  TIME_SCALE_RANGE,
  idleClip,
  runClip,
  walkClip,
} from "../../character/clips.ts";

const idle = idleClip();
const walk = walkClip();
const run = runClip();

/**
 * Durations the semester sim uses.
 * Idle, walk and run are the existing clips. Attack, dodge and hurt match the
 * times already published by the adventure store (0.46 / 0.45 / 0.4).
 * There is no separate cast or down clip on the rig; those stay poses.
 */
export const POSE_TIMES = {
  idle: idle.duration,
  walk: walk.duration,
  run: run.duration,
  strideWalk: STRIDE_LENGTH.walk,
  strideRun: STRIDE_LENGTH.run,
  timeScaleMin: TIME_SCALE_RANGE.min,
  timeScaleMax: TIME_SCALE_RANGE.max,
  /** Swing lock. Damage is resolved on the same step the swing starts. */
  attack: 0.46,
  attackHitAt: 0,
  dodge: 1.25,
  dodgeIframe: 0.45,
  hurt: 0.4,
  down: 0,
} as const;

export type PoseName =
  | "idle"
  | "walk"
  | "run"
  | "attack"
  | "cast"
  | "dodge"
  | "hurt"
  | "down";

/** Smallest fixed-step count that covers `seconds`. */
export function secondsToSteps(seconds: number): number {
  return Math.max(0, Math.ceil(seconds / FIXED_DT - 1e-9));
}

export const ATTACK_STEPS = secondsToSteps(POSE_TIMES.attack);
export const IFRAME_STEPS = secondsToSteps(POSE_TIMES.dodgeIframe);
export const DODGE_STEPS = secondsToSteps(POSE_TIMES.dodge);
export const HURT_STEPS = secondsToSteps(POSE_TIMES.hurt);

/** Cast recovery is the discipline cooldown already published in DISCIPLINES. */
export function castSteps(discipline: Discipline): number {
  return secondsToSteps(DISCIPLINES[discipline].cooldown);
}

/**
 * A swing connects only on its opening step, which is when the hit query runs.
 * Later steps of the same pose are recovery and do not strike again.
 */
export function swingConnects(attackStep: number, step: number): boolean {
  return step === attackStep;
}
