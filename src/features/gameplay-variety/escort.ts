import type { Caps, EscortBoard, EscortConfig } from "./types.ts";

export function buildEscort(config: EscortConfig, caps: Caps): EscortBoard {
  const nodes = config.nodes.map((node) => ({ ...node, links: [...node.links] }));
  if (caps.built >= 1) {
    const shade = "barrier";
    nodes.push({ id: shade, name: config.barrierName, links: [config.start, config.goal] });
    for (const id of [config.start, config.goal]) {
      const node = nodes.find((entry) => entry.id === id);
      if (node && !node.links.includes(shade)) node.links.push(shade);
    }
  }
  return {
    board: "escort",
    nodes,
    hazards: [...config.hazards],
    turn: 0,
    at: config.start,
    goal: config.goal,
    cargo: config.cargo,
    maxCargo: config.cargo,
  };
}

export type EscortMove = { board: EscortBoard; done: "ongoing" | "success" | "failed"; reason: string | null };

export function escortAct(board: EscortBoard, next: string | null): EscortMove {
  const at = board.nodes.find((node) => node.id === board.at);
  if (!at) return { board, done: "failed", reason: "路線斷了。" };
  if (next && next !== board.at && !at.links.includes(next)) {
    return { board, done: "ongoing", reason: null };
  }
  const destination = next ?? board.at;
  const hazard = board.hazards[Math.min(board.turn, board.hazards.length - 1)] ?? "";
  const cargo = destination === hazard ? board.cargo - 1 : board.cargo;
  const turn = board.turn + 1;
  const moved: EscortBoard = { ...board, at: destination, cargo, turn };
  if (cargo <= 0) return { board: moved, done: "failed", reason: "筆記在半路掉光了。" };
  if (destination === board.goal) return { board: moved, done: "success", reason: null };
  if (turn >= board.hazards.length) return { board: moved, done: "failed", reason: "這班傳送已經截止。" };
  return { board: moved, done: "ongoing", reason: null };
}
