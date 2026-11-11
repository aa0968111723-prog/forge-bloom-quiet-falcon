/**
 * Fixed clock, sweep, ground contact, knockback and prop replay.
 * Two dt sequences are compared only after the clock has counted steps.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { sampleGroundElevation } from "../src/game/world-data/elevation.ts";
import { KENAN_LANDING_Z } from "../src/game/world-data/kenan.ts";
import { SPAWN } from "../src/game/world-data/landmarks.ts";
import { resolveInterior } from "../src/game/rpg/rules.ts";
import { WALK } from "../src/game/rpg/move.ts";
import {
  FIXED_DT,
  MAX_CATCHUP_STEPS,
  POSITION_TOLERANCE_M,
  SURFACE_FRICTION,
  applyImpulse,
  cameraClearance,
  createHitLedger,
  createProp,
  createSimClock,
  createWalker,
  integrateInterior,
  knockback,
  resolveHitSignals,
  sampleContact,
  stepDynamics,
  stepInterior,
  stepWalker,
  sweepCircle,
} from "../src/game/rpg/physics/index.ts";

function drain(frames) {
  const clock = createSimClock();
  let steps = 0;
  const perFrame = [];
  for (const dt of frames) {
    const count = clock.step(dt);
    perFrame.push(count);
    steps += count;
  }
  return { steps, perFrame };
}

function repeats(dt, count) {
  return Array.from({ length: count }, () => dt);
}

function findOpen(radius = 0.5) {
  for (let x = 30; x <= 90; x += 2) {
    for (let z = -90; z <= -16; z += 2) {
      const resolved = resolveCollision(x, z, radius);
      if (Math.hypot(resolved.x - x, resolved.z - z) < 1e-6) return { x, z };
    }
  }
  throw new Error("no open pad");
}

function overlaps(x, z, radius, box) {
  const cx = Math.min(Math.max(x, box.minX), box.maxX);
  const cz = Math.min(Math.max(z, box.minZ), box.maxZ);
  return (x - cx) ** 2 + (z - cz) ** 2 < radius * radius - 1e-6;
}

test("fixed clock caps catch-up and drops a pause gap", () => {
  assert.equal(FIXED_DT, 1 / 60);
  assert.ok(MAX_CATCHUP_STEPS <= 5);
  const clock = createSimClock();
  assert.equal(clock.step(0.05), 3);
  assert.equal(clock.step(0.2), MAX_CATCHUP_STEPS);
  assert.equal(clock.step(FIXED_DT), 1);
  clock.pause();
  assert.equal(clock.step(2.5), 0);
  clock.resume();
  assert.equal(clock.step(FIXED_DT), 1);

  const steady = drain(repeats(FIXED_DT, 12));
  const coarse = drain(repeats(0.05, 4));
  assert.equal(steady.steps, 12);
  assert.equal(coarse.steps, 12);
  const hitch = drain([0.05, 0.2, FIXED_DT]);
  assert.deepEqual(hitch.perFrame, [3, MAX_CATCHUP_STEPS, 1]);
  assert.equal(hitch.steps, 9);

  const live = createSimClock();
  const paused = createSimClock();
  let liveDamage = 0;
  let pausedDamage = 0;
  for (const dt of repeats(FIXED_DT, 10)) {
    liveDamage += live.step(dt);
    pausedDamage += paused.step(dt);
  }
  paused.pause();
  pausedDamage += paused.step(3);
  paused.resume();
  for (const dt of repeats(FIXED_DT, 10)) {
    liveDamage += live.step(dt);
    pausedDamage += paused.step(dt);
  }
  assert.equal(pausedDamage, liveDamage);
  assert.equal(liveDamage, 20);
});

test("surface class is geometric and friction differs on the first step", () => {
  const stone = sampleContact(0, 70);
  const landingZ = (KENAN_LANDING_Z[0] + KENAN_LANDING_Z[1]) / 2;
  const landing = sampleContact(0, landingZ);
  const pave = sampleContact(0, SPAWN.z);
  let grass = null;
  for (let x = 30; x <= 70; x += 2) {
    for (let z = -80; z <= -20; z += 2) {
      const sample = sampleContact(x, z);
      if (sample.surface === "grass") {
        grass = sample;
        break;
      }
    }
    if (grass) break;
  }
  assert.ok(grass, "expected a grass sample");
  assert.equal(stone.surface, "stone");
  assert.equal(landing.surface, "stone");
  assert.equal(pave.surface, "pave");
  assert.equal(stone.accuracy, "estimated");
  assert.equal(stone.basis, "geometric");
  assert.equal(stone.height, sampleGroundElevation(0, 70));
  assert.ok(stone.slope > landing.slope);
  assert.ok(landing.slope < 0.05);
  assert.equal(stone.friction, SURFACE_FRICTION.stone);
  assert.ok(SURFACE_FRICTION.grass < SURFACE_FRICTION.stone);
  assert.ok(SURFACE_FRICTION.stone < SURFACE_FRICTION.pave);

  const impulse = { impulseX: 10, impulseZ: 0, steps: 1, mass: 1, radius: 0.3 };
  const grassEnd = knockback({ ...impulse, x: 40, z: -40 });
  const stoneEnd = knockback({ ...impulse, x: 0, z: 70 });
  const paveEnd = knockback({ ...impulse, x: 0, z: SPAWN.z });
  assert.equal(sampleContact(40, -40).surface, "grass");
  assert.ok(grassEnd.vx > stoneEnd.vx);
  assert.ok(stoneEnd.vx > paveEnd.vx);
});

test("sweep slides at corners and fits a narrow door without crossing a thin wall", () => {
  const pad = findOpen(0.6);
  const corner = [
    { minX: pad.x - 8, maxX: pad.x, minZ: pad.z - 8, maxZ: pad.z + 8 },
    { minX: pad.x, maxX: pad.x + 8, minZ: pad.z - 8, maxZ: pad.z },
  ];
  const radius = 0.4;
  const start = { x: pad.x + radius + 0.05, z: pad.z + radius + 0.05 };
  const frames = {
    fine: repeats(FIXED_DT, 90),
    coarse: repeats(0.05, 30),
  };
  assert.equal(drain(frames.fine).steps, drain(frames.coarse).steps);
  const steps = drain(frames.fine).steps;
  const wish = WALK / Math.SQRT2;
  const leave = (count) => stepWalker(createWalker(start.x, start.z, radius), wish, wish, count, corner);
  const leftFine = leave(steps);
  const leftCoarse = leave(drain(frames.coarse).steps);
  assert.ok(Math.abs(leftFine.x - leftCoarse.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(leftFine.z - leftCoarse.z) <= POSITION_TOLERANCE_M);
  assert.ok(leftFine.x > start.x + 1, "corner exit along +x");
  assert.ok(leftFine.z > start.z + 1, "corner exit along +z");
  for (const box of corner) assert.equal(overlaps(leftFine.x, leftFine.z, radius, box), false);
  const shortCount = drain([0.05, 0.2, FIXED_DT]).steps;
  const short = leave(shortCount);
  const shortReplay = leave(shortCount);
  assert.ok(Math.abs(short.x - shortReplay.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(short.z - shortReplay.z) <= POSITION_TOLERANCE_M);
  assert.ok(short.x > start.x);
  assert.ok(short.z > start.z);
  for (const box of corner) assert.equal(overlaps(short.x, short.z, radius, box), false);
  const into = sweepCircle({
    x: start.x,
    z: start.z,
    dx: -3,
    dz: -3,
    radius,
    extra: corner,
  });
  assert.equal(into.hit, true);
  for (const box of corner) assert.equal(overlaps(into.end.x, into.end.z, radius, box), false);

  const wall = { minX: pad.x - 6, maxX: pad.x + 6, minZ: pad.z - 6, maxZ: pad.z };
  let slide = createWalker(pad.x - 1, pad.z + radius + 0.08, radius);
  const slideSteps = drain(repeats(FIXED_DT, 60)).steps;
  const slidFine = stepWalker(slide, WALK, -WALK, slideSteps, [wall]);
  const slidCoarse = stepWalker(slide, WALK, -WALK, drain(repeats(0.05, 20)).steps, [wall]);
  assert.ok(Math.abs(slidFine.x - slidCoarse.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(slidFine.z - slidCoarse.z) <= POSITION_TOLERANCE_M);
  assert.ok(slidFine.x > slide.x + 1);
  assert.ok(slidFine.z >= pad.z + radius - 0.02);
  assert.equal(overlaps(slidFine.x, slidFine.z, radius, wall), false);

  const gap = 1.1;
  const door = [
    { minX: pad.x - 6, maxX: pad.x - gap / 2, minZ: pad.z - 0.3, maxZ: pad.z + 0.3 },
    { minX: pad.x + gap / 2, maxX: pad.x + 6, minZ: pad.z - 0.3, maxZ: pad.z + 0.3 },
  ];
  const passed = sweepCircle({
    x: pad.x,
    z: pad.z - 2,
    dx: 0,
    dz: 4,
    radius: 0.4,
    extra: door,
  });
  assert.ok(passed.end.z > pad.z + 0.5);
  const blocked = sweepCircle({
    x: pad.x,
    z: pad.z - 2,
    dx: 0,
    dz: 4,
    radius: 0.7,
    extra: door,
  });
  assert.equal(blocked.hit, true);
  assert.ok(blocked.end.z < pad.z - 0.3);

  const thin = { minX: pad.x - 4, maxX: pad.x + 4, minZ: pad.z - 0.1, maxZ: pad.z + 0.1 };
  const tunneled = sweepCircle({
    x: pad.x,
    z: pad.z - 3,
    dx: 0,
    dz: 6,
    radius: 0.4,
    extra: [thin],
  });
  assert.equal(tunneled.hit, true);
  assert.ok(tunneled.end.z < thin.minZ - 0.4 + 0.02);
  assert.ok(Math.abs(tunneled.landed.y - sampleGroundElevation(tunneled.landed.x, tunneled.landed.z)) < 1e-9);

  const spawn = sweepCircle({ x: SPAWN.x, z: SPAWN.z, dx: 0, dz: 0, radius: 0.45 });
  const legacy = resolveCollision(SPAWN.x, SPAWN.z, 0.45);
  assert.ok(Math.abs(spawn.end.x - legacy.x) <= 1e-9);
  assert.ok(Math.abs(spawn.end.z - legacy.z) <= 1e-9);
});

test("kenan steps, a platform drop, and the interior exit replay across dt", () => {
  const fine = drain(repeats(FIXED_DT, 120)).steps;
  const coarse = drain(repeats(0.05, 40)).steps;
  assert.equal(fine, coarse);
  const climb = (steps) => stepWalker(createWalker(0, 70, 0.4), 0, -WALK, steps);
  const climbedFine = climb(fine);
  const climbedCoarse = climb(coarse);
  assert.ok(Math.abs(climbedFine.x - climbedCoarse.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(climbedFine.z - climbedCoarse.z) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(climbedFine.y - climbedCoarse.y) <= POSITION_TOLERANCE_M);
  assert.ok(climbedFine.y > sampleContact(0, 70).height + 0.5);
  assert.equal(climbedFine.grounded, true);
  assert.ok(Math.abs(climbedFine.y - sampleContact(climbedFine.x, climbedFine.z).height) < 1e-6);
  assert.ok(Math.abs(climbedFine.x) < 3);

  let descent = createWalker(0, 52, 0.4);
  const yOnLanding = descent.y;
  descent = stepWalker(descent, 0, WALK, fine);
  assert.equal(descent.grounded, true);
  assert.ok(descent.y < yOnLanding - KENAN_Riser());
  assert.ok(Math.abs(descent.y - sampleContact(descent.x, descent.z).height) < 1e-6);

  const pad = findOpen(0.45);
  let falling = createWalker(pad.x, pad.z, 0.45);
  const floor = falling.y;
  falling = { ...falling, y: floor + 4, grounded: false, vy: 0 };
  let lowest = falling.y;
  for (let i = 0; i < fine; i++) {
    falling = stepWalker(falling, 0, 0, 1);
    lowest = Math.min(lowest, falling.y);
    assert.ok(falling.y >= floor - 1e-6);
  }
  assert.equal(falling.grounded, true);
  assert.equal(falling.vy, 0);
  assert.ok(Math.abs(falling.y - floor) < 1e-6);
  assert.ok(lowest >= floor - 1e-6);
  const settled = stepWalker(falling, 0, 0, 15);
  assert.ok(Math.abs(settled.y - falling.y) < 1e-6);
  assert.equal(settled.vy, 0);

  const hitchSteps = drain([0.05, 0.2, FIXED_DT]).steps;
  let other = createWalker(pad.x, pad.z, 0.45);
  other = stepWalker({ ...other, y: floor + 4, grounded: false, vy: 0 }, 0, 0, hitchSteps);
  let matched = createWalker(pad.x, pad.z, 0.45);
  matched = stepWalker({ ...matched, y: floor + 4, grounded: false, vy: 0 }, 0, 0, hitchSteps);
  assert.ok(Math.abs(other.y - matched.y) <= POSITION_TOLERANCE_M);

  const radius = 0.4;
  const oracle = resolveInterior(3, 2.2 - 0.05, radius, true);
  const once = stepInterior(3, 2.2, 0, -0.05, radius);
  assert.ok(Math.abs(once.x - oracle.x) <= 1e-6);
  assert.ok(Math.abs(once.z - oracle.z) <= 1e-6);
  const exitSteps = drain(repeats(FIXED_DT, 39)).steps;
  const leftFine = integrateInterior(0, 6.2, 0, WALK, exitSteps, radius);
  const leftCoarse = integrateInterior(0, 6.2, 0, WALK, drain(repeats(0.05, 13)).steps, radius);
  assert.equal(leftFine.exited, true);
  assert.ok(leftFine.z > 7);
  assert.ok(Math.abs(leftFine.z - leftCoarse.z) <= POSITION_TOLERANCE_M);
  const held = integrateInterior(6, 6.2, 0, WALK, exitSteps, radius);
  assert.equal(held.exited, false);
  assert.ok(held.z <= 7 - radius + 1e-6);
});

test("knockback stays out of the wall and matches across dt sequences", () => {
  const pad = findOpen(0.5);
  const wall = { minX: pad.x - 0.4, maxX: pad.x + 0.4, minZ: pad.z - 4, maxZ: pad.z + 4 };
  const startX = pad.x + 2;
  const run = (frames) => {
    const steps = drain(frames).steps;
    return knockback({
      x: startX,
      z: pad.z,
      impulseX: -900,
      impulseZ: 40,
      steps,
      mass: 70,
      radius: 0.45,
      extra: [wall],
    });
  };
  const fine = run(repeats(FIXED_DT, 90));
  const coarse = run(repeats(0.05, 30));
  const hitch = run([0.05, 0.2, FIXED_DT]);
  const hitchReplay = knockback({
    x: startX,
    z: pad.z,
    impulseX: -900,
    impulseZ: 40,
    steps: drain([0.05, 0.2, FIXED_DT]).steps,
    mass: 70,
    radius: 0.45,
    extra: [wall],
  });
  assert.ok(Math.abs(fine.x - coarse.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(fine.z - coarse.z) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(hitch.x - hitchReplay.x) <= POSITION_TOLERANCE_M);
  assert.ok(Math.abs(hitch.z - hitchReplay.z) <= POSITION_TOLERANCE_M);
  assert.equal(fine.hit, true);
  assert.ok(fine.x > wall.maxX + 0.45 - 0.02);
  assert.equal(overlaps(fine.x, fine.z, 0.45, wall), false);

  const light = knockback({
    x: pad.x,
    z: pad.z + 6,
    impulseX: 80,
    impulseZ: 0,
    steps: 40,
    mass: 10,
    radius: 0.3,
  });
  const heavy = knockback({
    x: pad.x,
    z: pad.z + 6,
    impulseX: 80,
    impulseZ: 0,
    steps: 40,
    mass: 80,
    radius: 0.3,
  });
  assert.ok(light.x - pad.x > heavy.x - pad.x);
});

test("same-frame hits keep order, and a dodge does not spend life", () => {
  const signals = resolveHitSignals([
    { targetId: "enemy-b", amount: 9, priority: 1 },
    { targetId: "fac-2", amount: 4, priority: 2, iframe: true },
    { targetId: "enemy-a", amount: 8, priority: 1 },
    { targetId: "fac-1", amount: 3, priority: 2 },
    { targetId: "enemy-c", amount: 5, priority: 1, blocked: true },
  ]);
  assert.deepEqual(
    signals.map((signal) => [signal.order, signal.kind, signal.targetId, signal.amount]),
    [
      [0, "hit", "enemy-a", 8],
      [1, "hit", "enemy-b", 9],
      [2, "blocked", "enemy-c", 0],
      [3, "hit", "fac-1", 3],
      [4, "dodge-iframe", "fac-2", 0],
    ],
  );
  const ledger = createHitLedger();
  const first = ledger.apply(1, { "enemy-a": 40, "enemy-b": 40, "fac-1": 20, "fac-2": 20 }, signals);
  assert.equal(first.hp["enemy-a"], 32);
  assert.equal(first.hp["enemy-b"], 31);
  assert.equal(first.hp["fac-1"], 17);
  assert.equal(first.hp["fac-2"], 20);
  assert.equal(first.applied, 20);
  const again = ledger.apply(1, first.hp, signals);
  assert.equal(again.applied, 0);
  assert.deepEqual(again.hp, first.hp);

  const clock = createSimClock();
  let damage = 0;
  damage += clock.step(FIXED_DT) > 0 ? 0 : 0;
  const batch = resolveHitSignals([
    { targetId: "enemy-a", amount: 2 },
    { targetId: "enemy-b", amount: 2 },
  ]);
  const frame = createHitLedger();
  const hit = frame.apply(clock.step(0.05) > 0 ? 1 : 0, { "enemy-a": 10, "enemy-b": 10 }, batch);
  clock.pause();
  clock.step(1.5);
  clock.resume();
  const afterPause = frame.apply(2, hit.hp, batch);
  assert.equal(hit.applied, 4);
  assert.equal(afterPause.applied, 4);
  assert.equal(afterPause.hp["enemy-a"], 6);
});

test("camera clearance stays outside and approaches smoothly", () => {
  const pad = findOpen(0.4);
  const block = { minX: pad.x - 1, maxX: pad.x + 1, minZ: pad.z - 1, maxZ: pad.z + 1 };
  const focus = { x: pad.x + 3, y: 2, z: pad.z };
  const desired = { x: pad.x, y: 2, z: pad.z };
  const clear = cameraClearance({
    focus,
    desired,
    radius: 0.35,
    extra: [block],
    blend: 1,
  });
  assert.equal(overlaps(clear.x, clear.z, 0.35, block), false);
  let previous = { x: pad.x + 6, y: 3, z: pad.z };
  let gap = Math.hypot(previous.x - clear.x, previous.z - clear.z);
  for (let i = 0; i < 12; i++) {
    const next = cameraClearance({
      focus,
      desired,
      previous,
      radius: 0.35,
      extra: [block],
      blend: 0.35,
    });
    assert.equal(overlaps(next.x, next.z, 0.35, block), false);
    const nextGap = Math.hypot(next.x - clear.x, next.z - clear.z);
    assert.ok(nextGap <= gap + 1e-4);
    gap = nextGap;
    previous = next;
  }
  assert.ok(gap < 0.2);
  assert.ok(previous.x > block.maxX + 0.35 - 0.05);
  assert.ok(previous.y >= sampleGroundElevation(previous.x, previous.z) + 0.4 - 1e-6);
});

test("crates and barriers push, sleep, and drop once", () => {
  const pad = findOpen(1);
  const barrier = createProp("barrier", "barrier-1", pad.x + 2, pad.z);
  const crate = {
    ...createProp("crate", "crate-1", pad.x, pad.z),
    vx: 2.4,
    awake: true,
    sleeping: false,
  };
  assert.equal(barrier.mobility, "fixed");
  assert.equal(crate.mobility, "movable");
  const pushed = stepDynamics([crate, barrier], 60);
  const moved = pushed.bodies.find((body) => body.id === "crate-1");
  const still = pushed.bodies.find((body) => body.id === "barrier-1");
  assert.equal(still.x, barrier.x);
  assert.equal(still.z, barrier.z);
  assert.ok(moved.x + moved.radius <= still.x - still.radius + 0.05);
  assert.equal(moved.sleeping, true);
  assert.ok(still.durability < still.maxDurability);
  assert.equal(pushed.drops.length, 0);

  const fragile = {
    ...createProp("crate", "crate-break", pad.x, pad.z + 4),
    durability: 1,
    vx: 3,
    awake: true,
    sleeping: false,
  };
  const block = createProp("barrier", "barrier-break", pad.x + 1.05, pad.z + 4);
  const broken = stepDynamics([fragile, block], 5);
  assert.equal(broken.drops.length, 1);
  assert.equal(broken.drops[0].id, "crate-break");
  const again = stepDynamics(broken.bodies, 8);
  assert.equal(again.drops.length, 0);
  assert.equal(again.bodies.find((body) => body.id === "crate-break").dropSettled, true);

  const ledger = new Set();
  const once = applyImpulse(createProp("crate", "c", pad.x, pad.z), 30, 0, "hit-1", ledger);
  const twice = applyImpulse(once.body, 30, 0, "hit-1", ledger);
  assert.equal(twice.damaged, false);
  assert.equal(twice.body.vx, once.body.vx);
  assert.equal(twice.body.durability, once.body.durability);
  const rested = stepDynamics([{ ...twice.body, durability: 0 }], 1);
  assert.equal(rested.drops.length, 1);
  assert.equal(stepDynamics(rested.bodies, 2).drops.length, 0);
});

function KENAN_Riser() {
  return 0.162;
}
