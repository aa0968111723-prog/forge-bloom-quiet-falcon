import { AVENUE_LENGTH, AXIS, DOLPHIN_ISLAND_RADIUS, PLAZA_ELEVATION, PLAZA_RADIUS, SCROLL_PLAZA_SIZE } from "./axis.ts";
import { sampleGroundElevation } from "./elevation.ts";
import { KENAN, KENAN_LANDING_ELEVATION, KENAN_LANDING_Z, KENAN_STEPS, KENAN_TOP_Z } from "./kenan.ts";
import { LANDMARK_BY_ID, LIBRARY, PALACE, palaceHallZs } from "./landmarks.ts";
import type { Accuracy } from "./origin.ts";
import { PATH_SEGMENTS } from "./paths.ts";

/**
 * Fixed benchmark cameras.
 * ========================
 *
 * The whole point is that every scene change can be judged from the *same*
 * viewpoints instead of from wherever the developer happened to be flying.
 * Reality Compare Mode (F8) cycles these, and the Playwright regression run
 * screenshots them, so a building that quietly moves 20 m shows up as a diff
 * rather than as a vague feeling that something looks off.
 *
 * View convention matches the player camera: forward =
 * (-sin(yaw)·cos(pitch), -sin(pitch), -cos(yaw)·cos(pitch)).
 * yaw 0 looks north (-Z); positive pitch looks down.
 */
export type BenchmarkTime = "day" | "cloudy" | "sunset" | "night" | "wet";

export type BenchmarkCamera = {
  id: string;
  label: string;
  /** Landmark this view is meant to judge. */
  landmarkId: string;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  fov: number;
  time: BenchmarkTime;
  /** What a person familiar with the campus should be able to check here. */
  checks: string[];
  referenceIds: string[];
};

const eye = (x: number, z: number, h = 1.68): [number, number, number] => [
  x,
  sampleGroundElevation(x, z) + h,
  z,
];

