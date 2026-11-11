import type { CollegeId } from "../../departments.ts";

/** Save version stays 1 or 2. This module never writes 3. */
export type GrowthVersion = 1 | 2;

export type MaterialBag = {
  notes: number;
  credit: number;
};

export type XpSource = "explore" | "combat" | "quest";

export type GrowthState = {
  version: GrowthVersion;
  /** Catalog id, or the raw saved id when it is not in the catalog. */
  departmentId: string | null;
  /** departments.ts id when the saved major can be resolved. */
  catalogDepartmentId: string | null;
  /** Original id when it differed from the catalog id. */
  legacyDepartmentId: string | null;
  pendingId: string | null;
  confirmed: boolean;
  initialized: boolean;
  skillRank: number;
  xp: number;
  equipped: boolean;
  spentPoints: number;
  learned: string[];
  invested: MaterialBag;
  materials: MaterialBag;
  xpEvents: string[];
  claimedQuests: string[];
  discoveries: string[];
  mainDone: boolean;
  lesson: string | null;
  boss: number;
};

export type SpendReason =
  | "ok"
  | "once"
  | "capped"
  | "locked"
  | "level"
  | "points"
  | "materials"
  | "unconfirmed"
  | "unknown";

export type SpendResult = {
  ok: boolean;
  reason: SpendReason;
  state: GrowthState;
};

export type NodeStatus = "learned" | "available" | "locked" | "capped";

export type CastTemplate = "melee-pulse" | "projectile" | "heal" | "area";

export type CastPhase =
  | "ready"
  | "release"
  | "range"
  | "hit"
  | "miss"
  | "blocked"
  | "recover";

export type RankIndex = 1 | 2 | 3 | 4 | 5;

export type AbilityRank = {
  rank: RankIndex;
  /** Base damage plus (rank - 1) * 12. Matches the HUD line. */
  damage: number;
  increment: number;
  /** Shown while sitting on this rank: notes = rank * 5, credit = rank. */
  cost: MaterialBag;
};

export type CollegeAbility = {
  collegeId: CollegeId;
  type: CastTemplate;
  focus: number;
  cooldown: number;
  range: number;
  damage: number;
  special: string;
  effect: {
    heal: number;
    focusRestore: number;
    knockback: number;
  };
  colorName: string;
  skill: string;
  label: string;
  ranks: Record<RankIndex, AbilityRank>;
};

export const EMPTY_BAG: MaterialBag = { notes: 0, credit: 0 };

export function freshGrowthState(): GrowthState {
  return {
    version: 2,
    departmentId: null,
    catalogDepartmentId: null,
    legacyDepartmentId: null,
    pendingId: null,
    confirmed: false,
    initialized: false,
    skillRank: 1,
    xp: 0,
    equipped: false,
    spentPoints: 0,
    learned: [],
    invested: { ...EMPTY_BAG },
    materials: { ...EMPTY_BAG },
    xpEvents: [],
    claimedQuests: [],
    discoveries: [],
    mainDone: false,
    lesson: null,
    boss: 0,
  };
}
