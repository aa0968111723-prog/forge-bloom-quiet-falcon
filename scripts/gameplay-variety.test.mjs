import assert from "node:assert/strict";
import test from "node:test";

import { VARIETY_EVENTS, kindCoverage } from "../src/features/gameplay-variety/catalog.ts";
import { createCombat, stepCombat, withCombat } from "../src/features/gameplay-variety/combat.ts";
import { escortAct } from "../src/features/gameplay-variety/escort.ts";
import { agreeingClues } from "../src/features/gameplay-variety/investigate.ts";
import { emptyMemory, readMemory, saveMemory } from "../src/features/gameplay-variety/memory.ts";
import { claimIntent, markClaim, reduceVariety, startRun } from "../src/features/gameplay-variety/play.ts";
import { buildRepair, repairVerdict } from "../src/features/gameplay-variety/repair.ts";
import { buildRoute, routeVerdict } from "../src/features/gameplay-variety/route.ts";
import { selectVariety } from "../src/features/gameplay-variety/select.ts";
import { settlementPreview } from "../src/features/gameplay-variety/settle.ts";
import { cellPoint, circleContains, shapeContains, telegraphLabel } from "../src/features/gameplay-variety/shapes.ts";
import { emptyCaps } from "../src/features/gameplay-variety/play.ts";
import { freshGrowthState } from "../src/game/rpg/growth/types.ts";
import { ENEMY_TYPES } from "../src/game/rpg/data.ts";

const skilled = { ...emptyCaps, skillRank: 2, equipped: true, built: 1 };

function play(id, caps = emptyCaps) {
  return startRun(emptyMemory(), VARIETY_EVENTS.find((event) => event.id === id), caps);
}

test("six kinds each have two different configurations", () => {
  const counts = kindCoverage();
  for (const count of Object.values(counts)) assert.ok(count >= 2);
  const rules = new Set(VARIETY_EVENTS.flatMap((event) => (event.investigate ? [event.investigate.rule] : [])));
  const modes = new Set(VARIETY_EVENTS.flatMap((event) => (event.puzzle ? [event.puzzle.mode] : [])));
  assert.deepEqual([...rules].sort(), ["exact", "window"]);
  assert.deepEqual([...modes].sort(), ["lamps", "valves"]);
  assert.equal(ENEMY_TYPES.quiz.speed !== ENEMY_TYPES.report.speed, true);
});

test("night patrol peace route solves clues, lamps, and escort", () => {
  let memory = play("gv-night-patrol");
  memory = reduceVariety(memory, { type: "ack" });
  const clues = memory.active.board;
  assert.equal(clues.board, "investigate");
  assert.deepEqual(agreeingClues(clues), ["note", "warm"]);
  memory = reduceVariety(memory, { type: "toggle-clue", id: "runner" });
  memory = reduceVariety(memory, { type: "submit-clues" });
  assert.equal(memory.active.phase, "investigate");
  assert.equal(memory.active.board.clues.length, 4);
  memory = reduceVariety(memory, { type: "toggle-clue", id: "runner" });
  memory = reduceVariety(memory, { type: "toggle-clue", id: "warm" });
  memory = reduceVariety(memory, { type: "toggle-clue", id: "note" });
  memory = reduceVariety(memory, { type: "submit-clues" });
  assert.equal(memory.active.phase, "puzzle");
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 0 });
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 2 });
  assert.equal(memory.active.phase, "fork");
  memory = reduceVariety(memory, { type: "choose-route", route: "escort" });
  assert.equal(memory.active.board.board, "escort");
  memory = reduceVariety(memory, { type: "escort-wait" });
  memory = reduceVariety(memory, { type: "escort-go", node: "lantern" });
  memory = reduceVariety(memory, { type: "escort-wait" });
  memory = reduceVariety(memory, { type: "escort-go", node: "desk" });
  assert.equal(memory.active.phase, "success");
  assert.equal(memory.active.route, "peace");
  assert.equal(memory.resolved.includes("gv-night-patrol"), true);
  const intent = claimIntent(memory);
  assert.equal(intent.questId, "quest-gv-night-peace");
  const paid = markClaim(memory, intent.questId);
  assert.equal(claimIntent(paid), null);
});

test("rushing the escort drops the notes and retry restores the same route", () => {
  let memory = play("gv-gym-escort");
  memory = reduceVariety(memory, { type: "escort-go", node: "ramp" });
  memory = reduceVariety(memory, { type: "escort-go", node: "stand" });
  assert.equal(memory.active.phase, "failed");
  memory = reduceVariety(memory, { type: "retry" });
  assert.equal(memory.active.phase, "escort");
  assert.equal(memory.active.board.cargo, 2);
  assert.equal(memory.active.board.at, "court");
  memory = reduceVariety(memory, { type: "escort-wait" });
  memory = reduceVariety(memory, { type: "escort-go", node: "ramp" });
  memory = reduceVariety(memory, { type: "escort-go", node: "stand" });
  memory = reduceVariety(memory, { type: "escort-go", node: "door" });
  assert.equal(memory.active.phase, "success");
});

