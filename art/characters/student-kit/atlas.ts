/**
 * Student kit texture atlas (512², 128 px cells).
 *
 *   row 0  FACE  FACE  SKIN    HAIR
 *   row 1  FACE  FACE  JACKET  SHIRT
 *   row 2  SHORTS CANVAS STRAP SHOE
 *   row 3  SOLE  METAL TURTLE  PALETTE (4×4 flat swatches)
 *
 * Every painter is deterministic, so the PNG is a pure function of this file
 * and spec.ts. Cloth patterns are periodic per cell so lofts that wrap a
 * sleeve or a leg meet without a seam.
 */
import { Raster, hex, mixColor, pfbm, shade, type RGBA } from "../../shared/raster.ts";
import { paintAnimeFace, type FaceStyle } from "../../shared/face.ts";
import type { AtlasRect } from "../../shared/builder.ts";
import { STUDENT_KIT } from "./spec.ts";

const S = STUDENT_KIT.atlasSize;
const C = S / 4;
const cell = (cx: number, cy: number, w = 1, h = 1): AtlasRect => ({ x: cx * C, y: cy * C, w: w * C, h: h * C });

export const CELLS = {
  face: cell(0, 0, 2, 2),
  skin: cell(2, 0),
  hair: cell(3, 0),
  jacket: cell(2, 1),
  shirt: cell(3, 1),
  shorts: cell(0, 2),
  canvas: cell(1, 2),
  strap: cell(2, 2),
  shoe: cell(3, 2),
  sole: cell(0, 3),
  metal: cell(1, 3),
  turtle: cell(2, 3),
} as const;

const SW = C / 4;
const SWATCH_NAMES = [
  "lining",
  "hairTie",
  "lace",
  "ink",
  "accent",
  "sock",
  "darkCanvas",
  "eyeDot",
  "tongue",
  "button",
  "badgeGold",
  "badgeJade",
  "turtleBelly",
  "cord",
  "shadow",
  "white",
] as const;
export type SwatchName = (typeof SWATCH_NAMES)[number];

/** A 32 px flat-colour swatch inside the PALETTE cell. */
export function swatch(name: SwatchName): AtlasRect {
  const i = SWATCH_NAMES.indexOf(name);
  return { x: 3 * C + (i % 4) * SW, y: 3 * C + Math.floor(i / 4) * SW, w: SW, h: SW };
}

const P = STUDENT_KIT.palette;
const SWATCH_COLORS: Record<SwatchName, string> = {
  lining: P.jacketLining,
  hairTie: P.hairTie,
  lace: "#fffdf8",
  ink: P.lash,
  accent: P.shoeAccent,
  sock: P.sock,
  darkCanvas: P.canvasShade,
  eyeDot: "#1d1311",
  tongue: "#efe9de",
  button: "#e9dcc0",
  badgeGold: P.metal,
  badgeJade: P.jacketShade,
  turtleBelly: "#e7dca8",
  cord: "#8a6a4c",
  shadow: "#3a3330",
  white: "#ffffff",
};

/** Atlas padding used by PartBuilder; painters address the same inner area. */
const PAD = 3;

/** Face projection extents (metres around the skull centre). */
export const FACE_EXTENT = { halfWidth: 0.125, halfHeight: 0.14 };

