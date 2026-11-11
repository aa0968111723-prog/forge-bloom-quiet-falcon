import { COLLEGE_IDS, type CollegeId } from "../../departments.ts";
import { DISCIPLINES } from "../data.ts";
import type { AbilityRank, CollegeAbility, RankIndex } from "./types.ts";

/** HUD tag and store.attack both spend 22 focus. Do not retune it here. */
export const SKILL_FOCUS = 22;

/** HUD adds this much damage for each rank above 1. */
export const DAMAGE_PER_RANK = 12;

export const RANK_CAP = 5;

const DISCIPLINE_OF = {
  "liberal-arts": "humanities",
  science: "science",
  engineering: "engineering",
  business: "business",
  "foreign-lang": "language",
  international: "international",
  education: "education",
  ai: "computing",
  "precision-health": "health",
} as const satisfies Record<CollegeId, keyof typeof DISCIPLINES>;

/**
 * Presentation template plus the numeric rider store.attack already applies.
 * heal / focusRestore / knockback are copied from that function, not retuned.
 */
const PRESENTATION = {
  "liberal-arts": { type: "projectile", colorName: "杏橘", heal: 0, focusRestore: 12, knockback: 0 },
  science: { type: "area", colorName: "堇紫", heal: 0, focusRestore: 0, knockback: 0 },
  engineering: { type: "melee-pulse", colorName: "冰川", heal: 0, focusRestore: 0, knockback: 2 },
  business: { type: "heal", colorName: "金穗", heal: 20, focusRestore: 0, knockback: 0 },
  "foreign-lang": { type: "projectile", colorName: "薄荷", heal: 0, focusRestore: 0, knockback: 0 },
  international: { type: "area", colorName: "鋼藍", heal: 0, focusRestore: 12, knockback: 0 },
  education: { type: "heal", colorName: "薔薇", heal: 20, focusRestore: 10, knockback: 0 },
  ai: { type: "projectile", colorName: "青碧", heal: 0, focusRestore: 0, knockback: 0 },
  "precision-health": { type: "heal", colorName: "葉綠", heal: 40, focusRestore: 0, knockback: 0 },
} as const satisfies Record<
  CollegeId,
  {
    type: CollegeAbility["type"];
    colorName: string;
    heal: number;
    focusRestore: number;
    knockback: number;
  }
>;

function ranksFor(base: number): Record<RankIndex, AbilityRank> {
  const ranks = {} as Record<RankIndex, AbilityRank>;
  for (let rank = 1; rank <= RANK_CAP; rank++) {
    const index = rank as RankIndex;
    ranks[index] = {
      rank: index,
      damage: base + (index - 1) * DAMAGE_PER_RANK,
      increment: (index - 1) * DAMAGE_PER_RANK,
      cost: { notes: index * 5, credit: index },
    };
  }
  return ranks;
}

function specialLine(
  description: string,
  effect: { heal: number; focusRestore: number; knockback: number },
) {
  const extra: string[] = [];
  if (effect.heal) extra.push(`生命 +${effect.heal}`);
  if (effect.focusRestore) extra.push(`專注 +${effect.focusRestore}`);
  if (effect.knockback) extra.push(`擊退 ${effect.knockback} 公尺`);
  return extra.length ? `${description}（${extra.join("、")}）` : description;
}

function makeAbility(collegeId: CollegeId): CollegeAbility {
  const discipline = DISCIPLINES[DISCIPLINE_OF[collegeId]];
  const presentation = PRESENTATION[collegeId];
  const effect = {
    heal: presentation.heal,
    focusRestore: presentation.focusRestore,
    knockback: presentation.knockback,
  };
  return {
    collegeId,
    type: presentation.type,
    focus: SKILL_FOCUS,
    cooldown: discipline.cooldown,
    range: discipline.range,
    damage: discipline.damage,
    special: specialLine(discipline.description, effect),
    effect,
    colorName: presentation.colorName,
    skill: discipline.skill,
    label: discipline.label,
    ranks: ranksFor(discipline.damage),
  };
}

export const COLLEGE_ABILITIES: Record<CollegeId, CollegeAbility> = Object.fromEntries(
  COLLEGE_IDS.map((id) => [id, makeAbility(id)]),
) as Record<CollegeId, CollegeAbility>;

/** Cost charged to leave `rank` and learn the next one. Rank 5 has no next buy. */
export function upgradeCost(rank: number) {
  const current = Math.min(RANK_CAP, Math.max(1, Math.floor(rank))) as RankIndex;
  return { notes: current * 5, credit: current };
}
