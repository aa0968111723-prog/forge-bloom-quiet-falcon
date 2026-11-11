#!/usr/bin/env node
/**
 * Art review captures from the running game (real renderer, real lighting).
 *
 *   node scripts/art/capture-art.mjs <baseUrl> <outDir> <scenario> [--tier low|high]
 *
 * Scenarios
 *   turnaround   protagonist front / three-quarter / side / back in the 宮燈教室
 *                interior (fixed lighting, fast frames)
 *   poses        one frame at the key time of each action clip
 *   avenue       start on 宮燈大道 and walk north; three frames
 *   combat       fight quiz-2 on 宮燈大道: telegraph, strike, hit, skill timeline
 *
 * Writes PNGs plus `<scenario>.json` with what was captured and any page errors.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ensureDir,
  gameUrl,
  holdKeys,
  launchBrowser,
  setPose,
  settle,
  sleep,
  startSemester,
  waitForTitle,
  webglInfo,
} from "./lib/capture.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const base = positional[0] ?? "http://127.0.0.1:8088/";
const outDir = ensureDir(resolve(positional[1] ?? "/tmp/art-capture"));
const scenario = positional[2] ?? "turnaround";
const tier = flag("--tier", "low");
const width = Number(flag("--width", 960));
const height = Number(flag("--height", 600));

const log = [];
const pageErrors = [];
const shot = async (page, name, note) => {
  const path = join(outDir, `${scenario}-${name}.png`);
  await page.screenshot({ path });
  log.push({ name, path, note });
  process.stderr.write(`captured ${name}\n`);
};

/** Wait for `n` rendered frames (robust on slow software renderers). */
async function frames(page, n) {
  await page.evaluate(
    (count) =>
      new Promise((done) => {
        let left = count;
        const tick = () => (--left <= 0 ? done(null) : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );
}

async function enterInterior(page, id) {
  await page.evaluate((site) => {
    const s = window.__rpgQA.rpg.getState();
    s.setPanel(null);
    s.enter(site);
  }, id);
  await page.waitForFunction((site) => window.__rpgQA.rpg.getState().interiorId === site, id);
  await settle(page, { stableFrames: 4 });
}

/** QA photo camera around the player (yaw 0 = behind a north-facing player). */
async function photo(page, yaw, { distance = 2.3, height = 1.05, lookY = 0.92 } = {}) {
  await page.evaluate((p) => window.__controlsTest.setPhoto(p), { yaw, distance, height, lookY });
  await frames(page, 6);
}

async function hideHud(page) {
  await page.addStyleTag({ content: ".ad-ui{display:none !important}" });
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => m.type() === "error" && pageErrors.push("console: " + m.text()));
  await page.goto(gameUrl(base, { tier }), { waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  const gl = await webglInfo(page);
  await startSemester(page);
  await page.waitForFunction(() => Boolean(window.__characterTest?.play), undefined, { timeout: 120000 });

  if (scenario === "turnaround" || scenario === "poses") {
    await enterInterior(page, "palace");
    // Stand mid-room facing the blackboard (north).
    await setPose(page, 0, 1.5, 0);
    await frames(page, 30);
    await hideHud(page);
    if (scenario === "turnaround") {
      for (const [name, yaw] of [
        ["front", Math.PI],
        ["three-quarter", Math.PI * 0.75],
        ["side", Math.PI / 2],
        ["back", 0],
      ]) {
        await photo(page, yaw);
        await shot(page, name, `photo yaw ${yaw.toFixed(2)} rad, body faces north, 宮燈教室 interior light`);
      }
      await photo(page, Math.PI, { distance: 0.72, height: 1.47, lookY: 1.42 });
      await shot(page, "face", "face close-up, front");
      await photo(page, Math.PI * 0.72, { distance: 0.8, height: 1.5, lookY: 1.43 });
      await shot(page, "face-three-quarter", "face close-up, three-quarter");
      await photo(page, Math.PI * 0.62, { distance: 0.9, height: 0.75, lookY: 0.7 });
      await shot(page, "hands", "hand and cuff close-up");
      await photo(page, Math.PI * 0.8, { distance: 0.8, height: 0.35, lookY: 0.12 });
      await shot(page, "shoes", "sneakers close-up");
      await photo(page, Math.PI * 0.15, { distance: 1.0, height: 1.25, lookY: 1.05 });
      await shot(page, "backpack", "backpack, straps and turtle charm");
      await page.evaluate(() => window.__controlsTest.setPhoto(null));
    } else {
      await photo(page, Math.PI * 0.78, { distance: 2.6, height: 1.1, lookY: 0.85 });
      for (const [clip, at] of [
        ["attack", 0.15],
        ["skill", 0.15],
        ["dodge", 0.13],
        ["hurt", 0.06],
        ["interact", 0.3],
      ]) {
        await page.evaluate((c) => window.__characterTest.play(c), clip);
        // Advance to the key time in real frames, then capture.
        const start = Date.now();
        await page.waitForFunction(
          ([c, t]) => window.__characterTest?.action === c && performance.now() > 0 && t >= 0,
          [clip, at],
        );
        await page.waitForTimeout(Math.max(0, at * 1000 - (Date.now() - start)));
        await shot(page, clip, `${clip} near t=${at}s`);
        await frames(page, 30);
      }
    }
  } else if (scenario === "avenue") {
    await setPose(page, 0, -70, 0);
    await settle(page, { stableFrames: 4 });
    await shot(page, "stand", "宮燈大道 looking north");
    await holdKeys(page, ["KeyW"]);
    await frames(page, 8);
    await shot(page, "walk", "walking north");
    await holdKeys(page, ["KeyW", "ShiftLeft"]);
    await frames(page, 8);
    await shot(page, "run", "sprinting north");
    await holdKeys(page, []);
  }

  const result = { ok: pageErrors.length === 0, scenario, tier, viewport: `${width}x${height}`, webgl: gl, captures: log, pageErrors };
  writeFileSync(join(outDir, `${scenario}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (pageErrors.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, scenario, error: error.message, pageErrors, captures: log }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
