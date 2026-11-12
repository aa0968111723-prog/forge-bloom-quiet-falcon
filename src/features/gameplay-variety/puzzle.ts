import type { PuzzleBoard, PuzzleConfig } from "./types.ts";

export function buildPuzzle(config: PuzzleConfig): PuzzleBoard {
  return { ...config, board: "puzzle", values: [...config.start], moves: 0 };
}

export function puzzleStep(values: readonly number[], mode: PuzzleBoard["mode"], index: number): number[] {
  const next = [...values];
  if (index < 0 || index >= next.length) return next;
  if (mode === "lamps") {
    for (const slot of [index - 1, index, index + 1]) {
      if (slot >= 0 && slot < next.length) next[slot] = next[slot] ? 0 : 1;
    }
    return next;
  }
  next[index] = (next[index] + 1) % 3;
  if (index + 1 < next.length) next[index + 1] = (next[index + 1] + 1) % 3;
  return next;
}

export function puzzleSolved(board: PuzzleBoard) {
  return board.values.every((value, index) => value === board.target[index]);
}
