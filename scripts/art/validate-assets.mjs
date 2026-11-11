#!/usr/bin/env node
/**
 * Validate the art pipeline end to end.
 *
 *   npm run art:validate              # registry, outputs, GLB structure, budgets, references
 *   npm run art:validate -- --rebuild # also re-export in memory and require identical bytes
 *
 * Errors fail the run; warnings are printed. Checks:
 *   - art/assets.json: required fields, unique ids, known category/status
 *   - source entry and files exist
 *   - output exists, matches public/game-art/manifest.json and the runtime table
 *   - GLB: every accessor/bufferView/material/node/skin/sampler reference resolves,
 *     animation channels target nodes in the asset, skinned clips drive joints,
 *     quaternion keys are unit length, declared clips exist
 *   - budgets: triangles, bytes, texture count and size
 *   - runtime: listed usage files exist and mention the id; every id used in src/
 *     exists; files in public/game-art/ that nothing lists are unused
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectGlb } from "./lib/glb.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REQUIRED = ["id", "name", "category", "version", "source", "license", "output", "units", "pivot", "forward", "budget", "runtime", "status"];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const COMPONENTS = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const n = TYPES[acc.type];
  const size = COMPONENTS[acc.componentType];
  const stride = view.byteStride ?? n * size;
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const row = [];
    for (let k = 0; k < n; k++) {
      const o = base + i * stride + k * size;
      row.push(acc.componentType === 5126 ? bin.readFloatLE(o) : acc.componentType === 5123 ? bin.readUInt16LE(o) : bin.readUInt8(o));
    }
    out.push(row);
  }
  return out;
}

/** Structural GLB checks; returns error strings. */
export function checkGlb(info, record) {
  const errors = [];
  const { json, bin } = info;
  const count = (k) => (json[k] ?? []).length;
  const ref = (what, i, k) => {
    if (i === undefined) return;
    if (!Number.isInteger(i) || i < 0 || i >= count(k)) errors.push(`${what} → ${k}[${i}] does not exist`);
  };
  (json.accessors ?? []).forEach((a, i) => {
    ref(`accessor ${i}`, a.bufferView, "bufferViews");
    const view = json.bufferViews?.[a.bufferView];
    if (view) {
      const end = (view.byteOffset ?? 0) + view.byteLength;
      if (end > bin.length) errors.push(`bufferView ${a.bufferView} runs past the binary chunk`);
    }
  });
  (json.meshes ?? []).forEach((m, mi) =>
    m.primitives.forEach((p, pi) => {
      for (const [k, v] of Object.entries(p.attributes)) ref(`mesh ${mi}/${pi} ${k}`, v, "accessors");
      ref(`mesh ${mi}/${pi} indices`, p.indices, "accessors");
      ref(`mesh ${mi}/${pi} material`, p.material, "materials");
    }),
  );
  (json.nodes ?? []).forEach((n, i) => {
    ref(`node ${i} mesh`, n.mesh, "meshes");
    ref(`node ${i} skin`, n.skin, "skins");
    for (const c of n.children ?? []) ref(`node ${i} child`, c, "nodes");
  });
  (json.skins ?? []).forEach((s, i) => {
    for (const j of s.joints) ref(`skin ${i} joint`, j, "nodes");
    ref(`skin ${i} inverseBindMatrices`, s.inverseBindMatrices, "accessors");
  });
  (json.textures ?? []).forEach((t, i) => {
    ref(`texture ${i} source`, t.source, "images");
    ref(`texture ${i} sampler`, t.sampler, "samplers");
  });
  (json.materials ?? []).forEach((m, i) => ref(`material ${i} baseColorTexture`, m.pbrMetallicRoughness?.baseColorTexture?.index, "textures"));

  const joints = new Set((json.skins ?? []).flatMap((s) => s.joints));
  const clipNames = new Set();
  for (const anim of json.animations ?? []) {
    clipNames.add(anim.name);
    anim.channels.forEach((c, ci) => {
      ref(`animation ${anim.name} channel ${ci} node`, c.target.node, "nodes");
      if (c.sampler < 0 || c.sampler >= anim.samplers.length) errors.push(`animation ${anim.name} channel ${ci} sampler missing`);
      if (record.skinned && !joints.has(c.target.node)) {
        errors.push(`animation ${anim.name} drives ${json.nodes[c.target.node]?.name}, which is not a skin joint`);
      }
      if (c.target.path === "rotation") {
        const s = anim.samplers[c.sampler];
        for (const q of readAccessor(json, bin, s.output)) {
          const len = Math.hypot(...q);
          if (Math.abs(len - 1) > 1e-3) {
            errors.push(`animation ${anim.name} ${json.nodes[c.target.node]?.name} has a non-unit quaternion (${len.toFixed(4)})`);
            break;
          }
        }
      }
    });
  }
  for (const name of record.animations ?? []) if (!clipNames.has(name)) errors.push(`declared clip "${name}" missing from GLB`);
  return errors;
}

