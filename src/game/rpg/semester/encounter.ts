import { SeekBehavior, Vector3, Vehicle } from "yuka";
import { DEPARTMENTS, DISCIPLINES, ENCOUNTERS, ENEMY_TYPES, type EnemyKind } from "../data.ts";
import { SPRINT } from "../move.ts";
import {
  MAX_CATCHUP_STEPS,
  createHitLedger,
  createSimClock,
  FIXED_DT,
  resolveHitSignals,
  sweepCircle,
  type HitLedger,
  type SimClock,
} from "../physics/index.ts";
import {
  BASIC_ATTACK_RANGE,
  basicAttackDamage,
  clearSegment,
  findWalkablePath,
  footprint,
  lifeCap,
  withinAttack,
  type Building,
} from "../rules.ts";
import type { AABB } from "../../world-data/colliders.ts";
import { cueLine, type CombatCueId } from "./cues.ts";
import { FINAL_PATTERN, PATTERNS } from "./patterns.ts";
import {
  ATTACK_STEPS,
  DODGE_STEPS,
  HURT_STEPS,
  IFRAME_STEPS,
  POSE_TIMES,
  castSteps,
  swingConnects,
  type PoseName,
} from "./poses.ts";

/** Same far gate tickRpg uses before it idles an encounter. */
export const FAR_GATE = 60;
/** Far enemies update one step out of this many. They never land a hit. */
export const FAR_STRIDE = 4;
export const AGGRO_RANGE = 23;
export const LEASH = 38;
export const HOME_ARRIVE = 1;
/** Recover beat published by tickRpg after a swing. */
export const RECOVER_S = 1.1;
/** Line of sight and body blocking both go through this physics cast. */
export const LOS_FUNCTION = "sweepCircle" as const;
/** One frame may simulate at most this many fixed steps. Pause drops the rest. */
export const CATCHUP_STEPS = MAX_CATCHUP_STEPS;

const PLAYER_RADIUS = 0.45;
const PATH_REFRESH = 90;
const FOCUS_REGEN = 3.2;
const SKILL_FOCUS = 22;
const DODGE_FOCUS = 18;
const KNOCK_M = 2;

export const FIRST_FIGHT = ENCOUNTERS.find((row) => row.id === "quiz-1") ?? ENCOUNTERS[0];

export type ActorState = "idle" | "chase" | "windup" | "recover" | "return" | "dead";
export type AnomalySpeed = "quiet" | "deadline" | "blackout";

export type SimPlayer = {
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  hp: number;
  hpMax: number;
  focus: number;
  xp: number;
  equipped: boolean;
  departmentId: string | null;
  interiorId: string | null;
  pose: PoseName;
  poseUntil: number;
  attackStep: number;
  attackReadyStep: number;
  dodgeReadyStep: number;
  iframeUntilStep: number;
  coffee: number;
  tea: number;
};

export type SimEnemy = {
  id: string;
  kind: EnemyKind;
  x: number;
  z: number;
  hp: number;
  state: ActorState;
  timerSteps: number;
  anchorX: number;
  anchorZ: number;
  phase: 0 | 1;
};

export type LootPile = {
  id: string;
  x: number;
  z: number;
  items: Record<string, number>;
};

type Steer = { vehicle: Vehicle; target: Vector3 };

export type EncounterSim = {
  clock: SimClock;
  paused: boolean;
  held: boolean;
  player: SimPlayer;
  enemy: SimEnemy;
  barriers: AABB[];
  buildings: Building[];
  steps: number;
  warnings: number;
  hits: number;
  blockedHits: number;
  immuneHits: number;
  missedHits: number;
  damageTaken: number;
  aiTicks: number;
  farHold: number;
  lowMotion: boolean;
  anomaly: AnomalySpeed;
  lastCue: CombatCueId | null;
  lastSignal: "hit" | "blocked" | "dodge-iframe" | null;
  lines: string[];
  seenPhases: string[];
  ledger: HitLedger;
  loot: LootPile[];
  dropped: boolean;
  bossSettled: boolean;
  detoured: boolean;
  penetrated: boolean;
  path: [number, number][];
  /** Path captured when it was planned, before waypoints are consumed. */
  planned: [number, number][];
  pathTarget: { x: number; z: number } | null;
  pathRefresh: number;
  steer: Steer | null;
  lastKnock: number;
  lastPlayerHit: "hit" | "miss" | "blocked" | "locked" | "indoor" | "down" | "no-focus" | null;
};

