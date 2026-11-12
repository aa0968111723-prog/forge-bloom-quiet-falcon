import {
  AVENUE_LENGTH,
  AVENUE_PAVED_WIDTH,
  AVENUE_PLANTING_WIDTH,
  AXIS,
  DOLPHIN_ISLAND_RADIUS,
  PLAZA_ELEVATION,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
} from "./axis.ts";
import { sampleGroundElevation } from "./elevation.ts";
import { KENAN, KENAN_LANDING_ELEVATION, KENAN_LANDING_Z, KENAN_TOTAL_RISE, KENAN_TOTAL_RUN } from "./kenan.ts";
import type { Accuracy, RealCoordinate } from "./origin.ts";

/**
 * Reality landmark records.
 *
 * `worldPosition` is the physical anchor of the thing itself (statue plinth,
 * building centre, stair foot). `interact` is the pilgrimage stamp point, which
 * is often somewhere else — you stamp 克難坡 on the mid landing, not at the
 * bottom gate.
 *
 * `accuracy` is the weakest link of the record, never the best one: a landmark
 * whose position is `estimated` stays `estimated` even if its step count is
 * documented. Reality Compare Mode (F8) prints it, and the world-data tests
 * assert it can never exceed what its references support.
 */
export type RealityLandmark = {
  id: string;
  name: string;
  nameEn: string;
  year: string;
  blurb: string;
  /** Physical anchor of the landmark, in metres. */
  worldPosition: [number, number, number];
  /** Facing, radians about +Y. 0 faces north (-Z). */
  rotationY: number;
  /** Finished ground level at the anchor, relative to the local datum. */
  elevation: number;
  realCoordinate?: RealCoordinate;
  /** Real extent across the axis (east–west for the corridor landmarks). */
  realWidth?: number;
  /** Real extent along the axis (north–south for the corridor landmarks). */
  realLength?: number;
  realHeight?: number;
  /** Plan outline in world XZ, when a rectangle is not good enough. */
  footprint?: [number, number][];
  accuracy: Accuracy;
  referenceIds: string[];
  /** Zone this landmark belongs to; drives streaming and LOD. */
  zone: string;
  /** Where the player stamps it. */
  interact: { x: number; z: number; radius: number };
  mapColor: string;
  /** Extra dimensions worth comparing against reality, shown by F8. */
  metrics?: { label: string; real: number; unit: string; accuracy: Accuracy }[];
};

/** Axis-aligned rectangle footprint helper. */
export function rectFootprint(
  cx: number,
  cz: number,
  width: number,
  length: number,
): [number, number][] {
  const hw = width / 2;
  const hl = length / 2;
  return [
    [cx - hw, cz - hl],
    [cx + hw, cz - hl],
    [cx + hw, cz + hl],
    [cx - hw, cz + hl],
  ];
}

/** Library block: centre, size and storey count. */
export const LIBRARY = {
  center: [18, AXIS.libraryCenterZ] as const,
  width: 66,
  length: 42,
  floors: 9,
  floorHeight: 4.0,
} as const;

/** The two porch columns under the library canopy, in world XZ. */
export function libraryPorchPosts(): { x: number; z: number }[] {
  return ([-1, 1] as const).map((side) => ({
    x: LIBRARY.center[0] - 8 + side * 8,
    z: LIBRARY.center[1] + LIBRARY.length / 2 + 3.4,
  }));
}

/** The paved plinth sticks out this far past each wall. The mesh is 1.1 m tall, above a step. */
export const LIBRARY_BASE_MARGIN = 2.5;

/**
 * 「閱讀的女孩」 on the west forecourt bench, clear of the ramp.
 * The seat is wide enough that one dodge stays on the near side.
 */
export const READING_GIRL = {
  x: -12,
  z: AXIS.libraryFrontZ + 6.4,
  pad: 1.4,
} as const;

/**
 * 宮燈教室 rows: five halls a side, mirrored about the avenue.
 *
 * Single-storey halls whose green glazed roof carries about half the
 * elevation — the proportion that makes them read as 宮燈教室 rather than a
 * generic red block (REF_PALACE_CLASSROOMS_1954, photographic).
 */
export const PALACE = {
  hallWidth: 28,
  hallDepth: 12,
  halls: 5,
  pitch: 38,
  /** Centre Z of the southern-most hall pair. */
  firstZ: AXIS.avenueSouthZ - 24,
  /** Distance from the avenue centreline to the hall centre. */
  offsetX: 10.5 + 12 / 2,
  storeys: 1,
  storeyHeight: 4.3,
} as const;

