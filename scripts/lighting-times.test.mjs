import assert from "node:assert/strict";
import test from "node:test";

import { TIME_PRESETS } from "../src/game/world-data/lighting.ts";

test("day, sunset, night, and wet are distinct avenue presets", () => {
  const day = TIME_PRESETS.day;
  const sunset = TIME_PRESETS.sunset;
  const night = TIME_PRESETS.night;
  const wet = TIME_PRESETS.wet;
  assert.equal(day.lampsOn, false);
  assert.equal(sunset.lampsOn, true);
  assert.equal(night.lampsOn, true);
  assert.ok(sunset.sunPos[0] < 0, "sunset light comes from the west");
  assert.ok(night.sunIntensity < day.sunIntensity * 0.2);
  assert.equal(wet.wetness, 1);
  assert.ok(wet.sunIntensity < day.sunIntensity);
});
