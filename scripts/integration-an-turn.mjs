/**
 * Fresh architecture semesters. Pay each of 安澄's field-column choices once.
 * Her closing line does not follow the turn flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-an-turn.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-an-turn
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-an-turn";
mkdirSync(outDir, { recursive: true });

const an = facultyPosts().find((post) => post.id === "npc-an-cheng");
assert.ok(an);

const ROUTES = [
  {
    id: "both",
    meet: "請你指出哪一個詞過重。",
    clash: "猶豫留在括號，不寫成作者的原話。",
    choice: "欄位放譯文，原文附在下面。",
    other: "欄位只放原文，譯文我口頭說明。",
    outcome: "這不是只展示漂亮的那版",
    flag: "both",
  },
  {
    id: "oral",
    meet: "我先讀原文，再聽你評譯文。",
    clash: "先刪掉那句，不代作者說。",
    choice: "欄位只放原文，譯文我口頭說明。",
    other: "欄位放譯文，原文附在下面。",
    outcome: "口頭的那句你自己負責",
    flag: "oral",
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
      both: flags["fac-an-both"] === true,
      oral: flags["fac-an-oral"] === true,
      turn: flags["fac-an-turn"] === true,
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
  const talk = page.getByRole("button", { name: "與安澄交談" });
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
    await stand(page, an);
    await openTalk(page);
    await choose(page, route.meet);
    await dismiss(page);
    await stand(page, an);
    await openTalk(page);
    await choose(page, route.clash);
    await dismiss(page);
    await stand(page, an);
    await openTalk(page);
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-an-turn");
    assert.match(opening.lead, /欄位只有一個/);
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
    assert.equal(paid[route.flag === "both" ? "oral" : "both"], false);
    assert.equal(paid.turn, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-wording-turn").length, 1);
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
    await stand(page, an);
    await openTalk(page);
    const next = await live(page);
    assert.equal(next.eventId, "evt-faculty-an-after");
    assert.match(next.lead, /版本可以現在貼/);
    await page.getByRole("button", { name: "就照這個版本貼上發表牆。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "我改一個詞再貼，你只看那個詞。" }).waitFor({ state: "visible" });
    assert.equal(next.notes, paid.notes);
    assert.equal(next.claimed.includes("quest-faculty-wording-after"), false);
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
    await stand(page, an);
    await openTalk(page);
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again[route.flag], true);
    assert.equal(again.eventId, "evt-faculty-an-after");
    assert.match(again.lead, /版本可以現在貼/);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-wording-turn").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-wording-after"), false);
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
