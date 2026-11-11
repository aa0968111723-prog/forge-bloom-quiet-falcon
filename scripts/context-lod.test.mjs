import assert from "node:assert/strict";
import test from "node:test";

import {
  SECONDARY_STRUCTURES,
  contextDetailLimit,
  contextShowsDetail,
} from "../src/game/world-data/zones/secondary.ts";

test("context detail drops off with distance and the low tier is shorter", () => {
  assert.equal(contextDetailLimit("high"), 90);
  assert.ok(contextDetailLimit("low") < contextDetailLimit("high"));
  assert.equal(contextShowsDetail(0, 0, 0, 40, "high"), true);
  assert.equal(contextShowsDetail(0, 0, 0, 120, "high"), false);
  assert.equal(contextShowsDetail(0, 0, 0, 70, "low"), false);
  assert.equal(contextShowsDetail(85, -536, 85, -550, "low"), true);
});

test("white-hall and chuehhsuan are not the generic slab", () => {
  const white = SECONDARY_STRUCTURES.find((item) => item.id === "white-hall");
  const hall = SECONDARY_STRUCTURES.find((item) => item.id === "chuehhsuan");
  const humanities = SECONDARY_STRUCTURES.find((item) => item.id === "humanities");
  assert.equal(white?.kind, "white-block");
  assert.equal(hall?.kind, "hip-roof-block");
  assert.equal(humanities?.kind, "hip-roof-block");
  assert.equal(white?.accuracy, "estimated");
  assert.equal(hall?.accuracy, "estimated");
});

test("dorm, lab, and sport masses stay distinct and estimated", () => {
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "sungtao")?.kind, "dorm-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "swimming")?.kind, "sport-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "hweiwen")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.kind, "linked-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.accuracy, "estimated");
  for (const id of ["sungtao", "chemistry", "swimming"]) {
    assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === id)?.accuracy, "estimated");
  }
});
