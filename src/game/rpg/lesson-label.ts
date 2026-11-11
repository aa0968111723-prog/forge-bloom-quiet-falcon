import type { LessonMark } from "./store";

/** Two-character label drawn on the campus map beside the lesson ring. */
const MAP_LABELS: Record<Exclude<LessonMark, "done">, string> = {
  department: "選系",
  move: "移動",
  supply: "補給",
  attack: "普攻",
  skill: "技能",
};

export function lessonMapLabel(step: LessonMark | null): string | null {
  if (!step || step === "done") return null;
  return MAP_LABELS[step];
}
