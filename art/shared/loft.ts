/**
 * Lofted surfaces: rings of cross-sections joined into a skin.
 *
 * Bodies, sleeves, shorts and shoes are lofts; hair clumps and straps are
 * sweeps of a lens-shaped profile along a curve. Both return indexed
 * geometry with smooth normals plus a per-vertex parameter `t` (0 at the first
 * ring, 1 at the last) that skinning and colour ramps key off.
 */
import * as THREE from "three";
import type { V3 } from "./builder.ts";

export type Ring = {
  center: V3;
  /** In-plane axes of the cross-section; `ay` is the "front" direction. */
  ax: V3;
  ay: V3;
  rx: number;
  ry: number;
  /** Radius multiplier by angle, for flattened or squared sections. */
  shape?: (theta: number) => number;
  /** Small offset of the section along `ay`, e.g. a belly or calf bulge. */
  bulge?: (theta: number) => number;
  /** Per-ring angular range; lets a jacket opening widen toward the hem. */
  arc?: [number, number];
};

export type LoftOptions = {
  segments?: number;
  /** Angular range [from, to] in radians; omit for a closed tube. */
  arc?: [number, number];
  /** Shell thickness for open garments; adds an inner wall and edge strips. */
  thickness?: number;
  capStart?: boolean;
  capEnd?: boolean;
};

export type Lofted = { geometry: THREE.BufferGeometry; param: Float32Array };

const v = (a: V3) => new THREE.Vector3(...a);

function ringPoint(ring: Ring, theta: number, inset = 0) {
  const s = ring.shape ? ring.shape(theta) : 1;
  const b = ring.bulge ? ring.bulge(theta) : 0;
  const rx = Math.max(0.0005, ring.rx * s - inset);
  const ry = Math.max(0.0005, ring.ry * s - inset);
  return v(ring.center)
    .addScaledVector(v(ring.ax), Math.cos(theta) * rx)
    .addScaledVector(v(ring.ay), Math.sin(theta) * ry + b);
}

/**
 * Join `rings` into a surface. With `arc` + `thickness` the result is a
 * garment panel with real cloth thickness on every open edge.
 */
