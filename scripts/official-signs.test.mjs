import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { CAMPUS_REGISTRY, OFFICIAL_SOURCES } from "../src/game/world-data/registry/index.ts";

test("two sign names follow the secretariat list and stay estimated", () => {
  const science = CAMPUS_SITES.find((site) => site.id === "science");
  const pool = CAMPUS_SITES.find((site) => site.id === "swimming");
  assert.equal(science?.name, "騮先紀念科學館");
  assert.equal(pool?.name, "紹謨紀念游泳館");
  for (const id of ["science", "swimming"]) {
    const row = CAMPUS_REGISTRY.find((item) => item.permanentId === id);
    assert.equal(row?.officialName, id === "science" ? science?.name : pool?.name);
    assert.equal(row?.accuracy, "estimated");
    assert.equal(row?.fieldChecked, false);
  }
  assert.ok(OFFICIAL_SOURCES.some((source) => source.url.includes("page_id=18273")));
  assert.ok(OFFICIAL_SOURCES.every((source) => source.downloadedThisRound === false));
});
