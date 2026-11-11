/**
 * Assemble the student kit: one skinned mesh, one material, one atlas.
 *
 *   node scripts/art/export-assets.mjs        (writes the GLB)
 *
 * The protagonist preset is the only preset authored so far; NPC presets
 * (body build, hair, outfit, accessories) extend this kit in later passes.
 */
import * as THREE from "three";
import { PartBuilder } from "../../shared/builder.ts";
import { paintAtlas } from "./atlas.ts";
import { addArm, addHead, addLowerBody, addTorso } from "./body.ts";
import { addBackpack } from "./backpack.ts";
import { ACTION_LAYERS, STRIDE, allClips } from "./clips.ts";
import { addHair } from "./hair.ts";
import { BONE_NAMES, UPPER_BODY, buildKitRig } from "./skeleton.ts";
import { STUDENT_KIT } from "./spec.ts";
import { withDetail, type Detail } from "./detail.ts";

export type BuiltKit = {
  scene: THREE.Group;
  mesh: THREE.SkinnedMesh;
  clips: THREE.AnimationClip[];
  atlasPng: Buffer;
  parts: { name: string; triangles: number }[];
  triangles: number;
  bones: string[];
  meta: Record<string, unknown>;
};

/** Detail 0 is the hero mesh; detail 1 is the low-tier mesh on the same skeleton and atlas. */
export function buildStudentKit(detail: Detail = 0): BuiltKit {
  return withDetail(detail, () => build(detail));
}

function build(detail: Detail): BuiltKit {
  const rig = buildKitRig();
  const b = new PartBuilder(STUDENT_KIT.atlasSize);
  addHead(b, rig);
  addHair(b, rig);
  addTorso(b, rig);
  addArm(b, rig, 1);
  addArm(b, rig, -1);
  addLowerBody(b, rig);
  addBackpack(b, rig);
  const geometry = b.build();

  const material = new THREE.MeshStandardMaterial({
    name: "student-atlas",
    vertexColors: true,
    roughness: 0.8,
    metalness: 0,
  });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = "student";
  mesh.add(rig.root);
  mesh.bind(rig.skeleton);

  const scene = new THREE.Group();
  scene.name = "student-kit";
  scene.add(mesh);
  scene.userData = {
    artId: detail === 0 ? STUDENT_KIT.id : `${STUDENT_KIT.id}-lod1`,
    artVersion: STUDENT_KIT.version,
    detail,
    actionLayers: ACTION_LAYERS,
    upperBody: UPPER_BODY,
    stride: STRIDE,
  };

  return {
    scene,
    mesh,
    clips: allClips(),
    atlasPng: paintAtlas().toPNG(),
    parts: b.parts,
    triangles: b.triangleCount,
    bones: BONE_NAMES,
    meta: {
      units: "m",
      forward: "+Z",
      up: "+Y",
      pivot: "ground between the feet",
      preset: "protagonist",
      detail: detail === 0 ? "hero (LOD0)" : "low tier (LOD1)",
      material: "one MeshStandardMaterial, base colour atlas × vertex colour",
    },
  };
}
