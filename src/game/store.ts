import { create } from "zustand";
import { LANDMARKS, LANDMARK_BY_ID, resolveCollision, SPAWN, type TimeOfDay } from "./world";
import { keptWarp, settlePlay, type Pose } from "./activity";
import { campusAudio } from "./audio";
import { loadLocal, saveLocal, inventoryFromSave, type GraphicsPref, type SaveBlob } from "./save";
import { setQualityPreference } from "./quality";
import {
  addItem,
  listItems,
  removeItem,
  starterInventory,
  useItem,
  withCapacity,
  type Inventory,
  type ItemId,
} from "./inventory.ts";
import { coerceDepartmentId, inventoryCapacityFor } from "./departments.ts";
import {
  applyHeal,
  createEnemyHp,
  healAmount,
  playerMaxHp,
  strikeEnemy,
  strikePlayer,
} from "./combat.ts";
import { ENEMY_SPAWN_BY_ID, ENEMY_SPAWNS } from "./world-data/encounters.ts";
import { listStructures, tryPlace, type BuildKind, type PlacedStructure } from "./building.ts";

export type Phase = "title" | "setup" | "playing" | "paused" | "codex";
export type HudPanel = "none" | "backpack" | "build";

export type Warp = { x: number; z: number; yaw: number };

function initialEnemies(): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of ENEMY_SPAWNS) m[e.id] = createEnemyHp(e.kind);
  return m;
}

type GameState = {
  phase: Phase;
  timeOfDay: TimeOfDay;
  /** Active Reality Compare benchmark camera (F8 dev tool), or null. */
  benchmarkId: string | null;
  graphics: GraphicsPref;
  /** Bumped whenever a graphics setting needs the 3D scene rebuilt. */
  sceneEpoch: number;
  visited: string[];
  nearbyId: string | null;
  plaqueId: string | null;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  stampFlash: number;
  muted: boolean;
  warp: Warp | null;
  snapCam: boolean;
  /** Settings dialog. Not written into the save. */
  settingsOpen: boolean;
  menuFrom: Phase;
  inventory: Inventory;
  departmentId: string | null;
  buildings: PlacedStructure[];
  playerHp: number;
  enemies: Record<string, number>;
  nearbyEnemyId: string | null;
  hud: HudPanel;
  buildKind: BuildKind;
  downed: boolean;
  start: () => void;
  resume: () => void;
  pause: () => void;
  setPhase: (phase: Phase) => void;
  openCodex: (from: Phase) => void;
  closeMenu: () => void;
  setTime: (t: TimeOfDay) => void;
  setBenchmark: (id: string | null) => void;
  setGraphics: (patch: Partial<GraphicsPref>) => void;
  setNearby: (id: string | null) => void;
  setNearbyEnemy: (id: string | null) => void;
  setPlayer: (x: number, z: number, yaw: number) => void;
  openPlaque: (id: string | null) => void;
  stamp: (id: string) => void;
  hydrate: (blob: SaveBlob) => void;
  toggleMute: () => void;
  travelTo: (id: string) => void;
  clearWarp: () => void;
  clearSnap: () => void;
  restartSlope: (stand?: Pose) => void;
  resetProgress: () => void;
  selectDepartment: (id: string) => void;
  addToPack: (id: ItemId, count?: number) => boolean;
  useFromPack: (id: ItemId) => boolean;
  toggleHud: (panel: HudPanel) => void;
  setBuildKind: (kind: BuildKind) => void;
  tryPlaceHere: () => boolean;
  strikeNearby: () => boolean;
  respawn: () => void;
};

function persist(partial: Partial<SaveBlob>) {
  const cur = loadLocal();
  saveLocal({ ...cur, ...partial });
}

function persistPlay(get: () => GameState) {
  const s = get();
  persist({
    visited: s.visited,
    inventory: listItems(s.inventory),
    inventoryCapacity: s.inventory.capacity,
    departmentId: s.departmentId,
    buildings: listStructures(s.buildings),
  });
}

const local = loadLocal();
const startInv = inventoryFromSave(local);
const startHp = playerMaxHp(local.departmentId);

