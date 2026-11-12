import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { splitPlants } from "../src/game/world-data/vegetation-lod.ts";

test("planting LOD keeps nearby plants and sends the rest out of range", () => {
  const plants = [
    { id: "bed", x: 4, z: -76 },
    { id: "hedge", x: -4, z: -80 },
    { id: "hill", x: 120, z: -80 },
  ];
  const split = splitPlants(plants, 0, -80, 48);
  assert.deepEqual(split.near.map((plant) => plant.id), ["bed", "hedge"]);
  assert.deepEqual(split.far.map((plant) => plant.id), ["hill"]);
  const edge = splitPlants([{ id: "rim", x: 48, z: 0 }], 0, 0, 48);
  assert.equal(edge.near.length, 0);
  assert.equal(edge.far.length, 1);
  const source = readFileSync(new URL("../src/game/world/Vegetation.tsx", import.meta.url), "utf8");
  assert.match(source, /splitPlants\(batch\.plants/);
  assert.match(source, /GROUND_SPECIES/);
  assert.match(source, /azalea/);
  assert.match(source, /flowerbed/);
});
