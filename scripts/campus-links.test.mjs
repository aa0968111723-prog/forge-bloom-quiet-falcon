import assert from "node:assert/strict";
import test from "node:test";

import { CAMPUS_ROADS, CAMPUS_SITES, siteEntrance } from "../src/game/rpg/campus.ts";
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
