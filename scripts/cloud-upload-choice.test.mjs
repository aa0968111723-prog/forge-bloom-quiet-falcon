import assert from "node:assert/strict";
import test from "node:test";

import { createCloudSaveController, memoryStorage } from "../src/features/cloud-save/client.ts";
import { canonicalJson, sha256Hex } from "../src/features/cloud-save/contract.ts";

function save(xp) {
  return { version: 2, hp: 80, xp, slots: [{ itemId: "notes", quantity: 1 }], buildings: [] };
}

function sessionFor(userId) {
  return jsonResponse(200, { user: { id: userId } });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeCloud() {
  let remote = null;
  let revision = 0;
  let offline = false;
  let dropNextPut = false;
  const seen = new Map();
  const puts = [];
  let ids = 0;
  let sessionId = "user-a";
  const fetch = async (_url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(_url).includes("/api/auth/get-session")) {
      return jsonResponse(200, { user: sessionId ? { id: sessionId } : null });
    }
    const method = init.method ?? "GET";
    if (method === "GET") {
      if (!remote)
        return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
      return jsonResponse(200, await head());
    }
    const body = JSON.parse(init.body);
    puts.push(body);
    if (seen.has(body.requestId)) return jsonResponse(200, seen.get(body.requestId));
    if (!remote) {
      if (body.confirmFirstSync !== true || body.baseRevision !== 0) {
        return jsonResponse(409, {
          error: { code: "first_sync_required", message: "需要首次同步。" },
          server: null,
        });
      }
      remote = body.document;
      revision = 1;
      const created = await head();
      seen.set(body.requestId, created);
      if (dropNextPut) {
        dropNextPut = false;
        throw new Error("socket closed");
      }
      return jsonResponse(200, created);
    }
    if (body.baseRevision !== revision) {
      return jsonResponse(409, {
        error: { code: "revision_conflict", message: "版本衝突。" },
        server: await head(),
      });
    }
    remote = body.document;
    revision += 1;
    const updated = await head();
    seen.set(body.requestId, updated);
    if (dropNextPut) {
      dropNextPut = false;
      throw new Error("socket closed");
    }
    return jsonResponse(200, updated);
  };
  async function head() {
    return {
      revision,
      schemaVersion: 1,
      contentVersion: 2,
      document: remote,
      etag: `"${revision}"`,
      contentHash: await sha256Hex(canonicalJson(remote)),
    };
  }
  return {
    fetch,
    puts,
    setOffline(value) {
      offline = value;
    },
    bump() {
      revision += 1;
    },
    dropNext() {
      dropNextPut = true;
    },
    setSession(id) {
      sessionId = id;
    },
    nextId() {
      ids += 1;
      return `uploadreq${String(ids).padStart(4, "0")}`;
    },
  };
}

test("upload follows first sync, later revisions, conflict, and the signed-in queue", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  const before = cloud.puts.length;
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal(cloud.puts.length, before);
  assert.equal((await client.uploadLocal()).status, "local_only");

  client.bindAccount("user-a");
  const first = await client.uploadLocal();
  assert.equal(first.status, "uploaded");
  assert.equal(first.revision, 1);
  assert.equal(cloud.puts.at(-1).confirmFirstSync, true);
  assert.equal(cloud.puts.at(-1).baseRevision, 0);

  client.writeLocal(JSON.stringify(save(2)));
  const second = await client.uploadLocal();
  assert.equal(second.status, "uploaded");
  assert.equal(second.revision, 2);
  assert.equal(cloud.puts.at(-1).confirmFirstSync, false);
  assert.equal(cloud.puts.at(-1).baseRevision, 1);
  assert.equal((await client.uploadLocal()).status, "in_sync");
  assert.equal(cloud.puts.length, 2);

  cloud.bump();
  client.writeLocal(JSON.stringify(save(3)));
  const count = cloud.puts.length;
  const conflict = await client.uploadLocal();
  assert.equal(conflict.status, "conflict");
  assert.equal(cloud.puts.length, count);

  const queuedCloud = fakeCloud();
  queuedCloud.setOffline(true);
  const queued = createCloudSaveController({
    fetch: queuedCloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => queuedCloud.nextId(),
  });
  queued.writeLocal(JSON.stringify(save(4)));
  queued.bindAccount("user-a");
  assert.equal((await queued.uploadLocal()).status, "queued");
  queued.bindAccount("user-b");
  assert.equal((await queued.flush()).sent, 0);
  assert.equal(queued.queuedCount("user-a"), 1);
  queued.bindAccount("user-a");
  queuedCloud.setOffline(false);
  const flushed = await queued.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(queuedCloud.puts.at(-1).confirmFirstSync, true);
  assert.equal(queued.queuedCount("user-a"), 0);
  assert.equal(queued.queuedCount("user-b"), 0);
});

