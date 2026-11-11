import assert from "node:assert/strict";
import test from "node:test";

import {
  SECONDARY_STRUCTURES,
  contextDetailLimit,
  contextShowsDetail,
  glazingBand,
  linkedHallProfile,
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
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.kind, "intl-dorm");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "reitaku")?.kind, "dorm-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "chemistry")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "shed");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "wind-lab")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "swimming")?.kind, "sport-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.kind, "stand");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.accuracy, "estimated");
  assert.notEqual(SECONDARY_STRUCTURES.find((item) => item.id === "reviewing")?.kind, "lab-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "hweiwen")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-building")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.kind, "linked-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-o")?.kind, "media-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-q")?.kind, "media-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "business-o")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "humanities")?.kind, "hip-roof-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "integrated")?.accuracy, "estimated");
  const hall = SECONDARY_STRUCTURES.find((item) => item.id === "integrated");
  const profile = linkedHallProfile(hall.size);
  const floors = hall.floors;
  for (let floor = 0; floor < floors; floor++) {
    const y = ((floor + 0.55) * hall.size[1]) / floors;
    const south = glazingBand("linked-hall", hall.size, floors, floor, 1);
    if (y < profile.baseH) continue;
    const face = profile.upperZ + profile.upperDepth / 2;
    assert.ok(Math.abs(south.lz - (face + 0.05)) < 1e-6, `upper band floats at ${south.lz}`);
    assert.ok(south.width <= profile.upperWidth - 1, "upper band is wider than the recessed wall");
  }
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "conference")?.kind, "forum-hall");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "conference")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "audiovisual")?.kind, "auditorium");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "audiovisual")?.accuracy, "estimated");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "humanities")?.kind, "hip-roof-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "administration")?.kind, "study-block");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "main-gate")?.kind, "gate");
  assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === "education")?.accuracy, "estimated");
  for (const id of ["sungtao", "chemistry", "swimming"]) {
    assert.equal(SECONDARY_STRUCTURES.find((item) => item.id === id)?.accuracy, "estimated");
  }
});
