import { CAMPUS_REGISTRY } from "../registry/index.ts";
import { entranceOf } from "./entrances.ts";
import { floorsFor, type DistrictFloor } from "./floors.ts";

export const PRIORITY_GRAYBOX_IDS = ["palace", "library", "gym", "museum"] as const;
export type PriorityGrayboxId = (typeof PRIORITY_GRAYBOX_IDS)[number];

export type GrayboxFootprint = {
  source: "registry";
  x: number;
  z: number;
  w: number;
  d: number;
  y: null;
  accuracy: "estimated";
};

export type GrayboxAsset = {
  assetId: string;
  kind: "procedural-box";
  meshSource: "district-graybox";
  colliderSource: "separate-unverified";
  textureIsSurveyPhoto: false;
  status: "graybox";
};

export type Graybox = {
  permanentId: PriorityGrayboxId;
  status: "graybox";
  sourceDate: null;
  evidenceStatus: "pending-survey";
  footprint: GrayboxFootprint;
  entrance: {
    status: "pending-survey";
    accuracy: "estimated";
    x: number | null;
    y: null;
    z: number | null;
    clearWidthM: null;
    sourceDate: null;
    note: string;
  };
  floors: DistrictFloor[];
  floorCountNote: string;
  collisionMatchesMesh: false;
  collisionMatchesMeshReason: string;
  asset: GrayboxAsset;
  shellWalkable: true;
  roomsAccessible: false;
  /** 巡禮或場景別名不另建存檔 id。 */
  saveId: PriorityGrayboxId;
  aliasIds: readonly string[];
};

const COLLISION_REASONS: Record<PriorityGrayboxId, string> = {
  palace:
    "沒有實測。清冊 footprint 是單一估計盒。場景外觀是多棟宮燈剪影，碰撞盒由另一組 PALACE 常數逐棟推出，與這個盒不是同一份已核對來源。宮燈與長椅等視覺道具不是碰撞。",
  library:
    "沒有實測。footprint 只用清冊既有的 x、z、w、d。外觀網格、材質與碰撞盒都沒有現勘證明是同一真實外殼。遊戲貼圖不是現勘照片。",
  gym:
    "沒有實測。外觀是廳館剪影，碰撞是估計的軸對齊盒，不能當成已核對的同一來源。程式裡的三層只是層數數字，不是已核實的七樓，也不能拿來切碰撞。視覺量體不是已核對碰撞。",
  museum:
    "沒有實測。外觀是船身、船首與上層結構的剪影，碰撞是軸對齊盒，形狀不同。maritime-museum 只是同座標別名，不是第二個存檔 id。視覺船殼不是已核對碰撞。",
};

const FLOOR_NOTES: Record<PriorityGrayboxId, string> = {
  palace: "清冊只有 1 個層數標籤。分棟、室號與室內用途都沒有圖，每一層維持待測。",
  library: "清冊只有 9 個層數標籤，沒有分層圖。入口層與各層用途待測。圖書館網址只是來源註記，本輪未核對。",
  gym: "清冊只有程式寫入的 3 個層數標籤，每一層都待測。七樓說法沒有圖面，不追加 7F，也不把三層寫成已核實樓層。",
  museum: "清冊只有 3 個層數標籤。黑天鵝展示廳的樓層與入口都沒有圖，不寫進已完成房間。",
};

const ALIASES: Record<PriorityGrayboxId, readonly string[]> = {
  palace: [],
  library: [],
  gym: ["gymnasium"],
  museum: ["maritime-museum"],
};

function buildGraybox(permanentId: PriorityGrayboxId): Graybox {
  const row = CAMPUS_REGISTRY.find((item) => item.permanentId === permanentId);
  const entrance = entranceOf(permanentId);
  if (!row || row.x == null || row.z == null || !row.footprint || !entrance) {
    throw new Error(`graybox ${permanentId} is missing a registry footprint`);
  }
  return {
    permanentId,
    status: "graybox",
    sourceDate: null,
    evidenceStatus: "pending-survey",
    footprint: {
      source: "registry",
      x: row.x,
      z: row.z,
      w: row.footprint.w,
      d: row.footprint.d,
      y: null,
      accuracy: "estimated",
    },
    entrance: {
      status: "pending-survey",
      accuracy: "estimated",
      x: entrance.x,
      y: null,
      z: entrance.z,
      clearWidthM: null,
      sourceDate: null,
      note: entrance.note,
    },
    floors: floorsFor(permanentId),
    floorCountNote: FLOOR_NOTES[permanentId],
    collisionMatchesMesh: false,
    collisionMatchesMeshReason: COLLISION_REASONS[permanentId],
    asset: {
      assetId: `graybox:${permanentId}`,
      kind: "procedural-box",
      meshSource: "district-graybox",
      colliderSource: "separate-unverified",
      textureIsSurveyPhoto: false,
      status: "graybox",
    },
    shellWalkable: true,
    roomsAccessible: false,
    saveId: permanentId,
    aliasIds: ALIASES[permanentId],
  };
}

export const GRAYBOXES: readonly Graybox[] = PRIORITY_GRAYBOX_IDS.map(buildGraybox);

export function grayboxById(permanentId: string): Graybox | null {
  return GRAYBOXES.find((box) => box.permanentId === permanentId) ?? null;
}
