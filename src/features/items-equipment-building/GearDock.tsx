import { useStore } from "zustand";
import { useGame } from "../../game/store";
import { inventory, useRpg } from "../../game/rpg/store";
import { factOf } from "./catalog";
import { craftIds, craftRecipe, planCraft } from "./craft";
import { gearBonus, instanceFor } from "./gear";
import type { GearQuality, GearSlot } from "./types";

const SLOT_LABEL: Record<GearSlot, string> = {
  tool: "主工具",
  accessory: "配件",
  pack: "背包",
};

/**
 * Three slots, craft reasons, and a comparison. The badge button stays on
 * the existing detail card so the old equip() path is unchanged.
 */
export function GearDock() {
  const loadout = useRpg((s) => s.loadout);
  const gear = useRpg((s) => s.gear);
  const buildings = useRpg((s) => s.buildings);
  const playerX = useGame((s) => s.playerX);
  const playerZ = useGame((s) => s.playerZ);
  useStore(inventory.store, (s) => s.slots);
  const near = (kind: "research" | "supply") =>
    buildings.some(
      (building) =>
        building.kind === kind && building.hp > 0 && Math.hypot(building.x - playerX, building.z - playerZ) <= 6,
    );
  const nearResearch = near("research");
  const nearSupply = near("supply");
  const owned = (id: string) => inventory.count(id) > 0;
  const bonus = gearBonus(loadout, gear, owned);
  return (
    <section className="ad-gear" aria-label="裝備槽">
      <div className="ad-section-line">
        <h3>裝備</h3>
        <span>負重 {bonus.carry}</span>
      </div>
      <div className="ad-gear-slots">
        {(["tool", "accessory", "pack"] as const).map((slot) => {
          const id = loadout[slot];
          const fact = id ? factOf(id) : null;
          const worn = fact ? instanceFor(gear, fact.id) : null;
          return (
            <button
              key={slot}
              type="button"
              className="ad-gear-slot ad-raise"
              onClick={() => {
                if (id) useRpg.getState().equipItem(id);
              }}
            >
              <small>{SLOT_LABEL[slot]}</small>
              <strong>{fact ? `${fact.icon} ${fact.name}` : "空"}</strong>
              <span>
                {worn && fact?.durability ? `耐久 ${Math.ceil(worn.durability)}` : fact ? fact.effect : "尚未裝備"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="ad-gear-note">
        {bonus.light > 0
          ? "野外燈會在停電時照亮。"
          : bonus.survey > 0
            ? `調查距離 +${bonus.survey} 公尺。`
            : bonus.gather > 0
              ? "補給時會多取一份筆記。"
              : "主工具、配件、背包各一件。徽章仍是配件，不加第二次生命。"}
      </p>
      <div className="ad-gear-craft" aria-label="製作">
        {craftIds().map((id) => {
          const fact = factOf(id);
          const recipe = craftRecipe(id);
          if (!fact || !recipe) return null;
          const plain = planCraft({
            id,
            quality: "plain",
            count: (item) => inventory.count(item),
            loadout,
            nearResearch,
            nearSupply,
          });
          const fine = planCraft({
            id,
            quality: "fine",
            count: (item) => inventory.count(item),
            loadout,
            nearResearch,
            nearSupply,
          });
          const other = loadout[fact.slot ?? "tool"];
          const compare =
            fact.slot && other && other !== id ? `現在的${SLOT_LABEL[fact.slot]}是${factOf(other)?.name ?? other}。` : "";
          return (
            <article key={id}>
              <header>
                <span>
                  {fact.icon} {fact.name}
                </span>
                <small>{fact.slot ? SLOT_LABEL[fact.slot] : fact.category === "consumable" ? "消耗" : "物品"}</small>
              </header>
              <p>{fact.effect}</p>
              {compare ? <p>{compare}</p> : null}
              <p>{plain.ok ? "可以製作。" : plain.reason}</p>
              <div>
                <button type="button" disabled={!plain.ok} onClick={() => useRpg.getState().craft(id, "plain")}>
                  製作
                </button>
                {fact.durability ? (
                  <button type="button" disabled={!fine.ok} onClick={() => useRpg.getState().craft(id, "fine")}>
                    精工
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function qualityLabel(quality: GearQuality) {
  return quality === "fine" ? "精工" : "普通";
}
