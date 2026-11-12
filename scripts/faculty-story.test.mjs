import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FACULTY_BEATS } from "../src/features/faculty-story/beats.ts";
import { FACULTY_CAST } from "../src/features/faculty-story/cast.ts";
import { facultyGesture } from "../src/features/faculty-story/gesture.ts";
import { facultyPosts, supplyDistance } from "../src/features/faculty-story/posts.ts";
import { MAIN_LINE, SIDE_LINES, playFacultyLine } from "../src/features/faculty-story/route.ts";
import { COLLEGE_IDS, DEPARTMENTS } from "../src/game/departments.ts";
import { CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";
import { NARRATIVE_SAVE_LIMIT, readNarrativeSession } from "../src/game/rpg/narrative-bridge.ts";
import { DISCOVER_XP } from "../src/game/rpg/growth/progress.ts";
import {
  acknowledge,
  arrive,
  choose,
  createPlay,
  leave,
  loadCatalog,
  talk,
  validateCatalog,
} from "../src/features/narrative/index.ts";

const catalog = loadCatalog();
const facultyEvents = catalog.events.filter((event) => event.id.startsWith("evt-faculty-"));
const partIds = new Set(
  [...readFileSync(new URL("../art/characters/npc-kit/parts.ts", import.meta.url), "utf8").matchAll(/id: "([^"]+)"/g)].map(
    (match) => match[1],
  ),
);

test("faculty catalog is fictional, week-1 reachable, and does not invent departments", () => {
  const report = validateCatalog(catalog);
  assert.deepEqual(report.errors, []);
  assert.equal(facultyEvents.length, 48);
  assert.equal(FACULTY_CAST.length, 12);
  assert.equal(new Set(FACULTY_CAST.map((person) => person.collegeId)).size, COLLEGE_IDS.length);
  assert.equal(FACULTY_CAST.filter((person) => person.role === "系主任").length, 3);
  assert.equal(FACULTY_CAST.filter((person) => person.role === "教授").length, 9);
  for (const person of FACULTY_CAST) {
    const department = DEPARTMENTS.find((entry) => entry.id === person.departmentId);
    assert.ok(department, person.departmentId);
    assert.equal(department.collegeId, person.collegeId);
    const npc = catalog.npcs.find((entry) => entry.id === person.id);
    assert.match(npc?.note ?? "", /^虛構角色。/);
    assert.equal(npc?.evidence, "fictional");
  }
  for (const event of facultyEvents) {
    assert.equal(event.autoFire, false);
    assert.equal(event.once, true);
    assert.equal(event.status.integrated, false);
    assert.equal(JSON.stringify(event).includes('"semester"'), false);
    assert.equal(event.choices.length >= 2, true);
  }
});

test("both main-line choices finish with different memory and later lines", () => {
  const left = playFacultyLine("faculty-main-left", MAIN_LINE, 0);
  const right = playFacultyLine("faculty-main-right", MAIN_LINE, 1);
  assert.equal(left.play.session.questNodes["quest-faculty-studio"], "after");
  assert.equal(right.play.session.questNodes["quest-faculty-studio"], "after");
  assert.equal(left.play.growth.xp, right.play.growth.xp);
  assert.notEqual(left.play.session.memory["npc-gu-heng:clash"], right.play.session.memory["npc-gu-heng:clash"]);
  assert.notEqual(left.openings[2], right.openings[2]);
  assert.notEqual(left.openings[7], right.openings[7]);
  const saved = readNarrativeSession(JSON.parse(JSON.stringify(left.play.session)));
  assert.equal(saved.memory["npc-gu-heng:clash"], left.play.session.memory["npc-gu-heng:clash"]);
  assert.equal(saved.questNodes["quest-faculty-studio"], "after");
  assert.equal(saved.resolved.includes("evt-faculty-liang-after"), true);
});