export function paintAtlas(): Raster {
  const r = new Raster(S, hex("#808080"));
  const skin = hex(P.skin);
  const skinAt = (u: number, v: number) => shade(skin, 0.985 + pfbm(u, v, 4, 3, 11) * 0.03);

  r.paint(CELLS.skin, (u, v) => skinAt(u, v));
  r.paint(CELLS.face, (u, v) => skinAt(u, v));
  paintFace(r);

  // Hair: root (bottom of cell) darker, a broken sheen band, lighter tips.
  const hair = hex(P.hair);
  const hairShade = hex(P.hairShade);
  const hairLight = hex(P.hairLight);
  r.paint(CELLS.hair, (u, v) => {
    const t = 1 - v; // 0 at root, 1 at tip
    const strands = pfbm(u * 1.0, 0.5, 24, 2, 5);
    let c = mixColor(hairShade, hair, Math.min(1, t / 0.22));
    const band = Math.exp(-Math.pow((t - 0.3) / 0.07, 2)) * (0.55 + 0.45 * pfbm(u, 0.2, 16, 2, 9));
    c = mixColor(c, hairLight, band * 0.7);
    c = mixColor(c, hairLight, Math.max(0, t - 0.75) * 0.9);
    return shade(c, 0.9 + strands * 0.2);
  });

  const weave = (base: string, dark: string, freq: number, amp: number, seed: number, diagonal: boolean) => {
    const a = hex(base);
    const b = hex(dark);
    return (u: number, v: number): RGBA => {
      const line = diagonal ? Math.sin((u + v) * Math.PI * 2 * freq) : Math.sin(v * Math.PI * 2 * freq);
      const mottle = pfbm(u, v, 4, 3, seed);
      return shade(mixColor(a, b, 0.12 + mottle * 0.18), 1 + line * amp);
    };
  };
  r.paint(CELLS.jacket, weave(P.jacket, P.jacketShade, 26, 0.035, 21, true));
  r.paint(CELLS.shirt, weave(P.shirt, "#ddd2bd", 30, 0.02, 23, false));
  r.paint(CELLS.shorts, weave(P.shorts, P.shortsShade, 34, 0.03, 25, true));

  const canvasA = hex(P.canvas);
  const canvasB = hex(P.canvasShade);
  r.paint(CELLS.canvas, (u, v) => {
    const warp = Math.sin(u * Math.PI * 2 * 22);
    const weft = Math.sin(v * Math.PI * 2 * 22);
    const mottle = pfbm(u, v, 4, 4, 31);
    return shade(mixColor(canvasA, canvasB, 0.15 + mottle * 0.35), 1 + warp * weft * 0.05);
  });

  const strap = hex(P.strap);
  r.paint(CELLS.strap, (u, v) => {
    const rib = Math.sin(v * Math.PI * 2 * 18) * 0.04;
    const stitch = (Math.abs(u - 0.14) < 0.03 || Math.abs(u - 0.86) < 0.03) && Math.sin(v * Math.PI * 2 * 9) > 0;
    return stitch ? hex("#d8c19a") : shade(strap, 0.95 + rib + pfbm(u, v, 4, 2, 41) * 0.08);
  });

  const shoe = hex(P.shoe);
  r.paint(CELLS.shoe, (u, v) => shade(shoe, 0.96 + pfbm(u, v, 8, 3, 51) * 0.05));

  const sole = hex(P.sole);
  r.paint(CELLS.sole, (u, v) => {
    const groove = Math.abs(Math.sin(v * Math.PI * 2 * 7)) > 0.92 ? 0.82 : 1;
    return shade(sole, groove * (0.97 + pfbm(u, v, 4, 2, 61) * 0.04));
  });

  const metal = hex(P.metal);
  r.paint(CELLS.metal, (u, v) => shade(metal, 0.75 + 0.45 * Math.exp(-Math.pow((v - 0.35) / 0.18, 2))));

  const shell = hex(P.turtleShell);
  r.paint(CELLS.turtle, (u, v) => {
    // Hexagonal scutes: distance to the nearest hex centre on a small grid.
    const gx = u * 4;
    const gy = v * 4 * 1.1547;
    const row = Math.floor(gy);
    const off = row % 2 ? 0.5 : 0;
    const cxh = Math.floor(gx - off) + 0.5 + off;
    const cyh = row + 0.5;
    const d = Math.hypot(gx - cxh, (gy - cyh) * 0.9);
    const line = d > 0.42 ? 0.62 : 1;
    const highlight = 1 + Math.exp(-Math.pow((v - 0.3) / 0.25, 2)) * 0.15;
    return shade(shell, line * highlight * (0.95 + pfbm(u, v, 4, 2, 71) * 0.08));
  });

  SWATCH_NAMES.forEach((name) => {
    const c = hex(SWATCH_COLORS[name]);
    r.paint(swatch(name), () => c);
  });
  return r;
}

/** The protagonist's face, drawn by the shared anime face painter. */
export const STUDENT_FACE: FaceStyle = {
  eyeLine: STUDENT_KIT.head.eyeLine,
  eyeSpacing: STUDENT_KIT.head.eyeSpacing,
  halfWidth: FACE_EXTENT.halfWidth,
  halfHeight: FACE_EXTENT.halfHeight,
  pad: PAD,
  scale: 1.15,
  eyeOpen: 1,
  irisTop: P.eyeIrisTop,
  irisBottom: P.eyeIrisBottom,
  lash: P.lash,
  brow: P.brow,
  blush: P.blush,
  lip: P.lip,
  skinShade: P.skinShade,
  lashWeight: 1,
  flick: true,
  browLift: 0.039,
  browWeight: [2.8, 1.1],
  browArch: 3.5,
  browTilt: 0,
  blushAlpha: 0.32,
  blushHatch: true,
  mouth: "smile",
};

function paintFace(r: Raster) {
  paintAnimeFace(r, CELLS.face, STUDENT_FACE);
}
