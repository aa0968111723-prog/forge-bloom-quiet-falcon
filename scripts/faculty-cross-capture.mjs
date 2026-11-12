import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";
import { loadCatalog } from "../src/features/narrative/load.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const catalog = loadCatalog();
const posts = facultyPosts();
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
  return { x, z, yaw };
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
  await page.waitForTimeout(500);
}

async function playBeat(page, eventId, choiceIndex) {
  const event = catalog.events.find((entry) => entry.id === eventId);
  await warp(page, standOf(event.placeId));
  const kind = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  if (kind !== "talk") throw new Error(`${eventId} prompt was ${kind}`);
  await page.locator("#narrative-scroll").waitFor();
  await page.getByRole("button", { name: "交談" }).click();
  const line = await page.locator("#narrative-scroll .ad-lead").first().innerText();
  mark(`${eventId} line ${line}`);
  await page.locator("#narrative-scroll button.ad-primary").nth(choiceIndex).click();
  await page.getByRole("button", { name: "繼續自由探索" }).click();
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().panel === null);
  return line;
}

const browser = await chromium.launch({
  executablePath: chromiumExecutablePath(),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});

const paths = [
  { name: "prereq-hear", he: 0, jiang: 0, file: "faculty-heng-turn-prereq-hear" },
  { name: "fixed-class", he: 1, jiang: 1, file: "faculty-heng-turn-fixed-class" },
];

for (const path of paths) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (err) => mark(`pageerror ${err.message}`));
  await page.goto("http://127.0.0.1:8080/?qa=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "開始學期" }).click();
  await page.getByRole("button", { name: "建築學系" }).click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
  const renderer = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "no-webgl";
  });
  mark(`${path.name} renderer ${renderer}`);
  await playBeat(page, "evt-faculty-he-meet", path.he);
  await playBeat(page, "evt-faculty-jiang-meet", path.jiang);
  await playBeat(page, "evt-faculty-heng-meet", 0);
  await playBeat(page, "evt-faculty-heng-clash", 0);
  const event = catalog.events.find((entry) => entry.id === "evt-faculty-heng-turn");
  await warp(page, standOf(event.placeId));
  const kind = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
  if (kind !== "talk") throw new Error(`heng turn prompt was ${kind}`);
  await page.locator("#narrative-scroll").waitFor();
  await page.getByRole("button", { name: "交談" }).click();
  const line = await page.locator("#narrative-scroll .ad-lead").first().innerText();
  mark(`${path.name} heng-turn ${line}`);
  await page.screenshot({ path: `${outDir}/${path.file}.png`, fullPage: false });
  await page.close();
}

await browser.close();
writeFileSync(`${outDir}/faculty-cross-log.json`, JSON.stringify(log, null, 2));
console.log("wrote cross log");
