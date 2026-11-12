/**
 * Tamsui campus registry and coordinate handoff for zone work (F).
 *
 * Positions copied from the game are model placements. Nothing in this module
 * was surveyed this round. `accuracy` stays `estimated` unless a row only
 * repeats a published figure that the existing references already cap at
 * `mapped`. `surveyed` is not used. y is null when no surveyed elevation exists.
 */
import { AXIS } from "../axis.ts";
import { LANDMARKS, PALACE, SPAWN } from "../landmarks.ts";
import {
  AXIS_BEARING_ACCURACY,
  AXIS_BEARING_DEG,
  EAST_VECTOR,
  METERS_PER_UNIT,
  NORTH_VECTOR,
  ORIGIN_REAL_COORDINATE,
  ORIGIN_REAL_COORDINATE_ACCURACY,
  realToWorld,
  worldToReal,
} from "../origin.ts";
import { ELEVATION_DATUM } from "../elevation.ts";
import { PATH_SEGMENTS } from "../paths.ts";
import { SECONDARY_STRUCTURES } from "../zones/secondary.ts";
import {
  CAMPUS_ROADS,
  CAMPUS_SITES,
  CAMPUS_SOURCE,
  SUPPLY_NODES,
  siteEntrance,
  type CampusSite,
} from "../../rpg/campus.ts";

export {
  realToWorld,
  worldToReal,
  METERS_PER_UNIT,
  AXIS_BEARING_DEG,
  ORIGIN_REAL_COORDINATE,
};

export const REGISTRY_IMPORT_PATH = "src/game/world-data/registry/index.ts" as const;

export const COORDINATE_SPEC = {
  name: "TWCS",
  unit: "metre",
  metersPerUnit: METERS_PER_UNIT,
  originName: "驚聲銅像廣場中心",
  originWorld: { x: 0, y: null, z: 0 },
  axes: { east: "+X", north: "-Z", up: "+Y" },
  northVector: NORTH_VECTOR,
  eastVector: EAST_VECTOR,
  verticalDatum: ELEVATION_DATUM,
  verticalDatumIsSeaLevel: false,
  axisBearingDeg: AXIS_BEARING_DEG,
  axisBearingAccuracy: AXIS_BEARING_ACCURACY,
  geographicAnchor: ORIGIN_REAL_COORDINATE,
  geographicAnchorAccuracy: ORIGIN_REAL_COORDINATE_ACCURACY,
} as const;

export const OFFICIAL_SOURCES = [
  { url: "https://freshman.web.tku.edu.tw/tw/g/school.html", fieldChecked: false, downloadedThisRound: false },
  { url: "https://classic.tku.edu.tw/doc/CampusMap202103.pdf", fieldChecked: false, downloadedThisRound: false },
  { url: "https://www.general.tku.edu.tw/", fieldChecked: false, downloadedThisRound: false },
  { url: "https://spacerental.tku.edu.tw/spacelisting.aspx", fieldChecked: false, downloadedThisRound: false },
  { url: "https://photo.az.tku.edu.tw/", fieldChecked: false, downloadedThisRound: false },
  {
    url: "https://www.lib.tku.edu.tw/Front/AboutUs/Openinghoursandpremises/MainBuilding/Page.aspx?id=%2BCcwjg98bKg%3D",
    fieldChecked: false,
    downloadedThisRound: false,
  },
  {
    url: "https://www.ac.tku.edu.tw/ac/?page_id=18273",
    fieldChecked: false,
    downloadedThisRound: false,
  },
] as const;

const LICENSE_UNCONFIRMED = "未確認（只記錄公開網址，未核對現場，未取得授權）";

export type RegistryAccuracy = "surveyed" | "mapped" | "estimated";
export type RegistryStatus = "known-geometry" | "alias" | "omitted-from-legacy-map" | "pending-survey";
export type ZoneId =
  | "axis-54"
  | "library-55"
  | "stem-56"
  | "teaching-57"
  | "culture-58"
  | "sports-59"
  | "life-60";

export type FloorListing = {
  label: string;
  status: "pending-survey";
  evidence: "count-only";
};

export type RegistryRelation = {
  type: "same-save-id" | "homonym-different-position" | "alias-same-footprint";
  otherId: string;
  note: string;
};

export type RegistryEntry = {
  permanentId: string;
  officialName: string;
  legacyMapNumber: number | null;
  parentId: string | null;
  source: string;
  sourceDate: string | null;
  license: string;
  accuracy: RegistryAccuracy;
  status: RegistryStatus;
  zone: ZoneId;
  x: number | null;
  y: number | null;
  z: number | null;
  floors: FloorListing[];
  aliasOf: string | null;
  code: string | null;
  kind: "campus-site" | "pilgrimage" | "alias" | "homonym" | "omission";
  saveKey: boolean;
  activeInScene: boolean;
  fieldChecked: false;
  relation: RegistryRelation | null;
  footprint: { w: number; d: number } | null;
  /** Model elevation from landmarks.ts. Not a survey, and not copied into y. */
  modelY: number | null;
  notes: string | null;
};

