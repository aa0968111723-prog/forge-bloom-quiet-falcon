import { eventById, VARIETY_EVENTS } from "./catalog.ts";
import { loadMemory, saveMemory, type MemoryStore } from "./memory.ts";
import { claimIntent, markClaim, reduceVariety, startRun } from "./play.ts";
import { selectVariety } from "./select.ts";
import type { Caps, Memory, PlayAction, RewardIntent } from "./types.ts";

export type PayResult = {
  paid: boolean;
  already: boolean;
  xp: number;
  notes: number;
  credit: number;
};

let memory: Memory = emptyFromStore();
const listeners = new Set<() => void>();
let payer: (intent: RewardIntent) => PayResult = () => ({
  paid: false,
  already: false,
  xp: 0,
  notes: 0,
  credit: 0,
});
let saveFailed: () => void = () => {};

function browserStore(): MemoryStore | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function emptyFromStore() {
  return loadMemory(browserStore());
}

function commit(next: Memory) {
  memory = next;
  const wrote = saveMemory(browserStore(), memory);
  for (const listener of listeners) listener();
  if (!wrote) saveFailed();
}

export function getMemory() {
  return memory;
}

export function subscribeMemory(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerVarietyPayer(fn: (intent: RewardIntent) => PayResult) {
  payer = fn;
}

export function registerVarietySaveFailure(fn: () => void) {
  saveFailed = fn;
}

export function replaceMemory(next: Memory) {
  commit(next);
}

export function varietyHeading() {
  const active = memory.active;
  if (!active) return "校園異象";
  return eventById(active.eventId)?.title ?? "校園異象";
}

export function offerAt(x: number, z: number, caps: Caps) {
  return selectVariety({ catalog: VARIETY_EVENTS, memory, x, z, caps });
}

export function beginEvent(eventId: string, caps: Caps) {
  const event = eventById(eventId);
  if (!event) return false;
  if (memory.active && memory.active.eventId !== eventId) return false;
  if (memory.active) return true;
  const next = startRun(memory, event, caps);
  if (!next.active) return false;
  commit(next);
  return true;
}

export function actVariety(action: PlayAction) {
  commit(reduceVariety(memory, action));
}

export function claimVariety(): PayResult {
  const intent = claimIntent(memory);
  if (!intent) return { paid: false, already: true, xp: 0, notes: 0, credit: 0 };
  const result = payer(intent);
  if (result.paid || result.already) commit(markClaim(memory, intent.questId));
  return result;
}

export function dismissVariety() {
  if (memory.active?.phase !== "success") return;
  if (claimIntent(memory)) return;
  commit({ ...memory, active: null });
}

export function readStorySignals() {
  return memory.signals;
}

export const varietyAnchors = VARIETY_EVENTS.map((event) => ({
  id: event.id,
  title: event.title,
  x: event.x,
  z: event.z,
}));
