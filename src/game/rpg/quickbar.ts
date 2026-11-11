/**
 * Pure quickbar readout.
 * Remaining seconds and progress come from skillUntil, dodgeUntil, and attackUntil against clock.
 * Spans and focus gates are the ones attack() and dodge() already write.
 */
import { maxHp } from "./store.ts";
import { DEPARTMENTS, DISCIPLINES } from "./data.ts";
import { itemVerdict } from "./itemdetail.ts";

/** attack() spends this much focus before a skill. */
const SKILL_FOCUS = 22;
/** dodge() refuses below this much focus. */
const DODGE_FOCUS = 18;
/** attack() writes attackUntil as clock + this span. */
const ATTACK_SPAN = 0.46;
/** dodge() writes dodgeUntil as clock + this span. */
const DODGE_SPAN = 1.25;
export type QuickMark = "ready" | "low-focus" | "full" | "empty" | "scene";

export type QuickSlotId = "attack" | "skill" | "dodge" | "coffee" | "tea";

export type QuickSnap = {
  phase: string;
  plaqueId: string | null;
  panel: string | null;
  hp: number;
  focus: number;
  xp: number;
  equipped: boolean;
  departmentId: string | null;
  buildKind: string | null;
  interiorId: string | null;
  clock: number;
  skillUntil: number;
  dodgeUntil: number;
  attackUntil: number;
  coffee: number;
  tea: number;
};

export type QuickSlotView = {
  id: QuickSlotId;
  label: string;
  key: string;
  seconds: number;
  secondsText: string;
  progress: number;
  mark: QuickMark;
  state: string;
  usable: boolean;
  inUse: boolean;
  count: number | null;
};

export type QuickView = {
  attack: QuickSlotView;
  skill: QuickSlotView;
  dodge: QuickSlotView;
  coffee: QuickSlotView;
  tea: QuickSlotView;
};

const STATE_TEXT: Record<QuickMark, string> = {
  ready: "",
  "low-focus": "專注不足",
  full: "滿狀態",
  empty: "耗盡",
  scene: "場景不可用",
};

function remain(until: number, clock: number): number {
  return Math.max(0, until - clock);
}

function progressOf(seconds: number, span: number): number {
  if (seconds <= 0) return 0;
  if (span <= 0) return 1;
  return Math.min(1, seconds / span);
}

function secondsText(seconds: number): string {
  if (seconds <= 0) return "";
  return Math.ceil(seconds) + " 秒";
}

function skillSpan(departmentId: string | null): number {
  const dept = DEPARTMENTS.find((d) => d.id === departmentId);
  if (!dept) return 0;
  return DISCIPLINES[dept.discipline].cooldown;
}

function attackBlocked(snap: QuickSnap): boolean {
  return (
    snap.phase !== "playing" ||
    Boolean(snap.plaqueId) ||
    Boolean(snap.panel) ||
    snap.hp <= 0 ||
    !snap.departmentId ||
    Boolean(snap.buildKind) ||
    Boolean(snap.interiorId)
  );
}

function dodgeBlocked(snap: QuickSnap): boolean {
  return (
    snap.phase !== "playing" ||
    snap.hp <= 0 ||
    Boolean(snap.buildKind) ||
    Boolean(snap.panel)
  );
}

function itemBlocked(snap: QuickSnap): boolean {
  return snap.phase !== "playing" || snap.hp <= 0 || Boolean(snap.panel);
}

function slot(
  id: QuickSlotId,
  label: string,
  key: string,
  seconds: number,
  span: number,
  mark: QuickMark,
  count: number | null,
): QuickSlotView {
  return {
    id,
    label,
    key,
    seconds,
    secondsText: secondsText(seconds),
    progress: progressOf(seconds, span),
    mark,
    state: STATE_TEXT[mark],
    usable: mark === "ready" && seconds <= 0,
    inUse: seconds > 0,
    count,
  };
}

/** One snapshot of the five quickbar actions. */
export function quickbarReadout(snap: QuickSnap): QuickView {
  const attackLeft = remain(snap.attackUntil, snap.clock);
  const skillLeft = remain(snap.skillUntil, snap.clock);
  const dodgeLeft = remain(snap.dodgeUntil, snap.clock);
  const attackMark: QuickMark = attackBlocked(snap) ? "scene" : "ready";
  const skillMark: QuickMark = attackBlocked(snap)
    ? "scene"
    : snap.focus < SKILL_FOCUS
      ? "low-focus"
      : "ready";
  const dodgeMark: QuickMark = dodgeBlocked(snap)
    ? "scene"
    : snap.focus < DODGE_FOCUS
      ? "low-focus"
      : "ready";
  const coffeeVerdict = itemVerdict({
    id: "coffee",
    count: snap.coffee,
    hp: snap.hp,
    maxLife: maxHp(snap),
    focus: snap.focus,
    action: "use",
  });
  const teaVerdict = itemVerdict({
    id: "tea",
    count: snap.tea,
    hp: snap.hp,
    maxLife: maxHp(snap),
    focus: snap.focus,
    action: "use",
  });
  const coffeeMark: QuickMark = itemBlocked(snap) ? "scene" : coffeeVerdict.mark;
  const teaMark: QuickMark = itemBlocked(snap) ? "scene" : teaVerdict.mark;
  return {
    attack: slot("attack", "普攻", "J", attackLeft, ATTACK_SPAN, attackMark, null),
    skill: slot("skill", "技能", "Q", skillLeft, skillSpan(snap.departmentId), skillMark, null),
    dodge: slot("dodge", "閃避", "Space", dodgeLeft, DODGE_SPAN, dodgeMark, null),
    coffee: slot("coffee", "咖啡", "1", 0, 0, coffeeMark, snap.coffee),
    tea: slot("tea", "茶", "2", 0, 0, teaMark, snap.tea),
  };
}
