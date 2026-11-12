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

const { RPG_SAVE_KEY, flushSave, inventory, noteCloudSave, useRpg } = await import(
  "../src/game/rpg/store.ts"
);
const { useGame } = await import("../src/game/store.ts");
const { SUPPLY_NODES } = await import("../src/game/rpg/campus.ts");
const { validateRpgDocument } = await import("../src/features/cloud-save/contract.ts");
await import("../src/features/gameplay-variety/host.ts");
const { emptyMemory } = await import("../src/features/gameplay-variety/memory.ts");
const { claimVariety, replaceMemory } = await import("../src/features/gameplay-variety/runtime.ts");

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

test("a move lesson with an unusable anchor still uploads", () => {
  const bad = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    lesson: "move",
    lessonAnchor: { x: 200_000, z: -200_000 },
    position: { x: 12, z: -20, yaw: 0.2 },
  });
  assert.equal(useRpg.getState().importSave(bad), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.lesson, "move");
  assert.ok(saved.lessonAnchor);
  assert.ok(Math.abs(saved.lessonAnchor.x) <= 100_000);
  assert.ok(Math.abs(saved.lessonAnchor.z) <= 100_000);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.lesson, "move");
  assert.equal(validateRpgDocument(reloaded).ok, true);

  const good = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    lesson: "move",
    lessonAnchor: { x: 10, z: 20 },
    position: { x: 12, z: -20, yaw: 0.2 },
  });
  assert.equal(useRpg.getState().importSave(good), true);
  const kept = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(kept.lessonAnchor.x, 10);
  assert.equal(kept.lessonAnchor.z, 20);
  assert.equal(validateRpgDocument(kept).ok, true);
});

test("a stray discovery still uploads the sites already found", async () => {
  const { useGame } = await import("../src/game/store.ts");
  useRpg.setState({
    discoveries: ["library", "Not A Site", "x".repeat(70)],
    freshStart: false,
    hp: 80,
    departmentId: "math",
    interiorId: null,
  });
  useGame.setState({ phase: "playing", playerX: 12, playerZ: -20, playerYaw: 0.2 });
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(saved.discoveries, ["library"]);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(reloaded.discoveries, ["library"]);
  assert.equal(validateRpgDocument(reloaded).ok, true);

  const file = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    discoveries: ["library", "gym", "Not A Site"],
  });
  assert.equal(useRpg.getState().importSave(file), true);
  const imported = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(imported.discoveries, ["library", "gym"]);
  assert.equal(validateRpgDocument(imported).ok, true);
});

test("an old piece of gear with a wild durability still uploads", () => {
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    gear: [
      {
        id: "gear-retired-lamp",
        itemId: "retired-lamp",
        durability: 150_000,
        quality: "fine",
      },
    ],
    quarantineGear: [
      {
        id: "gear-old-charm",
        itemId: "old charm",
        durability: -4,
        quality: "plain",
      },
      {
        id: "gear-kept-pin",
        itemId: "kept-pin",
        durability: 40,
        quality: "fine",
      },
    ],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const lamp = saved.quarantineGear.find((row) => row.itemId === "retired-lamp");
  const charm = saved.quarantineGear.find((row) => row.itemId === "old charm");
  const pin = saved.quarantineGear.find((row) => row.itemId === "kept-pin");
  assert.ok(lamp);
  assert.ok(charm);
  assert.ok(pin);
  assert.equal(lamp.durability, 100_000);
  assert.equal(lamp.quality, "fine");
  assert.equal(charm.durability, 0);
  assert.equal(pin.durability, 40);
  assert.equal(pin.quality, "fine");
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(
    reloaded.quarantineGear.find((row) => row.itemId === "retired-lamp").durability,
    100_000,
  );
  assert.equal(reloaded.quarantineGear.find((row) => row.itemId === "kept-pin").durability, 40);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a narrative clock outside the cloud range still uploads", () => {
  const memory = "還在圖書館。";
  const bad = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: -1,
      minute: 2_000_000,
      memory: { "npc-chen-yu:last": memory },
    },
  });
  assert.equal(useRpg.getState().importSave(bad), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.narrative.rngState, 2 ** 32 - 1);
  assert.equal(saved.narrative.minute, 1_000_000);
  assert.equal(saved.narrative.memory["npc-chen-yu:last"], memory);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.rngState, 2 ** 32 - 1);
  assert.equal(reloaded.narrative.minute, 1_000_000);
  assert.equal(reloaded.narrative.memory["npc-chen-yu:last"], memory);

  const good = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 12,
      minute: 480,
      memory: { "npc-chen-yu:last": memory },
    },
  });
  assert.equal(useRpg.getState().importSave(good), true);
  const kept = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(kept.narrative.rngState, 12);
  assert.equal(kept.narrative.minute, 480);
  assert.equal(kept.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(kept).ok, true);
});

