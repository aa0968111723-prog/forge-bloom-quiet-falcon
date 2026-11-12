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
  let rejectNextPut = false;
  let holdNextPut = false;
  let heldId = "";
  let failMatchingPut = false;
  let refuseMatchingPut = false;
  let refuseFirstSync = false;
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
    const requestKey = canonicalJson(body);
    if (rejectNextPut && method === "PUT") {
      rejectNextPut = false;
      throw new Error("socket closed");
    }
    if (method === "PUT" && heldId && body.requestId === heldId) {
      return jsonResponse(401, { error: { code: "unauthorized", message: "請先登入。" } });
    }
    if (holdNextPut && method === "PUT") {
      holdNextPut = false;
      heldId = body.requestId;
      return jsonResponse(401, { error: { code: "unauthorized", message: "請先登入。" } });
    }
    const prior = seen.get(body.requestId);
    if (prior) {
      if (prior.request !== requestKey) {
        return jsonResponse(409, {
          error: {
            code: "idempotency_mismatch",
            message: "相同 requestId 不能改用不同內容重送。",
          },
        });
      }
      return jsonResponse(200, prior.response);
    }
    if (!remote) {
      if (body.confirmFirstSync !== true || body.baseRevision !== 0) {
        return jsonResponse(409, {
          error: { code: "first_sync_required", message: "需要首次同步。" },
          server: null,
        });
      }
      if (refuseFirstSync) {
        refuseFirstSync = false;
        heldId = body.requestId;
        return jsonResponse(401, { error: { code: "unauthorized", message: "請先登入。" } });
      }
      remote = body.document;
      revision = 1;
      const created = await head();
      seen.set(body.requestId, { request: requestKey, response: created });
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
    if (failMatchingPut) {
      failMatchingPut = false;
      return jsonResponse(500, {
        error: { code: "internal", message: "伺服器暫時無法處理這個請求。" },
      });
    }
    if (refuseMatchingPut) {
      refuseMatchingPut = false;
      heldId = body.requestId;
      return jsonResponse(401, { error: { code: "unauthorized", message: "請先登入。" } });
    }
    remote = body.document;
    revision += 1;
    const updated = await head();
    seen.set(body.requestId, { request: requestKey, response: updated });
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
    rejectNext() {
      rejectNextPut = true;
    },
    holdNext() {
      holdNextPut = true;
    },
    failMatching() {
      failMatchingPut = true;
    },
    refuseMatching() {
      refuseMatchingPut = true;
    },
    refuseFirstSync() {
      refuseFirstSync = true;
    },
    replace(document) {
      remote = document;
      revision += 1;
    },
    clear() {
      remote = null;
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

test("a retry after more offline play sends the newest file under a new request id", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  client.writeLocal(JSON.stringify(save(6)));
  cloud.setOffline(false);
  cloud.rejectNext();
  const failed = await client.flush();
  assert.equal(failed.sent, 0);
  assert.equal(cloud.puts.at(-1).document.xp, 6);
  const failedId = cloud.puts.at(-1).requestId;
  clock += 60_000;
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(9)));
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(cloud.puts.at(-1).document.xp, 9);
  assert.notEqual(cloud.puts.at(-1).requestId, failedId);
  assert.equal(cloud.puts.at(-1).baseRevision, 1);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 2);
});

test("a dropped upload that already landed is continued from that revision", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(6)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.dropNext();
  assert.equal((await client.flush()).sent, 0);
  assert.equal(cloud.puts.at(-1).document.xp, 6);
  clock += 60_000;
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(9)));
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.deepEqual(
    cloud.puts.filter((body) => body.document).map((body) => body.document.xp),
    [1, 6, 9, 9],
  );
  assert.equal(cloud.puts.at(-1).baseRevision, 2);
  assert.notEqual(cloud.puts.at(-1).requestId, cloud.puts[1].requestId);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
});

test("a retry does not overwrite another device's save", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.rejectNext();
  assert.equal((await client.flush()).sent, 0);
  cloud.replace(save(7));
  clock += 60_000;
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(9)));
  cloud.setOffline(false);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 9 && body.baseRevision === 2),
    false,
  );
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  const planned = await client.plan();
  assert.equal(planned.status, "conflict");
  assert.equal(planned.remote.document.xp, 7);
});

