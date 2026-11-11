/** Field contract enforced by validate.ts. Content files do not carry executable code. */
export const EFFECT_TYPES = [
  "quest-reward",
  "set-flag",
  "set-quest-node",
  "discover-place",
  "remember",
  "cooldown",
] as const;

export const REJECTED_EFFECT_TYPES = [
  "set-hp",
  "add-item",
  "eval",
  "script",
  "mutate-save",
] as const;

export const ANIMATIONS = ["existing:idle", "existing:walk", "existing:run"] as const;

export const FLAG_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
export const EVENT_ID_PATTERN = /^evt-[a-z0-9-]+$/;
export const NPC_ID_PATTERN = /^npc-[a-z0-9-]+$/;
export const QUEST_ID_PATTERN = /^quest-[a-z0-9-]+$/;
export const SKILL_ID_PATTERN = /^college-ability:[a-z0-9-]+$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const DISCLAIMER = "這不是校方公告，也不是真實校園事故。";
