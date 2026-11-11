import type { CssRect, SafeInsets } from "../touch-layout.ts";
import {
  quickbarPlace,
  statusCardPlace,
  touchLayout,
} from "../touch-layout.ts";
import { MOBILE_PANELS, type MobilePanelId } from "./panels.ts";
import { contains, firstOverlap, type NamedRect } from "./rects.ts";

/** Phone HUD when the shorter side is at most this many CSS pixels. */
export const MOBILE_SHORT_SIDE = 500;

const GAP = 8;
const TAP = 44;

export function isMobileViewport(width: number, height: number): boolean {
  return Math.min(width, height) <= MOBILE_SHORT_SIDE;
}

export type LauncherRect = { id: MobilePanelId; rect: CssRect };

/**
 * Hit targets for one viewport.
 * `attack` is quick slot 0 and `skill` is quick slot 1 (same rectangles).
 * Slots sit inside `quickbar`. The launcher tray, when present, scrolls the
 * panels other than build; build itself stays on screen.
 */
export type MobileHudModel = {
  status: CssRect;
  minimap: CssRect;
  stick: CssRect;
  look: CssRect;
  sprint: CssRect;
  attack: CssRect;
  skill: CssRect;
  dodge: CssRect;
  interact: CssRect;
  build: CssRect;
  notice: CssRect;
  place: CssRect;
  rotate: CssRect;
  finish: CssRect;
  quickbar: CssRect;
  slots: CssRect[];
  quickDodge: CssRect;
  coffee: CssRect;
  tea: CssRect;
  launchers: LauncherRect[];
  tray: CssRect | null;
};

function carveLaunchers(look: CssRect): {
  build: CssRect;
  launchers: LauncherRect[];
  tray: CssRect | null;
  look: CssRect;
} {
  const rowW = MOBILE_PANELS.length * TAP + (MOBILE_PANELS.length - 1) * GAP;
  const roomBelow = (used: number) => look.h - used;
  if (look.w >= rowW && roomBelow(TAP + GAP) >= TAP) {
    const launchers = MOBILE_PANELS.map((panel, index) => ({
      id: panel.id,
      rect: {
        x: look.x + index * (TAP + GAP),
        y: look.y,
        w: TAP,
        h: TAP,
      },
    }));
    const used = TAP + GAP;
    return {
      build: launchers.find((item) => item.id === "build")!.rect,
      launchers,
      tray: null,
      look: { x: look.x, y: look.y + used, w: look.w, h: look.h - used },
    };
  }
  const build: CssRect = { x: look.x, y: look.y, w: TAP, h: TAP };
  const tray: CssRect = {
    x: look.x,
    y: look.y + TAP + GAP,
    w: Math.max(TAP, look.w),
    h: TAP,
  };
  const used = TAP + GAP + TAP + GAP;
  return {
    build,
    launchers: [{ id: "build", rect: build }],
    tray,
    look: { x: look.x, y: look.y + used, w: look.w, h: Math.max(0, look.h - used) },
  };
}

function placeNotice(bounds: CssRect, blockers: CssRect[]): CssRect | null {
  if (bounds.w < TAP || bounds.h < TAP) return null;
  let y = bounds.y;
  const blocks = blockers
    .filter((rect) => intersectsX(rect, bounds))
    .sort((a, b) => a.y - b.y);
  for (const block of blocks) {
    if (y + TAP <= block.y && y + TAP <= bounds.y + bounds.h) {
      return { x: bounds.x, y, w: bounds.w, h: TAP };
    }
    y = Math.max(y, block.y + block.h + GAP);
  }
  if (y + TAP <= bounds.y + bounds.h) return { x: bounds.x, y, w: bounds.w, h: TAP };
  return null;
}

function intersectsX(a: CssRect, b: CssRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w;
}

function placeBuildDock(pocket: CssRect, blockers: CssRect[]): { place: CssRect; rotate: CssRect; finish: CssRect } {
  const rowW = TAP * 3 + GAP * 2;
  const stackH = TAP * 3 + GAP * 2;
  const free = freeBands(pocket, blockers);
  for (const band of free) {
    if (band.w >= rowW && band.h >= TAP) {
      const y = band.y + band.h - TAP;
      return {
        place: { x: band.x, y, w: TAP, h: TAP },
        rotate: { x: band.x + TAP + GAP, y, w: TAP, h: TAP },
        finish: { x: band.x + (TAP + GAP) * 2, y, w: TAP, h: TAP },
      };
    }
    if (band.w >= TAP && band.h >= stackH) {
      return {
        place: { x: band.x, y: band.y, w: TAP, h: TAP },
        rotate: { x: band.x, y: band.y + TAP + GAP, w: TAP, h: TAP },
        finish: { x: band.x, y: band.y + (TAP + GAP) * 2, w: TAP, h: TAP },
      };
    }
  }
  const y = pocket.y;
  return {
    place: { x: pocket.x, y, w: TAP, h: TAP },
    rotate: { x: pocket.x, y: y + TAP + GAP, w: TAP, h: TAP },
    finish: { x: pocket.x, y: y + (TAP + GAP) * 2, w: TAP, h: TAP },
  };
}

