import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES } from "../src/game/rpg/campus.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { SECONDARY_STRUCTURES, gatePiers } from "../src/game/world-data/zones/secondary.ts";

test("guard gates are open piers, not a solid block", () => {
  const gates = CAMPUS_SITES.filter((site) => site.form === "gate");
  assert.deepEqual(
    gates.map((site) => site.id),
    ["main-gate", "dazhong-gate"],
  );
  for (const site of gates) {
    const structure = SECONDARY_STRUCTURES.find((item) => item.id === site.id);
    assert.equal(structure?.kind, "gate");
    assert.equal(structure?.accuracy, "estimated");
    const piers = gatePiers(structure);
    assert.equal(piers.length, 2);
    const passage = resolveCollision(site.x, site.z, 0.6);
    assert.ok(Math.hypot(passage.x - site.x, passage.z - site.z) < 0.05, site.id);
    for (const pier of piers) {
      const blocked = resolveCollision(pier.x, pier.z, 0.4);
      assert.ok(Math.hypot(blocked.x - pier.x, blocked.z - pier.z) > 0.2, site.id);
    }
  }
});
