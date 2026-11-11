import { DEPARTMENTS, DISCIPLINES, ENEMY_TYPES } from "../data.ts";
import { SPRINT } from "../move.ts";
import { FIXED_DT } from "../physics/index.ts";
import { basicAttackDamage, type Building } from "../rules.ts";
import {
  FIRST_FIGHT,
  buildingAabb,
  createEncounter,
  playerAttack,
  playerDodge,
  pumpEncounter,
  retryEncounter,
  stepEncounter,
  useSupply,
  type EncounterSim,
} from "./encounter.ts";
import { IFRAME_STEPS, type PoseName } from "./poses.ts";
import {
  advanceChapter,
  activateSide,
  claimSide,
  createStory,
  markVictory,
  readySide,
  type SideId,
  type StoryState,
} from "./story.ts";

export const TRACK_DEPARTMENTS = [
  DEPARTMENTS.find((row) => row.discipline === "engineering")!,
  DEPARTMENTS.find((row) => row.discipline === "science")!,
  DEPARTMENTS.find((row) => row.discipline === "humanities")!,
].map((row) => row.id);

export type LoopReport = {
  departmentId: string;
  ability: string;
  abilityOk: boolean;
  abilityNote: string;
  retreated: boolean;
  detoured: boolean;
  supplied: boolean;
  retried: boolean;
  dropped: boolean;
  barrierBlocked: boolean;
  bossVictoryOnce: boolean;
  chapter: string;
};

function barrierAt(x: number, z: number): { building: Building; box: ReturnType<typeof buildingAabb> } {
  const building: Building = {
    id: `barrier-${x}-${z}`,
    kind: "barrier",
    x,
    z,
    rotation: 0,
    hp: 280,
  };
  return { building, box: buildingAabb(building) };
}

function sidePath(story: StoryState, id: SideId, at: { x: number; z: number }) {
  activateSide(story, id);
  readySide(story, id);
  return claimSide(story, id, at);
}

function dodgeIncoming(state: EncounterSim) {
  const enemy = state.enemy;
  if (enemy.state === "windup" && enemy.timerSteps > 0 && enemy.timerSteps <= IFRAME_STEPS) {
    playerDodge(state);
  }
}

