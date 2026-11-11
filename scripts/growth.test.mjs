import assert from "node:assert/strict";
import test from "node:test";

import {
  COLLEGE_IDS,
  DEPARTMENTS,
  skillModifiers,
} from "../src/game/departments.ts";
import { DISCIPLINES } from "../src/game/rpg/data.ts";
import {
  CAST_PARTICLE_BUDGET,
  CAST_PHASES,
  COLLEGE_ABILITIES,
  ENEMY_CAST_WARNING,
  GROWTH_BANDS,
  cancelDepartment,
  castBeat,
  commitDepartment,
  compareDepartments,
  departmentKeyNav,
  freshGrowthState,
  grantCombatXp,
  grantQuestReward,
  grantXp,
  levelGrowthView,
  nodeStatus,
  overlapCasts,
  previewConfirm,
  readV2Progress,
  replayFastTravel,
  sceneCut,
  searchDepartments,
  skillKeyboardIds,
  spendPoint,
} from "../src/game/rpg/growth/index.ts";
import { basicAttackDamage, levelForXp, lifeCap } from "../src/game/rpg/rules.ts";

const DISCIPLINE_OF = {
  "liberal-arts": "humanities",
  science: "science",
  engineering: "engineering",
  business: "business",
  "foreign-lang": "language",
  international: "international",
  education: "education",
  ai: "computing",
  "precision-health": "health",
};

function ready(xp, notes, credit, departmentId = "cs") {
  let state = readV2Progress({ version: 2, skillRank: 1, xp: 0 });
  state = previewConfirm(state, departmentId);
  state = commitDepartment(state);
  return { ...state, xp, materials: { notes, credit } };
}

test("search keeps nine colleges, chinese substring, blank clear, and no hits", () => {
  const cleared = searchDepartments("  　  ");
  assert.equal(cleared.cleared, true);
  assert.equal(cleared.count, DEPARTMENTS.length);
  assert.equal(cleared.empty, false);
  assert.equal(cleared.groups.length, 9);
  assert.deepEqual(
    cleared.groups.map((group) => group.collegeId),
    [...COLLEGE_IDS],
  );
  assert.deepEqual(
    cleared.keyboardIds,
    DEPARTMENTS.map((department) => department.id),
  );

  const physics = searchDepartments("  物理  ");
  assert.deepEqual(physics.keyboardIds, ["physics"]);
  assert.equal(physics.count, 1);
  assert.equal(physics.groups.length, 9);
  assert.equal(physics.groups.find((group) => group.collegeId === "liberal-arts").count, 0);

  const both = searchDepartments("中國　文學");
  assert.deepEqual(both.keyboardIds, ["chi-lit"]);

  const english = searchDepartments("PHYSICS");
  assert.deepEqual(english.keyboardIds, ["physics"]);

  const engineering = searchDepartments("工程");
  assert.deepEqual(engineering.keyboardIds, ["civil", "cs", "ee"]);

  const none = searchDepartments("沒有這種科系");
  assert.equal(none.count, 0);
  assert.equal(none.empty, true);
  assert.equal(none.groups.length, 9);
  assert.ok(none.emptyMessage);
  assert.equal(
    none.groups.every((group) => group.departments.length === 0),
    true,
  );

  const first = departmentKeyNav(cleared.keyboardIds, null, "ArrowDown");
  const second = departmentKeyNav(cleared.keyboardIds, first, "next");
  assert.equal(first, "chi-lit");
  assert.equal(second, "mass-comm");
  assert.equal(departmentKeyNav(cleared.keyboardIds, "chi-lit", "ArrowUp"), "chi-lit");
  assert.equal(departmentKeyNav(cleared.keyboardIds, second, "Home"), "chi-lit");
  assert.equal(departmentKeyNav(cleared.keyboardIds, first, "Escape"), null);
  assert.equal(cleared.touchTargets.length, cleared.count);
});

