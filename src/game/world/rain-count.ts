import type { QualityTier } from "../quality";

/** Falling streaks around the camera. Low tier keeps the wet look and drops the count. */
export function rainStreaks(tier: QualityTier): number {
  return tier === "low" ? 64 : 320;
}
