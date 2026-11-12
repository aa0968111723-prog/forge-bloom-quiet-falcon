import { eventById } from "./catalog.ts";
import { createCombat, stepCombat } from "./combat.ts";
import { buildEscort, escortAct } from "./escort.ts";
import { agreeingClues, buildInvestigate, cluesMatch } from "./investigate.ts";
import { buildPuzzle, puzzleSolved, puzzleStep } from "./puzzle.ts";
import { buildRepair, repairVerdict } from "./repair.ts";
import { buildRoute, routeVerdict } from "./route.ts";
import type {
  Board,
  Caps,
  Memory,
  Phase,
  PlayAction,
  RewardIntent,
  RouteChoice,
  Run,
  VarietyEvent,
} from "./types.ts";

export const emptyCaps: Caps = {
  equipped: false,
  skillRank: 1,
  built: 0,
  collegeId: null,
  discipline: null,
};

function questFor(event: VarietyEvent, route: RouteChoice | null) {
  if (event.kind === "chain") {
    return route === "combat" ? (event.questCombat ?? event.questId) : (event.questPeace ?? event.questId);
  }
  return event.questId;
}

function signal(memory: Memory, event: VarietyEvent, route: RouteChoice): Memory["signals"] {
  return [
    ...memory.signals,
    { type: "variety.resolved" as const, eventId: event.id, route, questId: questFor(event, route) },
  ].slice(-20);
}

function openBeat(event: VarietyEvent, phase: Phase, memory: Memory, caps: Caps): Board | null {
  if (phase === "investigate" && event.investigate) return buildInvestigate(event.investigate);
  if (phase === "puzzle" && event.puzzle) return buildPuzzle(event.puzzle);
  if (phase === "escort" && event.escort) return buildEscort(event.escort, caps);
  if (phase === "route" && event.routePlan) return buildRoute(event.routePlan, caps);
  if (phase === "repair" && event.repair) return buildRepair(event.repair, memory.route === "peace");
  if (phase === "combat" && event.combat) return createCombat(event.combat);
  return null;
}

function firstPhase(event: VarietyEvent): Phase {
  if (event.kind === "chain") return "briefing";
  if (event.kind === "investigate") return "investigate";
  if (event.kind === "puzzle") return "puzzle";
  if (event.kind === "escort") return "escort";
  if (event.kind === "route") return "route";
  if (event.kind === "repair") return "repair";
  return "combat";
}

export function startRun(memory: Memory, event: VarietyEvent, caps: Caps): Memory {
  if (memory.active) return memory;
  if (memory.resolved.includes(event.id)) return memory;
  const phase =
    event.kind === "chain" && memory.tutorialSeen ? "investigate" : firstPhase(event);
  const run: Run = {
    eventId: event.id,
    phase,
    route: event.kind === "chain" ? null : "field",
    board: phase === "briefing" ? null : openBeat(event, phase, memory, caps),
    failReason: null,
    receipt: null,
    tutorial: event.kind === "chain" && !memory.tutorialSeen,
    caps,
  };
  const recent = [event.id, ...memory.recent.filter((id) => id !== event.id)].slice(0, 3);
  return { ...memory, recent, active: run };
}

function succeed(memory: Memory, run: Run, route: RouteChoice, receipt: string): Memory {
  const event = eventById(run.eventId);
  if (!event) return { ...memory, active: null };
  const resolved = memory.resolved.includes(event.id) ? memory.resolved : [...memory.resolved, event.id];
  const remembered = route === "peace" || route === "combat" ? route : memory.route;
  return {
    ...memory,
    resolved,
    route: remembered,
    signals: signal(memory, event, route),
    tutorialSeen: true,
    active: { ...run, phase: "success", route, board: null, failReason: null, receipt },
  };
}

function fail(memory: Memory, run: Run, reason: string, board: Board | null = run.board): Memory {
  return { ...memory, active: { ...run, phase: "failed", failReason: reason, board } };
}

