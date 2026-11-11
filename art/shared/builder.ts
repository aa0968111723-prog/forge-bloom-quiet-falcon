/**
 * Part assembler for code-authored models.
 *
 * Every part is generated in bind space, tagged with an atlas tile, a vertex
 * colour (or colour function) and skin weights, then merged into one
 * non-indexed buffer. One merged skinned mesh with one material is one draw
 * call, which is what lets a fully dressed character stay cheap.
 *
 * This module runs in Node at export time and is never shipped to players.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type V3 = [number, number, number];
export type BoneWeights = [number, number][];
/** Up to four [boneIndex, weight] pairs for a vertex at `p` with part parameter `t`. */
export type SkinFn = (p: THREE.Vector3, t: number) => BoneWeights;
/** `shell` is 0 on a garment's outer face, 1 on its inner face, 0.5 on cut edges. */
export type ColorFn = (p: THREE.Vector3, t: number, u: number, shell: number) => THREE.Color;

/** Pixel rectangle of one atlas cell, in a square atlas of `size` pixels. */
export type AtlasRect = { x: number; y: number; w: number; h: number };

export type PartOptions = {
  /** Debug/inspection name; becomes part of the part list in the manifest. */
  name: string;
  color: string | ColorFn;
  tile: AtlasRect;
  skin: number | SkinFn;
  /**
   * Unused: lofts carry their parameter as a `param` geometry attribute so it
   * survives de-indexing. Kept so call sites can document intent.
   */
  param?: ArrayLike<number>;
  /** Keep the geometry's own UVs inside the tile (default) or tile them `repeat` times. */
  uvRepeat?: [number, number];
  /**
   * Runtime tint slot (1–15) stored in the vertex colour's alpha; 255 (the
   * default) means "keep as authored". Kits with presets recolour by slot.
   */
  slot?: number;
};

const ATLAS_PAD = 3;

export class PartBuilder {
  readonly atlasSize: number;
  /** Tint slot used when a part does not name one (255 = keep as authored). */
  slot = 255;
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private colors: number[] = [];
  private skinIndex: number[] = [];
  private skinWeight: number[] = [];
  private slots: number[] = [];
  readonly parts: { name: string; triangles: number }[] = [];

  constructor(atlasSize: number) {
    this.atlasSize = atlasSize;
  }

