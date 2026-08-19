import { create } from "zustand";
import { LANDMARKS, LANDMARK_BY_ID, SPAWN, type TimeOfDay } from "./world";
import { loadLocal, saveLocal, type SaveBlob } from "./save";

export type Phase = "title" | "playing" | "paused" | "codex";

export type Warp = { x: number; z: number; yaw: number };

type GameState = {
  phase: Phase;
  timeOfDay: TimeOfDay;
  /** Active Reality Compare benchmark camera (F8 dev tool), or null. */
  benchmarkId: string | null;
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
  menuFrom: Phase;
  start: () => void;
  resume: () => void;
  pause: () => void;
  setPhase: (phase: Phase) => void;
  openCodex: (from: Phase) => void;
  closeMenu: () => void;
  setTime: (t: TimeOfDay) => void;
  setBenchmark: (id: string | null) => void;
  setNearby: (id: string | null) => void;
  setPlayer: (x: number, z: number, yaw: number) => void;
  openPlaque: (id: string | null) => void;
  stamp: (id: string) => void;
  hydrate: (blob: SaveBlob) => void;
  toggleMute: () => void;
  travelTo: (id: string) => void;
  clearWarp: () => void;
  clearSnap: () => void;
  restartSlope: () => void;
  resetProgress: () => void;
};

function persist(partial: Partial<SaveBlob>) {
  const cur = loadLocal();
  saveLocal({ ...cur, ...partial });
}

const local = loadLocal();

export const useGame = create<GameState>((set, get) => ({
  phase: "title",
  timeOfDay: local.timeOfDay,
  benchmarkId: null,
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
  menuFrom: "title",
  start: () => set({ phase: "playing", plaqueId: null, snapCam: true }),
  resume: () => set({ phase: "playing", plaqueId: null }),
  pause: () => {
    if (get().phase === "playing") set({ phase: "paused", plaqueId: null, menuFrom: "playing" });
  },
  setPhase: (phase) => set({ phase }),
  openCodex: (from) => set({ phase: "codex", menuFrom: from, plaqueId: null }),
  closeMenu: () => {
    const from = get().menuFrom;
    set({ phase: from === "playing" || from === "paused" ? "playing" : "title", plaqueId: null });
  },
  setTime: (timeOfDay) => {
    set({ timeOfDay });
    persist({ timeOfDay });
  },
  setBenchmark: (benchmarkId) => set({ benchmarkId }),
  setNearby: (nearbyId) => {
    if (get().nearbyId !== nearbyId) set({ nearbyId });
  },
  setPlayer: (playerX, playerZ, playerYaw) => set({ playerX, playerZ, playerYaw }),
  openPlaque: (plaqueId) => set({ plaqueId }),
  stamp: (id) => {
    const visited = get().visited.includes(id) ? get().visited : [...get().visited, id];
    set({ visited, plaqueId: id, stampFlash: performance.now() });
    persist({ visited });
  },
  hydrate: (blob) =>
    set({
      visited: Array.from(new Set([...get().visited, ...blob.visited])).filter((id) =>
        LANDMARKS.some((l) => l.id === id),
      ),
      timeOfDay: blob.timeOfDay,
      muted: blob.muted,
    }),
  toggleMute: () => {
    const muted = !get().muted;
    set({ muted });
    persist({ muted });
  },
  travelTo: (id) => {
    const l = LANDMARK_BY_ID[id];
    if (!l) return;
    set({
      warp: { x: l.x, z: l.z, yaw: 0 },
      phase: "playing",
      plaqueId: null,
      snapCam: true,
      playerX: l.x,
      playerZ: l.z,
      playerYaw: 0,
    });
  },
  clearWarp: () => set({ warp: null }),
  clearSnap: () => set({ snapCam: false }),
  restartSlope: () =>
    set({
      warp: { x: SPAWN.x, z: SPAWN.z, yaw: 0 },
      phase: "playing",
      plaqueId: null,
      snapCam: true,
      playerX: SPAWN.x,
      playerZ: SPAWN.z,
      playerYaw: 0,
    }),
  resetProgress: () => {
    persist({ visited: [] });
    set({ visited: [], plaqueId: null, stampFlash: 0 });
  },
}));
