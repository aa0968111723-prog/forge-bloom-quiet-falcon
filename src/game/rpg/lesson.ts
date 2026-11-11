import { SPAWN } from "../world";
import { SUPPLY_NODES } from "./campus.ts";
import { input } from "./input";
import { moveTargetSpeed } from "./move";
import { SUPPLY_REACH } from "./prompts.ts";
import { resolveBuildings } from "./rules.ts";
import {
  noteLesson,
  useRpg,
  type LessonMark,
} from "./store";
import { useGame } from "../store";

/** Metres ahead of the step's start that the move marker stands. */
const MOVE_SPAN = 5;
/** Prompt radius around a move or attack marker. Arrival is tighter than this. */
const MOVE_PROMPT = 4;
const MOVE_ARRIVE = 1.6;
const ATTACK_PROMPT = 6;

const OBJECTIVES: Record<Exclude<LessonMark, "done">, string> = {
  department: "選系",
  move: "移動",
  supply: "靠近補給",
  attack: "第一次普攻",
  skill: "第一次科系技能",
};

const PROMPTS: Record<Exclude<LessonMark, "done">, string> = {
  department: "點一個科系",
  move: "走到地圖標記",
  supply: "這是補給",
  attack: "打出這一擊",
  skill: "放出這一招",
};

export const LESSON_REMINDER =
  "搖桿移動。畫面上的普攻、科系技能、閃避和互動按鈕就能完成，不需要實體鍵。";

export type LessonReadout = {
  step: Exclude<LessonMark, "done"> | null;
  objective: string | null;
  prompt: string | null;
  marker: { x: number; z: number } | null;
  review: boolean;
  reminder: string | null;
};

function moveMarker(anchor: { x: number; z: number }) {
  return { x: anchor.x, z: anchor.z - MOVE_SPAN };
}

function nearestSupply(x: number, z: number) {
  let best = SUPPLY_NODES[0];
  let bestDistance = Infinity;
  for (const node of SUPPLY_NODES) {
    const distance = Math.hypot(node.x - x, node.z - z);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return { node: best, distance: bestDistance };
}

function nearestEnemy(x: number, z: number) {
  let best: { x: number; z: number } | null = null;
  let bestDistance = Infinity;
  for (const enemy of useRpg.getState().enemies) {
    if (enemy.hp <= 0) continue;
    const distance = Math.hypot(enemy.x - x, enemy.z - z);
    if (distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best ? { enemy: best, distance: bestDistance } : null;
}

/** One current step, its marker, and a prompt only while the player is close. */
export function lessonReadout(): LessonReadout {
  const rpg = useRpg.getState();
  const game = useGame.getState();
  const review = rpg.lessonReview && rpg.lesson === "done";
  const reminder = review ? LESSON_REMINDER : null;
  if (rpg.lesson === "done")
    return {
      step: null,
      objective: null,
      prompt: null,
      marker: null,
      review,
      reminder,
    };
  const step = rpg.lesson;
  const objective = OBJECTIVES[step];
  let marker: { x: number; z: number } = { x: SPAWN.x, z: SPAWN.z };
  let near = false;
  if (step === "department") {
    marker = { x: SPAWN.x, z: SPAWN.z };
    near =
      rpg.panel === "department" ||
      Math.hypot(game.playerX - marker.x, game.playerZ - marker.z) < MOVE_PROMPT;
  } else if (step === "move") {
    const anchor = rpg.lessonAnchor ?? { x: game.playerX, z: game.playerZ };
    marker = moveMarker(anchor);
    near = Math.hypot(game.playerX - marker.x, game.playerZ - marker.z) < MOVE_PROMPT;
  } else if (step === "supply") {
    const supply = nearestSupply(game.playerX, game.playerZ);
    marker = { x: supply.node.x, z: supply.node.z };
    near = supply.distance < SUPPLY_REACH;
  } else {
    const foe = nearestEnemy(game.playerX, game.playerZ);
    marker = foe
      ? { x: foe.enemy.x, z: foe.enemy.z }
      : { x: game.playerX, z: game.playerZ };
    near = foe ? foe.distance < ATTACK_PROMPT : false;
  }
  return {
    step,
    objective,
    prompt: near ? PROMPTS[step] : null,
    marker,
    review: false,
    reminder: null,
  };
}

function observeMove(x: number, z: number) {
  const rpg = useRpg.getState();
  if (rpg.lesson !== "move") return;
  if (!rpg.lessonAnchor) {
    useRpg.setState({ lessonAnchor: { x, z } });
    return;
  }
  const marker = moveMarker(rpg.lessonAnchor);
  if (Math.hypot(marker.x - x, marker.z - z) <= MOVE_ARRIVE) noteLesson("move");
}

/** Record that the player is actually inside the supply the game already uses. */
export function observeSupply() {
  const rpg = useRpg.getState();
  if (rpg.lesson !== "supply") return false;
  const game = useGame.getState();
  if (nearestSupply(game.playerX, game.playerZ).distance >= SUPPLY_REACH) return false;
  noteLesson("supply");
  return true;
}

/** End the required sequence. Ordinary exploration stays where it is. */
export function skipLesson() {
  const rpg = useRpg.getState();
  if (rpg.lesson === "done") return;
  useRpg.setState({ lesson: "done", lessonAnchor: null, lessonReview: false });
}

/** Show the control reminder without starting the sequence again. */
export function openLessonReview() {
  if (useRpg.getState().lesson !== "done") return;
  const game = useGame.getState();
  useRpg.setState({ lessonReview: true });
  useGame.setState({
    settingsOpen: false,
    playerX: game.playerX,
    playerZ: game.playerZ,
    playerYaw: game.playerYaw,
  });
}

export function closeLessonReview() {
  const game = useGame.getState();
  useRpg.setState({ lessonReview: false });
  useGame.setState({
    playerX: game.playerX,
    playerZ: game.playerZ,
    playerYaw: game.playerYaw,
    phase: game.phase,
  });
}

/** The on-screen attack and skill buttons. */
export function touchStrike(skill = false) {
  useRpg.getState().attack(skill);
}

/**
 * One walked step from the touch stick (or keys) already held in the sampler.
 * A zero deflection leaves the pose where it is.
 */
export function stepTouchWalk(delta: number) {
  const step = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.25) : 0;
  if (step <= 0) return false;
  const actions = input.sample();
  if (Math.hypot(actions.moveX, actions.moveY) < 0.01) return false;
  const game = useGame.getState();
  if (game.phase !== "playing" || game.plaqueId) return false;
  const rpg = useRpg.getState();
  if (rpg.panel || rpg.hp <= 0) return false;
  const speed = moveTargetSpeed(actions.moveX, actions.moveY, actions.sprint);
  const yaw = game.playerYaw;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const dx = fx * actions.moveY + rx * actions.moveX;
  const dz = fz * actions.moveY + rz * actions.moveX;
  const mag = Math.hypot(dx, dz);
  if (mag < 0.001 || speed <= 0) return false;
  const dist = speed * step;
  const resolved = resolveBuildings(
    game.playerX + (dx / mag) * dist,
    game.playerZ + (dz / mag) * dist,
    0.42,
    rpg.buildings,
  );
  if (Math.hypot(resolved.x - game.playerX, resolved.z - game.playerZ) < 0.02)
    return false;
  useGame.getState().setPlayer(resolved.x, resolved.z, yaw);
  return true;
}

useGame.subscribe((state, prev) => {
  if (state.warp) return;
  if (state.playerX === prev.playerX && state.playerZ === prev.playerZ) return;
  observeMove(state.playerX, state.playerZ);
});
