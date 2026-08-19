/** Small pure helpers shared by the reality data layer. No Three.js here. */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite smoothstep between two edges. */
export function smoothstep(edge0: number, edge1: number, v: number): number {
  if (edge1 === edge0) return v < edge0 ? 0 : 1;
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export type ControlPoint = readonly [number, number];

/**
 * Piecewise-linear sample of a control-point curve, clamped at both ends.
 * Points must be sorted on the first component, descending or ascending.
 */
export function sampleCurve(points: readonly ControlPoint[], at: number): number {
  const descending = points.length > 1 && points[1][0] < points[0][0];
  const key = descending ? -at : at;
  const k = (p: ControlPoint) => (descending ? -p[0] : p[0]);
  if (key <= k(points[0])) return points[0][1];
  const last = points[points.length - 1];
  if (key >= k(last)) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (key >= k(a) && key <= k(b)) {
      const span = k(b) - k(a);
      const t = span === 0 ? 0 : (key - k(a)) / span;
      return lerp(a[1], b[1], t);
    }
  }
  return last[1];
}

/** Deterministic hash-based pseudo-random in [0, 1). Stable across runs. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(Math.round(x * 73.13) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul(Math.round(y * 41.71) ^ 0xc2b2ae35, 0x27d4eb2f);
  h ^= Math.imul(seed + 0x165667b1, 0x9e3779b1);
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
