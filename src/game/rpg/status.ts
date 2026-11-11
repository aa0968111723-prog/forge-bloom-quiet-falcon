/**
 * Pure status readout for the adventure bars.
 * Current, maximum, and change come from one snapshot delta.
 * Life maximum is the shipped maxHp. Level progress uses levelForXp.
 */
import { maxHp } from "./store.ts";
import { levelForXp } from "./rules.ts";

export type StatusCueId = "hurt" | "low" | "recovery" | "level" | "save-error";

export type StatusCue = {
  id: StatusCueId;
  text: string;
  icon: string;
};

/** Words and icons the bars show beside the numbers. */
export const STATUS_CUES: Record<StatusCueId, StatusCue> = {
  hurt: { id: "hurt", text: "受傷", icon: "HeartCrack" },
  low: { id: "low", text: "低生命", icon: "HeartPulse" },
  recovery: { id: "recovery", text: "恢復", icon: "Heart" },
  level: { id: "level", text: "升級", icon: "ArrowUp" },
  "save-error": {
    id: "save-error",
    text: "保存失敗，請匯出備份",
    icon: "CircleAlert",
  },
};

const FOCUS_MAX = 100;

export type StatusSnap = {
  hp: number;
  focus: number;
  xp: number;
  equipped: boolean;
  hurt: boolean;
  saved: string;
};

export type AmountMark = "full" | "zero" | "low" | "steady";

export type AmountClass = {
  full: boolean;
  zero: boolean;
  low: boolean;
  mark: AmountMark;
};

export type BarReadout = {
  current: number;
  max: number;
  fraction: number;
  change: number;
  maxChange: number;
  changeText: string;
  line: string;
  /** Short label drawn on the bar. The long sentence stays in `line` for assistive text. */
  short: string;
  full: boolean;
  zero: boolean;
  low: boolean;
  mark: AmountMark;
  cues: StatusCue[];
  level: number;
};

export type StatusView = {
  life: BarReadout;
  focus: BarReadout;
  progress: BarReadout;
  saveText: string;
  saveCue: StatusCue | null;
};

export function statusSnap(s: {
  hp: number;
  focus: number;
  xp: number;
  equipped: boolean;
  hurtUntil: number;
  clock: number;
  saved: string;
}): StatusSnap {
  return {
    hp: s.hp,
    focus: s.focus,
    xp: s.xp,
    equipped: s.equipped,
    hurt: s.hurtUntil > s.clock,
    saved: s.saved,
  };
}

/**
 * Full means the shown current equals the maximum.
 * Zero means the shown current is 0.
 * Low is the remaining band under a quarter of the maximum.
 * Full and zero are never low.
 */
export function classifyAmount(current: number, max: number): AmountClass {
  const safeMax = Number.isFinite(max) ? Math.max(0, max) : 0;
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const full = safeMax > 0 && safeCurrent === safeMax;
  const zero = safeCurrent === 0;
  const low =
    !full && !zero && safeMax > 0 && safeCurrent > 0 && safeCurrent * 4 <= safeMax;
  const mark: AmountMark = zero ? "zero" : full ? "full" : low ? "low" : "steady";
  return { full, zero, low, mark };
}

export function saveLabel(saved: string) {
  if (saved === "error") return "保存失敗，請匯出備份";
  if (saved === "pending") return "正在保存…";
  return "進度已保存";
}

function signed(value: number) {
  const shown = Object.is(value, -0) ? 0 : value;
  return shown > 0 ? `+${shown}` : String(shown);
}

function changeText(change: number, maxChange: number) {
  return `變化 目前 ${signed(change)} 最大 ${signed(maxChange)}`;
}

function fractionOf(current: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, current / max));
}

/** One decimal at most, so a regen fraction does not spill across the bar. */
function meterCount(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  const clean = Object.is(rounded, -0) ? 0 : rounded;
  return Number.isInteger(clean) ? String(clean) : clean.toFixed(1);
}

function bar(args: {
  label: string;
  current: number;
  max: number;
  change: number;
  maxChange: number;
  cues: StatusCue[];
  level: number;
}): BarReadout {
  const kind = classifyAmount(args.current, args.max);
  const text = changeText(args.change, args.maxChange);
  return {
    current: args.current,
    max: args.max,
    fraction: fractionOf(args.current, args.max),
    change: args.change,
    maxChange: args.maxChange,
    changeText: text,
    line: `${args.label} 目前值 ${args.current} 最大值 ${args.max} ${text}`,
    short: `${args.label === "等級" ? "經驗" : args.label} ${meterCount(args.current)}/${meterCount(args.max)}`,
    full: kind.full,
    zero: kind.zero,
    low: kind.low,
    mark: kind.mark,
    cues: args.cues,
    level: args.level,
  };
}

function shownLife(snap: Pick<StatusSnap, "hp" | "xp" | "equipped">) {
  const max = maxHp({ xp: snap.xp, equipped: snap.equipped });
  const hp = Number.isFinite(snap.hp) ? snap.hp : 0;
  const current = Math.min(Math.max(0, hp), max);
  return { current, max };
}

function shownFocus(focus: number) {
  const value = Number.isFinite(focus) ? focus : 0;
  const current = Math.min(FOCUS_MAX, Math.max(0, value));
  return { current, max: FOCUS_MAX };
}

function shownProgress(xp: number) {
  const level = levelForXp(xp);
  const floor = 60 * (level - 1) ** 2;
  const cap = 60 * level ** 2;
  const max = Math.max(1, cap - floor);
  const current = Math.min(max, Math.max(0, xp - floor));
  return { level, current, max };
}

