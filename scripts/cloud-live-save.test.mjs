import assert from "node:assert/strict";
import test from "node:test";

import { MAX_DOCUMENT_KEYS, validateRpgDocument } from "../src/features/cloud-save/contract.ts";
import { emptyFelled, emptyGathered } from "../src/game/rpg/data.ts";

const base = {
  version: 2,
  hp: 100,
  slots: [{ itemId: "notes", quantity: 1 }],
  buildings: [],
};

test("a current campus snapshot passes the cloud contract", () => {
  const flags = Object.fromEntries(
    Array.from({ length: 50 }, (_, i) => [`flag-${i}`, i % 2 === 0]),
  );
  const checked = validateRpgDocument({
    ...base,
    departmentId: "engineering-工學院-0",
    xp: 60,
    focus: 80,
    equipped: true,
    loadout: { tool: "repair-wrench", accessory: null, pack: null },
    gear: [{ id: "gear-repair-wrench", itemId: "repair-wrench", durability: 40, quality: "plain" }],
    quarantine: [],
    quarantineGear: [],
    skillRank: 1,
    kills: 3,
    built: 1,
    boss: 0,
    gathered: { notes: 12, parts: 4, coffee: 1, tea: 3 },
    felled: { quiz: 5, report: 2, exam: 0, final: 0 },
    discoveries: ["library", "engineering"],
    claimed: ["first", "quest-orient-gate"],
    buildings: Array.from({ length: 48 }, (_, i) => ({
      id: `desk-${i}`,
      kind: "desk",
      x: i,
      z: i + 1,
      rotation: 0,
      hp: 120,
    })),
    heldBuild: null,
    harvested: { library: 1_700_000_000_000 },
    loot: [{ id: "pile-1", x: 12, z: 18, items: { notes: 1, parts: 2 } }],
    clock: 90,
    position: { x: 10, z: 20, yaw: 1.2 },
    pilgrimage: { visited: ["library"], timeOfDay: "day", muted: false },
    lesson: "move",
    lessonAnchor: { x: 10, z: 20 },
    interiorId: "library",
    floor: 2,
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 1,
      minute: 480,
      placeId: "library",
      weather: "clear",
      timeOfDay: "morning",
      semester: "week-1",
      collegeId: "engineering",
      departmentId: "engineering-工學院-0",
      flags,
      questNodes: { "quest-orient-gate": "outline" },
      memory: {},
      cooldowns: {},
      mutexUntil: {},
      mutexHolder: {},
      recent: ["evt-gate-orientation"],
      fired: ["evt-gate-orientation"],
      resolved: ["evt-gate-orientation"],
      activeEventId: null,
      mode: "exploring",
    },
    variety: {
      version: 1,
      rng: 1,
      recent: ["variety-gate"],
      resolved: [],
      claims: ["quest-orient-gate"],
      route: "peace",
      tutorialSeen: true,
      signals: [
        {
          type: "variety.resolved",
          eventId: "variety-gate",
          route: "peace",
          questId: "quest-orient-gate",
        },
      ],
      active: {
        eventId: "variety-quiz",
        phase: "combat",
        route: "field",
        failReason: null,
        receipt: null,
        tutorial: false,
        caps: {
          equipped: true,
          skillRank: 1,
          built: 1,
          collegeId: "engineering",
          discipline: null,
        },
        board: {
          board: "combat",
          combat: "quiz",
          player: { x: 0, y: 0 },
          playerHp: 12,
          enemy: { x: 2, y: 1 },
          enemyHp: 8,
          facing: 1,
          windup: 0,
          telegraph: null,
          commit: 0,
          laneY: null,
          stun: 0,
          step: 1,
          retargets: 0,
          desk: null,
          deskHp: null,
          nodes: [],
          lit: [true],
          guard: false,
          lastPlayerHit: 0,
          lastEnemyHit: 0,
          lastShape: null,
          outcome: "ongoing",
          log: "hit",
        },
      },
    },
  });
  assert.equal(checked.ok, true, checked.ok ? "" : checked.message);
});

