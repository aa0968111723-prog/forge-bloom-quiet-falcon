#!/usr/bin/env node
/** Exercise the deployed RPG entry, construction, and reload in a fresh browser. */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { chromiumExecutablePath } from "./browser-exe.mjs";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(
  process.argv[3] || "/workspace/screenshots/play-smoke.png",
  ["/workspace", process.env.BROWSER_SMOKE_ALLOWED_DIR].filter(Boolean),
);
const timeout = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 60000);
mkdirSync(dirname(outPng), { recursive: true });

function button(page, name) {
  return page.getByRole("button", { name, exact: true });
}

async function materials(page) {
  await button(page, "背包").click();
  const pack = page.getByRole("dialog", { name: "背包" });
  const counts = {};
  for (const item of ["課堂筆記", "構築零件"]) {
    const label = await pack.getByRole("button", { name: new RegExp(`^${item} \\d+ 個$`) })
      .getAttribute("aria-label");
    const count = Number(label?.match(/ (\d+) 個$/)?.[1]);
    assert.ok(Number.isInteger(count), `Missing inventory quantity for ${item}`);
    counts[item] = count;
  }
  await button(pack, "關閉").click();
  return counts;
}

async function visit(page, landmark) {
  await button(page, "開啟校園地圖").click();
  await button(page.getByRole("dialog", { name: "校園地圖" }), `前往${landmark}`).click();
}

async function previewDesk(page) {
  await button(page, "建造").click();
  const panel = page.getByRole("dialog", { name: "建造" });
  const card = panel.locator("article").filter({
    has: page.getByRole("heading", { name: "自習工作臺", exact: true }),
  });
  await button(card, "放置").click();
  await button(page, "結束建造").waitFor();
}

const pageErrors = [];
let browser;
let stage = "launch";
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutablePath(),
    args: ["--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 960, height: 600 },
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(timeout);
  page.on("pageerror", (error) => pageErrors.push(error.message));

  stage = "start anonymous semester";
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  assert.ok(response?.ok(), `Unexpected HTTP status ${response?.status()}`);
  await button(page, "遊戲設定").click();
  await button(page, "省電").click();
  await page.getByRole("button", { name: /^光影後製 · 關/ }).click();
  await button(page, "關閉").click();
  await button(page, "開始學期").click();
  const major = page.getByRole("dialog", { name: "選擇你的主修" });
  await major.getByRole("textbox", { name: "搜尋科系" }).fill("資訊工程");
  await major.getByRole("button", { name: /資訊工程學系/ }).click();
  await button(page, "略過").click();
  await page.locator("canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__perfTest?.info.render.calls > 0);
  const before = await materials(page);

  stage = "reject overlapping placement";
  await visit(page, "紹謨紀念體育館");
  await previewDesk(page);
  await page.getByText("與校園建築重疊", { exact: true }).waitFor();
  await button(page, "放置").click();
  await page.getByRole("status").filter({ hasText: "與校園建築重疊" }).waitFor();
  await button(page, "結束建造").click();
  await button(page, "普攻").waitFor();
  assert.deepEqual(await materials(page), before, "Rejected or cancelled placement spent materials");

  stage = "rotate and place";
  await visit(page, "五虎崗綜合球場");
  await previewDesk(page);
  await button(page, "旋轉").click();
  await button(page, "放置").click();
  await page.getByRole("status").filter({ hasText: "已建造自習工作臺" }).waitFor();
  await button(page, "結束建造").click();
  const after = await materials(page);
  assert.deepEqual(after, {
    課堂筆記: before.課堂筆記 - 5,
    構築零件: before.構築零件 - 4,
  }, "The desk must consume one recipe");

  stage = "reload and resume";
  await page.getByText("進度已保存", { exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded", timeout });
  await button(page, "繼續學期").click();
  assert.deepEqual(await materials(page), after, "Reload did not preserve the inventory");
  await button(page, "建造").click();
  const built = page.getByRole("dialog", { name: "建造" }).locator(".ad-built-list");
  assert.equal(await built.getByText(/自習工作臺/).count(), 1, "Reload did not preserve exactly one desk");
  await button(page, "關閉").click();
  await page.waitForFunction(() => window.__perfTest?.info.render.calls > 0);
  await page.screenshot({ path: outPng, fullPage: false });
  assert.deepEqual(pageErrors, [], "Browser reported uncaught exceptions");
  console.log(JSON.stringify({ ok: true, url, before, after, screenshot: outPng }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, stage, error: error.message, pageErrors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
}
