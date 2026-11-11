import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PRESS_STATES } from "../src/game/rpg/chrome.ts";
import {
  STATUS_CARD_H,
  quickbarPlace,
  statusCardPlace,
  touchLayout,
} from "../src/game/rpg/touch-layout.ts";
import {
  MOBILE_PANELS,
  MOBILE_SHORT_SIDE,
  compactStatus,
  firstOverlap,
  hotkeyGate,
  hudHitRects,
  hudOverlap,
  intersects,
  isMobileViewport,
  keyboardControlsClear,
  keyboardOpenLayout,
  mapDragDecision,
  meterLivePolicy,
  mobileHudLayout,
  mobilePromptAction,
  outsideSafe,
  panelClosePlan,
  sessionEvent,
  sessionHolds,
  idleSession,
  slotsInsideBar,
} from "../src/game/rpg/mobile/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };
const SAFE = { top: 47, right: 16, bottom: 34, left: 16 };
const VIEWS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
];
const TAP_IDS = ["attack", "skill", "dodge", "interact", "build", "place", "rotate", "finish"];

function legacyStatusCard(width, insets, typePx) {
  const w = width <= 700 ? 190 : 244;
  const inner = Math.max(1, w - 20);
  const line = Math.ceil(typePx * 1.25);
  const lines = (chars) => Math.max(1, Math.ceil((chars * typePx) / inner));
  const blocks = lines(6) + lines(12) + lines(32) + lines(32) + lines(28);
  return {
    x: insets.left + 12,
    y: insets.top + 12,
    w,
    h: 24 + blocks * line + 28,
  };
}

function unreservedQuickbar(width, height, insets) {
  const zones = touchLayout(width, height, insets);
  const gap = 8;
  const min = 44;
  const preferred = 96;
  const count = 5;
  const strip = {
    x: insets.left + gap,
    y: insets.top + gap,
    w: zones.look.x - gap - (insets.left + gap),
    h: zones.stick.y - gap - (insets.top + gap),
  };
  const tall = strip.w >= min && strip.h >= min * count + gap * (count - 1);
  if (tall) {
    const slotH = Math.min(preferred, Math.floor((strip.h - gap * (count - 1)) / count));
    const stackH = slotH * count + gap * (count - 1);
    return {
      x: strip.x,
      y: strip.y + strip.h - stackH,
      w: strip.w,
      h: stackH,
    };
  }
  return { x: 0, y: 0, w: 0, h: 0 };
}

