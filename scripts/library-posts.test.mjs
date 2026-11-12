import assert from "node:assert/strict";
import test from "node:test";

import { siteEntrance, CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { libraryPorchPosts } from "../src/game/world-data/landmarks.ts";

test("the library porch posts stop a body and the door stays open", () => {
  const posts = libraryPorchPosts();
  assert.equal(posts.length, 2);
  const blocked = resolveCollision(posts[0].x, posts[0].z, 0.42);
  assert.ok(Math.hypot(blocked.x - posts[0].x, blocked.z - posts[0].z) > 0.2);
  const between = resolveCollision((posts[0].x + posts[1].x) / 2, posts[0].z, 0.42);
  assert.ok(Math.hypot(between.x - (posts[0].x + posts[1].x) / 2, between.z - posts[0].z) < 0.05);
  const site = CAMPUS_SITES.find((s) => s.id === "library");
  assert.ok(site);
  const door = siteEntrance(site);
  const held = resolveCollision(door.x, door.z, 0.42);
  assert.ok(Math.hypot(held.x - door.x, held.z - door.z) < 0.05);
});
