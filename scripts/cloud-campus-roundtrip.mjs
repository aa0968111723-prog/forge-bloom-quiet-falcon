import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { register } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

await register(
  pathToFileURL(
    fileURLToPath(new URL("../src/game/rpg/acceptance/node-resolve.mjs", import.meta.url)),
  ).href,
  import.meta.url,
);

process.env.NODE_ENV = "test";

const root = fileURLToPath(new URL("..", import.meta.url));

function campusSave() {
  return {
    version: 2,
    hp: 90,
    xp: 40,
    slots: [{ itemId: "notes", quantity: 1 }],
    buildings: [{ id: "desk-1", kind: "desk", x: 4, z: 8, rotation: 0, hp: 120 }],
    departmentId: "engineering-工學院-0",
    interiorId: "library",
    floor: 3,
    position: { x: 12, z: 18, yaw: 0 },
    narrative: {
      version: 1,
      seed: "campus",
      rngState: 1,
      minute: 480,
      placeId: "library",
      weather: "clear",
      timeOfDay: "morning",
      semester: "week-1",
      collegeId: "engineering",
      departmentId: null,
      flags: { "gate-asked-map": true },
      questNodes: {},
      memory: {},
      cooldowns: {},
      mutexUntil: {},
      mutexHolder: {},
      recent: [],
      fired: ["evt-gate-orientation"],
      resolved: [],
      activeEventId: "evt-library-compare",
      mode: "in-event",
    },
    variety: {
      version: 1,
      rng: 7,
      recent: [],
      resolved: [],
      claims: [],
      route: null,
      tutorialSeen: false,
      signals: [],
      active: null,
    },
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function createJar(origin) {
  const cookies = new Map();
  return {
    header() {
      return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    async fetch(url, init = {}) {
      const headers = new Headers(init.headers);
      headers.set("origin", origin);
      const cookie = this.header();
      if (cookie) headers.set("cookie", cookie);
      const response = await fetch(url, { ...init, headers, redirect: "manual" });
      for (const line of response.headers.getSetCookie?.() ?? []) {
        const pair = line.split(";", 1)[0] ?? "";
        const eq = pair.indexOf("=");
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      return response;
    },
  };
}

function spawnServices(env) {
  const child = spawn(
    process.execPath,
    ["--experimental-transform-types", "scripts/game-services-server.mjs"],
    { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] },
  );
  let out = "";
  child.stdout.on("data", (chunk) => {
    out += chunk;
  });
  child.stderr.on("data", (chunk) => {
    out += chunk;
  });
  return {
    child,
    async listening() {
      const started = Date.now();
      while (!/listening host=\S+ port=\d+/.test(out)) {
        if (child.exitCode != null) throw new Error(out);
        if (Date.now() - started > 30_000) throw new Error(`startup timeout\n${out}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
  };
}

async function stopChild(child) {
  if (child.exitCode != null) return child.exitCode;
  child.kill("SIGTERM");
  return new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 8_000);
    child.once("exit", (status) => {
      clearTimeout(timer);
      resolve(status);
    });
  });
}

function assertCampus(raw) {
  const doc = typeof raw === "string" ? JSON.parse(raw) : raw;
  assert.equal(doc.interiorId, "library");
  assert.equal(doc.floor, 3);
  assert.equal(doc.narrative.seed, "campus");
  assert.equal(doc.narrative.activeEventId, "evt-library-compare");
  assert.equal(doc.narrative.mode, "in-event");
  assert.equal(doc.variety.version, 1);
  assert.equal(doc.buildings[0].id, "desk-1");
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "tku-campus-"));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = {
    NODE_ENV: "development",
    AUTH_EMAIL_PASSWORD: "true",
    BETTER_AUTH_SECRET: "campus-secret-0123456789abcdef0123456789",
    BETTER_AUTH_URL: origin,
    PGLITE_DATA_DIR: dir,
    HOST: "0.0.0.0",
    PORT: String(port),
    DATABASE_URL: "",
    CLOUD_SAVE_RATE_LIMIT: "100",
  };
  const { createCloudSaveController, memoryStorage } =
    await import("../src/features/cloud-save/client.ts");
  const text = JSON.stringify(campusSave());
  const first = spawnServices(env);
  try {
    await first.listening();
    const jar = createJar(origin);
    let calls = 0;
    const storage = memoryStorage();
    const client = createCloudSaveController({
      fetch: async (url, init) => {
        calls += 1;
        return jar.fetch(url, init);
      },
      baseUrl: origin,
      storage,
      randomId: () => "campusreq01",
    });
    const before = calls;
    client.writeLocal(text);
    assert.equal(calls, before);
    const signed = await jar.fetch(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Player",
        email: "campus@example.com",
        password: "correct-horse-1",
      }),
    });
    const user = await signed.json();
    assert.equal(signed.status, 200, JSON.stringify(user));
    client.bindAccount(user.user.id);
    assert.equal((await client.plan()).status, "need_first_sync");
    const uploaded = await client.uploadFirstSync();
    assert.equal(uploaded.status, "uploaded", JSON.stringify(uploaded));
    assert.equal(uploaded.revision, 1);

    const other = memoryStorage();
    const reader = createCloudSaveController({
      fetch: (url, init) => jar.fetch(url, init),
      baseUrl: origin,
      storage: other,
      randomId: () => "campusreq02",
    });
    reader.bindAccount(user.user.id);
    assert.equal((await reader.plan()).status, "need_download");
    const downloaded = await reader.downloadCloud();
    assert.equal(downloaded.status, "downloaded");
    assertCampus(reader.readLocal());
    assert.equal(await stopChild(first.child), 0);

    const second = spawnServices(env);
    try {
      await second.listening();
      const jar2 = createJar(origin);
      const again = await jar2.fetch(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "campus@example.com", password: "correct-horse-1" }),
      });
      assert.equal(again.status, 200, await again.clone().text());
      const restored = memoryStorage();
      const after = createCloudSaveController({
        fetch: (url, init) => jar2.fetch(url, init),
        baseUrl: origin,
        storage: restored,
        randomId: () => "campusreq03",
      });
      after.bindAccount(user.user.id);
      assert.equal((await after.plan()).status, "need_download");
      const loaded = await after.downloadCloud();
      assert.equal(loaded.status, "downloaded");
      assert.equal(loaded.revision, 1);
      assertCampus(after.readLocal());
    } finally {
      await stopChild(second.child);
    }
  } finally {
    await stopChild(first.child);
    await rm(dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