test("a later offline upload replaces the queued save for that account", async () => {
  const cloud = fakeCloud();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  cloud.setOffline(true);
  assert.equal((await client.uploadLocal()).status, "queued");
  client.writeLocal(JSON.stringify(save(2)));
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(cloud.puts.length, 1);
  assert.equal(cloud.puts[0].document.xp, 2);
  assert.equal(cloud.puts[0].confirmFirstSync, true);
  assert.equal(cloud.puts[0].requestId, "uploadreq0002");
});

test("a reloaded client retries one request id without a second revision", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.writeLocal(JSON.stringify(save(8)));
  client.bindAccount("user-a");
  cloud.dropNext();
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);

  const reloaded = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  assert.equal(reloaded.activeUser(), "user-a");
  const flushed = await reloaded.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(cloud.puts.length, 2);
  assert.equal(cloud.puts[0].requestId, cloud.puts[1].requestId);
  const again = await reloaded.flush();
  assert.equal(again.sent, 0);
  assert.equal(cloud.puts.length, 2);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 8);
});

test("restore previous copies the prior cloud save into the local file", async () => {
  const history = new Map();
  let remote = null;
  let revision = 0;
  let ids = 0;
  async function head() {
    return {
      revision,
      schemaVersion: 1,
      contentVersion: 2,
      document: remote,
      etag: `"${revision}"`,
      contentHash: await sha256Hex(canonicalJson(remote)),
    };
  }
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    const method = init.method ?? "GET";
    if (method === "GET") {
      if (!remote)
        return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
      return jsonResponse(200, await head());
    }
    const body = JSON.parse(init.body);
    if (method === "POST") {
      if (body.baseRevision !== revision) {
        return jsonResponse(409, {
          error: { code: "revision_conflict", message: "版本衝突。" },
          server: await head(),
        });
      }
      const prior = history.get(body.revision);
      if (!prior) {
        return jsonResponse(404, {
          error: { code: "revision_not_found", message: "找不到要恢復的版本。" },
        });
      }
      remote = prior;
      revision += 1;
      history.set(revision, remote);
      return jsonResponse(200, await head());
    }
    if (!remote) {
      remote = body.document;
      revision = 1;
      history.set(1, remote);
      return jsonResponse(200, await head());
    }
    if (body.baseRevision !== revision) {
      return jsonResponse(409, {
        error: { code: "revision_conflict", message: "版本衝突。" },
        server: await head(),
      });
    }
    remote = body.document;
    revision += 1;
    history.set(revision, remote);
    return jsonResponse(200, await head());
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => `restoreq${String(++ids).padStart(4, "0")}`,
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).revision, 1);
  assert.equal((await client.restorePrevious()).status, "error");
  assert.equal(JSON.parse(client.readLocal()).xp, 1);

  client.writeLocal(JSON.stringify(save(2)));
  assert.equal((await client.uploadLocal()).revision, 2);
  const restored = await client.restorePrevious();
  assert.equal(restored.status, "restored");
  assert.equal(restored.revision, 3);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  assert.equal((await client.plan()).status, "in_sync");
});

