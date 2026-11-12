import assert from "node:assert/strict";
import test from "node:test";

import { sweepCircle } from "../src/game/rpg/physics/sweep.ts";
import { MAIN_ROUTE, PAST_PLAZA_LAMP, SCROLL_LAMP_PASS } from "../src/game/world-data/axis.ts";
import { resolveCollision, substepCollision } from "../src/game/world-data/colliders.ts";
import { LAMP_POLE } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";

test("street-lamp poles stop a body and the pilgrimage lines stay open", () => {
  const lamps = PROPS.filter((prop) => prop.kind === "street-lamp");
  assert.equal(lamps.length, 59);
  assert.equal(LAMP_POLE.diameter, 0.18);
  const gate = lamps.find((lamp) => lamp.zone === "kenan" && lamp.x < 0 && lamp.z === 72);
  assert.ok(gate);
  const blocked = resolveCollision(gate.x, gate.z, 0.42);
  assert.ok(Math.hypot(blocked.x - gate.x, blocked.z - gate.z) > 0.2);
  const beside = resolveCollision(gate.x - 1.2, gate.z, 0.42);
  assert.ok(Math.abs(beside.x - (gate.x - 1.2)) < 0.05);
  for (const [x, z] of [PAST_PLAZA_LAMP, SCROLL_LAMP_PASS]) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `pass ${x},${z} moved`);
  }
  for (const [x, z] of MAIN_ROUTE) {
    const held = resolveCollision(x, z, 0.42);
    assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `route point ${x},${z} moved`);
  }
  for (const route of ROUTE_SPECS) {
    for (const [x, z] of route.polyline) {
      const held = resolveCollision(x, z, 0.42);
      assert.ok(Math.hypot(held.x - x, held.z - z) < 0.05, `${route.id} ${x},${z} moved`);
    }
  }
});

test("a dodge step and a sweep both stop on the near side of a lamp pole", () => {
  const lamp = PROPS.find(
    (prop) => prop.kind === "street-lamp" && Math.abs(prop.x - 66.2) < 0.01 && Math.abs(prop.z - 8) < 0.01,
  );
  assert.ok(lamp);
  const radius = 0.42;
  const west = lamp.x - LAMP_POLE.diameter / 2 - radius;
  const dodge = 13 / 24;
  const jumped = resolveCollision(west + dodge, lamp.z, radius);
  assert.ok(jumped.x > lamp.x, `single step stayed at ${jumped.x}`);
  const held = substepCollision(west, lamp.z, dodge, 0, radius);
  assert.ok(held.x < lamp.x - LAMP_POLE.diameter / 2, `substep crossed to ${held.x}`);
  const cast = sweepCircle({ x: 65.2, z: 8, dx: 2, dz: 0, radius });
  assert.equal(cast.hit, true);
  assert.ok(cast.end.x < lamp.x, `sweep crossed to ${cast.end.x}`);
});
