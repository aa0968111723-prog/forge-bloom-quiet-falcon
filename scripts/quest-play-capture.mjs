import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { SUPPLY_NODES } from "../src/game/rpg/campus.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const node = SUPPLY_NODES.find((entry) => entry.items.notes);
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
const enemy = { x: 78, z: 70.5 };
await page.evaluate((pose) => {
  window.__rpgQA.game.setState({
    warp: { x: pose.x, z: pose.z, yaw: pose.yaw },
    snapCam: true,
    playerX: pose.x,
    playerZ: pose.z,
    playerYaw: pose.yaw,
    phase: "playing",
  });
}, { x: enemy.x - 3.2, z: enemy.z - 1.4, yaw: Math.atan2(3.2, 1.4) });
await page.waitForTimeout(700);
const ground = await page.evaluate((point) => window.__rpgQA.ground(point.x, point.z), enemy);
await page.evaluate((target) => {
  window.__controlsTest.setPhoto({
    distance: 5.4,
    height: 1.8,
    yaw: target.yaw,
    lookY: 1.15,
    target: { x: target.x, y: target.y, z: target.z },
  });
}, { x: enemy.x, y: ground, z: enemy.z, yaw: Math.atan2(-3.2, -1.4) + 0.65 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/quest-patrol-gate.png` });
await page.evaluate(() => window.__controlsTest.setPhoto(null));
await page.evaluate((spot) => {
  window.__rpgQA.game.setState({
    warp: { x: spot.x, z: spot.z, yaw: 0 },
    snapCam: true,
    playerX: spot.x,
    playerZ: spot.z,
    playerYaw: 0,
    phase: "playing",
  });
}, node);
await page.waitForTimeout(400);
const kind = await page.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
const gathered = await page.evaluate(() => window.__rpgQA.rpg.getState().gathered);
await page.evaluate(() => window.__rpgQA.rpg.getState().setPanel("journal"));
await page.getByRole("heading", { name: "把記得的帶回來" }).waitFor();
const body = page.locator(".ad-dialog-body").last();
await body.evaluate((el) => { el.scrollTop = 0; });
await page.screenshot({ path: `${outDir}/quest-journal-lead.png` });
await body.evaluate((el) => {
  const heading = [...el.querySelectorAll("h3")].find((item) => item.textContent.includes("把記得的帶回來"));
  heading?.scrollIntoView({ block: "center" });
});
await page.screenshot({ path: `${outDir}/quest-journal-memory.png` });
await body.evaluate((el) => {
  const heading = [...el.querySelectorAll("h3")].find((item) => item.textContent.includes("先處理分組那一種"));
  heading?.scrollIntoView({ block: "center" });
});
await page.screenshot({ path: `${outDir}/quest-journal-load.png` });
const renderer = await page.evaluate(() => {
  const canvas = document.querySelector("canvas");
  const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "no-webgl";
});
const log = { renderer, kind, gathered, node: node.id };
writeFileSync(`${outDir}/quest-play-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify(log, null, 2));
if (kind !== "supply") throw new Error(`prompt was ${kind}`);
if ((gathered.notes ?? 0) < 1) throw new Error("notes were not remembered");

const mobile = await browser.newPage({
  viewport: { width: 390, height: 780 },
  hasTouch: true,
  isMobile: true,
});
mobile.on("pageerror", (err) => console.log("pageerror", err.message));
await mobile.goto("http://127.0.0.1:8080/?qa=1", { waitUntil: "domcontentloaded" });
await mobile.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.includes("開始學期")));
await mobile.evaluate(() => {
  [...document.querySelectorAll("button")].find((button) => button.textContent.includes("開始學期"))?.click();
});
await mobile.waitForFunction(() => document.querySelectorAll(".ad-department").length > 0, null, { timeout: 15000 });
await mobile.evaluate(() => {
  [...document.querySelectorAll(".ad-department")].find((button) => button.textContent.includes("建築學系"))?.click();
});
await mobile.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing", null, { timeout: 20000 });
await mobile.waitForFunction(() => !document.querySelector(".ad-asset-loading"), null, { timeout: 60000 });
const coarse = await mobile.evaluate(() => matchMedia("(pointer: coarse)").matches);
await mobile.evaluate((spot) => {
  window.__rpgQA.game.setState({
    warp: { x: spot.x, z: spot.z, yaw: 0 },
    snapCam: true,
    playerX: spot.x,
    playerZ: spot.z,
    playerYaw: 0,
    phase: "playing",
  });
}, node);
await mobile.waitForTimeout(400);
await mobile.evaluate(() => window.__rpgQA.rpg.getState().commitPrompt());
await mobile.evaluate(() => window.__rpgQA.rpg.getState().setPanel("journal"));
await mobile.locator("#tk-mobile-scroll-journal").waitFor();
const mobileBox = await mobile.locator("#tk-mobile-scroll-journal").evaluate((el) => {
  const heading = [...el.querySelectorAll("h3")].find((item) => item.textContent.includes("把記得的帶回來"));
  heading?.scrollIntoView({ block: "center" });
  const close = document.getElementById("tk-mobile-close-journal")?.getBoundingClientRect();
  return {
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflow: getComputedStyle(el).overflowY,
    close: close ? { width: close.width, height: close.height } : null,
  };
});
await mobile.screenshot({ path: `${outDir}/quest-journal-mobile.png` });
log.coarse = coarse;
log.mobile = mobileBox;
writeFileSync(`${outDir}/quest-play-log.json`, JSON.stringify(log, null, 2));
console.log(JSON.stringify({ coarse, mobile: mobileBox }, null, 2));
if (!coarse) throw new Error("mobile page did not match pointer: coarse");
if (!mobileBox.close || mobileBox.close.width < 44 || mobileBox.close.height < 44) {
  throw new Error(`journal close control ${JSON.stringify(mobileBox.close)}`);
}
await browser.close();
