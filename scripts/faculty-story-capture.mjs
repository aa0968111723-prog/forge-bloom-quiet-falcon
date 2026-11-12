import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";
import { MAIN_LINE } from "../src/features/faculty-story/route.ts";
import { loadCatalog } from "../src/features/narrative/load.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const catalog = loadCatalog();
const posts = facultyPosts();
const timed = process.argv.includes("--timed");
const video = process.argv.includes("--video");
const log = [];
const mark = (step) => {
  const row = { t: new Date().toISOString(), step };
  log.push(row);
  console.log(row.t, step);
};

function standOf(placeId) {
  const post = posts.find((entry) => entry.placeId === placeId);
  const dx = post.doorX - post.x;
  const dz = post.doorZ - post.z;
  const len = Math.hypot(dx, dz) || 1;
  const x = post.x + (dx / len) * 2.2;
  const z = post.z + (dz / len) * 2.2;
  const yaw = Math.atan2(-(post.x - x), -(post.z - z));
  return { x, z, yaw, name: post.name };
}

async function shot(page, name) {
  const file = `${outDir}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  mark(`shot ${file}`);
}

async function warp(page, pose) {
  await page.evaluate((pose) => {
    window.__rpgQA.game.setState({
      warp: { x: pose.x, z: pose.z, yaw: pose.yaw },
      snapCam: true,
      playerX: pose.x,
      playerZ: pose.z,
      playerYaw: pose.yaw,
      phase: "playing",
    });
  }, pose);
  await page.waitForTimeout(400);
}

async function startSemester(page) {
  await page.goto("http://127.0.0.1:8080/?qa=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "開始學期" }).waitFor({ timeout: 20000 });
  mark("title");
  await page.getByRole("button", { name: "開始學期" }).click();
  await page.getByRole("button", { name: "建築學系" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  mark("playing");
}

const browser = await chromium.launch({
  executablePath: chromiumExecutablePath(),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});

async function rendererOf(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    if (!gl) return "no-webgl";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
}

if (!timed) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...(video ? { recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => mark(`pageerror ${err.message}`));
  await startSemester(page);
  const renderer = await rendererOf(page);
  mark(`renderer ${renderer}`);
  const pose = standOf("post-gu-heng");
  await warp(page, pose);
  await page.waitForTimeout(1500);
  await shot(page, "faculty-gu-heng-world");
  const talked = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  mark(`commit ${talked}`);
  await page.locator("#narrative-scroll").waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: "交談" }).click();
  await page.getByRole("button", { name: "我先補剖面，補完再請你看。" }).waitFor();
  await shot(page, "faculty-gu-meet-choices");
  const before = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    return { xp: rpg.xp, claimed: rpg.claimed.filter((id) => id.startsWith("quest-faculty")) };
  });
  await page.getByRole("button", { name: "我先補剖面，補完再請你看。" }).click();
  await page.getByRole("button", { name: "繼續自由探索" }).waitFor();
  await shot(page, "faculty-gu-meet-outcome");
  await page.getByRole("button", { name: "繼續自由探索" }).click();
  await page.waitForTimeout(2200);
  const after = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    return { xp: rpg.xp, claimed: rpg.claimed.filter((id) => id.startsWith("quest-faculty")) };
  });
  mark(`paid ${JSON.stringify({ before, after })}`);
  await page.waitForTimeout(800);
  await shot(page, "faculty-gu-heng-desktop");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "繼續學期" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
  await warp(page, pose);
  const again = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  mark(`reload commit ${again}`);
  await page.locator("#narrative-scroll").waitFor();
  const line = await page.locator("#narrative-scroll .ad-lead").first().innerText();
  mark(`reload line ${line.slice(0, 80)}`);
  const reloaded = await page.evaluate(() => window.__rpgQA.rpg.getState().xp);
  mark(`xp after reload before next choice ${reloaded}`);
  await shot(page, "faculty-gu-clash-after-reload");
  const clip = video ? page.video() : null;
  await page.close();
  if (clip) {
    const saved = await clip.path();
    mark(`video ${saved}`);
  }
  await context.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 780 } });
  await startSemester(mobile);
  await warp(mobile, pose);
  await mobile.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  await mobile.locator("#narrative-scroll").waitFor();
  await mobile.getByRole("button", { name: "交談" }).click();
  const metrics = await mobile.locator("#narrative-scroll").evaluate((el) => {
    const close = document.getElementById("narrative-close")?.getBoundingClientRect();
    return {
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      overflow: getComputedStyle(el).overflowY,
      close: close ? { width: close.width, height: close.height } : null,
    };
  });
  mark(`mobile ${JSON.stringify(metrics)}`);
  await shot(mobile, "faculty-dialogue-mobile");
  if (metrics.scrollHeight > metrics.clientHeight) {
    await mobile.locator("#narrative-scroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await shot(mobile, "faculty-dialogue-mobile-scrolled");
  }
  await mobile.locator("#narrative-close").click();
  await mobile.waitForFunction(() => window.__rpgQA.rpg.getState().panel === null);
  mark("mobile closed");
  await shot(mobile, "faculty-dialogue-mobile-closed");
}

if (timed) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (err) => mark(`pageerror ${err.message}`));
  const started = Date.now();
  await startSemester(page);
  mark(`renderer ${await rendererOf(page)}`);
  for (const eventId of MAIN_LINE) {
    const event = catalog.events.find((entry) => entry.id === eventId);
    const pose = standOf(event.placeId);
    const from = await page.evaluate(() => {
      const g = window.__rpgQA.game.getState();
      return { x: g.playerX, z: g.playerZ };
    });
    const distance = Math.hypot(pose.x - from.x, pose.z - from.z);
    const steps = Math.max(1, Math.ceil(distance / 4.6));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      await warp(page, {
        x: from.x + (pose.x - from.x) * t,
        z: from.z + (pose.z - from.z) * t,
        yaw: pose.yaw,
      });
      await page.waitForTimeout(600);
    }
    const kind = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
    if (kind !== "talk") throw new Error(`${eventId} prompt was ${kind}`);
    await page.locator("#narrative-scroll").waitFor();
    await page.getByRole("button", { name: "交談" }).click();
    await page.waitForTimeout(12000);
    await page.locator("#narrative-scroll button.ad-primary").nth(0).click();
    await page.waitForTimeout(8000);
    await page.getByRole("button", { name: "繼續自由探索" }).click();
    mark(`${eventId} elapsed ${((Date.now() - started) / 1000).toFixed(1)}s walk ${distance.toFixed(1)}m`);
  }
  mark(`done ${((Date.now() - started) / 60000).toFixed(2)} min`);
}

await browser.close();
writeFileSync(`${outDir}/faculty-play-log.json`, JSON.stringify(log, null, 2));
console.log("wrote log");