export function palaceHallZs(): number[] {
  return Array.from({ length: PALACE.halls }, (_, i) => PALACE.firstZ - i * PALACE.pitch);
}

/** Stone base of a 宮燈, matching the avenue lantern cylinder. */
export const LANTERN_BASE = 0.8;

/** World XZ of the avenue lanterns. West row on the 12 m grid, east row half a step north. */
export function lanternPosts(): { x: number; z: number }[] {
  const lampX = AVENUE_PAVED_WIDTH / 2 + AVENUE_PLANTING_WIDTH * 0.45;
  const spacing = 12;
  const posts: { x: number; z: number }[] = [];
  for (let z = AXIS.avenueSouthZ - 4; z > AXIS.avenueNorthZ + 2; z -= spacing) {
    posts.push({ x: -lampX, z });
    posts.push({ x: lampX, z: z - spacing / 2 });
  }
  return posts;
}

/** Colonnade columns in front of each hall. The collider uses the same points. */
export function palaceColumns(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const width = PALACE.hallWidth;
  const depth = PALACE.hallDepth;
  for (const z of palaceHallZs()) {
    for (const facing of [-1, 1] as const) {
      const cx = facing * PALACE.offsetX;
      const front = -facing;
      const colX = cx + front * (depth / 2 + 1.55);
      for (let i = 0; i < 8; i++) {
        out.push({
          x: colX,
          z: z - width / 2 + 1.6 + i * ((width - 3.2) / 7),
        });
      }
    }
  }
  return out;
}

/** 水源街校門. The beam is overhead, so only the two piers stop a body. */
export const CAMPUS_GATE = {
  z: AXIS.gateZ + 6,
  halfSpan: 4.6,
  pier: 1.0,
} as const;

/** Bollard shaft diameter, matching the concrete cylinder's base radius of 0.11 m. */
export const BOLLARD = { diameter: 0.22 } as const;

/** The twelve kerb bollards, in world XZ. The mesh and the collider both use this list. */
export function bollards(): { x: number; z: number; rot: number; zone: string }[] {
  const posts = [
    { x: -2.2, z: AXIS.gateZ + 1.2, rot: 0, zone: "kenan" },
    { x: 2.2, z: AXIS.gateZ + 1.2, rot: 0, zone: "kenan" },
  ];
  for (let a = 0; a < 10; a++) {
    const t = (a / 10) * Math.PI * 2;
    posts.push({
      x: Math.sin(t) * DOLPHIN_ISLAND_RADIUS,
      z: AXIS.dolphinZ + Math.cos(t) * DOLPHIN_ISLAND_RADIUS,
      rot: t,
      zone: "dolphin",
    });
  }
  return posts;
}

/** Street-lamp pole diameter, matching the shaft's base radius of 0.09 m. The arm is above head height. */
export const LAMP_POLE = { diameter: 0.18 } as const;

/** Painted board depth and the frame added around the text. */
export const TEXT_SIGN_DEPTH = 0.06;
export const TEXT_SIGN_FRAME = 0.08;

export type TextSign = {
  id: string;
  map: "kenan" | "kenanSteps" | "avenue" | "wayfinding";
  x: number;
  z: number;
  rot: number;
  boardW: number;
  boardH: number;
  postHeight: number;
};

/** Named boards along the corridor. The mesh and the collider both use this list. */
export function textSigns(): TextSign[] {
  return [
    { id: "kenan-bottom", map: "kenan", x: -5.2, z: KENAN.bottomZ + 3, rot: Math.PI / 8, boardW: 1.05, boardH: 0.42, postHeight: 1.5 },
    { id: "kenan-steps", map: "kenanSteps", x: 5.2, z: KENAN.bottomZ + 4, rot: -Math.PI / 8, boardW: 1.35, boardH: 0.4, postHeight: 1.5 },
    { id: "kenan-landing", map: "kenan", x: -5.4, z: KENAN_LANDING_Z[0] - 3, rot: Math.PI / 2.4, boardW: 0.95, boardH: 0.38, postHeight: 1.2 },
    { id: "avenue", map: "avenue", x: -4.4, z: AXIS.avenueSouthZ - 3, rot: Math.PI / 6, boardW: 1.3, boardH: 0.42, postHeight: 1.5 },
    { id: "library-way", map: "wayfinding", x: 5.0, z: AXIS.avenueNorthZ - 4, rot: -Math.PI / 7, boardW: 1.15, boardH: 0.42, postHeight: 1.9 },
  ];
}

