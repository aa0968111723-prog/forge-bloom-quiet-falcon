import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

test("unreferenced photo textures are not part of the static site", () => {
  assert.equal(existsSync("public/textures"), false);
  const files = [
    ...walk("src").filter((path) => /\.(ts|tsx|css|html)$/.test(path)),
    "index.html",
  ].filter((path) => existsSync(path));
  const blob = files.map((path) => readFileSync(path, "utf8")).join("\n");
  assert.equal(blob.includes("/textures/"), false);
});