test("a chosen older revision restores locally and a missing one does not", async () => {
  const history = new Map();
  let remote = null;
  let revision = 0;
  let ids = 0;
  async function head() {
    return {
      revision,
      schemaVersion: 1,
      contentVersion: 2,
      document: remote,
      etag: `"${revision}"`,
      contentHash: await sha256Hex(canonicalJson(remote)),
    };
  }
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    const method = init.method ?? "GET";
    if (method === "GET" && String(url).endsWith("/revisions")) {
      const revisions = [...history.entries()]
        .sort((left, right) => right[0] - left[0])
        .map(([storedRevision, document]) => ({
          revision: storedRevision,
          contentHash: "hash",
          createdAt: "2026-11-12T00:00:00.000Z",
          document,
        }));
      return jsonResponse(200, { headRevision: revision || null, revisions });
    }
    if (method === "GET") {
      if (!remote)
        return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
      return jsonResponse(200, await head());
    }
    const body = JSON.parse(init.body);
    if (method === "POST") {
      if (body.baseRevision !== revision) {
        return jsonResponse(409, {
          error: { code: "revision_conflict", message: "版本衝突。" },
          server: await head(),
        });
      }
      const prior = history.get(body.revision);
      if (!prior) {
        return jsonResponse(404, {
          error: { code: "revision_not_found", message: "找不到要恢復的版本。" },
        });
      }
      remote = prior;
      revision += 1;
      history.set(revision, remote);
      return jsonResponse(200, await head());
    }
    remote = body.document;
    revision += 1;
    history.set(revision, remote);
    return jsonResponse(200, await head());
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => `chooseq${String(++ids).padStart(4, "0")}`,
  });
  client.bindAccount("user-a");
  for (const xp of [1, 2, 3]) {
    client.writeLocal(JSON.stringify(save(xp)));
    assert.equal((await client.uploadLocal()).revision, xp);
  }
  client.writeLocal(JSON.stringify(save(99)));
  const listed = await client.listRevisions();
  assert.equal(listed.status, "ready");
  assert.deepEqual(
    listed.revisions.map((item) => item.revision),
    [3, 2, 1],
  );
  assert.equal(JSON.stringify(listed).includes('"document"'), false);
  const missing = await client.restoreRevision(8);
  assert.equal(missing.status, "error");
  assert.equal(JSON.parse(client.readLocal()).xp, 99);
  const chosen = await client.restoreRevision(1);
  assert.equal(chosen.status, "restored");
  assert.equal(chosen.revision, 4);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("old RPG and pilgrimage files are not uploaded", async () => {
  let calls = 0;
  let puts = 0;
  const fetch = async (url, init = {}) => {
    calls += 1;
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if ((init.method ?? "GET") === "PUT") puts += 1;
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "oldrpgrequest01",
  });
  client.bindAccount("user-a");
  client.writeLocal(
    JSON.stringify({
      version: 1,
      departmentId: "math",
      inventory: [{ id: "pen", count: 2 }],
      buildings: [],
      visited: ["kenan"],
    }),
  );
  const oldRpg = await client.uploadLocal();
  assert.equal(oldRpg.status, "error");
  assert.equal(oldRpg.code, "legacy_rpg");
  assert.equal(puts, 0);
  assert.equal(calls, 2);
  assert.equal(JSON.parse(client.readLocal()).version, 1);

  client.writeLocal(
    JSON.stringify({
      version: 2,
      visited: ["kenan"],
      inventory: [{ id: "notes", count: 1 }],
      buildings: [],
      departmentId: "cs",
    }),
  );
  const world = await client.uploadLocal();
  assert.equal(world.status, "error");
  assert.equal(world.code, "legacy_pilgrimage");
  assert.equal(puts, 0);
  assert.equal(calls, 4);
  assert.equal(JSON.parse(client.readLocal()).inventory[0].id, "notes");
});

test("an offline reward is recorded once and stays with its account queue", async () => {
  const posts = [];
  let offline = false;
  let sessionId = "user-a";
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    const body = init.body ? JSON.parse(init.body) : null;
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts.push(body);
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "rewardreq0001",
  });
  let grants = 0;
  const grant = () => {
    grants += 1;
  };
  assert.equal((await client.noteReward("gather-notes", grant)).granted, true);
  assert.equal(posts.length, 0);
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  client.bindAccount("user-a");
  assert.equal((await client.flush()).sent, 1);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].eventId, "gather-notes");
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  client.logout();
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  assert.equal(grants, 1);

  offline = true;
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  offline = false;
  sessionId = "user-b";
  client.bindAccount("user-b");
  assert.equal((await client.flush()).sent, 1);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(client.queuedCount("user-b"), 0);
  assert.equal(posts.length, 2);
  assert.equal(posts[1].eventId, "gather-notes");
  assert.equal(grants, 1);
});