function retryBoard(event: VarietyEvent, run: Run, memory: Memory): Board | null {
  if (run.phase === "failed") {
    if (run.route === "peace") return openBeat(event, "escort", memory, run.caps);
    if (run.route === "combat" && event.kind === "chain") return createCombat(event.combat ?? "report");
  }
  return openBeat(event, run.phase === "failed" ? beatPhase(run) : run.phase, memory, run.caps);
}

function beatPhase(run: Run): Phase {
  if (run.route === "peace") return "escort";
  if (run.route === "combat") return "combat";
  if (run.board?.board === "investigate") return "investigate";
  if (run.board?.board === "puzzle") return "puzzle";
  if (run.board?.board === "escort") return "escort";
  if (run.board?.board === "route") return "route";
  if (run.board?.board === "repair") return "repair";
  if (run.board?.board === "combat") return "combat";
  return "investigate";
}

export function reduceVariety(memory: Memory, action: PlayAction): Memory {
  const run = memory.active;
  if (!run || run.phase === "aborted") return memory;
  const event = eventById(run.eventId);
  if (!event) return { ...memory, active: null };

  if (action.type === "abort") {
    return { ...memory, active: null };
  }

  if (action.type === "ack") {
    if (run.phase !== "briefing") return memory;
    const board = openBeat(event, "investigate", memory, run.caps);
    return {
      ...memory,
      tutorialSeen: true,
      active: { ...run, phase: "investigate", board, tutorial: true },
    };
  }

  if (action.type === "retry") {
    if (run.phase !== "failed") return memory;
    const phase = beatPhase(run);
    return {
      ...memory,
      active: {
        ...run,
        phase,
        board: retryBoard(event, run, memory),
        failReason: null,
      },
    };
  }

  if (action.type === "back-to-fork") {
    if (run.phase !== "failed" || event.kind !== "chain") return memory;
    return { ...memory, active: { ...run, phase: "fork", route: null, board: null, failReason: null } };
  }

  if (run.phase === "investigate" && run.board?.board === "investigate") {
    if (action.type === "toggle-clue") {
      const picked = run.board.picked.includes(action.id)
        ? run.board.picked.filter((id) => id !== action.id)
        : [...run.board.picked, action.id];
      return { ...memory, active: { ...run, board: { ...run.board, picked } } };
    }
    if (action.type === "submit-clues") {
      const expected = agreeingClues(run.board);
      if (!cluesMatch(run.board.picked, expected)) {
        const attempts = run.board.attempts + 1;
        if (attempts >= 3) return fail(memory, run, "線索對不上。可以重試，題目不會換。", { ...run.board, attempts });
        return { ...memory, active: { ...run, board: { ...run.board, attempts } } };
      }
      if (event.kind === "chain" && event.puzzle) {
        return { ...memory, active: { ...run, phase: "puzzle", board: buildPuzzle(event.puzzle), failReason: null } };
      }
      return succeed(memory, run, "field", "線索對上了。");
    }
  }

  if (run.phase === "puzzle" && run.board?.board === "puzzle") {
    if (action.type === "reset-puzzle") {
      return {
        ...memory,
        active: { ...run, board: { ...run.board, values: [...run.board.start], moves: 0 } },
      };
    }
    if (action.type === "toggle-puzzle") {
      const values = puzzleStep(run.board.values, run.board.mode, action.index);
      const moves = run.board.moves + 1;
      const board = { ...run.board, values, moves };
      if (puzzleSolved(board)) {
        if (event.kind === "chain") {
          return { ...memory, active: { ...run, phase: "fork", board: null, failReason: null } };
        }
        return succeed(memory, run, "field", "機關歸位了。");
      }
      if (moves >= board.limit) return fail(memory, run, "步數用完了。重試會回到最初的機關。", board);
      return { ...memory, active: { ...run, board } };
    }
  }

  if (run.phase === "fork" && event.kind === "chain") {
    if (action.type === "choose-route" && action.route === "escort" && event.escort) {
      return {
        ...memory,
        active: {
          ...run,
          phase: "escort",
          route: "peace",
          board: buildEscort(event.escort, run.caps),
          failReason: null,
        },
      };
    }
    if (action.type === "choose-route" && action.route === "combat" && event.combat) {
      return {
        ...memory,
        active: {
          ...run,
          phase: "combat",
          route: "combat",
          board: createCombat(event.combat),
          failReason: null,
        },
      };
    }
  }

  if (run.phase === "escort" && run.board?.board === "escort") {
    if (action.type === "escort-go" || action.type === "escort-wait") {
      const next = action.type === "escort-go" ? action.node : null;
      const result = escortAct(run.board, next);
      if (result.done === "success") return succeed(memory, run, run.route ?? "peace", "筆記送到了。");
      if (result.done === "failed") return fail(memory, run, result.reason ?? "護送失敗。", result.board);
      return { ...memory, active: { ...run, board: result.board } };
    }
  }

  if (run.phase === "combat" && run.board?.board === "combat" && action.type === "combat") {
    const sim = stepCombat(run.board, action.action, run.caps);
    if (sim.outcome === "win") {
      const route = run.route === "combat" ? "combat" : "field";
      return succeed(memory, run, route, sim.log);
    }
    if (sim.outcome === "lose") return fail(memory, run, sim.log, sim);
    return { ...memory, active: { ...run, board: sim } };
  }

  if (run.phase === "route" && run.board?.board === "route") {
    if (action.type === "route-pick" && !run.board.order.includes(action.id)) {
      return {
        ...memory,
        active: { ...run, board: { ...run.board, order: [...run.board.order, action.id], objection: null } },
      };
    }
    if (action.type === "route-undo") {
      return {
        ...memory,
        active: { ...run, board: { ...run.board, order: run.board.order.slice(0, -1), objection: null } },
      };
    }
    if (action.type === "route-commit") {
      const verdict = routeVerdict(run.board);
      if (!verdict.ok) {
        const checks = (run.board.checks ?? 0) + 1;
        const board = { ...run.board, objection: verdict.reason, checks };
        if (checks >= 3) return fail(memory, run, verdict.reason, board);
        return { ...memory, active: { ...run, board } };
      }
      return succeed(memory, run, "field", verdict.reason);
    }
  }

  if (run.phase === "repair" && run.board?.board === "repair") {
    if (action.type === "repair-clear") {
      const slots = run.board.slots.map((part, index) => (index === action.slot ? null : part));
      return { ...memory, active: { ...run, board: { ...run.board, slots, objection: null } } };
    }
    if (action.type === "repair-assign") {
      const slots = run.board.slots.map((part) => (part === action.part ? null : part));
      if (action.slot < 0 || action.slot >= slots.length) return memory;
      slots[action.slot] = action.part;
      return { ...memory, active: { ...run, board: { ...run.board, slots, objection: null } } };
    }
    if (action.type === "repair-check") {
      const verdict = repairVerdict(run.board);
      if (!verdict.ok) {
        const checks = (run.board.checks ?? 0) + 1;
        const board = { ...run.board, objection: verdict.reason, checks };
        if (checks >= 3) return fail(memory, run, verdict.reason, board);
        return { ...memory, active: { ...run, board } };
      }
      return succeed(memory, run, "field", verdict.reason);
    }
  }

  return memory;
}

export function claimIntent(memory: Memory): RewardIntent | null {
  const run = memory.active;
  if (!run || run.phase !== "success") return null;
  const event = eventById(run.eventId);
  if (!event) return null;
  const questId = questFor(event, run.route);
  if (memory.claims.includes(questId)) return null;
  return { questId, reward: event.reward, eventId: event.id };
}

export function markClaim(memory: Memory, questId: string): Memory {
  if (memory.claims.includes(questId)) return memory;
  return { ...memory, claims: [...memory.claims, questId] };
}
