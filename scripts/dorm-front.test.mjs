import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { dormFrontProfile, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("Sungtao 2 keeps a public ground floor and the other halls stay dorms", () => {
  const hall = SECONDARY_STRUCTURES.find((s) => s.id === "sungtao-2");
  assert.ok(hall);
  assert.equal(hall.kind, "dorm-front");
  for (const id of ["sungtao", "sungtao-3", "sungtao-4", "sungtao-5"]) {
    assert.equal(SECONDARY_STRUCTURES.find((s) => s.id === id)?.kind, "dorm-block");
  }
  assert.equal(SECONDARY_STRUCTURES.find((s) => s.id === "reitaku")?.kind, "intl-dorm");
  const site = CAMPUS_SITES.find((s) => s.id === "sungtao-2");
  assert.ok(site?.venues?.includes("文錙藝術中心"));
  assert.ok(site?.venues?.includes("美食廣場"));
  const profile = dormFrontProfile(hall.size);
  assert.ok(profile.lobbyH < hall.size[1] * 0.25);
  assert.ok(profile.glassZ > hall.size[2] / 2);
  assert.ok(profile.canopyZ - profile.canopyD / 2 >= hall.size[2] / 2 - 0.02);
  assert.ok(profile.canopyW < hall.size[0]);
});
