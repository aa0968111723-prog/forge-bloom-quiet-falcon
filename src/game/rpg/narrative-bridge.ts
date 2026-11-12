import { COLLEGE_IDS, type CollegeId } from "../departments.ts";
import type { TimeOfDay } from "../world-data/lighting.ts";
import { loadCatalog } from "../../features/narrative/load.ts";
import {
  acknowledge,
  arrive,
  choose,
  createSession,
  leave,
  talk,
  visibleChoices,
} from "../../features/narrative/play.ts";
import type { NarrativeSession, Play, PlayUi } from "../../features/narrative/types.ts";
import { pickLine } from "../../features/narrative/conditions.ts";
import { semesterPhase } from "../contracts/semester.ts";
import { collegeOf } from "./growth/tree.ts";
import { readV2Progress } from "./growth/progress.ts";
import type { GrowthState } from "./growth/types.ts";

const catalog = loadCatalog();

const EMPTY_UI = (): PlayUi => ({
  phase: "exploring",
  eventId: null,
  outcome: null,
  notice: null,
  considered: [],
});

/** World lighting presets the player already picks. Narrative has its own clock. */
export function narrativeClock(time: TimeOfDay): {
  timeOfDay: NarrativeSession["timeOfDay"];
  weather: NarrativeSession["weather"];
  minute: number;
} {
  switch (time) {
    case "cloudy":
      return { timeOfDay: "afternoon", weather: "clear", minute: 14 * 60 };
    case "sunset":
      return { timeOfDay: "evening", weather: "dusk", minute: 18 * 60 };
    case "night":
      return { timeOfDay: "night", weather: "clear", minute: 21 * 60 };
    case "wet":
      return { timeOfDay: "afternoon", weather: "rain", minute: 14 * 60 };
    default:
      return { timeOfDay: "morning", weather: "clear", minute: 8 * 60 };
  }
}

/** Fired, resolved, and flag maps. Recent stays at 3. Forty dropped later faculty consequences. */
export const NARRATIVE_SAVE_LIMIT = 200;

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length < 80).slice(0, limit);
}

function boolMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value).slice(0, NARRATIVE_SAVE_LIMIT)) {
    if (typeof entry === "boolean" && key.length < 80) out[key] = entry;
  }
  return out;
}

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value).slice(0, NARRATIVE_SAVE_LIMIT)) {
    if (typeof entry === "string" && key.length < 80 && entry.length < 80) out[key] = entry;
  }
  return out;
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value).slice(0, NARRATIVE_SAVE_LIMIT)) {
    if (typeof entry === "number" && Number.isFinite(entry) && key.length < 80) out[key] = entry;
  }
  return out;
}

/** Keep a saved narrative session. A broken object starts a fresh campus session. */
export function readNarrativeSession(raw: unknown): NarrativeSession {
  const blank = createSession("campus");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return blank;
  const record = raw as Record<string, unknown>;
  if (record.version !== 1) return blank;
  const weather = record.weather;
  const timeOfDay = record.timeOfDay;
  const semester = record.semester;
  return {
    ...blank,
    seed: typeof record.seed === "string" && record.seed.length < 64 ? record.seed : blank.seed,
    rngState:
      typeof record.rngState === "number" && Number.isFinite(record.rngState)
        ? record.rngState
        : blank.rngState,
    minute:
      typeof record.minute === "number" && Number.isFinite(record.minute) ? record.minute : blank.minute,
    placeId: typeof record.placeId === "string" ? record.placeId : null,
    weather: weather === "clear" || weather === "rain" || weather === "dusk" ? weather : blank.weather,
    timeOfDay:
      timeOfDay === "morning" || timeOfDay === "afternoon" || timeOfDay === "evening" || timeOfDay === "night"
        ? timeOfDay
        : blank.timeOfDay,
    semester: semester === "week-1" || semester === "midterm" || semester === "finals" ? semester : blank.semester,
    collegeId:
      typeof record.collegeId === "string" && (COLLEGE_IDS as readonly string[]).includes(record.collegeId)
        ? (record.collegeId as CollegeId)
        : null,
    departmentId: typeof record.departmentId === "string" ? record.departmentId : null,
    flags: boolMap(record.flags),
    questNodes: stringMap(record.questNodes),
    memory: stringMap(record.memory),
    cooldowns: numberMap(record.cooldowns),
    mutexUntil: numberMap(record.mutexUntil),
    mutexHolder: stringMap(record.mutexHolder),
    recent: stringList(record.recent, 3),
    fired: stringList(record.fired, NARRATIVE_SAVE_LIMIT),
    resolved: stringList(record.resolved, NARRATIVE_SAVE_LIMIT),
    activeEventId: null,
    mode: "exploring",
  };
}

export function liveGrowth(input: {
  departmentId: string | null;
  xp: number;
  claimed: readonly string[];
  discoveries: readonly string[];
  slots: readonly { itemId: string; quantity: number }[];
  skillRank: number;
  equipped: boolean;
  boss: number;
  lesson: string | null;
}): GrowthState {
  return readV2Progress({
    version: 2,
    departmentId: input.departmentId,
    xp: input.xp,
    claimed: [...input.claimed],
    discoveries: [...input.discoveries],
    slots: input.slots.map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity })),
    skillRank: input.skillRank,
    equipped: input.equipped,
    boss: input.boss,
    lesson: input.lesson,
  });
}

export function alignSession(
  session: NarrativeSession,
  input: { departmentId: string | null; time: TimeOfDay; growth: GrowthState },
): NarrativeSession {
  const clock = narrativeClock(input.time);
  return {
    ...session,
    ...clock,
    semester: semesterPhase(input.growth.claimedQuests),
    collegeId: collegeOf(input.growth),
    departmentId: input.growth.catalogDepartmentId,
    mode: "exploring",
    activeEventId: null,
  };
}

/** One draw at a campus site. The caller saves the returned session either way. */
export function approachPlace(
  session: NarrativeSession,
  growth: GrowthState,
  placeId: string,
  time: TimeOfDay,
): Play {
  const aligned = alignSession(session, { departmentId: null, time, growth });
  return arrive(catalog, { session: aligned, growth, ui: EMPTY_UI() }, placeId);
}

export function talkAt(play: Play): Play {
  return talk(catalog, play);
}

export function chooseAt(play: Play, choiceId: string) {
  return choose(catalog, play, choiceId);
}

export function leaveAt(play: Play): Play {
  return leave(catalog, play);
}

export function acknowledgeAt(play: Play): Play {
  return acknowledge(play);
}

export function choicesFor(play: Play) {
  return visibleChoices(catalog, play);
}

export function eventLine(eventId: string | null, session: NarrativeSession): string {
  const event = catalog.events.find((entry) => entry.id === eventId);
  if (!event) return "";
  const place = catalog.places.find((entry) => entry.id === session.placeId) ?? null;
  return pickLine(event.lines, { session, place });
}

export function rewardDelta(before: GrowthState, after: GrowthState) {
  return {
    xp: Math.max(0, after.xp - before.xp),
    notes: Math.max(0, after.materials.notes - before.materials.notes),
    credit: Math.max(0, after.materials.credit - before.materials.credit),
    discoveries: after.discoveries.filter((id) => !before.discoveries.includes(id)),
    claimed: after.claimedQuests.filter((id) => id.startsWith("quest-") && !before.claimedQuests.includes(id)),
  };
}

export function narrativeCatalog() {
  return catalog;
}
