/**
 * Fresh architecture semesters. Pay each of 簡禾's signature choices once.
 * Her closing line follows the earlier friend flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-he-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-he-turn
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-he-turn";
mkdirSync(outDir, { recursive: true });

const he = facultyPosts().find((post) => post.id === "npc-jian-he");
assert.ok(he);

const ROUTES = [
  {
    id: "sign",
    meet: "先看哪一門是另一門的先修。",
    clash: "我自己對過先修，不跟朋友的課表走。",
    choice: "我現在去補簽名，課表維持這兩門的決定。",
    other: "我改選不撞的那門，這張單重寫。",
    outcome: "我沒有改口",
    flag: "sign",
    next: "寫進去就依這個走",
  },
  {
    id: "switch",
    meet: "先看哪一門的時間不能改。",
    clash: "我先跟朋友同一門，下學期再補先修。",
    choice: "我改選不撞的那門，這張單重寫。",
    other: "我現在去補簽名，課表維持這兩門的決定。",
    outcome: "你不是被退選",
    flag: "switch",
    next: "你跟了朋友",
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
      sign: flags["fac-he-sign"] === true,
      switch: flags["fac-he-switch"] === true,
      turn: flags["fac-he-turn"] === true,
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
  const talk = page.getByRole("button", { name: "與簡禾交談" });
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
    await stand(page, he);
    await openTalk(page);
    await choose(page, route.meet);
    await dismiss(page);
    await stand(page, he);
    await openTalk(page);
    await choose(page, route.clash);
    await dismiss(page);
    await stand(page, he);
    await openTalk(page);
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-he-turn");
    assert.match(opening.lead, /截止前少一個簽名/);
    await page.getByRole("button", { name: route.other }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-choices`);
    const before = await live(page);
    await choose(page, route.choice);
    const paid = await live(page);
    const gain = expectedXp(before, paid, 8);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, gain.expected, JSON.stringify(gain.found));
    assert.equal(paid.notes, before.notes);
    assert.equal(paid[route.flag], true);
    assert.equal(paid[route.flag === "sign" ? "switch" : "sign"], false);
    assert.equal(paid.turn, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-course-turn").length, 1);
    assert.equal(paid.claimed.includes("quest-faculty-studio-turn"), false);
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
    await stand(page, he);
    await openTalk(page);
    const next = await live(page);
    assert.equal(next.eventId, "evt-faculty-he-after");
    assert.match(next.lead, new RegExp(route.next));
    await page.getByRole("button", { name: "把這個決定寫進我自己的課表。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "課表先寫這個，旁邊留一個可退的備案。" }).waitFor({ state: "visible" });
    assert.equal(next.notes, paid.notes);
    assert.equal(next.claimed.includes("quest-faculty-course-after"), false);
    await shot(page, `${route.id}-next`);
    await page.getByRole("button", { name: "離開，不結算" }).click();
    const unpaid = await live(page);
    assert.equal(unpaid.panel, null);
    note(`${route.id}-after`, { lead: next.lead, xp: unpaid.xp, notes: unpaid.notes });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    await stand(page, he);
    await openTalk(page);
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again[route.flag], true);
    assert.equal(again.eventId, "evt-faculty-he-after");
    assert.match(again.lead, new RegExp(route.next));
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-course-turn").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-course-after"), false);
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
