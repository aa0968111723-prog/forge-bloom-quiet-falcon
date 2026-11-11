/**
 * Exam / report / anomaly spawn points on the open campus.
 * Kept off the pilgrimage centreline so the 132-step walk stays clear.
 */

import type { EnemyKind } from "../combat.ts";

export type EnemySpawn = {
  id: string;
  kind: EnemyKind;
  name: string;
  x: number;
  z: number;
  /** Cluster this encounter belongs to, matching campus zones. */
  cluster: "east" | "west-academic" | "library" | "avenue";
};

export const ENEMY_SPAWNS: EnemySpawn[] = [
  { id: "exam-library", kind: "exam", name: "期中考卷", x: 28, z: -286, cluster: "library" },
  { id: "exam-science", kind: "exam", name: "微積分小考", x: 112, z: -26, cluster: "east" },
  { id: "exam-ai", kind: "exam", name: "程式測驗", x: 180, z: -168, cluster: "east" },
  { id: "report-palace", kind: "report", name: "學期報告", x: 8.4, z: -52, cluster: "avenue" },
  { id: "report-business", kind: "report", name: "個案報告", x: 118, z: -166, cluster: "east" },
  { id: "report-lit", kind: "report", name: "讀書報告", x: 98, z: 22, cluster: "east" },
  { id: "anomaly-meadow", kind: "anomaly", name: "牧羊異象", x: -78, z: -318, cluster: "library" },
  { id: "anomaly-west", kind: "anomaly", name: "西坡異象", x: -90, z: -18, cluster: "west-academic" },
  { id: "anomaly-east", kind: "anomaly", name: "五虎異象", x: 158, z: -200, cluster: "east" },
];

export const ENEMY_SPAWN_BY_ID: Record<string, EnemySpawn> = Object.fromEntries(
  ENEMY_SPAWNS.map((e) => [e.id, e]),
);

export const ENEMY_REACH = 3.8;

export function enemyAt(x: number, z: number, reach = ENEMY_REACH): EnemySpawn | null {
  let best: EnemySpawn | null = null;
  let bestD = reach;
  for (const e of ENEMY_SPAWNS) {
    const d = Math.hypot(x - e.x, z - e.z);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}