test("a signed-in reward waits for the server and does not grant a recorded event", async () => {
  let applied = false;
  let posts = 0;
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts += 1;
      const body = JSON.parse(init.body);
      return jsonResponse(200, { applied, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
  });
  client.bindAccount("user-a");
  let grants = 0;
  assert.equal(
    (
      await client.noteReward("gather-notes", () => {
        grants += 1;
      })
    ).granted,
    false,
  );
  assert.equal(grants, 0);
  assert.equal(posts, 1);
  applied = true;
  assert.equal(
    (
      await client.noteReward("gather-parts", () => {
        grants += 1;
      })
    ).granted,
    true,
  );
  assert.equal(grants, 1);
  assert.equal(posts, 2);
  assert.equal(
    (
      await client.noteReward("gather-parts", () => {
        grants += 1;
      })
    ).granted,
    false,
  );
  assert.equal(grants, 1);
  assert.equal(posts, 2);
});

test("a queued upload stays put when the session belongs to another account", async () => {
  const cloud = fakeCloud();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(6)));
  cloud.setOffline(true);
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.setSession("user-b");
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, true);
  assert.equal(cloud.puts.length, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  const planned = await client.plan();
  assert.equal(planned.status, "error");
  assert.equal(planned.code, "account_mismatch");
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "error");
  assert.equal(uploaded.code, "account_mismatch");
  assert.equal(cloud.puts.length, 0);
  let grants = 0;
  assert.equal(
    (
      await client.noteReward("gather-notes", () => {
        grants += 1;
      })
    ).granted,
    false,
  );
  assert.equal(grants, 0);
  cloud.setSession("user-a");
  const sent = await client.flush();
  assert.equal(sent.sent, 1);
  assert.equal(cloud.puts.length, 1);
  assert.equal(cloud.puts[0].document.xp, 6);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a bad cloud document does not replace the local save", async () => {
  let mode = "unsafe";
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    const method = init?.method ?? "GET";
    if (method === "POST") {
      return jsonResponse(200, {
        revision: 3,
        document: { ...save(1), score: 5 },
        contentHash: "ab",
      });
    }
    const document = mode === "unsafe" ? { ...save(9), score: 1 } : save(9);
    const contentHash =
      mode === "mismatch" ? "0".repeat(64) : await sha256Hex(canonicalJson(document));
    return jsonResponse(200, {
      revision: 2,
      schemaVersion: 1,
      contentVersion: 2,
      document,
      etag: '"2"',
      contentHash,
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "baddocreq0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  const unsafe = await client.downloadCloud();
  assert.equal(unsafe.status, "error");
  assert.equal(unsafe.code, "unsafe_content");
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  mode = "mismatch";
  const mismatch = await client.downloadCloud();
  assert.equal(mismatch.status, "error");
  assert.equal(mismatch.code, "invalid_document");
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  mode = "ok";
  const downloaded = await client.downloadCloud();
  assert.equal(downloaded.status, "downloaded");
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "error");
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
});

test("keeping the remote save drops the queued upload and leaves receipts", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(3)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  let grants = 0;
  assert.equal(
    (
      await client.noteReward("gather-notes", () => {
        grants += 1;
      })
    ).granted,
    true,
  );
  assert.equal(grants, 1);
  client.bindAccount("user-b");
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  client.bindAccount("user-a");
  const kept = await client.keepRemoteVersion();
  assert.equal(kept.status, "downloaded");
  assert.equal(JSON.parse(client.readLocal()).xp, 3);
  assert.equal(client.queuedCount("user-a"), 1);
  const other = JSON.parse(storage.getItem("tamkang-cloud-save-queue:user-b"));
  assert.equal(
    other.some((item) => item.kind === "put" && item.body.document.xp === 4),
    true,
  );
  await client.flush();
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 8),
    false,
  );
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 1);
});

