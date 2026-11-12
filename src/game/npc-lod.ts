import type { QualityTier } from "./quality";

/** High tier keeps the detailed kit out to 140 m. Low tier uses the stand-in and a shorter range. */
export function npcDrawRange(tier: QualityTier): number {
  return tier === "low" ? 90 : 140;
}

/** The detailed NPC kit is the high-tier mesh. Low tier keeps the procedural student. */
export function npcUsesDetailedKit(tier: QualityTier): boolean {
  return tier === "high";
}