  /** Add a geometry. The geometry is consumed (disposed) by this call. */
  add(source: THREE.BufferGeometry, opts: PartOptions) {
    const g = source.index ? source.toNonIndexed() : source;
    if (g !== source) source.dispose();
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const param = g.attributes.param;
    const shell = g.attributes.shell;
    const p = new THREE.Vector3();
    const [ru, rv] = opts.uvRepeat ?? [1, 1];
    const s = this.atlasSize;
    const u0 = (opts.tile.x + ATLAS_PAD) / s;
    const v0 = (opts.tile.y + ATLAS_PAD) / s;
    const uw = (opts.tile.w - ATLAS_PAD * 2) / s;
    const vh = (opts.tile.h - ATLAS_PAD * 2) / s;
    const fixed = typeof opts.color === "string" ? new THREE.Color(opts.color) : null;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const t = param ? param.getX(i) : 0;
      const s = shell ? shell.getX(i) : 0;
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      let u = uv ? uv.getX(i) : 0.5;
      let v = uv ? uv.getY(i) : 0.5;
      if (ru !== 1 || rv !== 1) {
        u = fract(u * ru);
        v = fract(v * rv);
      }
      // glTF UV (0,0) is the image's top-left and GLTFLoader keeps flipY off,
      // so a part's local v (0 = bottom of the part) maps to the cell bottom.
      this.uvs.push(u0 + clamp01(u) * uw, v0 + (1 - clamp01(v)) * vh);
      const c = fixed ?? (opts.color as ColorFn)(p, t, u, s);
      this.colors.push(c.r, c.g, c.b);
      this.slots.push(opts.slot ?? this.slot);
      const weights = typeof opts.skin === "number" ? [[opts.skin, 1] as [number, number]] : opts.skin(p, t);
      writeSkin(weights, this.skinIndex, this.skinWeight);
    }
    this.parts.push({ name: opts.name, triangles: pos.count / 3 });
    g.dispose();
    return this;
  }

  get triangleCount() {
    return this.positions.length / 9;
  }

  /**
   * Merge everything added so far into one indexed, skinned, vertex-coloured
   * geometry. Vertices shared by neighbouring triangles are welded back
   * together, then colour, UV and skin data are quantised to the compact
   * glTF core formats (RGBA8, UNORM16, UINT8 joints, UNORM8 weights).
   */
  build(): THREE.BufferGeometry {
    const raw = new THREE.BufferGeometry();
    raw.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    raw.setAttribute("normal", new THREE.Float32BufferAttribute(this.normals, 3));
    raw.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    raw.setAttribute("color", new THREE.Float32BufferAttribute(this.colors, 3));
    raw.setAttribute("skinIndex", new THREE.Float32BufferAttribute(this.skinIndex, 4));
    raw.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.skinWeight, 4));
    raw.setAttribute("slot", new THREE.Float32BufferAttribute(this.slots, 1));
    const g = mergeVertices(raw, 1e-6);
    raw.dispose();
    const n = g.attributes.position.count;

    const color = new Uint8Array(n * 4);
    const uv = new Uint16Array(n * 2);
    const joints = new Uint8Array(n * 4);
    const weights = new Uint8Array(n * 4);
    const c = g.attributes.color;
    const t = g.attributes.uv;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    const slot = g.attributes.slot;
    for (let i = 0; i < n; i++) {
      // Vertex colours are linear; 8 bits is ample for the soft occlusion they carry.
      color[i * 4] = Math.round(clamp01(c.getX(i)) * 255);
      color[i * 4 + 1] = Math.round(clamp01(c.getY(i)) * 255);
      color[i * 4 + 2] = Math.round(clamp01(c.getZ(i)) * 255);
      color[i * 4 + 3] = Math.round(slot.getX(i));
      uv[i * 2] = Math.round(clamp01(t.getX(i)) * 65535);
      uv[i * 2 + 1] = Math.round(clamp01(t.getY(i)) * 65535);
      const w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)].map((x) => Math.round(x * 255));
      // Weights must still sum to exactly 1 after rounding.
      const drift = 255 - w.reduce((a, b) => a + b, 0);
      let top = 0;
      for (let k = 1; k < 4; k++) if (w[k] > w[top]) top = k;
      w[top] += drift;
      const j = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
      for (let k = 0; k < 4; k++) {
        joints[i * 4 + k] = w[k] > 0 ? j[k] : 0;
        weights[i * 4 + k] = w[k];
      }
    }
    g.setAttribute("color", new THREE.BufferAttribute(color, 4, true));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2, true));
    g.setAttribute("skinIndex", new THREE.BufferAttribute(joints, 4));
    g.setAttribute("skinWeight", new THREE.BufferAttribute(weights, 4, true));
    g.deleteAttribute("slot");
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

function writeSkin(weights: BoneWeights, idx: number[], wts: number[]) {
  const top = weights
    .filter(([, w]) => w > 1e-4)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const sum = top.reduce((acc, [, w]) => acc + w, 0) || 1;
  for (let k = 0; k < 4; k++) {
    idx.push(top[k] ? top[k][0] : 0);
    wts.push(top[k] ? top[k][1] / sum : 0);
  }
}

export function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}
function fract(v: number) {
  return v - Math.floor(v);
}
export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Two-bone blend across a joint at parameter `at`, softened over `width`.
 * Below the joint the vertex belongs to `a`, above it to `b`.
 */
export function jointBlend(a: number, b: number, at: number, width: number): SkinFn {
  return (_p, t) => {
    const w = smoothstep(at - width, at + width, t);
    return [
      [a, 1 - w],
      [b, w],
    ];
  };
}

/** Three-bone chain blend (e.g. hip → knee → ankle) along a part parameter. */
export function chainBlend(bones: number[], joints: number[], width: number): SkinFn {
  return (_p, t) => {
    const out: BoneWeights = [];
    let remaining = 1;
    for (let i = 0; i < bones.length; i++) {
      const next = joints[i];
      const share = next === undefined ? remaining : remaining * (1 - smoothstep(next - width, next + width, t));
      out.push([bones[i], share]);
      remaining -= share;
    }
    return out;
  };
}

/** Linear colour ramp along the part parameter. */
export function ramp(from: string, to: string, curve = 1): ColorFn {
  const a = new THREE.Color(from);
  const b = new THREE.Color(to);
  const out = new THREE.Color();
  return (_p, t) => out.copy(a).lerp(b, Math.pow(clamp01(t), curve)).clone();
}

/** Darken vertices below a world height, a cheap baked contact occlusion. */
export function occlude(base: string, belowY: number, fade: number, strength: number): ColorFn {
  const c = new THREE.Color(base);
  return (p) => {
    const k = 1 - strength * (1 - smoothstep(belowY - fade, belowY, p.y));
    return c.clone().multiplyScalar(k);
  };
}
