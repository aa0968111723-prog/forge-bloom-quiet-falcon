/**
 * Fresh architecture semesters. Pay each of 沈酌's opening choices once.
 * The next line follows that flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-shen-meet.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-meet
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-shen-meet";
mkdirSync(outDir, { recursive: true });

const gu = facultyPosts().find((post) => post.id === "npc-gu-heng");
const shen = facultyPosts().find((post) => post.id === "npc-shen-zhuo");
assert.ok(gu && shen);

const ROUTES = [
  {
    id: "data",
    guMeet: "我帶了失敗的那一版，想先聽你怎麼看。",
    guClash: "裂縫畫進圖，註明還沒修。",
    opening: "裂縫留在圖上",
    choice: "這是數據。我把步驟留在紀錄裡。",
    other: "我想重做到好看為止。",
    outcome: "那就留在你手邊",
    flag: "data",
    clashLead: "你已經當它是數據",
  },
  {
    id: "redo",
    guMeet: "我先補剖面，補完再請你看。",
    guClash: "圖先保持乾淨，裂縫另紙附上。",
    opening: "裂縫在另一張紙上",
    choice: "我想重做到好看為止。",
    other: "這是數據。我把步驟留在紀錄裡。",
    outcome: "可以重做。重做之前，舊的那一次還是要在",
    flag: "redo",
    clashLead: "這一頁不能為了重做先消失",
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
      data: flags["fac-shen-data"] === true,
      redo: flags["fac-shen-redo"] === true,
      met: flags["fac-shen-met"] === true,
      outcome: rpg.narrativeUi?.outcome ?? "",
      eventId: rpg.narrativeUi?.eventId ?? null,
      lead: document.querySelector("#narrative-scroll .ad-lead")?.textContent ?? "",
    };
  });
}

function paidXp(before) {
  // Meet pays 6. The first visit to her post pays the existing 12 explore xp.
  // That visit is an xp event, not a new row in rpg.discoveries.
  return before.xp + 18;
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

async function openTalk(page, name) {
  const talk = page.getByRole("button", { name: `與${name}交談` });
  await talk.waitFor({ state: "visible", timeout: 15000 });
  await talk.click();
  const narrative = page.locator("#narrative-scroll");
  await narrative.waitFor({ state: "visible", timeout: 15000 });
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
  return narrative;
}

async function choose(page, text) {
  const button = page.getByRole("button", { name: text });
  await button.waitFor({ state: "visible", timeout: 15000 });
  await button.click();
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  for (const route of ROUTES) {
    await fresh(page);
    await stand(page, gu);
    await openTalk(page, "顧衡");
    await choose(page, route.guMeet);
    await page.getByRole("button", { name: "繼續自由探索" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);
    await openTalk(page, "顧衡");
    await choose(page, route.guClash);
    const afterGu = await live(page);
    assert.equal(afterGu.semester, "week-1");
    assert.equal(afterGu.notes, 19);
    await page.getByRole("button", { name: "繼續自由探索" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);

    await stand(page, shen);
    await openTalk(page, "沈酌");
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-shen-meet");
    assert.match(opening.lead, new RegExp(route.opening));
    await page.getByRole("button", { name: route.other }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-choices`);
    const before = await live(page);
    await choose(page, route.choice);
    const paid = await live(page);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, paidXp(before));
    assert.equal(paid.notes, before.notes);
    assert.equal(paid[route.flag], true);
    assert.equal(paid[route.flag === "data" ? "redo" : "data"], false);
    assert.equal(paid.met, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-shen-meet").length, 1);
    assert.equal(paid.semester, "week-1");
    assert.match(paid.semesterText, /第一週/);
    await shot(page, `${route.id}-outcome`);
    note(route.id, {
      xpBefore: before.xp,
      xp: paid.xp,
      notes: paid.notes,
      outcome: paid.outcome,
    });

    await page.getByRole("button", { name: "繼續自由探索" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);
    await openTalk(page, "沈酌");
    const clash = await live(page);
    assert.equal(clash.eventId, "evt-faculty-shen-clash");
    assert.match(clash.lead, new RegExp(route.clashLead));
    await page.getByRole("button", { name: "失敗那次寫進附錄，同組看得到。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "正文先寫成功的那次，失敗先放在你的紀錄。" }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-next`);
    await page.getByRole("button", { name: "離開，不結算" }).click();
    const unpaid = await live(page);
    assert.equal(unpaid.panel, null);
    assert.equal(unpaid.notes, paid.notes);
    assert.equal(unpaid.claimed.includes("quest-faculty-shen-clash"), false);
    assert.equal(unpaid.claimed.filter((id) => id === "quest-faculty-shen-meet").length, 1);
    const drifted = unpaid.discoveries.filter((id) => !paid.discoveries.includes(id));
    assert.equal(unpaid.xp, paid.xp + drifted.length * 12, JSON.stringify(drifted));

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    await stand(page, shen);
    const kept = await live(page);
    assert.equal(kept.departmentId, "engineering-工學院-0");
    assert.equal(kept.semester, "week-1");
    assert.equal(kept.notes, paid.notes);
    assert.equal(kept[route.flag], true);
    assert.equal(kept.claimed.filter((id) => id === "quest-faculty-shen-meet").length, 1);
    await openTalk(page, "沈酌");
    const again = await live(page);
    assert.equal(again.eventId, "evt-faculty-shen-clash");
    assert.match(again.lead, new RegExp(route.clashLead));
    assert.equal(again.notes, paid.notes);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-shen-meet").length, 1);
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
