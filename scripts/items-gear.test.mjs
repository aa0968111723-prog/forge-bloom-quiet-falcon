/**
 * Items, equipment, crafting, and placement.
 * Store cases use the same harness as the adventure runtime.
 */
import assert from "node:assert/strict";
import test from "node:test";

const savedData = new Map();
globalThis.localStorage = {
  getItem: (key) => savedData.get(key) ?? null,
  setItem: (key, value) => savedData.set(key, String(value)),
  removeItem: (key) => savedData.delete(key),
};
globalThis.document = {
  hidden: false,
  pointerLockElement: null,
  addEventListener() {},
  removeEventListener() {},
};
const windowHandlers = {};
globalThis.window = {
  addEventListener(name, fn) {
    windowHandlers[name] = fn;
  },
  removeEventListener() {},
  location: { search: "" },
};

const { ITEM_FACTS, EXTRA_RECIPES, factOf } = await import(
  "../src/features/items-equipment-building/catalog.ts"
);
const { gearBonus, ensureInstance, readLoadout, readGear, readQuarantineGear, mergeQuarantineGear } = await import(
  "../src/features/items-equipment-building/gear.ts"
);
const { planCraft } = await import("../src/features/items-equipment-building/craft.ts");
const { keepOut } = await import("../src/features/items-equipment-building/keepout.ts");
const { takeCost, refundOf } = await import("../src/features/items-equipment-building/commit.ts");
const { meshBudget, MESH_PARTS, coverBonus } = await import(
  "../src/features/items-equipment-building/facilities.ts"
);
const { validateRpgDocument, MAX_SLOTS } = await import("../src/features/cloud-save/contract.ts");
const { SPAWN } = await import("../src/game/world-data/landmarks.ts");
const runtime = await import("../work/test-runtime/runtime.mjs");

const { useRpg, useGame, inventory, RECIPES, ITEMS, DEPARTMENTS, validatePlacement, flushSave, promptDecision, promptSnap } = runtime;

function reset() {
  inventory.clear();
  useRpg.setState({
    departmentId: DEPARTMENTS[0].id,
    hp: 100,
    focus: 80,
    xp: 0,
    equipped: false,
    loadout: { tool: null, accessory: null, pack: null },
    gear: [],
    quarantine: [],
    quarantineGear: [],
    heldBuild: null,
    pockets: 0,
    buildings: [],
    loot: [],
    harvested: {},
    claimed: [],
    discoveries: [],
    panel: null,
    interiorId: null,
    buildKind: null,
    built: 0,
  });
  useGame.setState({ phase: "playing", plaqueId: null, playerX: 40, playerZ: -40, playerYaw: 0 });
}

test("catalog has distinct items, equipment, and buildings", () => {
  assert.ok(ITEM_FACTS.length >= 24);
  assert.ok(ITEM_FACTS.filter((fact) => fact.slot).length >= 12);
  assert.ok(RECIPES.length >= 8);
  const icons = ITEM_FACTS.map((fact) => fact.icon);
  assert.equal(new Set(icons).size, icons.length);
  const ids = ITEM_FACTS.map((fact) => fact.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const fact of ITEM_FACTS) {
    assert.ok(fact.source && fact.use && fact.effect);
    assert.ok(fact.maxStack >= 1);
    assert.ok(fact.weight >= 0);
  }
  for (const recipe of EXTRA_RECIPES) assert.ok(recipe.use && recipe.width > 0);
  const shapes = new Set(RECIPES.map((recipe) => `${recipe.width}x${recipe.depth}x${recipe.name}`));
  assert.equal(shapes.size, RECIPES.length);
});

test("bonuses are computed once and the badge attack stays outside them", () => {
  const loadout = { tool: "field-lamp", accessory: "badge", pack: "field-pack" };
  const gear = ensureInstance([], "field-lamp", "plain");
  const again = ensureInstance(gear, "field-lamp", "fine");
  assert.equal(again.length, 1);
  const owned = (id) => ["field-lamp", "badge", "field-pack"].includes(id);
  const first = gearBonus(loadout, gear, owned);
  const second = gearBonus(loadout, gear, owned);
  assert.deepEqual(first, second);
  assert.equal(first.attack, 0);
  assert.equal(first.light, 12);
  assert.equal(first.carry, 80 + 48);
  const empty = gearBonus({ tool: null, accessory: null, pack: null }, [], () => false);
  assert.equal(empty.moveScale, 1);
  assert.equal(empty.attack, 0);
  assert.equal(empty.light, 0);
});

