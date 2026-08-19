export {};

declare global {
  interface Window {
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
