import {
  AVENUE_PAVED_WIDTH,
  AVENUE_PLANTING_WIDTH,
  AXIS,
  DOLPHIN_ISLAND_RADIUS,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
} from "./axis.ts";
import { KENAN, KENAN_LANDING_Z, KENAN_TOP_Z, kenanDrainPositions } from "./kenan.ts";
import { LIBRARY, PALACE, palaceHallZs } from "./landmarks.ts";
import { PATH_SEGMENTS } from "./paths.ts";

/**
 * Campus small-object pass.
 *
 * Priority is *right kind in the right place*, not polygon count: a drain grate
 * every 8 m down 克難坡 and a kerb along the avenue do more for believability
 * than a high-poly bench. Each entry names its zone so mobile can drop the
 * furthest ones first.
 */
export type PropKind =
  | "lantern-post" // 宮燈
  | "street-lamp" // 路燈
  | "bench" // 長椅
  | "bin" // 垃圾桶
  | "sign-post" // 校園指示牌
  | "name-plate" // 門牌
  | "drain-grate" // 排水孔
  | "gutter" // 水溝
  | "railing" // 欄杆
  | "bollard" // 車阻
  | "utility-box" // 電箱
  | "hydrant" // 消防栓
  | "ac-unit" // 冷氣室外機
  | "tactile-strip" // 導盲磚
  | "ramp" // 無障礙坡道
  | "planter" // 花台
  | "potted-plant" // 盆栽
  | "noticeboard"; // 公告牌

export type PropInstance = {
  kind: PropKind;
  x: number;
  z: number;
  rotationY: number;
  scale: number;
  zone: string;
  /** Extra length for strip-like props (gutter, railing, tactile paving). */
  length?: number;
};

const prop = (
  kind: PropKind,
  x: number,
  z: number,
  zone: string,
  rotationY = 0,
  scale = 1,
  length?: number,
): PropInstance => ({ kind, x, z, rotationY, scale, zone, length });

function kenanProps(): PropInstance[] {
  const out: PropInstance[] = [];
  const inner = KENAN.width / 2 - KENAN.gutterInset;
  // The stair's own component (landmarks/KenanSlope) draws the drainage
  // channels and the pitched centre handrails as real geometry following the
  // flights; only the point-like grates are placed from here.
  for (const z of kenanDrainPositions()) {
    for (const s of [-1, 1] as const) out.push(prop("drain-grate", s * inner, z, "kenan"));
  }
  // Landing furniture — the place everybody stops to breathe.
  out.push(prop("bench", -2.7, KENAN_LANDING_Z[0] - 2.2, "kenan", 0));
  out.push(prop("bench", 2.7, KENAN_LANDING_Z[0] - 2.2, "kenan", Math.PI));
  out.push(prop("bin", 3.3, KENAN_LANDING_Z[1] + 1.2, "kenan"));
  out.push(prop("sign-post", -3.4, KENAN_LANDING_Z[1] + 1.0, "kenan", Math.PI / 2));
  // Bottom entrance.
  out.push(prop("sign-post", -4.6, KENAN.bottomZ + 3.4, "kenan", Math.PI / 2, 1.15));
  out.push(prop("noticeboard", 5.1, KENAN.bottomZ + 5.6, "kenan", -Math.PI / 2));
  out.push(prop("tactile-strip", 0, AXIS.gateZ + 2.4, "kenan", 0, 1, 5.2));
  out.push(prop("hydrant", -5.9, AXIS.gateZ + 4.2, "kenan"));
  out.push(prop("utility-box", 6.2, AXIS.gateZ + 6.4, "kenan", -Math.PI / 2));
  out.push(prop("bollard", -2.2, AXIS.gateZ + 1.2, "kenan"));
  out.push(prop("bollard", 2.2, AXIS.gateZ + 1.2, "kenan"));
  // Street lamps up the banks.
  let i = 0;
  for (let z = KENAN.bottomZ - 4; z > KENAN_TOP_Z; z -= 13, i++) {
    const s = i % 2 === 0 ? -1 : 1;
    out.push(prop("street-lamp", s * (KENAN.width / 2 + 1.15), z, "kenan", s > 0 ? -Math.PI / 2 : Math.PI / 2));
  }
  return out;
}

