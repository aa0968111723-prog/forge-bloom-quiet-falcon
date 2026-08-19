#!/usr/bin/env node
/**
 * Reality Pass visual + traversal regression.
 * ============================================
 *
 * 1. Captures every fixed benchmark camera (world-data/benchmarks.ts) as a PNG,
 *    each in its own declared lighting preset, so scene edits are judged from
 *    the same viewpoints every time instead of a free camera.
 * 2. Walks the player along MAIN_ROUTE with real key input and asserts:
 *      - the player is never blocked for long (colliders vs. the route)
 *      - ground height under the player never jumps more than a stair riser
 *      - the corridor landmarks appear in the HUD as they are passed
 * 3. Mobile viewport smoke: page boots, canvas exists, touch controls render.
 *
 * Usage: node scripts/reality-regression.mjs [baseUrl] [outDir]
 * Exit codes: 0 ok, 1 setup failure, 2 regression detected.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

import { BENCHMARK_CAMERAS } from "../src/game/world-data/benchmarks.ts";
import { MAIN_ROUTE } from "../src/game/world-data/axis.ts";
import { sampleGroundElevation } from "../src/game/world-data/elevation.ts";

const baseUrl = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outDir = checkedOutputPath(process.argv[3] || "/workspace/screenshots/reality", [
  "/workspace",
  process.cwd(),
]);
mkdirSync(outDir, { recursive: true });

const failures = [];
const log = (...a) => process.stderr.write(a.join(" ") + "\n");

const browser = await chromium.launch({
  headless: true,
  executablePath: chromiumExecutablePath(),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function shot(page, path) {
  const session = await page.context().newCDPSession(page);
  const { data } = await session.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(data, "base64"));
  await session.detach().catch(() => {});
}

async function boot(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByRole("button", { name: "開始巡禮" }).waitFor({ timeout: 30000 });
  // Let the material library and geometry settle before judging anything.
  await page.waitForTimeout(2600);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("button")];
    nodes.find((n) => n.textContent?.includes("開始巡禮"))?.click();
  });
  await page.waitForTimeout(900);
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setBenchmark), { timeout: 8000 });
}

/* ---------------------------------------------------- benchmark screenshots */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await boot(page);

  for (const bench of BENCHMARK_CAMERAS) {
    await page.evaluate((id) => window.__controlsTest.setBenchmark(id), bench.id);
    // Give the forced lighting preset + camera a few frames.
    await page.waitForTimeout(650);
    const active = await page.evaluate(() => window.__controlsTest.getBenchmark());
    if (active !== bench.id) failures.push(`benchmark ${bench.id} did not activate (got ${active})`);
    await shot(page, `${outDir}/${bench.id}.png`);
    log("bench", bench.id);
  }
  await page.evaluate(() => window.__controlsTest.setBenchmark(null));

  if (pageErrors.length) failures.push(`page errors during benchmarks: ${pageErrors.join("; ")}`);
  await page.close();
}

