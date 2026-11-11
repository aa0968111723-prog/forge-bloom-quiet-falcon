/**
 * NPC kit: every part as its own skinned mesh on one shared skeleton, one
 * material and one atlas, plus the roster presets and tint slots in the
 * scene's extras. The runtime keeps a preset's parts, tints them by slot,
 * merges them into one draw call and scales bones for the body build.
 */
import * as THREE from "three";
import { PartBuilder } from "../../shared/builder.ts";
import { ACTION_LAYERS, STRIDE, allClips } from "../student-kit/clips.ts";
import { BONE_NAMES, UPPER_BODY, buildKitRig } from "../student-kit/skeleton.ts";
import { paintNpcAtlas } from "./atlas.ts";
import { NPC_PARTS, SLOT } from "./parts.ts";
import { NPC_ROSTER } from "./roster.ts";
import { withDetail } from "../student-kit/detail.ts";

export const NPC_KIT = { id: "char.npc-kit", version: 1, atlasSize: 512 } as const;

/** Node name for a part id that survives glTF name sanitising ("top:hoodie" → "part_top_hoodie"). */
export const partNodeName = (id: string) => `part_${id.replace(/[^A-Za-z0-9-]/g, "_")}`;

/** NPCs are crowd characters: shared generators run at the low-tier detail level. */
export function buildNpcKit() {
  return withDetail(1, build);
}

function build() {
  const rig = buildKitRig();
  const material = new THREE.MeshStandardMaterial({ name: "npc-atlas", vertexColors: true, roughness: 0.82, metalness: 0 });
  const scene = new THREE.Group();
  scene.name = "npc-kit";
  scene.add(rig.root);
  const parts: { id: string; triangles: number }[] = [];
  for (const def of NPC_PARTS) {
    const b = new PartBuilder(NPC_KIT.atlasSize);
    def.build(b, rig);
    const mesh = new THREE.SkinnedMesh(b.build(), material);
    // glTF loaders strip ":" "." "/" "[]" from node names, so part ids map to safe names.
    mesh.name = partNodeName(def.id);
    scene.add(mesh);
    mesh.bind(rig.skeleton);
    parts.push({ id: def.id, triangles: b.triangleCount });
  }
  scene.userData = {
    artId: NPC_KIT.id,
    artVersion: NPC_KIT.version,
    actionLayers: ACTION_LAYERS,
    upperBody: UPPER_BODY,
    stride: STRIDE,
    slots: SLOT,
    presets: Object.fromEntries(NPC_ROSTER.map((p) => [p.id, { parts: p.parts, colors: p.colors, build: p.build, role: p.role, route: p.route }])),
  };
  return {
    scene,
    clips: allClips(),
    atlasPng: paintNpcAtlas().toPNG(),
    parts,
    bones: BONE_NAMES,
    triangles: parts.reduce((n, p) => n + p.triangles, 0),
    presetTriangles: Object.fromEntries(
      NPC_ROSTER.map((p) => [p.id, p.parts.reduce((n, id) => n + (parts.find((x) => x.id === id)?.triangles ?? 0), 0)]),
    ),
  };
}
