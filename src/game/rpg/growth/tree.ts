import { COLLEGE_IDS, departmentById, type CollegeId } from "../../departments.ts";
import { levelForXp } from "../rules.ts";
import { COLLEGE_ABILITIES, upgradeCost } from "./abilities.ts";
import { GROWTH_BANDS, pointsLeft } from "./bands.ts";
import type { GrowthState, NodeStatus, SpendResult } from "./types.ts";

export type SkillNodeKind = "rank" | "branch" | "capstone";

export type SkillNode = {
  id: string;
  collegeId: CollegeId;
  kind: SkillNodeKind;
  rank: number | null;
  requires: readonly string[];
  minLevel: number;
  pointCost: number;
  cost: { notes: number; credit: number };
  terminal: boolean;
};

const MID_LEVEL = GROWTH_BANDS[1].level;
const LATE_LEVEL = GROWTH_BANDS[2].level;

function rankId(collegeId: CollegeId, rank: number) {
  return `${collegeId}:rank:${rank}`;
}

function buildCollege(collegeId: CollegeId): SkillNode[] {
  const branchId = `${collegeId}:branch`;
  const capstoneId = `${collegeId}:capstone`;
  const ranks: SkillNode[] = [];
  for (let rank = 1; rank <= 5; rank++) {
    ranks.push({
      id: rankId(collegeId, rank),
      collegeId,
      kind: "rank",
      rank,
      requires: rank === 1 ? [] : [rankId(collegeId, rank - 1)],
      minLevel: rank,
      pointCost: rank === 1 ? 0 : 1,
      cost: rank === 1 ? { notes: 0, credit: 0 } : upgradeCost(rank - 1),
      terminal: rank === 5,
    });
  }
  const branch: SkillNode = {
    id: branchId,
    collegeId,
    kind: "branch",
    rank: null,
    requires: [rankId(collegeId, 3)],
    minLevel: MID_LEVEL,
    pointCost: 1,
    cost: { notes: 30, credit: 4 },
    terminal: false,
  };
  const capstone: SkillNode = {
    id: capstoneId,
    collegeId,
    kind: "capstone",
    rank: null,
    requires: [branchId, rankId(collegeId, 5)],
    minLevel: LATE_LEVEL,
    pointCost: 1,
    cost: { notes: 40, credit: 8 },
    terminal: true,
  };
  return [ranks[0], ranks[1], ranks[2], branch, ranks[3], ranks[4], capstone];
}

const NODES: Record<CollegeId, SkillNode[]> = Object.fromEntries(
  COLLEGE_IDS.map((collegeId) => [collegeId, buildCollege(collegeId)]),
) as Record<CollegeId, SkillNode[]>;

const NODE_BY_ID = new Map<string, SkillNode>();
for (const collegeId of COLLEGE_IDS) {
  for (const node of NODES[collegeId]) NODE_BY_ID.set(node.id, node);
}

export function skillNodes(collegeId: CollegeId): readonly SkillNode[] {
  return NODES[collegeId];
}

/** Stable linear id list for arrow-key traversal. Order does not follow unlock state. */
export function skillKeyboardIds(collegeId: CollegeId): readonly string[] {
  return NODES[collegeId].map((node) => node.id);
}

export function findSkillNode(nodeId: string): SkillNode | null {
  return NODE_BY_ID.get(nodeId) ?? null;
}

export function collegeOf(state: Pick<GrowthState, "departmentId" | "catalogDepartmentId">): CollegeId | null {
  const id = state.catalogDepartmentId ?? state.departmentId;
  return departmentById(id)?.collegeId ?? null;
}

export function nodeStatus(state: GrowthState, nodeId: string): NodeStatus {
  const node = findSkillNode(nodeId);
  if (!node) return "locked";
  const learned = state.learned.includes(node.id);
  if (learned) return node.terminal ? "capped" : "learned";
  if (collegeOf(state) !== node.collegeId) return "locked";
  if (node.requires.some((id) => !state.learned.includes(id))) return "locked";
  if (levelForXp(state.xp) < node.minLevel) return "locked";
  return "available";
}

/** Mark trunk ranks already paid for by a saved skillRank. Does not touch branch nodes. */
export function learnCurrentRanks(state: GrowthState): GrowthState {
  const college = collegeOf(state);
  if (!college) return state;
  const have = new Set(state.learned);
  let changed = false;
  for (let rank = 1; rank <= state.skillRank; rank++) {
    const id = rankId(college, rank);
    if (!have.has(id)) {
      have.add(id);
      changed = true;
    }
  }
  const spentPoints = Math.max(state.spentPoints, state.skillRank - 1);
  if (spentPoints !== state.spentPoints) changed = true;
  if (!changed && state.initialized) return state;
  const order = skillKeyboardIds(college);
  const learned = [
    ...order.filter((id) => have.has(id)),
    ...[...have].filter((id) => !order.includes(id)),
  ];
  return { ...state, learned, spentPoints, initialized: true };
}

export function spendPoint(state: GrowthState, nodeId: string): SpendResult {
  const node = findSkillNode(nodeId);
  if (!node) return { ok: false, reason: "unknown", state };
  const college = collegeOf(state);
  if (!state.confirmed) return { ok: false, reason: "unconfirmed", state };
  if (!college || node.collegeId !== college) return { ok: false, reason: "locked", state };
  if (state.learned.includes(node.id)) {
    return { ok: false, reason: node.terminal ? "capped" : "once", state };
  }
  if (node.requires.some((id) => !state.learned.includes(id))) {
    return { ok: false, reason: "locked", state };
  }
  if (levelForXp(state.xp) < node.minLevel) return { ok: false, reason: "level", state };
  if (pointsLeft(state.xp, state.spentPoints) < node.pointCost) {
    return { ok: false, reason: "points", state };
  }
  if (state.materials.notes < node.cost.notes || state.materials.credit < node.cost.credit) {
    return { ok: false, reason: "materials", state };
  }
  const next: GrowthState = {
    ...state,
    learned: [...state.learned, node.id],
    spentPoints: state.spentPoints + node.pointCost,
    materials: {
      notes: state.materials.notes - node.cost.notes,
      credit: state.materials.credit - node.cost.credit,
    },
    invested: {
      notes: state.invested.notes + node.cost.notes,
      credit: state.invested.credit + node.cost.credit,
    },
    skillRank:
      node.kind === "rank" && node.rank
        ? Math.max(state.skillRank, node.rank)
        : state.skillRank,
    initialized: true,
  };
  return { ok: true, reason: "ok", state: next };
}

export function abilityForCollege(collegeId: CollegeId) {
  return COLLEGE_ABILITIES[collegeId];
}
