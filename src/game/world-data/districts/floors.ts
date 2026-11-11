import { CAMPUS_REGISTRY } from "../registry/index.ts";

/** 只有層數標籤、沒有分層圖。用途保持空白，不准升格。 */
export type DistrictFloor = {
  label: string;
  status: "pending-survey";
  evidence: "count-only";
  use: null;
  sourceDate: null;
  note: string;
};

export function floorsFor(permanentId: string): DistrictFloor[] {
  const row = CAMPUS_REGISTRY.find((item) => item.permanentId === permanentId);
  if (!row) return [];
  return row.floors.map((floor) => ({
    label: floor.label,
    status: "pending-survey",
    evidence: "count-only",
    use: null,
    sourceDate: null,
    note: "只有程式層數標籤，沒有分層圖，樓層用途待測。",
  }));
}
