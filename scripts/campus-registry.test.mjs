import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { LANDMARKS } from "../src/game/world-data/landmarks.ts";
import {
  CAMPUS_REGISTRY,
  CHECK_POINTS,
  CONTROL_POINTS,
  COORDINATE_SPEC,
  MAP_ACTIONS,
  PILGRIMAGE_SITE_ALIASES,
  REALITY_COMPARE_LAYERS,
  ROUTE_SPECS,
  ZONE_BOUNDS,
  acceptanceTable,
  classifyMapPointer,
  realToWorld,
  recomputeRoute,
  worldToReal,
} from "../src/game/world-data/registry/index.ts";
import { REGISTRY_BASELINE, registrySnapshot } from "./art/registry-snapshot.mjs";

test("the regenerated registry matches the baseline identity and the committed snapshot", () => {
  const snap = registrySnapshot();
  const diff = snap.diffFromBaseline;
  assert.equal(diff.total.now, REGISTRY_BASELINE.total);
  assert.deepEqual(diff.aliasIds.added, []);
  assert.deepEqual(diff.aliasIds.removed, []);
  assert.equal(diff.saveKey.now, REGISTRY_BASELINE.saveKey);
  assert.deepEqual(diff.kind, []);
  assert.deepEqual(diff.zone, []);
  assert.equal(snap.counts.nonAlias, REGISTRY_BASELINE.nonAlias);
  assert.ok(snap.rows.every((row) => row.accuracy === "estimated" && row.acceptance === "pending-survey"));
  assert.ok(snap.rows.every((row) => row.aliasOf || row.entrance));
  const committed = JSON.parse(readFileSync(new URL("../docs/art/registry.json", import.meta.url), "utf8"));
  assert.deepEqual(committed, snap);
});

test("permanent ids are unique and every campus site is registered", () => {
  const ids = CAMPUS_REGISTRY.map((row) => row.permanentId);
  assert.equal(new Set(ids).size, ids.length);
  for (const site of CAMPUS_SITES) {
    assert.equal(CAMPUS_REGISTRY.filter((row) => row.permanentId === site.id).length, 1);
  }
});

test("pilgrimage sites that share a save id alias instead of cloning it", () => {
  assert.equal(LANDMARKS.length, 10);
  assert.equal(PILGRIMAGE_SITE_ALIASES.length, 3);
  for (const alias of PILGRIMAGE_SITE_ALIASES) {
    assert.equal(alias.aliasOf, alias.siteId);
    assert.equal(alias.pilgrimageId, alias.siteId);
    assert.equal(alias.sharedPermanentId, true);
    assert.equal(CAMPUS_REGISTRY.filter((row) => row.permanentId === alias.siteId).length, 1);
  }
  for (const id of ["palace", "library", "museum"]) {
    assert.ok(PILGRIMAGE_SITE_ALIASES.some((alias) => alias.pilgrimageId === id));
  }
  const palace = PILGRIMAGE_SITE_ALIASES.find((alias) => alias.pilgrimageId === "palace");
  assert.equal(palace.samePlan, false);
});

test("覺軒 keeps both positions", () => {
  const numbered = CAMPUS_REGISTRY.find((row) => row.permanentId === "chuehhsuan");
  const garden = CAMPUS_REGISTRY.find((row) => row.permanentId === "juexuan-garden");
  assert.ok(numbered && garden);
  assert.notEqual(numbered.z, garden.z);
  assert.equal(numbered.relation.otherId, "juexuan-garden");
  assert.equal(garden.relation.otherId, "chuehhsuan");
  assert.equal(garden.aliasOf, null);
});

test("seven zones expose the priority landmarks", () => {
  assert.deepEqual(
    ZONE_BOUNDS.map((zone) => zone.id),
    ["axis-54", "library-55", "stem-56", "teaching-57", "culture-58", "sports-59", "life-60"],
  );
  const priority = {
    palace: "axis-54",
    library: "library-55",
    gym: "sports-59",
    museum: "culture-58",
  };
  for (const [id, zoneId] of Object.entries(priority)) {
    const zone = ZONE_BOUNDS.find((item) => item.id === zoneId);
    assert.ok(zone.priorityIds.includes(id));
    assert.ok(zone.memberIds.includes(id));
    assert.equal(zone.boundsAccuracy, "estimated");
  }
});

