import type { InvestigateBoard, InvestigateConfig } from "./types.ts";

export function buildInvestigate(config: InvestigateConfig): InvestigateBoard {
  return { ...config, board: "investigate", picked: [], attempts: 0, clues: config.clues.map((clue) => ({ ...clue })) };
}

/** Largest set that satisfies the board rule. The clue text is not the answer key. */
export function agreeingClues(board: Pick<InvestigateBoard, "rule" | "window" | "clues">): string[] {
  if (board.rule === "exact") {
    const groups = new Map<string, string[]>();
    for (const clue of board.clues) {
      const key = `${clue.place}|${clue.minute}`;
      const list = groups.get(key) ?? [];
      list.push(clue.id);
      groups.set(key, list);
    }
    let best: string[] = [];
    for (const list of groups.values()) if (list.length > best.length) best = list;
    return [...best].sort();
  }
  let best: string[] = [];
  const places = new Set(board.clues.map((clue) => clue.place));
  for (const place of places) {
    const group = board.clues.filter((clue) => clue.place === place).sort((a, b) => a.minute - b.minute);
    for (let start = 0; start < group.length; start += 1) {
      const cluster = [group[start]];
      for (let next = start + 1; next < group.length; next += 1) {
        if (group[next].minute - group[start].minute <= board.window) cluster.push(group[next]);
        else break;
      }
      if (cluster.length > best.length) best = cluster.map((clue) => clue.id);
    }
  }
  return [...best].sort();
}

export function cluesMatch(picked: readonly string[], expected: readonly string[]) {
  if (picked.length !== expected.length) return false;
  const have = [...picked].sort();
  return expected.every((id, index) => have[index] === id);
}
