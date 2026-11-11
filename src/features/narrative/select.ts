import { evalCondition } from "./conditions.ts";
import { nextRng } from "./rng.ts";
import type { Catalog, EventRecord, NarrativeSession, PlaceRecord } from "./types.ts";

export type Suppression = {
  id: string;
  reason: "once" | "cooldown" | "mutex" | "condition" | "place" | "recent";
};

export type Selection = {
  event: EventRecord | null;
  session: NarrativeSession;
  eligible: string[];
  suppressed: Suppression[];
};

function atPlace(event: EventRecord, place: PlaceRecord): boolean {
  return place.id === event.placeId || place.aliasOf === event.placeId;
}

function weighted(events: EventRecord[], roll: number): EventRecord {
  const total = events.reduce((sum, event) => sum + event.weight, 0);
  let cursor = roll * total;
  for (const event of events) {
    cursor -= event.weight;
    if (cursor < 0) return event;
  }
  return events[events.length - 1];
}

/**
 * One draw per call. No eligible event returns null and leaves exploration open.
 * Recent ids are skipped only while another eligible event remains.
 */
export function selectEvent(
  catalog: Catalog,
  session: NarrativeSession,
  place: PlaceRecord,
): Selection {
  const rolled = nextRng(session.rngState);
  const nextSession = { ...session, rngState: rolled.state };
  const suppressed: Suppression[] = [];
  const ctx = { session, place };
  const tierCandidates: EventRecord[] = [];
  for (const event of catalog.events) {
    if (!atPlace(event, place)) {
      suppressed.push({ id: event.id, reason: "place" });
      continue;
    }
    if (event.once && session.resolved.includes(event.id)) {
      suppressed.push({ id: event.id, reason: "once" });
      continue;
    }
    if (session.minute < (session.cooldowns[event.id] ?? 0)) {
      suppressed.push({ id: event.id, reason: "cooldown" });
      continue;
    }
    if (event.mutexGroup && session.minute < (session.mutexUntil[event.mutexGroup] ?? 0)) {
      const holder = session.mutexHolder[event.mutexGroup];
      if (holder && holder !== event.id) {
        suppressed.push({ id: event.id, reason: "mutex" });
        continue;
      }
    }
    if (!evalCondition(event.when, ctx)) {
      suppressed.push({ id: event.id, reason: "condition" });
      continue;
    }
    tierCandidates.push(event);
  }
  if (!tierCandidates.length) {
    return { event: null, session: nextSession, eligible: [], suppressed };
  }
  const top = Math.max(...tierCandidates.map((event) => event.priority));
  const tier = tierCandidates.filter((event) => event.priority === top);
  const recent = new Set(session.recent);
  const fresh = tier.filter((event) => !recent.has(event.id));
  const pool = fresh.length > 0 ? fresh : tier;
  for (const event of tier) {
    if (!pool.includes(event)) suppressed.push({ id: event.id, reason: "recent" });
  }
  const event = pool.length === 1 ? pool[0] : weighted(pool, rolled.value);
  return { event, session: nextSession, eligible: pool.map((entry) => entry.id), suppressed };
}