export type ZoneBounds = {
  id: ZoneId;
  name: string;
  task: number;
  legacyMapNumbers: readonly number[];
  memberIds: string[];
  priorityIds: string[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  boundsAccuracy: "estimated";
  boundsNote: string;
};

const ZONE_ORDER: readonly ZoneId[] = [
  "axis-54",
  "library-55",
  "stem-56",
  "teaching-57",
  "culture-58",
  "sports-59",
  "life-60",
];

const ZONE_META: Record<
  ZoneId,
  { name: string; task: number; legacyMapNumbers: readonly number[]; priorityIds: readonly string[] }
> = {
  "axis-54": {
    name: "校門、克難坡、宮燈與歷史步行軸",
    task: 54,
    legacyMapNumbers: [1, 11, 32, 36, 38, 39],
    priorityIds: ["palace"],
  },
  "library-55": {
    name: "圖書館、書卷廣場、驚聲與覺生綜合大樓",
    task: 55,
    legacyMapNumbers: [29, 30, 31],
    priorityIds: ["library"],
  },
  "stem-56": {
    name: "理學、工程、建築與實驗場景",
    task: 56,
    legacyMapNumbers: [5, 6, 16, 17, 18, 19],
    priorityIds: [],
  },
  "teaching-57": {
    name: "文學、外語、商管、教育與傳播建物",
    task: 57,
    legacyMapNumbers: [7, 8, 12, 13, 14, 20, 27],
    priorityIds: [],
  },
  "culture-58": {
    name: "文化、校史、展演、會議及行政場館",
    task: 58,
    legacyMapNumbers: [4, 15, 33, 34, 35, 37],
    priorityIds: ["museum"],
  },
  "sports-59": {
    name: "體育館、泳館、五虎崗與田徑運動區",
    task: 59,
    legacyMapNumbers: [2, 3, 9, 21, 40],
    priorityIds: ["gym"],
  },
  "life-60": {
    name: "宿舍、餐飲、生活區與支路",
    task: 60,
    legacyMapNumbers: [10, 22, 23, 24, 25, 26, 28],
    priorityIds: [],
  },
};

const MAP_ZONE: Record<number, ZoneId> = {};
for (const zone of ZONE_ORDER) {
  for (const n of ZONE_META[zone].legacyMapNumbers) MAP_ZONE[n] = zone;
}

const PILGRIMAGE_ZONE: Record<string, ZoneId> = {
  kenan: "axis-54",
  statue: "axis-54",
  lantern: "axis-54",
  dolphin: "axis-54",
  scroll: "library-55",
  sheep: "library-55",
  tigers: "sports-59",
};

/** Legacy silhouettes that stay in source but are not exported on SECONDARY_STRUCTURES. */
const UNEXPORTED_LEGACY = [
  { id: "engineering-hall", name: "工學大樓", homonymOf: "engineering", zone: "stem-56" as const, x: 100, z: -90, w: 30, d: 18, floors: 7 },
  { id: "science-hall", name: "科學館", homonymOf: "science", zone: "stem-56" as const, x: 112, z: -40, w: 26, d: 16, floors: 6 },
  { id: "liberal-arts-hall", name: "文學館", homonymOf: "humanities", zone: "teaching-57" as const, x: 98, z: 8, w: 24, d: 16, floors: 5 },
  { id: "foreign-lang-hall", name: "外語大樓", homonymOf: "foreign", zone: "teaching-57" as const, x: 138, z: -40, w: 26, d: 16, floors: 5 },
  { id: "education-hall", name: "教育館", homonymOf: "education", zone: "teaching-57" as const, x: 180, z: -70, w: 24, d: 16, floors: 5 },
  { id: "ai-center", name: "AI創智中心", homonymOf: null, zone: "stem-56" as const, x: 180, z: -190, w: 26, d: 18, floors: 4 },
  { id: "health-hall", name: "精準健康館", homonymOf: null, zone: "stem-56" as const, x: 180, z: -230, w: 24, d: 16, floors: 4 },
  { id: "student-center", name: "學生活動中心", homonymOf: "commons", zone: "culture-58" as const, x: -88, z: -48, w: 28, d: 18, floors: 3 },
  { id: "admin-hall", name: "行政大樓", homonymOf: "administration", zone: "culture-58" as const, x: -94, z: 18, w: 26, d: 18, floors: 6 },
  { id: "research-hall", name: "研究大樓", homonymOf: null, zone: "stem-56" as const, x: -86, z: -160, w: 24, d: 16, floors: 7 },
] as const;

const EXTRA_ZONE: Record<string, ZoneId> = {
  "chingsheng-building": "library-55",
  "business-building": "teaching-57",
  gymnasium: "sports-59",
  "maritime-museum": "culture-58",
  "juexuan-garden": "axis-54",
  "volleyball-court": "sports-59",
};

function pendingFloors(count: number | undefined): FloorListing[] {
  if (!count || count < 1) return [];
  return Array.from({ length: count }, (_, i) => ({
    label: `${i + 1}F`,
    status: "pending-survey" as const,
    evidence: "count-only" as const,
  }));
}

function zoneForSite(site: CampusSite): ZoneId {
  if (site.id === "track") return "sports-59";
  const zone = site.mapNumber != null ? MAP_ZONE[site.mapNumber] : undefined;
  if (!zone) throw new Error(`campus site ${site.id} has no zone`);
  return zone;
}

function siteNotes(site: CampusSite): string | null {
  const notes: string[] = ["未核對現場。座標是程式估計位置。"];
  if (site.id === "gym") {
    notes.push("程式 floors=3。場地清單所稱七樓多功能球場本輪未下載，不列入已知樓層。");
  }
  if (site.id === "swimming") {
    notes.push("標示名稱依秘書處建物雙語頁。水道長度與樓層仍未核對，座標仍是估計。");
  }
  if (site.id === "track") notes.push("不在 mapNumbers，舊圖號缺失。");
  if (site.id === "palace") {
    notes.push("與巡禮共用 id。CAMPUS_SITES 與 LANDMARKS 的 z 錨點不同，見 relation，不拆存檔 id。");
  }
  if (site.id === "library" || site.id === "museum") {
    notes.push("與巡禮共用 permanentId，同址不另建 id。");
  }
  if (site.id === "chuehhsuan") {
    notes.push("與 juexuan-garden 同名不同座標，兩筆都保留。");
  }
  return notes.join("");
}

function palaceRelation(site: CampusSite): RegistryRelation | null {
  if (site.id !== "palace") return null;
  const lm = LANDMARKS.find((l) => l.id === "palace");
  if (!lm) return null;
  const dz = site.z - lm.worldPosition[2];
  return {
    type: "same-save-id",
    otherId: "palace",
    note: `建物清冊 z=${site.z}，巡禮錨點 z=${lm.worldPosition[2]}，差 ${dz}（PALACE.pitch=${PALACE.pitch}）。可能是同一排不同棟的錨點，未實測。`,
  };
}

function chuehRelation(site: CampusSite): RegistryRelation | null {
  if (site.id !== "chuehhsuan") return null;
  return {
    type: "homonym-different-position",
    otherId: "juexuan-garden",
    note: "圖號 38 的覺軒與宮燈旁的覺軒花園是兩筆不同程式座標，禁止合併。",
  };
}

const siteById = new Map(CAMPUS_SITES.map((s) => [s.id, s]));

function buildSites(): RegistryEntry[] {
  return CAMPUS_SITES.map((site) => ({
    permanentId: site.id,
    officialName: site.name,
    legacyMapNumber: site.mapNumber ?? null,
    parentId: null,
    source: CAMPUS_SOURCE,
    sourceDate: null,
    license: LICENSE_UNCONFIRMED,
    accuracy: "estimated",
    status: site.mapNumber == null ? "omitted-from-legacy-map" : "known-geometry",
    zone: zoneForSite(site),
    x: site.x,
    y: null,
    z: site.z,
    floors: pendingFloors(site.floors),
    aliasOf: null,
    code: site.code,
    kind: "campus-site",
    saveKey: true,
    activeInScene: true,
    fieldChecked: false,
    relation: palaceRelation(site) ?? chuehRelation(site),
    footprint: { w: site.w, d: site.d },
    modelY: null,
    notes: siteNotes(site),
  }));
}

function buildPilgrimage(siteIds: { has(id: string): boolean }): RegistryEntry[] {
  const rows: RegistryEntry[] = [];
  for (const lm of LANDMARKS) {
    if (siteIds.has(lm.id)) continue;
    const zone = PILGRIMAGE_ZONE[lm.id];
    if (!zone) throw new Error(`pilgrimage ${lm.id} has no zone`);
    rows.push({
      permanentId: lm.id,
      officialName: lm.name,
      legacyMapNumber: null,
      parentId: null,
      source: "src/game/world-data/landmarks.ts",
      sourceDate: null,
      license: LICENSE_UNCONFIRMED,
      accuracy: "estimated",
      status: "known-geometry",
      zone,
      x: lm.worldPosition[0],
      y: null,
      z: lm.worldPosition[2],
      floors: [],
      aliasOf: null,
      code: null,
      kind: "pilgrimage",
      saveKey: true,
      activeInScene: true,
      fieldChecked: false,
      relation: null,
      footprint: null,
      modelY: lm.elevation,
      notes: "不在 41 筆圖號表。是否印在舊圖上未核對。y 維持 null；modelY 只是模型高程。",
    });
  }
  return rows;
}

function buildSecondary(siteIds: { has(id: string): boolean }): RegistryEntry[] {
  const rows: RegistryEntry[] = [];
  for (const s of SECONDARY_STRUCTURES) {
    if (siteIds.has(s.id)) continue;
    const zone = EXTRA_ZONE[s.id];
    if (!zone) throw new Error(`secondary ${s.id} has no zone`);
    const near = CAMPUS_SITES.find((site) => Math.hypot(site.x - s.position[0], site.z - s.position[1]) < 0.5);
    if (near) {
      rows.push({
        permanentId: s.id,
        officialName: s.name,
        legacyMapNumber: null,
        parentId: null,
        source: "src/game/world-data/zones/secondary.ts",
        sourceDate: null,
        license: LICENSE_UNCONFIRMED,
        accuracy: "estimated",
        status: "alias",
        zone,
        x: s.position[0],
        y: null,
        z: s.position[1],
        floors: pendingFloors(s.floors),
        aliasOf: near.id,
        code: null,
        kind: "alias",
        saveKey: false,
        activeInScene: true,
        fieldChecked: false,
        relation: {
          type: "alias-same-footprint",
          otherId: near.id,
          note: "與建物清冊同座標的第二個程式 id，不是第二個存檔 id。",
        },
        footprint: { w: s.size[0], d: s.size[2] },
        modelY: null,
        notes: "未核對現場。",
      });
      continue;
    }
    const homonymOf = s.id === "juexuan-garden" ? "chuehhsuan" : null;
    rows.push({
      permanentId: s.id,
      officialName: s.name,
      legacyMapNumber: null,
      parentId: null,
      source: "src/game/world-data/zones/secondary.ts",
      sourceDate: null,
      license: LICENSE_UNCONFIRMED,
      accuracy: "estimated",
      status: "omitted-from-legacy-map",
      zone,
      x: s.position[0],
      y: null,
      z: s.position[1],
      floors: pendingFloors(s.floors),
      aliasOf: null,
      code: null,
      kind: homonymOf ? "homonym" : "omission",
      saveKey: false,
      activeInScene: true,
      fieldChecked: false,
      relation: homonymOf
        ? {
            type: "homonym-different-position",
            otherId: homonymOf,
            note: "與圖號 38 覺軒不同座標。責任在 axis-54，禁止合併。",
          }
        : null,
      footprint: { w: s.size[0], d: s.size[2] },
      modelY: null,
      notes: "無舊圖號。未核對現場。",
    });
  }
  return rows;
}

function buildUnexported(): RegistryEntry[] {
  return UNEXPORTED_LEGACY.map((s) => ({
    permanentId: s.id,
    officialName: s.name,
    legacyMapNumber: null,
    parentId: null,
    source: "src/game/world-data/zones/secondary.ts#LEGACY_SECONDARY_STRUCTURES",
    sourceDate: null,
    license: LICENSE_UNCONFIRMED,
    accuracy: "estimated" as const,
    status: "omitted-from-legacy-map" as const,
    zone: s.zone,
    x: s.x,
    y: null,
    z: s.z,
    floors: pendingFloors(s.floors),
    aliasOf: null,
    code: null,
    kind: s.homonymOf ? ("homonym" as const) : ("omission" as const),
    saveKey: false,
    activeInScene: false,
    fieldChecked: false as const,
    relation: s.homonymOf
      ? {
          type: "homonym-different-position" as const,
          otherId: s.homonymOf,
          note: "舊剪影與清冊同名或近名，但座標不同，且未進入 SECONDARY_STRUCTURES。禁止合併。",
        }
      : null,
    footprint: { w: s.w, d: s.d },
    modelY: null,
    notes: "LEGACY 陣列 slice(0,6) 之後的項目，場景未匯出。座標是程式殘留，不是實測。責任區沿名稱估計。",
  }));
}

export const CAMPUS_REGISTRY: RegistryEntry[] = [
  ...buildSites(),
  ...buildPilgrimage(siteById),
  ...buildSecondary(siteById),
  ...buildUnexported(),
];

export const PILGRIMAGE_SITE_ALIASES = LANDMARKS.filter((lm) => siteById.has(lm.id)).map((lm) => {
  const site = siteById.get(lm.id)!;
  const samePlan = Math.hypot(site.x - lm.worldPosition[0], site.z - lm.worldPosition[2]) < 0.05;
  return {
    pilgrimageId: lm.id,
    siteId: site.id,
    aliasOf: site.id,
    sharedPermanentId: true,
    samePlan,
    siteXZ: [site.x, site.z] as const,
    landmarkXZ: [lm.worldPosition[0], lm.worldPosition[2]] as const,
    stamp: lm.interact,
  };
});

const BOUNDS_PAD = 8;

export const ZONE_BOUNDS: ZoneBounds[] = ZONE_ORDER.map((id) => {
  const meta = ZONE_META[id];
  const members = CAMPUS_REGISTRY.filter((r) => r.zone === id);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const r of members) {
    if (r.x == null || r.z == null) continue;
    const hx = (r.footprint?.w ?? 0) / 2;
    const hz = (r.footprint?.d ?? 0) / 2;
    minX = Math.min(minX, r.x - hx);
    maxX = Math.max(maxX, r.x + hx);
    minZ = Math.min(minZ, r.z - hz);
    maxZ = Math.max(maxZ, r.z + hz);
  }
  return {
    id,
    name: meta.name,
    task: meta.task,
    legacyMapNumbers: meta.legacyMapNumbers,
    memberIds: members.map((r) => r.permanentId),
    priorityIds: [...meta.priorityIds],
    bounds: {
      minX: minX - BOUNDS_PAD,
      maxX: maxX + BOUNDS_PAD,
      minZ: minZ - BOUNDS_PAD,
      maxZ: maxZ + BOUNDS_PAD,
    },
    boundsAccuracy: "estimated",
    boundsNote: "成員估計座標外擴 8 m，含同名異址與未匯出剪影。不是實測分區界，區與區會重疊。",
  };
});

