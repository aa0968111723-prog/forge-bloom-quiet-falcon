import { CAMPUS_REGISTRY, ROUTE_SPECS, ZONE_BOUNDS, type RegistryAccuracy } from "../registry/index.ts";
import { entranceNote } from "./entrances.ts";
import { COMPLETION_ITEMS, FIXTURE_GAPS, ROOM_GAPS, completionCount } from "./gaps.ts";
import { GRAYBOXES } from "./grayboxes.ts";
import { DISTRICT_PACKS } from "./packs.ts";
import { walkScript } from "./walk.ts";

export { DISTRICT_PACKS } from "./packs.ts";
export { GRAYBOXES } from "./grayboxes.ts";
export { walkScript } from "./walk.ts";
export { FIXTURE_GAPS, ROOM_GAPS, COMPLETION_ITEMS, completionCount } from "./gaps.ts";
export { MEMBER_ENTRANCES, entranceNote, entranceOf } from "./entrances.ts";
export { floorsFor } from "./floors.ts";

const ZONE_IDS = ["axis-54", "library-55", "stem-56", "teaching-57", "culture-58", "sports-59", "life-60"] as const;

function assertNoSurveyed(value: unknown, path: string): void {
  if (value === "surveyed") throw new Error(`surveyed at ${path}`);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSurveyed(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) assertNoSurveyed(item, `${path}.${key}`);
  }
}

function assertDistricts(): void {
  if (DISTRICT_PACKS.length !== 7) throw new Error("expected seven district packs");
  if (DISTRICT_PACKS.map((pack) => pack.zoneId).join() !== ZONE_IDS.join()) throw new Error("zone order");
  if (ZONE_BOUNDS.map((zone) => zone.id).join() !== ZONE_IDS.join()) throw new Error("zone bounds drifted");
  const registryIds = new Set(CAMPUS_REGISTRY.map((row) => row.permanentId));
  for (const pack of DISTRICT_PACKS) {
    if (pack.evidenceStatus !== "pending-survey") throw new Error(pack.zoneId);
    const zone = ZONE_BOUNDS.find((item) => item.id === pack.zoneId);
    if (!zone || zone.memberIds.join() !== pack.memberIds.join()) throw new Error(`members ${pack.zoneId}`);
    for (const permanentId of pack.memberIds) {
      if (!registryIds.has(permanentId)) throw new Error(permanentId);
    }
  }
  const grayIds = GRAYBOXES.map((box) => box.permanentId).join();
  if (grayIds !== "palace,library,gym,museum") throw new Error("grayboxes");
  for (const box of GRAYBOXES) {
    const row = CAMPUS_REGISTRY.find((item) => item.permanentId === box.permanentId);
    if (!row?.footprint || row.x == null || row.z == null) throw new Error(box.permanentId);
    if (box.footprint.source !== "registry" || box.footprint.accuracy !== "estimated") throw new Error("footprint");
    if (box.footprint.x !== row.x || box.footprint.z !== row.z) throw new Error("footprint xz");
    if (box.footprint.w !== row.footprint.w || box.footprint.d !== row.footprint.d) throw new Error("footprint size");
    if (box.entrance.status !== "pending-survey" || box.collisionMatchesMesh !== false) throw new Error("graybox flags");
    if (!box.collisionMatchesMeshReason) throw new Error("collision reason");
    if (box.floors.length !== row.floors.length || box.floors.some((floor) => floor.status !== "pending-survey")) {
      throw new Error("floors");
    }
    if (box.status !== "graybox" || box.sourceDate !== null) throw new Error("graybox status");
  }
  if (entranceNote("business-o") === entranceNote("business-q")) throw new Error("O/Q notes");
  for (const box of GRAYBOXES) {
    const script = walkScript(box.permanentId);
    if (script.reportsSurveyedStepCount || script.stepCount !== null || script.surveyedStepCount !== null) {
      throw new Error("step count");
    }
    if (script.controlPointsUsedForFit) throw new Error("fit");
    const change = script.phases.find((phase) => phase.phase === "切樓層");
    if (change?.result !== "blocked-pending") throw new Error("floor change");
  }
  if (completionCount() !== 0) throw new Error("completion");
  const axis = DISTRICT_PACKS.find((pack) => pack.zoneId === "axis-54");
  if (!axis?.memberIds.includes("chuehhsuan") || !axis.memberIds.includes("juexuan-garden")) throw new Error("juexuan");
  const surveyed = new Set<RegistryAccuracy>(["surveyed"]);
  for (const route of ROUTE_SPECS) {
    if (surveyed.has(route.accuracy)) throw new Error(route.id);
  }
  assertNoSurveyed(DISTRICT_PACKS, "packs");
  assertNoSurveyed(GRAYBOXES, "grayboxes");
  assertNoSurveyed(FIXTURE_GAPS, "fixtures");
  assertNoSurveyed(ROOM_GAPS, "rooms");
  assertNoSurveyed(COMPLETION_ITEMS, "completion");
  for (const id of GRAYBOXES.map((box) => box.permanentId)) assertNoSurveyed(walkScript(id), `walk:${id}`);
}

assertDistricts();