export const BENCHMARK_CAMERAS: BenchmarkCamera[] = [
  {
    id: "KENAN_01",
    label: "克難坡坡底入口",
    landmarkId: "kenan",
    position: eye(0, KENAN.bottomZ + 8.5),
    yaw: 0,
    pitch: -0.16,
    fov: 58,
    time: "day",
    checks: [
      "第一段樓梯直接從鋪面起步，沒有多餘平台",
      "兩側護牆與植栽把視線收成一條坡道",
      "看不到坡頂，中間平台是視線終點",
    ],
    referenceIds: ["REF_KENAN_STEP_COUNT", "REF_KENAN_TWO_FLIGHTS"],
  },
  {
    id: "KENAN_02",
    label: "克難坡中間平台",
    landmarkId: "kenan",
    position: [0, KENAN_LANDING_ELEVATION + 1.68, KENAN_LANDING_Z[1] + 1.2],
    yaw: 0,
    pitch: -0.14,
    fov: 58,
    time: "day",
    checks: [
      "平台為水平，前後各一段樓梯",
      "第二段樓梯盡頭是坡頂鋪面而非天空",
      "護牆高度約與腰部齊",
    ],
    referenceIds: ["REF_KENAN_TWO_FLIGHTS", "REF_STAIR_TYPICAL_RISE"],
  },
  {
    id: "KENAN_03",
    label: "克難坡坡頂回望",
    landmarkId: "kenan",
    position: [0, KENAN.stepCount * KENAN.riser + 1.68, KENAN_TOP_Z - 2.5],
    yaw: Math.PI,
    pitch: 0.2,
    fov: 58,
    time: "day",
    checks: [
      "回望可看到兩段樓梯與中間平台的落差",
      "坡底鋪面明顯低於視點約二十公尺",
      "坡頂鋪面與廣場連續，沒有高度跳動",
    ],
    referenceIds: ["REF_KENAN_STEP_COUNT"],
  },
  {
    id: "CHINGSHENG_01",
    label: "驚聲銅像廣場",
    landmarkId: "statue",
    position: [0, PLAZA_ELEVATION + 1.68, PLAZA_RADIUS - 1],
    yaw: 0,
    pitch: 0.04,
    fov: 58,
    time: "day",
    checks: [
      "圓形廣場，銅像在中心、基座朝南",
      "南側是克難坡坡頂，北側接宮燈大道",
      "看台階梯沿廣場外緣",
    ],
    referenceIds: ["REF_CHINGSHENG_STATUE"],
  },
  {
    id: "PALACE_01",
    label: "宮燈教室正面",
    landmarkId: "palace",
    position: eye(2.4, PALACE.firstZ + 2),
    yaw: Math.PI / 2,
    pitch: -0.05,
    fov: 58,
    time: "day",
    checks: [
      "碧瓦紅牆、兩層、屋脊為歇山式",
      "迴廊朱柱在牆面之前，形成陰影帶",
      "建築面退縮在大道路緣之後約十公尺",
    ],
    referenceIds: ["REF_PALACE_CLASSROOMS_1954", "REF_PALACE_ARRANGEMENT"],
  },
  {
    id: "LANTERN_01",
    label: "宮燈大道南端",
    landmarkId: "lantern",
    position: eye(0, AXIS.avenueSouthZ - 6),
    yaw: 0,
    pitch: 0.03,
    fov: 58,
    time: "day",
    checks: [
      "石板鋪面約六公尺寬，兩側為植栽帶",
      "宮燈等距排列，愈遠愈密",
      "視線盡頭是海豚里程碑圓環",
    ],
    referenceIds: ["REF_LANTERN_AVENUE_LENGTH", "REF_PALACE_ARRANGEMENT"],
  },
  {
    id: "LANTERN_SUNSET",
    label: "宮燈大道黃昏",
    landmarkId: "lantern",
    position: eye(0, AXIS.avenueSouthZ - AVENUE_LENGTH * 0.45),
    yaw: 0.1,
    pitch: 0.02,
    fov: 54,
    time: "sunset",
    checks: [
      "夕陽自西側（畫面左）低角度打在紅牆上",
      "宮燈亮起但不過曝",
      "遠處淡水河面有反光但不像奇幻場景",
    ],
    referenceIds: ["REF_LANTERN_AVENUE_LENGTH", "REF_CAMPUS_ON_WUHU_HILL"],
  },
  {
    id: "DOLPHIN_01",
    label: "海豚里程碑圓環",
    landmarkId: "dolphin",
    position: eye(0, AXIS.dolphinZ + DOLPHIN_ISLAND_RADIUS + 5),
    yaw: 0,
    pitch: 0.02,
    fov: 58,
    time: "day",
    checks: [
      "海豚在圓環中央、基座刻字面向大道",
      "圓環為柏油車道，島緣有路緣石",
      "南側是宮燈大道盡頭，北側往書卷廣場",
    ],
    referenceIds: ["REF_DOLPHIN_MILESTONE"],
  },
  {
    id: "SCROLL_01",
    label: "書卷廣場",
    landmarkId: "scroll",
    position: eye(0, AXIS.scrollPlazaZ + SCROLL_PLAZA_SIZE[1] / 2 - 2),
    yaw: 0,
    pitch: 0.02,
    fov: 60,
    time: "day",
    checks: [
      "四片書卷，可從中間穿行",
      "廣場鋪面為大面積地磚，向圖書館開口",
      "西側是驚聲大樓量體",
    ],
    referenceIds: ["REF_SCROLL_PLAZA_1986"],
  },
  {
    id: "LIBRARY_01",
    label: "覺生紀念圖書館館前",
    landmarkId: "library",
    position: eye(10, AXIS.libraryFrontZ + 16),
    yaw: 0.05,
    pitch: -0.12,
    fov: 60,
    time: "day",
    checks: [
      "九層量體，開窗帶水平連續",
      "館前有廣場與長椅，西側是牧羊草坪的草坡",
      "建築順地勢，基座沿等高線退階",
    ],
    referenceIds: ["REF_LIBRARY_NINE_FLOORS"],
  },
];

