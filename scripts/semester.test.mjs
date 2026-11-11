/**
 * Semester loop: fixed-step encounters, cues, chapters, sides and three majors.
 * Replays the first quiz with scripted steps. No device screenshots.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ENEMY_TYPES } from "../src/game/rpg/data.ts";
import { basicAttackDamage } from "../src/game/rpg/rules.ts";
import { FIXED_DT, MAX_CATCHUP_STEPS } from "../src/game/rpg/physics/index.ts";
import { walkClip } from "../src/game/character/clips.ts";
import {
  ANOMALY_SCRIPT,
  APPEARANCE,
  CHAPTERS,
  COMBAT_CUES,
  EXAM_PATTERN,
  FAR_GATE,
  FAR_STRIDE,
  FINAL_PATTERN,
  FIRST_FIGHT,
  LOS_FUNCTION,
  POSE_TIMES,
  QUIZ_PATTERN,
  REPORT_PATTERN,
  STORY_SAVE_KEY,
  SUPPLY_HEAL,
  SUPPLY_FOCUS,
  TRACK_DEPARTMENTS,
  activateSide,
  advanceChapter,
  anomalyAt,
  applyV2Story,
  claimSide,
  createAnomaly,
  createEncounter,
  createSession,
  createStory,
  cueLine,
  grantQuestReward,
  markVictory,
  playerAttack,
  playerDodge,
  pumpEncounter,
  readV2Story,
  readySide,
  reflowSession,
  resolveAppearance,
  runCampusLoop,
  setSessionAppearance,
  setSessionInterior,
  setSessionPaused,
  setSessionTime,
  stepAnomaly,
  stepEncounter,
  stepSession,
  viewSession,
} from "../src/game/rpg/semester/index.ts";

const itemSource = readFileSync(new URL("../src/game/rpg/itemdetail.ts", import.meta.url), "utf8");

function repeats(dt, count) {
  return Array.from({ length: count }, () => dt);
}

function runDts(factory, frames) {
  const state = factory();
  let steps = 0;
  for (const dt of frames) steps += stepEncounter(state, dt);
  return {
    steps,
    warnings: state.warnings,
    hits: state.hits,
    hp: state.player.hp,
  };
}

test("enemy patterns reuse published color, windup and hp", () => {
  assert.equal(QUIZ_PATTERN.silhouette, ENEMY_TYPES.quiz.color);
  assert.equal(QUIZ_PATTERN.windup, ENEMY_TYPES.quiz.windup);
  assert.equal(QUIZ_PATTERN.hp, 65);
  assert.equal(QUIZ_PATTERN.window.id, "dodge-iframe");
  assert.equal(REPORT_PATTERN.silhouette, ENEMY_TYPES.report.color);
  assert.equal(REPORT_PATTERN.windup, ENEMY_TYPES.report.windup);
  assert.equal(REPORT_PATTERN.hp, 145);
  assert.equal(EXAM_PATTERN.windup, ENEMY_TYPES.exam.windup);
  assert.equal(EXAM_PATTERN.hp, 240);
  assert.equal(FINAL_PATTERN.hp, 520);
  assert.equal(FINAL_PATTERN.windup, ENEMY_TYPES.final.windup);
  assert.equal(FINAL_PATTERN.phases.length, 2);
  assert.notEqual(FINAL_PATTERN.phases[0].id, FINAL_PATTERN.phases[1].id);
  assert.equal(FINAL_PATTERN.phases[0].windup, ENEMY_TYPES.final.windup);
  assert.equal(FINAL_PATTERN.phases[1].windup, ENEMY_TYPES.final.windup);
  assert.equal(ENEMY_TYPES.quiz.hp, 65);
  assert.equal(ENEMY_TYPES.final.hp, 520);
  assert.equal(LOS_FUNCTION, "sweepCircle");
});

test("the same step count warns and hits the same way under two dt sequences", () => {
  const make = () =>
    createEncounter({
      id: FIRST_FIGHT.id,
      kind: "quiz",
      enemyX: FIRST_FIGHT.x,
      enemyZ: FIRST_FIGHT.z,
      playerX: FIRST_FIGHT.x,
      playerZ: FIRST_FIGHT.z + 2,
      yaw: 0,
    });
  const steady = runDts(make, repeats(FIXED_DT, 120));
  const coarse = runDts(make, repeats(0.05, 40));
  assert.equal(steady.steps, 120);
  assert.equal(coarse.steps, steady.steps);
  assert.equal(coarse.warnings, steady.warnings);
  assert.equal(coarse.hits, steady.hits);
  assert.ok(steady.warnings >= 1);
  assert.ok(steady.hits >= 1);
  assert.equal(coarse.hp, steady.hp);
});

test("pause does not catch up damage", () => {
  const state = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 2,
    yaw: 0,
  });
  while (state.enemy.state !== "windup") stepEncounter(state, FIXED_DT);
  const timer = state.enemy.timerSteps;
  const hp = state.player.hp;
  const steps = state.steps;
  state.paused = true;
  assert.equal(stepEncounter(state, 5), 0);
  assert.equal(state.enemy.timerSteps, timer);
  assert.equal(state.player.hp, hp);
  assert.equal(state.steps, steps);
  state.paused = false;
  assert.equal(stepEncounter(state, FIXED_DT), 1);
  assert.equal(state.enemy.timerSteps, timer - 1);
  assert.equal(state.player.hp, hp);
  assert.equal(stepEncounter(state, 1), MAX_CATCHUP_STEPS);
});

test("a barrier aabb blocks the swing", () => {
  const x = FIRST_FIGHT.x;
  const z = FIRST_FIGHT.z;
  const box = { minX: x - 1.5, maxX: x + 1.5, minZ: z + 0.6, maxZ: z + 1.4 };
  const state = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    enemyX: x,
    enemyZ: z,
    playerX: x,
    playerZ: z + 2,
    yaw: 0,
    barriers: [box],
  });
  pumpEncounter(state, 80);
  assert.equal(state.hits, 0);
  assert.ok(state.blockedHits > 0);
  assert.equal(state.player.hp, 100);
  assert.equal(state.lastSignal, "blocked");
});

test("leaving the area returns home and stops the damage", () => {
  const state = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 8,
    yaw: 0,
  });
  state.player.vz = 7.8;
  let chased = false;
  for (let i = 0; i < 600 && !(chased && (state.enemy.state === "return" || state.enemy.state === "idle")); i += 1) {
    stepEncounter(state, FIXED_DT);
    if (state.enemy.state === "chase" || state.enemy.state === "windup") chased = true;
  }
  assert.equal(chased, true);
  assert.ok(state.enemy.state === "return" || state.enemy.state === "idle");
  const hp = state.player.hp;
  const hits = state.hits;
  pumpEncounter(state, 120);
  assert.equal(state.hits, hits);
  assert.equal(state.player.hp, hp);
});

test("far enemies tick less often and do not hit through distance", () => {
  const near = createEncounter({
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 2,
  });
  const far = createEncounter({
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + FAR_GATE + 10,
  });
  pumpEncounter(near, 80);
  pumpEncounter(far, 80);
  assert.equal(near.aiTicks, 80);
  assert.equal(far.aiTicks, 80 / FAR_STRIDE);
  assert.equal(far.hits, 0);
  assert.equal(far.player.hp, 100);
  assert.equal(far.enemy.state, "idle");
});

test("combat cues keep words under reduced motion", () => {
  for (const cue of Object.values(COMBAT_CUES)) {
    assert.ok(cue.text.length > 0);
    assert.notEqual(cue.text, cue.color);
    const quiet = cueLine(cue.id, true);
    assert.match(quiet, new RegExp(cue.text));
  }
  const state = createEncounter({
    lowMotion: true,
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 2,
  });
  pumpEncounter(state, 70);
  assert.ok(state.lines.some((line) => line.includes("文字提示")));
});

test("final windup shows two different phases", () => {
  const state = createEncounter({
    id: "final-1",
    kind: "final",
    hp: 400,
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 2,
    yaw: 0,
  });
  pumpEncounter(state, 320);
  assert.deepEqual(state.seenPhases, ["deadline-sweep", "blackout-slam"]);
});

test("deadline and blackout have an omen, a countdown and one notice", () => {
  assert.match(ANOMALY_SCRIPT.deadline.omen, /前兆/);
  assert.match(ANOMALY_SCRIPT.blackout.omen, /前兆/);
  assert.match(ANOMALY_SCRIPT.deadline.restore, /恢復/);
  assert.match(ANOMALY_SCRIPT.blackout.restore, /點亮/);
  const omen = anomalyAt(300 * 60 - 60 * 60 - 10 * 60);
  assert.equal(omen.stage, "omen");
  assert.equal(omen.script, "deadline");
  const active = anomalyAt(300 * 60 - 60 * 60);
  assert.equal(active.stage, "active");
  assert.equal(active.remainingSteps, 60 * 60);
  const blackout = anomalyAt(300 * 60 + 300 * 60 - 60 * 60);
  assert.equal(blackout.script, "blackout");
  assert.equal(blackout.stage, "active");

  const sim = createAnomaly();
  const chunk = FIXED_DT * MAX_CATCHUP_STEPS;
  while (sim.simSteps < omen.occurrence * 0 + (300 * 60 - 70 * 60)) stepAnomaly(sim, chunk);
  assert.equal(sim.stage, "omen");
  assert.match(sim.banner, /前兆/);
  while (sim.stage !== "active") stepAnomaly(sim, chunk);
  assert.match(sim.banner, /剩餘/);
  const remaining = sim.remainingSteps;
  const notices = sim.notices.filter((row) => row.id === "deadline:0").length;
  sim.paused = true;
  assert.equal(stepAnomaly(sim, 3), 0);
  assert.equal(sim.remainingSteps, remaining);
  assert.equal(sim.notices.filter((row) => row.id === "deadline:0").length, notices);
  sim.paused = false;
  while (sim.stage === "active") stepAnomaly(sim, chunk);
  assert.match(sim.banner, /恢復/);
  assert.equal(sim.notices.filter((row) => row.id === "deadline:0").length, 1);
  assert.equal(sim.notices.filter((row) => row.id === "deadline:0:restore").length, 1);
});

test("chapters cannot skip a victory and a victory pays once", () => {
  const story = createStory();
  assert.equal(advanceChapter(story).ok, false);
  assert.equal(CHAPTERS[story.chapterIndex].name, "開學");
  assert.equal(markVictory(story, "victory-investigate"), true);
  assert.equal(advanceChapter(story).ok, false);
  assert.equal(markVictory(story, "victory-opening"), true);
  assert.equal(markVictory(story, "victory-opening"), false);
  assert.equal(advanceChapter(story).ok, true);
  assert.equal(CHAPTERS[story.chapterIndex].name, "調查");
  markVictory(story, "victory-investigate");
  assert.equal(advanceChapter(story).ok, true);
  markVictory(story, "victory-report");
  assert.equal(advanceChapter(story).ok, true);
  assert.equal(CHAPTERS[story.chapterIndex].name, "期末");
  assert.equal(advanceChapter(story).reason, "end");
  const xp = story.xp;
  assert.equal(markVictory(story, "boss"), true);
  assert.equal(markVictory(story, "boss"), false);
  assert.ok(story.xp > xp);
  assert.equal(story.bossVictory, true);
  const host = { xp: 0, granted: {} };
  assert.equal(grantQuestReward("boss", host), true);
  assert.equal(grantQuestReward("boss", host), false);
  assert.equal(host.xp, story.granted.boss);
});

test("a full bag spills one overflow pile and does not pay twice", () => {
  const story = createStory();
  story.bag = Array.from({ length: 24 }, () => ({ itemId: "notes", quantity: 99 }));
  assert.equal(activateSide(story, "side-explore"), true);
  assert.equal(readySide(story, "side-explore"), true);
  const first = claimSide(story, "side-explore", { x: 3, z: -12 });
  assert.equal(first.ok, true);
  assert.ok(first.overflow);
  assert.equal(first.overflow.x, 3);
  assert.equal(first.overflow.z, -12);
  assert.ok((first.overflow.items.coffee ?? 0) > 0);
  assert.equal(story.bag.length, 24);
  assert.equal(story.sides["side-explore"], "claimed");
  const piles = story.overflow.length;
  const xp = story.xp;
  const second = claimSide(story, "side-explore", { x: 9, z: 9 });
  assert.equal(second.ok, false);
  assert.equal(story.overflow.length, piles);
  assert.equal(story.xp, xp);
});

test("old v2 saves keep claimed sides and a boss win, blanks do not", () => {
  const won = readV2Story({
    version: 2,
    boss: 1,
    claimed: ["side-campus", "semester"],
  });
  assert.equal(won.key, STORY_SAVE_KEY);
  assert.equal(won.bossVictory, true);
  assert.deepEqual(won.claimedSides, ["side-campus"]);
  assert.deepEqual(won.claimedMissions, ["semester"]);
  assert.equal(won.chapterIndex, 3);
  const blank = readV2Story({ version: 2 });
  assert.equal(blank.bossVictory, false);
  assert.deepEqual(blank.claimedSides, []);
  const zero = readV2Story({ version: 2, boss: 0, claimed: [] });
  assert.equal(zero.bossVictory, false);
  const broken = readV2Story({ version: 1, boss: 1, claimed: ["side-explore"] });
  assert.equal(broken.bossVictory, false);
  assert.deepEqual(broken.claimedSides, []);
  const story = createStory();
  applyV2Story(story, { version: 2, boss: 1, claimed: ["side-build"] });
  const xp = story.xp;
  assert.equal(markVictory(story, "boss"), false);
  assert.equal(story.xp, xp);
  assert.equal(story.sides["side-build"], "claimed");
});

test("appearance id survives low quality and a reload", () => {
  assert.equal(APPEARANCE.length, 3);
  for (const look of APPEARANCE) {
    assert.equal(look.license, "existing-rig");
    assert.equal(look.status, "pending-asset");
    assert.equal(resolveAppearance(look.id, "low"), look.id);
    assert.equal(resolveAppearance(look.id, "high"), look.id);
  }
  const session = createSession();
  setSessionAppearance(session, "existing-college", "low");
  const saved = {
    version: 2,
    appearanceId: session.appearanceId,
    boss: 0,
    claimed: [],
  };
  const loaded = readV2Story(JSON.parse(JSON.stringify(saved)));
  assert.equal(loaded.appearanceId, "existing-college");
  assert.equal(resolveAppearance(loaded.appearanceId, "low"), "existing-college");
});

test("reflow, pause, time of day and interiors keep one clock", () => {
  const session = createSession(
    createEncounter({
      enemyX: FIRST_FIGHT.x,
      enemyZ: FIRST_FIGHT.z,
      playerX: FIRST_FIGHT.x,
      playerZ: FIRST_FIGHT.z + 2,
      yaw: 0,
      departmentId: TRACK_DEPARTMENTS[0],
    }),
  );
  stepSession(session, 0.05);
  playerAttack(session.encounter, false);
  activateSide(session.story, "side-campus");
  const before = viewSession(session);
  assert.equal(before.clockSkew, false);
  assert.equal(before.steps, before.anomalySteps);
  assert.deepEqual(reflowSession(session), before);
  setSessionPaused(session, true);
  assert.equal(stepSession(session, 2), 0);
  const paused = viewSession(session);
  assert.equal(paused.steps, before.steps);
  assert.equal(paused.anomalySteps, before.anomalySteps);
  assert.equal(paused.attackReadyStep, before.attackReadyStep);
  assert.deepEqual(paused.pins, before.pins);
  assert.equal(paused.hp, before.hp);
  setSessionPaused(session, false);
  setSessionTime(session, "night");
  const night = viewSession(session);
  assert.notEqual(night.light, before.light);
  assert.equal(night.steps, before.steps);
  assert.equal(night.attackReadyStep, before.attackReadyStep);
  assert.deepEqual(night.pins, before.pins);
  assert.equal(night.chapterId, before.chapterId);
  const hp = session.encounter.player.hp;
  setSessionInterior(session, "library");
  for (let i = 0; i < 16; i += 1) stepSession(session, FIXED_DT * MAX_CATCHUP_STEPS);
  assert.equal(session.encounter.player.hp, hp);
  assert.equal(session.encounter.player.interiorId, "library");
  assert.equal(session.clockSkew, false);
  assert.equal(session.encounter.steps, session.anomaly.simSteps);
  setSessionInterior(session, null);
  const back = viewSession(session);
  assert.equal(back.chapterId, before.chapterId);
  assert.deepEqual(back.pins, before.pins);
  assert.equal(back.appearanceId, before.appearanceId);
  assert.equal(back.interiorId, null);
});

test("swing, dodge and gait times land on the hit", () => {
  assert.equal(POSE_TIMES.attack, 0.46);
  assert.equal(POSE_TIMES.dodgeIframe, 0.45);
  assert.equal(POSE_TIMES.hurt, 0.4);
  assert.equal(POSE_TIMES.walk, walkClip().duration);
  assert.match(itemSource, /export const COFFEE_HEAL = 45/);
  assert.match(itemSource, /export const TEA_FOCUS = 55/);
  assert.equal(SUPPLY_HEAL, 45);
  assert.equal(SUPPLY_FOCUS, 55);
  const state = createEncounter({
    departmentId: TRACK_DEPARTMENTS[1],
    enemyX: FIRST_FIGHT.x,
    enemyZ: FIRST_FIGHT.z,
    playerX: FIRST_FIGHT.x,
    playerZ: FIRST_FIGHT.z + 2,
    yaw: 0,
  });
  const before = state.enemy.hp;
  assert.equal(playerAttack(state, false), "hit");
  assert.equal(state.player.pose, "attack");
  assert.equal(before - state.enemy.hp, basicAttackDamage(0, false));
  assert.equal(playerAttack(state, false), "locked");
  assert.equal(state.enemy.hp, before - basicAttackDamage(0, false));
  state.enemy.state = "windup";
  state.enemy.timerSteps = 10;
  assert.equal(playerDodge(state), true);
  for (let i = 0; i < 10; i += 1) stepEncounter(state, FIXED_DT);
  assert.equal(state.player.hp, 100);
  assert.equal(state.lastSignal, "dodge-iframe");
});

test("three majors finish the first fight, the barrier and the boss once", () => {
  assert.equal(TRACK_DEPARTMENTS.length, 3);
  for (const id of TRACK_DEPARTMENTS) {
    const report = runCampusLoop(id);
    assert.equal(report.abilityOk, true, `${id} ${report.abilityNote}`);
    assert.equal(report.retreated, true, id);
    assert.equal(report.detoured, true, id);
    assert.equal(report.supplied, true, id);
    assert.equal(report.retried, true, id);
    assert.equal(report.dropped, true, id);
    assert.equal(report.barrierBlocked, true, id);
    assert.equal(report.bossVictoryOnce, true, id);
    assert.equal(report.chapter, "期末", id);
  }
});
