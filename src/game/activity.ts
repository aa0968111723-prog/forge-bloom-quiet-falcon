import { input as pilgrimageInput } from "./input";
import { input as rpgInput } from "./rpg/input";
import { resolveBuildings, type Building } from "./rpg/rules";
import { SPAWN } from "./world";

/**
 * title ──continue──▶ playing
 * title ──continue, hp 0──▶ downed
 * title ──no major──▶ panel
 * playing ──pause / plaque──▶ paused
 * paused ──resume──▶ playing
 * playing ──panel──▶ panel ──close──▶ playing
 * playing ──enter──▶ indoor ──exit──▶ playing
 * playing | paused | panel | indoor ──travel──▶ playing
 * playing | indoor ──hp 0──▶ downed ──respawn──▶ playing
 * playing ──boss, reward unclaimed──▶ victory ──claim──▶ playing
 * any ──graphics──▶ same mode, same pose
 *
 * Play, pause and pilgrimage all call settlePlay. A relocate or a defeat
 * drops queued combat keys, the build ghost, charge and mercy timers, and
 * replaces any warp with the destination of this transition.
 */
export const PLAY_MODES = [
  "title",
  "playing",
  "paused",
  "panel",
  "indoor",
  "downed",
  "victory",
] as const;
export type PlayMode = (typeof PLAY_MODES)[number];

export const TRANSITIONS: {
  id: string;
  from: PlayMode[];
  to: PlayMode | "same";
}[] = [
  { id: "continue", from: ["title"], to: "playing" },
  { id: "continue-downed", from: ["title"], to: "downed" },
  { id: "pause", from: ["playing", "indoor"], to: "paused" },
  { id: "plaque", from: ["playing"], to: "paused" },
  { id: "resume", from: ["paused"], to: "playing" },
  { id: "open-panel", from: ["playing", "paused", "indoor"], to: "panel" },
  { id: "close-panel", from: ["panel"], to: "playing" },
  { id: "enter", from: ["playing"], to: "indoor" },
  { id: "exit", from: ["indoor"], to: "playing" },
  {
    id: "travel",
    from: ["playing", "paused", "panel", "indoor"],
    to: "playing",
  },
  { id: "down", from: ["playing", "indoor"], to: "downed" },
  { id: "respawn", from: ["downed"], to: "playing" },
  { id: "victory", from: ["playing"], to: "victory" },
  { id: "claim", from: ["victory"], to: "playing" },
  { id: "graphics", from: [...PLAY_MODES], to: "same" },
];

export type Pose = { x: number; z: number; yaw: number };

export function playMode(s: {
  phase: string;
  plaqueId: string | null;
  panel: string | null;
  interiorId: string | null;
  hp: number;
  boss: number;
  claimed: readonly string[];
}): PlayMode {
  if (s.phase === "title" || s.phase === "setup")
    return s.panel ? "panel" : "title";
  if (s.hp <= 0) return "downed";
  if (s.boss > 0 && !s.claimed.includes("semester")) return "victory";
  if (s.panel) return "panel";
  if (s.phase === "paused" || s.phase === "codex" || s.plaqueId) return "paused";
  if (s.interiorId) return "indoor";
  return "playing";
}

function angleNear(a: number, b: number) {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 0.02;
}

/** Keep a warp only when it is already the live pose. Anything else is stale. */
export function keptWarp(warp: Pose | null, pose: Pose): Pose | null {
  if (!warp) return null;
  if (Math.hypot(warp.x - pose.x, warp.z - pose.z) >= 0.05) return null;
  if (!angleNear(warp.yaw, pose.yaw)) return null;
  return warp;
}

export type SettleKind = "suspend" | "relocate" | "downed";

let settleRpg: (kind: SettleKind) => void = () => {};

export function registerPlaySettle(fn: (kind: SettleKind) => void) {
  settleRpg = fn;
}

export function settlePlay(kind: SettleKind) {
  const movement = kind !== "suspend";
  rpgInput.releaseEdges(movement);
  pilgrimageInput.releaseEdges(movement);
  settleRpg(kind);
}

export function calmWindups(
  enemies: { hp: number; state: string; timer: number }[],
) {
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    if (enemy.state === "windup" || enemy.state === "recover") {
      enemy.state = "idle";
      enemy.timer = 0;
    }
  }
}

const BODY_RADIUS = 0.42;

/**
 * Slope-foot apron, pushed out of buildings and living enemies.
 * South is +z, away from the climb.
 */
export function safeSlopeStand(
  buildings: Building[],
  threats: { x: number; z: number; reach: number }[],
): Pose {
  let x: number = SPAWN.x;
  let z: number = SPAWN.z;
  let last = resolveBuildings(x, z, BODY_RADIUS, buildings);
  for (let i = 0; i < 6; i++) {
    const p = resolveBuildings(x, z, BODY_RADIUS, buildings);
    last = p;
    const crowded = threats.some(
      (t) => Math.hypot(p.x - t.x, p.z - t.z) < t.reach,
    );
    const pushed = Math.hypot(p.x - x, p.z - z) > 0.05;
    if (!crowded && !pushed) return { x: p.x, z: p.z, yaw: 0 };
    x = p.x;
    z = p.z + (crowded ? 4 : 1.5);
  }
  return { x: last.x, z: last.z, yaw: 0 };
}
