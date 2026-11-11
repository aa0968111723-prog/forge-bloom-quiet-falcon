import { terrainHeight } from "../world";

/** Title camera center. A rebuilt canvas starts here until the follow rig seeds. */
export const TITLE_ORBIT = { x: -13, y: 31.5, z: 13 };

export const FOLLOW_PITCH = 0.22;
export const FOLLOW_DISTANCE = 5.15;
const FOLLOW_LOOK = 1.32;
const FOLLOW_HEAD = 0.42;

/**
 * Camera pose behind the player. The frame and the graphics rebuild both use
 * this, so a new canvas does not keep the title orbit.
 */
export function followCameraSeed(pose: {
  x: number;
  z: number;
  yaw: number;
  y?: number;
  pitch?: number;
}) {
  const pitch = pose.pitch ?? FOLLOW_PITCH;
  const y = pose.y ?? terrainHeight(pose.x, pose.z);
  const horizontal = Math.cos(pitch) * FOLLOW_DISTANCE;
  return {
    x: pose.x + Math.sin(pose.yaw) * horizontal,
    y: y + FOLLOW_LOOK + FOLLOW_HEAD + Math.sin(pitch) * FOLLOW_DISTANCE,
    z: pose.z + Math.cos(pose.yaw) * horizontal,
  };
}
