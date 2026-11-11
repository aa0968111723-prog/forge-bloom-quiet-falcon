import { SAVE_VERSION } from "../../save.ts";
import { RPG_SAVE_KEY } from "../store.ts";
import { STORY_SAVE_KEY, STORY_SAVE_VERSION } from "../semester/story.ts";
import {
  CAMPUS_REGISTRY,
  CHECK_POINTS,
  CONTROL_POINTS,
  acceptanceTable,
} from "../../world-data/registry/index.ts";
import { completionCount, walkScript } from "../../world-data/districts/index.ts";

const CHECK_IDS = [
  "chk-main-gate",
  "chk-palace-corner",
  "chk-museum-bow",
  "chk-kenan-landing",
] as const;

const GRAYBOX_IDS = ["palace", "library", "gym", "museum"] as const;

function pendingVerdict(accuracy: string): "待測" | "不得標通過" {
  return accuracy === "surveyed" ? "不得標通過" : "待測";
}

const checks = CHECK_IDS.map((id) => {
  const point = CHECK_POINTS.find((row) => row.id === id);
  if (!point) throw new Error(`missing check point ${id}`);
  return {
    id: point.id,
    name: point.name,
    x: point.x,
    y: point.y,
    z: point.z,
    accuracy: point.accuracy,
    usableForFit: point.usableForFit,
    reservedFor: point.reservedFor,
    verdict: pendingVerdict(point.accuracy),
  };
});

const acceptanceRows = acceptanceTable();

const accuracyRows = [
  ...checks.map((point) => ({
    kind: "check" as const,
    id: point.id,
    accuracy: point.accuracy,
    verdict: point.verdict,
  })),
  ...CONTROL_POINTS.map((point) => ({
    kind: "control" as const,
    id: point.id,
    accuracy: point.accuracy,
    verdict: pendingVerdict(point.accuracy),
  })),
  ...CAMPUS_REGISTRY.map((row) => ({
    kind: "registry" as const,
    id: row.permanentId,
    accuracy: row.accuracy,
    verdict: pendingVerdict(row.accuracy),
  })),
  ...acceptanceRows.map((row) => ({
    kind: "acceptance" as const,
    id: row.permanentId,
    accuracy: null,
    surveyedValue: row.surveyedValue,
    verdict: row.verdict === "pending" ? ("待測" as const) : ("不得標通過" as const),
  })),
];

const walks = GRAYBOX_IDS.map((id) => {
  const script = walkScript(id);
  return {
    id,
    controlPointsUsedForFit: script.controlPointsUsedForFit,
    stepCount: script.stepCount,
    surveyedStepCount: script.surveyedStepCount,
  };
});

/** Pure snapshot. Values come from the live exports, not a second copy of the keys. */
export const ACCEPTANCE_MATRIX = {
  save: {
    version: SAVE_VERSION,
    versionSource: "src/game/save.ts#SAVE_VERSION",
    rpgSaveKey: RPG_SAVE_KEY,
    rpgSaveKeySource: "src/game/rpg/store.ts#RPG_SAVE_KEY",
    storySaveKey: STORY_SAVE_KEY,
    storySaveVersion: STORY_SAVE_VERSION,
    storySource: "src/game/rpg/semester/story.ts",
    sameKey: RPG_SAVE_KEY === STORY_SAVE_KEY,
    sameVersion: SAVE_VERSION === STORY_SAVE_VERSION,
  },
  login: {
    loginFree: true,
    basis: "source",
    file: "src/game/rpg/AdventureApp.tsx",
    publicSiteMeasured: false,
    note: "依據是原始碼沒有登入流程，不是公開網站實測",
  },
  survey: {
    checks,
    usedForFit: checks.some(
      (point) => point.usableForFit || point.x !== null || point.y !== null || point.z !== null,
    ),
    walks,
    accuracyRows,
    nonSurveyedVerdict: "待測" as const,
  },
  districts: {
    completionCount: completionCount(),
    grayboxIsRealityComplete: false,
    note: "灰盒不是實景完成",
  },
  queue: [
    { id: "queue-slot-1", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
    { id: "queue-slot-2", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
    { id: "queue-slot-3", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
  ],
  wiring: [
    {
      id: "tickRpg",
      status: "未接線",
      detail: "tickRpg 仍用舊累加器，尚未改呼叫 semester 的 stepEncounter / createSimClock",
    },
    {
      id: "department-search",
      status: "未接線",
      detail: "DepartmentPanel 仍用 filterDepartments，尚未改呼叫 growth 的 searchDepartments",
    },
    {
      id: "build-session",
      status: "未接線",
      detail: "建造 build-session 尚未接到 HUD",
    },
    {
      id: "map-list-travel",
      status: "已接線",
      detail: "地圖清單與標記：拖曳超過門檻不快旅，輕點仍快旅",
    },
    {
      id: "quest-reward-ledgers",
      status: "未接線",
      detail: "成長 grantQuestReward 與學期 story.grantQuestReward 是兩套帳，尚未互呼叫",
    },
  ],
  external: {
    fieldSurvey: false,
    publicReleaseThisRound: false,
    blockers: [
      { id: "no-field-survey", status: "無現勘" },
      { id: "iphone-safari", status: "待測" },
      { id: "android-chrome", status: "待測" },
      { id: "public-release", status: "無公開站點這次發布" },
    ],
  },
  passes: {
    gameCandidate: { column: "遊戲候選", pass: false },
    tamsuiReality: { column: "淡水1:1實景", pass: false },
  },
};