export type EncounterSetup = {
  id?: string;
  kind?: EnemyKind;
  enemyX?: number;
  enemyZ?: number;
  playerX?: number;
  playerZ?: number;
  yaw?: number;
  hp?: number;
  focus?: number;
  departmentId?: string | null;
  barriers?: readonly AABB[];
  buildings?: readonly Building[];
  lowMotion?: boolean;
};

export function buildingAabb(building: Building): AABB {
  const box = footprint(building.kind, building.rotation);
  return {
    minX: building.x - box.width / 2,
    maxX: building.x + box.width / 2,
    minZ: building.z - box.depth / 2,
    maxZ: building.z + box.depth / 2,
  };
}

export function obstacleBoxes(state: EncounterSim): AABB[] {
  return [...state.barriers, ...state.buildings.map(buildingAabb)];
}

/**
 * Sight uses physics `sweepCircle` with the barrier boxes in `extra`.
 * A contact that stops short of the target is blocked. World colliders on the
 * same cast still apply, so callers should stand on open ground.
 */
export function sightBlocked(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  barriers: readonly AABB[],
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const full = Math.hypot(dx, dz);
  if (full < 1e-6 || barriers.length === 0) return false;
  const cast = sweepCircle({ x: ax, z: az, dx, dz, radius: 0.05, extra: barriers });
  if (!cast.hit) return false;
  const traveled = Math.hypot(cast.landed.x - ax, cast.landed.z - az);
  return traveled < full - 0.08;
}

function circleHitsBox(x: number, z: number, radius: number, box: AABB) {
  const cx = Math.min(Math.max(x, box.minX), box.maxX);
  const cz = Math.min(Math.max(z, box.minZ), box.maxZ);
  return (x - cx) ** 2 + (z - cz) ** 2 < radius * radius - 1e-6;
}

function pushCue(state: EncounterSim, id: CombatCueId) {
  state.lastCue = id;
  state.lines.push(cueLine(id, state.lowMotion));
}

function disciplineOf(state: EncounterSim) {
  const id = state.player.departmentId;
  const department = DEPARTMENTS.find((row) => row.id === id);
  if (!department) return null;
  return { department, discipline: DISCIPLINES[department.discipline] };
}

