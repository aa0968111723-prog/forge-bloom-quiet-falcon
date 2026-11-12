import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { narrativeGlue } from "../src/game/rpg/narrative-glue.ts";
import { applyEffects } from "../src/features/narrative/effects.ts";
import {
  MAIN_INTEGRATION,
  acknowledge,
  advanceMinutes,
  arrive,
  choose,
  configure,
  createPlay,
  inventoryStats,
  leave,
  loadCatalog,
  loadEnvelope,
  openingLine,
  runChain,
  runTour,
  selectEvent,
  simulateSeeds,
  talk,
  toEnvelope,
  validateCatalog,
  visibleChoices,
} from "../src/features/narrative/index.ts";
import { DISCOVER_XP } from "../src/game/rpg/growth/progress.ts";

const catalog = loadCatalog();

test("catalog validates and does not claim the long-term targets or main-game integration", () => {
  const report = validateCatalog(catalog);
  assert.deepEqual(report.errors, []);
  const contentEvents = catalog.events.filter((event) => !event.id.startsWith("evt-faculty-"));
  const facultyEvents = catalog.events.filter((event) => event.id.startsWith("evt-faculty-"));
  assert.equal(contentEvents.length, 10);
  assert.equal(facultyEvents.length, 48);
  assert.equal(
    catalog.quests.filter((quest) => quest.arc && !quest.id.startsWith("quest-faculty-")).length,
    1,
  );
  assert.equal(
    catalog.quests.filter((quest) => quest.arc && quest.id.startsWith("quest-faculty-")).length,
    13,
  );
  assert.ok(catalog.events.length < 120);
  assert.equal(MAIN_INTEGRATION, false);
  assert.equal(narrativeGlue.integrated, false);
  for (const event of catalog.events) {
    assert.equal(event.status.integrated, false);
    assert.equal(event.status.reviewed, false);
    assert.equal(event.status.authored, true);
    assert.equal(event.status.validated, true);
    assert.equal(event.status.previewed, true);
  }
});

test("place rows keep aliases and never use surveyed", () => {
  const stats = inventoryStats(catalog.places);
  assert.equal(stats.surveyed, 0);
  assert.ok(stats.rows > stats.namedSiteRows);
  assert.match(stats.statement, /不是已查證建築數/);
  assert.ok(
    catalog.places.some(
      (place) => place.id === "chingsheng-building" && place.aliasOf === "chingsheng",
    ),
  );
  const postal = catalog.places.find((place) => place.id === "meta:postal-address");
  assert.equal(postal?.conflicts.length, 2);
  const library = catalog.places.find((place) => place.id === "library");
  assert.match(library?.claims.map((claim) => claim.text).join(" ") ?? "", /2,806/);
  const zones = new Set(
    catalog.events
      .filter((event) => !event.id.startsWith("evt-faculty-"))
      .map((event) => catalog.places.find((place) => place.id === event.placeId)?.zone),
  );
  assert.equal(zones.size, 7);
});

test("official units do not invent a parallel department id", () => {
  assert.ok(
    catalog.units.unmapped.some((row) => row.officialName === "歷史學系" && !row.departmentId),
  );
  assert.ok(catalog.units.conflicts.some((line) => line.includes("數學系")));
  assert.ok(catalog.units.mapped.some((row) => row.departmentId === "mass-comm"));
});

