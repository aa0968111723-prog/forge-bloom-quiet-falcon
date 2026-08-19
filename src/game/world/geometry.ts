import * as THREE from "three";

/**
 * Geometry builders that bake *world-scale* UVs.
 *
 * Every Tamkang material declares how many metres one texture repeat covers, so
 * geometry is responsible for producing UVs in those units. Doing it here means
 * a single shared texture object per material (no per-mesh clones, no duplicated
 * VRAM) and a paving slab that is the same size whether it is 6 m of avenue or
 * 48 m of plaza.
 */

/** Box with per-face UVs scaled so one repeat covers `tile` metres. */
export function worldUvBox(width: number, height: number, depth: number, tile: number) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z; 4 vertices each.
  const spans: [number, number][] = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = spans[face];
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, uv.getX(i) * (su / tile), uv.getY(i) * (sv / tile));
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Cylinder with UVs scaled to metres around the circumference and up the side. */
export function worldUvCylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments: number,
  tile: number,
) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const circumference = Math.PI * (radiusTop + radiusBottom);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (circumference / tile), uv.getY(i) * (height / tile));
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Hip roof (歇山/廡殿 simplified): rectangular eave outline with overhang, four
 * slopes rising to a ridge along the long (Z) axis. Slight eave up-kick baked
 * in by lifting the outline corners, which is what makes a Chinese glazed roof
 * read as such at a distance. UVs run in metres up the slope.
 */
export function hipRoofGeometry(
  width: number,
  depth: number,
  overhang: number,
  rise: number,
  tile: number,
  kick = 0.35,
) {
  // Long axis along Z: ridge is a segment in Z, hips at both ends.
  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;
  const ridgeHalf = Math.max(0.5, depth / 2 - width * 0.45);
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  // eave corners (lifted by kick), eave edge midpoints (at 0)
  const eave: [number, number, number][] = [
    [-hw, kick, -hd],
    [hw, kick, -hd],
    [hw, kick, hd],
    [-hw, kick, hd],
    [-hw, 0, 0],
    [hw, 0, 0],
  ];
  const ridge: [number, number, number][] = [
    [0, rise, -ridgeHalf],
    [0, rise, ridgeHalf],
  ];
  const all = [...eave, ...ridge];
  for (const [x, y, z] of all) {
    positions.push(x, y, z);
    uvs.push((x + z) / tile, y / tile + Math.hypot(x, z) / tile);
  }
  const [c0, c1, c2, c3, mL, mR, r0, r1] = [0, 1, 2, 3, 4, 5, 6, 7];
  // west slope (two triangles through the eave midpoint for the kick)
  index.push(c0, mL, r0, mL, c3, r1, mL, r1, r0);
  // east slope
  index.push(c1, r0, mR, mR, r0, r1, mR, r1, c2);
  // north hip (low-Z end)
  index.push(c0, r0, c1);
  // south hip (high-Z end)
  index.push(c3, c2, r1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

export type HeightSampler = (x: number, z: number) => number;

/**
 * Terrain surface from explicit, possibly non-uniform coordinate lists.
 *
 * A single crack-free mesh: dense rows through the reality corridor and coarse
 * ones out at the silhouette, rather than two meshes that disagree at a seam.
 */
export function gridSurfaceGeometry(
  xs: number[],
  zs: number[],
  sampleY: HeightSampler,
  tile: number,
) {
  const nx = xs.length;
  const nz = zs.length;
  const positions = new Float32Array(nx * nz * 3);
  const uvs = new Float32Array(nx * nz * 2);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = xs[i];
      const z = zs[j];
      positions[k * 3] = x;
      positions[k * 3 + 1] = sampleY(x, z);
      positions[k * 3 + 2] = z;
      uvs[k * 2] = x / tile;
      uvs[k * 2 + 1] = z / tile;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Ribbon that follows the ground along a polyline — used for every path, road
 * and kerb, so paving stays glued to the terrain up a slope instead of being a
 * flat box that submarines into the hill.
 */
export function ribbonGeometry(
  points: readonly (readonly [number, number])[],
  width: number,
  sampleY: HeightSampler,
  lift: number,
  tile: number,
  step = 2.5,
) {
  const centres: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1];
    const [bx, bz] = points[i];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      centres.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  centres.push([points[points.length - 1][0], points[points.length - 1][1]]);

  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  let run = 0;
  for (let i = 0; i < centres.length; i++) {
    const [cx, cz] = centres[i];
    const prev = centres[Math.max(0, i - 1)];
    const next = centres[Math.min(centres.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let tz = next[1] - prev[1];
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz;
    const nz = tx;
    if (i > 0) run += Math.hypot(cx - prev[0], cz - prev[1]);
    for (const side of [-1, 1] as const) {
      const px = cx + nx * (width / 2) * side;
      const pz = cz + nz * (width / 2) * side;
      positions.push(px, sampleY(px, pz) + lift, pz);
      uvs.push(((side + 1) / 2) * (width / tile), run / tile);
    }
    if (i > 0) {
      // Wind so the face normal points up (+Y): L_prev, R_prev, L_cur / ...
      const a = (i - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Terrain-following rectangle, subdivided so it bends with the ground. */
export function groundRectGeometry(
  cx: number,
  cz: number,
  width: number,
  depth: number,
  sampleY: HeightSampler,
  lift: number,
  tile: number,
  step = 3,
) {
  const nx = Math.max(2, Math.ceil(width / step) + 1);
  const nz = Math.max(2, Math.ceil(depth / step) + 1);
  const xs = Array.from({ length: nx }, (_, i) => cx - width / 2 + (width * i) / (nx - 1));
  const zs = Array.from({ length: nz }, (_, j) => cz - depth / 2 + (depth * j) / (nz - 1));
  const geo = gridSurfaceGeometry(xs, zs, (x, z) => sampleY(x, z) + lift, tile);
  return geo;
}

/** Terrain-following disc, for the plaza and roundabout. */
export function groundDiscGeometry(
  cx: number,
  cz: number,
  radius: number,
  sampleY: HeightSampler,
  lift: number,
  tile: number,
  rings = 5,
  segments = 48,
) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  positions.push(cx, sampleY(cx, cz) + lift, cz);
  uvs.push(cx / tile, cz / tile);
  for (let r = 1; r <= rings; r++) {
    const rad = (radius * r) / rings;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = cx + Math.sin(a) * rad;
      const z = cz + Math.cos(a) * rad;
      positions.push(x, sampleY(x, z) + lift, z);
      uvs.push(x / tile, z / tile);
    }
  }
  const ringStart = (r: number) => 1 + (r - 1) * segments;
  for (let s = 0; s < segments; s++) {
    index.push(0, ringStart(1) + ((s + 1) % segments), ringStart(1) + s);
  }
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      const a = ringStart(r) + s;
      const b = ringStart(r) + ((s + 1) % segments);
      const c = ringStart(r + 1) + s;
      const d = ringStart(r + 1) + ((s + 1) % segments);
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Dispose every geometry in a list; for useMemo cleanup. */
export function disposeAll(geos: (THREE.BufferGeometry | null | undefined)[]) {
  for (const g of geos) g?.dispose();
}
