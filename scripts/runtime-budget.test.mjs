/**
 * Synthetic frame samples only. No on-device frame time is recorded here.
 * [10, 20, 30, 40, 100] is a fixture: median 30, nearest-rank p95 100.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  FAILURE_KINDS,
  LOAD_STALL,
  MEASUREMENT_SPEC,
  PENDING_DEVICE,
  PROGRESS_SPEC,
  QUALITY_SWITCH,
  QUALITY_TIERS,
  ROUTE_SEGMENTS,
  createRecovery,
  frameStats,
  recordSample,
  sameCondition,
} from "../src/game/rpg/runtime/index.ts";

const SYNTHETIC_FRAMES = [10, 20, 30, 40, 100];

test("frameStats uses the synthetic sample median and nearest-rank p95", () => {
  const input = [...SYNTHETIC_FRAMES];
  const stats = frameStats(input);
  assert.deepEqual(input, SYNTHETIC_FRAMES);
  assert.deepEqual(stats, { count: 5, median: 30, p95: 100 });
  assert.deepEqual(frameStats([40, 10, 30, 20]), { count: 4, median: 25, p95: 40 });
  assert.deepEqual(frameStats([12]), { count: 1, median: 12, p95: 12 });
  console.log(
    "synthetic-frame-sample [10,20,30,40,100] median=30 p95=100 nearest-rank; not a device measurement",
  );
});

test("frameStats rejects an empty or non-finite list instead of reporting 0", () => {
  assert.throws(() => frameStats([]), /refusing to report 0/);
  assert.throws(() => frameStats([10, Number.NaN]), /finite/);
  assert.throws(() => frameStats([-1]), /finite/);
});

test("five route segments stay pending-device when the device did not report fps", () => {
  const log = [];
  for (const segment of ROUTE_SEGMENTS) {
    recordSample(log, segment, {});
  }
  assert.deepEqual(ROUTE_SEGMENTS, ["title", "outdoor", "combat", "indoor", "outdoor-return"]);
  assert.equal(log.length, 5);
  for (const row of log) {
    assert.equal(row.fps, PENDING_DEVICE);
    assert.equal(row.frameMs, PENDING_DEVICE);
    assert.equal(row.drawCalls, PENDING_DEVICE);
    assert.equal(row.triangles, PENDING_DEVICE);
    assert.equal(row.bytes, PENDING_DEVICE);
    assert.equal(row.timeToOperableMs, PENDING_DEVICE);
    assert.equal(row.device, PENDING_DEVICE);
    assert.equal(row.viewport, PENDING_DEVICE);
    assert.equal(row.quality, PENDING_DEVICE);
  }
  console.log(
    "pending-device when unmeasured: fps, frameMs, drawCalls, triangles, bytes, timeToOperableMs, device, viewport, quality",
  );
  console.log("no on-device frame time was collected in this run");
});

test("a supplied frame time does not become a fake fps when the device is missing", () => {
  const log = [];
  const recorded = recordSample(log, "combat", {
    frameMs: 20,
    drawCalls: 10,
    triangles: 200,
    bytes: 4096,
    quality: "low",
    viewport: "390x844",
  });
  assert.equal(log.length, 1);
  assert.equal(recorded.segment, "combat");
  assert.equal(recorded.frameMs, 20);
  assert.equal(recorded.device, PENDING_DEVICE);
  assert.equal(recorded.fps, PENDING_DEVICE);
  assert.notEqual(recorded.fps, 1000 / recorded.frameMs);
  assert.equal(recorded.timeToOperableMs, PENDING_DEVICE);
  assert.throws(() => recordSample(log, "boss", {}), /unknown route segment/);
  assert.equal(log.length, 1);
});

test("sameCondition requires device, viewport, quality, and route", () => {
  const base = { device: "fixture-device", viewport: "800x600", quality: "auto", route: "outdoor" };
  assert.equal(sameCondition(base, { ...base }), true);
  assert.equal(sameCondition(base, { ...base, route: "indoor" }), false);
  assert.equal(sameCondition(base, { ...base, quality: "high" }), false);
  assert.equal(sameCondition(base, { ...base, viewport: "390x844" }), false);
  assert.equal(sameCondition(base, { ...base, device: "other-device" }), false);
  assert.equal(sameCondition(base, { ...base, device: PENDING_DEVICE }), false);
  assert.equal(
    sameCondition(
      { device: PENDING_DEVICE, viewport: "800x600", quality: "low", route: "title" },
      { device: PENDING_DEVICE, viewport: "800x600", quality: "low", route: "title" },
    ),
    false,
  );
  assert.equal(
    sameCondition(
      { device: "fixture-device", viewport: "800x600", quality: PENDING_DEVICE, route: "title" },
      { device: "fixture-device", viewport: "800x600", quality: PENDING_DEVICE, route: "title" },
    ),
    false,
  );
});

test("quality tiers keep collision, walkability, and combat resolution", () => {
  assert.deepEqual(QUALITY_TIERS, ["high", "auto", "low"]);
  assert.equal(QUALITY_SWITCH.labels.high, "細緻");
  assert.equal(QUALITY_SWITCH.labels.auto, "自動");
  assert.equal(QUALITY_SWITCH.labels.low, "省電");
  assert.equal(QUALITY_SWITCH.collisionStaysEnabled, true);
  assert.equal(QUALITY_SWITCH.walkabilityStaysEnabled, true);
  assert.equal(QUALITY_SWITCH.combatResolutionStaysEnabled, true);
  assert.match(QUALITY_SWITCH.statement, /碰撞/);
  assert.match(QUALITY_SWITCH.statement, /可走性/);
  assert.match(QUALITY_SWITCH.statement, /戰鬥判定/);
  assert.equal(MEASUREMENT_SPEC.deferRenderTuning, true);
  assert.deepEqual(MEASUREMENT_SPEC.lightingReviewWithF, ["day", "dusk", "night"]);
  assert.equal(PROGRESS_SPEC.saveVersion, 2);
  assert.equal(PROGRESS_SPEC.loginRequired, false);
  assert.equal(PROGRESS_SPEC.storageDeniedOverwritesProgress, false);
});

test("load stall stays operable and names the error", () => {
  assert.equal(LOAD_STALL.stalled, true);
  assert.equal(LOAD_STALL.operable, true);
  assert.equal(typeof LOAD_STALL.message, "string");
  assert.ok(LOAD_STALL.message.length > 0);
});

test("each failure retries cleanly once and sticks without claiming a save", () => {
  assert.deepEqual(FAILURE_KINDS, ["slow-network", "missing-asset", "webgl-lost", "storage-denied"]);
  const phrases = {
    "slow-network": /網路/,
    "missing-asset": /資源/,
    "webgl-lost": /上下文/,
    "storage-denied": /沒有被覆蓋/,
  };
  for (const kind of FAILURE_KINDS) {
    const progressCode = `progress-${kind}`;
    const baseline = { listeners: 4, audio: 2, canvas: 1 };
    const restored = createRecovery({ progressCode, ...baseline });
    assert.equal(restored.state, "idle");
    assert.equal(restored.progressCode, progressCode);
    restored.fail(kind);
    assert.equal(restored.state, "failed");
    assert.equal(restored.kind, kind);
    assert.match(restored.message, phrases[kind]);
    assert.ok(restored.nextStep.length > 0);
    assert.equal(restored.saveAccepted, false);
    assert.equal(restored.progressCode, progressCode);
    assert.deepEqual(restored.baseline, baseline);
    assert.deepEqual(restored.counts, { listeners: 5, audio: 3, canvas: 2 });
    restored.retry();
    assert.equal(restored.state, "restored");
    assert.ok(restored.history.includes("retrying"));
    assert.deepEqual(restored.counts, baseline);
    assert.equal(restored.progressCode, progressCode);
    assert.equal(restored.backupAvailable, true);
    assert.equal(restored.reportSaveSuccess(), false);
    assert.equal(restored.saveAccepted, false);
    if (kind === "storage-denied") assert.match(restored.message, /未覆蓋/);

    const stuck = createRecovery({ progressCode, ...baseline });
    stuck.fail(kind);
    stuck.retry({ ok: false });
    assert.equal(stuck.state, "stuck");
    assert.ok(stuck.history.includes("retrying"));
    assert.equal(stuck.progressCode, progressCode);
    assert.equal(stuck.backupAvailable, true);
    assert.equal(stuck.reportSaveSuccess(), false);
    assert.equal(stuck.saveAccepted, false);
    assert.deepEqual(stuck.counts, { listeners: 5, audio: 3, canvas: 2 });
    assert.match(stuck.message, /連續重試仍然失敗/);
    assert.match(stuck.nextStep, /不可回報保存成功/);
    stuck.retry();
    assert.equal(stuck.state, "stuck");
    assert.equal(stuck.saveAccepted, false);
    assert.equal(stuck.progressCode, progressCode);
  }
});

test("storage denial does not replace the progress code", () => {
  const progressCode = "slot-before-deny";
  const recovery = createRecovery({ progressCode, listeners: 1, audio: 0, canvas: 1 });
  const before = recovery.progressCode;
  recovery.fail("storage-denied");
  assert.equal(recovery.progressCode, before);
  recovery.retry();
  assert.equal(recovery.progressCode, before);
  assert.equal(recovery.reportSaveSuccess(), false);
  assert.equal(PROGRESS_SPEC.storageDeniedOverwritesProgress, false);
});