test("compare uses skillModifiers and same-college departments do not differ", () => {
  const across = compareDepartments("chi-lit", "physics");
  assert.deepEqual(across.a.modifiers, skillModifiers("chi-lit"));
  assert.deepEqual(across.b.modifiers, skillModifiers("physics"));
  assert.equal(across.sameCollege, false);
  assert.equal(across.identical, false);
  assert.equal(across.delta.reportAttackBonus, skillModifiers("physics").reportAttackBonus - skillModifiers("chi-lit").reportAttackBonus);
  assert.notEqual(across.delta.examAttackBonus, 0);

  const twins = compareDepartments("architecture", "civil");
  assert.equal(twins.sameCollege, true);
  assert.equal(twins.identical, true);
  assert.deepEqual(twins.a.modifiers, skillModifiers("architecture"));
  assert.deepEqual(twins.b.modifiers, skillModifiers("civil"));
  assert.ok(twins.lines.every((line) => line.delta === 0));

  const languages = compareDepartments("english", "japanese");
  assert.equal(languages.sameCollege, true);
  assert.equal(languages.identical, true);
});

test("cancel keeps the major and confirm initializes the trunk once", () => {
  const saved = readV2Progress({
    version: 2,
    skillRank: 4,
    xp: 5000,
    slots: [
      { itemId: "notes", quantity: 9 },
      { itemId: "credit", quantity: 2 },
    ],
  });
  const preview = previewConfirm(saved, "math");
  assert.equal(preview.departmentId, null);
  assert.equal(preview.pendingId, "math");
  assert.equal(preview.skillRank, 4);
  assert.equal(preview.xp, 5000);
  assert.deepEqual(preview.invested, saved.invested);
  const cancelled = cancelDepartment(preview);
  assert.equal(cancelled.departmentId, saved.departmentId);
  assert.equal(cancelled.pendingId, null);
  assert.equal(cancelled.skillRank, 4);
  assert.equal(cancelled.xp, 5000);
  assert.deepEqual(cancelled.invested, saved.invested);
  assert.deepEqual(cancelled.learned, saved.learned);
  assert.deepEqual(cancelled.materials, saved.materials);

  let picked = previewConfirm(freshGrowthState(), "english");
  picked = commitDepartment(picked);
  assert.equal(picked.departmentId, "english");
  assert.equal(picked.confirmed, true);
  assert.equal(picked.skillRank, 1);
  assert.ok(picked.learned.includes("foreign-lang:rank:1"));
  assert.equal(commitDepartment(picked), picked);
  assert.equal(previewConfirm(picked, "japanese"), picked);
  assert.equal(cancelDepartment(picked), picked);

  let kept = readV2Progress({ skillRank: 4, invested: { notes: 30, credit: 6 } });
  kept = commitDepartment(previewConfirm(kept, "ba"));
  assert.equal(kept.skillRank, 4);
  assert.deepEqual(kept.invested, { notes: 30, credit: 6 });
  assert.ok(kept.learned.includes("business:rank:4"));
  assert.equal(kept.learned.includes("business:branch"), false);
  assert.equal(commitDepartment(kept), kept);
});

test("v2 reader keeps rank and spent materials without raising the version", () => {
  const blank = readV2Progress(null);
  assert.equal(blank.version, 2);
  assert.equal(blank.departmentId, null);
  assert.equal(blank.skillRank, 1);
  assert.deepEqual(blank.invested, { notes: 0, credit: 0 });
  assert.equal(blank.confirmed, false);
  assert.equal(blank.mainDone, false);

  const rankOnly = readV2Progress({ skillRank: 3 });
  assert.equal(rankOnly.version, 2);
  assert.equal(rankOnly.departmentId, null);
  assert.equal(rankOnly.skillRank, 3);
  assert.deepEqual(rankOnly.invested, { notes: 15, credit: 3 });

  const legacy = readV2Progress({
    version: 1,
    skillRank: 2,
    inventory: [
      { id: "notes", count: 4 },
      { id: "credit", count: 1 },
    ],
  });
  assert.equal(legacy.version, 1);
  assert.equal(legacy.skillRank, 2);
  assert.deepEqual(legacy.invested, { notes: 5, credit: 1 });
  assert.deepEqual(legacy.materials, { notes: 4, credit: 1 });

  const high = readV2Progress({
    version: 2,
    departmentId: "med-info",
    skillRank: 5,
    xp: 20000,
    lesson: "done",
    boss: 1,
    claimed: ["semester"],
    discoveries: ["library"],
    slots: [
      { itemId: "notes", quantity: 12 },
      { itemId: "credit", quantity: 3 },
    ],
  });
  assert.equal(high.version, 2);
  assert.equal(high.departmentId, "med-info");
  assert.equal(high.skillRank, 5);
  assert.deepEqual(high.invested, { notes: 50, credit: 10 });
  assert.equal(high.mainDone, true);
  assert.equal(high.materials.notes, 12);
  assert.ok(high.learned.includes("precision-health:rank:5"));
  assert.equal(high.learned.includes("precision-health:branch"), false);
  assert.equal(levelGrowthView(high).level, levelForXp(20000));
  assert.equal(levelGrowthView(high).band, "late");
  assert.equal(grantQuestReward(high, "semester", { xp: 200, credit: 5 }), high);
  assert.equal(replayFastTravel(high, "library"), high);

  const mapped = readV2Progress({
    version: 2,
    departmentId: "humanities-文學院-0",
    skillRank: 2,
  });
  assert.equal(mapped.departmentId, "humanities-文學院-0");
  assert.equal(mapped.catalogDepartmentId, "chi-lit");
  assert.equal(mapped.version, 2);
  assert.ok(mapped.learned.includes("liberal-arts:rank:2"));
});