test("a built barrier opens a different escort link", () => {
  const plain = play("gv-night-patrol");
  let built = startRun(emptyMemory(), VARIETY_EVENTS.find((event) => event.id === "gv-night-patrol"), skilled);
  built = reduceVariety(built, { type: "ack" });
  for (const id of ["warm", "note"]) built = reduceVariety(built, { type: "toggle-clue", id });
  built = reduceVariety(built, { type: "submit-clues" });
  built = reduceVariety(built, { type: "toggle-puzzle", index: 0 });
  built = reduceVariety(built, { type: "toggle-puzzle", index: 2 });
  built = reduceVariety(built, { type: "choose-route", route: "escort" });
  assert.equal(built.active.board.nodes.some((node) => node.id === "barrier"), true);
  assert.equal(plain.active.phase, "briefing");
  const moved = escortAct(built.active.board, "barrier");
  assert.notEqual(moved.board.at, "gate");
});

test("library clues use a time window instead of an exact stamp", () => {
  let memory = play("gv-library-clues", skilled);
  const board = memory.active.board;
  assert.deepEqual(agreeingClues(board), ["bell", "open"]);
  memory = reduceVariety(memory, { type: "toggle-clue", id: "late" });
  memory = reduceVariety(memory, { type: "toggle-clue", id: "open" });
  memory = reduceVariety(memory, { type: "submit-clues" });
  assert.equal(memory.active.phase, "investigate");
  memory = reduceVariety(memory, { type: "toggle-clue", id: "late" });
  memory = reduceVariety(memory, { type: "toggle-clue", id: "bell" });
  memory = reduceVariety(memory, { type: "submit-clues" });
  assert.equal(memory.active.phase, "success");
});

test("valve puzzle is a different mechanism and can be reset", () => {
  let memory = play("gv-stem-valves", skilled);
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 0 });
  memory = reduceVariety(memory, { type: "reset-puzzle" });
  assert.deepEqual(memory.active.board.values, [1, 0, 2]);
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 0 });
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 0 });
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 1 });
  assert.equal(memory.active.phase, "success");
});

test("route orders are judged by budget, a closed first stop, and a required sequence", () => {
  const library = buildRoute(VARIETY_EVENTS.find((event) => event.id === "gv-library-route").routePlan, emptyCaps);
  const legal = routeVerdict({ ...library, order: ["door", "read", "desk"] });
  const closed = routeVerdict({ ...library, order: ["desk", "door", "read"] });
  const crowded = routeVerdict({ ...library, order: ["door", "read", "desk", "stack"] });
  assert.equal(legal.ok, true);
  assert.equal(closed.ok, false);
  assert.equal(crowded.ok, false);
  const stem = VARIETY_EVENTS.find((event) => event.id === "gv-stem-route").routePlan;
  const slow = buildRoute(stem, emptyCaps);
  const fast = buildRoute(stem, skilled);
  assert.equal(slow.stops.find((stop) => stop.id === "corridor").cost, 4);
  assert.equal(fast.stops.find((stop) => stop.id === "corridor").cost, 2);
  assert.equal(routeVerdict({ ...slow, order: ["lab", "office", "corridor", "hall"] }).ok, true);
  assert.equal(routeVerdict({ ...slow, order: ["lab", "hall", "office", "corridor"] }).ok, false);
});

test("repair follows the heat rule and a peaceful route prefills the cooler", () => {
  const config = VARIETY_EVENTS.find((event) => event.id === "gv-avenue-repair").repair;
  const scrambled = buildRepair(config, false);
  const helped = buildRepair(config, true);
  assert.equal(helped.slots.includes("cooler"), true);
  assert.equal(scrambled.slots.includes("cooler"), false);
  assert.equal(scrambled.parts.some((part) => part.id === "scrap"), true);
  const slots = ["battery", null, "antenna", "cooler"];
  assert.equal(repairVerdict({ ...scrambled, slots }).ok, false);
  const fixed = ["cooler", null, "antenna", "battery"];
  assert.equal(repairVerdict({ ...scrambled, slots: fixed }).ok, true);
  const lab = buildRepair(VARIETY_EVENTS.find((event) => event.id === "gv-lab-repair").repair, false);
  assert.equal(repairVerdict({ ...lab, slots: ["battery", "cooler", null, "antenna"] }).ok, true);
  assert.notDeepEqual(lab.slotNames, scrambled.slotNames);
});

