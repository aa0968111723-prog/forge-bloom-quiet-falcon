/** Shared with the interior ceiling mesh. The slab top meets the 4.4 m wall top. */
export const INTERIOR_CEILING_Y = 4.32;
export const INTERIOR_CEILING_THICKNESS = 0.16;
const INTERIOR_CAMERA_MARGIN = 0.35;

/** Follow rig numbers. follow.ts uses these same values for the seeded eye. */
export const FOLLOW_DISTANCE = 5.15;
export const FOLLOW_LOOK = 1.32;
export const FOLLOW_HEAD = 0.42;

/** Highest follow-camera eye that stays under the ceiling. */
export function interiorCameraCap(floorY = 0) {
  return floorY + INTERIOR_CEILING_Y - INTERIOR_CEILING_THICKNESS / 2 - INTERIOR_CAMERA_MARGIN;
}

/** Pitch whose seeded eye sits on interiorCameraCap. Steeper pitches would enter the slab. */
export function followPitchUnderCeiling(floorY = 0) {
  const rise = interiorCameraCap(floorY) - floorY - FOLLOW_LOOK - FOLLOW_HEAD;
  return Math.asin(Math.min(1, Math.max(-1, rise / FOLLOW_DISTANCE)));
}

export function followEyeHeight(floorY: number, pitch: number) {
  return floorY + FOLLOW_LOOK + FOLLOW_HEAD + Math.sin(pitch) * FOLLOW_DISTANCE;
}
