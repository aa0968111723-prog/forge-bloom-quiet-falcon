import { CAMPUS_SITES } from "../../game/rpg/campus.ts";
import { LANDMARKS } from "../../game/world-data/landmarks.ts";
import { accuracyCeiling } from "../../game/world-data/references.ts";
import {
  CAMPUS_REGISTRY,
  ENTRANCES,
  ROAD_REGISTRY,
  SUPPLY_INDEX,
  VENUE_LINKS,
  type ZoneId,
} from "../../game/world-data/registry/index.ts";
import type {
  Accuracy,
  ContentZone,
  Evidence,
  InventoryStats,
  PlaceClaim,
  PlaceFigure,
  PlaceRecord,
  SourceRef,
} from "./types.ts";

const MAP_SOURCE: SourceRef = {
  url: "https://classic.tku.edu.tw/doc/CampusMap202103.pdf",
  consulted: "2026-11-11",
  version:
    "檔名 CampusMap202103（2021-03）。本輪沒有重新下載 PDF，座標沿用 registry，不升為 surveyed。",
  confidence: "inherited-registry",
};

const FRESHMAN_SOURCE: SourceRef = {
  url: "https://freshman.web.tku.edu.tw/tw/g/school.html",
  consulted: "2026-11-11",
  version: "頁面當日可見文字。地址寫 251301 新北市淡水區英專路151號。",
  confidence: "official-page",
};

const LIBRARY_SOURCE: SourceRef = {
  url: "https://www.lib.tku.edu.tw/Front/AboutUs/Openinghoursandpremises/MainBuilding/Page.aspx?id=%2BCcwjg98bKg%3D",
  consulted: "2026-11-11",
  version: "頁面 Last Updated 2026/10/26。地址寫 251302。",
  confidence: "official-page",
};

const THEME_USE: Record<string, string> = {
  study: "教學或讀書空間",
  lab: "實驗或研究空間",
  arts: "展演、人文或行政空間",
  sport: "運動空間",
  dorm: "宿舍或生活空間",
};

export type PlacePatch = {
  use?: string;
  sources?: SourceRef[];
  claims?: PlaceClaim[];
  conflicts?: string[];
  pending?: string[];
  relatedQuests?: string[];
};

const PATCHES: Record<string, PlacePatch> = {
  library: {
    use: "覺生紀念圖書館總館。閱覽、討論室、自習室與非書資料室。",
    sources: [LIBRARY_SOURCE, MAP_SOURCE],
    claims: [
      { text: "啟用時間：85年9月23日。", sourceUrl: LIBRARY_SOURCE.url },
      {
        text: "使用面積：7000餘建坪。這是頁面原文，沒有換算成公尺。",
        sourceUrl: LIBRARY_SOURCE.url,
      },
      { text: "閱覽座位 2,806 席（含一樓自習室 235 席）。", sourceUrl: LIBRARY_SOURCE.url },
      { text: "頁面列出一樓到九樓的樓層用途。", sourceUrl: LIBRARY_SOURCE.url },
    ],
    pending: ["量體的公尺尺寸仍是 estimated，不能標 surveyed。"],
    conflicts: ["總館頁郵遞區號 251302，與新生頁 251301 不同。見 meta:postal-address。"],
    relatedQuests: ["quest-group-report"],
  },
  palace: {
    use: "宮燈教室。歷史步行軸上的教學空間，也是分組報告事件的相遇點。",
    pending: ["棟距與層高未實測。1954 與外觀描述沿用 references.ts，該檔沒有附 URL。"],
    relatedQuests: ["quest-group-report"],
  },
  "main-gate": {
    use: "英專路側大門警衛站。新生動線的起點。",
    sources: [FRESHMAN_SOURCE, MAP_SOURCE],
    claims: [{ text: "新生頁把校園地址寫在英專路 151 號。", sourceUrl: FRESHMAN_SOURCE.url }],
    relatedQuests: ["quest-orient-gate"],
  },
  engineering: {
    use: "工學大樓。實驗與上課空間。遲到事件發生在門口，不進入未測的樓層。",
    relatedQuests: ["quest-lab-checkin"],
  },
  business: {
    use: "商管大樓。社團排班事件用的是門口，不是某一間未核對的教室。",
    relatedQuests: ["quest-shift-table"],
  },
  foreign: {
    use: "外國語文大樓。語言事件發生在門口的對話，不改寫課程公告。",
    relatedQuests: ["quest-lang-check"],
  },
  museum: {
    use: "海事博物館。說明牌事件是虛構異象，建物名稱沿用清冊。",
    pending: ["內部展廳尺寸未測。黑天鵝展示廳只出現在程式 venues，樓層未核對。"],
    relatedQuests: ["quest-caption-note"],
  },
  track: {
    use: "田徑場。雨天事件把練習改到室內或改期。",
    pending: ["registry 狀態是 omitted-from-legacy-map。場地存在於程式清冊，不是新的實測。"],
    relatedQuests: ["quest-rain-practice"],
  },
  "sungtao-2": {
    use: "松濤二館。餐飲事件把美食廣場寫在這棟的掛接上。",
    pending: ["美食廣場在程式裡掛在松濤二館，母建物未核對，對話不把它說成已查證。"],
    relatedQuests: ["quest-meal-timing"],
  },
  gym: {
    use: "紹謨紀念體育館。雨天若改室內，只建議走到這裡，不保證場地有空。",
    relatedQuests: ["quest-rain-practice"],
  },
  parking: {
    use: "五虎崗機車停車場。",
    sources: [FRESHMAN_SOURCE, MAP_SOURCE],
    claims: [
      {
        text: "新生頁寫：機車申請後可停放於五虎崗或大忠街機車停車場。沒有車位數量。",
        sourceUrl: FRESHMAN_SOURCE.url,
      },
    ],
  },
  "dazhong-gate": {
    use: "大忠警衛站。",
    sources: [FRESHMAN_SOURCE, MAP_SOURCE],
    claims: [
      {
        text: "新生頁把大忠街機車停車場和五虎崗並列，沒有畫出路線。",
        sourceUrl: FRESHMAN_SOURCE.url,
      },
    ],
  },
  kenan: {
    use: "克難坡。階數沿用既有圖資，踏面與總爬升仍是 estimated。",
    pending: ["references.ts 的 132 階沒有附 URL。66/66 分段是該檔自己標的占位，不是實測。"],
  },
  lantern: {
    use: "宮燈大道。全長約 200 公尺是既有 documented 圖資，鋪面寬與軸線彎折未測。",
    pending: ["references.ts 沒有附 200 公尺的 URL。座標軸被假設成直線。"],
  },
};

