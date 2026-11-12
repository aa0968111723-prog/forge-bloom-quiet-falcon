import type { CollegeId } from "../../game/departments.ts";

/** One fictional classmate. The name is not a real student. */
export type PsychPerson = {
  id: string;
  name: string;
  role: "同學";
  collegeId: CollegeId;
  departmentId: string;
  questId: string;
  voice: string;
  siteId: string;
  /** Metres from the estimated door. Not a surveyed spot. */
  dx: number;
  dz: number;
};

export const PSYCH_CAST: readonly PsychPerson[] = [
  {
    id: "npc-xu-hui",
    name: "許回",
    role: "同學",
    collegeId: "liberal-arts",
    departmentId: "chi-lit",
    questId: "quest-psych-cause",
    voice: "先問那一頁是怎麼掉的。",
    siteId: "library",
    dx: -8,
    dz: 16,
  },
];

export function psychCard(npcId: string): { name: string; role: string; unitId: string } | null {
  const person = PSYCH_CAST.find((entry) => entry.id === npcId);
  if (!person) return null;
  return { name: person.name, role: person.role, unitId: person.departmentId };
}