test("old equipped boolean maps onto the accessory slot without wiping unknown gear", () => {
  const withBadge = readLoadout({
    equipped: true,
    loadout: undefined,
    slots: [{ itemId: "badge", quantity: 1 }],
  });
  assert.equal(withBadge.equipped, true);
  assert.equal(withBadge.loadout.accessory, "badge");
  const missing = readLoadout({
    equipped: true,
    loadout: undefined,
    slots: [{ itemId: "notes", quantity: 1 }],
  });
  assert.equal(missing.equipped, false);
  assert.equal(missing.loadout.accessory, null);
  const kept = readLoadout({
    equipped: false,
    loadout: { tool: "field-lamp", accessory: "badge", pack: null },
    slots: [
      { itemId: "field-lamp", quantity: 1 },
      { itemId: "badge", quantity: 1 },
    ],
  });
  assert.equal(kept.equipped, true);
  assert.equal(kept.loadout.tool, "field-lamp");
  const gear = readGear([
    { id: "gear-field-lamp", itemId: "field-lamp", durability: 10, quality: "plain" },
    { id: "gear-field-lamp", itemId: "field-lamp", durability: 80, quality: "plain" },
    { id: "odd", itemId: "not-a-tool", durability: 1, quality: "plain" },
  ]);
  assert.equal(gear.gear.length, 1);
  assert.equal(gear.gear[0].durability, 10);
  assert.equal(gear.dropped.length, 1);
  assert.equal(gear.dropped[0].itemId, "not-a-tool");
});

test("payment rolls back, refunds half, and rejects bad quantities", () => {
  const slots = [
    { itemId: "notes", quantity: 4 },
    { itemId: "parts", quantity: 2 },
  ];
  const bag = {
    slots: () => slots.map((slot) => ({ ...slot })),
    remove(id, quantity = 1) {
      const slot = slots.find((entry) => entry.itemId === id);
      if (!slot || slot.quantity < quantity) return false;
      slot.quantity -= quantity;
      return true;
    },
    clear() {
      slots.splice(0, slots.length);
    },
    add(id, quantity = 1) {
      const slot = slots.find((entry) => entry.itemId === id);
      if (slot) slot.quantity += quantity;
      else slots.push({ itemId: id, quantity });
      return { added: quantity };
    },
  };
  const failed = takeCost(bag, { notes: 1, parts: 9 });
  assert.equal(failed.ok, false);
  assert.equal(bag.slots().find((slot) => slot.itemId === "notes").quantity, 4);
  assert.equal(bag.slots().find((slot) => slot.itemId === "parts").quantity, 2);
  const negative = takeCost(bag, { notes: -1 });
  assert.equal(negative.ok, false);
  assert.equal(bag.slots().find((slot) => slot.itemId === "notes").quantity, 4);
  const zero = takeCost(bag, { notes: 0 });
  assert.equal(zero.ok, false);
  const paid = takeCost(bag, { notes: 2 });
  assert.equal(paid.ok, true);
  paid.undo();
  assert.equal(bag.slots().find((slot) => slot.itemId === "notes").quantity, 4);
  assert.deepEqual(refundOf({ notes: 5, parts: 1, copper: 2 }), { notes: 2, copper: 1 });
});

test("keep-out uses the body radius on roads, gates, spawns, and rescue", () => {
  assert.equal(keepOut(SPAWN.x, SPAWN.z, 1, 1), "這會擋住救援位置");
  assert.equal(keepOut(60, 65, 2, 2), "這會堵住校門");
  assert.equal(keepOut(50, -24, 2, 2), "這會堵住主路");
  assert.equal(keepOut(5, -104, 1.2, 1.2), "這會擋住任務出生點");
  assert.equal(keepOut(45, -32, 2.6, 1.6), null);
});

test("mesh budget is structural and drops when a building is removed", () => {
  const full = Array.from({ length: 48 }, (_, index) => ({ kind: RECIPES[index % RECIPES.length].id }));
  const capped = meshBudget(full);
  assert.ok(capped > 48);
  assert.equal(meshBudget(full.slice(0, -1)), capped - MESH_PARTS[full.at(-1).kind]);
  assert.equal(meshBudget([]), 0);
});

