/**
 * NPC kit atlas (512², 128 px cells). Cloth and hair cells are near-white so
 * each NPC's colours come from vertex tints set by its roster preset; faces
 * and skin are painted in full colour.
 *
 *   row 0  FACE_A FACE_A FACE_B FACE_B
 *   row 1  FACE_A FACE_A FACE_B FACE_B
 *   row 2  SKIN   HAIR   KNIT   TWILL
 *   row 3  DENIM  SHOE   SOLE   PALETTE (4×4 swatches)
 */
import type { AtlasRect } from "../../shared/builder.ts";
import { paintAnimeFace, type FaceStyle } from "../../shared/face.ts";
import { Raster, hex, mixColor, pfbm, shade } from "../../shared/raster.ts";
import { FACE_EXTENT } from "../student-kit/atlas.ts";
import { STUDENT_KIT } from "../student-kit/spec.ts";

const S = 512;
const C = S / 4;
const PAD = 3;
const cell = (cx: number, cy: number, w = 1, h = 1): AtlasRect => ({ x: cx * C, y: cy * C, w: w * C, h: h * C });

export const NPC_CELLS = {
  faceA: cell(0, 0, 2, 2),
  faceB: cell(2, 0, 2, 2),
  skin: cell(0, 2),
  hair: cell(1, 2),
  knit: cell(2, 2),
  twill: cell(3, 2),
  denim: cell(0, 3),
  shoe: cell(1, 3),
  sole: cell(2, 3),
} as const;

const SWATCHES = [
  "white",
  "ink",
  "gold",
  "leather",
  "lace",
  "tongue",
  "rubber",
  "frame",
  "paper",
  "cardboard",
  "plastic",
  "zip",
  "metal",
  "rib",
  "lining",
  "accent",
] as const;
export type NpcSwatch = (typeof SWATCHES)[number];
const SW = C / 4;
export function npcSwatch(name: NpcSwatch): AtlasRect {
  const i = SWATCHES.indexOf(name);
  return { x: 3 * C + (i % 4) * SW, y: 3 * C + Math.floor(i / 4) * SW, w: SW, h: SW };
}
const SWATCH_COLORS: Record<NpcSwatch, string> = {
  white: "#ffffff",
  ink: "#2a2524",
  gold: "#d5b26a",
  leather: "#ffffff",
  lace: "#f8f6f0",
  tongue: "#efe9de",
  rubber: "#e9e3d6",
  frame: "#2f2a2a",
  paper: "#f3ead8",
  cardboard: "#b98f5d",
  plastic: "#ffffff",
  zip: "#3b3b3e",
  metal: "#c8c6c0",
  rib: "#ececec",
  lining: "#d8d2c8",
  accent: "#ffffff",
};

const base = {
  eyeLine: STUDENT_KIT.head.eyeLine,
  eyeSpacing: STUDENT_KIT.head.eyeSpacing,
  halfWidth: FACE_EXTENT.halfWidth,
  halfHeight: FACE_EXTENT.halfHeight,
  pad: PAD,
  blush: "#ef9f95",
  lip: "#a8564e",
  skinShade: "#d99c82",
};

/** Soft: round eyes, long lashes, arched brows, blush, smile. */
export const FACE_SOFT: FaceStyle = {
  ...base,
  scale: 1.12,
  eyeOpen: 1,
  irisTop: "#2c2423",
  irisBottom: "#7b6458",
  lash: "#231a19",
  brow: "#3a2b26",
  lashWeight: 1.05,
  flick: true,
  browLift: 0.04,
  browWeight: [2.6, 1.0],
  browArch: 4,
  browTilt: -0.6,
  blushAlpha: 0.3,
  blushHatch: true,
  mouth: "grin",
};

/** Sharp: narrower eyes, short lashes, straight heavier brows, flat mouth. */
export const FACE_SHARP: FaceStyle = {
  ...base,
  scale: 1.0,
  eyeOpen: 0.72,
  irisTop: "#1f1b1d",
  irisBottom: "#5a5050",
  lash: "#1d1717",
  brow: "#231b1a",
  lashWeight: 0.8,
  flick: false,
  browLift: 0.03,
  browWeight: [4.2, 2.6],
  browArch: 1.2,
  browTilt: 1.6,
  blushAlpha: 0.12,
  blushHatch: false,
  mouth: "flat",
};

export function paintNpcAtlas(): Raster {
  const skin = hex("#f3c9ad");
  const r = new Raster(S, hex("#808080"));
  const skinAt = (u: number, v: number) => shade(skin, 0.985 + pfbm(u, v, 4, 3, 13) * 0.03);
  r.paint(NPC_CELLS.skin, skinAt);
  r.paint(NPC_CELLS.faceA, skinAt);
  r.paint(NPC_CELLS.faceB, skinAt);
  paintAnimeFace(r, NPC_CELLS.faceA, FACE_SOFT);
  paintAnimeFace(r, NPC_CELLS.faceB, FACE_SHARP);

  // Light hair base: tinted per NPC, so strands and sheen are luminance only.
  const hairBase = hex("#d9d2cc");
  r.paint(NPC_CELLS.hair, (u, v) => {
    const t = 1 - v;
    const strands = pfbm(u, 0.5, 24, 2, 5);
    const band = Math.exp(-Math.pow((t - 0.3) / 0.07, 2)) * (0.55 + 0.45 * pfbm(u, 0.2, 16, 2, 9));
    const root = 0.72 + 0.28 * Math.min(1, t / 0.22);
    return shade(hairBase, root * (0.88 + strands * 0.22) * (1 + band * 0.35));
  });
  const knit = hex("#f6f5f2");
  r.paint(NPC_CELLS.knit, (u, v) => {
    const rib = Math.sin(u * Math.PI * 2 * 30) * 0.03;
    return shade(knit, 0.94 + rib + pfbm(u, v, 4, 3, 17) * 0.06);
  });
  const twill = hex("#f4f2ee");
  r.paint(NPC_CELLS.twill, (u, v) => {
    const line = Math.sin((u + v) * Math.PI * 2 * 30) * 0.03;
    return shade(twill, 0.94 + line + pfbm(u, v, 4, 3, 19) * 0.06);
  });
  const denimA = hex("#4f6f95");
  const denimB = hex("#7f9bbd");
  r.paint(NPC_CELLS.denim, (u, v) => {
    const diag = Math.sin((u * 1.0 + v * 0.6) * Math.PI * 2 * 34) * 0.5 + 0.5;
    const fade = pfbm(u, v, 4, 4, 23);
    return shade(mixColor(denimA, denimB, fade * 0.6 + diag * 0.12), 0.95 + diag * 0.08);
  });
  const shoe = hex("#f8f6f1");
  r.paint(NPC_CELLS.shoe, (u, v) => shade(shoe, 0.95 + pfbm(u, v, 8, 3, 29) * 0.05));
  const sole = hex("#e8e2d6");
  r.paint(NPC_CELLS.sole, (u, v) => shade(sole, (Math.abs(Math.sin(v * Math.PI * 2 * 7)) > 0.92 ? 0.82 : 1) * (0.97 + pfbm(u, v, 4, 2, 31) * 0.04)));
  for (const name of SWATCHES) {
    const c = hex(SWATCH_COLORS[name]);
    r.paint(npcSwatch(name), name === "leather" ? (u, v) => shade(c, 0.92 + pfbm(u, v, 4, 2, 37) * 0.1) : () => c);
  }
  return r;
}
