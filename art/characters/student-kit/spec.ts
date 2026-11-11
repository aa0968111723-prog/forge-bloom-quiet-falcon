/**
 * Student kit — editable source parameters.
 *
 * Change colours or proportions here and run `npm run art:export`; the GLB in
 * public/game-art/characters/ is rebuilt from this file and the generators
 * beside it. Units are metres, the character faces +Z, +Y is up, and the
 * origin is on the ground between the feet (glTF convention: the
 * character's left is +X).
 */
export const STUDENT_KIT = {
  id: "char.student-kit",
  version: 1,
  /** Palette follows the jade campus fantasy direction (docs/art/DIRECTION.md). */
  palette: {
    skin: "#f3c9ad",
    skinShade: "#dfa086",
    blush: "#f0a59c",
    hair: "#4b2a20",
    hairShade: "#2e1913",
    hairLight: "#86533c",
    eyeIrisTop: "#3d2219",
    eyeIrisBottom: "#a8704a",
    lash: "#2b1915",
    brow: "#3d241c",
    lip: "#b05d55",
    shirt: "#f4ecdc",
    jacket: "#5f9c86",
    jacketShade: "#3f7764",
    jacketLining: "#d7e8dc",
    shorts: "#cdb894",
    shortsShade: "#a8916e",
    sock: "#fbf8f1",
    shoe: "#f8f5ee",
    sole: "#e9e3d6",
    shoeAccent: "#5f9c86",
    canvas: "#cfb68f",
    canvasShade: "#a98d66",
    strap: "#7b5e45",
    metal: "#d5b26a",
    turtleShell: "#5f9a74",
    turtleSkin: "#b8d7a4",
    hairTie: "#4f8f78",
  },
  /** Rest-pose bone layout (offsets relative to parent). */
  bones: [
    { name: "hips", parent: null, offset: [0, 0.84, 0] },
    { name: "spine", parent: "hips", offset: [0, 0.1, 0] },
    { name: "chest", parent: "spine", offset: [0, 0.15, 0] },
    { name: "neck", parent: "chest", offset: [0, 0.18, 0.005] },
    { name: "head", parent: "neck", offset: [0, 0.065, 0.005] },
    { name: "hairTail", parent: "head", offset: [0, 0.155, -0.112] },
    { name: "upperArmL", parent: "chest", offset: [0.165, 0.125, -0.005] },
    { name: "lowerArmL", parent: "upperArmL", offset: [0.035, -0.23, 0] },
    { name: "handL", parent: "lowerArmL", offset: [0.022, -0.215, 0.018] },
    { name: "upperArmR", parent: "chest", offset: [-0.165, 0.125, -0.005] },
    { name: "lowerArmR", parent: "upperArmR", offset: [-0.035, -0.23, 0] },
    { name: "handR", parent: "lowerArmR", offset: [-0.022, -0.215, 0.018] },
    { name: "bag", parent: "chest", offset: [0, 0.02, -0.19] },
    { name: "charm", parent: "bag", offset: [0.07, -0.006, -0.106] },
    { name: "upperLegL", parent: "hips", offset: [0.085, -0.055, 0] },
    { name: "lowerLegL", parent: "upperLegL", offset: [0.005, -0.37, 0.005] },
    { name: "footL", parent: "lowerLegL", offset: [0, -0.35, -0.015] },
    { name: "upperLegR", parent: "hips", offset: [-0.085, -0.055, 0] },
    { name: "lowerLegR", parent: "upperLegR", offset: [-0.005, -0.37, 0.005] },
    { name: "footR", parent: "lowerLegR", offset: [0, -0.35, -0.015] },
  ],
  head: {
    /** Centre of the skull relative to the head bone. */
    center: [0, 0.115, 0.014],
    radius: [0.112, 0.13, 0.118],
    /** Eye line height relative to the skull centre (anime eyes sit low). */
    eyeLine: -0.018,
    eyeSpacing: 0.046,
  },
  /** Atlas resolution; cells are 1/4 of it. */
  atlasSize: 512,
  /**
   * Triangle budget for the full hero preset (one skinned mesh). Matches the
   * pre-existing student budget in scripts/art-models.test.mjs.
   */
  triangleBudget: 22000,
} as const;

export type BoneName = (typeof STUDENT_KIT.bones)[number]["name"];