test("dropping a continued upload writes the chosen local file back", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  const fetch = async (url, init) => {
    if ((init?.method ?? "GET") === "PUT" && init.body) {
      const body = JSON.parse(init.body);
      if (body.document?.xp === 9 && body.baseRevision === 2) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(6)));
        const items = JSON.parse(storage.getItem(key) ?? "[]");
        storage.setItem(key, JSON.stringify(items.filter((item) => item.kind !== "put")));
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(6)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.dropNext();
  assert.equal((await client.flush()).sent, 0);
  clock += 60_000;
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(9)));
  cloud.setOffline(false);
  await client.flush();
  assert.deepEqual(
    cloud.puts.filter((body) => body.document).map((body) => body.document.xp),
    [1, 6, 9, 9, 6],
  );
  assert.equal(cloud.puts.at(-1).baseRevision, 3);
  assert.equal(JSON.parse(client.readLocal()).xp, 6);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 4);
});

test("a dropped upload is not retried when the disconnected send did not land", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  const fetch = async (url, init) => {
    if ((init?.method ?? "GET") === "PUT" && init.body) {
      const body = JSON.parse(init.body);
      if (body.document?.xp === 8) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(1)));
        const items = JSON.parse(storage.getItem(key) ?? "[]");
        storage.setItem(key, JSON.stringify(items.filter((item) => item.kind !== "put")));
        cloud.rejectNext();
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  assert.equal((await client.flush()).sent, 0);
  assert.equal(
    JSON.parse(storage.getItem(key) ?? "[]").some((item) => item.kind === "put"),
    false,
  );
  clock += 60_000;
  assert.equal((await client.flush()).sent, 0);
  assert.equal(cloud.puts.filter((body) => body.document?.xp === 8).length, 1);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 1);
});

test("a dropped upload that landed during a disconnect is written back", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  const fetch = async (url, init) => {
    if ((init?.method ?? "GET") === "PUT" && init.body) {
      const body = JSON.parse(init.body);
      if (body.document?.xp === 8) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(1)));
        const items = JSON.parse(storage.getItem(key) ?? "[]");
        storage.setItem(key, JSON.stringify(items.filter((item) => item.kind !== "put")));
        cloud.dropNext();
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  await client.flush();
  assert.deepEqual(
    cloud.puts.filter((body) => body.document).map((body) => body.document.xp),
    [1, 8, 1],
  );
  assert.equal(cloud.puts.at(-1).baseRevision, 2);
  assert.equal(
    JSON.parse(storage.getItem(key) ?? "[]").some((item) => item.kind === "put"),
    false,
  );
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
});

test("a session blip still writes back the chosen file after a dropped upload lands", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  let landed = false;
  let reads = 0;
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) {
      if (landed) {
        reads += 1;
        if (reads === 3) throw new Error("session blip");
      }
      return cloud.fetch(url, init);
    }
    if ((init?.method ?? "GET") === "PUT" && init.body) {
      const body = JSON.parse(init.body);
      if (body.document?.xp === 8) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(1)));
        const items = JSON.parse(storage.getItem(key) ?? "[]");
        storage.setItem(key, JSON.stringify(items.filter((item) => item.kind !== "put")));
        cloud.dropNext();
        landed = true;
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  await client.flush();
  assert.deepEqual(
    cloud.puts.filter((body) => body.document).map((body) => body.document.xp),
    [1, 8, 1],
  );
  assert.equal(cloud.puts.at(-1).baseRevision, 2);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  clock += 60_000;
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
});

test("flush does not send the next upload after the session changes account", async () => {
  let sessionId = "user-a";
  let offline = true;
  let clock = 1_000;
  const posts = [];
  const puts = [];
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    const body = JSON.parse(init.body);
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts.push({ sessionId, eventId: body.eventId });
      sessionId = "user-b";
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    if ((init.method ?? "GET") === "PUT") {
      puts.push({ sessionId, xp: body.document?.xp });
      return jsonResponse(200, {
        revision: 1,
        contentHash: "abc",
        document: body.document,
      });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    now: () => clock,
    randomId: () => "flushacct0001",
  });
  let grants = 0;
  client.bindAccount("user-a");
  assert.equal(
    (
      await client.noteReward("gather-notes", () => {
        grants += 1;
      })
    ).granted,
    true,
  );
  clock += 1;
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(client.queuedCount("user-a"), 2);
  offline = false;
  const flushed = await client.flush();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].sessionId, "user-a");
  assert.equal(posts[0].eventId, "gather-notes");
  assert.equal(puts.length, 0);
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, true);
  assert.equal(client.queuedCount("user-a"), 2);
  assert.equal(client.queuedCount("user-b"), 0);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  assert.equal(grants, 1);
});