export function zoneOfPermanentId(permanentId: string): ZoneId | null {
  return CAMPUS_REGISTRY.find((r) => r.permanentId === permanentId)?.zone ?? null;
}

export type SurveyPoint = {
  id: string;
  name: string;
  x: number | null;
  y: number | null;
  z: number | null;
  accuracy: RegistryAccuracy;
  status: "pending-survey";
  source: string;
  usableForFit: false;
  note: string;
};

export type CheckPoint = SurveyPoint & { reservedFor: "H" };

export const CONTROL_POINTS: SurveyPoint[] = [
  {
    id: "cp-plaza",
    name: "驚聲銅像廣場中心",
    x: 0,
    y: null,
    z: 0,
    accuracy: "estimated",
    status: "pending-survey",
    source: "src/game/world-data/origin.ts",
    usableForFit: false,
    note: "模型原點。不是實測控制點，本輪禁止拿來擬合。",
  },
  {
    id: "cp-library",
    name: "覺生紀念圖書館量體中心",
    x: 18,
    y: null,
    z: -321,
    accuracy: "estimated",
    status: "pending-survey",
    source: "src/game/rpg/campus.ts#library",
    usableForFit: false,
    note: "程式估計座標。待現勘取代後才可當控制點。",
  },
  {
    id: "cp-gym",
    name: "紹謨紀念體育館量體中心",
    x: 166,
    y: null,
    z: -122,
    accuracy: "estimated",
    status: "pending-survey",
    source: "src/game/rpg/campus.ts#gym",
    usableForFit: false,
    note: "程式估計座標。與 cp-plaza、cp-library 在平面上不共線，只用來固定暫定框架。",
  },
  {
    id: "cp-chemistry",
    name: "鍾靈化學館量體中心",
    x: 288,
    y: null,
    z: -258,
    accuracy: "estimated",
    status: "pending-survey",
    source: "src/game/rpg/campus.ts#chemistry",
    usableForFit: false,
    note: "東側分散點。程式估計座標，待測。",
  },
];

