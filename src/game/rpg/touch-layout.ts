export type CssRect = { x: number; y: number; w: number; h: number };

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TouchLayout = {
  stick: CssRect;
  look: CssRect;
  sprint: CssRect;
  dodge: CssRect;
  interact: CssRect;
};

/** Outer stick hit target. The analog radius lives on the input sampler. */
export const TOUCH_STICK = 112;
export const TOUCH_BUTTON = { w: 72, h: 48 };
const PAD = 8;
const GAP = 8;

/**
 * Hit rects in CSS pixels for one viewport.
 * `insets` are the safe-area insets already resolved to pixels.
 * Stick stays bottom-left, the three holds stack bottom-right, and look
 * fills the gap so a thumb on the stick does not cover the view drag.
 */
export function touchLayout(
  width: number,
  height: number,
  insets: SafeInsets,
): TouchLayout {
  const safeLeft = insets.left;
  const safeTop = insets.top;
  const safeRight = width - insets.right;
  const safeBottom = height - insets.bottom;
  const stick: CssRect = {
    x: safeLeft + PAD,
    y: safeBottom - PAD - TOUCH_STICK,
    w: TOUCH_STICK,
    h: TOUCH_STICK,
  };
  const colX = safeRight - PAD - TOUCH_BUTTON.w;
  const interact: CssRect = {
    x: colX,
    y: safeBottom - PAD - TOUCH_BUTTON.h,
    w: TOUCH_BUTTON.w,
    h: TOUCH_BUTTON.h,
  };
  const dodge: CssRect = {
    x: colX,
    y: interact.y - GAP - TOUCH_BUTTON.h,
    w: TOUCH_BUTTON.w,
    h: TOUCH_BUTTON.h,
  };
  const sprint: CssRect = {
    x: colX,
    y: dodge.y - GAP - TOUCH_BUTTON.h,
    w: TOUCH_BUTTON.w,
    h: TOUCH_BUTTON.h,
  };
  const look: CssRect = {
    x: stick.x + stick.w + GAP,
    y: safeTop + PAD,
    w: colX - GAP - (stick.x + stick.w + GAP),
    h: sprint.y - GAP - (safeTop + PAD),
  };
  return { stick, look, sprint, dodge, interact };
}

export type QuickbarPlacement = {
  bar: CssRect;
  slots: CssRect[];
};

const QUICK_SLOTS = 5;
const QUICK_GAP = 8;
const QUICK_MIN = 44;
const QUICK_PREFERRED = 96;

function packVertical(strip: CssRect): QuickbarPlacement {
  const slotH = Math.min(
    QUICK_PREFERRED,
    Math.floor((strip.h - QUICK_GAP * (QUICK_SLOTS - 1)) / QUICK_SLOTS),
  );
  const stackH = slotH * QUICK_SLOTS + QUICK_GAP * (QUICK_SLOTS - 1);
  const bar = {
    x: strip.x,
    y: strip.y + strip.h - stackH,
    w: strip.w,
    h: stackH,
  };
  const slots = Array.from({ length: QUICK_SLOTS }, (_, index) => ({
    x: bar.x,
    y: bar.y + index * (slotH + QUICK_GAP),
    w: bar.w,
    h: slotH,
  }));
  return { bar, slots };
}

function packHorizontal(pocket: CssRect): QuickbarPlacement {
  const slotW = Math.min(
    QUICK_PREFERRED,
    Math.floor((pocket.w - QUICK_GAP * (QUICK_SLOTS - 1)) / QUICK_SLOTS),
  );
  const slotH = Math.min(QUICK_PREFERRED, pocket.h);
  const rowW = slotW * QUICK_SLOTS + QUICK_GAP * (QUICK_SLOTS - 1);
  const bar = {
    x: pocket.x + pocket.w - rowW,
    y: pocket.y + pocket.h - slotH,
    w: rowW,
    h: slotH,
  };
  const slots = Array.from({ length: QUICK_SLOTS }, (_, index) => ({
    x: bar.x + index * (slotW + QUICK_GAP),
    y: bar.y,
    w: slotW,
    h: slotH,
  }));
  return { bar, slots };
}

/** Capped height of the compact status card in the left column. */
export const STATUS_CARD_H = 56;

/**
 * Top-left status card. Width stays in the stick column so it cannot cover look.
 * Height is capped so a tall readout cannot push the quickbar or stick offscreen.
 */
export function statusCardPlace(
  width: number,
  height: number,
  insets: SafeInsets,
): CssRect {
  const zones = touchLayout(width, height, insets);
  const x = zones.stick.x;
  const y = zones.look.y;
  const maxW = Math.max(0, width - insets.right - x);
  const maxH = Math.max(0, zones.stick.y - GAP - y);
  return {
    x,
    y,
    w: Math.min(zones.stick.w, maxW),
    h: Math.min(STATUS_CARD_H, maxH),
  };
}

function intersectsRect(a: CssRect, b: CssRect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Five quickbar slots in the open space beside stick, look, sprint, dodge, and interact.
 * The touch zones stay where `touchLayout` put them.
 * A vertical stack that would cover the compact status card drops below that card,
 * or moves into the horizontal pocket when the column is no longer tall enough.
 */
export function quickbarPlace(
  width: number,
  height: number,
  insets: SafeInsets,
): QuickbarPlacement {
  const zones = touchLayout(width, height, insets);
  const strip = {
    x: insets.left + QUICK_GAP,
    y: insets.top + QUICK_GAP,
    w: zones.look.x - QUICK_GAP - (insets.left + QUICK_GAP),
    h: zones.stick.y - QUICK_GAP - (insets.top + QUICK_GAP),
  };
  const pocket = {
    x: zones.stick.x + zones.stick.w + QUICK_GAP,
    y: zones.look.y + zones.look.h + QUICK_GAP,
    w: zones.sprint.x - QUICK_GAP - (zones.stick.x + zones.stick.w + QUICK_GAP),
    h: height - insets.bottom - (zones.look.y + zones.look.h + QUICK_GAP),
  };
  const stripTall =
    strip.w >= QUICK_MIN &&
    strip.h >= QUICK_MIN * QUICK_SLOTS + QUICK_GAP * (QUICK_SLOTS - 1);
  const status = statusCardPlace(width, height, insets);
  if (stripTall) {
    const placed = packVertical(strip);
    if (!intersectsRect(placed.bar, status)) return placed;
    const y = status.y + status.h + QUICK_GAP;
    const trimmed = {
      x: strip.x,
      y,
      w: strip.w,
      h: strip.y + strip.h - y,
    };
    const trimmedTall =
      trimmed.w >= QUICK_MIN &&
      trimmed.h >= QUICK_MIN * QUICK_SLOTS + QUICK_GAP * (QUICK_SLOTS - 1);
    if (trimmedTall) return packVertical(trimmed);
  }
  return packHorizontal(pocket);
}