test("the live bag can craft, equip, place, demolish, and reload one loop", () => {
  reset();
  for (const [id, count] of [
    ["notes", 20],
    ["parts", 20],
    ["copper", 4],
    ["recipe-lamp", 1],
    ["ridge-page", 1],
  ])
    assert.equal(inventory.add(id, count).overflow, 0, id);
  let spot = null;
  for (let x = 20; x <= 160 && !spot; x += 5)
    for (let z = -15; z >= -120 && !spot; z -= 5)
      if (validatePlacement("research", x, z, 0, [], { x: x + 8, z }) == null) spot = { x, z };
  assert.ok(spot);
  useGame.setState({ playerX: spot.x + 8, playerZ: spot.z });
  useRpg.getState().chooseBuild("research");
  assert.equal(useRpg.getState().place(spot.x, spot.z), true);
  assert.equal(useRpg.getState().place(spot.x, spot.z), false);
  const built = useRpg.getState().buildings.length;
  useGame.setState({ playerX: spot.x + 30, playerZ: spot.z });
  const before = inventory.count("notes");
  assert.equal(useRpg.getState().craft("field-lamp"), false);
  assert.equal(inventory.count("notes"), before);
  useGame.setState({ playerX: spot.x + 2, playerZ: spot.z });
  assert.equal(useRpg.getState().craft("field-lamp"), true);
  assert.ok(inventory.count("notes") < before);
  assert.equal(useRpg.getState().craft("field-lamp"), false);
  assert.equal(inventory.count("field-lamp"), 1);
  useRpg.getState().equipItem("field-lamp");
  const worn = gearBonus(useRpg.getState().loadout, useRpg.getState().gear, (id) => inventory.count(id) > 0);
  assert.equal(worn.light, 12);
  useRpg.getState().equipItem("field-lamp");
  assert.equal(useRpg.getState().loadout.tool, null);
  useRpg.getState().equipItem("field-lamp");
  const building = useRpg.getState().buildings[0];
  assert.equal(useRpg.getState().beginMove(building.id), true);
  useRpg.setState({ freshStart: false });
  flushSave();
  const moved = JSON.parse(localStorage.getItem("tamkang-rpg-v2"));
  assert.equal(moved.heldBuild.id, building.id);
  assert.equal(moved.buildings.some((row) => row.id === building.id), false);
  assert.equal(useRpg.getState().importSave(localStorage.getItem("tamkang-rpg-v2")), true);
  assert.equal(useRpg.getState().heldBuild, null);
  assert.ok(useRpg.getState().buildings.some((row) => row.id === building.id));
  const parts = inventory.count("parts");
  useRpg.getState().demolish(building.id);
  assert.equal(useRpg.getState().buildings.length, built - 1);
  assert.ok(inventory.count("parts") > parts || useRpg.getState().loot.some((pile) => pile.items.parts));
  const text = JSON.stringify({
    ...JSON.parse(JSON.stringify({
      version: 2,
      hp: 90,
      slots: inventory.slots(),
      buildings: useRpg.getState().buildings,
      equipped: useRpg.getState().equipped,
      loadout: useRpg.getState().loadout,
      gear: useRpg.getState().gear,
    })),
  });
  assert.equal(useRpg.getState().importSave(text), true);
  assert.equal(useRpg.getState().loadout.tool, "field-lamp");
  assert.equal(
    gearBonus(useRpg.getState().loadout, useRpg.getState().gear, (id) => inventory.count(id) > 0).light,
    worn.light,
  );
});

