import type { CollegeId } from "../../game/departments.ts";
import { freshGrowthState, type GrowthState } from "../../game/rpg/growth/types.ts";
import { readV2Progress } from "../../game/rpg/growth/progress.ts";
import { evalCondition, pickLine } from "./conditions.ts";
import { applyEffects } from "./effects.ts";
import { startRng } from "./rng.ts";
import { selectEvent } from "./select.ts";
import { CONTENT_REVISION, SAVE_SYNC, SAVE_VERSION } from "./types.ts";
import type {
  Catalog,
  NarrativeEnvelope,
  NarrativeSession,
  PlaceRecord,
  Play,
  PlayUi,
  SemesterPhase,
  TimeSlot,
  WeatherId,
} from "./types.ts";

const EMPTY_UI = (): PlayUi => ({
  phase: "exploring",
  eventId: null,
  outcome: null,
  notice: null,
  considered: [],
});

export function createSession(seed: string): NarrativeSession {
  return {
    version: 1,
    seed,
    rngState: startRng(seed),
    minute: 8 * 60,
    placeId: null,
    weather: "clear",
    timeOfDay: "morning",
    semester: "week-1",
    collegeId: null,
    departmentId: null,
    flags: {},
    questNodes: {},
    memory: {},
    cooldowns: {},
    mutexUntil: {},
    mutexHolder: {},
    recent: [],
    fired: [],
    resolved: [],
    activeEventId: null,
    mode: "exploring",
  };
}

export function createPlay(seed: string): Play {
  return { session: createSession(seed), growth: freshGrowthState(), ui: EMPTY_UI() };
}

function placeOf(catalog: Catalog, id: string | null): PlaceRecord | null {
  if (!id) return null;
  return catalog.places.find((place) => place.id === id) ?? null;
}

function sealResolved(
  session: NarrativeSession,
  eventId: string,
  once: boolean,
  cooldownMinutes: number,
  mutexGroup: string | null,
  mutexMinutes: number,
): NarrativeSession {
  const recent = [...session.recent, eventId].slice(-3);
  const fired = session.fired.includes(eventId) ? session.fired : [...session.fired, eventId];
  const resolved =
    once && !session.resolved.includes(eventId) ? [...session.resolved, eventId] : session.resolved;
  const cooldowns =
    cooldownMinutes > 0
      ? { ...session.cooldowns, [eventId]: session.minute + cooldownMinutes }
      : session.cooldowns;
  const mutexUntil =
    mutexGroup && mutexMinutes > 0
      ? { ...session.mutexUntil, [mutexGroup]: session.minute + mutexMinutes }
      : session.mutexUntil;
  const mutexHolder = mutexGroup
    ? { ...session.mutexHolder, [mutexGroup]: eventId }
    : session.mutexHolder;
  return {
    ...session,
    recent,
    fired,
    resolved,
    cooldowns,
    mutexUntil,
    mutexHolder,
    activeEventId: null,
    mode: "exploring",
  };
}

export function arrive(catalog: Catalog, play: Play, placeId: string): Play {
  const place = placeOf(catalog, placeId);
  if (!place) {
    return { ...play, ui: { ...EMPTY_UI(), notice: "這個地點不在清冊裡。畫面留在原處。" } };
  }
  const selection = selectEvent(
    catalog,
    { ...play.session, placeId, mode: "exploring", activeEventId: null },
    place,
  );
  if (!selection.event) {
    return {
      session: selection.session,
      growth: play.growth,
      ui: {
        phase: "exploring",
        eventId: null,
        outcome: null,
        notice: "這裡目前沒有事件。你可以換地方，或改時間與天氣。",
        considered: [],
      },
    };
  }
  return {
    session: selection.session,
    growth: play.growth,
    ui: {
      phase: "available",
      eventId: selection.event.id,
      outcome: null,
      notice: null,
      considered: selection.eligible,
    },
  };
}

