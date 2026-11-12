/**
 * Fresh architecture semesters. Pay each of 顧衡's clash choices once,
 * then read the matching line at 沈酌 without paying her.
 *
 *   node --experimental-transform-types scripts/integration-gu-clash.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-gu-clash
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-gu-clash";
mkdirSync(outDir, { recursive: true });

const gu = facultyPosts().find((post) => post.id === "npc-gu-heng");
const shen = facultyPosts().find((post) => post.id === "npc-shen-zhuo");
assert.ok(gu && shen);

const ROUTES = [
  {
    id: "honest",
    meet: "我帶了失敗的那一版，想先聽你怎麼看。",
    meetFlag: "fail",
    clash: "裂縫畫進圖，註明還沒修。",
    other: "圖先保持乾淨，裂縫另紙附上。",
    outcome: "沒修完不叫好看",
    flag: "fac-gu-honest",
    otherFlag: "fac-gu-aside",
    shen: "裂縫留在圖上",
  },
  {
    id: "aside",
    meet: "我先補剖面，補完再請你看。",
    meetFlag: "line",
    clash: "圖先保持乾淨，裂縫另紙附上。",
    other: "裂縫畫進圖，註明還沒修。",
    outcome: "另紙我收",
    flag: "fac-gu-aside",
    otherFlag: "fac-gu-honest",
    shen: "裂縫在另一張紙上",
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
      notice: rpg.notice,
      fail: flags["fac-gu-meet-fail"] === true,
      line: flags["fac-gu-meet-line"] === true,
      honest: flags["fac-gu-honest"] === true,
      aside: flags["fac-gu-aside"] === true,
      clash: flags["fac-gu-clash"] === true,
      discoveries: rpg.discoveries.slice(),
      outcome: rpg.narrativeUi?.outcome ?? "",
      eventId: rpg.narrativeUi?.eventId ?? null,
      lead: document.querySelector("#narrative-scroll .ad-lead")?.textContent ?? "",
      x: window.__rpgQA.game.getState().playerX,
      z: window.__rpgQA.game.getState().playerZ,
    };
  });
}

async function fresh(page) {
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await startSemester(page, { query: "建築學系", pick: /建築學系/ });
}

async function stand(page, post) {
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

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  for (const route of ROUTES) {
    await fresh(page);
    await stand(page, gu);
    const arrived = await live(page);
    assert.equal(arrived.semester, "week-1");
    assert.equal(arrived.departmentId, "engineering-工學院-0");
    assert.equal(arrived.clash, false);

    await openTalk(page, "顧衡");
    const meet = page.getByRole("button", { name: route.meet });
    await meet.waitFor({ state: "visible", timeout: 15000 });
    const posed = await live(page);
    await meet.click();
    const met = await live(page);
    assert.equal(met.xp, posed.xp + 22);
    assert.equal(met.semester, "week-1");
    assert.equal(met[route.meetFlag], true);
    await page.getByRole("button", { name: "繼續自由探索" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);

    await openTalk(page, "顧衡");
    const chosen = page.getByRole("button", { name: route.clash });
    const other = page.getByRole("button", { name: route.other });
    await chosen.waitFor({ state: "visible", timeout: 15000 });
    await other.waitFor({ state: "visible", timeout: 15000 });
    const clash = await live(page);
    assert.equal(clash.eventId, "evt-faculty-gu-clash");
    await shot(page, `${route.id}-choices`);
    await chosen.click();
    const paid = await live(page);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, clash.xp + 12);
    assert.equal(paid.notes, clash.notes + 1);
    assert.equal(paid[route.flag === "fac-gu-honest" ? "honest" : "aside"], true);
    assert.equal(paid[route.otherFlag === "fac-gu-honest" ? "honest" : "aside"], false);
    assert.equal(paid.clash, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-gu-clash").length, 1);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-studio-clash").length, 1);
    assert.equal(paid.semester, "week-1");
    assert.match(paid.semesterText, /第一週/);
    await shot(page, `${route.id}-outcome`);
    note(route.id, {
      xpBefore: clash.xp,
      xp: paid.xp,
      notes: paid.notes,
      outcome: paid.outcome,
      semester: paid.semester,
    });

    await page.getByRole("button", { name: "繼續自由探索" }).click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel == null);
    await page.getByRole("button", { name: "與顧衡交談" }).click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("沒有新的話"),
    );
    const quiet = await live(page);
    assert.equal(quiet.panel, null);
    assert.equal(quiet.notes, paid.notes);
    assert.equal(quiet.claimed.filter((id) => id === "quest-faculty-gu-clash").length, 1);
    const found = quiet.discoveries.filter((id) => !paid.discoveries.includes(id));
    assert.equal(quiet.xp, paid.xp + found.length * 12, JSON.stringify(found));

    await stand(page, shen);
    const atShen = await live(page);
    await openTalk(page, "沈酌");
    const heard = await live(page);
    assert.equal(heard.eventId, "evt-faculty-shen-meet");
    assert.match(heard.lead, new RegExp(route.shen));
    assert.equal(heard.xp, atShen.xp);
    await page.getByRole("button", { name: "這是數據。我把步驟留在紀錄裡。" }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "我想重做到好看為止。" }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-shen`);
    await page.getByRole("button", { name: "離開，不結算" }).click();
    const unpaid = await live(page);
    assert.equal(unpaid.panel, null);
    assert.equal(unpaid.xp, heard.xp);
    assert.equal(unpaid.notes, paid.notes);
    assert.equal(unpaid.claimed.includes("quest-faculty-shen-meet"), false);
    note(`${route.id}-shen`, { lead: heard.lead, xp: unpaid.xp, discover: atShen.xp - paid.xp });

    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 60000 });
    await page.getByRole("button", { name: "繼續學期" }).click();
    await page.waitForFunction(
      () => window.__rpgQA?.game.getState().phase === "playing",
      null,
      { timeout: 60000 },
    );
    const kept = await live(page);
    assert.equal(kept.departmentId, "engineering-工學院-0");
    assert.equal(kept.xp, unpaid.xp);
    assert.equal(kept.notes, paid.notes);
    assert.equal(kept.semester, "week-1");
    assert.equal(kept.clash, true);
    assert.equal(kept[route.flag === "fac-gu-honest" ? "honest" : "aside"], true);
    assert.equal(kept.claimed.filter((id) => id === "quest-faculty-gu-clash").length, 1);
    await stand(page, gu);
    await page.getByRole("button", { name: "與顧衡交談" }).click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("沒有新的話"),
    );
    const still = await live(page);
    assert.equal(still.panel, null);
    assert.equal(still.notes, kept.notes);
    assert.equal(still.claimed.filter((id) => id === "quest-faculty-gu-clash").length, 1);
    const again = still.discoveries.filter((id) => !kept.discoveries.includes(id));
    assert.equal(still.xp, kept.xp + again.length * 12, JSON.stringify(again));
    note(`${route.id}-reload`, { xp: still.xp, notes: still.notes, semester: still.semester });
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
