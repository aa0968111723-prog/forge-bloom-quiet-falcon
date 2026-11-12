import {
  AVENUE_PAVED_WIDTH,
  AVENUE_PLANTING_WIDTH,
  AXIS,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
} from "./axis.ts";
import { KENAN, KENAN_LANDING_Z, KENAN_TOP_Z, kenanDrainPositions } from "./kenan.ts";
import { LAMP_POLE, LIBRARY, PALACE, acUnits, benches, bins, bollards, lanternPosts, noticeboards, palaceHallZs, planters, pottedPlants, signPosts, utilityBoxes } from "./landmarks.ts";
import { COLLIDERS, registerPoleBoxes, type AABB } from "./colliders.ts";
import { sampleGroundElevation } from "./elevation.ts";
import { LIBRARY_RAMP, libraryRampLift } from "./library-ramp.ts";
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

/** Posts along a railing, local metres from the centre. Both ends are included. */
export function railingPostOffsets(length: number, spacing = 2) {
  const span = Math.max(length, 0.4);
  const count = Math.max(2, Math.round(span / spacing) + 1);
  const step = span / (count - 1);
  const half = span / 2;
  return Array.from({ length: count }, (_, i) => -half + i * step);
}

/** World XZ of a point `along` metres down a railing's local Z. */
export function railingPoint(x: number, z: number, rotationY: number, along: number) {
  return {
    x: x + along * Math.sin(rotationY),
    z: z + along * Math.cos(rotationY),
  };
}

/** Deck or skirt height under a railing post. The rail follows this, not a level line. */
export function railingSurfaceY(x: number, z: number) {
  return sampleGroundElevation(x, z) + libraryRampLift(x, z);
}

export function railingPostBases(rail: { x: number; z: number; rotationY: number; length?: number }) {
  return railingPostOffsets(rail.length ?? 1).map((along) => {
    const point = railingPoint(rail.x, rail.z, rail.rotationY, along);
    return { ...point, y: railingSurfaceY(point.x, point.z) };
  });
}

function kenanProps(): PropInstance[] {
  const out: PropInstance[] = [];
  const inner = KENAN.width / 2 - KENAN.gutterInset;
  // The stair component draws the drainage channels. The flights stay
  // rail-free; only the point-like grates are placed from here.
  for (const z of kenanDrainPositions()) {
    for (const s of [-1, 1] as const) out.push(prop("drain-grate", s * inner, z, "kenan"));
  }
  // Landing furniture — the place everybody stops to breathe.
  for (const seat of benches()) {
    if (seat.zone === "kenan") out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
  }
  for (const can of bins()) {
    if (can.zone === "kenan") out.push(prop("bin", can.x, can.z, can.zone));
  }
  for (const post of signPosts()) {
    if (post.zone === "kenan") out.push(prop("sign-post", post.x, post.z, post.zone, post.rotationY, post.scale));
  }
  for (const board of noticeboards()) {
    if (board.zone === "kenan") out.push(prop("noticeboard", board.x, board.z, board.zone, board.rotationY));
  }
  out.push(prop("tactile-strip", 0, AXIS.gateZ + 2.4, "kenan", 0, 1, 5.2));
  out.push(prop("hydrant", -5.9, AXIS.gateZ + 4.2, "kenan"));
  for (const cabinet of utilityBoxes()) {
    if (cabinet.zone === "kenan") out.push(prop("utility-box", cabinet.x, cabinet.z, cabinet.zone, cabinet.rotationY));
  }
  for (const post of bollards()) {
    if (post.zone === "kenan") out.push(prop("bollard", post.x, post.z, post.zone, post.rot));
  }
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
  for (const seat of benches()) {
    if (seat.zone === "plaza") out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
  }
  for (const can of bins()) {
    if (can.zone === "plaza") out.push(prop("bin", can.x, can.z, can.zone));
  }
  for (const post of signPosts()) {
    if (post.zone === "plaza") out.push(prop("sign-post", post.x, post.z, post.zone, post.rotationY, post.scale));
  }
  for (const pot of pottedPlants()) {
    if (pot.zone === "plaza") out.push(prop("potted-plant", pot.x, pot.z, pot.zone));
  }
  return out;
}

