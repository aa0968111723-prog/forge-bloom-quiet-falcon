/**
 * Tiny software raster for procedural "hand-painted" textures.
 *
 * Shapes are drawn as signed-distance fields with a one-pixel smoothstep, so
 * eyes, brows and seams stay anti-aliased at any size. Noise is periodic per
 * cell so cloth weaves tile seamlessly around a sleeve or a leg.
 * Runs in Node at export time only.
 */
import { deflateSync } from "node:zlib";

export type RGBA = [number, number, number, number];

export function hex(color: string, alpha = 1): RGBA {
  const n = parseInt(color.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

export function mixColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
}

export function shade(c: RGBA, k: number): RGBA {
  return [c[0] * k, c[1] * k, c[2] * k, c[3]];
}

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Deterministic hash → [0,1). */
function hash(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Periodic value noise: tiles every `period` cells in both axes. */
export function pnoise(u: number, v: number, period: number, seed = 1) {
  const x = u * period;
  const y = v * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash(w(x0), w(y0), seed);
  const b = hash(w(x0 + 1), w(y0), seed);
  const c = hash(w(x0), w(y0 + 1), seed);
  const d = hash(w(x0 + 1), w(y0 + 1), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function pfbm(u: number, v: number, period: number, octaves = 4, seed = 1) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += pnoise(u, v, period << o, seed + o * 17) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

export class Raster {
  readonly size: number;
  readonly data: Float32Array;

  constructor(size: number, background: RGBA = [0, 0, 0, 1]) {
    this.size = size;
    this.data = new Float32Array(size * size * 4);
    for (let i = 0; i < size * size; i++) this.data.set(background, i * 4);
  }

  /** Blend `color` at pixel with coverage `a` (0..1). */
  blend(x: number, y: number, color: RGBA, a: number) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const k = clamp(a * color[3]);
    const i = (y * this.size + x) * 4;
    for (let c = 0; c < 3; c++) this.data[i + c] += (color[c] - this.data[i + c]) * k;
  }

  get(x: number, y: number): RGBA {
    const i = (y * this.size + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Per-pixel painter over a cell; `u`,`v` are 0..1 inside the cell, v down. */
  paint(cell: { x: number; y: number; w: number; h: number }, fn: (u: number, v: number, px: number, py: number) => RGBA) {
    for (let py = cell.y; py < cell.y + cell.h; py++) {
      for (let px = cell.x; px < cell.x + cell.w; px++) {
        const u = (px - cell.x + 0.5) / cell.w;
        const v = (py - cell.y + 0.5) / cell.h;
        const c = fn(u, v, px, py);
        this.blend(px, py, c, 1);
      }
    }
  }

  /** Filled ellipse, optionally rotated, with a soft edge `feather` (px). */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: RGBA, rot = 0, feather = 1) {
    const r = Math.max(rx, ry) + feather + 1;
    const cs = Math.cos(rot);
    const sn = Math.sin(rot);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const lx = dx * cs + dy * sn;
        const ly = -dx * sn + dy * cs;
        const d = Math.hypot(lx / rx, ly / ry);
        // Approximate distance in pixels from the boundary.
        const edge = (d - 1) * Math.min(rx, ry);
        this.blend(x, y, color, 1 - smooth(-feather * 0.5, feather * 0.5, edge));
      }
    }
  }

  /** Polyline stroke whose width tapers from `w0` to `w1` along its length. */
  stroke(points: [number, number][], w0: number, w1: number, color: RGBA, feather = 0.9) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    }
    const total = lengths[lengths.length - 1] || 1;
    const pad = Math.max(w0, w1) + 2;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys) - pad); y <= Math.ceil(Math.max(...ys) + pad); y++) {
      for (let x = Math.floor(Math.min(...xs) - pad); x <= Math.ceil(Math.max(...xs) + pad); x++) {
        let best = Infinity;
        let along = 0;
        for (let i = 1; i < points.length; i++) {
          const [ax, ay] = points[i - 1];
          const [bx, by] = points[i];
          const vx = bx - ax;
          const vy = by - ay;
          const len2 = vx * vx + vy * vy || 1;
          const t = clamp(((x + 0.5 - ax) * vx + (y + 0.5 - ay) * vy) / len2);
          const d = Math.hypot(x + 0.5 - (ax + vx * t), y + 0.5 - (ay + vy * t));
          if (d < best) {
            best = d;
            along = (lengths[i - 1] + Math.sqrt(len2) * t) / total;
          }
        }
        const half = (w0 + (w1 - w0) * along) / 2;
        this.blend(x, y, color, 1 - smooth(half - feather / 2, half + feather / 2, best));
      }
    }
  }

  /** Quadratic Bézier sampled into a polyline stroke. */
  curve(a: [number, number], c: [number, number], b: [number, number], w0: number, w1: number, color: RGBA, steps = 24) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const s = 1 - t;
      pts.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
    }
    this.stroke(pts, w0, w1, color);
  }

  /** Encode as an 8-bit RGB PNG (alpha is not stored). */
  toPNG(): Buffer {
    const s = this.size;
    const pixels = new Uint8Array(s * s * 3);
    for (let i = 0; i < s * s; i++) {
      for (let c = 0; c < 3; c++) pixels[i * 3 + c] = Math.round(clamp(this.data[i * 4 + c]) * 255);
    }
    return encodePng(s, s, pixels);
  }
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, pixels: Uint8Array) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1);
    raw[o] = 1;
    for (let i = 0; i < stride; i++) {
      const cur = pixels[y * stride + i];
      const left = i >= 3 ? pixels[y * stride + i - 3] : 0;
      raw[o + 1 + i] = (cur - left) & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
