/**
 * Fire each college skill from a department picked on the real title screen.
 *
 *   node --experimental-transform-types scripts/integration-colleges.mjs http://127.0.0.1:8088/ /opt/cursor/artifacts/integration-colleges
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launchBrowser, startSemester, waitForTitle } from "./art/lib/capture.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:8088/";
const outDir = process.argv[3] ?? "/tmp/integration-colleges";
mkdirSync(outDir, { recursive: true });

const COLLEGES = [
  { discipline: "engineering", query: "建築學系", pick: /建築學系/, skill: "結構脈衝" },
  { discipline: "science", query: "化學學系", pick: /化學學系/, skill: "共振反應" },
  { discipline: "humanities", query: "歷史學系", pick: /歷史學系/, skill: "敘事解構" },
  { discipline: "business", query: "會計學系", pick: /會計學系/, skill: "資源調度" },
  { discipline: "language", query: "英文學系", pick: /英文學系/, skill: "多重詠唱" },
  { discipline: "education", query: "教育科技學系", pick: /教育科技學系/, skill: "知識領域" },
  { discipline: "international", query: "外交與國際關係學系", pick: /外交與國際關係學系/, skill: "協議共識" },
  { discipline: "computing", query: "人工智慧學系", pick: /人工智慧學系/, skill: "模型推演" },
  { discipline: "health", query: "高齡健康", pick: /高齡健康管理學研究所/, skill: "復原領域" },
];

const report = { steps: [], pageErrors: [] };

function note(step, detail) {
  report.steps.push({ step, ...detail });
  process.stderr.write(`${step} ${JSON.stringify(detail)}\n`);
}

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => report.pageErrors.push(String(error)));

try {
  for (const college of COLLEGES) {
    await page.goto(`${baseUrl.replace(/\/$/, "")}/?qa=1&q=low`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForTitle(page);
    await startSemester(page, { query: college.query, pick: college.pick });
    const before = await page.evaluate(() => {
      const rpg = window.__rpgQA.rpg;
      const enemy = rpg.getState().enemies.find((item) => item.id === "quiz-2");
      window.__controlsTest.setPose(enemy.x, enemy.z + 2.4, 0);
      rpg.setState({ focus: 100, skillUntil: 0, attackUntil: 0, panel: null, buildKind: null });
      return { hp: enemy.hp, departmentId: rpg.getState().departmentId };
    });
    await page.evaluate(() => window.__rpgQA.step(1 / 30, 2));
    const button = page.locator(`.ad-quickbar button[title="${college.skill}"]`);
    await button.waitFor({ state: "visible", timeout: 15000 });
    await button.click();
    const swung = await page.evaluate(() => {
      const rpg = window.__rpgQA.rpg;
      return {
        hp: rpg.getState().enemies.find((item) => item.id === "quiz-2")?.hp ?? null,
        notice: rpg.getState().notice,
      };
    });
    assert.ok(swung.hp < before.hp, `${college.skill} left quiz-2 at ${swung.hp}`);
    assert.match(swung.notice, new RegExp(college.skill));
    await page.screenshot({ path: join(outDir, `college-${college.discipline}.png`) });
    note(college.discipline, {
      skill: college.skill,
      departmentId: before.departmentId,
      before: before.hp,
      after: swung.hp,
      notice: swung.notice,
    });
  }
  report.ok = report.pageErrors.length === 0;
} catch (error) {
  report.ok = false;
  report.error = String(error);
  throw error;
} finally {
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
