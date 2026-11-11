import { basicAttackDamage, levelForXp, lifeCap } from "../rules.ts";
import type { GrowthState } from "./types.ts";

/**
 * Xp that the shipped levelForXp maps onto `level`.
 * levelForXp(xp) = min(30, floor(sqrt(xp / 60)) + 1), so the first xp of level L is 60 * (L - 1)^2.
 * The call below checks that inverse still matches the live function.
 */
export function xpToReachLevel(level: number) {
  const target = Math.min(30, Math.max(1, Math.floor(level)));
  const xp = 60 * (target - 1) * (target - 1);
  if (levelForXp(xp) !== target) {
    throw new Error("level curve drifted from levelForXp");
  }
  return xp;
}

const EARLY_XP = xpToReachLevel(1);
const MID_XP = xpToReachLevel(6);
const LATE_XP = xpToReachLevel(16);

export const GROWTH_BANDS = [
  {
    id: "early",
    label: "早期",
    xp: EARLY_XP,
    level: levelForXp(EARLY_XP),
    throughLevel: 5,
    reason:
      "1 到 5 級沿用 levelForXp。每級 1 點，剛好把既有技能從 1 階點到 5 階；升階仍要筆記 rank×5 與學分 rank。生命用 lifeCap，不另寫公式。",
  },
  {
    id: "mid",
    label: "中期",
    xp: MID_XP,
    level: levelForXp(MID_XP),
    throughLevel: 15,
    reason:
      "6 級起多出來的點數才夠打開學院分支。分支前置是主幹第 3 階，所以早期不能把分支一次點完。到達等級仍是 levelForXp 的結果。",
  },
  {
    id: "late",
    label: "晚期",
    xp: LATE_XP,
    level: levelForXp(LATE_XP),
    throughLevel: 30,
    reason:
      "16 級起才能點結尾節點。30 級封頂是 levelForXp 自己的上限，這裡只標晚段節奏，不改曲線。",
  },
] as const;

export type GrowthBandId = (typeof GROWTH_BANDS)[number]["id"];

export function bandForXp(xp: number) {
  const level = levelForXp(xp);
  if (level >= GROWTH_BANDS[2].level) return GROWTH_BANDS[2];
  if (level >= GROWTH_BANDS[1].level) return GROWTH_BANDS[1];
  return GROWTH_BANDS[0];
}

export function pointBudget(xp: number) {
  return Math.max(0, levelForXp(xp) - 1);
}

export function pointsLeft(xp: number, spentPoints: number) {
  return Math.max(0, pointBudget(xp) - Math.max(0, spentPoints));
}

/** Level readout for D and the HUD. Numbers come from the shipped rules. */
export function levelGrowthView(state: Pick<GrowthState, "xp" | "equipped" | "spentPoints" | "skillRank">) {
  const level = levelForXp(state.xp);
  const band = bandForXp(state.xp);
  const nextLevel = level >= 30 ? null : level + 1;
  return {
    xp: state.xp,
    level,
    life: lifeCap(state.xp, state.equipped),
    attack: basicAttackDamage(state.xp, state.equipped),
    band: band.id,
    bandLabel: band.label,
    reason: band.reason,
    pointsTotal: pointBudget(state.xp),
    pointsSpent: state.spentPoints,
    pointsLeft: pointsLeft(state.xp, state.spentPoints),
    skillRank: state.skillRank,
    nextLevel,
    nextLevelXp: nextLevel === null ? null : xpToReachLevel(nextLevel),
  };
}
