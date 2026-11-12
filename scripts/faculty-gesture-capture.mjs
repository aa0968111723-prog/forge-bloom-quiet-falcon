import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { facultyPosts } from "../src/features/faculty-story/posts.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const post = facultyPosts().find((entry) => entry.id === "npc-gu-heng");
const dx = post.doorX - post.x;
const dz = post.doorZ - post.z;
const len = Math.hypot(dx, dz) || 1;
const pose = {
  x: post.x + (dx / len) * 2.2,
  z: post.z + (dz / len) * 2.2,
  yaw: Math.atan2(-(post.x - (post.x + (dx / len) * 2.2)), -(post.z - (post.z + (dz / len) * 2.2))),
};

const browser = await chromium.launch({
  executablePath: chromiumExecutablePath(),
  args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (err) => console.log("pageerror", err.message));
await page.goto("http://127.0.0.1:8080/?qa=1", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "開始學期" }).click();
await page.getByRole("button", { name: "建築學系" }).click();
await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
await page.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
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
await page.waitForFunction(() => window.__facultyQA?.people?.["npc-gu-heng"], null, { timeout: 20000 });
const ground = await page.evaluate((point) => window.__rpgQA.ground(point.x, point.z), post);
const face = Math.atan2(-(post.doorX - post.x), -(post.doorZ - post.z)) + Math.PI;
await page.evaluate((target) => {
  window.__controlsTest.setPhoto({
    distance: 2.4,
    height: 1.25,
    yaw: target.yaw,
    lookY: 1.2,
    target: { x: target.x, y: target.y, z: target.z },
  });
}, { x: post.x, y: ground, z: post.z, yaw: face + Math.PI + 0.95 });
await page.waitForTimeout(500);
await page.addStyleTag({ content: ".ad-interact{opacity:0!important}" });
const idle = await page.evaluate(() => window.__facultyQA.people["npc-gu-heng"]);
await page.screenshot({ path: `${outDir}/faculty-gu-idle.png` });
await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
await page.getByRole("button", { name: "交談" }).click();
const talking = await page.evaluate((idleArm) => {
  const scrim = document.querySelector(".ad-narrative-scrim");
  if (scrim) scrim.style.opacity = "0";
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      const row = window.__facultyQA?.people?.["npc-gu-heng"];
      if (row?.action === "interact" && row.armX !== null && Math.abs(row.armX - idleArm) > 0.05) resolve(row);
      else if (performance.now() - start > 2500) reject(new Error(`talk pose ${JSON.stringify(row)}`));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, idle.armX);
await page.screenshot({ path: `${outDir}/faculty-gu-talk.png` });
await page.evaluate(() => {
  const scrim = document.querySelector(".ad-narrative-scrim");
  if (scrim) scrim.style.opacity = "";
});
await page.getByRole("button", { name: "我先補剖面，補完再請你看。" }).click();
const delivering = await page.evaluate((idleArm) => {
  const scrim = document.querySelector(".ad-narrative-scrim");
  if (scrim) scrim.style.opacity = "0";
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = () => {
      const row = window.__facultyQA?.people?.["npc-gu-heng"];
      if (row?.gesture === "deliver" && row.action === "interact" && row.armX !== null && Math.abs(row.armX - idleArm) > 0.05) {
        resolve(row);
      } else if (performance.now() - start > 2500) reject(new Error(`deliver pose ${JSON.stringify(row)}`));
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}, idle.armX);
await page.screenshot({ path: `${outDir}/faculty-gu-deliver.png` });
const renderer = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "no-webgl";
});
const log = { renderer, idle, talking, delivering };
writeFileSync(`${outDir}/faculty-gesture-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
if (idle.action !== null) throw new Error(`idle action was ${idle.action}`);
if (talking.gesture !== "talk" || talking.action !== "interact") throw new Error("talk did not play interact");
if (delivering.gesture !== "deliver" || delivering.action !== "interact") throw new Error("deliver did not play interact");
if (talking.armX === null || Math.abs(talking.armX - idle.armX) < 0.05) {
  throw new Error(`arm did not move: idle ${idle.armX} talk ${talking.armX}`);
}
await browser.close();
