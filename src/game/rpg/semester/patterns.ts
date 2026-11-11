import { ENEMY_TYPES, type EnemyKind } from "../data.ts";

/** One readable weakness or the moment the player can answer. */
export type PatternWindow = {
  id: string;
  label: string;
};

export type FinalPhase = {
  id: "deadline-sweep" | "blackout-slam";
  label: string;
  /** Same published windup. The two phases differ by name, not by edited hp. */
  windup: number;
};

export type EnemyPattern = {
  kind: EnemyKind;
  name: string;
  /** Silhouette tint taken from ENEMY_TYPES.color. */
  silhouette: string;
  windup: number;
  /** Read-only copy of the published hp. Combat does not write this back. */
  hp: number;
  window: PatternWindow;
  phases?: readonly FinalPhase[];
};

function pattern(kind: EnemyKind, window: PatternWindow): EnemyPattern {
  const type = ENEMY_TYPES[kind];
  return {
    kind,
    name: type.name,
    silhouette: type.color,
    windup: type.windup,
    hp: type.hp,
    window,
  };
}

/** Pop quiz: the dodge iframe is the opening. */
export const QUIZ_PATTERN = pattern("quiz", {
  id: "dodge-iframe",
  label: "閃避窗",
});

/** Group report: a built barrier breaks the line. */
export const REPORT_PATTERN = pattern("report", {
  id: "barrier",
  label: "路障遮擋",
});

/** Midterm: the recover beat after the swing is the attack window. */
export const EXAM_PATTERN = pattern("exam", {
  id: "recover",
  label: "收招空檔",
});

const finalWindup = ENEMY_TYPES.final.windup;

/** Final keeps the published windup and splits it into two named swings. */
export const FINAL_PATTERN: EnemyPattern = {
  ...pattern("final", { id: "two-phase", label: "兩段攻擊間的空隙" }),
  phases: [
    { id: "deadline-sweep", label: "截止日橫掃", windup: finalWindup },
    { id: "blackout-slam", label: "暗幕重擊", windup: finalWindup },
  ],
};

export const PATTERNS = {
  quiz: QUIZ_PATTERN,
  report: REPORT_PATTERN,
  exam: EXAM_PATTERN,
  final: FINAL_PATTERN,
} as const;
