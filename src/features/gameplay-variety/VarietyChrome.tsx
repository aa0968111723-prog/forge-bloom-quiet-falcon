import { useEffect, useState, useSyncExternalStore } from "react";
import { useGame } from "../../game/store.ts";
import { quality } from "../../game/quality.ts";
import { terrainHeight } from "../../game/world.ts";
import { useRpg } from "../../game/rpg/store.ts";
import { eventById } from "./catalog.ts";
import { cellsInShape, sameCell, telegraphLabel } from "./shapes.ts";
import "./host.ts";
import {
  actVariety,
  beginEvent,
  claimVariety,
  dismissVariety,
  getMemory,
  offerAt,
  readStorySignals,
  subscribeMemory,
  varietyAnchors,
} from "./runtime.ts";
import { readCaps } from "./host.ts";
import "./variety.css";

function useMemory() {
  return useSyncExternalStore(subscribeMemory, getMemory, getMemory);
}

function useReduced() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, []);
  return reduced;
}

export function VarietyDock() {
  const memory = useMemory();
  const [label, setLabel] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => {
      const game = useGame.getState();
      const rpg = useRpg.getState();
      if (game.phase !== "playing" || rpg.panel || rpg.hp <= 0 || !rpg.departmentId) {
        setLabel(null);
        setEventId(null);
        return;
      }
      const caps = readCaps();
      if (memory.active) {
        setEventId(memory.active.eventId);
        setLabel(memory.active.phase === "success" ? "領取異象紀錄" : "繼續未完成的調查");
        return;
      }
      const offer = offerAt(game.playerX, game.playerZ, caps);
      setEventId(offer.event?.id ?? null);
      setLabel(offer.event ? offer.event.title : null);
    };
    refresh();
    const stopGame = useGame.subscribe(refresh);
    const stopRpg = useRpg.subscribe(refresh);
    return () => {
      stopGame();
      stopRpg();
    };
  }, [memory]);
  if (!label || !eventId) return null;
  return (
    <div className="gv-dock">
      <button
        type="button"
        data-gv="dock"
        onClick={() => {
          if (!beginEvent(eventId, readCaps())) return;
          useRpg.getState().setPanel("variety");
        }}
      >
        {label}
      </button>
    </div>
  );
}

function CloseButton() {
  return (
    <button
      type="button"
      onClick={() => {
        dismissVariety();
        useRpg.getState().setPanel(null);
      }}
    >
      關閉
    </button>
  );
}

function AbortButton() {
  return (
    <button
      type="button"
      data-gv="abort"
      onClick={() => {
        actVariety({ type: "abort" });
        useRpg.getState().setPanel(null);
      }}
    >
      中止並離開
    </button>
  );
}