function plazaProps(): PropInstance[] {
  const out: PropInstance[] = [];
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2 + 0.2;
    out.push(
      prop("street-lamp", Math.sin(t) * (PLAZA_RADIUS + 2.2), Math.cos(t) * (PLAZA_RADIUS + 2.2), "plaza", t),
    );
  }
  for (let a = 0; a < 6; a++) {
    const t = Math.PI * 0.55 + (a / 6) * Math.PI * 0.9;
    out.push(prop("bench", Math.sin(t) * (PLAZA_RADIUS - 2.4), Math.cos(t) * (PLAZA_RADIUS - 2.4), "plaza", t + Math.PI));
  }
  out.push(prop("bin", PLAZA_RADIUS - 1.6, -4.2, "plaza"));
  out.push(prop("sign-post", -4.2, -PLAZA_RADIUS + 1.2, "plaza", 0, 1.1));
  out.push(prop("potted-plant", -2.6, 2.4, "plaza"));
  out.push(prop("potted-plant", 2.6, 2.4, "plaza"));
  return out;
}

function avenueProps(): PropInstance[] {
  const out: PropInstance[] = [];
  const lampX = AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH * 0.45;
  // 宮燈: the avenue's signature. Even spacing, both sides, staggered by half.
  const spacing = 12;
  let i = 0;
  for (let z = AXIS.avenueSouthZ - 4; z > AXIS.avenueNorthZ + 2; z -= spacing, i++) {
    out.push(prop("lantern-post", -lampX, z, "avenue", 0));
    out.push(prop("lantern-post", lampX, z - spacing / 2, "avenue", 0));
  }
  // Hall-front furniture: name plate, potted plants, AC units on the back wall.
  for (const z of palaceHallZs()) {
    for (const s of [-1, 1] as const) {
      out.push(prop("potted-plant", s * (PALACE.offsetX - PALACE.hallDepth / 2 - 1.1), z + 4.2, "avenue"));
      out.push(prop("potted-plant", s * (PALACE.offsetX - PALACE.hallDepth / 2 - 1.1), z - 4.2, "avenue"));
      out.push(prop("ac-unit", s * (PALACE.offsetX + PALACE.hallDepth / 2 + 0.4), z + 6.5, "avenue", s > 0 ? Math.PI / 2 : -Math.PI / 2));
      out.push(prop("ac-unit", s * (PALACE.offsetX + PALACE.hallDepth / 2 + 0.4), z - 6.5, "avenue", s > 0 ? Math.PI / 2 : -Math.PI / 2));
      out.push(prop("bench", s * (AVENUE_PAVED_WIDTH / 2 + 1.4), z + 9, "avenue", s > 0 ? -Math.PI / 2 : Math.PI / 2));
      out.push(prop("bin", s * (AVENUE_PAVED_WIDTH / 2 + 1.5), z - 11, "avenue"));
      out.push(prop("planter", s * (AVENUE_PAVED_WIDTH / 2 + 2.6), z, "avenue", 0, 1, 6));
    }
  }
  for (let k = 0; k < 5; k++) {
    const z = AXIS.avenueSouthZ - 22 - k * 42;
    out.push(prop("drain-grate", -(AVENUE_PAVED_WIDTH / 2 + 0.18), z, "avenue"));
    out.push(prop("drain-grate", AVENUE_PAVED_WIDTH / 2 + 0.18, z, "avenue"));
    out.push(prop("hydrant", -(AVENUE_PAVED_WIDTH / 2 + 3.9), z - 6, "avenue"));
    out.push(prop("utility-box", AVENUE_PAVED_WIDTH / 2 + 4.2, z + 8, "avenue", -Math.PI / 2));
    out.push(prop("sign-post", -(AVENUE_PAVED_WIDTH / 2 + 1.1), z + 16, "avenue", 0, 1));
  }
  return out;
}

