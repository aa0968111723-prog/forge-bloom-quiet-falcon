/**
 * Fresh architecture semesters. Pay each of 簡衡's check choices once.
 * The next line needs 簡禾 and 江照 already met, so a fresh semester
 * shows the nothing-new notice and leaves that line unpaid.
 *
 *   node --experimental-transform-types scripts/integration-heng-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-heng-clash
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-heng-clash";
mkdirSync(outDir, { recursive: true });

const heng = facultyPosts().find((post) => post.id === "npc-jian-heng");
assert.ok(heng);

const ROUTES = [
  {
    id: "check",
    meet: "我去問簡禾和江照，把他們的原句帶回來。",
    choice: "我對過了。兩句沒有合成一句。",
    other: "有一句我還不確定，請標成待查。",
    outcome: "各自已經開口",
    flag: "check",
  },
  {
    id: "unsure",
    meet: "我先寫下我聽到的兩句，請你標出不確定的地方。",
    choice: "有一句我還不確定，請標成待查。",
    other: "我對過了。兩句沒有合成一句。",
    outcome: "這一格先空著",
    flag: "unsure",
  },
];

const report = { steps: [], pageErrors: [] };

function note(step, detail) {
  report.steps.push({ step, ...detail });
  try {
    process.stderr.write(`${step} ${JSON.stringify(detail)}\n`);
  } catch {
    // A broken output pipe has closed mid-run. The report file keeps the step.
  }
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: join(outDir, `${name}.png`) });
  } catch (error) {
    if (!String(error).includes("EIO")) throw error;
  }
}

async function live(page) {
  return page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    const flags = rpg.narrative.flags;
    return {
      xp: rpg.xp,
      notes: window.__rpgQA.inventory.count("notes"),
      departmentId: rpg.departmentId,
      semester: rpg.narrative.semester,
      semesterText: document.querySelector(".ad-semester")?.textContent ?? "",
      claimed: rpg.claimed.filter((id) => String(id).startsWith("quest-faculty")),
      panel: rpg.panel,
      discoveries: rpg.discoveries.slice(),
      check: flags["fac-heng-check"] === true,
      unsure: flags["fac-heng-unsure"] === true,
      clash: flags["fac-heng-clash"] === true,
      heMet: flags["fac-he-met"] === true,
      jiangMet: flags["fac-jiang-met"] === true,
      notice: rpg.notice ?? "",
      outcome: rpg.narrativeUi?.outcome ?? "",
      eventId: rpg.narrativeUi?.eventId ?? null,
      lead: document.querySelector("#narrative-scroll .ad-lead")?.textContent ?? "",
    };
  });
}

function expectedXp(before, after, questXp) {
  const found = after.discoveries.filter((id) => !before.discoveries.includes(id));
  return { found, expected: before.xp + questXp + found.length * 12 };
}

async function fresh(page) {
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await startSemester(page, { query: "建築學系", pick: /建築學系/ });
}

async function stand(page, post) {
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setPose), null, { timeout: 20000 });
  await page.evaluate(({ x, z }) => {
    window.__controlsTest.setPose(x, z, Math.PI);
    window.__rpgQA.rpg.setState({ panel: null, buildKind: null });
  }, post);
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 24));
}

async function openTalk(page) {
  const talk = page.getByRole("button", { name: "與簡衡交談" });
  await talk.waitFor({ state: "visible", timeout: 15000 });
  await talk.click();
  const narrative = page.locator("#narrative-scroll");
  await narrative.waitFor({ state: "visible", timeout: 15000 });
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
}

async function choose(page, text) {
  const button = page.getByRole("button", { name: text });
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
}

async function dismiss(page) {
  await page.getByRole("button", { name: "繼續自由探索" }).click();
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  for (const route of ROUTES) {
    await fresh(page);
    await stand(page, heng);
    await openTalk(page);
    await choose(page, route.meet);
    await dismiss(page);
    await stand(page, heng);
    await openTalk(page);
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-heng-clash");
    assert.match(opening.lead, /沒有把兩句合成一句/);
    assert.equal(opening.heMet, false);
    assert.equal(opening.jiangMet, false);
    await page.getByRole("button", { name: route.other }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-choices`);
    const before = await live(page);
    await choose(page, route.choice);
    const paid = await live(page);
    const gain = expectedXp(before, paid, 8);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, gain.expected, JSON.stringify(gain.found));
    assert.equal(paid.notes, before.notes + 1);
    assert.equal(paid[route.flag], true);
    assert.equal(paid[route.flag === "check" ? "unsure" : "check"], false);
    assert.equal(paid.clash, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-cross-clash").length, 1);
    assert.equal(paid.claimed.includes("quest-faculty-studio-clash"), false);
    assert.equal(paid.claimed.includes("quest-faculty-cross-turn"), false);
    assert.equal(paid.semester, "week-1");
    assert.match(paid.semesterText, /第一週/);
    await shot(page, `${route.id}-outcome`);
    note(route.id, {
      xpBefore: before.xp,
      xp: paid.xp,
      notes: paid.notes,
      found: gain.found,
      lead: opening.lead,
      outcome: paid.outcome,
      semester: paid.semester,
    });

    await dismiss(page);
    await stand(page, heng);
    await page.getByRole("button", { name: "與簡衡交談" }).click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("上一件事還沒完成"),
      null,
      { timeout: 15000 },
    );
    const done = await live(page);
    assert.equal(done.panel, null);
    assert.equal(done.eventId, null);
    assert.equal(done.xp, paid.xp);
    assert.equal(done.notes, paid.notes);
    assert.equal(done.heMet, false);
    assert.equal(done.jiangMet, false);
    assert.equal(done.claimed.includes("quest-faculty-cross-turn"), false);
    await shot(page, `${route.id}-done`);
    note(`${route.id}-done`, { notice: done.notice, xp: done.xp, notes: done.notes });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    await stand(page, heng);
    await page.getByRole("button", { name: "與簡衡交談" }).click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("上一件事還沒完成"),
      null,
      { timeout: 15000 },
    );
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again.xp, paid.xp);
    assert.equal(again[route.flag], true);
    assert.equal(again.panel, null);
    assert.equal(again.heMet, false);
    assert.equal(again.jiangMet, false);
    assert.match(again.notice, /上一件事還沒完成/);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-cross-clash").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-cross-turn"), false);
    await shot(page, `${route.id}-reloaded`);
    note(`${route.id}-reload`, { xp: again.xp, notes: again.notes, notice: again.notice });
  }
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  await shot(page, "failure").catch(() => {});
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close().catch((error) => {
    if (!String(error).includes("EIO")) throw error;
  });
}
