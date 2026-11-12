import assert from "node:assert/strict";
import test, { beforeEach, after } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const savedData = new Map();
globalThis.localStorage = {
  getItem: (k) => savedData.get(k) ?? null,
  setItem: (k, v) => savedData.set(k, String(v)),
  removeItem: (k) => savedData.delete(k),
};
const handlers = {};
const documentHandlers = {};
globalThis.document = {
  hidden: false,
  pointerLockElement: null,
  addEventListener(name, fn) {
    documentHandlers[name] = fn;
  },
  removeEventListener() {},
};
globalThis.window = { addEventListener(name,fn) {handlers[name]=fn;}, removeEventListener() {}, location: { search: "" } };
const r = await import("../work/test-runtime/runtime.mjs");
const {
  useRpg,
  useGame,
  inventory,
  DEPARTMENTS,
  DISCIPLINES,
  ENCOUNTERS,
  ENEMY_TYPES,
  RECIPES,
  CAMPUS_SITES,
  SUPPLY_NODES,
  siteEntrance,
  validatePlacement,
  resolveBuildings,
  withinAttack,
  tickRpg,
  flushSave,
  RPG_SAVE_KEY,
  playMode,
  PLAY_MODES,
  TRANSITIONS,
  rpgInput,
  pilgrimageInput,
  SPAWN,
  openDialog,
  cycleDialogFocus,
  filterDepartments,
  dialogDepth,
  closeVictory,
  victoryPauseMenuOpen,
  WALK,
  SPRINT,
  moveTargetSpeed,
  STICK_RADIUS,
  touchLayout,
  doorOverlap,
  footprint,
  ITEMS,
  MISSIONS,
  BASIC_ATTACK_RANGE,
} = r;
const onVisibility = documentHandlers.visibilitychange;
const onStorage = handlers.storage;
const initial = { ...useRpg.getState() };
beforeEach(() => {
  flushSave();
  useRpg.setState({
    ...initial,
    departmentId: DEPARTMENTS[0].id,
    hp: 100,
    focus: 100,
    xp: 0,
    clock: 10,
    skillRank: 1,
    equipped: false,
    claimed: [],
    discoveries: [],
    kills: 0,
    boss: 0,
    built: 0,
    panel: null,
    interiorId: null,
    buildKind: null,
    buildings: [],
    loot: [],
    harvested: {},
    attackUntil: 0,
    skillUntil: 0,
    enemies: ENCOUNTERS.map((e) => ({
      ...e,
      anchorX: e.x,
      anchorZ: e.z,
      hp: ENEMY_TYPES[e.kind].hp,
      state: "idle",
      timer: 0,
      hurt: 0,
    })),
  });
  inventory.clear();
  for (const [id, n] of [
    ["notes", 60],
    ["parts", 60],
    ["credit", 10],
    ["coffee", 3],
    ["tea", 3],
  ])
    inventory.add(id, n);
  useGame.setState({
    phase: "playing",
    plaqueId: null,
    benchmarkId: null,
    playerX: -5,
    playerZ: -45,
    playerYaw: 0,
  });
});
after(() => flushSave());
test("quick key taps remain queued until a simulation frame consumes them", () => {
  const input = new r.InputManager(); input.attach();
  for(const [code,action] of [["KeyE","interact"],["Escape","pause"],["Space","dodge"]]){
    handlers.keydown({code,repeat:false,target:{tagName:"DIV"},preventDefault(){}});
    handlers.keyup({code});
    assert.equal(input.sample()[action],true,code+" tap lost before frame");
    assert.equal(input.sample()[action],false,code+" repeats without a new press");
  }
});
test("real inventory library stacks, limits capacity, reports overflow without negative counts", () => {
  inventory.clear();
  const result = inventory.add("notes", 99 * 24 + 5);
  assert.equal(inventory.slots().length, 24);
  assert.equal(result.overflow, 5);
  assert.equal(inventory.count("notes"), 99 * 24);
  assert.equal(inventory.remove("notes", 99 * 24 + 1), false);
});
test("full health and focus preserve consumables; healing respects maximum", () => {
  useRpg.getState().useItem("coffee");
  assert.equal(inventory.count("coffee"), 3);
  useRpg.setState({ hp: 60 });
  useRpg.getState().useItem("coffee");
  assert.equal(useRpg.getState().hp, 100);
  assert.equal(inventory.count("coffee"), 2);
  useRpg.getState().useItem("tea");
  assert.equal(inventory.count("tea"), 3);
});
test("each department discipline has an active skill that damages, consumes focus and enforces cooldown", () => {
  for (const discipline of Object.keys(DISCIPLINES)) {
    const dept = DEPARTMENTS.find((d) => d.discipline === discipline),
      s = useRpg.getState(),
      enemy = s.enemies[0];
    enemy.hp = 1000;
    enemy.x = -5;
    enemy.z = -48;
    enemy.state = "idle";
    useRpg.setState({
      departmentId: dept.id,
      skillUntil: 0,
      attackUntil: 0,
      focus: 100,
    });
    useRpg.getState().attack(true);
    assert.ok(enemy.hp < 1000, discipline);
    assert.ok(useRpg.getState().focus < 100, discipline);
    const hp = enemy.hp;
    useRpg.getState().attack(true);
    assert.equal(enemy.hp, hp, "cooldown blocks repeated skill");
  }
});
test("combat has facing, range, death, XP and recoverable loot", () => {
  const enemy = useRpg.getState().enemies[0];
  enemy.hp = 1;
  useGame.setState({ playerYaw: Math.PI });
  useRpg.getState().attack();
  assert.equal(enemy.hp, 1, "wrong-facing attack misses");
  useRpg.setState({ attackUntil: 0 });
  useGame.setState({ playerYaw: 0 });
  useRpg.getState().attack();
  assert.equal(enemy.hp, 0);
  assert.equal(useRpg.getState().kills, 1);
  assert.ok(useRpg.getState().xp > 0);
  useGame.setState({ playerZ: enemy.z });
  assert.equal(useRpg.getState().interact(), true);
  assert.equal(useRpg.getState().loot.length, 0);
});
test("enemy telegraph permits dodge; a hit can defeat and respawn preserves inventory", () => {
  const s = useRpg.getState(),
    enemy = s.enemies[0];
  enemy.x = -5;
  enemy.z = -46;
  enemy.state = "windup";
  enemy.timer = 0.01;
  assert.equal(s.dodge(), true);
  tickRpg(0.06);
  assert.equal(useRpg.getState().hp, 100, "dodge prevents hit");
  useRpg.setState({ clock: 20, invulnerableUntil: 0, hp: 1 });
  enemy.state = "windup";
  enemy.timer = 0.01;
  tickRpg(0.06);
  assert.equal(useRpg.getState().hp, 0);
  const items = inventory.count("notes");
  useRpg.getState().respawn();
  assert.equal(useRpg.getState().hp, 100);
  assert.equal(inventory.count("notes"), items);
});
test("construction validates before atomic cost deduction, supports rotation, collision and refund", () => {
  useGame.setState({ playerX: 45, playerZ: -20 });
  useRpg.getState().chooseBuild("desk");
  const before = inventory.count("parts");
  assert.equal(useRpg.getState().place(0, 40), false);
  assert.equal(inventory.count("parts"), before);
  assert.equal(useRpg.getState().place(45, -32), true);
  assert.equal(inventory.count("parts"), before - 4);
  assert.equal(useRpg.getState().place(45, -32), false);
  assert.equal(inventory.count("parts"), before - 4);
  const b = useRpg.getState().buildings[0],
    p = resolveBuildings(b.x, b.z, 0.42, [b]);
  assert.ok(Math.hypot(p.x - b.x, p.z - b.z) > 0.5);
  useRpg.getState().demolish(b.id);
  assert.equal(useRpg.getState().buildings.length, 0);
  assert.equal(inventory.count("parts"), before - 2);
});
test("building recipes have usable effects: study desk restores, turret damages, lantern slows enemies", () => {
  const enemy = useRpg.getState().enemies[0];
  enemy.x = 45;
  enemy.z = -32;
  enemy.anchorX = 45;
  enemy.anchorZ = -32;
  enemy.hp = 1000;
  useGame.setState({ playerX: 45, playerZ: -20 });
  useRpg.setState({
    hp: 40,
    buildings: [
      { id: "desk", kind: "desk", x: 45, z: -22, rotation: 0, hp: 180 },
      { id: "turret", kind: "turret", x: 50, z: -30, rotation: 0, hp: 160 },
    ],
  });
  for (let i = 0; i < 25; i++) tickRpg(0.06);
  assert.ok(useRpg.getState().hp > 40);
  assert.ok(enemy.hp < 1000);
});
test("missions require progress and can only pay rewards once", () => {
  const before = inventory.count("parts");
  useRpg.getState().claim("first");
  assert.equal(inventory.count("parts"), before);
  useRpg.setState({ kills: 3 });
  useRpg.getState().claim("first");
  const after = inventory.count("parts");
  assert.equal(after, before + 8);
  useRpg.getState().claim("first");
  assert.equal(inventory.count("parts"), after);
});
test("every campus building entrance is outside colliders and supports entering, floors and exiting", () => {
  for (const site of CAMPUS_SITES) {
    const d = siteEntrance(site),
      p = resolveBuildings(d.x, d.z, 0.42, []);
    assert.ok(
      Math.hypot(p.x - d.x, p.z - d.z) < 0.1,
      site.name + " entrance blocked",
    );
    useRpg.getState().travel(site.id);
    useRpg.getState().enter(site.id);
    if (site.form === "court") {
      assert.equal(useRpg.getState().interiorId, null);
      continue;
    }
    assert.equal(useRpg.getState().interiorId, site.id);
    useRpg.getState().changeFloor(1);
    assert.equal(useRpg.getState().floor, Math.min(2, site.floors));
    useRpg.getState().exit();
    assert.equal(useRpg.getState().interiorId, null);
  }
});
test("supply collection has a persistent cooldown and cannot be farmed by repeated interaction", () => {
  const n = SUPPLY_NODES[0];
  useGame.setState({ playerX: n.x, playerZ: n.z });
  const before = inventory.count("parts");
  assert.equal(useRpg.getState().interact(), true);
  const after = inventory.count("parts");
  assert.ok(after > before);
  useRpg.getState().interact();
  assert.equal(inventory.count("parts"), after);
  flushSave();
  assert.ok(
    JSON.parse(savedData.get(RPG_SAVE_KEY)).harvested[n.id] > Date.now(),
  );
});
test("importing a distant v2 save keeps that point across the page-leave flush", () => {
  assert.equal(RPG_SAVE_KEY, "tamkang-rpg-v2");
  assert.equal(handlers.pagehide, flushSave);
  const here = { x: -5, z: -45, yaw: 0 };
  const stand = (point) => {
    useRpg.setState({ interiorId: null, buildings: [] });
    useGame.setState({
      phase: "playing",
      playerX: point.x,
      playerZ: point.z,
      playerYaw: point.yaw,
      warp: null,
    });
    flushSave();
    return savedData.get(RPG_SAVE_KEY);
  };
  const unchanged = (point, buildings = []) => {
    const p = resolveBuildings(point.x, point.z, 0.42, buildings);
    return Math.hypot(p.x - point.x, p.z - point.z) < 1e-6;
  };
  const away = CAMPUS_SITES.find((site) => {
    const door = siteEntrance(site);
    return (
      unchanged(door) && Math.hypot(door.x - here.x, door.z - here.z) > 20
    );
  });
  assert.ok(away, "need a walkable point the resolver does not move");
  const door = siteEntrance(away);
  const there = { x: door.x, z: door.z, yaw: 1.25 };
  const agree = (point) => {
    const stored = JSON.parse(savedData.get(RPG_SAVE_KEY)).position;
    const live = useGame.getState();
    const checkpoint = useRpg.getState().checkpoint;
    assert.deepEqual(stored, point);
    assert.equal(live.playerX, point.x);
    assert.equal(live.playerZ, point.z);
    assert.equal(live.playerYaw, point.yaw);
    assert.deepEqual(live.warp, point);
    assert.deepEqual(checkpoint, point);
    assert.equal(useRpg.getState().interiorId, null);
  };
  const text = stand(there);
  useGame.setState({
    phase: "playing",
    playerX: here.x,
    playerZ: here.z,
    playerYaw: here.yaw,
    warp: { ...here },
  });
  useRpg.setState({ checkpoint: { ...here }, interiorId: null });
  assert.equal(useRpg.getState().importSave(text), true);
  handlers.pagehide();
  agree(there);
  const kept = savedData.get(RPG_SAVE_KEY);
  useGame.setState({ playerX: 4, playerZ: 4, playerYaw: 0, warp: null });
  assert.equal(useRpg.getState().importSave(kept), true);
  agree(there);
  assert.equal(useRpg.getState().departmentId, DEPARTMENTS[0].id);
  assert.ok(inventory.count("parts") > 0);

  useGame.setState({
    phase: "title",
    playerX: here.x,
    playerZ: here.z,
    playerYaw: here.yaw,
    warp: null,
    snapCam: false,
  });
  useRpg.setState({ checkpoint: { ...here } });
  assert.equal(useRpg.getState().importSave(text), true);
  handlers.pagehide();
  agree(there);
  useRpg.getState().continueGame();
  assert.equal(useGame.getState().phase, "playing");
  agree(there);

  const indoor = CAMPUS_SITES.find(
    (site) => site.form !== "court" && site.id !== away.id,
  );
  assert.ok(indoor);
  const entrance = siteEntrance(indoor);
  assert.ok(unchanged(entrance));
  assert.ok(Math.hypot(entrance.x - here.x, entrance.z - here.z) > 5);
  useRpg.setState({ interiorId: indoor.id, floor: 2, buildings: [] });
  useGame.setState({
    phase: "playing",
    playerX: 0,
    playerZ: 4,
    playerYaw: 0.2,
    warp: { x: 0, z: 4, yaw: 0.2 },
  });
  document.createElement = () => ({ click() {}, href: "", download: "" });
  URL.createObjectURL = () => "blob:tamkang-save";
  URL.revokeObjectURL = () => {};
  useRpg.getState().exportSave();
  const exported = JSON.parse(savedData.get(RPG_SAVE_KEY));
  assert.deepEqual(exported.position, {
    x: entrance.x,
    z: entrance.z,
    yaw: Math.PI,
  });
  useRpg.setState({ interiorId: null });
  useGame.setState({
    playerX: here.x,
    playerZ: here.z,
    playerYaw: here.yaw,
    warp: { ...here },
  });
  assert.equal(
    useRpg.getState().importSave(savedData.get(RPG_SAVE_KEY)),
    true,
  );
  handlers.pagehide();
  agree({ x: entrance.x, z: entrance.z, yaw: Math.PI });

  const base = JSON.parse(stand(there));
  delete base.position;
  const skeleton = JSON.stringify(base);
  const landInvalid = (position) => {
    useGame.setState({
      phase: "playing",
      playerX: here.x,
      playerZ: here.z,
      playerYaw: here.yaw,
      warp: { ...here },
    });
    useRpg.setState({ checkpoint: { ...here }, interiorId: null, buildings: [] });
    assert.equal(
      useRpg.getState().importSave(
        skeleton.replace(/}$/, `,"position":${position}}`),
      ),
      true,
    );
    handlers.pagehide();
  };
  landInvalid('{"x":1e309,"z":0,"yaw":4}');
  const fallback = JSON.parse(savedData.get(RPG_SAVE_KEY)).position;
  assert.ok(Math.hypot(fallback.x - here.x, fallback.z - here.z) > 5);
  assert.ok(unchanged(fallback, useRpg.getState().buildings));
  agree(fallback);
  const fallbackText = savedData.get(RPG_SAVE_KEY);
  landInvalid('{"x":9000,"z":-9000,"yaw":2}');
  agree(fallback);
  useGame.setState({ playerX: here.x, playerZ: here.z, playerYaw: 0, warp: null });
  assert.equal(useRpg.getState().importSave(fallbackText), true);
  agree(fallback);

  const good = savedData.get(RPG_SAVE_KEY);
  const goodX = useGame.getState().playerX;
  assert.equal(useRpg.getState().importSave("{invalid"), false);
  assert.equal(savedData.get(RPG_SAVE_KEY), good);
  assert.equal(useGame.getState().playerX, goodX);
  assert.equal(useRpg.getState().departmentId, DEPARTMENTS[0].id);
});
test("save round trip restores department, skill, items, structures and rejects malformed data", () => {
  useRpg.setState({ xp: 300, skillRank: 2, hp: 70 });
  flushSave();
  const text = savedData.get(RPG_SAVE_KEY);
  useRpg.setState({ xp: 0, skillRank: 1 });
  inventory.clear();
  assert.equal(useRpg.getState().importSave(text), true);
  assert.equal(useRpg.getState().xp, 300);
  assert.equal(useRpg.getState().skillRank, 2);
  assert.ok(inventory.count("parts") > 0);
  assert.equal(useRpg.getState().importSave("{invalid"), false);
  assert.equal(useRpg.getState().xp, 300);
});
test("campus registry covers all 40 official architecture numbers and entry walks avoid buildings", () => {
  const numbers = new Set(CAMPUS_SITES.map((s) => s.mapNumber));
  for (let i = 1; i <= 40; i++)
    assert.ok(numbers.has(i), "missing official map location " + i);
  const { findWalkablePath, clearSegment } = r;
  for (const site of CAMPUS_SITES) {
    const start = siteEntrance(site);
    const x = [61, 195, 331, 390, 490, -95].sort(
      (a, b) => Math.abs(a - start.x) - Math.abs(b - start.x),
    )[0];
    const path = findWalkablePath(start, { x, z: start.z }, 1.1);
    assert.ok(path.length >= 2, site.name + " has no connecting walk");
    for (let j = 1; j < path.length; j++)
      assert.ok(
        clearSegment(
          path[j - 1][0],
          path[j - 1][1],
          path[j][0],
          path[j][1],
          1.1,
        ),
        site.name + " path crosses a building",
      );
  }
});
test("validated import applies one snapshot and leaves the previous save untouched on rejection", () => {
  const hud = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/game/rpg/AdventureHud.tsx"),
    "utf8",
  );
  assert.match(hud, /匯入存檔/);
  assert.match(hud, /type="file"/);
  assert.match(hud, /importSave\(/);
  assert.match(hud, /input\.value = ""/);
  assert.equal(RPG_SAVE_KEY, "tamkang-rpg-v2");

  flushSave();
  const capture = () => {
    const rpg = useRpg.getState();
    const game = useGame.getState();
    return {
      slots: JSON.stringify(inventory.slots()),
      departmentId: rpg.departmentId,
      buildings: JSON.stringify(rpg.buildings),
      claimed: JSON.stringify(rpg.claimed),
      stored: savedData.get(RPG_SAVE_KEY) ?? null,
      hp: rpg.hp,
      xp: rpg.xp,
      playerX: game.playerX,
      playerZ: game.playerZ,
      playerYaw: game.playerYaw,
      visited: JSON.stringify(game.visited),
      timeOfDay: game.timeOfDay,
      muted: game.muted,
    };
  };
  const same = (before, after) => {
    assert.deepEqual(after, before);
  };
  const reject = (text, reason) => {
    const before = capture();
    assert.equal(useRpg.getState().importSave(text), false);
    assert.match(useRpg.getState().notice, reason);
    same(before, capture());
  };
  const department = (name) => {
    const found = DEPARTMENTS.find((item) => item.name === name);
    assert.ok(found, name);
    return found.id;
  };
  const findPad = (kind, existing) => {
    for (let x = 30; x <= 160; x += 7)
      for (const z of [-18, -25, -36, -48, -62, -78])
        if (validatePlacement(kind, x, z, 0, existing) == null) return { x, z };
    assert.fail("no open ground for " + kind);
  };
  const placed = (id, kind, at, hp) => ({
    id,
    kind,
    x: at.x,
    z: at.z,
    rotation: 0,
    hp,
  });

  reject("{invalid", /存檔不是有效的 JSON/);
  reject(
    JSON.stringify({ version: 2, hp: -1, slots: [], buildings: [] }),
    /數值或物品數量為負/,
  );
  reject(
    JSON.stringify({
      version: 2,
      hp: 40,
      slots: [{ itemId: "notes", quantity: -3 }],
      buildings: [],
    }),
    /數值或物品數量為負/,
  );
  reject(
    JSON.stringify({
      version: 2,
      hp: 40,
      slots: [],
      buildings: [{ id: "hurt", kind: "desk", x: 45, z: -25, rotation: 0, hp: -5 }],
    }),
    /數值或物品數量為負/,
  );
  reject("x".repeat(1_000_001), /存檔超過大小上限/);
  reject(
    JSON.stringify({
      version: 2,
      hp: 40,
      slots: Array.from({ length: 37 }, () => ({ itemId: "notes", quantity: 1 })),
      buildings: [],
    }),
    /物品槽超過背包容量/,
  );
  reject(
    JSON.stringify({
      version: 2,
      hp: 40,
      slots: [],
      buildings: Array.from({ length: 49 }, (_, index) => ({
        id: "b" + index,
        kind: "desk",
        x: 45,
        z: -25,
        rotation: 0,
        hp: 10,
      })),
    }),
    /建築數量超過上限/,
  );
  reject(
    JSON.stringify({ version: 9, hp: 40, slots: [], buildings: [] }),
    /無法辨識此存檔版本/,
  );
  reject(
    JSON.stringify({
      version: 1,
      departmentId: "math",
      inventory: [{ id: "pen", count: -2 }],
      buildings: [],
    }),
    /數值或物品數量為負/,
  );

  const storage = globalThis.localStorage;
  const originalSetItem = storage.setItem;
  storage.setItem = (key, value) => {
    if (key === RPG_SAVE_KEY) throw new Error("quota");
    return originalSetItem.call(storage, key, value);
  };
  try {
    const before = capture();
    assert.equal(
      useRpg.getState().importSave(
        JSON.stringify({
          version: 2,
          hp: 40,
          xp: 80,
          departmentId: department("化學學系"),
          claimed: ["first"],
          slots: [{ itemId: "badge", quantity: 1 }],
          buildings: [],
          position: { x: 80, z: -30, yaw: 0.5 },
        }),
      ),
      false,
    );
    assert.match(useRpg.getState().notice, /無法寫入儲存空間/);
    same(before, capture());
  } finally {
    storage.setItem = originalSetItem;
  }

  const deskAt = findPad("desk", []);
  const desk = placed("imported-desk", "desk", deskAt, 180);
  const away = CAMPUS_SITES.find((site) => {
    const door = siteEntrance(site);
    const resolved = resolveBuildings(door.x, door.z, 0.42, [desk]);
    return (
      Math.hypot(resolved.x - door.x, resolved.z - door.z) < 1e-6 &&
      Math.hypot(door.x + 5, door.z + 45) > 20
    );
  });
  assert.ok(away, "need a walkable stand away from the current player");
  const door = siteEntrance(away);
  const supply = SUPPLY_NODES[0];
  const stale = SUPPLY_NODES[1];
  const distantHarvest = SUPPLY_NODES[2];
  assert.ok(supply && stale && distantHarvest);
  const freshHarvest = Date.now() + 60_000;
  const full = {
    version: 2,
    departmentId: department("化學學系"),
    xp: 120,
    hp: 90,
    focus: 40,
    equipped: true,
    skillRank: 3,
    kills: 4,
    built: 2,
    boss: 0,
    clock: 25,
    discoveries: [CAMPUS_SITES[0].id, "not-a-site"],
    claimed: ["first", "not-a-quest"],
    buildings: [desk],
    slots: [
      { itemId: "notes", quantity: 4 },
      { itemId: "coffee", quantity: 50 },
      { itemId: "unknown-relic", quantity: 3 },
    ],
    harvested: {
      [supply.id]: freshHarvest,
      [stale.id]: -5,
      [distantHarvest.id]: Date.now() + 999_999,
    },
    position: { x: door.x, z: door.z, yaw: 1.25 },
    pilgrimage: { visited: ["kenan"], timeOfDay: "day", muted: false },
  };
  assert.equal(useRpg.getState().importSave(JSON.stringify(full)), true);
  assert.match(useRpg.getState().notice, /存檔已匯入/);
  const rpg = useRpg.getState();
  const live = useGame.getState();
  assert.equal(rpg.departmentId, department("化學學系"));
  assert.equal(rpg.xp, 120);
  assert.equal(rpg.hp, 90);
  assert.equal(rpg.focus, 40);
  assert.equal(rpg.equipped, false);
  assert.equal(rpg.skillRank, 3);
  assert.equal(rpg.kills, 4);
  assert.equal(rpg.built, 2);
  assert.equal(rpg.boss, 0);
  assert.equal(rpg.clock, 25);
  assert.deepEqual(rpg.discoveries, [CAMPUS_SITES[0].id]);
  assert.deepEqual(rpg.claimed, ["first"]);
  assert.equal(rpg.buildings.length, 1);
  assert.equal(rpg.buildings[0].kind, "desk");
  assert.equal(rpg.buildings[0].id, "imported-desk");
  assert.equal(inventory.count("notes"), 4);
  assert.equal(inventory.count("coffee"), 20);
  assert.equal(
    inventory.slots().some((slot) => slot.itemId === "unknown-relic"),
    false,
  );
  assert.equal(rpg.harvested[supply.id], freshHarvest);
  assert.equal(rpg.harvested[stale.id], undefined);
  assert.equal(rpg.harvested[distantHarvest.id], undefined);
  assert.equal(live.playerX, door.x);
  assert.equal(live.playerZ, door.z);
  assert.equal(live.playerYaw, 1.25);
  assert.deepEqual(live.warp, { x: door.x, z: door.z, yaw: 1.25 });
  assert.deepEqual(rpg.checkpoint, live.warp);
  assert.deepEqual(live.visited, ["kenan"]);
  assert.equal(live.timeOfDay, "day");
  assert.equal(live.muted, false);
  const written = savedData.get(RPG_SAVE_KEY);
  const parsed = JSON.parse(written);
  assert.equal(parsed.version, 2);
  assert.equal(parsed.departmentId, rpg.departmentId);
  assert.deepEqual(parsed.claimed, rpg.claimed);
  assert.deepEqual(parsed.slots, inventory.slots());
  assert.deepEqual(parsed.buildings, rpg.buildings);
  assert.deepEqual(parsed.position, { x: door.x, z: door.z, yaw: 1.25 });
  assert.equal(parsed.harvested[supply.id], freshHarvest);
  assert.equal(parsed.harvested[stale.id], undefined);
  useRpg.setState({
    departmentId: DEPARTMENTS[0].id,
    claimed: [],
    buildings: [],
    xp: 1,
    hp: 5,
    discoveries: [],
  });
  inventory.clear();
  inventory.add("tea", 2);
  useGame.setState({ playerX: 0, playerZ: 0, playerYaw: 0, warp: null });
  assert.equal(useRpg.getState().importSave(written), true);
  assert.equal(useRpg.getState().departmentId, department("化學學系"));
  assert.deepEqual(useRpg.getState().claimed, ["first"]);
  assert.deepEqual(inventory.slots(), parsed.slots);
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(useGame.getState().playerX, door.x);
  assert.equal(useGame.getState().playerZ, door.z);
  assert.equal(useRpg.getState().hp, 90);

  const visitedBefore = [...useGame.getState().visited];
  const mutedBefore = useGame.getState().muted;
  const timeBefore = useGame.getState().timeOfDay;
  assert.equal(
    useRpg.getState().importSave(
      JSON.stringify({ version: 2, hp: 80, slots: [], buildings: [] }),
    ),
    true,
  );
  assert.match(useRpg.getState().notice, /存檔已匯入/);
  const sparse = useRpg.getState();
  assert.equal(sparse.departmentId, null);
  assert.equal(sparse.xp, 0);
  assert.equal(sparse.focus, 100);
  assert.equal(sparse.skillRank, 1);
  assert.equal(sparse.kills, 0);
  assert.equal(sparse.built, 0);
  assert.equal(sparse.boss, 0);
  assert.equal(sparse.clock, 0);
  assert.equal(sparse.equipped, false);
  assert.equal(sparse.hp, 80);
  assert.deepEqual(sparse.claimed, []);
  assert.deepEqual(sparse.discoveries, []);
  assert.deepEqual(sparse.buildings, []);
  assert.deepEqual(sparse.loot, []);
  assert.deepEqual(sparse.harvested, {});
  assert.deepEqual(inventory.slots(), []);
  assert.deepEqual(useGame.getState().visited, visitedBefore);
  assert.equal(useGame.getState().muted, mutedBefore);
  assert.equal(useGame.getState().timeOfDay, timeBefore);
  const stand = sparse.checkpoint;
  assert.ok(stand);
  assert.equal(useGame.getState().playerX, stand.x);
  assert.equal(useGame.getState().playerZ, stand.z);
  assert.equal(useGame.getState().playerYaw, stand.yaw);
  assert.deepEqual(useGame.getState().warp, stand);
  const sparseText = savedData.get(RPG_SAVE_KEY);
  const sparseSaved = JSON.parse(sparseText);
  assert.equal(sparseSaved.version, 2);
  assert.equal(sparseSaved.hp, 80);
  assert.equal(sparseSaved.departmentId, null);
  assert.equal(sparseSaved.xp, 0);
  assert.equal(sparseSaved.focus, 100);
  assert.equal(sparseSaved.skillRank, 1);
  assert.deepEqual(sparseSaved.slots, []);
  assert.deepEqual(sparseSaved.buildings, []);
  assert.deepEqual(sparseSaved.claimed, []);
  assert.deepEqual(sparseSaved.position, stand);
  useRpg.setState({
    departmentId: DEPARTMENTS[0].id,
    hp: 5,
    xp: 20,
    skillRank: 4,
    focus: 10,
  });
  inventory.add("notes", 3);
  useGame.setState({ playerX: 3, playerZ: 3, playerYaw: 1, warp: null });
  assert.equal(useRpg.getState().importSave(sparseText), true);
  assert.equal(useRpg.getState().hp, 80);
  assert.equal(useRpg.getState().departmentId, null);
  assert.equal(useRpg.getState().skillRank, 1);
  assert.deepEqual(inventory.slots(), []);
  assert.deepEqual(useRpg.getState().checkpoint, stand);
  assert.equal(useGame.getState().playerX, stand.x);

  const fallback = (position) => {
    const body = JSON.stringify({ version: 2, hp: 80, slots: [], buildings: [] });
    assert.equal(
      useRpg.getState().importSave(body.replace(/}$/, `,"position":${position}}`)),
      true,
    );
    assert.match(useRpg.getState().notice, /存檔已匯入/);
    assert.deepEqual(useRpg.getState().checkpoint, stand);
    assert.equal(useGame.getState().playerX, stand.x);
    assert.equal(useGame.getState().playerZ, stand.z);
  };
  fallback('{"x":1e309,"z":0,"yaw":4}');
  fallback('{"x":9000,"z":-9000,"yaw":2}');

  const west = CAMPUS_SITES.find((site) => {
    const entry = siteEntrance(site);
    if (entry.x >= 0 && entry.z >= 0) return false;
    const resolved = resolveBuildings(entry.x, entry.z, 0.42, []);
    return Math.hypot(resolved.x - entry.x, resolved.z - entry.z) < 1e-6;
  });
  assert.ok(west, "need a walkable negative coordinate");
  const westDoor = siteEntrance(west);
  assert.equal(
    useRpg.getState().importSave(
      JSON.stringify({
        version: 2,
        hp: 70,
        slots: [],
        buildings: [],
        position: { x: westDoor.x, z: westDoor.z, yaw: 0.4 },
      }),
    ),
    true,
  );
  assert.match(useRpg.getState().notice, /存檔已匯入/);
  assert.equal(useGame.getState().playerX, westDoor.x);
  assert.equal(useGame.getState().playerZ, westDoor.z);
  assert.ok(westDoor.x < 0 || westDoor.z < 0);

  const lampAt = findPad("lantern", []);
  const lamp = placed("legacy-lamp", "lantern", lampAt, 120);
  const bannerAt = findPad("barrier", [lamp]);
  const banner = placed("legacy-banner", "barrier", bannerAt, 120);
  const boothAt = findPad("desk", [lamp, banner]);
  assert.equal(
    useRpg.getState().importSave(
      JSON.stringify({
        version: 1,
        visited: ["kenan", "statue", "not-a-landmark"],
        timeOfDay: "night",
        muted: true,
        departmentId: "math",
        inventory: [
          { id: "pen", count: 2 },
          { id: "stamp-ink", count: 5 },
          { id: "brick", count: 4 },
          { id: "lantern", count: 3 },
          { id: "first-aid", count: 1 },
          { id: "quill", count: 2 },
        ],
        buildings: [
          { id: "legacy-lamp", kind: "lamp-post", x: lampAt.x, z: lampAt.z },
          { id: "legacy-banner", kind: "banner", x: bannerAt.x, z: bannerAt.z },
          { id: "legacy-booth", kind: "booth", x: boothAt.x, z: boothAt.z },
        ],
      }),
    ),
    true,
  );
  assert.match(useRpg.getState().notice, /存檔已匯入/);
  assert.equal(useRpg.getState().departmentId, department("應用數學與數據科學學系"));
  assert.equal(inventory.count("notes"), 7);
  assert.equal(inventory.count("parts"), 7);
  assert.equal(inventory.count("coffee"), 1);
  assert.equal(
    inventory.slots().some((slot) => slot.itemId === "quill"),
    false,
  );
  const kinds = useRpg.getState().buildings.map((building) => building.kind).sort();
  assert.deepEqual(kinds, ["barrier", "desk", "lantern"]);
  assert.deepEqual(useGame.getState().visited, ["kenan", "statue"]);
  assert.equal(useGame.getState().timeOfDay, "night");
  assert.equal(useGame.getState().muted, true);
  const legacyText = savedData.get(RPG_SAVE_KEY);
  const legacySaved = JSON.parse(legacyText);
  assert.equal(legacySaved.version, 2);
  assert.equal(legacySaved.departmentId, department("應用數學與數據科學學系"));
  assert.deepEqual(legacySaved.slots, inventory.slots());
  assert.deepEqual(legacySaved.buildings, useRpg.getState().buildings);
  useGame.setState({ phase: "title" });
  useRpg.getState().continueGame();
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(inventory.count("notes"), 7);
  assert.equal(useRpg.getState().buildings.length, 3);
  inventory.clear();
  useRpg.setState({ departmentId: null, buildings: [] });
  useGame.setState({ visited: [], timeOfDay: "day", muted: false, phase: "title" });
  assert.equal(useRpg.getState().importSave(legacyText), true);
  assert.equal(useRpg.getState().departmentId, department("應用數學與數據科學學系"));
  assert.equal(inventory.count("parts"), 7);
  assert.deepEqual(useGame.getState().visited, ["kenan", "statue"]);
  useRpg.getState().continueGame();
  assert.equal(useGame.getState().phase, "playing");

  assert.equal(
    useRpg.getState().importSave(
      JSON.stringify({
        version: 1,
        departmentId: "chemistry",
        visited: ["statue"],
        timeOfDay: "sunset",
        muted: false,
        inventory: [{ id: "coffee", count: 1 }],
        buildings: [],
      }),
    ),
    true,
  );
  assert.equal(useRpg.getState().departmentId, department("化學學系"));
  assert.equal(inventory.count("coffee"), 1);
  assert.deepEqual(useGame.getState().visited, ["statue"]);
  useGame.setState({ phase: "title" });
  useRpg.getState().continueGame();
  assert.equal(useGame.getState().phase, "playing");
  reject(JSON.stringify({ version: 3, hp: 10, slots: [], buildings: [] }), /無法辨識此存檔版本/);
  assert.equal(useRpg.getState().departmentId, department("化學學系"));
  assert.equal(useGame.getState().phase, "playing");
});
test("title close, settled movement, other tabs, and a failed write keep the latest checkpoint", () => {
  const hud = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/game/rpg/AdventureHud.tsx"),
    "utf8",
  );
  assert.match(hud, /正在保存…/);
  assert.match(hud, /進度已保存/);
  assert.match(hud, /保存失敗，請匯出備份/);
  assert.match(hud, /保留現有進度/);
  assert.match(hud, /重新載入/);
  assert.match(hud, /keepProgress\(\)/);
  assert.match(hud, /reloadProgress\(\)/);
  assert.equal(typeof onVisibility, "function");
  assert.equal(typeof onStorage, "function");
  assert.equal(handlers.pagehide, flushSave);

  const department = (name) => {
    const found = DEPARTMENTS.find((item) => item.name === name);
    assert.ok(found, name);
    return found;
  };
  const findPad = (kind, existing) => {
    for (let x = 30; x <= 160; x += 7)
      for (const z of [-18, -25, -36, -48, -62, -78])
        if (validatePlacement(kind, x, z, 0, existing) == null) return { x, z };
    assert.fail("no open ground for " + kind);
  };
  const notesBefore = inventory.count("notes");
  const partsBefore = inventory.count("parts");
  const deskAt = findPad("desk", []);
  const desk = {
    id: "kept-desk",
    kind: "desk",
    x: deskAt.x,
    z: deskAt.z,
    rotation: 0,
    hp: 180,
  };
  const away = CAMPUS_SITES.find((site) => {
    const door = siteEntrance(site);
    const resolved = resolveBuildings(door.x, door.z, 0.42, [desk]);
    return (
      Math.hypot(resolved.x - door.x, resolved.z - door.z) < 1e-6 &&
      Math.hypot(door.x + 5, door.z + 45) > 30
    );
  });
  assert.ok(away, "need a saved stand away from the title spawn");
  const door = siteEntrance(away);
  const checkpoint = { x: door.x, z: door.z, yaw: 1.1 };
  useRpg.setState({
    checkpoint,
    claimed: ["first"],
    buildings: [desk],
    interiorId: null,
  });
  useGame.setState({
    phase: "title",
    playerX: -5,
    playerZ: -45,
    playerYaw: 0,
    warp: null,
  });
  handlers.pagehide();
  const closed = JSON.parse(savedData.get(RPG_SAVE_KEY));
  assert.deepEqual(closed.position, checkpoint);
  assert.equal(closed.departmentId, DEPARTMENTS[0].id);
  assert.equal(inventory.count("notes"), notesBefore);
  assert.equal(inventory.count("parts"), partsBefore);
  assert.deepEqual(useRpg.getState().claimed, ["first"]);
  assert.equal(useRpg.getState().buildings[0].id, "kept-desk");
  assert.equal(useGame.getState().playerX, -5);
  assert.equal(useGame.getState().playerZ, -45);
  document.createElement = () => ({ click() {}, href: "", download: "" });
  URL.createObjectURL = () => "blob:tamkang-title";
  URL.revokeObjectURL = () => {};
  useRpg.getState().exportSave();
  assert.deepEqual(JSON.parse(savedData.get(RPG_SAVE_KEY)).position, checkpoint);
  const titleText = savedData.get(RPG_SAVE_KEY);
  inventory.clear();
  useRpg.setState({
    claimed: [],
    buildings: [],
    checkpoint: { x: 1, z: 1, yaw: 0 },
    departmentId: department("化學學系").id,
  });
  useGame.setState({ playerX: 4, playerZ: 4, playerYaw: 2 });
  assert.equal(useRpg.getState().importSave(titleText), true);
  assert.deepEqual(useRpg.getState().checkpoint, checkpoint);
  assert.equal(useRpg.getState().departmentId, DEPARTMENTS[0].id);
  assert.equal(inventory.count("notes"), notesBefore);
  assert.equal(inventory.count("parts"), partsBefore);
  assert.deepEqual(useRpg.getState().claimed, ["first"]);
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(useRpg.getState().buildings[0].id, "kept-desk");
  assert.deepEqual(JSON.parse(savedData.get(RPG_SAVE_KEY)).position, checkpoint);

  useGame.setState({
    phase: "playing",
    playerX: 400,
    playerZ: -10,
    playerYaw: 0,
    warp: null,
  });
  flushSave();
  assert.equal(useRpg.getState().saved, "saved");
  const storage = globalThis.localStorage;
  const originalSetItem = storage.setItem;
  let writes = 0;
  storage.setItem = (key, value) => {
    if (key === RPG_SAVE_KEY) writes += 1;
    return originalSetItem.call(storage, key, value);
  };
  try {
    useRpg.setState({ focus: 40, clock: 30 });
    for (let i = 0; i < 4; i++) tickRpg(0.05);
    useRpg.setState({ clock: 31, focus: 55 });
    assert.equal(writes, 0);
    assert.equal(useRpg.getState().saved, "saved");
    for (let i = 1; i <= 6; i++) {
      useGame.setState({ playerX: 400 + i, playerZ: -10 - i, playerYaw: i / 10 });
      useRpg.setState({ xp: 10 * i, clock: 40 + i, focus: 60 + i });
    }
    assert.equal(writes, 0);
    assert.equal(useRpg.getState().saved, "pending");
    document.hidden = true;
    onVisibility();
    assert.equal(writes, 1);
    assert.equal(useRpg.getState().saved, "saved");
    assert.deepEqual(JSON.parse(savedData.get(RPG_SAVE_KEY)).position, {
      x: 406,
      z: -16,
      yaw: 0.6,
    });
    assert.equal(JSON.parse(savedData.get(RPG_SAVE_KEY)).xp, 60);
  } finally {
    storage.setItem = originalSetItem;
    document.hidden = false;
  }

  const mine = JSON.parse(savedData.get(RPG_SAVE_KEY));
  const otherDoor = siteEntrance(
    CAMPUS_SITES.find((site) => site.id !== away.id && site.form !== "court") ??
      away,
  );
  const other = {
    ...mine,
    departmentId: department("化學學系").id,
    xp: 80,
    claimed: ["builder"],
    slots: [{ itemId: "coffee", quantity: 2 }],
    buildings: [],
    position: { x: otherDoor.x, z: otherDoor.z, yaw: 0.4 },
  };
  const otherText = JSON.stringify(other);
  savedData.set(RPG_SAVE_KEY, otherText);
  onStorage({ key: RPG_SAVE_KEY, newValue: otherText });
  assert.equal(useRpg.getState().saveConflict, true);
  useRpg.setState({ xp: 61 });
  handlers.pagehide();
  document.hidden = true;
  onVisibility();
  flushSave();
  assert.equal(savedData.get(RPG_SAVE_KEY), otherText);
  useRpg.getState().keepProgress();
  assert.equal(useRpg.getState().saveConflict, false);
  assert.equal(useRpg.getState().saved, "saved");
  const kept = JSON.parse(savedData.get(RPG_SAVE_KEY));
  assert.equal(kept.departmentId, useRpg.getState().departmentId);
  assert.equal(kept.xp, useRpg.getState().xp);
  assert.deepEqual(kept.claimed, useRpg.getState().claimed);
  assert.deepEqual(kept.slots, inventory.slots());
  assert.deepEqual(kept.buildings, useRpg.getState().buildings);
  assert.deepEqual(kept.position, {
    x: useGame.getState().playerX,
    z: useGame.getState().playerZ,
    yaw: useGame.getState().playerYaw,
  });

  const reloaded = {
    ...kept,
    departmentId: department("化學學系").id,
    xp: 15,
    claimed: ["first"],
    slots: [{ itemId: "notes", quantity: 2 }, { itemId: "parts", quantity: 4 }],
    buildings: [desk],
    position: checkpoint,
  };
  const reloadText = JSON.stringify(reloaded);
  savedData.set(RPG_SAVE_KEY, reloadText);
  onStorage({ key: RPG_SAVE_KEY, newValue: reloadText });
  assert.equal(useRpg.getState().saveConflict, true);
  handlers.pagehide();
  assert.equal(savedData.get(RPG_SAVE_KEY), reloadText);
  useRpg.getState().reloadProgress();
  assert.equal(useRpg.getState().saveConflict, false);
  assert.equal(useRpg.getState().departmentId, department("化學學系").id);
  assert.equal(inventory.count("notes"), 2);
  assert.equal(inventory.count("parts"), 4);
  assert.deepEqual(useRpg.getState().claimed, ["first"]);
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(useRpg.getState().buildings[0].kind, "desk");
  assert.deepEqual(useRpg.getState().checkpoint, checkpoint);

  const beforeRetry = savedData.get(RPG_SAVE_KEY);
  const slotsBefore = JSON.stringify(inventory.slots());
  const claimedBefore = JSON.stringify(useRpg.getState().claimed);
  const buildingsBefore = JSON.stringify(useRpg.getState().buildings);
  useRpg.setState({ xp: 44 });
  let failed = false;
  storage.setItem = (key, value) => {
    if (key === RPG_SAVE_KEY && !failed) {
      failed = true;
      throw new Error("quota");
    }
    return originalSetItem.call(storage, key, value);
  };
  try {
    flushSave();
    assert.equal(useRpg.getState().saved, "error");
    assert.equal(useRpg.getState().xp, 44);
    assert.equal(JSON.stringify(inventory.slots()), slotsBefore);
    assert.equal(JSON.stringify(useRpg.getState().claimed), claimedBefore);
    assert.equal(JSON.stringify(useRpg.getState().buildings), buildingsBefore);
    assert.equal(useRpg.getState().departmentId, department("化學學系").id);
    assert.equal(savedData.get(RPG_SAVE_KEY), beforeRetry);
    storage.setItem = originalSetItem;
    flushSave();
    assert.equal(useRpg.getState().saved, "saved");
    assert.equal(JSON.parse(savedData.get(RPG_SAVE_KEY)).xp, 44);
    assert.equal(JSON.parse(savedData.get(RPG_SAVE_KEY)).departmentId, department("化學學系").id);
    assert.deepEqual(JSON.parse(savedData.get(RPG_SAVE_KEY)).position, checkpoint);
  } finally {
    storage.setItem = originalSetItem;
    document.hidden = false;
    if (useRpg.getState().saveConflict) useRpg.getState().keepProgress();
  }
});
test("low health, defeat, refresh while dead, interiors, fast travel and graphics follow one play-state transition", () => {
  for (const mode of PLAY_MODES)
    assert.ok(
      TRANSITIONS.some((edge) => edge.from.includes(mode) || edge.to === mode),
      mode,
    );
  const mode = () => {
    const g = useGame.getState();
    const s = useRpg.getState();
    return playMode({
      phase: g.phase,
      plaqueId: g.plaqueId,
      panel: s.panel,
      interiorId: s.interiorId,
      hp: s.hp,
      boss: s.boss,
      claimed: s.claimed,
    });
  };
  const pose = () => {
    const g = useGame.getState();
    return { x: g.playerX, z: g.playerZ, yaw: g.playerYaw };
  };
  const notes = () => inventory.count("notes");
  const coffee = () => inventory.count("coffee");
  rpgInput.attach();
  const room = CAMPUS_SITES.find((site) => {
    if (site.form === "court") return false;
    const entrance = siteEntrance(site);
    return Math.hypot(entrance.x - SPAWN.x, entrance.z - SPAWN.z) > 40;
  });
  assert.ok(room);
  const door = siteEntrance(room);
  const foe = () => useRpg.getState().enemies[0];

  useGame.setState({
    phase: "playing",
    plaqueId: null,
    playerX: -5,
    playerZ: -45,
    playerYaw: 0,
    warp: { x: 400, z: -10, yaw: 1 },
  });
  useRpg.setState({
    hp: 30,
    xp: 0,
    boss: 0,
    claimed: ["first"],
    discoveries: [],
    attackUntil: 0,
    panel: null,
    interiorId: null,
    buildKind: null,
  });
  foe().hp = 1000;
  foe().x = -5;
  foe().z = -48;
  foe().state = "idle";
  const claimed = ["first"];
  const coffeeBefore = coffee();
  const notesBefore = notes();
  assert.equal(mode(), "playing");
  useRpg.getState().attack();
  assert.ok(foe().hp < 1000, "low health can still strike");
  assert.equal(useRpg.getState().hp, 30);
  assert.equal(notes(), notesBefore);
  useRpg.getState().useItem("coffee");
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(coffee(), coffeeBefore - 1);
  assert.equal(notes(), notesBefore);
  assert.deepEqual(pose(), { x: -5, z: -45, yaw: 0 });
  assert.deepEqual(useRpg.getState().claimed, claimed);

  const queued = (code) =>
    handlers.keydown({
      code,
      repeat: false,
      target: { tagName: "DIV" },
      preventDefault() {},
    });
  queued("Space");
  useRpg.setState({
    hp: 75,
    buildKind: "desk",
    attackUntil: 80,
    skillUntil: 80,
    dodgeUntil: 80,
    invulnerableUntil: 80,
    hurtUntil: 80,
    attackFx: {
      x: 1,
      z: 1,
      yaw: 0,
      skill: false,
      color: "#fff",
      range: 3,
      at: 0,
    },
  });
  foe().state = "windup";
  foe().timer = 0.01;
  useGame.setState({ warp: { x: 400, z: -10, yaw: 2 } });
  useRpg.getState().enter(room.id);
  assert.equal(mode(), "indoor");
  assert.equal(useRpg.getState().interiorId, room.id);
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(useRpg.getState().buildKind, null);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().skillUntil, 0);
  assert.equal(useRpg.getState().dodgeUntil, 0);
  assert.equal(useRpg.getState().invulnerableUntil, 0);
  assert.equal(useRpg.getState().hurtUntil, 0);
  assert.equal(useRpg.getState().attackFx, null);
  assert.equal(foe().state, "idle");
  assert.equal(rpgInput.sample().dodge, false);
  assert.deepEqual(useGame.getState().warp, { x: 0, z: 4, yaw: 0 });
  assert.deepEqual(pose(), { x: 0, z: 4, yaw: 0 });
  assert.notDeepEqual(useGame.getState().warp, { x: 400, z: -10, yaw: 2 });
  assert.equal(notes(), notesBefore);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  useRpg.getState().exit();
  assert.equal(mode(), "playing");
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(useRpg.getState().hp, 75);
  assert.deepEqual(useGame.getState().warp, { x: door.x, z: door.z, yaw: Math.PI });
  assert.deepEqual(pose(), { x: door.x, z: door.z, yaw: Math.PI });
  assert.equal(notes(), notesBefore);

  queued("Space");
  useRpg.setState({
    panel: null,
    interiorId: room.id,
    buildKind: "lantern",
    attackUntil: 40,
    invulnerableUntil: 40,
    hp: 75,
  });
  useGame.setState({
    phase: "playing",
    warp: { x: 0, z: 4, yaw: 0.4 },
    playerX: 0,
    playerZ: 4,
    playerYaw: 0.4,
  });
  useRpg.getState().setPanel("map");
  assert.equal(mode(), "panel");
  useRpg.getState().travel(room.id);
  assert.equal(mode(), "playing");
  assert.equal(useRpg.getState().panel, null);
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(useRpg.getState().buildKind, null);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().invulnerableUntil, 0);
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(rpgInput.sample().dodge, false);
  assert.deepEqual(useGame.getState().warp, { x: door.x, z: door.z, yaw: 0 });
  assert.deepEqual(pose(), { x: door.x, z: door.z, yaw: 0 });
  const discoveries = useRpg.getState().discoveries.length;
  useRpg.getState().travel(room.id);
  assert.equal(useRpg.getState().discoveries.length, discoveries);
  assert.equal(notes(), notesBefore);
  assert.equal(coffee(), coffeeBefore - 1);
  assert.deepEqual(useRpg.getState().claimed, claimed);

  const graphics = { ...useGame.getState().graphics };
  const epoch = useGame.getState().sceneEpoch;
  useRpg.setState({
    hp: 75,
    buildKind: "lantern",
    attackUntil: 12,
    invulnerableUntil: 12,
  });
  useGame.setState({
    phase: "paused",
    playerX: door.x,
    playerZ: door.z,
    playerYaw: 0,
    warp: { x: 400, z: -10, yaw: 1 },
  });
  useGame.getState().setGraphics({ postFx: !graphics.postFx });
  assert.equal(useGame.getState().phase, "paused");
  assert.equal(mode(), "paused");
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(useRpg.getState().buildKind, "lantern");
  assert.equal(useRpg.getState().attackUntil, 12);
  assert.deepEqual(pose(), { x: door.x, z: door.z, yaw: 0 });
  assert.equal(useGame.getState().warp, null);
  assert.ok(useGame.getState().sceneEpoch > epoch);
  assert.equal(notes(), notesBefore);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  useGame.getState().resume();
  assert.equal(mode(), "playing");
  useGame.getState().setGraphics(graphics);

  pilgrimageInput.keys.add("KeyQ");
  pilgrimageInput.prevAttack = false;
  useGame.setState({
    phase: "playing",
    playerX: door.x,
    playerZ: door.z,
    playerYaw: 0,
    warp: { x: 400, z: -10, yaw: 1 },
    plaqueId: null,
  });
  useRpg.setState({ hp: 75, buildKind: "lantern" });
  useGame.getState().pause();
  assert.equal(mode(), "paused");
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(useGame.getState().warp, null);
  assert.deepEqual(pose(), { x: door.x, z: door.z, yaw: 0 });
  assert.equal(pilgrimageInput.sample().attack, false);
  useGame.getState().resume();
  assert.equal(mode(), "playing");
  const visited = useGame.getState().visited.filter((id) => id !== "kenan");
  useGame.setState({ visited, plaqueId: null });
  rpgInput.keys.add("KeyE");
  rpgInput.prevInteract = false;
  useGame.getState().stamp("kenan");
  assert.equal(
    useGame.getState().visited.filter((id) => id === "kenan").length,
    1,
  );
  assert.equal(useGame.getState().plaqueId, "kenan");
  assert.equal(mode(), "paused");
  assert.equal(rpgInput.sample().interact, false);
  useGame.getState().stamp("kenan");
  assert.equal(
    useGame.getState().visited.filter((id) => id === "kenan").length,
    1,
  );
  useGame.getState().openPlaque(null);
  assert.equal(mode(), "playing");
  useGame.getState().travelTo("kenan");
  assert.equal(mode(), "playing");
  assert.equal(useRpg.getState().hp, 75);
  assert.equal(useRpg.getState().buildKind, null);
  assert.equal(useRpg.getState().interiorId, null);
  assert.notEqual(useGame.getState().warp.x, 400);
  assert.equal(useGame.getState().playerX, useGame.getState().warp.x);
  assert.equal(useGame.getState().playerZ, useGame.getState().warp.z);
  assert.equal(notes(), notesBefore);

  const fallen = foe();
  fallen.hp = 30;
  fallen.anchorX = SPAWN.x;
  fallen.anchorZ = SPAWN.z;
  fallen.x = SPAWN.x;
  fallen.z = SPAWN.z;
  fallen.state = "windup";
  fallen.timer = 0.01;
  const resting = useRpg.getState().enemies[1];
  resting.hp = 0;
  resting.state = "dead";
  resting.timer = 40;
  const lootBefore = useRpg.getState().loot.length;
  queued("Space");
  useRpg.setState({
    hp: 0,
    buildKind: "desk",
    attackUntil: 90,
    skillUntil: 90,
    dodgeUntil: 90,
    invulnerableUntil: 90,
    hurtUntil: 90,
    panel: null,
    interiorId: null,
    buildings: [],
  });
  useGame.setState({
    phase: "playing",
    playerX: door.x,
    playerZ: door.z,
    playerYaw: 0.2,
    warp: { x: 400, z: -10, yaw: 2 },
  });
  assert.equal(mode(), "downed");
  useRpg.getState().respawn();
  assert.equal(mode(), "playing");
  assert.equal(useRpg.getState().hp, 100);
  assert.equal(useRpg.getState().focus, 100);
  assert.equal(useRpg.getState().buildKind, null);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().skillUntil, 0);
  assert.equal(useRpg.getState().dodgeUntil, 0);
  assert.equal(useRpg.getState().invulnerableUntil, 0);
  assert.equal(useRpg.getState().hurtUntil, 0);
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(rpgInput.sample().dodge, false);
  assert.equal(fallen.state, "idle");
  assert.equal(fallen.x, SPAWN.x);
  assert.equal(fallen.z, SPAWN.z);
  assert.equal(resting.hp, 0);
  assert.equal(resting.timer, 40);
  assert.equal(useRpg.getState().loot.length, lootBefore);
  assert.equal(notes(), notesBefore);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  const landed = pose();
  const reach = ENEMY_TYPES[fallen.kind].radius + 2.5;
  assert.ok(
    Math.hypot(landed.x - SPAWN.x, landed.z - SPAWN.z) >= reach - 0.05,
    "respawn stands clear of the enemy",
  );
  const free = resolveBuildings(landed.x, landed.z, 0.42, []);
  assert.ok(Math.hypot(free.x - landed.x, free.z - landed.z) < 0.05);
  assert.notEqual(landed.x, 400);
  assert.ok(Math.hypot(landed.x - door.x, landed.z - door.z) > 5);
  fallen.x = landed.x;
  fallen.z = landed.z + 0.4;
  fallen.state = "windup";
  fallen.timer = 0.01;
  tickRpg(0.06);
  assert.ok(useRpg.getState().hp < 100, "respawn does not leave mercy frames");
  useRpg.setState({ hp: 0, buildings: [] });
  const block = {
    id: "spawn-block",
    kind: "desk",
    x: SPAWN.x,
    z: SPAWN.z,
    rotation: 0,
    hp: 180,
  };
  useRpg.setState({ hp: 0, buildings: [block] });
  fallen.anchorX = -5;
  fallen.anchorZ = -48;
  fallen.hp = 10;
  useRpg.getState().respawn();
  const shifted = pose();
  const pushed = resolveBuildings(shifted.x, shifted.z, 0.42, [block]);
  assert.ok(Math.hypot(pushed.x - shifted.x, pushed.z - shifted.z) < 0.05);
  assert.ok(Math.hypot(shifted.x - block.x, shifted.z - block.z) > 0.5);
  assert.equal(notes(), notesBefore);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  assert.equal(useRpg.getState().buildings.length, 1);

  useRpg.setState({
    hp: 0,
    claimed,
    buildings: [],
    interiorId: room.id,
    floor: 2,
    attackUntil: 15,
    invulnerableUntil: 15,
    checkpoint: null,
  });
  useGame.setState({
    phase: "playing",
    playerX: 0,
    playerZ: 4,
    playerYaw: 0.2,
    warp: { x: 0, z: 4, yaw: 0.2 },
  });
  const savedNotes = notes();
  handlers.pagehide();
  const deadText = savedData.get(RPG_SAVE_KEY);
  const deadSave = JSON.parse(deadText);
  assert.equal(deadSave.hp, 0);
  assert.deepEqual(deadSave.claimed, claimed);
  assert.deepEqual(deadSave.position, { x: door.x, z: door.z, yaw: Math.PI });
  inventory.add("notes", 4);
  useRpg.setState({
    hp: 100,
    claimed: [],
    interiorId: null,
    attackUntil: 5,
    invulnerableUntil: 5,
  });
  useGame.setState({ playerX: 3, playerZ: 3, playerYaw: 1, warp: { x: 9, z: 9, yaw: 1 } });
  assert.equal(useRpg.getState().importSave(deadText), true);
  assert.equal(useRpg.getState().hp, 0);
  assert.equal(notes(), savedNotes);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().invulnerableUntil, 0);
  assert.deepEqual(useGame.getState().warp, {
    x: door.x,
    z: door.z,
    yaw: Math.PI,
  });
  useGame.setState({ phase: "title" });
  assert.equal(mode(), "title");
  useRpg.getState().continueGame();
  assert.equal(mode(), "downed");
  assert.equal(useRpg.getState().hp, 0);
  assert.deepEqual(pose(), { x: door.x, z: door.z, yaw: Math.PI });
  assert.equal(notes(), savedNotes);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  useRpg.getState().respawn();
  assert.equal(mode(), "playing");
  assert.equal(useRpg.getState().hp, 100);
  assert.equal(notes(), savedNotes);
  assert.deepEqual(useRpg.getState().claimed, claimed);
  assert.equal(useRpg.getState().buildings.length, 0);
  const home = resolveBuildings(SPAWN.x, SPAWN.z, 0.42, []);
  const again = pose();
  assert.ok(Math.hypot(again.x - home.x, again.z - home.z) < 0.05);

  const credits = inventory.count("credit");
  const badges = inventory.count("badge");
  useRpg.setState({
    hp: 75,
    xp: 0,
    boss: 1,
    claimed: ["first"],
    panel: null,
    interiorId: null,
  });
  useGame.setState({ phase: "playing", plaqueId: null });
  assert.equal(mode(), "victory");
  useGame.getState().pause();
  assert.equal(mode(), "victory");
  useRpg.getState().claim("semester");
  assert.equal(inventory.count("badge"), badges + 1);
  assert.equal(inventory.count("credit"), credits + 5);
  assert.ok(useRpg.getState().claimed.includes("semester"));
  useRpg.getState().claim("semester");
  assert.equal(inventory.count("badge"), badges + 1);
  assert.equal(inventory.count("credit"), credits + 5);
  assert.equal(
    useRpg.getState().claimed.filter((id) => id === "semester").length,
    1,
  );
  assert.equal(notes(), savedNotes);
  useGame.getState().resume();
  assert.equal(mode(), "playing");
  useGame.setState({ warp: null, plaqueId: null, phase: "playing" });
  useRpg.setState({ buildings: [], interiorId: null, buildKind: null, boss: 0 });
});
test("press and release before the next sample performs interact, dodge, and pause once", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const hud = readFileSync(join(root, "../src/game/rpg/AdventureHud.tsx"), "utf8");
  const world = readFileSync(join(root, "../src/game/rpg/AdventureWorld.tsx"), "utf8");
  const player = readFileSync(join(root, "../src/game/rpg/AdventurePlayer.tsx"), "utf8");
  assert.doesNotMatch(hud, /keys\.add\("Space"\)/);
  assert.doesNotMatch(hud, /keys\.add\("KeyE"\)/);
  assert.doesNotMatch(hud, /keys\.delete\("Space"\), 120\)/);
  assert.doesNotMatch(hud, /keys\.delete\("KeyE"\), 120\)/);
  assert.match(hud, /input\.tap\("dodge"\)/);
  assert.match(hud, /bind\("interact"\)/);
  assert.match(
    readFileSync(join(root, "../src/game/rpg/input.ts"), "utf8"),
    /zone === "interact"[\s\S]{0,40}this\.tap\("interact"\)/,
  );
  assert.doesNotMatch(world, /e\.code === "KeyE"/);
  assert.match(player, /actions\.pauseCount/);
  assert.match(player, /actions\.dodgeCount/);
  assert.match(player, /actions\.interactCount/);

  document.hidden = false;
  rpgInput.detach();
  rpgInput.attach();
  const press = (code) =>
    handlers.keydown({
      code,
      repeat: false,
      target: { tagName: "DIV" },
      preventDefault() {},
    });
  const release = (code) => handlers.keyup({ code });
  const tapKey = (code) => {
    press(code);
    release(code);
  };
  const once = (action, countName) => {
    const first = rpgInput.sample();
    assert.equal(first[action], true, action);
    assert.equal(first[countName], 1, action);
    const again = rpgInput.sample();
    assert.equal(again[action], false, action + " repeated");
    assert.equal(again[countName], 0, action + " repeated");
  };

  tapKey("KeyE");
  once("interact", "interactCount");
  tapKey("Space");
  once("dodge", "dodgeCount");
  tapKey("Escape");
  once("pause", "pauseCount");

  rpgInput.tap("dodge");
  rpgInput.tap("dodge");
  tapKey("KeyE");
  tapKey("KeyE");
  const doubled = rpgInput.sample();
  assert.equal(doubled.dodge, true);
  assert.equal(doubled.dodgeCount, 2);
  assert.equal(doubled.interact, true);
  assert.equal(doubled.interactCount, 2);
  assert.equal(doubled.pauseCount, 0);
  const drained = rpgInput.sample();
  assert.equal(drained.dodge, false);
  assert.equal(drained.dodgeCount, 0);
  assert.equal(drained.interact, false);
  assert.equal(drained.interactCount, 0);

  press("KeyW");
  tapKey("KeyE");
  tapKey("Space");
  const together = rpgInput.sample();
  assert.ok(together.moveY > 0);
  assert.equal(together.interact, true);
  assert.equal(together.interactCount, 1);
  assert.equal(together.dodge, true);
  assert.equal(together.dodgeCount, 1);
  const moving = rpgInput.sample();
  assert.ok(moving.moveY > 0);
  assert.equal(moving.interact, false);
  assert.equal(moving.dodge, false);
  assert.equal(moving.interactCount, 0);
  assert.equal(moving.dodgeCount, 0);
  release("KeyW");
  assert.equal(rpgInput.sample().moveY, 0);

  rpgInput.tap("pause");
  const late = rpgInput.sample();
  assert.equal(late.pause, true);
  assert.equal(late.pauseCount, 1);
  assert.equal(rpgInput.sample().pauseCount, 0);

  rpgInput.tap("interact");
  handlers.blur();
  assert.equal(rpgInput.sample().interact, false);
  assert.equal(rpgInput.sample().interactCount, 0);
  tapKey("KeyF");
  once("interact", "interactCount");

  rpgInput.tap("dodge");
  rpgInput.detach();
  rpgInput.attach();
  assert.equal(rpgInput.sample().dodge, false);
  tapKey("Space");
  once("dodge", "dodgeCount");

  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.setState({ panel: null, buildKind: null, hp: 100, interiorId: null });
  press("KeyW");
  rpgInput.tap("interact");
  rpgInput.tap("dodge");
  rpgInput.tap("pause");
  useRpg.getState().setPanel("inventory");
  const opened = rpgInput.sample();
  assert.equal(opened.interact, false);
  assert.equal(opened.dodge, false);
  assert.equal(opened.pause, false);
  assert.equal(opened.interactCount, 0);
  assert.equal(opened.dodgeCount, 0);
  assert.equal(opened.pauseCount, 0);
  assert.ok(opened.moveY > 0);
  useRpg.getState().setPanel(null);
  tapKey("Space");
  once("dodge", "dodgeCount");
  release("KeyW");
  assert.equal(rpgInput.sample().moveY, 0);

  press("KeyA");
  rpgInput.tap("pause");
  document.hidden = true;
  documentHandlers.visibilitychange();
  document.hidden = false;
  documentHandlers.visibilitychange();
  const shown = rpgInput.sample();
  assert.equal(shown.pause, false);
  assert.equal(shown.pauseCount, 0);
  assert.equal(shown.moveX, 0);
  tapKey("Escape");
  once("pause", "pauseCount");

  document.hidden = false;
  useRpg.getState().setPanel(null);
  useGame.setState({ phase: "playing", plaqueId: null });
});
test("title department search, backpack focus, and one escape layer keep space and enter native", () => {
  const rootDir = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(rootDir, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const combat = read("../src/game/rpg/AdventureCombatHud.tsx");
  const dialogSource = read("../src/game/rpg/DialogFrame.tsx");
  const css = read("../src/game/rpg/adventure.css");
  assert.match(hud, /filterDepartments\(DEPARTMENTS, search, college\)/);
  assert.match(hud, /aria-label="搜尋科系"/);
  assert.match(combat, /<Dialog/);
  assert.match(combat, /onClose=\{closeVictory\}/);
  assert.match(combat, /onClick=\{closeVictory\}/);
  assert.match(dialogSource, /openDialog\(/);
  assert.match(css, /button:focus[\s\S]*outline:\s*3px solid #ddaf61/);

  document.hidden = false;
  document.pointerLockElement = null;
  document.activeElement = null;
  rpgInput.detach();
  rpgInput.attach();
  rpgInput.sample();

  const press = (partial) => {
    let prevented = false;
    handlers.keydown({
      repeat: false,
      key: "",
      code: "",
      target: { tagName: "DIV" },
      preventDefault() {
        prevented = true;
      },
      stopPropagation() {},
      ...partial,
    });
    return prevented;
  };
  const el = (tag, className = "") => {
    const node = {
      tagName: tag,
      className,
      inert: false,
      isConnected: true,
      disabled: false,
      parentElement: null,
      children: [],
      focus() {
        document.activeElement = node;
      },
      getClientRects() {
        return [node];
      },
      getAttribute(name) {
        return name === "tabindex" ? null : null;
      },
      hasAttribute() {
        return false;
      },
      addEventListener() {},
      removeEventListener() {},
      querySelector(selector) {
        return (
          walk(node).find((item) =>
            selector === ".ad-dialog-body"
              ? item.className === "ad-dialog-body"
              : false,
          ) ?? null
        );
      },
      querySelectorAll() {
        return walk(node);
      },
    };
    return node;
  };
  const walk = (node) => {
    const found = [];
    for (const child of node.children) found.push(child, ...walk(child));
    return found;
  };
  const mount = (parent, child) => {
    parent.children.push(child);
    child.parentElement = parent;
    return child;
  };

  const button = { tagName: "BUTTON" };
  assert.equal(press({ code: "Space", key: " ", target: button }), false);
  let sample = rpgInput.sample();
  assert.equal(sample.dodge, false);
  assert.equal(sample.dodgeCount, 0);
  assert.equal(press({ code: "Enter", key: "Enter", target: button }), false);
  sample = rpgInput.sample();
  assert.equal(sample.dodge, false);
  assert.equal(sample.dodgeCount, 0);
  assert.equal(press({ code: "Space", key: " ", target: { tagName: "DIV" } }), true);
  sample = rpgInput.sample();
  assert.equal(sample.dodge, true);
  assert.equal(sample.dodgeCount, 1);
  assert.equal(rpgInput.sample().dodge, false);

  press({ code: "Space", key: " ", isComposing: true, target: { tagName: "INPUT" } });
  press({ code: "Escape", key: "Escape", isComposing: true, target: { tagName: "INPUT" } });
  press({ code: "Space", key: " ", keyCode: 229, target: { tagName: "DIV" } });
  press({ code: "Escape", key: "Escape", keyCode: 229, target: { tagName: "DIV" } });
  sample = rpgInput.sample();
  assert.equal(sample.dodge, false);
  assert.equal(sample.dodgeCount, 0);
  assert.equal(sample.pause, false);
  assert.equal(sample.pauseCount, 0);

  const selectHost = el("SECTION", "ad-dialog");
  const selectScrim = el("DIV");
  const selectUi = el("DIV");
  mount(selectUi, selectScrim);
  mount(selectScrim, selectHost);
  let selectClosed = 0;
  let releaseSelect = () => {};
  releaseSelect = openDialog({
    root: selectHost,
    scrim: selectScrim,
    close: () => {
      selectClosed += 1;
      releaseSelect();
    },
  });
  press({ code: "Space", key: " ", target: { tagName: "SELECT" } });
  press({ code: "Escape", key: "Escape", target: { tagName: "SELECT" } });
  sample = rpgInput.sample();
  assert.equal(selectClosed, 0);
  assert.equal(dialogDepth(), 1);
  assert.equal(sample.dodge, false);
  assert.equal(sample.pause, false);
  releaseSelect();
  assert.equal(dialogDepth(), 0);

  useGame.setState({ phase: "playing", plaqueId: null });
  const phase = useGame.getState().phase;
  const closed = [];
  const openNamed = (name) => {
    const root = el("SECTION", "ad-dialog");
    const scrim = el("DIV");
    const ui = el("DIV");
    mount(ui, scrim);
    mount(scrim, root);
    let release = () => {};
    release = openDialog({
      root,
      scrim,
      close: () => {
        closed.push(name);
        release();
      },
    });
    return release;
  };
  openNamed("low");
  openNamed("top");
  press({ code: "Escape", key: "Escape", target: { tagName: "DIV" } });
  assert.deepEqual(closed, ["top"]);
  assert.equal(dialogDepth(), 1);
  assert.equal(useGame.getState().phase, phase);
  sample = rpgInput.sample();
  assert.equal(sample.pause, false);
  assert.equal(sample.pauseCount, 0);
  press({ code: "Escape", key: "Escape", target: { tagName: "DIV" } });
  assert.deepEqual(closed, ["top", "low"]);
  assert.equal(dialogDepth(), 0);
  assert.equal(useGame.getState().phase, phase);
  sample = rpgInput.sample();
  assert.equal(sample.pause, false);
  assert.equal(sample.pauseCount, 0);

  useRpg.setState({
    departmentId: null,
    panel: null,
    hp: 100,
    boss: 0,
    claimed: [],
    interiorId: null,
  });
  useGame.setState({ phase: "title", plaqueId: null });
  useRpg.getState().continueGame();
  assert.equal(useRpg.getState().panel, "department");
  assert.equal(useGame.getState().phase, "title");
  const query = DEPARTMENTS.find((d) => d.name.length > 1).name;
  const hits = filterDepartments(DEPARTMENTS, query, "全部");
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((d) => d.name.includes(query)));
  assert.equal(filterDepartments(DEPARTMENTS, query + "沒有這科系", "全部").length, 0);
  const college = hits[0].college;
  assert.ok(
    filterDepartments(DEPARTMENTS, "", college).every((d) => d.college === college),
  );
  useRpg.getState().chooseDepartment(hits[0].id);
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(useRpg.getState().panel, null);
  assert.equal(useRpg.getState().departmentId, hits[0].id);

  const ui = el("DIV");
  const hudBox = el("DIV");
  const trigger = el("BUTTON");
  const scrim = el("DIV");
  const dialog = el("SECTION", "ad-dialog");
  const header = el("DIV");
  const closeBtn = el("BUTTON");
  const body = el("DIV", "ad-dialog-body");
  const search = el("INPUT");
  const last = el("BUTTON");
  mount(ui, hudBox);
  mount(hudBox, trigger);
  mount(ui, scrim);
  mount(scrim, dialog);
  mount(dialog, header);
  mount(header, closeBtn);
  mount(dialog, body);
  mount(body, search);
  mount(body, last);
  useRpg.getState().setPanel("inventory");
  assert.equal(useGame.getState().phase, "paused");
  document.activeElement = trigger;
  document.pointerLockElement = { id: "lock" };
  let released = false;
  document.exitPointerLock = () => {
    released = true;
    document.pointerLockElement = null;
  };
  let releaseBag = () => {};
  releaseBag = openDialog({
    root: dialog,
    scrim,
    close: () => {
      useRpg.getState().setPanel(null);
      releaseBag();
    },
  });
  assert.equal(released, true);
  assert.equal(document.pointerLockElement, null);
  assert.equal(hudBox.inert, true);
  assert.equal(scrim.inert, false);
  assert.equal(document.activeElement, search);
  press({ code: "Space", key: " ", target: search });
  press({ code: "Enter", key: "Enter", target: search });
  sample = rpgInput.sample();
  assert.equal(sample.dodge, false);
  assert.equal(sample.dodgeCount, 0);
  let wrapped = false;
  assert.equal(
    cycleDialogFocus({
      key: "Tab",
      shiftKey: false,
      target: last,
      preventDefault() {
        wrapped = true;
      },
    }),
    true,
  );
  assert.equal(wrapped, true);
  assert.equal(document.activeElement, closeBtn);
  wrapped = false;
  assert.equal(
    cycleDialogFocus({
      key: "Tab",
      shiftKey: true,
      target: closeBtn,
      preventDefault() {
        wrapped = true;
      },
    }),
    true,
  );
  assert.equal(wrapped, true);
  assert.equal(document.activeElement, last);
  press({ code: "Escape", key: "Escape", target: { tagName: "DIV" } });
  assert.equal(useRpg.getState().panel, null);
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(dialogDepth(), 0);
  assert.equal(document.activeElement, trigger);
  assert.equal(hudBox.inert, false);
  sample = rpgInput.sample();
  assert.equal(sample.pause, false);
  assert.equal(sample.pauseCount, 0);
  assert.equal(sample.dodge, false);
  assert.equal(
    playMode({
      phase: useGame.getState().phase,
      plaqueId: useGame.getState().plaqueId,
      panel: useRpg.getState().panel,
      interiorId: useRpg.getState().interiorId,
      hp: useRpg.getState().hp,
      boss: useRpg.getState().boss,
      claimed: useRpg.getState().claimed,
    }),
    "playing",
  );
  useRpg.setState({
    boss: 1,
    claimed: [],
    panel: null,
    hp: 100,
    interiorId: null,
    xp: 0,
  });
  useGame.setState({ phase: "playing", plaqueId: null });
  useGame.getState().pause();
  assert.equal(useGame.getState().phase, "paused");
  const victoryRoot = el("SECTION", "ad-dialog");
  const victoryScrim = el("DIV");
  const victoryUi = el("DIV");
  mount(victoryUi, victoryScrim);
  mount(victoryScrim, victoryRoot);
  let releaseVictory = () => {};
  releaseVictory = openDialog({
    root: victoryRoot,
    scrim: victoryScrim,
    close: closeVictory,
  });
  assert.equal(dialogDepth(), 1);
  press({ code: "Escape", key: "Escape", target: { tagName: "DIV" } });
  assert.equal(dialogDepth(), 1);
  assert.ok(useRpg.getState().claimed.includes("semester"));
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(victoryPauseMenuOpen(false), false);
  sample = rpgInput.sample();
  assert.equal(sample.pause, false);
  assert.equal(sample.pauseCount, 0);
  releaseVictory();
  assert.equal(dialogDepth(), 0);
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(victoryPauseMenuOpen(false), false);

  document.pointerLockElement = null;
  document.hidden = false;
});
test("stick magnitude scales walk speed and touch controls release cleanly", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const player = read("../src/game/rpg/AdventurePlayer.tsx");
  const css = read("../src/game/rpg/adventure.css");
  assert.match(player, /moveTargetSpeed\(actions\.moveX, actions\.moveY, actions\.sprint\)/);
  assert.match(hud, /setPointerCapture\(e\.pointerId\)/);
  assert.match(hud, /onPointerCancel:/);
  assert.match(hud, /onLostPointerCapture:/);
  assert.match(hud, /pointerEnd\(e\.pointerId, kind\)/);
  assert.match(hud, /touchLayout\(/);
  assert.match(hud, /bind\("stick"\)/);
  assert.match(hud, /bind\("look"\)/);
  assert.match(hud, /bind\("sprint"\)/);
  assert.match(hud, /bind\("dodge"\)/);
  assert.match(hud, /bind\("interact"\)/);
  assert.match(css, /env\(safe-area-inset-top/);
  assert.match(css, /env\(safe-area-inset-right/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /env\(safe-area-inset-left/);

  document.hidden = false;
  document.pointerLockElement = null;
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.setState({ panel: null, hp: 100, boss: 0, claimed: [], interiorId: null });
  rpgInput.detach();
  rpgInput.attach();
  const press = (code) =>
    handlers.keydown({
      code,
      repeat: false,
      target: { tagName: "DIV" },
      preventDefault() {},
    });
  const release = (code) => handlers.keyup({ code });
  const reset = () => {
    document.hidden = false;
    document.pointerLockElement = null;
    handlers.blur();
    rpgInput.releaseTouch();
    rpgInput.sample();
  };
  const aim = (sample) => moveTargetSpeed(sample.moveX, sample.moveY, sample.sprint);
  const near = (actual, expected, label) =>
    assert.ok(Math.abs(actual - expected) < 1e-9, label + " " + actual + " vs " + expected);

  reset();
  assert.equal(aim(rpgInput.sample()), 0);
  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  assert.equal(rpgInput.joyX, 0, "a move before capture must not stick");

  const half = STICK_RADIUS / 2;
  rpgInput.pointerDown(1, "stick", 0, 0);
  rpgInput.pointerMove(1, half, 0);
  const light = rpgInput.sample();
  const lightAim = aim(light);
  assert.equal(light.sprint, false);
  assert.ok(lightAim > 0);
  assert.ok(lightAim < WALK, "light stick stays under the walk cap");

  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  const full = rpgInput.sample();
  const fullAim = aim(full);
  assert.equal(full.sprint, false);
  assert.equal(fullAim, WALK);
  assert.ok(lightAim < fullAim);
  assert.ok(fullAim < SPRINT, "a full stick does not become sprint");

  rpgInput.pointerMove(1, STICK_RADIUS * 3, 0);
  const pinned = rpgInput.sample();
  assert.equal(aim(pinned), WALK);
  assert.equal(pinned.sprint, false);

  rpgInput.pointerDown(3, "sprint", 0, 0);
  rpgInput.pointerMove(1, half, 0);
  const lightSprint = rpgInput.sample();
  const lightSprintAim = aim(lightSprint);
  assert.equal(lightSprint.sprint, true);
  assert.ok(lightSprintAim > lightAim);
  assert.ok(lightSprintAim < SPRINT);
  assert.notEqual(lightSprintAim, WALK);
  near(lightSprintAim / SPRINT, lightAim / WALK, "sprint scales the same magnitude");

  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  const fullSprint = rpgInput.sample();
  assert.equal(fullSprint.sprint, true);
  assert.equal(aim(fullSprint), SPRINT);

  rpgInput.pointerEnd(1, "up");
  rpgInput.pointerEnd(3, "up");
  press("KeyW");
  const keyed = rpgInput.sample();
  assert.equal(keyed.sprint, false);
  assert.equal(aim(keyed), WALK);
  press("ShiftLeft");
  const keyedSprint = rpgInput.sample();
  assert.equal(keyedSprint.sprint, true);
  assert.equal(aim(keyedSprint), SPRINT);
  release("ShiftLeft");
  press("KeyD");
  const diagonal = rpgInput.sample();
  assert.equal(diagonal.sprint, false);
  assert.equal(aim(diagonal), WALK);
  release("KeyW");
  release("KeyD");
  assert.equal(aim(rpgInput.sample()), 0);

  reset();
  press("KeyD");
  rpgInput.pointerDown(1, "stick", 40, 80);
  rpgInput.pointerMove(1, 40 + half, 80);
  rpgInput.pointerDown(2, "look", 200, 100);
  rpgInput.pointerMove(2, 206, 104);
  rpgInput.pointerDown(3, "sprint", 0, 0);
  rpgInput.pointerDown(4, "dodge", 0, 0);
  rpgInput.pointerDown(5, "interact", 0, 0);
  document.pointerLockElement = { id: "lock" };
  handlers.mousemove({ movementX: 5, movementY: -1 });
  const together = rpgInput.sample();
  assert.ok(together.moveX > 0, "stick and key share the sample");
  assert.ok(together.moveY !== 0 || together.moveX !== 0);
  assert.equal(together.sprint, true);
  assert.equal(together.dodge, true);
  assert.equal(together.dodgeCount, 1);
  assert.equal(together.interact, true);
  assert.equal(together.interactCount, 1);
  assert.equal(together.lookX, 5 + 6);
  assert.equal(together.lookY, -1 + 4);
  const drained = rpgInput.sample();
  assert.equal(drained.dodge, false);
  assert.equal(drained.dodgeCount, 0);
  assert.equal(drained.interact, false);
  assert.equal(drained.interactCount, 0);
  assert.equal(drained.sprint, true);
  assert.ok(drained.moveX > 0);
  assert.equal(drained.lookX, 0);

  rpgInput.pointerEnd(2, "cancel");
  rpgInput.pointerMove(2, 240, 140);
  const afterCancel = rpgInput.sample();
  assert.equal(afterCancel.lookX, 0);
  assert.equal(afterCancel.lookY, 0);
  assert.equal(afterCancel.sprint, true);
  assert.ok(rpgInput.joyX !== 0);
  assert.equal(rpgInput.keys.has("KeyD"), true);

  handlers.mousemove({ movementX: 3, movementY: 0 });
  const mouseLeft = rpgInput.sample();
  assert.equal(mouseLeft.lookX, 3);
  assert.equal(mouseLeft.sprint, true);
  assert.equal(rpgInput.keys.has("KeyD"), true);

  rpgInput.pointerEnd(1, "lost");
  rpgInput.pointerMove(1, 40 + STICK_RADIUS, 80);
  assert.equal(rpgInput.joyX, 0);
  assert.equal(rpgInput.joyY, 0);
  const afterLost = rpgInput.sample();
  assert.equal(afterLost.sprint, true);
  assert.equal(afterLost.moveX, 1);
  assert.equal(afterLost.moveY, 0);
  assert.equal(rpgInput.keys.has("KeyD"), true);

  rpgInput.pointerEnd(3, "up");
  const afterSprint = rpgInput.sample();
  assert.equal(afterSprint.sprint, false);
  assert.equal(afterSprint.moveX, 1);
  assert.equal(afterSprint.dodge, false);
  assert.equal(afterSprint.interact, false);
  rpgInput.releaseTouch();
  const stillHeld = rpgInput.sample();
  assert.equal(stillHeld.moveX, 1);
  assert.equal(stillHeld.sprint, false);
  release("KeyD");
  const fingersUp = rpgInput.sample();
  assert.equal(fingersUp.moveX, 0);
  assert.equal(fingersUp.moveY, 0);
  assert.equal(fingersUp.sprint, false);
  assert.equal(fingersUp.dodge, false);
  assert.equal(fingersUp.interact, false);

  reset();
  rpgInput.pointerDown(1, "stick", 10, 30);
  rpgInput.pointerMove(1, 10 + STICK_RADIUS, 30);
  const east = rpgInput.sample();
  near(east.moveX, 1, "east");
  near(east.moveY, 0, "east y");
  rpgInput.pointerMove(1, 10, 30 - STICK_RADIUS);
  const north = rpgInput.sample();
  near(north.moveX, 0, "north x");
  near(north.moveY, 1, "north");
  rpgInput.pointerMove(1, 10 - STICK_RADIUS, 30);
  const west = rpgInput.sample();
  near(west.moveX, -1, "west");
  near(west.moveY, 0, "west y");
  assert.equal(west.sprint, false);

  reset();
  rpgInput.pointerDown(1, "stick", 0, 0);
  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  rpgInput.pointerDown(3, "sprint", 0, 0);
  rpgInput.pointerDown(4, "dodge", 0, 0);
  rpgInput.pointerDown(5, "interact", 0, 0);
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.setState({ panel: null });
  useRpg.getState().setPanel("inventory");
  const opened = rpgInput.sample();
  assert.equal(opened.moveX, 0);
  assert.equal(opened.moveY, 0);
  assert.equal(opened.sprint, false);
  assert.equal(opened.dodge, false);
  assert.equal(opened.interact, false);
  assert.equal(opened.dodgeCount, 0);
  assert.equal(opened.interactCount, 0);
  assert.equal(rpgInput.joyX, 0);
  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  assert.equal(rpgInput.joyX, 0, "a finger cleared by the panel must not revive");
  useRpg.getState().setPanel(null);

  reset();
  press("KeyW");
  rpgInput.pointerDown(1, "stick", 0, 0);
  rpgInput.pointerMove(1, 0, -half);
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.setState({ panel: null });
  useRpg.getState().setPanel("inventory");
  const keyedPanel = rpgInput.sample();
  assert.ok(keyedPanel.moveY > 0, "a key still held survives the panel");
  assert.equal(rpgInput.joyY, 0);
  assert.equal(keyedPanel.sprint, false);
  useRpg.getState().setPanel(null);
  release("KeyW");

  reset();
  press("KeyA");
  rpgInput.pointerDown(1, "stick", 0, 0);
  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  rpgInput.pointerDown(3, "sprint", 0, 0);
  rpgInput.tap("dodge");
  rpgInput.tap("interact");
  document.hidden = true;
  documentHandlers.visibilitychange();
  document.hidden = false;
  const shown = rpgInput.sample();
  assert.equal(shown.moveX, 0);
  assert.equal(shown.moveY, 0);
  assert.equal(shown.sprint, false);
  assert.equal(shown.dodge, false);
  assert.equal(shown.interact, false);
  assert.equal(shown.lookX, 0);
  rpgInput.pointerMove(1, STICK_RADIUS, 0);
  assert.equal(rpgInput.joyX, 0);
  assert.equal(rpgInput.sample().moveX, 0);

  const views = [
    { width: 360, height: 640, insets: { top: 24, right: 12, bottom: 28, left: 12 } },
    { width: 390, height: 844, insets: { top: 47, right: 16, bottom: 34, left: 16 } },
    { width: 844, height: 390, insets: { top: 12, right: 28, bottom: 16, left: 44 } },
  ];
  const zones = ["stick", "look", "sprint", "dodge", "interact"];
  const overlaps = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const view of views) {
    for (const side of ["top", "right", "bottom", "left"])
      assert.ok(view.insets[side] > 0, view.width + " inset " + side);
    const layout = touchLayout(view.width, view.height, view.insets);
    for (let i = 0; i < zones.length; i++) {
      const rect = layout[zones[i]];
      assert.ok(rect.w >= 44 && rect.h >= 44, zones[i] + " tap " + view.width);
      assert.ok(rect.x >= view.insets.left, zones[i] + " left " + view.width);
      assert.ok(rect.y >= view.insets.top, zones[i] + " top " + view.width);
      assert.ok(rect.x + rect.w <= view.width - view.insets.right, zones[i] + " right " + view.width);
      assert.ok(rect.y + rect.h <= view.height - view.insets.bottom, zones[i] + " bottom " + view.width);
      for (let j = i + 1; j < zones.length; j++)
        assert.equal(overlaps(rect, layout[zones[j]]), false, zones[i] + " overlaps " + zones[j] + " at " + view.width);
    }
  }

  document.hidden = false;
  document.pointerLockElement = null;
  useRpg.getState().setPanel(null);
  useGame.setState({ phase: "playing", plaqueId: null });
  reset();
});
test("new builds keep doorways clear and old obstacles still relocate travel", () => {
  const groundOk = (kind, x, z, rotation) =>
    validatePlacement(kind, x, z, rotation, [], undefined, false) == null;
  let cover = null;
  let swing = null;
  for (const recipe of RECIPES) {
    if (recipe.width === recipe.depth || (cover && swing)) continue;
    let covered = null;
    let crossed = null;
    for (const site of CAMPUS_SITES) {
      if (site.form || (covered && crossed)) continue;
      const door = siteEntrance(site);
      for (let dx = -4; dx <= 4 && (!covered || !crossed); dx += 0.5) {
        for (let dz = -4; dz <= 4 && (!covered || !crossed); dz += 0.5) {
          const x = door.x + dx;
          const z = door.z + dz;
          const upright = doorOverlap(recipe.id, x, z, 0);
          const turned = doorOverlap(recipe.id, x, z, Math.PI / 2);
          if (!covered && upright.entrance && groundOk(recipe.id, x, z, 0))
            covered = { site, recipe, x, z, rotation: 0 };
          if (!covered && turned.entrance && groundOk(recipe.id, x, z, Math.PI / 2))
            covered = { site, recipe, x, z, rotation: Math.PI / 2 };
          if (!crossed && upright.passage !== turned.passage) {
            const rotation = upright.passage ? 0 : Math.PI / 2;
            const other = rotation === 0 ? Math.PI / 2 : 0;
            const crossing = rotation === 0 ? upright : turned;
            const missing = rotation === 0 ? turned : upright;
            if (
              crossing.passage &&
              !missing.passage &&
              groundOk(recipe.id, x, z, rotation)
            )
              crossed = { site, recipe, x, z, rotation, other };
          }
        }
      }
    }
    if (covered && crossed) {
      cover = covered;
      swing = crossed;
    }
  }
  assert.ok(cover, "need a real entrance a facility can cover");
  assert.ok(swing, "need a rotation that crosses the short passage");
  assert.equal(cover.recipe.id, swing.recipe.id);
  assert.equal(doorOverlap(swing.recipe.id, swing.x, swing.z, swing.rotation).passage, true);
  assert.equal(doorOverlap(swing.recipe.id, swing.x, swing.z, swing.other).passage, false);
  assert.equal(doorOverlap(cover.recipe.id, cover.x, cover.z, cover.rotation).entrance, true);

  const counts = () => ({
    notes: inventory.count("notes"),
    parts: inventory.count("parts"),
    credit: inventory.count("credit"),
  });
  const buildings = () => useRpg.getState().buildings.map((b) => ({ ...b }));
  const standBack = (spot) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: spot.x + 30,
      playerZ: spot.z,
      playerYaw: 0,
    });
    useRpg.setState({
      hp: 100,
      interiorId: null,
      panel: null,
      buildKind: null,
      rotation: spot.rotation ?? 0,
    });
  };
  const refused = (spot) => {
    standBack(spot);
    const before = { counts: counts(), buildings: buildings() };
    useRpg.getState().chooseBuild(spot.recipe.id);
    useRpg.setState({ rotation: spot.rotation });
    assert.equal(useRpg.getState().place(spot.x, spot.z), false);
    assert.deepEqual(counts(), before.counts);
    assert.deepEqual(buildings(), before.buildings);
  };

  useRpg.setState({ buildings: [] });
  refused(cover);
  refused(swing);

  let open = null;
  const away = { x: 0, z: -200 };
  for (let x = 20; x <= 140 && !open; x += 5)
    for (let z = -15; z >= -100 && !open; z -= 5)
      if (validatePlacement("desk", x, z, 0, [], away) == null) open = { x, z };
  assert.ok(open, "need open ground");
  const desk = RECIPES.find((recipe) => recipe.id === "desk");
  standBack({ ...open, rotation: 0 });
  const beforeOpen = counts();
  useRpg.getState().chooseBuild("desk");
  assert.equal(useRpg.getState().place(open.x, open.z), true);
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(useRpg.getState().buildings[0].kind, "desk");
  assert.equal(inventory.count("notes"), beforeOpen.notes - (desk.cost.notes ?? 0));
  assert.equal(inventory.count("parts"), beforeOpen.parts - (desk.cost.parts ?? 0));
  assert.equal(inventory.count("credit"), beforeOpen.credit - (desk.cost.credit ?? 0));
  assert.equal(useRpg.getState().place(open.x, open.z), false);
  assert.equal(inventory.count("notes"), beforeOpen.notes - (desk.cost.notes ?? 0));
  assert.equal(inventory.count("parts"), beforeOpen.parts - (desk.cost.parts ?? 0));

  const kind = cover.recipe.id;
  const savedHp = cover.recipe.health;
  const text = JSON.stringify({
    version: 2,
    hp: 90,
    departmentId: DEPARTMENTS[0].id,
    slots: [
      { itemId: "notes", quantity: 12 },
      { itemId: "parts", quantity: 12 },
      { itemId: "credit", quantity: 2 },
    ],
    buildings: [
      {
        id: "old-door",
        kind,
        x: cover.x,
        z: cover.z,
        rotation: cover.rotation,
        hp: savedHp,
      },
    ],
    position: { x: cover.x + 30, z: cover.z, yaw: 0 },
  });
  assert.equal(useRpg.getState().importSave(text), true);
  const kept = useRpg.getState().buildings.find((b) => b.id === "old-door");
  assert.ok(kept, "old doorway facility was dropped on restore");
  assert.equal(kept.kind, kind);
  assert.equal(kept.x, cover.x);
  assert.equal(kept.z, cover.z);
  assert.equal(doorOverlap(kept.kind, kept.x, kept.z, kept.rotation).entrance, true);
  standBack({ x: cover.x, z: cover.z, rotation: cover.rotation });
  useRpg.setState({ departmentId: DEPARTMENTS[0].id, hp: 100 });
  const beforeRetry = { counts: counts(), buildings: buildings() };
  useRpg.getState().chooseBuild(kind);
  useRpg.setState({ rotation: cover.rotation });
  assert.equal(useRpg.getState().place(cover.x, cover.z), false);
  assert.deepEqual(counts(), beforeRetry.counts);
  assert.deepEqual(buildings(), beforeRetry.buildings);

  const door = siteEntrance(cover.site);
  const stable = (point) => {
    const resolved = resolveBuildings(
      point.x,
      point.z,
      0.42,
      useRpg.getState().buildings,
    );
    return Math.hypot(resolved.x - point.x, resolved.z - point.z) < 0.05;
  };
  const outside = (point) => {
    const box = footprint(kept.kind, kept.rotation);
    return (
      Math.abs(point.x - kept.x) >= box.width / 2 ||
      Math.abs(point.z - kept.z) >= box.depth / 2
    );
  };
  const nearer = (point) => {
    const here = Math.hypot(point.x - door.x, point.z - door.z);
    const other = CAMPUS_SITES.find((site) => {
      if (site.id === cover.site.id) return false;
      return stable(siteEntrance(site));
    });
    assert.ok(other, "need another clear entrance");
    const there = siteEntrance(other);
    assert.ok(here < Math.hypot(there.x - door.x, there.z - door.z));
    assert.ok(here > 0.05);
  };
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.setState({ hp: 100, panel: null, interiorId: null });
  useRpg.getState().travel(cover.site.id);
  const traveled = { x: useGame.getState().playerX, z: useGame.getState().playerZ };
  assert.equal(useGame.getState().playerYaw, 0);
  assert.equal(stable(traveled), true);
  assert.equal(outside(traveled), true);
  nearer(traveled);
  useRpg.getState().enter(cover.site.id);
  assert.equal(useRpg.getState().interiorId, cover.site.id);
  useRpg.getState().exit();
  const left = { x: useGame.getState().playerX, z: useGame.getState().playerZ };
  assert.equal(useGame.getState().playerYaw, Math.PI);
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(stable(left), true);
  assert.equal(outside(left), true);
  nearer(left);

  useRpg.setState({ buildings: [], hp: 100, interiorId: null, panel: null });
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.getState().travel(cover.site.id);
  assert.equal(useGame.getState().playerX, door.x);
  assert.equal(useGame.getState().playerZ, door.z);
  assert.equal(useGame.getState().playerYaw, 0);
  useRpg.getState().enter(cover.site.id);
  useRpg.getState().exit();
  assert.equal(useGame.getState().playerX, door.x);
  assert.equal(useGame.getState().playerZ, door.z);
  assert.equal(useGame.getState().playerYaw, Math.PI);
});
test("intake follows the amount that entered the bag", () => {
  const home = { x: 45, z: -20 };
  const counts = () =>
    Object.fromEntries(ITEMS.map((item) => [item.id, inventory.count(item.id)]));
  const standAt = (point) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: point.x,
      playerZ: point.z,
      playerYaw: 0,
    });
    useRpg.setState({ hp: 100, panel: null, interiorId: null, buildKind: null });
  };
  const fillFull = () => {
    inventory.clear();
    let sawOverflow = false;
    for (let i = 0; i < 40 && !sawOverflow; i++) {
      const result = inventory.add("parts", 400);
      if (result.overflow > 0) sawOverflow = true;
    }
    assert.equal(sawOverflow, true);
    const probe = inventory.add("parts", 1);
    assert.equal(probe.added, 0);
    assert.ok(probe.overflow > 0);
  };
  const measurePartial = () => {
    fillFull();
    assert.equal(inventory.remove("parts", 1), true);
    const one = inventory.add("parts", 1);
    assert.equal(one.added, 1);
    assert.equal(one.overflow, 0);
    assert.equal(inventory.remove("parts", 1), true);
    const bulk = inventory.add("parts", 30);
    assert.ok(bulk.overflow > 0);
    const free = bulk.added;
    assert.equal(inventory.remove("parts", free), true);
    assert.equal(free, 1);
    return free;
  };
  const plant = (kind) => {
    standAt(home);
    const recipe = RECIPES.find((item) => item.id === kind);
    for (const [id, n] of Object.entries(recipe.cost)) {
      if (inventory.count(id) < n) assert.equal(inventory.add(id, n).overflow, 0);
    }
    const buildings = useRpg.getState().buildings;
    const player = { x: home.x, z: home.z };
    let spot = null;
    for (let x = 20; x <= 160 && !spot; x += 5)
      for (let z = -15; z >= -120 && !spot; z -= 5)
        if (validatePlacement(kind, x, z, 0, buildings, player) == null)
          spot = { x, z };
    assert.ok(spot, "need a legal spot for " + kind);
    useRpg.getState().chooseBuild(kind);
    assert.equal(useRpg.getState().place(spot.x, spot.z), true);
    useRpg.getState().cancelBuild();
    return useRpg.getState().buildings.at(-1);
  };
  const settled = (before, grant, free) => {
    const now = counts();
    const got = {};
    for (const item of ITEMS) {
      const delta = now[item.id] - before[item.id];
      if (delta) got[item.id] = delta;
    }
    const piles = useRpg.getState().loot;
    assert.ok(piles.length <= 1);
    const left = piles[0]?.items ?? {};
    let accepted = 0;
    for (const [id, n] of Object.entries(grant)) {
      if (!n) continue;
      const gain = got[id] ?? 0;
      assert.equal(gain + (left[id] ?? 0), n, id);
      accepted += gain;
    }
    for (const id of Object.keys(got)) assert.ok((grant[id] ?? 0) >= got[id], id);
    const room = Math.min(free, grant.parts ?? 0);
    assert.equal(got.parts ?? 0, room);
    assert.equal(accepted, room);
  };
  const noticeOf = (bagIds, groundIds) => {
    const notice = useRpg.getState().notice;
    const bagAt = notice.indexOf("已入袋");
    const groundAt = notice.indexOf("留在地面");
    if (!bagIds.length) assert.equal(bagAt, -1, notice);
    if (!groundIds.length) assert.equal(groundAt, -1, notice);
    if (bagIds.length && groundIds.length) assert.ok(groundAt > bagAt, notice);
    const bagText = bagAt < 0 ? "" : notice.slice(bagAt, groundAt < 0 ? undefined : groundAt);
    const groundText = groundAt < 0 ? "" : notice.slice(groundAt);
    for (const id of bagIds) {
      const name = ITEMS.find((item) => item.id === id).name;
      assert.ok(bagText.includes(name), notice);
    }
    for (const id of groundIds) {
      const name = ITEMS.find((item) => item.id === id).name;
      assert.ok(groundText.includes(name), notice);
      if (!bagIds.includes(id)) assert.equal(bagText.includes(name), false, notice);
    }
  };
  const still = (run) => {
    const before = counts();
    const ground = useRpg.getState().loot.map((pile) => ({
      id: pile.id,
      x: pile.x,
      z: pile.z,
      items: pile.items,
    }));
    run();
    assert.deepEqual(counts(), before);
    assert.deepEqual(
      useRpg.getState().loot.map((pile) => ({
        id: pile.id,
        x: pile.x,
        z: pile.z,
        items: pile.items,
      })),
      ground,
    );
  };
  const positiveIds = (items) =>
    Object.entries(items)
      .filter(([, n]) => n > 0)
      .map(([id]) => id);

  useRpg.setState({ buildings: [], loot: [], harvested: {}, claimed: [] });
  const barrier = RECIPES.find((item) => item.id === "barrier");
  const refund = { parts: Math.floor(barrier.cost.parts / 2) };
  const built = plant("barrier");
  fillFull();
  standAt(home);
  let before = counts();
  useRpg.getState().demolish(built.id);
  settled(before, refund, 0);
  noticeOf([], ["parts"]);
  assert.ok(useRpg.getState().notice.includes("設施已拆除"));
  still(() => useRpg.getState().demolish(built.id));

  useRpg.setState({ buildings: [], loot: [] });
  const again = plant("barrier");
  const free = measurePartial();
  standAt(home);
  before = counts();
  useRpg.getState().demolish(again.id);
  settled(before, refund, free);
  noticeOf(["parts"], ["parts"]);
  still(() => useRpg.getState().demolish(again.id));

  const node = SUPPLY_NODES[0];
  useRpg.setState({ loot: [], harvested: {}, buildings: [] });
  fillFull();
  standAt(node);
  before = counts();
  assert.equal(useRpg.getState().interact(), true);
  assert.ok(useRpg.getState().harvested[node.id] > Date.now());
  settled(before, node.items, 0);
  noticeOf([], positiveIds(node.items));
  still(() => useRpg.getState().interact());

  useRpg.setState({ loot: [], harvested: {} });
  measurePartial();
  standAt(node);
  before = counts();
  assert.equal(useRpg.getState().interact(), true);
  settled(before, node.items, free);
  noticeOf(["parts"], positiveIds(node.items));
  still(() => useRpg.getState().interact());

  const mission = MISSIONS.find((item) => item.id === "first");
  useRpg.setState({ loot: [], claimed: [], kills: mission.target });
  fillFull();
  standAt(home);
  before = counts();
  useRpg.getState().claim(mission.id);
  assert.ok(useRpg.getState().claimed.includes(mission.id));
  settled(before, mission.reward, 0);
  noticeOf([], positiveIds(mission.reward));
  still(() => useRpg.getState().claim(mission.id));

  useRpg.setState({ loot: [], claimed: [], kills: mission.target });
  measurePartial();
  standAt(home);
  before = counts();
  useRpg.getState().claim(mission.id);
  settled(before, mission.reward, free);
  noticeOf(["parts"], positiveIds(mission.reward));
  still(() => useRpg.getState().claim(mission.id));

  useRpg.setState({
    loot: [],
    buildings: [],
    interiorId: null,
    panel: null,
    buildKind: null,
    attackUntil: 0,
    enemies: ENCOUNTERS.map((enemy) => ({
      ...enemy,
      anchorX: enemy.x,
      anchorZ: enemy.z,
      hp: ENEMY_TYPES[enemy.kind].hp,
      state: "idle",
      timer: 0,
      hurt: 0,
    })),
  });
  const enemy = useRpg.getState().enemies.find((entry) => entry.kind === "quiz");
  enemy.hp = 1;
  fillFull();
  standAt({ x: enemy.x, z: enemy.z + 3 });
  before = counts();
  useRpg.getState().attack();
  assert.equal(enemy.hp, 0);
  assert.equal(useRpg.getState().notice.includes("已入袋"), false);
  const reward = { ...ENEMY_TYPES[enemy.kind].reward };
  settled(before, reward, 0);
  standAt(enemy);
  before = counts();
  assert.equal(useRpg.getState().interact(), true);
  settled(before, reward, 0);
  noticeOf([], positiveIds(reward));
  still(() => useRpg.getState().interact());

  measurePartial();
  standAt(enemy);
  before = counts();
  const carried = { ...useRpg.getState().loot[0].items };
  assert.equal(useRpg.getState().interact(), true);
  settled(before, carried, free);
  noticeOf(
    ["parts"],
    positiveIds(carried).filter((id) => carried[id] > (id === "parts" ? free : 0)),
  );
  still(() => useRpg.getState().interact());

  useRpg.setState({ buildings: [], loot: [], harvested: {}, claimed: [] });
  inventory.clear();
  assert.equal(inventory.add("parts", 30).overflow, 0);
  const first = plant("barrier");
  const second = plant("barrier");
  fillFull();
  standAt(home);
  before = counts();
  useRpg.getState().demolish(first.id);
  useRpg.getState().demolish(second.id);
  assert.equal(useRpg.getState().buildings.length, 0);
  assert.equal(useRpg.getState().loot.length, 1);
  assert.equal(useRpg.getState().loot[0].items.parts, refund.parts * 2);
  assert.equal(inventory.count("parts"), before.parts);

  const qty = useRpg.getState().loot[0].items.parts;
  assert.equal(inventory.remove("parts", qty), true);
  const cooled = {};
  for (const supply of SUPPLY_NODES) cooled[supply.id] = Date.now() + 180_000;
  useRpg.setState({ harvested: cooled });
  flushSave();
  const text = savedData.get(RPG_SAVE_KEY);
  const saved = JSON.parse(text);
  const slotCount = (slots) => {
    const totals = Object.fromEntries(ITEMS.map((item) => [item.id, 0]));
    for (const slot of slots) totals[slot.itemId] += slot.quantity;
    return totals;
  };
  const savedBag = slotCount(saved.slots);
  const savedGround = saved.loot[0].items.parts;
  assert.equal(saved.version, 2);
  assert.equal(saved.loot.length, 1);
  assert.equal(savedGround, qty);
  inventory.add("parts", 1);
  useRpg.setState({ loot: [] });
  assert.equal(useRpg.getState().importSave(text), true);
  for (const item of ITEMS) assert.equal(inventory.count(item.id), savedBag[item.id]);
  assert.equal(useRpg.getState().loot.length, 1);
  assert.equal(useRpg.getState().loot[0].items.parts, savedGround);
  const pile = useRpg.getState().loot[0];
  standAt(pile);
  assert.equal(useRpg.getState().interact(), true);
  assert.equal(inventory.count("parts"), savedBag.parts + savedGround);
  assert.equal(useRpg.getState().loot.length, 0);
  assert.equal(useRpg.getState().notice.includes("已入袋"), true);
  assert.equal(useRpg.getState().notice.includes("留在地面"), false);
  const picked = inventory.count("parts");
  useRpg.getState().interact();
  assert.equal(inventory.count("parts"), picked);
  assert.equal(useRpg.getState().importSave(text), true);
  for (const item of ITEMS) assert.equal(inventory.count(item.id), savedBag[item.id]);
  assert.equal(useRpg.getState().loot.length, 1);
  assert.equal(useRpg.getState().loot[0].items.parts, savedGround);
});
test("basic attacks hit the nearest legal enemy and the hud reads that swing", () => {
  const player = { x: -5, z: -45 };
  const stand = (yaw = 0) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: player.x,
      playerZ: player.z,
      playerYaw: yaw,
    });
    useRpg.setState({
      hp: 100,
      focus: 100,
      attackUntil: 0,
      skillUntil: 0,
      panel: null,
      interiorId: null,
      buildKind: null,
      clock: 10,
    });
  };
  const roster = () => useRpg.getState().enemies;
  const park = (keep) => {
    for (const enemy of roster()) {
      if (keep.includes(enemy)) continue;
      enemy.hp = 0;
      enemy.x = 500;
      enemy.z = 500;
    }
  };
  const arrange = (first, second) => {
    const rest = roster().filter((enemy) => enemy !== first && enemy !== second);
    useRpg.setState({ enemies: [first, second, ...rest] });
  };
  const struck = () => useRpg.getState().attackFx.hits;
  const inArc = (enemy, yaw = 0) =>
    withinAttack(
      player.x,
      player.z,
      yaw,
      enemy.x,
      enemy.z,
      BASIC_ATTACK_RANGE,
      false,
    );
  const [near, far] = roster();
  near.hp = 400;
  far.hp = 400;
  near.x = player.x;
  near.z = player.z - 1.2;
  far.x = player.x;
  far.z = player.z - 3;
  park([near, far]);
  assert.ok(
    Math.hypot(near.x - player.x, near.z - player.z) <
      Math.hypot(far.x - player.x, far.z - player.z),
  );
  assert.equal(inArc(near), true);
  assert.equal(inArc(far), true);

  stand();
  arrange(far, near);
  useRpg.setState({ buildings: [], loot: [] });
  const nearOpen = near.hp;
  const farOpen = far.hp;
  useRpg.getState().attack();
  assert.ok(near.hp < nearOpen);
  assert.equal(far.hp, farOpen);
  assert.deepEqual(struck(), [near.id]);

  stand();
  arrange(near, far);
  const nearFlipped = near.hp;
  const farFlipped = far.hp;
  useRpg.getState().attack();
  assert.ok(near.hp < nearFlipped);
  assert.equal(far.hp, farFlipped);
  assert.deepEqual(struck(), [near.id]);

  near.hp = 400;
  far.hp = 400;
  near.x = player.x + 2.2;
  near.z = player.z - 0.8;
  far.x = player.x;
  far.z = player.z - 3;
  assert.ok(
    Math.hypot(near.x - player.x, near.z - player.z) <
      Math.hypot(far.x - player.x, far.z - player.z),
  );
  assert.equal(inArc(near), true);
  assert.equal(inArc(far), true);
  stand();
  arrange(near, far);
  useRpg.setState({ buildings: [] });
  useRpg.getState().attack();
  assert.ok(near.hp < 400);
  assert.equal(far.hp, 400);
  assert.deepEqual(struck(), [near.id]);

  near.hp = 400;
  far.hp = 400;
  stand();
  useRpg.setState({
    buildings: [
      {
        id: "swing-wall",
        kind: "lantern",
        x: player.x + 1.1,
        z: player.z - 0.4,
        rotation: 0,
        hp: 120,
      },
    ],
  });
  useRpg.getState().attack();
  assert.equal(near.hp, 400);
  assert.ok(far.hp < 400);
  assert.deepEqual(struck(), [far.id]);
  assert.equal(struck().includes(near.id), false);

  near.hp = 400;
  far.hp = 400;
  near.x = player.x;
  near.z = player.z + 1.5;
  far.x = player.x;
  far.z = player.z - 2.4;
  useRpg.setState({ buildings: [] });
  assert.equal(inArc(near), false);
  assert.equal(inArc(far), true);
  stand();
  const behind = near.hp;
  const front = far.hp;
  useRpg.getState().attack();
  assert.equal(near.hp, behind);
  assert.ok(far.hp < front);
  assert.equal(struck().includes(near.id), false);

  near.hp = 400;
  far.hp = 400;
  near.x = player.x;
  near.z = player.z - 1.4;
  far.x = player.x;
  far.z = player.z - 8;
  assert.equal(inArc(near), true);
  assert.equal(inArc(far), false);
  stand();
  const close = near.hp;
  const distant = far.hp;
  useRpg.getState().attack();
  assert.ok(near.hp < close);
  assert.equal(far.hp, distant);
  assert.equal(struck().includes(far.id), false);
  assert.deepEqual(struck(), [near.id]);

  near.hp = 0;
  far.hp = 400;
  near.x = player.x;
  near.z = player.z - 1;
  far.x = player.x;
  far.z = player.z - 2.8;
  stand();
  useRpg.getState().attack();
  assert.equal(near.hp, 0);
  assert.ok(far.hp < 400);
  assert.equal(struck().includes(near.id), false);
  assert.deepEqual(struck(), [far.id]);

  near.hp = 400;
  far.hp = 400;
  near.x = player.x;
  near.z = player.z - 1.6;
  far.x = player.x;
  far.z = player.z - 2.8;
  stand(Math.PI);
  const missedNear = near.hp;
  const missedFar = far.hp;
  useRpg.getState().attack();
  assert.equal(near.hp, missedNear);
  assert.equal(far.hp, missedFar);
  assert.deepEqual(struck(), []);

  near.hp = 500;
  far.hp = 500;
  near.x = player.x - 1;
  near.z = player.z - 2;
  far.x = player.x + 1;
  far.z = player.z - 2.5;
  const discipline =
    DISCIPLINES[
      DEPARTMENTS.find((dept) => dept.id === useRpg.getState().departmentId)
        .discipline
    ];
  assert.equal(
    withinAttack(player.x, player.z, 0, near.x, near.z, discipline.range, true),
    true,
  );
  assert.equal(
    withinAttack(player.x, player.z, 0, far.x, far.z, discipline.range, true),
    true,
  );
  stand();
  useRpg.setState({ buildings: [], loot: [] });
  const focusBefore = useRpg.getState().focus;
  const skillNear = near.hp;
  const skillFar = far.hp;
  useRpg.getState().attack(true);
  assert.ok(near.hp < skillNear);
  assert.ok(far.hp < skillFar);
  assert.ok(useRpg.getState().focus < focusBefore);
  assert.deepEqual(struck().slice().sort(), [near.id, far.id].sort());
  const focusOnce = useRpg.getState().focus;
  const heldNear = near.hp;
  const heldFar = far.hp;
  useRpg.getState().attack(true);
  assert.equal(near.hp, heldNear);
  assert.equal(far.hp, heldFar);
  assert.equal(useRpg.getState().focus, focusOnce);

  stand();
  useRpg.setState({ loot: [], buildings: [] });
  near.hp = 1;
  far.hp = 0;
  near.x = player.x;
  near.z = player.z - 1.5;
  const bag = () => ITEMS.map((item) => inventory.count(item.id)).join(",");
  const beforeBag = bag();
  useRpg.getState().attack();
  assert.equal(near.hp, 0);
  assert.ok(useRpg.getState().loot.length >= 1);
  assert.equal(bag(), beforeBag);
  assert.deepEqual(struck(), [near.id]);

  const hud = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../src/game/rpg/AdventureCombatHud.tsx",
    ),
    "utf8",
  );
  assert.match(hud, /attackFx\?\.hits/);
});

