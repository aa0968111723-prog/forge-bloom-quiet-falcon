import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
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

// Better Auth enables its own sign-in limiter only when NODE_ENV=production.
// This flow creates several test accounts back to back. The database-down
// process sets production itself and does not sign in.
process.env.NODE_ENV = "test";

const root = fileURLToPath(new URL("..", import.meta.url));

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

function rpgText(xp, claimed = ["first"]) {
  return JSON.stringify({
    version: 2,
    hp: 80,
    xp,
    slots: [{ itemId: "coffee", quantity: 1 }],
    buildings: [],
    claimed,
    departmentId: "engineering-工學院-0",
  });
}

function createJar(origin) {
  const cookies = new Map();
  return {
    drop(namePart) {
      for (const name of [...cookies.keys()]) {
        if (name.includes(namePart)) cookies.delete(name);
      }
    },
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

async function signUp(jar, base, email) {
  const response = await jar.fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Player", email, password: "correct-horse-1" }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.ok(body.user?.id);
  return body.user.id;
}

async function signIn(jar, base, email) {
  const response = await jar.fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct-horse-1" }),
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.user.id;
}

function saveBody(document, extra = {}) {
  return {
    schemaVersion: 1,
    contentVersion: 2,
    baseRevision: 0,
    confirmFirstSync: false,
    requestId: `req-${Math.random().toString(36).slice(2, 12)}`,
    document,
    ...extra,
  };
}

async function putJson(jar, base, body, headers = {}) {
  return jar.fetch(`${base}/api/cloud/saves/rpg`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-cloud-save": "1", ...headers },
    body: JSON.stringify(body),
  });
}

function spawnServices(env) {
  const child = spawn(
    process.execPath,
    ["--experimental-transform-types", "scripts/game-services-server.mjs"],
    {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    },
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
    output: () => out,
    async listening() {
      const started = Date.now();
      while (!/listening host=\S+ port=\d+/.test(out)) {
        if (child.exitCode != null) throw new Error(out);
        if (Date.now() - started > 30_000) throw new Error(`startup timeout\n${out}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const match = /listening host=(\S+) port=(\d+)/.exec(out);
      return { host: match[1], port: Number(match[2]) };
    },
  };
}

async function stopChild(child) {
  if (child.exitCode != null) return child.exitCode;
  child.kill("SIGTERM");
  const code = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 8_000);
    child.once("exit", (status) => {
      clearTimeout(timer);
      resolve(status);
    });
  });
  return code;
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "tku-cloud-"));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  process.env.AUTH_EMAIL_PASSWORD = "true";
  process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcd";
  process.env.BETTER_AUTH_URL = origin;
  process.env.PGLITE_DATA_DIR = dir;
  process.env.HOST = "0.0.0.0";
  process.env.PORT = String(port);
  delete process.env.DATABASE_URL;
  process.env.CLOUD_SAVE_RATE_LIMIT = "100";

  const { startGameServer } = await import("../src/server/cloud/standalone.ts");
  const { createCloudSaveController, memoryStorage } =
    await import("../src/features/cloud-save/client.ts");
  const { RPG_LOCAL_SAVE_KEY } = await import("../src/features/cloud-save/contract.ts");
  const { getSql, getPglite } = await import("../src/lib/db.ts");
  const { freshGrowthState } = await import("../src/game/rpg/growth/types.ts");
  const { grantQuestReward } = await import("../src/game/rpg/growth/progress.ts");
  const { resetRateLimits } = await import("../src/server/cloud/http.ts");

  assert.equal(RPG_LOCAL_SAVE_KEY, "tamkang-rpg-v2");
  assert.match(
    readFileSync(join(root, "src/game/rpg/store.ts"), "utf8"),
    /export const RPG_SAVE_KEY = "tamkang-rpg-v2"/,
  );
  const adventure = readFileSync(join(root, "src/game/rpg/AdventureApp.tsx"), "utf8");
  assert.equal(adventure.includes("cloud-save"), false);
  assert.equal(/\blogin\b|登入/.test(adventure), false);

  let growth = freshGrowthState();
  growth = grantQuestReward(growth, "first", { xp: 10, notes: 2, credit: 1 });
  const again = grantQuestReward(growth, "first", { xp: 10, notes: 2, credit: 1 });
  assert.equal(again.xp, growth.xp);
  assert.equal(again.materials.notes, growth.materials.notes);
  assert.equal(again.materials.credit, growth.materials.credit);

  let server = await startGameServer({ host: "0.0.0.0", port });
  assert.equal(server.port, port);
  assert.ok(server.host === "0.0.0.0" || server.host === "::");
  const base = server.url;
  const jarA = createJar(origin);
  const storageA = memoryStorage();
  let calls = 0;
  let offline = false;
  let clock = Date.now();
  const clientA = createCloudSaveController({
    fetch: async (url, init) => {
      calls += 1;
      if (offline) throw new Error("offline");
      return jarA.fetch(url, init);
    },
    baseUrl: base,
    storage: storageA,
    now: () => clock,
    randomId: (() => {
      let n = 0;
      return () => `localreq${++n}abcd`;
    })(),
  });

  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal((await health.json()).ok, true);
    const ready = await fetch(`${base}/api/ready`);
    assert.equal(ready.status, 200);

    const beforeCalls = calls;
    clientA.writeLocal(rpgText(5));
    assert.equal(calls, beforeCalls);
    assert.equal(clientA.readLocal(), rpgText(5));
    assert.equal(clientA.activeUser(), null);
    assert.equal((await clientA.plan()).status, "local_only");

    const userA = await signUp(jarA, base, "player-a@example.com");
    clientA.bindAccount(userA);
    assert.equal((await clientA.plan()).status, "need_first_sync");

    const refused = await putJson(jarA, base, saveBody(JSON.parse(rpgText(5))));
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).error.code, "first_sync_required");
    assert.equal(
      (await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json()).error.code,
      "not_found",
    );
    assert.equal(clientA.readLocal(), rpgText(5));

    const uploaded = await clientA.uploadFirstSync();
    assert.equal(uploaded.status, "uploaded");
    assert.equal(uploaded.revision, 1);

    const jarB = createJar(origin);
    const storageB = memoryStorage();
    await signIn(jarB, base, "player-a@example.com");
    const clientB = createCloudSaveController({
      fetch: (url, init) => jarB.fetch(url, init),
      baseUrl: base,
      storage: storageB,
      randomId: () => `clientbreq${Math.random().toString(36).slice(2, 10)}`,
    });
    clientB.bindAccount(userA);
    assert.equal((await clientB.plan()).status, "need_download");
    assert.equal(clientB.readLocal(), null);
    const downloaded = await clientB.downloadCloud();
    assert.equal(downloaded.status, "downloaded");
    assert.equal(JSON.parse(clientB.readLocal()).xp, 5);

    clientA.writeLocal(rpgText(11));
    clientB.writeLocal(rpgText(22));
    const firstRace = [
      saveBody(JSON.parse(rpgText(11)), { baseRevision: 1, requestId: "concurrent-a-0001" }),
      saveBody(JSON.parse(rpgText(22)), { baseRevision: 1, requestId: "concurrent-b-0001" }),
    ];
    const [left, right] = await Promise.all([
      putJson(jarA, base, firstRace[0], { "if-match": '"1"' }),
      putJson(jarB, base, firstRace[1], { "if-match": '"1"' }),
    ]);
    const outcomes = [
      { response: left, jar: jarA, client: clientA, body: firstRace[0], xp: 11 },
      { response: right, jar: jarB, client: clientB, body: firstRace[1], xp: 22 },
    ];
    const winner = outcomes.find((item) => item.response.status === 200);
    const loser = outcomes.find((item) => item.response.status === 409);
    assert.ok(winner && loser);
    const winnerBody = await winner.response.json();
    const loserBody = await loser.response.json();
    assert.equal(loserBody.error.code, "revision_conflict");
    assert.equal(loserBody.server.revision, winnerBody.revision);
    assert.equal(winnerBody.document.xp, winner.xp);
    const keptRemote = await loser.client.keepRemoteVersion();
    assert.equal(keptRemote.status, "downloaded");
    assert.equal(JSON.parse(loser.client.readLocal()).xp, winner.xp);

    const head = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    const contenders = [
      { client: winner.client, jar: winner.jar, xp: 31, requestId: "choose-left-00001" },
      { client: loser.client, jar: loser.jar, xp: 32, requestId: "choose-right-0001" },
    ];
    for (const item of contenders) item.client.writeLocal(rpgText(item.xp));
    const secondRace = await Promise.all(
      contenders.map(async (item) => ({
        ...item,
        response: await putJson(
          item.jar,
          base,
          saveBody(JSON.parse(rpgText(item.xp)), {
            baseRevision: head.revision,
            requestId: item.requestId,
          }),
          { "if-match": `"${head.revision}"` },
        ),
      })),
    );
    const secondLoser = secondRace.find((item) => item.response.status === 409);
    assert.ok(secondRace.some((item) => item.response.status === 200));
    assert.ok(secondLoser);
    const chosen = await secondLoser.client.keepLocalVersion();
    assert.equal(chosen.status, "uploaded");
    const afterChoice = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(afterChoice.document.xp, secondLoser.xp);
    assert.equal(afterChoice.revision, chosen.revision);
    const keptXp = afterChoice.document.xp;

    const replayBody = winner.body;
    const replay = await putJson(winner.jar, base, replayBody, {
      "if-match": `"${replayBody.baseRevision}"`,
    });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).idempotentReplay, true);
    const afterReplay = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(afterReplay.revision, afterChoice.revision);

    const mismatch = await putJson(winner.jar, base, {
      ...replayBody,
      document: JSON.parse(rpgText(41)),
    });
    assert.equal(mismatch.status, 409);
    assert.equal((await mismatch.json()).error.code, "idempotency_mismatch");

    clientA.writeLocal(rpgText(77));
    await jarA.fetch(`${base}/api/auth/sign-out`, { method: "POST" });
    clientA.logout();
    assert.equal(clientA.readLocal(), rpgText(77));
    assert.equal((await clientA.plan()).reason, "signed_out");
    const signedOut = await fetch(`${base}/api/cloud/saves/rpg`);
    assert.equal(signedOut.status, 401);
    await signIn(jarA, base, "player-a@example.com");
    clientA.bindAccount(userA);
    const stillCloud = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(stillCloud.document.xp, keptXp);
    assert.equal(clientA.readLocal(), rpgText(77));

    const forged = await putJson(jarA, base, {
      ...saveBody(JSON.parse(rpgText(1)), {
        baseRevision: stillCloud.revision,
        confirmFirstSync: false,
      }),
      userId: "someone-else",
    });
    assert.equal(forged.status, 403);
    assert.equal((await forged.json()).error.code, "forged_user");
    const forgedGet = await jarA.fetch(`${base}/api/cloud/saves/rpg?userId=${userA}`);
    assert.equal(forgedGet.status, 403);

    const jarC = createJar(origin);
    const userC = await signUp(jarC, base, "player-c@example.com");
    const other = await (await jarC.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(other.error.code, "not_found");
    assert.notEqual(userC, userA);

    const legacy = await putJson(jarA, base, saveBody({ visited: ["kenan"], playSeconds: 3 }));
    assert.equal(legacy.status, 422);
    assert.equal((await legacy.json()).error.code, "legacy_pilgrimage");
    const oldRpg = await putJson(
      jarA,
      base,
      saveBody({
        version: 1,
        departmentId: "math",
        inventory: [{ id: "pen", count: 2 }],
        buildings: [],
        visited: ["kenan"],
      }),
    );
    assert.equal(oldRpg.status, 422);
    assert.equal((await oldRpg.json()).error.code, "legacy_rpg");
    const worldSave = await putJson(
      jarA,
      base,
      saveBody({
        version: 2,
        visited: ["kenan"],
        inventory: [{ id: "notes", count: 1 }],
        buildings: [],
        departmentId: "cs",
      }),
    );
    assert.equal(worldSave.status, 422);
    assert.equal((await worldSave.json()).error.code, "legacy_pilgrimage");
    const sql = await getSql();
    const pilgrimage = await sql.query("select count(*) as n from pilgrimage");
    assert.equal(Number(pilgrimage[0].n), 0);
    const unchanged = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(unchanged.document.xp, keptXp);

    const bad = await putJson(
      jarA,
      base,
      saveBody({ version: 99, hp: 1, slots: [], buildings: [] }, { contentVersion: 99 }),
    );
    assert.equal(bad.status, 422);
    const broken = await jarA.fetch(`${base}/api/cloud/saves/rpg`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: "{",
    });
    assert.equal(broken.status, 400);
    const huge = await jarA.fetch(`${base}/api/cloud/saves/rpg`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: `{"pad":"${"x".repeat(300_000)}"}`,
    });
    assert.equal(huge.status, 413);
    const csrf = await jarA.fetch(`${base}/api/cloud/saves/rpg`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(saveBody(JSON.parse(rpgText(40)))),
    });
    assert.equal(csrf.status, 403);
    const evil = await fetch(`${base}/api/cloud/saves/rpg`, {
      headers: { origin: "https://evil.example" },
    });
    assert.equal(evil.status, 403);
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
    const allowed = await fetch(`${base}/api/health`, { headers: { origin } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    assert.notEqual(allowed.headers.get("access-control-allow-origin"), "*");

    jarA.drop("session_data");
    await sql.query(
      `update "session" set "expiresAt" = now() - interval '1 hour' where "userId" = $1`,
      [userA],
    );
    const expired = await jarA.fetch(`${base}/api/cloud/saves/rpg`);
    assert.equal(expired.status, 401);
    await signIn(jarA, base, "player-a@example.com");

    resetRateLimits();
    process.env.CLOUD_SAVE_RATE_LIMIT = "2";
    const jarD = createJar(origin);
    await signUp(jarD, base, "player-d@example.com");
    const first = await putJson(
      jarD,
      base,
      saveBody(JSON.parse(rpgText(1)), { confirmFirstSync: true, requestId: "rate-first-0001" }),
    );
    const second = await putJson(
      jarD,
      base,
      saveBody(JSON.parse(rpgText(2)), { baseRevision: 1, requestId: "rate-second-001" }),
    );
    const third = await putJson(
      jarD,
      base,
      saveBody(JSON.parse(rpgText(3)), { baseRevision: 2, requestId: "rate-third-0001" }),
    );
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    process.env.CLOUD_SAVE_RATE_LIMIT = "100";

    let grants = 0;
    clientA.bindAccount(userA);
    const rewardA = await clientA.noteReward("quest_first", () => {
      grants += 1;
    });
    const rewardB = await clientA.noteReward("quest_first", () => {
      grants += 1;
    });
    assert.equal(rewardA.granted, true);
    assert.equal(rewardB.granted, false);
    assert.equal(grants, 1);
    const receipt = await jarA.fetch(`${base}/api/cloud/saves/rpg/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({ eventId: "quest_side", requestId: "reward-side-0001" }),
    });
    const receiptAgain = await jarA.fetch(`${base}/api/cloud/saves/rpg/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({ eventId: "quest_side", requestId: "reward-side-0001" }),
    });
    assert.equal((await receipt.json()).applied, true);
    const replayed = await receiptAgain.json();
    assert.equal(replayed.applied, true);
    assert.equal(replayed.idempotentReplay, true);
    const receiptRows = await sql.query(
      "select count(*) as n from reward_receipts where event_id = $1",
      ["quest_side"],
    );
    assert.equal(Number(receiptRows[0].n), 1);

    const content = await clientA.loadContent({ activeEvent: true });
    assert.equal(content.manifest.source, "server");
    assert.equal(content.decision.use, "current");
    assert.equal(content.decision.reason, "active_event");

    const queueUser = await signUp(createJar(origin), base, "player-q@example.com");
    const queueJar = createJar(origin);
    await signIn(queueJar, base, "player-q@example.com");
    const queueStorage = memoryStorage();
    const queueClient = createCloudSaveController({
      fetch: async (url, init) => {
        if (offline) throw new Error("offline");
        return queueJar.fetch(url, init);
      },
      baseUrl: base,
      storage: queueStorage,
      now: () => clock,
      randomId: (() => {
        let n = 0;
        return () => `queue-request-${++n}`.padEnd(16, "x");
      })(),
    });
    queueClient.bindAccount(queueUser);
    queueClient.writeLocal(rpgText(8));
    assert.equal((await queueClient.uploadFirstSync()).status, "uploaded");
    offline = true;
    queueClient.writeLocal(rpgText(9));
    assert.equal((await queueClient.pushLocal()).status, "queued");
    assert.equal(queueClient.queuedCount(queueUser), 1);
    queueClient.bindAccount(userC);
    offline = false;
    assert.equal((await queueClient.flush()).sent, 0);
    assert.equal(queueClient.queuedCount(queueUser), 1);
    const queueCloud = await (await queueJar.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(queueCloud.document.xp, 8);
    queueClient.bindAccount(queueUser);
    clock += 5_000;
    assert.equal((await queueClient.flush()).sent, 1);
    const queueAfter = await (await queueJar.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(queueAfter.document.xp, 9);

    const queueBefore = await (await queueJar.fetch(`${base}/api/cloud/saves/rpg`)).json();
    const saveRows = await sql.query(
      `select schema_version, content_version, revision, document, document_bytes, content_hash
       from rpg_saves where user_id = $1`,
      [userA],
    );
    const revisionRows = await sql.query(
      `select revision, schema_version, content_version, document, content_hash, created_at
       from rpg_save_revisions where user_id = $1 order by revision`,
      [userA],
    );
    const requestRows = await sql.query(
      `select request_id, payload_hash, status_code, response, created_at
       from rpg_save_requests where user_id = $1`,
      [userA],
    );
    const receiptRowsBackup = await sql.query(
      `select event_id, created_at from reward_receipts where user_id = $1 order by event_id`,
      [userA],
    );
    const backup = saveRows[0];
    assert.ok(backup);
    assert.ok(revisionRows.length >= 1);
    assert.ok(requestRows.length >= 1);
    assert.ok(receiptRowsBackup.length >= 1);
    await sql.query("delete from rpg_save_requests where user_id = $1", [userA]);
    await sql.query("delete from reward_receipts where user_id = $1", [userA]);
    await sql.query("delete from rpg_save_revisions where user_id = $1", [userA]);
    await sql.query("delete from rpg_saves where user_id = $1", [userA]);
    assert.equal((await jarA.fetch(`${base}/api/cloud/saves/rpg`)).status, 404);
    const emptied = await (await jarA.fetch(`${base}/api/cloud/saves/rpg/revisions`)).json();
    assert.equal(emptied.headRevision, null);
    assert.deepEqual(emptied.revisions, []);
    const otherStill = await (await queueJar.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(otherStill.revision, queueBefore.revision);
    assert.equal(otherStill.document.xp, queueBefore.document.xp);
    await sql.query(
      `insert into rpg_saves (
         user_id, schema_version, content_version, revision, document, document_bytes, content_hash
       ) values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        userA,
        backup.schema_version,
        backup.content_version,
        backup.revision,
        JSON.stringify(backup.document),
        backup.document_bytes,
        backup.content_hash,
      ],
    );
    for (const row of revisionRows) {
      await sql.query(
        `insert into rpg_save_revisions (
           user_id, revision, schema_version, content_version, document, content_hash, created_at
         ) values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [
          userA,
          row.revision,
          row.schema_version,
          row.content_version,
          JSON.stringify(row.document),
          row.content_hash,
          row.created_at,
        ],
      );
    }
    for (const row of requestRows) {
      await sql.query(
        `insert into rpg_save_requests (
           user_id, request_id, payload_hash, status_code, response, created_at
         ) values ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          userA,
          row.request_id,
          row.payload_hash,
          row.status_code,
          JSON.stringify(row.response),
          row.created_at,
        ],
      );
    }
    for (const row of receiptRowsBackup) {
      await sql.query(
        `insert into reward_receipts (user_id, event_id, created_at) values ($1, $2, $3)`,
        [userA, row.event_id, row.created_at],
      );
    }
    const restored = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(restored.revision, Number(backup.revision));
    assert.equal(restored.document.xp, keptXp);
    const restoredHistory = await (
      await jarA.fetch(`${base}/api/cloud/saves/rpg/revisions`)
    ).json();
    assert.deepEqual(
      restoredHistory.revisions.map((item) => item.revision).sort((left, right) => left - right),
      revisionRows.map((row) => Number(row.revision)).sort((left, right) => left - right),
    );
    assert.equal(JSON.stringify(restoredHistory).includes('"document"'), false);
    const receiptAfterBackup = await sql.query(
      "select count(*) as n from reward_receipts where user_id = $1",
      [userA],
    );
    assert.equal(Number(receiptAfterBackup[0].n), receiptRowsBackup.length);
    const replayedRequest = await putJson(
      jarA,
      base,
      saveBody(JSON.parse(rpgText(1)), {
        baseRevision: Number(backup.revision),
        confirmFirstSync: false,
        requestId: requestRows[0].request_id,
      }),
    );
    assert.equal(replayedRequest.status, 409);
    assert.equal((await replayedRequest.json()).error.code, "idempotency_mismatch");
    const afterMismatch = await (await jarA.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(afterMismatch.revision, Number(backup.revision));
    assert.equal(afterMismatch.document.xp, keptXp);

    const previous = await (
      await jarA.fetch(`${base}/api/cloud/saves/rpg/restore`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-cloud-save": "1" },
        body: JSON.stringify({
          baseRevision: restored.revision,
          revision: 1,
          requestId: "restore-first-01",
        }),
      })
    ).json();
    assert.equal(previous.document.xp, 5);
    assert.ok(previous.revision > restored.revision);

    const histJar = createJar(origin);
    const histUser = await signUp(histJar, base, "player-hist@example.com");
    let histRevision = 0;
    for (let xp = 1; xp <= 9; xp += 1) {
      const response = await putJson(
        histJar,
        base,
        saveBody(JSON.parse(rpgText(xp)), {
          baseRevision: histRevision,
          confirmFirstSync: histRevision === 0,
          requestId: `histreq${String(xp).padStart(4, "0")}`,
        }),
      );
      const uploaded = await response.json();
      assert.equal(response.status, 200, JSON.stringify(uploaded));
      histRevision = uploaded.revision;
      assert.equal(histRevision, xp);
    }
    const listedResponse = await histJar.fetch(`${base}/api/cloud/saves/rpg/revisions`);
    const listed = await listedResponse.json();
    assert.equal(listedResponse.status, 200);
    assert.equal(listed.headRevision, 9);
    assert.equal(listed.revisions.length, 8);
    assert.equal(listed.revisions[0].revision, 9);
    assert.equal(typeof listed.revisions[0].createdAt, "string");
    assert.ok(listed.revisions[0].createdAt.length > 0);
    assert.equal(
      listed.revisions.some((item) => item.revision === 1),
      false,
    );
    assert.equal(
      listed.revisions.some((item) => item.revision === 2),
      true,
    );
    assert.equal(JSON.stringify(listed).includes('"document"'), false);
    assert.equal(
      (await histJar.fetch(`${base}/api/cloud/saves/rpg/revisions?userId=${histUser}`)).status,
      403,
    );
    assert.equal(
      (await createJar(origin).fetch(`${base}/api/cloud/saves/rpg/revisions`)).status,
      401,
    );
    const foreignHistory = await (await jarC.fetch(`${base}/api/cloud/saves/rpg/revisions`)).json();
    assert.equal(foreignHistory.headRevision, null);
    assert.deepEqual(foreignHistory.revisions, []);
    const foreignRestore = await jarC.fetch(`${base}/api/cloud/saves/rpg/restore`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({
        baseRevision: 9,
        revision: 2,
        requestId: "foreign-restore-01",
      }),
    });
    assert.equal(foreignRestore.status, 404);
    const histStorage = memoryStorage();
    let histIds = 0;
    const histClient = createCloudSaveController({
      fetch: (url, init) => histJar.fetch(url, init),
      baseUrl: base,
      storage: histStorage,
      randomId: () => `histclient${String(++histIds).padStart(4, "0")}`,
    });
    histClient.bindAccount(histUser);
    histClient.writeLocal(rpgText(99));
    const missing = await histClient.restoreRevision(1);
    assert.equal(missing.status, "error", JSON.stringify(missing));
    assert.equal(JSON.parse(histClient.readLocal()).xp, 99);
    const headStill = await (await histJar.fetch(`${base}/api/cloud/saves/rpg`)).json();
    assert.equal(headStill.revision, 9);
    assert.equal(headStill.document.xp, 9);
    const chosenRevision = await histClient.restoreRevision(2);
    assert.equal(chosenRevision.status, "restored", JSON.stringify(chosenRevision));
    assert.equal(chosenRevision.revision, 10);
    assert.equal(JSON.parse(histClient.readLocal()).xp, 2);
    const afterPrune = await (await histJar.fetch(`${base}/api/cloud/saves/rpg/revisions`)).json();
    assert.equal(afterPrune.revisions.length, 8);
    assert.equal(
      afterPrune.revisions.some((item) => item.revision === 2),
      false,
    );
    const historyReplay = await histJar.fetch(`${base}/api/cloud/saves/rpg/restore`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({ baseRevision: 10, revision: 3, requestId: "hist-replay-01" }),
    });
    const historyReplayBody = await historyReplay.json();
    assert.equal(historyReplay.status, 200, JSON.stringify(historyReplayBody));
    assert.equal(historyReplayBody.revision, 11);
    assert.equal(historyReplayBody.document.xp, 3);
    const historyReplayAgain = await histJar.fetch(`${base}/api/cloud/saves/rpg/restore`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({ baseRevision: 10, revision: 3, requestId: "hist-replay-01" }),
    });
    const replayAgainBody = await historyReplayAgain.json();
    assert.equal(historyReplayAgain.status, 200);
    assert.equal(replayAgainBody.idempotentReplay, true);
    assert.equal(replayAgainBody.revision, 11);
    assert.equal(replayAgainBody.document.xp, 3);
    const receipts = await sql.query(
      "select count(*) as n from reward_receipts where user_id = $1",
      [histUser],
    );
    assert.equal(Number(receipts[0].n), 0);

    const pg = await getPglite();
    const migration = readFileSync(join(root, "migrations/0003_rpg_saves.sql"), "utf8");
    await pg.exec(migration);
    await pg.exec(migration);
    const names = await sql.query("select name from _migrations order by name");
    assert.deepEqual(
      names.map((row) => row.name),
      ["0001_auth.sql", "0002_pilgrimage.sql", "0003_rpg_saves.sql"],
    );

    await verifyProcessRestart();
    await verifyDatabaseDown();
  } finally {
    if (server) await server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function verifyProcessRestart() {
  const dir = await mkdtemp(join(tmpdir(), "tku-restart-"));
  const port = await freePort();
  const secret = "restart-secret-0123456789abcdef0123456789";
  const env = {
    NODE_ENV: "development",
    AUTH_EMAIL_PASSWORD: "true",
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    PGLITE_DATA_DIR: dir,
    HOST: "0.0.0.0",
    PORT: String(port),
    DATABASE_URL: "",
  };
  const first = spawnServices(env);
  try {
    const heard = await first.listening();
    assert.equal(heard.host, "0.0.0.0");
    assert.equal(heard.port, port);
    const origin = `http://127.0.0.1:${port}`;
    const jar = createJar(origin);
    await signUp(jar, origin, "restart@example.com");
    const firstDoc = {
      ...JSON.parse(rpgText(15, ["first", "gather-notes"])),
      gathered: { notes: 12, parts: 0, coffee: 0, tea: 0 },
      felled: { quiz: 0, report: 2, exam: 0, final: 0 },
      interiorId: "library",
      floor: 3,
      loot: [{ id: "pile-quest", x: 4, z: 8, items: { notes: 2 }, quest: { notes: 1 } }],
    };
    const saved = await putJson(
      jar,
      origin,
      saveBody(firstDoc, { confirmFirstSync: true, requestId: "restart-upload-1" }),
    );
    const savedBody = await saved.json();
    assert.equal(saved.status, 200, JSON.stringify(savedBody));
    assert.equal(savedBody.revision, 1);
    const receipt = await jar.fetch(`${origin}/api/cloud/saves/rpg/receipts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cloud-save": "1" },
      body: JSON.stringify({ eventId: "gather-notes", requestId: "restart-reward-01" }),
    });
    const receiptBody = await receipt.json();
    assert.equal(receipt.status, 200, JSON.stringify(receiptBody));
    assert.equal(receiptBody.applied, true);
    const updated = await putJson(
      jar,
      origin,
      saveBody(
        { ...firstDoc, gathered: { ...firstDoc.gathered, notes: 13 } },
        { baseRevision: 1, confirmFirstSync: false, requestId: "restart-upload-2" },
      ),
    );
    const updatedBody = await updated.json();
    assert.equal(updated.status, 200, JSON.stringify(updatedBody));
    assert.equal(updatedBody.revision, 2);
    assert.equal(await stopChild(first.child), 0);
    const second = spawnServices(env);
    try {
      await second.listening();
      const jar2 = createJar(origin);
      const restartedUser = await signIn(jar2, origin, "restart@example.com");
      const loaded = await (await jar2.fetch(`${origin}/api/cloud/saves/rpg`)).json();
      assert.equal(loaded.document.xp, 15);
      assert.equal(loaded.revision, 2);
      assert.equal(loaded.document.gathered.notes, 13);
      assert.equal(loaded.document.felled.report, 2);
      assert.equal(loaded.document.interiorId, "library");
      assert.equal(loaded.document.floor, 3);
      assert.equal(loaded.document.loot[0].quest.notes, 1);
      assert.equal(loaded.document.claimed.includes("gather-notes"), true);
      const { canonicalJson, sha256Hex } = await import("../src/features/cloud-save/contract.ts");
      const { createCloudSaveController, memoryStorage } = await import(
        "../src/features/cloud-save/client.ts"
      );
      assert.equal(await sha256Hex(canonicalJson(loaded.document)), loaded.contentHash);
      const client = createCloudSaveController({
        fetch: (url, init) => jar2.fetch(url, init),
        baseUrl: origin,
        storage: memoryStorage(),
        randomId: () => "restart-download-1",
      });
      client.bindAccount(restartedUser);
      const downloaded = await client.downloadCloud();
      assert.equal(downloaded.status, "downloaded", JSON.stringify(downloaded));
      const local = JSON.parse(client.readLocal());
      assert.equal(local.loot[0].quest.notes, 1);
      assert.equal(local.interiorId, "library");
      assert.equal(local.floor, 3);
      const history = await (await jar2.fetch(`${origin}/api/cloud/saves/rpg/revisions`)).json();
      assert.deepEqual(
        history.revisions.map((item) => item.revision).sort((left, right) => left - right),
        [1, 2],
      );
      assert.equal(JSON.stringify(history).includes('"document"'), false);
      const repeated = await jar2.fetch(`${origin}/api/cloud/saves/rpg/receipts`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-cloud-save": "1" },
        body: JSON.stringify({ eventId: "gather-notes", requestId: "restart-reward-02" }),
      });
      const repeatedBody = await repeated.json();
      assert.equal(repeated.status, 200, JSON.stringify(repeatedBody));
      assert.equal(repeatedBody.applied, false);
      const replayed = await jar2.fetch(`${origin}/api/cloud/saves/rpg/receipts`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-cloud-save": "1" },
        body: JSON.stringify({ eventId: "gather-notes", requestId: "restart-reward-01" }),
      });
      const replayedBody = await replayed.json();
      assert.equal(replayed.status, 200, JSON.stringify(replayedBody));
      assert.equal(replayedBody.idempotentReplay, true);
      assert.equal(replayedBody.applied, true);
      const still = await (await jar2.fetch(`${origin}/api/cloud/saves/rpg`)).json();
      assert.equal(still.revision, 2);
      assert.equal(still.document.gathered.notes, 13);
      assert.equal(still.document.loot[0].quest.notes, 1);
      const restored = await jar2.fetch(`${origin}/api/cloud/saves/rpg/restore`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-cloud-save": "1" },
        body: JSON.stringify({
          baseRevision: 2,
          revision: 1,
          requestId: "restart-restore-1",
        }),
      });
      const restoredBody = await restored.json();
      assert.equal(restored.status, 200, JSON.stringify(restoredBody));
      assert.equal(restoredBody.revision, 3);
      assert.equal(restoredBody.document.gathered.notes, 12);
      assert.equal(restoredBody.document.loot[0].quest.notes, 1);
      assert.equal(restoredBody.document.floor, 3);
      assert.equal(
        await sha256Hex(canonicalJson(restoredBody.document)),
        restoredBody.contentHash,
      );
    } finally {
      await stopChild(second.child);
    }
  } finally {
    await stopChild(first.child);
    await rm(dir, { recursive: true, force: true });
  }
}

async function verifyDatabaseDown() {
  const port = await freePort();
  const child = spawnServices({
    NODE_ENV: "production",
    AUTH_EMAIL_PASSWORD: "false",
    BETTER_AUTH_SECRET: "down-secret-0123456789abcdef0123456789ab",
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    HOST: "0.0.0.0",
    PORT: String(port),
    DATABASE_URL: "postgres://127.0.0.1:1/cloud_save_down",
    PGLITE_DATA_DIR: "",
  });
  try {
    const heard = await child.listening();
    assert.equal(heard.host, "0.0.0.0");
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    const ready = await fetch(`http://127.0.0.1:${port}/api/ready`);
    assert.equal(ready.status, 503);
    assert.equal((await ready.json()).error.code, "database_unavailable");
    assert.equal(child.child.exitCode, null);
    assert.equal(await stopChild(child.child), 0);
  } finally {
    await stopChild(child.child);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
