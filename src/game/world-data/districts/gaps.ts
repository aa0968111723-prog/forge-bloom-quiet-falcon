import { CAMPUS_REGISTRY, VENUE_LINKS, type ZoneId } from "../registry/index.ts";
import { GRAYBOXES } from "./grayboxes.ts";

export type GapMissing = {
  photo: string;
  drawing: string;
  measurement: string;
};

export type FixtureGap = {
  id: string;
  zoneId: ZoneId;
  parentId: string | null;
  name: string;
  status: "pending-survey";
  sourceDate: null;
  missing: GapMissing;
  note: string;
};

export type RoomGap = {
  id: string;
  zoneId: ZoneId;
  parentId: string | null;
  name: string;
  roomCode: null;
  floorLabel: null;
  use: null;
  status: "pending-survey";
  sourceDate: null;
  interiorApproved: false;
  missing: GapMissing;
  note: string;
};

export type CompletionItem = {
  id: string;
  status: "accepted" | "graybox" | "pending-survey";
  sourceDate: string | null;
};

const PHOTO = "沒有本輪現勘照片";
const DRAWING = "沒有已核對的平面或立面";
const MEASURE = "沒有現場量測";

function missing(photo = PHOTO, drawing = DRAWING, measurement = MEASURE): GapMissing {
  return { photo, drawing, measurement };
}

const FIXTURE_NOTES: Partial<Record<string, string>> = {
  kenan: "階數、級高、踏面、平台深、步道寬與扶手都待測。132 階只是待核對說法。視覺排水孔與長椅不是已核對碰撞。",
  palace: "門窗、迴廊與室內階都沒有照片或大樣。灰盒外殼不算固定設施已完成。",
  lantern: "宮燈間距、燈高與大道鋪面只有程式道具，碰撞未核對。",
  dolphin: "圓環、基座與雕塑沒有現勘尺寸。視覺模型不是碰撞依據。",
  statue: "驚聲銅像廣場鋪面、看台與基座尺寸待測。",
  "main-gate": "大門警衛站外觀與門位待測。",
  "dazhong-gate": "大忠警衛站外觀與門位待測。",
  security: "勤務監控管制中心只留外觀缺口，室內未核准。",
  "white-hall": "白樓立面與入口待測。",
  chuehhsuan: "與 juexuan-garden 是兩筆，固定設施不合併。",
  "juexuan-garden": "與 chuehhsuan 不同座標，庭園設施另記，不合併。",
  library: "入口層、雨遮與無障礙坡道沒有大樣。",
  scroll: "四片書卷的間距與基座待測。視覺薄片不是已核對碰撞。",
  sheep: "牧羊草坪邊界與雕塑基座待測。",
  chingsheng: "驚聲大樓入口與文錙音樂廳的樓層關係待測。",
  integrated: "覺生綜合大樓入口層待測。",
  science: "與 science-hall 是否前後棟待核，設備不合併。",
  "science-hall": "舊剪影，與 science 的前後關係待核。",
  chemistry: "實驗室外固定設備沒有圖，不能當完成設施。",
  engineering: "與 engineering-hall 前後棟待核，不合併。",
  "engineering-hall": "未匯出舊剪影，與 engineering 的關係待核。",
  "old-engineering": "工學館與工學大樓的前後關係待核。",
  architecture: "建築系館入口與中庭待測。",
  "wind-lab": "風洞本體與實驗段沒有圖面或量測。",
  "business-o": "O 館入口固定門扇待測，註記不可拿去當 Q 館。",
  "business-q": "Q 館入口是另一扇待測的門，不可複製 O 館描述。",
  business: "商管大樓入口待測。",
  humanities: "文學館入口待測。",
  foreign: "外語大樓入口待測，與 foreign-lang-hall 不合併。",
  hweiwen: "會文館入口待測。",
  education: "教育館入口待測，與 education-hall 不合併。",
  museum: "船型外觀與軸對齊碰撞盒不是同一來源。舷側展示機沒有量測。",
  "maritime-museum": "場景別名，固定設施仍記在 museum，不另建成完成品。",
  conference: "守謙國際會議中心入口與大廳待測。",
  commons: "學生活動中心入口待測。student-center 是另一筆剪影。",
  audiovisual: "視聽教育館入口與座椅區待測。",
  administration: "行政大樓入口待測。admin-hall 不合併。",
  yingyuan: "校史館與創辦人紀念館的樓層關係待測。",
  gym: "體育館樓層數不是已核實的七樓。看臺、地板與器材都沒有圖。",
  gymnasium: "gym 的場景別名，不另建完成的碰撞館。",
  swimming: "標示已對上秘書處的紹謨紀念游泳館。水道長度仍待測。",
  track: "田徑場跑道分道、彎道與入口待測。舊圖號仍缺。",
  "wuhu-courts": "綜合球場分區與網柱待測。",
  reviewing: "司令臺台面可以走上去，台高 1.25 m 與坡長仍是估計。小間仍擋住。",
  parking: "機車區車格與邊界待測。地面畫線不是已核對碰撞。",
  tigers: "五虎碑基座待測。五虎坡是否同一處，沒有證據前不改名。",
  reitaku: "麗澤室內未核准，外觀門廳也沒有量測。",
  sungtao: "松濤一館室內未核准。",
  "sungtao-2": "松濤二館室內未核准。美食廣場與文錙藝術中心的母建物待測。",
  "sungtao-3": "松濤三館室內未核准。",
  "sungtao-4": "松濤四館室內未核准。",
  "sungtao-5": "松濤五館室內未核准。",
  faculty: "實棟室內未核准。",
};