/* ------------------------------------------------------------ traversal walk */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await boot(page);

  // Start at the spawn end of the route.
  const [sx, sz] = MAIN_ROUTE[0];
  await page.evaluate(({ x, z }) => window.__controlsTest.setPose(x, z, 0), { x: sx, z: sz });
  await page.waitForTimeout(400);

  const seenLandmarks = new Set();
  let stuckMs = 0;
  let lastPos = await page.evaluate(() => window.__controlsTest.getPosition());
  // Keys stay held for the whole walk; only the yaw is steered each tick, so
  // the player keeps momentum exactly as a human holding W would.
  await page.evaluate(() => window.__controlsTest.setKeys(["KeyW", "ShiftLeft"]));

  segments: for (let i = 1; i < MAIN_ROUTE.length; i++) {
    const [tx, tz] = MAIN_ROUTE[i];
    const segLen = Math.hypot(tx - lastPos.x, tz - lastPos.z);
    // Sprint is 7.8 m/s under real rendering; allow a generous 2 m/s to
    // absorb headless-software-GL frame rates before calling it a failure.
    const deadline = Date.now() + 20000 + (segLen / 2) * 1000;
    for (;;) {
      const state = await page.evaluate(({ x, z }) => {
        const t = window.__controlsTest;
        const cur = t.getPosition();
        t.setYaw(Math.atan2(-(x - cur.x), -(z - cur.z)));
        const hud = document.querySelector(".font-display.text-xl");
        return { pos: cur, hud: hud ? hud.textContent : null };
      }, { x: tx, z: tz });
      const { pos, hud } = state;
      if (hud) seenLandmarks.add(hud.trim());
      const dist = Math.hypot(tx - pos.x, tz - pos.z);
      if (dist < 1.8) break;
      if (Date.now() > deadline) {
        failures.push(`traversal: timed out heading to waypoint ${i} (${tx},${tz}), at ${pos.x.toFixed(1)},${pos.z.toFixed(1)}`);
        break segments;
      }
      const moved = Math.hypot(pos.x - lastPos.x, pos.z - lastPos.z);
      stuckMs = moved < 0.1 ? stuckMs + 300 : 0;
      lastPos = pos;
      if (stuckMs > 6000) {
        failures.push(`traversal: stuck ~${stuckMs}ms near ${pos.x.toFixed(1)},${pos.z.toFixed(1)} heading to waypoint ${i}`);
        break segments;
      }
      // Ground sanity: the player stands on the analytic ground, not in it.
      const expected = sampleGroundElevation(pos.x, pos.z);
      if (Math.abs(pos.y - expected) > 0.65) {
        failures.push(`traversal: player y ${pos.y.toFixed(2)} vs ground ${expected.toFixed(2)} at ${pos.x.toFixed(1)},${pos.z.toFixed(1)}`);
        break segments;
      }
      await page.waitForTimeout(300);
    }
    log("waypoint", i, "reached");
  }
  await page.evaluate(() => window.__controlsTest.setKeys([]));
  for (const name of ["克難坡", "驚聲銅像廣場", "宮燈大道", "海豚里程碑", "書卷廣場", "覺生紀念圖書館"]) {
    if (![...seenLandmarks].some((s) => s.includes(name))) {
      failures.push(`traversal: HUD never showed ${name} (saw: ${[...seenLandmarks].join(", ") || "nothing"})`);
    }
  }
  await shot(page, `${outDir}/route-end.png`);
  if (pageErrors.length) failures.push(`page errors during traversal: ${pageErrors.join("; ")}`);
  await page.close();
}

/* ------------------------------------------------------------- mobile smoke */
{
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await page.goto(`${baseUrl}${baseUrl.includes("?") ? "&" : "?"}q=low`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.getByRole("button", { name: "開始巡禮" }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("button")];
    nodes.find((n) => n.textContent?.includes("開始巡禮"))?.click();
  });
  await page.waitForTimeout(1200);
  const canvasCount = await page.locator("canvas").count();
  if (canvasCount < 1) failures.push("mobile: no canvas rendered");
  // Climb a few steps of the slope with the injected keys to prove movement.
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setPose), { timeout: 8000 });
  await page.evaluate(() => window.__controlsTest.setPose(0, 80, 0));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.__controlsTest.getPosition());
  await page.evaluate(() => window.__controlsTest.setKeys(["KeyW", "ShiftLeft"]));
  await page.waitForTimeout(6000);
  await page.evaluate(() => window.__controlsTest.setKeys([]));
  const after = await page.evaluate(() => window.__controlsTest.getPosition());
  // Headless software GL runs slow; any real climb (several steps up) passes.
  if (!(after.z < before.z - 3 && after.y > before.y + 0.4)) {
    failures.push(
      `mobile: did not climb the slope (z ${before.z.toFixed(1)}->${after.z.toFixed(1)}, y ${before.y.toFixed(2)}->${after.y.toFixed(2)})`,
    );
  }
  await shot(page, `${outDir}/mobile-kenan.png`);
  if (pageErrors.length) failures.push(`mobile page errors: ${pageErrors.join("; ")}`);
  await page.close();
}

await browser.close();

if (failures.length) {
  console.log(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, benchmarks: BENCHMARK_CAMERAS.length, outDir }, null, 2));
