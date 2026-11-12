import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, String(value));
  },
  removeItem: (key) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
  key: (index) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

await register(
  pathToFileURL(
    fileURLToPath(new URL("../src/game/rpg/acceptance/node-resolve.mjs", import.meta.url)),
  ).href,
  import.meta.url,
);

const { RPG_SAVE_KEY, flushSave, noteCloudSave, useRpg } = await import("../src/game/rpg/store.ts");
const { SUPPLY_NODES } = await import("../src/game/rpg/campus.ts");
const { validateRpgDocument } = await import("../src/features/cloud-save/contract.ts");

test("a downloaded cloud save is not overwritten by the running game", () => {
  const cloud = JSON.stringify({
    version: 2,
    hp: 40,
    xp: 12,
    slots: [],
    buildings: [],
    interiorId: "library",
    floor: 3,
  });
  localStorage.setItem(RPG_SAVE_KEY, cloud);
  useRpg.setState({ xp: 99, freshStart: false });
  flushSave();
  assert.notEqual(localStorage.getItem(RPG_SAVE_KEY), cloud);

  localStorage.setItem(RPG_SAVE_KEY, cloud);
  noteCloudSave(cloud);
  assert.equal(useRpg.getState().saveConflict, true);
  flushSave();
  assert.equal(localStorage.getItem(RPG_SAVE_KEY), cloud);
  assert.equal(useRpg.getState().xp, 99);
});

test("reloading the downloaded cloud save keeps the interior floor", () => {
  const cloud = JSON.stringify({
    version: 2,
    hp: 40,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    interiorId: "library",
    floor: 3,
  });
  localStorage.setItem(RPG_SAVE_KEY, cloud);
  noteCloudSave(cloud);
  useRpg.getState().reloadProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.interiorId, "library");
  assert.equal(saved.floor, 3);
  assert.equal(useRpg.getState().interiorId, "library");
  assert.equal(useRpg.getState().floor, 3);
  assert.equal(useRpg.getState().saveConflict, false);
});

test("reloading a cloud save keeps a built station's harvest cooldown", () => {
  const stationId = "11111111-2222-4333-8444-555555555555";
  const supply = SUPPLY_NODES[0];
  const until = Date.now() + 120_000;
  const cloud = {
    version: 2,
    hp: 40,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    harvested: {
      [`facility:${stationId}`]: until,
      [supply.id]: until,
      "facility:cooled-too-far": Date.now() + 999_999,
    },
  };
  const text = JSON.stringify(cloud);
  assert.equal(validateRpgDocument(cloud).ok, true);
  localStorage.setItem(RPG_SAVE_KEY, text);
  noteCloudSave(text);
  useRpg.getState().reloadProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(useRpg.getState().harvested[`facility:${stationId}`], until);
  assert.equal(useRpg.getState().harvested[supply.id], until);
  assert.equal(useRpg.getState().harvested["facility:cooled-too-far"], undefined);
  assert.equal(saved.harvested[`facility:${stationId}`], until);
  assert.equal(saved.harvested[supply.id], until);
  assert.equal(validateRpgDocument(saved).ok, true);
});

test("an imported unknown item stays quarantined and can still upload", () => {
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [{ itemId: "Old Badge", quantity: 2 }],
    gear: [{ id: "kept-lamp", itemId: "Field Lamp", durability: 3, quality: "plain" }],
    buildings: [],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(saved.quarantine, [{ itemId: "Old Badge", quantity: 2 }]);
  assert.deepEqual(saved.quarantineGear, [
    { id: "kept-lamp", itemId: "Field Lamp", durability: 3, quality: "plain" },
  ]);
  assert.equal(
    saved.slots.some((slot) => slot.itemId === "Old Badge"),
    false,
  );
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
});