test("arc and lane damage use the telegraph shape, not a circle", () => {
  const caps = emptyCaps;
  const exam = createCombat("exam");
  const face = stepCombat(exam, "strike", caps);
  const side = stepCombat(withCombat(exam, { player: { x: 3, y: 1 } }), "strike", caps);
  assert.ok(face.lastPlayerHit > 0);
  assert.equal(side.lastPlayerHit, 0);
  const sidePoint = cellPoint({ x: 3, y: 1 });
  const origin = cellPoint(exam.enemy);
  assert.equal(circleContains(sidePoint.x, sidePoint.z, origin.x, origin.z, 1.2), true);
  assert.equal(
    shapeContains({ kind: "arc", x: origin.x, z: origin.z, facing: exam.facing, radius: 1.7, half: 0.55 }, sidePoint.x, sidePoint.z),
    false,
  );
  assert.equal(face.lastPlayerHit, stepCombat(exam, "strike", skilled).lastPlayerHit - 5);

  let lane = createCombat("report");
  lane = stepCombat(lane, "wait", caps);
  lane = withCombat(lane, { player: { x: 4, y: 0 }, commit: 1 });
  const warned = lane.telegraph;
  lane = stepCombat(lane, "wait", caps);
  assert.equal(lane.lastEnemyHit, 0);
  assert.equal(warned.kind, "rect");
  assert.equal(telegraphLabel(warned), "長條預警");
  const near = cellPoint({ x: 4, y: 0 });
  const enemy = cellPoint({ x: 4, y: 1 });
  assert.equal(circleContains(near.x, near.z, enemy.x, enemy.z, 1.2), true);
  assert.equal(shapeContains(warned, near.x, near.z), false);

  let stayed = createCombat("report");
  for (let i = 0; i < 4; i += 1) stayed = stepCombat(stayed, "wait", caps);
  assert.ok(stayed.lastEnemyHit > 0);
});

test("interrupt, shield tempo, protect, and dispel are different decisions", () => {
  const caps = emptyCaps;
  const primed = withCombat(createCombat("quiz"), {
    player: { x: 3, y: 2 },
    windup: 1,
    telegraph: { kind: "arc", x: 4.5, z: 2.5, facing: -Math.PI / 2, radius: 1.25, half: 0.6 },
  });
  const hit = stepCombat(primed, "wait", caps);
  const cut = stepCombat(primed, "skill", caps);
  assert.ok(hit.lastEnemyHit > 0);
  assert.equal(cut.lastEnemyHit, 0);
  assert.equal(cut.telegraph, null);
  const early = stepCombat(withCombat(primed, { windup: 2 }), "skill", caps);
  const earlySkilled = stepCombat(withCombat(primed, { windup: 2 }), "skill", skilled);
  assert.equal(early.stun, 0);
  assert.equal(earlySkilled.stun, 1);

  let quiz = createCombat("quiz");
  let finalFight = createCombat("final");
  for (let i = 0; i < 4; i += 1) {
    quiz = stepCombat(quiz, "wait", caps);
    finalFight = stepCombat(finalFight, "wait", caps);
  }
  assert.ok(quiz.retargets > finalFight.retargets);

  const shape = { kind: "rect", x: 2.5, z: 2.5, yaw: 0, length: 5, width: 1 };
  const protectedDesk = stepCombat(
    withCombat(createCombat("final"), { windup: 1, telegraph: shape, player: { x: 2, y: 4 } }),
    "wait",
    caps,
  );
  const broken = stepCombat(
    withCombat(createCombat("final"), { windup: 1, telegraph: shape, player: { x: 0, y: 0 } }),
    "wait",
    caps,
  );
  assert.ok(protectedDesk.playerHp < 100);
  assert.equal(protectedDesk.deskHp, 40);
  assert.ok(broken.deskHp < 40);

  let dispel = withCombat(createCombat("final"), { player: { x: 0, y: 0 } });
  dispel = stepCombat(dispel, "dispel", caps);
  dispel = stepCombat(withCombat(dispel, { player: { x: 0, y: 4 } }), "dispel", caps);
  assert.equal(dispel.outcome, "win");
  assert.ok(dispel.enemyHp > 0);
});

