/** Hold a clock when reduced motion is on. Water ripples read this time. */
export function stepWaterTime(current: number, delta: number, reduced: boolean) {
  if (reduced || delta <= 0) return current;
  return current + delta;
}

/** Slow cloud-field drift, in metres, wrapping at 1600. Reduced motion holds it. */
export function stepCloudDrift(current: number, delta: number, reduced: boolean) {
  if (reduced || delta <= 0) return current;
  return (current + delta * 1.6) % 1600;
}