export function talk(catalog: Catalog, play: Play): Play {
  const event = catalog.events.find((entry) => entry.id === play.ui.eventId);
  if (!event || play.ui.phase !== "available") return play;
  return {
    ...play,
    session: { ...play.session, mode: "in-event", activeEventId: event.id },
    ui: { ...play.ui, phase: "talking" },
  };
}

export function leave(catalog: Catalog, play: Play): Play {
  const event = catalog.events.find(
    (entry) => entry.id === play.session.activeEventId || entry.id === play.ui.eventId,
  );
  if (play.ui.phase !== "talking" && play.ui.phase !== "available") return play;
  return {
    session: { ...play.session, mode: "exploring", activeEventId: null },
    growth: play.growth,
    ui: {
      phase: "exploring",
      eventId: null,
      outcome: null,
      notice: event?.recovery.leave["zh-Hant"] ?? "你先離開。這件事沒有結算。",
      considered: [],
    },
  };
}

export type ChoiceResult = { play: Play; ok: boolean; reason: string | null; skipped: string[] };

export function choose(catalog: Catalog, play: Play, choiceId: string): ChoiceResult {
  const event = catalog.events.find((entry) => entry.id === play.session.activeEventId);
  if (!event || play.session.mode !== "in-event") {
    return { play, ok: false, reason: "no-event", skipped: [] };
  }
  const choice = event.choices.find((entry) => entry.id === choiceId);
  if (!choice) return { play, ok: false, reason: "unknown-choice", skipped: [] };
  const place = placeOf(catalog, play.session.placeId);
  if (!evalCondition(choice.when, { session: play.session, place })) {
    return {
      play: { ...play, ui: { ...play.ui, notice: "這個選項現在不成立。沒有發放獎勵。" } },
      ok: false,
      reason: "conditions",
      skipped: [],
    };
  }
  const applied = applyEffects(catalog, play.growth, play.session, choice.effects);
  if (!applied.ok) {
    return {
      play: { ...play, ui: { ...play.ui, notice: "這個選項有效果不在白名單裡，已整段取消。" } },
      ok: false,
      reason: "illegal-effect",
      skipped: [],
    };
  }
  const sealed = sealResolved(
    applied.session,
    event.id,
    event.once,
    event.cooldownMinutes,
    event.mutexGroup,
    event.mutexMinutes,
  );
  const outcome = pickLine(choice.outcome, { session: sealed, place });
  const skippedNote = applied.skipped.length ? "獎勵已結算過，沒有再次發放。" : null;
  return {
    ok: true,
    reason: null,
    skipped: applied.skipped,
    play: {
      growth: applied.growth,
      session: sealed,
      ui: {
        phase: "outcome",
        eventId: event.id,
        outcome,
        notice: skippedNote,
        considered: [],
      },
    },
  };
}

export function acknowledge(play: Play): Play {
  if (play.ui.phase !== "outcome") return play;
  return {
    ...play,
    ui: {
      phase: "exploring",
      eventId: null,
      outcome: null,
      notice: "你可以繼續走。",
      considered: [],
    },
  };
}

export function advanceMinutes(play: Play, minutes: number): Play {
  if (!Number.isFinite(minutes) || minutes <= 0) return play;
  return {
    ...play,
    session: { ...play.session, minute: play.session.minute + Math.floor(minutes) },
  };
}

export function configure(
  play: Play,
  patch: Partial<
    Pick<NarrativeSession, "weather" | "timeOfDay" | "semester" | "collegeId" | "departmentId">
  >,
): Play {
  return { ...play, session: { ...play.session, ...patch } };
}

export function openingLine(catalog: Catalog, play: Play): string {
  const event = catalog.events.find((entry) => entry.id === play.ui.eventId);
  if (!event) return "";
  return pickLine(event.lines, {
    session: play.session,
    place: placeOf(catalog, play.session.placeId),
  });
}