test("failed use, full bag, unknown id, blocked entrance, and old save stay safe", () => {
  reset();
  useRpg.setState({ hp: 100, focus: 100 });
  inventory.add("bandage", 1);
  inventory.add("mint", 1);
  inventory.add("lamp-oil", 1);
  useRpg.getState().useItem("bandage");
  useRpg.getState().useItem("mint");
  useRpg.getState().useItem("lamp-oil");
  assert.equal(inventory.count("bandage"), 1);
  assert.equal(inventory.count("mint"), 1);
  assert.equal(inventory.count("lamp-oil"), 1);
  inventory.clear();
  useRpg.setState({ kills: 3, claimed: [] });
  assert.equal(inventory.add("parts", 99 * 24 + 1).overflow > 0, true);
  const full = inventory.count("parts");
  useRpg.getState().claim("first");
  assert.equal(inventory.count("parts"), full);
  assert.equal(useRpg.getState().importSave(JSON.stringify({
    version: 2,
    hp: 80,
    slots: [
      { itemId: "notes", quantity: 2 },
      { itemId: "unknown-relic", quantity: 3 },
      { itemId: "coffee", quantity: 0 },
      { itemId: "parts", quantity: -1 },
    ],
    buildings: [],
  })), false);
  assert.equal(useRpg.getState().importSave(JSON.stringify({
    version: 2,
    hp: 80,
    equipped: true,
    slots: [
      { itemId: "notes", quantity: 2 },
      { itemId: "unknown-relic", quantity: 3 },
    ],
    buildings: [],
  })), true);
  assert.equal(inventory.slots().some((slot) => slot.itemId === "unknown-relic"), false);
  assert.equal(inventory.count("notes"), 2);
  assert.ok(useRpg.getState().quarantine.some((row) => row.itemId === "unknown-relic"));
  assert.equal(useRpg.getState().equipped, false);
  const wornTool = useRpg.getState().loadout.tool;
  windowHandlers.storage?.({ key: "tamkang-rpg-v2", newValue: "{\"version\":2,\"hp\":10,\"slots\":[],\"buildings\":[],\"loadout\":{\"tool\":\"ward-pin\"}}" });
  assert.equal(useRpg.getState().saveConflict, true);
  assert.equal(useRpg.getState().loadout.tool, wornTool);
  assert.equal(factOf("ridge-page").locked, true);
  inventory.add("ridge-page", 1);
  assert.equal(useRpg.getState().discardItem("ridge-page"), false);
  assert.equal(inventory.count("ridge-page"), 1);
  const blocked = validatePlacement("desk", 50, -24, 0, [], { x: 80, z: -24 });
  assert.equal(blocked, "這會堵住主路");
  const plan = planCraft({
    id: "field-lamp",
    quality: "plain",
    count: () => 0,
    loadout: { tool: null, accessory: null, pack: null },
    nearResearch: false,
    nearSupply: false,
  });
  assert.equal(plan.ok, false);
  flushSave();
});

test("a facility does not hide its own prompt, and quarantined gear survives another load", () => {
  const kept = mergeQuarantineGear(
    readQuarantineGear([{ id: "gear-lost", itemId: "unknown-relic", durability: 4, quality: "plain" }]),
    readGear([]).dropped,
  );
  assert.equal(kept[0].itemId, "unknown-relic");
  reset();
  let supply = null;
  for (let x = 20; x <= 160 && !supply; x += 5) {
    for (let z = -15; z >= -120 && !supply; z -= 5) {
      useGame.setState({ phase: "playing", plaqueId: null, playerX: x, playerZ: z + 2, playerYaw: 0 });
      useRpg.setState({
        buildings: [{ id: "supply-self", kind: "supply", x, z, rotation: 0, hp: 140 }],
        loot: [],
        panel: null,
        interiorId: null,
        buildKind: null,
        harvested: {},
      });
      const choice = promptDecision(promptSnap());
      if (choice?.kind === "facility" && choice.targetId === "supply-self") supply = { x, z };
    }
  }
  assert.ok(supply);
  useRpg.setState({
    buildings: [
      { id: "supply-self", kind: "supply", x: supply.x, z: supply.z, rotation: 0, hp: 140 },
      { id: "wall", kind: "desk", x: supply.x, z: supply.z + 1, rotation: 0, hp: 180 },
    ],
  });
  assert.notEqual(promptDecision(promptSnap())?.targetId, "supply-self");
  const text = JSON.stringify({
    version: 2,
    hp: 80,
    slots: [{ itemId: "notes", quantity: 1 }],
    buildings: [],
    gear: [],
    quarantineGear: [{ id: "gear-lost", itemId: "unknown-relic", durability: 4, quality: "plain" }],
  });
  assert.equal(useRpg.getState().importSave(text), true);
  assert.equal(useRpg.getState().quarantineGear[0].itemId, "unknown-relic");
  useRpg.setState({ freshStart: false });
  flushSave();
  assert.equal(useRpg.getState().importSave(localStorage.getItem("tamkang-rpg-v2")), true);
  assert.equal(useRpg.getState().quarantineGear.some((row) => row.itemId === "unknown-relic"), true);
});

