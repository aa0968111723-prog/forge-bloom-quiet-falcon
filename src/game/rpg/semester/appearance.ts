import { QUALITY_PRESETS, type QualityTier } from "../../quality.ts";

/**
 * Three preset looks on the existing rig.
 * No new mesh is shipped. License stays on the rig we already have.
 */
export const APPEARANCE = [
  {
    id: "existing-uniform",
    license: "existing-rig",
    status: "pending-asset",
    outfit: "校服剪影",
    face: "既有臉部骨架",
    departmentMark: "科系織帶",
  },
  {
    id: "existing-college",
    license: "existing-rig",
    status: "pending-asset",
    outfit: "學院披肩",
    face: "既有臉部骨架",
    departmentMark: "學院色帶",
  },
  {
    id: "existing-club",
    license: "existing-rig",
    status: "pending-asset",
    outfit: "社團外套",
    face: "既有臉部骨架",
    departmentMark: "社團別針",
  },
] as const;

export type AppearanceId = (typeof APPEARANCE)[number]["id"];

export function isAppearanceId(id: string): id is AppearanceId {
  return APPEARANCE.some((look) => look.id === id);
}

/** Low and high tiers keep the same id. Quality only changes the preset flag. */
export function resolveAppearance(id: string, _quality: QualityTier): AppearanceId {
  return isAppearanceId(id) ? id : APPEARANCE[0].id;
}

export function appearanceQuality(tier: QualityTier) {
  return QUALITY_PRESETS[tier];
}
