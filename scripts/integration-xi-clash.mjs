/**
 * Fresh architecture semesters. Pay each of 程晰's clash choices once.
 * Her consent line does not follow the clash flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-xi-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-xi-clash
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-xi-clash";
mkdirSync(outDir, { recursive: true });

const xi = facultyPosts().find((post) => post.id === "npc-cheng-xi");
assert.ok(xi);

const ROUTES = [
  {
    id: "out",
    meet: "我先問每一個人，問完再決定收不收。",
    choice: "沒有同意的檔先移出資料夾。",
    other: "先留著，標成未授權，不能拿去跑。",
    outcome: "現在這個資料夾裡只留能用的",
    flag: "out",
  },
  {
    id: "hold",
    meet: "我先只用自己的那一份。",
    choice: "先留著，標成未授權，不能拿去跑。",
    other: "沒有同意的檔先移出資料夾。",
    outcome: "這不是已經同意，是隔離",
    flag: "hold",
  },
];

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
      notes: window.__rpgQA.inventory.count("notes"),
      departmentId: rpg.departmentId,
      semester: rpg.narrative.semester,
      semesterText: document.querySelector(".ad-semester")?.textContent ?? "",
      claimed: rpg.claimed.filter((id) => String(id).startsWith("quest-faculty")),
      panel: rpg.panel,
      discoveries: rpg.discoveries.slice(),
      out: flags["fac-xi-out"] === true,
      hold: flags["fac-xi-hold"] === true,
      clash: flags["fac-xi-clash"] === true,
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
  const talk = page.getByRole("button", { name: "與程晰交談" });
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
    await stand(page, xi);
    await openTalk(page);
    await choose(page, route.meet);
    await dismiss(page);
    await stand(page, xi);
    await openTalk(page);
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-xi-clash");
    assert.match(opening.lead, /有人已經把檔丟進來了/);
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
    assert.equal(paid[route.flag === "out" ? "hold" : "out"], false);
    assert.equal(paid.clash, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-ethics-clash").length, 1);
    assert.equal(paid.claimed.includes("quest-faculty-studio-clash"), false);
    assert.equal(paid.semester, "week-1");
    assert.match(paid.semesterText, /第一週/);
    await shot(page, `${route.id}-outcome`);
    note(route.id, {
      xpBefore: before.xp,
      xp: paid.xp,
      notes: paid.notes,
      outcome: paid.outcome,
      semester: paid.semester,
    });

    await dismiss(page);
    await stand(page, xi);
    await openTalk(page);
    const next = await live(page);
    assert.equal(next.eventId, "evt-faculty-xi-turn");
    assert.match(next.lead, /你自己的作業也在裡面/);
    await page.getByRole("button", { name: "把自己的也移出，直到我寫了同意。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "我寫一張同意，只覆蓋我自己的檔。" }).waitFor({ state: "visible" });
    assert.equal(next.notes, paid.notes);
    assert.equal(next.claimed.includes("quest-faculty-ethics-turn"), false);
    await shot(page, `${route.id}-next`);
    await page.getByRole("button", { name: "離開，不結算" }).click();
    const unpaid = await live(page);
    assert.equal(unpaid.panel, null);
    note(`${route.id}-turn`, { lead: next.lead, xp: unpaid.xp, notes: unpaid.notes });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    await stand(page, xi);
    await openTalk(page);
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again[route.flag], true);
    assert.equal(again.eventId, "evt-faculty-xi-turn");
    assert.match(again.lead, /你自己的作業也在裡面/);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-ethics-clash").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-ethics-turn"), false);
    await shot(page, `${route.id}-reloaded`);
    note(`${route.id}-reload`, { xp: again.xp, notes: again.notes, lead: again.lead });
    await page.getByRole("button", { name: "離開，不結算" }).click();
  }
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
