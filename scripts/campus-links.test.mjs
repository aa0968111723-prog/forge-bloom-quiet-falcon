import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_ROADS, CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";
import { resolveCollision } from "../src/game/world-data/colliders.ts";
import { entranceRoadPath } from "../src/game/rpg/rules.ts";

function distPointSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

function distToRoads(x, z) {
  let best = Infinity;
  for (const poly of CAMPUS_ROADS) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, az] = poly[i - 1];
      const [bx, bz] = poly[i];
      best = Math.min(best, distPointSeg(x, z, ax, az, bx, bz));
    }
  }
  return best;
}

test("every campus door walks onto the estimated road grid", () => {
  assert.ok(CAMPUS_SITES.length >= 41);
  for (const site of CAMPUS_SITES) {
    const door = siteEntrance(site);
    const path = entranceRoadPath(site);
    assert.ok(path.length >= 2, site.id);
    assert.equal(path[0][0], door.x);
    assert.equal(path[0][1], door.z);
    assert.ok(distToRoads(path.at(-1)[0], path.at(-1)[1]) < 1.6, site.id);
  }
  for (const id of ["audiovisual", "main-gate"]) {
    const site = CAMPUS_SITES.find((item) => item.id === id);
    const path = entranceRoadPath(site);
    assert.ok(path.length >= 2, id);
    assert.ok(distToRoads(path.at(-1)[0], path.at(-1)[1]) < 1.6, id);
  }
});

test("estimated road centerlines stay outside solid walls", () => {
  const radius = 0.42;
  for (const poly of CAMPUS_ROADS) {
    for (let i = 1; i < poly.length; i++) {
      const [ax, az] = poly[i - 1];
      const [bx, bz] = poly[i];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.4));
      let x = ax;
      let z = az;
      for (let k = 1; k <= n; k++) {
        const tx = ax + ((bx - ax) * k) / n;
        const tz = az + ((bz - az) * k) / n;
        const next = resolveCollision(tx, tz, radius);
        const moved = Math.hypot(next.x - x, next.z - z);
        const wanted = Math.hypot(tx - x, tz - z);
        assert.ok(
          wanted <= 0.08 || moved >= wanted * 0.45,
          `road stuck near ${tx.toFixed(1)}, ${tz.toFixed(1)}`,
        );
        x = next.x;
        z = next.z;
      }
    }
  }
});

test("estimated campus roads form one connected grid", () => {
  const n = CAMPUS_ROADS.length;
  const parent = CAMPUS_ROADS.map((_, index) => index);
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const unite = (a, b) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let hit = false;
      for (const [x, z] of CAMPUS_ROADS[i]) {
        if (distToRoadsOn(CAMPUS_ROADS[j], x, z) < 1.5) hit = true;
      }
      for (const [x, z] of CAMPUS_ROADS[j]) {
        if (distToRoadsOn(CAMPUS_ROADS[i], x, z) < 1.5) hit = true;
      }
      if (hit) unite(i, j);
    }
  }
  const roots = new Set(CAMPUS_ROADS.map((_, index) => find(index)));
  assert.equal(roots.size, 1);
});

function distToRoadsOn(polys, x, z) {
  let best = Infinity;
  const roads = Array.isArray(polys[0]?.[0]) ? polys : [polys];
  for (const poly of roads) {
    for (let i = 1; i < poly.length; i++) {
      best = Math.min(best, distPointSeg(x, z, poly[i - 1][0], poly[i - 1][1], poly[i][0], poly[i][1]));
    }
  }
  return best;
}