/** Axis-aligned footprint of a yawed board, including its frame. */
export function textSignAabb(sign: TextSign): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const w = sign.boardW + TEXT_SIGN_FRAME;
  const d = TEXT_SIGN_DEPTH;
  const c = Math.abs(Math.cos(sign.rot));
  const s = Math.abs(Math.sin(sign.rot));
  const hx = (w * c + d * s) / 2;
  const hz = (w * s + d * c) / 2;
  return { minX: sign.x - hx, maxX: sign.x + hx, minZ: sign.z - hz, maxZ: sign.z + hz };
}

/** Noticeboard face: 1.9 m across and thick enough that a body cannot step through. */
export const NOTICEBOARD = { width: 1.9, depth: 0.16 } as const;

/** The four campus noticeboards, in world XZ. The mesh and the collider both use this list. */
export function noticeboards(): { x: number; z: number; rotationY: number; zone: string }[] {
  return [
    { x: 5.1, z: KENAN.bottomZ + 5.6, rotationY: -Math.PI / 2, zone: "kenan" },
    { x: -SCROLL_PLAZA_SIZE[0] / 2 + 5, z: AXIS.scrollPlazaZ - 6, rotationY: Math.PI / 2, zone: "scroll" },
    { x: 130, z: -82, rotationY: 0, zone: "east" },
    { x: -88, z: -24, rotationY: 0, zone: "west-academic" },
  ];
}

/** Axis-aligned footprint of a rotated noticeboard. */
export function noticeboardFootprint(board: { x: number; z: number; rotationY: number }) {
  const along = Math.abs(Math.cos(board.rotationY));
  const across = Math.abs(Math.sin(board.rotationY));
  return {
    x: board.x,
    z: board.z,
    width: NOTICEBOARD.width * along + NOTICEBOARD.depth * across,
    depth: NOTICEBOARD.width * across + NOTICEBOARD.depth * along,
  };
}

/** Utility cabinet footprint, matching the prop mesh. */
export const UTILITY_BOX = { width: 0.9, depth: 0.5 } as const;

/** The seven campus utility cabinets, in world XZ. The mesh and the collider both use this list. */
export function utilityBoxes(): { x: number; z: number; rotationY: number; zone: string }[] {
  const boxes = [{ x: 6.2, z: AXIS.gateZ + 6.4, rotationY: -Math.PI / 2, zone: "kenan" }];
  for (let k = 0; k < 5; k++) {
    const z = AXIS.avenueSouthZ - 22 - k * 42;
    boxes.push({ x: AVENUE_PAVED_WIDTH / 2 + 4.2, z: z + 8, rotationY: -Math.PI / 2, zone: "avenue" });
  }
  boxes.push({ x: LIBRARY.center[0] + 26, z: AXIS.libraryFrontZ + 4, rotationY: -Math.PI / 2, zone: "library" });
  return boxes;
}

/** Axis-aligned footprint of a rotated utility cabinet. */
export function utilityBoxFootprint(box: { x: number; z: number; rotationY: number }) {
  const along = Math.abs(Math.cos(box.rotationY));
  const across = Math.abs(Math.sin(box.rotationY));
  return {
    x: box.x,
    z: box.z,
    width: UTILITY_BOX.width * along + UTILITY_BOX.depth * across,
    depth: UTILITY_BOX.width * across + UTILITY_BOX.depth * along,
  };
}

/** Concrete planter trough. Length runs along Z when rotation is 0. */
export const PLANTER = { width: 0.8 } as const;

/** Avenue and library planters, in world XZ. The mesh and the collider both use this list. */
export function planters(): { x: number; z: number; rotationY: number; length: number; zone: string }[] {
  const beds = [];
  for (const z of palaceHallZs()) {
    for (const side of [-1, 1] as const) {
      // The west trough at the second hall sits south of the door. The colonnade
      // leaves a step narrower than the 2 m walk grid, so the trough stays off that step.
      const doorHall = z === PALACE.firstZ - PALACE.pitch && side < 0;
      beds.push({
        x: side * (AVENUE_PAVED_WIDTH / 2 + 2.6),
        z: doorHall ? z + 3 : z,
        rotationY: 0,
        length: doorHall ? 3.6 : 6,
        zone: "avenue",
      });
    }
  }
  const rampX = LIBRARY.center[0] - 20;
  // South of the ramp lip and of the standing point just past it.
  const rampSouth = LIBRARY.center[1] + LIBRARY.length / 2 + 7.4 + 7 + 3.9;
  for (let k = 0; k < 8; k++) {
    const x = -18 + k * 5.4;
    const crossesRamp = Math.abs(x - rampX) < 1.7;
    beds.push({
      x,
      z: crossesRamp ? rampSouth : AXIS.libraryFrontZ + 14,
      rotationY: 0,
      length: 4.2,
      zone: "library",
    });
  }
  return beds;
}