export function createEncounter(setup: EncounterSetup = {}): EncounterSim {
  const kind = setup.kind ?? FIRST_FIGHT.kind;
  const type = ENEMY_TYPES[kind];
  const anchorX = setup.enemyX ?? FIRST_FIGHT.x;
  const anchorZ = setup.enemyZ ?? FIRST_FIGHT.z;
  const xp = 0;
  const equipped = false;
  return {
    clock: createSimClock(),
    paused: false,
    held: false,
    player: {
      x: setup.playerX ?? anchorX,
      z: setup.playerZ ?? anchorZ + 8,
      yaw: setup.yaw ?? 0,
      vx: 0,
      vz: 0,
      hp: setup.hp ?? 100,
      hpMax: lifeCap(xp, equipped),
      focus: setup.focus ?? 100,
      xp,
      equipped,
      departmentId: setup.departmentId ?? null,
      interiorId: null,
      pose: "idle",
      poseUntil: 0,
      attackStep: -1,
      attackReadyStep: 0,
      dodgeReadyStep: 0,
      iframeUntilStep: -1,
      coffee: 1,
      tea: 1,
    },
    enemy: {
      id: setup.id ?? FIRST_FIGHT.id,
      kind,
      x: anchorX,
      z: anchorZ,
      hp: type.hp,
      state: "idle",
      timerSteps: 0,
      anchorX,
      anchorZ,
      phase: 0,
    },
    barriers: setup.barriers ? [...setup.barriers] : [],
    buildings: setup.buildings ? [...setup.buildings] : [],
    steps: 0,
    warnings: 0,
    hits: 0,
    blockedHits: 0,
    immuneHits: 0,
    missedHits: 0,
    damageTaken: 0,
    aiTicks: 0,
    farHold: 0,
    lowMotion: setup.lowMotion ?? false,
    anomaly: "quiet",
    lastCue: null,
    lastSignal: null,
    lines: [],
    seenPhases: [],
    ledger: createHitLedger(),
    loot: [],
    dropped: false,
    bossSettled: false,
    detoured: false,
    penetrated: false,
    path: [],
    planned: [],
    pathTarget: null,
    pathRefresh: 0,
    steer: null,
    lastKnock: 0,
    lastPlayerHit: null,
  };
}

function defeatEnemy(state: EncounterSim) {
  const enemy = state.enemy;
  enemy.hp = 0;
  enemy.state = "dead";
  if (state.dropped) return;
  state.dropped = true;
  const reward = ENEMY_TYPES[enemy.kind].reward;
  state.loot.push({
    id: `${enemy.id}-loot`,
    x: enemy.x,
    z: enemy.z,
    items: { ...reward },
  });
  if (enemy.kind === "final") state.bossSettled = true;
}

function resolveStrike(state: EncounterSim, distance: number) {
  const enemy = state.enemy;
  const type = ENEMY_TYPES[enemy.kind];
  const reach = type.radius + 2.5;
  const boxes = obstacleBoxes(state);
  const blocked = sightBlocked(enemy.x, enemy.z, state.player.x, state.player.z, boxes);
  const inRange = distance < reach;
  if (!inRange) {
    state.missedHits += 1;
    pushCue(state, "miss");
    return;
  }
  const iframe = state.steps <= state.player.iframeUntilStep;
  const intent = {
    targetId: "player",
    amount: type.damage,
    iframe: !blocked && iframe,
    blocked,
  };
  const [signal] = resolveHitSignals([intent]);
  state.lastSignal = signal.kind;
  const book = state.ledger.apply(state.steps, { player: state.player.hp }, [signal]);
  state.player.hp = Math.max(0, book.hp.player ?? state.player.hp);
  if (signal.kind === "hit") {
    state.hits += 1;
    state.damageTaken += signal.amount;
    state.player.pose = state.player.hp <= 0 ? "down" : "hurt";
    state.player.poseUntil = state.steps + HURT_STEPS;
    pushCue(state, "hit");
    return;
  }
  if (signal.kind === "blocked") {
    state.blockedHits += 1;
    pushCue(state, "blocked");
    return;
  }
  state.immuneHits += 1;
  pushCue(state, "immune");
}