export function visibleChoices(catalog: Catalog, play: Play) {
  const event = catalog.events.find((entry) => entry.id === play.ui.eventId);
  if (!event) return [];
  const place = placeOf(catalog, play.session.placeId);
  return event.choices.filter((choice) =>
    evalCondition(choice.when, { session: play.session, place }),
  );
}

export function suggest(
  catalog: Catalog,
  play: Play,
): { placeId: string; reason: string; timeOfDay?: TimeSlot } | null {
  const resolved = new Set(play.session.resolved);
  if (
    !resolved.has("evt-gate-orientation") &&
    !play.session.fired.includes("evt-gate-orientation")
  ) {
    return { placeId: "main-gate", reason: "樣板從大門開始。你也可以直接去別的地方。" };
  }
  const node = play.session.questNodes["quest-group-report"];
  if (!node) return { placeId: "palace", reason: "宮燈教室有人在對分組大綱。" };
  if (node === "outline") return { placeId: "library", reason: "兩份出處在圖書館對。" };
  if (node === "sources") {
    return { placeId: "palace", reason: "傍晚再回宮燈。早上這段不會出現。", timeOfDay: "evening" };
  }
  const rest = catalog.events.find((event) => !resolved.has(event.id) && event.once);
  if (rest)
    return { placeId: rest.placeId, reason: "任務鏈已結束。下面只是另一區的事，可以不去。" };
  return null;
}

export function toEnvelope(play: Play): NarrativeEnvelope {
  return {
    version: SAVE_VERSION,
    sync: SAVE_SYNC,
    contentRevision: CONTENT_REVISION,
    session: play.session,
    growth: play.growth,
    ui: play.ui,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function numberMap(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) return null;
    out[key] = entry;
  }
  return out;
}

function stringMap(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") return null;
    out[key] = entry;
  }
  return out;
}

function flagMap(value: unknown): Record<string, boolean> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "boolean") return null;
    out[key] = entry;
  }
  return out;
}

function restoreGrowth(raw: unknown): GrowthState | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1 && raw.version !== 2) return null;
  if (Array.isArray(raw.claimedQuests) && isRecord(raw.materials)) {
    const notes = raw.materials.notes;
    const credit = raw.materials.credit;
    if (typeof notes !== "number" || typeof credit !== "number") return null;
    const base = freshGrowthState();
    const invested = isRecord(raw.invested) ? raw.invested : base.invested;
    return {
      ...base,
      version: raw.version,
      departmentId: typeof raw.departmentId === "string" ? raw.departmentId : null,
      catalogDepartmentId:
        typeof raw.catalogDepartmentId === "string" ? raw.catalogDepartmentId : null,
      legacyDepartmentId:
        typeof raw.legacyDepartmentId === "string" ? raw.legacyDepartmentId : null,
      pendingId: typeof raw.pendingId === "string" ? raw.pendingId : null,
      confirmed: raw.confirmed === true,
      initialized: raw.initialized === true,
      skillRank: typeof raw.skillRank === "number" ? raw.skillRank : 1,
      xp: typeof raw.xp === "number" && raw.xp >= 0 ? raw.xp : 0,
      equipped: raw.equipped === true,
      spentPoints: typeof raw.spentPoints === "number" ? raw.spentPoints : 0,
      learned: stringList(raw.learned),
      invested: {
        notes: typeof invested.notes === "number" ? invested.notes : 0,
        credit: typeof invested.credit === "number" ? invested.credit : 0,
      },
      materials: { notes, credit },
      xpEvents: stringList(raw.xpEvents),
      claimedQuests: stringList(raw.claimedQuests),
      discoveries: stringList(raw.discoveries),
      mainDone: raw.mainDone === true,
      lesson: typeof raw.lesson === "string" ? raw.lesson : null,
      boss: raw.boss === 1 ? 1 : 0,
    };
  }
  return readV2Progress(raw);
}

