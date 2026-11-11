import type { CollegeId } from "../../game/departments.ts";
import type { GrowthState } from "../../game/rpg/growth/types.ts";

export const CONTENT_REVISION = 1;
export const SAVE_VERSION = 1;
export const SAVE_SYNC = "local-fixture-only" as const;

export const EVIDENCE = ["factual", "fictional", "gameplay-adaptation"] as const;
export type Evidence = (typeof EVIDENCE)[number];

export const ACCURACY = ["surveyed", "mapped", "estimated"] as const;
export type Accuracy = (typeof ACCURACY)[number];

export const CONFIDENCE = [
  "official-page",
  "inherited-registry",
  "filename-only",
  "unverified",
] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const TIME_SLOTS = ["morning", "afternoon", "evening", "night"] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export const WEATHERS = ["clear", "rain", "dusk"] as const;
export type WeatherId = (typeof WEATHERS)[number];

export const SEMESTERS = ["week-1", "midterm", "finals"] as const;
export type SemesterPhase = (typeof SEMESTERS)[number];

export const ZONES = [
  "axis-54",
  "library-55",
  "stem-56",
  "teaching-57",
  "culture-58",
  "sports-59",
  "life-60",
  "cross-zone",
] as const;
export type ContentZone = (typeof ZONES)[number];

export const MATURITY_KEYS = [
  "authored",
  "validated",
  "previewed",
  "integrated",
  "reviewed",
] as const;
export type Maturity = Record<(typeof MATURITY_KEYS)[number], boolean>;

export type LocaleText = { "zh-Hant": string } & Record<string, string>;

export type SourceRef = {
  url: string;
  consulted: string;
  version: string;
  confidence: Confidence;
};

export type PlaceFigure = {
  label: string;
  value: number;
  unit: string;
  accuracy: Accuracy;
  referenceId: string;
};

export type PlaceClaim = {
  text: string;
  sourceUrl: string;
};

export type PlaceRecord = {
  id: string;
  name: string;
  zone: ContentZone;
  use: string;
  evidence: Evidence;
  accuracy: Accuracy;
  aliasOf: string | null;
  sources: SourceRef[];
  pending: string[];
  conflicts: string[];
  relatedQuests: string[];
  claims: PlaceClaim[];
  figures: PlaceFigure[];
  recordClass:
    | "building"
    | "landmark"
    | "alias"
    | "homonym"
    | "omission"
    | "road"
    | "entrance"
    | "venue"
    | "supply"
    | "meta";
  registryStatus: string | null;
  notes: string | null;
};

export type Condition =
  | { op: "all"; of: Condition[] }
  | { op: "any"; of: Condition[] }
  | { op: "not"; of: Condition }
  | { op: "flag"; id: string; equals: boolean }
  | { op: "flag-any"; ids: string[] }
  | { op: "place"; id: string }
  | { op: "zone"; id: string }
  | { op: "college"; id: CollegeId }
  | { op: "department"; id: string }
  | { op: "time"; slot: TimeSlot }
  | { op: "weather"; id: WeatherId }
  | { op: "semester"; phase: SemesterPhase }
  | { op: "quest-node"; questId: string; node: string }
  | { op: "memory"; npcId: string; key: string; equals: string }
  | { op: "seen"; eventId: string; equals: boolean };

export type Effect =
  | { type: "quest-reward"; questId: string; xp?: number; notes?: number; credit?: number }
  | { type: "set-flag"; flag: string; value: boolean }
  | { type: "set-quest-node"; questId: string; node: string }
  | { type: "discover-place"; placeId: string }
  | { type: "remember"; npcId: string; key: string; value: string }
  | { type: "cooldown"; eventId: string; minutes: number };

export type Line = { when?: Condition; text: LocaleText };

export type Choice = {
  id: string;
  text: LocaleText;
  when?: Condition;
  skillId?: string;
  effects: Effect[];
  outcome: Line[];
  nextEventId: string | null;
};