test("a narrative place the cloud cannot name still uploads", () => {
  const memory = "還在圖書館。";
  const bad = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 12,
      minute: 480,
      placeId: "Not A Place",
      departmentId: "x".repeat(90),
      memory: { "npc-chen-yu:last": memory },
    },
  });
  assert.equal(useRpg.getState().importSave(bad), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.narrative.placeId, null);
  assert.equal(saved.narrative.departmentId, null);
  assert.equal(saved.narrative.memory["npc-chen-yu:last"], memory);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.placeId, null);
  assert.equal(reloaded.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(reloaded).ok, true);

  const good = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 12,
      minute: 480,
      placeId: "library",
      departmentId: "math",
      memory: { "npc-chen-yu:last": memory },
    },
  });
  assert.equal(useRpg.getState().importSave(good), true);
  const kept = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(kept.narrative.placeId, "library");
  assert.equal(kept.narrative.departmentId, "math");
  assert.equal(kept.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(kept).ok, true);
});

test("a narrative timer outside the cloud range still uploads", () => {
  const memory = "還在圖書館。";
  const bad = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 12,
      minute: 480,
      cooldowns: { "event-rain": 1e16, "event-bell": 900 },
      mutexUntil: { gate: -1e13 },
      memory: { "npc-chen-yu:last": memory },
    },
  });
  assert.equal(useRpg.getState().importSave(bad), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.narrative.cooldowns["event-rain"], 1e15);
  assert.equal(saved.narrative.cooldowns["event-bell"], 900);
  assert.equal(saved.narrative.mutexUntil.gate, -1e12);
  assert.equal(saved.narrative.memory["npc-chen-yu:last"], memory);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.cooldowns["event-rain"], 1e15);
  assert.equal(reloaded.narrative.cooldowns["event-bell"], 900);
  assert.equal(reloaded.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("an empty narrative key still uploads the named entries", () => {
  const memory = "還在圖書館。";
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 12,
      minute: 480,
      cooldowns: { "": 900, "event-bell": 1200 },
      flags: { "": true, "seen-gate": true },
      memory: { "": "空白", "npc-chen-yu:last": memory },
      fired: ["", "event-rain"],
    },
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(Object.hasOwn(saved.narrative.cooldowns, ""), false);
  assert.equal(saved.narrative.cooldowns["event-bell"], 1200);
  assert.equal(Object.hasOwn(saved.narrative.flags, ""), false);
  assert.equal(saved.narrative.flags["seen-gate"], true);
  assert.equal(Object.hasOwn(saved.narrative.memory, ""), false);
  assert.equal(saved.narrative.memory["npc-chen-yu:last"], memory);
  assert.deepEqual(saved.narrative.fired, ["event-rain"]);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.cooldowns["event-bell"], 1200);
  assert.equal(reloaded.narrative.memory["npc-chen-yu:last"], memory);
  assert.deepEqual(reloaded.narrative.fired, ["event-rain"]);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a quest claim longer than the cloud allows still uploads the others", () => {
  const keptQuest = `quest-${"b".repeat(58)}`;
  const droppedQuest = `quest-${"a".repeat(59)}`;
  assert.equal(keptQuest.length, 64);
  assert.equal(droppedQuest.length, 65);
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    claimed: ["first", droppedQuest, keptQuest, "explorer"],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(saved.claimed, ["first", keptQuest, "explorer"]);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(reloaded.claimed, ["first", keptQuest, "explorer"]);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a long pilgrimage list still uploads the rpg save", async () => {
  const { useGame } = await import("../src/game/store.ts");
  const longId = "x".repeat(65);
  const stamps = Array.from({ length: 40 }, (_, index) => `stamp-${index}`);
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    interiorId: null,
  });
  useGame.setState({
    phase: "playing",
    playerX: 12,
    playerZ: -20,
    playerYaw: 0.2,
    timeOfDay: "day",
    muted: false,
    visited: ["kenan", longId, ...stamps],
  });
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.pilgrimage.visited.includes(longId), false);
  assert.equal(saved.pilgrimage.visited[0], "kenan");
  assert.equal(saved.pilgrimage.visited.includes("stamp-0"), true);
  assert.ok(saved.pilgrimage.visited.length <= 32);
  assert.equal(saved.pilgrimage.visited.length, 32);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("an empty variety note still uploads the named beats", async () => {
  await import("../src/features/gameplay-variety/host.ts");
  const named = "a".repeat(79);
  const tooLong = "b".repeat(80);
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
    variety: {
      version: 1,
      rng: 12,
      recent: ["", tooLong, named],
      resolved: ["real-event", ""],
      claims: ["", "quest-walk"],
      route: null,
      active: null,
      signals: [],
      tutorialSeen: true,
    },
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.variety.recent.includes(""), false);
  assert.equal(saved.variety.recent.includes(tooLong), false);
  assert.deepEqual(saved.variety.recent, [named]);
  assert.deepEqual(saved.variety.resolved, ["real-event"]);
  assert.deepEqual(saved.variety.claims, ["quest-walk"]);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.deepEqual(reloaded.variety.recent, [named]);
  assert.deepEqual(reloaded.variety.claims, ["quest-walk"]);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a long variety note still uploads the run", async () => {
  await import("../src/features/gameplay-variety/host.ts");
  const longReason = "過".repeat(90);
  const longReceipt = "記".repeat(90);
  const keptReason = "線".repeat(80);
  const base = {
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [],
    buildings: [],
  };
  const variety = {
    version: 1,
    rng: 12,
    recent: ["gv-night-patrol"],
    resolved: ["gv-night-patrol"],
    claims: ["quest-gv-night-peace"],
    route: "peace",
    tutorialSeen: true,
    active: {
      eventId: "gv-night-patrol",
      phase: "failed",
      route: "field",
      board: null,
      failReason: longReason,
      receipt: longReceipt,
      tutorial: false,
      caps: {
        equipped: true,
        skillRank: 2,
        built: 3,
        collegeId: "c".repeat(90),
        discipline: "lab",
      },
    },
    signals: [
      {
        type: "variety.resolved",
        eventId: "gv-night-patrol",
        route: "field",
        questId: "Not A Quest",
      },
      {
        type: "variety.resolved",
        eventId: "x".repeat(90),
        route: "peace",
        questId: "quest-gv-library-clues",
      },
      {
        type: "variety.resolved",
        eventId: "gv-library-clues",
        route: "peace",
        questId: "quest-gv-library-clues",
      },
    ],
  };
  assert.equal(useRpg.getState().importSave(JSON.stringify({ ...base, variety })), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.variety.active.eventId, "gv-night-patrol");
  assert.equal(saved.variety.active.phase, "failed");
  assert.equal(saved.variety.active.failReason, longReason.slice(0, 80));
  assert.equal(saved.variety.active.receipt, longReceipt.slice(0, 80));
  assert.equal(saved.variety.active.caps.collegeId, null);
  assert.equal(saved.variety.active.caps.discipline, "lab");
  assert.equal(saved.variety.active.caps.equipped, true);
  assert.equal(saved.variety.active.caps.skillRank, 2);
  assert.equal(saved.variety.signals.length, 1);
  assert.equal(saved.variety.signals[0].questId, "quest-gv-library-clues");
  assert.equal(saved.variety.signals[0].eventId, "gv-library-clues");
  assert.deepEqual(saved.variety.resolved, ["gv-night-patrol"]);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.variety.active.failReason, longReason.slice(0, 80));
  assert.equal(validateRpgDocument(reloaded).ok, true);

  const named = {
    ...variety,
    active: { ...variety.active, failReason: keptReason, receipt: "筆記送到了。", collegeId: undefined },
    signals: [variety.signals[2]],
  };
  named.active.caps = { ...variety.active.caps, collegeId: "engineering", discipline: "lab" };
  assert.equal(useRpg.getState().importSave(JSON.stringify({ ...base, variety: named })), true);
  const kept = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(kept.variety.active.failReason, keptReason);
  assert.equal(kept.variety.active.receipt, "筆記送到了。");
  assert.equal(kept.variety.active.caps.collegeId, "engineering");
  assert.equal(validateRpgDocument(kept).ok, true);

  const unnamed = {
    ...variety,
    active: { ...variety.active, eventId: "e".repeat(90), failReason: "線索對不上。" },
    signals: [variety.signals[2]],
  };
  assert.equal(useRpg.getState().importSave(JSON.stringify({ ...base, variety: unnamed })), true);
  const dropped = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(dropped.variety.active, null);
  assert.deepEqual(dropped.variety.resolved, ["gv-night-patrol"]);
  assert.equal(validateRpgDocument(dropped).ok, true);
});

