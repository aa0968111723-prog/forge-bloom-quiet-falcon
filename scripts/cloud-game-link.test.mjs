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
