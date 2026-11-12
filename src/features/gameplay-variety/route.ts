import type { Caps, RouteBoard, RouteConfig } from "./types.ts";

export function buildRoute(config: RouteConfig, caps: Caps): RouteBoard {
  const skilled = caps.skillRank >= 2;
  return {
    board: "route",
    stops: config.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      cost: skilled && stop.skilledCost != null ? stop.skilledCost : stop.cost,
    })),
    budget: config.budget,
    required: [...config.required],
    blockedFirst: config.blockedFirst,
    before: config.before ? [config.before[0], config.before[1]] : null,
    order: [],
    note: config.note,
    objection: null,
    checks: 0,
  };
}

export function routeVerdict(board: RouteBoard): { ok: boolean; reason: string; spent: number } {
  const seen = new Set<string>();
  let spent = 0;
  if (board.blockedFirst && board.order[0] === board.blockedFirst) {
    return { ok: false, reason: "這站現在沒開，不能排第一。", spent: 0 };
  }
  for (const id of board.order) {
    if (seen.has(id)) return { ok: false, reason: "同一站排了兩次。", spent };
    seen.add(id);
    const stop = board.stops.find((entry) => entry.id === id);
    if (!stop) return { ok: false, reason: "有一站不在這張圖上。", spent };
    spent += stop.cost;
  }
  if (board.before) {
    const [earlier, later] = board.before;
    const a = board.order.indexOf(earlier);
    const b = board.order.indexOf(later);
    if (a < 0 || b < 0 || a > b) {
      return { ok: false, reason: "順序不對，前面的站還沒走到。", spent };
    }
  }
  for (const id of board.required) {
    if (!seen.has(id)) return { ok: false, reason: "還有必須走到的站。", spent };
  }
  if (spent > board.budget) return { ok: false, reason: `超過 ${board.budget} 分鐘。`, spent };
  return { ok: true, reason: `走完，用了 ${spent} 分鐘。`, spent };
}
