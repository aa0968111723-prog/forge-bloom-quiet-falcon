import { inventory, maxHp, registerVarietySave, useRpg, flushSave } from "../../game/rpg/store.ts";
import { useGame } from "../../game/store.ts";
import { DEPARTMENTS } from "../../game/rpg/data.ts";
import { levelForXp } from "../../game/rpg/rules.ts";
import { collegeOf } from "../../game/rpg/growth/tree.ts";
import { liveGrowth } from "../../game/rpg/narrative-bridge.ts";
import { readMemory } from "./memory.ts";
import { getMemory, registerVarietyPayer, registerVarietySaveFailure, replaceMemory, varietyWriteOk, type PayResult } from "./runtime.ts";
import { settlementPreview } from "./settle.ts";
import type { Caps, RewardIntent } from "./types.ts";

export function readCaps(): Caps {
  const rpg = useRpg.getState();
  const growth = liveGrowth({
    departmentId: rpg.departmentId,
    xp: rpg.xp,
    claimed: rpg.claimed,
    discoveries: rpg.discoveries,
    slots: inventory.slots(),
    skillRank: rpg.skillRank,
    equipped: rpg.equipped,
    boss: rpg.boss,
    lesson: rpg.lesson,
  });
  const department = DEPARTMENTS.find((item) => item.id === rpg.departmentId);
  return {
    equipped: rpg.equipped,
    skillRank: rpg.skillRank,
    built: rpg.built,
    collegeId: collegeOf(growth),
    discipline: department?.discipline ?? null,
  };
}

function payVariety(intent: RewardIntent): PayResult {
  const rpg = useRpg.getState();
  const growth = liveGrowth({
    departmentId: rpg.departmentId,
    xp: rpg.xp,
    claimed: rpg.claimed,
    discoveries: rpg.discoveries,
    slots: inventory.slots(),
    skillRank: rpg.skillRank,
    equipped: rpg.equipped,
    boss: rpg.boss,
    lesson: rpg.lesson,
  });
  const preview = settlementPreview(growth, intent.questId, intent.reward);
  if (!preview.paid) return { paid: false, already: true, xp: 0, notes: 0, credit: 0 };
  const accepted: string[] = [];
  const left: Record<string, number> = {};
  for (const [id, amount] of [
    ["notes", preview.notes],
    ["credit", preview.credit],
  ] as const) {
    if (amount <= 0) continue;
    const result = inventory.add(id, amount);
    if (result.added > 0) accepted.push(`${id} ${result.added}`);
    if (result.overflow > 0) left[id] = result.overflow;
  }
  const claimed = [...rpg.claimed];
  for (const id of preview.claimed) {
    if (!claimed.includes(id)) claimed.push(id);
  }
  const xp = rpg.xp + preview.xp;
  const leveled = levelForXp(xp) > levelForXp(rpg.xp);
  const game = useGame.getState();
  const loot =
    Object.keys(left).length > 0
      ? [
          ...rpg.loot,
          {
            id: `variety-${intent.questId}`,
            x: game.playerX,
            z: game.playerZ,
            items: left,
          },
        ]
      : rpg.loot;
  useRpg.setState({
    xp,
    claimed,
    loot,
    ...(leveled ? { hp: maxHp({ ...rpg, xp }), focus: 100 } : {}),
  });
  rpg.notify(
    preview.xp > 0
      ? `異象紀錄已結算，經驗 +${preview.xp}${accepted.length ? `，${accepted.join("、")}` : ""}。`
      : "這份紀錄已經領過。",
  );
  flushSave();
  return {
    paid: true,
    already: false,
    xp: preview.xp,
    notes: preview.notes,
    credit: preview.credit,
  };
}

registerVarietyPayer(payVariety);
registerVarietySaveFailure(() => {
  useRpg.setState({ saved: "error" });
});
registerVarietySave({
  capture: () => getMemory(),
  restore: (value) => {
    replaceMemory(readMemory(value));
    return varietyWriteOk();
  },
});