export const CHECK_POINTS: CheckPoint[] = [
  {
    id: "chk-main-gate",
    name: "大門警衛站轉角",
    x: null,
    y: null,
    z: null,
    accuracy: "estimated",
    status: "pending-survey",
    source: "reserved",
    usableForFit: false,
    reservedFor: "H",
    note: "獨立檢核點。本輪不測、不擬合。",
  },
  {
    id: "chk-palace-corner",
    name: "宮燈教室外牆轉角",
    x: null,
    y: null,
    z: null,
    accuracy: "estimated",
    status: "pending-survey",
    source: "reserved",
    usableForFit: false,
    reservedFor: "H",
    note: "獨立檢核點。不要用宮殿錨點的模型座標回填。",
  },
  {
    id: "chk-museum-bow",
    name: "海事博物館船首",
    x: null,
    y: null,
    z: null,
    accuracy: "estimated",
    status: "pending-survey",
    source: "reserved",
    usableForFit: false,
    reservedFor: "H",
    note: "獨立檢核點。留給 H。",
  },
  {
    id: "chk-kenan-landing",
    name: "克難坡中間平台",
    x: null,
    y: null,
    z: null,
    accuracy: "estimated",
    status: "pending-survey",
    source: "reserved",
    usableForFit: false,
    reservedFor: "H",
    note: "獨立檢核點。平台位置與分段都還沒實測。",
  },
];

export const TOLERANCE_POLICY = {
  adopted: false as const,
  reason: "沒有更高精度的獨立資料可驗，本輪不採用建議公差。",
  suggestedIfHigherPrecisionExists: {
    externalControlPlanarM: 0.3,
    elevationM: 0.15,
    doorClearWidthM: 0.05,
  },
};

export const CAPTURE_SPEC = {
  requires: ["已知機位", "視向", "鏡頭", "比例參考"] as const,
  instrumentReadings: null,
  note: "不發明儀器讀數。BENCHMARK_CAMERAS 是遊戲相機，不是現場照片。",
};