test("chromescale shares one depth budget across title play bag and map", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const dialog = read("../src/game/rpg/DialogFrame.tsx");
  const world = read("../src/game/rpg/AdventureWorld.tsx");
  const app = read("../src/game/rpg/AdventureApp.tsx");
  const chrome = read("../src/game/rpg/chrome.ts");
  const rule = (selector) => {
    const start = css.indexOf(selector + " {");
    assert.ok(start >= 0, selector);
    return css.slice(start, css.indexOf("}", start));
  };

  const condition = { time: "day", tier: "high" };
  const labels = r.CHROME_SURFACES.map((surface) => r.primaryLabel(surface, condition));
  for (const label of labels) assert.deepEqual(label, labels[0]);
  assert.deepEqual(r.primaryLabel("dialog", condition), labels[0]);
  assert.deepEqual(r.primaryLabel("sign", condition), labels[0]);
  assert.equal(labels[0].typeSize, r.CHROME_SCALE.type.primary);
  assert.equal(labels[0].spacing, r.CHROME_SCALE.spacing.primary);
  assert.equal(labels[0].lightEdge, r.CHROME_SCALE.lightEdge);
  assert.equal(labels[0].material, r.CHROME_SCALE.material);
  assert.equal(labels[0].state, r.CHROME_SCALE.state.idle);
  assert.equal(labels[0].depth, r.CHROME_SCALE.depth.readout);
  assert.ok(labels[0].alpha > 0 && labels[0].alpha < 1);

  const blocks = (selector) => {
    const found = [];
    const needle = selector + " {";
    let from = 0;
    while (from < css.length) {
      const start = css.indexOf(needle, from);
      if (start < 0) break;
      const end = css.indexOf("}", start);
      found.push(css.slice(start, end));
      from = end + 1;
    }
    assert.ok(found.length >= 1, selector);
    return found;
  };
  const painted = (block, vars) => {
    const declared = [...block.matchAll(/color:\s*([^;]+)/g)].map((match) => match[1].trim());
    return declared.map((value) => {
      const variable = value.match(/^var\((--ad-[a-z0-9-]+)\)/);
      if (variable) {
        assert.equal(typeof vars[variable[1]], "string", value);
        return vars[variable[1]];
      }
      assert.match(value, /^#[0-9a-fA-F]{3,8}$/, value);
      return value;
    });
  };
  const copySelectors = [
    [".ad-item-detail p", "backpack"],
    [".ad-item-detail > small", "backpack"],
    [".ad-section-line > span", "backpack"],
    [".ad-map-list > button > b", "map"],
  ];

  for (const time of ["day", "sunset", "night"]) {
    assert.equal(r.skyFor(time), r.TIME_PRESETS[time].sky);
    for (const tier of ["high", "low"]) {
      const label = r.primaryLabel("title", { time, tier });
      assert.deepEqual(label, r.primaryLabel("hud", { time, tier }));
      assert.deepEqual(label, r.primaryLabel("backpack", { time, tier }));
      assert.deepEqual(label, r.primaryLabel("map", { time, tier }));
      assert.deepEqual(label, r.primaryLabel("dialog", { time, tier }));
      assert.equal(r.readable(label.ink, label.backing, r.skyFor(time), label.alpha), true);
      const vars = r.chromeVars({ time, tier }, false);
      for (const [selector, surface] of copySelectors) {
        const surfaceLabel = r.primaryLabel(surface, { time, tier });
        const colors = blocks(selector).flatMap((block) => painted(block, vars));
        assert.ok(colors.length >= 1, selector);
        for (const color of colors) {
          assert.equal(
            r.readable(color, surfaceLabel.backing, r.skyFor(time), surfaceLabel.alpha),
            true,
            selector + " " + time,
          );
        }
      }
      const code = painted(blocks(".ad-map-list > button > b")[0], vars)[0];
      const hover = blocks(".ad-map-list > button:hover")[0].match(/background:\s*([^;]+)/);
      assert.ok(hover, "map hover backing");
      assert.equal(r.readable(code, hover[1].trim(), r.skyFor(time), 1), true);
    }
  }
  assert.equal(r.readable("#777777", "#888888", r.skyFor("day"), 1), false);
  assert.equal(r.readable(r.CHROME_SCALE.ink, r.CHROME_SCALE.ink, r.skyFor("day"), 0), true);
  assert.equal(r.readable(r.CHROME_SCALE.ink, r.CHROME_SCALE.ink, r.skyFor("day"), 1), false);

  const depth = r.chromeDepth();
  assert.ok(depth.decor.depth < depth.readout.depth);
  assert.equal(depth.decor.pointerEvents, "none");
  assert.match(rule(".ad-depth"), /pointer-events:\s*none/);
  assert.match(rule(".ad-depth"), /z-index:\s*var\(--ad-depth-decor\)/);
  assert.match(css, /z-index:\s*var\(--ad-depth-readout\)/);
  assert.match(hud, /className="ad-depth ad-sheen"/);
  assert.match(dialog, /className="ad-depth ad-sheen"/);
  assert.match(hud, /<h1 className="ad-primary-label">/);
  assert.match(hud, /ad-primary-label">\{dept/);
  assert.match(hud, /<h3 className="ad-primary-label">隨身物品<\/h3>/);
  assert.match(hud, /<h3 className="ad-primary-label">校園建築<\/h3>/);
  assert.match(dialog, /<h2 className="ad-primary-label">/);
  assert.match(rule(".ad-title"), /var\(--ad-plate\)/);
  assert.match(rule(".ad-status"), /var\(--ad-plate\)/);
  assert.match(rule(".ad-dialog"), /var\(--ad-plate\)/);
  assert.match(rule(".ad-primary-label"), /var\(--ad-type\)/);
  assert.match(hud, /<button/);
  assert.match(dialog, /<button/);
  assert.match(dialog, /role="dialog"/);
  assert.doesNotMatch(hud, /<Canvas|<mesh|<sprite/);
  assert.doesNotMatch(chrome, /from ["']three["']/);
  assert.equal(app.match(/<Canvas/g).length, 1);

  assert.equal(r.signHost().marker, "scene");
  assert.equal(r.signHost().wording, "dom");
  assert.match(hud, /plaque\.blurb/);
  assert.match(hud, /data-sign-wording=\{signHost\(\)\.wording\}/);
  assert.match(world, /signHost\(\)/);
  assert.match(world, /<sprite/);
  assert.doesNotMatch(world, /blurb/);

  assert.deepEqual(r.controlLabels("high", false), r.controlLabels("low", true));
  assert.deepEqual(r.controlLabels("low", false), r.controlLabels("high", true));
  assert.match(hud, /CHROME_CONTROLS/);
  assert.match(hud, /chromeVars\(/);
  assert.match(hud, /prefers-reduced-motion/);
  assert.match(dialog, /CHROME_CONTROLS\.close/);
  for (const label of r.controlLabels("low", true)) assert.ok(chrome.includes(label));

  const full = r.chromeBudget("high", false);
  const low = r.chromeBudget("low", false);
  const reduced = r.chromeBudget("high", true);
  assert.ok(low.layers <= full.layers);
  assert.ok(low.blur <= full.blur);
  assert.ok(low.shadow <= full.shadow);
  assert.ok(low.motion <= full.motion);
  assert.equal(low.motion, 0);
  assert.equal(low.blur, 0);
  assert.equal(low.shadow, 0);
  assert.equal(reduced.motion, 0);
  assert.equal(reduced.blur, 0);
  assert.equal(reduced.shadow, 0);
  assert.ok(reduced.layers <= full.layers);
  assert.ok(full.motion > low.motion);
  const vars = r.chromeVars(condition, false);
  const lowVars = r.chromeVars({ time: "night", tier: "low" }, true);
  assert.equal(vars["--ad-ink"], labels[0].ink);
  assert.equal(vars["--ad-edge"], labels[0].lightEdge);
  assert.equal(vars["--ad-type"], labels[0].typeSize + "px");
  assert.equal(vars["--ad-space"], labels[0].spacing + "px");
  assert.equal(vars["--ad-state"], labels[0].state);
  assert.equal(Number(vars["--ad-layers"]), full.layers);
  assert.equal(Number.parseFloat(vars["--ad-blur"]), full.blur);
  assert.equal(Number.parseFloat(vars["--ad-shadow"]), full.shadow);
  assert.equal(Number(vars["--ad-motion"]), full.motion);
  assert.equal(Number(lowVars["--ad-layers"]), low.layers);
  assert.equal(Number.parseFloat(lowVars["--ad-blur"]), low.blur);
  assert.equal(Number.parseFloat(lowVars["--ad-shadow"]), low.shadow);
  assert.equal(Number(lowVars["--ad-motion"]), 0);
  assert.equal(lowVars["--ad-show-material"], "none");
  assert.equal(lowVars["--ad-show-edge"], "none");
  assert.equal(vars["--ad-show-material"], "block");
  for (const name of ["--ad-layers", "--ad-blur", "--ad-shadow", "--ad-motion", "--ad-show-material", "--ad-show-edge", "--ad-plate", "--ad-edge", "--ad-space"]) {
    assert.match(css, new RegExp("var\\(" + name + "\\)"));
  }
  const motionAt = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(motionAt > css.indexOf("@keyframes ad-edge-sheen"));
  const motion = css.slice(motionAt);
  assert.match(motion, /\.ad-ui/);
  assert.match(motion, /\.ad-depth/);
  assert.match(motion, /\.ad-sheen/);
  assert.match(motion, /animation:\s*none/);
  assert.match(motion, /transition:\s*none/);
});

test("pressface shares one raised language across controls", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const dialog = read("../src/game/rpg/DialogFrame.tsx");
  const combat = read("../src/game/rpg/AdventureCombatHud.tsx");
  const day = { time: "day", tier: "high" };
  assert.deepEqual(r.primaryLabel("title", day), r.primaryLabel("hud", day));
  assert.deepEqual(r.primaryLabel("backpack", day), r.primaryLabel("map", day));
  assert.equal(r.primaryLabel("title", day).ink, r.CHROME_SCALE.ink);
  assert.equal(r.primaryLabel("title", day).backing, r.CHROME_SCALE.backing);
  assert.equal(r.primaryLabel("title", day).state, r.CHROME_SCALE.state.idle);

  assert.deepEqual(r.PRESS_PIECES, ["button", "icon", "card", "key", "overlay"]);
  assert.deepEqual(r.PRESS_STATES, ["ready", "pressed", "selected", "focus", "disabled", "waiting"]);
  const roles = Object.keys(r.PRESS_ROLES);
  assert.deepEqual(roles, ["confirm", "cancel", "back", "import"]);
  for (const role of roles) {
    const high = r.pressFace("button", "ready", day, false, role);
    const low = r.pressFace("overlay", "waiting", { time: "night", tier: "low" }, true, role);
    assert.equal(high.label, r.PRESS_ROLES[role]);
    assert.equal(low.label, high.label);
    assert.deepEqual(high.budget, r.chromeBudget("high", false));
    assert.deepEqual(low.budget, r.chromeBudget("low", true));
    assert.equal(low.activatable, false);
  }
  assert.equal(r.PRESS_ROLES.confirm, "保留現有進度");
  assert.equal(r.PRESS_ROLES.cancel, "關閉");
  assert.equal(r.PRESS_ROLES.cancel, r.CHROME_CONTROLS.close);
  assert.equal(r.PRESS_ROLES.back, "返回校園");
  assert.equal(r.PRESS_ROLES.back, r.CHROME_CONTROLS.exitCampus);
  assert.equal(r.PRESS_ROLES.import, "匯入存檔");

  const seen = new Set();
  for (const state of r.PRESS_STATES) {
    const base = r.pressFace(r.PRESS_PIECES[0], state, day, false, "confirm");
    seen.add(`${base.thickness}|${base.light}|${base.sheen}|${base.shift}`);
    for (const piece of r.PRESS_PIECES) {
      for (const role of roles) {
        const face = r.pressFace(piece, state, day, false, role);
        assert.equal(face.piece, piece);
        assert.equal(face.state, state);
        assert.equal(face.role, role);
        assert.equal(face.label, r.PRESS_ROLES[role]);
        assert.equal(face.thickness, base.thickness);
        assert.equal(face.light, base.light);
        assert.equal(face.sheen, base.sheen);
        assert.equal(face.shift, base.shift);
        assert.equal(face.activatable, base.activatable);
        assert.deepEqual(face.budget, r.chromeBudget(day.tier, false));
      }
    }
  }
  assert.equal(seen.size, r.PRESS_STATES.length);
  const cheapSigs = new Set();
  for (const state of r.PRESS_STATES) {
    const face = r.pressFace("card", state, { time: "sunset", tier: "low" }, true);
    assert.equal(face.shift, 0);
    assert.deepEqual(face.budget, r.chromeBudget("low", true));
    cheapSigs.add(`${face.thickness}|${face.light}|${face.sheen}`);
  }
  assert.equal(cheapSigs.size, r.PRESS_STATES.length);
  assert.equal(r.pressFace("button", "ready", day).activatable, true);
  assert.equal(r.pressFace("icon", "disabled", day).activatable, false);
  assert.equal(r.pressFace("key", "waiting", day).activatable, false);
  assert.equal(r.pressFace("overlay", "focus", day).activatable, true);

  const waiting = r.pressAttrs("button", "waiting");
  assert.equal(waiting["data-press"], "waiting");
  assert.equal(waiting.disabled, true);
  assert.equal(waiting["aria-disabled"], true);
  assert.equal(waiting["aria-busy"], true);
  const disabled = r.pressAttrs("icon", "disabled");
  assert.equal(disabled.disabled, true);
  assert.equal(disabled["aria-disabled"], true);
  assert.equal(disabled["aria-busy"], undefined);
  const ready = r.pressAttrs("button", "ready", "confirm");
  assert.equal(ready.disabled, undefined);
  assert.equal(ready["aria-disabled"], undefined);
  assert.equal(ready["aria-busy"], undefined);
  assert.equal(ready["data-role"], "confirm");
  assert.equal(ready["data-piece"], "button");
  assert.equal(r.pressAttrs("button", "selected")["aria-pressed"], true);
  assert.equal(r.pressMark("key", "waiting").disabled, undefined);
  assert.equal(r.pressMark("key", "waiting")["aria-busy"], true);
  assert.equal(r.pressMark("overlay", "disabled")["aria-disabled"], true);
  assert.equal(r.pressMark("card", "ready")["data-piece"], "card");

  const pressRule = (state) => {
    const match = css.match(new RegExp(`data-press="${state}"[^{]*\\{([^}]*)\\}`));
    assert.ok(match, state);
    return match[1];
  };
  const declared = (block, name) => {
    const match = block.match(new RegExp(`--ad-press-${name}:\\s*([^;]+)`));
    assert.ok(match, name);
    return match[1].trim();
  };
  for (const state of r.PRESS_STATES) {
    const face = r.pressFace("button", state, day, false);
    const block = pressRule(state);
    assert.equal(Number(declared(block, "thick")), face.thickness, state);
    assert.equal(declared(block, "light"), face.light, state);
    assert.equal(Number(declared(block, "sheen")), face.sheen, state);
    assert.equal(Number(declared(block, "shift")), face.shift, state);
    for (const piece of ["ad-raise", "ad-raise-icon", "ad-raise-card", "ad-raise-key", "ad-raise-overlay"]) {
      assert.match(css, new RegExp(`\\.${piece}\\[data-press="${state}"\\]`));
    }
  }
  const readyBlock = pressRule("ready");
  assert.match(readyBlock, /var\(--ad-motion\)/);
  assert.match(readyBlock, /var\(--ad-press-shift\)/);
  assert.match(readyBlock, /var\(--ad-layers\)/);
  assert.match(readyBlock, /var\(--ad-blur\)/);
  assert.match(readyBlock, /var\(--ad-shadow\)/);
  assert.match(readyBlock, /var\(--ad-edge\)/);
  assert.doesNotMatch(pressRule("focus"), /outline/);
  const pressed = r.pressFace("icon", "pressed", day, false);
  const cheapPressed = r.pressFace("icon", "pressed", { time: "night", tier: "low" }, true, "import");
  const rawShift = Number(declared(pressRule("pressed"), "shift"));
  assert.equal(pressed.shift, rawShift * pressed.budget.motion);
  assert.equal(cheapPressed.shift, rawShift * cheapPressed.budget.motion);
  assert.equal(cheapPressed.label, r.PRESS_ROLES.import);
  assert.equal(cheapPressed.light, pressed.light);
  assert.equal(cheapPressed.thickness, pressed.thickness);
  const touchAt = css.indexOf("touch press matches the pointer press face");
  assert.ok(touchAt > 0);
  const touch = css.slice(touchAt, css.indexOf("}", touchAt));
  assert.match(touch, /button\.ad-raise:active/);
  assert.match(touch, /button\.ad-raise-icon:active/);
  assert.equal(Number(declared(touch, "thick")), pressed.thickness);
  assert.equal(declared(touch, "light"), pressed.light);
  assert.equal(Number(declared(touch, "sheen")), pressed.sheen);
  assert.equal(Number(declared(touch, "shift")), rawShift);
  const enlargedAt = css.indexOf("enlarged text keeps raised actions on the shared type scale");
  assert.ok(enlargedAt > 0);
  const enlarged = css.slice(enlargedAt, css.indexOf("}", enlargedAt));
  for (const role of roles) assert.match(enlarged, new RegExp(`data-role="${role}"`));
  assert.match(enlarged, /font-size:\s*var\(--ad-type\)/);
  assert.match(css, /button:focus[\s\S]*outline:\s*3px solid #ddaf61/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.ad-raise[\s\S]*transition:\s*none/);

  assert.match(hud, /<button/);
  assert.match(dialog, /<button/);
  assert.match(combat, /<button/);
  assert.match(hud, /ad-raise-card/);
  assert.match(hud, /ad-raise-key/);
  assert.match(hud, /ad-raise-overlay/);
  assert.match(hud, /ad-raise-icon/);
  assert.match(dialog, /ad-raise-icon/);
  assert.match(combat, /ad-raise-overlay/);
  assert.match(hud, /pressAttrs\("button", "ready", "import"\)/);
  assert.match(hud, /匯入存檔/);
  assert.match(hud, /file\.current\?\.click\(\)/);
  assert.match(hud, /type="file"/);
  assert.match(hud, /f\.size > 1_000_000/);
  assert.match(hud, /importSave\(await f\.text\(\)\)/);
  assert.match(hud, /pressAttrs\("button", "ready", "confirm"\)/);
  assert.match(hud, /保留現有進度/);
  assert.match(hud, /keepProgress\(\)/);
  assert.match(hud, /重新載入/);
  assert.match(hud, /reloadProgress\(\)/);
  assert.match(hud, /pressAttrs\("button", "ready", "back"\)/);
  assert.match(hud, /CHROME_CONTROLS\.exitCampus/);
  assert.match(hud, /\.exit\(\)/);
  assert.match(hud, /"waiting"/);
  assert.match(hud, /"disabled"/);
  assert.match(hud, /disabled=\{s\.cooldown > 0\}/);
  assert.match(hud, /pressAttrs\("button", inventory\.has\("coffee"\) \? "ready" : "disabled"\)/);
  assert.match(hud, /pressMark\("key", inventory\.has\("coffee"\) \? "ready" : "disabled"\)/);
  assert.match(hud, /pressAttrs\("button", inventory\.has\("tea"\) \? "ready" : "disabled"\)/);
  assert.match(hud, /pressMark\("key", inventory\.has\("tea"\) \? "ready" : "disabled"\)/);
  assert.equal(r.pressMark("key", "disabled")["data-press"], r.pressAttrs("button", "disabled")["data-press"]);
  assert.equal(r.pressMark("key", "disabled")["aria-disabled"], true);
  assert.equal(r.pressFace("key", "disabled", day).activatable, false);
  assert.equal(
    r.pressFace("key", "disabled", day).thickness,
    r.pressFace("button", "disabled", day).thickness,
  );
  assert.equal(r.pressFace("key", "disabled", day).sheen, r.pressFace("button", "disabled", day).sheen);

  const cssRules = (() => {
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const found = [];
    const walk = (text) => {
      let i = 0;
      while (i < text.length) {
        while (i < text.length && /\s/.test(text[i])) i += 1;
        if (i >= text.length) break;
        const open = text.indexOf("{", i);
        if (open < 0) break;
        const selector = text.slice(i, open).trim();
        let depth = 1;
        let j = open + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === "{") depth += 1;
          else if (text[j] === "}") depth -= 1;
          j += 1;
        }
        const body = text.slice(open + 1, j - 1);
        if (selector.startsWith("@")) walk(body);
        else if (selector) found.push({ selector, body, order: found.length });
        i = j;
      }
    };
    walk(stripped);
    return found;
  })();
  const specOf = (selector) => {
    const plain = selector.replace(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g, '""');
    let ids = (plain.match(/#[\w-]+/g) || []).length;
    let classes = (plain.match(/\.[\w-]+/g) || []).length + (plain.match(/\[[^\]]+\]/g) || []).length;
    let elements = 0;
    for (const pseudo of plain.match(/::?[\w-]+(?:\([^)]*\))?/g) || []) {
      if (pseudo.startsWith("::")) elements += 1;
      else if (/^:where\b/.test(pseudo)) continue;
      else if (/^:(not|is)\b/.test(pseudo)) {
        const inner = pseudo.slice(pseudo.indexOf("(") + 1, pseudo.lastIndexOf(")"));
        const spec = specOf(inner);
        ids += spec[0];
        classes += spec[1];
        elements += spec[2];
      } else classes += 1;
    }
    const words = plain
      .replace(/::?[\w-]+(?:\([^)]*\))?/g, " ")
      .replace(/\[[^\]]+\]/g, " ")
      .replace(/\.[\w-]+/g, " ")
      .replace(/#[\w-]+/g, " ");
    elements += (words.match(/[a-zA-Z*][\w-]*/g) || []).length;
    return [ids, classes, elements];
  };
  const specCmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const selectorList = (selector) => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < selector.length; i += 1) {
      const ch = selector[i];
      if (ch === "(" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "]") depth -= 1;
      else if (ch === "," && depth === 0) {
        parts.push(selector.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(selector.slice(start).trim());
    return parts.filter(Boolean);
  };
  const rightmost = (selector) => {
    let depth = 0;
    let last = 0;
    for (let i = 0; i < selector.length; i += 1) {
      const ch = selector[i];
      if (ch === "(" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "]") depth -= 1;
      else if (depth === 0 && (ch === ">" || ch === "+" || ch === "~" || /\s/.test(ch))) last = i + 1;
    }
    return selector.slice(last).trim();
  };
  const matchesCompound = (compound, el) => {
    if (!compound || compound.includes("::")) return false;
    let rest = compound;
    const tag = rest.match(/^[a-zA-Z][\w-]*/);
    if (tag) {
      if (tag[0].toLowerCase() !== el.tag) return false;
      rest = rest.slice(tag[0].length);
    }
    for (const cls of rest.match(/\.[\w-]+/g) || []) {
      if (!el.classes.has(cls.slice(1))) return false;
    }
    for (const attr of rest.match(/\[[^\]]+\]/g) || []) {
      const parsed = attr.match(/^\[\s*([\w-]+)(?:\s*([~|^$*]?=)\s*"?([^"\]]+)"?)?\s*\]$/);
      if (!parsed || el.attrs[parsed[1]] === undefined) return false;
      if (parsed[2] === "=" && el.attrs[parsed[1]] !== parsed[3]) return false;
    }
    for (const pseudo of rest.match(/:(?!not\b|where\b|is\b)[\w-]+/g) || []) {
      if (!el.pseudos.has(pseudo.slice(1))) return false;
    }
    for (const not of rest.matchAll(/:not\(([^)]+)\)/g)) {
      if (matchesCompound(not[1], el)) return false;
    }
    return true;
  };
  const matches = (selector, el) => matchesCompound(rightmost(selector), el);
  const winning = (el, property) => {
    let best = null;
    const decl = new RegExp(`(?:^|[;{}\\n])\\s*${property}\\s*:\\s*([^;]+)`);
    for (const rule of cssRules) {
      if (!decl.test(rule.body)) continue;
      for (const selector of selectorList(rule.selector)) {
        if (!matches(selector, el)) continue;
        const spec = specOf(selector);
        if (
          !best ||
          specCmp(spec, best.spec) > 0 ||
          (specCmp(spec, best.spec) === 0 && rule.order >= best.order)
        ) {
          best = { spec, order: rule.order, body: rule.body, value: rule.body.match(decl)[1].trim() };
        }
      }
    }
    return best;
  };
  const slot = (pseudos, press) => ({
    tag: "button",
    classes: new Set(["ad-slot", "ad-raise", ...(press === "selected" ? ["selected"] : [])]),
    attrs: { "data-press": press },
    pseudos: new Set(pseudos),
  });
  const slotCases = [
    ["selected", [], "selected"],
    ["pressed", ["active"], "selected"],
    ["focus", ["focus"], "selected"],
    ["disabled", ["disabled"], "disabled"],
  ];
  for (const [state, pseudos, press] of slotCases) {
    const el = slot(pseudos, press);
    const shadow = winning(el, "box-shadow");
    const face = r.pressFace("button", state, day, false);
    assert.ok(shadow, state);
    assert.match(shadow.body, /var\(--ad-press-thick\)/, state);
    assert.match(shadow.body, /var\(--ad-press-sheen\)/, state);
    assert.match(shadow.body, /var\(--ad-press-shift\)/, state);
    assert.ok(specCmp(shadow.spec, specOf(".ad-slot.selected")) > 0, state);
    assert.doesNotMatch(shadow.value, /#5c9382/, state);
    const thick = winning(el, "--ad-press-thick");
    const sheen = winning(el, "--ad-press-sheen");
    assert.equal(Number(thick.value), face.thickness, state);
    assert.equal(Number(sheen.value), face.sheen, state);
  }
  assert.match(dialog, /pressAttrs\("icon", "ready", "cancel"\)/);
  assert.match(dialog, /onClick=\{onClose\}/);
  assert.match(dialog, /aria-label=\{CHROME_CONTROLS\.close\}/);
  assert.match(hud, /input\.tap\("dodge"\)/);
});

test("statusbar shows current max and change with isolated cues", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const fnBody = (source, name) => {
    const start = source.indexOf("function " + name + "(");
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  };
  const mediaBlocks = (source, header) => {
    const found = [];
    let from = 0;
    while (from < source.length) {
      const start = source.indexOf(header, from);
      if (start < 0) break;
      let depth = 0;
      const open = source.indexOf("{", start);
      let end = -1;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      assert.ok(end > start, header);
      found.push(source.slice(start, end));
      from = end;
    }
    return found;
  };

  const bare = { xp: 0, equipped: false };
  const cap = r.maxHp(bare);
  const fullClass = r.classifyAmount(cap, cap);
  const zeroClass = r.classifyAmount(0, cap);
  let lowCurrent = -1;
  for (let current = 0; current <= cap; current += 1) {
    if (r.classifyAmount(current, cap).low) {
      lowCurrent = current;
      break;
    }
  }
  assert.ok(lowCurrent > 0);
  const lowClass = r.classifyAmount(lowCurrent, cap);
  assert.equal(fullClass.full, true);
  assert.equal(fullClass.zero, false);
  assert.equal(fullClass.low, false);
  assert.equal(zeroClass.zero, true);
  assert.equal(zeroClass.full, false);
  assert.equal(zeroClass.low, false);
  assert.equal(lowClass.low, true);
  assert.equal(lowClass.full, false);
  assert.equal(lowClass.zero, false);
  assert.notEqual(fullClass.mark, zeroClass.mark);
  assert.notEqual(fullClass.mark, lowClass.mark);
  assert.notEqual(zeroClass.mark, lowClass.mark);

  const interiorLife = r.lifeReadout({ hp: 99.1, xp: 0, equipped: false });
  assert.equal(interiorLife.full, false);
  assert.equal(interiorLife.zero, false);
  assert.ok(interiorLife.current > 0 && interiorLife.current < interiorLife.max);
  assert.equal(interiorLife.max, r.maxHp({ xp: 0, equipped: false }));
  const interiorFocus = r.focusReadout({ focus: 0.4 });
  assert.equal(interiorFocus.zero, false);
  assert.equal(interiorFocus.full, false);
  assert.ok(interiorFocus.current > 0 && interiorFocus.current < interiorFocus.max);

  const readLife = r.holdLife();
  readLife({ hp: 40, xp: 0, equipped: false, hurt: false });
  const movedLife = readLife({ hp: 70, xp: 0, equipped: false, hurt: false });
  const sameLife = readLife({ hp: 70, xp: 0, equipped: false, hurt: false });
  assert.notEqual(movedLife.change, 0);
  assert.equal(sameLife.current, movedLife.current);
  assert.equal(sameLife.max, movedLife.max);
  assert.equal(sameLife.change, movedLife.change);
  const readFocus = r.holdFocus();
  readFocus({ focus: 10 });
  const movedFocus = readFocus({ focus: 40 });
  const sameFocus = readFocus({ focus: 40 });
  assert.notEqual(movedFocus.change, 0);
  assert.equal(sameFocus.current, movedFocus.current);
  assert.equal(sameFocus.max, movedFocus.max);
  assert.equal(sameFocus.change, movedFocus.change);
  const readProgress = r.holdProgress();
  readProgress({ xp: 0 });
  const movedProgress = readProgress({ xp: 1 });
  const sameProgress = readProgress({ xp: 1 });
  assert.notEqual(movedProgress.change, 0);
  assert.equal(sameProgress.current, movedProgress.current);
  assert.equal(sameProgress.max, movedProgress.max);
  assert.equal(sameProgress.change, movedProgress.change);

  useRpg.setState({
    xp: 0,
    equipped: false,
    hp: cap,
    focus: 100,
    hurtUntil: 0,
    clock: 10,
    saved: "saved",
  });
  const fullSnap = r.statusSnap(useRpg.getState());
  const full = r.statusReadout(null, fullSnap, "playing");
  for (const bar of [full.life, full.focus, full.progress]) {
    assert.match(bar.line, /目前值/);
    assert.match(bar.line, /最大值/);
    assert.match(bar.line, /變化/);
    assert.equal(bar.short.includes("目前值"), false);
    assert.match(bar.short, new RegExp(`${bar.current}/${bar.max}`));
    assert.equal(bar.current <= bar.max, true);
    assert.deepEqual(r.classifyAmount(bar.current, bar.max), {
      full: bar.full,
      zero: bar.zero,
      low: bar.low,
      mark: bar.mark,
    });
  }
  const fractionalFocus = r.focusReadout({ focus: 41.28 });
  assert.match(fractionalFocus.line, /目前值 41\.28/);
  assert.equal(fractionalFocus.short.includes("41.28"), false);
  assert.equal(fractionalFocus.short, "專注 41.3/100");
  assert.equal(full.life.full, true);
  assert.equal(full.life.low, false);
  assert.equal(full.focus.full, true);
  assert.equal(full.focus.low, false);
  assert.equal(full.life.cues.some((cue) => cue.id === "low"), false);
  assert.equal(full.focus.cues.some((cue) => cue.id === "low"), false);

  useRpg.setState({ hp: 0, focus: 0 });
  const zero = r.statusReadout(null, r.statusSnap(useRpg.getState()), "playing");
  assert.equal(zero.life.zero, true);
  assert.equal(zero.life.full, false);
  assert.equal(zero.life.low, false);
  assert.equal(zero.focus.zero, true);
  assert.equal(zero.focus.low, false);
  assert.equal(zero.life.cues.some((cue) => cue.id === "low"), false);
  assert.notEqual(full.life.mark, zero.life.mark);

  useRpg.setState({ hp: lowCurrent, focus: 10, hurtUntil: 0, clock: 10, saved: "saved" });
  const lowBefore = r.statusSnap(useRpg.getState());
  const lowView = r.statusReadout(null, lowBefore, "playing");
  const lowCue = lowView.life.cues.find((cue) => cue.id === "low");
  assert.equal(lowView.life.low, true);
  assert.equal(lowView.life.full, false);
  assert.equal(lowView.life.zero, false);
  assert.ok(lowCue && lowCue.text && lowCue.icon);
  assert.equal(lowCue.text, r.STATUS_CUES.low.text);
  assert.equal(lowCue.icon, r.STATUS_CUES.low.icon);
  useRpg.getState().useItem("coffee");
  const healedState = useRpg.getState();
  assert.ok(healedState.hp > lowBefore.hp);
  const healed = r.statusReadout(lowBefore, r.statusSnap(healedState), "playing");
  const recovered = healed.life.cues.find((cue) => cue.id === "recovery");
  assert.ok(recovered && recovered.text && recovered.icon);
  assert.equal(recovered.text, r.STATUS_CUES.recovery.text);
  assert.equal(healed.life.current <= healed.life.max, true);
  assert.equal(healed.life.max, r.maxHp(healedState));

  useRpg.setState({ focus: 10 });
  const focusBefore = r.statusSnap(useRpg.getState());
  useRpg.getState().useItem("tea");
  const focusState = useRpg.getState();
  assert.ok(focusState.focus > focusBefore.focus);
  const focusPlay = r.statusReadout(focusBefore, r.statusSnap(focusState), "playing");
  const focusPause = r.statusReadout(focusBefore, r.statusSnap(focusState), "paused");
  const focusCue = focusPlay.focus.cues.find((cue) => cue.id === "recovery");
  assert.ok(focusCue && focusCue.text && focusCue.icon);
  assert.equal(focusPlay.focus.current, focusPause.focus.current);
  assert.equal(focusPlay.focus.max, focusPause.focus.max);
  assert.equal(focusPlay.focus.change, focusPause.focus.change);

  useRpg.setState({ hp: cap, focus: 100, hurtUntil: 30, clock: 10, saved: "saved", equipped: false, xp: 0 });
  const hurtSnap = r.statusSnap(useRpg.getState());
  assert.equal(hurtSnap.hurt, true);
  const hurtView = r.statusReadout(null, hurtSnap, "paused");
  const hurtCue = hurtView.life.cues.find((cue) => cue.id === "hurt");
  assert.ok(hurtCue && hurtCue.text && hurtCue.icon);
  assert.equal(hurtCue.text, r.STATUS_CUES.hurt.text);
  assert.equal(hurtCue.icon, r.STATUS_CUES.hurt.icon);
  assert.equal(hurtView.life.full, true);
  assert.equal(hurtView.life.low, false);

  useRpg.setState({ saved: "error", hurtUntil: 0 });
  const failed = r.statusReadout(null, r.statusSnap(useRpg.getState()), "playing");
  assert.equal(failed.saveText, "保存失敗，請匯出備份");
  assert.equal(r.saveLabel("pending"), "正在保存…");
  assert.equal(r.saveLabel("saved"), "進度已保存");
  assert.ok(failed.saveCue && failed.saveCue.text && failed.saveCue.icon);
  assert.equal(failed.saveCue.text, "保存失敗，請匯出備份");
  assert.equal(failed.saveCue.icon, r.STATUS_CUES["save-error"].icon);

  inventory.add("badge", 1);
  const unequippedMax = r.maxHp({ xp: 0, equipped: false });
  useRpg.setState({
    xp: 0,
    equipped: false,
    hp: unequippedMax,
    focus: 100,
    hurtUntil: 0,
    clock: 10,
    saved: "saved",
  });
  const beforeEquip = r.statusSnap(useRpg.getState());
  assert.equal(r.statusReadout(null, beforeEquip, "playing").life.full, true);
  useRpg.getState().equip();
  const equipped = useRpg.getState();
  assert.equal(equipped.equipped, true);
  const risenPlay = r.statusReadout(beforeEquip, r.statusSnap(equipped), "playing");
  const risenPause = r.statusReadout(beforeEquip, r.statusSnap(equipped), "paused");
  assert.equal(risenPlay.life.max, r.maxHp(equipped));
  assert.equal(risenPlay.life.current, equipped.hp);
  assert.equal(risenPlay.life.current <= risenPlay.life.max, true);
  assert.equal(risenPlay.life.full, false);
  assert.ok(risenPlay.life.max > r.maxHp(beforeEquip));
  assert.equal(risenPlay.life.maxChange, r.maxHp(equipped) - r.maxHp(beforeEquip));
  assert.match(risenPlay.life.changeText, new RegExp("最大 \\+" + risenPlay.life.maxChange));
  assert.match(risenPlay.life.line, /目前值/);
  assert.match(risenPlay.life.line, /最大值/);
  assert.match(risenPlay.life.line, /變化/);
  assert.equal(risenPause.life.current, risenPlay.life.current);
  assert.equal(risenPause.life.max, risenPlay.life.max);
  assert.equal(risenPause.life.change, risenPlay.life.change);
  assert.equal(risenPause.focus.current, risenPlay.focus.current);
  assert.equal(risenPause.focus.max, risenPlay.focus.max);
  assert.equal(risenPause.focus.change, risenPlay.focus.change);
  assert.equal(risenPause.progress.current, risenPlay.progress.current);
  assert.equal(risenPause.progress.max, risenPlay.progress.max);
  assert.equal(risenPause.progress.change, risenPlay.progress.change);
  useRpg.getState().useItem("coffee");
  const filled = useRpg.getState();
  assert.equal(filled.hp, r.maxHp(filled));
  assert.ok(filled.hp > r.maxHp({ xp: filled.xp, equipped: false }));
  const filledSnap = r.statusSnap(filled);
  useRpg.getState().equip();
  const bareState = useRpg.getState();
  assert.equal(bareState.equipped, false);
  assert.equal(bareState.hp, r.maxHp(bareState));
  assert.ok(filled.hp > bareState.hp);
  const clamped = r.statusReadout(filledSnap, r.statusSnap(bareState), "playing");
  assert.equal(clamped.life.current, bareState.hp);
  assert.equal(clamped.life.max, r.maxHp(bareState));
  assert.equal(clamped.life.current <= clamped.life.max, true);

  let leveled = null;
  for (let xp = 0; xp < 200000 && !leveled; xp += 1) {
    useRpg.setState({
      xp,
      discoveries: [],
      hp: 11,
      focus: 11,
      equipped: false,
      hurtUntil: 0,
      clock: 10,
      saved: "saved",
    });
    const before = r.statusSnap(useRpg.getState());
    const beforeLevel = r.levelForXp(before.xp);
    useRpg.getState().discover(CAMPUS_SITES[0].id);
    const after = useRpg.getState();
    if (r.levelForXp(after.xp) > beforeLevel) leveled = { before, after };
  }
  assert.ok(leveled);
  assert.equal(leveled.after.hp, r.maxHp(leveled.after));
  assert.equal(leveled.after.focus, 100);
  const upgraded = r.statusReadout(leveled.before, r.statusSnap(leveled.after), "playing");
  const upgradedPause = r.statusReadout(leveled.before, r.statusSnap(leveled.after), "paused");
  const levelCue = upgraded.progress.cues.find((cue) => cue.id === "level");
  assert.ok(levelCue && levelCue.text && levelCue.icon);
  assert.equal(levelCue.text, r.STATUS_CUES.level.text);
  assert.equal(levelCue.icon, r.STATUS_CUES.level.icon);
  assert.equal(upgraded.life.current, leveled.after.hp);
  assert.equal(upgraded.life.max, r.maxHp(leveled.after));
  assert.equal(upgraded.focus.current, leveled.after.focus);
  assert.equal(upgradedPause.life.current, upgraded.life.current);
  assert.equal(upgradedPause.life.max, upgraded.life.max);
  assert.equal(upgradedPause.life.change, upgraded.life.change);
  assert.equal(upgradedPause.focus.current, upgraded.focus.current);
  assert.equal(upgradedPause.focus.max, upgraded.focus.max);
  assert.equal(upgradedPause.focus.change, upgraded.focus.change);
  assert.equal(upgradedPause.progress.current, upgraded.progress.current);
  assert.equal(upgradedPause.progress.max, upgraded.progress.max);
  assert.equal(upgradedPause.progress.change, upgraded.progress.change);

  for (const cue of Object.values(r.STATUS_CUES)) {
    assert.ok(cue.text && cue.icon);
    const line = hud.split(/\r?\n/).find((row) => row.includes(cue.text) && row.includes(cue.icon));
    assert.ok(line, cue.text);
  }
  const marks = fnBody(hud, "StatusCueMark");
  assert.match(marks, /aria-hidden="true"/);
  assert.match(marks, /\{cue\.text\}/);
  assert.match(hud, /進度已保存/);
  assert.match(hud, /正在保存…/);
  assert.match(hud, /保存失敗，請匯出備份/);
  assert.ok(hud.split('role="meter"').length - 1 >= 3);
  assert.match(hud, /aria-valuenow=\{/);
  assert.match(hud, /aria-valuemax=\{/);

  const life = fnBody(hud, "LifeMeter");
  const focusMeter = fnBody(hud, "FocusMeter");
  const progress = fnBody(hud, "ProgressMeter");
  const save = fnBody(hud, "SaveLine");
  const name = fnBody(hud, "StatusName");
  const status = fnBody(hud, "Status");
  const parent = fnBody(hud, "AdventureHud");
  const selectorAt = parent.indexOf("useRpg(");
  const selector = parent.slice(selectorAt, parent.indexOf("})),", selectorAt));
  assert.match(life, /useRpg\(/);
  assert.match(life, /holdLife\(/);
  assert.doesNotMatch(life, /useEffect/);
  assert.match(life, /s\.hp/);
  assert.match(life, /hurt:\s*s\.hurtUntil > s\.clock/);
  assert.doesNotMatch(life, /s\.focus/);
  assert.doesNotMatch(life, /clock:\s*s\.clock/);
  assert.match(focusMeter, /useRpg\(/);
  assert.match(focusMeter, /holdFocus\(/);
  assert.doesNotMatch(focusMeter, /useEffect/);
  assert.match(focusMeter, /s\.focus/);
  assert.doesNotMatch(focusMeter, /s\.hp/);
  assert.doesNotMatch(focusMeter, /s\.xp/);
  assert.doesNotMatch(focusMeter, /s\.clock/);
  assert.match(progress, /useRpg\(/);
  assert.match(progress, /holdProgress\(/);
  assert.doesNotMatch(progress, /useEffect/);
  assert.match(progress, /s\.xp/);
  assert.doesNotMatch(progress, /s\.hp/);
  assert.doesNotMatch(progress, /s\.focus/);
  assert.doesNotMatch(progress, /s\.clock/);
  assert.match(save, /s\.saved/);
  assert.doesNotMatch(save, /s\.hp|s\.focus|s\.xp|s\.clock/);
  assert.match(name, /s\.departmentId/);
  assert.doesNotMatch(name, /s\.hp|s\.focus|s\.xp|s\.clock/);
  assert.doesNotMatch(status, /useRpg\(/);
  assert.match(selector, /down:\s*s\.hp <= 0/);
  assert.doesNotMatch(selector, /hp:\s*s\.hp/);
  assert.doesNotMatch(selector, /\bfocus\b/);
  assert.doesNotMatch(selector, /\bclock\b/);
  assert.doesNotMatch(selector, /s\.xp/);
  const statusAt = hud.indexOf("<Status />");
  const gate = hud.lastIndexOf('phase !== "title"', statusAt);
  assert.ok(gate >= 0 && statusAt - gate < 500);
  assert.doesNotMatch(hud.slice(gate, statusAt), /phase === "playing"/);

  const narrow = mediaBlocks(css, "@media (max-width: 700px)").find((block) => block.includes(".ad-meter"));
  const reduced = mediaBlocks(css, "@media (prefers-reduced-motion: reduce)")[0];
  assert.ok(narrow);
  assert.match(narrow, /var\(--ad-ink\)/);
  assert.match(narrow, /var\(--ad-type\)/);
  assert.match(narrow, /var\(--ad-motion\)/);
  assert.match(reduced, /var\(--ad-ink\)/);
  assert.match(reduced, /var\(--ad-type\)/);
  assert.match(reduced, /var\(--ad-motion\)/);
  assert.match(reduced, /transition:\s*none/);
  assert.match(css, /\.ad-meter span,\s*\.ad-cue,\s*\.ad-xp span \{[\s\S]*?color:\s*var\(--ad-ink\)/);
  assert.match(css, /\.ad-meter span,\s*\.ad-cue,\s*\.ad-xp span \{[\s\S]*?font-size:\s*var\(--ad-type\)/);
  assert.match(css, /\.ad-readout\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(life, /className="ad-readout"[\s\S]*role="meter"[\s\S]*<\/div>\s*\{bar\.cues\.map/);
  assert.match(focusMeter, /className="ad-readout"[\s\S]*role="meter"[\s\S]*<\/div>\s*\{bar\.cues\.map/);
  assert.match(progress, /className="ad-readout"[\s\S]*role="meter"[\s\S]*<\/div>\s*\{bar\.cues\.map/);
  assert.match(css, /\.ad-meter i \{[\s\S]*?transition:\s*width calc\(var\(--ad-motion\) \* 0\.16s\)/);
  assert.match(css, /button:focus[\s\S]*outline:\s*3px solid #ddaf61/);
  assert.equal(r.chromeBudget("low", false).motion, 0);
  assert.equal(r.chromeBudget("high", true).motion, 0);
  assert.ok(r.chromeBudget("high", false).motion > 0);
  for (const time of ["day", "sunset", "night"]) {
    for (const tier of ["high", "low"]) {
      const label = r.primaryLabel("hud", { time, tier });
      const vars = r.chromeVars({ time, tier }, tier === "low");
      assert.equal(vars["--ad-ink"], label.ink);
      assert.equal(vars["--ad-type"], label.typeSize + "px");
      assert.equal(Number(vars["--ad-motion"]), r.chromeBudget(tier, tier === "low").motion);
      assert.equal(r.readable(label.ink, label.backing, r.skyFor(time), label.alpha), true);
    }
  }
});

test("quickbar shows skill and dodge cooldowns with distinct unavailable states", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const world = read("../src/game/rpg/AdventureWorld.tsx");
  const player = read("../src/game/rpg/AdventurePlayer.tsx");
  const fnBody = (source, name) => {
    const start = source.indexOf("function " + name + "(");
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  };
  const mediaBlocks = (source, header) => {
    const found = [];
    let from = 0;
    while (from < source.length) {
      const start = source.indexOf(header, from);
      if (start < 0) break;
      let depth = 0;
      const open = source.indexOf("{", start);
      let end = -1;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }
      assert.ok(end > start, header);
      found.push(source.slice(start, end));
      from = end;
    }
    return found;
  };
  const quickSnap = () => {
    const s = useRpg.getState();
    const g = useGame.getState();
    return {
      phase: g.phase,
      plaqueId: g.plaqueId,
      panel: s.panel,
      hp: s.hp,
      focus: s.focus,
      xp: s.xp,
      equipped: s.equipped,
      departmentId: s.departmentId,
      buildKind: s.buildKind,
      interiorId: s.interiorId,
      clock: s.clock,
      skillUntil: s.skillUntil,
      dodgeUntil: s.dodgeUntil,
      attackUntil: s.attackUntil,
      coffee: inventory.count("coffee"),
      tea: inventory.count("tea"),
    };
  };

  useRpg.setState({
    panel: null,
    interiorId: null,
    buildKind: null,
    hp: r.maxHp(useRpg.getState()),
    focus: 100,
    skillUntil: 0,
    dodgeUntil: 0,
    attackUntil: 0,
    notice: "",
  });
  useGame.setState({ phase: "playing", plaqueId: null });
  useRpg.getState().attack(true);
  useRpg.getState().dodge();
  const both = useRpg.getState();
  assert.ok(both.skillUntil > both.clock);
  assert.ok(both.dodgeUntil > both.clock);
  const opened = r.quickbarReadout(quickSnap());
  assert.equal(opened.skill.seconds, both.skillUntil - both.clock);
  assert.equal(opened.dodge.seconds, both.dodgeUntil - both.clock);
  assert.equal(opened.skill.progress, 1);
  assert.equal(opened.dodge.progress, 1);
  assert.equal(opened.skill.secondsText, Math.ceil(both.skillUntil - both.clock) + " 秒");
  assert.equal(opened.dodge.secondsText, Math.ceil(both.dodgeUntil - both.clock) + " 秒");
  assert.equal(opened.skill.inUse, true);
  assert.equal(opened.dodge.inUse, true);
  assert.equal(opened.attack.label, "普攻");
  assert.equal(opened.skill.label, "技能");
  assert.equal(opened.dodge.label, "閃避");
  assert.equal(opened.coffee.label, "咖啡");
  assert.equal(opened.tea.label, "茶");
  assert.deepEqual(
    [opened.attack.key, opened.skill.key, opened.dodge.key, opened.coffee.key, opened.tea.key],
    ["J", "Q", "Space", "1", "2"],
  );
  const skillSpan = opened.skill.seconds;
  const dodgeSpan = opened.dodge.seconds;
  const step = Math.min(skillSpan, dodgeSpan) / 2;
  useRpg.setState({ clock: both.clock + step });
  const later = useRpg.getState();
  const laterView = r.quickbarReadout(quickSnap());
  assert.equal(laterView.skill.seconds, later.skillUntil - later.clock);
  assert.equal(laterView.dodge.seconds, later.dodgeUntil - later.clock);
  assert.ok(laterView.skill.seconds > 0);
  assert.ok(laterView.dodge.seconds > 0);
  assert.equal(laterView.skill.progress, laterView.skill.seconds / skillSpan);
  assert.equal(laterView.dodge.progress, laterView.dodge.seconds / dodgeSpan);
  assert.notEqual(laterView.skill.secondsText, "");
  assert.notEqual(laterView.dodge.secondsText, "");

  const cap = r.maxHp(useRpg.getState());
  useRpg.setState({ hp: cap, focus: 40, panel: null, notice: "" });
  const coffeeBefore = inventory.count("coffee");
  assert.ok(coffeeBefore > 0);
  useRpg.getState().useItem("coffee");
  assert.equal(inventory.count("coffee"), coffeeBefore);
  assert.equal(useRpg.getState().hp, cap);
  assert.equal(useRpg.getState().notice, "狀態已滿，不需要消耗物品。");
  const full = r.quickbarReadout(quickSnap());
  assert.equal(full.coffee.mark, "full");
  assert.equal(full.coffee.state, "滿狀態");
  assert.equal(full.coffee.usable, false);
  assert.equal(full.tea.mark, "ready");

  useRpg.setState({
    hp: 40,
    panel: null,
    interiorId: null,
    buildKind: null,
    skillUntil: 0,
    attackUntil: 0,
    dodgeUntil: 0,
    notice: "",
  });
  useGame.setState({ phase: "playing", plaqueId: null });
  let spentAt = -1;
  for (let focus = 0; focus <= 100; focus += 1) {
    useRpg.setState({ focus, skillUntil: 0, attackUntil: 0, notice: "" });
    useRpg.getState().attack(true);
    const after = useRpg.getState();
    if (after.skillUntil > after.clock) {
      spentAt = focus;
      break;
    }
    assert.equal(after.focus, focus);
    assert.equal(after.skillUntil, 0);
    assert.equal(after.notice, "專注不足，飲用烏龍茶或稍候恢復。");
  }
  assert.ok(spentAt > 0);
  useRpg.setState({ focus: spentAt - 1, skillUntil: 0, attackUntil: 0, notice: "" });
  const blockedFocus = useRpg.getState().focus;
  useRpg.getState().attack(true);
  assert.equal(useRpg.getState().focus, blockedFocus);
  assert.equal(useRpg.getState().skillUntil, 0);
  assert.equal(useRpg.getState().notice, "專注不足，飲用烏龍茶或稍候恢復。");
  const low = r.quickbarReadout(quickSnap());
  assert.equal(low.skill.mark, "low-focus");
  assert.equal(low.skill.state, "專注不足");
  assert.equal(low.skill.usable, false);
  useRpg.setState({ focus: spentAt, skillUntil: 0, attackUntil: 0, notice: "" });
  const enough = r.quickbarReadout(quickSnap());
  assert.notEqual(enough.skill.mark, "low-focus");
  assert.equal(enough.skill.usable, true);

  useRpg.setState({ panel: null, interiorId: null, buildKind: null, hp: 40 });
  useGame.setState({ phase: "playing", plaqueId: null });
  while (inventory.count("coffee") > 0) assert.equal(inventory.remove("coffee", 1), true);
  while (inventory.count("tea") > 0) assert.equal(inventory.remove("tea", 1), true);
  const none = r.quickbarReadout(quickSnap());
  assert.equal(none.coffee.mark, "empty");
  assert.equal(none.tea.mark, "empty");
  assert.equal(none.coffee.state, "耗盡");
  assert.equal(none.tea.state, "耗盡");
  assert.equal(none.coffee.usable, false);
  assert.equal(none.tea.usable, false);
  assert.equal(inventory.count("coffee"), 0);
  assert.equal(inventory.count("tea"), 0);

  useRpg.setState({
    panel: "inventory",
    interiorId: null,
    buildKind: null,
    focus: 100,
    hp: 80,
    attackUntil: 0,
    skillUntil: 0,
    dodgeUntil: 0,
  });
  const panelFocus = useRpg.getState().focus;
  assert.equal(useRpg.getState().dodge(), false);
  useRpg.getState().attack();
  useRpg.getState().attack(true);
  assert.equal(useRpg.getState().focus, panelFocus);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().skillUntil, 0);
  assert.equal(useRpg.getState().dodgeUntil, 0);
  const panelView = r.quickbarReadout(quickSnap());
  assert.equal(panelView.attack.mark, "scene");
  assert.equal(panelView.skill.mark, "scene");
  assert.equal(panelView.dodge.mark, "scene");
  assert.equal(panelView.coffee.mark, "scene");
  assert.equal(panelView.tea.mark, "scene");
  assert.equal(panelView.attack.state, "場景不可用");
  assert.equal(panelView.attack.usable, false);

  useRpg.setState({ panel: null, interiorId: "hall", buildKind: null, focus: 100, attackUntil: 0, skillUntil: 0, dodgeUntil: 0 });
  useRpg.getState().attack();
  useRpg.getState().attack(true);
  assert.equal(useRpg.getState().focus, 100);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().skillUntil, 0);
  const indoor = r.quickbarReadout(quickSnap());
  assert.equal(indoor.attack.mark, "scene");
  assert.equal(indoor.skill.mark, "scene");
  assert.equal(indoor.skill.state, "場景不可用");
  assert.notEqual(indoor.dodge.mark, "scene");

  useRpg.setState({ interiorId: null, buildKind: "bench", panel: null, focus: 100, attackUntil: 0, skillUntil: 0, dodgeUntil: 0 });
  useRpg.getState().attack();
  useRpg.getState().attack(true);
  assert.equal(useRpg.getState().dodge(), false);
  assert.equal(useRpg.getState().focus, 100);
  assert.equal(useRpg.getState().attackUntil, 0);
  assert.equal(useRpg.getState().skillUntil, 0);
  const built = r.quickbarReadout(quickSnap());
  assert.equal(built.attack.mark, "scene");
  assert.equal(built.skill.mark, "scene");
  assert.equal(built.dodge.mark, "scene");
  assert.equal(built.attack.state, "場景不可用");

  inventory.add("tea", 1);
  useRpg.setState({ panel: "inventory", hp: 40, focus: 10, notice: "" });
  const teaBefore = inventory.count("tea");
  const focusBefore = useRpg.getState().focus;
  useRpg.getState().useItem("tea");
  assert.equal(inventory.count("tea"), teaBefore - 1);
  assert.ok(useRpg.getState().focus > focusBefore);

  const distinct = new Set([full.coffee.state, low.skill.state, none.coffee.state, built.attack.state]);
  assert.equal(distinct.size, 4);

  const bar = fnBody(hud, "Quickbar");
  const gate = fnBody(hud, "quickBackground");
  assert.match(gate, /useRpg\.getState\(\)\.panel/);
  assert.match(gate, /return/);
  for (const label of ["普攻", "技能", "閃避", "咖啡", "茶"]) assert.match(bar, new RegExp('label="' + label + '"'));
  for (const key of ["J", "Q", "Space", "1", "2"]) assert.match(bar, new RegExp('keyMark="' + key + '"'));
  assert.equal((bar.match(/<QuickSlot/g) || []).length, 5);
  assert.match(fnBody(hud, "QuickSlot"), /<button/);
  assert.match(hud, /data-seconds=\{slot\.seconds\}/);
  assert.match(hud, /data-progress=\{slot\.progress\}/);
  assert.match(hud, /slot\.secondsText/);
  assert.match(hud, /slot\.progress \* 100/);
  assert.match(hud, /quickbarReadout\(/);
  assert.match(bar, /quickBackground\(\(\) => useRpg\.getState\(\)\.attack\(\)\)/);
  assert.match(bar, /quickBackground\(\(\) => useRpg\.getState\(\)\.attack\(true\)\)/);
  assert.match(bar, /quickBackground\(\(\) => input\.tap\("dodge"\)\)/);
  assert.match(bar, /quickBackground\(\(\) => useRpg\.getState\(\)\.useItem\("coffee"\)\)/);
  assert.match(bar, /quickBackground\(\(\) => useRpg\.getState\(\)\.useItem\("tea"\)\)/);
  assert.match(hud, /onClick=\{\(\) => useRpg\.getState\(\)\.useItem\(item\.id\)\}/);
  assert.match(hud, /disabled=\{s\.cooldown > 0\}/);
  assert.match(hud, /phase === "playing" && !state\.panel && !state\.down/);
  assert.doesNotMatch(fnBody(hud, "QuickSlot"), /translate/);
  assert.doesNotMatch(bar, /translate/);
  const liveAt = css.indexOf(".ad-quick-live");
  assert.ok(liveAt >= 0);
  const liveRule = css.slice(liveAt, css.indexOf("}", liveAt) + 1);
  assert.doesNotMatch(liveRule, /translate/);
  assert.doesNotMatch(liveRule, /transform/);
  const panelReturn = world.indexOf('if (g.phase !== "playing" || s.panel || g.plaqueId) return;');
  assert.ok(panelReturn >= 0);
  assert.ok(panelReturn < world.indexOf('if (e.code === "KeyJ")'));
  assert.ok(panelReturn < world.indexOf('if (e.code === "KeyQ")'));
  assert.ok(panelReturn < world.indexOf('if (e.code === "Digit1")'));
  assert.ok(panelReturn < world.indexOf('if (e.code === "Digit2")'));
  const frozenAt = player.indexOf("const frozen");
  const dodgeCall = player.indexOf("useRpg.getState().dodge()");
  assert.ok(frozenAt >= 0 && frozenAt < dodgeCall);
  assert.match(player.slice(frozenAt, dodgeCall), /panel/);
  assert.match(player.slice(frozenAt, dodgeCall), /if \(!frozen\)/);
  for (const zone of ["stick", "look", "sprint", "dodge", "interact"]) {
    assert.match(hud, new RegExp("place\\(layout\\." + zone + "\\)"));
  }

  const narrow = mediaBlocks(css, "@media (max-width: 700px)").find((block) => block.includes(".ad-quickbar small"));
  const coarse = mediaBlocks(css, "@media (pointer: coarse) and (max-width: 700px)")[0];
  const reduced = mediaBlocks(css, "@media (prefers-reduced-motion: reduce)")[0];
  assert.ok(narrow);
  assert.ok(coarse);
  assert.ok(reduced);
  for (const block of [narrow, coarse, reduced]) {
    assert.match(block, /var\(--ad-ink\)/);
    assert.match(block, /var\(--ad-type\)/);
    assert.match(block, /var\(--ad-motion\)/);
    assert.match(block, /\.ad-quickbar small/);
    assert.match(block, /\.ad-quick-seconds/);
    assert.match(block, /\.ad-quick-meter[\s\S]*var\(--ad-motion\)/);
  }
  assert.match(coarse, /\.ad-quickbar \.ad-key\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(coarse, /\.ad-quickbar small[\s\S]{0,180}display:\s*none/);
  assert.doesNotMatch(coarse, /\.ad-quick-seconds[\s\S]{0,180}display:\s*none/);
  assert.match(css, /button:focus[\s\S]*outline:\s*3px solid #ddaf61/);
  assert.equal(r.chromeBudget("low", false).motion, 0);
  assert.equal(r.chromeBudget("high", true).motion, 0);
  for (const time of ["day", "sunset", "night"]) {
    for (const tier of ["high", "low"]) {
      const label = r.primaryLabel("hud", { time, tier });
      assert.equal(r.readable(label.ink, label.backing, r.skyFor(time), label.alpha), true);
    }
  }

  const overlaps = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const phones = [
    { width: 390, height: 844, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { width: 390, height: 844, insets: { top: 47, right: 16, bottom: 34, left: 16 } },
  ];
  const zoneNames = ["stick", "look", "sprint", "dodge", "interact"];
  for (const phone of phones) {
    const zones = r.touchLayout(phone.width, phone.height, phone.insets);
    const layout = r.quickbarPlace(phone.width, phone.height, phone.insets);
    assert.equal(layout.slots.length, 5, phone.height + " slots");
    const rects = [layout.bar, ...layout.slots];
    for (const rect of rects) {
      assert.ok(rect.w >= 44 && rect.h >= 44, "phone slot");
      assert.ok(rect.x >= phone.insets.left, "left");
      assert.ok(rect.y >= phone.insets.top, "top");
      assert.ok(rect.x + rect.w <= phone.width - phone.insets.right, "right");
      assert.ok(rect.y + rect.h <= phone.height - phone.insets.bottom, "bottom");
      for (const name of zoneNames)
        assert.equal(overlaps(rect, zones[name]), false, name + " " + phone.insets.top);
    }
    for (let i = 0; i < layout.slots.length; i += 1) {
      for (let j = i + 1; j < layout.slots.length; j += 1)
        assert.equal(overlaps(layout.slots[i], layout.slots[j]), false, "slots");
    }
  }
  assert.match(hud, /quickbarPlace\(/);
  assert.match(hud, /ad-quickbar-placed/);
  assert.doesNotMatch(coarse, /right:\s*14px/);
  const placedRuleAt = css.indexOf(".ad-quickbar.ad-quickbar-placed {");
  assert.ok(placedRuleAt >= 0);
  const placedRule = css.slice(placedRuleAt, css.indexOf("}", placedRuleAt) + 1);
  assert.match(placedRule, /z-index:\s*1/);
  assert.match(placedRule, /transform:\s*none/);
  assert.doesNotMatch(placedRule, /translate/);
});

test("prompts share one operable target across marker text and the action", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const world = read("../src/game/rpg/AdventureWorld.tsx");
  const player = read("../src/game/rpg/AdventurePlayer.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const fnBody = (source, name) => {
    const start = source.indexOf("function " + name + "(");
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  };
  const nearby = fnBody(hud, "Nearby");
  const touch = fnBody(hud, "TouchControls");
  const choiceOf = fnBody(hud, "usePromptChoice");
  assert.match(choiceOf, /promptDecision\(promptSnap\(\)\)/);
  assert.match(nearby, /usePromptChoice\(/);
  assert.match(touch, /usePromptChoice\(/);
  assert.match(world, /promptDecision\(/);
  assert.match(world, /promptLabels\(/);
  assert.match(world, /\$\{label\.kind\}:\$\{label\.id\}/);
  assert.match(nearby, /input\.tap\("interact"\)/);
  assert.match(touch, /bind\("interact"\)/);
  assert.match(nearby, /\{choice\.text\}/);
  assert.match(touch, /prompt\.text/);
  assert.match(player, /commitPrompt\(/);
  assert.doesNotMatch(nearby, /Math\.hypot/);
  assert.doesNotMatch(touch, /Math\.hypot/);
  assert.doesNotMatch(choiceOf, /Math\.hypot/);
  assert.doesNotMatch(nearby, /按 E|E 返回|E 放置|E 整理/);
  assert.doesNotMatch(touch, /按 E|E 互動/);
  assert.doesNotMatch(world, /按 E/);
  assert.match(nearby, /rotate\(\)/);
  assert.match(css, /\.ad-interact button \{[^}]*color:\s*var\(--ad-ink\)/);
  assert.match(css, /\.ad-interact button \{[^}]*font-size:\s*var\(--ad-type\)/);
  assert.equal(
    r.readable(r.CHROME_SCALE.ink, "#e6d5ac", r.skyFor("day"), 1),
    true,
  );

  const stand = (x, z, extra = {}) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: x,
      playerZ: z,
      playerYaw: 0,
      visited: [],
      ...extra,
    });
  };
  const quiet = (patch = {}) => {
    useRpg.setState({
      hp: 100,
      focus: 100,
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      loot: [],
      harvested: {},
      ...patch,
    });
  };
  const aimed = (anchor, zOffset) => ({
    x: anchor.x,
    y: anchor.y,
    z: anchor.z + zOffset,
    fx: 0,
    fy: 0,
    fz: zOffset < 0 ? 1 : -1,
    fov: 50,
    width: 1280,
    height: 720,
  });
  const sameTarget = (label, choice) =>
    label.kind === choice.kind && label.id === choice.targetId;
  const framePair = (a, b) => {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const midZ = (a.z + b.z) / 2;
    const span = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const px = -(b.z - a.z) / span;
    const pz = (b.x - a.x) / span;
    const back = span * 1.6 + 14;
    return {
      x: midX + px * back,
      y: midY + 2,
      z: midZ + pz * back,
      fx: -px * back,
      fy: -2,
      fz: -pz * back,
      fov: 60,
      width: 1280,
      height: 720,
    };
  };
  const actionLabel = (choice) => {
    const probe = r.promptLabels(r.promptSnap(), {
      x: choice.x,
      y: 0,
      z: choice.z,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    });
    const anchor = probe.find((label) => sameTarget(label, choice)).anchor;
    const labels = r.promptLabels(r.promptSnap(), aimed(anchor, -8));
    const matched = labels.filter((label) => sameTarget(label, choice));
    assert.equal(matched.length, 1);
    const mark = matched[0];
    assert.equal(mark.text, choice.marker);
    assert.equal(mark.action, true);
    assert.equal(mark.shown, true);
    assert.equal(labels.filter((label) => label.action).length, 1);
    return mark;
  };

  const indoor = CAMPUS_SITES.find((site) => site.form !== "court");
  const door = siteEntrance(indoor);
  quiet({
    loot: [{ id: "door-drop", x: door.x, z: door.z, items: { parts: 1 } }],
  });
  stand(door.x, door.z);
  let choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "pickup");
  assert.equal(choice.targetId, "door-drop");
  actionLabel(choice);
  const partsBefore = inventory.count("parts");
  assert.equal(useRpg.getState().commitPrompt(), "pickup");
  assert.equal(useRpg.getState().interiorId, null);
  assert.equal(useRpg.getState().loot.length, 0);
  assert.equal(inventory.count("parts"), partsBefore + 1);

  const cooled = Object.fromEntries(
    SUPPLY_NODES.map((node) => [node.id, Date.now() + 1e9]),
  );
  let supply = null;
  for (const node of SUPPLY_NODES) {
    quiet({ harvested: cooled });
    stand(node.x, node.z);
    if (!r.promptDecision(r.promptSnap())) {
      supply = node;
      break;
    }
  }
  assert.ok(supply);
  const cooledParts = inventory.count("parts");
  const cooledUntil = useRpg.getState().harvested[supply.id];
  assert.equal(useRpg.getState().commitPrompt(), null);
  assert.equal(inventory.count("parts"), cooledParts);
  assert.equal(useRpg.getState().harvested[supply.id], cooledUntil);

  quiet({ harvested: cooled, loot: [] });
  let landmark = null;
  for (const item of r.LANDMARKS) {
    stand(item.x, item.z);
    choice = r.promptDecision(r.promptSnap());
    if (choice?.kind === "stamp") {
      landmark = item;
      break;
    }
  }
  assert.ok(landmark);
  actionLabel(choice);
  assert.equal(useRpg.getState().commitPrompt(), "stamp");
  assert.ok(useGame.getState().visited.includes(landmark.id));
  assert.equal(useGame.getState().plaqueId, landmark.id);
  useGame.setState({ plaqueId: null });
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "open");
  assert.equal(useRpg.getState().commitPrompt(), "open");
  assert.equal(useGame.getState().plaqueId, landmark.id);

  quiet();
  useRpg.getState().enter(indoor.id);
  stand(0, 6);
  useRpg.setState({ hp: 80, panel: null, buildKind: null });
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "exit");
  assert.equal(choice.text, "返回校園");
  assert.equal(choice.marker, choice.text);
  actionLabel(choice);
  assert.equal(useRpg.getState().commitPrompt(), "exit");
  assert.equal(useRpg.getState().interiorId, null);

  quiet();
  useRpg.getState().enter(indoor.id);
  stand(0, 0);
  useRpg.setState({ hp: 40, focus: 40, panel: null, buildKind: null });
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "notes");
  assert.equal(choice.text, "整理筆記");
  assert.equal(choice.marker, choice.text);
  assert.equal(useRpg.getState().commitPrompt(), "notes");
  assert.equal(useRpg.getState().interiorId, indoor.id);
  assert.equal(useRpg.getState().hp, 50);
  assert.equal(useRpg.getState().focus, 55);

  quiet();
  let placed = null;
  for (const site of CAMPUS_SITES) {
    const at = siteEntrance(site);
    stand(at.x + 14, at.z);
    useRpg.setState({
      interiorId: null,
      panel: null,
      hp: 100,
      buildings: [],
      loot: [],
      buildKind: "desk",
      rotation: 0,
    });
    choice = r.promptDecision(r.promptSnap());
    if (choice?.kind === "place" && choice.reason === null) {
      placed = choice;
      break;
    }
  }
  assert.ok(placed);
  const paid = inventory.count("parts");
  assert.equal(useRpg.getState().commitPrompt(), "place");
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(inventory.count("parts"), paid - RECIPES.find((item) => item.id === "desk").cost.parts);
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "place");
  assert.ok(choice.reason);
  assert.equal(choice.text, choice.reason);
  assert.equal(choice.marker, choice.reason);
  const held = inventory.count("parts");
  assert.equal(useRpg.getState().commitPrompt(), "place");
  assert.equal(useRpg.getState().buildings.length, 1);
  assert.equal(inventory.count("parts"), held);
  assert.equal(useRpg.getState().notice, choice.reason);
  useRpg.getState().cancelBuild();

  const court = CAMPUS_SITES.find((site) => site.form === "court");
  const courtDoor = siteEntrance(court);
  quiet();
  stand(courtDoor.x, courtDoor.z);
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "arrive");
  actionLabel(choice);
  assert.equal(useRpg.getState().commitPrompt(), "arrive");
  assert.equal(useRpg.getState().interiorId, null);
  assert.ok(useRpg.getState().notice.includes(court.name));

  quiet({
    loot: [{ id: "held", x: door.x, z: door.z, items: { parts: 1 } }],
  });
  stand(door.x, door.z);
  useRpg.setState({ panel: "inventory" });
  assert.equal(r.promptDecision(r.promptSnap()), null);
  assert.equal(useRpg.getState().commitPrompt(), null);
  assert.equal(useRpg.getState().loot.length, 1);
  useRpg.setState({ panel: null, hp: 0 });
  assert.equal(r.promptDecision(r.promptSnap()), null);
  useGame.setState({ phase: "paused" });
  useRpg.setState({ hp: 100 });
  assert.equal(r.promptDecision(r.promptSnap()), null);
  assert.equal(useRpg.getState().loot.length, 1);

  const shared = CAMPUS_SITES.filter((site) => {
    if (site.form === "court") return false;
    const landmark = r.LANDMARKS.find((mark) => mark.id === site.id);
    if (!landmark) return false;
    const at = siteEntrance(site);
    return Math.hypot(at.x - landmark.x, at.z - landmark.z) < landmark.radius;
  });
  assert.ok(shared.some((site) => site.id === "library"));
  assert.ok(shared.some((site) => site.id === "museum"));
  const gates = [
    () => useRpg.setState({ panel: "inventory", hp: 100 }),
    () => {
      useRpg.setState({ panel: null, hp: 100 });
      useGame.setState({ phase: "paused" });
    },
    () => {
      useGame.setState({ phase: "playing" });
      useRpg.setState({ panel: null, hp: 0 });
    },
  ];
  for (const site of shared) {
    const at = siteEntrance(site);
    const landmark = r.LANDMARKS.find((item) => item.id === site.id);
    quiet({ loot: [] });
    stand(at.x, at.z);
    choice = r.promptDecision(r.promptSnap());
    assert.equal(choice.kind, "enter");
    assert.equal(choice.targetId, site.id);
    assert.equal(choice.marker, "進入");
    assert.ok(Math.hypot(at.x - landmark.x, at.z - landmark.z) < landmark.radius);
    assert.equal(r.clearSight(at.x, at.z, landmark.x, landmark.z, []), true);
    const probe = r.promptLabels(r.promptSnap(), {
      x: at.x,
      y: 4,
      z: at.z,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    });
    const doorLabel = probe.find((label) => label.kind === "enter" && label.id === site.id);
    const stampLabel = probe.find((label) => label.kind === "stamp" && label.id === site.id);
    assert.ok(doorLabel);
    assert.ok(stampLabel);
    const view = framePair(doorLabel.anchor, stampLabel.anchor);
    const framed = r.promptLabels(r.promptSnap(), view);
    const doorFramed = framed.find((label) => label.kind === "enter" && label.id === site.id);
    const stampFramed = framed.find((label) => label.kind === "stamp" && label.id === site.id);
    assert.ok(doorFramed.rect, site.id + " door");
    assert.ok(stampFramed.rect, site.id + " stamp");
    const actions = framed.filter((label) => label.action);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].kind, "enter");
    assert.equal(actions[0].id, site.id);
    assert.equal(actions[0].text, choice.marker);
    assert.equal(actions[0].shown, true);
    assert.equal(actions[0].anchor.x, at.x);
    assert.equal(actions[0].anchor.z, at.z);
    assert.equal(stampFramed.action, false);
    assert.equal(stampFramed.text, "蓋章");
    assert.equal(stampFramed.anchor.x, landmark.x);
    assert.equal(stampFramed.anchor.z, landmark.z);
    quiet({
      loot: [{ id: site.id + "-drop", x: at.x, z: at.z, items: { parts: 1 } }],
    });
    stand(at.x, at.z);
    for (const gate of gates) {
      gate();
      assert.equal(r.promptDecision(r.promptSnap()), null);
      assert.equal(useRpg.getState().commitPrompt(), null);
      const hidden = r.promptLabels(r.promptSnap(), view);
      const verbs = hidden.filter((label) => label.kind !== "name");
      assert.ok(verbs.some((label) => label.kind === "pickup" && label.text === "拾取" && label.rect));
      assert.ok(verbs.some((label) => label.kind === "enter" && label.text === "進入" && label.rect));
      assert.ok(verbs.some((label) => label.kind === "stamp" && label.text === "蓋章" && label.rect));
      assert.equal(verbs.some((label) => label.shown || label.action), false);
    }
    assert.equal(useRpg.getState().loot.length, 1);
  }

  const origin = { x: 200, z: -20 };
  quiet({
    buildings: [{ id: "wall", kind: "barrier", x: 201.8, z: -20, rotation: 0, hp: 100 }],
    loot: [
      { id: "near", x: origin.x, z: origin.z, items: { parts: 1 } },
      { id: "twin", x: origin.x, z: origin.z, items: { parts: 1 } },
      { id: "side", x: 196.4, z: -20, items: { parts: 1 } },
      { id: "blocked", x: 203.6, z: -20, items: { parts: 1 } },
      { id: "far", x: 200, z: 80, items: { parts: 1 } },
    ],
  });
  stand(origin.x, origin.z);
  choice = r.promptDecision(r.promptSnap());
  assert.equal(choice.kind, "pickup");
  assert.equal(choice.targetId, "near");
  const seed = r.promptLabels(r.promptSnap(), {
    x: origin.x,
    y: 0,
    z: origin.z,
    fx: 0,
    fy: 0,
    fz: 1,
    fov: 50,
    width: 1280,
    height: 720,
  });
  const nearAnchor = seed.find((label) => label.id === "near").anchor;
  const here = r.promptLabels(r.promptSnap(), aimed(nearAnchor, -8));
  const away = r.promptLabels(r.promptSnap(), {
    x: nearAnchor.x,
    y: nearAnchor.y,
    z: nearAnchor.z + 8,
    fx: 0,
    fy: 0,
    fz: 1,
    fov: 50,
    width: 1280,
    height: 720,
  });
  const overlaps = (a, b) =>
    a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const near = here.find((label) => label.id === "near");
  const twin = here.find((label) => label.id === "twin");
  const side = here.find((label) => label.id === "side");
  const blocked = here.find((label) => label.id === "blocked");
  const far = here.find((label) => label.id === "far");
  assert.equal(near.action, true);
  assert.equal(near.shown, true);
  assert.equal(near.text, choice.marker);
  assert.equal(twin.action, false);
  assert.equal(overlaps(near.rect, twin.rect), true);
  assert.equal(twin.shown, false);
  assert.equal(side.action, false);
  assert.equal(side.shown, true);
  assert.equal(blocked.action, false);
  assert.equal(blocked.shown, false);
  assert.equal(far.action, false);
  assert.equal(far.shown, false);
  const moved = away.find((label) => label.id === "near");
  assert.deepEqual(moved.anchor, near.anchor);
  assert.equal(moved.anchor.x, origin.x);
  assert.equal(moved.anchor.z, origin.z);
  assert.equal(moved.shown, false);
  const shownIds = (list) =>
    list.filter((label) => label.shown).map((label) => label.id).sort().join(",");
  assert.notEqual(shownIds(here), shownIds(away));
});
test("settings sections keep the selected choice, the default, and the live pose", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (name) => readFileSync(join(here, "../src/game/rpg", name), "utf8");
  const hud = read("AdventureHud.tsx");
  const panelAt = hud.indexOf("function SettingsPanel()");
  const panel = hud.slice(panelAt, hud.indexOf("const STATUS_CUE_MARK", panelAt));
  const shown = hud.slice(hud.indexOf("{showSettings &&"), hud.indexOf("{plaque &&"));
  const player = read("AdventurePlayer.tsx");
  const layoutAt = player.indexOf("useLayoutEffect(() =>");
  const layout = player.slice(layoutAt, player.indexOf("useEffect", layoutAt));
  const app = read("AdventureApp.tsx");
  const section = (label) =>
    r.settingsSurface().sections.find((item) => item.label === label);
  const choice = (label, id) => section(label).choices.find((item) => item.id === id);
  const mode = () => {
    const g = useGame.getState();
    const s = useRpg.getState();
    return playMode({
      phase: g.phase,
      plaqueId: g.plaqueId,
      panel: s.panel,
      interiorId: s.interiorId,
      hp: s.hp,
      boss: s.boss,
      claimed: s.claimed,
    });
  };
  const pose = () => {
    const g = useGame.getState();
    return { x: g.playerX, z: g.playerZ, yaw: g.playerYaw };
  };
  const stand = (phase, x, z, yaw) => {
    useRpg.setState({
      panel: null,
      interiorId: null,
      hp: 100,
      boss: 0,
      claimed: [],
      saveConflict: false,
      saved: "saved",
    });
    useGame.setState({
      phase,
      playerX: x,
      playerZ: z,
      playerYaw: yaw,
      plaqueId: null,
      warp: null,
      settingsOpen: false,
    });
  };

  useRpg.getState().keepProgress();
  useGame.getState().setTime(r.SAVE_DEFAULTS.timeOfDay);
  useGame.getState().setGraphics({ ...r.SAVE_DEFAULTS.graphics });
  r.applySettings("volume", r.SAVE_DEFAULTS.muted ? "silent" : "audible");
  stand("title", -5, -45, 0);

  assert.deepEqual(
    r.settingsSurface().sections.map((item) => item.label),
    ["時光", "畫質", "音訊", "操作", "存檔"],
  );
  assert.equal(r.SAVE_DEFAULTS.timeOfDay, "sunset");
  assert.equal(r.SAVE_DEFAULTS.graphics.tier, "auto");
  assert.equal(r.SAVE_DEFAULTS.graphics.postFx, true);
  assert.equal(r.SAVE_DEFAULTS.muted, false);
  const sunset = choice("時光", r.SAVE_DEFAULTS.timeOfDay);
  assert.equal(sunset.selected, true);
  assert.equal(sunset.isDefault, true);
  assert.equal(sunset.label, r.TIME_PRESETS.sunset.label);
  assert.notEqual(sunset.label, "日落");
  assert.equal(choice("畫質", "auto").selected, true);
  assert.equal(choice("畫質", "auto").isDefault, true);
  assert.equal(choice("畫質", "on").selected, true);
  assert.equal(choice("畫質", "on").isDefault, true);
  assert.equal(choice("音訊", "audible").selected, true);
  assert.equal(choice("音訊", "audible").isDefault, true);
  assert.match(section("操作").note, /不需要實體鍵/);
  assert.equal(/按 E|按 Esc|必須按/.test(section("操作").note), false);
  assert.match(panel, /<section/);
  assert.match(panel, /aria-pressed=\{choice\.selected\}/);
  assert.match(panel, /data-default=/);
  assert.match(panel, /預設/);
  assert.match(panel, /ad-settings-status/);
  assert.match(panel, /applySettings\(choice\.action, choice\.id\)/);
  assert.match(panel, /applySettings\("return"\)/);
  assert.match(panel, /settingsReturnLabel/);
  assert.equal(/pointer:\s*coarse|matchMedia|KeyE|Escape/.test(panel), false);
  assert.equal(/coarse|matchMedia|KeyE|Escape/.test(shown), false);
  assert.match(shown, /<SettingsPanel \/>/);
  assert.match(hud, /state\.panel && !showSettings/);
  assert.match(hud, /plaque && !state\.panel && !showSettings/);
  assert.match(read("AdventureCombatHud.tsx"), /victory && !settingsOpen/);
  assert.match(layout, /phase === "title"/);
  assert.match(layout, /followCameraSeed/);
  assert.ok(layout.indexOf("phase === \"title\"") < layout.indexOf("followCameraSeed"));
  assert.match(player.slice(player.indexOf("const seeded")), /followCameraSeed/);
  assert.match(app, /TITLE_ORBIT/);
  for (const action of ["tier", "volume", "export"]) {
    assert.equal(
      r.settingsSurface().sections.some((item) =>
        item.choices.some((itemChoice) => itemChoice.action === action),
      ),
      true,
      action,
    );
  }

  r.applySettings("tier", "low");
  assert.equal(useGame.getState().phase, "title");
  assert.equal(useGame.getState().graphics.tier, "low");
  assert.equal(r.graphicsLive().tier, "low");
  assert.equal(choice("畫質", "low").selected, true);
  assert.equal(choice("畫質", "auto").selected, false);
  assert.equal(choice("畫質", "auto").isDefault, true);
  r.applySettings("tier", "high");
  assert.equal(useGame.getState().graphics.tier, "high");
  assert.equal(r.graphicsLive().tier, "high");
  assert.equal(choice("畫質", "high").selected, true);
  r.applySettings("post", "off");
  assert.equal(useGame.getState().graphics.postFx, false);
  assert.equal(r.graphicsLive().postFx, false);
  assert.equal(choice("畫質", "off").selected, true);
  assert.equal(choice("畫質", "on").isDefault, true);
  r.applySettings("post", "on");
  assert.equal(useGame.getState().graphics.postFx, true);
  assert.equal(r.graphicsLive().postFx, true);
  assert.equal(choice("畫質", "on").selected, true);
  r.applySettings("volume", "silent");
  assert.equal(useGame.getState().phase, "title");
  assert.equal(useGame.getState().muted, true);
  assert.equal(r.volumeLive(), true);
  assert.equal(choice("音訊", "silent").selected, true);
  assert.equal(choice("音訊", "audible").isDefault, true);
  r.applySettings("volume", "audible");
  assert.equal(useGame.getState().muted, false);
  assert.equal(r.volumeLive(), false);
  assert.equal(choice("音訊", "audible").selected, true);
  r.applySettings("time", "night");
  assert.equal(useGame.getState().timeOfDay, "night");
  assert.equal(choice("時光", "night").selected, true);
  assert.equal(choice("時光", "sunset").selected, false);
  assert.equal(choice("時光", "sunset").isDefault, true);

  for (const [saved, text] of [
    ["pending", "正在保存…"],
    ["saved", "進度已保存"],
    ["error", "保存失敗"],
  ]) {
    useRpg.setState({ saved });
    assert.match(section("存檔").status, new RegExp(text));
  }

  useGame.setState({ phase: "playing" });
  useRpg.getState().setPanel("inventory");
  useRpg.setState({ panel: null });
  useGame.setState({ phase: "title", settingsOpen: false });
  useRpg.setState({ panel: "inventory" });
  r.openSettings();
  assert.equal(useGame.getState().phase, "title");
  assert.equal(useRpg.getState().panel, null);
  assert.equal(r.frontModal(), "settings");
  assert.equal(r.settingsReturnLabel("title"), "返回標題");
  r.applySettings("return");
  assert.equal(useGame.getState().phase, "title");
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.settingsVisible(), false);

  const awayX = SPAWN.x + 48;
  const awayZ = SPAWN.z - 36;
  const awayYaw = 1.15;
  stand("playing", awayX, awayZ, awayYaw);
  const playing = pose();
  assert.equal(mode(), "playing");
  r.openSettings();
  assert.equal(useGame.getState().phase, "paused");
  assert.equal(mode(), "paused");
  assert.deepEqual(pose(), playing);
  assert.equal(r.settingsReturnLabel(useGame.getState().phase), "返回遊戲");
  r.applySettings("return");
  assert.equal(useGame.getState().phase, "playing");
  assert.equal(mode(), "playing");
  assert.equal(r.settingsVisible(), false);
  assert.deepEqual(pose(), playing);
  useGame.getState().pause();
  assert.equal(mode(), "paused");
  useGame.getState().resume();
  assert.equal(mode(), "playing");
  assert.deepEqual(pose(), playing);

  stand("playing", awayX, awayZ, awayYaw);
  useRpg.setState({ panel: "inventory" });
  assert.equal(r.frontModal(), "panel");
  assert.equal(r.settingsVisible(), false);
  useRpg.setState({ panel: null });
  useGame.setState({ plaqueId: "library" });
  assert.equal(r.frontModal(), "plaque");
  useGame.setState({ plaqueId: null });
  useRpg.setState({ saveConflict: true });
  assert.equal(r.frontModal(), "save");
  useRpg.setState({ saveConflict: false });
  useRpg.setState({ boss: 1, claimed: [] });
  assert.equal(r.frontModal(), "victory");
  assert.equal(r.settingsVisible(), false);

  useRpg.setState({ panel: "map", saveConflict: true, boss: 1, claimed: [] });
  useGame.setState({ plaqueId: "library", phase: "playing", settingsOpen: false });
  r.openSettings();
  assert.equal(useRpg.getState().panel, null);
  assert.equal(useGame.getState().plaqueId, null);
  assert.equal(useRpg.getState().saveConflict, false);
  assert.equal(useRpg.getState().claimed.includes("semester"), true);
  assert.equal(r.frontModal(), "settings");
  assert.equal(r.settingsVisible(), true);
  flushSave();
  r.returnFromSettings();

  stand("paused", awayX, awayZ, awayYaw);
  useGame.setState({ settingsOpen: true });
  useRpg.getState().setPanel("journal");
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.frontModal(), "panel");
  useRpg.setState({ panel: null });
  useGame.setState({ settingsOpen: true, phase: "paused" });
  useGame.getState().openPlaque("library");
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.frontModal(), "plaque");
  useGame.setState({ plaqueId: null, settingsOpen: true, phase: "paused" });
  const foreign = JSON.stringify({ version: 2, marker: "foreign-settings" });
  savedData.set(RPG_SAVE_KEY, foreign);
  onStorage({ key: RPG_SAVE_KEY, newValue: foreign });
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.frontModal(), "save");
  useGame.setState({ settingsOpen: true });
  useRpg.getState().reloadProgress();
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.frontModal(), "save");
  useRpg.getState().keepProgress();
  useGame.setState({ settingsOpen: true, phase: "playing", plaqueId: null });
  useRpg.setState({ boss: 0, claimed: [], panel: null, hp: 100 });
  r.hitEnemy(
    { hp: 5, kind: "final", x: 1, z: 1, state: "idle", hurt: 0, timer: 0, id: "boss" },
    9,
  );
  assert.equal(useGame.getState().settingsOpen, false);
  assert.equal(r.frontModal(), "victory");
  r.openSettings();
  assert.equal(r.frontModal(), "settings");
  assert.equal(useRpg.getState().claimed.includes("semester"), true);
  flushSave();
  r.returnFromSettings();

  stand("playing", awayX, awayZ, awayYaw);
  r.applySettings("time", "night");
  r.applySettings("volume", "silent");
  const create = document.createElement;
  document.createElement = () => ({ click() {}, href: "", download: "" });
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:tamkang-save";
  URL.revokeObjectURL = () => {};
  try {
    r.applySettings("export");
    const exported = JSON.parse(savedData.get(RPG_SAVE_KEY));
    assert.equal(exported.pilgrimage.timeOfDay, "night");
    assert.equal(exported.pilgrimage.muted, true);
    assert.equal(exported.graphics, undefined);
    r.applySettings("time", "day");
    r.applySettings("volume", "audible");
    assert.equal(useRpg.getState().importSave(savedData.get(RPG_SAVE_KEY)), true);
    assert.equal(useGame.getState().timeOfDay, "night");
    assert.equal(useGame.getState().muted, true);
    assert.equal(r.loadLocal().timeOfDay, "night");
    assert.equal(r.loadLocal().muted, true);
  } finally {
    document.createElement = create;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
  }

  stand("playing", awayX, awayZ, awayYaw);
  r.applySettings("time", "wet");
  r.applySettings("tier", "low");
  r.applySettings("post", "off");
  r.applySettings("volume", "silent");
  const kept = r.loadLocal();
  assert.equal(kept.timeOfDay, "wet");
  assert.equal(kept.graphics.tier, "low");
  assert.equal(kept.graphics.postFx, false);
  assert.equal(kept.muted, true);
  assert.equal(useGame.getState().timeOfDay, "wet");
  assert.equal(r.graphicsLive().tier, "low");
  assert.equal(r.graphicsLive().postFx, false);
  assert.equal(r.volumeLive(), true);

  stand("playing", awayX, awayZ, awayYaw);
  useRpg.setState({ hp: 100, panel: null, interiorId: null, boss: 0, claimed: ["semester"] });
  useGame.setState({
    warp: { x: SPAWN.x, z: SPAWN.z, yaw: 0 },
    playerX: awayX,
    playerZ: awayZ,
    playerYaw: awayYaw,
  });
  const before = pose();
  const beforeMode = mode();
  r.applySettings("tier", "high");
  assert.equal(mode(), beforeMode);
  assert.equal(useGame.getState().phase, "playing");
  assert.deepEqual(pose(), before);
  assert.equal(useGame.getState().warp, null);
  assert.ok(useGame.getState().sceneEpoch > 0);
  const seed = r.followCameraSeed({ x: before.x, z: before.z, yaw: before.yaw });
  const span = (a, b) => Math.hypot(a.x - b.x, (a.z ?? 0) - (b.z ?? 0));
  const fx = -Math.sin(before.yaw);
  const fz = -Math.cos(before.yaw);
  assert.ok((seed.x - before.x) * fx + (seed.z - before.z) * fz < -1);
  assert.ok(span(seed, r.TITLE_ORBIT) > 10);
  assert.ok(span(seed, before) < span(seed, SPAWN));
  assert.ok(span(seed, before) < span(before, SPAWN));

  useRpg.getState().keepProgress();
  useGame.getState().setTime(r.SAVE_DEFAULTS.timeOfDay);
  useGame.getState().setGraphics({ ...r.SAVE_DEFAULTS.graphics });
  r.applySettings("volume", "audible");
  useGame.setState({
    settingsOpen: false,
    phase: "playing",
    plaqueId: null,
    warp: null,
    snapCam: false,
  });
  useRpg.setState({
    panel: null,
    saveConflict: false,
    boss: 0,
    claimed: [],
    saved: "saved",
    interiorId: null,
  });
});
test("home title reads empty, progress, a bad file, and a storage limit", () => {
  const hud = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/game/rpg/AdventureHud.tsx"),
    "utf8",
  );
  assert.match(hud, /readHome\(/);
  assert.match(hud, /enterHome\(/);
  assert.match(hud, /home\.primary/);
  assert.match(hud, /home\.kind === "progress"/);
  assert.match(hud, /home\.fileError/);
  assert.match(hud, /home\.storageLimit/);
  assert.match(hud, /home\.importLabel/);
  assert.match(hud, /home\.exportLabel/);
  assert.match(hud, /exportHomeBackup\(/);
  assert.match(hud, /stageImport\(/);
  assert.match(hud, /confirmImport\(/);
  assert.match(hud, /cancelImport\(/);
  assert.match(hud, /替換存檔/);
  const chem = DEPARTMENTS.find((item) => item.name === "化學學系");
  const history = DEPARTMENTS.find((item) => item.name === "歷史學系");
  assert.ok(chem && history && chem.id !== history.id);
  const doors = CAMPUS_SITES.map((site) => siteEntrance(site)).filter((entry) => {
    const resolved = resolveBuildings(entry.x, entry.z, 0.42, []);
    return Math.hypot(resolved.x - entry.x, resolved.z - entry.z) < 1e-6;
  });
  assert.ok(doors.length >= 2);
  const first = doors[0];
  const second = doors.find((entry) => entry.x !== first.x || entry.z !== first.z);
  assert.ok(second);
  const placed = () => {
    const game = useGame.getState();
    const rpg = useRpg.getState();
    return {
      departmentId: rpg.departmentId,
      xp: rpg.xp,
      x: game.playerX,
      z: game.playerZ,
      yaw: game.playerYaw,
      text: savedData.get(RPG_SAVE_KEY) ?? null,
    };
  };
  const samePlace = (left, right) => {
    assert.equal(left.departmentId, right.departmentId);
    assert.equal(left.xp, right.xp);
    assert.equal(left.x, right.x);
    assert.equal(left.z, right.z);
    assert.equal(left.yaw, right.yaw);
    assert.equal(left.text, right.text);
  };
  const stand = (x, z, yaw) => {
    useRpg.setState({
      panel: null,
      buildings: [],
      interiorId: null,
      incomingSave: null,
      freshStart: false,
      loot: [],
    });
    useGame.setState({
      phase: "playing",
      playerX: x,
      playerZ: z,
      playerYaw: yaw,
      warp: null,
      plaqueId: null,
      settingsOpen: false,
    });
  };
  const offered = (home) => {
    assert.match(home.importLabel, /匯入/);
    assert.match(home.exportLabel, /匯出/);
  };
  const storage = globalThis.localStorage;
  const originalSetItem = storage.setItem;
  const create = document.createElement;
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  try {
    stand(first.x, first.z, 0.65);
    useRpg.setState({ departmentId: chem.id, xp: 180 });
    flushSave();
    savedData.delete(RPG_SAVE_KEY);
    const emptyBefore = placed();
    const empty = r.readHome();
    assert.equal(empty.kind, "empty");
    assert.equal(empty.primary, r.CHROME_CONTROLS.startSemester);
    assert.notEqual(empty.primary, r.CHROME_CONTROLS.continueSemester);
    assert.equal(empty.major, null);
    assert.equal(empty.progress, null);
    assert.equal(empty.summary, null);
    assert.equal(empty.fileError, null);
    assert.equal(empty.storageLimit, null);
    offered(empty);
    assert.equal(r.stageImport("pending-text"), "direct");
    assert.equal(useRpg.getState().incomingSave, null);
    assert.equal(savedData.has(RPG_SAVE_KEY), false);
    useRpg.getState().chooseDepartment(history.id);
    assert.equal(useRpg.getState().departmentId, chem.id);
    r.enterHome();
    assert.equal(useGame.getState().phase, "title");
    assert.equal(useRpg.getState().panel, "department");
    assert.equal(useGame.getState().playerX, emptyBefore.x);
    assert.equal(useGame.getState().playerZ, emptyBefore.z);
    assert.equal(useGame.getState().playerYaw, emptyBefore.yaw);
    assert.equal(useRpg.getState().xp, emptyBefore.xp);
    assert.equal(savedData.get(RPG_SAVE_KEY) ?? null, null);
    useRpg.getState().chooseDepartment(history.id);
    assert.equal(useRpg.getState().departmentId, history.id);
    assert.equal(useGame.getState().phase, "playing");
    assert.equal(savedData.get(RPG_SAVE_KEY) ?? null, null);

    stand(first.x, first.z, 0.4);
    useRpg.setState({ departmentId: chem.id, xp: 180 });
    flushSave();
    const stored = savedData.get(RPG_SAVE_KEY);
    const file = JSON.parse(stored);
    assert.equal(file.departmentId, chem.id);
    assert.equal(file.xp, 180);
    useRpg.setState({ departmentId: history.id, xp: 20 });
    useGame.setState({ playerX: second.x, playerZ: second.z, playerYaw: 1.7 });
    savedData.set(RPG_SAVE_KEY, stored);
    const progress = r.readHome();
    assert.equal(progress.kind, "progress");
    assert.equal(progress.primary, r.CHROME_CONTROLS.continueSemester);
    assert.equal(progress.major, chem.name);
    const bar = r.progressReadout({ xp: file.xp });
    assert.equal(progress.progress, bar.line);
    assert.equal(progress.summary.includes(chem.name), true);
    assert.equal(progress.summary.includes(`等級 ${bar.level}`), true);
    assert.equal(progress.fileError, null);
    assert.equal(progress.storageLimit, null);
    offered(progress);
    r.enterHome();
    assert.equal(useGame.getState().phase, "playing");
    assert.equal(useRpg.getState().departmentId, file.departmentId);
    assert.equal(useRpg.getState().xp, file.xp);
    assert.equal(useGame.getState().playerX, file.position.x);
    assert.equal(useGame.getState().playerZ, file.position.z);
    assert.equal(useGame.getState().playerYaw, file.position.yaw);
    assert.notEqual(useRpg.getState().departmentId, history.id);

    stand(first.x, first.z, 0.4);
    useRpg.setState({ departmentId: chem.id, xp: 180 });
    flushSave();
    savedData.set(RPG_SAVE_KEY, "{");
    const fileBefore = placed();
    const broken = r.readHome();
    assert.equal(broken.kind, "file");
    assert.equal(broken.fileError, r.HOME_FILE_ERROR);
    assert.match(broken.fileError, /檔案錯誤/);
    assert.equal(broken.storageLimit, null);
    assert.equal(broken.major, null);
    assert.equal(broken.progress, null);
    assert.equal(broken.summary, null);
    assert.equal(broken.primary, r.CHROME_CONTROLS.startSemester);
    assert.notEqual(broken.primary, r.CHROME_CONTROLS.continueSemester);
    offered(broken);
    r.enterHome();
    assert.equal(useGame.getState().phase, "title");
    assert.equal(useRpg.getState().xp, fileBefore.xp);
    assert.equal(useGame.getState().playerX, fileBefore.x);
    assert.equal(useGame.getState().playerZ, fileBefore.z);
    assert.equal(useGame.getState().playerYaw, fileBefore.yaw);
    assert.equal(savedData.get(RPG_SAVE_KEY), "{");
    assert.equal(useRpg.getState().departmentId, null);

    stand(first.x, first.z, 0.4);
    useRpg.setState({ departmentId: chem.id, xp: 180 });
    flushSave();
    const storedBefore = placed();
    assert.equal(JSON.parse(storedBefore.text).departmentId, chem.id);
    storage.setItem = (key, value) => {
      if (key === RPG_SAVE_KEY) throw new Error("quota");
      return originalSetItem.call(storage, key, value);
    };
    const limited = r.readHome();
    assert.equal(limited.kind, "storage");
    assert.equal(limited.storageLimit, r.HOME_STORAGE_LIMIT);
    assert.match(limited.storageLimit, /儲存限制/);
    assert.equal(limited.fileError, null);
    assert.equal(limited.major, null);
    assert.equal(limited.progress, null);
    assert.equal(limited.summary, null);
    assert.equal(limited.primary, r.CHROME_CONTROLS.startSemester);
    assert.notEqual(limited.primary, r.CHROME_CONTROLS.continueSemester);
    offered(limited);
    const keptText = savedData.get(RPG_SAVE_KEY);
    useRpg.getState().chooseDepartment(history.id);
    assert.equal(useRpg.getState().departmentId, chem.id);
    r.enterHome();
    assert.equal(useGame.getState().phase, "title");
    assert.equal(savedData.get(RPG_SAVE_KEY), keptText);
    assert.equal(useGame.getState().playerX, storedBefore.x);
    assert.equal(useGame.getState().playerZ, storedBefore.z);
    assert.equal(useGame.getState().playerYaw, storedBefore.yaw);
    useRpg.getState().chooseDepartment(history.id);
    assert.equal(useRpg.getState().departmentId, history.id);
    assert.equal(useGame.getState().phase, "playing");
    flushSave();
    assert.equal(savedData.get(RPG_SAVE_KEY), keptText);
    assert.equal(useRpg.getState().saved, "error");
    storage.setItem = originalSetItem;

    stand(first.x, first.z, 0.4);
    useRpg.setState({ departmentId: chem.id, xp: 180 });
    flushSave();
    const original = savedData.get(RPG_SAVE_KEY);
    const otherText = JSON.stringify({
      version: 2,
      hp: 90,
      xp: 240,
      departmentId: history.id,
      slots: [],
      buildings: [],
      position: { x: second.x, z: second.z, yaw: 1.1 },
    });
    assert.equal(r.stageImport(otherText), "confirm");
    assert.equal(useRpg.getState().incomingSave, otherText);
    useRpg.setState({ xp: 230 });
    document.createElement = () => ({ click() {}, href: "", download: "" });
    URL.createObjectURL = () => "blob:tamkang-home";
    URL.revokeObjectURL = () => {};
    const exported = r.exportHomeBackup();
    assert.equal(exported, original);
    assert.equal(JSON.parse(exported).xp, 180);
    assert.equal(savedData.get(RPG_SAVE_KEY), original);
    assert.equal(useRpg.getState().xp, 230);
    assert.equal(useRpg.getState().incomingSave, otherText);
    const held = placed();
    r.cancelImport();
    assert.equal(useRpg.getState().incomingSave, null);
    samePlace(held, placed());
    assert.equal(r.stageImport("not-json"), "confirm");
    assert.equal(r.confirmImport(), false);
    assert.equal(useRpg.getState().incomingSave, null);
    samePlace(held, placed());
    assert.equal(r.stageImport(otherText), "confirm");
    assert.equal(r.confirmImport(), true);
    assert.equal(useRpg.getState().departmentId, history.id);
    assert.equal(useRpg.getState().xp, 240);
    assert.equal(useGame.getState().playerX, second.x);
    assert.equal(useGame.getState().playerZ, second.z);
    assert.equal(useGame.getState().playerYaw, 1.1);
    assert.notEqual(savedData.get(RPG_SAVE_KEY), original);
    const replaced = JSON.parse(savedData.get(RPG_SAVE_KEY));
    assert.equal(replaced.departmentId, history.id);
    assert.equal(replaced.xp, 240);
  } finally {
    storage.setItem = originalSetItem;
    document.createElement = create;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    useRpg.getState().keepProgress();
    useRpg.setState({
      incomingSave: null,
      freshStart: false,
      panel: null,
      saveConflict: false,
      saved: "saved",
      notice: "",
      departmentId: DEPARTMENTS[0].id,
      xp: 0,
    });
    useGame.getState().setTime(r.SAVE_DEFAULTS.timeOfDay);
    useGame.getState().setGraphics({ ...r.SAVE_DEFAULTS.graphics });
    if (useGame.getState().muted) r.applySettings("volume", "audible");
    useGame.setState({
      settingsOpen: false,
      phase: "playing",
      plaqueId: null,
      warp: null,
      snapCam: false,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
    });
    flushSave();
  }
});

test("lesson guides one real action at a time", () => {
  const hud = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/game/rpg/AdventureHud.tsx"),
    "utf8",
  );
  const shown = hud.slice(hud.indexOf("{showSettings &&"), hud.indexOf("{plaque &&"));
  assert.match(hud, /略過/);
  assert.match(hud, /重看操作/);
  assert.match(hud, /observeSupply\(/);
  assert.match(hud, /lessonReadout\(/);
  assert.match(hud, /#ddaf61/);
  assert.match(hud, /ad-lesson-reach/);
  assert.equal(/coarse|matchMedia|KeyE|Escape/.test(shown), false);
  assert.match(hud, /plaque && !state\.panel && !showSettings/);

  const chem = DEPARTMENTS.find((d) => d.name === "化學學系");
  const steps = ["選系", "移動", "靠近補給", "第一次普攻", "第一次科系技能"];
  const only = (objective) => {
    const read = r.lessonReadout();
    assert.equal(read.objective, objective);
    assert.equal(steps.filter((item) => item === read.objective).length, 1);
    assert.ok(read.marker);
    assert.equal(read.review, false);
    assert.equal(read.reminder, null);
    return read;
  };
  const where = () => {
    const g = useGame.getState();
    const s = useRpg.getState();
    return `${g.playerX.toFixed(1)},${g.playerZ.toFixed(1)} ${s.lesson} ${g.phase}`;
  };
  const nearestSupply = () => {
    const g = useGame.getState();
    let best = SUPPLY_NODES[0];
    let distance = Infinity;
    for (const node of SUPPLY_NODES) {
      const next = Math.hypot(node.x - g.playerX, node.z - g.playerZ);
      if (next < distance) {
        best = node;
        distance = next;
      }
    }
    return { node: best, distance };
  };
  const nearestFoe = () => {
    const g = useGame.getState();
    let enemy = null;
    let distance = Infinity;
    for (const foe of useRpg.getState().enemies) {
      if (foe.hp <= 0) continue;
      const next = Math.hypot(foe.x - g.playerX, foe.z - g.playerZ);
      if (next < distance) {
        enemy = foe;
        distance = next;
      }
    }
    return { enemy, distance };
  };
  const aimAt = (x, z) => {
    const g = useGame.getState();
    useGame.setState({
      playerYaw: Math.atan2(-(x - g.playerX), -(z - g.playerZ)),
    });
  };
  const holdForward = () => {
    rpgInput.pointerDown(7, "stick", 0, 0);
    rpgInput.pointerMove(7, 0, -STICK_RADIUS);
  };
  const walkToward = (x, z, done, cap = 900) => {
    useGame.getState().clearWarp();
    holdForward();
    for (let i = 0; i < cap; i += 1) {
      if (done()) return true;
      const g = useGame.getState();
      const base = Math.atan2(-(x - g.playerX), -(z - g.playerZ));
      let moved = false;
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
        useGame.setState({ playerYaw: base + turn });
        if (r.stepTouchWalk(0.25)) {
          moved = true;
          break;
        }
      }
      if (!moved) return done();
    }
    return done();
  };
  const ready = () => {
    const s = useRpg.getState();
    useRpg.setState({
      clock: Math.max(s.clock, s.attackUntil, s.skillUntil) + 0.05,
      focus: 100,
      panel: null,
      interiorId: null,
      buildKind: null,
      hp: Math.max(1, s.hp),
    });
    useGame.setState({ phase: "playing", plaqueId: null });
    useGame.getState().clearWarp();
  };
  try {
    rpgInput.releaseEdges(true);
    savedData.set(RPG_SAVE_KEY, "{");
    r.loadSavedLesson();
    assert.equal(useRpg.getState().departmentId, null);
    assert.equal(useRpg.getState().freshStart, false);
    savedData.delete(RPG_SAVE_KEY);
    r.loadSavedLesson();
    useGame.setState({ phase: "playing", plaqueId: null, warp: null, playerX: -5, playerZ: -45, playerYaw: 0 });
    useRpg.setState({ panel: null, interiorId: null, hp: 100, focus: 100, buildings: [], loot: [] });
    const opened = only("選系");
    useGame.getState().setPlayer(opened.marker.x + 80, opened.marker.z + 80, 0);
    assert.equal(r.lessonReadout().prompt, null);
    assert.equal(r.lessonReadout().objective, "選系");
    useGame.getState().setPlayer(opened.marker.x, opened.marker.z, 0);
    assert.equal(r.lessonReadout().prompt, "點一個科系");
    useGame.getState().setPlayer(opened.marker.x + 80, opened.marker.z, 0);
    assert.equal(r.lessonReadout().prompt, null);
    useRpg.setState({ panel: "department" });
    assert.equal(r.lessonReadout().prompt, "點一個科系");
    useRpg.setState({ panel: null });
    assert.equal(r.lessonReadout().objective, "選系");
    assert.equal(r.lessonReadout().prompt, null);
    r.openLessonReview();
    assert.equal(r.lessonReadout().review, false);
    r.touchStrike();
    r.touchStrike(true);
    assert.equal(r.lessonReadout().objective, "選系");
    const stillX = useGame.getState().playerX;
    const stillZ = useGame.getState().playerZ;
    assert.equal(r.stepTouchWalk(0.2), false);
    assert.equal(useGame.getState().playerX, stillX);
    assert.equal(useGame.getState().playerZ, stillZ);

    useGame.getState().setPlayer(-5, -45, 0);
    useGame.getState().clearWarp();
    useRpg.getState().chooseDepartment(chem.id);
    const moving = only("移動");
    assert.equal(moving.prompt, null);
    assert.equal(useGame.getState().phase, "playing");
    const parkedX = useGame.getState().playerX;
    const parkedZ = useGame.getState().playerZ;
    assert.equal(r.stepTouchWalk(0.2), false);
    assert.equal(useGame.getState().playerX, parkedX);
    assert.equal(useGame.getState().playerZ, parkedZ);
    assert.equal(r.lessonReadout().objective, "移動");
    ready();
    r.touchStrike(true);
    assert.equal(r.lessonReadout().objective, "移動");
    assert.ok(useRpg.getState().focus < 100);
    useRpg.setState({ panel: "journal" });
    const blockedUntil = useRpg.getState().attackUntil;
    r.touchStrike();
    assert.equal(useRpg.getState().attackUntil, blockedUntil);
    assert.equal(r.lessonReadout().objective, "移動");
    useRpg.setState({ panel: null });

    let sawMovePrompt = false;
    holdForward();
    for (let i = 0; i < 12 && !sawMovePrompt; i += 1) {
      const read = r.lessonReadout();
      if (read.objective === "移動" && read.prompt === "走到地圖標記") sawMovePrompt = true;
      else {
        aimAt(read.marker.x, read.marker.z);
        assert.equal(r.stepTouchWalk(0.2), true, where());
      }
    }
    assert.equal(sawMovePrompt, true);
    assert.equal(r.lessonReadout().objective, "移動");
    const markerBefore = { ...r.lessonReadout().marker };

    const door = CAMPUS_SITES.find((site) => site.form !== "court");
    useRpg.getState().enter(door.id);
    useGame.getState().clearWarp();
    assert.equal(useRpg.getState().interiorId, door.id);
    assert.equal(r.lessonReadout().objective, "移動");
    const inside = r.promptDecision(r.promptSnap());
    assert.ok(inside);
    assert.equal(r.lessonReadout().objective, "移動");
    useRpg.getState().exit();
    useGame.getState().clearWarp();
    assert.equal(useRpg.getState().interiorId, null);
    assert.equal(r.lessonReadout().objective, "移動");

    flushSave();
    const mid = savedData.get(RPG_SAVE_KEY);
    const stored = JSON.parse(mid);
    assert.equal(stored.version, 2);
    assert.equal(stored.lesson, "move");
    assert.equal(stored.lessonAnchor.x, markerBefore.x);
    assert.equal(stored.lessonAnchor.z, markerBefore.z + 5);
    const old = JSON.stringify({
      version: 2,
      hp: 100,
      xp: 40,
      departmentId: chem.id,
      slots: [],
      buildings: [],
    });
    assert.equal(Object.hasOwn(JSON.parse(old), "lesson"), false);
    assert.equal(useRpg.getState().importSave(old), true);
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(r.lessonReadout().marker, null);
    savedData.set(RPG_SAVE_KEY, mid);
    r.loadSavedLesson();
    const restored = only("移動");
    assert.equal(restored.marker.x, markerBefore.x);
    assert.equal(restored.marker.z, markerBefore.z);
    {
      const g = useGame.getState();
      const dist = Math.hypot(g.playerX - restored.marker.x, g.playerZ - restored.marker.z);
      if (dist > 20) assert.equal(restored.prompt, null);
    }

    assert.equal(
      walkToward(restored.marker.x, restored.marker.z, () => r.lessonReadout().objective !== "移動"),
      true,
      where(),
    );
    const supplied = only("靠近補給");
    assert.notEqual(supplied.prompt, "走到地圖標記");
    if (nearestSupply().distance >= r.SUPPLY_REACH) {
      assert.equal(supplied.prompt, null);
      assert.equal(r.observeSupply(), false);
      assert.equal(r.lessonReadout().objective, "靠近補給");
    }
    assert.equal(
      walkToward(
        nearestSupply().node.x,
        nearestSupply().node.z,
        () => nearestSupply().distance < r.SUPPLY_REACH,
      ),
      true,
      where(),
    );
    assert.equal(nearestSupply().distance < r.SUPPLY_REACH, true);
    const closeSupply = only("靠近補給");
    assert.equal(closeSupply.prompt, "這是補給");
    assert.equal(r.stepTouchWalk(0), false);
    assert.equal(r.lessonReadout().objective, "靠近補給");
    const worldSupply = r.promptDecision(r.promptSnap());
    assert.equal(worldSupply.kind, "supply");
    assert.equal(r.observeSupply(), true);
    assert.equal(nearestSupply().distance < r.SUPPLY_REACH, true);
    assert.equal(r.lessonReadout().objective, "第一次普攻");
    assert.notEqual(r.lessonReadout().prompt, "這是補給");
    assert.equal(r.promptDecision(r.promptSnap()).kind, "supply");

    const farFoe = nearestFoe();
    assert.ok(farFoe.enemy);
    if (farFoe.distance > 30) assert.equal(r.lessonReadout().prompt, null);
    ready();
    r.touchStrike(true);
    assert.equal(r.lessonReadout().objective, "第一次普攻");
    useRpg.setState({ panel: "map" });
    r.touchStrike();
    assert.equal(r.lessonReadout().objective, "第一次普攻");
    useRpg.setState({ panel: null });
    assert.equal(
      walkToward(farFoe.enemy.x, farFoe.enemy.z, () => {
        const read = r.lessonReadout();
        return read.objective === "第一次普攻" && read.prompt === "打出這一擊";
      }),
      true,
      where(),
    );
    assert.equal(only("第一次普攻").prompt, "打出這一擊");
    ready();
    const swingClock = useRpg.getState().clock;
    r.touchStrike();
    assert.ok(useRpg.getState().attackUntil > swingClock);
    const afterSwing = r.lessonReadout();
    assert.equal(afterSwing.objective, "第一次科系技能");
    assert.notEqual(afterSwing.prompt, "打出這一擊");
    ready();
    r.touchStrike();
    assert.equal(r.lessonReadout().objective, "第一次科系技能");
    useRpg.setState({ focus: 10 });
    r.touchStrike(true);
    assert.equal(useRpg.getState().focus, 10);
    assert.equal(r.lessonReadout().objective, "第一次科系技能");
    if (r.lessonReadout().prompt !== "放出這一招") {
      const foe = nearestFoe().enemy;
      assert.ok(foe, where());
      assert.equal(
        walkToward(foe.x, foe.z, () => r.lessonReadout().prompt === "放出這一招"),
        true,
        where(),
      );
    }
    assert.equal(only("第一次科系技能").prompt, "放出這一招");
    ready();
    r.touchStrike(true);
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(r.lessonReadout().prompt, null);
    assert.equal(r.lessonReadout().marker, null);
    assert.equal(r.lessonReadout().step, null);
    const exploredX = useGame.getState().playerX;
    aimAt(exploredX + 4, useGame.getState().playerZ);
    holdForward();
    assert.equal(r.stepTouchWalk(0.25), true, where());
    assert.notEqual(useGame.getState().playerX, exploredX);
    assert.equal(useGame.getState().phase, "playing");
    ready();
    r.touchStrike();
    assert.equal(r.lessonReadout().objective, null);

    const pose = () => {
      const g = useGame.getState();
      return { x: g.playerX, z: g.playerZ, yaw: g.playerYaw, phase: g.phase };
    };
    flushSave();
    savedData.delete(RPG_SAVE_KEY);
    r.loadSavedLesson();
    useGame.setState({ phase: "playing", plaqueId: null, warp: null });
    useRpg.setState({ panel: null, interiorId: null, hp: 100 });
    assert.equal(r.lessonReadout().objective, "選系");
    const skippedAt = pose();
    r.skipLesson();
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(r.lessonReadout().step, null);
    assert.equal(useGame.getState().playerX, skippedAt.x);
    assert.equal(useGame.getState().playerZ, skippedAt.z);
    assert.equal(useGame.getState().phase, skippedAt.phase);
    r.openLessonReview();
    assert.equal(r.lessonReadout().review, true);
    assert.equal(r.lessonReadout().objective, null);
    assert.match(r.lessonReadout().reminder, /不需要實體鍵/);
    assert.match(r.lessonReadout().reminder, /搖桿/);
    r.closeLessonReview();
    assert.equal(r.lessonReadout().review, false);
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(useGame.getState().playerX, skippedAt.x);
    assert.equal(useGame.getState().playerZ, skippedAt.z);
    assert.equal(useGame.getState().playerYaw, skippedAt.yaw);
    assert.equal(useGame.getState().phase, skippedAt.phase);
    r.enterHome();
    assert.equal(useRpg.getState().lesson, "done");
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(useRpg.getState().panel, "department");
    flushSave();
    r.loadSavedLesson();
    assert.equal(useRpg.getState().lesson, "done");
    assert.equal(r.lessonReadout().objective, null);

    const legacy = JSON.stringify({
      version: 2,
      hp: 100,
      xp: 180,
      departmentId: chem.id,
      slots: [],
      buildings: [],
    });
    assert.equal(useRpg.getState().importSave(legacy), true);
    assert.equal(useRpg.getState().lesson, "done");
    assert.equal(useRpg.getState().departmentId, chem.id);
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(r.lessonReadout().marker, null);
    const kept = pose();
    r.openLessonReview();
    assert.equal(r.lessonReadout().step, null);
    assert.match(r.lessonReadout().reminder, /普攻/);
    r.closeLessonReview();
    assert.equal(useGame.getState().playerX, kept.x);
    assert.equal(useGame.getState().playerZ, kept.z);
    assert.equal(useGame.getState().playerYaw, kept.yaw);
    assert.equal(useGame.getState().phase, kept.phase);
    assert.equal(r.lessonReadout().objective, null);
    assert.equal(useRpg.getState().lesson, "done");
  } finally {
    rpgInput.releaseEdges(true);
    useGame.getState().clearWarp();
    useRpg.setState({
      lesson: initial.lesson,
      lessonAnchor: initial.lessonAnchor,
      lessonReview: false,
      freshStart: false,
      panel: null,
      interiorId: null,
      departmentId: DEPARTMENTS[0].id,
      hp: 100,
      focus: 100,
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      warp: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
    });
    flushSave();
  }
});

test("pack keeps stored slot order while the backpack view filters and sorts", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const panelStart = hud.indexOf("const PACK_FILTERS");
  const panel = hud.slice(panelStart, hud.indexOf("\nfunction SkillPanel(", panelStart));
  assert.match(panel, /packView\(/);
  assert.match(panel, /\{row\.icon\}/);
  assert.match(panel, /\{row\.name\}/);
  assert.match(panel, /\{row\.quantity\}/);
  assert.match(panel, /\{row\.state\}/);
  assert.match(panel, /耗材/);
  assert.match(panel, /材料/);
  assert.match(panel, /裝備/);
  assert.match(panel, /稀有/);
  assert.match(panel, /背包是空的。/);
  assert.match(panel, /沒有符合的物品。/);
  assert.match(panel, /slotCap\(rpg\.loadout, rpg\.pockets/);
  assert.match(panel, /格/);
  const selectedAt = css.indexOf(".ad-slot.selected {");
  const selectedRule = css.slice(selectedAt, css.indexOf("}", selectedAt));
  const slotAt = css.indexOf(".ad-slot {");
  const slotRule = css.slice(slotAt, css.indexOf("}", slotAt));
  assert.match(selectedRule, /outline:/);
  assert.doesNotMatch(slotRule, /outline:/);
  assert.notEqual(selectedRule, slotRule);
  for (const block of css.matchAll(/\.ad-slot[^{]*\{[^}]*\}/g)) {
    assert.doesNotMatch(block[0], /text-overflow:\s*ellipsis/);
    if (block[0].includes("small")) assert.doesNotMatch(block[0], /display:\s*none/);
  }
  assert.doesNotMatch(css, /\.ad-slot small\s*\{[^}]*display:\s*none/);

  const viewOf = (filter, sort, extra = {}) => {
    const state = useRpg.getState();
    return r.packView(inventory.slots(), {
      filter,
      sort,
      hp: extra.hp ?? state.hp,
      maxHp: r.maxHp(state),
      focus: extra.focus ?? state.focus,
      equipped: extra.equipped ?? state.equipped,
    });
  };
  const listed = (slots) => slots.map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
  try {
    inventory.clear();
    assert.equal(inventory.slots().length, 0);
    assert.deepEqual(viewOf("all", "stored"), []);
    assert.equal(inventory.count("notes"), 0);

    const coffee = ITEMS.find((item) => item.id === "coffee");
    assert.ok(coffee.maxStack > 1);
    assert.equal(inventory.add("coffee", coffee.maxStack - 1).overflow, 0);
    assert.equal(inventory.slots().length, 1);
    assert.equal(inventory.slots()[0].itemId, "coffee");
    assert.equal(inventory.slots()[0].quantity, coffee.maxStack - 1);
    assert.equal(inventory.add("coffee", 2).overflow, 0);
    assert.equal(inventory.slots().length, 2);
    assert.equal(inventory.slots()[0].quantity, coffee.maxStack);
    assert.equal(inventory.slots()[1].itemId, "coffee");
    assert.equal(inventory.slots()[1].quantity, 1);
    const stacked = viewOf("consumable", "stored");
    assert.equal(stacked.length, 2);
    assert.deepEqual(
      stacked.map((row) => [row.index, row.quantity]),
      [[0, coffee.maxStack], [1, 1]],
    );

    inventory.clear();
    assert.equal(inventory.add("notes", 4).overflow, 0);
    assert.equal(inventory.add("coffee", 2).overflow, 0);
    assert.equal(inventory.add("badge", 1).overflow, 0);
    assert.equal(inventory.add("credit", 3).overflow, 0);
    const stored = listed(inventory.slots());
    const mixed = viewOf("all", "stored");
    assert.deepEqual(
      mixed.map((row) => ({ itemId: row.itemId, quantity: row.quantity, index: row.index })),
      stored.map((slot, index) => ({ ...slot, index })),
    );
    assert.deepEqual(viewOf("material", "stored").map((row) => row.name), ["課堂筆記"]);
    assert.equal(viewOf("material", "stored")[0].usable, false);
    assert.deepEqual(viewOf("consumable", "name").map((row) => row.name), ["冰咖啡"]);
    assert.equal(viewOf("equipment", "stored")[0].name, "五虎崗徽章");
    assert.equal(viewOf("equipment", "stored")[0].state, "可裝備");
    assert.deepEqual(viewOf("rare", "stored").map((row) => row.name), ["學分結晶"]);
    assert.equal(viewOf("rare", "quantity")[0].quantity, 3);
    const byName = viewOf("all", "name");
    assert.deepEqual(
      byName.map((row) => row.name),
      [...byName.map((row) => row.name)].sort((a, b) => a.localeCompare(b, "zh-Hant")),
    );
    assert.deepEqual(listed(inventory.slots()), stored);
    const byCount = viewOf("all", "quantity");
    assert.deepEqual(
      byCount.map((row) => row.quantity),
      [...byCount.map((row) => row.quantity)].sort((a, b) => b - a),
    );
    for (const row of byCount) {
      assert.equal(inventory.slots()[row.index].itemId, row.itemId);
      assert.equal(inventory.slots()[row.index].quantity, row.quantity);
    }
    assert.deepEqual(listed(inventory.slots()), stored);
    const pose = {
      x: useGame.getState().playerX,
      z: useGame.getState().playerZ,
      yaw: useGame.getState().playerYaw,
    };
    useRpg.getState().setPanel("inventory");
    useRpg.getState().setPanel(null);
    assert.equal(useGame.getState().playerX, pose.x);
    assert.equal(useGame.getState().playerZ, pose.z);
    assert.equal(useGame.getState().playerYaw, pose.yaw);
    assert.equal(useGame.getState().phase, "playing");
    assert.deepEqual(listed(inventory.slots()), stored);
    flushSave();
    const saved = JSON.parse(savedData.get(RPG_SAVE_KEY));
    assert.deepEqual(listed(saved.slots), stored);

    inventory.clear();
    assert.equal(inventory.add("notes", 2).overflow, 0);
    assert.deepEqual(viewOf("consumable", "stored"), []);
    assert.equal(viewOf("material", "stored")[0].name, "課堂筆記");

    inventory.clear();
    assert.equal(inventory.add("coffee", 2).overflow, 0);
    useRpg.setState({ hp: 100, focus: 100, xp: 0, equipped: false });
    const full = viewOf("consumable", "stored");
    assert.equal(full.length, 1);
    assert.equal(full[0].usable, false);
    assert.equal(full[0].state, "不可用");
    assert.equal(full[0].name, "冰咖啡");
    assert.equal(full[0].quantity, 2);
    useRpg.getState().useItem("coffee");
    assert.equal(inventory.slots()[0].quantity, 2);
    assert.equal(inventory.count("coffee"), 2);
    useRpg.setState({ hp: 40 });
    const hurt = viewOf("consumable", "stored");
    assert.equal(hurt[0].usable, true);
    assert.equal(hurt[0].state, "可使用");
    useRpg.getState().useItem("coffee");
    assert.equal(inventory.slots()[0].itemId, "coffee");
    assert.equal(inventory.slots()[0].quantity, 1);
    assert.equal(inventory.count("coffee"), 1);

    inventory.clear();
    assert.equal(inventory.add("badge", 1).overflow, 0);
    useRpg.setState({ equipped: false, hp: 100, xp: 0 });
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, true);
    assert.equal(viewOf("equipment", "stored")[0].state, "已裝備");
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, false);
    assert.equal(viewOf("equipment", "stored")[0].state, "可裝備");

    inventory.clear();
    let added = { overflow: 0 };
    let steps = 0;
    while (added.overflow === 0 && steps < 40) {
      added = inventory.add("badge", 1);
      steps += 1;
    }
    assert.equal(inventory.slots().length, 24);
    assert.ok(added.overflow > 0);
    assert.equal(inventory.count("badge"), 24);
    assert.ok(inventory.slots().every((slot) => slot.itemId === "badge" && slot.quantity > 0));
    assert.equal(inventory.add("notes", 3).overflow, 3);
    assert.equal(inventory.slots().length, 24);
    assert.equal(inventory.count("notes"), 0);
    assert.equal(viewOf("all", "name").length, 24);
  } finally {
    inventory.clear();
    for (const [id, n] of [
      ["notes", 60],
      ["parts", 60],
      ["credit", 10],
      ["coffee", 3],
      ["tea", 3],
    ])
      inventory.add(id, n);
    useRpg.setState({
      panel: null,
      equipped: false,
      hp: 100,
      focus: 100,
      xp: 0,
      freshStart: false,
    });
    useGame.setState({
      phase: "playing",
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
      warp: null,
    });
    flushSave();
  }
});

test("itemdetail shares purpose, effect, count, clue, and action with use, equip, and the quickbar", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const hud = readFileSync(join(root, "../src/game/rpg/AdventureHud.tsx"), "utf8");
  const panelStart = hud.indexOf("const PACK_FILTERS");
  const panel = hud.slice(panelStart, hud.indexOf("\nfunction SkillPanel(", panelStart));
  assert.match(panel, /itemDetail\(/);
  for (const label of ["用途", "現有效果", "數量", "取得線索", "主要動作"]) {
    assert.match(panel, new RegExp(label));
  }
  for (const field of ["purpose", "effect", "quantity", "clue", "action"]) {
    assert.match(panel, new RegExp("detail\\." + field));
  }
  assert.match(panel, /detail\.lifeFrom/);
  assert.match(panel, /detail\.lifeTo/);
  assert.match(panel, /detail\.attackFrom/);
  assert.match(panel, /detail\.attackTo/);
  assert.match(panel, /onClick=\{\(\) => useRpg\.getState\(\)\.useItem\(item\.id\)\}/);
  assert.match(panel, /onClick=\{\(\) => useRpg\.getState\(\)\.equip\(\)\}/);
  assert.match(hud, /useItem\("coffee"\)/);
  assert.match(hud, /useItem\("tea"\)/);
  assert.match(hud, /inventory\.has\("coffee"\)/);
  assert.match(hud, /inventory\.has\("tea"\)/);

  const listed = (slots) => slots.map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
  const snap = () => {
    const s = useRpg.getState();
    const g = useGame.getState();
    return {
      phase: g.phase,
      plaqueId: g.plaqueId,
      panel: s.panel,
      hp: s.hp,
      focus: s.focus,
      xp: s.xp,
      equipped: s.equipped,
      departmentId: s.departmentId,
      buildKind: s.buildKind,
      interiorId: s.interiorId,
      clock: s.clock,
      skillUntil: s.skillUntil,
      dodgeUntil: s.dodgeUntil,
      attackUntil: s.attackUntil,
      coffee: inventory.count("coffee"),
      tea: inventory.count("tea"),
    };
  };
  const detailFor = (itemId) => {
    const s = useRpg.getState();
    return r.itemDetail({
      itemId,
      count: inventory.count(itemId),
      hp: s.hp,
      focus: s.focus,
      xp: s.xp,
      equipped: s.equipped,
    });
  };
  const rowsFor = (filter) => {
    const s = useRpg.getState();
    return r.packView(inventory.slots(), {
      filter,
      sort: "stored",
      hp: s.hp,
      maxHp: r.maxHp(s),
      focus: s.focus,
      equipped: s.equipped,
    });
  };
  const shownDetail = (filter, selectedIndex) => {
    const rows = rowsFor(filter);
    const shown = rows.find((row) => row.index === selectedIndex) ?? rows[0];
    assert.ok(shown, filter);
    const detail = detailFor(shown.itemId);
    const item = ITEMS.find((entry) => entry.id === shown.itemId);
    assert.equal(detail.itemId, shown.itemId);
    assert.equal(detail.quantity, inventory.count(shown.itemId));
    assert.equal(detail.purpose, item.description);
    for (const field of ["purpose", "effect", "clue", "action"]) {
      assert.equal(typeof detail[field], "string", field);
      assert.ok(detail[field].length > 0, field);
    }
    return { shown, detail };
  };
  const assertClueGrants = (itemId, clue) => {
    if (clue.startsWith("補給：")) {
      const site = CAMPUS_SITES.find((entry) => entry.name === clue.slice("補給：".length));
      assert.ok(site, clue);
      const node = SUPPLY_NODES.find((entry) => entry.id === "supply-" + site.id);
      assert.ok(node, clue);
      assert.ok(Number(node.items[itemId] ?? 0) > 0, clue);
      return;
    }
    if (clue.startsWith("委託：")) {
      const mission = MISSIONS.find((entry) => entry.name === clue.slice("委託：".length));
      assert.ok(mission, clue);
      assert.ok(Number(mission.reward[itemId] ?? 0) > 0, clue);
      return;
    }
    if (clue.startsWith("擊退：")) {
      const enemy = Object.values(ENEMY_TYPES).find((entry) => entry.name === clue.slice("擊退：".length));
      assert.ok(enemy, clue);
      assert.ok(Number(enemy.reward[itemId] ?? 0) > 0, clue);
      return;
    }
    assert.fail(clue);
  };
  const barAgrees = () => {
    const s = useRpg.getState();
    const view = r.quickbarReadout(snap());
    const coffee = r.itemVerdict({
      id: "coffee",
      count: inventory.count("coffee"),
      hp: s.hp,
      maxLife: r.maxHp(s),
      focus: s.focus,
      action: "use",
    });
    const tea = r.itemVerdict({
      id: "tea",
      count: inventory.count("tea"),
      hp: s.hp,
      maxLife: r.maxHp(s),
      focus: s.focus,
      action: "use",
    });
    const blocked = s.panel || s.hp <= 0 || useGame.getState().phase !== "playing";
    if (!blocked) {
      assert.equal(view.coffee.mark, coffee.mark);
      assert.equal(view.tea.mark, tea.mark);
    }
    assert.equal(view.coffee.count, inventory.count("coffee"));
    assert.equal(view.tea.count, inventory.count("tea"));
    return { view, coffee, tea };
  };
  const basicSwing = () => {
    const enemy = useRpg.getState().enemies.find((entry) => entry.id === "quiz-1");
    assert.ok(enemy);
    enemy.hp = 400;
    enemy.x = -5;
    enemy.z = -48;
    enemy.state = "idle";
    useRpg.setState({
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      attackUntil: 0,
      hp: Math.max(1, useRpg.getState().hp),
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
    });
    const before = enemy.hp;
    const xp = useRpg.getState().xp;
    useRpg.getState().attack();
    const after = useRpg.getState().enemies.find((entry) => entry.id === "quiz-1");
    assert.ok(after.hp > 0);
    assert.equal(useRpg.getState().xp, xp);
    assert.ok(useRpg.getState().attackFx.hits.includes("quiz-1"));
    assert.ok(after.hp < before);
    return before - after.hp;
  };
  let fullFocus = null;
  for (let focus = 0; focus <= 200; focus += 1) {
    const verdict = r.itemVerdict({
      id: "tea",
      count: 1,
      hp: 40,
      maxLife: 100,
      focus,
      action: "use",
    });
    if (!verdict.allowed && verdict.mark === "full") {
      fullFocus = focus;
      break;
    }
  }
  assert.equal(typeof fullFocus, "number");

  const priorGame = {
    visited: [...useGame.getState().visited],
    timeOfDay: useGame.getState().timeOfDay,
    muted: useGame.getState().muted,
  };
  try {
    inventory.clear();
    assert.equal(inventory.add("notes", 4).overflow, 0);
    assert.equal(inventory.add("coffee", 3).overflow, 0);
    assert.equal(inventory.add("tea", 2).overflow, 0);
    assert.equal(inventory.add("badge", 1).overflow, 0);
    assert.equal(inventory.add("credit", 3).overflow, 0);
    const stored = listed(inventory.slots());
    useRpg.setState({
      hp: r.maxHp(useRpg.getState()),
      focus: fullFocus,
      xp: 0,
      equipped: false,
      panel: null,
      notice: "",
    });
    const coffeeRow = rowsFor("consumable").find((row) => row.itemId === "coffee");
    assert.ok(coffeeRow);
    const categories = {};
    for (const filter of ["consumable", "material", "equipment", "rare"]) {
      const view = shownDetail(filter, coffeeRow.index);
      categories[filter] = view.detail;
      assert.equal(ITEMS.find((entry) => entry.id === view.detail.itemId).category, filter);
      assertClueGrants(view.detail.itemId, view.detail.clue);
    }
    assert.notEqual(categories.consumable.itemId, categories.material.itemId);
    assert.notEqual(categories.consumable.purpose, categories.material.purpose);
    assert.notEqual(categories.consumable.effect, categories.material.effect);
    assert.notEqual(categories.consumable.clue, categories.material.clue);
    assert.notEqual(categories.consumable.action, categories.material.action);
    assert.notEqual(categories.equipment.itemId, categories.rare.itemId);
    assert.equal(categories.consumable.itemId, "coffee");
    assert.equal(categories.material.purpose.includes("冰咖啡"), false);
    assert.equal(categories.material.effect.includes("冰咖啡"), false);
    assert.equal(categories.material.clue.includes("冰咖啡"), false);
    assert.deepEqual(listed(inventory.slots()), stored);

    const cap = r.maxHp(useRpg.getState());
    const coffeeCount = inventory.count("coffee");
    useRpg.getState().useItem("coffee");
    assert.equal(inventory.count("coffee"), coffeeCount);
    assert.equal(useRpg.getState().hp, cap);
    const fullCoffee = detailFor("coffee");
    assert.equal(fullCoffee.quantity, inventory.count("coffee"));
    assert.equal(fullCoffee.allowed, false);
    assert.equal(fullCoffee.reason, useRpg.getState().notice);
    assert.equal(fullCoffee.reason, "狀態已滿，不需要消耗物品。");
    assert.equal(fullCoffee.action.includes(fullCoffee.reason), true);
    const fullBar = barAgrees();
    assert.equal(fullBar.view.coffee.mark, "full");
    assert.equal(fullBar.view.coffee.state, "滿狀態");
    assert.equal(fullBar.coffee.allowed, false);

    useRpg.setState({ focus: fullFocus - 1, notice: "" });
    const teaBefore = inventory.count("tea");
    const readyTea = detailFor("tea");
    assert.equal(readyTea.allowed, true);
    assert.equal(readyTea.quantity, teaBefore);
    const readyBar = barAgrees();
    assert.equal(readyBar.view.tea.mark, "ready");
    assert.equal(readyBar.tea.allowed, true);
    useRpg.getState().useItem("tea");
    const teaNotice = useRpg.getState().notice;
    const teaAmount = Number((teaNotice.match(/專注 \+(\d+)/) || [])[1]);
    assert.ok(teaAmount >= 1);
    assert.equal(inventory.count("tea"), teaBefore - 1);
    assert.equal(useRpg.getState().focus, Math.min(fullFocus, fullFocus - 1 + teaAmount));
    assert.equal(useRpg.getState().focus, fullFocus);
    const afterTea = detailFor("tea");
    assert.equal(afterTea.quantity, inventory.count("tea"));
    const afterTeaBar = barAgrees();
    assert.equal(afterTeaBar.view.tea.count, inventory.count("tea"));
    useRpg.setState({ notice: "" });
    const fullTeaCount = inventory.count("tea");
    useRpg.getState().useItem("tea");
    assert.equal(inventory.count("tea"), fullTeaCount);
    assert.equal(useRpg.getState().focus, fullFocus);
    const fullTea = detailFor("tea");
    assert.equal(fullTea.quantity, fullTeaCount);
    assert.equal(fullTea.allowed, false);
    assert.equal(fullTea.reason, useRpg.getState().notice);
    assert.equal(fullTea.reason, "狀態已滿，不需要消耗物品。");
    const fullTeaBar = barAgrees();
    assert.equal(fullTeaBar.view.tea.mark, "full");
    assert.equal(fullTeaBar.view.tea.state, "滿狀態");

    useRpg.setState({ equipped: false, xp: 0, hp: r.maxHp({ xp: 0, equipped: false }), focus: fullFocus, notice: "" });
    const bareLife = r.maxHp(useRpg.getState());
    const bareAttack = basicSwing();
    assert.ok(inventory.count("badge") > 0);
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, true);
    const wornLife = r.maxHp(useRpg.getState());
    assert.ok(wornLife > bareLife);
    useRpg.setState({ hp: wornLife, attackUntil: 0 });
    const wornAttack = basicSwing();
    assert.ok(wornAttack > bareAttack);
    const wornDetail = detailFor("badge");
    assert.equal(wornDetail.quantity, inventory.count("badge"));
    assert.equal(wornDetail.lifeUnequipped, bareLife);
    assert.equal(wornDetail.lifeEquipped, wornLife);
    assert.equal(wornDetail.lifeFrom, wornLife);
    assert.equal(wornDetail.lifeTo, bareLife);
    assert.equal(wornDetail.lifeDelta, bareLife - wornLife);
    assert.equal(wornDetail.attackUnequipped, bareAttack);
    assert.equal(wornDetail.attackEquipped, wornAttack);
    assert.equal(wornDetail.attackFrom, wornAttack);
    assert.equal(wornDetail.attackTo, bareAttack);
    assert.equal(wornDetail.attackDelta, bareAttack - wornAttack);
    assert.equal(wornDetail.effect.includes(String(bareLife)), true);
    assert.equal(wornDetail.effect.includes(String(wornLife)), true);
    assert.equal(wornDetail.effect.includes(String(bareAttack)), true);
    assert.equal(wornDetail.effect.includes(String(wornAttack)), true);
    assert.equal(wornDetail.action.includes("卸下徽章"), true);
    assertClueGrants("badge", wornDetail.clue);
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, false);
    assert.equal(useRpg.getState().hp, bareLife);
    const bareDetail = detailFor("badge");
    assert.equal(bareDetail.lifeFrom, bareLife);
    assert.equal(bareDetail.lifeTo, wornLife);
    assert.equal(bareDetail.lifeDelta, wornLife - bareLife);
    assert.equal(bareDetail.attackFrom, bareAttack);
    assert.equal(bareDetail.attackTo, wornAttack);
    assert.equal(bareDetail.attackDelta, wornAttack - bareAttack);
    assert.equal(bareDetail.action.includes("裝備徽章"), true);

    inventory.clear();
    useRpg.setState({ equipped: false, notice: "" });
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, false);
    assert.equal(useRpg.getState().notice, "沒有五虎崗徽章，無法改變裝備。");
    const missingBadge = detailFor("badge");
    assert.equal(missingBadge.quantity, 0);
    assert.equal(missingBadge.allowed, false);
    assert.equal(missingBadge.reason, useRpg.getState().notice);
    useRpg.setState({ equipped: true, notice: "" });
    useRpg.getState().equip();
    assert.equal(useRpg.getState().equipped, true);
    assert.equal(useRpg.getState().notice, "沒有五虎崗徽章，無法改變裝備。");

    inventory.clear();
    assert.equal(inventory.add("coffee", 1).overflow, 0);
    const coffeeCap = r.maxHp({ xp: 0, equipped: false });
    useRpg.setState({ equipped: false, xp: 0, hp: coffeeCap - 1, focus: fullFocus, panel: null, notice: "" });
    useRpg.getState().useItem("coffee");
    const coffeeAmount = Number((useRpg.getState().notice.match(/生命 \+(\d+)/) || [])[1]);
    assert.ok(coffeeAmount >= 1);
    assert.equal(inventory.count("coffee"), 0);
    assert.equal(useRpg.getState().hp, Math.min(coffeeCap, coffeeCap - 1 + coffeeAmount));
    assert.equal(useRpg.getState().hp, coffeeCap);
    const spentHp = useRpg.getState().hp;
    useRpg.setState({ notice: "" });
    useRpg.getState().useItem("coffee");
    assert.equal(inventory.count("coffee"), 0);
    assert.equal(useRpg.getState().hp, spentHp);
    assert.equal(useRpg.getState().notice, "背包裡沒有這個物品。");
    const emptyCoffee = detailFor("coffee");
    assert.equal(emptyCoffee.quantity, 0);
    assert.equal(emptyCoffee.allowed, false);
    assert.equal(emptyCoffee.reason, useRpg.getState().notice);
    const emptyCoffeeBar = barAgrees();
    assert.equal(emptyCoffeeBar.view.coffee.count, 0);
    assert.equal(emptyCoffeeBar.view.coffee.mark, "empty");
    assert.equal(emptyCoffeeBar.view.coffee.state, "耗盡");

    inventory.clear();
    assert.equal(inventory.add("tea", 1).overflow, 0);
    useRpg.setState({ hp: coffeeCap, focus: 1, panel: null, notice: "" });
    useRpg.getState().useItem("tea");
    const lastTeaAmount = Number((useRpg.getState().notice.match(/專注 \+(\d+)/) || [])[1]);
    assert.ok(lastTeaAmount >= 1);
    assert.equal(inventory.count("tea"), 0);
    assert.equal(useRpg.getState().focus, Math.min(fullFocus, 1 + lastTeaAmount));
    assert.ok(useRpg.getState().focus > 1);
    const spentFocus = useRpg.getState().focus;
    useRpg.setState({ notice: "" });
    useRpg.getState().useItem("tea");
    assert.equal(inventory.count("tea"), 0);
    assert.equal(useRpg.getState().focus, spentFocus);
    assert.equal(useRpg.getState().notice, "背包裡沒有這個物品。");
    const emptyTea = detailFor("tea");
    assert.equal(emptyTea.quantity, 0);
    assert.equal(emptyTea.allowed, false);
    assert.equal(emptyTea.reason, useRpg.getState().notice);
    const emptyTeaBar = barAgrees();
    assert.equal(emptyTeaBar.view.tea.count, 0);
    assert.equal(emptyTeaBar.view.tea.mark, "empty");
    assert.equal(emptyTeaBar.view.tea.state, "耗盡");

    inventory.clear();
    assert.equal(inventory.add("coffee", 3).overflow, 0);
    assert.equal(inventory.add("notes", 9).overflow, 0);
    assert.equal(inventory.add("tea", 2).overflow, 0);
    const preCoffee = inventory.count("coffee");
    const preNotes = inventory.count("notes");
    const preTea = inventory.count("tea");
    assert.equal(
      useRpg.getState().importSave(
        JSON.stringify({
          version: 1,
          departmentId: "math",
          hp: 80,
          inventory: [
            { id: "pen", count: 6 },
            { id: "first-aid", count: 2 },
          ],
          buildings: [],
        }),
      ),
      true,
    );
    assert.equal(inventory.count("notes"), 6);
    assert.equal(inventory.count("coffee"), 2);
    assert.equal(inventory.count("tea"), 0);
    assert.equal(inventory.slots().some((slot) => slot.itemId === "pen" || slot.itemId === "first-aid"), false);
    assert.notEqual(inventory.count("notes"), preNotes);
    assert.notEqual(inventory.count("coffee"), preCoffee);
    assert.notEqual(inventory.count("tea"), preTea);
    const importedNotes = detailFor("notes");
    const importedCoffee = detailFor("coffee");
    assert.equal(importedNotes.quantity, inventory.count("notes"));
    assert.equal(importedCoffee.quantity, inventory.count("coffee"));
    assert.notEqual(importedNotes.quantity, preNotes);
    assert.notEqual(importedCoffee.quantity, preCoffee);
    assert.equal(importedNotes.quantity, 6);
    assert.equal(importedCoffee.quantity, 2);
    const importedBar = barAgrees();
    assert.equal(importedBar.view.coffee.count, inventory.count("coffee"));
    assert.equal(importedBar.view.tea.count, inventory.count("tea"));
    assert.notEqual(importedBar.view.coffee.count, preCoffee);
    assert.equal(importedBar.view.coffee.count, 2);
  } finally {
    inventory.clear();
    for (const [id, n] of [
      ["notes", 60],
      ["parts", 60],
      ["credit", 10],
      ["coffee", 3],
      ["tea", 3],
    ])
      inventory.add(id, n);
    useRpg.setState({
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      loot: [],
      equipped: false,
      hp: 100,
      focus: 100,
      xp: 0,
      kills: 0,
      freshStart: false,
      notice: "",
      attackUntil: 0,
      skillUntil: 0,
      dodgeUntil: 0,
      departmentId: DEPARTMENTS[0].id,
      enemies: ENCOUNTERS.map((enemy) => ({
        ...enemy,
        anchorX: enemy.x,
        anchorZ: enemy.z,
        hp: ENEMY_TYPES[enemy.kind].hp,
        state: "idle",
        timer: 0,
        hurt: 0,
      })),
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
      warp: null,
      visited: priorGame.visited,
      timeOfDay: priorGame.timeOfDay,
      muted: priorGame.muted,
    });
    flushSave();
  }
});

test("grounddrops name the intake and match the save", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const world = readFileSync(join(root, "../src/game/rpg/AdventureWorld.tsx"), "utf8");
  assert.match(world, /lootClusters\(/);
  assert.match(world, /pickupOutline\(/);
  assert.match(world, /clearSight\(/);
  assert.match(world, /EdgesGeometry/);
  assert.doesNotMatch(world, /loot\.map\(/);
  assert.equal(r.OUTLINE_REACH < r.GROUND_DRAW, true);
  assert.equal(r.GROUND_DRAW < 85, true);
  assert.deepEqual(r.pickupOutline(80, false, true), { mesh: false, outline: false });
  assert.deepEqual(r.pickupOutline(20, false, true), { mesh: true, outline: false });
  assert.deepEqual(r.pickupOutline(6, false, true), { mesh: true, outline: true });
  assert.deepEqual(r.pickupOutline(6, false, false), { mesh: true, outline: false });
  assert.deepEqual(r.pickupOutline(10, true, true), { mesh: true, outline: true });
  assert.deepEqual(r.pickupOutline(20, true, true), { mesh: false, outline: false });

  const priorGame = {
    visited: useGame.getState().visited,
    timeOfDay: useGame.getState().timeOfDay,
    muted: useGame.getState().muted,
  };
  const field = { x: 200, z: -20 };
  const cooledAll = Object.fromEntries(
    SUPPLY_NODES.map((node) => [node.id, Date.now() + 1e9]),
  );
  const counts = () =>
    Object.fromEntries(ITEMS.map((item) => [item.id, inventory.count(item.id)]));
  const packLoot = (list) =>
    list
      .map((pile) => ({ id: pile.id, x: pile.x, z: pile.z, items: { ...pile.items } }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const stand = (x, z) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: x,
      playerZ: z,
      playerYaw: 0,
      visited: [],
    });
    useRpg.setState({ hp: 100, panel: null, interiorId: null, buildKind: null, freshStart: false });
  };
  const slotsOf = () =>
    inventory.slots().map((slot) => ({ itemId: slot.itemId, quantity: slot.quantity }));
  const viewAt = (id) => {
    const g = useGame.getState();
    const seed = r.promptLabels(r.promptSnap(), {
      x: g.playerX,
      y: 0,
      z: g.playerZ,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    });
    const anchor = seed.find((label) => label.id === id)?.anchor;
    assert.ok(anchor, id);
    return {
      x: anchor.x,
      y: anchor.y,
      z: anchor.z - 8,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    };
  };
  const savedFile = () => {
    flushSave();
    const text = savedData.get(RPG_SAVE_KEY);
    const saved = JSON.parse(text);
    assert.equal(saved.version, 2);
    const bag = Object.fromEntries(ITEMS.map((item) => [item.id, 0]));
    for (const slot of saved.slots) bag[slot.itemId] += slot.quantity;
    assert.deepEqual(bag, counts());
    assert.deepEqual(packLoot(saved.loot), packLoot(useRpg.getState().loot));
    return text;
  };
  const fillFull = () => {
    inventory.clear();
    let sawOverflow = false;
    for (let i = 0; i < 40 && !sawOverflow; i += 1) {
      if (inventory.add("parts", 400).overflow > 0) sawOverflow = true;
    }
    assert.equal(sawOverflow, true);
    const probe = inventory.add("parts", 1);
    assert.equal(probe.added, 0);
    assert.ok(probe.overflow > 0);
  };
  try {
    useRpg.setState({
      loot: [],
      harvested: cooledAll,
      buildings: [],
      interiorId: null,
      panel: null,
      hp: 100,
      buildKind: null,
      freshStart: false,
    });
    stand(field.x, field.z);
    assert.equal(r.promptDecision(r.promptSnap()), null);

    fillFull();
    const fullGrant = { parts: 3, notes: 2 };
    useRpg.setState({
      loot: [{ id: "full-pile", x: field.x, z: field.z, items: fullGrant }],
      harvested: cooledAll,
      buildings: [],
    });
    stand(field.x, field.z);
    const fullPreview = r.intakePreview(slotsOf(), r.BAG_CAPACITY, fullGrant);
    assert.deepEqual(fullPreview.accepted, {});
    assert.equal(fullPreview.left.parts, 3);
    assert.equal(fullPreview.left.notes, 2);
    const fullChoice = r.promptDecision(r.promptSnap());
    assert.equal(fullChoice.kind, "pickup");
    assert.equal(fullChoice.targetId, "full-pile");
    assert.equal(fullChoice.marker, fullChoice.text);
    assert.equal(
      fullChoice.text,
      "課堂筆記 ×2、構築零件 ×3。留在地面：課堂筆記 ×2、構築零件 ×3",
    );
    const fullBefore = counts();
    assert.equal(useRpg.getState().commitPrompt(), "pickup");
    assert.deepEqual(counts(), fullBefore);
    assert.deepEqual(useRpg.getState().loot[0].items, fullGrant);
    assert.equal(useRpg.getState().notice.includes("已入袋"), false);
    assert.equal(useRpg.getState().notice.includes("留在地面"), true);
    savedFile();

    assert.equal(inventory.remove("parts", 1), true);
    const partialPreview = r.intakePreview(slotsOf(), r.BAG_CAPACITY, fullGrant);
    assert.equal(partialPreview.accepted.parts, 1);
    assert.equal(partialPreview.left.parts, 2);
    assert.equal(partialPreview.left.notes, 2);
    const partialChoice = r.promptDecision(r.promptSnap());
    assert.equal(
      partialChoice.text,
      "課堂筆記 ×2、構築零件 ×3。已入袋：構築零件 ×1。留在地面：課堂筆記 ×2、構築零件 ×2",
    );
    assert.equal(partialChoice.marker, partialChoice.text);
    const partialParts = inventory.count("parts");
    assert.equal(useRpg.getState().commitPrompt(), "pickup");
    assert.equal(inventory.count("parts"), partialParts + 1);
    assert.equal(inventory.count("notes"), fullBefore.notes);
    assert.deepEqual(useRpg.getState().loot[0].items, { parts: 2, notes: 2 });
    assert.equal(useRpg.getState().notice.includes("已入袋"), true);
    assert.equal(useRpg.getState().notice.includes("留在地面"), true);
    assert.ok(useRpg.getState().notice.indexOf("留在地面") > useRpg.getState().notice.indexOf("已入袋"));
    savedFile();

    inventory.clear();
    assert.equal(inventory.add("parts", 10).overflow, 0);
    assert.equal(inventory.add("notes", 4).overflow, 0);
    assert.equal(inventory.add("tea", 2).overflow, 0);
    const heap = [];
    for (let i = 0; i < 8; i += 1) {
      heap.push({
        id: "heap-" + i,
        x: field.x + (i % 3) * 0.35,
        z: field.z + Math.floor(i / 3) * 0.35,
        items: i === 0 ? { parts: 1, notes: 2 } : { parts: 1 },
      });
    }
    const distant = Array.from({ length: 12 }, (_, i) => ({
      id: "far-" + i,
      x: field.x + i * 3,
      z: field.z + 80,
      items: { parts: 1 },
    }));
    useRpg.setState({ loot: [...heap, ...distant], harvested: cooledAll, buildings: [] });
    const clusters = r.lootClusters(useRpg.getState().loot);
    assert.equal(clusters.length, 13);
    assert.equal(clusters.find((cluster) => cluster.members.length === 8).members.length, 8);
    assert.equal(r.lootClusters(distant).length, 12);
    stand(field.x, field.z);
    const heapChoice = r.promptDecision(r.promptSnap());
    assert.equal(heapChoice.targetId, "heap-0");
    assert.equal(heapChoice.text.includes("課堂筆記 ×2"), true);
    assert.equal(heapChoice.text.includes("構築零件 ×1"), true);
    assert.equal(heapChoice.text.includes("已入袋"), true);
    assert.equal(heapChoice.text.includes("留在地面"), false);
    const heapLabels = r.promptLabels(r.promptSnap(), viewAt("heap-0"));
    const shownPickups = heapLabels.filter((label) => label.kind === "pickup" && label.shown);
    assert.deepEqual(shownPickups.map((label) => label.id), ["heap-0"]);
    assert.equal(heapLabels.find((label) => label.id === "heap-1").shown, false);
    assert.equal(heapLabels.find((label) => label.id === "heap-1").text, "拾取");
    assert.equal(heapLabels.filter((label) => label.id.startsWith("far-") && label.shown).length, 0);
    const notesBefore = inventory.count("notes");
    const partsBefore = inventory.count("parts");
    assert.equal(useRpg.getState().commitPrompt(), "pickup");
    assert.equal(inventory.count("notes"), notesBefore + 2);
    assert.equal(inventory.count("parts"), partsBefore + 1);
    assert.equal(useRpg.getState().loot.some((pile) => pile.id === "heap-0"), false);
    assert.equal(useRpg.getState().loot.length, 19);
    assert.equal(useRpg.getState().loot.find((pile) => pile.id === "heap-1").items.parts, 1);
    assert.equal(useRpg.getState().loot.find((pile) => pile.id === "far-3").items.parts, 1);
    savedFile();

    const wall = [{ id: "wall", kind: "barrier", x: field.x + 1.8, z: field.z, rotation: 0, hp: 100 }];
    const hidden = { id: "hidden", x: field.x + 3.6, z: field.z, items: { coffee: 1 } };
    const open = { id: "open", x: field.x - 3.6, z: field.z, items: { tea: 1 } };
    useRpg.setState({ loot: [hidden, open], buildings: wall, harvested: cooledAll });
    stand(field.x, field.z);
    assert.equal(r.clearSight(field.x, field.z, hidden.x, hidden.z, wall), false);
    assert.equal(r.clearSight(field.x, field.z, open.x, open.z, wall), true);
    const walled = r.promptDecision(r.promptSnap());
    assert.equal(walled.kind, "pickup");
    assert.equal(walled.targetId, "open");
    assert.equal(walled.text.includes("烏龍茶 ×1"), true);
    assert.equal(walled.text.includes("冰咖啡"), false);
    const wallLabels = r.promptLabels(r.promptSnap(), viewAt("open"));
    const hiddenLabel = wallLabels.find((label) => label.id === "hidden");
    const openLabel = wallLabels.find((label) => label.id === "open");
    assert.equal(hiddenLabel.text, "拾取");
    assert.equal(hiddenLabel.shown, false);
    assert.equal(hiddenLabel.action, false);
    assert.equal(openLabel.shown, true);
    assert.equal(openLabel.action, true);
    assert.equal(openLabel.text, walled.marker);
    useRpg.setState({ loot: [hidden] });
    assert.equal(r.promptDecision(r.promptSnap()), null);
    assert.equal(useRpg.getState().commitPrompt(), null);
    assert.equal(useRpg.getState().loot.length, 1);
    assert.equal(useRpg.getState().loot[0].items.coffee, 1);

    const kept = { id: "kept", x: field.x + 0.2, z: field.z + 0.2, items: { parts: 2, notes: 1 } };
    const indoor = CAMPUS_SITES.find((site) => site.form !== "court");
    let supply = null;
    for (const node of SUPPLY_NODES) {
      const harvested = { ...cooledAll, [node.id]: 0 };
      useRpg.setState({ harvested, loot: [], buildings: [], interiorId: null });
      stand(node.x, node.z);
      const choice = r.promptDecision(r.promptSnap());
      useRpg.setState({ harvested: cooledAll });
      if (choice?.kind === "supply" && choice.targetId === node.id && !r.promptDecision(r.promptSnap())) {
        supply = node;
        break;
      }
    }
    assert.ok(supply);
    const heldUntil = Date.now() + 180_000;
    useRpg.setState({
      loot: [kept],
      buildings: [],
      harvested: { ...cooledAll, [supply.id]: heldUntil },
      interiorId: null,
    });
    stand(field.x, field.z);
    assert.equal(r.promptDecision(r.promptSnap()).targetId, "kept");
    const lootText = JSON.stringify(packLoot(useRpg.getState().loot));
    useRpg.getState().enter(indoor.id);
    assert.ok(useRpg.getState().interiorId);
    assert.equal(JSON.stringify(packLoot(useRpg.getState().loot)), lootText);
    assert.equal(useRpg.getState().harvested[supply.id], heldUntil);
    const inside = r.promptDecision(r.promptSnap());
    assert.notEqual(inside?.kind, "pickup");
    assert.notEqual(inside?.kind, "supply");
    const insideLabels = r.promptLabels(r.promptSnap(), {
      x: 0,
      y: 2,
      z: -4,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    });
    assert.equal(insideLabels.some((label) => label.kind === "pickup" && label.shown), false);
    assert.equal(insideLabels.some((label) => label.id === "kept"), false);
    useRpg.getState().exit();
    assert.equal(useRpg.getState().interiorId, null);
    assert.equal(JSON.stringify(packLoot(useRpg.getState().loot)), lootText);
    assert.equal(useRpg.getState().harvested[supply.id], heldUntil);
    stand(field.x + 40, field.z);
    const away = r.promptLabels(r.promptSnap(), viewAt("kept"));
    assert.equal(away.find((label) => label.id === "kept")?.shown ?? false, false);
    assert.notEqual(r.promptDecision(r.promptSnap())?.targetId, "kept");
    stand(field.x, field.z);
    const returned = r.promptDecision(r.promptSnap());
    assert.equal(returned.targetId, "kept");
    assert.equal(returned.text.includes("構築零件 ×2"), true);
    assert.equal(returned.text.includes("課堂筆記 ×1"), true);
    assert.deepEqual(useRpg.getState().loot[0].items, kept.items);

    inventory.clear();
    assert.equal(inventory.add("notes", 4).overflow, 0);
    assert.equal(inventory.add("parts", 4).overflow, 0);
    assert.equal(inventory.add("coffee", 1).overflow, 0);
    useRpg.setState({ loot: [], harvested: { ...cooledAll, [supply.id]: 0 }, buildings: [], interiorId: null });
    stand(supply.x, supply.z);
    const ready = r.promptDecision(r.promptSnap());
    assert.equal(ready.kind, "supply");
    assert.equal(ready.targetId, supply.id);
    const readyPreview = r.intakePreview(slotsOf(), r.BAG_CAPACITY, supply.items);
    for (const [id, amount] of Object.entries(supply.items)) {
      const name = ITEMS.find((item) => item.id === id).name;
      assert.equal(ready.text.includes(`${name} ×${amount}`), true);
    }
    assert.equal(ready.text.includes("已入袋"), true);
    assert.equal(ready.text.includes("留在地面"), false);
    const beforeHarvest = counts();
    assert.equal(useRpg.getState().interact(), true);
    for (const item of ITEMS) {
      assert.equal(
        inventory.count(item.id) - beforeHarvest[item.id],
        readyPreview.accepted[item.id] ?? 0,
        item.id,
      );
    }
    assert.equal(useRpg.getState().loot.length, 0);
    const until = useRpg.getState().harvested[supply.id];
    assert.ok(until - Date.now() <= 180_000);
    assert.ok(until - Date.now() > 170_000);
    assert.equal(r.promptDecision(r.promptSnap()), null);
    const coolLabels = r.promptLabels(r.promptSnap(), viewAt(supply.id));
    const cool = coolLabels.find((label) => label.kind === "cool" && label.id === supply.id);
    assert.ok(cool);
    assert.equal(cool.shown, true);
    assert.equal(cool.action, false);
    assert.equal(cool.text.includes("已冷卻"), true);
    for (const [id, amount] of Object.entries(supply.items)) {
      const name = ITEMS.find((item) => item.id === id).name;
      assert.equal(cool.text.includes(`${name} ×${amount}`), true);
    }
    const cooledParts = inventory.count("parts");
    assert.equal(useRpg.getState().interact(), false);
    assert.equal(inventory.count("parts"), cooledParts);
    assert.equal(useRpg.getState().harvested[supply.id], until);
    stand(supply.x + 40, supply.z);
    const farCool = r.promptLabels(r.promptSnap(), {
      x: supply.x,
      y: 2,
      z: supply.z - 8,
      fx: 0,
      fy: 0,
      fz: 1,
      fov: 50,
      width: 1280,
      height: 720,
    });
    assert.equal(farCool.some((label) => label.kind === "cool" && label.shown), false);
    assert.equal(useRpg.getState().harvested[supply.id], until);
    stand(supply.x, supply.z);
    const cooledAgain = r.promptLabels(r.promptSnap(), viewAt(supply.id));
    assert.equal(
      cooledAgain.some((label) => label.kind === "cool" && label.id === supply.id && label.shown),
      true,
    );
    assert.equal(r.promptDecision(r.promptSnap()), null);
    useRpg.setState({ harvested: { ...cooledAll, [supply.id]: Date.now() - 1 } });
    const renewed = r.promptDecision(r.promptSnap());
    assert.equal(renewed.kind, "supply");
    assert.equal(renewed.targetId, supply.id);
    assert.equal(
      r.promptLabels(r.promptSnap(), viewAt(supply.id)).some((label) => label.kind === "cool" && label.shown),
      false,
    );
    const againPreview = r.intakePreview(slotsOf(), r.BAG_CAPACITY, supply.items);
    const beforeAgain = counts();
    assert.equal(useRpg.getState().interact(), true);
    for (const item of ITEMS) {
      assert.equal(
        inventory.count(item.id) - beforeAgain[item.id],
        againPreview.accepted[item.id] ?? 0,
        item.id,
      );
    }
    assert.equal(useRpg.getState().interact(), false);
    const text = savedFile();
    assert.equal(JSON.parse(text).harvested[supply.id], useRpg.getState().harvested[supply.id]);
    const savedBag = counts();
    const savedLoot = packLoot(useRpg.getState().loot);
    const savedUntil = useRpg.getState().harvested[supply.id];
    inventory.add("parts", 5);
    useRpg.setState({ loot: [{ id: "scratch", x: 1, z: 1, items: { tea: 1 } }], harvested: {} });
    assert.equal(useRpg.getState().importSave(text), true);
    assert.deepEqual(counts(), savedBag);
    assert.deepEqual(packLoot(useRpg.getState().loot), savedLoot);
    assert.equal(useRpg.getState().harvested[supply.id], savedUntil);
  } finally {
    inventory.clear();
    for (const [id, n] of [
      ["notes", 60],
      ["parts", 60],
      ["credit", 10],
      ["coffee", 3],
      ["tea", 3],
    ])
      inventory.add(id, n);
    useRpg.setState({
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      loot: [],
      harvested: {},
      equipped: false,
      hp: 100,
      focus: 100,
      xp: 0,
      kills: 0,
      discoveries: [],
      freshStart: false,
      notice: "",
      attackUntil: 0,
      skillUntil: 0,
      dodgeUntil: 0,
      departmentId: DEPARTMENTS[0].id,
      enemies: ENCOUNTERS.map((enemy) => ({
        ...enemy,
        anchorX: enemy.x,
        anchorZ: enemy.z,
        hp: ENEMY_TYPES[enemy.kind].hp,
        state: "idle",
        timer: 0,
        hurt: 0,
      })),
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
      warp: null,
      visited: priorGame.visited,
      timeOfDay: priorGame.timeOfDay,
      muted: priorGame.muted,
    });
    flushSave();
  }
});

test("buildcards match place cost across five states", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const css = read("../src/game/rpg/adventure.css");
  const rules = read("../src/game/rpg/rules.ts");
  const store = read("../src/game/rpg/store.ts");
  const cards = read("../src/game/rpg/buildcard.ts");
  const panelStart = hud.indexOf("function BuildPanel(");
  const panel = hud.slice(panelStart, hud.indexOf("\nfunction ", panelStart + 1));
  assert.match(panel, /buildCards\(/);
  assert.match(panel, /<dt>用途<\/dt>\s*<dd>\{card\.purpose\}<\/dd>/);
  assert.match(panel, /<dt>大小<\/dt>\s*<dd>\{card\.size\}<\/dd>/);
  assert.match(panel, /<dt>耐久<\/dt>\s*<dd>\{card\.durability\}<\/dd>/);
  assert.match(panel, /<dt>材料<\/dt>/);
  assert.match(panel, /\{material\.name\} \{material\.held\}\/\{material\.cost\}/);
  assert.match(panel, /<dt>目前缺額<\/dt>\s*<dd>\{card\.shortageText\}<\/dd>/);
  assert.match(panel, /\{card\.status\}/);
  assert.match(panel, /aria-label="建造資源"/);
  assert.match(panel, /\{item\.name\} \{item\.held\}/);
  assert.match(panel, /card\.canPlace \? "ready" : "disabled"/);
  assert.match(panel, /disabled=\{!card\.canPlace\}/);
  assert.match(panel, /chooseBuild\(card\.id\)/);
  assert.match(panel, /\{view\.count\} \/ \{view\.cap\}/);
  assert.doesNotMatch(panel, /buildings\.length >= 48/);
  assert.doesNotMatch(panel, /inventory\.add\(/);
  assert.doesNotMatch(cards, /inventory\.add\(/);
  assert.match(cards, /footprint\(/);
  assert.match(cards, /canPay\(/);
  assert.match(rules, /buildings\.length >= FACILITY_CAP\) return FACILITY_CAP_NOTICE/);
  assert.match(store, /notify\(BUILD_NEED_OUTDOORS\)/);
  assert.match(store, /notify\(BUILD_NEED_MATERIALS\)/);
  for (const block of css.matchAll(/\.ad-recipe-facts[^{]*\{[^}]*\}/g)) {
    assert.doesNotMatch(block[0], /text-overflow:\s*ellipsis/);
    assert.doesNotMatch(block[0], /display:\s*none/);
  }
  for (const block of css.matchAll(/\.ad-(?:recipe-materials|recipe-hint|build-stock)[^{]*\{[^}]*\}/g)) {
    assert.doesNotMatch(block[0], /text-overflow:\s*ellipsis/);
    assert.doesNotMatch(block[0], /display:\s*none/);
  }

  assert.deepEqual(
    RECIPES.map((recipe) => recipe.name),
    ["自習工作臺", "守夜宮燈", "社團路障", "知識投射器", "研究桌", "補給站", "線索展示板", "崗上休息點", "異象樁"],
  );
  assert.equal(r.FACILITY_CAP, 48);
  const priorGame = {
    visited: useGame.getState().visited,
    timeOfDay: useGame.getState().timeOfDay,
    muted: useGame.getState().muted,
  };
  const counts = () =>
    Object.fromEntries(ITEMS.map((item) => [item.id, inventory.count(item.id)]));
  const shot = () => useRpg.getState().buildings.map((building) => ({ ...building }));
  const readCards = () => {
    assert.equal(useRpg.getState().buildKind, null);
    const view = r.buildCards({
      interiorId: useRpg.getState().interiorId,
      departmentId: useRpg.getState().departmentId,
      buildingCount: useRpg.getState().buildings.length,
      count: (id) => inventory.count(id),
    });
    assert.equal(view.cap, r.FACILITY_CAP);
    assert.equal(view.count, useRpg.getState().buildings.length);
    assert.deepEqual(
      view.cards.map((card) => card.id),
      RECIPES.map((recipe) => recipe.id),
    );
    const costIds = [...new Set(RECIPES.flatMap((recipe) => Object.keys(recipe.cost)))];
    assert.deepEqual(
      view.resources.map((item) => item.id),
      ITEMS.filter((item) => costIds.includes(item.id)).map((item) => item.id),
    );
    for (const item of view.resources) {
      assert.equal(item.name, ITEMS.find((entry) => entry.id === item.id).name);
      assert.equal(item.held, inventory.count(item.id));
    }
    for (const card of view.cards) {
      const recipe = RECIPES.find((entry) => entry.id === card.id);
      const box = footprint(recipe.id, 0);
      assert.equal(card.name, recipe.name);
      assert.equal(card.purpose, recipe.description);
      assert.equal(card.durability, recipe.health);
      assert.equal(card.width, box.width);
      assert.equal(card.depth, box.depth);
      assert.equal(card.size, `${box.width} × ${box.depth}`);
      assert.deepEqual(
        card.materials.map((material) => material.id),
        ITEMS.map((item) => item.id).filter((id) => recipe.cost[id] != null),
      );
      for (const material of card.materials) {
        assert.equal(material.name, ITEMS.find((item) => item.id === material.id).name);
        assert.equal(material.cost, recipe.cost[material.id]);
        assert.equal(material.held, inventory.count(material.id));
        assert.equal(material.short, Math.max(0, material.cost - material.held));
      }
      assert.deepEqual(
        card.shortage.map((material) => material.id),
        card.materials.filter((material) => material.short > 0).map((material) => material.id),
      );
      if (card.shortage.length === 0) assert.equal(card.shortageText, "沒有缺額");
      else
        for (const material of card.shortage)
          assert.equal(card.shortageText.includes(`${material.name} ${material.short}`), true);
      assert.equal(card.canPlace, card.hint == null);
      assert.equal(card.status, card.canPlace ? "可以放置" : card.hint);
    }
    return view;
  };
  const prepare = () => {
    useRpg.setState({
      buildings: [],
      interiorId: null,
      buildKind: null,
      rotation: 0,
      panel: null,
      departmentId: DEPARTMENTS[0].id,
      hp: 100,
      notice: "",
    });
    useGame.setState({ phase: "playing", plaqueId: null });
  };
  const seed = (card, mode) => {
    assert.ok(card.materials.length > 0, card.id);
    inventory.clear();
    for (const material of card.materials) {
      assert.ok(material.cost >= 1, material.id);
      const held =
        mode === "above"
          ? material.cost + 1
          : mode === "exact"
            ? material.cost
            : material.id === card.materials[0].id
              ? material.cost - 1
              : material.cost;
      if (held > 0) assert.equal(inventory.add(material.id, held).overflow, 0, material.id);
    }
  };
  const seedAll = (view) => {
    inventory.clear();
    const need = {};
    for (const card of view.cards)
      for (const material of card.materials)
        need[material.id] = Math.max(need[material.id] ?? 0, material.cost + 1);
    for (const [id, n] of Object.entries(need))
      assert.equal(inventory.add(id, n).overflow, 0, id);
  };
  const spots = new Map();
  const spotFor = (kind) => {
    if (spots.has(kind)) return spots.get(kind);
    for (let x = 20; x <= 160; x += 5)
      for (let z = -15; z >= -120; z -= 5) {
        const player = { x: x + 30, z };
        if (validatePlacement(kind, x, z, 0, [], player) == null) {
          const spot = { x, z };
          spots.set(kind, spot);
          return spot;
        }
      }
    assert.fail("legal spot " + kind);
  };
  const stand = (spot) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: spot.x + 30,
      playerZ: spot.z,
      playerYaw: 0,
    });
  };
  const spentOk = (before, card) => {
    for (const item of ITEMS) {
      const spent = card.materials.find((material) => material.id === item.id)?.cost ?? 0;
      assert.equal(inventory.count(item.id), before[item.id] - spent, card.id + " " + item.id);
    }
  };
  try {
    for (const recipe of RECIPES) {
      prepare();
      const preview = readCards().cards.find((card) => card.id === recipe.id);

      seed(preview, "above");
      const aboveView = readCards();
      const above = aboveView.cards.find((card) => card.id === recipe.id);
      for (const material of above.materials) assert.equal(material.held, material.cost + 1);
      assert.equal(above.shortage.length, 0);
      assert.equal(above.canPlace, true);
      assert.equal(above.status, "可以放置");
      assert.equal(aboveView.needsOutdoors, false);
      assert.equal(aboveView.atCap, false);
      const aboveSpot = spotFor(above.id);
      stand(aboveSpot);
      const aboveBefore = counts();
      useRpg.getState().chooseBuild(above.id);
      assert.equal(useRpg.getState().buildKind, above.id);
      assert.equal(useRpg.getState().place(aboveSpot.x, aboveSpot.z), true);
      assert.equal(useRpg.getState().buildings.length, 1);
      assert.equal(useRpg.getState().buildings[0].kind, above.id);
      assert.equal(useRpg.getState().buildings[0].hp, above.durability);
      assert.equal(useRpg.getState().buildings[0].rotation, 0);
      spentOk(aboveBefore, above);
      useRpg.getState().cancelBuild();

      prepare();
      seed(preview, "exact");
      const exactView = readCards();
      const exact = exactView.cards.find((card) => card.id === recipe.id);
      for (const material of exact.materials) assert.equal(material.held, material.cost);
      assert.equal(exact.shortage.length, 0);
      assert.equal(exact.canPlace, true);
      assert.equal(exact.status, "可以放置");
      const exactSpot = spotFor(exact.id);
      stand(exactSpot);
      const exactBefore = counts();
      useRpg.getState().chooseBuild(exact.id);
      assert.equal(useRpg.getState().place(exactSpot.x, exactSpot.z), true);
      assert.equal(useRpg.getState().buildings[0].kind, exact.id);
      assert.equal(useRpg.getState().buildings[0].hp, exact.durability);
      spentOk(exactBefore, exact);
      for (const material of exact.materials) assert.equal(inventory.count(material.id), 0);
      useRpg.getState().cancelBuild();

      prepare();
      seed(preview, "short");
      const shortView = readCards();
      const short = shortView.cards.find((card) => card.id === recipe.id);
      assert.ok(short.materials.some((material) => material.held < material.cost));
      assert.ok(short.shortage.length >= 1);
      assert.equal(short.canPlace, false);
      const shortSpot = spotFor(short.id);
      stand(shortSpot);
      assert.equal(
        validatePlacement(short.id, shortSpot.x, shortSpot.z, 0, [], {
          x: shortSpot.x + 30,
          z: shortSpot.z,
        }),
        null,
      );
      const shortBefore = counts();
      const shortBuildings = shot();
      useRpg.setState({ notice: "" });
      useRpg.getState().chooseBuild(short.id);
      assert.equal(useRpg.getState().place(shortSpot.x, shortSpot.z), false);
      assert.equal(useRpg.getState().notice, short.hint);
      assert.equal(useRpg.getState().notice, short.status);
      assert.deepEqual(counts(), shortBefore);
      assert.deepEqual(shot(), shortBuildings);
      useRpg.getState().cancelBuild();
    }

    prepare();
    const indoorPreview = readCards();
    seedAll(indoorPreview);
    const site = CAMPUS_SITES.find((entry) => entry.form !== "court");
    assert.ok(site, "indoor site");
    useRpg.getState().enter(site.id);
    assert.equal(useRpg.getState().interiorId, site.id);
    assert.equal(useRpg.getState().departmentId, DEPARTMENTS[0].id);
    assert.ok(useRpg.getState().buildings.length < r.FACILITY_CAP);
    useRpg.setState({ buildKind: null, notice: "" });
    const indoorView = readCards();
    assert.equal(indoorView.needsOutdoors, true);
    const indoor = indoorView.cards[0];
    for (const card of indoorView.cards) {
      assert.equal(card.shortage.length, 0);
      assert.equal(card.canPlace, false);
      assert.equal(card.hint, indoor.hint);
      assert.equal(card.status, indoor.hint);
    }
    const indoorBefore = counts();
    const indoorBuildings = shot();
    useRpg.getState().chooseBuild(indoor.id);
    assert.equal(useRpg.getState().buildKind, null);
    assert.equal(useRpg.getState().notice, indoor.hint);
    assert.equal(useRpg.getState().place(20, -40), false);
    assert.equal(useRpg.getState().notice, indoor.status);
    assert.deepEqual(counts(), indoorBefore);
    assert.deepEqual(shot(), indoorBuildings);

    prepare();
    const capPreview = readCards();
    seedAll(capPreview);
    const filler = RECIPES[0];
    useRpg.setState({
      interiorId: null,
      buildKind: null,
      buildings: Array.from({ length: r.FACILITY_CAP }, (_, index) => ({
        id: `cap-${index}`,
        kind: filler.id,
        x: 0,
        z: 0,
        rotation: 0,
        hp: filler.health,
      })),
    });
    const capView = readCards();
    assert.equal(capView.atCap, true);
    assert.equal(capView.needsOutdoors, false);
    assert.equal(capView.count, r.FACILITY_CAP);
    const capped = capView.cards[0];
    for (const card of capView.cards) {
      assert.equal(card.shortage.length, 0);
      assert.equal(card.canPlace, false);
      assert.equal(card.hint, capped.hint);
      assert.equal(card.status, capped.hint);
    }
    const capBefore = counts();
    const capBuildings = shot();
    useRpg.setState({ notice: "", buildKind: null });
    useRpg.getState().chooseBuild(capped.id);
    assert.equal(useRpg.getState().buildKind, capped.id);
    assert.equal(useRpg.getState().place(20, -40), false);
    assert.equal(useRpg.getState().notice, capped.hint);
    assert.equal(useRpg.getState().notice, capped.status);
    assert.equal(useRpg.getState().buildings.length, r.FACILITY_CAP);
    assert.deepEqual(counts(), capBefore);
    assert.deepEqual(shot(), capBuildings);
  } finally {
    inventory.clear();
    for (const [id, n] of [
      ["notes", 60],
      ["parts", 60],
      ["credit", 10],
      ["coffee", 3],
      ["tea", 3],
    ])
      inventory.add(id, n);
    useRpg.setState({
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      loot: [],
      harvested: {},
      equipped: false,
      hp: 100,
      focus: 100,
      xp: 0,
      built: 0,
      kills: 0,
      discoveries: [],
      freshStart: false,
      notice: "",
      attackUntil: 0,
      skillUntil: 0,
      dodgeUntil: 0,
      rotation: 0,
      departmentId: DEPARTMENTS[0].id,
      enemies: ENCOUNTERS.map((enemy) => ({
        ...enemy,
        anchorX: enemy.x,
        anchorZ: enemy.z,
        hp: ENEMY_TYPES[enemy.kind].hp,
        state: "idle",
        timer: 0,
        hurt: 0,
      })),
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
      warp: null,
      visited: priorGame.visited,
      timeOfDay: priorGame.timeOfDay,
      muted: priorGame.muted,
    });
    flushSave();
  }
});

test("placeverdict agrees across flat slope door overlap turn materials and cancel", () => {
  const root = dirname(fileURLToPath(import.meta.url));
  const read = (path) => readFileSync(join(root, path), "utf8");
  const hud = read("../src/game/rpg/AdventureHud.tsx");
  const world = read("../src/game/rpg/AdventureWorld.tsx");
  const player = read("../src/game/rpg/AdventurePlayer.tsx");
  const prompts = read("../src/game/rpg/prompts.ts");
  const storeSrc = read("../src/game/rpg/store.ts");
  const css = read("../src/game/rpg/adventure.css");
  const touchFile = read("../src/game/rpg/touch-layout.ts");
  const fnBody = (source, name) => {
    const start = source.indexOf("function " + name + "(");
    assert.ok(start >= 0, name);
    const next = source.indexOf("\nfunction ", start + 1);
    return source.slice(start, next === -1 ? source.length : next);
  };
  const nearby = fnBody(hud, "Nearby");
  const touch = fnBody(hud, "TouchControls");
  const ghost = fnBody(world, "BuildGhost");
  assert.match(nearby, /commitPrompt\(\)[\s\S]{0,80}放置/);
  assert.match(nearby, /rotate\(\)[\s\S]{0,80}旋轉/);
  assert.match(nearby, /cancelBuild\(\)[\s\S]{0,80}結束建造/);
  assert.match(nearby, /input\.tap\("interact"\)/);
  assert.match(nearby, /\{choice\.text\}/);
  assert.match(hud, /<Nearby coarse=\{coarse\} \/>/);
  assert.match(touch, /bind\("interact"\)/);
  assert.match(touch, /layout\.stick/);
  assert.match(touch, /layout\.look/);
  assert.match(touch, /layout\.sprint/);
  assert.match(touch, /layout\.dodge/);
  assert.match(touch, /layout\.interact/);
  assert.match(player, /commitPrompt\(\)/);
  assert.match(css, /\.ad-interact \{[^}]*flex-wrap:\s*wrap/);
  assert.match(ghost, /useFrame\(/);
  assert.match(ghost, /useRpg\.getState\(\)/);
  assert.match(ghost, /useGame\.getState\(\)/);
  assert.match(ghost, /placeVerdict\(/);
  assert.match(ghost, /verdict\.color/);
  assert.match(ghost, /verdict\.words/);
  assert.match(ghost, /verdict\.facing/);
  assert.match(ghost, /verdict\.width/);
  assert.match(ghost, /verdict\.depth/);
  assert.match(ghost, /shown\.words/);
  assert.match(ghost, /shown\?\.color/);
  assert.match(ghost, /terrainHeight\(verdict\.spot\.x, verdict\.spot\.z\)/);
  assert.match(ghost, /rotation\.y = verdict\.facing/);
  assert.doesNotMatch(ghost, /validatePlacement\(/);
  assert.doesNotMatch(ghost, /#7ddac3|#ed786b/);
  const model = fnBody(world, "BuildingModel");
  assert.match(model, /tint/);
  assert.match(model, /PLACE_GHOST_READY/);
  assert.match(model, /PLACE_GHOST_BLOCKED/);
  assert.match(prompts, /function promptDecision[\s\S]*placeVerdict\(/);
  assert.match(storeSrc, /judgePlacement\(/);
  assert.match(storeSrc, /notify\(BUILD_NEED_MATERIALS\)/);
  const readyMatch = prompts.match(/PLACE_GHOST_READY = "(#[0-9a-f]{6})"/);
  const blockedMatch = prompts.match(/PLACE_GHOST_BLOCKED = "(#[0-9a-f]{6})"/);
  assert.ok(readyMatch && blockedMatch);
  const ready = readyMatch[1];
  const blocked = blockedMatch[1];
  assert.equal(ready, "#7ddac3");
  assert.equal(blocked, "#ed786b");
  assert.match(touchFile, /export const TOUCH_STICK = 112/);
  assert.match(touchFile, /export const TOUCH_BUTTON = \{ w: 72, h: 48 \}/);
  assert.match(touchFile, /const PAD = 8/);
  assert.match(touchFile, /const GAP = 8/);
  const zones = touchLayout(800, 600, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.equal(zones.stick.x, 8);
  assert.equal(zones.stick.y, 600 - 8 - 112);
  assert.equal(zones.stick.w, 112);
  assert.equal(zones.stick.h, 112);
  assert.equal(zones.interact.x, 800 - 8 - 72);
  assert.equal(zones.interact.y, 600 - 8 - 48);
  for (const name of ["interact", "dodge", "sprint"]) {
    assert.equal(zones[name].w, 72, name);
    assert.equal(zones[name].h, 48, name);
  }
  assert.ok(zones.look.w > 0 && zones.look.h > 0);

  const recipe = RECIPES.find((item) => item.width !== item.depth);
  assert.ok(recipe);
  const counts = () =>
    Object.fromEntries(ITEMS.map((item) => [item.id, inventory.count(item.id)]));
  const shot = () => useRpg.getState().buildings.map((building) => ({ ...building }));
  const reseed = () => {
    inventory.clear();
    for (const [id, n] of [
      ["notes", 60],
      ["parts", 60],
      ["credit", 10],
      ["coffee", 3],
      ["tea", 3],
    ])
      assert.equal(inventory.add(id, n).overflow, 0, id);
  };
  const stand = (x, z, yaw) => {
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: x + Math.sin(yaw) * 5,
      playerZ: z + Math.cos(yaw) * 5,
      playerYaw: yaw,
    });
  };
  const readVerdict = () => {
    const live = useRpg.getState();
    const g = useGame.getState();
    const view = r.placeVerdict({
      kind: live.buildKind,
      x: g.playerX,
      z: g.playerZ,
      yaw: g.playerYaw,
      rotation: live.rotation,
      buildings: live.buildings,
      count: (id) => inventory.count(id),
    });
    const box = footprint(view.kind, live.rotation);
    const spec = RECIPES.find((item) => item.id === view.kind);
    assert.equal(view.width, box.width);
    assert.equal(view.depth, box.depth);
    assert.equal(view.facing, live.rotation);
    assert.equal(view.yaw, g.playerYaw);
    assert.equal(view.legal, view.reason == null);
    assert.equal(view.words, view.legal ? r.PLACE_LEGAL_WORD : view.reason);
    assert.equal(view.color, view.legal ? ready : blocked);
    assert.equal(view.kind, live.buildKind);
    assert.deepEqual(view.cost, spec.cost);
    return view;
  };
  const prepare = (turns) => {
    useRpg.setState({
      buildings: [],
      interiorId: null,
      panel: null,
      hp: 100,
      focus: 100,
      notice: "",
      rotation: 0,
      buildKind: null,
      departmentId: DEPARTMENTS[0].id,
    });
    useGame.setState({ phase: "playing", plaqueId: null });
    useRpg.getState().chooseBuild(recipe.id);
    assert.equal(useRpg.getState().buildKind, recipe.id);
    assert.equal(useRpg.getState().rotation, 0);
    for (let i = 0; i < turns; i += 1) useRpg.getState().rotate();
  };
  const find = (yaw, pred, label) => {
    const seen = new Set();
    for (let x = -108; x <= 200; x += 4) {
      for (let z = 48; z >= -180; z -= 4) {
        stand(x, z, yaw);
        const view = readVerdict();
        seen.add(view.legal ? "legal" : view.reason);
        if (pred(view)) return view;
      }
    }
    assert.fail(label + " " + [...seen].join(" | "));
  };
  const submit = (view) => {
    const choice = r.promptDecision(r.promptSnap());
    assert.ok(choice);
    assert.equal(choice.kind, "place");
    assert.equal(choice.x, view.spot.x);
    assert.equal(choice.z, view.spot.z);
    assert.equal(choice.reason, view.reason);
    assert.equal(choice.text, view.legal ? "放置" : view.words);
    assert.equal(choice.marker, choice.text);
    const before = counts();
    const buildings = shot();
    useRpg.setState({ notice: "" });
    assert.equal(useRpg.getState().commitPrompt(), "place");
    return { before, buildings };
  };
  const unchanged = (before, buildings) => {
    assert.deepEqual(counts(), before);
    assert.deepEqual(shot(), buildings);
  };
  const priorGame = {
    visited: useGame.getState().visited,
    timeOfDay: useGame.getState().timeOfDay,
    muted: useGame.getState().muted,
  };
  try {
    prepare(0);
    const flat = find(0, (view) => view.legal, "flat");
    assert.equal(flat.legal, true);
    assert.equal(flat.words, r.PLACE_LEGAL_WORD);
    assert.equal(flat.color, ready);
    assert.deepEqual(
      { width: flat.width, depth: flat.depth },
      footprint(recipe.id, flat.facing),
    );
    const placed = submit(flat);
    const built = useRpg.getState().buildings;
    assert.equal(built.length, placed.buildings.length + 1);
    const building = built[built.length - 1];
    assert.equal(building.kind, flat.kind);
    assert.equal(building.x, flat.spot.x);
    assert.equal(building.z, flat.spot.z);
    assert.equal(building.rotation, flat.facing);
    assert.equal(building.hp, recipe.health);
    for (const item of ITEMS)
      assert.equal(
        inventory.count(item.id),
        placed.before[item.id] - (flat.cost[item.id] ?? 0),
        item.id,
      );

    prepare(0);
    const bounds = validatePlacement(recipe.id, 4000, 4000, 0, [], { x: 0, z: 0 });
    const closeAt = { x: 40, z: -40 };
    const close = validatePlacement(recipe.id, closeAt.x, closeAt.z, 0, [], closeAt);
    let passage = null;
    for (let z = 4; z <= 40; z += 2) {
      const inside = validatePlacement(recipe.id, 0, z, 0, [], { x: 40, z });
      const outside = validatePlacement(recipe.id, 50, z, 0, [], { x: 90, z });
      if (inside && inside !== bounds && inside !== outside) {
        passage = inside;
        break;
      }
    }
    assert.ok(bounds && close && passage);
    assert.notEqual(bounds, passage);
    const campus = new Set();
    for (const site of CAMPUS_SITES) {
      const reason = validatePlacement(
        recipe.id,
        site.x,
        site.z,
        0,
        [],
        { x: site.x + 30, z: site.z },
        false,
      );
      if (reason) campus.add(reason);
    }
    assert.ok(campus.size >= 1);
    const known = new Set([bounds, close, passage, ...campus]);
    const slope = find(0, (view) => {
      if (view.legal || known.has(view.reason)) return false;
      const g = useGame.getState();
      const bare = validatePlacement(
        recipe.id,
        view.spot.x,
        view.spot.z,
        useRpg.getState().rotation,
        useRpg.getState().buildings,
        { x: g.playerX, z: g.playerZ },
        false,
      );
      const hit = doorOverlap(recipe.id, view.spot.x, view.spot.z, useRpg.getState().rotation);
      return bare === view.reason && !hit.entrance && !hit.exit && !hit.passage;
    }, "slope");
    assert.equal(slope.legal, false);
    assert.equal(slope.words, slope.reason);
    assert.equal(slope.color, blocked);
    const sloped = submit(slope);
    assert.equal(useRpg.getState().notice, slope.words);
    assert.equal(useRpg.getState().buildings.length, sloped.buildings.length);
    unchanged(sloped.before, sloped.buildings);

    prepare(0);
    const door = find(0, (view) => {
      if (view.legal) return false;
      const g = useGame.getState();
      const open = validatePlacement(
        recipe.id,
        view.spot.x,
        view.spot.z,
        useRpg.getState().rotation,
        useRpg.getState().buildings,
        { x: g.playerX, z: g.playerZ },
        false,
      );
      const hit = doorOverlap(recipe.id, view.spot.x, view.spot.z, useRpg.getState().rotation);
      return open == null && (hit.entrance || hit.exit || hit.passage);
    }, "door");
    assert.equal(door.words, door.reason);
    assert.equal(door.color, blocked);
    const blockedDoor = submit(door);
    assert.equal(useRpg.getState().notice, door.words);
    unchanged(blockedDoor.before, blockedDoor.buildings);

    prepare(0);
    const open = find(0, (view) => view.legal, "overlap");
    const occupied = {
      id: "overlap-probe",
      kind: recipe.id,
      x: open.spot.x,
      z: open.spot.z,
      rotation: useRpg.getState().rotation,
      hp: recipe.health,
    };
    useRpg.setState({ buildings: [occupied] });
    stand(open.spot.x, open.spot.z, 0);
    const overlap = readVerdict();
    assert.equal(overlap.legal, false);
    assert.equal(overlap.spot.x, open.spot.x);
    assert.equal(overlap.spot.z, open.spot.z);
    assert.equal(overlap.words, overlap.reason);
    assert.notEqual(overlap.reason, open.reason);
    const crowded = submit(overlap);
    assert.equal(useRpg.getState().notice, overlap.words);
    assert.equal(useRpg.getState().buildings.length, 1);
    assert.equal(useRpg.getState().buildings[0].id, occupied.id);
    unchanged(crowded.before, crowded.buildings);

    prepare(1);
    assert.equal(useRpg.getState().rotation, Math.PI / 2);
    const turned = find(0, (view) => view.legal, "turn");
    const unturned = footprint(recipe.id, 0);
    assert.notEqual(turned.width, unturned.width);
    assert.deepEqual(
      { width: turned.width, depth: turned.depth },
      footprint(recipe.id, useRpg.getState().rotation),
    );
    assert.equal(turned.facing, useRpg.getState().rotation);
    assert.equal(turned.words, r.PLACE_LEGAL_WORD);
    const turnedPlace = submit(turned);
    const landed = useRpg.getState().buildings[useRpg.getState().buildings.length - 1];
    assert.equal(landed.kind, turned.kind);
    assert.equal(landed.x, turned.spot.x);
    assert.equal(landed.z, turned.spot.z);
    assert.equal(landed.rotation, turned.facing);
    assert.deepEqual(footprint(landed.kind, landed.rotation), {
      width: turned.width,
      depth: turned.depth,
    });
    for (const item of ITEMS)
      assert.equal(
        inventory.count(item.id),
        turnedPlace.before[item.id] - (turned.cost[item.id] ?? 0),
        item.id,
      );

    prepare(0);
    const payable = find(0, (view) => view.legal, "materials");
    const pose = {
      x: useGame.getState().playerX,
      z: useGame.getState().playerZ,
      yaw: useGame.getState().playerYaw,
    };
    inventory.clear();
    for (const [id, n] of Object.entries(payable.cost)) {
      assert.ok(n >= 1, id);
      if (n - 1 > 0) assert.equal(inventory.add(id, n - 1).overflow, 0, id);
    }
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: pose.x,
      playerZ: pose.z,
      playerYaw: pose.yaw,
    });
    const poor = readVerdict();
    assert.equal(poor.legal, false);
    assert.equal(poor.spot.x, payable.spot.x);
    assert.equal(poor.spot.z, payable.spot.z);
    assert.equal(
      validatePlacement(
        recipe.id,
        poor.spot.x,
        poor.spot.z,
        useRpg.getState().rotation,
        useRpg.getState().buildings,
        { x: pose.x, z: pose.z },
        false,
      ),
      null,
    );
    for (const [id, n] of Object.entries(poor.cost)) assert.ok(inventory.count(id) < n, id);
    assert.equal(poor.words, poor.reason);
    const broke = submit(poor);
    assert.equal(useRpg.getState().notice, poor.words);
    assert.equal(useRpg.getState().buildings.length, broke.buildings.length);
    unchanged(broke.before, broke.buildings);

    reseed();
    prepare(0);
    const first = find(0, (view) => view.legal, "move");
    const second = find(
      Math.PI / 2,
      (view) => view.legal && (view.spot.x !== first.spot.x || view.spot.z !== first.spot.z),
      "yaw",
    );
    assert.notEqual(second.yaw, first.yaw);
    assert.equal(second.words, r.PLACE_LEGAL_WORD);
    const moved = submit(second);
    const next = useRpg.getState().buildings[useRpg.getState().buildings.length - 1];
    assert.equal(next.x, second.spot.x);
    assert.equal(next.z, second.spot.z);
    assert.equal(next.rotation, second.facing);
    assert.equal(next.x === first.spot.x && next.z === first.spot.z, false);
    for (const item of ITEMS)
      assert.equal(
        inventory.count(item.id),
        moved.before[item.id] - (second.cost[item.id] ?? 0),
        item.id,
      );

    reseed();
    prepare(0);
    const aimed = find(0, (view) => view.legal, "cancel");
    assert.equal(aimed.legal, true);
    const bag = counts();
    const pending = shot();
    useRpg.setState({ clock: 40, attackUntil: 0, panel: null, interiorId: null });
    useRpg.getState().attack();
    assert.equal(useRpg.getState().attackUntil, 0);
    assert.equal(useRpg.getState().buildKind, recipe.id);
    assert.deepEqual(counts(), bag);
    useRpg.getState().cancelBuild();
    assert.equal(useRpg.getState().buildKind, null);
    assert.deepEqual(counts(), bag);
    assert.deepEqual(shot(), pending);
    useRpg.getState().attack();
    assert.ok(useRpg.getState().attackUntil > 40);
    const node = SUPPLY_NODES[0];
    useRpg.setState({
      loot: [],
      buildings: [],
      harvested: {},
      interiorId: null,
      panel: null,
      buildKind: null,
      hp: 100,
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: node.x,
      playerZ: node.z,
      playerYaw: 0,
      visited: [],
    });
    const decision = r.promptDecision(r.promptSnap());
    assert.ok(decision);
    assert.equal(decision.kind, "supply");
    assert.notEqual(decision.kind, "place");
    const beforeSupply = counts();
    assert.equal(useRpg.getState().interact(), true);
    assert.equal(useRpg.getState().buildings.length, 0);
    assert.equal(useRpg.getState().buildKind, null);
    for (const id of Object.keys(recipe.cost))
      assert.ok(inventory.count(id) >= beforeSupply[id], id);
  } finally {
    useRpg.getState().cancelBuild();
    reseed();
    useRpg.setState({
      panel: null,
      interiorId: null,
      buildKind: null,
      buildings: [],
      loot: [],
      harvested: {},
      equipped: false,
      hp: 100,
      focus: 100,
      xp: 0,
      built: 0,
      kills: 0,
      discoveries: [],
      freshStart: false,
      notice: "",
      attackUntil: 0,
      skillUntil: 0,
      dodgeUntil: 0,
      rotation: 0,
      clock: 10,
      departmentId: DEPARTMENTS[0].id,
      enemies: ENCOUNTERS.map((enemy) => ({
        ...enemy,
        anchorX: enemy.x,
        anchorZ: enemy.z,
        hp: ENEMY_TYPES[enemy.kind].hp,
        state: "idle",
        timer: 0,
        hurt: 0,
      })),
    });
    useGame.setState({
      phase: "playing",
      plaqueId: null,
      playerX: -5,
      playerZ: -45,
      playerYaw: 0,
      warp: null,
      visited: priorGame.visited,
      timeOfDay: priorGame.timeOfDay,
      muted: priorGame.muted,
    });
    flushSave();
  }
});
