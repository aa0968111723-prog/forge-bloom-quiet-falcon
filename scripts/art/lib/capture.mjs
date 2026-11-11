/**
 * Shared Playwright helpers for the art pipeline captures.
 *
 * Everything here drives the real game page in a real Chromium WebGL context.
 * On a GPU-less host Chromium falls back to SwiftShader, so frame times taken
 * here describe *that* host only; callers label them with `hostLabel()` and
 * never present them as phone or desktop-GPU results.
 */
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "../../browser-exe.mjs";
import { checkedUrl } from "../../browser-guard.mjs";

export function browserExecutable() {
  const candidates = [
    process.env.PW_CHROMIUM_PATH,
    chromiumExecutablePath(),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ];
  return candidates.find((c) => c && existsSync(c));
}

export async function launchBrowser() {
  return chromium.launch({
    headless: true,
    executablePath: browserExecutable(),
    args: [
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--enable-webgl",
    ],
  });
}

/** Identifies the machine that produced a measurement. */
export function hostLabel(renderer) {
  const cpu = os.cpus()[0]?.model?.replace(/\s+/g, " ").trim() ?? "unknown-cpu";
  return `${os.cpus().length}vcpu ${cpu} / ${renderer ?? "unknown-renderer"}`;
}

export function gameUrl(base, { tier = "high", extra = {} } = {}) {
  const url = new URL(checkedUrl(base));
  url.searchParams.set("qa", "1");
  url.searchParams.set("q", tier);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, String(v));
  return url.toString();
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function button(page, name) {
  return page.getByRole("button", { name, exact: true });
}

/** WebGL vendor/renderer strings, so captures record what actually drew them. */
export async function webglInfo(page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return { ok: false };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      ok: true,
      version: gl.getParameter(gl.VERSION),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  });
}

/** Wait until the scene graph stops growing (lazy Suspense children done). */
export async function settle(page, { floor = 1, stableFrames = 6, timeout = 90000 } = {}) {
  const deadline = Date.now() + timeout;
  let last = -1;
  let stable = 0;
  for (;;) {
    const g = await page
      .evaluate(() => window.__perfTest?.info.memory.geometries ?? 0)
      .catch(() => 0);
    stable = g === last && g >= floor ? stable + 1 : 0;
    last = g;
    if (stable >= stableFrames) return g;
    if (Date.now() > deadline) throw new Error(`scene never settled (geometries ${g})`);
    await page.waitForTimeout(250);
  }
}

/**
 * Sample real requestAnimationFrame intervals for `ms`, then read the
 * renderer's draw statistics from the last frame.
 */
export async function sampleFrames(page, ms = 3000) {
  return page.evaluate(async (duration) => {
    const deltas = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      const tick = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - start >= duration) resolve(null);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    deltas.shift();
    const sorted = deltas.slice().sort((a, b) => a - b);
    const pick = (q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
    const median =
      sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    const info = window.__perfTest?.info;
    return {
      frames: sorted.length,
      frameMsMedian: Number(median?.toFixed(2)),
      frameMsP95: Number(pick(0.95)?.toFixed(2)),
      drawCalls: info?.render.calls ?? null,
      triangles: info?.render.triangles ?? null,
      geometries: info?.memory.geometries ?? null,
      textures: info?.memory.textures ?? null,
    };
  }, ms);
}

/** Network transfer as the browser saw it, split by type. */
export async function transferStats(page) {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    const nav = performance.getEntriesByType("navigation")[0];
    const byType = {};
    let transfer = nav?.transferSize ?? 0;
    let encoded = nav?.encodedBodySize ?? 0;
    for (const e of entries) {
      const ext = (new URL(e.name).pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? "other").toLowerCase();
      byType[ext] ??= { count: 0, transferBytes: 0, encodedBytes: 0 };
      byType[ext].count += 1;
      byType[ext].transferBytes += e.transferSize ?? 0;
      byType[ext].encodedBytes += e.encodedBodySize ?? 0;
      transfer += e.transferSize ?? 0;
      encoded += e.encodedBodySize ?? 0;
    }
    return { resources: entries.length + 1, transferBytes: transfer, encodedBytes: encoded, byType };
  });
}

/**
 * Start a fresh semester through the real title UI and department picker.
 * `query` is typed into the department search; `pick` selects the result.
 */
export async function startSemester(page, { query = "土木工程", pick = /土木工程學系/ } = {}) {
  await button(page, "開始學期").click();
  const major = page.getByRole("dialog", { name: "選擇你的主修" });
  await major.getByRole("textbox", { name: "搜尋科系" }).fill(query);
  await major.getByRole("button", { name: pick }).click();
  const skip = button(page, "略過");
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.waitForFunction(() => window.__rpgQA?.game.getState().phase === "playing");
}

/** Wait for the title screen to be operable: first frame drawn and button live. */
export async function waitForTitle(page, timeout = 120000) {
  await button(page, "開始學期").waitFor({ state: "visible", timeout });
  await page.waitForFunction(
    () => (window.__perfTest?.info.render.calls ?? 0) > 0 && !document.querySelector(".ad-asset-loading"),
    undefined,
    { timeout },
  );
}

export async function setPose(page, x, z, yaw = 0) {
  await page.waitForFunction(() => Boolean(window.__controlsTest?.setPose));
  await page.evaluate(([px, pz, py]) => window.__controlsTest.setPose(px, pz, py), [x, z, yaw]);
}

export async function holdKeys(page, codes) {
  await page.evaluate((c) => window.__controlsTest?.setKeys?.(c), codes);
}

export const sleep = (page, ms) => page.waitForTimeout(ms);