test("five minute chain has two real paths, memory, and one payout", () => {
  const libraryPath = runChain(catalog, "lantern-7", true);
  const stayPath = runChain(catalog, "lantern-7", false);
  assert.equal(libraryPath.growth.xp, 8 + DISCOVER_XP + 12 + DISCOVER_XP + 15 + 24);
  assert.equal(libraryPath.growth.xp, stayPath.growth.xp);
  assert.equal(libraryPath.growth.materials.notes, 10);
  assert.equal(stayPath.growth.materials.notes, 10);
  assert.equal(libraryPath.growth.materials.credit, 1);
  assert.equal(stayPath.growth.materials.credit, 1);
  assert.equal(libraryPath.session.flags["group-library"], true);
  assert.equal(stayPath.session.flags["group-stay"], true);
  assert.equal(libraryPath.session.questNodes["quest-group-report"], "done");
  assert.notEqual(
    libraryPath.session.memory["npc-lin-ke:pact"],
    stayPath.session.memory["npc-lin-ke:pact"],
  );

  let play = createPlay("memory");
  play = acknowledge(
    choose(catalog, talk(catalog, arrive(catalog, play, "main-gate")), "gate-ask-map").play,
  );
  play = talk(catalog, arrive(catalog, play, "palace"));
  assert.match(openingLine(catalog, play), /問過路/);
  play = acknowledge(choose(catalog, play, "palace-library").play);
  play = talk(catalog, arrive(catalog, play, "library"));
  assert.match(openingLine(catalog, play), /沒有只丟連結/);
  play = acknowledge(choose(catalog, play, "library-compare").play);
  play = arrive(catalog, play, "palace");
  assert.equal(play.ui.eventId, null);
  assert.match(play.ui.notice ?? "", /沒有事件/);
  play = arrive(catalog, configure(play, { timeOfDay: "evening" }), "palace");
  play = talk(catalog, play);
  assert.match(openingLine(catalog, play), /並列/);
  const finished = choose(catalog, play, "deadline-calm");
  assert.match(finished.play.ui.outcome ?? "", /不講燈/);
  play = acknowledge(finished.play);
  play = arrive(catalog, play, "museum");
  assert.equal(play.ui.phase, "available");
  play = arrive(catalog, leave(catalog, talk(catalog, play)), "science");
  assert.equal(play.ui.eventId, null);
});

test("leaving, saving, and repeating do not pay twice", () => {
  let play = createPlay("save");
  play = talk(catalog, arrive(catalog, play, "main-gate"));
  play = leave(catalog, play);
  assert.equal(play.growth.xp, 0);
  assert.equal(play.session.resolved.includes("evt-gate-orientation"), false);
  play = arrive(catalog, play, "main-gate");
  assert.equal(play.ui.eventId, "evt-gate-orientation");
  play = runChain(catalog, "save", true);
  const envelope = toEnvelope(play);
  const loaded = loadEnvelope(envelope);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.play.growth.materials.notes, play.growth.materials.notes);
  const again = loadEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.equal(again.ok, true);
  if (!again.ok) return;
  const paid = applyEffects(catalog, again.play.growth, again.play.session, [
    { type: "quest-reward", questId: "quest-group-report-done", xp: 24, notes: 4, credit: 1 },
  ]);
  assert.equal(paid.growth.materials.notes, again.play.growth.materials.notes);
  assert.ok(paid.skipped.some((entry) => entry.includes("quest-group-report-done")));
  assert.equal(loadEnvelope({ ...envelope, version: 0 }).ok, false);
  assert.equal(loadEnvelope({ ...envelope, sync: "cloud" }).ok, false);
  assert.equal(loadEnvelope({ ...envelope, growth: { ...envelope.growth, version: 3 } }).ok, false);
});