test("an empty narrative seed still uploads the campus memory", () => {
  const memory = "還在圖書館。";
  const kept = "s".repeat(63);
  const file = (seed) =>
    JSON.stringify({
      version: 2,
      hp: 80,
      xp: 12,
      departmentId: "math",
      slots: [],
      buildings: [],
      narrative: {
        version: 1,
        seed,
        rngState: 12,
        minute: 480,
        memory: { "npc-chen-yu:last": memory },
      },
    });
  assert.equal(useRpg.getState().importSave(file("")), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.narrative.seed, "campus");
  assert.equal(saved.narrative.rngState, 12);
  assert.equal(saved.narrative.minute, 480);
  assert.equal(saved.narrative.memory["npc-chen-yu:last"], memory);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.narrative.seed, "campus");
  assert.equal(reloaded.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(reloaded).ok, true);

  assert.equal(useRpg.getState().importSave(file(kept)), true);
  const named = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(named.narrative.seed, kept);
  assert.equal(named.narrative.rngState, 12);
  assert.equal(validateRpgDocument(named).ok, true);

  assert.equal(useRpg.getState().importSave(file("t".repeat(64))), true);
  const folded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(folded.narrative.seed, "campus");
  assert.equal(folded.narrative.memory["npc-chen-yu:last"], memory);
  assert.equal(validateRpgDocument(folded).ok, true);
});

