import { CAMPUS_REGISTRY, ENTRANCES, type ZoneId } from "../registry/index.ts";

export type DistrictEntrance = {
  permanentId: string;
  zoneId: ZoneId;
  status: "pending-survey";
  accuracy: "estimated";
  x: number | null;
  y: null;
  z: number | null;
  clearWidthM: null;
  sourceDate: null;
  explicitInProgram: boolean;
  note: string;
};

function noteFor(
  permanentId: string,
  officialName: string,
  code: string | null,
  legacyMapNumber: number | null,
  x: number | null,
  z: number | null,
  explicit: boolean,
): string {
  if (permanentId === "business-o") {
    return `傳播館 O 館，permanentId business-o，代碼 ${code}，舊圖號 ${legacyMapNumber}。入口待測，淨寬沒有量測。估計量體中心約在 x=${x}、z=${z}，程式沒有指定門，南側外推只是這棟暫定接近點。這段描述只給這棟，不能改個代號就拿去當另一棟傳播館的門。`;
  }
  if (permanentId === "business-q") {
    return `傳播館 Q 館，permanentId business-q，代碼 ${code}，舊圖號 ${legacyMapNumber}。這是分開的一棟，門位、朝向與淨寬都待測。估計量體中心約在 x=${x}、z=${z}。接近點沒有現勘，而且不得沿用另一棟的南側外推句子。兩棟入口不可互換。`;
  }
  const approach = explicit ? "程式另有接近點，仍不是實測門位。" : "沒有指定門，座標只是估計接近點。";
  return `${officialName}（${permanentId}）入口待測。${approach}淨寬沒有量測。`;
}

export const MEMBER_ENTRANCES: DistrictEntrance[] = CAMPUS_REGISTRY.map((row) => {
  const programmed = ENTRANCES.find((entry) => entry.parentId === row.permanentId);
  const x = programmed?.x ?? row.x;
  const z = programmed?.z ?? row.z;
  return {
    permanentId: row.permanentId,
    zoneId: row.zone,
    status: "pending-survey",
    accuracy: "estimated",
    x,
    y: null,
    z,
    clearWidthM: null,
    sourceDate: null,
    explicitInProgram: programmed?.explicit ?? false,
    note: noteFor(row.permanentId, row.officialName, row.code, row.legacyMapNumber, row.x, row.z, programmed?.explicit ?? false),
  };
});

const entranceByPermanentId = new Map(MEMBER_ENTRANCES.map((entry) => [entry.permanentId, entry]));

export function entranceOf(permanentId: string): DistrictEntrance | null {
  return entranceByPermanentId.get(permanentId) ?? null;
}

export function entranceNote(permanentId: string): string {
  const entry = entranceOf(permanentId);
  if (!entry) throw new Error(`no entrance note for ${permanentId}`);
  return entry.note;
}

const oNote = entranceNote("business-o");
const qNote = entranceNote("business-q");
if (oNote === qNote || oNote.includes("business-q") || qNote.includes("business-o")) {
  throw new Error("O/Q entrance notes must be distinct and not interchangeable");
}