test("six side lines and the two extra arcs have different goals and both endings", () => {
  const required = ["course", "ethics", "survey", "wording", "hours", "cross"];
  for (const key of required) assert.equal(SIDE_LINES[key].eventIds.length, 4);
  for (const key of ["course", "ethics", "survey", "wording", "hours", "case", "schedule"]) {
    const left = playFacultyLine(key + "-l", SIDE_LINES[key].eventIds, 0);
    const right = playFacultyLine(key + "-r", SIDE_LINES[key].eventIds, 1);
    assert.notEqual(left.outcomes[1], right.outcomes[1]);
    assert.equal(left.play.session.resolved.at(-1), SIDE_LINES[key].eventIds.at(-1));
  }
  let waiting = createPlay("cross-wait");
  for (const eventId of SIDE_LINES.cross.eventIds.slice(0, 2)) {
    const event = catalog.events.find((entry) => entry.id === eventId);
    waiting = talk(catalog, arrive(catalog, waiting, event.placeId));
    waiting = acknowledge(choose(catalog, waiting, event.choices[0].id).play);
  }
  const blocked = arrive(catalog, waiting, "post-jian-heng");
  assert.notEqual(blocked.ui.eventId, "evt-faculty-heng-turn");
  let opened = createPlay("cross-open");
  opened = playOnto(opened, ["evt-faculty-he-meet", "evt-faculty-jiang-meet"], 0);
  opened = playOnto(opened, SIDE_LINES.cross.eventIds, 1);
  assert.equal(opened.session.resolved.includes("evt-faculty-heng-after"), true);
  assert.notEqual(
    playFacultyLine("cross-a", prepCross(0), 0).play.session.memory["npc-jian-heng:after"],
    playFacultyLine("cross-b", prepCross(1), 1).play.session.memory["npc-jian-heng:after"],
  );
});

function playOnto(play, eventIds, choiceIndex) {
  let next = play;
  for (const eventId of eventIds) {
    const event = catalog.events.find((entry) => entry.id === eventId);
    next = talk(catalog, arrive(catalog, next, event.placeId));
    assert.equal(next.ui.eventId, eventId);
    const result = choose(catalog, next, event.choices[choiceIndex].id);
    assert.equal(result.ok, true);
    next = acknowledge(result.play);
  }
  return next;
}

function prepCross(index) {
  return ["evt-faculty-he-meet", "evt-faculty-jiang-meet", ...SIDE_LINES.cross.eventIds];
}

test("rewards pay once, leaving pays nothing, and unknown ids do not pay", () => {
  let play = createPlay("pay-once");
  play = talk(catalog, arrive(catalog, play, "post-gu-heng"));
  const first = choose(catalog, play, "fac-gu-meet-line");
  assert.equal(first.ok, true);
  const paid = first.play.growth.xp - play.growth.xp;
  assert.equal(paid, 6 + 4 + DISCOVER_XP);
  const again = choose(
    catalog,
    {
      ...play,
      growth: first.play.growth,
      session: { ...play.session, mode: "in-event", activeEventId: "evt-faculty-gu-meet" },
    },
    "fac-gu-meet-fail",
  );
  assert.equal(again.ok, true);
  assert.equal(again.play.growth.xp, first.play.growth.xp);
  assert.ok(again.skipped.some((item) => item.startsWith("quest-reward")));
  const saved = readNarrativeSession(JSON.parse(JSON.stringify(first.play.session)));
  const returned = arrive(catalog, { ...first.play, session: saved }, "post-gu-heng");
  assert.notEqual(returned.ui.eventId, "evt-faculty-gu-meet");
  let mid = createPlay("leave");
  mid = talk(catalog, arrive(catalog, mid, "post-gu-heng"));
  const left = leave(catalog, mid);
  assert.equal(left.growth.xp, mid.growth.xp);
  assert.equal(left.session.resolved.includes("evt-faculty-gu-meet"), false);
  const missing = arrive(catalog, createPlay("missing"), "post-nobody");
  assert.equal(missing.ui.eventId, null);
  const unknown = choose(catalog, mid, "not-a-choice");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unknown-choice");
  assert.equal(unknown.play.growth.xp, mid.growth.xp);
});

test("an old gate-only save can still meet 顧衡, and fifty flags survive reload", () => {
  let play = createPlay("old-gate");
  play = {
    ...play,
    session: readNarrativeSession({
      version: 1,
      fired: ["evt-gate-orientation"],
      resolved: ["evt-gate-orientation"],
      flags: { "gate-asked-map": true },
      recent: ["evt-gate-orientation", "extra-a", "extra-b", "extra-c"],
    }),
  };
  play = arrive(catalog, play, "post-gu-heng");
  assert.equal(play.ui.eventId, "evt-faculty-gu-meet");
  assert.equal(play.session.recent.length, 3);
  const flags = {};
  const resolved = [];
  for (let i = 0; i < 60; i += 1) {
    flags[`kept-${i}`] = i % 2 === 0;
    resolved.push(`evt-kept-${i}`);
  }
  const round = readNarrativeSession({ version: 1, flags, resolved, fired: resolved });
  assert.equal(Object.keys(round.flags).length, 60);
  assert.equal(round.resolved.length, 60);
  assert.ok(NARRATIVE_SAVE_LIMIT >= 60);
});

