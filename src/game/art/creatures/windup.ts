/**
 * Visual windup for the quiz creature.
 *
 * The store only moves `timer` while the simulation is running, and it moves
 * in buckets of at least 50 ms. Between those buckets the graphic eases
 * forward. While a panel, plaque, or other hold freezes `tickRpg`, the timer
 * stays put, so the graphic must stay put too. `Math.max` still lets a real
 * tick catch up; it must not be fed frames that the simulation never played.
 */
export function nextWindupProgress(
  visual: number,
  timer: number,
  duration: number,
  dt: number,
  paused: boolean,
): number {
  if (duration <= 0) return 1;
  const real = Math.min(1, Math.max(0, 1 - timer / duration));
  if (paused) return visual;
  return Math.max(real, Math.min(1, visual + Math.max(0, dt) / duration));
}