export const useGame = create<GameState>((set, get) => ({
  phase: "title",
  timeOfDay: local.timeOfDay,
  benchmarkId: null,
  graphics: local.graphics,
  sceneEpoch: 0,
  visited: local.visited,
  nearbyId: null,
  plaqueId: null,
  playerX: SPAWN.x,
  playerZ: SPAWN.z,
  playerYaw: 0,
  stampFlash: 0,
  muted: local.muted,
  warp: null,
  snapCam: false,
  settingsOpen: false,
  menuFrom: "title",
  inventory: startInv,
  departmentId: local.departmentId,
  buildings: local.buildings,
  playerHp: startHp,
  enemies: initialEnemies(),
  nearbyEnemyId: null,
  hud: "none",
  buildKind: "booth",
  downed: false,
  start: () => {
    let inventory = get().inventory;
    if (listItems(inventory).length === 0) {
      inventory = starterInventory(inventory.capacity);
    }
    const departmentId = get().departmentId;
    set({
      inventory,
      plaqueId: null,
      hud: "none",
      downed: false,
      playerHp: playerMaxHp(departmentId),
      snapCam: Boolean(departmentId),
      phase: departmentId ? "playing" : "setup",
    });
    persistPlay(get);
  },
  resume: () => {
    settlePlay("suspend");
    set({ phase: "playing", plaqueId: null, hud: "none", settingsOpen: false });
  },
  pause: () => {
    if (get().phase !== "playing") return;
    settlePlay("suspend");
    const s = get();
    set({
      phase: "paused",
      plaqueId: null,
      menuFrom: "playing",
      hud: "none",
      warp: keptWarp(s.warp, { x: s.playerX, z: s.playerZ, yaw: s.playerYaw }),
    });
  },
  setPhase: (phase) => set({ phase }),
  openCodex: (from) => set({ phase: "codex", menuFrom: from, plaqueId: null, hud: "none" }),
  closeMenu: () => {
    const from = get().menuFrom;
    set({ phase: from === "playing" || from === "paused" ? "playing" : "title", plaqueId: null, hud: "none" });
  },
  setTime: (timeOfDay) => {
    set({ timeOfDay });
    persist({ timeOfDay });
  },
  setBenchmark: (benchmarkId) => set({ benchmarkId }),
  setGraphics: (patch) => {
    const s = get();
    const graphics = { ...s.graphics, ...patch };
    settlePlay("suspend");
    set({
      graphics,
      sceneEpoch: s.sceneEpoch + 1,
      snapCam: true,
      warp: keptWarp(s.warp, { x: s.playerX, z: s.playerZ, yaw: s.playerYaw }),
    });
    persist({ graphics });
    setQualityPreference(graphics);
  },
  setNearby: (nearbyId) => {
    if (get().nearbyId !== nearbyId) set({ nearbyId });
  },
  setNearbyEnemy: (nearbyEnemyId) => {
    if (get().nearbyEnemyId !== nearbyEnemyId) set({ nearbyEnemyId });
  },
  setPlayer: (playerX, playerZ, playerYaw) => set({ playerX, playerZ, playerYaw }),
  openPlaque: (plaqueId) => {
    settlePlay("suspend");
    const s = get();
    set({
      plaqueId,
      settingsOpen: plaqueId ? false : s.settingsOpen,
      warp: keptWarp(s.warp, { x: s.playerX, z: s.playerZ, yaw: s.playerYaw }),
    });
  },
  stamp: (id) => {
    settlePlay("suspend");
    const s = get();
    const visited = s.visited.includes(id) ? s.visited : [...s.visited, id];
    set({
      visited,
      plaqueId: id,
      stampFlash: performance.now(),
      warp: keptWarp(s.warp, { x: s.playerX, z: s.playerZ, yaw: s.playerYaw }),
    });
    persist({ visited });
  },
  hydrate: (blob) => {
    const departmentId = coerceDepartmentId(blob.departmentId) ?? get().departmentId;
    const cap = inventoryCapacityFor(departmentId);
    const inventory = withCapacity(inventoryFromSave(blob), cap);
    set({
      visited: Array.from(new Set([...get().visited, ...blob.visited])).filter((id) =>
        LANDMARKS.some((l) => l.id === id),
      ),
      timeOfDay: blob.timeOfDay,
      muted: blob.muted,
      inventory,
      departmentId,
      buildings: blob.buildings ?? get().buildings,
      playerHp: playerMaxHp(departmentId),
    });
  },
  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    persist({ muted });
    campusAudio.setMuted(muted);
  },
  travelTo: (id) => {
    const l = LANDMARK_BY_ID[id];
    if (!l) return;
    settlePlay("relocate");
    set({
      warp: { x: l.x, z: l.z, yaw: 0 },
      phase: "playing",
      plaqueId: null,
      hud: "none",
      snapCam: true,
      playerX: l.x,
      playerZ: l.z,
      playerYaw: 0,
    });
  },
  clearWarp: () => set({ warp: null }),
  clearSnap: () => set({ snapCam: false }),
  restartSlope: (stand) => {
    const resolved = stand ?? resolveCollision(SPAWN.x, SPAWN.z, 0.42);
    const pose = stand ?? { x: resolved.x, z: resolved.z, yaw: 0 };
    settlePlay("relocate");
    set({
      warp: pose,
      phase: "playing",
      plaqueId: null,
      hud: "none",
      snapCam: true,
      playerX: pose.x,
      playerZ: pose.z,
      playerYaw: pose.yaw,
      downed: false,
      playerHp: playerMaxHp(get().departmentId),
    });
  },
  resetProgress: () => {
    persist({ visited: [] });
    set({ visited: [], plaqueId: null, stampFlash: 0 });
  },
  selectDepartment: (id) => {
    const departmentId = coerceDepartmentId(id);
    if (!departmentId) return;
    const capacity = inventoryCapacityFor(departmentId);
    let inventory = withCapacity(get().inventory, capacity);
    if (listItems(inventory).length === 0) inventory = starterInventory(capacity);
    const playerHp = playerMaxHp(departmentId);
    set({
      departmentId,
      inventory,
      playerHp,
      phase: "playing",
      snapCam: true,
      plaqueId: null,
      hud: "none",
      downed: false,
    });
    persistPlay(get);
  },
  addToPack: (id, count = 1) => {
    const r = addItem(get().inventory, id, count);
    if (!r.ok) return false;
    set({ inventory: r.inventory });
    persistPlay(get);
    return true;
  },
  useFromPack: (id) => {
    const r = useItem(get().inventory, id);
    if (!r.ok) return false;
    let playerHp = get().playerHp;
    if (id === "coffee" || id === "first-aid") {
      playerHp = applyHeal(playerHp, playerMaxHp(get().departmentId), healAmount(get().departmentId));
    }
    set({ inventory: r.inventory, playerHp, downed: false });
    persistPlay(get);
    return true;
  },
  toggleHud: (panel) => {
    const hud = get().hud === panel ? "none" : panel;
    set({ hud, plaqueId: hud === "none" ? get().plaqueId : null });
  },
  setBuildKind: (buildKind) => set({ buildKind }),
  tryPlaceHere: () => {
    const s = get();
    const result = tryPlace(s.buildings, s.buildKind, s.playerX, s.playerZ);
    if (!result.ok) return false;
    const brick = removeItem(s.inventory, "brick", 1);
    if (!brick.ok) return false;
    set({ buildings: result.placed, inventory: brick.inventory });
    persistPlay(get);
    return true;
  },
  strikeNearby: () => {
    const s = get();
    if (s.downed || s.phase !== "playing") return false;
    const spawn = s.nearbyEnemyId ? ENEMY_SPAWN_BY_ID[s.nearbyEnemyId] : null;
    if (!spawn) return false;
    const hp = s.enemies[spawn.id] ?? 0;
    if (hp <= 0) return false;
    const hit = strikeEnemy(hp, spawn.kind, s.departmentId);
    const enemies = { ...s.enemies, [spawn.id]: hit.hp };
    if (hit.defeated) {
      const loot = addItem(s.inventory, "notes", 1);
      set({
        enemies,
        inventory: loot.ok ? loot.inventory : s.inventory,
      });
      persistPlay(get);
      return true;
    }
    const back = strikePlayer(s.playerHp, spawn.kind, s.departmentId);
    set({
      enemies,
      playerHp: back.hp,
      downed: back.defeated,
      hud: back.defeated ? "none" : s.hud,
    });
    return true;
  },
  respawn: () => {
    set({ enemies: initialEnemies() });
    get().restartSlope();
  },
}));
