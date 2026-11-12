import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_ROADS } from "../src/game/rpg/campus.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { exhibitFootprint, HULL_YAW, MUSEUM_EXHIBITS } from "../src/game/world-data/exhibits.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";
import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";

test("museum airframes block the body and leave the south door open", () => {
  const hull = SECONDARY_STRUCTURES.find((item) => item.id === "maritime-museum");
  assert.ok(hull);
  assert.equal(hull.kind, "ship");
  assert.equal(hull.rotationY, HULL_YAW);
  assert.equal(hull.accuracy, "estimated");
  const door = resolveCollision(150, -230, 0.42);
  assert.ok(Math.hypot(door.x - 150, door.z + 230) < 0.05);
  for (const item of MUSEUM_EXHIBITS) {
    const foot = exhibitFootprint(item);
    const blocked = resolveCollision(item.x, item.z, 0.42);
    assert.ok(Math.hypot(blocked.x - item.x, blocked.z - item.z) > 0.2, item.id);
    const contactZ = item.z + foot.d / 2 + 0.42;
    const dodged = resolveCollision(item.x, contactZ - 1.04, 0.42);
    assert.ok(dodged.z > item.z, `${item.id} dodge crossed to ${dodged.z}`);
    const gap =
      item.z - foot.d / 2 > hull.position[1] + hull.size[2] / 2 ||
      item.z + foot.d / 2 < hull.position[1] - hull.size[2] / 2 ||
      item.x - foot.w / 2 > hull.position[0] + hull.size[0] / 2 ||
      item.x + foot.w / 2 < hull.position[0] - hull.size[0] / 2;
    assert.ok(gap, `${item.id} overlaps the hull box`);
  }
  const routes = [MAIN_ROUTE, ...ROUTE_SPECS.map((route) => route.polyline), ...CAMPUS_ROADS];
  for (const route of routes) {
    for (let i = 1; i < route.length; i++) {
      const [ax, az] = route[i - 1];
      const [bx, bz] = route[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        for (const item of MUSEUM_EXHIBITS) {
          const foot = exhibitFootprint(item);
          const hit = Math.abs(x - item.x) < foot.w / 2 + 0.42 && Math.abs(z - item.z) < foot.d / 2 + 0.42;
          assert.ok(!hit, `route ${x},${z} meets ${item.id}`);
        }
      }
    }
  }
  for (const plant of CURATED_PLANTS) {
    for (const item of MUSEUM_EXHIBITS) {
      const foot = exhibitFootprint(item);
      const inside = Math.abs(plant.x - item.x) < foot.w / 2 && Math.abs(plant.z - item.z) < foot.d / 2;
      assert.ok(!inside, `${plant.species} stands on ${item.id}`);
    }
  }
});
