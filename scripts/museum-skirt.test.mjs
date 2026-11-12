import assert from "node:assert/strict";
import test from "node:test";

import { foundationSpan, SECONDARY_STRUCTURES } from "../src/game/world-data/zones/secondary.ts";

test("the maritime museum skirt fills the downhill gap under the hull", () => {
  const museum = SECONDARY_STRUCTURES.find((s) => s.id === "maritime-museum");
  assert.ok(museum);
  const span = foundationSpan(museum);
  assert.ok(span.gap > 2, `gap ${span.gap}`);
  assert.ok(span.low < span.deck);
  assert.ok(Math.abs(span.deck - span.low - span.gap) < 1e-6);
  const doorZ = -230;
  const skirtSouth = museum.position[1] + museum.size[2] / 2 + 0.2;
  assert.ok(doorZ > skirtSouth, "the south approach stays outside the skirt");
  const flat = SECONDARY_STRUCTURES.find((s) => s.id === "white-hall");
  assert.ok(flat);
  assert.ok(foundationSpan(flat).gap < 1.5);
});