export function loft(rings: Ring[], opts: LoftOptions = {}): Lofted {
  const segs = opts.segments ?? 16;
  const closed = !opts.arc;
  const [a0, a1] = opts.arc ?? [0, Math.PI * 2];
  const cols = segs + 1;
  const lengths = cumulative(rings.map((r) => v(r.center)));
  const total = lengths[lengths.length - 1] || 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const params: number[] = [];
  const shells: number[] = [];
  const indices: number[] = [];

  const sheet = (inset: number, flip: boolean) => {
    const base = positions.length / 3;
    rings.forEach((ring, r) => {
      const [r0, r1] = ring.arc ?? [a0, a1];
      for (let c = 0; c < cols; c++) {
        const theta = r0 + ((r1 - r0) * c) / segs;
        const p = ringPoint(ring, theta, inset);
        positions.push(p.x, p.y, p.z);
        uvs.push(c / segs, lengths[r] / total);
        params.push(lengths[r] / total);
        shells.push(inset > 0 ? 1 : 0);
      }
    });
    for (let r = 0; r < rings.length - 1; r++) {
      for (let c = 0; c < segs; c++) {
        const i = base + r * cols + c;
        const j = i + cols;
        if (flip) indices.push(i, i + 1, j, i + 1, j + 1, j);
        else indices.push(i, j, i + 1, i + 1, j, j + 1);
      }
    }
    return base;
  };

  const outer = sheet(0, false);
  const orient = needsFlip(positions, indices, rings, outer);
  if (orient) flipRange(indices, 0, indices.length);
  let innerBase = -1;

  if (opts.thickness && opts.thickness > 0) {
    const innerStart = indices.length;
    const inner = sheet(opts.thickness, true);
    innerBase = inner;
    if (orient) flipRange(indices, innerStart, indices.length);
    const edgeQuads: [number, number, number, number][] = [];
    // Hem and top edges.
    for (const r of [0, rings.length - 1]) {
      for (let c = 0; c < segs; c++) {
        edgeQuads.push([outer + r * cols + c, outer + r * cols + c + 1, inner + r * cols + c, inner + r * cols + c + 1]);
      }
    }
    // Front opening edges.
    if (!closed) {
      for (const c of [0, segs]) {
        for (let r = 0; r < rings.length - 1; r++) {
          edgeQuads.push([outer + r * cols + c, outer + (r + 1) * cols + c, inner + r * cols + c, inner + (r + 1) * cols + c]);
        }
      }
    }
    for (const [o0, o1, i0, i1] of edgeQuads) {
      const base = positions.length / 3;
      for (const idx of [o0, o1, i0, i1]) {
        // Duplicated vertices give the cloth edge its own crisp normal.
        positions.push(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);
        uvs.push(uvs[idx * 2], uvs[idx * 2 + 1]);
        params.push(params[idx]);
        shells.push(0.5);
      }
      // Both windings: the strip is only a few millimetres wide and must read
      // from inside and outside the garment.
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  if (opts.capStart) cap(rings[0], a0, a1, segs, positions, uvs, params, indices, 0, !orient);
  if (opts.capEnd) cap(rings[rings.length - 1], a0, a1, segs, positions, uvs, params, indices, 1, orient);
  while (shells.length < params.length) shells.push(0);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  // Carried as attributes so they survive de-indexing in PartBuilder.
  geometry.setAttribute("param", new THREE.Float32BufferAttribute(params, 1));
  geometry.setAttribute("shell", new THREE.Float32BufferAttribute(shells, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if (closed) {
    weldSeamNormals(geometry, rings.length, cols, outer);
    if (innerBase >= 0) weldSeamNormals(geometry, rings.length, cols, innerBase);
  }
  return { geometry, param: new Float32Array(params) };
}

function cap(
  ring: Ring,
  a0: number,
  a1: number,
  segs: number,
  positions: number[],
  uvs: number[],
  params: number[],
  indices: number[],
  t: number,
  flip: boolean,
) {
  const center = positions.length / 3;
  const c = v(ring.center);
  positions.push(c.x, c.y, c.z);
  uvs.push(0.5, 0.5);
  params.push(t);
  for (let i = 0; i <= segs; i++) {
    const theta = a0 + ((a1 - a0) * i) / segs;
    const p = ringPoint(ring, theta);
    positions.push(p.x, p.y, p.z);
    uvs.push(0.5 + Math.cos(theta) * 0.5, 0.5 + Math.sin(theta) * 0.5);
    params.push(t);
  }
  for (let i = 0; i < segs; i++) {
    if (flip) indices.push(center, center + 1 + i + 1, center + 1 + i);
    else indices.push(center, center + 1 + i, center + 1 + i + 1);
  }
}

function needsFlip(positions: number[], indices: number[], rings: Ring[], base: number) {
  // Compare the first face normal with the outward radial direction.
  const at = (i: number) => new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  const [i0, i1, i2] = [indices[0], indices[1], indices[2]];
  const a = at(i0);
  const n = new THREE.Vector3().subVectors(at(i1), a).cross(new THREE.Vector3().subVectors(at(i2), a));
  const radial = a.clone().sub(v(rings[0].center));
  void base;
  return n.dot(radial) < 0;
}

function flipRange(indices: number[], from: number, to: number) {
  for (let i = from; i < to; i += 3) {
    const tmp = indices[i + 1];
    indices[i + 1] = indices[i + 2];
    indices[i + 2] = tmp;
  }
}

function weldSeamNormals(g: THREE.BufferGeometry, rows: number, cols: number, base: number) {
  const n = g.attributes.normal as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let r = 0; r < rows; r++) {
    const first = base + r * cols;
    const last = first + cols - 1;
    a.fromBufferAttribute(n, first);
    b.fromBufferAttribute(n, last);
    a.add(b).normalize();
    n.setXYZ(first, a.x, a.y, a.z);
    n.setXYZ(last, a.x, a.y, a.z);
  }
  n.needsUpdate = true;
}

function cumulative(points: THREE.Vector3[]) {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + points[i].distanceTo(points[i - 1]));
  return out;
}

/** Horizontal ring frame (cross-section in the XZ plane), front = +Z. */
export function hring(center: V3, rx: number, rz: number, extra: Partial<Ring> = {}): Ring {
  return { center, ax: [1, 0, 0], ay: [0, 0, 1], rx, ry: rz, ...extra };
}

/** Ring perpendicular to a limb direction, with `front` kept as the second axis. */
export function limbRing(center: V3, dir: V3, front: V3, rx: number, ry: number, extra: Partial<Ring> = {}): Ring {
  const d = v(dir).normalize();
  const f = v(front).sub(d.clone().multiplyScalar(v(front).dot(d))).normalize();
  const side = new THREE.Vector3().crossVectors(f, d).normalize();
  return { center, ax: side.toArray() as V3, ay: f.toArray() as V3, rx, ry, ...extra };
}

export type SweepOptions = {
  /** Half width (across the clump) and half thickness along t. */
  width: (t: number) => number;
  thickness: (t: number) => number;
  /** Direction the flat face should point (e.g. away from the scalp). */
  outward: V3 | ((t: number) => THREE.Vector3);
  segments?: number;
  around?: number;
};

/**
 * Sweep a lens-shaped section along a Catmull-Rom curve. Used for hair
 * clumps, cords and straps; the tip collapses to a point when width → 0.
 */
export function sweep(points: V3[], opts: SweepOptions): Lofted {
  const curve = new THREE.CatmullRomCurve3(points.map(v), false, "centripetal");
  const segs = opts.segments ?? 10;
  const around = opts.around ?? 8;
  const rings: Ring[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const out = typeof opts.outward === "function" ? opts.outward(t) : v(opts.outward);
    const side = new THREE.Vector3().crossVectors(tan, out).normalize();
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const normal = new THREE.Vector3().crossVectors(side, tan).normalize();
    rings.push({
      center: c.toArray() as V3,
      ax: side.toArray() as V3,
      ay: normal.toArray() as V3,
      rx: Math.max(0.0004, opts.width(t)),
      ry: Math.max(0.0003, opts.thickness(t)),
    });
  }
  return loft(rings, { segments: around });
}

/** Sample a closed lathe-like dome (half ellipsoid) facing +Y. */
export function dome(rx: number, ry: number, rz: number, rows = 8, segs = 16, from = 0, to = Math.PI / 2): Lofted {
  const rings: Ring[] = [];
  for (let i = 0; i <= rows; i++) {
    const a = from + ((to - from) * i) / rows;
    const s = Math.max(0.0005, Math.cos(a));
    rings.push(hring([0, Math.sin(a) * ry, 0], rx * s, rz * s));
  }
  return loft(rings, { segments: segs });
}