function northProps(): PropInstance[] {
  const out: PropInstance[] = [];
  // Roundabout: kerb bollards, lamps, signage.
  for (let a = 0; a < 10; a++) {
    const t = (a / 10) * Math.PI * 2;
    out.push(prop("bollard", Math.sin(t) * DOLPHIN_ISLAND_RADIUS, AXIS.dolphinZ + Math.cos(t) * DOLPHIN_ISLAND_RADIUS, "dolphin", t));
  }
  for (const [x, z] of [
    [-13, AXIS.dolphinZ + 12],
    [13, AXIS.dolphinZ + 12],
    [-13, AXIS.dolphinZ - 12],
    [13, AXIS.dolphinZ - 12],
  ] as const) {
    out.push(prop("street-lamp", x, z, "dolphin", 0, 1.1));
  }
  out.push(prop("sign-post", -12, AXIS.dolphinZ + 16, "dolphin", 0, 1.2));

  const [w, d] = SCROLL_PLAZA_SIZE;
  for (let k = 0; k < 6; k++) {
    const z = AXIS.scrollPlazaZ + d / 2 - 4 - k * ((d - 8) / 5);
    for (const s of [-1, 1] as const) {
      out.push(prop("bench", s * (w / 2 - 4.5), z, "scroll", s > 0 ? -Math.PI / 2 : Math.PI / 2));
      out.push(prop("street-lamp", s * (w / 2 - 1.5), z, "scroll", 0, 1.05));
    }
  }
  out.push(prop("bin", -w / 2 + 3, AXIS.scrollPlazaZ + d / 2 - 3, "scroll"));
  out.push(prop("bin", w / 2 - 3, AXIS.scrollPlazaZ - d / 2 + 3, "scroll"));
  out.push(prop("noticeboard", -w / 2 + 5, AXIS.scrollPlazaZ - 6, "scroll", Math.PI / 2));
  out.push(prop("drain-grate", 0, AXIS.scrollPlazaZ + 6, "scroll"));
  out.push(prop("drain-grate", 0, AXIS.scrollPlazaZ - 6, "scroll"));

  // Library forecourt: benches (「閱讀的女孩」 sits on one), ramp, tactile route.
  for (let k = 0; k < 6; k++) {
    out.push(prop("bench", -12 + k * 8.4, AXIS.libraryFrontZ + 6.4, "library", Math.PI));
  }
  out.push(prop("ramp", LIBRARY.center[0] - 20, AXIS.libraryFrontZ + 1.6, "library", 0, 1, 14));
  out.push(prop("tactile-strip", 10, AXIS.libraryFrontZ + 9, "library", 0, 1, 16));
  out.push(prop("name-plate", 10, AXIS.libraryFrontZ - 0.2, "library", 0, 1.6));
  out.push(prop("bin", 20, AXIS.libraryFrontZ + 6, "library"));
  out.push(prop("bin", -2, AXIS.libraryFrontZ + 6, "library"));
  out.push(prop("utility-box", LIBRARY.center[0] + 26, AXIS.libraryFrontZ + 4, "library", -Math.PI / 2));
  out.push(prop("hydrant", -6, AXIS.libraryFrontZ + 4, "library"));
  for (let k = 0; k < 8; k++) {
    out.push(prop("planter", -18 + k * 5.4, AXIS.libraryFrontZ + 14, "library", 0, 1, 4.2));
  }
  return out;
}

/** Street lamps along the vehicle roads, derived from the road polylines. */
function roadLamps(): PropInstance[] {
  const out: PropInstance[] = [];
  for (const seg of PATH_SEGMENTS) {
    if (seg.surface !== "asphalt") continue;
    for (let i = 1; i < seg.points.length; i++) {
      const [ax, az] = seg.points[i - 1];
      const [bx, bz] = seg.points[i];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.floor(len / 26));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        const nx = -(bz - az) / len;
        const nz = (bx - ax) / len;
        const off = seg.width / 2 + 1.2;
        out.push(prop("street-lamp", x + nx * off, z + nz * off, "east", Math.atan2(nx, nz)));
      }
    }
  }
  return out;
}

export const PROPS: PropInstance[] = [
  ...kenanProps(),
  ...plazaProps(),
  ...avenueProps(),
  ...northProps(),
  ...roadLamps(),
];

export function propsOfKind(kind: PropKind): PropInstance[] {
  return PROPS.filter((p) => p.kind === kind);
}

export const PROP_KINDS: PropKind[] = Array.from(new Set(PROPS.map((p) => p.kind)));
