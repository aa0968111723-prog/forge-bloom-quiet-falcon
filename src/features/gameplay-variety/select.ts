import { nextRng, startRng } from "../narrative/rng.ts";
import type { Caps, Memory, VarietyEvent } from "./types.ts";

export type Suppression = { id: string; reason: string };

export type VarietyPick = {
  event: VarietyEvent | null;
  memory: Memory;
  eligible: string[];
  suppressed: Suppression[];
  resume: boolean;
};

function abilityOk(event: VarietyEvent, caps: Caps) {
  if (event.ability === "equipped") return caps.equipped;
  if (event.ability === "skill-2") return caps.skillRank >= 2;
  if (event.ability === "built") return caps.built >= 1;
  return true;
}

function weighted(events: VarietyEvent[], roll: number) {
  const total = events.length;
  const index = Math.min(events.length - 1, Math.floor(roll * total));
  return events[index];
}

/**
 * One draw. Seed replaces the saved rng for this call so a test can replay it.
 * No wall clock is read. A resolved event cannot be drawn again.
 */
export function selectVariety(input: {
  catalog: readonly VarietyEvent[];
  memory: Memory;
  x: number;
  z: number;
  caps: Caps;
  seed?: string;
}): VarietyPick {
  if (input.memory.active) {
    const current = input.catalog.find((event) => event.id === input.memory.active?.eventId) ?? null;
    return {
      event: current,
      memory: input.memory,
      eligible: current ? [current.id] : [],
      suppressed: [],
      resume: true,
    };
  }
  const rolled = nextRng(input.seed ? startRng(input.seed) : input.memory.rng);
  const memory = { ...input.memory, rng: rolled.state };
  const suppressed: Suppression[] = [];
  const near: VarietyEvent[] = [];
  for (const event of input.catalog) {
    const distance = Math.hypot(input.x - event.x, input.z - event.z);
    if (distance > event.reach) {
      suppressed.push({ id: event.id, reason: "region" });
      continue;
    }
    if (input.memory.resolved.includes(event.id)) {
      suppressed.push({ id: event.id, reason: "once" });
      continue;
    }
    if (event.requires.some((id) => !input.memory.resolved.includes(id))) {
      suppressed.push({ id: event.id, reason: "requires" });
      continue;
    }
    if (!abilityOk(event, input.caps)) {
      suppressed.push({ id: event.id, reason: "ability" });
      continue;
    }
    if (input.memory.resolved.length === 0 && event.difficulty > 1) {
      suppressed.push({ id: event.id, reason: "progress" });
      continue;
    }
    near.push(event);
  }
  if (!near.length) {
    return { event: null, memory, eligible: [], suppressed, resume: false };
  }
  const top = Math.max(...near.map((event) => event.priority));
  const tier = near.filter((event) => event.priority === top);
  for (const event of near) {
    if (!tier.includes(event)) suppressed.push({ id: event.id, reason: "priority" });
  }
  const recent = new Set(input.memory.recent);
  const fresh = tier.filter((event) => !recent.has(event.id));
  const pool = fresh.length > 0 ? fresh : tier;
  for (const event of tier) {
    if (!pool.includes(event)) suppressed.push({ id: event.id, reason: "recent" });
  }
  const event = pool.length === 1 ? pool[0] : weighted(pool, rolled.value);
  return { event, memory, eligible: pool.map((entry) => entry.id), suppressed, resume: false };
}
