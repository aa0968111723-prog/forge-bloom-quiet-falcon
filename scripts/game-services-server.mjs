#!/usr/bin/env node
/**
 * Optional Node process for RPG cloud save.
 * The static site does not start this. Production must set BETTER_AUTH_SECRET.
 */
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

await register(
  pathToFileURL(
    fileURLToPath(new URL("../src/game/rpg/acceptance/node-resolve.mjs", import.meta.url)),
  ).href,
  import.meta.url,
);

if (process.env.NODE_ENV !== "production") {
  process.env.AUTH_EMAIL_PASSWORD ??= "true";
}

if (!process.env.DATABASE_URL?.trim()) {
  process.env.PGLITE_DATA_DIR ??= join(process.cwd(), "data", "pglite");
}

if (!process.env.BETTER_AUTH_SECRET?.trim()) {
  if (process.env.NODE_ENV === "production") {
    console.error("[game-services] BETTER_AUTH_SECRET is required in production");
    process.exit(1);
  }
  const file = join(process.cwd(), "data", "dev-auth-secret");
  await mkdir(dirname(file), { recursive: true });
  let secret = "";
  try {
    secret = (await readFile(file, "utf8")).trim();
  } catch {
    secret = "";
  }
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    await writeFile(file, secret, { mode: 0o600 });
    await chmod(file, 0o600);
  }
  process.env.BETTER_AUTH_SECRET = secret;
}

process.env.HOST ??= "0.0.0.0";

if (process.env.DATABASE_URL?.trim()) {
  const { migrateDatabase } = await import("./migrate.mjs");
  try {
    await migrateDatabase();
  } catch (err) {
    console.error(
      "[game-services] database migrate failed; health stays up and ready stays down",
      err instanceof Error ? err.name : "error",
    );
  }
}

const { startGameServer } = await import("../src/server/cloud/standalone.ts");
const started = await startGameServer();
console.log(`game-services listening host=${started.host} port=${started.port}`);

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await started.close();
  process.exit(0);
}
process.on("SIGTERM", () => {
  void shutdown();
});
process.on("SIGINT", () => {
  void shutdown();
});
