/**
 * Fresh architecture semester. Defeat two report anomalies, claim 先處理分組那一種 once,
 * and keep the receipt after reload. The reward does not count as gathered supplies.
 *
 *   node --experimental-transform-types scripts/integration-reports.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-reports
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-reports";
mkdirSync(outDir, { recursive: true });

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
    return {
      xp: rpg.xp,
      notes: window.__rpgQA.inventory.count("notes"),
      parts: window.__rpgQA.inventory.count("parts"),
      semester: rpg.narrative.semester,
      semesterText: document.querySelector(".ad-semester")?.textContent ?? "",
      gathered: rpg.gathered,
      felled: rpg.felled,
      claimed: rpg.claimed.filter((id) => id === "reports"),
      departmentId: rpg.departmentId,
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
  await startSemester(page, { query: "建築學系", pick: /建築學系/ });
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setPose), null, { timeout: 20000 });
  const before = await live(page);
  assert.equal(before.semester, "week-1");
  assert.equal(before.felled.report, 0);
  assert.equal(before.gathered.notes, 0);
  assert.equal(before.gathered.parts, 0);
  assert.deepEqual(before.claimed, []);

  const defeated = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg;
    const done = [];
    for (const id of ["report-1", "report-2"]) {
      const enemy = rpg.getState().enemies.find((item) => item.id === id);
      if (!enemy || enemy.hp <= 0) throw new Error(`${id} was not standing`);
      window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
      let hp = enemy.hp;
      for (let i = 0; i < 40 && hp > 0; i += 1) {
        rpg.setState({ attackUntil: 0, panel: null });
        rpg.getState().attack(false);
        hp = rpg.getState().enemies.find((item) => item.id === id)?.hp ?? 0;
      }
      if (hp > 0) throw new Error(`${id} stayed at ${hp}`);
      done.push(id);
    }
    return done;
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 12));
  const felled = await live(page);
  assert.deepEqual(defeated, ["report-1", "report-2"]);
  assert.equal(felled.felled.report, 2);
  assert.equal(felled.felled.quiz, 0);
  assert.equal(felled.gathered.notes, 0);
  assert.equal(felled.gathered.parts, 0);
  assert.equal(felled.semester, "week-1");
  note("felled", { xp: felled.xp, notes: felled.notes, parts: felled.parts, report: felled.felled.report });

  await page.getByRole("button", { name: "學期委託" }).click();
  const article = page.locator("article").filter({
    has: page.getByRole("heading", { name: "先處理分組那一種" }),
  });
  await article.getByText("2 / 2").waitFor({ state: "visible" });
  const claim = article.getByRole("button", { name: "領取獎勵" });
  await claim.waitFor({ state: "visible" });
  assert.equal(await claim.isDisabled(), false);
  await article.scrollIntoViewIfNeeded();
  await shot(page, "ready");
  await claim.click();
  const paid = await live(page);
  assert.equal(paid.xp, felled.xp + 50);
  assert.equal(paid.notes, felled.notes + 4);
  assert.equal(paid.parts, felled.parts + 6);
  assert.equal(paid.gathered.notes, 0);
  assert.equal(paid.gathered.parts, 0);
  assert.deepEqual(paid.claimed, ["reports"]);
  assert.equal(paid.semester, "week-1");
  assert.match(paid.semesterText, /第一週/);
  await article.getByRole("button", { name: "已領取" }).waitFor({ state: "visible" });
  assert.equal(await article.getByRole("button", { name: "已領取" }).isDisabled(), true);
  await shot(page, "claimed");
  note("claimed", { xp: paid.xp, notes: paid.notes, parts: paid.parts, semester: paid.semester });

  const again = await page.evaluate(() => {
    const beforeXp = window.__rpgQA.rpg.getState().xp;
    window.__rpgQA.rpg.getState().claim("reports");
    return window.__rpgQA.rpg.getState().xp === beforeXp;
  });
  assert.equal(again, true);
  assert.equal((await live(page)).notes, paid.notes);

  await page.getByRole("button", { name: "關閉" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "繼續學期" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setPose), null, { timeout: 20000 });
  const kept = await live(page);
  assert.equal(kept.departmentId, "engineering-工學院-0");
  assert.equal(kept.semester, "week-1");
  assert.equal(kept.felled.report, 2);
  assert.equal(kept.gathered.notes, 0);
  assert.equal(kept.gathered.parts, 0);
  assert.equal(kept.notes, paid.notes);
  assert.equal(kept.parts, paid.parts);
  assert.equal(kept.xp, paid.xp);
  assert.deepEqual(kept.claimed, ["reports"]);
  await page.getByRole("button", { name: "學期委託" }).click();
  const reloaded = page.locator("article").filter({
    has: page.getByRole("heading", { name: "先處理分組那一種" }),
  });
  await reloaded.getByText("2 / 2").waitFor({ state: "visible" });
  assert.equal(await reloaded.getByRole("button", { name: "已領取" }).isDisabled(), true);
  await reloaded.scrollIntoViewIfNeeded();
  await shot(page, "reloaded");
  note("reload", { xp: kept.xp, notes: kept.notes, parts: kept.parts, report: kept.felled.report });
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  await shot(page, "failure").catch(() => {});
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
