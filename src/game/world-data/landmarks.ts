import {
  AVENUE_LENGTH,
  AVENUE_PAVED_WIDTH,
  AXIS,
  DOLPHIN_ISLAND_RADIUS,
  PLAZA_ELEVATION,
  PLAZA_RADIUS,
  SCROLL_PLAZA_SIZE,
} from "./axis.ts";
import { sampleGroundElevation } from "./elevation.ts";
import { KENAN, KENAN_LANDING_ELEVATION, KENAN_TOTAL_RISE, KENAN_TOTAL_RUN } from "./kenan.ts";
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
    interact: { x: -58, z: -298, radius: 14 },
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
    interact: { x: 150, z: -140, radius: 10 },
    mapColor: "#8a6a44",
  },
];

export const LANDMARK_BY_ID: Record<string, RealityLandmark> = Object.fromEntries(
  LANDMARKS.map((l) => [l.id, l]),
);

/** Player spawn: on the bottom apron of 克難坡, facing up the steps. */
export const SPAWN = { x: 0, y: 0, z: AXIS.gateZ - 6, yaw: 0 } as const;
