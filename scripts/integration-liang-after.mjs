/**
 * Fresh architecture semesters. Pay each of 梁晚's poster choices once.
 * The main faculty line ends here. Talking again says she has nothing new.
 *
 *   node --experimental-transform-types scripts/integration-liang-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-liang-after
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-liang-after";
mkdirSync(outDir, { recursive: true });

const gu = facultyPosts().find((post) => post.id === "npc-gu-heng");
const shen = facultyPosts().find((post) => post.id === "npc-shen-zhuo");
const liang = facultyPosts().find((post) => post.id === "npc-liang-wan");
const qiu = facultyPosts().find((post) => post.id === "npc-qiu-ning");
assert.ok(gu && shen && liang && qiu);

const ROUTES = [
  {
    id: "board",
    guMeet: "我帶了失敗的那一版，想先聽你怎麼看。",
    guClash: "裂縫畫進圖，註明還沒修。",
    shenMeet: "這是數據。我把步驟留在紀錄裡。",
    shenClash: "失敗那次寫進附錄，同組看得到。",
    liangMeet: "我寫成我們三個人都同意的句子。",
    liangClash: "兩份出處並列，註明各自是哪一次的說法。",
    guTurn: "我去找主任，評圖改到走廊，教室先給社團。",
    qiuMeet: "請你把兩個時段都念給我聽，我再選。",
    qiuClash: "最好的一小時給社團，評圖用前一小時。",
    qiuTurn: "我寫一張說明，寫明誰讓出一小時。",
    liangTurn: "每個人的句子分開寫，不合併成我們。",
    shenTurn: "評圖時把紀錄帶來，給顧衡看。",
    qiuAfter: "公告之前，我和另一邊對調一小時。",
    guAfter: "現在把缺的裂縫和紀錄補進正式圖面。",
    shenAfter: "請你寫一張短記，讓我夾進圖。",
    opening: "這張寫的是你的決定",
    choice: "海報只放已經並列、寫了名字的出處。",
    other: "出處若還沒齊，海報先拿下，下週再貼。",
    outcome: "沒寫名字的不在牆上",
    flag: "board",
  },
  {
    id: "wait",
    guMeet: "我先補剖面，補完再請你看。",
    guClash: "圖先保持乾淨，裂縫另紙附上。",
    shenMeet: "我想重做到好看為止。",
    shenClash: "正文先寫成功的那次，失敗先放在你的紀錄。",
    liangMeet: "我只寫我自己的請求，不代他們發言。",
    liangClash: "先貼訪談，出處下週補上。",
    guTurn: "我請社團先用一小時，評圖往後挪。",
    qiuMeet: "我想先確認評圖那一格還在不在。",
    qiuClash: "最好的一小時給評圖，社團用前一小時。",
    qiuTurn: "請梁晚把三邊的名字分開，不合成一句。",
    liangTurn: "我的請求留在第一行，其他人的話另行列出。",
    shenTurn: "若當時沒寫完整，我現在跟你一起補步驟。",
    qiuAfter: "就照現在這張表貼出去。",
    guAfter: "圖先維持這樣，我用你留下的時段補。",
    shenAfter: "不用字條。我自己在評圖上說。",
    opening: "出處還沒齊",
    choice: "出處若還沒齊，海報先拿下，下週再貼。",
    other: "海報只放已經並列、寫了名字的出處。",
    outcome: "先拿下",
    flag: "wait",
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
      board: flags["fac-liang-board"] === true,
      wait: flags["fac-liang-wait"] === true,
      after: flags["fac-liang-after"] === true,
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
    await choose(page, route.shenClash);
    await dismiss(page);
    await stand(page, liang);
    await openTalk(page, "梁晚");
    await choose(page, route.liangMeet);
    await dismiss(page);
    await openTalk(page, "梁晚");
    await choose(page, route.liangClash);
    await dismiss(page);
    await stand(page, gu);
    await openTalk(page, "顧衡");
    await choose(page, route.guTurn);
    await dismiss(page);
    await stand(page, qiu);
    await openTalk(page, "邱寧");
    await choose(page, route.qiuMeet);
    await dismiss(page);
    await openTalk(page, "邱寧");
    await choose(page, route.qiuClash);
    await dismiss(page);
    await openTalk(page, "邱寧");
    await choose(page, route.qiuTurn);
    await dismiss(page);
    await stand(page, liang);
    await openTalk(page, "梁晚");
    await choose(page, route.liangTurn);
    await dismiss(page);
    await stand(page, shen);
    await openTalk(page, "沈酌");
    await choose(page, route.shenTurn);
    await dismiss(page);
    await stand(page, qiu);
    await openTalk(page, "邱寧");
    await choose(page, route.qiuAfter);
    await dismiss(page);
    await stand(page, gu);
    await openTalk(page, "顧衡");
    await choose(page, route.guAfter);
    await dismiss(page);
    await stand(page, shen);
    await openTalk(page, "沈酌");
    await choose(page, route.shenAfter);
    await dismiss(page);
    await stand(page, liang);
    await openTalk(page, "梁晚");
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-liang-after");
    assert.match(opening.lead, new RegExp(route.opening));
    await page.getByRole("button", { name: route.other }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-choices`);
    const before = await live(page);
    await choose(page, route.choice);
    const paid = await live(page);
    const gain = expectedXp(before, paid, 14);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, gain.expected, JSON.stringify(gain.found));
    assert.equal(paid.notes, before.notes + 1);
    assert.equal(paid[route.flag], true);
    assert.equal(paid[route.flag === "board" ? "wait" : "board"], false);
    assert.equal(paid.after, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-liang-after").length, 1);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-studio-after").length, 1);
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
    const talk = page.getByRole("button", { name: "與梁晚交談" });
    await talk.click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("這段已經談完"),
      null,
      { timeout: 15000 },
    );
    const done = await live(page);
    assert.equal(done.panel, null);
    assert.equal(done.xp, paid.xp);
    assert.equal(done.notes, paid.notes);
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
    await stand(page, liang);
    await page.getByRole("button", { name: "與梁晚交談" }).click();
    await page.waitForFunction(
      () => window.__rpgQA.rpg.getState().notice.includes("這段已經談完"),
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
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-liang-after").length, 1);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-studio-after").length, 1);
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
  await browser.close();
}
