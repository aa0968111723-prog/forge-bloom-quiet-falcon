import assert from "node:assert/strict";
import test from "node:test";

import { LIBRARY_SHELF } from "../src/game/rpg/interior-layout.ts";

test("reading-room shelves sit between the body and the wall", () => {
  const shelf = LIBRARY_SHELF;
  for (const [name, x, depth] of [
    ["board", shelf.boardX, shelf.boardDepth],
    ["book", shelf.bookX, shelf.bookDepth],
  ]) {
    const inner = x - depth / 2;
    const outer = x + depth / 2;
    assert.ok(inner > shelf.bodyEdge, `${name} inner ${inner} meets the body`);
    assert.ok(outer < shelf.wallInner, `${name} outer ${outer} enters the wall`);
  }
});