type LifeSnap = Pick<StatusSnap, "hp" | "xp" | "equipped" | "hurt">;
type FocusSnap = Pick<StatusSnap, "focus">;
type ProgressSnap = Pick<StatusSnap, "xp">;

function lifeSnap(snap: Partial<LifeSnap>): LifeSnap {
  return {
    hp: snap.hp ?? 0,
    xp: snap.xp ?? 0,
    equipped: snap.equipped ?? false,
    hurt: snap.hurt ?? false,
  };
}

function sameLife(a: LifeSnap, b: LifeSnap) {
  return a.hp === b.hp && a.xp === b.xp && a.equipped === b.equipped && a.hurt === b.hurt;
}

/** One argument reads that snapshot. Two arguments read the delta from prev to next. */
export function lifeReadout(next: Partial<LifeSnap>): BarReadout;
export function lifeReadout(prev: Partial<LifeSnap> | null, next: Partial<LifeSnap>): BarReadout;
export function lifeReadout(
  prev: Partial<LifeSnap> | null,
  next?: Partial<LifeSnap>,
): BarReadout {
  const single = next === undefined;
  const resolvedNext = lifeSnap(single ? (prev ?? {}) : next);
  const resolvedPrev = single || !prev ? null : lifeSnap(prev);
  const shown = shownLife(resolvedNext);
  const previous = resolvedPrev ? shownLife(resolvedPrev) : null;
  const change = previous ? shown.current - previous.current : 0;
  const maxChange = previous ? shown.max - previous.max : 0;
  const kind = classifyAmount(shown.current, shown.max);
  const cues: StatusCue[] = [];
  if (resolvedNext.hurt) cues.push(STATUS_CUES.hurt);
  if (kind.low) cues.push(STATUS_CUES.low);
  if (change > 0) cues.push(STATUS_CUES.recovery);
  return bar({
    label: "生命",
    current: shown.current,
    max: shown.max,
    change,
    maxChange,
    cues,
    level: levelForXp(resolvedNext.xp),
  });
}

export function focusReadout(next: Partial<FocusSnap>): BarReadout;
export function focusReadout(prev: Partial<FocusSnap> | null, next: Partial<FocusSnap>): BarReadout;
export function focusReadout(
  prev: Partial<FocusSnap> | null,
  next?: Partial<FocusSnap>,
): BarReadout {
  const single = next === undefined;
  const resolvedNext = single ? (prev ?? {}) : next;
  const resolvedPrev = single ? null : prev;
  const shown = shownFocus(resolvedNext.focus ?? 0);
  const previous = resolvedPrev ? shownFocus(resolvedPrev.focus ?? 0) : null;
  const change = previous ? shown.current - previous.current : 0;
  const maxChange = previous ? shown.max - previous.max : 0;
  const cues: StatusCue[] = [];
  if (change > 0) cues.push(STATUS_CUES.recovery);
  return bar({
    label: "專注",
    current: shown.current,
    max: shown.max,
    change,
    maxChange,
    cues,
    level: 0,
  });
}

export function progressReadout(next: Partial<ProgressSnap>): BarReadout;
export function progressReadout(
  prev: Partial<ProgressSnap> | null,
  next: Partial<ProgressSnap>,
): BarReadout;
export function progressReadout(
  prev: Partial<ProgressSnap> | null,
  next?: Partial<ProgressSnap>,
): BarReadout {
  const single = next === undefined;
  const resolvedNext = single ? (prev ?? {}) : next;
  const resolvedPrev = single ? null : prev;
  const shown = shownProgress(resolvedNext.xp ?? 0);
  const previous = resolvedPrev ? shownProgress(resolvedPrev.xp ?? 0) : null;
  const change = previous ? shown.current - previous.current : 0;
  const maxChange = previous ? shown.max - previous.max : 0;
  const cues: StatusCue[] = [];
  if (previous && shown.level > previous.level) cues.push(STATUS_CUES.level);
  return bar({
    label: "等級",
    current: shown.current,
    max: shown.max,
    change,
    maxChange,
    cues,
    level: shown.level,
  });
}

/** Pause and play share one readout. The phase does not rewrite the numbers. */
export function statusReadout(
  prev: StatusSnap | null,
  next: StatusSnap,
  phase: "playing" | "paused" = "playing",
): StatusView {
  const view: StatusView = {
    life: lifeReadout(prev, next),
    focus: focusReadout(prev, next),
    progress: progressReadout(prev, next),
    saveText: saveLabel(next.saved),
    saveCue: next.saved === "error" ? STATUS_CUES["save-error"] : null,
  };
  return phase === "paused" ? view : view;
}

/**
 * Remembers the last delta. A later call with the same snapshot, such as a
 * parent re-render while paused, keeps current, max, and change.
 */
export function holdLife() {
  let seen: LifeSnap | null = null;
  let view: BarReadout | null = null;
  return (next: Partial<LifeSnap>) => {
    const snap = lifeSnap(next);
    if (view && seen && sameLife(seen, snap)) return view;
    view = lifeReadout(seen, snap);
    seen = snap;
    return view;
  };
}

export function holdFocus() {
  let seen: number | null = null;
  let view: BarReadout | null = null;
  return (next: Partial<FocusSnap>) => {
    const focus = next.focus ?? 0;
    if (view && seen === focus) return view;
    view = focusReadout(seen === null ? null : { focus: seen }, { focus });
    seen = focus;
    return view;
  };
}

export function holdProgress() {
  let seen: number | null = null;
  let view: BarReadout | null = null;
  return (next: Partial<ProgressSnap>) => {
    const xp = next.xp ?? 0;
    if (view && seen === xp) return view;
    view = progressReadout(seen === null ? null : { xp: seen }, { xp });
    seen = xp;
    return view;
  };
}
