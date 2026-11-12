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
