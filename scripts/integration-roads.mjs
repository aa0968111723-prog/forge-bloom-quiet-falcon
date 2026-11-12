/**
 * Walk a standable point of the estimated road grid in each of the seven districts
 * and check the follow camera stays with the player.
 *
 *   node --experimental-transform-types scripts/integration-roads.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-roads
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { CAMPUS_ROADS } from "../src/game/rpg/campus.ts";
import { ZONE_MARK, ZONE_MARK_ORDER, zoneNear } from "../src/game/rpg/map-zones.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-roads";
mkdirSync(outDir, { recursive: true });

const TITLE_ORBIT = { x: -13, y: 31.5, z: 13 };

function standStops() {
  const found = new Map();
  for (const poly of CAMPUS_ROADS) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, az] = poly[i - 1];
      const [bx, bz] = poly[i];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 8));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const p = resolveCollision(x, z, 1.1);
        if (Math.hypot(p.x - x, p.z - z) > 0.05) continue;
        const zone = zoneNear(x, z);
        if (!zone || found.has(zone)) continue;
        found.set(zone, {
          zone,
          label: ZONE_MARK[zone].label,
          x,
          z,
          yaw: Math.atan2(-(bx - ax), -(bz - az)),
        });
      }
    }
  }
  return ZONE_MARK_ORDER.map((id) => found.get(id));
}

const stops = standStops();
assert.equal(stops.filter(Boolean).length, 7);

const report = { stops: [], views: [], pageErrors: [] };

function note(step, detail) {
  report.stops.push({ step, ...detail });
  process.stderr.write(`${step} ${JSON.stringify(detail)}\n`);
}

function overlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function behind(pos, cam) {
  const horizontal = Math.hypot(cam.x - pos.x, cam.z - pos.z);
  const fromTitle = Math.hypot(cam.x - TITLE_ORBIT.x, cam.y - TITLE_ORBIT.y, cam.z - TITLE_ORBIT.z);
  return { horizontal, above: cam.y - pos.y, fromTitle };
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

async function settle() {
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 8));
}

async function sample() {
  return page.evaluate(() => {
    const pos = window.__controlsTest.getPosition();
    const cam = window.__controlsTest.getCamera();
    const label = [...document.querySelectorAll(".ad-minimap-svg text")].map((node) => node.textContent).join("");
    const box = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    return {
      pos,
      cam,
      label,
      boxes: { minimap: box(".ad-minimap"), quick: box(".ad-quickbar"), semester: box(".ad-semester") },
    };
  });
}

try {
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await startSemester(page);

  for (const viewport of [
    { name: "desktop", width: 1280, height: 720 },
    { name: "narrow", width: 390, height: 780 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settle();
    await page.getByRole("button", { name: "開啟校園地圖" }).click();
    const map = page.getByRole("dialog", { name: "校園地圖" });
    await map.waitFor();
    const legend = await map.locator(".ad-map-svg text").allTextContents();
    for (const id of ZONE_MARK_ORDER) assert.ok(legend.includes(ZONE_MARK[id].label), legend.join("|"));
    await page.screenshot({ path: join(outDir, `map-${viewport.name}.png`) });
    await map.getByRole("button", { name: "關閉" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);

    for (const stop of stops) {
      await page.evaluate(({ x, z, yaw }) => window.__controlsTest.setPose(x, z, yaw), stop);
      await settle();
      const before = await sample();
      assert.equal(before.label, stop.label, `${stop.zone} minimap was ${before.label}`);
      const rig = behind(before.pos, before.cam);
      assert.ok(rig.horizontal > 2 && rig.horizontal < 8, `${stop.zone} camera distance ${rig.horizontal}`);
      assert.ok(rig.above > 0.4, `${stop.zone} camera height ${rig.above}`);
      assert.ok(rig.fromTitle > 20, `${stop.zone} camera stayed on the title orbit`);
      await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
      await page.evaluate(() => window.__rpgQA.step(1 / 30, 24));
      await page.evaluate(() => window.__controlsTest.setKeys([]));
      await settle();
      const after = await sample();
      const moved = Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z);
      const camMoved = Math.hypot(after.cam.x - before.cam.x, after.cam.z - before.cam.z);
      const followed = behind(after.pos, after.cam);
      assert.ok(moved > 1.2, `${stop.zone} only moved ${moved}`);
      assert.ok(camMoved > 1, `${stop.zone} camera only moved ${camMoved}`);
      assert.ok(followed.horizontal > 2 && followed.horizontal < 8, `${stop.zone} follow ${followed.horizontal}`);
      assert.equal(after.label, stop.label);
      assert.equal(overlap(after.boxes.minimap, after.boxes.quick), false);
      assert.equal(overlap(after.boxes.semester, after.boxes.quick), false);
      await page.screenshot({ path: join(outDir, `${stop.zone}-${viewport.name}.png`) });
      note(`${viewport.name}:${stop.zone}`, {
        label: stop.label,
        from: { x: before.pos.x, z: before.pos.z },
        to: { x: after.pos.x, z: after.pos.z },
        moved,
        camera: followed,
      });
    }
    report.views.push(viewport);
  }
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  throw error;
} finally {
  await page.evaluate(() => window.__controlsTest?.setKeys([])).catch(() => {});
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