function zoneOf(id: string | null): ContentZone {
  if (!id) return "cross-zone";
  const row = CAMPUS_REGISTRY.find((entry) => entry.permanentId === id);
  return row?.zone ?? "cross-zone";
}

function evidenceFor(recordClass: PlaceRecord["recordClass"], named: boolean): Evidence {
  if (recordClass === "road" && !named) return "gameplay-adaptation";
  if (recordClass === "entrance" || recordClass === "supply") return "gameplay-adaptation";
  return "factual";
}

function withPatch(place: PlaceRecord, patch: PlacePatch | undefined): PlaceRecord {
  if (!patch) return place;
  return {
    ...place,
    use: patch.use ?? place.use,
    sources: patch.sources ?? place.sources,
    claims: patch.claims ?? place.claims,
    conflicts: [...place.conflicts, ...(patch.conflicts ?? [])],
    pending: [...place.pending, ...(patch.pending ?? [])],
    relatedQuests: patch.relatedQuests ?? place.relatedQuests,
  };
}

function figuresFor(id: string): PlaceFigure[] {
  const landmark = LANDMARKS.find((entry) => entry.id === id);
  if (!landmark?.metrics) return [];
  const ceiling = accuracyCeiling(landmark.referenceIds);
  const rank = { surveyed: 3, mapped: 2, estimated: 1 };
  return landmark.metrics.map((metric) => {
    const accuracy: Accuracy = rank[metric.accuracy] > rank[ceiling] ? ceiling : metric.accuracy;
    return {
      label: metric.label,
      value: metric.real,
      unit: metric.unit,
      accuracy,
      referenceId: landmark.referenceIds[0] ?? "missing",
    };
  });
}

function siteUse(id: string, name: string): string {
  const site = CAMPUS_SITES.find((entry) => entry.id === id);
  const theme = site ? THEME_USE[site.theme] : "校園空間";
  return `${name}。${theme}。名稱沿用遊戲清冊，座標是 estimated。`;
}

