import { startRng } from "../narrative/rng.ts";
import type { Board, Memory, Phase, RouteChoice, Run } from "./types.ts";

export const VARIETY_SAVE_KEY = "tamkang-gameplay-variety-v1";

const PHASES = new Set<Phase>([
  "briefing",
  "investigate",
  "puzzle",
  "fork",
  "escort",
  "combat",
  "route",
  "repair",
  "success",
  "failed",
  "aborted",
]);

export function emptyMemory(seed = "tamkang-variety"): Memory {
  return {
    version: 1,
    rng: startRng(seed),
    recent: [],
    resolved: [],
    claims: [],
    route: null,
    active: null,
    signals: [],
    tutorialSeen: false,
  };
}

function strings(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length < 80).slice(0, limit);
}

function boardOf(value: unknown): Board | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const board = (value as { board?: unknown }).board;
  if (
    board === "investigate" ||
    board === "puzzle" ||
    board === "escort" ||
    board === "route" ||
    board === "repair" ||
    board === "combat"
  ) {
    return value as Board;
  }
  return null;
}

function readSignals(value: unknown): Memory["signals"] {
  if (!Array.isArray(value)) return [];
  const signals: Memory["signals"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: unknown; eventId?: unknown; route?: unknown; questId?: unknown };
    if (row.type !== "variety.resolved" || typeof row.eventId !== "string" || typeof row.questId !== "string") {
      continue;
    }
    if (row.route !== "peace" && row.route !== "combat" && row.route !== "field") continue;
    signals.push({ type: "variety.resolved", eventId: row.eventId, route: row.route, questId: row.questId });
  }
  return signals.slice(-20);
}

function runOf(value: unknown): Run | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<Run>;
  if (typeof raw.eventId !== "string" || !raw.phase || !PHASES.has(raw.phase)) return null;
  const route: RouteChoice | null =
    raw.route === "peace" || raw.route === "combat" || raw.route === "field" ? raw.route : null;
  return {
    eventId: raw.eventId,
    phase: raw.phase,
    route,
    board: boardOf(raw.board),
    failReason: typeof raw.failReason === "string" ? raw.failReason : null,
    receipt: typeof raw.receipt === "string" ? raw.receipt : null,
    tutorial: raw.tutorial === true,
    caps: {
      equipped: raw.caps?.equipped === true,
      skillRank:
        typeof raw.caps?.skillRank === "number" && raw.caps.skillRank >= 2
          ? Math.min(5, Math.floor(raw.caps.skillRank))
          : 1,
      built:
        typeof raw.caps?.built === "number" && raw.caps.built > 0
          ? Math.min(48, Math.floor(raw.caps.built))
          : 0,
      collegeId: typeof raw.caps?.collegeId === "string" ? raw.caps.collegeId : null,
      discipline: typeof raw.caps?.discipline === "string" ? raw.caps.discipline : null,
    },
  };
}

export function readMemory(raw: unknown): Memory {
  const blank = emptyMemory();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return blank;
  const record = raw as Partial<Memory>;
  if (record.version !== 1) return blank;
  const route = record.route === "peace" || record.route === "combat" ? record.route : null;
  return {
    version: 1,
    rng: typeof record.rng === "number" && Number.isFinite(record.rng) ? record.rng >>> 0 : blank.rng,
    recent: strings(record.recent, 3),
    resolved: strings(record.resolved, 40),
    claims: strings(record.claims, 40),
    route,
    active: runOf(record.active),
    signals: readSignals(record.signals),
    tutorialSeen: record.tutorialSeen === true,
  };
}

export type MemoryStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function loadMemory(store: MemoryStore | null): Memory {
  if (!store) return emptyMemory();
  try {
    const text = store.getItem(VARIETY_SAVE_KEY);
    if (!text) return emptyMemory();
    return readMemory(JSON.parse(text) as unknown);
  } catch {
    return emptyMemory();
  }
}

export function saveMemory(store: MemoryStore | null, memory: Memory) {
  if (!store) return;
  const signals = memory.signals.slice(-20);
  store.setItem(VARIETY_SAVE_KEY, JSON.stringify({ ...memory, signals }));
}