test("cloud saves reject fields outside the live snapshot", () => {
  const extra = validateRpgDocument({ ...base, score: 99 });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.code, "unsafe_content");

  const supplies = validateRpgDocument({
    ...base,
    gathered: { notes: 12, parts: 0, coffee: 0, tea: 0 },
    felled: { report: 2 },
  });
  assert.equal(supplies.ok, true, supplies.ok ? "" : supplies.message);
  const planted = validateRpgDocument({ ...base, gathered: { notes: 1, badge: 1 } });
  assert.equal(planted.ok, false);
  if (!planted.ok) assert.equal(planted.code, "unsafe_content");
  const negative = validateRpgDocument({ ...base, felled: { quiz: -1 } });
  assert.equal(negative.ok, false);
  if (!negative.ok) assert.equal(negative.code, "invalid_document");

  const narrative = validateRpgDocument({
    ...base,
    narrative: { version: 1, flags: {}, script: "run" },
  });
  assert.equal(narrative.ok, false);
  if (!narrative.ok) assert.equal(narrative.code, "unsafe_content");

  const flags = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`flag-${i}`, true]));
  const crowded = validateRpgDocument({ ...base, narrative: { version: 1, flags } });
  assert.equal(crowded.ok, false);
  if (!crowded.ok) assert.match(crowded.message, /超過上限/);

  const overflow = Object.fromEntries(
    Array.from({ length: MAX_DOCUMENT_KEYS }, (_, i) => [`flag-${i}`, true]),
  );
  const tooWide = validateRpgDocument({ ...base, narrative: { version: 1, flags: overflow } });
  assert.equal(tooWide.ok, false);
  if (!tooWide.ok) assert.match(tooWide.message, /欄位過多/);
});

test("live collection counters fit the cloud save and older saves can omit them", () => {
  const counted = validateRpgDocument({
    ...base,
    gathered: emptyGathered(),
    felled: emptyFelled(),
  });
  assert.equal(counted.ok, true, counted.ok ? "" : counted.message);
  const older = validateRpgDocument(base);
  assert.equal(older.ok, true, older.ok ? "" : older.message);
});

test("an old RPG import stays out of the pilgrimage bucket", () => {
  const oldRpg = validateRpgDocument({
    version: 1,
    departmentId: "math",
    inventory: [{ id: "pen", count: 2 }],
    buildings: [],
    visited: ["kenan"],
  });
  assert.equal(oldRpg.ok, false);
  if (!oldRpg.ok) assert.equal(oldRpg.code, "legacy_rpg");

  const pilgrimage = validateRpgDocument({ visited: ["kenan"], playSeconds: 3 });
  assert.equal(pilgrimage.ok, false);
  if (!pilgrimage.ok) assert.equal(pilgrimage.code, "legacy_pilgrimage");

  const world = validateRpgDocument({
    version: 2,
    visited: ["kenan"],
    inventory: [{ id: "notes", count: 1 }],
    buildings: [],
    departmentId: "cs",
  });
  assert.equal(world.ok, false);
  if (!world.ok) assert.equal(world.code, "legacy_pilgrimage");

  const current = validateRpgDocument(base);
  assert.equal(current.ok, true);
});

test("quest marks on ground loot stay in the cloud document", () => {
  const marked = validateRpgDocument({
    ...base,
    loot: [{ id: "pile-quest", x: 4, z: 8, items: { notes: 2, parts: 1 }, quest: { notes: 1 } }],
  });
  assert.equal(marked.ok, true, marked.ok ? "" : marked.message);
  if (marked.ok) assert.equal(marked.document.loot?.[0]?.quest?.notes, 1);

  const older = validateRpgDocument({
    ...base,
    loot: [{ id: "pile-old", x: 4, z: 8, items: { notes: 1 } }],
  });
  assert.equal(older.ok, true, older.ok ? "" : older.message);

  const extra = validateRpgDocument({
    ...base,
    loot: [{ id: "pile-extra", x: 1, z: 1, items: { notes: 1 }, source: "quest" }],
  });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.code, "unsafe_content");

  const over = validateRpgDocument({
    ...base,
    loot: [{ id: "pile-over", x: 1, z: 1, items: { notes: 1 }, quest: { notes: 2 } }],
  });
  assert.equal(over.ok, false);
  if (!over.ok) assert.equal(over.code, "invalid_document");
});