export function buildPlaces(): PlaceRecord[] {
  const places: PlaceRecord[] = CAMPUS_REGISTRY.map((row) => {
    const recordClass: PlaceRecord["recordClass"] =
      row.kind === "alias"
        ? "alias"
        : row.kind === "homonym"
          ? "homonym"
          : row.kind === "omission"
            ? "omission"
            : row.kind === "pilgrimage"
              ? "landmark"
              : "building";
    const place: PlaceRecord = {
      id: row.permanentId,
      name: row.officialName,
      zone: row.zone,
      use: siteUse(row.permanentId, row.officialName),
      evidence: evidenceFor(recordClass, true),
      accuracy: row.accuracy,
      aliasOf: row.aliasOf,
      sources: [MAP_SOURCE],
      pending: ["位置來自 registry 的模型座標，本輪沒有實測。"],
      conflicts:
        recordClass === "homonym" || recordClass === "alias"
          ? ["這列是別名或同名條目，不能加進已查證建築數。"]
          : [],
      relatedQuests: [],
      claims: [],
      figures: figuresFor(row.permanentId),
      recordClass,
      registryStatus: row.status,
      notes: row.notes,
    };
    if (recordClass === "omission") {
      place.pending.push("舊圖缺號或程式未核對。保留列名，不把它算成已查證建築。");
    }
    return withPatch(place, PATCHES[row.permanentId]);
  });

  for (const road of ROAD_REGISTRY) {
    const named = Boolean(road.officialName);
    places.push({
      id: road.permanentId,
      name: road.officialName ?? road.permanentId,
      zone: "cross-zone",
      use: named
        ? `${road.officialName}。路名有紀錄，幾何未測。`
        : "匿名校園道路折線，只有程式座標。",
      evidence: named ? "factual" : "gameplay-adaptation",
      accuracy: road.accuracy,
      aliasOf: null,
      sources: [MAP_SOURCE],
      pending: [road.notes],
      conflicts: [],
      relatedQuests: [],
      claims: [],
      figures: [],
      recordClass: "road",
      registryStatus: road.status,
      notes: road.source,
    });
  }

  for (const entrance of ENTRANCES) {
    places.push({
      id: entrance.id,
      name: `${entrance.parentId} 入口`,
      zone: zoneOf(entrance.parentId),
      use: "由建物量體外推的入口點。",
      evidence: "gameplay-adaptation",
      accuracy: entrance.accuracy,
      aliasOf: entrance.parentId,
      sources: [MAP_SOURCE],
      pending: [entrance.notes],
      conflicts: [],
      relatedQuests: [],
      claims: [],
      figures: [],
      recordClass: "entrance",
      registryStatus: entrance.status,
      notes: entrance.explicit ? "程式有指定 entrance。" : "無指定入口。",
    });
  }

  for (const venue of VENUE_LINKS) {
    places.push({
      id: venue.id,
      name: venue.officialName,
      zone: zoneOf(venue.parentId),
      use: venue.parentId ? `掛在 ${venue.parentId} 名下的空間名稱。` : "有名稱、沒有母建物。",
      evidence: "factual",
      accuracy: "estimated",
      aliasOf: venue.parentId,
      sources: [MAP_SOURCE],
      pending: [venue.notes ?? "樓層與母建物未核對。"],
      conflicts: venue.parentVerified ? [] : ["母建物未核對，這列不是一棟新的已查證建築。"],
      relatedQuests: [],
      claims: [],
      figures: [],
      recordClass: "venue",
      registryStatus: venue.status,
      notes: venue.source,
    });
  }

  for (const supply of SUPPLY_INDEX) {
    places.push({
      id: supply.id,
      name: `${supply.parentId} 補給點`,
      zone: zoneOf(supply.parentId),
      use: "遊戲補給點，不是官方設施名稱。",
      evidence: "gameplay-adaptation",
      accuracy: supply.accuracy,
      aliasOf: supply.parentId,
      sources: [MAP_SOURCE],
      pending: ["補給點只有程式座標。"],
      conflicts: [],
      relatedQuests: [],
      claims: [],
      figures: [],
      recordClass: "supply",
      registryStatus: supply.status,
      notes: supply.source,
    });
  }

  places.push({
    id: "meta:postal-address",
    name: "淡水校園通訊地址",
    zone: "axis-54",
    use: "地址衝突紀錄。不是建物。",
    evidence: "factual",
    accuracy: "estimated",
    aliasOf: null,
    sources: [FRESHMAN_SOURCE, LIBRARY_SOURCE],
    pending: ["兩個官方頁面的郵遞區號不同，本輪不選邊。"],
    conflicts: [
      "2026-11-11 新生頁寫 251301 新北市淡水區英專路151號。",
      "圖書館總館頁 Last Updated 2026/10/26 寫 251302 新北市淡水區英專路151號。",
    ],
    relatedQuests: [],
    claims: [],
    figures: [],
    recordClass: "meta",
    registryStatus: null,
    notes: "路名與門牌相同，郵遞區號衝突。",
  });

  return places;
}

export function inventoryStats(places: readonly PlaceRecord[]): InventoryStats {
  return {
    rows: places.length,
    namedSiteRows: places.filter((place) => place.recordClass === "building").length,
    aliasRows: places.filter((place) => place.aliasOf).length,
    surveyed: places.filter((place) => place.accuracy === "surveyed").length,
    statement: "列數含別名、道路、廣場、入口、補給點與同名條目，不是已查證建築數。surveyed 為 0。",
  };
}

export function zoneIds(): readonly ZoneId[] {
  return ["axis-54", "library-55", "stem-56", "teaching-57", "culture-58", "sports-59", "life-60"];
}