test("selection honors region, progress, recent history, ability, and seed", () => {
  const caps = emptyCaps;
  const memory = emptyMemory("selection");
  const chain = selectVariety({ catalog: VARIETY_EVENTS, memory, x: 0, z: -40, caps });
  assert.equal(chain.event.id, "gv-night-patrol");
  const tooSoon = selectVariety({ catalog: VARIETY_EVENTS, memory, x: 10, z: -276, caps });
  assert.equal(tooSoon.event, null);
  assert.equal(tooSoon.suppressed.some((item) => item.reason === "progress"), true);
  const after = selectVariety({
    catalog: VARIETY_EVENTS,
    memory: { ...memory, resolved: ["gv-gym-escort"] },
    x: 10,
    z: -276,
    caps,
  });
  assert.equal(after.event.id, "gv-library-clues");
  const blocked = selectVariety({
    catalog: VARIETY_EVENTS,
    memory: { ...memory, resolved: ["gv-gym-escort"] },
    x: 230,
    z: -228,
    caps,
  });
  assert.equal(blocked.event, null);
  const ready = selectVariety({
    catalog: VARIETY_EVENTS,
    memory: { ...memory, resolved: ["gv-gym-escort"] },
    x: 230,
    z: -228,
    caps: skilled,
  });
  assert.equal(ready.event.id, "gv-lab-repair");
  const pair = VARIETY_EVENTS.filter((event) => event.difficulty === 1).slice(0, 2).map((event) => ({
    ...event,
    x: 0,
    z: 0,
    reach: 5,
    priority: 3,
  }));
  const first = selectVariety({ catalog: pair, memory, x: 0, z: 0, caps, seed: "lane-a" });
  const again = selectVariety({ catalog: pair, memory, x: 0, z: 0, caps, seed: "lane-a" });
  assert.equal(first.event.id, again.event.id);
  assert.equal(first.eligible.length, 2);
  const skipped = selectVariety({
    catalog: pair,
    memory: { ...memory, recent: [pair[0].id] },
    x: 0,
    z: 0,
    caps,
  });
  assert.equal(skipped.event.id, pair[1].id);
  const active = startRun(memory, pair[0], caps);
  const resumed = selectVariety({ catalog: pair, memory: active, x: 30, z: 30, caps, seed: "other" });
  assert.equal(resumed.resume, true);
  assert.equal(resumed.event.id, pair[0].id);
  assert.equal(resumed.memory.rng, active.rng);
  const done = selectVariety({
    catalog: VARIETY_EVENTS,
    memory: { ...memory, resolved: ["gv-night-patrol"] },
    x: 0,
    z: -40,
    caps,
  });
  assert.equal(done.event, null);
});

test("abort clears the run and a saved board comes back", () => {
  let memory = play("gv-night-patrol");
  memory = reduceVariety(memory, { type: "ack" });
  memory = reduceVariety(memory, { type: "abort" });
  assert.equal(memory.active, null);
  let again = play("gv-stem-valves", skilled);
  again = reduceVariety(again, { type: "toggle-puzzle", index: 0 });
  const box = { saved: "" };
  saveMemory(
    {
      getItem: () => box.saved,
      setItem: (_key, value) => {
        box.saved = value;
      },
    },
    again,
  );
  const loaded = readMemory(JSON.parse(box.saved));
  assert.equal(loaded.active.phase, "puzzle");
  assert.deepEqual(loaded.active.board.values, again.active.board.values);
  assert.equal(JSON.stringify(loaded).includes("Date"), false);
});

test("quest settlement pays once", () => {
  const growth = freshGrowthState();
  const first = settlementPreview(growth, "quest-gv-night-peace", { xp: 36, notes: 4, credit: 0 });
  assert.equal(first.paid, true);
  assert.equal(first.xp, 36);
  assert.equal(first.notes, 4);
  const second = settlementPreview(first.growth, "quest-gv-night-peace", { xp: 36, notes: 4, credit: 0 });
  assert.equal(second.paid, false);
  assert.equal(second.xp, 0);
  assert.equal(second.notes, 0);
});

test("the night patrol can switch into the report lane and that fight can be won", () => {
  let memory = play("gv-night-patrol");
  memory = reduceVariety(memory, { type: "ack" });
  for (const id of ["warm", "note"]) memory = reduceVariety(memory, { type: "toggle-clue", id });
  memory = reduceVariety(memory, { type: "submit-clues" });
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 0 });
  memory = reduceVariety(memory, { type: "toggle-puzzle", index: 2 });
  memory = reduceVariety(memory, { type: "choose-route", route: "combat" });
  assert.equal(memory.active.board.combat, "report");
  let state = memory.active.board;
  let guard = 0;
  while (state.outcome === "ongoing" && guard < 80) {
    const adjacent =
      Math.max(Math.abs(state.player.x - state.enemy.x), Math.abs(state.player.y - state.enemy.y)) <= 1;
    let action = "wait";
    if (state.commit === 1 && state.laneY === state.player.y) action = state.player.y > 0 ? "north" : "south";
    else if (!adjacent && state.player.x < state.enemy.x) action = "east";
    else if (adjacent) action = "strike";
    state = stepCombat(state, action, emptyCaps);
    guard += 1;
  }
  assert.equal(state.outcome, "win");
  memory = reduceVariety(memory, { type: "abort" });
  assert.equal(memory.active, null);
});