test("a session change is not given the other account's cloud save", async () => {
  let sessionId = "user-a";
  let flipped = false;
  const fetch = async (url) => {
    if (String(url).includes("/api/auth/get-session")) {
      const id = sessionId;
      if (!flipped) {
        flipped = true;
        sessionId = "user-b";
      }
      return sessionFor(id);
    }
    const document = save(sessionId === "user-b" ? 99 : 1);
    return jsonResponse(200, {
      revision: 2,
      schemaVersion: 1,
      contentVersion: 2,
      document,
      etag: '"2"',
      contentHash: await sha256Hex(canonicalJson(document)),
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "othersave0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const planned = await client.plan();
  assert.equal(planned.status, "error");
  assert.equal(planned.code, "account_mismatch");
  assert.equal(Object.hasOwn(planned, "remote"), false);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);

  flipped = false;
  sessionId = "user-a";
  const downloaded = await client.downloadCloud();
  assert.equal(downloaded.status, "error");
  assert.equal(downloaded.code, "account_mismatch");
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a session blip does not grant a reward the server already recorded", async () => {
  let sessionReads = 0;
  let posts = 0;
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) {
      sessionReads += 1;
      if (sessionReads === 2) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts += 1;
      const body = JSON.parse(init.body);
      return jsonResponse(200, { applied: false, eventId: body.eventId });
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
  const result = await client.noteReward("gather-notes", () => {
    grants += 1;
  });
  assert.equal(result.granted, false);
  assert.equal(grants, 0);
  assert.equal(posts, 1);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a session change does not apply a restored cloud save", async () => {
  let sessionId = "user-a";
  const head = save(1);
  const other = save(99);
  const headHash = await sha256Hex(canonicalJson(head));
  const otherHash = await sha256Hex(canonicalJson(other));
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "GET") {
      return jsonResponse(200, {
        revision: 2,
        schemaVersion: 1,
        contentVersion: 2,
        document: head,
        etag: '"2"',
        contentHash: headHash,
      });
    }
    sessionId = "user-b";
    return jsonResponse(200, {
      revision: 3,
      schemaVersion: 1,
      contentVersion: 2,
      document: other,
      etag: '"3"',
      contentHash: otherHash,
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restoreacct0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "error");
  assert.equal(restored.code, "account_mismatch");
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a session blip does not apply a restored cloud save", async () => {
  let sessionReads = 0;
  const head = save(1);
  const older = save(4);
  const headHash = await sha256Hex(canonicalJson(head));
  const olderHash = await sha256Hex(canonicalJson(older));
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) {
      sessionReads += 1;
      if (sessionReads === 4) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "GET") {
      return jsonResponse(200, {
        revision: 2,
        schemaVersion: 1,
        contentVersion: 2,
        document: head,
        etag: '"2"',
        contentHash: headHash,
      });
    }
    return jsonResponse(200, {
      revision: 3,
      schemaVersion: 1,
      contentVersion: 2,
      document: older,
      etag: '"3"',
      contentHash: olderHash,
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restoreblip0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "local_only");
  assert.equal(restored.reason, "offline");
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a queued upload stays when its response arrives for another account", async () => {
  let sessionId = "user-a";
  let offline = true;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "PUT") {
      sessionId = "user-b";
      return jsonResponse(200, {
        revision: 4,
        contentHash: "other-account-hash",
        document: save(9),
      });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "keepqueue0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(3)));
  assert.equal((await client.uploadLocal()).status, "queued");
  offline = false;
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 3);
});

test("an upload is not recorded when the session changes before its response is accepted", async () => {
  let sessionId = "user-a";
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "PUT") {
      sessionId = "user-b";
      return jsonResponse(200, {
        revision: 4,
        contentHash: "other-account-hash",
        document: save(9),
      });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "keepdirect0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(3)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "error");
  assert.equal(uploaded.code, "account_mismatch");
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 3);
});

