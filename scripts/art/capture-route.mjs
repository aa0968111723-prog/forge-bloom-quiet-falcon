#!/usr/bin/env node
/**
 * Five-segment runtime route: title → outdoor → combat → indoor → outdoor-return.
 *
 *   node scripts/art/capture-route.mjs <baseUrl> <outDir> [--tier high|low] [--label name]
 *
 * Drives the real game through its UI and the `?qa=1` store seam, samples real
 * requestAnimationFrame intervals per segment, reads renderer statistics and
 * network transfer, and saves one screenshot per segment plus `route.json`.
 * Numbers describe the host that ran the browser (see `host` in the output);
 * they are not phone or desktop-GPU results.
 */
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ensureDir,
  gameUrl,
  holdKeys,
  hostLabel,
  launchBrowser,
  sampleFrames,
  setPose,
  settle,
  sleep,
  startSemester,
  transferStats,
  waitForTitle,
  webglInfo,
} from "./lib/capture.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = args[0] && !args[0].startsWith("--") ? args[0] : "http://127.0.0.1:8089/";
const outDir = ensureDir(resolve(args[1] && !args[1].startsWith("--") ? args[1] : "/tmp/art-route"));
const tier = flag("--tier", "high");
const label = flag("--label", "route");
const viewport = tier === "low" ? { width: 844, height: 390 } : { width: 1280, height: 720 };
const SAMPLE_MS = Number(process.env.ROUTE_SAMPLE_MS || 4000);

const pageErrors = [];
const segments = [];
const browser = await launchBrowser();
let stage = "launch";
try {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") pageErrors.push("console: " + m.text());
  });

  stage = "title";
  const t0 = Date.now();
  await page.goto(gameUrl(base, { tier }), { waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  const timeToTitleMs = Date.now() - t0;
  await settle(page);
  const titleOperableMs = Date.now() - t0;
  const gl = await webglInfo(page);
  segments.push({ segment: "title", timeToOperableMs: titleOperableMs, ...(await sampleFrames(page, SAMPLE_MS)) });
  await page.screenshot({ path: join(outDir, `${label}-1-title.png`) });

  stage = "outdoor";
  const s0 = Date.now();
  await startSemester(page);
  await setPose(page, 0, -60, 0);
  await settle(page);
  const outdoorOperableMs = Date.now() - s0;
  await holdKeys(page, ["KeyW"]);
  const outdoor = await sampleFrames(page, SAMPLE_MS);
  await holdKeys(page, []);
  segments.push({ segment: "outdoor", timeToOperableMs: outdoorOperableMs, ...outdoor });
  await page.screenshot({ path: join(outDir, `${label}-2-outdoor.png`) });

  stage = "combat";
  // quiz-2 anchors at (5, -104); stand inside its chase radius facing it.
  await setPose(page, 1.5, -97.5, -0.45);
  await sleep(page, 400);
  const combatSample = page.evaluate(async () => {
    const qa = window.__rpgQA;
    const until = performance.now() + 4000;
    let swings = 0;
    while (performance.now() < until) {
      qa.rpg.getState().attack(swings % 4 === 3);
      swings++;
      await new Promise((r) => setTimeout(r, 250));
    }
    return swings;
  });
  const combat = await sampleFrames(page, SAMPLE_MS);
  await combatSample;
  const fight = await page.evaluate(() => {
    const s = window.__rpgQA.rpg.getState();
    const e = s.enemies.find((x) => x.id === "quiz-2");
    return { quiz2: e ? { hp: e.hp, state: e.state } : null, playerHp: s.hp, kills: s.kills };
  });
  segments.push({ segment: "combat", ...combat, fight });
  await page.screenshot({ path: join(outDir, `${label}-3-combat.png`) });

  stage = "indoor";
  const i0 = Date.now();
  await page.evaluate(() => {
    const s = window.__rpgQA.rpg.getState();
    s.setPanel(null);
    s.enter("palace");
  });
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().interiorId === "palace");
  await settle(page, { stableFrames: 4 });
  const indoorOperableMs = Date.now() - i0;
  segments.push({ segment: "indoor", timeToOperableMs: indoorOperableMs, ...(await sampleFrames(page, SAMPLE_MS)) });
  await page.screenshot({ path: join(outDir, `${label}-4-indoor.png`) });

  stage = "outdoor-return";
  const r0 = Date.now();
  await page.evaluate(() => window.__rpgQA.rpg.getState().exit());
  await page.waitForFunction(() => window.__rpgQA.rpg.getState().interiorId === null);
  await settle(page, { stableFrames: 4 });
  const returnOperableMs = Date.now() - r0;
  segments.push({
    segment: "outdoor-return",
    timeToOperableMs: returnOperableMs,
    ...(await sampleFrames(page, SAMPLE_MS)),
  });
  await page.screenshot({ path: join(outDir, `${label}-5-outdoor-return.png`) });

  const transfer = await transferStats(page);
  const heap = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const result = {
    ok: pageErrors.length === 0,
    label,
    url: gameUrl(base, { tier }),
    tier,
    viewport: `${viewport.width}x${viewport.height}`,
    host: hostLabel(gl.renderer),
    webgl: gl,
    measuredAt: new Date().toISOString(),
    timeToTitleMs,
    segments,
    transfer,
    usedJSHeapBytes: heap,
    pageErrors,
    note: "Frame times are from this host's browser. Not a phone or desktop-GPU result.",
  };
  writeFileSync(join(outDir, `${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (pageErrors.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ ok: false, stage, error: error.message, pageErrors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
