/** Seamlessly tiling value noise + helpers for the material generator. */

function hash(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x85ebca6b) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);

/**
 * Value noise on a `period`×`period` lattice, wrapped so the result tiles.
 * @param {number} u 0..1
 * @param {number} v 0..1
 */
export function tilingNoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const w = (i, j) => hash(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const a = w(x0, y0);
  const b = w(x0 + 1, y0);
  const c = w(x0, y0 + 1);
  const d = w(x0 + 1, y0 + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

/** Sum of octaves, still tiling because every octave's period divides `base`. */
export function fbm(u, v, base, octaves, seed, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += tilingNoise(u, v, base * 2 ** o, seed + o * 101) * amp;
    norm += amp;
    amp *= gain;
  }
  return sum / norm;
}

/** Distance to the nearest of `period`² jittered feature points; tiles. */
export function tilingWorley(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let best = 10;
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      const cx = xi + di;
      const cy = yi + dj;
      const wx = ((cx % period) + period) % period;
      const wy = ((cy % period) + period) % period;
      const px = cx + hash(wx, wy, seed);
      const py = cy + hash(wx, wy, seed + 7919);
      const d = Math.hypot(px - x, py - y);
      if (d < best) best = d;
    }
  }
  return Math.min(1, best);
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, v) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** #rrggbb -> [0..1, 0..1, 0..1] */
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function mixRgb(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
