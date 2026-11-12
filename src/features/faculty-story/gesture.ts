/** Which kit pose a standing faculty member uses. Talk and deliver are one-shots. */

export type FacultyGesture = "idle" | "talk" | "deliver";

export function facultyGesture(phase: string | null | undefined): FacultyGesture {
  if (phase === "outcome") return "deliver";
  if (phase === "talking") return "talk";
  return "idle";
}
