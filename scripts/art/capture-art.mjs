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
 *   swing        basic attack on 宮燈大道: chamber, contact, follow-through
 *   hud          status card short labels; keeps the HUD visible
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
  sampleFrames,
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
  if (scenario === "still-wind" || scenario === "still-water" || scenario === "still-title" || scenario === "still-charm") await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(gameUrl(base, { tier }), { waitUntil: "domcontentloaded" });
  await waitForTitle(page);
  const gl = await webglInfo(page);
  if (scenario === "title" || scenario === "still-title") {
    if (scenario === "still-title") {
      const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (!reduced) throw new Error("reduced motion was not applied");
    }
    await frames(page, 8);
    await shot(page, "card", "title with card");
    await hideHud(page);
    await frames(page, 4);
    await shot(page, "world", scenario === "still-title" ? "reduced motion, title camera held" : "title camera without the card");
  } else {
    await startSemester(page);
    await page.waitForFunction(() => Boolean(window.__characterTest?.play), undefined, { timeout: 120000 });
  }

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
  } else if (scenario === "swing") {
    const step = (n = 1) => page.evaluate((c) => window.__rpgQA.step(1 / 30, c), n);
    await setPose(page, 0.4, -97.2, 0);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.freeze());
    // Camera on the character's right, so the chambered hand is not hidden by the body.
    await page.evaluate((p) => window.__controlsTest.setPhoto(p), { yaw: -Math.PI * 0.72, distance: 3.2, height: 1.4, lookY: 1.1 });
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ attackUntil: 0, skillUntil: 0, focus: 100, hp: 100 });
      window.__rpgQA.rpg.getState().attack(false);
    });
    let elapsed = 0;
    for (const [label, frames] of [["chamber", 2], ["contact", 3], ["follow", 3], ["fade", 6]]) {
      await step(frames);
      elapsed += frames / 30;
      const fx = await page.evaluate(() => {
        const s = window.__rpgQA.rpg.getState();
        return { skill: s.attackFx?.skill ?? null, range: s.attackFx?.range ?? null, age: Number((s.clock - (s.attackFx?.at ?? s.clock)).toFixed(3)) };
      });
      await shot(page, label, `basic t=${elapsed.toFixed(2)} s ${JSON.stringify(fx)}`);
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
        if (name === "business" && (label === "travel" || label === "impact")) {
          await page.evaluate(() => {
            const y = window.__rpgQA.ground(4.2, -103);
            window.__controlsTest.setPhoto({
              yaw: 0.7,
              distance: 3.4,
              height: 1.1,
              lookY: 0,
              target: { x: 4.2, y: y + 1.15, z: -103 },
            });
            window.__rpgQA.step(0, 1);
          });
        }
        await shot(page, `${name}-${label}`, `${name} t=${elapsed.toFixed(2)} s ${JSON.stringify(cast)}`);
        if (name === "business" && (label === "travel" || label === "impact")) {
          await page.evaluate(() =>
            window.__controlsTest.setPhoto({ yaw: -0.35, distance: 9.5, height: 5.2, lookY: 0.2 }),
          );
        }
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
  } else if (scenario === "rain") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("wet"));
    await frames(page, 8);
    const live = await page.evaluate(() => window.__rpgQA.game.getState().timeOfDay);
    await shot(page, "wet", `timeOfDay=${live} tier ${tier}`);
  } else if (scenario === "lighting") {
    // Same stand on 宮燈大道 under the four presets the game actually runs.
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await hideHud(page);
    for (const time of ["day", "sunset", "night", "wet"]) {
      await page.evaluate((id) => window.__rpgQA.game.getState().setTime(id), time);
      await settle(page, { stableFrames: 3 });
      const live = await page.evaluate(() => window.__rpgQA.game.getState().timeOfDay);
      await shot(page, time, `timeOfDay=${live} at (0, -80)`);
    }
  } else if (scenario === "cleared") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 128, -158, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(128.4, -169.8);
      window.__controlsTest.setPhoto({
        yaw: 0.2,
        distance: 16,
        height: 3.2,
        lookY: 2,
        target: { x: 128.4, y, z: -169.8 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "business", "street lamp south of the business building");
    await setPose(page, 151, -228, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(150.6, -240.8);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 14,
        height: 3,
        lookY: 2.2,
        target: { x: 150.6, y, z: -240.8 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "museum", "street lamp south of the maritime museum");
  } else if (scenario === "slope") {
    // Library forecourt ramp, high end just outside the south wall.
    await hideHud(page);
    await setPose(page, -2, -292.6, Math.PI);
    const lift = await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const g = window.__rpgQA.ground;
      const y = g(8, -292.6);
      window.__controlsTest.setPhoto({
        yaw: 0.04,
        distance: 11,
        height: 1.5,
        lookY: 1.1,
        target: { x: -2, y: y + 0.4, z: -293 },
      });
      return { south: g(-2, -285.6), north: g(-2, -299.6), off: y };
    });
    await settle(page, { stableFrames: 3 });
    await shot(
      page,
      "rise",
      `north ${lift.north.toFixed(2)} south ${lift.south.toFixed(2)} off-ramp ${lift.off.toFixed(2)}`,
    );
  } else if (scenario === "furniture") {
    await hideHud(page);
    await setPose(page, -6, -278, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-4, -290);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 14,
        height: 3.6,
        lookY: 1.1,
        target: { x: -3.4, y: y + 0.3, z: -289 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "clear", "bench and planter clear of the library ramp");
  } else if (scenario === "reader") {
    await hideHud(page);
    await setPose(page, -12, -286, 0);
    const seat = await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-12, -293.6);
      window.__controlsTest.setPhoto({
        yaw: 0.22,
        distance: 16,
        height: 4.5,
        lookY: 1.2,
        target: { x: -7, y: y + 0.4, z: -294 },
      });
      return y;
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "seat", `reading girl ground ${seat.toFixed(2)}`);
  } else if (scenario === "field") {
    await hideHud(page);
    await setPose(page, 425, -560, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(425, -595);
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 42,
        height: 22,
        lookY: 0,
        target: { x: 425, y: y + 1, z: -595 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "open", "wuhu field without trees on the grass");
  } else if (scenario === "wet-field") {
    await hideHud(page);
    await setPose(page, 425, -560, Math.PI);
    for (const time of ["day", "wet"]) {
      await page.evaluate((id) => {
        window.__rpgQA.game.getState().setTime(id);
        const y = window.__rpgQA.ground(425, -595);
        window.__controlsTest.setPhoto({
          yaw: 0.35,
          distance: 42,
          height: 22,
          lookY: 0,
          target: { x: 425, y: y + 1, z: -595 },
        });
      }, time);
      await settle(page, { stableFrames: 3 });
      const live = await page.evaluate(() => window.__rpgQA.game.getState().timeOfDay);
      await shot(page, time, `timeOfDay=${live} wuhu field`);
    }
  } else if (scenario === "courts") {
    await hideHud(page);
    await setPose(page, 425, -560, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(425, -595);
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 42,
        height: 22,
        lookY: 0,
        target: { x: 425, y: y + 1, z: -595 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "wuhu", "two marked courts on the wuhu field");
  } else if (scenario === "net") {
    await hideHud(page);
    await setPose(page, 436, -580, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(436, -595);
      window.__controlsTest.setPhoto({
        yaw: 0.2,
        distance: 14,
        height: 2.4,
        lookY: 1.2,
        target: { x: 436, y: y + 1.1, z: -595 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "posts", "court net of posts and tapes");
  } else if (scenario === "parking") {
    await hideHud(page);
    await setPose(page, 290, -590, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(290, -615);
      window.__controlsTest.setPhoto({
        yaw: 0.4,
        distance: 38,
        height: 20,
        lookY: 0,
        target: { x: 290, y: y + 1, z: -615 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "stalls", "scooter bays on the wuhu parking pad");
  } else if (scenario === "pavilion") {
    await hideHud(page);
    await setPose(page, -46, -96, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-46, -108);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 16,
        height: 4.2,
        lookY: 1.4,
        target: { x: -46, y: y + 1.2, z: -108 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "open", "open garden pavilion");
  } else if (scenario === "track") {
    await hideHud(page);
    await setPose(page, -40, -500, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-40, -535);
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 70,
        height: 36,
        lookY: 0,
        target: { x: -40, y: y + 1, z: -535 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "infield", "pitch inside the running track");
  } else if (scenario === "ramp") {
    // Library forecourt ramp. Rails sit just outside the 1.6 m deck.
    await hideHud(page);
    await setPose(page, -2, -284, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-2, -292.6);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 14,
        height: 3.2,
        lookY: 0.6,
        target: { x: -2, y, z: -292.6 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "rails", "library ramp with a railing each side");
  } else if (scenario === "museum") {
    // Side view of the maritime museum so the bow can be seen against the hull.
    await hideHud(page);
    await setPose(page, 190, -250, Math.PI / 2);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(176, -255);
      window.__controlsTest.setPhoto({
        yaw: 0.55,
        distance: 24,
        height: 5,
        lookY: 3,
        target: { x: 176, y: y + 3, z: -255 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "bow", "maritime museum bow on the hull");
  } else if (scenario === "colonnade") {
    // West hall corner. The desired camera is inside the hall; the follow rig
    // should stay outside and keep the character in frame. Coordinates match
    // palaceHallZs()[2] in the colonnade camera test.
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -9.7, -99.5, -Math.PI * 0.72);
    await page.evaluate(() => window.__controlsTest.setPhoto(null));
    await settle(page, { stableFrames: 4 });
    const rig = await page.evaluate(() => {
      const player = window.__controlsTest.getPosition();
      const camera = window.__controlsTest.getCamera();
      const dx = camera.x - player.x;
      const dy = camera.y - player.y;
      const dz = camera.z - player.z;
      return {
        player,
        camera,
        range: Math.hypot(dx, dy, dz),
      };
    });
    await shot(page, "corner", `follow range ${rig.range.toFixed(2)} m at (${rig.player.x.toFixed(1)}, ${rig.player.z.toFixed(1)})`);
  } else if (scenario === "lamp-night") {
    // First plaza street lamp, outside the statue apron. Night should light
    // the head; day should leave it dark. Coordinates match street-lamp.test.
    await hideHud(page);
    const lamp = { x: 2.622, z: 12.937 };
    await setPose(page, lamp.x, lamp.z - 6, 0);
    for (const time of ["day", "night"]) {
      await page.evaluate((id) => {
        window.__rpgQA.game.getState().setTime(id);
        const y = window.__rpgQA.ground(2.622, 12.937);
        window.__controlsTest.setPhoto({
          yaw: 0.15,
          distance: 7.5,
          height: 2.4,
          lookY: 3.6,
          target: { x: 2.622, y, z: 12.937 },        });
      }, time);
      await settle(page, { stableFrames: 3 });
      const live = await page.evaluate(() => window.__rpgQA.game.getState().timeOfDay);
      await shot(page, time, `timeOfDay=${live} plaza street lamp`);
    }
  } else if (scenario === "interiors") {
    // Three public interiors already in the game: 宮燈教室, 圖書館閱讀桌, 體育館活動場.
    // These are game layouts, not surveyed rooms. Enter, look, exit, and check
    // that the semester (hp, department) survives and the player is back outdoors.
    const rooms = [
      ["palace", "classroom"],
      ["library", "reading"],
      ["gym", "activity"],
    ];
    await hideHud(page);
    const before = await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      return { hp: s.hp, departmentId: s.departmentId, interiorId: s.interiorId };
    });
    for (const [id, role] of rooms) {
      await enterInterior(page, id);
      await page.evaluate((p) => window.__controlsTest.setPhoto(p), { yaw: Math.PI * 0.72, distance: 7.5, height: 2.4, lookY: 1.1 });
      await frames(page, 4);
      const inside = await page.evaluate(() => {
        const s = window.__rpgQA.rpg.getState();
        const g = window.__rpgQA.game.getState();
        return { interiorId: s.interiorId, floor: s.floor, hp: s.hp, departmentId: s.departmentId, x: g.playerX, z: g.playerZ };
      });
      await shot(page, `${id}-inside`, `${role} inside ${JSON.stringify(inside)} before ${JSON.stringify(before)}`);
      await page.evaluate(() => {
        window.__controlsTest.setPhoto(null);
        window.__rpgQA.rpg.getState().exit();
      });
      await page.waitForFunction(() => window.__rpgQA.rpg.getState().interiorId === null);
      await settle(page, { stableFrames: 3 });
      const outside = await page.evaluate(() => {
        const s = window.__rpgQA.rpg.getState();
        const g = window.__rpgQA.game.getState();
        return { interiorId: s.interiorId, hp: s.hp, departmentId: s.departmentId, x: Number(g.playerX.toFixed(2)), z: Number(g.playerZ.toFixed(2)) };
      });
      await shot(page, `${id}-outside`, `${role} exited ${JSON.stringify(outside)}`);
    }
} else if (scenario === "bollard") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -5.2, 89.2, -Math.PI / 2);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 40);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.2, distance: 4.4, height: 1.55, lookY: 0.6 });
    });
    await frames(page, 4);
    await shot(page, "post", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.x > -2.4) throw new Error(`walked through the bollard ${JSON.stringify(stopped)}`);
  } else if (scenario === "ceiling") {
    await enterInterior(page, "palace");
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.4, distance: 6.5, height: 1.2, lookY: 2.6 });
    });
    await frames(page, 4);
    const inside = await page.evaluate(() => window.__rpgQA.rpg.getState().interiorId);
    await shot(page, "palace", `ceiling interior ${inside}`);
    await page.evaluate(() => window.__controlsTest.setPhoto(null));
    await page.evaluate(() => window.__controlsTest.setPitch(1.12));
    await frames(page, 10);
    const cam = await page.evaluate(() => window.__controlsTest.getCamera());
    await shot(page, "lookdown", `follow camera ${JSON.stringify(cam)}`);
    if (!cam || cam.y >= 4.24) throw new Error(`camera entered the ceiling ${JSON.stringify(cam)}`);
  } else if (scenario === "door") {
    await enterInterior(page, "palace");
    await page.evaluate(() => window.__controlsTest.setPose(2.8, 6.2, Math.PI));
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 20);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const blocked = await page.evaluate(() => ({
      interiorId: window.__rpgQA.rpg.getState().interiorId,
      ...window.__controlsTest.getPosition(),
    }));
    await shot(page, "jamb", `blocked at the jamb ${JSON.stringify(blocked)}`);
    await page.evaluate(() => window.__controlsTest.setPose(0, 5.5, Math.PI));
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 50);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    await frames(page, 4);
    const left = await page.evaluate(() => ({
      interiorId: window.__rpgQA.rpg.getState().interiorId,
      ...window.__controlsTest.getPosition(),
    }));
    await shot(page, "outside", `walked out ${JSON.stringify(left)}`);
    if (blocked.interiorId !== "palace" || blocked.z > 7 || left.interiorId !== null) {
      throw new Error(`doorway ${JSON.stringify({ blocked, left })}`);
    }
  } else if (scenario === "classhall") {
    await hideHud(page);
    await setPose(page, 224, -55, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(224, -84);
      window.__controlsTest.setPhoto({
        yaw: 0.4,
        distance: 38,
        height: 12,
        lookY: 2,
        target: { x: 224, y: y + 8, z: -84 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "education classroom hall");
  } else if (scenario === "dormfront") {
    await hideHud(page);
    await setPose(page, 427, -220, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(427, -255);
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 42,
        height: 14,
        lookY: 2,
        target: { x: 427, y: y + 10, z: -255 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "sungtao 2 public front");
  } else if (scenario === "lamp") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -8, 72, -Math.PI / 2);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 48);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.35, distance: 4.6, height: 1.7, lookY: 0.9 });
    });
    await frames(page, 4);
    await shot(page, "pole", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.x > -5.4) throw new Error(`walked through the lamp ${JSON.stringify(stopped)}`);
  } else if (scenario === "tree") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -11, 82, -Math.PI / 2);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 48);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: -1.15, distance: 6.5, height: 1.35, lookY: 1.05 });
    });
    await frames(page, 4);
    await shot(page, "trunk", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.x > -7.6) throw new Error(`walked through the trunk ${JSON.stringify(stopped)}`);
  } else if (scenario === "gate") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -8, 94, -Math.PI / 2);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 48);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.35, distance: 7, height: 2.4, lookY: 2.2 });
    });
    await frames(page, 4);
    await shot(page, "pier", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.x > -5.2) throw new Error(`walked through the gate pier ${JSON.stringify(stopped)}`);
  } else if (scenario === "text-sign") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -8.2, 79, -Math.PI / 2);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 48);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.15, distance: 4.8, height: 1.7, lookY: 1.35 });
    });
    await frames(page, 4);
    await shot(page, "board", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.x > -5.9) throw new Error(`walked through the sign ${JSON.stringify(stopped)}`);
  } else if (scenario === "plinth") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 10, -293, 0);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 56);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: -0.7, distance: 8, height: 2.6, lookY: 1.6 });
    });
    await frames(page, 4);
    await shot(page, "skirt", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.z < -297.7) throw new Error(`walked onto the plinth ${JSON.stringify(stopped)}`);
  } else if (scenario === "still-wind") {
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!reduced) throw new Error("reduced motion was not applied");
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 0, -40, 0);
    await frames(page, 20);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.4, distance: 7, height: 2.2, lookY: 1.4 });
    });
    await frames(page, 4);
    await shot(page, "avenue", "reduced motion, day, avenue canopy");
  } else if (scenario === "still-water") {
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!reduced) throw new Error("reduced motion was not applied");
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("cloudy"));
    await setPose(page, -70, -80, Math.PI / 2);
    await frames(page, 12);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 1.15, distance: 16, height: 7, lookY: 2 });
    });
    await frames(page, 4);
    await shot(page, "shore", "reduced motion, cloudy, looking toward the river");
  } else if (scenario === "still-charm") {
    await enterInterior(page, "palace");
    await setPose(page, 0, 1.5, 0);
    await frames(page, 20);
    await hideHud(page);
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    await photo(page, Math.PI * 0.15, { distance: 1.05, height: 1.25, lookY: 1.05 });
    await shot(page, "backpack", `reduced motion ${reduced}, backpack and turtle charm at rest targets`);
  } else if (scenario === "sheep") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -58, -294, 0);
    await page.evaluate(() => {
      const rpg = window.__rpgQA.rpg;
      const enemies = rpg.getState().enemies.map((enemy) => ({
        ...enemy,
        x: 400,
        z: 400,
        state: "idle",
      }));
      rpg.setState({ enemies });
    });
    await frames(page, 8);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z < -300.7);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: -0.55, distance: 8, height: 2.1, lookY: 1.6 });
    });
    await frames(page, 6);
    await shot(page, "south", `shepherd figure, day, walked north and stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "tigers") {
    await hideHud(page);
    await page.addStyleTag({ content: ".ad-interact{display:none !important}" });
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await page.evaluate(() => {
      const rpg = window.__rpgQA.rpg;
      const enemies = rpg.getState().enemies.map((enemy) => ({
        ...enemy,
        x: 400,
        z: 400,
        state: "idle",
      }));
      rpg.setState({ enemies });
    });
    await setPose(page, 150, -146, Math.PI);
    await frames(page, 10);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z > -142.15);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      document.querySelectorAll(".ad-interact,.ad-ui").forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
      window.__controlsTest.setPhoto({ yaw: -2.2, distance: 8, height: 4.8, lookY: 0.6 });
    });
    await frames(page, 6);
    await shot(page, "north", `five tigers stele, day, walked south and stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "exhibits") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 160, -260, 0);
    await frames(page, 10);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z < -264.2);
    await frames(page, 6);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 2.15, distance: 14, height: 3.2, lookY: 1.15 });
    });
    await frames(page, 6);
    await shot(page, "jet", `fighter beside the hull, stopped ${JSON.stringify(stopped)}`);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({
        yaw: Math.PI,
        distance: 12,
        height: 2.6,
        lookY: 1.15,
        target: { x: 136, y: 22, z: -270 },
      });
    });
    await frames(page, 6);
    await shot(page, "heli", "helicopter beside the hull, rotor still");
  } else if (scenario === "hoop") {
    await hideHud(page);
    await enterInterior(page, "gym");
    await setPose(page, 5.4, 0, -Math.PI / 2);
    await frames(page, 12);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().x > 6.7);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: -1.1, distance: 6.5, height: 2.2, lookY: 1.6 });
    });
    await frames(page, 6);
    await shot(page, "stand", `gym hoop base, walked east and stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "desk") {
    await hideHud(page);
    await enterInterior(page, "palace");
    await setPose(page, 0, -3.5, 0);
    await frames(page, 12);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z < -4.3);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.45, distance: 4.8, height: 1.7, lookY: 1.05 });
    });
    await frames(page, 6);
    await shot(page, "front", `palace desk, walked north and stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "carrel") {
    await hideHud(page);
    await enterInterior(page, "library");
    await setPose(page, 4.5, -3.5, 0);
    await frames(page, 12);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z < -4.2);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.6, distance: 4.6, height: 1.8, lookY: 1.1 });
    });
    await frames(page, 6);
    await shot(page, "east", `reading carrel, walked north and stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "shelves") {
    await hideHud(page);
    await enterInterior(page, "library");
    await setPose(page, 8.5, -2.6, -Math.PI / 2);
    await frames(page, 16);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.15, distance: 3.4, height: 1.45, lookY: 1.35 });
    });
    await frames(page, 6);
    const stood = await page.evaluate(() => window.__controlsTest.getPosition());
    await shot(page, "east", `library shelves clear of the body ${JSON.stringify(stood)}`);
  } else if (scenario === "girl") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, -12, -291.2, 0);
    await frames(page, 12);
    await holdKeys(page, ["KeyW"]);
    await page.waitForFunction(() => window.__controlsTest.getPosition().z < -292.3);
    await frames(page, 8);
    await holdKeys(page, []);
    await frames(page, 8);
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.55, distance: 5.5, height: 1.7, lookY: 1.15 });
    });
    await frames(page, 6);
    await shot(page, "south", `reading girl on the forecourt, stopped ${JSON.stringify(stopped)}`);
  } else if (scenario === "gym-night") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("night"));
    await setPose(page, 166, -88, 0);
    await frames(page, 16);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.2, distance: 26, height: 9, lookY: 7 });
    });
    await frames(page, 6);
    await shot(page, "south", "gym clerestory at night, lamps on");
  } else if (scenario === "scroll-words") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 0, -272, 0);
    await frames(page, 16);
    await page.evaluate(() => {
      const here = window.__controlsTest.getPosition();
      window.__controlsTest.setPhoto({
        yaw: -2.3,
        distance: 8,
        height: 2.2,
        lookY: 3.4,
        target: { x: 3.3, y: here.y, z: here.z + 3.3 },
      });
    });
    await frames(page, 6);
    await shot(page, "southeast", "scroll blade with one character of 樸實剛毅, day");
  } else if (scenario === "dolphin-motto") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 0, -221, 0);
    await frames(page, 16);
    await page.evaluate(() => {
      const here = window.__controlsTest.getPosition();
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 6.5,
        height: 1.35,
        lookY: 0.85,
        target: { x: 0, y: here.y, z: -226 },
      });
    });
    await frames(page, 6);
    await shot(page, "south", "dolphin plinth motto, both lines, day");
  } else if (scenario === "pool-night") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("night"));
    await setPose(page, 236, -390, 0);
    await frames(page, 16);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.15, distance: 28, height: 6, lookY: 4 });
    });
    await frames(page, 6);
    await shot(page, "south", "pool hall south glass at night, lamps on");
  } else if (scenario === "gym-floor") {
    await hideHud(page);
    await enterInterior(page, "gym");
    await setPose(page, 0, 1.2, Math.PI);
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.55, distance: 10, height: 7.2, lookY: 0.4 });
    });
    await frames(page, 8);
    await shot(page, "court", "activity room court lines between the hoops");
  } else if (scenario === "pool-water") {
    await hideHud(page);
    await enterInterior(page, "swimming");
    await frames(page, 8);
    const spawned = await page.evaluate(() => window.__controlsTest.getPosition());
    if (spawned.z < 5) throw new Error(`spawned in the water ${JSON.stringify(spawned)}`);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 36);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPhoto({ yaw: 0.45, distance: 12, height: 8.2, lookY: 0.3 });
    });
    await frames(page, 6);
    await shot(page, "lanes", `spawned ${JSON.stringify(spawned)} stopped ${JSON.stringify(stopped)}`);
    if (stopped.z < 4.3 || stopped.z > 4.7) throw new Error(`walked into the water ${JSON.stringify(stopped)}`);
  } else if (scenario === "swan") {
    await hideHud(page);
    await enterInterior(page, "museum");
    await setPose(page, 0, -3.4, 0);
    await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
    await frames(page, 30);
    await page.evaluate(() => window.__controlsTest.setKeys([]));
    const stopped = await page.evaluate(() => window.__controlsTest.getPosition());
    await page.evaluate(() => {
      window.__controlsTest.setPose(2.2, -3.6, -0.7);
      window.__controlsTest.setPhoto({
        yaw: -0.9,
        distance: 3.4,
        height: 1.45,
        lookY: 0.55,
        target: { x: 0, y: 0, z: -5.3 },
      });
    });
    await frames(page, 6);
    await shot(page, "plinth", `stopped ${JSON.stringify(stopped)}`);
    if (stopped.z < -4.3 || stopped.z > -4.0) throw new Error(`walked through the swan ${JSON.stringify(stopped)}`);
  } else if (scenario === "track-finish") {
    await hideHud(page);
    await setPose(page, -40, -470, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-40, -482);
      window.__controlsTest.setPhoto({
        yaw: 0.2,
        distance: 22,
        height: 10,
        lookY: 0.4,
        target: { x: -40, y, z: -482 },
      });
    });
    await frames(page, 8);
    await shot(page, "stripe", "finish stripe across the south straight");
  } else if (scenario === "sand-pit") {
    await hideHud(page);
    await setPose(page, -18, -520, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-18, -535);
      window.__controlsTest.setPhoto({
        yaw: 0.4,
        distance: 28,
        height: 16,
        lookY: 0,
        target: { x: -18, y, z: -535 },
      });
    });
    await frames(page, 8);
    await shot(page, "pit", "sand pit east of the infield");
  } else if (scenario === "gate-cross") {
    await hideHud(page);
    await setPose(page, 0, 98, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(0, 86.4);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 14,
        height: 5,
        lookY: 0.2,
        target: { x: 0, y, z: 86.4 },
      });
    });
    await frames(page, 8);
    await shot(page, "zebra", "zebra bars on the slope apron");
  } else if (scenario === "notice") {
    await hideHud(page);
    await setPose(page, 2.2, 81.6, -Math.PI / 2);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(5.1, 81.6);
      window.__controlsTest.setPhoto({
        yaw: -Math.PI / 2,
        distance: 3.4,
        height: 1.55,
        lookY: 0.15,
        target: { x: 5.1, y: y + 1.45, z: 81.6 },
      });
    });
    await frames(page, 8);
    await shot(page, "board", "notice board at the slope apron");
  } else if (scenario === "lithall") {
    await hideHud(page);
    await setPose(page, 88, -300, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(88, -338);
      window.__controlsTest.setPhoto({
        yaw: 0.45,
        distance: 40,
        height: 14,
        lookY: 2,
        target: { x: 88, y: y + 9, z: -338 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "literature hall eave");
  } else if (scenario === "dormbalcony") {
    await hideHud(page);
    await setPose(page, 292, -330, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(292, -365);
      window.__controlsTest.setPhoto({
        yaw: 0.55,
        distance: 42,
        height: 12,
        lookY: 4,
        target: { x: 292, y: y + 12, z: -365 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "sungtao balconies");
  } else if (scenario === "chueh") {
    await hideHud(page);
    await setPose(page, 150, -520, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(150, -550);
      window.__controlsTest.setPhoto({
        yaw: 0.5,
        distance: 36,
        height: 10,
        lookY: 2,
        target: { x: 150, y: y + 5, z: -550 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "chueh hsuan veranda");
  } else if (scenario === "museumskirt") {
    await hideHud(page);
    await setPose(page, 110, -252, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(150, -252);
      window.__controlsTest.setPhoto({
        yaw: -1.15,
        distance: 38,
        height: 5,
        lookY: 1,
        target: { x: 150, y: y + 4, z: -252 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "west", "museum downhill skirt");
  } else if (scenario === "gymskirt") {
    await hideHud(page);
    await setPose(page, 130, -150, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(166, -122);      window.__controlsTest.setPhoto({
        yaw: -2.4,
        distance: 42,
        height: 8,
        lookY: 2,
       target: { x: 166, y: y + 6, z: -122 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "west", "gym downhill skirt");  } else if (scenario === "foreignskirt") {
    await hideHud(page);
    await setPose(page, 120, -370, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(155, -340);
      window.__controlsTest.setPhoto({
        yaw: -2.4,
        distance: 42,
        height: 8,
        lookY: 2,
        target: { x: 155, y: y + 6, z: -340 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "west", "language hall downhill skirt");  } else if (scenario === "commonsskirt") {
    await hideHud(page);
    await setPose(page, 130, -60, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(160, -39);
      window.__controlsTest.setPhoto({
        yaw: -2.4,
        distance: 40,
        height: 8,
        lookY: 2,
        target: { x: 160, y: y + 5, z: -39 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "west", "activity hall downhill skirt");
  } else if (scenario === "icons") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ departmentId: "engineering-工學院-1" });
    });
    await frames(page, 2);
    const label = await page.evaluate(() => {
      const button = [...document.querySelectorAll(".ad-quickbar button")].find((el) =>
        (el.getAttribute("aria-label") || el.textContent || "").includes("技能"),
      );
      return button ? button.textContent.replace(/\s+/g, " ").trim() : "missing";
    });
    await shot(page, "engineering", `skill slot ${label}`);
    await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      window.__rpgQA.rpg.setState({ hp: 40, hurtUntil: s.clock + 40 });
    });
    await frames(page, 2);
    await shot(page, "hurt", "hurt vignette");
  } else if (scenario === "phone") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ departmentId: "engineering-工學院-1", hp: 62, focus: 40, xp: 80 });
    });
    await frames(page, 3);
    const icons = await page.evaluate(() => {
      const bar = document.querySelector(".ad-quickbar svg");
      const tool = document.querySelector(".ad-hud-right .ad-icon");
      const box = (el) => (el ? el.getBoundingClientRect() : null);
      return {
        skill: box(bar),
        tool: box(tool),
        skillClass: bar?.getAttribute("class") ?? "missing",
      };
    });
    await shot(page, "icons", `390 phone ${JSON.stringify(icons)}`);
  } else if (scenario === "hud") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await page.evaluate(() => window.__rpgQA.rpg.setState({ hp: 62, focus: 40, xp: 80 }));
    await frames(page, 4);
    const read = await page.evaluate(() => {
      const card = document.querySelector(".ad-status");
      return card ? card.innerText.replace(/\s+/g, " ").trim() : "missing";
    });
    await shot(page, "status", `viewport ${width}x${height} ${read}`);
    await page.evaluate(() => {
      const s = window.__rpgQA.rpg.getState();
      window.__rpgQA.rpg.setState({ hp: 10, hurtUntil: s.clock + 30, focus: Math.min(100, s.focus + 8) });
    });
    await frames(page, 2);
    const warn = await page.evaluate(() => {
      const card = document.querySelector(".ad-status");
      return card ? card.innerText.replace(/\s+/g, " ").trim() : "missing";
    });
    await shot(page, "warn", `viewport ${width}x${height} ${warn}`);
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ lesson: "move", lessonAnchor: { x: 0, z: -80 } });
    });
    await frames(page, 2);
    const badge = await page.evaluate(() => document.querySelector(".ad-minimap-lesson")?.textContent ?? "missing");
    await shot(page, "minimap", `lesson badge ${badge}`);
  } else if (scenario === "links") {
    // Estimated door walks that used to aim through the building or stop off the road.
    await hideHud(page);
    const stands = [
      ["audiovisual", 222, 2.5],
      ["main-gate", 60, 70.5],
    ];
    for (const [id, x, z] of stands) {
      await setPose(page, x, z, 0);
      await page.evaluate(() =>
        window.__controlsTest.setPhoto({ yaw: 0.6, distance: 34, height: 22, lookY: 0 }),
      );
      await settle(page, { stableFrames: 3 });
      const at = await page.evaluate(() => {
        const g = window.__rpgQA.game.getState();
        return { x: Number(g.playerX.toFixed(1)), z: Number(g.playerZ.toFixed(1)) };
      });
      await shot(page, id, `${id} door stand ${JSON.stringify(at)}`);
    }
  } else if (scenario === "gates") {
    await hideHud(page);
    const stands = [
      ["main-gate", 60, 70.5],
      ["dazhong-gate", 486, -46],
    ];
    for (const [id, x, z] of stands) {
      await setPose(page, x, z, Math.PI);
      await page.evaluate(() =>
        window.__controlsTest.setPhoto({ yaw: 0.15, distance: 16, height: 6.5, lookY: 1.2 }),
      );
      await settle(page, { stableFrames: 3 });
      await shot(page, id, `${id} open passage`);
    }
  } else if (scenario === "business") {
    await hideHud(page);
    await setPose(page, 132, -158, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(118, -182);
      window.__controlsTest.setPhoto({
        yaw: 0.4,
        distance: 36,
        height: 14,
        lookY: 4,
        target: { x: 118, y: y + 12, z: -182 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "mass", "business glass podium");
  } else if (scenario === "signs") {
    await hideHud(page);
    const stands = [
      ["science", 230, -255, 26],
      ["swimming", 236, -425, 28],
    ];
    for (const [id, x, z, depth] of stands) {
      await setPose(page, x, z + depth / 2 + 8, 0);
      await page.evaluate((spot) => {
        const gy = window.__rpgQA.ground(spot.x, spot.z);
        const target = { x: spot.x, y: gy + 3.25, z: spot.z + spot.depth / 2 + 0.2 };
        window.__controlsTest.setPhoto({ yaw: 0.62, distance: 7.2, height: 0.35, lookY: 0, target });
      }, { x, z, depth });
      await settle(page, { stableFrames: 3 });
      await shot(page, id, `${id} official sign`);
    }
  } else if (scenario === "integrated") {
    await hideHud(page);
    await setPose(page, -48, -328, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(-65, -360);
      window.__controlsTest.setPhoto({
        yaw: 0.35,
        distance: 28,
        height: 6,
        lookY: 0,
        target: { x: -65, y: y + 8, z: -360 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "integrated linked hall");
  } else if (scenario === "forum") {
    await hideHud(page);
    await setPose(page, 310, -410, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(292, -452);
      window.__controlsTest.setPhoto({
        yaw: 0.4,
        distance: 36,
        height: 8,
        lookY: 0,
        target: { x: 292, y: y + 6, z: -452 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "conference forum hall");
  } else if (scenario === "stand") {
    await hideHud(page);
    await setPose(page, -60, -398, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(-75, -420);
      window.__controlsTest.setPhoto({
        yaw: 0.95,
        distance: 46,
        height: 18,
        lookY: -4,
        target: { x: -75, y: y + 3, z: -420 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "deck", "reviewing stand");
  } else if (scenario === "shed") {
    await hideHud(page);
    await setPose(page, 450, -145, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(427, -177);
      window.__controlsTest.setPhoto({
        yaw: 0.7,
        distance: 40,
        height: 10,
        lookY: 0,
        target: { x: 427, y: y + 4, z: -177 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "duct", "wind tunnel shed");
  } else if (scenario === "reitaku") {
    await hideHud(page);
    await setPose(page, 450, -20, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(427, -52);
      window.__controlsTest.setPhoto({
        yaw: 0.65,
        distance: 42,
        height: 12,
        lookY: 0,
        target: { x: 427, y: y + 12, z: -52 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "house", "reitaku international house");
  } else if (scenario === "media") {
    await hideHud(page);
    await setPose(page, 100, -390, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(86, -418);
      window.__controlsTest.setPhoto({
        yaw: 0.55,
        distance: 38,
        height: 10,
        lookY: 0,
        target: { x: 86, y: y + 7, z: -418 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "o", "communication hall O");
  } else if (scenario === "auditorium") {
    await hideHud(page);
    await setPose(page, 240, 8, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(222, -12);
      window.__controlsTest.setPhoto({
        yaw: 0.6,
        distance: 40,
        height: 12,
        lookY: 0,
        target: { x: 222, y: y + 10, z: -12 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "audiovisual auditorium");
  } else if (scenario === "studio") {
    await hideHud(page);
    await setPose(page, 268, -48, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(285, -90);
      window.__controlsTest.setPhoto({
        yaw: -0.55,
        distance: 42,
        height: 16,
        lookY: 0,
        target: { x: 285, y: y + 8, z: -90 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "architecture studio mass");
  } else if (scenario === "activity") {
    await hideHud(page);
    await setPose(page, 142, -8, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(160, -39);
      window.__controlsTest.setPhoto({
        yaw: -0.5,
        distance: 40,
        height: 14,
        lookY: 0,
        target: { x: 160, y: y + 7, z: -39 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "student activity hall");
  } else if (scenario === "watch") {
    await hideHud(page);
    await setPose(page, 12, -358, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(25, -375);
      window.__controlsTest.setPhoto({
        yaw: -0.7,
        distance: 16,
        height: 4.5,
        lookY: 0,
        target: { x: 25, y: y + 2.2, z: -375 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "post", "security watch post");
  } else if (scenario === "engineering") {
    await hideHud(page);
    await setPose(page, 260, -140, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(287, -175);
      window.__controlsTest.setPhoto({
        yaw: -0.55,
        distance: 52,
        height: 16,
        lookY: 0,
        target: { x: 287, y: y + 10, z: -175 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "tower", "engineering tower");
  } else if (scenario === "pool") {
    await hideHud(page);
    await setPose(page, 258, -392, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(236, -425);
      window.__controlsTest.setPhoto({
        yaw: -0.7,
        distance: 36,
        height: 12,
        lookY: 0,
        target: { x: 236, y: y + 4, z: -425 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "swimming pool hall");
  } else if (scenario === "office") {
    await hideHud(page);
    await setPose(page, 112, -8, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(88, -44);
      window.__controlsTest.setPhoto({
        yaw: -0.65,
        distance: 38,
        height: 12,
        lookY: 0,
        target: { x: 88, y: y + 8, z: -44 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "administration office block");
  } else if (scenario === "faculty") {
    await hideHud(page);
    await setPose(page, 318, -520, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(290, -550);
      window.__controlsTest.setPhoto({
        yaw: -0.7,
        distance: 42,
        height: 12,
        lookY: 0,
        target: { x: 290, y: y + 8, z: -550 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "house", "faculty house");
  } else if (scenario === "garden") {
    await hideHud(page);
    await setPose(page, 248, -518, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(220, -550);
      window.__controlsTest.setPhoto({
        yaw: -0.75,
        distance: 36,
        height: 10,
        lookY: 0,
        target: { x: 220, y: y + 4, z: -550 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "house", "yingyuan garden house");
  } else if (scenario === "language") {
    await hideHud(page);
    await setPose(page, 185, -300, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(155, -340);
      window.__controlsTest.setPhoto({
        yaw: -0.65,
        distance: 46,
        height: 14,
        lookY: 0,
        target: { x: 155, y: y + 8, z: -340 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "foreign language hall");
  } else if (scenario === "planting") {
    await hideHud(page);
    await setPose(page, 0, -80, 0);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(6, -76);
      window.__controlsTest.setPhoto({
        yaw: 1.15,
        distance: 12,
        height: 2.4,
        lookY: 0,
        target: { x: 6, y: y + 0.8, z: -76 },
      });
    });
    await settle(page, { stableFrames: 4 });
    await shot(page, "avenue", "avenue trees, shrubs and beds");
  } else if (scenario === "roads") {
    await hideHud(page);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await setPose(page, 250, -55, 0);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(222, -25.6);
      window.__controlsTest.setPhoto({
        yaw: 2.6,
        distance: 34,
        height: 16,
        lookY: 0,
        target: { x: 222, y: y + 2, z: -20 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "road north of the audiovisual hall");
    await setPose(page, 486, -28, Math.PI);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(486, -52);
      window.__controlsTest.setPhoto({
        yaw: 0.15,
        distance: 20,
        height: 7,
        lookY: 0,
        target: { x: 486, y: y + 1.6, z: -52 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "gate", "road through the Dazhong gate");
  } else if (scenario === "memorial") {
    await hideHud(page);
    await setPose(page, -30, -248, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-52, -276);
      window.__controlsTest.setPhoto({
        yaw: 0.45,
        distance: 48,
        height: 18,
        lookY: 0,
        target: { x: -52, y: y + 14, z: -276 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "tower", "chingsheng memorial tower");
  } else if (scenario === "gym") {
    await hideHud(page);
    await setPose(page, 140, -78, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(166, -122);
      window.__controlsTest.setPhoto({
        yaw: -0.4,
        distance: 52,
        height: 16,
        lookY: 0,
        target: { x: 166, y: y + 8, z: -122 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "arena", "shaomo gymnasium");
  } else if (scenario === "science") {
    await hideHud(page);
    await setPose(page, 210, -230, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(230, -255);
      window.__controlsTest.setPhoto({
        yaw: -0.45,
        distance: 42,
        height: 12,
        lookY: 0,
        target: { x: 230, y: y + 8, z: -255 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "liuxian science hall");
  } else if (scenario === "workshop") {
    await hideHud(page);
    await setPose(page, 200, -145, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(222, -174);
      window.__controlsTest.setPhoto({
        yaw: -0.4,
        distance: 40,
        height: 12,
        lookY: 0,
        target: { x: 222, y: y + 7, z: -174 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "older engineering workshop");
  } else if (scenario === "chem") {
    await hideHud(page);
    await setPose(page, 312, -228, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(288, -258);
      window.__controlsTest.setPhoto({
        yaw: -0.7,
        distance: 40,
        height: 12,
        lookY: 0,
        target: { x: 288, y: y + 7, z: -258 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "chemistry hall");
  } else if (scenario === "seminar") {
    await hideHud(page);
    await setPose(page, 242, -304, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(218, -334);
      window.__controlsTest.setPhoto({
        yaw: -0.7,
        distance: 36,
        height: 10,
        lookY: 0,
        target: { x: 218, y: y + 6, z: -334 },
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "hall", "hweiwen seminar hall");
  } else if (scenario === "deck") {
    await hideHud(page);
    await setPose(page, -75, -413.4, Math.PI);
    await page.evaluate(() => {
      window.__rpgQA.game.getState().setTime("day");
      const y = window.__rpgQA.ground(-75, -413.4);
      window.__controlsTest.setPhoto({
        yaw: 1.2,
        distance: 12,
        height: 3.4,
        lookY: 0,
        target: { x: -75, y: y + 0.4, z: -414 },
      });
    });
    await settle(page, { stableFrames: 4 });
    await shot(page, "stand", "player standing on the reviewing deck");
  } else if (scenario === "npc-low") {
    await hideHud(page);
    await setPose(page, 8, -40, Math.PI);
    await page.evaluate(() => window.__rpgQA.game.getState().setTime("day"));
    await frames(page, 12);
    const walker = await page.evaluate(() => window.__npcQA?.walkers?.[0] ?? null);
    if (!walker) throw new Error("low-tier avenue walker was not reported");
    await page.evaluate((at) => {
      const y = window.__rpgQA.ground(at.x, at.z);
      window.__controlsTest.setPhoto({
        yaw: Math.PI * 0.85,
        distance: 5.5,
        height: 1.35,
        lookY: 0,
        target: { x: at.x, y: y + 1, z: at.z },
      });
    }, walker);
    await frames(page, 4);
    await shot(page, "avenue", `low-tier NPC stand-in at ${walker.x.toFixed(1)}, ${walker.z.toFixed(1)}`);
  } else if (scenario === "study") {
    await hideHud(page);
    await setPose(page, 224, -69.5, Math.PI);
    await page.evaluate(() =>
      window.__controlsTest.setPhoto({ yaw: 0.4, distance: 34, height: 12, lookY: 5 }),
    );
    await settle(page, { stableFrames: 3 });
    await shot(page, "education", "education study mass");
  } else if (scenario === "themes") {
    await hideHud(page);
    const stands = [
      ["sungtao", 292, -347.5],
      ["chemistry", 288, -243.5],
      ["swimming", 236, -408.5],
    ];
    for (const [id, x, z] of stands) {
      await setPose(page, x, z, Math.PI);
      await page.evaluate(() =>
        window.__controlsTest.setPhoto({ yaw: 0.35, distance: 36, height: 14, lookY: 6 }),
      );
      await settle(page, { stableFrames: 3 });
      await shot(page, id, `${id} theme mass`);
    }
  } else if (scenario === "halls") {
    await hideHud(page);
    const stands = [
      ["white-hall", 85, -536.5, { yaw: 0.9, distance: 42, height: 18, lookY: 6 }],
      ["chuehhsuan", 150, -536.5, { yaw: 0.2, distance: 28, height: 10, lookY: 3 }],
    ];
    for (const [id, x, z, photo] of stands) {
      await setPose(page, x, z, Math.PI);
      await page.evaluate((p) => window.__controlsTest.setPhoto(p), photo);
      await settle(page, { stableFrames: 3 });
      await shot(page, id, `${id} near silhouette`);
    }
  } else if (scenario === "zones") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 3 });
    await page.evaluate(() => window.__rpgQA.rpg.getState().setPanel("map"));
    await frames(page, 3);
    await shot(page, "map", "district legend");
  } else if (scenario === "lesson") {
    await setPose(page, 0, -40, 0);
    await page.evaluate(() => {
      window.__rpgQA.rpg.setState({ lesson: "move", lessonAnchor: { x: 0, z: -80 } });
      window.__rpgQA.rpg.getState().setPanel("map");
    });
    await frames(page, 4);
    await shot(page, "map", "lesson marker label");
  } else if (scenario === "budget") {
    await setPose(page, 0, -80, 0);
    await settle(page, { stableFrames: 4 });
    const sample = await sampleFrames(page, 1500);
    await shot(page, "avenue", `triangles ${sample.triangles} calls ${sample.drawCalls}`);
    console.log(JSON.stringify(sample));
  } else if (scenario === "vista") {
    await hideHud(page);
    await setPose(page, -36, -348, Math.PI / 2);
    await page.evaluate(() => {
      const y = window.__rpgQA.ground(-36, -348);
      const target = { x: -470, y: y + 36, z: -80 };
      const dx = -36 - target.x;
      const dz = -348 - target.z;
      window.__controlsTest.setPhoto({
        yaw: Math.atan2(dx, dz),
        distance: Math.hypot(dx, dz),
        height: 8 - 28,
        lookY: 6,
        target,
      });
    });
    await settle(page, { stableFrames: 3 });
    await shot(page, "west", "meadow looking west across the river");
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
