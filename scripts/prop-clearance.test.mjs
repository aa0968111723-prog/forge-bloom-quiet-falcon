import assert from "node:assert/strict";
import test from "node:test";

import { AXIS } from "../src/game/world-data/axis.ts";
import { COLLIDERS } from "../src/game/world-data/colliders.ts";
import { LIBRARY_BASE_MARGIN } from "../src/game/world-data/landmarks.ts";
import { PROPS } from "../src/game/world-data/props.ts";

function inside(x, z, box) {
  return x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
}

test("street lamps and the library name plate sit outside solids", () => {
  for (const lamp of PROPS.filter((p) => p.kind === "street-lamp")) {
    assert.equal(COLLIDERS.some((box) => inside(lamp.x, lamp.z, box)), false, `${lamp.x},${lamp.z}`);
  }
  const plate = PROPS.find((p) => p.kind === "name-plate" && p.zone === "library");
  assert.equal(plate.rotationY, Math.PI / 2);
  // The plate hangs on the wall, above the plinth, so its plan sits on the skirt.
  assert.ok(plate.z > AXIS.libraryFrontZ);
  assert.ok(plate.z < AXIS.libraryFrontZ + LIBRARY_BASE_MARGIN);
  assert.equal(
    COLLIDERS.some((box) => inside(plate.x, plate.z, box) && box.maxZ <= AXIS.libraryFrontZ + 0.05),
    false,
  );
  const business = PROPS.find((p) => p.kind === "street-lamp" && Math.abs(p.x - 128.4) < 0.3);
  const museum = PROPS.find((p) => p.kind === "street-lamp" && Math.abs(p.x - 150.6) < 0.3);
  assert.ok(business.z > -171);
  assert.ok(museum.z > -242);
});