/** Axis-aligned footprint of a rotated planter. */
export function planterFootprint(bed: { x: number; z: number; rotationY: number; length: number }) {
  const along = Math.abs(Math.cos(bed.rotationY));
  const across = Math.abs(Math.sin(bed.rotationY));
  return {
    x: bed.x,
    z: bed.z,
    width: PLANTER.width * along + bed.length * across,
    depth: PLANTER.width * across + bed.length * along,
  };
}

/** Bench seat: 1.7 m wide and 0.5 m deep before yaw. */
export const BENCH = { width: 1.7, depth: 0.5 } as const;

/** Every campus bench, in world XZ. The mesh and the collider both use this list. */
export function benches(): { x: number; z: number; rotationY: number; zone: string }[] {
  const seats = [
    { x: -2.7, z: KENAN_LANDING_Z[0] - 2.2, rotationY: 0, zone: "kenan" },
    { x: 2.7, z: KENAN_LANDING_Z[0] - 2.2, rotationY: Math.PI, zone: "kenan" },
  ];
  for (let a = 0; a < 6; a++) {
    const t = Math.PI * 0.55 + (a / 6) * Math.PI * 0.9;
    seats.push({
      x: Math.sin(t) * (PLAZA_RADIUS - 2.4),
      z: Math.cos(t) * (PLAZA_RADIUS - 2.4),
      rotationY: t + Math.PI,
      zone: "plaza",
    });
  }
  for (const z of palaceHallZs()) {
    for (const side of [-1, 1] as const) {
      seats.push({
        x: side * (AVENUE_PAVED_WIDTH / 2 + 1.4),
        z: z + 9,
        rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        zone: "avenue",
      });
    }
  }
  const [width, depth] = SCROLL_PLAZA_SIZE;
  for (let k = 0; k < 6; k++) {
    const z = AXIS.scrollPlazaZ + depth / 2 - 4 - k * ((depth - 8) / 5);
    for (const side of [-1, 1] as const) {
      seats.push({
        x: side * (width / 2 - 4.5),
        z,
        rotationY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
        zone: "scroll",
      });
    }
  }
  // The seat that used to sit at x=-3.6 crossed the ramp skirt. It stays at x=-4.8.
  for (const x of [-12, -4.8, 4.8, 13.2, 21.6, 30]) {
    seats.push({
      x,
      z: AXIS.libraryFrontZ + 6.4,
      rotationY: Math.PI,
      zone: "library",
    });
  }
  const clusters = [
    [64, 8],
    [64, -40],
    [80, -90],
    [130, -90],
    [166, -90],
    [180, -160],
    [180, -210],
    [-70, 8],
    [-70, -48],
    [-70, -160],
    [-52, -260],
  ] as const;
  for (const [x, z] of clusters) {
    seats.push({ x: x - 2.4, z, rotationY: Math.PI / 2, zone: x > 0 ? "east" : "west-academic" });
  }
  return seats;
}

/** Axis-aligned footprint of a rotated bench. */
export function benchFootprint(seat: { x: number; z: number; rotationY: number }) {
  const along = Math.abs(Math.cos(seat.rotationY));
  const across = Math.abs(Math.sin(seat.rotationY));
  return {
    x: seat.x,
    z: seat.z,
    width: BENCH.width * along + BENCH.depth * across,
    depth: BENCH.width * across + BENCH.depth * along,
  };
}


/** Trash bin diameter, matching the prop cylinder. */
export const BIN = { diameter: 0.56 } as const;

/**
 * Every campus bin, in world XZ. The mesh and the collider both use this list.
 * The ramp bin uses the same ramp origin as `LIBRARY_RAMP` (centreX-20, south face + 7.4, length 14).
 */