function restoreSession(raw: unknown): NarrativeSession | null {
  if (!isRecord(raw) || raw.version !== 1 || typeof raw.seed !== "string") return null;
  const flags = flagMap(raw.flags);
  const questNodes = stringMap(raw.questNodes);
  const memory = stringMap(raw.memory);
  const cooldowns = numberMap(raw.cooldowns);
  const mutexUntil = numberMap(raw.mutexUntil);
  const mutexHolder = stringMap(raw.mutexHolder);
  if (!flags || !questNodes || !memory || !cooldowns || !mutexUntil || !mutexHolder) return null;
  if (typeof raw.rngState !== "number" || typeof raw.minute !== "number") return null;
  const base = createSession(raw.seed);
  return {
    ...base,
    rngState: raw.rngState >>> 0,
    minute: raw.minute,
    placeId: typeof raw.placeId === "string" ? raw.placeId : null,
    weather:
      raw.weather === "rain" || raw.weather === "dusk" || raw.weather === "clear"
        ? raw.weather
        : "clear",
    timeOfDay:
      raw.timeOfDay === "morning" ||
      raw.timeOfDay === "afternoon" ||
      raw.timeOfDay === "evening" ||
      raw.timeOfDay === "night"
        ? raw.timeOfDay
        : "morning",
    semester:
      raw.semester === "week-1" || raw.semester === "midterm" || raw.semester === "finals"
        ? raw.semester
        : "week-1",
    collegeId: typeof raw.collegeId === "string" ? (raw.collegeId as CollegeId) : null,
    departmentId: typeof raw.departmentId === "string" ? raw.departmentId : null,
    flags,
    questNodes,
    memory,
    cooldowns,
    mutexUntil,
    mutexHolder,
    recent: stringList(raw.recent),
    fired: stringList(raw.fired),
    resolved: stringList(raw.resolved),
    activeEventId: typeof raw.activeEventId === "string" ? raw.activeEventId : null,
    mode: raw.mode === "in-event" ? "in-event" : "exploring",
  };
}

function restoreUi(raw: unknown): PlayUi {
  if (!isRecord(raw)) return EMPTY_UI();
  const phase =
    raw.phase === "available" ||
    raw.phase === "talking" ||
    raw.phase === "outcome" ||
    raw.phase === "exploring"
      ? raw.phase
      : "exploring";
  return {
    phase,
    eventId: typeof raw.eventId === "string" ? raw.eventId : null,
    outcome: typeof raw.outcome === "string" ? raw.outcome : null,
    notice: typeof raw.notice === "string" ? raw.notice : null,
    considered: stringList(raw.considered),
  };
}

export type LoadResult =
  { ok: true; play: Play } | { ok: false; reason: "incompatible-version" | "not-local-fixture" };

export function loadEnvelope(raw: unknown): LoadResult {
  if (!isRecord(raw)) return { ok: false, reason: "incompatible-version" };
  if (raw.version !== SAVE_VERSION || raw.contentRevision !== CONTENT_REVISION) {
    return { ok: false, reason: "incompatible-version" };
  }
  if (raw.sync !== SAVE_SYNC) return { ok: false, reason: "not-local-fixture" };
  if (isRecord(raw.growth) && raw.growth.version !== 1 && raw.growth.version !== 2) {
    return { ok: false, reason: "incompatible-version" };
  }
  const growth = restoreGrowth(raw.growth);
  const session = restoreSession(raw.session);
  if (!growth || !session) return { ok: false, reason: "incompatible-version" };
  return { ok: true, play: { growth, session, ui: restoreUi(raw.ui) } };
}

export function setClock(
  play: Play,
  timeOfDay: TimeSlot,
  weather?: WeatherId,
  semester?: SemesterPhase,
): Play {
  return configure(play, {
    timeOfDay,
    ...(weather ? { weather } : {}),
    ...(semester ? { semester } : {}),
  });
}
