import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMPUS_REGISTRY,
  ZONE_BOUNDS,
} from "../src/game/world-data/registry/index.ts";
import {
  COMPLETION_ITEMS,
  DISTRICT_PACKS,
  FIXTURE_GAPS,
  GRAYBOXES,
  ROOM_GAPS,
  completionCount,
  entranceNote,
  walkScript,
} from "../src/game/world-data/districts/index.ts";

const PRIORITY = {
  palace: "axis-54",
  library: "library-55",
  gym: "sports-59",
  museum: "culture-58",
};

function assertNoSurveyed(value, path) {
  if (value === "surveyed") assert.fail(`surveyed at ${path}`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSurveyed(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoSurveyed(item, `${path}.${key}`);
  }
}

test("seven district packs match the frozen zones", () => {
  assert.deepEqual(
    DISTRICT_PACKS.map((pack) => pack.zoneId),
    ["axis-54", "library-55", "stem-56", "teaching-57", "culture-58", "sports-59", "life-60"],
  );
  assert.deepEqual(
    DISTRICT_PACKS.map((pack) => pack.zoneId),
    ZONE_BOUNDS.map((zone) => zone.id),
  );
  const registryIds = new Set(CAMPUS_REGISTRY.map((row) => row.permanentId));
  for (const pack of DISTRICT_PACKS) {
    assert.equal(pack.evidenceStatus, "pending-survey");
    assert.equal(pack.boundsAccuracy, "estimated");
    assert.ok(pack.memberIds.length > 0);
    const zone = ZONE_BOUNDS.find((item) => item.id === pack.zoneId);
    assert.deepEqual(pack.memberIds, zone.memberIds);
    for (const permanentId of pack.memberIds) assert.ok(registryIds.has(permanentId));
    for (const member of pack.members) assert.ok(registryIds.has(member.permanentId));
  }
});

test("priority landmarks keep one save id inside their zones", () => {
  assert.deepEqual(
    GRAYBOXES.map((box) => box.permanentId),
    ["palace", "library", "gym", "museum"],
  );
  for (const [permanentId, zoneId] of Object.entries(PRIORITY)) {
    assert.equal(CAMPUS_REGISTRY.filter((row) => row.permanentId === permanentId).length, 1);
    const pack = DISTRICT_PACKS.find((item) => item.zoneId === zoneId);
    assert.ok(pack.memberIds.includes(permanentId));
    assert.ok(pack.priorityIds.includes(permanentId));
    assert.equal(GRAYBOXES.filter((box) => box.permanentId === permanentId).length, 1);
  }
  const axis = DISTRICT_PACKS.find((pack) => pack.zoneId === "axis-54");
  assert.ok(axis.memberIds.includes("chuehhsuan"));
  assert.ok(axis.memberIds.includes("juexuan-garden"));
  assert.ok(axis.memberIds.includes("palace"));
});

test("grayboxes copy registry footprints and stay unverified", () => {
  for (const box of GRAYBOXES) {
    const row = CAMPUS_REGISTRY.find((item) => item.permanentId === box.permanentId);
    assert.equal(box.status, "graybox");
    assert.equal(box.sourceDate, null);
    assert.equal(box.footprint.source, "registry");
    assert.equal(box.footprint.accuracy, "estimated");
    assert.equal(box.footprint.x, row.x);
    assert.equal(box.footprint.z, row.z);
    assert.equal(box.footprint.w, row.footprint.w);
    assert.equal(box.footprint.d, row.footprint.d);
    assert.equal(box.footprint.y, null);
    assert.equal(box.entrance.status, "pending-survey");
    assert.equal(box.entrance.clearWidthM, null);
    assert.equal(box.entrance.sourceDate, null);
    assert.equal(box.collisionMatchesMesh, false);
    assert.ok(box.collisionMatchesMeshReason.length > 10);
    assert.equal(box.asset.textureIsSurveyPhoto, false);
    assert.equal(box.asset.colliderSource === box.asset.meshSource, false);
    assert.equal(box.roomsAccessible, false);
    assert.equal(box.shellWalkable, true);
    assert.equal(box.saveId, box.permanentId);
    assert.deepEqual(
      box.floors.map((floor) => floor.label),
      row.floors.map((floor) => floor.label),
    );
    assert.ok(box.floors.every((floor) => floor.status === "pending-survey" && floor.use == null && floor.sourceDate == null));
  }
  const gym = GRAYBOXES.find((box) => box.permanentId === "gym");
  assert.deepEqual(
    gym.floors.map((floor) => floor.label),
    ["1F", "2F", "3F"],
  );
  assert.equal(gym.floors.some((floor) => floor.label === "7F"), false);
});

test("nothing in the district pack is surveyed", () => {
  assertNoSurveyed(DISTRICT_PACKS, "packs");
  assertNoSurveyed(GRAYBOXES, "grayboxes");
  assertNoSurveyed(FIXTURE_GAPS, "fixtures");
  assertNoSurveyed(ROOM_GAPS, "rooms");
  assertNoSurveyed(COMPLETION_ITEMS, "completion");
  for (const box of GRAYBOXES) assertNoSurveyed(walkScript(box.permanentId), box.permanentId);
});

test("completion count ignores pending and graybox items", () => {
  assert.ok(COMPLETION_ITEMS.some((item) => item.status === "pending-survey"));
  assert.ok(COMPLETION_ITEMS.some((item) => item.status === "graybox"));
  assert.equal(COMPLETION_ITEMS.some((item) => item.status === "accepted"), false);
  assert.equal(completionCount(), 0);
  assert.equal(
    completionCount([
      { status: "pending-survey", sourceDate: "2026-01-01" },
      { status: "graybox", sourceDate: "2026-01-01" },
      { status: "accepted", sourceDate: null },
      { status: "accepted", sourceDate: "  " },
      { status: "accepted", sourceDate: "2026-01-02" },
    ]),
    1,
  );
});

test("O and Q entrance notes are not copies", () => {
  const o = entranceNote("business-o");
  const q = entranceNote("business-q");
  const pack = DISTRICT_PACKS.find((item) => item.zoneId === "teaching-57");
  assert.equal(pack.entrances.find((entry) => entry.permanentId === "business-o").note, o);
  assert.equal(pack.entrances.find((entry) => entry.permanentId === "business-q").note, q);
  assert.notEqual(o, q);
  assert.equal(o.includes("business-q"), false);
  assert.equal(q.includes("business-o"), false);
  const normalized = (note) => note.replaceAll("business-o", "ID").replaceAll("business-q", "ID").replaceAll("O", "X").replaceAll("Q", "X").replaceAll(/\d+/g, "#");
  assert.notEqual(normalized(o), normalized(q));
});

test("graybox walks do not report surveyed step counts", () => {
  for (const box of GRAYBOXES) {
    const script = walkScript(box.permanentId);
    assert.equal(script.reportsSurveyedStepCount, false);
    assert.equal(script.stepCount, null);
    assert.equal(script.surveyedStepCount, null);
    assert.equal(script.controlPointsUsedForFit, false);
    assert.deepEqual(
      script.phases.map((phase) => phase.phase),
      ["步行抵達", "進入", "切樓層", "離開", "重載"],
    );
    assert.equal(script.phases[0].result, "estimated-walk");
    assert.equal(script.phases[1].result, "graybox-shell");
    assert.equal(script.phases[2].result, "blocked-pending");
    assert.equal(script.phases[4].result, "same-permanent-id");
    assert.equal(script.routeAccuracy === "surveyed", false);
    const encoded = JSON.stringify(script);
    assert.equal(encoded.includes('"surveyed"'), false);
    assert.equal(encoded.includes('"stepCount":132'), false);
    assert.equal(encoded.includes('"surveyedStepCount":132'), false);
  }
  assert.equal(walkScript("palace").routeId, "kenan-to-palace");
  assert.equal(walkScript("library").routeId, "kenan-to-library");
  assert.equal(walkScript("gym").routeId, "kenan-to-gym");
  assert.equal(walkScript("museum").routeId, null);
});

test("every zone records fixture and room gaps that are not complete", () => {
  for (const zone of ZONE_BOUNDS) {
    assert.ok(FIXTURE_GAPS.some((gap) => gap.zoneId === zone.id));
    assert.ok(ROOM_GAPS.some((gap) => gap.zoneId === zone.id));
  }
  for (const gap of [...FIXTURE_GAPS, ...ROOM_GAPS]) {
    assert.equal(gap.status, "pending-survey");
    assert.equal(gap.sourceDate, null);
    assert.ok(gap.missing.photo.length > 0);
    assert.ok(gap.missing.drawing.length > 0);
    assert.ok(gap.missing.measurement.length > 0);
  }
  const youlian = ROOM_GAPS.find((gap) => gap.name === "有蓮國際會議廳");
  assert.equal(youlian.parentId, null);
  assert.equal(youlian.zoneId, "culture-58");
  assert.equal(ROOM_GAPS.some((gap) => gap.status === "accepted"), false);
  assert.ok(FIXTURE_GAPS.some((gap) => gap.id === "fixture:lanping-pavilion" && gap.parentId === null));
  const lifeRooms = ROOM_GAPS.filter((gap) => gap.zoneId === "life-60");
  assert.ok(lifeRooms.every((gap) => gap.interiorApproved === false));
});
