import assert from "node:assert/strict";
import test from "node:test";

import { DEPARTMENTS as CATALOG } from "../src/game/departments.ts";
import { DEPARTMENTS as RPG } from "../src/game/rpg/data.ts";
import { validateRpgDocument } from "../src/features/cloud-save/contract.ts";
import { abilityQuery, resolveDepartment } from "../src/game/contracts/departments.ts";
import { readV2Progress } from "../src/game/rpg/growth/progress.ts";
import {
  CAMPUS_ERRAND_ID,
  COMBAT_MISSION_ID,
  ERRAND_NOTES,
  ERRAND_XP,
  GATE_QUEST_ID,
  errandReward,
  semesterPhase,
  stampSemester,
} from "../src/game/contracts/semester.ts";

test("the two department catalogs resolve to one rpg id", () => {
  const chem = RPG.find((row) => row.name === "化學學系");
  const math = RPG.find((row) => row.name === "應用數學與數據科學學系");
  const civil = RPG.find((row) => row.name === "土木工程學系");
  assert.ok(chem && math && civil);
  assert.equal(CATALOG.some((row) => row.id === "chemistry"), true);

  const chemLink = resolveDepartment(chem.id);
  assert.equal(chemLink?.catalogId, "chemistry");
  assert.equal(chemLink?.collegeId, "science");
  assert.equal(chemLink?.discipline, "science");
  assert.equal(chemLink?.canonicalId, chem.id);
  assert.equal(resolveDepartment("chemistry")?.rpgId, chem.id);
  assert.equal(resolveDepartment("化學系")?.canonicalId, chem.id);
  assert.equal(readV2Progress({ version: 2, departmentId: chem.id }).catalogDepartmentId, "chemistry");

  const mathLink = resolveDepartment(math.id);
  assert.equal(mathLink?.catalogId, "math");
  assert.equal(abilityQuery(math.id)?.modifiers.examAttackBonus, abilityQuery("math")?.modifiers.examAttackBonus);
  assert.ok((abilityQuery("civil")?.modifiers.inventoryCapacityBonus ?? 0) > 0);

  const civilLink = resolveDepartment("civil");
  assert.equal(civilLink?.rpgId, civil.id);
  assert.equal(civilLink?.canonicalId, civil.id);
  assert.equal(resolveDepartment("not-a-major"), null);
  assert.equal(resolveDepartment("med-info")?.catalogId, "med-info");
  assert.equal(resolveDepartment("med-info")?.rpgId, null);
});

test("semester advances only after the gate quest and the campus errand", () => {
  assert.equal(semesterPhase([]), "week-1");
  assert.equal(semesterPhase([GATE_QUEST_ID]), "week-1");
  assert.equal(semesterPhase([COMBAT_MISSION_ID, GATE_QUEST_ID]), "week-1");
  assert.equal(semesterPhase([COMBAT_MISSION_ID, CAMPUS_ERRAND_ID]), "week-1");
  assert.equal(semesterPhase([GATE_QUEST_ID, CAMPUS_ERRAND_ID]), "midterm");
  assert.equal(
    semesterPhase([GATE_QUEST_ID, CAMPUS_ERRAND_ID, COMBAT_MISSION_ID]),
    "finals",
  );
  assert.equal(errandReward([]), null);
  assert.deepEqual(errandReward([GATE_QUEST_ID]), {
    id: CAMPUS_ERRAND_ID,
    xp: ERRAND_XP,
    notes: ERRAND_NOTES,
  });
  assert.equal(errandReward([GATE_QUEST_ID, CAMPUS_ERRAND_ID]), null);
  const session = { semester: "week-1" };
  assert.equal(stampSemester(session, [GATE_QUEST_ID]), session);
  const stamped = stampSemester(session, [GATE_QUEST_ID, CAMPUS_ERRAND_ID]);
  assert.equal(stamped.semester, "midterm");
  assert.notEqual(stamped, session);
  assert.equal(stampSemester(stamped, [GATE_QUEST_ID, CAMPUS_ERRAND_ID]), stamped);
});