test("a session blip does not retire a queued upload", async () => {
  let sessionReads = 0;
  let offline = true;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) {
      sessionReads += 1;
      if (sessionReads === 3) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "PUT") {
      return jsonResponse(200, {
        revision: 2,
        contentHash: "hash-2",
        document: save(3),
      });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "keepblip00001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(3)));
  assert.equal((await client.uploadLocal()).status, "queued");
  offline = false;
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 3);
});

test("a continued upload stays queued when its response arrives for another account", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  let sessionId = "user-a";
  let continuations = 0;
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init?.method ?? "GET") === "PUT" && init.body) {
      const body = JSON.parse(init.body);
      if (body.document?.xp === 9) {
        continuations += 1;
        if (continuations === 2) {
          sessionId = "user-b";
          return jsonResponse(200, {
            revision: 9,
            contentHash: "other-account-hash",
            document: save(9),
          });
        }
      }
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(6)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.dropNext();
  assert.equal((await client.flush()).sent, 0);
  clock += 60_000;
  client.writeLocal(JSON.stringify(save(9)));
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(JSON.parse(storage.getItem("tamkang-cloud-save-meta:user-a")).revision, 1);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
});

test("a session blip does not record a continued upload", async () => {
  const cloud = fakeCloud();
  let clock = 1_000;
  let armed = false;
  let reads = 0;
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) {
      if (armed) {
        reads += 1;
        if (reads === 4) throw new Error("session blip");
      }
      return sessionFor("user-a");
    }
    return cloud.fetch(url, init);
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(6)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.dropNext();
  assert.equal((await client.flush()).sent, 0);
  clock += 60_000;
  client.writeLocal(JSON.stringify(save(9)));
  armed = true;
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(JSON.parse(storage.getItem("tamkang-cloud-save-meta:user-a")).revision, 1);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
});

function foreignConflict(document) {
  return jsonResponse(409, {
    error: { code: "revision_conflict", message: "版本衝突。" },
    server: {
      revision: 3,
      schemaVersion: 1,
      contentVersion: 2,
      document,
      etag: '"3"',
      contentHash: "other-account-hash",
    },
  });
}

test("a revision conflict from another account does not drop the queued upload", async () => {
  let sessionId = "user-a";
  let offline = true;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "PUT") {
      sessionId = "user-b";
      return foreignConflict(save(99));
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "conflictacct001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  offline = false;
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
});

test("a revision conflict from another account is not offered as this save", async () => {
  let sessionId = "user-a";
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "PUT") {
      sessionId = "user-b";
      return foreignConflict(save(99));
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "conflictdirect01",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "error");
  assert.equal(uploaded.code, "account_mismatch");
  assert.equal(Object.hasOwn(uploaded, "remote"), false);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
});

test("a session blip does not drop a queued upload on revision conflict", async () => {
  let sessionReads = 0;
  let offline = true;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) {
      sessionReads += 1;
      if (sessionReads === 3) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "PUT") return foreignConflict(save(99));
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "conflictblip001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  offline = false;
  const flushed = await client.flush();
  assert.equal(flushed.paused, true);
  assert.equal(flushed.sent, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
});

async function cloudHead(document, revision) {
  return {
    revision,
    schemaVersion: 1,
    contentVersion: 2,
    document,
    etag: `"${revision}"`,
    contentHash: await sha256Hex(canonicalJson(document)),
  };
}

