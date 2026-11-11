/**
 * Gameplay systems: backpack, Tamkang departments/skills, combat, building,
 * local lights, and walkable campus clusters. Imports shipped modules from
 * src/game — it does not copy the rules.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  addItem,
  emptyInventory,
  itemCount,
  listItems,
  removeItem,
  starterInventory,
  useItem,
  usedSlots,
} from "../src/game/inventory.ts";
import {
  COLLEGES,
  DEPARTMENTS,
  inventoryCapacityFor,
  skillModifiers,
} from "../src/game/departments.ts";
import {
  attackDamage,
  createEnemyHp,
  ENEMY_KINDS,
  isDefeated,
  strikeEnemy,
  strikePlayer,
} from "../src/game/combat.ts";
import { listStructures, tryPlace } from "../src/game/building.ts";
import { normalizeSave, serializeSave } from "../src/game/save.ts";
import { lightsForTime } from "../src/game/world-data/local-lights.ts";
import { TIME_PRESETS } from "../src/game/world-data/lighting.ts";
import {
  buildingApproachPoint,
  namedWalkableBuildings,
} from "../src/game/world-data/zones/secondary.ts";
import { ZONE_BY_ID } from "../src/game/world-data/zones/index.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { WORLD_BOUNDS } from "../src/game/world-data/origin.ts";
import { LANDMARKS } from "../src/game/world-data/landmarks.ts";
import { ENEMY_SPAWNS } from "../src/game/world-data/encounters.ts";

test("backpack add, list, overflow, remove and use", () => {
  let inv = emptyInventory(8);
  assert.equal(listItems(inv).length, 0);
  const added = addItem(inv, "notes", 2);
  assert.equal(added.ok, true);
  inv = added.inventory;
  const listed = listItems(inv);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "notes");
  assert.equal(listed[0].count, 2);
  assert.equal(itemCount(inv, "notes"), 2);

  const overflow = addItem(inv, "brick", 10);
  assert.equal(overflow.ok, false);
  assert.equal(overflow.reason, "overflow");
  assert.equal(itemCount(inv, "notes"), 2);

  const removed = removeItem(inv, "notes", 1);
  assert.equal(removed.ok, true);
  inv = removed.inventory;
  assert.equal(itemCount(inv, "notes"), 1);

  const used = useItem(inv, "notes");
  assert.equal(used.ok, true);
  inv = used.inventory;
  assert.equal(itemCount(inv, "notes"), 0);
  assert.equal(listItems(inv).length, 0);

  const missing = useItem(inv, "coffee");
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "missing");
});

test("starter pack fits default capacity", () => {
  const inv = starterInventory();
  assert.ok(usedSlots(inv) > 0);
  assert.ok(usedSlots(inv) <= inv.capacity);
  assert.ok(itemCount(inv, "brick") >= 1);
});

test("Tamkang colleges and departments are the real set", () => {
  const names = COLLEGES.map((c) => c.name);
  for (const n of [
    "文學院",
    "理學院",
    "工學院",
    "商管學院",
    "外國語文學院",
    "國際事務學院",
    "教育學院",
    "AI創智學院",
    "精準健康學院",
  ]) {
    assert.ok(names.includes(n), `missing college ${n}`);
  }
  assert.equal(COLLEGES.length, 9);
  assert.ok(DEPARTMENTS.length >= 9);
  for (const d of DEPARTMENTS) {
    assert.ok(COLLEGES.some((c) => c.id === d.collegeId), d.id);
  }
});

test("selecting a department changes a combat or inventory number", () => {
  const baseCap = inventoryCapacityFor(null);
  const engCap = inventoryCapacityFor("cs");
  assert.ok(engCap > baseCap, "工學院 should enlarge the backpack");

  const baseExam = attackDamage("exam", null);
  const sciExam = attackDamage("exam", "math");
  assert.ok(sciExam > baseExam, "理學院 should raise exam damage");

  const baseReport = attackDamage("report", null);
  const litReport = attackDamage("report", "chi-lit");
  assert.ok(litReport > baseReport, "文學院 should raise report damage");

  const baseAnomaly = attackDamage("anomaly", null);
  const aiAnomaly = attackDamage("anomaly", "ai");
  assert.ok(aiAnomaly > baseAnomaly, "AI創智學院 should raise anomaly damage");

  const zero = skillModifiers(null);
  const health = skillModifiers("med-info");
  assert.ok(health.healOnUse > zero.healOnUse);
  assert.ok(health.maxHpBonus > zero.maxHpBonus);
});

test("exam, report and anomaly take damage and die at 0 HP", () => {
  for (const kind of ENEMY_KINDS) {
    const max = createEnemyHp(kind);
    assert.ok(max > 0, `${kind} hp`);
    const first = strikeEnemy(max, kind, null);
    assert.ok(first.damage > 0);
    assert.ok(first.hp < max, `${kind} HP must fall`);
    assert.equal(isDefeated(first.hp), first.hp <= 0);

    let hp = max;
    let guard = 0;
    while (!isDefeated(hp) && guard < 40) {
      hp = strikeEnemy(hp, kind, null).hp;
      guard += 1;
    }
    assert.equal(hp, 0, `${kind} should reach 0 HP`);
    assert.equal(isDefeated(hp), true);
  }
});

test("player at 0 HP is defeated", () => {
  const hit = strikePlayer(1, "anomaly", null);
  assert.ok(hit.damage >= 1);
  assert.equal(hit.hp, 0);
  assert.equal(hit.defeated, true);
  assert.equal(isDefeated(hit.hp), true);
});

test("place a structure, list it, reject overlap", () => {
  const first = tryPlace([], "booth", 80, 20, "booth-a");
  assert.equal(first.ok, true);
  const listed = listStructures(first.placed);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, "booth-a");
  assert.equal(listed[0].x, 80);
  assert.equal(listed[0].z, 20);

  const overlap = tryPlace(first.placed, "desk", 80, 20);
  assert.equal(overlap.ok, false);
  assert.equal(overlap.reason, "overlap");

  const onStatue = tryPlace([], "booth", 0, 0);
  assert.equal(onStatue.ok, false);
  assert.equal(onStatue.reason, "overlap");

  const beside = tryPlace(first.placed, "banner", 90, 28, "banner-a");
  assert.equal(beside.ok, true);
  assert.equal(beside.placed.length, 2);
});

test("save then load restores inventory, department and buildings", () => {
  const blob = normalizeSave({
    version: 1,
    visited: ["kenan"],
    inventory: [
      { id: "notes", count: 2 },
      { id: "brick", count: 3 },
    ],
    departmentId: "cs",
    buildings: [{ id: "booth-a", kind: "booth", x: 80, z: 20 }],
  });
  assert.equal(blob.departmentId, "cs");
  assert.equal(blob.visited.includes("kenan"), true);
  assert.equal(
    blob.inventory.find((i) => i.id === "notes")?.count,
    2,
  );
  assert.equal(blob.buildings.length, 1);

  const loaded = normalizeSave(JSON.parse(serializeSave(blob)));
  assert.equal(loaded.departmentId, "cs");
  assert.equal(loaded.inventory.find((i) => i.id === "notes")?.count, 2);
  assert.equal(loaded.inventory.find((i) => i.id === "brick")?.count, 3);
  assert.equal(loaded.buildings[0].kind, "booth");
  assert.equal(loaded.buildings[0].x, 80);
  assert.equal(loaded.visited[0], "kenan");
});

test("v1 pilgrimage-only save migrates empty inventory and no department", () => {
  const blob = normalizeSave({ version: 1, visited: ["statue"], timeOfDay: "night" });
  assert.deepEqual(blob.inventory, []);
  assert.equal(blob.departmentId, null);
  assert.deepEqual(blob.buildings, []);
  assert.equal(blob.timeOfDay, "night");
  assert.deepEqual(blob.visited, ["statue"]);
});

test("local lantern and window lights follow lampsOn", () => {
  assert.equal(TIME_PRESETS.night.lampsOn, true);
  assert.equal(TIME_PRESETS.day.lampsOn, false);

  const on = lightsForTime("night");
  assert.ok(on.length > 0, "night should have local lights");
  assert.ok(on.every((l) => l.intensity > 0));
  assert.ok(on.some((l) => l.kind === "lantern"));
  assert.ok(on.some((l) => l.kind === "window"));

  const off = lightsForTime("day");
  assert.ok(off.length === 0 || off.every((l) => l.intensity === 0));
});

test("named walkable buildings exist in east campus and west academic cluster", () => {
  const named = namedWalkableBuildings();
  const east = named.filter((s) => s.cluster === "east");
  const west = named.filter((s) => s.cluster === "west-academic");
  assert.ok(east.length >= 5, `east buildings ${east.length}`);
  assert.ok(west.length >= 1, `west buildings ${west.length}`);
  assert.ok(east.some((s) => s.id === "engineering"));
  assert.ok(named.some((s) => s.id === "commons"));
  assert.equal(ZONE_BY_ID.east.detail, "campus");
  assert.equal(ZONE_BY_ID["west-academic"].detail, "campus");

  for (const s of named) {
    assert.ok(s.position[0] >= WORLD_BOUNDS.minX && s.position[0] <= WORLD_BOUNDS.maxX, s.id);
    assert.ok(s.position[1] >= WORLD_BOUNDS.minZ && s.position[1] <= WORLD_BOUNDS.maxZ, s.id);
    const ap = buildingApproachPoint(s);
    assert.ok(ap.x >= WORLD_BOUNDS.minX && ap.x <= WORLD_BOUNDS.maxX, `${s.id} approach x`);
    assert.ok(ap.z >= WORLD_BOUNDS.minZ && ap.z <= WORLD_BOUNDS.maxZ, `${s.id} approach z`);
    const pushed = resolveCollision(ap.x, ap.z, 0.45);
    assert.ok(
      Math.hypot(pushed.x - ap.x, pushed.z - ap.z) < 0.01,
      `${s.id} approach is inside a collider`,
    );
  }
});

test("pilgrimage stamps still exist and stay reachable", () => {
  assert.ok(LANDMARKS.length >= 10);
  for (const id of ["kenan", "statue", "palace", "lantern", "dolphin", "scroll", "library"]) {
    const l = LANDMARKS.find((row) => row.id === id);
    assert.ok(l, id);
    assert.ok(l.interact.radius > 0);
    const pushed = resolveCollision(l.interact.x, l.interact.z, 0.45);
    assert.ok(
      Math.hypot(pushed.x - l.interact.x, pushed.z - l.interact.z) < 0.01,
      `${id} stamp blocked`,
    );
  }
});

test("exam report and anomaly spawns exist on campus", () => {
  for (const kind of ENEMY_KINDS) {
    assert.ok(
      ENEMY_SPAWNS.some((e) => e.kind === kind),
      `missing ${kind} spawn`,
    );
  }
  for (const e of ENEMY_SPAWNS) {
    const pushed = resolveCollision(e.x, e.z, 0.45);
    assert.ok(
      Math.hypot(pushed.x - e.x, pushed.z - e.z) < 0.01,
      `${e.id} spawn inside a collider`,
    );
  }
});