export function bins(): { x: number; z: number; zone: string }[] {
  const cans = [
    { x: 3.3, z: KENAN_LANDING_Z[1] + 1.2, zone: "kenan" },
    { x: PLAZA_RADIUS - 1.6, z: -4.2, zone: "plaza" },
  ];
  for (const z of palaceHallZs()) {
    for (const side of [-1, 1] as const) {
      cans.push({ x: side * (AVENUE_PAVED_WIDTH / 2 + 1.5), z: z - 11, zone: "avenue" });
    }
  }
  const [width, depth] = SCROLL_PLAZA_SIZE;
  cans.push({ x: -width / 2 + 3, z: AXIS.scrollPlazaZ + depth / 2 - 3, zone: "scroll" });
  cans.push({ x: width / 2 - 3, z: AXIS.scrollPlazaZ - depth / 2 + 3, zone: "scroll" });
  cans.push({ x: 20, z: AXIS.libraryFrontZ + 6, zone: "library" });
  const rampX = LIBRARY.center[0] - 20;
  const rampZ = LIBRARY.center[1] + LIBRARY.length / 2 + 7.4;
  cans.push({ x: rampX - 3.4, z: rampZ + 14 / 2 + 1.2, zone: "library" });
  cans.push({ x: 128, z: -84, zone: "east" });
  cans.push({ x: -86, z: -26, zone: "west-academic" });
  return cans;
}

/** Outdoor AC cabinet, matching the prop box. */
export const AC_UNIT = { width: 0.84, depth: 0.32 } as const;

/** The twenty cabinets on the back walls of 宮燈教室. The mesh and the collider both use this list. */
export function acUnits(): { x: number; z: number; rotationY: number; zone: string }[] {
  const units = [];
  for (const z of palaceHallZs()) {
    for (const side of [-1, 1] as const) {
      const x = side * (PALACE.offsetX + PALACE.hallDepth / 2 + 0.4);
      const rotationY = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      units.push({ x, z: z + 6.5, rotationY, zone: "avenue" });
      units.push({ x, z: z - 6.5, rotationY, zone: "avenue" });
    }
  }
  return units;
}

/** Axis-aligned footprint of a rotated AC cabinet. */
export function acUnitFootprint(unit: { x: number; z: number; rotationY: number }) {
  const along = Math.abs(Math.cos(unit.rotationY));
  const across = Math.abs(Math.sin(unit.rotationY));
  return {
    x: unit.x,
    z: unit.z,
    width: AC_UNIT.width * along + AC_UNIT.depth * across,
    depth: AC_UNIT.width * across + AC_UNIT.depth * along,
  };
}

/** Campus direction sign. The board is 1.15 m wide before scale. */
export const SIGN_POST = { width: 1.15, depth: 0.16 } as const;

/** The nine direction signs, in world XZ. The mesh and the collider both use this list. */
export function signPosts(): { x: number; z: number; rotationY: number; scale: number; zone: string }[] {
  const posts = [
    { x: -3.4, z: KENAN_LANDING_Z[1] + 1, rotationY: Math.PI / 2, scale: 1, zone: "kenan" },
    { x: -4.6, z: KENAN.bottomZ + 3.4, rotationY: Math.PI / 2, scale: 1.15, zone: "kenan" },
    { x: -4.2, z: -PLAZA_RADIUS + 1.2, rotationY: 0, scale: 1.1, zone: "plaza" },
    { x: -12, z: AXIS.dolphinZ + 16, rotationY: 0, scale: 1.2, zone: "dolphin" },
  ];
  for (let k = 0; k < 5; k++) {
    const z = AXIS.avenueSouthZ - 22 - k * 42;
    posts.push({
      x: -(AVENUE_PAVED_WIDTH / 2 + 1.1),
      z: z + 16,
      rotationY: 0,
      scale: 1,
      zone: "avenue",
    });
  }
  return posts;
}

/** Axis-aligned footprint of a rotated direction sign. */
export function signFootprint(post: { x: number; z: number; rotationY: number; scale: number }) {
  const along = Math.abs(Math.cos(post.rotationY));
  const across = Math.abs(Math.sin(post.rotationY));
  const width = SIGN_POST.width * post.scale;
  const depth = SIGN_POST.depth * post.scale;
  return {
    x: post.x,
    z: post.z,
    width: width * along + depth * across,
    depth: width * across + depth * along,
  };
}

