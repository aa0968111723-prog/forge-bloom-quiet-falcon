/**
 * Anime face painter shared by every character atlas.
 *
 * Draws into a face cell that a head's planar UV projection maps onto
 * (see student-kit/body.ts addHead). Distances are given in millimetres on
 * the face plane so a style reads the same at any atlas resolution.
 */
import type { AtlasRect } from "./builder.ts";
import { Raster, hex, mixColor, shade } from "./raster.ts";

export type FaceStyle = {
  /** Eye centre height and half spacing, metres relative to the skull centre. */
  eyeLine: number;
  eyeSpacing: number;
  /** Face projection extents (metres) and PartBuilder padding (px). */
  halfWidth: number;
  halfHeight: number;
  pad: number;
  /** Eye size relative to life size (anime eyes run large). */
  scale: number;
  /** Vertical squash of sclera and iris: 1 round, < 1 narrower. */
  eyeOpen: number;
  irisTop: string;
  irisBottom: string;
  lash: string;
  brow: string;
  blush: string;
  lip: string;
  skinShade: string;
  /** Multiplier on lash stroke weight; 0 drops the outer flick. */
  lashWeight: number;
  flick: boolean;
  /** Brow height above the eye line (m), stroke weights and shape. */
  browLift: number;
  browWeight: [number, number];
  browArch: number;
  /** Positive lowers the inner end (stern), negative raises it (soft). */
  browTilt: number;
  blushAlpha: number;
  blushHatch: boolean;
  mouth: "smile" | "flat" | "grin";
};

export function paintAnimeFace(r: Raster, cell: AtlasRect, f: FaceStyle) {
  const facePx = (u: number, vUp: number): [number, number] => [
    cell.x + f.pad + u * (cell.w - f.pad * 2),
    cell.y + f.pad + (1 - vUp) * (cell.h - f.pad * 2),
  ];
  const faceMetres = (x: number, y: number) => facePx(0.5 + x / (f.halfWidth * 2), 0.5 + y / (f.halfHeight * 2));
  const pxPerM = (cell.w - f.pad * 2) / (f.halfWidth * 2);
  const k = (pxPerM / 1000) * f.scale;
  const ky = k * f.eyeOpen;
  const lash = hex(f.lash);
  const brow = hex(f.brow);
  const irisTop = hex(f.irisTop);
  const irisBottom = hex(f.irisBottom);
  const { eyeLine, eyeSpacing } = f;

  // Blush first so the eyes sit on top of it.
  for (const side of [-1, 1]) {
    const [bx, by] = faceMetres(side * 0.052, eyeLine - 0.034);
    r.ellipse(bx, by, 11 * k * 1.1, 5.5 * k * 1.1, hex(f.blush, f.blushAlpha), 0, 4);
    if (f.blushHatch) {
      for (let i = 0; i < 3; i++) {
        const x0 = bx - 5 * k + i * 4 * k;
        r.stroke([[x0, by + 2.5 * k], [x0 + 2.5 * k, by - 2.5 * k]], 1.1, 0.9, hex(f.blush, 0.55));
      }
    }
  }

  for (const side of [-1, 1]) {
    // `side` is +1 for the character's left (+X), which reads on the viewer's right.
    const [cx, cy] = faceMetres(side * eyeSpacing, eyeLine);
    const out = side;
    const mm = (x: number, y: number): [number, number] => [cx + x * k * out, cy + y * ky];

    r.ellipse(cx, cy + 2 * ky, 17.5 * k, 18.5 * ky, hex("#fbf7f1"), 0, 1.2);
    const irisR = [11.5 * k, 17.5 * ky];
    const [ix, iy] = [cx - out * 1.2 * k, cy + 1.5 * ky];
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
    r.ellipse(ix, iy + 1 * ky, 5.5 * k, 8.5 * ky, hex("#1d1210"), 0, 1);
    r.ellipse(ix + out * 3.8 * k, iy - 6.5 * ky, 4.2 * k, 5.4 * ky, hex("#ffffff"), out * 0.35, 1);
    r.ellipse(ix - out * 4.5 * k, iy + 8.5 * ky, 2.1 * k, 2.1 * k, hex("#fff8ec", 0.9), 0, 1);
    const lw = f.lashWeight;
    r.stroke([mm(-17, -5), mm(-9, -16.5), mm(3, -19.5), mm(14, -15.5), mm(20.5, -8)], 2.2 * lw, 4.4 * lw, lash);
    if (f.flick) {
      r.stroke([mm(18.5, -10), mm(23.5, -13.5), mm(26.5, -15)], 3.2 * lw, 0.8, lash);
      r.stroke([mm(20, -7), mm(24, -6.5)], 2.0 * lw, 0.6, lash);
    }
    r.stroke([mm(3, 20.5), mm(10, 18.5), mm(16, 14)], 1.0, 1.6, hex(f.lash, 0.65));
    const [bx, by] = faceMetres(side * (eyeSpacing + 0.003), eyeLine + f.browLift);
    r.curve(
      [bx - out * 13 * k, by + (3 + f.browTilt) * k],
      [bx + out * 1 * k, by - f.browArch * k],
      [bx + out * 15 * k, by + (1.5 - f.browTilt * 0.6) * k],
      f.browWeight[0],
      f.browWeight[1],
      brow,
    );
  }

  const [nx, ny] = faceMetres(0.002, eyeLine - 0.03);
  r.stroke([[nx - 0.5 * k, ny - 2.5 * k], [nx + 1.8 * k, ny + 2 * k]], 1.6, 1.2, hex(f.skinShade, 0.9));
  const [mx, my] = faceMetres(0, eyeLine - 0.058);
  if (f.mouth === "flat") {
    r.stroke([[mx - 5 * k, my + 0.6 * k], [mx + 5 * k, my + 0.2 * k]], 1.3, 1.3, hex(f.lip));
  } else if (f.mouth === "grin") {
    r.curve([mx - 7 * k, my - 1 * k], [mx, my + 5 * k], [mx + 7 * k, my - 1 * k], 1.6, 1.6, hex(f.lip));
    r.curve([mx - 4 * k, my + 1.2 * k], [mx, my + 3.4 * k], [mx + 4 * k, my + 1.2 * k], 2.4, 2.4, hex("#8e3f3a", 0.85));
  } else {
    r.curve([mx - 6.5 * k, my - 0.5 * k], [mx, my + 3.5 * k], [mx + 6.5 * k, my - 0.5 * k], 1.4, 1.4, hex(f.lip));
  }
}