export const FIXED_VIEWPOINTS = [
  {
    id: "vp-kenan-top",
    name: "克難坡坡頂西望淡水河與觀音山",
    zone: "axis-54" as const,
    x: 0,
    y: null,
    z: 0,
    viewDirection: "west",
    lens: null,
    scaleReference: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    photo: "pending-photo" as const,
    note: "機位用模型原點暫代。尚未拍攝。",
  },
  {
    id: "vp-lantern-mid",
    name: "宮燈大道中段",
    zone: "axis-54" as const,
    x: 0,
    y: null,
    z: AXIS.avenueSouthZ - 100,
    viewDirection: "north",
    lens: null,
    scaleReference: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    photo: "pending-photo" as const,
    note: "大道中點取自估計軸線，不是實測樁。",
  },
  {
    id: "vp-sheep",
    name: "牧羊草坪望圖書館",
    zone: "library-55" as const,
    x: -58,
    y: null,
    z: -298,
    viewDirection: "east",
    lens: null,
    scaleReference: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    photo: "pending-photo" as const,
    note: "座標來自 landmarks.ts 牧羊草坪錨點，待拍。",
  },
] as const;

export type SurveyGap = {
  id: string;
  target: string;
  missing: string;
  drawingNeeded: string;
  targetAccuracy: string;
};

export const SURVEY_GAPS: SurveyGap[] = [
  {
    id: "gap-control-refit",
    target: "cp-plaza、cp-library、cp-gym、cp-chemistry",
    missing: "可識別座標系的現場控制點與高程，取代模型座標",
    drawingNeeded: "校方測繪控制點成果或同等精度的現勘紀錄",
    targetAccuracy: "在有更高精度基準前，不採用平面 ≤0.30 m、高程 ≤0.15 m",
  },
  {
    id: "gap-check-H",
    target: "chk-main-gate、chk-palace-corner、chk-museum-bow、chk-kenan-landing",
    missing: "獨立檢核，禁止用於本輪擬合",
    drawingNeeded: "與控制點分開的現勘紀錄",
    targetAccuracy: "待 H；本輪無公差可判",
  },
  {
    id: "gap-kenan-flights",
    target: "kenan",
    missing: "各段階數、踏面、級高、平台深、步道寬、扶手。132 階只是待核對的公開說法；66/66 與高度是待測",
    drawingNeeded: "坡道剖面與分段計數",
    targetAccuracy: "階數待核對；幾何維持 estimated",
  },
  {
    id: "gap-doors",
    target: "palace、library、gym、museum 門口",
    missing: "門口淨寬與門位",
    drawingNeeded: "入口大樣或現勘",
    targetAccuracy: "建議淨寬 ≤0.05 m 尚未採用",
  },
  {
    id: "gap-juexuan",
    target: "chuehhsuan 與 juexuan-garden",
    missing: "兩筆覺軒哪一筆在宮燈旁",
    drawingNeeded: "校園平面與現勘點位",
    targetAccuracy: "平面待有更高精度基準後才訂公差",
  },
  {
    id: "gap-palace-anchor",
    target: "palace",
    missing: "建物清冊與巡禮錨點的 z 差",
    drawingNeeded: "宮燈教室分棟平面",
    targetAccuracy: "未實測，不宣告同棟或異棟",
  },
  {
    id: "gap-homonym-silhouettes",
    target: "engineering-hall、science-hall、liberal-arts-hall、foreign-lang-hall、education-hall、student-center、admin-hall、ai-center、health-hall、research-hall",
    missing: "未匯出舊剪影與正式節點是否為同一棟",
    drawingNeeded: "當期校園圖與棟別代碼",
    targetAccuracy: "維持 estimated / 待測",
  },
  {
    id: "gap-boundary",
    target: "淡水校界",
    missing: "校界線",
    drawingNeeded: "地籍或校方校界圖",
    targetAccuracy: "無實測，不畫成已校準校界",
  },
  {
    id: "gap-yingzhuan",
    target: "英專路與校園相接路段",
    missing: "路中線、路寬、人行道與入口街廓",
    drawingNeeded: "道路現況或測繪",
    targetAccuracy: "待測",
  },
  {
    id: "gap-xuefu",
    target: "學府路與校園相接路段",
    missing: "路中線、路寬、人行道與入口街廓",
    drawingNeeded: "道路現況或測繪",
    targetAccuracy: "待測",
  },
  {
    id: "gap-shuiyuan",
    target: "水源街",
    missing: "與校門相接的完整路段。paths.ts 的 shuiyuan-street 只是估計片段",
    drawingNeeded: "街廓平面",
    targetAccuracy: "待測",
  },
  {
    id: "gap-views",
    target: "vp-kenan-top、vp-lantern-mid、vp-sheep",
    missing: "現場照片：機位、視向、鏡頭、比例參考",
    drawingNeeded: "同機位照片，不是儀器讀數",
    targetAccuracy: "待拍",
  },
  {
    id: "gap-library-floors",
    target: "library",
    missing: "分層平面、入口層與可能地下層",
    drawingNeeded: "圖書館樓層說明（網頁本輪未核對）與平面",
    targetAccuracy: "樓層明細維持 pending-survey",
  },
  {
    id: "gap-gym-floors",
    target: "gym",
    missing: "程式 3 層與七樓球場說法的差異",
    drawingNeeded: "場地清單與樓層平面（本輪未下載）",
    targetAccuracy: "不把 7 寫成已知樓層",
  },
  {
    id: "gap-venues",
    target: "文錙藝術中心、有蓮國際會議廳、黑天鵝展示廳與其餘 venues",
    missing: "實際母建物、樓層與入口",
    drawingNeeded: "場地清單與分層平面",
    targetAccuracy: "母建物僅沿用程式 venues 時標待測",
  },
  {
    id: "gap-retaining",
    target: "擋土牆、坡道、排水、路緣",
    missing: "克難坡以外的牆、溝、緣石，以及坡道淨寬",
    drawingNeeded: "剖面與現勘",
    targetAccuracy: "kenan.ts 常數維持 estimated",
  },
  {
    id: "gap-bearing",
    target: "AXIS_BEARING_DEG 與 ORIGIN_REAL_COORDINATE",
    missing: "真實方位與地理錨點",
    drawingNeeded: "控制測量",
    targetAccuracy: "維持 estimated，禁止改標 surveyed",
  },
  {
    id: "gap-track-number",
    target: "track",
    missing: "田徑場舊圖號",
    drawingNeeded: "當期校園圖",
    targetAccuracy: "圖號維持 null",
  },
];

