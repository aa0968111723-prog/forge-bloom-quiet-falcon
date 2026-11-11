import { grantQuestReward, replayFastTravel } from "../../game/rpg/growth/progress.ts";
import type { GrowthState } from "../../game/rpg/growth/types.ts";
import { memoryKey } from "./conditions.ts";
import { EFFECT_TYPES } from "./schema.ts";
import type { Catalog, Effect, NarrativeSession } from "./types.ts";

export type EffectResult = {
  ok: boolean;
  reason: "illegal-effect" | null;
  growth: GrowthState;
  session: NarrativeSession;
  applied: string[];
  skipped: string[];
};

function positive(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value;
}

function applyOne(
  catalog: Catalog,
  growth: GrowthState,
  session: NarrativeSession,
  effect: Effect,
):
  | {
      ok: true;
      growth: GrowthState;
      session: NarrativeSession;
      applied: string | null;
      skipped: string | null;
    }
  | { ok: false } {
  if (!EFFECT_TYPES.includes(effect.type as (typeof EFFECT_TYPES)[number])) return { ok: false };
  switch (effect.type) {
    case "quest-reward": {
      if (!catalog.quests.some((quest) => quest.rewardIds.includes(effect.questId)))
        return { ok: false };
      const beforeNotes = growth.materials.notes;
      const beforeCredit = growth.materials.credit;
      const beforeXp = growth.xp;
      const next = grantQuestReward(growth, effect.questId, {
        xp: positive(effect.xp),
        notes: positive(effect.notes),
        credit: positive(effect.credit),
      });
      const changed =
        next !== growth ||
        next.xp !== beforeXp ||
        next.materials.notes !== beforeNotes ||
        next.materials.credit !== beforeCredit;
      return {
        ok: true,
        growth: next,
        session,
        applied: changed ? `quest-reward:${effect.questId}` : null,
        skipped: changed ? null : `quest-reward:${effect.questId}`,
      };
    }
    case "set-flag":
      return {
        ok: true,
        growth,
        session: { ...session, flags: { ...session.flags, [effect.flag]: effect.value } },
        applied: `flag:${effect.flag}`,
        skipped: null,
      };
    case "set-quest-node": {
      const quest = catalog.quests.find((entry) => entry.id === effect.questId);
      if (!quest || !quest.nodes.some((node) => node.id === effect.node)) return { ok: false };
      return {
        ok: true,
        growth,
        session: {
          ...session,
          questNodes: { ...session.questNodes, [effect.questId]: effect.node },
        },
        applied: `node:${effect.questId}:${effect.node}`,
        skipped: null,
      };
    }
    case "discover-place": {
      const place = catalog.places.find((entry) => entry.id === effect.placeId);
      if (!place || place.aliasOf) return { ok: false };
      const next = replayFastTravel(growth, effect.placeId);
      return {
        ok: true,
        growth: next,
        session,
        applied: next === growth ? null : `discover:${effect.placeId}`,
        skipped: next === growth ? `discover:${effect.placeId}` : null,
      };
    }
    case "remember": {
      if (!catalog.npcs.some((npc) => npc.id === effect.npcId)) return { ok: false };
      const key = memoryKey(effect.npcId, effect.key);
      return {
        ok: true,
        growth,
        session: { ...session, memory: { ...session.memory, [key]: effect.value } },
        applied: `memory:${key}`,
        skipped: null,
      };
    }
    case "cooldown": {
      if (!catalog.events.some((event) => event.id === effect.eventId)) return { ok: false };
      if (!Number.isFinite(effect.minutes) || effect.minutes < 0) return { ok: false };
      return {
        ok: true,
        growth,
        session: {
          ...session,
          cooldowns: { ...session.cooldowns, [effect.eventId]: session.minute + effect.minutes },
        },
        applied: `cooldown:${effect.eventId}`,
        skipped: null,
      };
    }
    default:
      return { ok: false };
  }
}

/** Apply a whitelist. An illegal effect rolls the whole list back. */
export function applyEffects(
  catalog: Catalog,
  growth: GrowthState,
  session: NarrativeSession,
  effects: readonly Effect[],
): EffectResult {
  let nextGrowth = growth;
  let nextSession = session;
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const effect of effects) {
    const step = applyOne(catalog, nextGrowth, nextSession, effect);
    if (!step.ok) {
      return { ok: false, reason: "illegal-effect", growth, session, applied: [], skipped: [] };
    }
    nextGrowth = step.growth;
    nextSession = step.session;
    if (step.applied) applied.push(step.applied);
    if (step.skipped) skipped.push(step.skipped);
  }
  return { ok: true, reason: null, growth: nextGrowth, session: nextSession, applied, skipped };
}
