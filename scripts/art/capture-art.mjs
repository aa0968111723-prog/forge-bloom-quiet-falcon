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
 *   npcs         each roster walker on its route, three-quarter front and side
 *   creature     --enemy <id>: idle turnaround at its spawn, then chase, windup
 *                (telegraph), strike, hurt and defeat against the real AI
 *   skills       each non-engineering college cast on 宮燈大道: release, travel,
 *                impact, fade, against quiz-2 and the real attack()
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
const enemyId = flag("--enemy", "report-1");
const onlySkills = new Set((flag("--only", "") || "").split(",").filter(Boolean));
/** Optional "x,z": move the enemy (and its leash anchor) somewhere open for the photos. */
const enemyAt = flag("--at", null)?.split(",").map(Number) ?? null;
const width = Number(flag("--width", 960));
const height = Number(flag("--height", 600));

const log = [];
const pageErrors = [];
const shot = async (page, name, note) => {
  const path = join(outDir, `${scenario === "creature" ? enemyId + (enemyAt ? "-open" : "") : scenario}-${name}.png`);
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

  if (scenario === "turnaround" || scenario === "poses" || scenario === "casts") {
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
    } else if (scenario === "casts") {
      await photo(page, Math.PI * 0.72, { distance: 2.6, height: 1.2, lookY: 0.9 });
      await page.evaluate(() => window.__rpgQA.freeze());
      const step = (n) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
      const casts = ["skill", "skill-science", "skill-humanities", "skill-business", "skill-language", "skill-education", "skill-international", "skill-computing", "skill-health"];
      for (const clip of casts) {
        await page.evaluate((c) => window.__characterTest.play(c), clip);
        await step(6);
        await shot(page, clip, `${clip} at 0.20 s`);
        await step(14);
      }
      await page.evaluate(() => window.__rpgQA.resume());
    } else {
      await photo(page, Math.PI * 0.72, { distance: 2.7, height: 1.15, lookY: 0.8 });
      await page.evaluate(() => window.__rpgQA.freeze());
      const step = (n) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
      await step(10);
      await shot(page, "idle", "idle, three-quarter front");
      // Key frame of each clip, reached with exact 1/30 s steps.
      for (const [clip, frameAt] of [
        ["attack", 4],
        ["skill", 5],
        ["dodge", 4],
        ["hurt", 2],
        ["interact", 9],
      ]) {
        await page.evaluate((c) => window.__characterTest.play(c), clip);
        await step(frameAt);
        await shot(page, clip, `${clip} at t=${(frameAt / 30).toFixed(2)} s`);
        await step(30);
      }
      await page.evaluate(() => window.__rpgQA.resume());
    }
  } else if (scenario === "combat") {
    // Engineering major vs quiz-2 on 宮燈大道. The real AI and combat rules run;
    // the QA clock only makes every frame exactly 1/30 s so timelines are exact.
    const enemy = () =>
      page.evaluate(() => {
        const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2");
        return { state: e.state, timer: Number(e.timer.toFixed(3)), hp: e.hp, hurt: Number(e.hurt.toFixed(3)), x: Number(e.x.toFixed(2)), z: Number(e.z.toFixed(2)) };
      });
    const step = (n = 1) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
    const until = async (predicate, label, limit = 900) => {
      for (let i = 0; i < limit; i++) {
        if (await page.evaluate(predicate)) return i;
        await step(1);
      }
      throw new Error(`timed out waiting for ${label}`);
    };
    await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      const e = s.enemies.find((x) => x.id === "quiz-2");
      Object.assign(e, { x: 4.2, z: -103, hp: 65, state: "idle", timer: 0, hurt: 0 });
      window.__rpgQA.rpg.setState({ focus: 100, skillUntil: 0, attackUntil: 0, hp: 100 });
    });
    // On the open paving, facing the quiz to the north-east.
    await setPose(page, 0.4, -97.2, -0.55);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.freeze());
    const close = { yaw: -0.85, distance: 4.4, height: 2.3, lookY: 0.75 };
    const wide = { yaw: -0.25, distance: 7.4, height: 4.2, lookY: 0.4 };
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), close);
    await step(3);
    await until(() => window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2").state === "chase", "chase");
    await step(6);
    await shot(page, "1-chase", `chase ${JSON.stringify(await enemy())}`);
    await until(() => {
      const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2");
      return e.state === "windup" && 1 - e.timer / 0.9 >= 0.3;
    }, "windup 30%");
    await shot(page, "2-telegraph-early", `windup ${JSON.stringify(await enemy())}`);
    await until(() => {
      const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2");
      return e.state === "windup" && 1 - e.timer / 0.9 >= 0.8;
    }, "windup 80%");
    await shot(page, "3-telegraph-late", `windup ${JSON.stringify(await enemy())}`);
    await until(() => window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2").state === "recover", "strike");
    await step(2);
    const struck = await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      return { playerHp: s.hp, hurtUntil: Number(s.hurtUntil.toFixed(2)), clock: Number(s.clock.toFixed(2)) };
    });
    await shot(page, "4-strike", `strike resolved ${JSON.stringify(struck)}`);
    await step(3);
    await shot(page, "5-player-hurt", "0.17 s after the strike: player flinch if it landed");
    await step(12);
    await page.evaluate(() => window.__rpgQA.rpg.setState({ attackUntil: 0 }));
    await page.evaluate(() => window.__rpgQA.rpg.getState().attack(false));
    await step(4);
    await shot(page, "6-basic-attack", `J at t≈0.13 s ${JSON.stringify(await enemy())}`);
    await step(14);
    // Engineering skill (Q): fixed timeline after the cast, wide enough for the 12 m range.
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), wide);
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ skillUntil: 0, attackUntil: 0, focus: 100 });
      window.__rpgQA.rpg.getState().attack(true);
    });
    const cast = await page.evaluate(() => {
      const fx = window.__rpgQA.rpg.getState().attackFx;
      return { range: fx.range, hits: fx.hits, skill: fx.skill };
    });
    let elapsed = 0;
    for (const [label, frames] of [["release", 1], ["travel", 2], ["impact", 3], ["settle", 3], ["dissipate", 6], ["gone", 7]]) {
      await step(frames);
      elapsed += frames / 30;
      await shot(page, `7-skill-${label}`, `skill t=${elapsed.toFixed(2)} s ${JSON.stringify(cast)} enemy ${JSON.stringify(await enemy())}`);
    }
    // Defeat: leave one hit point, then strike with a basic attack.
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), close);
    await step(10);
    await page.evaluate(() => {
      const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2");
      e.hp = 1;
      window.__rpgQA.rpg.setState({ attackUntil: 0 });
      window.__rpgQA.rpg.getState().attack(false);
    });
    elapsed = 0;
    for (const frames of [2, 6, 10, 14]) {
      await step(frames);
      elapsed += frames / 30;
      await shot(page, `8-defeat-${elapsed.toFixed(2)}`, `defeat t=${elapsed.toFixed(2)} s ${JSON.stringify(await enemy())}`);
    }
    await page.evaluate(() => {
      window.__controlsTest.setPhoto(null);
      window.__rpgQA.resume();
    });
  } else if (scenario === "skills") {
    const majors = [
      ["science", "science-理學院-0"],
      ["humanities", "humanities-文學院-0"],
      ["business", "business-商管學院-0"],
      ["language", "language-外國語文學院-0"],
      ["education", "education-教育學院-0"],
      ["international", "international-國際事務學院-0"],
      ["computing", "computing-AI創智學院-0"],
      ["health", "health-精準健康學院-0"],
    ].filter(([name]) => onlySkills.size === 0 || onlySkills.has(name));
    const step = (n = 1) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
    await page.evaluate(() => {
      const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === "quiz-2");
      Object.assign(e, { x: 4.2, z: -103, hp: 200, state: "idle", timer: 0, hurt: 0 });
    });
    await setPose(page, 0.4, -97.2, 0);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.freeze());
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), { yaw: -0.35, distance: 9.5, height: 5.2, lookY: 0.2 });
    for (const [name, id] of majors) {
      const cast = await page.evaluate((major) => {
        const rpg = window.__rpgQA.rpg;
        const enemy = rpg.getState().enemies.find((x) => x.id === "quiz-2");
        Object.assign(enemy, { x: 4.2, z: -103, hp: 200, state: "idle", timer: 0, hurt: 0 });
        rpg.setState({ departmentId: major, skillUntil: 0, attackUntil: 0, focus: 100, hp: 100 });
        rpg.getState().attack(true);
        const fx = rpg.getState().attackFx;
        return { skill: fx?.skill, range: fx?.range, hits: fx?.hits?.length ?? 0, color: fx?.color };
      }, id);
      let elapsed = 0;
      for (const [label, frames] of [["release", 2], ["travel", 5], ["impact", 6], ["fade", 10]]) {
        await step(frames);
        elapsed += frames / 30;
        await shot(page, `${name}-${label}`, `${name} t=${elapsed.toFixed(2)} s ${JSON.stringify(cast)}`);
      }
    }
    await page.evaluate(() => {
      window.__controlsTest.setPhoto(null);
      window.__rpgQA.resume();
    });
  } else if (scenario === "creature") {
    const step = (n = 1) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
    const enemy = () =>
      page.evaluate((id) => {
        const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id);
        return { kind: e.kind, state: e.state, timer: Number(e.timer.toFixed(3)), hp: e.hp, hurt: Number(e.hurt.toFixed(3)), x: Number(e.x.toFixed(2)), z: Number(e.z.toFixed(2)) };
      }, enemyId);
    const until = async (predicate, label, limit = 900) => {
      for (let i = 0; i < limit; i++) {
        if (await page.evaluate(predicate, enemyId)) return i;
        await step(1);
      }
      throw new Error(`timed out waiting for ${label}`);
    };
    // Reset the enemy at its own spawn; park the player out of aggro range to the south.
    const spawn = await page.evaluate(([id, at]) => {
      const s = window.__rpgQA.rpg.getState();
      const e = s.enemies.find((x) => x.id === id);
      if (!e) throw new Error(`no enemy ${id}`);
      if (at) Object.assign(e, { anchorX: at[0], anchorZ: at[1] });
      Object.assign(e, { x: e.anchorX, z: e.anchorZ, state: "idle", timer: 0, hurt: 0 });
      window.__rpgQA.rpg.setState({ focus: 100, skillUntil: 0, attackUntil: 0, hp: 100 });
      return { x: e.anchorX, z: e.anchorZ, kind: e.kind };
    }, [enemyId, enemyAt]);
    const size = { quiz: 1, report: 1.15, exam: 1.35, final: 1.9 }[spawn.kind] ?? 1;
    await setPose(page, spawn.x, spawn.z + 40, Math.PI);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.freeze());
    const target = { x: spawn.x, y: await page.evaluate(([x, z]) => window.__rpgQA.ground(x, z), [spawn.x, spawn.z]), z: spawn.z };
    for (const [name, yaw] of [["front", 0], ["three-quarter", 0.75], ["side", Math.PI / 2], ["back", Math.PI]]) {
      // Enemies face the player (south, +Z), so yaw 0 is their front.
      await page.evaluate((p) => window.__controlsTest.setPhoto(p), { target: { ...target, y: target.y }, yaw, distance: 4.2 * size, height: 1.5 * size, lookY: 1.0 * size });
      await step(2);
      await shot(page, `turn-${name}`, `${enemyId} idle, ${name} ${JSON.stringify(await enemy())}`);
    }
    // Fight: player south of it facing north (yaw 0 looks toward -Z); camera three-quarter.
    await page.evaluate(() => window.__rpgQA.resume());
    await setPose(page, spawn.x + 0.6, spawn.z + 5.5 * size, 0);
    await settle(page, { stableFrames: 2 });
    await page.evaluate(() => window.__rpgQA.freeze());
    const fight = { yaw: -0.9, distance: 6.5 * size, height: 3.0 * size, lookY: 0.9 * size };
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), fight);
    await step(3);
    await until((id) => ["chase", "windup"].includes(window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id).state), "chase");
    await step(4);
    await shot(page, "1-chase", `chase ${JSON.stringify(await enemy())}`);
    await until((id) => window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id).state === "windup", "windup");
    const windup = await page.evaluate((id) => window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id).timer, enemyId);
    for (const [label, at] of [["2-windup-40", 0.4], ["3-windup-85", 0.85]]) {
      await page.evaluate(([w, a]) => {
        window.__captureWindup = w;
        window.__captureAt = a;
      }, [windup, at]);
      await until((id) => {
        const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id);
        return e.state !== "windup" || e.timer <= window.__captureWindup * (1 - window.__captureAt);
      }, label);
      await shot(page, label, `windup ${Math.round(at * 100)}% of ${windup.toFixed(2)} s ${JSON.stringify(await enemy())}`);
    }
    await until((id) => window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id).state === "recover", "strike");
    await step(3);
    const struck = await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      return { playerHp: s.hp, hurtUntil: Number(s.hurtUntil.toFixed(2)) };
    });
    await shot(page, "4-strike", `strike resolved ${JSON.stringify(struck)}`);
    await step(14);
    // Basic attacks reach 3.7 m in front of the player: step in to 2.6 m, facing it.
    const closeIn = () =>
      page.evaluate((id) => {
        const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id);
        window.__controlsTest.setPose(e.x, e.z + 2.6, 0);
      }, enemyId);
    await closeIn();
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ attackUntil: 0, hp: 100 });
      window.__rpgQA.rpg.getState().attack(false);
    });
    await step(3);
    await shot(page, "5-hurt", `basic attack ${JSON.stringify(await enemy())}`);
    await step(12);
    await closeIn();
    await page.evaluate((id) => {
      const e = window.__rpgQA.rpg.getState().enemies.find((x) => x.id === id);
      e.hp = 1;
      window.__rpgQA.rpg.setState({ attackUntil: 0, hp: 100 });
      window.__rpgQA.rpg.getState().attack(false);
    }, enemyId);
    let elapsed = 0;
    for (const frames of [3, 9, 18]) {
      await step(frames);
      elapsed += frames / 30;
      await shot(page, `6-defeat-${elapsed.toFixed(2)}`, `defeat t=${elapsed.toFixed(2)} s ${JSON.stringify(await enemy())}`);
    }
    await page.evaluate(() => {
      window.__controlsTest.setPhoto(null);
      window.__rpgQA.resume();
    });
  } else if (scenario === "npcs") {
    // Each roster walker on its real route, three-quarter front, then side.
    await page.waitForFunction(() => (window.__npcQA?.walkers?.filter(Boolean).length ?? 0) >= 5);
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.freeze());
    const step = (n) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
    const walkers = await page.evaluate(() => window.__npcQA.walkers.map((w) => ({ ...w })));
    for (const [i, w] of walkers.entries()) {
      // Park the player out of frame near the walker so its LOD and lighting are local.
      await page.evaluate(([x, z]) => window.__controlsTest.setPose(x + 6, z + 6, 0), [w.x, w.z]);
      await step(4);
      const live = await page.evaluate((k) => ({ ...window.__npcQA.walkers[k] }), i);
      const target = { x: live.x, y: live.y, z: live.z };
      await page.evaluate((p) => window.__controlsTest.setPhoto(p), { target, yaw: live.yaw + 0.55, distance: 2.6, height: 1.05, lookY: 0.88 });
      await step(1);
      await shot(page, `${i + 1}-${live.id}`, `${live.id} at (${live.x.toFixed(1)}, ${live.z.toFixed(1)}), three-quarter front`);
      await page.evaluate((p) => window.__controlsTest.setPhoto(p), { target, yaw: live.yaw + Math.PI / 2, distance: 2.6, height: 1.05, lookY: 0.88 });
      await step(1);
      await shot(page, `${i + 1}-${live.id}-side`, `${live.id} side`);
    }
    await page.evaluate(() => {
      window.__controlsTest.setPhoto(null);
      window.__rpgQA.resume();
    });
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
