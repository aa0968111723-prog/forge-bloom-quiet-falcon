import { create } from "zustand";
export const usePerformance = create<{
  fps: number;
  dpr: number;
  drawCalls: number;
  triangles: number;
}>(() => ({ fps: 0, dpr: 1, drawCalls: 0, triangles: 0 }));
