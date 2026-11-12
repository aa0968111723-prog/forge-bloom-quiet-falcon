/**
 * Fresh semester. Open the journal and read the collection missions at zero.
 *
 *   node --experimental-transform-types scripts/integration-journal.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-journal
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-journal";
mkdirSync(outDir, { recursive: true });

const NAMES = ["把記得的帶回來", "手上的材料", "先把精神提起來", "先處理分組那一種"];

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const report = { pageErrors: [] };
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  await startSemester(page, { query: "建築學系", pick: /建築學系/ });
  await page.getByRole("button", { name: "學期委託" }).click();
  await page.getByText("還沒做完的會留在這裡").waitFor({ state: "visible" });
  for (const name of NAMES) {
    await page.getByRole("heading", { name }).waitFor({ state: "visible" });
  }
  const counts = await page.locator("small").allTextContents();
  assert.ok(counts.some((text) => text.includes("0 / 12")));
  assert.ok(counts.some((text) => text.includes("0 / 4")));
  assert.ok(counts.some((text) => text.includes("0 / 2")));
  const state = await page.evaluate(() => {
    const rpg = window.__rpgQA.rpg.getState();
    return {
      semester: rpg.narrative.semester,
      gathered: rpg.gathered,
      felled: rpg.felled,
      claimed: rpg.claimed.filter((id) => ["gather-notes", "gather-parts", "gather-drinks", "reports"].includes(id)),
    };
  });
  assert.equal(state.semester, "week-1");
  assert.deepEqual(state.claimed, []);
  assert.equal(state.gathered.notes, 0);
  assert.equal(state.felled.report, 0);
  await page.screenshot({ path: join(outDir, "journal.png") });
  await page.getByRole("heading", { name: "先處理分組那一種" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(outDir, "journal-collections.png") });
  report.ok = report.pageErrors.length === 0;
  report.state = state;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  await page.screenshot({ path: join(outDir, "failure.png") }).catch(() => {});
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
