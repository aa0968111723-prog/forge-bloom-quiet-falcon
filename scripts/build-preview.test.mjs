/**
 * Placement preview and demolish confirmation share one judge.
 * A mismatch between the ghost and the commit must fail these checks.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";
import { RECIPES } from "../src/game/rpg/data.ts";
import { footprint } from "../src/game/rpg/rules.ts";
import { judgePlacement, PLACE_LEGAL_WORD } from "../src/game/rpg/prompts.ts";
import { BUILD_NEED_MATERIALS } from "../src/game/rpg/buildcard.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import {
  BAG_CAPACITY,
  allowsImmediatePlay,
  beginBuild,
  cancelBuild,
  cancelDemolish,
  commitBuild,
  confirmDemolish,
  createBuildSession,
  endBuild,
  facilityAabb,
  facilityColliders,
  listFacilities,
  locateFacility,
  moveBuild,
  planDemolish,
  requestDemolish,
  restoreLegacyFacilities,
  rotateBuild,
  sessionPreview,
  slotCount,
  strikeFacility,
} from "../src/game/rpg/build-session.ts";

const RICH = [
  { itemId: "notes", quantity: 40 },
  { itemId: "parts", quantity: 40 },
  { itemId: "credit", quantity: 4 },
];

function fresh(kind = "lantern") {
  return beginBuild(createBuildSession({ slots: RICH }), kind);
}

function aimed(state, x, z) {
  return moveBuild(state, x, z + 5, 0);
}

function findAim(kind, slots = RICH) {
  let state = beginBuild(createBuildSession({ slots }), kind);
  for (let x = 24; x <= 70; x += 0.5) {
    for (let z = -16; z >= -80; z -= 0.5) {
      const next = aimed(state, x, z);
      const preview = sessionPreview(next);
      if (preview.legal && preview.spot.x === x && preview.spot.z === z) return next;
    }
  }
  return null;
}

test("ghost words, rotation and commit use the same placement judge", () => {
  assert.equal(BAG_CAPACITY, 24);
  const state = findAim("lantern");
  assert.ok(state, "expected a legal lantern spot");
  const preview = sessionPreview(state);
  assert.equal(preview.words, PLACE_LEGAL_WORD);
  assert.equal(preview.reason, null);
  assert.notEqual(preview.color, sessionPreview(aimed(fresh("lantern"), 0, 0)).color);
  const direct = judgePlacement(
    preview.kind,
    preview.spot.x,
    preview.spot.z,
    preview.facing,
    [],
    { x: state.playerX, z: state.playerZ },
    (id) => slotCount(state.slots, id),
  );
  assert.equal(preview.legal, direct.legal);
  assert.equal(preview.words, direct.words);
  assert.deepEqual(preview.cost, direct.cost);
  assert.equal(preview.width, direct.width);
  assert.equal(preview.depth, direct.depth);

  const placed = commitBuild(state);
  assert.equal(placed.placed, true);
  assert.equal(placed.preview.words, preview.words);
  assert.deepEqual(placed.preview.spot, preview.spot);
  assert.deepEqual(placed.preview.cost, preview.cost);
  const built = placed.state.buildings[0];
  assert.equal(built.x, preview.spot.x);
  assert.equal(built.z, preview.spot.z);
  assert.equal(built.rotation, preview.facing);
  const builtBox = facilityAabb(built);
  assert.ok(Math.abs(builtBox.maxX - builtBox.minX - preview.width) < 1e-9);
  assert.ok(Math.abs(builtBox.maxZ - builtBox.minZ - preview.depth) < 1e-9);
  assert.equal(facilityColliders(placed.state).length, 1);
  for (const [id, amount] of Object.entries(preview.cost)) {
    assert.equal(slotCount(state.slots, id) - slotCount(placed.state.slots, id), amount);
  }
  const again = commitBuild(placed.state);
  assert.equal(again.placed, false);
  assert.equal(again.preview.words, "與既有設施重疊");
  assert.notEqual(again.preview.words, PLACE_LEGAL_WORD);
  assert.deepEqual(again.state.slots, placed.state.slots);
  assert.equal(again.state.buildings.length, 1);

  const turned = sessionPreview(rotateBuild(rotateBuild(aimed(fresh("barrier"), preview.spot.x, preview.spot.z))));
  const once = sessionPreview(rotateBuild(aimed(fresh("barrier"), preview.spot.x, preview.spot.z)));
  const box = footprint("barrier", Math.PI / 2);
  assert.equal(once.width, box.width);
  assert.equal(once.depth, box.depth);
  assert.notEqual(once.width, turned.width);
  assert.equal(once.words === PLACE_LEGAL_WORD || once.words === turned.words, true);
  const rotatedCommit = commitBuild(rotateBuild(aimed(fresh("barrier"), preview.spot.x, preview.spot.z + 6)));
  if (rotatedCommit.placed) {
    assert.equal(rotatedCommit.state.buildings[0].rotation, Math.PI / 2);
    const aabb = facilityAabb(rotatedCommit.state.buildings[0]);
    assert.ok(Math.abs(aabb.maxX - aabb.minX - rotatedCommit.preview.width) < 1e-9);
    assert.ok(Math.abs(aabb.maxZ - aabb.minZ - rotatedCommit.preview.depth) < 1e-9);
  }

  const moved = sessionPreview(moveBuild(state, state.playerX + 4, state.playerZ, state.yaw));
  assert.notDeepEqual(moved.spot, preview.spot);
});

test("flat, slope, entrance, overlap and missing materials stay on the ghost", () => {
  const flat = findAim("desk");
  assert.ok(flat);
  assert.equal(sessionPreview(flat).words, PLACE_LEGAL_WORD);

  let slopeWords = null;
  let slopeState = fresh("barrier");
  for (let x = 16; x <= 28; x += 1) {
    for (let z = 20; z <= 70; z += 1) {
      const preview = sessionPreview(aimed(slopeState, x, z));
      if (preview.words === "坡度太大，請選平坦地面") {
        slopeWords = preview;
        break;
      }
    }
    if (slopeWords) break;
  }
  assert.ok(slopeWords, "expected a slope rejection");
  assert.equal(slopeWords.legal, false);
  assert.equal(commitBuild(aimed(slopeState, slopeWords.spot.x, slopeWords.spot.z)).placed, false);

  const library = CAMPUS_SITES.find((site) => site.id === "library");
  const blocked = sessionPreview(aimed(fresh("lantern"), library.x, library.z));
  assert.equal(blocked.words, "與校園建築重疊");
  assert.equal(commitBuild(aimed(fresh("lantern"), library.x, library.z)).placed, false);

  const door = siteEntrance(library);
  const entrance = sessionPreview(aimed(fresh("lantern"), door.x, door.z));
  assert.equal(entrance.words, "請保留建築入口與門口通行空間");
  assert.equal(commitBuild(aimed(fresh("lantern"), door.x, door.z)).placed, false);

  const poor = beginBuild(
    createBuildSession({ slots: [{ itemId: "notes", quantity: 1 }] }),
    "lantern",
  );
  const short = sessionPreview(aimed(poor, flat.playerX - 5, flat.playerZ - 5));
  assert.equal(short.legal, false);
  assert.equal(short.words, BUILD_NEED_MATERIALS);
  const refused = commitBuild(aimed(poor, flat.playerX - 5, flat.playerZ - 5));
  assert.equal(refused.placed, false);
  assert.equal(slotCount(refused.state.slots, "notes"), 1);
});

test("cancel and end build spend nothing and leave combat available", () => {
  const state = findAim("turret");
  assert.ok(state);
  const before = state.slots.map((slot) => ({ ...slot }));
  const cancelled = cancelBuild(state);
  assert.deepEqual(cancelled.slots, before);
  assert.equal(cancelled.buildings.length, 0);
  assert.equal(allowsImmediatePlay(cancelled), true);
  assert.equal(sessionPreview(cancelled).legal, false);
  assert.equal(commitBuild(cancelled).placed, false);

  const ended = endBuild(rotateBuild(state));
  assert.deepEqual(ended.slots, before);
  assert.equal(ended.kind, null);
  assert.equal(allowsImmediatePlay(ended), true);
});

test("demolish confirms once, splits a full bag, and ignores a wreck", () => {
  const firstAim = findAim("lantern");
  assert.ok(firstAim);
  const first = commitBuild(firstAim);
  assert.equal(first.placed, true);
  const secondAim = findAim("lantern");
  let second = null;
  for (let x = first.state.buildings[0].x + 3; x <= 70; x += 0.5) {
    const aim = aimed(
      beginBuild(
        createBuildSession({ slots: RICH, buildings: first.state.buildings }),
        "lantern",
      ),
      x,
      first.state.buildings[0].z,
    );
    if (sessionPreview(aim).legal) {
      second = commitBuild(aim);
      break;
    }
  }
  assert.ok(second?.placed, "expected a second lantern");
  assert.equal(second.state.buildings.length, 2);
  assert.notEqual(second.state.buildings[0].id, second.state.buildings[1].id);
  assert.equal(second.state.buildings[0].kind, second.state.buildings[1].kind);
  const listed = listFacilities(second.state, 0, 0);
  assert.equal(listed.length, 2);
  assert.ok(listed[0].distance <= listed[1].distance);
  assert.equal(listed[0].name, "守夜宮燈");
  assert.ok(listed[0].purpose.length > 0);
  const located = locateFacility(second.state, second.state.buildings[1].id, 0, 0);
  assert.equal(located.x, second.state.buildings[1].x);

  const target = second.state.buildings[0];
  const asked = requestDemolish(second.state, target.id);
  assert.equal(asked.plan.ok, true);
  assert.deepEqual(asked.plan.refund, { notes: 1, parts: 1 });
  const notesBefore = slotCount(asked.state.slots, "notes");
  const done = confirmDemolish(asked.state);
  assert.equal(done.applied, true);
  assert.equal(slotCount(done.state.slots, "notes"), notesBefore + asked.plan.accepted.notes);
  assert.equal(done.state.buildings.some((building) => building.id === target.id), false);
  assert.equal(done.state.buildings.length, 1);
  assert.equal(facilityColliders(done.state).length, 1);
  const repeat = confirmDemolish(done.state);
  assert.equal(repeat.applied, false);
  assert.deepEqual(repeat.state.slots, done.state.slots);
  assert.equal(repeat.state.buildings.length, 1);

  const pending = requestDemolish(done.state, done.state.buildings[0].id);
  const aborted = cancelDemolish(pending.state);
  assert.equal(aborted.demolishId, null);
  assert.deepEqual(aborted.slots, pending.state.slots);
  assert.equal(confirmDemolish(aborted).applied, false);
  assert.equal(aborted.buildings.length, 1);

  const wrecked = strikeFacility(done.state, done.state.buildings[0].id, 500, "blow-1");
  assert.equal(wrecked.buildings[0].hp, 0);
  assert.equal(facilityColliders(wrecked).length, 0);
  assert.equal(listFacilities(wrecked, 0, 0).length, 0);
  const struckAgain = strikeFacility(wrecked, wrecked.buildings[0].id, 500, "blow-1");
  assert.equal(struckAgain.buildings[0].hp, 0);
  assert.equal(planDemolish(wrecked, wrecked.buildings[0].id).reason, "設施已摧毀");
  assert.equal(requestDemolish(wrecked, wrecked.buildings[0].id).plan.ok, false);

  const full = Array.from({ length: BAG_CAPACITY }, () => ({ itemId: "badge", quantity: 1 }));
  const packed = createBuildSession({
    slots: full,
    buildings: second.state.buildings,
  });
  const overflow = planDemolish(packed, second.state.buildings[0].id);
  assert.equal(overflow.ok, true);
  assert.ok(overflow.spots.length > 0);
  for (const spot of overflow.spots) {
    const resolved = resolveCollision(spot.x, spot.z, 0.3, facilityColliders({
      ...packed,
      buildings: packed.buildings.filter((building) => building.id !== second.state.buildings[0].id),
    }));
    assert.ok(Math.abs(resolved.x - spot.x) < 1e-6);
    assert.ok(Math.abs(resolved.z - spot.z) < 1e-6);
  }
  const paid = confirmDemolish(requestDemolish(packed, second.state.buildings[0].id).state);
  assert.equal(paid.applied, true);
  assert.equal(paid.state.slots.length, BAG_CAPACITY);
  assert.equal(confirmDemolish(paid.state).applied, false);
});

test("legacy v2 facility spots that still validate are kept", () => {
  const aim = findAim("desk");
  assert.ok(aim);
  const placed = commitBuild(aim);
  const kept = placed.state.buildings[0];
  const restored = restoreLegacyFacilities([
    { id: kept.id, kind: kept.kind, x: kept.x, z: kept.z, rotation: kept.rotation, hp: 50 },
    { id: kept.id, kind: kept.kind, x: kept.x + 8, z: kept.z, rotation: 0, hp: 50 },
    { id: "statue", kind: "lantern", x: 0, z: 0, rotation: 0, hp: 80 },
    { id: "unknown", kind: "banner", x: kept.x, z: kept.z, rotation: 0, hp: 80 },
  ]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, kept.id);
  assert.equal(restored[0].x, kept.x);
  assert.equal(restored[0].z, kept.z);
  assert.equal(restored[0].hp, 50);
  const aabb = facilityAabb(restored[0]);
  assert.ok(kept.x > aabb.minX && kept.x < aabb.maxX);
  assert.ok(kept.z > aabb.minZ && kept.z < aabb.maxZ);
});