function steerToward(state: EncounterSim, tx: number, tz: number) {
  const enemy = state.enemy;
  const type = ENEMY_TYPES[enemy.kind];
  const speed = type.speed * (state.anomaly === "deadline" ? 1.4 : 1);
  if (!state.steer) {
    const vehicle = new Vehicle();
    const target = new Vector3();
    vehicle.steering.add(new SeekBehavior(target));
    vehicle.maxForce = 80;
    state.steer = { vehicle, target };
  }
  const refresh =
    !state.pathTarget ||
    state.steps >= state.pathRefresh ||
    Math.hypot(state.pathTarget.x - tx, state.pathTarget.z - tz) > 4;
  if (refresh) {
    const direct = clearSegment(enemy.x, enemy.z, tx, tz, type.radius, state.buildings);
    if (!direct) state.detoured = true;
    const path = findWalkablePath(
      { x: enemy.x, z: enemy.z },
      { x: tx, z: tz },
      type.radius,
      state.buildings,
    );
    const frozen = (path.length ? path : [[enemy.x, enemy.z]]).map(
      (point) => [point[0], point[1]] as [number, number],
    );
    state.planned = frozen;
    state.path = frozen.map((point) => [point[0], point[1]] as [number, number]);
    state.pathTarget = { x: tx, z: tz };
    state.pathRefresh = state.steps + PATH_REFRESH;
  }
  const path = state.path;
  while (path.length > 1 && Math.hypot(enemy.x - path[0][0], enemy.z - path[0][1]) < 1.3) {
    path.shift();
  }
  const waypoint = path[0] ?? [enemy.x, enemy.z];
  const { vehicle, target } = state.steer;
  vehicle.position.set(enemy.x, 0, enemy.z);
  vehicle.maxSpeed = speed;
  target.set(waypoint[0], 0, waypoint[1]);
  vehicle.update(FIXED_DT);
  const boxes = obstacleBoxes(state);
  const cast = sweepCircle({
    x: enemy.x,
    z: enemy.z,
    dx: vehicle.position.x - enemy.x,
    dz: vehicle.position.z - enemy.z,
    radius: type.radius,
    extra: boxes,
  });
  enemy.x = cast.end.x;
  enemy.z = cast.end.z;
  const radius = type.radius;
  if (boxes.some((box) => circleHitsBox(enemy.x, enemy.z, radius, box))) state.penetrated = true;
}

function beginWindup(state: EncounterSim) {
  const enemy = state.enemy;
  const pattern = PATTERNS[enemy.kind];
  const phase = enemy.kind === "final" ? FINAL_PATTERN.phases?.[enemy.phase] : undefined;
  enemy.state = "windup";
  // Published windups are exact multiples of the fixed step (0.9s → 54).
  enemy.timerSteps = Math.round(pattern.windup / FIXED_DT);
  if (phase && !state.seenPhases.includes(phase.id)) state.seenPhases.push(phase.id);
  state.warnings += 1;
  pushCue(state, "windup");
}

function fixedStep(state: EncounterSim) {
  state.steps += 1;
  const player = state.player;
  const enemy = state.enemy;
  if (player.pose !== "down" && player.hp > 0 && state.steps >= player.poseUntil) {
    player.pose = player.vx !== 0 || player.vz !== 0 ? "walk" : "idle";
  }
  player.focus = Math.min(100, player.focus + FOCUS_REGEN * FIXED_DT);
  const boxes = obstacleBoxes(state);
  const moved = sweepCircle({
    x: player.x,
    z: player.z,
    dx: player.vx * FIXED_DT,
    dz: player.vz * FIXED_DT,
    radius: PLAYER_RADIUS,
    extra: boxes,
  });
  player.x = moved.end.x;
  player.z = moved.end.z;

  if (player.interiorId) {
    enemy.state = enemy.hp <= 0 ? "dead" : "idle";
    return;
  }
  if (enemy.hp <= 0) {
    enemy.state = "dead";
    return;
  }
  const distance = Math.hypot(enemy.x - player.x, enemy.z - player.z);
  const home = Math.hypot(enemy.x - enemy.anchorX, enemy.z - enemy.anchorZ);
  if (distance > FAR_GATE) {
    enemy.state = "idle";
    enemy.timerSteps = 0;
    state.farHold += 1;
    if (state.farHold % FAR_STRIDE === 0) state.aiTicks += 1;
    return;
  }
  state.aiTicks += 1;
  if (enemy.state === "windup") {
    enemy.timerSteps -= 1;
    if (enemy.timerSteps <= 0) {
      resolveStrike(state, distance);
      enemy.state = "recover";
      enemy.timerSteps = Math.round(RECOVER_S / FIXED_DT);
      if (enemy.kind === "final") enemy.phase = enemy.phase === 0 ? 1 : 0;
    }
    return;
  }
  if (enemy.state === "recover") {
    enemy.timerSteps -= 1;
    if (enemy.timerSteps <= 0) enemy.state = "chase";
    return;
  }
  const reach = ENEMY_TYPES[enemy.kind].radius + 2;
  if (distance < reach) {
    beginWindup(state);
    return;
  }
  const chase = distance < AGGRO_RANGE && home < LEASH;
  if (!chase) {
    if (home < HOME_ARRIVE) {
      enemy.state = "idle";
      return;
    }
    enemy.state = "return";
    steerToward(state, enemy.anchorX, enemy.anchorZ);
    return;
  }
  enemy.state = "chase";
  steerToward(state, player.x, player.z);
}

