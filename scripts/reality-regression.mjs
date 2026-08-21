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
let perfResult = null;
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

/**
 * Wait until the campus has actually been built, rather than sleeping a fixed
 * amount — a fixed timeout guesses, and guesses badly on a software renderer.
 *
 * Readiness is "the geometry count stopped growing", not "it passed N".
 * An absolute threshold silently encodes today's scene complexity, so any
 * legitimate optimisation trips it: merging the character's twenty loose
 * meshes into one skinned mesh cut the count by ~60 and broke a hard-coded
 * 300. Settling is the property we actually mean, and it holds whichever
 * direction the count moves.
 */
async function waitForScene(page, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  // The scene has clearly mounted past the sky/water shell by this point.
  const FLOOR = 120;
  const STABLE_POLLS = 4;
  let last = -1;
  let stable = 0;
  for (;;) {
    const g = await page
      .evaluate(() => window.__perfTest?.info.memory.geometries ?? 0)
      .catch(() => 0);
    stable = g === last ? stable + 1 : 0;
    last = g;
    if (g >= FLOOR && stable >= STABLE_POLLS) return g;
    if (Date.now() > deadline) {
      failures.push(
        `scene never finished building (geometries settled at ${g}, floor ${FLOOR})`,
      );
      return g;
    }
    await page.waitForTimeout(1000);
  }
}

async function boot(page, extraQuery = "") {
  const url = extraQuery ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${extraQuery}` : baseUrl;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.getByRole("button", { name: "開始巡禮" }).waitFor({ timeout: 30000 });
  await waitForScene(page);
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
  // Benchmarks capture the full-detail scene, but with the post chain off:
  // a software-GL runner cannot feed a full-screen composer and still finish
  // loading. Post-processing is verified separately at a smaller viewport.
  await boot(page, "q=high&postfx=off");

  for (const bench of BENCHMARK_CAMERAS) {
    // Re-assert the hook each time: a slow software renderer can remount the
    // canvas between captures, and a bare TypeError here would hide whatever
    // the actual regression was.
    await page
      .waitForFunction(() => Boolean(window.__controlsTest?.setBenchmark), { timeout: 30000 })
      .catch(() => failures.push(`benchmark ${bench.id}: controls hook never appeared`));
    await page.evaluate((id) => window.__controlsTest?.setBenchmark(id), bench.id);
    // Give the forced lighting preset + camera a few frames.
    await page.waitForTimeout(650);
    const active = await page.evaluate(() => window.__controlsTest.getBenchmark());
    if (active !== bench.id) failures.push(`benchmark ${bench.id} did not activate (got ${active})`);
    await shot(page, `${outDir}/${bench.id}.png`);
    log("bench", bench.id);
  }
  await page.evaluate(() => window.__controlsTest.setBenchmark(null));

  // Renderer statistics + a crude FPS probe at the avenue benchmark — the
  // heaviest sightline. Numbers are printed, and only wildly out-of-budget
  // values fail the run (headless software GL is not a real GPU).
  await page.evaluate((id) => window.__controlsTest.setBenchmark(id), "LANTERN_01");
  await page.waitForTimeout(500);
  const perf = await page.evaluate(async () => {
    const info = window.__perfTest?.info;
    const t0 = performance.now();
    let frames = 0;
    await new Promise((resolve) => {
      const tick = () => {
        frames += 1;
        if (performance.now() - t0 > 2000) resolve(null);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return {
      calls: info?.render.calls ?? -1,
      triangles: info?.render.triangles ?? -1,
      geometries: info?.memory.geometries ?? -1,
      textures: info?.memory.textures ?? -1,
      fps: Math.round((frames / (performance.now() - t0)) * 1000),
    };
  });
  log("perf", JSON.stringify(perf));
  if (perf.calls > 600) failures.push(`perf: ${perf.calls} draw calls at LANTERN_01 (budget 600)`);
  if (perf.triangles > 1_600_000) failures.push(`perf: ${perf.triangles} triangles at LANTERN_01`);
  await page.evaluate(() => window.__controlsTest.setBenchmark(null));

  if (pageErrors.length) failures.push(`page errors during benchmarks: ${pageErrors.join("; ")}`);
  perfResult = perf;
  await page.close();
}

/* ------------------------------------------------------------ traversal walk */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  // The traversal validates collision and ground logic, not visuals: run the
  // low quality tier so headless software GL keeps a workable frame rate.
  await boot(page, "q=low");

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
    // Sprint is 7.8 m/s under real rendering; software GL runs the clock much
    // slower (delta clamping), so budget a very generous 1 m/s equivalent.
    const deadline = Date.now() + 40000 + segLen * 1600;
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
      if (stuckMs > 12000) {
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

/* --------------------------------------------------- post-processing smoke */
{
  // Small viewport so the software renderer can actually drive the composer.
  const page = await browser.newPage({ viewport: { width: 640, height: 380 } });
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await boot(page, "q=high&postfx=on");
  await page.evaluate(() => window.__controlsTest.setBenchmark("LANTERN_SUNSET"));
  await page.waitForTimeout(6000);
  const drew = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return { ok: false, reason: "no canvas" };
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return { ok: Boolean(gl), reason: gl ? "" : "no gl context" };
  });
  if (!drew.ok) failures.push(`postfx: ${drew.reason}`);
  await shot(page, `${outDir}/postfx-sunset.png`);
  if (pageErrors.length) failures.push(`post-processing page errors: ${pageErrors.join("; ")}`);
  log("postfx captured");
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
  // Headless software GL runs slow. Any unambiguous climb passes: a couple of
  // treads gained is proof the input path, collision and stepped ground all
  // work on a touch-tier device.
  if (!(after.z < before.z - 2 && after.y > before.y + 0.24)) {
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
  console.log(JSON.stringify({ ok: false, failures, perf: perfResult }, null, 2));
  process.exit(2);
}
console.log(JSON.stringify({ ok: true, benchmarks: BENCHMARK_CAMERAS.length, perf: perfResult, outDir }, null, 2));
