import { terrainHeight } from "../world";
import {
  FOLLOW_DISTANCE,
  FOLLOW_HEAD,
  FOLLOW_LOOK,
  followPitchUnderCeiling,
  interiorCameraCap,
  INTERIOR_CEILING_THICKNESS,
  INTERIOR_CEILING_Y,
} from "./interior-ceiling";

export {
  FOLLOW_DISTANCE,
  followPitchUnderCeiling,
  interiorCameraCap,
  INTERIOR_CEILING_THICKNESS,
  INTERIOR_CEILING_Y,
};

/** Title camera center. A rebuilt canvas starts here until the follow rig seeds. */
export const TITLE_ORBIT = { x: -13, y: 31.5, z: 13 };

export const FOLLOW_PITCH = 0.22;

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
