import { grantQuestReward, type QuestReward } from "../../game/rpg/growth/progress.ts";
import type { GrowthState } from "../../game/rpg/growth/types.ts";
import type { RewardSpec } from "./types.ts";

export type SettlementPreview = {
  growth: GrowthState;
  paid: boolean;
  xp: number;
  notes: number;
  credit: number;
  claimed: string[];
};

/** Existing quest settlement. A second call with the same quest id pays nothing. */
export function settlementPreview(
  growth: GrowthState,
  questId: string,
  reward: RewardSpec,
): SettlementPreview {
  const spec: QuestReward = {
    xp: reward.xp,
    notes: reward.notes,
    credit: reward.credit,
  };
  const next = grantQuestReward(growth, questId, spec);
  const xp = Math.max(0, next.xp - growth.xp);
  const notes = Math.max(0, next.materials.notes - growth.materials.notes);
  const credit = Math.max(0, next.materials.credit - growth.materials.credit);
  const claimed = next.claimedQuests.filter(
    (id) => id.startsWith("quest-") && !growth.claimedQuests.includes(id),
  );
  return {
    growth: next,
    paid: xp > 0 || notes > 0 || credit > 0 || claimed.length > 0,
    xp,
    notes,
    credit,
    claimed,
  };
}