test("control points with coordinates are not collinear and checks stay reserved", () => {
  const placed = CONTROL_POINTS.filter((point) => point.x != null && point.z != null);
  assert.ok(placed.length >= 3);
  const [a, b, c] = placed;
  const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  assert.ok(Math.abs(cross) > 1);
  const controlIds = new Set(CONTROL_POINTS.map((point) => point.id));
  for (const point of CHECK_POINTS) {
    assert.equal(controlIds.has(point.id), false);
    assert.equal(point.reservedFor, "H");
    assert.equal(point.x, null);
    assert.equal(point.usableForFit, false);
  }
});

test("nothing without a survey is marked surveyed", () => {
  for (const row of CAMPUS_REGISTRY) {
    if (row.accuracy === "surveyed") assert.ok(row.source && row.fieldChecked);
    assert.notEqual(row.accuracy, "surveyed");
    assert.equal(row.y, null);
  }
  for (const point of [...CONTROL_POINTS, ...CHECK_POINTS]) {
    assert.notEqual(point.accuracy, "surveyed");
  }
  assert.equal(COORDINATE_SPEC.axisBearingAccuracy, "estimated");
  assert.equal(COORDINATE_SPEC.geographicAnchorAccuracy, "estimated");
  assert.equal(COORDINATE_SPEC.metersPerUnit, 1);
});

test("dragging a warp does not move the player", () => {
  assert.deepEqual([...MAP_ACTIONS], ["select", "track", "warp"]);
  assert.equal(classifyMapPointer({ action: "warp", dragging: true }), "ignore-warp");
  assert.equal(classifyMapPointer({ action: "warp-to-site", pointer: "drag" }), "ignore-warp");
  assert.equal(classifyMapPointer({ action: "warp", dragging: false }), "warp");
  assert.equal(classifyMapPointer("select"), "select");
  assert.equal(classifyMapPointer({ action: "track", dragging: true }), "track");
});

test("acceptance rows without a survey stay pending", () => {
  const rows = acceptanceTable();
  assert.equal(rows.length, CAMPUS_REGISTRY.length);
  assert.ok(rows.every((row) => row.verdict === "pending" && row.surveyedValue === null && row.error === null));
  const library = acceptanceTable([
    { permanentId: "library", source: "none", surveyedValue: null, modelValue: 12 },
  ]).find((row) => row.permanentId === "library");
  assert.equal(library.verdict, "pending");
  assert.equal(library.error, null);
  assert.equal(library.modelValue, 12);
});

test("three walk routes stay estimated and can detour", () => {
  assert.deepEqual(
    ROUTE_SPECS.map((route) => route.id),
    ["kenan-to-palace", "kenan-to-library", "kenan-to-gym"],
  );
  for (const route of ROUTE_SPECS) {
    assert.equal(route.status, "幾何尚未依現勘重算");
    assert.equal(route.accuracy, "estimated");
    assert.ok(route.polyline.length >= 2);
    assert.ok(route.turns.length >= 1);
  }
  const blockedVia = recomputeRoute("kenan-to-palace", [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }]);
  assert.equal(blockedVia.recomputed, true);
  assert.ok(!blockedVia.polyline.some((point) => point[0] === 0 && point[1] === 0));
  const detour = recomputeRoute("kenan-to-palace", [{ minX: -6, maxX: -2, minZ: -71, maxZ: -69 }]);
  assert.ok(detour.polyline.length > ROUTE_SPECS[0].polyline.length);
  assert.equal(detour.status, "幾何尚未依現勘重算");
  assert.equal(REALITY_COMPARE_LAYERS.visible[0], "layer.campus");
});

test("coordinate conversion round-trips", () => {
  const back = realToWorld(worldToReal(12, -40));
  assert.ok(Math.abs(back[0] - 12) < 1e-6);
  assert.ok(Math.abs(back[1] + 40) < 1e-6);
});