function freeBands(pocket: CssRect, blockers: CssRect[]): CssRect[] {
  const hits = blockers
    .filter((rect) => intersectsX(rect, pocket) && rect.y < pocket.y + pocket.h && rect.y + rect.h > pocket.y)
    .sort((a, b) => a.y - b.y);
  const bands: CssRect[] = [];
  let y = pocket.y;
  for (const hit of hits) {
    const top = Math.max(hit.y, pocket.y);
    if (top - y >= TAP) bands.push({ x: pocket.x, y, w: pocket.w, h: top - y });
    y = Math.max(y, Math.min(pocket.y + pocket.h, hit.y + hit.h));
  }
  if (pocket.y + pocket.h - y >= TAP) {
    bands.push({ x: pocket.x, y, w: pocket.w, h: pocket.y + pocket.h - y });
  }
  return bands;
}

/**
 * Non-overlapping HUD rectangles for a viewport.
 * Safe-area insets are pixels. Keyboard and browser chrome are applied by
 * `keyboardOpenLayout` for the department sheet, not by shrinking these zones.
 */
export function mobileHudLayout(
  width: number,
  height: number,
  insets: SafeInsets,
): MobileHudModel {
  const zones = touchLayout(width, height, insets);
  const status = statusCardPlace(width, height, insets);
  const quick = quickbarPlace(width, height, insets);
  const carved = carveLaunchers(zones.look);
  const miniRoom = zones.sprint.y - GAP - zones.look.y;
  const miniH = Math.min(zones.sprint.w, Math.max(TAP, Math.min(72, miniRoom)));
  const minimap: CssRect = {
    x: zones.sprint.x,
    y: zones.look.y,
    w: zones.sprint.w,
    h: Math.min(miniH, Math.max(0, miniRoom)),
  };
  const pocket: CssRect = {
    x: zones.stick.x + zones.stick.w + GAP,
    y: zones.look.y + zones.look.h + GAP,
    w: zones.sprint.x - GAP - (zones.stick.x + zones.stick.w + GAP),
    h: height - insets.bottom - (zones.look.y + zones.look.h + GAP),
  };
  const dock = placeBuildDock(pocket, [quick.bar, ...quick.slots]);
  const leftNotice = placeNotice(
    {
      x: status.x,
      y: status.y + status.h + GAP,
      w: status.w,
      h: zones.stick.y - GAP - (status.y + status.h + GAP),
    },
    [quick.bar, ...quick.slots, zones.stick],
  );
  const rightNotice = placeNotice(
    {
      x: minimap.x,
      y: minimap.y + minimap.h + GAP,
      w: minimap.w,
      h: zones.sprint.y - GAP - (minimap.y + minimap.h + GAP),
    },
    [zones.sprint, zones.dodge, zones.interact],
  );
  const notice = leftNotice ?? rightNotice ?? {
    x: carved.look.x,
    y: carved.look.y,
    w: Math.max(TAP, Math.min(160, carved.look.w)),
    h: TAP,
  };
  const look = leftNotice || rightNotice
    ? carved.look
    : {
        x: carved.look.x,
        y: notice.y + notice.h + GAP,
        w: carved.look.w,
        h: Math.max(0, carved.look.y + carved.look.h - (notice.y + notice.h + GAP)),
      };
  const slots = quick.slots;
  return {
    status,
    minimap,
    stick: zones.stick,
    look,
    sprint: zones.sprint,
    attack: slots[0],
    skill: slots[1],
    dodge: zones.dodge,
    interact: zones.interact,
    build: carved.build,
    notice,
    place: dock.place,
    rotate: dock.rotate,
    finish: dock.finish,
    quickbar: quick.bar,
    slots,
    quickDodge: slots[2],
    coffee: slots[3],
    tea: slots[4],
    launchers: carved.launchers,
    tray: carved.tray,
  };
}

/**
 * Rectangles that must be disjoint.
 * Quick slots are contained in the quickbar bar, so the bar is omitted.
 * Attack and skill are the first two slots, so they are omitted as aliases.
 */
export function hudHitRects(hud: MobileHudModel): NamedRect[] {
  const items: NamedRect[] = [
    { id: "status", rect: hud.status },
    { id: "minimap", rect: hud.minimap },
    { id: "stick", rect: hud.stick },
    { id: "look", rect: hud.look },
    { id: "sprint", rect: hud.sprint },
    { id: "dodge", rect: hud.dodge },
    { id: "interact", rect: hud.interact },
    { id: "build", rect: hud.build },
    { id: "notice", rect: hud.notice },
    { id: "place", rect: hud.place },
    { id: "rotate", rect: hud.rotate },
    { id: "finish", rect: hud.finish },
    { id: "slot-attack", rect: hud.slots[0] },
    { id: "slot-skill", rect: hud.slots[1] },
    { id: "slot-dodge", rect: hud.slots[2] },
    { id: "slot-coffee", rect: hud.slots[3] },
    { id: "slot-tea", rect: hud.slots[4] },
  ];
  if (hud.tray) items.push({ id: "tray", rect: hud.tray });
  for (const launcher of hud.launchers) {
    if (launcher.id === "build") continue;
    items.push({ id: `open-${launcher.id}`, rect: launcher.rect });
  }
  return items;
}

export function hudOverlap(hud: MobileHudModel): string | null {
  return firstOverlap(hudHitRects(hud));
}

export function slotsInsideBar(hud: MobileHudModel): boolean {
  return hud.slots.every((slot) => contains(hud.quickbar, slot));
}
