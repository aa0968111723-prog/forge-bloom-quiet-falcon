import assert from "node:assert/strict";
import test from "node:test";

import { facultyPosts } from "../src/features/faculty-story/posts.ts";
import { CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";
import {
  ENCOUNTERS,
  emptyFelled,
  emptyGathered,
  missionProgress,
  MISSIONS,
} from "../src/game/rpg/data.ts";

const patrols = ENCOUNTERS.filter((row) => row.id.startsWith("patrol-"));

test("patrol encounters fill empty colleges without sitting on doors, buildings, or faculty", () => {
  assert.equal(patrols.length, 10);
  assert.equal(new Set(patrols.map((row) => row.id)).size, 10);
  for (const row of patrols) assert.ok(row.kind === "quiz" || row.kind === "report");
  const posts = facultyPosts();
  for (const row of patrols) {
    for (const site of CAMPUS_SITES) {
      const inside =
        Math.abs(row.x - site.x) < site.w / 2 + 2 && Math.abs(row.z - site.z) < site.d / 2 + 2;
      assert.equal(inside, false, `${row.id} overlaps ${site.id}`);
      const door = siteEntrance(site);
      assert.ok(Math.hypot(row.x - door.x, row.z - door.z) >= 8, `${row.id} covers ${site.id} door`);
    }
    for (const post of posts) {
      assert.ok(Math.hypot(row.x - post.x, row.z - post.z) >= 12, `${row.id} covers ${post.id}`);
    }
    for (const other of ENCOUNTERS) {
      if (other.id === row.id) continue;
      assert.ok(Math.hypot(row.x - other.x, row.z - other.z) >= 14, `${row.id} stacks on ${other.id}`);
    }
  }
});

test("collection and report progress use separate psychological channels", () => {
  const state = {
    kills: 3,
    built: 0,
    boss: 0,
    discoveries: [],
    gathered: { ...emptyGathered(), notes: 12, parts: 4, coffee: 1, tea: 3 },
    felled: { ...emptyFelled(), quiz: 5, report: 2 },
  };
  const progress = (id) => missionProgress(MISSIONS.find((row) => row.id === id), state);
  assert.equal(progress("gather-notes"), 12);
  assert.equal(progress("gather-parts"), 4);
  assert.equal(progress("gather-drinks"), 4);
  assert.equal(progress("reports"), 2);
  assert.equal(progress("first"), 3);
  assert.equal(progress("reports") < state.felled.quiz + state.felled.report, true);
});