export function runCampusLoop(departmentId: string): LoopReport {
  const department = DEPARTMENTS.find((row) => row.id === departmentId);
  const fail = (note: string): LoopReport => ({
    departmentId,
    ability: "",
    abilityOk: false,
    abilityNote: note,
    retreated: false,
    detoured: false,
    supplied: false,
    retried: false,
    dropped: false,
    barrierBlocked: false,
    bossVictoryOnce: false,
    chapter: "開學",
  });
  if (!department) return fail("unknown department");
  const discipline = DISCIPLINES[department.discipline];
  const story = createStory();
  const anchorX = FIRST_FIGHT.x;
  const anchorZ = FIRST_FIGHT.z;

  const probe = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 8,
    yaw: 0,
  });
  const focusBefore = probe.player.focus;
  const hpBefore = probe.enemy.hp;
  const swing = playerAttack(probe, true);
  const dealt = hpBefore - probe.enemy.hp;
  let abilityOk = false;
  if (department.discipline === "engineering") abilityOk = swing === "hit" && probe.lastKnock > 1;
  if (department.discipline === "science") {
    abilityOk = swing === "hit" && dealt === discipline.damage && dealt > basicAttackDamage(0, false);
  }
  if (department.discipline === "humanities") {
    abilityOk = swing === "hit" && probe.player.focus === focusBefore - 22 + 12;
  }

  const retreat = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 8,
    yaw: 0,
  });
  retreat.player.vz = SPRINT;
  let chased = false;
  for (let i = 0; i < 600 && !(chased && (retreat.enemy.state === "return" || retreat.enemy.state === "idle")); i += 1) {
    stepEncounter(retreat, FIXED_DT);
    if (retreat.enemy.state === "chase" || retreat.enemy.state === "windup") chased = true;
  }
  const hpLeft = retreat.player.hp;
  const hitsLeft = retreat.hits;
  pumpEncounter(retreat, 120);
  const retreated =
    chased &&
    hitsLeft === 0 &&
    retreat.hits === hitsLeft &&
    retreat.player.hp === hpLeft &&
    (retreat.enemy.state === "return" || retreat.enemy.state === "idle");

  const around = barrierAt(anchorX, anchorZ + 4);
  const detour = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 8,
    yaw: 0,
    buildings: [around.building],
    barriers: [around.box],
  });
  pumpEncounter(detour, 240);
  const lateral = detour.planned.some((point) => Math.abs(point[0] - anchorX) > 1);
  const moved = Math.hypot(detour.enemy.x - anchorX, detour.enemy.z - anchorZ) > 0.3;
  const detoured = detour.detoured && lateral && moved && !detour.penetrated;

  const nurse = createEncounter({
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX + 30,
    playerZ: anchorZ,
    hp: 40,
  });
  const supplied = useSupply(nurse, "coffee") && nurse.player.hp === 85 && nurse.player.coffee === 0;

  const wall = barrierAt(anchorX, anchorZ + 1);
  const blocked = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 2,
    yaw: 0,
    buildings: [wall.building],
    barriers: [wall.box],
  });
  const hpBlocked = blocked.player.hp;
  pumpEncounter(blocked, 80);
  const barrierBlocked = blocked.hits === 0 && blocked.blockedHits > 0 && blocked.player.hp === hpBlocked;

  const duel = createEncounter({
    id: FIRST_FIGHT.id,
    kind: "quiz",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 2,
    yaw: 0,
  });
  for (let i = 0; i < 2000 && duel.enemy.hp > 0 && duel.player.hp > 0; i += 1) {
    dodgeIncoming(duel);
    playerAttack(duel, false);
    stepEncounter(duel, FIXED_DT);
  }
  const dropped =
    duel.enemy.hp <= 0 &&
    duel.loot.length === 1 &&
    duel.loot[0].items.notes === ENEMY_TYPES.quiz.reward.notes;
  const xpBeforeRetry = story.xp;
  const refusedSkip = advanceChapter(story).ok === false;
  const opened = markVictory(story, "victory-opening");
  duel.player.hp = 0;
  duel.player.pose = "down";
  const lootCount = duel.loot.length;
  retryEncounter(duel);
  const idlePose = new Set<PoseName>(["idle"]);
  const retried =
    refusedSkip &&
    opened &&
    duel.player.hp === duel.player.hpMax &&
    idlePose.has(duel.player.pose) &&
    duel.enemy.hp === ENEMY_TYPES.quiz.hp &&
    duel.loot.length === lootCount &&
    story.xp === xpBeforeRetry + (story.granted["victory-opening"] ?? 0) &&
    story.chapterIndex === 0;

  if (advanceChapter(story).ok) {
    sidePath(story, "side-explore", { x: anchorX + 2, z: anchorZ });
    markVictory(story, "victory-investigate");
  }
  if (advanceChapter(story).ok) {
    sidePath(story, "side-build", { x: anchorX + 3, z: anchorZ });
    markVictory(story, "victory-report");
  }
  const reachedFinal = advanceChapter(story).ok && story.chapterIndex === 3;
  sidePath(story, "side-campus", { x: anchorX + 4, z: anchorZ });

  const boss = createEncounter({
    id: "final-1",
    kind: "final",
    departmentId,
    enemyX: anchorX,
    enemyZ: anchorZ,
    playerX: anchorX,
    playerZ: anchorZ + 2,
    yaw: 0,
  });
  for (let i = 0; i < 8000 && boss.enemy.hp > 0 && boss.player.hp > 0; i += 1) {
    dodgeIncoming(boss);
    playerAttack(boss, false);
    stepEncounter(boss, FIXED_DT);
  }
  const bossDown = boss.enemy.hp <= 0 && boss.bossSettled && boss.loot.length === 1;
  const paid = markVictory(story, "boss");
  const paidAgain = markVictory(story, "boss");
  const piles = boss.loot.length;
  retryEncounter(boss);
  const bossVictoryOnce =
    reachedFinal &&
    bossDown &&
    paid &&
    !paidAgain &&
    story.bossVictory &&
    boss.enemy.hp === 0 &&
    boss.loot.length === piles;

  return {
    departmentId,
    ability: discipline.skill,
    abilityOk,
    abilityNote:
      department.discipline === "engineering"
        ? `knock ${probe.lastKnock.toFixed(2)}`
        : department.discipline === "science"
          ? `damage ${dealt}`
          : `focus ${probe.player.focus}`,
    retreated,
    detoured,
    supplied,
    retried,
    dropped,
    barrierBlocked,
    bossVictoryOnce,
    chapter: reachedFinal ? "期末" : "未完",
  };
}
