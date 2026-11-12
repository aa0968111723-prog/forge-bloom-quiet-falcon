import assert from "node:assert/strict";
import test from "node:test";

import { LIBRARY_RAMP, libraryRampLift } from "../src/game/world-data/library-ramp.ts";
import { PROPS, READING_GIRL_SEAT } from "../src/game/world-data/props.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { LIBRARY, READING_GIRL } from "../src/game/world-data/landmarks.ts";
import { ROUTE_SPECS } from "../src/game/world-data/registry/index.ts";
import { CURATED_PLANTS } from "../src/game/world-data/vegetation.ts";
import { CAMPUS_ROADS } from "../src/game/rpg/campus.ts";

test("the reading girl sits on a bench beside the library ramp", () => {
  assert.equal(libraryRampLift(READING_GIRL_SEAT.x, READING_GIRL_SEAT.z), 0);
  const bench = PROPS.find(
    (prop) =>
      prop.kind === "bench" &&
      prop.x === READING_GIRL_SEAT.x &&
      prop.z === READING_GIRL_SEAT.z &&
      prop.zone === "library",
  );
  assert.ok(bench, "a library bench is at the statue seat");
  const onDeck = libraryRampLift(LIBRARY_RAMP.x, READING_GIRL_SEAT.z);
  assert.ok(onDeck > 0.4, `the old seat on the ramp centre lifts ${onDeck}`);
  assert.equal(READING_GIRL.x, READING_GIRL_SEAT.x);
  assert.equal(READING_GIRL.z, READING_GIRL_SEAT.z);
});

test("the reading girl sits on a forecourt seat that stops a body", () => {
  const girl = READING_GIRL;
  const southWall = LIBRARY.center[1] + LIBRARY.length / 2;
  assert.ok(girl.z - girl.pad / 2 > southWall, "the seat overlaps the library");
  assert.equal(libraryRampLift(girl.x, girl.z), 0);
  const blocked = resolveCollision(girl.x, girl.z, 0.42);
  assert.ok(Math.hypot(blocked.x - girl.x, blocked.z - girl.z) > 0.2);
  const door = resolveCollision(LIBRARY_RAMP.x, southWall + 3, 0.42);
  assert.ok(Math.hypot(door.x - LIBRARY_RAMP.x, door.z - (southWall + 3)) < 0.05);
  const south = girl.z + girl.pad / 2 + 0.42;
  const dodged = resolveCollision(girl.x, south - 1.04, 0.42);
  assert.ok(dodged.z > girl.z, `dodge crossed the seat to ${dodged.z}`);
  for (const plant of CURATED_PLANTS) {
    const inside = Math.abs(plant.x - girl.x) < girl.pad / 2 && Math.abs(plant.z - girl.z) < girl.pad / 2;
    assert.ok(!inside, `${plant.species} is on the seat`);
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
        const hit = Math.abs(x - girl.x) < girl.pad / 2 + 0.42 && Math.abs(z - girl.z) < girl.pad / 2 + 0.42;
        assert.ok(!hit, `route ${x},${z} meets the seat`);
      }
    }
  }
});
