/**
 * One chrome scale for the adventure HUD, panels, dialogs, and world signs.
 * Surfaces read this module. Low quality and reduced motion only narrow the
 * budget; they do not invent a second palette or a second layout.
 */
import { TIME_PRESETS, type TimeOfDay } from "../world-data/lighting.ts";

export type { TimeOfDay };
export { TIME_PRESETS };

export type ChromeTier = "high" | "low";

export type ChromeSurface = "title" | "hud" | "backpack" | "map" | "dialog" | "sign";

export type ChromeRole = "hud" | "panel" | "dialog" | "sign";

export type ChromeCondition = {
  time: TimeOfDay;
  tier: ChromeTier;
};

/** Shared steps. Primary labels on every surface use the primary step. */
export const CHROME_SCALE = {
  depth: { decor: 0, readout: 2, hud: 3, panel: 4, dialog: 6 },
  material: "paper",
  lightEdge: "#9a7340",
  type: { primary: 16, display: 3 },
  spacing: { primary: 12 },
  state: { idle: "idle", focus: "focus", disabled: "disabled" },
  ink: "#102e32",
  backing: "#f4efe2",
  /** Translucent, so contrast is judged after compositing over the sky. */
  alpha: 0.94,
} as const;

export const CHROME_SURFACES = ["title", "hud", "backpack", "map"] as const;

export type PrimaryLabel = {
  depth: number;
  material: string;
  lightEdge: string;
  typeSize: number;
  spacing: number;
  state: string;
  ink: string;
  backing: string;
  alpha: number;
};

export type ChromeBudget = {
  layers: number;
  blur: number;
  shadow: number;
  motion: number;
};

const FULL_BUDGET: ChromeBudget = { layers: 3, blur: 8, shadow: 28, motion: 1 };
const CHEAP_BUDGET: ChromeBudget = { layers: 1, blur: 0, shadow: 0, motion: 0 };

/** Body and primary text pass only at this contrast ratio or higher. */
export const READABLE_CONTRAST = 4.5;

/**
 * Labels the player can operate. Quality and reduced motion do not change them.
 */
export const CHROME_CONTROLS = {
  continueSemester: "繼續學期",
  startSemester: "開始學期",
  settings: "遊戲設定",
  inventory: "背包",
  skills: "科系技能",
  build: "建造",
  journal: "學期委託",
  map: "校園地圖",
  openMap: "開啟校園地圖",
  close: "關閉",
  explore: "繼續探索",
  run: "奔跑",
  dodge: "閃避",
  interact: "E 互動",
  look: "轉動視角",
  stick: "移動搖桿",
  floorDown: "下一樓",
  floorUp: "上一樓",
  exitCampus: "返回校園",
} as const;

export function controlLabels(
  _tier: ChromeTier = "high",
  _reducedMotion = false,
): string[] {
  return Object.values(CHROME_CONTROLS);
}

export function surfaceRole(surface: ChromeSurface): ChromeRole {
  if (surface === "hud") return "hud";
  if (surface === "dialog") return "dialog";
  if (surface === "sign") return "sign";
  return "panel";
}

/**
 * World signs may sit in the scene as markers. The wording a player must read
 * stays in the DOM plaque and dialog.
 */
export function signHost(): { marker: "scene"; wording: "dom" } {
  return { marker: "scene", wording: "dom" };
}

export function chromeDepth(): {
  decor: { depth: number; pointerEvents: "none" };
  readout: { depth: number; pointerEvents: "none" };
} {
  return {
    decor: { depth: CHROME_SCALE.depth.decor, pointerEvents: "none" },
    readout: { depth: CHROME_SCALE.depth.readout, pointerEvents: "none" },
  };
}

export function skyFor(time: TimeOfDay): string {
  return TIME_PRESETS[time].sky;
}

function assertCondition(condition: ChromeCondition) {
  if (!TIME_PRESETS[condition.time]) throw new Error("unknown chrome time");
  if (condition.tier !== "high" && condition.tier !== "low")
    throw new Error("unknown chrome tier");
}

/** Same primary label for every surface under a condition. */
export function primaryLabel(
  surface: ChromeSurface,
  condition: ChromeCondition,
): PrimaryLabel {
  assertCondition(condition);
  surfaceRole(surface);
  return {
    depth: CHROME_SCALE.depth.readout,
    material: CHROME_SCALE.material,
    lightEdge: CHROME_SCALE.lightEdge,
    typeSize: CHROME_SCALE.type.primary,
    spacing: CHROME_SCALE.spacing.primary,
    state: CHROME_SCALE.state.idle,
    ink: CHROME_SCALE.ink,
    backing: CHROME_SCALE.backing,
    alpha: CHROME_SCALE.alpha,
  };
}

