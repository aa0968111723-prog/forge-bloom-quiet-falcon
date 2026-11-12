import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("../public/game-art/", import.meta.url);

/** Raw and gzip ceilings. Measured 2026-11-12 with node:zlib; headroom is about 15%. */
const CEILINGS = {
  "characters/student-kit.glb": { raw: 1_400_000, gzip: 530_000 },
  "characters/student-kit-lod1.glb": { raw: 800_000, gzip: 330_000 },
  "characters/npc-kit.glb": { raw: 1_850_000, gzip: 700_000 },
  "creatures/quiz.glb": { raw: 220_000, gzip: 115_000 },
  "creatures/report.glb": { raw: 240_000, gzip: 100_000 },
  "creatures/exam.glb": { raw: 250_000, gzip: 115_000 },
  "creatures/final.glb": { raw: 280_000, gzip: 110_000 },
};

function walk(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(path).isDirectory()) out.push(...walk(path, rel));
    else if (name.endsWith(".glb")) out.push(rel);
  }
  return out;
}

test("committed game-art stays inside the measured transfer budget", () => {
  const found = walk(ROOT.pathname).sort();
  assert.deepEqual(found, Object.keys(CEILINGS).sort());
  let rawSum = 0;
  let gzipSum = 0;
  for (const rel of found) {
    const bytes = readFileSync(join(ROOT.pathname, rel));
    const gzip = gzipSync(bytes).length;
    const cap = CEILINGS[rel];
    rawSum += bytes.length;
    gzipSum += gzip;
    assert.ok(bytes.length <= cap.raw, `${rel} raw ${bytes.length} exceeds ${cap.raw}`);
    assert.ok(gzip <= cap.gzip, `${rel} gzip ${gzip} exceeds ${cap.gzip}`);
  }
  assert.ok(gzipSum < 1_900_000, `gzipped set is ${gzipSum}`);
  console.log(`game-art budget: raw ${rawSum} gzip ${gzipSum}`);
});
