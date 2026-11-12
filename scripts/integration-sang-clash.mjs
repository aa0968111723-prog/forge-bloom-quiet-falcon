/**
 * Fresh architecture semesters. Pay each of 桑知's clash choices once.
 * Her speaking line does not follow the clash flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-sang-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-sang-clash
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-sang-clash";
mkdirSync(outDir, { recursive: true });

const sang = facultyPosts().find((post) => post.id === "npc-sang-zhi");
assert.ok(sang);

const ROUTES = [
  {
    id: "wait",
    meet: "這次我寫過程，對方寫結論，下次對調。",
    choice: "結論先空著，等過程到了再寫。",
    other: "用已有的過程寫暫定結論，標清楚。",
    outcome: "等不是退組",
    flag: "wait",
  },
  {
    id: "draft",
    meet: "結論一起寫，過程我們分開寫。",
    choice: "用已有的過程寫暫定結論，標清楚。",
    other: "結論先空著，等過程到了再寫。",
    outcome: "現在不要寫成定稿",
    flag: "draft",
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
      wait: flags["fac-sang-wait"] === true,
      draft: flags["fac-sang-draft"] === true,
      clash: flags["fac-sang-clash"] === true,
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
  const talk = page.getByRole("button", { name: "與桑知交談" });
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
    await stand(page, sang);
    await openTalk(page);
    await choose(page, route.meet);
    await dismiss(page);
    await stand(page, sang);
    await openTalk(page);
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-sang-clash");
    assert.match(opening.lead, /有人沒交過程/);
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
    assert.equal(paid[route.flag === "wait" ? "draft" : "wait"], false);
    assert.equal(paid.clash, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-case-clash").length, 1);
    assert.equal(paid.claimed.includes("quest-faculty-studio-clash"), false);
    assert.equal(paid.semester, "week-1");
    assert.match(paid.semesterText, /第一週/);
    await shot(page, `${route.id}-outcome`);
    note(route.id, {
      xpBefore: before.xp,
      xp: paid.xp,
      notes: paid.notes,
      found: gain.found,
      outcome: paid.outcome,
      semester: paid.semester,
    });

    await dismiss(page);
    await stand(page, sang);
    await openTalk(page);
    const next = await live(page);
    assert.equal(next.eventId, "evt-faculty-sang-turn");
    assert.match(next.lead, /只夠一個人的份量/);
    await page.getByRole("button", { name: "我只講自己寫的那一段。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "我們各講一半，結論不獨佔。" }).waitFor({ state: "visible" });
    assert.equal(next.notes, paid.notes);
    assert.equal(next.claimed.includes("quest-faculty-case-turn"), false);
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
    await stand(page, sang);
    await openTalk(page);
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again[route.flag], true);
    assert.equal(again.eventId, "evt-faculty-sang-turn");
    assert.match(again.lead, /只夠一個人的份量/);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-case-clash").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-case-turn"), false);
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
  await browser.close().catch((error) => {
    if (!String(error).includes("EIO")) throw error;
  });
}