export type EventRecord = {
  id: string;
  version: number;
  placeId: string;
  npcIds: string[];
  priority: number;
  weight: number;
  cooldownMinutes: number;
  mutexGroup: string | null;
  mutexMinutes: number;
  once: boolean;
  autoFire: boolean;
  anomaly: boolean;
  evidence: Evidence;
  when?: Condition;
  lines: Line[];
  choices: Choice[];
  assets: {
    images: { id: string; required: boolean }[];
    audio: { id: string; required: boolean }[];
    animation: string[];
  };
  status: Maturity;
  recovery: { leave: LocaleText; unavailable: LocaleText };
};

export type QuestNode = {
  id: string;
  requires: string | null;
  summary: LocaleText;
};

export type QuestRecord = {
  id: string;
  title: LocaleText;
  evidence: Evidence;
  arc: boolean;
  nodes: QuestNode[];
  rewardIds: string[];
};

export type NpcRecord = {
  id: string;
  name: string;
  evidence: Evidence;
  collegeId: CollegeId | null;
  departmentId: string | null;
  officialUnit: string | null;
  unmappedDepartment: boolean;
  voice: string;
  note: string;
};

export type AssetClass = "research" | "redistributable" | "original";
export type AssetStatus = "ready" | "pending" | "reference-only";

export type AssetRecord = {
  id: string;
  class: AssetClass;
  kind: "character" | "building" | "plant" | "prop" | "skill" | "ui" | "audio" | "illustration";
  author: string;
  sourceUrl: string | null;
  version: string;
  licenseEvidence: string;
  modifiable: boolean;
  redistributable: boolean;
  credit: string;
  usedIn: string[];
  status: AssetStatus;
  path: string | null;
  hotlink: boolean;
  note: string;
};

export type UnitRow = {
  officialName: string;
  collegeId: CollegeId;
  departmentId?: string;
  note?: string;
};

export type OfficialUnits = {
  consulted: string;
  source: string;
  mapped: UnitRow[];
  unmapped: UnitRow[];
  conflicts: string[];
};

export type NarrativeSession = {
  version: 1;
  seed: string;
  rngState: number;
  minute: number;
  placeId: string | null;
  weather: WeatherId;
  timeOfDay: TimeSlot;
  semester: SemesterPhase;
  collegeId: CollegeId | null;
  departmentId: string | null;
  flags: Record<string, boolean>;
  questNodes: Record<string, string>;
  memory: Record<string, string>;
  cooldowns: Record<string, number>;
  mutexUntil: Record<string, number>;
  mutexHolder: Record<string, string>;
  recent: string[];
  fired: string[];
  resolved: string[];
  activeEventId: string | null;
  mode: "exploring" | "in-event";
};

export type PlayUi = {
  phase: "exploring" | "available" | "talking" | "outcome";
  eventId: string | null;
  outcome: string | null;
  notice: string | null;
  considered: string[];
};

export type Play = {
  session: NarrativeSession;
  growth: GrowthState;
  ui: PlayUi;
};

export type NarrativeEnvelope = {
  version: 1;
  sync: typeof SAVE_SYNC;
  contentRevision: 1;
  session: NarrativeSession;
  growth: GrowthState;
  ui: PlayUi;
};

export type BriefRecord = {
  id: string;
  subject: "character" | "building" | "plant" | "prop" | "skill" | "ui" | "audio" | "illustration";
  style: string;
  size: string;
  use: string;
  format: string;
  transparent: boolean;
  acceptance: string;
  status: "ready" | "pending";
  assetIds: string[];
};

export type OssCandidate = {
  name: string;
  repo: string;
  version: string;
  license: string;
  inspected: string;
  maintenance: string;
  need: string;
  compatibility: string;
  size: string;
  alternative: string;
  decision: string;
  adopted: boolean;
};

export type Catalog = {
  revision: number;
  places: PlaceRecord[];
  npcs: NpcRecord[];
  quests: QuestRecord[];
  events: EventRecord[];
  assets: AssetRecord[];
  units: OfficialUnits;
  briefs: BriefRecord[];
  oss: OssCandidate[];
};

export type InventoryStats = {
  rows: number;
  namedSiteRows: number;
  aliasRows: number;
  surveyed: number;
  statement: string;
};
