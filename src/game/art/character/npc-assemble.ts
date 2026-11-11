import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ActionLayer } from "./animator";

type KitData = {
  presets: Record<string, { parts: string[]; colors: Record<string, string>; build: { height: number; chest: [number, number, number] } }>;
  slots: Record<string, number>;
  upperBody: string[];
  actionLayers: Record<string, ActionLayer>;
  stride: { walk: number; run: number };
};

/**
 * Assemble one roster NPC from the shared kit: keep the preset's parts, tint
 * each vertex by its slot (stored in vertex alpha at export), merge into one
 * skinned mesh (one draw call) and scale the chest for the body build.
 *
 * Dev strict mode runs the caller's memo twice. The first call already
 * replaced the part meshes, so a second call keeps that mesh.
 */
export function assemble(root: THREE.Object3D, presetId: string) {
  const kit = root.getObjectByName("npc-kit")?.userData as KitData | undefined;
  const existing = root.getObjectByName(`npc:${presetId}`) as THREE.SkinnedMesh | undefined;
  if (existing && kit) {
    return { mesh: existing, kit, dispose: () => existing.geometry.dispose() };
  }
  const preset = kit?.presets[presetId];
  if (!kit || !preset) throw new Error(`NPC preset "${presetId}" is not in char.npc-kit`);
  const tints: (THREE.Color | null)[] = Array.from({ length: 16 }, () => null);
  for (const [slot, color] of Object.entries(preset.colors)) {
    const index = kit.slots[slot];
    // Vertex colours are linear; preset colours are authored as sRGB hex.
    if (index !== undefined) tints[index] = new THREE.Color(color);
  }
  // Must match partNodeName() in art/characters/npc-kit/kit.ts.
  const wanted = new Set(preset.parts.map((id) => `part_${id.replace(/[^A-Za-z0-9-]/g, "_")}`));
  const keep: THREE.SkinnedMesh[] = [];
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!o.name.startsWith("part_")) return;
    (wanted.has(o.name) ? keep : drop).push(o as THREE.SkinnedMesh);
  });
  if (keep.length !== preset.parts.length) throw new Error(`NPC preset "${presetId}" lists a part the kit does not have`);
  const tinted = keep.map((mesh) => {
    const g = mesh.geometry.clone();
    const color = g.getAttribute("color") as THREE.BufferAttribute;
    const src = color.array as Uint8Array;
    const out = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i += 4) {
      const t = tints[src[i + 3]] ?? null;
      out[i] = t ? Math.round(src[i] * t.r) : src[i];
      out[i + 1] = t ? Math.round(src[i + 1] * t.g) : src[i + 1];
      out[i + 2] = t ? Math.round(src[i + 2] * t.b) : src[i + 2];
      out[i + 3] = 255;
    }
    g.setAttribute("color", new THREE.BufferAttribute(out, 4, true));
    return g;
  });
  const merged = mergeGeometries(tinted, false);
  tinted.forEach((g) => g.dispose());
  if (!merged) throw new Error(`NPC preset "${presetId}" parts could not be merged`);
  const first = keep[0];
  const mesh = new THREE.SkinnedMesh(merged, first.material);
  mesh.name = `npc:${presetId}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(first.skeleton, first.bindMatrix);
  for (const part of [...keep, ...drop]) part.parent?.remove(part);
  root.add(mesh);

  // Body build: wider/narrower chest, with neck and arms compensated so the
  // head and limbs keep their own proportions.
  const [cx, cy, cz] = preset.build.chest;
  root.getObjectByName("chest")?.scale.set(cx, cy, cz);
  for (const name of ["neck", "upperArmL", "upperArmR", "bag"]) root.getObjectByName(name)?.scale.set(1 / cx, 1 / cy, 1 / cz);
  root.scale.setScalar(preset.build.height);
  return { mesh, kit, dispose: () => merged.dispose() };
}