/**
 * One rendered frame. Damage, windup and cues advance only inside clock.step.
 * A pause returns 0 and leaves hp, timers and the accumulator untouched.
 */
export function stepEncounter(state: EncounterSim, frameDt: number): number {
  if (state.paused) {
    if (!state.held) {
      state.clock.pause();
      state.held = true;
    }
    return 0;
  }
  if (state.held) {
    state.clock.resume();
    state.held = false;
  }
  const steps = state.clock.step(frameDt);
  for (let i = 0; i < steps; i += 1) fixedStep(state);
  return steps;
}

export function pumpEncounter(state: EncounterSim, steps: number) {
  for (let i = 0; i < steps; i += 1) stepEncounter(state, FIXED_DT);
}

export type PlayerSwing = "hit" | "miss" | "blocked" | "locked" | "indoor" | "down" | "no-focus";

/** Player swing. The hit query runs on this step; the pose then holds for the lock. */
export function playerAttack(state: EncounterSim, skill = false): PlayerSwing {
  const player = state.player;
  if (player.hp <= 0) {
    player.pose = "down";
    state.lastPlayerHit = "down";
    return "down";
  }
  if (player.interiorId) {
    state.lastPlayerHit = "indoor";
    return "indoor";
  }
  const profile = disciplineOf(state);
  const lock = skill && profile ? castSteps(profile.department.discipline) : ATTACK_STEPS;
  if (state.steps < player.attackReadyStep) {
    state.lastPlayerHit = "locked";
    return "locked";
  }
  if (skill && player.focus < SKILL_FOCUS) {
    state.lastPlayerHit = "no-focus";
    return "no-focus";
  }
  if (skill) player.focus -= SKILL_FOCUS;
  const attackStep = state.steps;
  player.attackStep = attackStep;
  player.attackReadyStep = state.steps + lock;
  player.pose = skill ? "cast" : "attack";
  player.poseUntil = player.attackReadyStep;
  const range = skill && profile ? profile.discipline.range : BASIC_ATTACK_RANGE;
  const enemy = state.enemy;
  const facing = withinAttack(player.x, player.z, player.yaw, enemy.x, enemy.z, range, skill);
  if (!facing || enemy.hp <= 0 || !swingConnects(attackStep, state.steps)) {
    pushCue(state, "miss");
    state.lastPlayerHit = "miss";
    return "miss";
  }
  const boxes = obstacleBoxes(state);
  if (sightBlocked(player.x, player.z, enemy.x, enemy.z, boxes)) {
    const [signal] = resolveHitSignals([
      { targetId: enemy.id, amount: 0, blocked: true },
    ]);
    state.lastSignal = signal.kind;
    state.ledger.apply(state.steps, { [enemy.id]: enemy.hp }, [signal]);
    pushCue(state, "blocked");
    state.lastPlayerHit = "blocked";
    return "blocked";
  }
  const damage =
    skill && profile
      ? profile.discipline.damage
      : basicAttackDamage(player.xp, player.equipped);
  const [signal] = resolveHitSignals([{ targetId: enemy.id, amount: damage }]);
  state.lastSignal = signal.kind;
  const book = state.ledger.apply(state.steps, { [enemy.id]: enemy.hp }, [signal]);
  enemy.hp = Math.max(0, book.hp[enemy.id] ?? enemy.hp);
  pushCue(state, "hit");
  state.lastPlayerHit = "hit";
  if (skill && profile?.department.discipline === "engineering" && enemy.hp > 0) {
    const dx = enemy.x - player.x;
    const dz = enemy.z - player.z;
    const span = Math.hypot(dx, dz) || 1;
    const beforeX = enemy.x;
    const beforeZ = enemy.z;
    const cast = sweepCircle({
      x: enemy.x,
      z: enemy.z,
      dx: (dx / span) * KNOCK_M,
      dz: (dz / span) * KNOCK_M,
      radius: ENEMY_TYPES[enemy.kind].radius,
      extra: boxes,
    });
    enemy.x = cast.end.x;
    enemy.z = cast.end.z;
    state.lastKnock = Math.hypot(enemy.x - beforeX, enemy.z - beforeZ);
  }
  if (skill && profile && ["humanities", "international"].includes(profile.department.discipline)) {
    player.focus = Math.min(100, player.focus + 12);
  }
  if (skill && profile && ["business", "education"].includes(profile.department.discipline)) {
    player.hp = Math.min(player.hpMax, player.hp + 20);
  }
  if (skill && profile?.department.discipline === "education") {
    player.focus = Math.min(100, player.focus + 10);
  }
  if (skill && profile?.department.discipline === "health") {
    player.hp = Math.min(player.hpMax, player.hp + 40);
  }
  if (enemy.hp <= 0) defeatEnemy(state);
  return "hit";
}