test("required flags are set by both choices and do not cycle", () => {
  const setters = new Map();
  for (const event of facultyEvents) {
    for (const choice of event.choices) {
      for (const effect of choice.effects) {
        if (effect.type !== "set-flag" || !effect.value) continue;
        const both = event.choices.every((entry) =>
          entry.effects.some((item) => item.type === "set-flag" && item.flag === effect.flag && item.value),
        );
        if (both) setters.set(effect.flag, event.id);
      }
    }
  }
  const edges = new Map();
  for (const event of facultyEvents) {
    const needed = [];
    if (event.when?.op === "all") {
      for (const term of event.when.of) if (term.op === "flag") needed.push(term.id);
    }
    for (const flag of needed) {
      const setter = setters.get(flag);
      assert.ok(setter, flag);
      assert.notEqual(setter, event.id);
      const list = edges.get(setter) ?? [];
      list.push(event.id);
      edges.set(setter, list);
    }
  }
  const color = new Map();
  const visit = (id) => {
    color.set(id, "gray");
    for (const next of edges.get(id) ?? []) {
      assert.notEqual(color.get(next), "gray");
      if (!color.has(next)) visit(next);
    }
    color.set(id, "black");
  };
  for (const id of edges.keys()) if (!color.has(id)) visit(id);
});

test("choice text is unique, chairs are not one script, and kit parts exist", () => {
  const texts = facultyEvents.flatMap((event) => event.choices.map((choice) => choice.text["zh-Hant"]));
  assert.equal(new Set(texts).size, texts.length);
  const openings = facultyEvents.map((event) => event.lines.at(-1).text["zh-Hant"]);
  assert.equal(new Set(openings).size, openings.length);
  const chairs = ["npc-qiu-ning", "npc-meng-zhao", "npc-jiang-zhao"].map((id) =>
    facultyEvents.find((event) => event.npcIds[0] === id && event.id.endsWith("-meet")).lines.at(-1).text["zh-Hant"],
  );
  assert.equal(new Set(chairs).size, 3);
  for (const line of chairs) assert.equal(line.includes("反派"), false);
  for (const person of FACULTY_CAST) {
    for (const part of person.look.parts) assert.ok(partIds.has(part), part);
  }
  for (let i = 0; i < FACULTY_CAST.length; i += 1) {
    for (let j = i + 1; j < FACULTY_CAST.length; j += 1) {
      const a = new Set(FACULTY_CAST[i].look.parts);
      const b = new Set(FACULTY_CAST[j].look.parts);
      let diff = 0;
      for (const part of a) if (!b.has(part)) diff += 1;
      for (const part of b) if (!a.has(part)) diff += 1;
      assert.ok(diff >= 3, `${FACULTY_CAST[i].id} ${FACULTY_CAST[j].id} ${diff}`);
    }
  }
  assert.equal(facultyGesture("talking"), "talk");
  assert.equal(facultyGesture("outcome"), "deliver");
  assert.equal(facultyGesture("available"), "idle");
});

test("posts stay outside doors, supplies, and each other", () => {
  const posts = facultyPosts();
  assert.equal(posts.length, 12);
  for (const post of posts) {
    const site = CAMPUS_SITES.find((entry) => entry.id === post.siteId);
    const door = Math.hypot(post.x - post.doorX, post.z - post.doorZ);
    assert.ok(door >= 8, post.id);
    const inside =
      post.x > site.x - site.w / 2 &&
      post.x < site.x + site.w / 2 &&
      post.z > site.z - site.d / 2 &&
      post.z < site.z + site.d / 2;
    assert.equal(inside, false, post.id);
    assert.ok(supplyDistance(post) >= 8, post.id);
    for (const other of CAMPUS_SITES) {
      const entrance = siteEntrance(other);
      const gap = Math.hypot(post.x - entrance.x, post.z - entrance.z);
      assert.ok(gap >= 8, `${post.id} ${other.id} ${gap}`);
    }
  }
  for (let i = 0; i < posts.length; i += 1) {
    for (let j = i + 1; j < posts.length; j += 1) {
      const gap = Math.hypot(posts[i].x - posts[j].x, posts[i].z - posts[j].z);
      assert.ok(gap >= 8, `${posts[i].id} ${posts[j].id}`);
    }
  }
});
