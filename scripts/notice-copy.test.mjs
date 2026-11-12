import assert from "node:assert/strict";
import test from "node:test";

import { NOTICE_LINES } from "../src/game/world-data/notice-copy.ts";
import { propsOfKind } from "../src/game/world-data/props.ts";

test("every notice board shares two short lines", () => {
  assert.equal(NOTICE_LINES.length, 2);
  assert.equal(NOTICE_LINES[0], "校園公告");
  assert.equal(NOTICE_LINES[1], "請沿步道行走");
  for (const line of NOTICE_LINES) assert.ok(line.length >= 2 && line.length <= 8);
  assert.equal(propsOfKind("noticeboard").length, 4);
});