function center(rect) {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

test("desktop touch zones stay on the shipped anchors", () => {
  const zones = touchLayout(800, 600, ZERO);
  assert.equal(zones.stick.x, 8);
  assert.equal(zones.stick.y, 600 - 8 - 112);
  assert.equal(zones.stick.w, 112);
  assert.equal(zones.stick.h, 112);
  assert.equal(zones.interact.x, 800 - 8 - 72);
  assert.equal(zones.interact.y, 600 - 8 - 48);
  for (const name of ["interact", "dodge", "sprint"]) {
    assert.equal(zones[name].w, 72, name);
    assert.equal(zones[name].h, 48, name);
  }
  assert.ok(zones.look.w > 0 && zones.look.h > 0);
  assert.equal(STATUS_CARD_H, 56);
  assert.equal(MOBILE_SHORT_SIDE, 500);
  assert.equal(isMobileViewport(390, 844), true);
  assert.equal(isMobileViewport(844, 390), true);
  assert.equal(isMobileViewport(1280, 800), false);
  assert.equal(isMobileViewport(800, 600), false);
});

test("legacy status covers the quickbar or pushes the column offscreen", () => {
  const land = legacyStatusCard(844, ZERO, 16);
  const landBar = unreservedQuickbar(844, 390, ZERO);
  assert.equal(intersects(land, landBar), true, "844×390 legacy status should cover the unreserved quickbar");
  const portrait = legacyStatusCard(390, ZERO, 16);
  const portraitBar = unreservedQuickbar(390, 844, ZERO);
  assert.equal(intersects(portrait, portraitBar), true, "390×844 legacy status should cover the unreserved quickbar");
  const enlarged = legacyStatusCard(390, ZERO, 32);
  const columnTop = 8;
  const columnBottom = 844 - 8;
  const minQuick = 44 * 5 + 8 * 4;
  const stacked = columnTop + enlarged.h + 8 + minQuick + 8 + 112;
  assert.ok(stacked > columnBottom, "enlarged portrait status pushes the column out");
  const compact = statusCardPlace(390, 844, ZERO);
  assert.ok(compact.h <= STATUS_CARD_H);
  assert.equal(intersects(compact, quickbarPlace(390, 844, ZERO).bar), false);
  assert.equal(intersects(statusCardPlace(844, 390, ZERO), quickbarPlace(844, 390, ZERO).bar), false);
});

test("phone and desktop viewports keep disjoint HUD rectangles", () => {
  for (const view of VIEWS) {
    for (const insets of [ZERO, SAFE]) {
      const label = `${view.width}×${view.height} top ${insets.top}`;
      const hud = mobileHudLayout(view.width, view.height, insets);
      assert.equal(hudOverlap(hud), null, label);
      assert.equal(slotsInsideBar(hud), true, label);
      assert.equal(hud.attack, hud.slots[0], label);
      assert.equal(hud.skill, hud.slots[1], label);
      assert.equal(hud.slots.length, 5, label);
      assert.ok(hud.look.w >= 44 && hud.look.h >= 44, label + " look");
      assert.ok(hud.status.h <= STATUS_CARD_H && hud.status.h > 0, label + " status");
      for (const id of TAP_IDS) {
        const rect = hud[id];
        assert.ok(rect.w >= 44 && rect.h >= 44, `${label} ${id} ${rect.w}×${rect.h}`);
      }
      for (const slot of hud.slots) {
        assert.ok(slot.w >= 44 && slot.h >= 44, label + " slot");
      }
      for (const item of hudHitRects(hud)) {
        assert.equal(outsideSafe(item.id, item.rect, view.width, view.height, insets), null, label);
      }
      const again = mobileHudLayout(view.width, view.height, insets);
      assert.deepEqual(again, hud, label + " stable");
    }
  }
});

test("390 portrait quickbar still clears the touch zones", () => {
  for (const insets of [ZERO, SAFE]) {
    const zones = touchLayout(390, 844, insets);
    const layout = quickbarPlace(390, 844, insets);
    assert.equal(layout.slots.length, 5);
    const rects = [layout.bar, ...layout.slots];
    for (const rect of rects) {
      assert.ok(rect.w >= 44 && rect.h >= 44);
      assert.equal(outsideSafe("quick", rect, 390, 844, insets), null);
      for (const name of ["stick", "look", "sprint", "dodge", "interact"]) {
        assert.equal(intersects(rect, zones[name]), false, name);
      }
    }
    assert.equal(firstOverlap(layout.slots.map((rect, index) => ({ id: "s" + index, rect }))), null);
  }
});

test("compact status keeps full values for assistive text only", () => {
  const view = compactStatus({
    life: 80,
    lifeMax: 120,
    focus: 40,
    focusMax: 100,
    level: 3,
    saved: "ok",
  });
  assert.equal(view.relayout, false);
  assert.equal(view.visibleSave, "已保存");
  assert.match(view.visibleLevel, /等級 3/);
  assert.equal(view.ariaLife.includes("目前值 80"), true);
  assert.equal(view.ariaLife.includes("最大值 120"), true);
  assert.equal(view.ariaFocus.includes("目前值 40"), true);
  assert.equal(view.ariaFocus.includes("最大值 100"), true);
  assert.equal(view.visibleLife.includes("變化"), false);
  const pending = compactStatus({ life: 1, lifeMax: 2, focus: 3, focusMax: 4, level: 1, saved: "pending" });
  const failed = compactStatus({ life: 1, lifeMax: 2, focus: 3, focusMax: 4, level: 1, saved: "error" });
  assert.equal(pending.visibleSave, "保存中");
  assert.equal(pending.ariaSave, "正在保存…");
  assert.equal(failed.visibleSave, "保存失敗");
  assert.equal(failed.ariaSave, "保存失敗，請匯出備份");
  assert.equal(pending.relayout, false);
  const hud = mobileHudLayout(390, 844, ZERO);
  assert.deepEqual(mobileHudLayout(390, 844, ZERO).status, hud.status);
});

test("keyboard and browser chrome keep confirm and close on screen", () => {
  const open = keyboardOpenLayout({
    width: 390,
    height: 844,
    insets: SAFE,
    keyboardHeight: 300,
    toolbar: { top: 0, bottom: 48 },
  });
  assert.equal(open.keyboardOpen, true);
  assert.equal(open.hotkeysSuspended, true);
  assert.equal(keyboardControlsClear(open), null);
  assert.ok(open.search);
  assert.equal(hotkeyGate({ panel: null, keyboardOpen: true }).quickbarFires, false);
  const land = keyboardOpenLayout({
    width: 844,
    height: 390,
    insets: SAFE,
    keyboardHeight: 200,
    toolbar: { top: 20, bottom: 30 },
  });
  assert.equal(land.keyboardOpen, true);
  assert.equal(land.hotkeysSuspended, true);
  assert.equal(keyboardControlsClear(land), null);
  const toolbarOnly = keyboardOpenLayout({
    width: 320,
    height: 568,
    insets: ZERO,
    keyboardHeight: 0,
    toolbar: { top: 12, bottom: 56 },
  });
  assert.equal(toolbarOnly.keyboardOpen, false);
  assert.equal(toolbarOnly.hotkeysSuspended, false);
  assert.equal(keyboardControlsClear(toolbarOnly), null);
  assert.equal(hotkeyGate({ panel: "inventory", keyboardOpen: false }).hotkeysSuspended, true);
  assert.equal(hotkeyGate({ panel: null, keyboardOpen: false }).quickbarFires, true);
});

test("panels expose an independent scroller, close control, and focus restore target", () => {
  assert.equal(MOBILE_PANELS.length, 7);
  const ids = new Set();
  for (const panel of MOBILE_PANELS) {
    const plan = panelClosePlan(panel.id);
    assert.equal(panel.blocksQuickbar, true);
    assert.equal(plan.restoreFocusId, panel.restoreFocusId);
    for (const id of [panel.scrollId, panel.closeId, panel.restoreFocusId]) {
      assert.equal(ids.has(id), false, id);
      ids.add(id);
      assert.match(id, /^tk-mobile-/);
    }
  }
  assert.deepEqual(
    MOBILE_PANELS.map((panel) => panel.id),
    ["department", "inventory", "skills", "map", "build", "journal", "settings"],
  );
});

test("map drags do not fast travel and meters are not live regions", () => {
  assert.deepEqual(mapDragDecision({ intent: "go", distance: 0 }), { action: "go", fastTravel: true });
  assert.deepEqual(mapDragDecision({ intent: "go", distance: 6 }), { action: "pan", fastTravel: false });
  assert.deepEqual(mapDragDecision({ intent: "go", distance: 12 }), { action: "pan", fastTravel: false });
  assert.deepEqual(mapDragDecision({ intent: "go", dragged: true, distance: 0 }), {
    action: "pan",
    fastTravel: false,
  });
  assert.equal(mapDragDecision({ intent: "select", distance: 0 }).fastTravel, false);
  assert.equal(mapDragDecision({ intent: "track", distance: 4 }).fastTravel, false);
  assert.equal(mapDragDecision({ intent: "select", distance: 20 }).action, "pan");
  assert.deepEqual(meterLivePolicy("life"), { ariaLive: "off", announce: false });
  assert.deepEqual(meterLivePolicy("focus"), { ariaLive: "off", announce: false });
  assert.deepEqual(meterLivePolicy("xp"), { ariaLive: "off", announce: false });
  assert.deepEqual(meterLivePolicy("toast"), { ariaLive: "polite", announce: true });
  assert.deepEqual(mobilePromptAction({ marker: "放置", action: "放置" }), {
    keyRequired: false,
    label: "放置",
    sharedDecision: true,
  });
  assert.equal(mobilePromptAction(null).keyRequired, false);
});

test("two fingers can move and look, and blur does not stick", () => {
  const hud = mobileHudLayout(390, 844, SAFE);
  const stick = center(hud.stick);
  const look = center(hud.look);
  const attack = center(hud.attack);
  let session = idleSession();
  session = sessionEvent(session, { type: "down", id: 1, ...stick });
  session = sessionEvent(session, { type: "down", id: 2, ...look });
  const both = sessionHolds(session, hud);
  assert.equal(both.move, true);
  assert.equal(both.look, true);
  assert.equal(both.stuck, false);
  session = sessionEvent(session, { type: "blur" });
  const cleared = sessionHolds(session, hud);
  assert.equal(cleared.move, false);
  assert.equal(cleared.look, false);
  assert.equal(cleared.attack, false);
  assert.equal(cleared.stuck, false);
  session = sessionEvent(idleSession(), { type: "down", id: 3, ...attack });
  assert.equal(sessionHolds(session, hud).attack, true);
  session = sessionEvent(session, { type: "hidden" });
  assert.equal(sessionHolds(session, hud).attack, false);
  session = sessionEvent(idleSession(), { type: "down", id: 4, ...stick });
  session = sessionEvent(session, { type: "up", id: 4 });
  assert.equal(sessionHolds(session, hud).move, false);
});

test("overlap reports name the rectangles", () => {
  const message = firstOverlap([
    { id: "status", rect: { x: 0, y: 0, w: 40, h: 40 } },
    { id: "quickbar", rect: { x: 20, y: 20, w: 40, h: 40 } },
  ]);
  assert.match(message, /status intersects quickbar/);
});

test("mobile css stays scoped and drops press travel when motion is reduced", () => {
  const css = readFileSync(join(root, "../src/game/rpg/mobile/mobile.css"), "utf8");
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
  for (const match of stripped.matchAll(/([^{}]+)\{/g)) selectors.push(match[1].trim());
  assert.ok(selectors.length > 0);
  for (const selector of selectors) {
    if (selector.startsWith("@")) continue;
    assert.match(selector, /\.tk-mobile/, selector);
    assert.doesNotMatch(selector, /^(body|html|:root|\*)\b/);
  }
  for (const state of PRESS_STATES) {
    assert.match(css, new RegExp(`data-press="${state}"`));
  }
  assert.match(css, /translateY\(3px\)/);
  const reducedAt = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(reducedAt >= 0);
  const reduced = css.slice(reducedAt);
  assert.match(reduced, /\.tk-mobile/);
  assert.match(reduced, /transform:\s*none/);
  assert.doesNotMatch(reduced, /translateY|translateX|translate3d/);
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-top/);
  const hud = readFileSync(join(root, "../src/game/rpg/mobile/MobileHud.tsx"), "utf8");
  assert.match(hud, /className="tk-mobile"/);
  assert.match(hud, /mobile\.css/);
  assert.match(hud, /tk-mobile-scroll/);
  assert.match(hud, /關閉/);
});
