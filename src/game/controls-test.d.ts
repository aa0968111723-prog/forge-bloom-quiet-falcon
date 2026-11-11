export {};

declare global {
  interface Window {
    /** Skeletal animation state, published by the player's character. */
    __characterTest?: {
      weights: { idle: number; walk: number; run: number; walkRate: number };
      boneRotation: (name: string) => { x: number; y: number; z: number } | null;
    };
    /** WebGL renderer statistics, exposed for the perf regression. */
    __perfTest?: {
      info: {
        render: { calls: number; triangles: number };
        memory: { geometries: number; textures: number };
      };
    };
    /**
     * Store access for scripted art/QA captures. Only installed when the page
     * is opened with `?qa=1`; the game never reads it.
     */
    __rpgQA?: {
      rpg: typeof import("./rpg/store").useRpg;
      game: typeof import("./store").useGame;
    };
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setKeys?: (codes: string[]) => void;
      getPosition?: () => { x: number; y: number; z: number };
      setPose?: (x: number, z: number, yaw?: number) => void;
      /** Reality Compare Mode test hooks (F8 equivalent). */
      setBenchmark?: (id: string | null) => void;
      getBenchmark?: () => string | null;
      /** Adjust camera yaw without resetting velocity. */
      setYaw?: (yaw: number) => void;
    };
  }
}
