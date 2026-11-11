/**
 * The west vista: 淡水河, the far-bank town, and 觀音山.
 *
 * These are silhouettes. The numbers are not a survey. The near shore is the
 * last walkable ground; the water, the town, and the ridges stay beyond it.
 */
export const SHORE_X = -112;

export type VistaBlock = { x: number; z: number; w: number; h: number; d: number; tone: number };

/** Low blocks on the far bank, west of the river plane. */
export function vistaTown(): VistaBlock[] {
  const out: VistaBlock[] = [];
  for (let i = 0; i < 46; i++) {
    const z = -320 + i * 9.6;
    const jitter = Math.sin(i * 12.9898) * 43758.5453;
    const f = jitter - Math.floor(jitter);
    out.push({
      x: -408 - f * 18,
      z,
      w: 4.5 + f * 6,
      h: 3 + ((i * 7) % 5) * 2.2,
      d: 5 + ((i * 3) % 4) * 1.5,
      tone: i % 3,
    });
  }
  return out;
}

/** Haze ridges. x is the cone center; the wide bases stay west of the shore. */
export const VISTA_RIDGES = [
  { x: -560, h: 96, z: -140, r: 210, rot: 0.14, color: "#5e7263" },
  { x: -520, h: 58, z: 20, r: 140, rot: -0.24, color: "#66796d" },
  { x: -500, h: 34, z: -260, r: 120, rot: 0.32, color: "#6d7f74" },
  { x: -470, h: 24, z: 120, r: 96, rot: 0.05, color: "#748577" },
] as const;