test("a revision conflict from another account is not offered as a restored save", async () => {
  let sessionId = "user-a";
  const head = await cloudHead(save(1), 2);
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "GET") return jsonResponse(200, head);
    sessionId = "user-b";
    return foreignConflict(save(99));
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restoreconflict1",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "error");
  assert.equal(restored.code, "account_mismatch");
  assert.equal(Object.hasOwn(restored, "remote"), false);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a session blip does not offer a restored revision conflict", async () => {
  let sessionReads = 0;
  const head = await cloudHead(save(1), 2);
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) {
      sessionReads += 1;
      if (sessionReads === 4) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "GET") return jsonResponse(200, head);
    return foreignConflict(save(99));
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restoreblip0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "local_only");
  assert.equal(restored.reason, "offline");
  assert.equal(Object.hasOwn(restored, "remote"), false);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a same-account restore conflict still offers that cloud save", async () => {
  const head = await cloudHead(save(1), 2);
  const server = await cloudHead(save(7), 3);
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if ((init.method ?? "GET") === "GET") return jsonResponse(200, head);
    return jsonResponse(409, {
      error: { code: "revision_conflict", message: "版本衝突。" },
      server,
    });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "restoresame0001",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  const restored = await client.restoreRevision(1);
  assert.equal(restored.status, "conflict");
  assert.equal(restored.remote.revision, 3);
  assert.equal(restored.remote.document.xp, 7);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
});

test("a dropped upload is not recorded when the landed read belongs to another account", async () => {
  let sessionId = "user-a";
  let offline = false;
  let landed = false;
  const puts = [];
  const sent = save(8);
  const sentHash = await sha256Hex(canonicalJson(sent));
  const storage = memoryStorage();
  const key = "tamkang-cloud-save-queue:user-a";
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    const method = init.method ?? "GET";
    if (method === "PUT") {
      const body = JSON.parse(init.body);
      puts.push(body.document.xp);
      if (body.document.xp === 8) {
        storage.setItem("tamkang-rpg-v2", JSON.stringify(save(1)));
        const items = JSON.parse(storage.getItem(key) ?? "[]");
        storage.setItem(key, JSON.stringify(items.filter((item) => item.kind !== "put")));
        landed = true;
        throw new Error("disconnect");
      }
      return jsonResponse(200, { revision: 1, contentHash: "first-hash" });
    }
    if (method === "GET") {
      if (!landed) {
        return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
      }
      sessionId = "user-b";
      return jsonResponse(200, {
        revision: 9,
        schemaVersion: 1,
        contentVersion: 2,
        document: sent,
        etag: '"9"',
        contentHash: sentHash,
      });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "droprepairacct1",
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  offline = true;
  client.writeLocal(JSON.stringify(save(8)));
  assert.equal((await client.uploadLocal()).status, "queued");
  offline = false;
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.deepEqual(puts, [1, 8]);
  assert.equal(JSON.parse(storage.getItem("tamkang-cloud-save-meta:user-a")).revision, 1);
  assert.equal(JSON.parse(client.readLocal()).xp, 1);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("another account's reward receipt does not decide this grant", async () => {
  let sessionId = "user-a";
  let posts = 0;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts += 1;
      const body = JSON.parse(init.body);
      if (posts === 1) {
        sessionId = "user-b";
        return jsonResponse(200, { applied: false, eventId: body.eventId });
      }
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "rewardacct0001",
  });
  client.bindAccount("user-a");
  let grants = 0;
  const grant = () => {
    grants += 1;
  };
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  assert.equal(grants, 0);
  assert.deepEqual(JSON.parse(storage.getItem("tamkang-cloud-save-receipt:user-a")), []);
  assert.equal(storage.getItem("tamkang-cloud-save-receipt:local"), null);
  sessionId = "user-a";
  assert.equal((await client.noteReward("gather-notes", grant)).granted, true);
  assert.equal(grants, 1);
  assert.equal(posts, 2);
});

test("another account's applied reward is not granted on this device", async () => {
  let sessionId = "user-a";
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      sessionId = "user-b";
      const body = JSON.parse(init.body);
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "rewardacct0002",
  });
  client.bindAccount("user-a");
  let grants = 0;
  const result = await client.noteReward("gather-notes", () => {
    grants += 1;
  });
  assert.equal(result.granted, false);
  assert.equal(grants, 0);
  assert.deepEqual(JSON.parse(storage.getItem("tamkang-cloud-save-receipt:user-a")), []);
  assert.equal(storage.getItem("tamkang-cloud-save-receipt:local"), null);
});

