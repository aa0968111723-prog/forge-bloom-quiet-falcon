import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test(
  "a campus interior survives cloud upload, download, and database restart",
  { timeout: 120_000 },
  () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-transform-types", "scripts/cloud-campus-roundtrip.mjs"],
      { cwd: root, stdio: "inherit", env: process.env },
    );
    assert.equal(result.status, 0);
  },
);
