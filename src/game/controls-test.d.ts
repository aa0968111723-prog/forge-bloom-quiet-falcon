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
