import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useGame } from "../store";
import { useRpg } from "./store";
import { ENEMY_TYPES } from "./data";
import { Dialog } from "./DialogFrame";
import { closeVictory, settleVictoryClose } from "./victory";
import { pressAttrs, pressMark } from "./chrome";
function Victory() {
  useEffect(() => {
    useGame.getState().pause();
    return () => {
      settleVictoryClose();
    };
  }, []);
  return (
    <Dialog
      className="ad-victory"
      title="你走過了這個學期。"
      onClose={closeVictory}
    >
      <span className="ad-eyebrow">SEMESTER COMPLETE</span>
      <p className="ad-lead">
        「期末 · 截止日」已被擊退。領取你的學分與五虎崗徽章，繼續探索校園。
      </p>
      <button type="button" className="ad-primary ad-raise" {...pressAttrs("button", "ready")} onClick={closeVictory}>
        領取獎勵，繼續探索
      </button>
    </Dialog>
  );
}
export function AdventureCombatHud() {
  const { x, z, phase, settingsOpen } = useGame(
    useShallow((s) => ({
      x: s.playerX,
      z: s.playerZ,
      phase: s.phase,
      settingsOpen: s.settingsOpen,
    })),
  );
  const state = useRpg(
    useShallow((s) => {
      let target: (typeof s.enemies)[number] | null = null,
        best = 25;
      if (!s.interiorId)
        for (const e of s.enemies) {
          const d = Math.hypot(x - e.x, z - e.z);
          if (e.hp > 0 && d < best) {
            target = e;
            best = d;
          }
        }
      const swingNames = (s.attackFx?.hits ?? [])
        .map((id) => s.enemies.find((enemy) => enemy.id === id)?.kind)
        .filter((kind) => kind)
        .map((kind) => ENEMY_TYPES[kind!].name)
        .join("、");
      return {
        kind: target?.kind ?? null,
        hp: target?.hp ?? 0,
        windup: target?.state === "windup",
        victory: s.boss > 0 && !s.claimed.includes("semester"),
        hurt: s.hurtUntil > s.clock,
        swingNames,
      };
    }),
  );
  const type = state.kind ? ENEMY_TYPES[state.kind] : null;
  return (
    <>
      {type && phase === "playing" && (
        <div className="ad-target ad-raise-overlay" {...pressMark("overlay", "ready")}>
          <strong>{type.name}</strong>
          <small>{state.windup ? "即將攻擊 · 離開紅色範圍" : "校園異象"}</small>
          <div>
            <i
              style={{
                width: (state.hp / type.hp) * 100 + "%",
                background: type.color,
              }}
            />
          </div>
          <span>
            {Math.ceil(state.hp)} / {type.hp}
          </span>
        </div>
      )}
      {state.swingNames && (
        <p className="ad-swing-hits">{state.swingNames}</p>
      )}
      {state.hurt && <div className="ad-hurt" />}
      {state.victory && !settingsOpen && <Victory />}
    </>
  );
}