function fixtureNote(permanentId: string, officialName: string): string {
  return FIXTURE_NOTES[permanentId] ?? `${officialName}的固定設施沒有照片、圖面或量測。視覺道具不是已核對碰撞。`;
}

const ROOM_NOTES: Partial<Record<string, string>> = {
  palace: "沒有分棟分室圖。不把程式裡的棟數寫成已清點房間。",
  library: "沒有任何一層的房間圖。入口層待測，不編室號。",
  gym: "沒有樓層平面。不因七樓說法建立房間，三層標籤也不代表實景完成。",
  museum: "展示廳與黑天鵝都沒有房間圖。",
  reitaku: "未核准室內，不可標完成。",
  sungtao: "未核准室內，不可標完成。",
  "sungtao-2": "未核准室內。美食廣場與文錙藝術中心都不標完成。",
  "sungtao-3": "未核准室內，不可標完成。",
  "sungtao-4": "未核准室內，不可標完成。",
  "sungtao-5": "未核准室內，不可標完成。",
  faculty: "未核准室內，不可標完成。",
  engineering: "與工學館、未匯出工學大樓剪影的前後棟待核，房間不合併。",
  "old-engineering": "與工學大樓的前後關係待核，不共用房間清單。",
  science: "與科學館剪影的前後關係待核，不共用房間清單。",
};

function roomNote(permanentId: string, officialName: string): string {
  return ROOM_NOTES[permanentId] ?? `${officialName}沒有房間照片或圖面，室號與用途待測，不計入實景完成。`;
}

export const FIXTURE_GAPS: readonly FixtureGap[] = [
  ...CAMPUS_REGISTRY.map((row) => ({
    id: `fixture:${row.permanentId}`,
    zoneId: row.zone,
    parentId: row.permanentId,
    name: `${row.officialName}固定設施`,
    status: "pending-survey" as const,
    sourceDate: null,
    missing: missing(),
    note: fixtureNote(row.permanentId, row.officialName),
  })),
  {
    id: "fixture:lanping-pavilion",
    zoneId: "axis-54",
    parentId: null,
    name: "蘭坪亭",
    status: "pending-survey",
    sourceDate: null,
    missing: missing("沒有蘭坪亭照片", "清冊與本輪都沒有圖面", "位置與尺寸都沒有量測"),
    note: "任務點名蘭坪亭，但清冊沒有 permanentId。不新建存檔 id。",
  },
  {
    id: "fixture:wuhu-slope",
    zoneId: "sports-59",
    parentId: null,
    name: "五虎坡",
    status: "pending-survey",
    sourceDate: null,
    missing: missing("沒有五虎坡照片", "沒有坡道剖面", "坡長、坡寬與高差都沒有量測"),
    note: "不把 tigers（五虎碑）直接寫成五虎坡。兩者是否同址待測。",
  },
];

function zoneOfParent(parentId: string | null): ZoneId {
  if (!parentId) return "culture-58";
  const row = CAMPUS_REGISTRY.find((item) => item.permanentId === parentId);
  if (!row) throw new Error(`venue parent ${parentId} is not in the registry`);
  return row.zone;
}

export const ROOM_GAPS: readonly RoomGap[] = [
  ...CAMPUS_REGISTRY.map((row) => ({
    id: `room:${row.permanentId}:unlisted`,
    zoneId: row.zone,
    parentId: row.permanentId,
    name: `${row.officialName}未列房間`,
    roomCode: null,
    floorLabel: null,
    use: null,
    status: "pending-survey" as const,
    sourceDate: null,
    interiorApproved: false as const,
    missing: missing("沒有房間照片", "沒有分層房間圖", "沒有室號、淨寬或用途量測"),
    note: roomNote(row.permanentId, row.officialName),
  })),
  ...VENUE_LINKS.map((venue) => ({
    id: `room:${venue.id}`,
    zoneId: zoneOfParent(venue.parentId),
    parentId: venue.parentId,
    name: venue.officialName,
    roomCode: null as null,
    floorLabel: null as null,
    use: null as null,
    status: "pending-survey" as const,
    sourceDate: null,
    interiorApproved: false as const,
    missing: missing("沒有廳室照片", "沒有標出母建物與樓層的圖", "沒有廳室尺寸"),
    note: venue.parentId
      ? `${venue.notes}母建物未核對，這間不計入實景完成。`
      : "有蓮國際會議廳不知道母建物，不猜測，房間維持待測。",
  })),
];

export const COMPLETION_ITEMS: readonly CompletionItem[] = [
  ...GRAYBOXES.map((box) => ({
    id: `graybox:${box.permanentId}`,
    status: box.status,
    sourceDate: box.sourceDate,
  })),
  ...GRAYBOXES.flatMap((box) =>
    box.floors.map((floor) => ({
      id: `floor:${box.permanentId}:${floor.label}`,
      status: floor.status,
      sourceDate: floor.sourceDate,
    })),
  ),
  ...FIXTURE_GAPS.map((gap) => ({ id: gap.id, status: gap.status, sourceDate: gap.sourceDate })),
  ...ROOM_GAPS.map((gap) => ({ id: gap.id, status: gap.status, sourceDate: gap.sourceDate })),
];

function hasSourceDate(sourceDate: string | null): sourceDate is string {
  return typeof sourceDate === "string" && sourceDate.trim().length > 0;
}

/** 只計算已接受且有來源日期的項目。灰盒與待測都不算實景完成。 */
export function completionCount(
  items: readonly { status: string; sourceDate: string | null }[] = COMPLETION_ITEMS,
): number {
  return items.filter((item) => item.status === "accepted" && hasSourceDate(item.sourceDate)).length;
}
