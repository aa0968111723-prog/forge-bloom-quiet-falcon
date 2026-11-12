import assert from "node:assert/strict";
import test from "node:test";

import { LIBRARY_RAMP, libraryRampLift } from "../src/game/world-data/library-ramp.ts";
import { PROPS, READING_GIRL_SEAT } from "../src/game/world-data/props.ts";

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
});
