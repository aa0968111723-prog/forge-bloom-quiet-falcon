import type { CssRect } from "../touch-layout.ts";

export type NamedRect = { id: string; rect: CssRect };

export function intersects(a: CssRect, b: CssRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function contains(outer: CssRect, inner: CssRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

export function pointIn(rect: CssRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

function formatRect(rect: CssRect): string {
  return `x:${rect.x} y:${rect.y} w:${rect.w} h:${rect.h}`;
}

/** First overlapping pair, or null. Touching edges are not an intersection. */
export function firstOverlap(items: readonly NamedRect[]): string | null {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (intersects(a.rect, b.rect)) {
        return `${a.id} intersects ${b.id} (${formatRect(a.rect)} vs ${formatRect(b.rect)})`;
      }
    }
  }
  return null;
}

export function outsideSafe(
  id: string,
  rect: CssRect,
  width: number,
  height: number,
  insets: { top: number; right: number; bottom: number; left: number },
): string | null {
  if (rect.w <= 0 || rect.h <= 0) return `${id} has empty size (${formatRect(rect)})`;
  if (rect.x < insets.left) return `${id} crosses the left safe edge (${formatRect(rect)})`;
  if (rect.y < insets.top) return `${id} crosses the top safe edge (${formatRect(rect)})`;
  if (rect.x + rect.w > width - insets.right) {
    return `${id} crosses the right safe edge (${formatRect(rect)})`;
  }
  if (rect.y + rect.h > height - insets.bottom) {
    return `${id} crosses the bottom safe edge (${formatRect(rect)})`;
  }
  return null;
}