test("a session blip does not settle a reward receipt", async () => {
  let reads = 0;
  const storage = memoryStorage();
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) {
      reads += 1;
      if (reads === 3) throw new Error("session blip");
      return sessionFor("user-a");
    }
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      const body = JSON.parse(init.body);
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => "rewardblip0001",
  });
  client.bindAccount("user-a");
  let grants = 0;
  const result = await client.noteReward("gather-notes", () => {
    grants += 1;
  });
  assert.equal(result.granted, false);
  assert.equal(grants, 0);
  assert.deepEqual(JSON.parse(storage.getItem("tamkang-cloud-save-receipt:user-a")), []);
  assert.equal(storage.getItem("tamkang-cloud-save-receipt:local"), null);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a lost upload response continues the newer local file under a new request id", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  cloud.dropNext();
  assert.equal((await client.uploadLocal()).status, "queued");
  assert.equal(storage.getItem("tamkang-cloud-save-meta:user-a"), null);
  client.writeLocal(JSON.stringify(save(4)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.notEqual(cloud.puts[0].requestId, cloud.puts[1].requestId);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 2);
  assert.equal(head.document.xp, 4);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 2);
});

test("a database outage keeps the upload the player already asked to send", async () => {
  let databaseUp = false;
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if (!databaseUp) {
      return jsonResponse(503, {
        error: { code: "database_unavailable", message: "資料庫無法使用。" },
      });
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
  client.writeLocal(JSON.stringify(save(4)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  databaseUp = true;
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 4);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a rejected save is not queued after the database answers", async () => {
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if (init?.method === "PUT") {
      return jsonResponse(422, { error: { code: "invalid_document", message: "存檔內容不正確。" } });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "沒有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage,
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(2)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "error");
  assert.equal(client.queuedCount("user-a"), 0);
});

test("an expired session keeps this account's upload and reward", async () => {
  let expired = true;
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const receipts = [];
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) {
      return expired ? jsonResponse(401, {}) : sessionFor("user-a");
    }
    if (String(url).endsWith("/receipts") && init?.method === "POST") {
      const body = JSON.parse(init.body);
      receipts.push(body.eventId);
      return jsonResponse(200, { applied: true, eventId: body.eventId });
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
  client.writeLocal(JSON.stringify(save(4)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
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
  expired = false;
  const flushed = await client.flush();
  assert.equal(flushed.sent, 2);
  assert.equal(flushed.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 4);
  assert.deepEqual(receipts, ["gather-notes"]);
  assert.equal(
    (
      await client.noteReward("gather-notes", () => {
        grants += 1;
      })
    ).granted,
    false,
  );
  assert.equal(grants, 1);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a session with no user keeps this account's upload", async () => {
  let anonymous = true;
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) {
      return anonymous ? jsonResponse(200, { user: null }) : sessionFor("user-a");
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
  client.writeLocal(JSON.stringify(save(7)));
  assert.equal((await client.uploadLocal()).status, "queued");
  anonymous = false;
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.document.xp, 7);
});

test("a refused upload keeps the newer local file on this device's revision", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  client.writeLocal(JSON.stringify(save(4)));
  cloud.holdNext();
  const refused = await client.uploadLocal();
  assert.equal(refused.status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  const held = cloud.puts.at(-1);
  client.writeLocal(JSON.stringify(save(9)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 2);
  assert.equal(head.document.xp, 9);
  assert.equal(cloud.puts.at(-1).document.xp, 9);
  assert.equal(cloud.puts.at(-1).baseRevision, 1);
  assert.notEqual(cloud.puts.at(-1).requestId, held.requestId);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 2);
});

test("a refused upload does not overwrite another device's save", async () => {
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
  client.writeLocal(JSON.stringify(save(4)));
  cloud.holdNext();
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.replace(save(7));
  client.writeLocal(JSON.stringify(save(9)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 9 && body.baseRevision === 2),
    false,
  );
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.document.xp, 7);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "conflict");
  assert.equal(planned.remote.document.xp, 7);
});

test("an interrupted follow-up keeps the newer local file queued", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  let clock = 10_000;
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    now: () => clock,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  client.writeLocal(JSON.stringify(save(4)));
  cloud.holdNext();
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.replace(save(4));
  client.writeLocal(JSON.stringify(save(9)));
  cloud.failMatching();
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, false);
  assert.equal(client.queuedCount("user-a"), 1);
  const queued = JSON.parse(storage.getItem("tamkang-cloud-save-queue:user-a"));
  assert.equal(queued.length, 1);
  assert.equal(queued[0].body.document.xp, 9);
  assert.equal(queued[0].body.baseRevision, 2);
  assert.equal(queued[0].attempts, 1);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 2);
  assert.equal(head.document.xp, 4);
  assert.equal(JSON.parse(client.readLocal()).xp, 9);
  clock += 1_000;
  const again = await client.flush();
  assert.equal(again.sent, 1);
  const next = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(next.revision, 3);
  assert.equal(next.document.xp, 9);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
});

