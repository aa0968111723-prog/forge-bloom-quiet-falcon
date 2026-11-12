/**
 * Fresh semester, then 顧衡's fail choice on the real dialogue panel.
 *
 *   node --experimental-transform-types scripts/integration-gu-fail.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-fail
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-gu-fail";
mkdirSync(outDir, { recursive: true });

const FAIL = "我帶了失敗的那一版，想先聽你怎麼看。";
const LINE = "我先補剖面，補完再請你看。";
const OUTCOME = "失敗的那版可以先放上來。你把它帶來，我就不當你在躲。";
const CLASH = "你沒有先藏。裂縫還在。";

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
    const flags = rpg.narrative.flags;
    return {
      xp: rpg.xp,
      departmentId: rpg.departmentId,
      semester: rpg.narrative.semester,
      semesterText: document.querySelector(".ad-semester")?.textContent ?? "",
      claimed: rpg.claimed.filter((id) => id.startsWith("quest-faculty")),
      fail: flags["fac-gu-meet-fail"] === true,
      line: flags["fac-gu-meet-line"] === true,
      met: flags["fac-gu-met"] === true,
      outcome: rpg.narrativeUi?.outcome ?? "",
      eventId: rpg.narrativeUi?.eventId ?? null,
      lead: document.querySelector("#narrative-scroll .ad-lead")?.textContent ?? "",
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

  await page.evaluate(() => {
    window.__controlsTest.setPose(294.8, -74.5, Math.PI);
    window.__rpgQA.rpg.setState({ panel: null, buildKind: null });
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 8));
  const before = await live(page);
  assert.equal(before.semester, "week-1");
  assert.equal(before.fail, false);

  const talk = page.getByRole("button", { name: "與顧衡交談" });
  await talk.waitFor({ state: "visible", timeout: 15000 });
  await talk.click();
  const narrative = page.locator("#narrative-scroll");
  await narrative.waitFor({ state: "visible", timeout: 15000 });
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
  const fail = page.getByRole("button", { name: FAIL });
  const line = page.getByRole("button", { name: LINE });
  await fail.waitFor({ state: "visible", timeout: 15000 });
  await line.waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "01-choices");
  const posed = await live(page);
  await fail.click();
  const met = await live(page);
  assert.match(met.outcome, /失敗的那版可以先放上來/);
  assert.equal(met.fail, true);
  assert.equal(met.line, false);
  assert.equal(met.met, true);
  assert.ok(met.claimed.includes("quest-faculty-gu-meet"));
  assert.ok(met.claimed.includes("quest-faculty-studio-meet"));
  assert.equal(met.claimed.filter((id) => id === "quest-faculty-gu-meet").length, 1);
  assert.equal(met.xp, posed.xp + 22);
  assert.equal(met.semester, "week-1");
  assert.match(met.semesterText, /第一週/);
  await shot(page, "02-fail");
  note("fail-choice", {
    departmentId: met.departmentId,
    xpBefore: posed.xp,
    xp: met.xp,
    semester: met.semester,
    outcome: met.outcome,
  });

  await page.getByRole("button", { name: "繼續自由探索" }).click();
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);
  await talk.click();
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
  const clash = await live(page);
  assert.equal(clash.eventId, "evt-faculty-gu-clash");
  assert.match(clash.lead, new RegExp(CLASH));
  assert.doesNotMatch(clash.lead, /線有了/);
  await shot(page, "03-clash");
  await page.getByRole("button", { name: "離開，不結算" }).click();
  const unpaid = await live(page);
  assert.equal(unpaid.xp, met.xp);
  assert.equal(unpaid.claimed.includes("quest-faculty-gu-clash"), false);
  note("clash-visible", { eventId: clash.eventId, lead: clash.lead, xp: unpaid.xp });

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "繼續學期" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing");
  const kept = await live(page);
  assert.equal(kept.departmentId, met.departmentId);
  assert.equal(kept.xp, met.xp);
  assert.equal(kept.fail, true);
  assert.equal(kept.line, false);
  assert.equal(kept.semester, "week-1");
  assert.ok(kept.claimed.includes("quest-faculty-gu-meet"));
  assert.equal(kept.claimed.filter((id) => id === "quest-faculty-gu-meet").length, 1);
  await page.evaluate(() => {
    window.__controlsTest.setPose(294.8, -74.5, Math.PI);
    window.__rpgQA.rpg.setState({ panel: null });
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 6));
  await page.getByRole("button", { name: "與顧衡交談" }).click();
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
  const again = await live(page);
  assert.equal(again.eventId, "evt-faculty-gu-clash");
  assert.match(again.lead, new RegExp(CLASH));
  assert.equal(again.xp, met.xp);
  await shot(page, "04-reloaded");
  note("reload", { xp: again.xp, semester: again.semester, eventId: again.eventId });
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