function avenueProps(): PropInstance[] {
  const out: PropInstance[] = [];
  for (const post of lanternPosts()) out.push(prop("lantern-post", post.x, post.z, "avenue", 0));
  // Hall-front furniture: name plate, potted plants, AC units on the back wall.
  for (const z of palaceHallZs()) {
    for (const s of [-1, 1] as const) {
      for (const pot of pottedPlants()) {
        if (pot.zone === "avenue" && Math.sign(pot.x) === s && (pot.z === z + 4.2 || pot.z === z - 4.2)) {
          out.push(prop("potted-plant", pot.x, pot.z, pot.zone));
        }
      }
      for (const unit of acUnits()) {
        if ((unit.z === z + 6.5 || unit.z === z - 6.5) && Math.sign(unit.x) === s) {
          out.push(prop("ac-unit", unit.x, unit.z, unit.zone, unit.rotationY));
        }
      }
      for (const seat of benches()) {
        if (seat.zone === "avenue" && seat.z === z + 9 && Math.sign(seat.x) === s) {
          out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
        }
      }
      for (const can of bins()) {
        if (can.zone === "avenue" && can.z === z - 11 && Math.sign(can.x) === s) {
          out.push(prop("bin", can.x, can.z, can.zone));
        }
      }
    }
  }
  for (const bed of planters()) {
    if (bed.zone === "avenue") out.push(prop("planter", bed.x, bed.z, bed.zone, bed.rotationY, 1, bed.length));
  }
  for (let k = 0; k < 5; k++) {
    const z = AXIS.avenueSouthZ - 22 - k * 42;
    out.push(prop("drain-grate", -(AVENUE_PAVED_WIDTH / 2 + 0.18), z, "avenue"));
    out.push(prop("drain-grate", AVENUE_PAVED_WIDTH / 2 + 0.18, z, "avenue"));
    out.push(prop("hydrant", -(AVENUE_PAVED_WIDTH / 2 + 3.9), z - 6, "avenue"));
    for (const cabinet of utilityBoxes()) {
      if (cabinet.zone === "avenue" && cabinet.z === z + 8) {
        out.push(prop("utility-box", cabinet.x, cabinet.z, cabinet.zone, cabinet.rotationY));
      }
    }
  }
  for (const post of signPosts()) {
    if (post.zone === "avenue") out.push(prop("sign-post", post.x, post.z, post.zone, post.rotationY, post.scale));
  }
  return out;
}

function northProps(): PropInstance[] {
  const out: PropInstance[] = [];
  // Roundabout: kerb bollards, lamps, signage.
  for (const post of bollards()) {
    if (post.zone === "dolphin") out.push(prop("bollard", post.x, post.z, post.zone, post.rot));
  }
  for (const [x, z] of [
    [-13, AXIS.dolphinZ + 12],
    [13, AXIS.dolphinZ + 12],
    [-13, AXIS.dolphinZ - 12],
    [13, AXIS.dolphinZ - 12],
  ] as const) {
    out.push(prop("street-lamp", x, z, "dolphin", 0, 1.1));
  }
  for (const post of signPosts()) {
    if (post.zone === "dolphin") out.push(prop("sign-post", post.x, post.z, post.zone, post.rotationY, post.scale));
  }

  const [w, d] = SCROLL_PLAZA_SIZE;
  for (let k = 0; k < 6; k++) {
    const z = AXIS.scrollPlazaZ + d / 2 - 4 - k * ((d - 8) / 5);
    for (const s of [-1, 1] as const) {
      for (const seat of benches()) {
        if (seat.zone === "scroll" && seat.z === z && Math.sign(seat.x) === s) {
          out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
        }
      }
      out.push(prop("street-lamp", s * (w / 2 - 1.5), z, "scroll", 0, 1.05));
    }
  }
  for (const can of bins()) {
    if (can.zone === "scroll") out.push(prop("bin", can.x, can.z, can.zone));
  }
  for (const board of noticeboards()) {
    if (board.zone === "scroll") out.push(prop("noticeboard", board.x, board.z, board.zone, board.rotationY));
  }
  out.push(prop("drain-grate", 0, AXIS.scrollPlazaZ + 6, "scroll"));
  out.push(prop("drain-grate", 0, AXIS.scrollPlazaZ - 6, "scroll"));

  // Library forecourt: benches (「閱讀的女孩」 sits on the west one at x=-12), ramp, tactile route.
  for (const seat of benches()) {
    if (seat.zone === "library") out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
  }
  out.push(prop("ramp", LIBRARY_RAMP.x, LIBRARY_RAMP.z, "library", 0, 1, LIBRARY_RAMP.length));
  for (const side of [-1, 1] as const) {
    out.push(prop("railing", LIBRARY_RAMP.x + side * 0.95, LIBRARY_RAMP.z, "library", 0, 1, LIBRARY_RAMP.length));
  }
  out.push(prop("tactile-strip", 10, AXIS.libraryFrontZ + 9, "library", 0, 1, 16));
  out.push(prop("name-plate", 10, AXIS.libraryFrontZ + 0.15, "library", Math.PI / 2, 1.6));
  for (const can of bins()) {
    if (can.zone === "library") out.push(prop("bin", can.x, can.z, can.zone));
  }
  for (const cabinet of utilityBoxes()) {
    if (cabinet.zone === "library") out.push(prop("utility-box", cabinet.x, cabinet.z, cabinet.zone, cabinet.rotationY));
  }
  out.push(prop("hydrant", -6, AXIS.libraryFrontZ + 4, "library"));
  for (const bed of planters()) {
    if (bed.zone === "library") out.push(prop("planter", bed.x, bed.z, bed.zone, bed.rotationY, 1, bed.length));
  }
  return out;
}

