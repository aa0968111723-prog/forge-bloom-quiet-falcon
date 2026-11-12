import assert from "node:assert/strict";
import test from "node:test";

import { createCloudSaveController, memoryStorage } from "../src/features/cloud-save/client.ts";
import { canonicalJson, sha256Hex } from "../src/features/cloud-save/contract.ts";

function save(xp) {
  return { version: 2, hp: 80, xp, slots: [{ itemId: "notes", quantity: 1 }], buildings: [] };
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
  const fetch = async (_url, init = {}) => {
    if (offline) throw new Error("offline");
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
  const fetch = async (_url, init = {}) => {
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
  const fetch = async () => {
    calls += 1;
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
  assert.equal(calls, 1);
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
  assert.equal(calls, 2);
  assert.equal(JSON.parse(client.readLocal()).inventory[0].id, "notes");
});

test("an offline reward is recorded once and stays with its account queue", async () => {
  const posts = [];
  let offline = false;
  const fetch = async (url, init = {}) => {
    if (offline) throw new Error("offline");
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