export function validate({ rebuild = false } = {}) {
  const errors = [];
  const warnings = [];
  const rows = [];
  const registryPath = join(ROOT, "art/assets.json");
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const manifestPath = join(ROOT, "public/game-art/manifest.json");
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { assets: [] };
  if (!existsSync(manifestPath)) errors.push("public/game-art/manifest.json is missing; run npm run art:export");
  const runtimeTable = existsSync(join(ROOT, "src/game/art/art-manifest.gen.ts"))
    ? readFileSync(join(ROOT, "src/game/art/art-manifest.gen.ts"), "utf8")
    : "";

  const seen = new Set();
  for (const a of registry.assets) {
    const tag = a.id ?? "(no id)";
    for (const k of REQUIRED) if (a[k] === undefined || a[k] === "") errors.push(`${tag}: missing field ${k}`);
    if (seen.has(a.id)) errors.push(`${tag}: duplicate id`);
    seen.add(a.id);
    if (!registry.categories.includes(a.category)) errors.push(`${tag}: unknown category ${a.category}`);
    if (!registry.statuses.includes(a.status)) errors.push(`${tag}: unknown status ${a.status}`);
    for (const f of [a.source?.entry, ...(a.source?.files ?? [])].filter(Boolean)) {
      if (!existsSync(join(ROOT, f))) errors.push(`${tag}: source file ${f} is missing`);
    }
    const out = join(ROOT, a.output);
    if (!existsSync(out)) {
      errors.push(`${tag}: output ${a.output} is missing`);
      continue;
    }
    const bytes = readFileSync(out);
    let info;
    try {
      info = inspectGlb(bytes);
    } catch (e) {
      errors.push(`${tag}: output is not a valid GLB (${e.message})`);
      continue;
    }
    for (const e of checkGlb(info, a)) errors.push(`${tag}: ${e}`);
    const entry = manifest.assets.find((m) => m.id === a.id);
    if (!entry) errors.push(`${tag}: not in public/game-art/manifest.json`);
    else if (entry.metrics?.sha256 !== info.sha256) errors.push(`${tag}: manifest is stale (sha mismatch); run npm run art:export`);
    if (!runtimeTable.includes(JSON.stringify(a.id)) || !runtimeTable.includes(info.sha256)) {
      errors.push(`${tag}: src/game/art/art-manifest.gen.ts is stale; run npm run art:export`);
    }
    const b = a.budget ?? {};
    if (b.triangles && info.triangles > b.triangles) errors.push(`${tag}: ${info.triangles} triangles over budget ${b.triangles}`);
    if (b.bytes && info.bytes > b.bytes) errors.push(`${tag}: ${info.bytes} bytes over budget ${b.bytes}`);
    if (b.textures !== undefined && info.textures.length > b.textures) errors.push(`${tag}: ${info.textures.length} textures over budget ${b.textures}`);
    for (const t of info.textures) {
      if (b.textureSize && (t.width > b.textureSize || t.height > b.textureSize)) {
        errors.push(`${tag}: texture ${t.name} ${t.width}×${t.height} over ${b.textureSize}`);
      }
    }
    for (const f of a.runtime ?? []) {
      const p = join(ROOT, f);
      if (!existsSync(p)) errors.push(`${tag}: runtime file ${f} is missing`);
      else if (!readFileSync(p, "utf8").includes(a.id)) errors.push(`${tag}: runtime file ${f} never mentions ${a.id}`);
    }
    if (!(a.runtime ?? []).length) {
      (a.status === "integrated" ? errors : warnings).push(`${tag}: no runtime usage listed (unused asset)`);
    }
    rows.push({
      id: a.id,
      status: a.status,
      triangles: `${info.triangles}/${b.triangles ?? "-"}`,
      bytes: `${(info.bytes / 1024).toFixed(0)}KiB/${b.bytes ? (b.bytes / 1024).toFixed(0) : "-"}KiB`,
      clips: info.animations.length,
      textures: info.textures.map((t) => `${t.width}×${t.height}`).join(",") || "-",
    });
  }

  // Ids referenced from game code must exist; every id must be referenced by game code.
  const used = new Set();
  const sources = walk(join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith("art-manifest.gen.ts"));
  for (const file of sources) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:useArtModel|preloadArt|artUrl)\(\s*"([^"]+)"/g)) {
      used.add(m[1]);
      if (!seen.has(m[1])) errors.push(`${relative(ROOT, file)}: references unknown art id ${m[1]}`);
    }
    // Ids chosen through a lookup table (e.g. per quality tier) count as used.
    for (const id of seen) if (text.includes(JSON.stringify(id))) used.add(id);
  }
  for (const id of seen) {
    if (!used.has(id)) warnings.push(`${id}: nothing in src/ references it`);
  }

  // Files in the output folder that no record owns.
  const owned = new Set(registry.assets.map((a) => resolve(ROOT, a.output)));
  owned.add(manifestPath);
  for (const f of walk(join(ROOT, "public/game-art"))) {
    if (!owned.has(resolve(f))) errors.push(`${relative(ROOT, f)}: unused file (no asset record owns it)`);
  }
  for (const m of manifest.assets) if (!seen.has(m.id)) errors.push(`${m.id}: in manifest but not in art/assets.json`);

  return { errors, warnings, rows, rebuild };
}

async function rebuildCheck(result) {
  const { exportAsset } = await import("./export-assets.mjs");
  const registry = JSON.parse(readFileSync(join(ROOT, "art/assets.json"), "utf8"));
  const { ART_BUILDERS } = await import(join(ROOT, "art/index.ts"));
  const { createHash } = await import("node:crypto");
  for (const a of registry.assets) {
    const { bytes } = await exportAsset(a, ART_BUILDERS);
    const fresh = createHash("sha256").update(bytes).digest("hex");
    const committed = existsSync(join(ROOT, a.output))
      ? createHash("sha256").update(readFileSync(join(ROOT, a.output))).digest("hex")
      : null;
    if (fresh !== committed) result.errors.push(`${a.id}: a fresh export differs from ${a.output}; source and output are out of sync`);
  }
}

async function main() {
  const rebuild = process.argv.includes("--rebuild");
  const result = validate({ rebuild });
  if (rebuild) await rebuildCheck(result);
  console.table(result.rows);
  for (const w of result.warnings) console.log(`warning: ${w}`);
  for (const e of result.errors) console.log(`error: ${e}`);
  console.log(`${result.errors.length} errors, ${result.warnings.length} warnings${rebuild ? " (rebuild checked)" : ""}`);
  if (result.errors.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { rebuildCheck };
