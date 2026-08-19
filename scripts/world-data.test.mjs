/**
 * Reality-data invariants.
 *
 * These run headlessly against src/game/world-data (Node strips the TypeScript
 * types), so the geometry contract is checked without a browser: the slope
 * really has 132 equal steps, the main route is really walkable end to end, and
 * no landmark can claim more accuracy than its references support.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { AXIS, MAIN_ROUTE, PLAZA_ELEVATION, corridorHalfWidth } from "../src/game/world-data/axis.ts";
import { COLLIDERS, landmarkAt, resolveCollision } from "../src/game/world-data/colliders.ts";
import {
  sampleGroundElevation,
  sampleTerrainElevation,
  spineGroundElevation,
} from "../src/game/world-data/elevation.ts";
import {
  KENAN,
  KENAN_LANDING_ELEVATION,
  KENAN_LANDING_Z,
  KENAN_STEPS,
  KENAN_TOP_Z,
  KENAN_TOTAL_RISE,
  kenanSection,
} from "../src/game/world-data/kenan.ts";
import { LANDMARKS, LANDMARK_BY_ID, SPAWN } from "../src/game/world-data/landmarks.ts";
import { ACCURACY_VALUES, realToWorld, worldToReal, WORLD_BOUNDS } from "../src/game/world-data/origin.ts";
import { REFERENCE_BY_ID, accuracyCeiling, accuracyRank } from "../src/game/world-data/references.ts";
import { BENCHMARK_CAMERAS, deviationRows } from "../src/game/world-data/benchmarks.ts";
import { CURATED_PLANTS, scatterPlants } from "../src/game/world-data/vegetation.ts";
import { PROPS, propsOfKind } from "../src/game/world-data/props.ts";
import { ZONE_BY_ID } from "../src/game/world-data/zones/index.ts";
import { TIME_PRESETS, TIME_OF_DAY_VALUES, coerceTimeOfDay } from "../src/game/world-data/lighting.ts";

const NEAR = 1e-9;

test("Ke-nan slope has 132 uniform steps in two flights", () => {
  assert.equal(KENAN_STEPS.length, 132);
  assert.equal(KENAN.stepCount, 132);
  assert.equal(
    KENAN.flightSteps.reduce((a, b) => a + b, 0),
    132,
  );
  assert.equal(KENAN_STEPS.filter((s) => s.flight === 0).length, KENAN.flightSteps[0]);
  assert.equal(KENAN_STEPS.filter((s) => s.flight === 1).length, KENAN.flightSteps[1]);

  for (let i = 0; i < KENAN_STEPS.length; i++) {
    const s = KENAN_STEPS[i];
    assert.equal(s.index, i + 1);
    // Every tread is exactly one riser above the one below it.
    assert.ok(Math.abs(s.treadTop - (i + 1) * KENAN.riser) < 1e-9, `step ${s.index} elevation`);
    assert.ok(Math.abs(s.nosingZ - s.backZ - KENAN.tread) < 1e-9, `step ${s.index} tread depth`);
    // Steps climb towards north.
    assert.ok(s.backZ < s.nosingZ);
  }
  assert.ok(Math.abs(KENAN_TOTAL_RISE - 132 * KENAN.riser) < NEAR);
  assert.ok(Math.abs(KENAN_STEPS[131].treadTop - KENAN_TOTAL_RISE) < 1e-9);
});

test("mid landing is level and sits between the two flights", () => {
  assert.ok(KENAN_LANDING_Z[0] > KENAN_LANDING_Z[1]);
  assert.ok(Math.abs(KENAN_LANDING_Z[0] - KENAN_LANDING_Z[1] - KENAN.landingDepth) < 1e-9);
  const mid = (KENAN_LANDING_Z[0] + KENAN_LANDING_Z[1]) / 2;
  assert.equal(kenanSection(mid), "landing");
  for (let z = KENAN_LANDING_Z[1] + 0.1; z < KENAN_LANDING_Z[0]; z += 0.25) {
    assert.ok(Math.abs(sampleGroundElevation(0, z) - KENAN_LANDING_ELEVATION) < 1e-9);
  }
});

test("slope profile never jumps more than one riser", () => {
  let maxJump = 0;
  let prev = null;
  for (let z = AXIS.gateZ + 20; z >= AXIS.northLimitZ; z -= 0.2) {
    const y = spineGroundElevation(z);
    if (prev !== null) maxJump = Math.max(maxJump, Math.abs(y - prev));
    prev = y;
  }
  // A single tread is the largest legitimate discontinuity anywhere on the axis.
  assert.ok(maxJump <= KENAN.riser + 1e-9, `max centreline jump ${maxJump}`);
});

test("terrain mesh surface stays under the tread geometry on the slope", () => {
  for (let z = KENAN_TOP_Z + 0.5; z < KENAN.bottomZ; z += 0.37) {
    for (const x of [-3, 0, 3]) {
      const ground = sampleGroundElevation(x, z);
      const mesh = sampleTerrainElevation(x, z);
      assert.ok(mesh <= ground + 1e-9, `mesh above tread at ${x},${z}`);
      // ...but not so far under that it opens a visible gap.
      assert.ok(ground - mesh < KENAN.riser + 0.12, `mesh too deep at ${x},${z}`);
    }
  }
});

test("main pilgrimage route is walkable end to end", () => {
  let length = 0;
  let blocked = 0;
  let samples = 0;
  let maxStep = 0;
  let prevY = null;
  for (let i = 1; i < MAIN_ROUTE.length; i++) {
    const [ax, az] = MAIN_ROUTE[i - 1];
    const [bx, bz] = MAIN_ROUTE[i];
    const d = Math.hypot(bx - ax, bz - az);
    length += d;
    const n = Math.ceil(d / 0.2);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      samples += 1;
      const r = resolveCollision(x, z, 0.45);
      if (Math.hypot(r.x - x, r.z - z) > 0.01) blocked += 1;
      const y = sampleGroundElevation(x, z);
      if (prevY !== null) maxStep = Math.max(maxStep, Math.abs(y - prevY));
      prevY = y;
    }
  }
  assert.equal(blocked, 0, "route must not intersect any collider");
  // Player movement rejects a step of 0.7 m or more, so the route must stay well under.
  assert.ok(maxStep < 0.35, `max step along route ${maxStep}`);
  assert.ok(length > 330 && length < 470, `route length ${length} m`);
  assert.ok(samples > 1000);
});

test("route touches every corridor landmark's stamp radius", () => {
  const seen = new Set();
  for (let i = 1; i < MAIN_ROUTE.length; i++) {
    const [ax, az] = MAIN_ROUTE[i - 1];
    const [bx, bz] = MAIN_ROUTE[i];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const hit = landmarkAt(ax + (bx - ax) * t, az + (bz - az) * t);
      if (hit) seen.add(hit.id);
    }
  }
  for (const id of ["kenan", "statue", "lantern", "dolphin", "scroll", "library"]) {
    assert.ok(seen.has(id), `route should pass through ${id}`);
  }
});

test("player spawns on the ground at the slope foot", () => {
  const ground = sampleGroundElevation(SPAWN.x, SPAWN.z);
  assert.ok(Math.abs(SPAWN.y - ground) < 0.25, `spawn ${SPAWN.y} vs ground ${ground}`);
  assert.equal(kenanSection(SPAWN.z), "bottom-apron");
  const pushed = resolveCollision(SPAWN.x, SPAWN.z, 0.45);
  assert.ok(Math.hypot(pushed.x - SPAWN.x, pushed.z - SPAWN.z) < 0.01, "spawn inside a collider");
});

test("landmarks are well-formed and do not over-claim accuracy", () => {
  const ids = new Set();
  for (const l of LANDMARKS) {
    assert.ok(!ids.has(l.id), `duplicate landmark id ${l.id}`);
    ids.add(l.id);
    assert.ok(ACCURACY_VALUES.includes(l.accuracy), `${l.id} accuracy`);
    assert.ok(l.referenceIds.length > 0, `${l.id} has no references`);
    for (const ref of l.referenceIds) {
      assert.ok(REFERENCE_BY_ID[ref], `${l.id} cites unknown reference ${ref}`);
    }
    // Nothing may claim better accuracy than its best reference allows.
    assert.ok(
      accuracyRank(l.accuracy) <= accuracyRank(accuracyCeiling(l.referenceIds)),
      `${l.id} claims ${l.accuracy} but references only support ${accuracyCeiling(l.referenceIds)}`,
    );
    assert.ok(ZONE_BY_ID[l.zone], `${l.id} in unknown zone ${l.zone}`);
    assert.ok(l.interact.radius > 0);
    assert.ok(l.interact.x >= WORLD_BOUNDS.minX && l.interact.x <= WORLD_BOUNDS.maxX);
    assert.ok(l.interact.z >= WORLD_BOUNDS.minZ && l.interact.z <= WORLD_BOUNDS.maxZ);
    // Stamp points must be reachable, not buried in a building.
    const pushed = resolveCollision(l.interact.x, l.interact.z, 0.45);
    assert.ok(
      Math.hypot(pushed.x - l.interact.x, pushed.z - l.interact.z) < 0.01,
      `${l.id} stamp point is inside a collider`,
    );
  }
});

test("stamp radii do not swallow another landmark's stamp point", () => {
  for (const a of LANDMARKS) {
    for (const b of LANDMARKS) {
      if (a.id === b.id) continue;
      const d = Math.hypot(a.interact.x - b.interact.x, a.interact.z - b.interact.z);
      assert.ok(d > a.interact.radius, `${b.id} stamp point sits inside ${a.id}`);
    }
  }
});

test("real-scale spacing matches the published axis figures", () => {
  // 宮燈大道 is documented as about 200 m.
  assert.ok(Math.abs(Math.abs(AXIS.avenueNorthZ - AXIS.avenueSouthZ) - 200) < NEAR);
  // The slope climbs 132 steps and nothing else does.
  assert.ok(Math.abs(PLAZA_ELEVATION - KENAN_TOTAL_RISE) < 0.3);
  // The corridor is on the order of 400 m from the slope foot to the library.
  const corridor = AXIS.gateZ - AXIS.libraryFrontZ;
  assert.ok(corridor > 350 && corridor < 430, `corridor ${corridor} m`);
});

test("every required benchmark camera exists and looks at solid ground", () => {
  const required = [
    "KENAN_01",
    "KENAN_02",
    "CHINGSHENG_01",
    "PALACE_01",
    "LANTERN_01",
    "LANTERN_SUNSET",
    "DOLPHIN_01",
    "SCROLL_01",
    "LIBRARY_01",
  ];
  const byId = new Map(BENCHMARK_CAMERAS.map((b) => [b.id, b]));
  for (const id of required) assert.ok(byId.has(id), `missing benchmark ${id}`);
  for (const b of BENCHMARK_CAMERAS) {
    assert.ok(LANDMARK_BY_ID[b.landmarkId], `${b.id} targets unknown landmark`);
    assert.ok(TIME_OF_DAY_VALUES.includes(b.time), `${b.id} time`);
    assert.ok(b.fov > 30 && b.fov < 90);
    assert.ok(b.checks.length > 0, `${b.id} has no checks to judge`);
    for (const ref of b.referenceIds) assert.ok(REFERENCE_BY_ID[ref], `${b.id} bad ref ${ref}`);
    // Eye height must be above the ground it stands on, and roughly human.
    const ground = sampleGroundElevation(b.position[0], b.position[2]);
    const eye = b.position[1] - ground;
    assert.ok(eye > 0.9 && eye < 3.2, `${b.id} eye height ${eye} m above ground`);
  }
});

test("built geometry matches the dimensions the landmarks claim", () => {
  for (const l of LANDMARKS) {
    for (const row of deviationRows(l.id)) {
      assert.ok(Number.isFinite(row.game), `${l.id} / ${row.label} not measurable`);
      // Deviation here means "the generated world drifted from its own spec",
      // which should always be zero; reference error is tracked by `accuracy`.
      assert.ok(
        Math.abs(row.deviation) < 0.06,
        `${l.id} ${row.label}: real ${row.real}, built ${row.game}`,
      );
    }
  }
});

test("curated planting stays out of buildings and off the paving", () => {
  for (const p of CURATED_PLANTS) {
    const inside = COLLIDERS.some(
      (b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ,
    );
    assert.ok(!inside, `${p.species} at ${p.x},${p.z} is inside a building`);
    // Nothing may be planted in the middle of the walking route.
    const onAvenue = p.z < AXIS.avenueSouthZ && p.z > AXIS.avenueNorthZ;
    if (onAvenue && p.species !== "moss") {
      assert.ok(Math.abs(p.x) > 2.6, `${p.species} at ${p.x},${p.z} blocks the avenue paving`);
    }
  }
});

test("backdrop scatter never reaches into a calibrated corridor", () => {
  for (const p of scatterPlants(1)) {
    assert.ok(
      Math.abs(p.x) > corridorHalfWidth(p.z) + 20,
      `scattered ${p.species} at ${p.x},${p.z} intrudes on the corridor`,
    );
  }
});

test("props are placed in known zones and the lanterns line the avenue", () => {
  for (const p of PROPS) {
    assert.ok(ZONE_BY_ID[p.zone], `prop ${p.kind} in unknown zone ${p.zone}`);
  }
  const lanterns = propsOfKind("lantern-post");
  // Both sides of a 200 m avenue at 12 m spacing.
  assert.ok(lanterns.length >= 30, `only ${lanterns.length} lantern posts`);
  for (const l of lanterns) {
    assert.ok(l.z <= AXIS.avenueSouthZ && l.z >= AXIS.avenueNorthZ - 6, "lantern off the avenue");
    assert.ok(Math.abs(l.x) > 3, "lantern standing in the walk");
  }
  for (const kind of ["drain-grate", "bench", "street-lamp", "sign-post", "tactile-strip", "ramp"]) {
    assert.ok(propsOfKind(kind).length > 0, `no ${kind} placed`);
  }
});

test("lighting presets are complete and plausibly exposed", () => {
  for (const id of TIME_OF_DAY_VALUES) {
    const p = TIME_PRESETS[id];
    assert.ok(p, `missing preset ${id}`);
    assert.ok(p.fogFar > p.fogNear);
    // Fog must not eat the 400 m corridor.
    assert.ok(p.fogFar >= 300, `${id} fogFar ${p.fogFar} is too near for a 400 m corridor`);
    assert.ok(p.exposure > 0.8 && p.exposure < 1.3, `${id} exposure ${p.exposure}`);
    assert.ok(p.wetness >= 0 && p.wetness <= 1);
  }
  // Sunset light must come from the west, across the Tamsui River.
  assert.ok(TIME_PRESETS.sunset.sunPos[0] < -100);
  assert.ok(coerceTimeOfDay("day") === "day");
  assert.ok(coerceTimeOfDay("sunset") === "sunset");
  assert.ok(coerceTimeOfDay("night") === "night");
  assert.equal(coerceTimeOfDay("noon"), null);
});

test("real-world coordinate conversion round-trips", () => {
  for (const [x, z] of [
    [0, 0],
    [120, -260],
    [-80, 60],
  ]) {
    const back = realToWorld(worldToReal(x, z));
    assert.ok(Math.abs(back[0] - x) < 0.05 && Math.abs(back[1] - z) < 0.05, `${x},${z}`);
  }
  // The geographic anchor is the world origin by definition.
  const anchor = realToWorld({ lat: 25.1747, lng: 121.449 });
  assert.ok(Math.abs(anchor[0]) < 0.01 && Math.abs(anchor[1]) < 0.01);
});