test("a variety run still uploads after more stations were placed than can stand at once", async () => {
  const { readCaps } = await import("../src/features/gameplay-variety/host.ts");
  const { beginEvent } = await import("../src/features/gameplay-variety/runtime.ts");
  useRpg.setState({ built: 49, freshStart: false, hp: 80, departmentId: "math" });
  const caps = readCaps();
  assert.equal(caps.built, 49);
  assert.equal(beginEvent("gv-night-patrol", caps), true);
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.built, 49);
  assert.equal(saved.variety.active.caps.built, 49);
  assert.equal(saved.buildings.length <= 48, true);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.built, 49);
  assert.equal(reloaded.variety.active.eventId, "gv-night-patrol");
  assert.equal(reloaded.variety.active.caps.built, 49);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a long look-around still uploads the same facing", async () => {
  const { useGame } = await import("../src/game/store.ts");
  const { withinAttack } = await import("../src/game/rpg/rules.ts");
  for (const yaw of [100_001, -100_001]) {
    useGame.setState({ phase: "playing", playerX: 12, playerZ: -20, playerYaw: yaw });
    useRpg.setState({
      freshStart: false,
      hp: 80,
      departmentId: "math",
      interiorId: null,
      checkpoint: null,
    });
    useRpg.getState().keepProgress();
    const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
    const checked = validateRpgDocument(saved);
    assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
    assert.ok(saved.position.yaw >= 0 && saved.position.yaw < Math.PI * 2);
    const ahead = { x: 12 - Math.sin(yaw), z: -20 - Math.cos(yaw) };
    assert.equal(
      withinAttack(12, -20, saved.position.yaw, ahead.x, ahead.z, 3.7, false),
      withinAttack(12, -20, yaw, ahead.x, ahead.z, 3.7, false),
    );
    assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
    const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
    assert.equal(validateRpgDocument(reloaded).ok, true);
    assert.ok(reloaded.position.yaw >= 0 && reloaded.position.yaw < Math.PI * 2);
  }
});

test("a full-length campus memory still uploads", async () => {
  const { useGame } = await import("../src/game/store.ts");
  const { applyEffects } = await import("../src/features/narrative/effects.ts");
  const { createSession } = await import("../src/features/narrative/play.ts");
  const line = "記".repeat(80);
  assert.equal(line.length, 80);
  const played = applyEffects(
    { npcs: [{ id: "npc-chen-yu" }] },
    {},
    createSession("campus"),
    [{ type: "remember", npcId: "npc-chen-yu", key: "last", value: line }],
  );
  assert.equal(played.ok, true);
  const key = "npc-chen-yu:last";
  useGame.setState({ phase: "playing", playerX: 12, playerZ: -20, playerYaw: 0.4 });
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    interiorId: null,
    checkpoint: null,
    narrative: played.session,
  });
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(saved.narrative.memory[key], line);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.memory[key], line);
  assert.equal(validateRpgDocument(reloaded).ok, true);
  const tooLong = structuredClone(saved);
  tooLong.narrative.memory[key] = `${line}。`;
  assert.equal(tooLong.narrative.memory[key].length, 81);
  const rejected = validateRpgDocument(tooLong);
  assert.equal(rejected.ok, false);
});

test("a long ground-loot id still uploads with its items", () => {
  const longId = `pile-${"a".repeat(90)}`;
  assert.ok(longId.length > 80);
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    loot: [{ id: longId, x: 12, z: 18, items: { notes: 2 }, quest: { notes: 1 } }],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.loot.length, 1);
  assert.equal(saved.loot[0].id, longId.slice(0, 80));
  assert.equal(saved.loot[0].items.notes, 2);
  assert.equal(saved.loot[0].quest.notes, 1);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.loot[0].id, longId.slice(0, 80));
  assert.equal(reloaded.loot[0].items.notes, 2);
  assert.equal(reloaded.loot[0].quest.notes, 1);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("an unusable ground pile still uploads its items", async () => {
  const { WORLD_BOUNDS } = await import("../src/game/world.ts");
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    loot: [
      { id: "", x: 200_000, z: -200_000, items: { notes: 3 }, quest: { notes: 2 } },
      { id: "pile-near", x: 12, z: 18, items: { parts: 1 } },
    ],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const far = saved.loot.find((pile) => pile.items.notes === 3);
  const near = saved.loot.find((pile) => pile.id === "pile-near");
  assert.ok(far);
  assert.ok(near);
  assert.ok(far.id.length >= 1 && far.id.length <= 80);
  assert.equal(far.items.notes, 3);
  assert.equal(far.quest.notes, 2);
  assert.ok(far.x >= WORLD_BOUNDS.minX + 8 && far.x <= WORLD_BOUNDS.maxX - 8);
  assert.ok(far.z >= WORLD_BOUNDS.minZ + 8 && far.z <= WORLD_BOUNDS.maxZ - 8);
  assert.equal(near.x, 12);
  assert.equal(near.z, 18);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const kept = reloaded.loot.find((pile) => pile.items.notes === 3);
  assert.equal(kept.id, far.id);
  assert.equal(kept.items.notes, 3);
  assert.equal(kept.quest.notes, 2);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});
