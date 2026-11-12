import assert from "node:assert/strict";
import test from "node:test";

import { facultyPosts } from "../src/features/faculty-story/posts.ts";
import { psychPosts } from "../src/features/psych-story/posts.ts";
import { DEPARTMENTS } from "../src/game/departments.ts";
import { CAMPUS_SITES, SUPPLY_NODES, siteEntrance } from "../src/game/rpg/campus.ts";
import { ENCOUNTERS } from "../src/game/rpg/data.ts";
import { DISCOVER_XP } from "../src/game/rpg/growth/progress.ts";
import { MAIN_INTEGRATION } from "../src/features/narrative/adapter.ts";
import {
  acknowledge,
  arrive,
  choose,
  createPlay,
  leave,
  loadCatalog,
  openingLine,
  talk,
  validateCatalog,
} from "../src/features/narrative/index.ts";

const catalog = loadCatalog();
const placeId = "post-xu-hui";

function walk(seed, choiceIds) {
  let play = createPlay(seed);
  const lines = [];
  const outcomes = [];
  for (const choiceId of choiceIds) {
    play = talk(catalog, arrive(catalog, play, placeId));
    lines.push(openingLine(catalog, play));
    const result = choose(catalog, play, choiceId);
    assert.equal(result.ok, true, result.reason ?? choiceId);
    outcomes.push(result.play.ui.outcome);
    play = acknowledge(result.play);
  }
  return { play, lines, outcomes };
}

test("許回 stays off doors, buildings, faculty, supplies, and encounters", () => {
  const [post] = psychPosts();
  assert.equal(post.placeId, placeId);
  assert.ok(Math.hypot(post.x - post.doorX, post.z - post.doorZ) >= 8);
  for (const site of CAMPUS_SITES) {
    const inside =
      Math.abs(post.x - site.x) < site.w / 2 + 2 && Math.abs(post.z - site.z) < site.d / 2 + 2;
    assert.equal(inside, false, site.id);
    const door = siteEntrance(site);
    assert.ok(Math.hypot(post.x - door.x, post.z - door.z) >= 8, site.id);
  }
  for (const faculty of facultyPosts()) {
    assert.ok(Math.hypot(post.x - faculty.x, post.z - faculty.z) >= 12, faculty.id);
  }
  for (const node of SUPPLY_NODES) {
    assert.ok(Math.hypot(post.x - node.x, post.z - node.z) >= 8, node.id);
  }
  for (const enemy of ENCOUNTERS) {
    assert.ok(Math.hypot(post.x - enemy.x, post.z - enemy.z) >= 14, enemy.id);
  }
});

test("both attributions are quoted later, and each reward pays once", () => {
  assert.deepEqual(validateCatalog(catalog).errors, []);
  assert.equal(MAIN_INTEGRATION, false);
  const person = catalog.npcs.find((entry) => entry.id === "npc-xu-hui");
  assert.equal(person?.evidence, "fictional");
  assert.equal(DEPARTMENTS.some((entry) => entry.id === person.departmentId), true);
  for (const event of catalog.events.filter((entry) => entry.id.startsWith("evt-psych-"))) {
    assert.equal(JSON.stringify(event.when ?? null).includes("semester"), false);
  }

  const retrieve = walk("retrieve", ["psych-meet-retrieve", "psych-turn-pause", "psych-after-note"]);
  assert.match(retrieve.lines[1], /沒把那一頁提取出來/);
  assert.match(retrieve.lines[2], /沒提取出來/);
  assert.match(retrieve.lines[2], /先停一下，只找回那一頁/);
  assert.match(retrieve.outcomes[1], /沒有把停一下說成治療/);

  const load = walk("load", ["psych-meet-load", "psych-turn-shed", "psych-after-group"]);
  assert.match(load.lines[1], /兩件事擠掉了那一頁/);
  assert.match(load.lines[2], /兩件事擠掉了那一頁/);
  assert.match(load.lines[2], /先放下其中一件/);
  assert.notEqual(retrieve.lines[2], load.lines[2]);

  const paid = 6 + DISCOVER_XP + 8 + 10;
  assert.equal(retrieve.play.growth.xp, paid);
  assert.equal(load.play.growth.xp, paid);
  assert.equal(retrieve.play.growth.materials.notes, 1);
  assert.equal(load.play.growth.materials.notes, 1);
  for (const id of ["quest-psych-cause-meet", "quest-psych-cause-turn", "quest-psych-cause-after"]) {
    assert.equal(retrieve.play.growth.claimedQuests.includes(id), true, id);
  }

  const again = choose(catalog, {
    ...retrieve.play,
    session: { ...retrieve.play.session, mode: "in-event", activeEventId: "evt-psych-after" },
    ui: { ...retrieve.play.ui, phase: "talking", eventId: "evt-psych-after" },
  }, "psych-after-note");
  assert.equal(again.ok, true);
  assert.equal(again.play.growth.xp, paid);
  assert.equal(again.play.growth.materials.notes, 1);
  assert.ok(again.skipped.some((entry) => entry.includes("quest-psych-cause-after")));

  let left = talk(catalog, arrive(catalog, createPlay("leave"), placeId));
  left = leave(catalog, left);
  assert.equal(left.growth.xp, 0);
  assert.equal(left.session.resolved.includes("evt-psych-meet"), false);
});
