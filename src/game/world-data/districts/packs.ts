import { CAMPUS_REGISTRY, OFFICIAL_SOURCES, ZONE_BOUNDS, type ZoneId } from "../registry/index.ts";
import { MEMBER_ENTRANCES, type DistrictEntrance } from "./entrances.ts";

export type DistrictEvidenceStatus = "pending-survey";

export type DistrictPack = {
  zoneId: ZoneId;
  name: string;
  task: number;
  memberIds: string[];
  members: { permanentId: string }[];
  priorityIds: readonly string[];
  evidenceStatus: DistrictEvidenceStatus;
  fieldChecked: false;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  boundsAccuracy: "estimated";
  boundsNote: string;
  photos: "pending-photo";
  drawings: "pending-drawing";
  measurements: "pending-measurement";
  /** 官方網址只作來源註記，不當成已核對現場。 */
  sources: { url: string; fieldChecked: false; role: "source-note-only" }[];
  entrances: DistrictEntrance[];
  notes: string[];
};

const ZONE_NOTES: Record<ZoneId, string[]> = {
  "axis-54": [
    "成員與估計區界沿用清冊，本包不重劃。",
    "大門、大忠、勤務中心外觀、克難坡、宮燈教室與大道、白樓、覺軒、驚聲廣場、海豚里程碑都還沒現勘。",
    "克難坡階數、級高、踏面待測。132 階只是待核對說法。",
    "蘭坪亭沒有清冊 permanentId，不新建存檔 id。",
    "chuehhsuan 與 juexuan-garden 兩筆都留著，不合併。",
    "palace 與巡禮同址，不另建第二個存檔 id。",
  ],
  "library-55": [
    "覺生紀念圖書館、驚聲、覺生綜合大樓、書卷廣場、牧羊草坪的樓層與入口層待測。",
    "chingsheng-building 是同座標別名，不是第二個存檔 id。",
    "圖書館網頁只登記為來源，本輪沒有拿來核對樓層。",
  ],
  "stem-56": [
    "麗先科學館、鍾靈化學館、工學館、建築系館、風洞、工學大樓都沒有現勘。",
    "engineering 與 engineering-hall、science 與 science-hall 的前後棟待核，不合併。",
  ],
  "teaching-57": [
    "文學、會文、商管、教育、外語、傳播 O 與 Q 都沒有現勘。",
    "business-o 與 business-q 的入口註記不同，不可互換。",
  ],
  "culture-58": [
    "守謙、海事博物館、學生活動、視聽、行政、校史都沒有現勘。",
    "有蓮的母建物未知，維持沒有 parentId。黑天鵝、文錙、創辦人紀念館只沿程式掛靠，母建物待測。",
    "maritime-museum 與 museum 同址，不另建存檔 id。",
  ],
  "sports-59": [
    "體育館、泳館、田徑場、綜合球場、司令臺、機車區都沒有現勘。",
    "遊戲與清冊的體育館層數不是已核實的七樓。",
    "五虎坡與五虎碑是否同一處待測，不把 tigers 改名成已核對的坡。",
    "gymnasium 是 gym 的別名，不是第二個存檔 id。",
  ],
  "life-60": [
    "麗澤、松濤一至五、實棟都沒有核准室內，不能標完成。",
    "美食廣場掛在松濤二館只是程式寫法，母建物與室內都待測。",
  ],
};

export const DISTRICT_PACKS: readonly DistrictPack[] = ZONE_BOUNDS.map((zone) => {
  const memberIds = [...zone.memberIds];
  for (const permanentId of memberIds) {
    if (!CAMPUS_REGISTRY.some((row) => row.permanentId === permanentId)) {
      throw new Error(`pack ${zone.id} cites unknown id ${permanentId}`);
    }
  }
  return {
    zoneId: zone.id,
    name: zone.name,
    task: zone.task,
    memberIds,
    members: memberIds.map((permanentId) => ({ permanentId })),
    priorityIds: zone.priorityIds,
    evidenceStatus: "pending-survey",
    fieldChecked: false,
    bounds: zone.bounds,
    boundsAccuracy: zone.boundsAccuracy,
    boundsNote: zone.boundsNote,
    photos: "pending-photo",
    drawings: "pending-drawing",
    measurements: "pending-measurement",
    sources: OFFICIAL_SOURCES.map((source) => ({
      url: source.url,
      fieldChecked: false as const,
      role: "source-note-only" as const,
    })),
    entrances: MEMBER_ENTRANCES.filter((entry) => entry.zoneId === zone.id),
    notes: ZONE_NOTES[zone.id],
  };
});
