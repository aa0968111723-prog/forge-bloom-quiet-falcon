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

/** Convert face-local (u right, v up) into atlas pixels, matching PartBuilder's padding. */
function facePx(u: number, vUp: number): [number, number] {
  const f = CELLS.face;
  return [f.x + PAD + u * (f.w - PAD * 2), f.y + PAD + (1 - vUp) * (f.h - PAD * 2)];
}

/** Metres on the face plane (x right, y up, relative to skull centre) → pixels. */
function faceMetres(x: number, y: number): [number, number] {
  return facePx(0.5 + x / (FACE_EXTENT.halfWidth * 2), 0.5 + y / (FACE_EXTENT.halfHeight * 2));
}

function paintFace(r: Raster) {
  const { eyeLine, eyeSpacing } = STUDENT_KIT.head;
  const pxPerM = (CELLS.face.w - PAD * 2) / (FACE_EXTENT.halfWidth * 2);
  // Pixels per millimetre; eye features are drawn 15 % over life size, as anime eyes are.
  const k = (pxPerM / 1000) * 1.15;
  const lash = hex(P.lash);
  const brow = hex(P.brow);
  const irisTop = hex(P.eyeIrisTop);
  const irisBottom = hex(P.eyeIrisBottom);

  // Blush first so the eyes sit on top of it.
  for (const side of [-1, 1]) {
    const [bx, by] = faceMetres(side * 0.052, eyeLine - 0.034);
    r.ellipse(bx, by, 11 * k * 1.1, 5.5 * k * 1.1, hex(P.blush, 0.32), 0, 4);
    for (let i = 0; i < 3; i++) {
      const x0 = bx - 5 * k + i * 4 * k;
      r.stroke([[x0, by + 2.5 * k], [x0 + 2.5 * k, by - 2.5 * k]], 1.1, 0.9, hex(P.blush, 0.55));
    }
  }

  for (const side of [-1, 1]) {
    // `side` is +1 for the character's left (+X), which reads on the viewer's right.
    const [cx, cy] = faceMetres(side * eyeSpacing, eyeLine);
    const out = side; // outer corner direction in pixels
    const mm = (x: number, y: number): [number, number] => [cx + x * k * out, cy + y * k];

    // Sclera under the lid line.
    r.ellipse(cx, cy + 2 * k, 17.5 * k, 18.5 * k, hex("#fbf7f1"), 0, 1.2);
    // Iris with a vertical gradient, a darker rim and lid shadow on top.
    const irisR = [11.5 * k, 17.5 * k];
    const [ix, iy] = [cx - out * 1.2 * k, cy + 1.5 * k];
    for (let y = Math.floor(iy - irisR[1] - 2); y <= Math.ceil(iy + irisR[1] + 2); y++) {
      for (let x = Math.floor(ix - irisR[0] - 2); x <= Math.ceil(ix + irisR[0] + 2); x++) {
        const d = Math.hypot((x + 0.5 - ix) / irisR[0], (y + 0.5 - iy) / irisR[1]);
        if (d > 1.06) continue;
        const ty = (y + 0.5 - (iy - irisR[1])) / (irisR[1] * 2);
        let c = mixColor(irisTop, irisBottom, Math.pow(Math.min(1, Math.max(0, ty - 0.15) / 0.85), 1.2));
        if (d > 0.84) c = shade(c, 0.55);
        if (ty < 0.38) c = shade(c, 0.6 + ty);
        r.blend(x, y, c, d > 1 ? (1.06 - d) / 0.06 : 1);
      }
    }
    r.ellipse(ix, iy + 1 * k, 5.5 * k, 8.5 * k, hex("#1d1210"), 0, 1);
    // Catch-lights: a large one up and outward, a small one low and inward.
    r.ellipse(ix + out * 3.8 * k, iy - 6.5 * k, 4.2 * k, 5.4 * k, hex("#ffffff"), out * 0.35, 1);
    r.ellipse(ix - out * 4.5 * k, iy + 8.5 * k, 2.1 * k, 2.1 * k, hex("#fff8ec", 0.9), 0, 1);
    // Upper lash line with an outer flick, tapered.
    r.stroke([mm(-17, -5), mm(-9, -16.5), mm(3, -19.5), mm(14, -15.5), mm(20.5, -8)], 2.2, 4.4, lash);
    r.stroke([mm(18.5, -10), mm(23.5, -13.5), mm(26.5, -15)], 3.2, 0.8, lash);
    r.stroke([mm(20, -7), mm(24, -6.5)], 2.0, 0.6, lash);
    // Lower lid: short, soft, outer half only.
    r.stroke([mm(3, 20.5), mm(10, 18.5), mm(16, 14)], 1.0, 1.6, hex(P.lash, 0.65));
    // Brow: arched, thin, tapering outward.
    const [bx, by] = faceMetres(side * (eyeSpacing + 0.003), eyeLine + 0.039);
    r.curve(
      [bx - out * 13 * k, by + 3 * k],
      [bx + out * 1 * k, by - 3.5 * k],
      [bx + out * 15 * k, by + 1.5 * k],
      2.8,
      1.1,
      brow,
    );
  }

  // Nose: a small warm shadow, not an outline.
  const [nx, ny] = faceMetres(0.002, eyeLine - 0.03);
  r.stroke([[nx - 0.5 * k, ny - 2.5 * k], [nx + 1.8 * k, ny + 2 * k]], 1.6, 1.2, hex(P.skinShade, 0.9));
  // Mouth: a gentle smile.
  const [mx, my] = faceMetres(0, eyeLine - 0.058);
  r.curve([mx - 6.5 * k, my - 0.5 * k], [mx, my + 3.5 * k], [mx + 6.5 * k, my - 0.5 * k], 1.4, 1.4, hex(P.lip));
}
