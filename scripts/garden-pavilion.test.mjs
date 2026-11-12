import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { scatterPlants } from "../src/game/world-data/vegetation.ts";
import { SECONDARY_STRUCTURES, pavilionPosts } from "../src/game/world-data/zones/secondary.ts";

test("the garden pavilion is open and the other Chueh Hsuan stays a hip roof", () => {
  const garden = SECONDARY_STRUCTURES.find((s) => s.id === "juexuan-garden");
  const house = SECONDARY_STRUCTURES.find((s) => s.id === "chuehhsuan");
  assert.equal(garden.kind, "pavilion");
  assert.equal(house.kind, "hip-roof-block");
  const center = resolveCollision(garden.position[0], garden.position[1], 0.42);
  assert.ok(Math.hypot(center.x - garden.position[0], center.z - garden.position[1]) < 0.05);
  const posts = pavilionPosts(garden);
  assert.equal(posts.length, 4);
  for (const post of posts) {
    const blocked = resolveCollision(post.x, post.z, 0.42);
    assert.ok(Math.hypot(blocked.x - post.x, blocked.z - post.z) > 0.2);
  }
  const trees = scatterPlants(1).filter(
    (tree) =>
      Math.abs(tree.x - garden.position[0]) < garden.size[0] / 2 + 4 &&
      Math.abs(tree.z - garden.position[1]) < garden.size[2] / 2 + 4,
  );
  assert.equal(trees.length, 0);
});
