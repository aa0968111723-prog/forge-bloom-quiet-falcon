import { arrive, choose, createPlay, openingLine, talk, acknowledge } from "../narrative/play.ts";
import { loadCatalog } from "../narrative/load.ts";
import type { Play } from "../narrative/types.ts";
import { FACULTY_BEATS } from "./beats.ts";

export const MAIN_LINE = FACULTY_BEATS.filter((beat) => beat.group === "main").map((beat) => beat.id);

export const SIDE_LINES: Record<string, { title: string; eventIds: string[] }> = {
  course: { title: "自己的課表", eventIds: [] },
  ethics: { title: "未授權的檔", eventIds: [] },
  survey: { title: "空答不是同意", eventIds: [] },
  wording: { title: "譯文不代原句", eventIds: [] },
  hours: { title: "時段不往前吃", eventIds: [] },
  cross: { title: "兩句並列", eventIds: [] },
  case: { title: "結論不獨佔", eventIds: [] },
  schedule: { title: "不退教育的申請", eventIds: [] },
};

for (const beat of FACULTY_BEATS) {
  if (beat.group === "main") continue;
  SIDE_LINES[beat.group]?.eventIds.push(beat.id);
}

/** Walk one line by always taking the same choice index. Both indexes stay reachable. */
export function playFacultyLine(seed: string, eventIds: readonly string[], choiceIndex: 0 | 1): {
  play: Play;
  openings: string[];
  outcomes: string[];
} {
  const catalog = loadCatalog();
  let play = createPlay(seed);
  const openings: string[] = [];
  const outcomes: string[] = [];
  for (const eventId of eventIds) {
    const event = catalog.events.find((entry) => entry.id === eventId);
    if (!event) throw new Error(`missing faculty event ${eventId}`);
    play = talk(catalog, arrive(catalog, play, event.placeId));
    if (play.ui.eventId !== eventId) {
      throw new Error(`${eventId} was not offered, got ${play.ui.eventId ?? "none"}`);
    }
    openings.push(openingLine(catalog, play));
    const choice = event.choices[choiceIndex];
    if (!choice) throw new Error(`${eventId} missing choice ${choiceIndex}`);
    const result = choose(catalog, play, choice.id);
    if (!result.ok) throw new Error(`${choice.id} refused: ${result.reason}`);
    outcomes.push(result.play.ui.outcome ?? "");
    play = acknowledge(result.play);
  }
  return { play, openings, outcomes };
}
