/** Title camera center. A rebuilt canvas starts here until the follow rig seeds. */
export const TITLE_ORBIT = { x: -13, y: 31.5, z: 13 };

/** Title camera. Reduced motion stays on the orbit centre instead of drifting. */
export function titleCamera(elapsed: number, reduced: boolean) {
  if (reduced) return { x: TITLE_ORBIT.x, y: TITLE_ORBIT.y, z: TITLE_ORBIT.z };
  return {
    x: TITLE_ORBIT.x + Math.sin(elapsed * 0.1) * 2.2,
    y: TITLE_ORBIT.y,
    z: TITLE_ORBIT.z + Math.cos(elapsed * 0.08) * 1.8,
  };
}
