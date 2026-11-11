export type MobileSave = "ok" | "pending" | "error" | string;

export type MobileStatusInput = {
  life: number;
  lifeMax: number;
  focus: number;
  focusMax: number;
  level: number;
  saved: MobileSave;
};

export type CompactStatus = {
  visibleLife: string;
  visibleFocus: string;
  visibleLevel: string;
  visibleSave: string;
  ariaLife: string;
  ariaFocus: string;
  ariaLevel: string;
  ariaSave: string;
  /** Numeric changes must not resize the HUD. */
  relayout: false;
};

const SAVE_SHORT: Record<string, string> = {
  error: "保存失敗",
  pending: "保存中",
  ok: "已保存",
  "保存失敗，請匯出備份": "保存失敗",
  "正在保存…": "保存中",
  "進度已保存": "已保存",
};

const SAVE_FULL: Record<string, string> = {
  error: "保存失敗，請匯出備份",
  pending: "正在保存…",
  ok: "進度已保存",
  "保存失敗，請匯出備份": "保存失敗，請匯出備份",
  "正在保存…": "正在保存…",
  "進度已保存": "進度已保存",
};

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/**
 * One visible row: life, focus, level, short save.
 * Assistive text still names the current value and the maximum.
 */
export function compactStatus(input: MobileStatusInput): CompactStatus {
  const life = finite(input.life);
  const lifeMax = finite(input.lifeMax);
  const focus = finite(input.focus);
  const focusMax = finite(input.focusMax);
  const level = finite(input.level);
  const saved = input.saved;
  return {
    visibleLife: `${life}/${lifeMax}`,
    visibleFocus: `${focus}/${focusMax}`,
    visibleLevel: `等級 ${level}`,
    visibleSave: SAVE_SHORT[saved] ?? "已保存",
    ariaLife: `生命 目前值 ${life} 最大值 ${lifeMax}`,
    ariaFocus: `專注 目前值 ${focus} 最大值 ${focusMax}`,
    ariaLevel: `等級 目前值 ${level}`,
    ariaSave: SAVE_FULL[saved] ?? "進度已保存",
    relayout: false,
  };
}