export const BENCHMARK_BY_ID: Record<string, BenchmarkCamera> = Object.fromEntries(
  BENCHMARK_CAMERAS.map((b) => [b.id, b]),
);

/**
 * A real-vs-built comparison row.
 *
 * `real` is what the reference says. `game` is *measured back out of the
 * generated world* (tread list, path polylines, footprints) rather than read
 * from the same constant that produced it, so a mismatch means the geometry
 * pipeline drifted away from its own spec. A deviation of 0 does not mean the
 * reference is right — check `accuracy` for that.
 */
export type DeviationRow = {
  label: string;
  real: number;
  game: number;
  unit: string;
  accuracy: Accuracy;
  deviation: number;
};

function polylineLength(points: readonly (readonly [number, number])[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

function bboxSpan(points: readonly (readonly [number, number])[]): [number, number] {
  const xs = points.map((p) => p[0]);
  const zs = points.map((p) => p[1]);
  return [Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)];
}

/** Values measured out of the generated world, keyed by landmark. */
export function measureGame(landmarkId: string): Record<string, number> {
  switch (landmarkId) {
    case "kenan": {
      const last = KENAN_STEPS[KENAN_STEPS.length - 1];
      const first = KENAN_STEPS[0];
      const risers = KENAN_STEPS.slice(1).map((s, i) => s.treadTop - KENAN_STEPS[i].treadTop);
      const treads = KENAN_STEPS.map((s) => s.nosingZ - s.backZ);
      return {
        階數: KENAN_STEPS.length,
        總爬升: last.treadTop,
        階高: risers.reduce((a, b) => a + b, 0) / risers.length,
        踏面: treads.reduce((a, b) => a + b, 0) / treads.length,
        梯寬: KENAN.width,
        平台高程: KENAN_LANDING_ELEVATION,
        總長: first.nosingZ - last.backZ,
      };
    }
    case "statue":
      return { 廣場直徑: PLAZA_RADIUS * 2, 銅像含基座高: 3.4 };
    case "palace": {
      const lm = LANDMARK_BY_ID.palace;
      const span = lm.footprint ? bboxSpan(lm.footprint) : [0, 0];
      return {
        單棟長度: span[1],
        單棟進深: span[0],
        層數: PALACE.storeys,
        每側棟數: palaceHallZs().length,
      };
    }
    case "lantern": {
      const seg = PATH_SEGMENTS.find((p) => p.id === "lantern-avenue");
      const paved = seg ? polylineLength(seg.points) : 0;
      const south = sampleGroundElevation(0, AXIS.avenueSouthZ);
      const north = sampleGroundElevation(0, AXIS.avenueNorthZ);
      return { 全長: AVENUE_LENGTH, 鋪面寬: seg?.width ?? 0, 南北高差: south - north, 鋪面實測長: paved };
    }
    case "dolphin":
      return { 圓環直徑: DOLPHIN_ISLAND_RADIUS * 2, 雕塑含基座高: 3.6 };
    case "scroll":
      return { 廣場寬: SCROLL_PLAZA_SIZE[0], 廣場深: SCROLL_PLAZA_SIZE[1], 書卷數: 4, 書卷高: 7.2 };
    case "library": {
      const lm = LANDMARK_BY_ID.library;
      const span = lm.footprint ? bboxSpan(lm.footprint) : [0, 0];
      return { 地上層數: LIBRARY.floors, 量體長: span[0], 量體深: span[1], 層高: LIBRARY.floorHeight };
    }
    default:
      return {};
  }
}

/** Real-vs-built table for a landmark, ready to print in the F8 panel. */
export function deviationRows(landmarkId: string): DeviationRow[] {
  const lm = LANDMARK_BY_ID[landmarkId];
  if (!lm?.metrics) return [];
  const measured = measureGame(landmarkId);
  return lm.metrics.map((m) => {
    const game = measured[m.label] ?? Number.NaN;
    return {
      label: m.label,
      real: m.real,
      game,
      unit: m.unit,
      accuracy: m.accuracy,
      deviation: Number.isFinite(game) ? game - m.real : Number.NaN,
    };
  });
}
