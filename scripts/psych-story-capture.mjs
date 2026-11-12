import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { psychPosts } from "../src/features/psych-story/posts.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const post = psychPosts()[0];
const stand = { x: post.x, z: post.z + 2.4, yaw: Math.atan2(-(post.x - post.x), -(post.z - (post.z + 2.4))) };

async function boot(page) {
  console.log("boot");
  page.on("pageerror", (err) => console.log("pageerror", err.message));
  await page.goto("http://127.0.0.1:8080/?qa=1", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__rpgQA?.rpg, null, { timeout: 20000 });
  const start = page.getByRole("button", { name: "開始學期" });
  try {
    await start.click({ timeout: 8000 });
  } catch {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((button) => button.textContent.includes("開始學期"))?.click();
    });
  }
  const major = page.locator(".ad-department", { hasText: "建築學系" });
  try {
    await major.click({ timeout: 8000 });
  } catch {
    await page.evaluate(() => {
      [...document.querySelectorAll(".ad-department")].find((button) => button.textContent.includes("建築學系"))?.click();
    });
  }
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
}

async function warp(page) {
  await page.evaluate((pose) => {
    window.__rpgQA.game.setState({
      warp: { x: pose.x, z: pose.z, yaw: pose.yaw },
      snapCam: true,
      playerX: pose.x,
      playerZ: pose.z,
      playerYaw: pose.yaw,
      phase: "playing",
      panel: null,
    });
    window.__rpgQA.rpg.getState().setPanel(null);
  }, stand);
  await page.waitForTimeout(400);
}

async function beat(page, choice, shot) {
  const before = await page.evaluate(() => window.__rpgQA.rpg.getState().xp);
  const kind = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  if (kind !== "talk") throw new Error(`prompt was ${kind}`);
  await page.getByRole("button", { name: "交談" }).click();
  await page.getByRole("button", { name: choice }).waitFor();
  if (shot) await page.screenshot({ path: `${outDir}/${shot}` });
  await page.getByRole("button", { name: choice }).click();
  await page.getByRole("button", { name: "繼續自由探索" }).click();
  const after = await page.evaluate(() => ({
    xp: window.__rpgQA.rpg.getState().xp,
    gathered: window.__rpgQA.rpg.getState().gathered.notes,
    panel: window.__rpgQA.rpg.getState().panel,
  }));
  await warp(page);
  return { before, after };
}

const browser = await chromium.launch({
  executablePath: chromiumExecutablePath(),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await boot(page);
await warp(page);
const ground = await page.evaluate((point) => window.__rpgQA.ground(point.x, point.z), post);
await page.evaluate((target) => {
  window.__controlsTest.setPhoto({
    distance: 4.2,
    height: 1.6,
    yaw: 0.4,
    lookY: 1.1,
    target: { x: target.x, y: target.y, z: target.z },
  });
}, { x: post.x, y: ground, z: post.z });
await page.waitForTimeout(400);
await page.screenshot({ path: `${outDir}/psych-xu-hui.png` });
await page.evaluate(() => window.__controlsTest.setPhoto(null));
const retrieve = [];
retrieve.push(await beat(page, "是我沒把那一頁提取出來。", "psych-meet-choices.png"));
retrieve.push(await beat(page, "先停一下，只找回那一頁。", "psych-turn-retrieve.png"));
retrieve.push(await beat(page, "把這句留在筆記上。", "psych-after-retrieve-pause.png"));
const done = await page.evaluate(() => {
  const kind = window.__rpgQA.rpg.getState().commitPrompt();
  return { kind, notice: window.__rpgQA.rpg.getState().notice, gathered: window.__rpgQA.rpg.getState().gathered.notes };
});

await page.evaluate(() => {
  const rpg = window.__rpgQA.rpg;
  const session = rpg.getState().narrative;
  const flags = Object.fromEntries(Object.entries(session.flags).filter(([key]) => !key.startsWith("psych-")));
  const memory = Object.fromEntries(Object.entries(session.memory).filter(([key]) => !key.startsWith("npc-xu-hui:")));
  const questNodes = { ...session.questNodes };
  delete questNodes["quest-psych-cause"];
  rpg.setState({
    narrative: {
      ...session,
      flags,
      memory,
      questNodes,
      fired: session.fired.filter((id) => !id.startsWith("evt-psych-")),
      resolved: session.resolved.filter((id) => !id.startsWith("evt-psych-")),
      activeEventId: null,
      mode: "exploring",
      placeId: null,
    },
    narrativeUi: null,
    panel: null,
    claimed: rpg.getState().claimed.filter((id) => !id.startsWith("quest-psych-")),
    discoveries: rpg.getState().discoveries.filter((id) => id !== "post-xu-hui"),
  });
});
console.log("path2");
await warp(page);
await beat(page, "是當時兩件事一起擠進來，那一頁被擠掉了。", null);
await beat(page, "先放下其中一件，再回來取那一頁。", null);
await beat(page, "把這句說給下一組聽。", "psych-after-load-shed.png");
const renderer = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "no-webgl";
});
await page.close();

const mobile = await browser.newPage({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
await boot(mobile);
await warp(mobile);
await mobile.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
await mobile.getByRole("button", { name: "交談" }).click();
await mobile.getByRole("button", { name: "是我沒把那一頁提取出來。" }).click();
await mobile.getByRole("button", { name: "繼續自由探索" }).click();
await warp(mobile);
await mobile.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
await mobile.getByRole("button", { name: "交談" }).click();
await mobile.getByText("沒把那一頁提取出來").waitFor();
const mobileBox = await mobile.locator("#narrative-scroll").evaluate((el) => {
  const close = document.getElementById("narrative-close")?.getBoundingClientRect();
  return {
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflow: getComputedStyle(el).overflowY,
    close: close ? { width: Math.round(close.width), height: Math.round(close.height) } : null,
    coarse: matchMedia("(pointer: coarse)").matches,
  };
});
await mobile.screenshot({ path: `${outDir}/psych-turn-mobile.png` });

const log = { renderer, post: { x: post.x, z: post.z }, retrieve, done, mobile: mobileBox };
writeFileSync(`${outDir}/psych-story-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
if (done.notice?.includes("沒有新的話") !== true) throw new Error(`notice ${done.notice}`);
if (done.gathered !== 0) throw new Error("quest notes were counted as gathered memory");
const deltas = retrieve.map((row) => row.after.xp - row.before);
if (deltas.join() !== "18,8,10") throw new Error(`xp deltas ${deltas.join()}`);
if (!mobileBox.coarse) throw new Error("mobile pointer was not coarse");
if (!mobileBox.close || mobileBox.close.width < 44 || mobileBox.close.height < 44) {
  throw new Error(`close ${JSON.stringify(mobileBox.close)}`);
}
await browser.close();
