import type { CssRect, SafeInsets } from "../touch-layout.ts";
import { intersects } from "./rects.ts";

export type ToolbarInsets = { top: number; bottom: number };

export type KeyboardOpenLayout = {
  keyboardOpen: boolean;
  /** Search focus must not reach gameplay hotkeys. */
  hotkeysSuspended: boolean;
  frame: CssRect;
  search: CssRect | null;
  confirm: CssRect;
  close: CssRect;
  scroll: CssRect;
};

const GAP = 8;
const TAP = 44;

/**
 * Visible frame after safe-area, the dynamic browser toolbar, and the soft keyboard.
 * Toolbar and keyboard insets stack on top of the safe area.
 */
export function visibleFrame(input: {
  width: number;
  height: number;
  insets: SafeInsets;
  keyboardHeight: number;
  toolbar: ToolbarInsets;
}): CssRect {
  const top = input.insets.top + Math.max(0, input.toolbar.top);
  const bottomCut =
    input.insets.bottom + Math.max(0, input.toolbar.bottom) + Math.max(0, input.keyboardHeight);
  return {
    x: input.insets.left,
    y: top,
    w: Math.max(0, input.width - input.insets.left - input.insets.right),
    h: Math.max(0, input.height - top - bottomCut),
  };
}

/**
 * Department search sheet while the soft keyboard or browser toolbar changes.
 * Confirm and close stay inside the visible frame. Search is omitted only when
 * the leftover band cannot hold a 44px field, and hotkeys stay suspended whenever
 * the keyboard is open.
 */
export function keyboardOpenLayout(input: {
  width: number;
  height: number;
  insets: SafeInsets;
  keyboardHeight: number;
  toolbar: ToolbarInsets;
}): KeyboardOpenLayout {
  const keyboardOpen = input.keyboardHeight > 0;
  const frame = visibleFrame(input);
  const buttonH = Math.min(TAP, frame.h);
  const y = frame.y + frame.h - buttonH;
  const each = Math.floor((frame.w - GAP) / 2);
  const confirm: CssRect = { x: frame.x, y, w: Math.max(0, each), h: buttonH };
  const close: CssRect = {
    x: frame.x + confirm.w + GAP,
    y,
    w: Math.max(0, frame.w - GAP - confirm.w),
    h: buttonH,
  };
  const room = y - GAP - frame.y;
  const search: CssRect | null =
    room >= TAP
      ? { x: frame.x, y: frame.y, w: frame.w, h: TAP }
      : null;
  const scrollTop = (search ? search.y + search.h : frame.y) + GAP;
  const scrollH = Math.max(0, y - GAP - scrollTop);
  const scroll: CssRect = { x: frame.x, y: scrollTop, w: frame.w, h: scrollH };
  return {
    keyboardOpen,
    hotkeysSuspended: keyboardOpen,
    frame,
    search,
    confirm,
    close,
    scroll,
  };
}

export function keyboardControlsClear(layout: KeyboardOpenLayout): string | null {
  const frame = layout.frame;
  for (const [id, rect] of [
    ["confirm", layout.confirm],
    ["close", layout.close],
  ] as const) {
    if (rect.w < TAP || rect.h < TAP) return `${id} is under 44 (${rect.w}×${rect.h})`;
    if (rect.x < frame.x || rect.y < frame.y) return `${id} is outside the visible frame`;
    if (rect.x + rect.w > frame.x + frame.w || rect.y + rect.h > frame.y + frame.h) {
      return `${id} is outside the visible frame`;
    }
  }
  if (intersects(layout.confirm, layout.close)) return "confirm intersects close";
  if (layout.search && intersects(layout.search, layout.confirm)) return "search intersects confirm";
  if (layout.search && intersects(layout.search, layout.close)) return "search intersects close";
  return null;
}