export const LANDMARKS: RealityLandmark[] = [
  {
    id: "kenan",
    name: "克難坡",
    nameEn: "Ke-nan Slope",
    year: "1953",
    blurb:
      "一百三十二階陡坡，是淡江草創時進入校園的必經要道。它象徵篳路藍縷、以啟山林，也是校訓「樸實剛毅」最具體的體能課。每學年開學典禮，師生仍會重走這段巡禮。",
    worldPosition: [0, 0, AXIS.gateZ - 4],
    rotationY: 0,
    elevation: 0,
    realWidth: KENAN.width,
    realLength: KENAN_TOTAL_RUN,
    realHeight: KENAN_TOTAL_RISE,
    accuracy: "estimated",
    referenceIds: ["REF_KENAN_STEP_COUNT", "REF_KENAN_TWO_FLIGHTS", "REF_STAIR_TYPICAL_RISE"],
    zone: "kenan",
    interact: { x: 0, z: (KENAN.bottomZ - KENAN.flightSteps[0] * KENAN.tread) - 3, radius: 9 },
    mapColor: "#cfc4b0",
    metrics: [
      { label: "階數", real: KENAN.stepCount, unit: "階", accuracy: "mapped" },
      { label: "總爬升", real: KENAN_TOTAL_RISE, unit: "m", accuracy: "estimated" },
      { label: "階高", real: KENAN.riser, unit: "m", accuracy: "estimated" },
      { label: "踏面", real: KENAN.tread, unit: "m", accuracy: "estimated" },
      { label: "梯寬", real: KENAN.width, unit: "m", accuracy: "estimated" },
      { label: "平台高程", real: KENAN_LANDING_ELEVATION, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "statue",
    name: "驚聲銅像廣場",
    nameEn: "Ching-sheng Plaza",
    year: "—",
    blurb:
      "克難坡頂的圓形廣場，紀念創辦人張建邦之父張驚聲先生。看台仿羅馬階梯，基座題「功在作人」。夜間靜謐，是許多淡江人的第一個校園記憶點。",
    worldPosition: [0, PLAZA_ELEVATION, 0],
    rotationY: 0,
    elevation: PLAZA_ELEVATION,
    realWidth: PLAZA_RADIUS * 2,
    realLength: PLAZA_RADIUS * 2,
    realHeight: 3.4,
    accuracy: "estimated",
    referenceIds: ["REF_CHINGSHENG_STATUE", "REF_AXIS_STRAIGHT_ASSUMPTION"],
    zone: "plaza",
    // South of the plinth, where you actually stand when you arrive off the
    // slope — the plinth itself is solid.
    interact: { x: 0, z: 5.6, radius: 8.4 },
    mapColor: "#b9a078",
    metrics: [
      { label: "廣場直徑", real: PLAZA_RADIUS * 2, unit: "m", accuracy: "estimated" },
      { label: "銅像含基座高", real: 3.4, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "palace",
    name: "宮燈教室",
    nameEn: "Palace Classrooms",
    year: "1954",
    blurb:
      "碧瓦紅牆、迴廊朱柱，是淡水校園永久校舍的起點，也是「中學為體、西學為用」的建築宣言。教室沿宮燈大道兩側展開，比鄰仿宋代庭園「覺軒」，無數偶像劇在此取景。",
    worldPosition: [-PALACE.offsetX, sampleGroundElevation(-PALACE.offsetX, PALACE.firstZ), PALACE.firstZ],
    rotationY: Math.PI / 2,
    elevation: sampleGroundElevation(-PALACE.offsetX, PALACE.firstZ),
    realWidth: PALACE.hallDepth,
    realLength: PALACE.hallWidth,
    realHeight: PALACE.storeys * PALACE.storeyHeight + 3.4,
    footprint: rectFootprint(-PALACE.offsetX, PALACE.firstZ, PALACE.hallDepth, PALACE.hallWidth),
    accuracy: "estimated",
    referenceIds: ["REF_PALACE_CLASSROOMS_1954", "REF_PALACE_ARRANGEMENT"],
    zone: "avenue",
    interact: { x: -9.4, z: PALACE.firstZ, radius: 8 },
    mapColor: "#c45c4a",
    metrics: [
      { label: "單棟長度", real: PALACE.hallWidth, unit: "m", accuracy: "estimated" },
      { label: "單棟進深", real: PALACE.hallDepth, unit: "m", accuracy: "estimated" },
      { label: "層數", real: PALACE.storeys, unit: "層", accuracy: "estimated" },
      { label: "每側棟數", real: PALACE.halls, unit: "棟", accuracy: "estimated" },
    ],
  },
  {
    id: "lantern",
    name: "宮燈大道",
    nameEn: "Lantern Avenue",
    year: "—",
    blurb:
      "長約二百公尺的石板步道，宮燈教室夾道、宮燈低垂，西望淡水河夕照。是新淡水八景、校友返校必訪，也是台灣偶像劇最愛的校園場景。",
    worldPosition: [0, sampleGroundElevation(0, AXIS.avenueSouthZ - AVENUE_LENGTH / 2), AXIS.avenueSouthZ - AVENUE_LENGTH / 2],
    rotationY: 0,
    elevation: sampleGroundElevation(0, AXIS.avenueSouthZ - AVENUE_LENGTH / 2),
    realWidth: AVENUE_PAVED_WIDTH,
    realLength: AVENUE_LENGTH,
    accuracy: "estimated",
    referenceIds: ["REF_LANTERN_AVENUE_LENGTH", "REF_AXIS_STRAIGHT_ASSUMPTION", "REF_PLATEAU_ASSUMPTION"],
    zone: "avenue",
    interact: { x: 0, z: AXIS.avenueSouthZ - AVENUE_LENGTH / 2, radius: 10 },
    mapColor: "#d9783a",
    metrics: [
      { label: "全長", real: AVENUE_LENGTH, unit: "m", accuracy: "mapped" },
      { label: "鋪面寬", real: AVENUE_PAVED_WIDTH, unit: "m", accuracy: "estimated" },
      { label: "南北高差", real: 2.97, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "dolphin",
    name: "海豚里程碑",
    nameEn: "Dolphin Milestone",
    year: "—",
    blurb:
      "宮燈大道北端圓環，雕塑家王秀杞作品。海豚由全校同學票選為吉祥物，象徵智慧與遨遊四海。基座鐫刻張創辦人勉詞：「立足淡江，放眼世界，掌握資訊，開創未來」。",
    worldPosition: [0, sampleGroundElevation(0, AXIS.dolphinZ), AXIS.dolphinZ],
    rotationY: 0,
    elevation: sampleGroundElevation(0, AXIS.dolphinZ),
    realWidth: DOLPHIN_ISLAND_RADIUS * 2,
    realLength: DOLPHIN_ISLAND_RADIUS * 2,
    realHeight: 3.6,
    accuracy: "estimated",
    referenceIds: ["REF_DOLPHIN_MILESTONE", "REF_AXIS_STRAIGHT_ASSUMPTION"],
    zone: "dolphin",
    // On the roundabout paving beside the island, not on top of the plinth.
    interact: { x: 6.6, z: AXIS.dolphinZ, radius: 8.4 },
    mapColor: "#7eb0c8",
    metrics: [
      { label: "圓環直徑", real: DOLPHIN_ISLAND_RADIUS * 2, unit: "m", accuracy: "estimated" },
      { label: "雕塑含基座高", real: 3.6, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "scroll",
    name: "書卷廣場",
    nameEn: "Scroll Plaza",
    year: "1986",
    blurb:
      "驚聲大樓與覺生紀念圖書館前的集會心臟。中央四片竹卷由校友林貴榮設計，象徵古代簡冊與校訓四字；俯瞰又像馬達轉軸。學生暱稱「蛋捲廣場」。",
    worldPosition: [0, sampleGroundElevation(0, AXIS.scrollPlazaZ), AXIS.scrollPlazaZ],
    rotationY: 0,
    elevation: sampleGroundElevation(0, AXIS.scrollPlazaZ),
    realWidth: SCROLL_PLAZA_SIZE[0],
    realLength: SCROLL_PLAZA_SIZE[1],
    realHeight: 7.2,
    footprint: rectFootprint(0, AXIS.scrollPlazaZ, SCROLL_PLAZA_SIZE[0], SCROLL_PLAZA_SIZE[1]),
    accuracy: "estimated",
    referenceIds: ["REF_SCROLL_PLAZA_1986", "REF_AXIS_STRAIGHT_ASSUMPTION"],
    zone: "scroll",
    interact: { x: 0, z: AXIS.scrollPlazaZ, radius: 11 },
    mapColor: "#d9c39a",
    metrics: [
      { label: "廣場寬", real: SCROLL_PLAZA_SIZE[0], unit: "m", accuracy: "estimated" },
      { label: "廣場深", real: SCROLL_PLAZA_SIZE[1], unit: "m", accuracy: "estimated" },
      { label: "書卷數", real: 4, unit: "片", accuracy: "mapped" },
      { label: "書卷高", real: 7.2, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "library",
    name: "覺生紀念圖書館",
    nameEn: "Chueh-sheng Library",
    year: "—",
    blurb:
      "牧羊草坪旁的九層開放式圖書館，順山勢而建，是淡江人引以為傲的知識地標。館前長椅上有「閱讀的女孩」雕像，黃昏時樓體映著河面的光。",
    worldPosition: [LIBRARY.center[0], sampleGroundElevation(LIBRARY.center[0], LIBRARY.center[1]), LIBRARY.center[1]],
    rotationY: 0,
    elevation: sampleGroundElevation(LIBRARY.center[0], LIBRARY.center[1]),
    realWidth: LIBRARY.width,
    realLength: LIBRARY.length,
    realHeight: LIBRARY.floors * LIBRARY.floorHeight + 1.6,
    footprint: rectFootprint(LIBRARY.center[0], LIBRARY.center[1], LIBRARY.width, LIBRARY.length),
    accuracy: "estimated",
    referenceIds: ["REF_LIBRARY_NINE_FLOORS", "REF_AXIS_STRAIGHT_ASSUMPTION"],
    zone: "library",
    interact: { x: 10, z: AXIS.libraryFrontZ + 3, radius: 11 },
    mapColor: "#8aa3b8",
    metrics: [
      { label: "地上層數", real: LIBRARY.floors, unit: "層", accuracy: "mapped" },
      { label: "量體長", real: LIBRARY.width, unit: "m", accuracy: "estimated" },
      { label: "量體深", real: LIBRARY.length, unit: "m", accuracy: "estimated" },
      { label: "層高", real: LIBRARY.floorHeight, unit: "m", accuracy: "estimated" },
    ],
  },
  {
    id: "sheep",
    name: "牧羊草坪",
    nameEn: "Shepherd's Meadow",
    year: "—",
    blurb:
      "校園最開闊的綠地。草坡上有李雙澤「唱自己的歌」紀念雕塑，午後常有人席地遠眺觀音山。圖書館的影子會慢慢爬過這片草地。",
    worldPosition: [-58, sampleGroundElevation(-58, -298), -298],
    rotationY: 0,
    elevation: sampleGroundElevation(-58, -298),
    accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER", "REF_CAMPUS_ON_WUHU_HILL"],
    zone: "library",
    interact: { x: -58, z: -294, radius: 14 },
    mapColor: "#6a9a62",
  },
  {
    id: "museum",
    name: "海事博物館",
    nameEn: "Maritime Museum",
    year: "—",
    blurb:
      "校園裡最容易一眼認出的白色船型建築。前身為航海學系商船學館，舷側常停放 F-100 戰鬥機與直升機模型，把淡江與海洋的緣分停泊在五虎崗上。",
    worldPosition: [150, sampleGroundElevation(150, -252), -252],
    rotationY: 0.16,
    accuracy: "estimated",
    elevation: sampleGroundElevation(150, -252),
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
    zone: "east",
    // In front of the hull, not inside it.
    interact: { x: 150, z: -236, radius: 11 },
    mapColor: "#e8eef4",
  },
  {
    id: "tigers",
    name: "五虎碑",
    nameEn: "Five Tigers Stele",
    year: "—",
    blurb:
      "紹謨紀念體育館前的銅雕，五虎環抱，取五虎崗之名。基座刻有張創辦人「五虎崗傳奇」，要淡江人把旺盛的氣勢留在這座山上。",
    worldPosition: [150, sampleGroundElevation(150, -140), -140],
    rotationY: 1.2,
    elevation: sampleGroundElevation(150, -140),
    accuracy: "estimated",
    referenceIds: ["REF_SECONDARY_ZONE_PLACEHOLDER"],
    zone: "east",
    // North of the ring, on open grass. The pad itself is solid.
    interact: { x: 150, z: -143.6, radius: 10 },
    mapColor: "#8a6a44",
  },
];

/**
 * 唱自己的歌 on 牧羊草坪. North of the stamp so the stamp stays open.
 * The pad is estimated; it is wide enough that one dodge step cannot cross it.
 */
export const SHEPHERD = { x: -58, z: -302, pad: 1.6 } as const;

/**
 * 五虎碑 north of the gym. The ring is estimated.
 * The pad is wide enough that one dodge step cannot cross its centre.
 */
export const TIGER_STELE = { x: 150, z: -140, pad: 3.2 } as const;

export const LANDMARK_BY_ID: Record<string, RealityLandmark> = Object.fromEntries(
  LANDMARKS.map((l) => [l.id, l]),
);

/** Player spawn: on the bottom apron of 克難坡, facing up the steps. */
export const SPAWN = { x: 0, y: 0, z: AXIS.gateZ - 6, yaw: 0 } as const;