test("spend rejects spam, level, points, materials, locked branch, and the cap", () => {
  const poor = ready(0, 0, 0);
  assert.equal(spendPoint(freshGrowthState(), "engineering:rank:2").reason, "unconfirmed");
  const lowLevel = spendPoint(poor, "engineering:rank:2");
  assert.equal(lowLevel.reason, "level");
  assert.equal(lowLevel.state, poor);

  const noPoints = spendPoint({ ...ready(60, 20, 5), spentPoints: 1 }, "engineering:rank:2");
  assert.equal(noPoints.reason, "points");
  assert.equal(noPoints.state.materials.notes, 20);

  const broke = ready(60, 0, 0);
  const noMats = spendPoint(broke, "engineering:rank:2");
  assert.equal(noMats.reason, "materials");
  assert.equal(noMats.state, broke);
  assert.equal(noMats.state.skillRank, 1);

  const locked = spendPoint(ready(1500, 100, 20), "engineering:branch");
  assert.equal(locked.reason, "locked");
  assert.equal(nodeStatus(locked.state, "engineering:branch"), "locked");

  let state = ready(960, 50, 10);
  const before = structuredClone(state);
  for (const rank of [2, 3, 4, 5]) {
    const spent = spendPoint(state, `engineering:rank:${rank}`);
    assert.equal(spent.ok, true, `rank ${rank} ${spent.reason}`);
    assert.notEqual(spent.state, state);
    state = spent.state;
  }
  assert.deepEqual(before.materials, { notes: 50, credit: 10 });
  assert.equal(state.skillRank, 5);
  assert.deepEqual(state.materials, { notes: 0, credit: 0 });
  assert.deepEqual(state.invested, { notes: 50, credit: 10 });
  const capped = spendPoint(state, "engineering:rank:5");
  assert.equal(capped.reason, "capped");
  assert.equal(capped.state, state);
  assert.equal(nodeStatus(state, "engineering:rank:5"), "capped");

  const opened = ready(60, 40, 8);
  const once = spendPoint(opened, "engineering:rank:2");
  assert.equal(once.ok, true);
  assert.equal(once.state.materials.notes, 35);
  assert.equal(once.state.materials.credit, 7);
  const twice = spendPoint(once.state, "engineering:rank:2");
  assert.equal(twice.reason, "once");
  assert.equal(twice.state, once.state);

  let mid = ready(1500, 80, 20);
  for (const rank of [2, 3]) mid = spendPoint(mid, `engineering:rank:${rank}`).state;
  assert.equal(nodeStatus(mid, "engineering:branch"), "available");
  const branch = spendPoint(mid, "engineering:branch");
  assert.equal(branch.ok, true);
  assert.equal(spendPoint(branch.state, "engineering:branch").state, branch.state);
  assert.equal(branch.state.skillRank, 3);
});

test("xp and quest rewards settle once, including fast travel replay", () => {
  let state = freshGrowthState();
  state = grantCombatXp(state, "quiz-1", 24);
  assert.equal(state.xp, 24);
  assert.equal(grantCombatXp(state, "quiz-1", 24), state);
  assert.equal(grantXp(state, "combat:quiz-1", 24, "nope"), state);

  const traveled = replayFastTravel(state, "palace");
  assert.equal(traveled.xp, 36);
  assert.equal(replayFastTravel(traveled, "palace"), traveled);
  const other = replayFastTravel(traveled, "library");
  assert.equal(other.xp, 48);

  const paid = grantQuestReward(other, "first", { xp: 60, notes: 3, credit: 1 });
  assert.equal(paid.xp, 108);
  assert.equal(paid.materials.notes, 3);
  assert.equal(paid.materials.credit, 1);
  assert.equal(grantQuestReward(paid, "first", { xp: 60, notes: 9 }), paid);

  const seeded = readV2Progress({ version: 2, xp: 12, discoveries: ["palace"] });
  assert.equal(replayFastTravel(seeded, "palace"), seeded);
  assert.equal(seeded.xp, 12);
});

