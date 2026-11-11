import type { Condition, NarrativeSession, PlaceRecord } from "./types.ts";

export type EvalContext = {
  session: NarrativeSession;
  place: PlaceRecord | null;
  /** Reachability only. Gameplay leaves this unset. */
  everNodes?: ReadonlySet<string>;
  /** Reachability only. Player-controlled time, weather, and college count as possible. */
  abstractFreedom?: boolean;
};

export function memoryKey(npcId: string, key: string): string {
  return `${npcId}:${key}`;
}

export function evalCondition(condition: Condition | undefined, ctx: EvalContext): boolean {
  if (!condition) return true;
  switch (condition.op) {
    case "all":
      return condition.of.every((entry) => evalCondition(entry, ctx));
    case "any":
      return condition.of.some((entry) => evalCondition(entry, ctx));
    case "not":
      return !evalCondition(condition.of, ctx);
    case "flag":
      return Boolean(ctx.session.flags[condition.id]) === condition.equals;
    case "flag-any":
      return condition.ids.some((id) => Boolean(ctx.session.flags[id]));
    case "place":
      if (ctx.abstractFreedom) return true;
      return ctx.place?.id === condition.id || ctx.place?.aliasOf === condition.id;
    case "zone":
      if (ctx.abstractFreedom) return true;
      return ctx.place?.zone === condition.id;
    case "college":
      if (ctx.abstractFreedom) return true;
      return ctx.session.collegeId === condition.id;
    case "department":
      if (ctx.abstractFreedom) return true;
      return ctx.session.departmentId === condition.id;
    case "time":
      if (ctx.abstractFreedom) return true;
      return ctx.session.timeOfDay === condition.slot;
    case "weather":
      if (ctx.abstractFreedom) return true;
      return ctx.session.weather === condition.id;
    case "semester":
      if (ctx.abstractFreedom) return true;
      return ctx.session.semester === condition.phase;
    case "quest-node": {
      if (ctx.session.questNodes[condition.questId] === condition.node) return true;
      return ctx.everNodes?.has(`${condition.questId}:${condition.node}`) ?? false;
    }
    case "memory":
      return ctx.session.memory[memoryKey(condition.npcId, condition.key)] === condition.equals;
    case "seen":
      return ctx.session.fired.includes(condition.eventId) === condition.equals;
    default:
      return false;
  }
}

export function pickLine(
  lines: { when?: Condition; text: { "zh-Hant": string } }[],
  ctx: EvalContext,
): string {
  for (const line of lines) {
    if (evalCondition(line.when, ctx)) return line.text["zh-Hant"];
  }
  return "";
}