test("legacy claimed quests and illegal effects do not move the reward ledger", () => {
  const fresh = createPlay("legacy");
  const loaded = loadEnvelope({
    version: 1,
    sync: "local-fixture-only",
    contentRevision: 1,
    session: fresh.session,
    growth: { version: 2, claimed: ["quest-orient-gate"], xp: 8 },
    ui: fresh.ui,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  const paid = applyEffects(catalog, loaded.play.growth, loaded.play.session, [
    { type: "quest-reward", questId: "quest-orient-gate", xp: 8, notes: 1 },
  ]);
  assert.equal(paid.growth.xp, 8);
  assert.equal(paid.growth.materials.notes, 0);
  const illegal = applyEffects(catalog, paid.growth, paid.session, [{ type: "set-hp" }]);
  assert.equal(illegal.ok, false);
  assert.equal(illegal.growth, paid.growth);
});

test("mutex keeps the other event out until the window passes", () => {
  const place = catalog.places.find((entry) => entry.id === "business");
  const donor = catalog.events.find((event) => event.id === "evt-business-shift");
  const paired = {
    ...catalog,
    events: [
      {
        ...donor,
        id: "evt-mutex-a",
        mutexGroup: "desk",
        mutexMinutes: 50,
        once: false,
        cooldownMinutes: 0,
      },
      {
        ...donor,
        id: "evt-mutex-b",
        mutexGroup: "desk",
        mutexMinutes: 50,
        once: false,
        cooldownMinutes: 0,
      },
    ],
  };
  let play = createPlay("mutex");
  play = acknowledge(
    choose(paired, talk(paired, arrive(paired, play, "business")), "shift-swap").play,
  );
  const blocked = selectEvent(paired, play.session, place);
  const winner = blocked.event?.id;
  const loser = winner === "evt-mutex-a" ? "evt-mutex-b" : "evt-mutex-a";
  assert.ok(winner === "evt-mutex-a" || winner === "evt-mutex-b");
  assert.ok(blocked.suppressed.some((entry) => entry.id === loser && entry.reason === "mutex"));
  const later = selectEvent(paired, { ...play.session, minute: play.session.minute + 50 }, place);
  assert.ok(later.eligible.includes(loser));
});

test("rain cooldown, clear weather, and college-only choices stay optional", () => {
  let play = createPlay("rain-3");
  play = arrive(catalog, play, "track");
  assert.equal(play.ui.eventId, null);
  play = talk(catalog, arrive(catalog, configure(play, { weather: "rain" }), "track"));
  assert.equal(
    visibleChoices(catalog, play).some((choice) => choice.id === "rain-health-note"),
    false,
  );
  const first = choose(catalog, play, "rain-indoor");
  assert.equal(first.ok, true);
  play = acknowledge(first.play);
  const xp = play.growth.xp;
  play = arrive(catalog, play, "track");
  assert.equal(play.ui.eventId, null);
  const blocked = selectEvent(
    catalog,
    play.session,
    catalog.places.find((place) => place.id === "track"),
  );
  assert.ok(
    blocked.suppressed.some(
      (entry) => entry.id === "evt-track-rain" && entry.reason === "cooldown",
    ),
  );
  play = arrive(catalog, advanceMinutes(play, 180), "track");
  play = acknowledge(choose(catalog, talk(catalog, play), "rain-reschedule").play);
  assert.equal(play.growth.xp, xp);
  let lab = createPlay("lab");
  lab = talk(catalog, arrive(catalog, lab, "engineering"));
  assert.equal(
    visibleChoices(catalog, lab).some((choice) => choice.id === "lab-diagram"),
    false,
  );
  lab = talk(catalog, arrive(catalog, configure(lab, { collegeId: "engineering" }), "engineering"));
  assert.equal(
    visibleChoices(catalog, lab).some((choice) => choice.id === "lab-diagram"),
    true,
  );
  const diagram = choose(catalog, lab, "lab-diagram");
  assert.equal(diagram.play.session.flags["lab-diagram"], true);
  assert.equal(diagram.play.growth.materials.notes, 2);
});

test("same seed repeats and a weighted pair is not stuck on one event", () => {
  const seeds = ["gate-100", "lantern-7", "rain-3"];
  const runs = simulateSeeds(catalog, seeds);
  assert.equal(runs.length, 3);
  for (const run of runs) {
    assert.equal(run.sameAsRepeat, true);
    assert.equal(run.fired.length, 10);
    assert.equal(run.xp, 8 + 12 + 12 + 12 + 15 + 24 + 10 + 10 + 10 + 12 + 8 + DISCOVER_XP + 6);
    assert.equal(run.notes, 17);
    assert.equal(run.credit, 2);
  }
  const first = runTour(catalog, "gate-100");
  const second = runTour(catalog, "gate-100");
  assert.deepEqual(first.session.fired, second.session.fired);
  assert.match(first.growth.claimedQuests.join(), /quest-group-report-done/);
  const place = catalog.places.find((entry) => entry.id === "business");
  const weighted = {
    ...catalog,
    events: [
      {
        ...catalog.events[5],
        id: "evt-weight-a",
        weight: 1,
        priority: 1,
        once: false,
        when: undefined,
        mutexGroup: null,
      },
      {
        ...catalog.events[5],
        id: "evt-weight-b",
        weight: 1,
        priority: 1,
        once: false,
        when: undefined,
        mutexGroup: null,
      },
    ],
  };
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const picked = selectEvent(weighted, createPlay(`weight-${i}`).session, place);
    seen.add(picked.event?.id);
  }
  assert.equal(seen.size, 2);
  const session = createPlay("weight-0").session;
  assert.equal(
    selectEvent(weighted, session, place).event?.id,
    selectEvent(weighted, session, place).event?.id,
  );
});

test("validator catches broken links, loops, unreachable nodes, and missing text", () => {
  const unreachable = structuredClone(catalog);
  const donor = unreachable.events[0];
  unreachable.events.push({
    ...donor,
    id: "evt-unreachable-demo",
    when: { op: "flag", id: "nobody-sets-this", equals: true },
    choices: donor.choices.map((choice) => ({ ...choice, id: `${choice.id}-unreachable` })),
  });
  assert.ok(validateCatalog(unreachable).errors.some((error) => error.code === "unreachable"));

  const loop = structuredClone(catalog);
  const base = loop.events[1];
  loop.events.push(
    {
      ...base,
      id: "evt-loop-a",
      autoFire: true,
      choices: base.choices.map((choice) => ({
        ...choice,
        id: `${choice.id}-a`,
        nextEventId: "evt-loop-b",
      })),
    },
    {
      ...base,
      id: "evt-loop-b",
      autoFire: true,
      choices: base.choices.map((choice) => ({
        ...choice,
        id: `${choice.id}-b`,
        nextEventId: "evt-loop-a",
      })),
    },
  );
  assert.ok(validateCatalog(loop).errors.some((error) => error.code === "infinite-loop"));

  const duplicate = structuredClone(catalog);
  duplicate.events.push(duplicate.events[0]);
  assert.ok(validateCatalog(duplicate).errors.some((error) => error.code === "duplicate-id"));

  const blank = structuredClone(catalog);
  blank.events[0].lines[0].text["zh-Hant"] = " ";
  assert.ok(validateCatalog(blank).errors.some((error) => error.code === "missing-locale"));

  const surveyed = structuredClone(catalog);
  surveyed.places[0].accuracy = "surveyed";
  assert.ok(
    validateCatalog(surveyed).errors.some((error) => error.code === "surveyed-without-evidence"),
  );
});

test("ready original files match their recorded hashes and research images stay out of public", () => {
  for (const asset of catalog.assets) {
    if (asset.class === "research") {
      assert.equal(asset.path, null);
      assert.equal(asset.hotlink, false);
      assert.equal(asset.redistributable, false);
    }
    if (!asset.path || !asset.version.startsWith("sha256:")) continue;
    const digest = createHash("sha256").update(readFileSync(asset.path)).digest("hex");
    assert.equal(`sha256:${digest}`, asset.version);
    if (asset.path.endsWith(".svg")) {
      const text = readFileSync(asset.path, "utf8");
      assert.doesNotMatch(text, /<image|href="https?:/);
      assert.match(text, /viewBox="0 0 64 64"/);
    }
  }
  assert.equal(
    catalog.assets.find((asset) => asset.id === "concept-lantern-deadline")?.status,
    "pending",
  );
  assert.equal(
    catalog.assets.find((asset) => asset.id === "sfx-lantern-flicker")?.status,
    "pending",
  );
});
