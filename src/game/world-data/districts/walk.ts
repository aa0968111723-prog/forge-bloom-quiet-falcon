import { CAMPUS_REGISTRY, ROUTE_SPECS } from "../registry/index.ts";
import { grayboxById } from "./grayboxes.ts";

export type WalkPhaseName = "步行抵達" | "進入" | "切樓層" | "離開" | "重載";

export type WalkPhase = {
  phase: WalkPhaseName;
  result: string;
  note: string;
};

export type WalkScript = {
  id: string;
  known: boolean;
  graybox: boolean;
  reportsSurveyedStepCount: false;
  stepCount: null;
  surveyedStepCount: null;
  controlPointsUsedForFit: false;
  routeId: string | null;
  routeAccuracy: "estimated" | null;
  routeStatus: string | null;
  phases: WalkPhase[];
};

function routeFor(permanentId: string) {
  return ROUTE_SPECS.find((route) => route.toId === permanentId) ?? null;
}

/**
 * 步行腳本只描述灰盒外殼。樓層還是待測時，切樓層一定是 blocked-pending。
 * 不回報階數，也不拿控制點擬合。
 */
export function walkScript(id: string): WalkScript {
  const row = CAMPUS_REGISTRY.find((item) => item.permanentId === id);
  const box = grayboxById(id);
  const route = routeFor(id);
  const floors = box?.floors ?? row?.floors ?? [];
  const floorPending = floors.length === 0 || floors.some((floor) => floor.status === "pending-survey");
  const arriveNote = route
    ? "沿尚未依現勘重算的估計折線走近。階數、級高、踏面都不回報，也不把公開說法升格。"
    : "沒有從克難坡出發的既定路線。若要接近，只用估計座標，距離與階數都未測。";
  const enterResult = box ? "graybox-shell" : "blocked-pending";
  const enterNote = box
    ? "可走進估計量體的灰盒外殼。沒有真實房間，視覺道具不是已核對碰撞。"
    : "這棟還沒有可走的灰盒外殼，不能假進室內。";
  return {
    id,
    known: Boolean(row),
    graybox: Boolean(box),
    reportsSurveyedStepCount: false,
    stepCount: null,
    surveyedStepCount: null,
    controlPointsUsedForFit: false,
    routeId: route?.id ?? null,
    routeAccuracy: route ? route.accuracy : null,
    routeStatus: route?.status ?? null,
    phases: [
      { phase: "步行抵達", result: "estimated-walk", note: arriveNote },
      { phase: "進入", result: enterResult, note: enterNote },
      {
        phase: "切樓層",
        result: floorPending ? "blocked-pending" : "change-floor",
        note: floorPending ? "樓層待測，沒有分層圖，不能進入真實房間。" : "樓層已有核對資料才可切換。",
      },
      {
        phase: "離開",
        result: box ? "left-shell" : "blocked-pending",
        note: box ? "離開灰盒外殼，回到待測的估計入口附近。" : "沒有進入，也就沒有室內可離開。",
      },
      {
        phase: "重載",
        result: row ? "same-permanent-id" : "unknown-id",
        note: row ? `重載仍使用存檔 id ${row.permanentId}，不複製第二個 id。` : "未知 id，不新建存檔。",
      },
    ],
  };
}
