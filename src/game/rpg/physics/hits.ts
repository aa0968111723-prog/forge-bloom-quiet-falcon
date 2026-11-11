export type HitSignal = {
  kind: "dodge-iframe" | "hit" | "blocked";
  targetId: string;
  amount: number;
  order: number;
};

export type HitIntent = {
  targetId: string;
  amount: number;
  /** Lower runs first. Omitted priorities are 0. */
  priority?: number;
  iframe?: boolean;
  blocked?: boolean;
};

/**
 * Same-frame order is priority, then targetId, then input index.
 * A dodge iframe reports amount 0 so the consumer does not deduct life.
 */
export function resolveHitSignals(intents: readonly HitIntent[]): HitSignal[] {
  const ranked = intents.map((intent, index) => ({ intent, index }));
  ranked.sort((a, b) => {
    const priority = (a.intent.priority ?? 0) - (b.intent.priority ?? 0);
    if (priority !== 0) return priority;
    if (a.intent.targetId < b.intent.targetId) return -1;
    if (a.intent.targetId > b.intent.targetId) return 1;
    return a.index - b.index;
  });
  return ranked.map(({ intent }, order) => {
    if (intent.iframe) {
      return { kind: "dodge-iframe", targetId: intent.targetId, amount: 0, order };
    }
    if (intent.blocked) {
      return { kind: "blocked", targetId: intent.targetId, amount: 0, order };
    }
    return {
      kind: "hit",
      targetId: intent.targetId,
      amount: Math.max(0, intent.amount),
      order,
    };
  });
}

export type HitLedger = {
  apply: (
    frame: number,
    hp: Readonly<Record<string, number>>,
    signals: readonly HitSignal[],
  ) => { hp: Record<string, number>; applied: number };
};

/** Each frame/order/target is deducted once. Later calls with the same key add nothing. */
export function createHitLedger(): HitLedger {
  const seen = new Set<string>();
  return {
    apply(frame, hp, signals) {
      const next = { ...hp };
      let applied = 0;
      for (const signal of signals) {
        const key = `${frame}:${signal.order}:${signal.targetId}:${signal.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (signal.kind !== "hit") continue;
        const before = next[signal.targetId] ?? 0;
        next[signal.targetId] = before - signal.amount;
        applied += signal.amount;
      }
      return { hp: next, applied };
    },
  };
}
