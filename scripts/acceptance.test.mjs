/**
 * Integrated acceptance matrix. Reads live exports and the unwired sources.
 * No device run, no public-site fetch, no fps or step-count claims.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { register } from "node:module";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { SAVE_VERSION } from "../src/game/save.ts";
import { createBuildSession } from "../src/game/rpg/build-session.ts";
import { freshGrowthState } from "../src/game/rpg/growth/types.ts";
import { grantQuestReward as grantGrowthQuest } from "../src/game/rpg/growth/progress.ts";
import { createStory, grantQuestReward as grantStoryQuest, STORY_SAVE_KEY, STORY_SAVE_VERSION } from "../src/game/rpg/semester/story.ts";
import { completionCount, GRAYBOXES } from "../src/game/world-data/districts/index.ts";
import {
  CAMPUS_REGISTRY,
  CHECK_POINTS,
  CONTROL_POINTS,
  acceptanceTable,
} from "../src/game/world-data/registry/index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const CHECK_IDS = ["chk-main-gate", "chk-palace-corner", "chk-museum-bow", "chk-kenan-landing"];

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

await register(
  pathToFileURL(fileURLToPath(new URL("../src/game/rpg/acceptance/node-resolve.mjs", import.meta.url))).href,
  import.meta.url,
);
const { ACCEPTANCE_MATRIX: matrix } = await import("../src/game/rpg/acceptance/index.ts");
const { RPG_SAVE_KEY } = await import("../src/game/rpg/store.ts");

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function sliceFn(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(end > start, nextName);
  return source.slice(start, end);
}

function filesUnder(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "acceptance") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...filesUnder(path));
    else out.push(path);
  }
  return out;
}

function walkFlags(value, hit) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "pass" || key === "passed" || key === "通過") hit.push([key, child]);
    walkFlags(child, hit);
  }
}

test("save version and keys are the live exports", () => {
  assert.equal(SAVE_VERSION, 2);
  assert.equal(RPG_SAVE_KEY, "tamkang-rpg-v2");
  assert.equal(STORY_SAVE_KEY, "tamkang-rpg-v2");
  assert.equal(STORY_SAVE_VERSION, 2);
  assert.equal(matrix.save.version, SAVE_VERSION);
  assert.equal(matrix.save.rpgSaveKey, RPG_SAVE_KEY);
  assert.equal(matrix.save.storySaveKey, STORY_SAVE_KEY);
  assert.equal(matrix.save.storySaveVersion, STORY_SAVE_VERSION);
  assert.equal(matrix.save.sameKey, true);
  assert.equal(matrix.save.sameVersion, true);
  assert.equal(matrix.save.versionSource, "src/game/save.ts#SAVE_VERSION");
  assert.equal(matrix.save.rpgSaveKeySource, "src/game/rpg/store.ts#RPG_SAVE_KEY");
});

test("AdventureApp has no login gate in source", () => {
  const source = read("src/game/rpg/AdventureApp.tsx");
  assert.equal(/\blogin\b|登入|signIn|SignIn|useCurrentUser|better-auth|requireAuth|auth\/gates|\bauth\b/i.test(source), false);
  assert.match(source, /export default function AdventureApp/);
  assert.match(source, /<AdventureHud \/>/);
  assert.equal(matrix.login.loginFree, true);
  assert.equal(matrix.login.basis, "source");
  assert.equal(matrix.login.file, "src/game/rpg/AdventureApp.tsx");
  assert.equal(matrix.login.publicSiteMeasured, false);
});

test("reserved check points stay null and are not fitted", () => {
  assert.deepEqual(CHECK_POINTS.map((point) => point.id), CHECK_IDS);
  assert.deepEqual(matrix.survey.checks.map((point) => point.id), CHECK_IDS);
  for (const id of CHECK_IDS) {
    const live = CHECK_POINTS.find((point) => point.id === id);
    const row = matrix.survey.checks.find((point) => point.id === id);
    assert.ok(live && row);
    assert.equal(live.x, null);
    assert.equal(live.y, null);
    assert.equal(live.z, null);
    assert.equal(live.usableForFit, false);
    assert.equal(live.reservedFor, "H");
    assert.notEqual(live.accuracy, "surveyed");
    assert.equal(row.x, null);
    assert.equal(row.y, null);
    assert.equal(row.z, null);
    assert.equal(row.usableForFit, false);
    assert.equal(row.verdict, "待測");
    assert.equal(row.accuracy, live.accuracy);
  }
  assert.equal(matrix.survey.usedForFit, false);
  const hits = [];
  for (const path of filesUnder(join(root, "src"))) {
    const text = readFileSync(path, "utf8");
    if (CHECK_IDS.some((id) => text.includes(id))) hits.push(relative(root, path).replaceAll("\\", "/"));
  }
  assert.deepEqual(hits, ["src/game/world-data/registry/index.ts"]);
  for (const walk of matrix.survey.walks) {
    assert.equal(walk.controlPointsUsedForFit, false);
    assert.equal(walk.stepCount, null);
    assert.equal(walk.surveyedStepCount, null);
  }
});

test("rows that are not surveyed stay pending", () => {
  assert.equal(matrix.survey.nonSurveyedVerdict, "待測");
  assert.ok(matrix.survey.accuracyRows.length > CHECK_IDS.length);
  for (const row of matrix.survey.accuracyRows) {
    assert.notEqual(row.verdict, "pass");
    assert.notEqual(row.verdict, "通過");
    if (row.accuracy !== "surveyed") assert.equal(row.verdict, "待測");
  }
  for (const row of CAMPUS_REGISTRY) assert.notEqual(row.accuracy, "surveyed");
  for (const point of [...CONTROL_POINTS, ...CHECK_POINTS]) assert.notEqual(point.accuracy, "surveyed");
  const table = acceptanceTable();
  assert.equal(table.length, CAMPUS_REGISTRY.length);
  for (const row of table) {
    assert.equal(row.verdict, "pending");
    assert.equal(row.surveyedValue, null);
  }
  const mirrored = matrix.survey.accuracyRows.filter((row) => row.kind === "acceptance");
  assert.equal(mirrored.length, table.length);
  assert.ok(mirrored.every((row) => row.verdict === "待測" && row.surveyedValue === null));
});

test("district grayboxes are not a finished reality count", () => {
  assert.equal(completionCount(), 0);
  assert.equal(matrix.districts.completionCount, 0);
  assert.equal(matrix.districts.grayboxIsRealityComplete, false);
  assert.ok(GRAYBOXES.length > 0);
  for (const box of GRAYBOXES) {
    assert.equal(box.status, "graybox");
    assert.equal(box.sourceDate, null);
  }
});

test("three queue slots keep the baseline and do not add gameplay", () => {
  assert.deepEqual(matrix.queue, [
    { id: "queue-slot-1", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
    { id: "queue-slot-2", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
    { id: "queue-slot-3", status: "原文待核對", behavior: "keep-baseline", sourceText: null },
  ]);
  const hits = [];
  for (const path of filesUnder(join(root, "src"))) {
    if (readFileSync(path, "utf8").includes("queue-slot-1")) hits.push(relative(root, path));
  }
  assert.deepEqual(hits, []);
});

test("tickRpg still uses the old accumulator", () => {
  const source = read("src/game/rpg/store.ts");
  const start = source.indexOf("export function tickRpg");
  const end = source.indexOf("function snapshot()", start);
  const body = source.slice(start, end);
  assert.match(source, /let accum = 0/);
  assert.match(body, /accum \+= Math\.min\(delta, 0\.08\)/);
  assert.equal(body.includes("stepEncounter"), false);
  assert.equal(body.includes("createSimClock"), false);
  assert.equal(source.includes("semester/encounter"), false);
  assert.equal(source.includes("semester/index"), false);
  const row = matrix.wiring.find((item) => item.id === "tickRpg");
  assert.equal(row.status, "未接線");
});

test("DepartmentPanel still filters with the old search", () => {
  const source = read("src/game/rpg/AdventureHud.tsx");
  const panel = sliceFn(source, "DepartmentPanel", "InventoryPanel");
  assert.match(panel, /filterDepartments\(DEPARTMENTS, search, college\)/);
  assert.equal(source.includes("searchDepartments"), false);
  assert.equal(source.includes("growth/search"), false);
  const row = matrix.wiring.find((item) => item.id === "department-search");
  assert.equal(row.status, "未接線");
});

test("build session is not mounted on the HUD", () => {
  assert.equal(typeof createBuildSession, "function");
  for (const path of [
    "src/game/rpg/AdventureHud.tsx",
    "src/game/rpg/AdventureWorld.tsx",
    "src/game/rpg/AdventureApp.tsx",
  ]) {
    const source = read(path);
    assert.equal(source.includes("build-session"), false, path);
    assert.equal(source.includes("createBuildSession"), false, path);
  }
  const hud = read("src/game/rpg/AdventureHud.tsx");
  assert.match(sliceFn(hud, "BuildPanel", "JournalPanel"), /buildCards\(/);
  const row = matrix.wiring.find((item) => item.id === "build-session");
  assert.equal(row.status, "未接線");
});

test("map list taps still fast-travel and drags do not", () => {
  const source = read("src/game/rpg/AdventureHud.tsx");
  const panel = sliceFn(source, "MapPanel", "SettingsPanel");
  assert.match(panel, /mapDragDecision\(\{ intent: "go", distance \}\)\.fastTravel/);
  assert.match(panel, /useRpg\.getState\(\)\.travel\(s\.id\)/);
  const row = matrix.wiring.find((item) => item.id === "map-list-travel");
  assert.equal(row.status, "已接線");
});

test("growth and semester quest rewards are separate ledgers", () => {
  const growthSource = read("src/game/rpg/growth/progress.ts");
  const storySource = read("src/game/rpg/semester/story.ts");
  assert.equal(growthSource.includes("semester/"), false);
  assert.equal(storySource.includes("growth/"), false);
  assert.notEqual(grantGrowthQuest, grantStoryQuest);
  const story = createStory();
  const growth = freshGrowthState();
  assert.equal(grantStoryQuest("side-explore", story), true);
  assert.equal(growth.xp, 0);
  assert.deepEqual(growth.claimedQuests, []);
  assert.equal(Object.hasOwn(story, "xpEvents"), false);
  assert.ok(story.granted["side-explore"] > 0);
  const paid = grantGrowthQuest(growth, "side-explore", { xp: 30, notes: 1, credit: 1 });
  assert.notEqual(paid, growth);
  assert.equal(growth.xp, 0);
  assert.equal(paid.claimedQuests.includes("side-explore"), true);
  assert.equal(Object.hasOwn(paid, "granted"), false);
  assert.equal(story.xp > 0, true);
  const row = matrix.wiring.find((item) => item.id === "quest-reward-ledgers");
  assert.equal(row.status, "未接線");
  assert.equal(
    matrix.wiring.filter((item) => item.id !== "map-list-travel").every((item) => item.status === "未接線"),
    true,
  );
  assert.equal(matrix.wiring.find((item) => item.id === "map-list-travel").status, "已接線");
  assert.deepEqual(
    matrix.wiring.map((item) => item.id),
    ["tickRpg", "department-search", "build-session", "map-list-travel", "quest-reward-ledgers"],
  );
});

test("candidate and reality columns are not passes", () => {
  assert.equal(matrix.external.fieldSurvey, false);
  assert.equal(matrix.external.publicReleaseThisRound, false);
  assert.deepEqual(
    matrix.external.blockers.map((row) => [row.id, row.status]),
    [
      ["no-field-survey", "無現勘"],
      ["iphone-safari", "待測"],
      ["android-chrome", "待測"],
      ["public-release", "無公開站點這次發布"],
    ],
  );
  assert.equal(matrix.passes.gameCandidate.column, "遊戲候選");
  assert.equal(matrix.passes.tamsuiReality.column, "淡水1:1實景");
  assert.equal(matrix.passes.gameCandidate.pass, false);
  assert.equal(matrix.passes.tamsuiReality.pass, false);
  const flags = [];
  walkFlags(matrix, flags);
  assert.deepEqual(flags, [
    ["pass", false],
    ["pass", false],
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(matrix)), matrix);
});