export function VarietyPanel() {
  const memory = useMemory();
  const reduced = useReduced();
  const run = memory.active;
  const event = run ? eventById(run.eventId) : null;
  if (!run || !event) {
    return (
      <div className="gv-panel">
        <p>這段調查已經結束。</p>
        <CloseButton />
      </div>
    );
  }
  const board = run.board;
  return (
    <div className="gv-panel" data-gv="panel" data-phase={run.phase} data-motion={reduced ? "reduce" : "full"} data-quality={quality().tier}>
      <p className="gv-note">{event.summary} 位置是估計的，不是實測。</p>
      {run.tutorial && run.phase === "investigate" ? <p>新手：先點選相符的線索，再送出。答錯不會換題。</p> : null}
      {run.phase === "briefing" ? (
        <>
          {event.briefing.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button type="button" data-gv="ack" onClick={() => actVariety({ type: "ack" })}>
            開始查看線索
          </button>
        </>
      ) : null}
      {run.phase === "investigate" && board?.board === "investigate" ? (
        <>
          <p>{board.hint}</p>
          {board.clues.map((clue) => (
            <button
              type="button"
              key={clue.id}
              className={board.picked.includes(clue.id) ? "gv-on" : undefined}
              aria-pressed={board.picked.includes(clue.id)}
              onClick={() => actVariety({ type: "toggle-clue", id: clue.id })}
            >
              {clue.text}
            </button>
          ))}
          <button type="button" data-gv="submit" onClick={() => actVariety({ type: "submit-clues" })}>
            送出這組線索
          </button>
          <p className="gv-note">已試 {board.attempts} 次。三次對不上可以重試。</p>
        </>
      ) : null}
      {run.phase === "puzzle" && board?.board === "puzzle" ? (
        <>
          <p>{board.label}</p>
          <div className="gv-row">
            {board.values.map((value, index) => (
              <button type="button" key={index} data-gv={`puzzle-${index}`} onClick={() => actVariety({ type: "toggle-puzzle", index })}>
                {board.mode === "lamps" ? (value ? "亮" : "暗") : `閥 ${value}`}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => actVariety({ type: "reset-puzzle" })}>
            扳回最初
          </button>
          <p className="gv-note">
            已操作 {board.moves}/{board.limit}。{board.mode === "lamps" ? "連動隔壁。" : "連動右邊。"}
          </p>
        </>
      ) : null}
      {run.phase === "fork" ? (
        <>
          <p>筆記可以護送回去，也可以留下處理報告異象。兩條都會結算，獎勵只領一次。</p>
          <div className="gv-actions">
            <button type="button" data-gv="peace" onClick={() => actVariety({ type: "choose-route", route: "escort" })}>
              護送筆記
            </button>
            <button type="button" data-gv="fight" onClick={() => actVariety({ type: "choose-route", route: "combat" })}>
              處理長條異象
            </button>
          </div>
        </>
      ) : null}
      {run.phase === "escort" && board?.board === "escort" ? (
        <>
          <p>
            人在{board.nodes.find((node) => node.id === board.at)?.name}。筆記 {board.cargo}/{board.maxCargo}。
            這一拍的阻礙在{board.nodes.find((node) => node.id === board.hazards[Math.min(board.turn, board.hazards.length - 1)])?.name}。
          </p>
          <div className="gv-actions">
            {board.nodes
              .find((node) => node.id === board.at)
              ?.links.map((id) => (
                <button type="button" key={id} onClick={() => actVariety({ type: "escort-go", node: id })}>
                  走到{board.nodes.find((node) => node.id === id)?.name}
                </button>
              ))}
            <button type="button" onClick={() => actVariety({ type: "escort-wait" })}>
              在原地等一拍
            </button>
          </div>
        </>
      ) : null}
      {run.phase === "combat" && board?.board === "combat" ? (
        <>
          <p>
            生命 {board.playerHp}。異象 {board.enemyHp}。{telegraphLabel(board.telegraph)}。{board.log}
            {board.deskHp != null ? ` 桌子 ${board.deskHp}。` : ""}
          </p>
          <div className="gv-grid" data-gv="grid">
            {Array.from({ length: 25 }, (_, index) => {
              const cell = { x: index % 5, y: Math.floor(index / 5) };
              const shaped = board.telegraph ? cellsInShape(board.telegraph).some((item) => sameCell(item, cell)) : false;
              const marks = [
                sameCell(cell, board.player) ? "你" : "",
                sameCell(cell, board.enemy) ? "異" : "",
                board.desk && sameCell(cell, board.desk) ? "桌" : "",
                board.nodes.some((node) => sameCell(node, cell)) ? "結" : "",
              ].join("");
              return (
                <span
                  key={index}
                  className="gv-cell"
                  data-shape={shaped ? board.telegraph?.kind : undefined}
                  aria-label={shaped ? telegraphLabel(board.telegraph) : "空格"}
                >
                  {marks || (shaped ? (board.telegraph?.kind === "arc" ? "扇" : "條") : "")}
                </span>
              );
            })}
          </div>
          <div className="gv-actions">
            {(
              [
                ["north", "上"],
                ["west", "左"],
                ["east", "右"],
                ["south", "下"],
                ["strike", "攻擊"],
                ["skill", "打斷"],
                ["guard", "格擋"],
                ["dispel", "解除"],
                ["wait", "觀察"],
              ] as const
            ).map(([action, text]) => (
              <button type="button" key={action} data-gv={action} onClick={() => actVariety({ type: "combat", action })}>
                {text}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {run.phase === "route" && board?.board === "route" ? (
        <>
          <p>
            {board.note} 預算 {board.budget} 分鐘。目前：{board.order.join(" → ") || "還沒排"}。
          </p>
          <div className="gv-actions">
            {board.stops.map((stop) => (
              <button type="button" key={stop.id} onClick={() => actVariety({ type: "route-pick", id: stop.id })}>
                {stop.name} {stop.cost} 分
              </button>
            ))}
            <button type="button" onClick={() => actVariety({ type: "route-undo" })}>
              拿掉最後一站
            </button>
            <button type="button" data-gv="route-commit" onClick={() => actVariety({ type: "route-commit" })}>
              依這個順序走
            </button>
          </div>
        </>
      ) : null}
      {run.phase === "repair" && board?.board === "repair" ? (
        <>
          <p>熱源在「{board.slotNames[board.heat]}」。冷卻片要貼著它，電池要離開它，熱源那格留空。</p>
          {board.slotNames.map((name, index) => (
            <div className="gv-row" key={name}>
              <span>
                {name}
                {index === board.heat ? "（熱）" : ""}：{board.parts.find((part) => part.id === board.slots[index])?.name ?? "空"}
              </span>
              {board.parts.map((part) => (
                <button type="button" key={part.id} onClick={() => actVariety({ type: "repair-assign", part: part.id, slot: index })}>
                  放{part.name}
                </button>
              ))}
              <button type="button" onClick={() => actVariety({ type: "repair-clear", slot: index })}>
                拿開
              </button>
            </div>
          ))}
          <button type="button" data-gv="repair-check" onClick={() => actVariety({ type: "repair-check" })}>
            接上線路
          </button>
        </>
      ) : null}
      {run.phase === "success" ? (
        <>
          <p>{run.receipt}</p>
          <p className="gv-note">紀錄 {readStorySignals().length} 條，交給後續劇情接線，不改教授對話。</p>
          <button type="button" data-gv="claim" onClick={() => claimVariety()}>
            領取結算
          </button>
          <CloseButton />
        </>
      ) : null}
      {run.phase === "failed" ? (
        <>
          <p>{run.failReason}</p>
          <div className="gv-actions">
            <button type="button" data-gv="retry" onClick={() => actVariety({ type: "retry" })}>
              重試這一關
            </button>
            {event.kind === "chain" ? (
              <button type="button" onClick={() => actVariety({ type: "back-to-fork" })}>
                回到護送或戰鬥
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {run.phase !== "success" ? <AbortButton /> : null}
    </div>
  );
}

export function VarietyMarks() {
  const tier = quality().tier;
  return (
    <group>
      {varietyAnchors.map((anchor) => (
        <mesh
          key={anchor.id}
          position={[anchor.x, terrainHeight(anchor.x, anchor.z) + 0.08, anchor.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.85, 1.15, tier === "low" ? 6 : 24]} />
          <meshBasicMaterial color="#c6a15a" />
        </mesh>
      ))}
    </group>
  );
}