test("a refused follow-up keeps the newer local file on this device's revision", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  client.writeLocal(JSON.stringify(save(4)));
  cloud.holdNext();
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.replace(save(4));
  client.writeLocal(JSON.stringify(save(9)));
  cloud.refuseMatching();
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, true);
  assert.equal(client.queuedCount("user-a"), 1);
  const held = JSON.parse(storage.getItem("tamkang-cloud-save-queue:user-a"));
  assert.equal(held[0].body.document.xp, 9);
  assert.equal(held[0].attempts >= 1, true);
  const during = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(during.document.xp, 4);
  client.writeLocal(JSON.stringify(save(12)));
  const again = await client.flush();
  assert.equal(again.sent, 1);
  assert.equal(again.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 3);
  assert.equal(head.document.xp, 12);
  assert.notEqual(cloud.puts.at(-1).requestId, held[0].body.requestId);
  assert.equal(cloud.puts.at(-1).baseRevision, 2);
  assert.equal(JSON.parse(client.readLocal()).xp, 12);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 3);
});

test("a refused first sync keeps the newer local file", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  cloud.setOffline(true);
  client.writeLocal(JSON.stringify(save(4)));
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.clear();
  cloud.refuseFirstSync();
  client.writeLocal(JSON.stringify(save(9)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, true);
  assert.equal(client.queuedCount("user-a"), 1);
  const held = JSON.parse(storage.getItem("tamkang-cloud-save-queue:user-a"));
  assert.equal(held[0].body.confirmFirstSync, true);
  assert.equal(held[0].body.document.xp, 9);
  assert.equal(held[0].attempts >= 1, true);
  client.writeLocal(JSON.stringify(save(12)));
  const again = await client.flush();
  assert.equal(again.sent, 1);
  assert.equal(again.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 12);
  assert.notEqual(cloud.puts.at(-1).requestId, held[0].body.requestId);
  assert.equal(JSON.parse(client.readLocal()).xp, 12);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 1);
});

test("a signed-out save write stays queued for this account", async () => {
  let rejectPut = true;
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const fetch = async (url, init) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if (init?.method === "PUT" && rejectPut) {
      rejectPut = false;
      return jsonResponse(401, { error: { code: "unauthorized", message: "請先登入。" } });
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
  client.writeLocal(JSON.stringify(save(4)));
  const uploaded = await client.uploadLocal();
  assert.equal(uploaded.status, "queued");
  assert.equal(client.queuedCount("user-a"), 1);
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.paused, false);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 4);
});

test("a queued upload lands when this account's cloud row is gone", async () => {
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
  client.writeLocal(JSON.stringify(save(4)));
  cloud.setOffline(true);
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.clear();
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.paused, false);
  assert.equal(client.queuedCount("user-a"), 0);
  const refused = cloud.puts.at(-2);
  assert.equal(refused.confirmFirstSync, false);
  assert.equal(refused.baseRevision, 1);
  const landed = cloud.puts.at(-1);
  assert.equal(landed.confirmFirstSync, true);
  assert.equal(landed.baseRevision, 0);
  assert.equal(landed.document.xp, 4);
  assert.notEqual(landed.requestId, refused.requestId);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 1);
  assert.equal(head.document.xp, 4);
  assert.equal((await client.plan()).status, "in_sync");
});

test("an empty cloud does not take another account's queued upload", async () => {
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
  client.writeLocal(JSON.stringify(save(4)));
  cloud.setOffline(true);
  assert.equal((await client.uploadLocal()).status, "queued");
  cloud.setOffline(false);
  cloud.clear();
  cloud.setSession("user-b");
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(flushed.paused, true);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(cloud.puts.length, 1);
  assert.equal((await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).status, 404);
});

