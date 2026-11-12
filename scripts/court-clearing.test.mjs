import assert from "node:assert/strict";
import test from "node:test";

import { scatterPlants } from "../src/game/world-data/vegetation.ts";
import { SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

function onCourt(plant, court, margin = 0) {
  return (
    Math.abs(plant.x - court.position[0]) < court.size[0] / 2 + margin &&
    Math.abs(plant.z - court.position[1]) < court.size[2] / 2 + margin
  );
}

test("scattered trees stay off the open courts", () => {
  const courts = SECONDARY_STRUCTURES.filter((s) => s.kind === "court");
  assert.ok(courts.length >= 4);
  const trees = scatterPlants(1);
  for (const court of courts) {
    const inside = trees.filter((tree) => onCourt(tree, court));
    assert.equal(inside.length, 0, court.id);
  }
  const wuhu = courts.find((s) => s.id === "wuhu-courts");
  const near = trees.filter((tree) => onCourt(tree, wuhu, 2.9));
  assert.equal(near.length, 0);
});
