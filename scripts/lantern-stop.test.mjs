import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { AVENUE_PAVED_WIDTH, MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { LANTERN_BASE, lanternPosts } from "../src/game/world-data/landmarks.ts";
import { PROPS, propsOfKind } from "../src/game/world-data/props.ts";

test("avenue lantern bases stop a body and the paved centre stays open", () => {
  const posts = lanternPosts();
  const placed = propsOfKind("lantern-post");
  assert.ok(posts.length >= 30);
  assert.deepEqual(
    placed.map((p) => [p.x, p.z]),
    posts.map((p) => [p.x, p.z]),
  );
  const blocked = resolveCollision(posts[0].x, posts[0].z, 0.42);
  assert.ok(Math.hypot(blocked.x - posts[0].x, blocked.z - posts[0].z) > 0.2);
  const centre = resolveCollision(0, posts[0].z, 0.42);
  assert.ok(Math.hypot(centre.x, centre.z - posts[0].z) < 0.05);
  const paving = resolveCollision(Math.sign(posts[0].x) * (AVENUE_PAVED_WIDTH / 2), posts[0].z, 0.42);
  assert.ok(Math.abs(paving.x - Math.sign(posts[0].x) * (AVENUE_PAVED_WIDTH / 2)) < 0.05);
  const gap = resolveCollision(posts[0].x, (posts[0].z + posts[2].z) / 2, 0.42);
  assert.ok(Math.abs(gap.z - (posts[0].z + posts[2].z) / 2) < 0.05);
  for (const [x, z] of MAIN_ROUTE) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `route point ${x},${z} moved`);
  }
  for (const lamp of PROPS.filter((p) => p.kind === "street-lamp")) {
    for (const post of posts) {
      const dx = Math.max(0, Math.abs(lamp.x - post.x) - LANTERN_BASE / 2);
      const dz = Math.max(0, Math.abs(lamp.z - post.z) - LANTERN_BASE / 2);
      assert.ok(Math.hypot(dx, dz) > 1.2, `street lamp ${lamp.x},${lamp.z} sits on a lantern`);
    }
  }
});