test("growth bands call levelForXp and keep the shipped life curve", () => {
  assert.deepEqual(
    GROWTH_BANDS.map((band) => band.level),
    [1, 6, 16],
  );
  for (const band of GROWTH_BANDS) {
    assert.equal(band.level, levelForXp(band.xp));
    assert.ok(band.reason.length > 0);
  }
  const view = levelGrowthView({ xp: 60, equipped: true, spentPoints: 0, skillRank: 1 });
  assert.equal(view.level, levelForXp(60));
  assert.equal(view.life, lifeCap(60, true));
  assert.equal(view.attack, basicAttackDamage(60, true));
  assert.equal(view.band, "early");
});

test("nine abilities share the hud rank formula and cast beats keep the warning", () => {
  const templates = new Set();
  for (const collegeId of COLLEGE_IDS) {
    const ability = COLLEGE_ABILITIES[collegeId];
    const discipline = DISCIPLINES[DISCIPLINE_OF[collegeId]];
    templates.add(ability.type);
    assert.equal(ability.damage, discipline.damage);
    assert.equal(ability.range, discipline.range);
    assert.equal(ability.cooldown, discipline.cooldown);
    assert.equal(ability.focus, 22);
    for (let rank = 1; rank <= 5; rank++) {
      assert.equal(ability.ranks[rank].damage, discipline.damage + (rank - 1) * 12);
      assert.equal(ability.ranks[rank].increment, (rank - 1) * 12);
      assert.equal(ability.ranks[rank].cost.notes, rank * 5);
      assert.equal(ability.ranks[rank].cost.credit, rank);
    }
    const order = skillKeyboardIds(collegeId);
    assert.deepEqual(order, skillKeyboardIds(collegeId));
    assert.ok(order.includes(`${collegeId}:branch`));
    assert.equal(order.length, 7);

    for (const phase of ["hit", "miss", "blocked"]) {
      const beat = castBeat(collegeId, phase);
      assert.equal(beat.colorName.length > 0, true);
      assert.ok(beat.particles <= CAST_PARTICLE_BUDGET);
      assert.equal(beat.flash, false);
      assert.equal(beat.soundId, phase === "recover" ? null : `cast-${ability.type}-${phase}`);
      assert.equal(beat.enemyWarning, ENEMY_CAST_WARNING);
      assert.equal(beat.enemyWarning.suppressedByParticles, false);
      assert.match(beat.enemyWarning.text, /即將攻擊/);
    }
    const quiet = castBeat(collegeId, "hit", { reducedMotion: true, muted: true, quality: "low" });
    assert.equal(quiet.particles, 0);
    assert.equal(quiet.staticMark, "靜態");
    assert.equal(quiet.soundId, null);
    assert.match(quiet.caption, /靜音/);
    assert.equal(quiet.enemyWarning.flag, true);
    assert.equal(quiet.enemyWarning.readable, true);
    assert.match(quiet.enemyWarning.text, /即將攻擊/);
    assert.equal(quiet.flash, false);
  }
  assert.equal(templates.size, 4);
  for (const template of ["melee-pulse", "projectile", "heal", "area"]) {
    assert.equal(templates.has(template), true);
  }

  for (const phase of CAST_PHASES) {
    const beat = castBeat("science", phase, { quality: "low" });
    assert.ok(beat.particles <= CAST_PARTICLE_BUDGET);
    assert.equal(beat.enemyWarning, ENEMY_CAST_WARNING);
  }
  const hit = castBeat("engineering", "hit");
  const release = castBeat("engineering", "release");
  const stacked = overlapCasts([hit, release, hit]);
  assert.equal(stacked.clamped, true);
  assert.equal(stacked.particles, CAST_PARTICLE_BUDGET);
  assert.equal(stacked.enemyWarning, ENEMY_CAST_WARNING);
  const cut = sceneCut(hit);
  assert.equal(cut.phase, "recover");
  assert.equal(cut.particles, 0);
  assert.match(cut.caption, /切場/);
  assert.equal(cut.enemyWarning, ENEMY_CAST_WARNING);
});
