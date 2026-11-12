/**
 * Enter and leave public buildings other than the main gate.
 *
 *   node --experimental-transform-types scripts/integration-interiors.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-interiors
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-interiors";
mkdirSync(outDir, { recursive: true });

const IDS = ["library", "chemistry", "gym"];
const sites = IDS.map((id) => {
  const site = CAMPUS_SITES.find((item) => item.id === id);
  assert.ok(site, id);
  return { ...site, door: siteEntrance(site) };
});

const report = { steps: [], pageErrors: [] };

function note(step, detail) {
  report.steps.push({ step, ...detail });
  process.stderr.write(`${step} ${JSON.stringify(detail)}\n`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
}

async function live(page) {
  return page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    const game = window.__rpgQA.game.getState();
    return {
      interiorId: rpg.interiorId,
      floor: rpg.floor,
      xp: rpg.xp,
      semester: rpg.narrative.semester,
      discoveries: rpg.discoveries,
      x: game.playerX,
      z: game.playerZ,
      bar: document.querySelector(".ad-interior-bar")?.textContent ?? "",
    };
  });
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await startSemester(page);

  for (const site of sites) {
    await page.evaluate(({ x, z }) => {
      window.__controlsTest.setPose(x, z, 0);
      window.__rpgQA.rpg.setState({ panel: null, buildKind: null });
    }, site.door);
    await page.evaluate(() => window.__rpgQA.step(1 / 30, 6));
    const enter = page.getByRole("button", { name: `進入${site.name}` });
    await enter.waitFor({ state: "visible", timeout: 15000 });
    const before = await live(page);
    assert.equal(before.interiorId, null);
    await enter.click();
    await page.waitForFunction(
      (id) => window.__rpgQA.rpg.getState().interiorId === id,
      site.id,
    );
    const inside = await live(page);
    assert.equal(inside.floor, 1);
    assert.match(inside.bar, new RegExp(site.name));
    assert.match(inside.bar, /1 樓/);
    assert.ok(inside.discoveries.includes(site.id));
    assert.equal(inside.semester, "week-1");
    if (site.id === "library") {
      await page.getByRole("button", { name: "上一樓" }).click();
      await page.waitForFunction(() => window.__rpgQA.rpg.getState().floor === 2);
      const upstairs = await live(page);
      assert.match(upstairs.bar, /2 樓/);
      await shot(page, "library-floor-2");
      const stored = await page.evaluate(() => {
        window.dispatchEvent(new Event("pagehide"));
        const raw = localStorage.getItem("tamkang-rpg-v2");
        const doc = raw ? JSON.parse(raw) : null;
        return { interiorId: doc?.interiorId ?? null, floor: doc?.floor ?? null };
      });
      assert.equal(stored.interiorId, "library", JSON.stringify(stored));
      assert.equal(stored.floor, 2);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
      const beforeContinue = await page.evaluate(() => {
        const raw = localStorage.getItem("tamkang-rpg-v2");
        const doc = raw ? JSON.parse(raw) : null;
        return { interiorId: doc?.interiorId ?? null, floor: doc?.floor ?? null };
      });
      assert.equal(beforeContinue.interiorId, "library", `title save ${JSON.stringify(beforeContinue)}`);
      await page.getByRole("button", { name: "繼續學期" }).click();
      await page.waitForFunction(
        () => window.__rpgQA?.game.getState().phase === "playing",
        null,
        { timeout: 60000 },
      );
      const resumed = await live(page);
      assert.equal(resumed.interiorId, "library", JSON.stringify(resumed));
      assert.equal(resumed.floor, 2);
      const kept = await live(page);
      assert.match(kept.bar, /覺生紀念圖書館/);
      assert.match(kept.bar, /2 樓/);
      await shot(page, "library-reloaded");
      note("library-kept", { floor: kept.floor, xp: kept.xp, semester: kept.semester });
    } else {
      await shot(page, `${site.id}-inside`);
    }
    await page.locator(".ad-interior-bar").getByRole("button", { name: "返回校園" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().interiorId === null);
    const outside = await live(page);
    const back = Math.hypot(outside.x - site.door.x, outside.z - site.door.z);
    assert.ok(back < 8, `${site.id} exited ${back} m from the door`);
    await shot(page, `${site.id}-outside`);
    note(site.id, {
      name: site.name,
      xp: outside.xp,
      returned: { x: outside.x, z: outside.z },
      semester: outside.semester,
    });
  }
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
