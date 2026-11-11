import type { Discipline } from "./data.ts";

/**
 * One readable mark per college skill. The names match lucide icons.
 * They identify the equipped discipline; they are not a surveyed crest.
 */
export const SKILL_GLYPH: Record<Discipline, string> = {
  engineering: "DraftingCompass",
  science: "FlaskConical",
  humanities: "ScrollText",
  business: "Coins",
  language: "Languages",
  education: "GraduationCap",
  international: "Globe",
  computing: "Cpu",
  health: "HeartPulse",
};