test("restoring a cloud revision drops the queued local upload", async () => {
  let offline = true;
  const posts = [];
  const older = save(1);
  const head = save(2);
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if ((init.method ?? "GET") === "GET") {
      return jsonResponse(200, {
        revision: 2,
        schemaVersion: 1,
        contentVersion: 2,
        document: head,
        etag: '"2"',
        contentHash: await sha256Hex(canonicalJson(head)),
      });
    }
    posts.push(String(url));
    return jsonResponse(200, {
      revision: 3,
      document: older,
      contentHash: await sha256Hex(canonicalJson(older)),
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restorereq0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(9)));
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  offline = false;
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "restored");
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  assert.equal(client.queuedCount("user-a"), 0);
  assert.deepEqual(posts, ["http://127.0.0.1/api/cloud/saves/rpg/restore"]);
});

test("flush keeps a receipt that arrives while an upload is in flight", async () => {
  const storage = memoryStorage();
  const cloud = fakeCloud();
  const fetch = async (url, init) => {
    if ((init?.method ?? "GET") === "PUT") {
      const key = "tamkang-cloud-save-queue:user-a";
      const raw = storage.getItem(key);
      const items = raw ? JSON.parse(raw) : [];
      if (items.some((item) => item.kind === "put")) {
        items.push({
          id: "reward-gather-notes",
          userId: "user-a",
          kind: "receipt",
          body: { eventId: "gather-notes", requestId: "reward-gather-notes" },
          attempts: 0,
          nextAt: 0,
        });
        storage.setItem(key, JSON.stringify(items));
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(2)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(5)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  const left = JSON.parse(storage.getItem("tamkang-cloud-save-queue:user-a"));
  assert.equal(left.length, 1);
  assert.equal(left[0].kind, "receipt");
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 5),
    true,
  );
});

test("flush does not send an upload dropped while an earlier item is in flight", async () => {
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  const sent = [];
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    const method = init.method ?? "GET";
    if (method === "POST") {
      const items = JSON.parse(storage.getItem(key)).filter((item) => item.kind !== "put");
      storage.setItem(key, JSON.stringify(items));
      return jsonResponse(200, { applied: true, eventId: "gather-notes" });
    }
    sent.push(JSON.parse(init.body));
    return jsonResponse(200, { revision: 2, contentHash: "abc" });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "laterupload0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  const now = Date.now();
  storage.setItem(
    key,
    JSON.stringify([
      {
        id: "reward-gather-notes",
        userId: "user-a",
        kind: "receipt",
        body: { eventId: "gather-notes", requestId: "reward-gather-notes" },
        attempts: 0,
        nextAt: now - 10,
      },
      {
        id: "laterupload0001",
        userId: "user-a",
        kind: "put",
        body: {
          schemaVersion: 1,
          contentVersion: 2,
          baseRevision: 1,
          confirmFirstSync: false,
          requestId: "laterupload0001",
          document: save(4),
        },
        attempts: 0,
        nextAt: now,
      },
    ]),
  );
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.deepEqual(sent, []);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("an upload that lands after the player keeps the cloud save is put back", async () => {
  const storage = memoryStorage();
  const cloud = fakeCloud();
  const key = "tamkang-cloud-save-queue:user-a";
  const fetch = async (url, init) => {
    if ((init?.method ?? "GET") === "PUT") {
      const items = JSON.parse(storage.getItem(key) ?? "[]");
      if (items.some((item) => item.kind === "put")) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(3)));
        storage.setItem(
          key,
          JSON.stringify([
            {
              id: "reward-gather-notes",
              userId: "user-a",
              kind: "receipt",
              body: { eventId: "gather-notes", requestId: "reward-gather-notes" },
              attempts: 0,
              nextAt: 0,
            },
          ]),
        );
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(3)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  await client.flush();
  assert.deepEqual(
    cloud.puts.filter((body) => body.document).map((body) => body.document.xp),
    [3, 8, 3],
  );
  assert.equal(cloud.puts.at(-1).baseRevision, 2);
  assert.equal(JSON.parse(client.readLocal()).xp, 3);
  const left = JSON.parse(storage.getItem(key));
  assert.equal(left.length, 1);
  assert.equal(left[0].kind, "receipt");
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
});

test("the first flush sends the newest local file instead of the queued snapshot", async () => {
  const cloud = fakeCloud();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  client.writeLocal(JSON.stringify(save(9)));
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 4),
    false,
  );
  assert.equal(cloud.puts.at(-1).document.xp, 9);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 2);
});