test("a supply pickup settles the errand once on the live save", async () => {
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
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    location: { search: "" },
  };
  const runtime = await import("../work/test-runtime/runtime.mjs");
  const { useRpg, useGame, inventory, SUPPLY_NODES } = runtime;
  const node = SUPPLY_NODES[0];
  const other = SUPPLY_NODES[1];
  const third = SUPPLY_NODES[2];
  assert.ok(node && other && third);

  const stand = (site) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: site.x,
      playerZ: site.z,
      playerYaw: 0,
    });
  };
  useRpg.setState({
    hp: 100,
    xp: 20,
    claimed: [GATE_QUEST_ID],
    harvested: {},
    loot: [],
    interiorId: null,
    panel: null,
    buildKind: null,
    buildings: [],
    narrative: { ...useRpg.getState().narrative, semester: "week-1" },
  });
  const notesBefore = inventory.count("notes");
  stand(node);
  assert.equal(useRpg.getState().commitPrompt(), "supply");
  const after = useRpg.getState();
  assert.equal(after.claimed.includes(CAMPUS_ERRAND_ID), true);
  assert.equal(after.xp, 20 + ERRAND_XP);
  assert.equal(after.narrative.semester, "midterm");
  assert.equal(inventory.count("notes"), notesBefore + ERRAND_NOTES + (node.items.notes ?? 0));

  stand(other);
  assert.equal(useRpg.getState().commitPrompt(), "supply");
  assert.equal(useRpg.getState().xp, 20 + ERRAND_XP);
  assert.equal(useRpg.getState().claimed.filter((id) => id === CAMPUS_ERRAND_ID).length, 1);

  useRpg.setState({
    claimed: [],
    xp: 20,
    harvested: {},
    narrative: { ...useRpg.getState().narrative, semester: "finals" },
  });
  stand(third);
  assert.equal(useRpg.getState().commitPrompt(), "supply");
  assert.equal(useRpg.getState().claimed.includes(CAMPUS_ERRAND_ID), false);
  assert.equal(useRpg.getState().xp, 20);
  assert.equal(useRpg.getState().narrative.semester, "week-1");

  const { validatePlacement } = runtime;
  const player = { x: 0, z: 40 };
  stand(player);
  useRpg.setState({
    departmentId: "science-理學院-2",
    claimed: [GATE_QUEST_ID],
    xp: 20,
    buildings: [],
    interiorId: null,
    panel: null,
    buildKind: null,
    equipped: false,
    narrative: { ...useRpg.getState().narrative, semester: "finals" },
  });
  if (inventory.count("notes") < 8) inventory.add("notes", 8);
  if (inventory.count("parts") < 8) inventory.add("parts", 8);
  const notesAtPlace = inventory.count("notes");
  const partsAtPlace = inventory.count("parts");

  useRpg.getState().chooseBuild("lantern");
  assert.equal(useRpg.getState().buildKind, "lantern");
  assert.equal(useRpg.getState().place(player.x, player.z), false);
  assert.equal(useRpg.getState().claimed.includes(CAMPUS_ERRAND_ID), false);
  assert.equal(useRpg.getState().xp, 20);
  assert.equal(useRpg.getState().buildings.length, 0);
  useRpg.getState().cancelBuild();
  assert.equal(useRpg.getState().buildKind, null);
  assert.equal(useRpg.getState().claimed.includes(CAMPUS_ERRAND_ID), false);

  let legal = null;
  for (let x = -80; x <= 80 && !legal; x += 8) {
    for (let z = -80; z <= 40 && !legal; z += 8) {
      if (validatePlacement("lantern", x, z, 0, [], player) == null) legal = { x, z };
    }
  }
  assert.ok(legal);
  useRpg.getState().chooseBuild("lantern");
  assert.equal(useRpg.getState().buildKind, "lantern");
  assert.equal(useRpg.getState().place(legal.x, legal.z), true);
  const placed = useRpg.getState();
  assert.equal(placed.buildings.length, 1);
  assert.equal(placed.buildings[0].kind, "lantern");
  assert.equal(placed.claimed.filter((id) => id === CAMPUS_ERRAND_ID).length, 1);
  assert.equal(placed.xp, 20 + ERRAND_XP);
  assert.equal(placed.narrative.semester, "midterm");
  assert.equal(inventory.count("notes"), notesAtPlace - 3 + ERRAND_NOTES);
  assert.equal(inventory.count("parts"), partsAtPlace - 3);

  assert.equal(useRpg.getState().place(legal.x, legal.z), false);
  assert.equal(useRpg.getState().xp, 20 + ERRAND_XP);
  assert.equal(useRpg.getState().buildings.length, 1);

  if (inventory.count("badge") < 1) inventory.add("badge", 1);
  useRpg.getState().equip();
  assert.equal(useRpg.getState().equipped, true);
  assert.equal(useRpg.getState().loadout.accessory, "badge");
  useRpg.getState().equip();
  assert.equal(useRpg.getState().equipped, false);
  assert.equal(useRpg.getState().loadout.accessory, null);
  assert.equal(useRpg.getState().claimed.filter((id) => id === CAMPUS_ERRAND_ID).length, 1);
});

test("cloud saves accept the gear fields and reject a slot outside the whitelist", () => {
  const base = {
    version: 2,
    hp: 100,
    slots: [{ itemId: "notes", quantity: 1 }],
    buildings: [],
  };
  const accepted = validateRpgDocument({
    ...base,
    loadout: { tool: "repair-wrench", accessory: "badge", pack: null },
    gear: [{ id: "gear-wrench-1", itemId: "repair-wrench", durability: 48, quality: "plain" }],
    quarantine: [{ itemId: "unknown-coil", quantity: 2 }],
    quarantineGear: [],
    heldBuild: null,
  });
  assert.equal(accepted.ok, true);
  const oldSave = validateRpgDocument(base);
  assert.equal(oldSave.ok, true);
  const extra = validateRpgDocument({
    ...base,
    loadout: { tool: null, accessory: null, pack: null, script: "nope" },
  });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.code, "unsafe_content");
});
