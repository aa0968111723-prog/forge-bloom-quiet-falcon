import assert from "node:assert/strict";
import test from "node:test";

import { validateRpgDocument } from "../src/features/cloud-save/contract.ts";
import { freshGrowthState } from "../src/game/rpg/growth/types.ts";
import {
  approachPlace,
  chooseAt,
  narrativeClock,
  readNarrativeSession,
  rewardDelta,
  talkAt,
} from "../src/game/rpg/narrative-bridge.ts";
import { createSession } from "../src/features/narrative/play.ts";

test("world time maps onto the narrative clock", () => {
  assert.deepEqual(narrativeClock("wet"), {
    timeOfDay: "afternoon",
    weather: "rain",
    minute: 14 * 60,
  });
  assert.equal(narrativeClock("sunset").timeOfDay, "evening");
  assert.equal(narrativeClock("day").weather, "clear");
});

test("a broken narrative blob starts a fresh session", () => {
  const session = readNarrativeSession({ version: 2, flags: { "gate-asked-map": true } });
  assert.equal(session.version, 1);
  assert.deepEqual(session.flags, {});
});

test("the gate choice pays once through the live growth delta", () => {
  const growth = freshGrowthState();
  const first = approachPlace(createSession("campus"), growth, "main-gate", "day");
  assert.equal(first.ui.phase, "available");
  assert.equal(first.ui.eventId, "evt-gate-orientation");
  const talking = talkAt(first);
  const chosen = chooseAt(talking, "gate-ask-map");
  assert.equal(chosen.ok, true);
  const delta = rewardDelta(growth, chosen.play.growth);
  assert.equal(delta.xp, 20);
  assert.equal(delta.notes, 1);
  assert.deepEqual(delta.claimed, ["quest-orient-gate"]);
  const again = approachPlace(chosen.play.session, chosen.play.growth, "main-gate", "day");
  assert.equal(again.ui.phase, "exploring");
  assert.equal(rewardDelta(chosen.play.growth, again.growth).xp, 0);
});

test("the campus save still validates with the narrative session attached", () => {
  const growth = freshGrowthState();
  const approached = approachPlace(createSession("campus"), growth, "main-gate", "day");
  const chosen = chooseAt(talkAt(approached), "gate-ask-map");
  const delta = rewardDelta(growth, chosen.play.growth);
  const checked = validateRpgDocument({
    version: 2,
    hp: 100,
    xp: growth.xp + delta.xp,
    slots: [{ itemId: "notes", quantity: 1 }],
    buildings: [],
    claimed: delta.claimed,
    narrative: chosen.play.session,
  });
  assert.equal(checked.ok, true);
});

test("rain is the only way the track event is offered", () => {
  const growth = freshGrowthState();
  const dry = approachPlace(createSession("campus"), growth, "track", "day");
  assert.equal(dry.ui.phase, "exploring");
  const wet = approachPlace(createSession("campus"), growth, "track", "wet");
  assert.equal(wet.ui.eventId, "evt-track-rain");
});
