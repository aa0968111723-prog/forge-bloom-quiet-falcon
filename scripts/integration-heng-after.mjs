/**
 * Fresh architecture semesters. Meet 簡禾 and 江照, pay 簡衡 through the
 * side-by-side line, then pay each return choice once. The return line
 * follows whether the side-by-side choice asked them to nod. Talking again
 * shows the nothing-new notice.
 *
 *   node --experimental-transform-types scripts/integration-heng-after.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-heng-after
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-heng-after";
mkdirSync(outDir, { recursive: true });

const he = facultyPosts().find((post) => post.id === "npc-jian-he");
const jiang = facultyPosts().find((post) => post.id === "npc-jiang-zhao");
const heng = facultyPosts().find((post) => post.id === "npc-jian-heng");
assert.ok(he && jiang && heng);

const ROUTES = [
  {
    id: "return",
    he: "先看哪一門是另一門的先修。",
    jiang: "請你先念教育學院那張。我不先站在商管這邊。",
    hengMeet: "我去問簡禾和江照，把他們的原句帶回來。",
    hengClash: "我對過了。兩句沒有合成一句。",
    turn: "維持兩句並列，不選邊。",
    choice: "我把並列的結果送回簡禾和江照。",
    other: "有人還沒點頭，這份先當草稿。",
    outcome: "到送達為止",
    lead: /草稿不會變成命令/,
    flag: "return",
  },
  {
    id: "draft",
    he: "先看哪一門的時間不能改。",
    jiang: "我想先知道哪一格是商管本來的課。",
    hengMeet: "我先寫下我聽到的兩句，請你標出不確定的地方。",
    hengClash: "有一句我還不確定，請標成待查。",
    turn: "建議對調一小時，但要他們自己點頭。",
    choice: "有人還沒點頭，這份先當草稿。",
    other: "我把並列的結果送回簡禾和江照。",
    outcome: "定死",
    lead: /就送建議/,
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
      prereq: flags["fac-he-prereq"] === true,
      fixed: flags["fac-he-fixed"] === true,
      hear: flags["fac-jiang-hear"] === true,
      class: flags["fac-jiang-class"] === true,
      heMet: flags["fac-he-met"] === true,
      jiangMet: flags["fac-jiang-met"] === true,
      both: flags["fac-heng-both"] === true,
      swap: flags["fac-heng-swap"] === true,
      turn: flags["fac-heng-turn"] === true,
      return: flags["fac-heng-return"] === true,
      draft: flags["fac-heng-draft"] === true,
      after: flags["fac-heng-after"] === true,
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

async function payMeet(page, post, name, text) {
  await stand(page, post);
  await openTalk(page, name);
  await choose(page, text);
  await dismiss(page);
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  for (const route of ROUTES) {
    await fresh(page);
    await payMeet(page, he, "簡禾", route.he);
    await payMeet(page, jiang, "江照", route.jiang);
    await payMeet(page, heng, "簡衡", route.hengMeet);
    await stand(page, heng);
    await openTalk(page, "簡衡");
    await choose(page, route.hengClash);
    await dismiss(page);
    await stand(page, heng);
    await openTalk(page, "簡衡");
    await choose(page, route.turn);
    await dismiss(page);
    await stand(page, heng);
    await openTalk(page, "簡衡");
    const opening = await live(page);
    assert.equal(opening.eventId, "evt-faculty-heng-after");
    assert.match(opening.lead, route.lead);
    assert.equal(opening.swap, route.id === "draft");
    assert.equal(opening.notes, 19);
    await page.getByRole("button", { name: route.other }).waitFor({ state: "visible" });
    await shot(page, `${route.id}-choices`);
    const before = await live(page);
    await choose(page, route.choice);
    const paid = await live(page);
    const gain = expectedXp(before, paid, 10);
    assert.match(paid.outcome, new RegExp(route.outcome));
    assert.equal(paid.xp, gain.expected, JSON.stringify(gain.found));
    assert.equal(paid.notes, before.notes + 1);
    assert.equal(paid[route.flag], true);
    assert.equal(paid[route.flag === "return" ? "draft" : "return"], false);
    assert.equal(paid.after, true);
    assert.equal(paid.claimed.filter((id) => id === "quest-faculty-cross-after").length, 1);
    assert.equal(paid.claimed.includes("quest-faculty-studio-after"), false);
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
      () => window.__rpgQA.rpg.getState().notice.includes("這段已經談完"),
      null,
      { timeout: 15000 },
    );
    const done = await live(page);
    assert.equal(done.panel, null);
    assert.equal(done.eventId, null);
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
    await stand(page, heng);
    await page.getByRole("button", { name: "與簡衡交談" }).click();
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
    assert.match(again.notice, /這段已經談完/);
    assert.equal(again.claimed.filter((id) => id === "quest-faculty-cross-after").length, 1);
    assert.equal(again.claimed.includes("quest-faculty-studio-after"), false);
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
