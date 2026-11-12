/**
 * Fresh architecture semesters. Pay each of 沈酌's clash choices once.
 * 梁晚's opening follows that flag and is left unpaid.
 *
 *   node --experimental-transform-types scripts/integration-shen-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-shen-clash
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-shen-clash";
mkdirSync(outDir, { recursive: true });

const gu = facultyPosts().find((post) => post.id === "npc-gu-heng");
const shen = facultyPosts().find((post) => post.id === "npc-shen-zhuo");
const liang = facultyPosts().find((post) => post.id === "npc-liang-wan");
assert.ok(gu && shen && liang);

const ROUTES = [
  {
    id: "public",
    guMeet: "我帶了失敗的那一版，想先聽你怎麼看。",
    guClash: "裂縫畫進圖，註明還沒修。",
    shenMeet: "這是數據。我把步驟留在紀錄裡。",
    shenLead: "你已經當它是數據",
    choice: "失敗那次寫進附錄，同組看得到。",
    other: "正文先寫成功的那次，失敗先放在你的紀錄。",
    outcome: "附錄就是給同組看的",
    flag: "public",
    liang: "附錄",
  },
  {
    id: "office",
    guMeet: "我先補剖面，補完再請你看。",
    guClash: "圖先保持乾淨，裂縫另紙附上。",
    shenMeet: "我想重做到好看為止。",
    shenLead: "這一頁不能為了重做先消失",
    choice: "正文先寫成功的那次，失敗先放在你的紀錄。",
    other: "失敗那次寫進附錄，同組看得到。",
    outcome: "可以先放在我這裡",
    flag: "office",
    liang: "不能寫她同意隱藏",
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
      card: document.querySelector(".ad-semester")?.parentElement?.innerText ?? "",
      claimed: rpg.claimed.filter((id) => String(id).startsWith("quest-faculty")),
      panel: rpg.panel,
      discoveries: rpg.discoveries.slice(),
      public: flags["fac-shen-public"] === true,
      office: flags["fac-shen-office"] === true,
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

async function openTalk(page, name) {
  const talk = page.getByRole("button", { name: `與${name}交談` });
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
    await stand(page, gu);
    await openTalk(page, "顧衡");
    await choose(page, route.guMeet);
    await dismiss(page);
    await openTalk(page, "顧衡");
    await choose(page, route.guClash);
    await dismiss(page);
    await stand(page, shen);
    await openTalk(page, "沈酌");
    await choose(page, route.shenMeet);
    await dismiss(page);
    await openTalk(page, "沈酌");
    const clash = await live(page);
    assert.equal(clash.eventId, "evt-faculty-shen-clash");
    assert.match(clash.lead, new RegExp(route.shenLead));
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
    assert.equal(paid[route.flag === "public" ? "office" : "public"], false);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-shen-clash").length, 1);
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
    await stand(page, liang);
    const atLiang = await live(page);
    await openTalk(page, "梁晚");
    const heard = await live(page);
    assert.equal(heard.eventId, "evt-faculty-liang-meet");
    assert.match(heard.lead, new RegExp(route.liang));
    await page.getByRole("button", { name: "我寫成我們三個人都同意的句子。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "我只寫我自己的請求，不代他們發言。" }).waitFor({ state: "visible" });
    const drifted = heard.discoveries.filter((id) => !paid.discoveries.includes(id));
    assert.equal(heard.xp, atLiang.xp);
    assert.equal(heard.notes, paid.notes);
    await shot(page, `${route.id}-liang`);
    await page.getByRole("button", { name: "離開，不結算" }).click();
    const unpaid = await live(page);
    assert.equal(unpaid.panel, null);
    assert.equal(unpaid.claimed.includes("quest-faculty-liang-meet"), false);
    assert.equal(unpaid.claimed.filter((id) => id === "quest-faculty-shen-clash").length, 1);
    note(`${route.id}-liang`, { lead: heard.lead, xp: unpaid.xp, discover: drifted });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    await stand(page, liang);
    await openTalk(page, "梁晚");
    const again = await live(page);
    assert.equal(again.departmentId, "engineering-工學院-0");
    assert.equal(again.semester, "week-1");
    assert.equal(again.notes, paid.notes);
    assert.equal(again[route.flag], true);
    assert.equal(again.eventId, "evt-faculty-liang-meet");
    assert.match(again.lead, new RegExp(route.liang));
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-shen-clash").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-liang-meet"), false);
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
