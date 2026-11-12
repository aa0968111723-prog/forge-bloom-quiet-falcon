import assert from "node:assert/strict";
import test from "node:test";

import { TIME_PRESETS } from "../src/game/world-data/lighting.ts";
import { PLAZA_RADIUS } from "../src/game/world-data/axis.ts";
import {
  STREET_LAMP_HEAD,
  STREET_LAMP_SCALE,
  streetLampEmissive,
  streetLampHead,
} from "../src/game/world-data/street-lamp.ts";

test("street-lamp heads follow the same lampsOn flag as the avenue", () => {
  assert.equal(TIME_PRESETS.day.lampsOn, false);
  assert.equal(TIME_PRESETS.night.lampsOn, true);
  assert.equal(streetLampEmissive(false).emissiveIntensity, 0);
  assert.ok(streetLampEmissive(true).emissiveIntensity > 1);
  const head = streetLampHead(10, 4, 0, 20);
  assert.ok(head.x < 10, "yaw 0 keeps the KayKit arm on -X");
  assert.ok(Math.abs(head.z - 4) < 1e-9);
  assert.ok(Math.abs(head.y - (20 + STREET_LAMP_HEAD.y * STREET_LAMP_SCALE)) < 1e-9);
  const turned = streetLampHead(0, 0, Math.PI / 2, 0);
  assert.ok(Math.abs(turned.x) < 1e-9);
  assert.ok(turned.z > 0);
});

test("the first plaza street lamp sits outside the statue apron", () => {
  const t = 0.2;
  const radius = PLAZA_RADIUS + 2.2;
  const x = Math.sin(t) * radius;
  const z = Math.cos(t) * radius;
  assert.ok(Math.hypot(x, z) > PLAZA_RADIUS);
  assert.ok(Math.abs(x - 2.622) < 0.01);
  assert.ok(Math.abs(z - 12.937) < 0.01);
});
