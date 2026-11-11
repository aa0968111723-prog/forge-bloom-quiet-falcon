/** high = 細緻, auto = 自動, low = 省電. Existing quality thresholds are not changed here. */
export const QUALITY_TIERS = ["high", "auto", "low"] as const;

export type QualityTierId = (typeof QUALITY_TIERS)[number];

export const QUALITY_TIER_LABELS = {
  high: "細緻",
  auto: "自動",
  low: "省電",
} as const;

/**
 * Tier switches may later affect shadows, lights, LOD, particles, and textures.
 * Collision, walkability, and combat resolution stay on in every tier, including 省電.
 */
export const QUALITY_SWITCH = {
  tiers: QUALITY_TIERS,
  labels: QUALITY_TIER_LABELS,
  collisionStaysEnabled: true,
  walkabilityStaysEnabled: true,
  combatResolutionStaysEnabled: true,
  statement:
    "切換細緻、自動或省電時，只調整畫面負擔。碰撞、可走性與戰鬥判定維持不變，不得為了省電關閉。",
} as const;