test("an old harvest cooldown still uploads the stations that are cooling", () => {
  const supply = SUPPLY_NODES[0];
  const now = Date.now();
  const live = now + 60_000;
  const harvested = {};
  for (let index = 0; index < 120; index += 1) harvested[`facility:old-${index}`] = now - 1_000;
  harvested[supply.id] = live;
  harvested["facility:station-1"] = live;
  harvested["facility:gone-station"] = live;
  harvested["facility:constructor"] = live;
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    interiorId: null,
    harvested,
    buildings: [{ id: "station-1", kind: "rest", x: 12, z: -20, rotation: 0, hp: 40 }],
  });
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(saved.harvested["facility:old-0"], undefined);
  assert.equal(saved.harvested["facility:gone-station"], live);
  assert.equal(saved.harvested["facility:constructor"], undefined);
  assert.equal(saved.harvested[supply.id], live);
  assert.equal(saved.harvested["facility:station-1"], live);
  assert.ok(Object.keys(saved.harvested).length <= 112);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.harvested[supply.id], live);
  assert.equal(reloaded.harvested["facility:station-1"], live);
  assert.equal(reloaded.harvested["facility:constructor"], undefined);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a full quarantine list still uploads the campus save", () => {
  const kept = Array.from({ length: 24 }, (_, index) => ({
    itemId: `kept-${index}`,
    quantity: 1,
  }));
  const building = { id: "station-1", kind: "rest", x: 12, z: -20, rotation: 0, hp: 40 };
  const file = {
    version: 2,
    hp: 80,
    xp: 12,
    departmentId: "math",
    slots: [{ itemId: "extra-book", quantity: 2 }],
    buildings: [building],
    quarantine: kept,
  };
  assert.equal(useRpg.getState().importSave(JSON.stringify(file)), true);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.ok(saved.quarantine.length <= 24);
  assert.equal(saved.quarantine[0].itemId, "kept-0");
  assert.equal(
    saved.quarantine.some((row) => row.itemId === "extra-book"),
    false,
  );
  assert.equal(saved.buildings[0].id, "station-1");
  assert.equal(saved.hp, 80);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);

  assert.equal(
    useRpg.getState().importSave(JSON.stringify({ ...file, quarantine: kept.slice(0, 23) })),
    true,
  );
  const withRoom = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(withRoom.quarantine.some((row) => row.itemId === "extra-book"), true);
  assert.equal(withRoom.quarantine.find((row) => row.itemId === "extra-book").quantity, 2);
  assert.ok(withRoom.quarantine.length <= 24);
  assert.equal(validateRpgDocument(withRoom).ok, true);

  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    quarantine: [...kept, { itemId: "extra-book", quantity: 2 }],
    buildings: [building],
  });
  useRpg.getState().keepProgress();
  const folded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(folded.quarantine.length, 24);
  assert.equal(folded.quarantine[0].itemId, "kept-0");
  assert.equal(folded.quarantine.some((row) => row.itemId === "extra-book"), false);
  assert.equal(folded.buildings[0].id, "station-1");
  const foldedCheck = validateRpgDocument(folded);
  assert.equal(foldedCheck.ok, true, foldedCheck.ok ? "" : foldedCheck.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(folded)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.quarantine.length, 24);
  assert.equal(reloaded.hp, 80);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a crowded ground pile still uploads every item", () => {
  const ids = [
    "notes",
    "parts",
    "coffee",
    "tea",
    "credit",
    "badge",
    "copper",
    "glass",
    "cloth",
    "herb",
    "ink",
    "chalk",
    "resin",
    "mint",
    "bandage",
    "lamp-oil",
    "field-lamp",
  ];
  const items = Object.fromEntries(ids.map((id) => [id, id === "notes" ? 2 : 1]));
  const building = { id: "station-1", kind: "rest", x: 12, z: -20, rotation: 0, hp: 40 };
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    buildings: [building],
    loot: [{ id: "pile-wide", x: 12, z: 18, items, quest: { notes: 1 } }],
  });
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.ok(saved.loot.every((pile) => Object.keys(pile.items).length <= 16));
  const kept = {};
  for (const pile of saved.loot) {
    for (const [id, count] of Object.entries(pile.items)) kept[id] = (kept[id] ?? 0) + count;
  }
  assert.equal(kept.notes, 2);
  assert.equal(kept["field-lamp"], 1);
  assert.equal(kept.copper, 1);
  assert.equal(saved.loot.find((pile) => pile.items.notes).quest.notes, 1);
  assert.equal(saved.loot.find((pile) => pile.items.notes).id, "pile-wide");
  assert.equal(saved.buildings[0].id, "station-1");
  assert.equal(saved.hp, 80);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const again = {};
  for (const pile of reloaded.loot) {
    for (const [id, count] of Object.entries(pile.items)) again[id] = (again[id] ?? 0) + count;
  }
  assert.equal(again.notes, 2);
  assert.equal(again["field-lamp"], 1);
  assert.equal(reloaded.loot.find((pile) => pile.items.notes).quest.notes, 1);
  assert.equal(validateRpgDocument(reloaded).ok, true);

  const narrow = Object.fromEntries(ids.slice(0, 16).map((id) => [id, 1]));
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    buildings: [building],
    loot: [{ id: "pile-fit", x: 4, z: 8, items: narrow }],
  });
  useRpg.getState().keepProgress();
  const fitted = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(fitted.loot.length, 1);
  assert.equal(fitted.loot[0].id, "pile-fit");
  assert.equal(Object.keys(fitted.loot[0].items).length, 16);
  assert.equal(validateRpgDocument(fitted).ok, true);
});

