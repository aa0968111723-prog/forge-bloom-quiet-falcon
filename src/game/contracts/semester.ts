import type { SemesterPhase } from "../../features/narrative/types.ts";

/**
 * The only semester source for the main save.
 * Phase follows quests already stored on `claimed`. It does not read the computer clock,
 * and it does not open a second reward list.
 */
export const SEMESTER_SOURCE = "contracts.semester";

export const GATE_QUEST_ID = "quest-orient-gate";
export const CAMPUS_ERRAND_ID = "quest-errand-campus-post";
export const COMBAT_MISSION_ID = "first";

export const ERRAND_XP = 12;
export const ERRAND_NOTES = 2;

export type SemesterView = {
  phase: SemesterPhase;
  label: string;
  next: string;
  short: string;
};

export type ErrandOffer = {
  id: typeof CAMPUS_ERRAND_ID;
  xp: number;
  notes: number;
};

export function semesterPhase(claimed: readonly string[]): SemesterPhase {
  const has = (id: string) => claimed.includes(id);
  const midterm = has(GATE_QUEST_ID) && has(CAMPUS_ERRAND_ID);
  if (midterm && has(COMBAT_MISSION_ID)) return "finals";
  if (midterm) return "midterm";
  return "week-1";
}

export function semesterView(claimed: readonly string[]): SemesterView {
  const phase = semesterPhase(claimed);
  if (phase === "finals") {
    return { phase, label: "期末", next: "委託已結算", short: "期末" };
  }
  if (phase === "midterm") {
    return { phase, label: "期中", next: "擊退三隻異象", short: "期中" };
  }
  if (!claimed.includes(GATE_QUEST_ID)) {
    return { phase, label: "第一週", next: "先問入口方向", short: "第一週" };
  }
  return {
    phase,
    label: "第一週",
    next: "領補給或放設施",
    short: "第一週",
  };
}

/** Null when the gate quest is unfinished or this errand already settled. */
export function errandReward(claimed: readonly string[]): ErrandOffer | null {
  if (!claimed.includes(GATE_QUEST_ID) || claimed.includes(CAMPUS_ERRAND_ID)) return null;
  return { id: CAMPUS_ERRAND_ID, xp: ERRAND_XP, notes: ERRAND_NOTES };
}

export function stampSemester<T extends { semester: SemesterPhase }>(
  session: T,
  claimed: readonly string[],
): T {
  const phase = semesterPhase(claimed);
  if (session.semester === phase) return session;
  return { ...session, semester: phase };
}
