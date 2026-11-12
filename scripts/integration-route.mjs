/**
 * One playthrough of the integrated game on the current tree.
 *
 * Offline static site: title, character, campus, the gate conversation,
 * one reward, a basic attack through the existing combat rule, then reload.
 * The save that reload kept is then the cloud document: first sync, a second
 * client, a revision conflict, logout, and a disconnected push.
 *
 *   node --experimental-transform-types scripts/integration-route.mjs http://127.0.0.1:8086/ /opt/cursor/artifacts/integration-route
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { register } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";
import { buildSpot } from "../src/game/rpg/prompts.ts";
import { validatePlacement } from "../src/game/rpg/rules.ts";

await register(
  pathToFileURL(
    fileURLToPath(new URL("../src/game/rpg/acceptance/node-resolve.mjs", import.meta.url)),
  ).href,
  import.meta.url,
);

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8086/";
const outDir = process.argv[3] ?? "/tmp/integration-route";
mkdirSync(outDir, { recursive: true });

const report = { steps: [], pageErrors: [], apiRequests: [] };

function note(step, detail) {
  report.steps.push({ step, ...detail });
  process.stderr.write(`${step} ${JSON.stringify(detail)}\n`);
}

function notesOf(doc) {
  const slot = doc.slots?.find((row) => row.itemId === "notes");
  return slot?.quantity ?? 0;
}

function slotCount(doc, itemId) {
  const slot = doc.slots?.find((row) => row.itemId === itemId);
  return slot?.quantity ?? 0;
}

function legalLanternPose() {
  for (let x = -80; x <= 80; x += 4) {
    for (let z = -80; z <= 40; z += 4) {
      const player = { x, z: z + 5 };
      const spot = buildSpot(player.x, player.z, 0);
      if (spot.x !== x || spot.z !== z) continue;
      if (validatePlacement("lantern", spot.x, spot.z, 0, [], player) == null) {
        return { x: player.x, z: player.z, yaw: 0 };
      }
    }
  }
  return null;
}

async function shot(page, name) {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path });
  return path;
}

async function readLive(page) {
  return page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    const game = window.__rpgQA.game.getState();
    const enemy = rpg.enemies.find((item) => item.id === "quiz-2");
    const text = localStorage.getItem("tamkang-rpg-v2");
    return {
      phase: game.phase,
      departmentId: rpg.departmentId,
      x: game.playerX,
      z: game.playerZ,
      xp: rpg.xp,
      hp: rpg.hp,
      panel: rpg.panel,
      claimed: rpg.claimed,
      buildKind: rpg.buildKind,
      buildings: rpg.buildings.map((item) => item.kind),
      equipped: rpg.equipped,
      semester: rpg.narrative.semester,
      collegeId: rpg.narrative.collegeId,
      semesterText:
        document.querySelector(".ad-semester")?.textContent ??
        document.querySelector(".tk-mobile-semester")?.textContent ??
        null,
      flag: rpg.narrative.flags["gate-asked-map"] === true,
      resolved: rpg.narrative.resolved.includes("evt-gate-orientation"),
      enemyHp: enemy?.hp ?? null,
      save: text,
    };
  });
}

async function playOffline(page) {
  const api = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/")) api.push(url);
  });
  page.on("pageerror", (error) => report.pageErrors.push(String(error)));
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await shot(page, "01-title");
  note("offline-title", { api: api.length });

  await startSemester(page, { query: "化學", pick: /化學學系/ });
  const started = await readLive(page);
  assert.equal(started.phase, "playing");
  assert.equal(started.departmentId, "science-理學院-2");
  assert.ok(Number.isFinite(started.x) && Number.isFinite(started.z));
  await shot(page, "02-campus");
  note("character-campus", {
    departmentId: started.departmentId,
    x: started.x,
    z: started.z,
  });

  await page.evaluate(() => window.__controlsTest.setPose(60, 70.5, 0));
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 4));
  const enter = page.getByRole("button", { name: "進入大門警衛站" });
  await enter.waitFor({ state: "visible", timeout: 15000 });
  await enter.click();
  const talk = page.getByRole("button", { name: "交談" });
  await talk.waitFor({ state: "visible", timeout: 15000 });
  await talk.click();
  const choice = page.getByRole("button", { name: "可以只告訴我今天會用到的路嗎？" });
  await choice.waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "03-gate-talk");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const before = await readLive(page);
  const beforeDoc = JSON.parse(before.save);
  await choice.click();
  const paid = await readLive(page);
  assert.ok(paid.claimed.includes("quest-orient-gate"));
  assert.equal(paid.flag, true);
  assert.equal(paid.collegeId, "science");
  assert.equal(paid.semester, "week-1");
  assert.ok(paid.xp > before.xp);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const paidSave = JSON.parse(await page.evaluate(() => localStorage.getItem("tamkang-rpg-v2")));
  assert.equal(notesOf(paidSave), notesOf(beforeDoc) + 1);
  await shot(page, "04-reward");
  note("reward-once", { xp: paid.xp, notes: notesOf(paidSave), claimed: paid.claimed });

  const dismiss = page.getByRole("button", { name: "繼續自由探索" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await page.evaluate(() => window.__rpgQA.rpg.getState().narrativeDismiss());
  const { SUPPLY_NODES } = await import("../src/game/rpg/campus.ts");
  const crate = SUPPLY_NODES[0];
  await page.evaluate(({ x, z }) => window.__controlsTest.setPose(x, z, 0), crate);
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 4));
  const beforeErrand = await readLive(page);
  await page.locator(".ad-interact button").click();
  const errand = await readLive(page);
  assert.ok(errand.claimed.includes("quest-errand-campus-post"));
  assert.equal(errand.xp, beforeErrand.xp + 12);
  assert.equal(errand.semester, "midterm");
  assert.equal(errand.semesterText, "期中 · 擊退三隻異象");
  await page.setViewportSize({ width: 1280, height: 720 });
  await shot(page, "04b-semester-desktop");
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForFunction(() => window.innerWidth === 390);
  await shot(page, "04c-semester-narrow");
  const narrow = await readLive(page);
  assert.equal(narrow.semesterText, "期中 · 擊退三隻異象");
  await page.setViewportSize({ width: 960, height: 600 });
  note("campus-errand", {
    xp: errand.xp,
    semester: errand.semester,
    claimed: errand.claimed,
    semesterText: errand.semesterText,
    narrowText: narrow.semesterText,
  });
  await page.evaluate(() => window.__controlsTest.setPose(60, 70.5, 0));
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 4));
  const again = page.getByRole("button", { name: "進入大門警衛站" });
  await again.click();
  const second = await readLive(page);
  assert.equal(second.panel === "narrative", false);
  assert.equal(second.xp, errand.xp);
  assert.equal(second.resolved, true);
  const inside = await page.evaluate(() => window.__rpgQA.rpg.getState().interiorId);
  assert.equal(inside, "main-gate");
  note("reward-not-repeated", { panel: second.panel, xp: second.xp, interiorId: inside });

  await page.evaluate(() => window.__controlsTest.setPose(0, 6.2, 0));
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 3));
  const leave = page.locator(".ad-interact").getByRole("button", { name: "返回校園" });
  await leave.waitFor({ state: "visible", timeout: 15000 });
  await leave.click();
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().interiorId === null);

  const illegalSpot = buildSpot(0, 10, 0);
  assert.equal(
    validatePlacement("lantern", illegalSpot.x, illegalSpot.z, 0, [], { x: 0, z: 10 }),
    "請保留克難坡通行空間",
  );
  await page.evaluate(() => window.__controlsTest.setPose(0, 10, 0));
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 2));
  const xpBeforeBuild = (await readLive(page)).xp;
  await page.getByRole("button", { name: "建造", exact: true }).click();
  const lanternCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "守夜宮燈" }),
  });
  await lanternCard.getByRole("button", { name: "放置" }).click();
  await page.locator(".ad-interact").getByText("請保留克難坡通行空間").waitFor();
  await page.locator(".ad-interact").getByRole("button", { name: "放置" }).click();
  const refused = await readLive(page);
  assert.deepEqual(refused.buildings, []);
  assert.equal(refused.xp, xpBeforeBuild);
  assert.equal(refused.claimed.filter((id) => id === "quest-errand-campus-post").length, 1);
  await shot(page, "05b-illegal-place");
  await page.locator(".ad-interact").getByRole("button", { name: "結束建造" }).click();
  assert.equal((await readLive(page)).buildKind, null);

  const legalPose = legalLanternPose();
  assert.ok(legalPose);
  await page.evaluate(
    ({ x, z, yaw }) => window.__controlsTest.setPose(x, z, yaw),
    legalPose,
  );
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 2));
  await page.getByRole("button", { name: "建造", exact: true }).click();
  await lanternCard.getByRole("button", { name: "放置" }).click();
  const placeBar = page.locator(".ad-interact");
  await placeBar.getByRole("button", { name: "結束建造" }).waitFor();
  await page.setViewportSize({ width: 1280, height: 720 });
  await shot(page, "05c-place-desktop");
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForFunction(() => window.innerWidth === 390);
  await shot(page, "05c-place-narrow");
  await page.setViewportSize({ width: 960, height: 600 });
  const xpAtPlace = (await readLive(page)).xp;
  await placeBar.getByRole("button", { name: "放置" }).click();
  const placed = await readLive(page);
  assert.deepEqual(placed.buildings, ["lantern"]);
  assert.equal(placed.xp, xpAtPlace);
  assert.equal(placed.claimed.filter((id) => id === "quest-errand-campus-post").length, 1);
  await placeBar.getByRole("button", { name: "放置" }).click();
  const overlapped = await readLive(page);
  assert.deepEqual(overlapped.buildings, ["lantern"]);
  assert.equal(overlapped.xp, xpAtPlace);
  await placeBar.getByRole("button", { name: "結束建造" }).click();
  assert.equal((await readLive(page)).buildKind, null);
  await shot(page, "05d-lantern");
  note("build-place", {
    refused: refused.buildings.length,
    placed: placed.buildings,
    xp: placed.xp,
  });

  await page.evaluate(() => {
    const enemy = window.__rpgQA.rpg.getState().enemies.find((item) => item.id === "quiz-2");
    window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 2));
  const armed = await readLive(page);
  await page.evaluate(() => window.__rpgQA.rpg.getState().attack(false));
  const struck = await readLive(page);
  assert.ok(struck.enemyHp < armed.enemyHp, `quiz-2 stayed at ${struck.enemyHp}`);
  assert.equal(struck.xp, armed.xp);
  assert.equal(struck.claimed.filter((id) => id === "quest-errand-campus-post").length, 1);
  await shot(page, "05-combat");
  note("combat", { before: armed.enemyHp, after: struck.enemyHp, xp: struck.xp });

  const fought = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg;
    const enemy = rpg.getState().enemies.find((item) => item.id === "final-1");
    window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
    let hp = enemy.hp;
    for (let i = 0; i < 40 && hp > 0; i += 1) {
      rpg.setState({ attackUntil: 0 });
      rpg.getState().attack(false);
      hp = rpg.getState().enemies.find((item) => item.id === "final-1")?.hp ?? 0;
    }
    return { hp, boss: rpg.getState().boss };
  });
  assert.equal(fought.hp, 0);
  assert.equal(fought.boss, 1);
  const claimReward = page.getByRole("button", { name: "領取獎勵，繼續探索" });
  await claimReward.waitFor({ state: "visible", timeout: 15000 });
  await claimReward.click();
  await page.waitForFunction(() => window.__rpgQA.game.getState().phase === "playing");
  const rewarded = await readLive(page);
  assert.ok(rewarded.claimed.includes("semester"));
  assert.equal(rewarded.semester, "midterm");
  assert.equal(rewarded.equipped, false);
  await page.getByRole("button", { name: "背包", exact: true }).click();
  await page.getByRole("button", { name: "五虎崗徽章 1 個" }).click();
  await page.getByRole("button", { name: "裝備徽章" }).click();
  const worn = await readLive(page);
  assert.equal(worn.equipped, true);
  assert.deepEqual(worn.buildings, ["lantern"]);
  await shot(page, "05e-badge");
  await page.getByRole("dialog", { name: "背包" }).getByRole("button", { name: "關閉" }).click();
  const retry = page.getByRole("button", { name: "回到克難坡，重新出發" });
  if (await retry.isVisible().catch(() => false)) {
    await retry.click();
    await page.waitForFunction(() => window.__rpgQA.rpg.getState().hp > 0);
    const stood = await readLive(page);
    assert.equal(stood.equipped, true);
    assert.deepEqual(stood.buildings, ["lantern"]);
  }
  note("equip-badge", {
    equipped: worn.equipped,
    claimed: worn.claimed.includes("semester"),
    semester: worn.semester,
    buildings: worn.buildings,
  });

  await page.evaluate(() => {
    const enemy = window.__rpgQA.rpg.getState().enemies.find((item) => item.id === "report-1");
    window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
    window.__rpgQA.rpg.setState({
      panel: null,
      buildKind: null,
      focus: 100,
      skillUntil: 0,
      attackUntil: 0,
    });
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 2));
  const reportBefore = await page.evaluate(
    () => window.__rpgQA.rpg.getState().enemies.find((item) => item.id === "report-1").hp,
  );
  await page.locator(".ad-quickbar").getByRole("button", { name: /^技能/ }).click();
  const reportAfter = await page.evaluate(
    () => window.__rpgQA.rpg.getState().enemies.find((item) => item.id === "report-1").hp,
  );
  assert.ok(reportAfter < reportBefore, `report-1 stayed at ${reportAfter}`);
  const exam = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg;
    const enemy = rpg.getState().enemies.find((item) => item.id === "exam-1");
    window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
    rpg.setState({ panel: null, buildKind: null, attackUntil: 0 });
    const before = enemy.hp;
    rpg.getState().attack(false);
    const after = rpg.getState().enemies.find((item) => item.id === "exam-1")?.hp ?? before;
    return { before, after, kind: enemy.kind };
  });
  assert.ok(exam.after < exam.before, `exam-1 stayed at ${exam.after}`);
  note("monster-kinds", {
    quiz: "earlier swing",
    report: { before: reportBefore, after: reportAfter, via: "skill-button" },
    exam,
    final: "defeated earlier",
  });

  await page.evaluate(() => {
    window.__controlsTest.setPose(0, -40, 0);
    window.__rpgQA.rpg.setState({ panel: null, buildKind: null });
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 4));
  const dock = page.locator("[data-gv=dock]");
  await dock.waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "07-variety-dock");
  const xpBeforeVariety = (await readLive(page)).xp;
  await dock.click();
  const panel = page.locator("[data-gv=panel]");
  await panel.getByRole("button", { name: "開始查看線索" }).click();
  await panel.getByRole("button", { name: "閉館鈴後有人往圖書館跑。" }).click();
  await panel.getByRole("button", { name: "送出這組線索" }).click();
  await panel.getByRole("button", { name: "閉館鈴後有人往圖書館跑。" }).click();
  await panel.getByRole("button", { name: "第三盞的開關是暖的。" }).click();
  await panel.getByRole("button", { name: "有人把筆記放在第三盞下面。" }).click();
  await panel.getByRole("button", { name: "送出這組線索" }).click();
  await panel.locator("[data-gv=puzzle-0]").click();
  await panel.locator("[data-gv=puzzle-2]").click();
  await panel.locator("[data-gv=peace]").click();
  await panel.getByRole("button", { name: "在原地等一拍" }).click();
  await panel.getByRole("button", { name: "走到第三盞" }).click();
  await panel.getByRole("button", { name: "在原地等一拍" }).click();
  await panel.getByRole("button", { name: "走到傳達桌" }).click();
  await panel.locator("[data-gv=claim]").click();
  const varied = await readLive(page);
  assert.ok(varied.claimed.includes("quest-gv-night-peace"));
  assert.equal(varied.xp, xpBeforeVariety + 36);
  assert.equal(varied.semester, "midterm");
  assert.deepEqual(varied.buildings, ["lantern"]);
  await panel.locator("[data-gv=claim]").click();
  assert.equal((await readLive(page)).xp, varied.xp);
  await shot(page, "07b-variety-claimed");
  await panel.getByRole("button", { name: "關閉" }).click();
  note("variety-peace", {
    xp: varied.xp,
    claimed: "quest-gv-night-peace",
    semester: varied.semester,
  });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.__controlsTest.setPose(294.8, -74.5, Math.PI);
    window.__rpgQA.rpg.setState({ panel: null, buildKind: null });
  });
  await page.evaluate(() => window.__rpgQA.step(1 / 30, 8));
  const facultyTalk = page.getByRole("button", { name: "與顧衡交談" });
  await facultyTalk.waitFor({ state: "visible", timeout: 15000 });
  await facultyTalk.click();
  const narrative = page.locator("#narrative-scroll");
  await narrative.waitFor({ state: "visible", timeout: 15000 });
  await narrative.getByRole("button", { name: "交談", exact: true }).click();
  const lineChoice = page.getByRole("button", { name: "我先補剖面，補完再請你看。" });
  const failChoice = page.getByRole("button", { name: "我帶了失敗的那一版，想先聽你怎麼看。" });
  await lineChoice.waitFor({ state: "visible", timeout: 15000 });
  await failChoice.waitFor({ state: "visible", timeout: 15000 });
  await shot(page, "08-faculty-choices");
  const beforeFaculty = await readLive(page);
  await lineChoice.click();
  const met = await readLive(page);
  assert.ok(met.claimed.includes("quest-faculty-gu-meet"));
  assert.ok(met.claimed.includes("quest-faculty-studio-meet"));
  assert.equal(met.xp, beforeFaculty.xp + 22);
  assert.equal(met.semester, "midterm");
  const facultyFlags = await page.evaluate(() => {
    const flags = window.__rpgQA.rpg.getState().narrative.flags;
    return { line: flags["fac-gu-meet-line"] === true, fail: flags["fac-gu-meet-fail"] === true };
  });
  assert.equal(facultyFlags.line, true);
  assert.equal(facultyFlags.fail, false);
  await shot(page, "08b-faculty-line");
  const leaveFaculty = page.getByRole("button", { name: "繼續自由探索" });
  await leaveFaculty.click();
  note("faculty-gu", {
    choice: "fac-gu-meet-line",
    otherChoiceVisible: "我帶了失敗的那一版，想先聽你怎麼看。",
    xp: met.xp,
    semester: met.semester,
  });

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const savedText = await page.evaluate(() => localStorage.getItem("tamkang-rpg-v2"));
  const saved = JSON.parse(savedText);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "繼續學期" }).waitFor({ state: "visible", timeout: 120000 });
  await page.getByRole("button", { name: "繼續學期" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing");
  const reloaded = await readLive(page);
  assert.equal(reloaded.departmentId, saved.departmentId);
  assert.equal(reloaded.xp, saved.xp);
  assert.ok(reloaded.claimed.includes("quest-orient-gate"));
  assert.ok(reloaded.claimed.includes("quest-errand-campus-post"));
  assert.ok(reloaded.claimed.includes("semester"));
  assert.ok(reloaded.claimed.includes("quest-gv-night-peace"));
  assert.ok(reloaded.claimed.includes("quest-faculty-gu-meet"));
  assert.ok(reloaded.claimed.includes("quest-faculty-studio-meet"));
  assert.equal(reloaded.semester, "midterm");
  assert.equal(reloaded.equipped, true);
  assert.deepEqual(reloaded.buildings, ["lantern"]);
  assert.equal(reloaded.flag, true);
  const reloadedFaculty = await page.evaluate(() => {
    const flags = window.__rpgQA.rpg.getState().narrative.flags;
    return flags["fac-gu-meet-line"] === true && flags["fac-gu-meet-fail"] !== true;
  });
  assert.equal(reloadedFaculty, true);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const reloadedDoc = JSON.parse(await page.evaluate(() => localStorage.getItem("tamkang-rpg-v2")));
  assert.equal(notesOf(reloadedDoc), notesOf(saved));
  assert.equal(slotCount(reloadedDoc, "badge"), 1);
  assert.equal(reloadedDoc.equipped, true);
  await shot(page, "06-reloaded");
  note("save-reload", {
    xp: reloaded.xp,
    notes: notesOf(reloadedDoc),
    departmentId: reloaded.departmentId,
    equipped: reloaded.equipped,
    buildings: reloaded.buildings,
  });
  assert.deepEqual(api, []);
  report.apiRequests = api;
  return reloadedDoc;
}

function createJar(origin) {
  const cookies = new Map();
  return {
    drop(namePart) {
      for (const name of [...cookies.keys()]) {
        if (name.includes(namePart)) cookies.delete(name);
      }
    },
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    async fetch(url, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("origin", origin);
      const cookie = this.header();
      if (cookie) headers.set("cookie", cookie);
      const response = await fetch(url, { ...init, headers, redirect: "manual" });
      for (const line of response.headers.getSetCookie?.() ?? []) {
        const pair = line.split(";", 1)[0] ?? "";
        const eq = pair.indexOf("=");
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      return response;
    },
  };
}

async function signUp(jar, base, email) {
  const response = await jar.fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Player", email, password: "correct-horse-1" }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.user.id;
}

async function signIn(jar, base, email) {
  const response = await jar.fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-1" }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.user.id;
}

function saveBody(document, extra = {}) {
  return {
    schemaVersion: 1,
    contentVersion: 2,
    baseRevision: 0,
    confirmFirstSync: false,
    requestId: `route-${Math.random().toString(36).slice(2, 12)}`,
    document,
    ...extra,
  };
}

async function freePort() {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

async function syncCloud(document) {
  const dir = await mkdtemp(join(tmpdir(), "tku-route-"));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  process.env.NODE_ENV = "test";
  process.env.AUTH_EMAIL_PASSWORD = "true";
  process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcd";
  process.env.BETTER_AUTH_URL = origin;
  process.env.PGLITE_DATA_DIR = dir;
  process.env.HOST = "127.0.0.1";
  process.env.PORT = String(port);
  delete process.env.DATABASE_URL;
  const { startGameServer } = await import("../src/server/cloud/standalone.ts");
  const { createCloudSaveController, memoryStorage } = await import("../src/features/cloud-save/client.ts");
  const server = await startGameServer({ host: "127.0.0.1", port });
  try {
    const base = server.url ?? origin;
    const health = await fetch(`${base}/api/health`);
    assert.equal((await health.json()).ok, true);
    const jarA = createJar(base);
    const storageA = memoryStorage();
    let offline = false;
    const clientA = createCloudSaveController({
      fetch: async (url, init) => {
        if (offline) throw new Error("offline");
        return jarA.fetch(url, init);
      },
      baseUrl: base,
      storage: storageA,
      randomId: (() => {
        let n = 0;
        return () => `routereq${++n}abcd`;
      })(),
    });
    const text = JSON.stringify(document);
    clientA.writeLocal(text);
    assert.equal((await clientA.plan()).status, "local_only");
    note("guest-local", { status: "local_only" });

    const email = `route-${Date.now()}@example.com`;
    const userA = await signUp(jarA, base, email);
    clientA.bindAccount(userA);
    assert.equal((await clientA.plan()).status, "need_first_sync");
    const refused = await jarA.fetch(`${base}/api/cloud/saves/rpg`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify(saveBody(document)),
    });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).error.code, "first_sync_required");
    assert.equal(clientA.readLocal(), text);
    const uploaded = await clientA.uploadFirstSync();
    assert.equal(uploaded.status, "uploaded");
    note("login-sync", { revision: uploaded.revision, xp: document.xp, user: userA });

    const jarB = createJar(base);
    const storageB = memoryStorage();
    await signIn(jarB, base, email);
    const clientB = createCloudSaveController({
      fetch: (url, init) => jarB.fetch(url, init),
      baseUrl: base,
      storage: storageB,
      randomId: () => `routebreq${Math.random().toString(36).slice(2, 10)}`,
    });
    clientB.bindAccount(userA);
    assert.equal((await clientB.plan()).status, "need_download");
    const downloaded = await clientB.downloadCloud();
    assert.equal(downloaded.status, "downloaded");
    const remote = JSON.parse(clientB.readLocal());
    assert.equal(remote.xp, document.xp);
    assert.equal(remote.departmentId, document.departmentId);
    assert.ok(remote.claimed.includes("quest-orient-gate"));
    assert.ok(remote.claimed.includes("quest-errand-campus-post"));
    assert.ok(remote.claimed.includes("semester"));
    assert.ok(remote.claimed.includes("quest-gv-night-peace"));
    assert.ok(remote.claimed.includes("quest-faculty-gu-meet"));
    assert.equal(remote.narrative.flags["fac-gu-meet-line"], true);
    assert.equal(remote.narrative.semester, "midterm");
    assert.equal(remote.equipped, true);
    assert.equal(remote.buildings.length, 1);
    assert.equal(remote.buildings[0].kind, "lantern");
    note("second-client", {
      xp: remote.xp,
      departmentId: remote.departmentId,
      semester: remote.narrative.semester,
      equipped: remote.equipped,
      buildings: remote.buildings.length,
    });

    const leftDoc = { ...document, xp: document.xp + 3 };
    const rightDoc = { ...document, xp: document.xp + 7 };
    const race = await Promise.all([
      jarA.fetch(`${base}/api/cloud/saves/rpg`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-cloud-save": "1",
          "if-match": '"1"',
        },
        body: JSON.stringify(saveBody(leftDoc, { baseRevision: 1, requestId: "route-race-a-01" })),
      }),
      jarB.fetch(`${base}/api/cloud/saves/rpg`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-cloud-save": "1",
          "if-match": '"1"',
        },
        body: JSON.stringify(saveBody(rightDoc, { baseRevision: 1, requestId: "route-race-b-01" })),
      }),
    ]);
    const statuses = [];
    for (const response of race) statuses.push(response.status);
    assert.ok(statuses.includes(200) && statuses.includes(409), statuses.join(","));
    const loser = race[statuses.indexOf(409)];
    const loserBody = await loser.json();
    assert.equal(loserBody.error.code, "revision_conflict");
    note("conflict", { statuses, code: loserBody.error.code, revision: loserBody.server.revision });

    offline = true;
    clientA.writeLocal(JSON.stringify({ ...document, xp: document.xp + 1 }));
    const queued = await clientA.pushLocal();
    assert.equal(queued.status, "queued");
    offline = false;
    const during = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.notEqual(during.document.xp, document.xp + 1);
    note("disconnect", { queued: queued.status, cloudXp: during.document.xp });

    await jarA.fetch(`${base}/api/auth/sign-out`, { method: "POST" });
    clientA.logout();
    assert.equal((await clientA.plan()).reason, "signed_out");
    const signedOut = await fetch(`${base}/api/cloud/saves/rpg`, {
      headers: { origin: base },
    });
    assert.equal(signedOut.status, 401);
    assert.equal(JSON.parse(clientA.readLocal()).departmentId, document.departmentId);
    note("logout", { status: signedOut.status });
  } finally {
    await server.close();
  }
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const document = await playOffline(page);
  writeFileSync(join(outDir, "save.json"), JSON.stringify(document));
  await syncCloud(document);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = String(error?.stack ?? error);
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
