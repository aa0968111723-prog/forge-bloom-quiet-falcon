/**
 * Art source registry: stable asset id → builder.
 *
 * `scripts/art/export-assets.mjs` walks this table, so adding an asset means
 * adding its builder here and its record in `art/assets.json`.
 */
import type * as THREE from "three";
import { buildStudentKit } from "./characters/student-kit/kit.ts";
import { buildQuiz } from "./creatures/quiz/quiz.ts";
import { buildNpcKit } from "./characters/npc-kit/kit.ts";

export type BuiltAsset = {
  scene: THREE.Object3D;
  clips: THREE.AnimationClip[];
  /** PNG images to embed, bound to materials by name. */
  textures: { material: string; png: Buffer }[];
  meta: Record<string, unknown>;
};

export const ART_BUILDERS: Record<string, () => BuiltAsset> = {
  "char.student-kit": () => {
    const kit = buildStudentKit();
    return {
      scene: kit.scene,
      clips: kit.clips,
      textures: [{ material: "student-atlas", png: kit.atlasPng }],
      meta: { ...kit.meta, bones: kit.bones, parts: summariseParts(kit.parts) },
    };
  },
  "char.student-kit-lod1": () => {
    const kit = buildStudentKit(1);
    return {
      scene: kit.scene,
      clips: kit.clips,
      textures: [{ material: "student-atlas", png: kit.atlasPng }],
      meta: { ...kit.meta, bones: kit.bones, parts: summariseParts(kit.parts) },
    };
  },
  "char.npc-kit": () => {
    const kit = buildNpcKit();
    return {
      scene: kit.scene,
      clips: kit.clips,
      textures: [{ material: "npc-atlas", png: kit.atlasPng }],
      meta: {
        units: "m",
        forward: "+Z",
        up: "+Y",
        pivot: "ground between the feet",
        bones: kit.bones,
        parts: Object.fromEntries(kit.parts.map((p) => [p.id, p.triangles])),
        presetTriangles: kit.presetTriangles,
      },
    };
  },
  "creature.quiz": () => {
    const quiz = buildQuiz();
    return {
      scene: quiz.scene,
      clips: quiz.clips,
      textures: [{ material: "quiz-atlas", png: quiz.atlasPng }],
      meta: {
        units: "m",
        forward: "+Z",
        up: "+Y",
        pivot: "ground under the sheet",
        bones: quiz.bones,
        parts: summariseParts(quiz.parts),
      },
    };
  },
};

function summariseParts(parts: { name: string; triangles: number }[]) {
  const out: Record<string, number> = {};
  for (const p of parts) out[p.name] = (out[p.name] ?? 0) + p.triangles;
  return out;
}