test("a full ground still keeps a variety overflow on the pile already there", () => {
  const fillers = [
    "parts",
    "coffee",
    "tea",
    "credit",
    "badge",
    "copper",
    "glass",
    "cloth",
    "herb",
    "ink",
    "chalk",
    "resin",
    "mint",
    "bandage",
    "lamp-oil",
    "field-lamp",
    "survey-lens",
    "repair-wrench",
    "gather-hook",
    "focus-charm",
    "stride-wrap",
    "ward-pin",
    "field-pack",
    "research-satchel",
  ];
  inventory.clear();
  for (const id of fillers) inventory.add(id, 1);
  assert.equal(inventory.isFull(), true);
  const building = { id: "station-1", kind: "rest", x: 12, z: -20, rotation: 0, hp: 40 };
  const loot = [{ id: "pile-feet", x: 12, z: 18, items: { notes: 1 } }];
  for (let index = 1; index < 100; index += 1) {
    loot.push({ id: `pile-${index}`, x: 40 + index, z: 8, items: { parts: 1 } });
  }
  useGame.setState({ playerX: 12, playerZ: 18, phase: "playing" });
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    claimed: [],
    discoveries: [],
    buildings: [building],
    loot,
  });
  const memory = emptyMemory();
  memory.active = {
    eventId: "gv-night-patrol",
    phase: "success",
    route: "peace",
    board: null,
    failReason: null,
    receipt: "筆記送到了。",
    tutorial: true,
    caps: { equipped: false, skillRank: 1, built: 0, collegeId: null, discipline: null },
  };
  replaceMemory(memory);
  const paid = claimVariety();
  assert.equal(paid.paid, true);
  assert.equal(paid.notes, 4);
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.ok(saved.loot.length <= 100);
  assert.equal(saved.loot.find((pile) => pile.id === "pile-feet").items.notes, 5);
  assert.equal(saved.buildings[0].id, "station-1");
  assert.equal(saved.hp, 80);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.equal(reloaded.loot.find((pile) => pile.id === "pile-feet").items.notes, 5);
  assert.equal(reloaded.loot.length <= 100, true);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});

