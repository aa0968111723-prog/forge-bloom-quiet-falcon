import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
await import("./build-rpg-test.mjs");
const files = readdirSync(new URL("./", import.meta.url))
  .filter((f) => f.endsWith(".test.mjs"))
  .map((f) => `scripts/${f}`);
if (!files.length) throw new Error("No tests discovered");
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