test("an equipped wrench repairs the damaged facility from the prompt", () => {
  reset();
  inventory.add("repair-wrench", 1);
  inventory.add("parts", 4);
  let spot = null;
  for (let x = 20; x <= 160 && !spot; x += 5) {
    for (let z = -15; z >= -120 && !spot; z -= 5) {
      useGame.setState({ phase: "playing", plaqueId: null, playerX: x, playerZ: z + 2, playerYaw: 0 });
      useRpg.setState({
        loadout: { tool: "repair-wrench", accessory: null, pack: null },
        gear: [{ id: "gear-repair-wrench", itemId: "repair-wrench", durability: 48, quality: "plain" }],
        buildings: [{ id: "hurt-desk", kind: "desk", x, z, rotation: 0, hp: 40 }],
        loot: [],
        panel: null,
        interiorId: null,
        buildKind: null,
      });
      const choice = promptDecision(promptSnap());
      if (choice?.kind === "repair" && choice.targetId === "hurt-desk") spot = { x, z };
    }
  }
  assert.ok(spot);
  assert.equal(useRpg.getState().commitPrompt(), "repair");
  assert.ok(useRpg.getState().buildings.find((building) => building.id === "hurt-desk").hp > 40);
  assert.ok(useRpg.getState().gear.find((row) => row.itemId === "repair-wrench").durability < 48);
  useGame.setState({ playerX: spot.x, playerZ: spot.z + 2 });
  useRpg.setState({
    buildings: [{ id: "research-1", kind: "research", x: spot.x, z: spot.z, rotation: 0, hp: 160 }],
  });
  assert.equal(useRpg.getState().serviceWrench(), true);
});

test("the same bag grows by a worn pack or sewn pockets, and cover stacks once", () => {
  reset();
  const stuffed = inventory.add("parts", 99 * 24 + 1);
  assert.ok(stuffed.overflow > 0);
  assert.equal(inventory.slots().length, 24);
  inventory.clear();
  inventory.add("field-pack", 1);
  useRpg.setState({ loadout: { tool: null, accessory: null, pack: "field-pack" }, pockets: 0 });
  const wider = inventory.add("parts", 99 * 28 + 1);
  assert.equal(inventory.slots().length, 28);
  assert.ok(wider.overflow > 0);
  const before = inventory.count("parts");
  useRpg.setState({ loadout: { tool: null, accessory: null, pack: null } });
  assert.equal(inventory.slots().length, 28);
  assert.equal(inventory.count("parts"), before);
  assert.equal(inventory.add("notes", 1).added, 0);
  inventory.clear();
  inventory.add("cloth", 4);
  useRpg.setState({
    buildings: [{ id: "sup", kind: "supply", x: 40, z: -40, rotation: 0, hp: 140 }],
    pockets: 0,
  });
  useGame.setState({ playerX: 40, playerZ: -40 });
  assert.equal(useRpg.getState().sewPocket(), true);
  assert.equal(useRpg.getState().pockets, 4);
  assert.equal(inventory.count("cloth"), 2);
  assert.equal(useRpg.getState().sewPocket(), true);
  assert.equal(useRpg.getState().pockets, 8);
  assert.equal(inventory.count("cloth"), 0);
  assert.equal(useRpg.getState().sewPocket(), false);
  assert.equal(inventory.count("cloth"), 0);
  assert.equal(coverBonus([], 0, 0), 0);
  assert.equal(coverBonus([{ kind: "barrier", x: 0, z: 0, hp: 280 }], 1, 0), 4);
  assert.equal(coverBonus([{ kind: "barrier", x: 0, z: 0, hp: 40 }], 1, 0), 2);
  assert.equal(coverBonus([{ kind: "barrier", x: 0, z: 0, hp: 280 }], 10, 0), 0);
  const slots = Array.from({ length: 30 }, () => ({ itemId: "notes", quantity: 1 }));
  assert.equal(validateRpgDocument({ version: 2, hp: 10, slots, buildings: [] }).ok, true);
  assert.equal(
    validateRpgDocument({
      version: 2,
      hp: 10,
      slots: Array.from({ length: MAX_SLOTS + 1 }, () => ({ itemId: "notes", quantity: 1 })),
      buildings: [],
    }).ok,
    false,
  );
  reset();
});
