/**
 * Rebuild the campus disposition from the live registry.
 *
 * The game already assembles CAMPUS_REGISTRY at import time. This snapshot
 * is the art-side copy: one row per permanentId, with accuracy kept apart
 * from whether a model is in the scene. It is compared with the counts in
 * docs/art/BASELINE.md section 6. A matching count is not a survey.
 */
import { CAMPUS_REGISTRY } from "../../src/game/world-data/registry/index.ts";
import { entranceOf } from "../../src/game/world-data/districts/entrances.ts";

const BASELINE = {
  source: "docs/art/BASELINE.md §6",
  total: 64,
  aliasIds: ["business-building", "chingsheng-building", "gymnasium", "maritime-museum"],
  nonAlias: 60,
  saveKey: 48,
  activeInScene: 54,
  kind: { "campus-site": 41, pilgrimage: 7, alias: 4, homonym: 8, omission: 4 },
  zone: {
    "axis-54": 11,
    "library-55": 6,
    "stem-56": 11,
    "teaching-57": 11,
    "culture-58": 9,
    "sports-59": 9,
    "life-60": 7,
  },
};

function tally(rows, key) {
  const out = {};
  for (const row of rows) out[row[key]] = (out[row[key]] ?? 0) + 1;
  return out;
}

function sameCount(now, baseline) {
  const keys = new Set([...Object.keys(now), ...Object.keys(baseline)]);
  const changes = [];
  for (const key of [...keys].sort()) {
    if ((now[key] ?? 0) !== (baseline[key] ?? 0)) changes.push({ key, baseline: baseline[key] ?? 0, now: now[key] ?? 0 });
  }
  return changes;
}

/** Fresh disposition. Stable key order so a rewrite can be compared byte for byte. */
export function registrySnapshot() {
  const rows = CAMPUS_REGISTRY.map((row) => {
    const entrance = entranceOf(row.permanentId);
    const buildStatus = row.aliasOf
      ? "alias-not-duplicated"
      : row.activeInScene
        ? "in-scene-estimated"
        : "not-in-scene";
    return {
      permanentId: row.permanentId,
      officialName: row.officialName,
      zone: row.zone,
      kind: row.kind,
      aliasOf: row.aliasOf,
      saveKey: row.saveKey,
      activeInScene: row.activeInScene,
      accuracy: row.accuracy,
      registryStatus: row.status,
      buildStatus,
      acceptance: "pending-survey",
      legacyMapNumber: row.legacyMapNumber,
      code: row.code,
      x: row.x,
      y: row.y,
      z: row.z,
      footprint: row.footprint,
      source: row.source,
      sourceDate: row.sourceDate,
      license: row.license,
      fieldChecked: row.fieldChecked,
      entrance: entrance
        ? {
            status: entrance.status,
            accuracy: entrance.accuracy,
            x: entrance.x,
            z: entrance.z,
            clearWidthM: entrance.clearWidthM,
            explicitInProgram: entrance.explicitInProgram,
          }
        : null,
      lod: row.activeInScene ? "shared-campus-mesh" : "none",
      relation: row.relation ? { type: row.relation.type, otherId: row.relation.otherId } : null,
    };
  });
  const aliasIds = rows.filter((row) => row.aliasOf).map((row) => row.permanentId).sort();
  const kind = tally(rows, "kind");
  const zone = tally(rows, "zone");
  const saveKey = rows.filter((row) => row.saveKey).length;
  const activeInScene = rows.filter((row) => row.activeInScene).length;
  return {
    generatedFrom: "src/game/world-data/registry/index.ts",
    accuracyNote: "accuracy is data precision. buildStatus is whether the game draws it. Neither field means the building was surveyed.",
    counts: {
      total: rows.length,
      alias: aliasIds.length,
      nonAlias: rows.length - aliasIds.length,
      saveKey,
      activeInScene,
      kind,
      zone,
      accuracy: tally(rows, "accuracy"),
    },
    diffFromBaseline: {
      source: BASELINE.source,
      total: { baseline: BASELINE.total, now: rows.length },
      aliasIds: {
        baseline: BASELINE.aliasIds,
        now: aliasIds,
        added: aliasIds.filter((id) => !BASELINE.aliasIds.includes(id)),
        removed: BASELINE.aliasIds.filter((id) => !aliasIds.includes(id)),
      },
      saveKey: { baseline: BASELINE.saveKey, now: saveKey },
      activeInScene: { baseline: BASELINE.activeInScene, now: activeInScene },
      kind: sameCount(kind, BASELINE.kind),
      zone: sameCount(zone, BASELINE.zone),
    },
    rows,
  };
}

export const REGISTRY_BASELINE = BASELINE;
