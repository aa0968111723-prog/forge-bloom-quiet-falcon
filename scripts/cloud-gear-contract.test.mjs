import assert from "node:assert/strict";
import test from "node:test";

import { validateRpgDocument } from "../src/features/cloud-save/contract.ts";

const base = {
  version: 2,
  hp: 100,
  slots: [{ itemId: "notes", quantity: 1 }],
  buildings: [],
};

test("cloud saves accept the live gear fields", () => {
  const accepted = validateRpgDocument({
    ...base,
    loadout: { tool: "repair-wrench", accessory: "badge", pack: null },
    gear: [{ id: "gear-repair-wrench", itemId: "repair-wrench", durability: 48, quality: "plain" }],
    quarantine: [{ itemId: "parts", quantity: 2 }],
    quarantineGear: [{ id: "gear-field-lamp", itemId: "field-lamp", durability: 12, quality: "fine" }],
    heldBuild: null,
    narrative: { version: 1, flags: {} },
    variety: { version: 1, resolved: [] },
  });
  assert.equal(accepted.ok, true);
  assert.equal(validateRpgDocument(base).ok, true);
  const emptyWear = validateRpgDocument({
    ...base,
    loadout: { tool: null, accessory: null, pack: null },
    gear: [],
    quarantine: [],
    quarantineGear: [],
    heldBuild: null,
  });
  assert.equal(emptyWear.ok, true);
});

test("cloud saves reject gear fields outside the whitelist", () => {
  const extra = validateRpgDocument({
    ...base,
    loadout: { tool: null, accessory: null, pack: null, bonus: 1 },
  });
  assert.equal(extra.ok, false);
  if (!extra.ok) assert.equal(extra.code, "unsafe_content");

  const quality = validateRpgDocument({
    ...base,
    gear: [{ id: "gear-repair-wrench", itemId: "repair-wrench", durability: 1, quality: "mythic" }],
  });
  assert.equal(quality.ok, false);
  if (!quality.ok) assert.equal(quality.code, "invalid_document");

  const crowded = validateRpgDocument({
    ...base,
    gear: Array.from({ length: 25 }, (_, i) => ({
      id: `gear-${i}`,
      itemId: "repair-wrench",
      durability: 1,
      quality: "plain",
    })),
  });
  assert.equal(crowded.ok, false);

  const emptyQuarantine = validateRpgDocument({
    ...base,
    quarantine: [{ itemId: "parts", quantity: 0 }],
  });
  assert.equal(emptyQuarantine.ok, false);

  const held = validateRpgDocument({
    ...base,
    heldBuild: { id: "held-1", kind: "lantern", x: 1, z: 2, rotation: 0 },
  });
  assert.equal(held.ok, false);
});