export function chromeBudget(tier: ChromeTier, reducedMotion = false): ChromeBudget {
  if (tier !== "high" && tier !== "low") throw new Error("unknown chrome tier");
  if (tier === "low" || reducedMotion) return { ...CHEAP_BUDGET };
  return { ...FULL_BUDGET };
}

function channel(hex: string, index: number): number {
  const h = hex.replace("#", "");
  const wide = h.length === 3 ? h[index] + h[index] : h.slice(index * 2, index * 2 + 2);
  return parseInt(wide, 16);
}

function linear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * linear(channel(hex, 0)) +
    0.7152 * linear(channel(hex, 1)) +
    0.0722 * linear(channel(hex, 2))
  );
}

/** Composite a translucent backing over a sky color. Alpha 1 leaves the backing. */
export function composite(backing: string, sky: string, alpha: number): string {
  const a = Math.min(1, Math.max(0, alpha));
  const mix = (index: number) =>
    Math.round(a * channel(backing, index) + (1 - a) * channel(sky, index));
  return (
    "#" +
    [mix(0), mix(1), mix(2)].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
}

export function contrast(text: string, plate: string): number {
  const hi = Math.max(luminance(text), luminance(plate));
  const lo = Math.min(luminance(text), luminance(plate));
  return (hi + 0.05) / (lo + 0.05);
}

/** True only when the composited pair reaches the body-text ratio. */
export function readable(
  text: string,
  backing: string,
  sky: string,
  alpha: number,
): boolean {
  return contrast(text, composite(backing, sky, alpha)) >= READABLE_CONTRAST;
}

function plateColor(backing: string, alpha: number): string {
  return `rgba(${channel(backing, 0)}, ${channel(backing, 1)}, ${channel(backing, 2)}, ${alpha})`;
}

/** CSS variables the adventure stylesheet spends. One budget, no second pass. */
export function chromeVars(
  condition: ChromeCondition,
  reducedMotion = false,
): Record<`--${string}`, string> {
  const surfaces: ChromeSurface[] = ["title", "hud", "backpack", "map", "dialog", "sign"];
  const label = primaryLabel(surfaces[0], condition);
  for (const surface of surfaces) {
    const other = primaryLabel(surface, condition);
    if (
      other.typeSize !== label.typeSize ||
      other.spacing !== label.spacing ||
      other.lightEdge !== label.lightEdge ||
      other.material !== label.material ||
      other.state !== label.state ||
      other.depth !== label.depth ||
      other.ink !== label.ink ||
      other.backing !== label.backing ||
      other.alpha !== label.alpha
    ) {
      throw new Error("chrome scale diverged");
    }
  }
  const budget = chromeBudget(condition.tier, reducedMotion);
  const depth = chromeDepth();
  return {
    "--ad-ink": label.ink,
    "--ad-paper": label.backing,
    "--ad-on-ink": label.backing,
    "--ad-plate": plateColor(label.backing, label.alpha),
    "--ad-alpha": String(label.alpha),
    "--ad-edge": label.lightEdge,
    "--ad-type": `${label.typeSize}px`,
    "--ad-display": String(CHROME_SCALE.type.display),
    "--ad-space": `${label.spacing}px`,
    "--ad-state": label.state,
    "--ad-depth-decor": String(depth.decor.depth),
    "--ad-depth-readout": String(depth.readout.depth),
    "--ad-layers": String(budget.layers),
    "--ad-blur": `${budget.blur}px`,
    "--ad-shadow": `${budget.shadow}px`,
    "--ad-motion": String(budget.motion),
    "--ad-show-material": budget.layers >= 2 ? "block" : "none",
    "--ad-show-edge": budget.layers >= 3 ? "block" : "none",
  };
}

/** Reusable raised pieces. The face does not change with the piece. */
export const PRESS_PIECES = ["button", "icon", "card", "key", "overlay"] as const;

/** 可按、按下、選取、焦點、禁用、等待. */
export const PRESS_STATES = [
  "ready",
  "pressed",
  "selected",
  "focus",
  "disabled",
  "waiting",
] as const;

/**
 * Style-table roles. Visible copy stays on the existing actions:
 * 確認 is 保留現有進度, 取消 is 關閉, 返回 is 返回校園, 匯入 is 匯入存檔.
 */
export const PRESS_ROLES = {
  confirm: "保留現有進度",
  cancel: "關閉",
  back: "返回校園",
  import: "匯入存檔",
} as const;

export type PressPiece = (typeof PRESS_PIECES)[number];
export type PressState = (typeof PRESS_STATES)[number];
export type PressRole = keyof typeof PRESS_ROLES;

export type PressFace = {
  piece: PressPiece;
  state: PressState;
  role: PressRole | null;
  label: string;
  thickness: number;
  light: string;
  sheen: number;
  shift: number;
  activatable: boolean;
  budget: ChromeBudget;
};

const PRESS_FACE: Record<
  PressState,
  { thickness: number; light: string; sheen: number; shift: number; activatable: boolean }
> = {
  ready: { thickness: 4, light: "crest", sheen: 0.55, shift: 0, activatable: true },
  pressed: { thickness: 1, light: "seat", sheen: 0.08, shift: 3, activatable: true },
  selected: { thickness: 5, light: "band", sheen: 0.72, shift: 1, activatable: true },
  focus: { thickness: 6, light: "rim", sheen: 0.9, shift: 0, activatable: true },
  disabled: { thickness: 2, light: "dim", sheen: 0.16, shift: 0, activatable: false },
  waiting: { thickness: 3, light: "hold", sheen: 0.4, shift: 0, activatable: false },
};

const PRESS_CONTROLS = new Set<PressPiece>(["button", "icon"]);

function assertPress(piece: string, state: string, role?: string) {
  if (!(PRESS_PIECES as readonly string[]).includes(piece))
    throw new Error("unknown press piece");
  if (!(PRESS_STATES as readonly string[]).includes(state))
    throw new Error("unknown press state");
  if (role !== undefined && !(role in PRESS_ROLES)) throw new Error("unknown press role");
}

/**
 * One press language for every piece and role under a condition.
 * The short shift is the face displacement times the shared motion budget,
 * so low quality and reduced motion zero it without a second table.
 */
export function pressFace(
  piece: PressPiece,
  state: PressState,
  condition: ChromeCondition,
  reducedMotion = false,
  role?: PressRole,
): PressFace {
  assertCondition(condition);
  assertPress(piece, state, role);
  const face = PRESS_FACE[state];
  const budget = chromeBudget(condition.tier, reducedMotion);
  return {
    piece,
    state,
    role: role ?? null,
    label: role ? PRESS_ROLES[role] : "",
    thickness: face.thickness,
    light: face.light,
    sheen: face.sheen,
    shift: face.shift * budget.motion,
    activatable: face.activatable,
    budget,
  };
}

export type PressAttrs = {
  "data-piece": PressPiece;
  "data-press": PressState;
  "data-role"?: PressRole;
  disabled?: true;
  "aria-disabled"?: true;
  "aria-busy"?: true;
  "aria-pressed"?: true;
};

/** Native button and icon attributes. 禁用 and 等待 cannot activate. */
export function pressAttrs(
  piece: PressPiece,
  state: PressState,
  role?: PressRole,
): PressAttrs {
  const face = pressFace(piece, state, { time: "day", tier: "high" }, false, role);
  const attrs: PressAttrs = {
    "data-piece": piece,
    "data-press": state,
  };
  if (role) attrs["data-role"] = role;
  if (!face.activatable) {
    attrs["aria-disabled"] = true;
    if (PRESS_CONTROLS.has(piece)) attrs.disabled = true;
    if (state === "waiting") attrs["aria-busy"] = true;
  }
  if (state === "selected") attrs["aria-pressed"] = true;
  return attrs;
}

/** Marks and overlays stay out of the button disabled attribute. */
export function pressMark(
  piece: PressPiece,
  state: PressState,
  role?: PressRole,
): Omit<PressAttrs, "disabled"> {
  const attrs = pressAttrs(piece, state, role);
  return {
    "data-piece": attrs["data-piece"],
    "data-press": attrs["data-press"],
    ...(attrs["data-role"] ? { "data-role": attrs["data-role"] } : {}),
    ...(attrs["aria-disabled"] ? { "aria-disabled": true as const } : {}),
    ...(attrs["aria-busy"] ? { "aria-busy": true as const } : {}),
    ...(attrs["aria-pressed"] ? { "aria-pressed": true as const } : {}),
  };
}
