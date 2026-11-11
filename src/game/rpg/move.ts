/** Adventure walk and sprint caps, metres per second. */
export const WALK = 4.6;
export const SPRINT = 7.8;

/**
 * Planar speed the body aims at before damping, from a zeroed start.
 * Stick magnitude scales whichever cap the sprint hold already chose.
 * A harder push stays inside that cap and never becomes sprint by itself.
 */
export function moveTargetSpeed(moveX: number, moveY: number, sprint: boolean) {
  const mag = Math.min(1, Math.hypot(moveX, moveY));
  return mag * (sprint ? SPRINT : WALK);
}