/** Slide a point out of every solid, leaving `margin` metres of clear air. */
export function clearOfSolids(x: number, z: number, margin = 1.2) {
  let px = x;
  let pz = z;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const box of COLLIDERS) {
      if (px <= box.minX - margin || px >= box.maxX + margin || pz <= box.minZ - margin || pz >= box.maxZ + margin) continue;
      const left = px - (box.minX - margin);
      const right = box.maxX + margin - px;
      const down = pz - (box.minZ - margin);
      const up = box.maxZ + margin - pz;
      const nearest = Math.min(left, right, down, up);
      if (nearest === left) px = box.minX - margin;
      else if (nearest === right) px = box.maxX + margin;
      else if (nearest === down) pz = box.minZ - margin;
      else pz = box.maxZ + margin;
      moved = true;
    }
    if (!moved) break;
  }
  return { x: px, z: pz };
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
        const cleared = clearOfSolids(x + nx * off, z + nz * off);
        out.push(prop("street-lamp", cleared.x, cleared.z, "east", Math.atan2(nx, nz)));
      }
    }
  }
  return out;
}

function campusClusterProps(): PropInstance[] {
  const out: PropInstance[] = [];
  const eastLamps: [number, number][] = [
    [64, 8],
    [64, -40],
    [80, -90],
    [130, -90],
    [166, -90],
    [180, -160],
    [180, -210],
  ];
  for (const [x, z] of eastLamps) {
    out.push(prop("street-lamp", x + 2.2, z, "east", 0));
    for (const seat of benches()) {
      if (seat.zone === "east" && seat.x === x - 2.4 && seat.z === z) {
        out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
      }
    }
  }
  const westLamps: [number, number][] = [
    [-70, 8],
    [-70, -48],
    [-70, -160],
    [-52, -260],
  ];
  for (const [x, z] of westLamps) {
    out.push(prop("street-lamp", x + 2.2, z, "west-academic", 0));
    for (const seat of benches()) {
      if (seat.zone === "west-academic" && seat.x === x - 2.4 && seat.z === z) {
        out.push(prop("bench", seat.x, seat.z, seat.zone, seat.rotationY));
      }
    }
  }
  for (const board of noticeboards()) {
    if (board.zone === "east" || board.zone === "west-academic") {
      out.push(prop("noticeboard", board.x, board.z, board.zone, board.rotationY));
    }
  }
  for (const can of bins()) {
    if (can.zone === "east" || can.zone === "west-academic") out.push(prop("bin", can.x, can.z, can.zone));
  }
  return out;
}

export const PROPS: PropInstance[] = [
  ...kenanProps(),
  ...plazaProps(),
  ...avenueProps(),
  ...northProps(),
  ...roadLamps(),
  ...campusClusterProps(),
];

registerPoleBoxes(
  PROPS.filter((item) => item.kind === "street-lamp").map(
    (item): AABB => ({
      minX: item.x - LAMP_POLE.diameter / 2,
      maxX: item.x + LAMP_POLE.diameter / 2,
      minZ: item.z - LAMP_POLE.diameter / 2,
      maxZ: item.z + LAMP_POLE.diameter / 2,
    }),
  ),
);

/** West forecourt bench, clear of the library ramp. The statue sits here. */
export const READING_GIRL_SEAT = { x: -12, z: AXIS.libraryFrontZ + 6.4 } as const;

export function propsOfKind(kind: PropKind): PropInstance[] {
  return PROPS.filter((p) => p.kind === kind);
}

export const PROP_KINDS: PropKind[] = Array.from(new Set(PROPS.map((p) => p.kind)));