test("a full ground still keeps every kind when one pile must split", () => {
  const ids = [
    "notes",
    "parts",
    "coffee",
    "tea",
    "credit",
    "badge",
    "copper",
    "glass",
    "cloth",
    "herb",
    "ink",
    "chalk",
    "resin",
    "mint",
    "bandage",
    "lamp-oil",
    "field-lamp",
  ];
  const items = Object.fromEntries(ids.map((id) => [id, 1]));
  const building = { id: "station-1", kind: "rest", x: 12, z: -20, rotation: 0, hp: 40 };
  const loot = [];
  for (let index = 0; index < 99; index += 1) {
    loot.push({
      id: `pile-${index}`,
      x: 40 + (index % 40),
      z: 8 + Math.floor(index / 40),
      items: { notes: 1 },
    });
  }
  loot.push({ id: "pile-wide", x: 12, z: 18, items, quest: { notes: 1, "field-lamp": 1 } });
  useRpg.setState({
    freshStart: false,
    hp: 80,
    departmentId: "math",
    buildings: [building],
    loot,
  });
  replaceMemory(emptyMemory());
  useRpg.getState().keepProgress();
  const saved = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  assert.ok(saved.loot.length <= 100);
  assert.ok(saved.loot.every((pile) => Object.keys(pile.items).length <= 16));
  const kept = {};
  for (const pile of saved.loot) {
    for (const [id, count] of Object.entries(pile.items)) kept[id] = (kept[id] ?? 0) + count;
  }
  assert.equal(kept.notes, 100);
  assert.equal(kept["field-lamp"], 1);
  assert.equal(kept.copper, 1);
  const lamp = saved.loot.find((pile) => pile.items["field-lamp"]);
  assert.equal(lamp.x, 12);
  assert.equal(lamp.z, 18);
  assert.equal(lamp.quest["field-lamp"], 1);
  assert.equal(saved.loot.find((pile) => pile.id === "pile-wide").quest.notes, 1);
  assert.equal(saved.buildings[0].id, "station-1");
  assert.equal(saved.hp, 80);
  const checked = validateRpgDocument(saved);
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
  assert.equal(useRpg.getState().importSave(JSON.stringify(saved)), true);
  const reloaded = JSON.parse(localStorage.getItem(RPG_SAVE_KEY));
  const again = {};
  for (const pile of reloaded.loot) {
    for (const [id, count] of Object.entries(pile.items)) again[id] = (again[id] ?? 0) + count;
  }
  assert.equal(again.notes, 100);
  assert.equal(again["field-lamp"], 1);
  assert.equal(reloaded.loot.find((pile) => pile.items["field-lamp"]).quest["field-lamp"], 1);
  assert.equal(validateRpgDocument(reloaded).ok, true);
});