test("a rate-limited reward is granted once and stays with this account", async () => {
  let sessionId = "user-a";
  let limited = true;
  const receipts = [];
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor(sessionId);
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      const body = JSON.parse(init.body);
      if (limited) {
        return jsonResponse(429, { error: { code: "rate_limited", message: "請求過於頻繁，請稍後再試。" } });
      }
      receipts.push({ sessionId, eventId: body.eventId });
      return jsonResponse(200, { applied: true, eventId: body.eventId });
    }
    return jsonResponse(404, { error: { code: "not_found", message: "尚未有雲端存檔。" } });
  };
  const client = createCloudSaveController({
    fetch,
    baseUrl: "http://127.0.0.1",
    storage: memoryStorage(),
    randomId: () => "rewardrate0001",
  });
  client.bindAccount("user-a");
  let grants = 0;
  const grant = () => {
    grants += 1;
  };
  assert.equal((await client.noteReward("gather-notes", grant)).granted, true);
  assert.equal(grants, 1);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  assert.equal(grants, 1);
  sessionId = "user-b";
  const blocked = await client.flush();
  assert.equal(blocked.sent, 0);
  assert.equal(blocked.paused, true);
  assert.equal(receipts.length, 0);
  assert.equal(client.queuedCount("user-a"), 1);
  assert.equal(client.queuedCount("user-b"), 0);
  sessionId = "user-a";
  limited = false;
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  assert.equal(flushed.paused, false);
  assert.deepEqual(receipts, [{ sessionId: "user-a", eventId: "gather-notes" }]);
  assert.equal((await client.noteReward("gather-notes", grant)).granted, false);
  assert.equal(grants, 1);
  assert.equal(client.queuedCount("user-a"), 0);
});

test("a rejected reward receipt is not granted or queued", async () => {
  let posts = 0;
  const fetch = async (url, init = {}) => {
    if (String(url).includes("/api/auth/get-session")) return sessionFor("user-a");
    if ((init.method ?? "GET") === "POST" && String(url).endsWith("/receipts")) {
      posts += 1;
      return jsonResponse(422, { error: { code: "invalid_document", message: "獎勵事件 id 不正確。" } });
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
  assert.equal(client.queuedCount("user-a"), 0);
});

function requeueLanded(storage, userId, body) {
  storage.setItem(
    `tamkang-cloud-save-queue:${userId}`,
    JSON.stringify([
      {
        id: body.requestId,
        userId,
        kind: "put",
        body,
        attempts: 0,
        nextAt: 0,
      },
    ]),
  );
}

test("a reused request id continues the newer local file from this device's save", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  const landed = cloud.puts.at(-1);
  requeueLanded(storage, "user-a", landed);
  client.writeLocal(JSON.stringify(save(4)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 1);
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.revision, 2);
  assert.equal(head.document.xp, 4);
  assert.equal(cloud.puts.at(-1).document.xp, 4);
  assert.equal(cloud.puts.at(-1).baseRevision, 1);
  assert.notEqual(cloud.puts.at(-1).requestId, landed.requestId);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "in_sync");
  assert.equal(planned.revision, 2);
});

test("a reused request id does not overwrite another device's save", async () => {
  const cloud = fakeCloud();
  const storage = memoryStorage();
  const client = createCloudSaveController({
    fetch: cloud.fetch,
    baseUrl: "http://127.0.0.1",
    storage,
    randomId: () => cloud.nextId(),
  });
  client.bindAccount("user-a");
  client.writeLocal(JSON.stringify(save(1)));
  assert.equal((await client.uploadLocal()).status, "uploaded");
  requeueLanded(storage, "user-a", cloud.puts.at(-1));
  cloud.replace(save(7));
  client.writeLocal(JSON.stringify(save(4)));
  const flushed = await client.flush();
  assert.equal(flushed.sent, 0);
  assert.equal(
    cloud.puts.some((body) => body.document?.xp === 4 && body.baseRevision === 2),
    false,
  );
  const head = await (await cloud.fetch("http://127.0.0.1/api/cloud/saves/rpg")).json();
  assert.equal(head.document.xp, 7);
  assert.equal(JSON.parse(client.readLocal()).xp, 4);
  assert.equal(client.queuedCount("user-a"), 0);
  const planned = await client.plan();
  assert.equal(planned.status, "conflict");
  assert.equal(planned.remote.document.xp, 7);
});
