/**
 * Minimal GLB reader/writer and inspector.
 *
 * Used to embed generated PNGs after GLTFExporter (which cannot encode images
 * in Node) and to measure exported assets without a browser.
 */
import { createHash } from "node:crypto";

const MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export function readGlb(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.readUInt32LE(0) !== MAGIC) throw new Error("not a GLB file");
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB version ${version}`);
  let offset = 12;
  let json = null;
  let bin = Buffer.alloc(0);
  while (offset < buf.length) {
    const len = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === JSON_CHUNK) json = JSON.parse(data.toString("utf8"));
    else if (type === BIN_CHUNK) bin = Buffer.from(data);
    offset += 8 + len;
  }
  if (!json) throw new Error("GLB has no JSON chunk");
  return { json, bin };
}

const pad4 = (n) => (n + 3) & ~3;

export function writeGlb({ json, bin }) {
  if (json.buffers?.[0]) json.buffers[0].byteLength = bin.length;
  const jsonText = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadded = Buffer.concat([jsonText, Buffer.alloc(pad4(jsonText.length) - jsonText.length, 0x20)]);
  const binPadded = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length, 0)]);
  const total = 12 + 8 + jsonPadded.length + (binPadded.length ? 8 + binPadded.length : 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const parts = [header, jsonHeader, jsonPadded];
  if (binPadded.length) {
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binPadded.length, 0);
    binHeader.writeUInt32LE(BIN_CHUNK, 4);
    parts.push(binHeader, binPadded);
  }
  return Buffer.concat(parts);
}

/** Append a PNG to the binary chunk and bind it as baseColorTexture of `materialName`. */
export function embedTexture(glb, materialName, png) {
  const { json } = glb;
  const material = json.materials?.find((m) => m.name === materialName);
  if (!material) throw new Error(`material ${materialName} not found in GLB`);
  const offset = pad4(glb.bin.length);
  glb.bin = Buffer.concat([glb.bin, Buffer.alloc(offset - glb.bin.length), png]);
  json.bufferViews ??= [];
  json.images ??= [];
  json.samplers ??= [];
  json.textures ??= [];
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: png.length });
  json.images.push({ name: `${materialName}-atlas`, mimeType: "image/png", bufferView: json.bufferViews.length - 1 });
  // LINEAR / LINEAR_MIPMAP_LINEAR, clamped: atlas cells must not wrap.
  json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 });
  json.textures.push({ sampler: json.samplers.length - 1, source: json.images.length - 1 });
  material.pbrMetallicRoughness ??= {};
  material.pbrMetallicRoughness.baseColorTexture = { index: json.textures.length - 1, texCoord: 0 };
  return glb;
}

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Measure an exported GLB: geometry, materials, textures, skins, clips. */
export function inspectGlb(buffer) {
  const { json, bin } = readGlb(buffer);
  const accessors = json.accessors ?? [];
  let triangles = 0;
  let vertices = 0;
  const attributes = new Set();
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const posAcc = accessors[prim.attributes.POSITION];
      vertices += posAcc?.count ?? 0;
      for (const k of Object.keys(prim.attributes)) attributes.add(k);
      const count = prim.indices !== undefined ? accessors[prim.indices].count : posAcc?.count ?? 0;
      if ((prim.mode ?? 4) === 4) triangles += count / 3;
      if (posAcc?.min && posAcc?.max) {
        for (let i = 0; i < 3; i++) {
          bounds.min[i] = Math.min(bounds.min[i], posAcc.min[i]);
          bounds.max[i] = Math.max(bounds.max[i], posAcc.max[i]);
        }
      }
    }
  }
  const textures = (json.images ?? []).map((img) => {
    const view = json.bufferViews[img.bufferView];
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    return { name: img.name, mimeType: img.mimeType, bytes: view.byteLength, ...pngSize(data) };
  });
  const nodeName = (i) => json.nodes?.[i]?.name ?? `#${i}`;
  const animations = (json.animations ?? []).map((anim) => {
    let duration = 0;
    for (const s of anim.samplers) duration = Math.max(duration, accessors[s.input]?.max?.[0] ?? 0);
    return {
      name: anim.name,
      duration: Number(duration.toFixed(4)),
      channels: anim.channels.length,
      targets: [...new Set(anim.channels.map((c) => `${nodeName(c.target.node)}.${c.target.path}`))],
    };
  });
  const skins = (json.skins ?? []).map((s) => ({ joints: s.joints.map(nodeName) }));
  return {
    bytes: buffer.length,
    sha256: createHash("sha256").update(Buffer.from(buffer)).digest("hex"),
    triangles: Math.round(triangles),
    vertices,
    meshes: json.meshes?.length ?? 0,
    primitives: (json.meshes ?? []).reduce((n, m) => n + m.primitives.length, 0),
    materials: (json.materials ?? []).map((m) => m.name),
    attributes: [...attributes].sort(),
    textures,
    skins,
    nodes: (json.nodes ?? []).map((n) => n.name ?? null),
    animations,
    bounds: {
      min: bounds.min.map((v) => Number(v.toFixed(4))),
      max: bounds.max.map((v) => Number(v.toFixed(4))),
    },
    json,
    bin,
  };
}