export function playerDodge(state: EncounterSim): boolean {
  const player = state.player;
  if (player.hp <= 0 || player.focus < DODGE_FOCUS || state.steps < player.dodgeReadyStep) return false;
  player.focus -= DODGE_FOCUS;
  player.dodgeReadyStep = state.steps + DODGE_STEPS;
  player.iframeUntilStep = state.steps + IFRAME_STEPS;
  player.pose = "dodge";
  player.poseUntil = player.dodgeReadyStep;
  return true;
}

/** Coffee restores the published 45 life. A full bar does not consume the drink. */
export const SUPPLY_HEAL = 45;
export const SUPPLY_FOCUS = 55;

export function useSupply(state: EncounterSim, item: "coffee" | "tea"): boolean {
  const player = state.player;
  if (item === "coffee") {
    if (player.coffee <= 0 || player.hp >= player.hpMax || player.hp <= 0) return false;
    player.coffee -= 1;
    player.hp = Math.min(player.hpMax, player.hp + SUPPLY_HEAL);
    return true;
  }
  if (player.tea <= 0 || player.focus >= 100) return false;
  player.tea -= 1;
  player.focus = Math.min(100, player.focus + SUPPLY_FOCUS);
  return true;
}

/** Respawn after a wipe. A settled final stays dead and does not drop again. */
export function retryEncounter(state: EncounterSim) {
  const player = state.player;
  player.hp = player.hpMax;
  player.pose = "idle";
  player.iframeUntilStep = -1;
  player.attackReadyStep = state.steps;
  player.dodgeReadyStep = state.steps;
  if (state.bossSettled && state.enemy.kind === "final") return;
  state.dropped = false;
  const type = ENEMY_TYPES[state.enemy.kind];
  state.enemy.hp = type.hp;
  state.enemy.x = state.enemy.anchorX;
  state.enemy.z = state.enemy.anchorZ;
  state.enemy.state = "idle";
  state.enemy.timerSteps = 0;
  state.enemy.phase = 0;
  state.path = [];
  state.planned = [];
  state.pathTarget = null;
}

export { SPRINT, POSE_TIMES };