export type VenueLink = {
  id: string;
  officialName: string;
  parentId: string | null;
  status: "pending-survey";
  parentVerified: false;
  source: string;
  notes: string;
};

export const VENUE_LINKS: VenueLink[] = [
  { id: "venue:museum:black-swan", officialName: "黑天鵝展示廳", parentId: "museum", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在海事博物館。樓層未核對。" },
  { id: "venue:chingsheng:wentsao-music", officialName: "文錙音樂廳", parentId: "chingsheng", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在驚聲大樓。樓層未核對。" },
  { id: "venue:chingsheng:intl-hall", officialName: "驚聲國際會議廳", parentId: "chingsheng", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在驚聲大樓。樓層未核對。" },
  { id: "venue:integrated:intl-hall", officialName: "覺生國際會議廳", parentId: "integrated", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在覺生綜合大樓。樓層未核對。" },
  { id: "venue:commons:post-office", officialName: "郵局", parentId: "commons", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在學生活動中心。" },
  { id: "venue:commons:incubator", officialName: "建邦中小企業創新育成中心", parentId: "commons", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在學生活動中心。" },
  { id: "venue:sungtao-2:wentsao-art", officialName: "文錙藝術中心", parentId: "sungtao-2", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式掛在松濤二館。實際母建物未核對，不得當成實測。" },
  { id: "venue:sungtao-2:food-court", officialName: "美食廣場", parentId: "sungtao-2", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式掛在松濤二館。未核對。" },
  { id: "venue:yingyuan:founder", officialName: "張建邦創辦人紀念館", parentId: "yingyuan", status: "pending-survey", parentVerified: false, source: "campus.ts venues", notes: "程式寫在濯纓苑／校史館。樓層未核對。" },
  { id: "venue:youlian-hall", officialName: "有蓮國際會議廳", parentId: null, status: "pending-survey", parentVerified: false, source: "task-58-name-only", notes: "程式清冊沒有這筆。不猜測母建物。" },
];

export const ENTRANCES = CAMPUS_SITES.map((site) => {
  const entrance = siteEntrance(site);
  return {
    id: `entrance:${site.id}`,
    parentId: site.id,
    x: entrance.x,
    y: null,
    z: entrance.z,
    clearWidthM: null as number | null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    source: "siteEntrance",
    explicit: Boolean(site.entrance),
    notes: site.entrance ? "程式有指定 entrance，淨寬未測。" : "無指定入口，函式用量體南側外推，待測。",
  };
});

export const ROAD_REGISTRY = [
  ...CAMPUS_ROADS.map((polyline, index) => ({
    permanentId: `campus-road-${index}`,
    officialName: null as string | null,
    polyline: polyline.map((p) => [p[0], p[1]] as [number, number]),
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    source: "src/game/rpg/campus.ts#CAMPUS_ROADS",
    namedOnLegacyMap: false,
    notes: "匿名折線，沒有路名，未核對現場。",
  })),
  ...PATH_SEGMENTS.map((segment) => ({
    permanentId: segment.id,
    officialName: segment.id,
    polyline: segment.points.map((p) => [p[0], p[1]] as [number, number]),
    accuracy: "estimated" as const,
    status: "known-geometry" as const,
    source: "src/game/world-data/paths.ts",
    namedOnLegacyMap: false,
    notes:
      segment.id === "lantern-avenue"
        ? "來源檔把大道長度標成 mapped，軸線仍是 estimated。本清冊不升格。"
        : "沿用路徑折線，精度改記 estimated。",
  })),
  {
    permanentId: "road:yingzhuan",
    officialName: "英專路",
    polyline: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    source: "name-only",
    namedOnLegacyMap: false,
    notes: "無幾何。見 gap-yingzhuan。",
  },
  {
    permanentId: "road:xuefu",
    officialName: "學府路",
    polyline: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    source: "name-only",
    namedOnLegacyMap: false,
    notes: "無幾何。見 gap-xuefu。",
  },
  {
    permanentId: "road:shuiyuan",
    officialName: "水源街",
    polyline: null,
    accuracy: "estimated" as const,
    status: "pending-survey" as const,
    source: "name-only",
    namedOnLegacyMap: false,
    notes: "完整街廓未建。估計片段見 path id shuiyuan-street。",
  },
];

export const SUPPLY_INDEX = SUPPLY_NODES.map((node) => ({
  id: node.id,
  parentId: node.id.replace(/^supply-/, ""),
  x: node.x,
  y: null,
  z: node.z,
  accuracy: "estimated" as const,
  status: "pending-survey" as const,
  source: "src/game/rpg/campus.ts#SUPPLY_NODES",
}));

export const MAP_ACTIONS = ["select", "track", "warp"] as const;
export type MapAction = (typeof MAP_ACTIONS)[number];

export type MapPointerInput =
  | string
  | {
      action?: string;
      type?: string;
      dragging?: boolean;
      pointer?: string;
    };

export const MAP_LEGEND = [
  { id: "study", label: "教學" },
  { id: "lab", label: "實驗" },
  { id: "arts", label: "藝文" },
  { id: "sport", label: "運動" },
  { id: "dorm", label: "宿舍" },
  { id: "pilgrimage", label: "巡禮" },
  { id: "outdoor", label: "戶外" },
  { id: "supply", label: "補給" },
  { id: "quest", label: "任務" },
] as const;

export function classifyMapPointer(action: MapPointerInput): MapAction | "ignore-warp" {
  const dragging =
    typeof action === "object" &&
    (action.dragging === true || action.pointer === "drag" || action.type === "drag");
  const name = typeof action === "string" ? action : (action.action ?? action.type ?? "");
  const warpLike = name === "warp" || name.startsWith("warp") || name === "goto" || name === "travel";
  if (dragging && warpLike) return "ignore-warp";
  if (name === "select" || name === "track" || name === "warp") return name;
  return "ignore-warp";
}

export function searchRegistry(query: string, zone?: ZoneId): RegistryEntry[] {
  const q = query.trim().toLowerCase();
  return CAMPUS_REGISTRY.filter((row) => {
    if (zone && row.zone !== zone) return false;
    if (!q) return true;
    return (
      row.officialName.toLowerCase().includes(q) ||
      row.permanentId.toLowerCase().includes(q) ||
      (row.code ?? "").toLowerCase().includes(q)
    );
  });
}

export type XZ = readonly [number, number];

export type ObstacleRect = { minX: number; maxX: number; minZ: number; maxZ: number };

function pointInObstacle(x: number, z: number, obstacles: readonly ObstacleRect[]): boolean {
  return obstacles.some((o) => x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ);
}

function segmentHits(a: XZ, b: XZ, obstacles: readonly ObstacleRect[]): boolean {
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    if (pointInObstacle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, obstacles)) return true;
  }
  return false;
}

function lengthOf(points: readonly XZ[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

function turnsOf(points: readonly XZ[]): number[] {
  const turns: number[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    const ax = points[i][0] - points[i - 1][0];
    const az = points[i][1] - points[i - 1][1];
    const bx = points[i + 1][0] - points[i][0];
    const bz = points[i + 1][1] - points[i][1];
    if (Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)) > (15 * Math.PI) / 180) turns.push(i);
  }
  return turns;
}

const kenan = LANDMARKS.find((l) => l.id === "kenan");
if (!kenan) throw new Error("missing kenan");
const palaceEntrance = siteEntrance(siteById.get("palace")!);
const libraryEntrance = siteEntrance(siteById.get("library")!);
const gymEntrance = siteEntrance(siteById.get("gym")!);
const routeStart: XZ = [kenan.worldPosition[0], kenan.worldPosition[2]];

const STEP_NOTE =
  "幾何尚未依現勘重算。克難坡 132 階只是待核對的公開說法；現行 66/66 分段是待測。折線沒有展開階數。銅像與海豚基座從東側繞。圖書館折線沿中線走到宮燈垃圾桶以北，再向東繞過海豚基座。體育館從宮燈教室南緣與活動中心、教育館之間的空檔走。";

/** East of the 驚聲銅像 plinth, the same side the avenue route uses. */
const STATUE_PASS_X = 5.6;
/** East of the dolphin plinth, the same side the avenue route uses. */
const DOLPHIN_PASS_X = 6.6;
/** North of the avenue bins and south of the dolphin plinth. */
const PAST_BINS_Z = -210;

function structureSpanX(id: string): { min: number; max: number } {
  const row = SECONDARY_STRUCTURES.find((structure) => structure.id === id);
  if (!row) throw new Error(`missing structure ${id}`);
  return { min: row.position[0] - row.size[0] / 2, max: row.position[0] + row.size[0] / 2 };
}

/** South of the southern 宮燈教室 hall. The estimated road at z=-24 sits on that wall. */
const SOUTH_OF_PALACE_Z = PALACE.firstZ + PALACE.hallWidth / 2 + 1.2;
const commonsSpan = structureSpanX("commons");
const educationSpan = structureSpanX("education");
/** Between 學生活動中心 and 教育館, both estimated masses. */
const GYM_LANE_X = (commonsSpan.max + educationSpan.min) / 2;

export const ROUTE_SPECS = [
  {
    id: "kenan-to-palace" as const,
    fromId: "kenan",
    toId: "palace",
    polyline: [
      routeStart,
      [0, AXIS.slopeTopZ],
      [STATUE_PASS_X, 0],
      [0, palaceEntrance.z],
      [palaceEntrance.x, palaceEntrance.z],
    ] as XZ[],
    status: "幾何尚未依現勘重算" as const,
    accuracy: "estimated" as const,
    stepNote: STEP_NOTE,
  },
  {
    id: "kenan-to-library" as const,
    fromId: "kenan",
    toId: "library",
    polyline: [
      routeStart,
      [0, AXIS.slopeTopZ],
      [STATUE_PASS_X, 0],
      [0, AXIS.avenueSouthZ],
      [0, PAST_BINS_Z],
      [DOLPHIN_PASS_X, PAST_BINS_Z],
      [DOLPHIN_PASS_X, AXIS.dolphinZ],
      [0, AXIS.scrollPlazaZ],
      [libraryEntrance.x, libraryEntrance.z],
    ] as XZ[],
    status: "幾何尚未依現勘重算" as const,
    accuracy: "estimated" as const,
    stepNote: STEP_NOTE,
  },
  {
    id: "kenan-to-gym" as const,
    fromId: "kenan",
    toId: "gym",
    polyline: [
      routeStart,
      [0, AXIS.slopeTopZ],
      [STATUE_PASS_X, 0],
      [0, SOUTH_OF_PALACE_Z],
      [GYM_LANE_X, SOUTH_OF_PALACE_Z],
      [GYM_LANE_X, gymEntrance.z],
      [gymEntrance.x, gymEntrance.z],
    ] as XZ[],
    status: "幾何尚未依現勘重算" as const,
    accuracy: "estimated" as const,
    stepNote: STEP_NOTE,
  },
].map((route) => ({
  ...route,
  turns: turnsOf(route.polyline),
  lengthM: lengthOf(route.polyline),
}));

function nudgeOut(point: XZ, awayFrom: XZ, obstacles: readonly ObstacleRect[]): XZ {
  if (!pointInObstacle(point[0], point[1], obstacles)) return point;
  const dx = point[0] - awayFrom[0];
  const dz = point[1] - awayFrom[1];
  const len = Math.hypot(dx, dz) || 1;
  const px = -dz / len;
  const pz = dx / len;
  for (const side of [14, -14, 28, -28]) {
    const cand: XZ = [point[0] + px * side, point[1] + pz * side];
    if (!pointInObstacle(cand[0], cand[1], obstacles)) return cand;
  }
  return point;
}

export function recomputeRoute(routeId: (typeof ROUTE_SPECS)[number]["id"], obstacles: readonly ObstacleRect[] = []) {
  const spec = ROUTE_SPECS.find((route) => route.id === routeId);
  if (!spec) throw new Error(`unknown route ${routeId}`);
  const shifted: XZ[] = spec.polyline.map((point) => [point[0], point[1]]);
  for (let i = 1; i < shifted.length - 1; i++) shifted[i] = nudgeOut(shifted[i], shifted[i - 1], obstacles);
  const polyline: XZ[] = [shifted[0]];
  let unresolvedObstacle = false;
  for (let i = 1; i < shifted.length; i++) {
    const a = shifted[i - 1];
    const b = shifted[i];
    if (!segmentHits(a, b, obstacles)) {
      polyline.push(b);
      continue;
    }
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const mid: XZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let placed = false;
    for (const side of [14, -14, 28, -28]) {
      const cand: XZ = [mid[0] + px * side, mid[1] + pz * side];
      if (pointInObstacle(cand[0], cand[1], obstacles)) continue;
      if (segmentHits(a, cand, obstacles) || segmentHits(cand, b, obstacles)) continue;
      polyline.push(cand);
      placed = true;
      break;
    }
    if (!placed) unresolvedObstacle = true;
    polyline.push(b);
  }
  return {
    ...spec,
    polyline,
    turns: turnsOf(polyline),
    lengthM: lengthOf(polyline),
    recomputed: obstacles.length > 0,
    unresolvedObstacle,
    status: "幾何尚未依現勘重算" as const,
    accuracy: "estimated" as const,
  };
}

export const MINIMAP_GUIDE = {
  showsHeading: true,
  showsTarget: true,
  showsNextTurn: true,
  routeIds: ["kenan-to-palace", "kenan-to-library", "kenan-to-gym"] as const,
  note: "小地圖只顯示朝向、目標與下一個轉折。本輪不接 UI。",
};

export const REALITY_LAYERS = {
  campus: "layer.campus",
  anomaly: "layer.anomaly",
  quest: "layer.quest",
  build: "layer.build",
} as const;

export const REALITY_COMPARE_LAYERS = {
  visible: ["layer.campus"] as const,
  gameOnly: ["layer.anomaly", "layer.quest", "layer.build"] as const,
  note: "Reality Compare 只顯示基準校園。異象、任務、建造留在遊戲層。本輪不改 AdventureApp。",
};

export const SAFE_LANDINGS = {
  saveVersion: 2,
  schemaChanged: false,
  spawn: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z, yaw: SPAWN.yaw, accuracy: "estimated" as const },
  interiorReturn: "siteEntrance(site)，沿用既有 id",
  warp: "明確 warp 才移動；拖曳地圖必須 ignore-warp",
  notes: "不改 save schema。重生、室內返回、快旅與既有設施都落在原 id。落點座標仍是估計值。",
};

export const GROUND_INTERFACE = {
  changedThisRound: false,
  expectedModule: "src/game/rpg/physics",
  expectedFunction: "sampleContact",
  modulePresent: false,
  note: "E 本輪不改碰撞。日後道路與地形接 B 時使用 sampleContact。該模組目前不存在。",
};

export type ACCEPTANCE_ROW = {
  permanentId: string;
  source: string;
  surveyedValue: number | null;
  modelValue: number | null;
  error: number | null;
  verdict: "pending" | "pass" | "fail";
  walkthroughEvidence: string | null;
};

export type AcceptanceInput = {
  permanentId: string;
  source?: string;
  surveyedValue?: number | null;
  modelValue?: number | null;
  walkthroughEvidence?: string | null;
};

export function acceptanceTable(overrides: readonly AcceptanceInput[] = []): ACCEPTANCE_ROW[] {
  const byId = new Map(overrides.map((row) => [row.permanentId, row]));
  const ids = [...CAMPUS_REGISTRY.map((row) => row.permanentId)];
  for (const row of overrides) if (!ids.includes(row.permanentId)) ids.push(row.permanentId);
  return ids.map((permanentId) => {
    const base = CAMPUS_REGISTRY.find((row) => row.permanentId === permanentId);
    const over = byId.get(permanentId);
    const surveyed = over?.surveyedValue ?? null;
    const model = over?.modelValue ?? null;
    const hasSurvey = typeof surveyed === "number" && Number.isFinite(surveyed);
    const hasModel = typeof model === "number" && Number.isFinite(model);
    return {
      permanentId,
      source: over?.source ?? base?.source ?? "",
      surveyedValue: hasSurvey ? surveyed : null,
      modelValue: hasModel ? model : null,
      error: hasSurvey && hasModel ? model - surveyed : null,
      verdict: "pending",
      walkthroughEvidence: over?.walkthroughEvidence ?? null,
    };
  });
}

function assertRegistry(): void {
  const ids = CAMPUS_REGISTRY.map((row) => row.permanentId);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate permanentId");
  for (const site of CAMPUS_SITES) {
    if (!ids.includes(site.id)) throw new Error(`missing site ${site.id}`);
  }
  for (const lm of LANDMARKS) {
    const covered = ids.includes(lm.id) || PILGRIMAGE_SITE_ALIASES.some((a) => a.pilgrimageId === lm.id && a.aliasOf === lm.id);
    if (!covered) throw new Error(`missing pilgrimage ${lm.id}`);
  }
  for (const row of CAMPUS_REGISTRY) {
    if (row.accuracy === "surveyed") throw new Error(`surveyed without a survey: ${row.permanentId}`);
    if (!row.source) throw new Error(`missing source ${row.permanentId}`);
  }
  const pointIds = new Set<string>();
  for (const point of CONTROL_POINTS) {
    if (point.accuracy === "surveyed") throw new Error(point.id);
    pointIds.add(point.id);
  }
  for (const point of CHECK_POINTS) {
    if (pointIds.has(point.id) || point.reservedFor !== "H") throw new Error(point.id);
    pointIds.add(point.id);
  }
  const [a, b, c] = CONTROL_POINTS;
  if (a.x == null || b.x == null || c.x == null || a.z == null || b.z == null || c.z == null) {
    throw new Error("control points missing xz");
  }
  const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  if (Math.abs(cross) < 1) throw new Error("control points collinear");
  if (ZONE_BOUNDS.length !== 7) throw new Error("zones");
  for (const id of ["palace", "library", "gym", "museum"] as const) {
    if (!ZONE_BOUNDS.some((zone) => zone.priorityIds.includes(id))) throw new Error(`priority ${id}`);
  }
}

assertRegistry();
