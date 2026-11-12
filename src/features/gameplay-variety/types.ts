/** Gameplay variety contracts. Rewards stay on the existing quest settlement. */

export type VarietyKind =
  | "investigate"
  | "puzzle"
  | "escort"
  | "route"
  | "repair"
  | "combat";

export type VarietyRegion = "avenue" | "library" | "stem" | "sports" | "life";

export type RouteChoice = "peace" | "combat" | "field";

export type Caps = {
  equipped: boolean;
  skillRank: number;
  built: number;
  collegeId: string | null;
  discipline: string | null;
};

export type StorySignal = {
  type: "variety.resolved";
  eventId: string;
  route: RouteChoice;
  questId: string;
};

export type RewardSpec = {
  xp: number;
  notes: number;
  credit: number;
};

export type Clue = {
  id: string;
  place: string;
  minute: number;
  text: string;
};

export type InvestigateConfig = {
  rule: "exact" | "window";
  window: number;
  clues: Clue[];
  hint: string;
};

export type PuzzleConfig = {
  mode: "lamps" | "valves";
  start: number[];
  target: number[];
  limit: number;
  label: string;
};

export type EscortNode = {
  id: string;
  name: string;
  links: string[];
};

export type EscortConfig = {
  nodes: EscortNode[];
  hazards: string[];
  start: string;
  goal: string;
  cargo: number;
  barrierName: string;
};

export type RouteStop = {
  id: string;
  name: string;
  cost: number;
  /** Used when the player has skill rank 2 or higher. */
  skilledCost?: number;
};

export type RouteConfig = {
  stops: RouteStop[];
  budget: number;
  required: string[];
  blockedFirst: string | null;
  /** The first id must appear earlier in the order than the second. */
  before: [string, string] | null;
  note: string;
};

export type RepairConfig = {
  heat: number;
  slotNames: string[];
};

export type CombatKind =
  | "quiz"
  | "report"
  | "exam"
  | "final"
  | "rollcall"
  | "rollcall-late"
  | "downpour"
  | "downpour-slow"
  | "flyer"
  | "flyer-wide";

export type ArcShape = {
  kind: "arc";
  x: number;
  z: number;
  facing: number;
  radius: number;
  half: number;
};

export type RectShape = {
  kind: "rect";
  x: number;
  z: number;
  yaw: number;
  length: number;
  width: number;
};

export type Shape = ArcShape | RectShape;

export type Cell = { x: number; y: number };

export type CombatAction =
  | "north"
  | "east"
  | "south"
  | "west"
  | "strike"
  | "skill"
  | "dispel"
  | "guard"
  | "wait";

export type CombatState = {
  board: "combat";
  combat: CombatKind;
  player: Cell;
  playerHp: number;
  enemy: Cell;
  enemyHp: number;
  facing: number;
  windup: number;
  telegraph: Shape | null;
  commit: number;
  laneY: number | null;
  stun: number;
  step: number;
  retargets: number;
  desk: Cell | null;
  deskHp: number | null;
  nodes: Cell[];
  lit: boolean[];
  seats: Cell[] | null;
  seatIndex: number;
  misses: number;
  water: number | null;
  shelter: Cell | null;
  patrol: Cell[] | null;
  patrolAt: number;
  guard: boolean;
  lastPlayerHit: number;
  lastEnemyHit: number;
  lastShape: Shape | null;
  outcome: "ongoing" | "win" | "lose";
  log: string;
};

export type InvestigateBoard = InvestigateConfig & {
  board: "investigate";
  picked: string[];
  attempts: number;
};

export type PuzzleBoard = PuzzleConfig & {
  board: "puzzle";
  values: number[];
  moves: number;
};

export type EscortBoard = {
  board: "escort";
  nodes: EscortNode[];
  hazards: string[];
  turn: number;
  at: string;
  goal: string;
  cargo: number;
  maxCargo: number;
};

export type RouteBoard = {
  board: "route";
  stops: { id: string; name: string; cost: number }[];
  budget: number;
  required: string[];
  blockedFirst: string | null;
  before: [string, string] | null;
  order: string[];
  note: string;
  objection: string | null;
  checks: number;
};

export type RepairBoard = {
  board: "repair";
  parts: { id: string; name: string }[];
  slots: (string | null)[];
  slotNames: string[];
  heat: number;
  objection: string | null;
  checks: number;
};

export type Board =
  | InvestigateBoard
  | PuzzleBoard
  | EscortBoard
  | RouteBoard
  | RepairBoard
  | CombatState;

export type Phase =
  | "briefing"
  | "investigate"
  | "puzzle"
  | "fork"
  | "escort"
  | "combat"
  | "route"
  | "repair"
  | "success"
  | "failed"
  | "aborted";

export type Run = {
  eventId: string;
  phase: Phase;
  route: RouteChoice | null;
  board: Board | null;
  failReason: string | null;
  receipt: string | null;
  tutorial: boolean;
  caps: Caps;
};

export type Memory = {
  version: 1;
  rng: number;
  recent: string[];
  resolved: string[];
  claims: string[];
  /** Last night-patrol choice. Repair boards read this once, when they start. */
  route: "peace" | "combat" | null;
  active: Run | null;
  signals: StorySignal[];
  tutorialSeen: boolean;
};

export type VarietyEvent = {
  id: string;
  kind: "chain" | VarietyKind;
  title: string;
  summary: string;
  region: VarietyRegion;
  /** Estimated campus metres. Not a surveyed coordinate. */
  x: number;
  z: number;
  reach: number;
  difficulty: 1 | 2;
  priority: number;
  requires: string[];
  ability: null | "equipped" | "skill-2" | "built";
  briefing: string[];
  questId: string;
  questPeace?: string;
  questCombat?: string;
  reward: RewardSpec;
  investigate?: InvestigateConfig;
  puzzle?: PuzzleConfig;
  escort?: EscortConfig;
  routePlan?: RouteConfig;
  repair?: RepairConfig;
  combat?: CombatKind;
};

export type PlayAction =
  | { type: "ack" }
  | { type: "toggle-clue"; id: string }
  | { type: "submit-clues" }
  | { type: "toggle-puzzle"; index: number }
  | { type: "reset-puzzle" }
  | { type: "choose-route"; route: "escort" | "combat" }
  | { type: "escort-go"; node: string }
  | { type: "escort-wait" }
  | { type: "combat"; action: CombatAction }
  | { type: "route-pick"; id: string }
  | { type: "route-undo" }
  | { type: "route-commit" }
  | { type: "repair-assign"; part: string; slot: number }
  | { type: "repair-clear"; slot: number }
  | { type: "repair-check" }
  | { type: "retry" }
  | { type: "back-to-fork" }
  | { type: "abort" };

export type RewardIntent = {
  questId: string;
  reward: RewardSpec;
  eventId: string;
};
