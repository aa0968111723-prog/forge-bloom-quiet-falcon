/** Fixed simulation step. Gameplay damage advances only by this many seconds. */
export const FIXED_DT = 1 / 60;

/**
 * Largest number of fixed steps one frame may run.
 * Time beyond this window is dropped, not stored for later frames.
 */
export const MAX_CATCHUP_STEPS = 5;

export type SimClock = {
  /** How many fixed steps this frame should simulate. Zero while paused. */
  step: (frameDtSeconds: number) => number;
  pause: () => void;
  resume: () => void;
};

/**
 * Seconds in, fixed step count out.
 * Pausing clears the accumulator so the gap is not replayed as damage.
 */
export function createSimClock(): SimClock {
  let accumulator = 0;
  let paused = false;
  return {
    pause() {
      paused = true;
      accumulator = 0;
    },
    resume() {
      paused = false;
      accumulator = 0;
    },
    step(frameDtSeconds: number) {
      if (paused) return 0;
      if (!Number.isFinite(frameDtSeconds) || frameDtSeconds <= 0) return 0;
      const capped = Math.min(frameDtSeconds, FIXED_DT * MAX_CATCHUP_STEPS);
      accumulator += capped;
      let steps = 0;
      while (steps < MAX_CATCHUP_STEPS && accumulator >= FIXED_DT - 1e-9) {
        accumulator -= FIXED_DT;
        steps += 1;
      }
      if (accumulator < 1e-9) accumulator = 0;
      if (steps === MAX_CATCHUP_STEPS) accumulator = 0;
      return steps;
    },
  };
}
