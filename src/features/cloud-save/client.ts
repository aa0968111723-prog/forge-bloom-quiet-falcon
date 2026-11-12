import {
  BUNDLED_CONTENT_MANIFEST,
  CLOUD_ACTIVE_USER_KEY,
  CLOUD_CONTENT_VERSION,
  CLOUD_META_PREFIX,
  CLOUD_QUEUE_PREFIX,
  CLOUD_RECEIPT_PREFIX,
  CLOUD_SCHEMA_VERSION,
  RPG_LOCAL_SAVE_KEY,
  canonicalJson,
  decideContentUpdate,
  sha256Hex,
  validateRpgDocument,
  type ContentManifest,
  type SaveDocument,
} from "./contract.ts";

export type LocalStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type QueueItem = {
  id: string;
  userId: string;
  kind: "put" | "receipt";
  body: Record<string, unknown>;
  attempts: number;
  nextAt: number;
};

type Meta = { revision: number; contentHash: string };

export type CloudRevision = {
  revision: number;
  contentHash: string;
  createdAt: string;
};

export type RemoteHead = {
  revision: number;
  schemaVersion: number;
  contentVersion: number;
  document: SaveDocument;
  etag: string;
  contentHash: string;
};

export type SyncPlan =
  | { status: "local_only"; reason: "signed_out" | "offline" | "kept_local" | "server_unavailable" }
  | { status: "need_first_sync" }
  | { status: "need_download"; remote: RemoteHead }
  | { status: "conflict"; localText: string; remote: RemoteHead }
  | { status: "in_sync"; revision: number }
  | { status: "local_changes"; revision: number }
  | { status: "error"; code: string; message: string };

export function memoryStorage(): LocalStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function createCloudSaveController(options: {
  fetch: FetchLike;
  baseUrl?: string;
  storage: LocalStore;
  now?: () => number;
  randomId?: () => string;
}) {
  const storage = options.storage;
  const now = options.now ?? (() => Date.now());
  const randomId =
    options.randomId ??
    (() => `req-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`);
  const base = (options.baseUrl ?? "").replace(/\/$/, "");

  function writeLocal(text: string): void {
    storage.setItem(RPG_LOCAL_SAVE_KEY, text);
  }

  function readLocal(): string | null {
    return storage.getItem(RPG_LOCAL_SAVE_KEY);
  }

  function bindAccount(userId: string): void {
    storage.setItem(CLOUD_ACTIVE_USER_KEY, userId);
    const account = readReceipts(userId);
    const known = new Set(account.map((item) => item.eventId));
    for (const item of readReceipts("local")) {
      if (known.has(item.eventId)) continue;
      account.push(item);
      known.add(item.eventId);
      enqueue({
        id: item.requestId,
        userId,
        kind: "receipt",
        body: { eventId: item.eventId, requestId: item.requestId },
        attempts: 0,
        nextAt: now(),
      });
    }
    writeReceipts(userId, account);
  }

  function logout(): void {
    storage.removeItem(CLOUD_ACTIVE_USER_KEY);
  }

  function activeUser(): string | null {
    return storage.getItem(CLOUD_ACTIVE_USER_KEY);
  }

  function queuedCount(userId = activeUser()): number {
    if (!userId) return 0;
    return readQueue(userId).length;
  }

  async function plan(): Promise<SyncPlan> {
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    const remote = await getRemote();
    if (remote.status === "offline") return { status: "local_only", reason: "offline" };
    if (remote.status === "down") return { status: "local_only", reason: "server_unavailable" };
    if (remote.status === "unauthorized")
      return { status: "error", code: "unauthorized", message: "請先登入。" };
    if (remote.status === "missing") return { status: "need_first_sync" };
    if (remote.status === "error")
      return { status: "error", code: remote.code, message: remote.message };
    const localText = readLocal();
    if (!localText) return { status: "need_download", remote: remote.head };
    let localHash: string;
    try {
      localHash = await sha256Hex(canonicalJson(JSON.parse(localText)));
    } catch {
      return { status: "error", code: "invalid_local", message: "本機存檔不是有效的 JSON。" };
    }
    if (localHash === remote.head.contentHash) {
      writeMeta(userId, { revision: remote.head.revision, contentHash: remote.head.contentHash });
      return { status: "in_sync", revision: remote.head.revision };
    }
    const meta = readMeta(userId);
    if (meta && meta.revision === remote.head.revision) {
      return { status: "local_changes", revision: remote.head.revision };
    }
    return { status: "conflict", localText, remote: remote.head };
  }

  async function keepLocalOnly(): Promise<{ ok: true }> {
    return { ok: true };
  }

  async function uploadFirstSync(): Promise<
    SyncPlan | { status: "uploaded"; revision: number } | { status: "queued" }
  > {
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    const prepared = prepareLocal();
    if (!prepared.ok) return { status: "error", code: prepared.code, message: prepared.message };
    const body = {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      contentVersion: CLOUD_CONTENT_VERSION,
      baseRevision: 0,
      confirmFirstSync: true,
      requestId: randomId(),
      document: prepared.document,
    };
    return sendPut(userId, body);
  }

  async function pushLocal(): Promise<
    SyncPlan | { status: "uploaded"; revision: number } | { status: "queued" }
  > {
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    const meta = readMeta(userId);
    if (!meta) return plan();
    const prepared = prepareLocal();
    if (!prepared.ok) return { status: "error", code: prepared.code, message: prepared.message };
    const body = {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      contentVersion: CLOUD_CONTENT_VERSION,
      baseRevision: meta.revision,
      confirmFirstSync: false,
      requestId: randomId(),
      document: prepared.document,
    };
    return sendPut(userId, body);
  }

  async function uploadLocal(): Promise<
    SyncPlan | { status: "uploaded"; revision: number } | { status: "queued" }
  > {
    const current = await plan();
    if (current.status === "need_first_sync") return uploadFirstSync();
    if (current.status === "local_changes") return pushLocal();
    if (current.status === "local_only" && current.reason === "offline" && activeUser()) {
      return readMeta(activeUser() as string) ? pushLocal() : uploadFirstSync();
    }
    return current;
  }

  async function downloadCloud(): Promise<SyncPlan | { status: "downloaded"; revision: number }> {
    const remote = await getRemote();
    if (remote.status === "offline") return { status: "local_only", reason: "offline" };
    if (remote.status === "down") return { status: "local_only", reason: "server_unavailable" };
    if (remote.status === "missing") {
      return { status: "error", code: "empty_cloud", message: "雲端沒有存檔，不會清掉本機進度。" };
    }
    if (remote.status !== "ready") {
      return remote.status === "unauthorized"
        ? { status: "error", code: "unauthorized", message: "請先登入。" }
        : { status: "error", code: remote.code, message: remote.message };
    }
    if (!remote.head.document || typeof remote.head.document !== "object") {
      return {
        status: "error",
        code: "empty_cloud",
        message: "雲端存檔是空的，不會覆蓋本機進度。",
      };
    }
    writeLocal(JSON.stringify(remote.head.document));
    const userId = activeUser();
    if (userId) {
      writeMeta(userId, { revision: remote.head.revision, contentHash: remote.head.contentHash });
    }
    return { status: "downloaded", revision: remote.head.revision };
  }

  async function keepRemoteVersion(): Promise<
    SyncPlan | { status: "downloaded"; revision: number }
  > {
    return downloadCloud();
  }

  function headRevisionOf(current: SyncPlan): number | null {
    if (current.status === "in_sync" || current.status === "local_changes") return current.revision;
    if (current.status === "conflict" || current.status === "need_download")
      return current.remote.revision;
    return null;
  }

  async function listRevisions(): Promise<
    | { status: "ready"; headRevision: number | null; revisions: CloudRevision[] }
    | Extract<SyncPlan, { status: "local_only" | "error" }>
  > {
    if (!activeUser()) return { status: "local_only", reason: "signed_out" };
    try {
      const response = await cloudFetch("/api/cloud/saves/rpg/revisions", { method: "GET" });
      if (response.status === 401)
        return { status: "error", code: "unauthorized", message: "請先登入。" };
      if (response.status >= 500) return { status: "local_only", reason: "server_unavailable" };
      const payload = await response.json();
      if (!response.ok) {
        return {
          status: "error",
          code: String(payload?.error?.code ?? response.status),
          message: String(payload?.error?.message ?? "無法讀取雲端版本。"),
        };
      }
      const revisions = Array.isArray(payload.revisions)
        ? payload.revisions.flatMap((item: unknown) => {
            if (!item || typeof item !== "object") return [];
            const row = item as Record<string, unknown>;
            if (typeof row.revision !== "number" || typeof row.contentHash !== "string") return [];
            return [
              {
                revision: row.revision,
                contentHash: row.contentHash,
                createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
              },
            ];
          })
        : [];
      return {
        status: "ready",
        headRevision: typeof payload.headRevision === "number" ? payload.headRevision : null,
        revisions,
      };
    } catch {
      return { status: "local_only", reason: "offline" };
    }
  }

  async function restoreRevision(
    revision: number,
  ): Promise<SyncPlan | { status: "restored"; revision: number }> {
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    if (!Number.isInteger(revision) || revision < 1) {
      return { status: "error", code: "invalid_document", message: "要恢復的版本不正確。" };
    }
    const current = await plan();
    const base = headRevisionOf(current);
    if (base == null) return current;
    if (revision === base) {
      return {
        status: "error",
        code: "revision_not_found",
        message: "這就是目前的雲端版本。",
      };
    }
    return postRestore(userId, base, revision);
  }

  async function restorePrevious(): Promise<SyncPlan | { status: "restored"; revision: number }> {
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    const current = await plan();
    const base = headRevisionOf(current);
    if (base == null) return current;
    if (base <= 1) {
      return {
        status: "error",
        code: "revision_not_found",
        message: "沒有更早的雲端版本。",
      };
    }
    return postRestore(userId, base, base - 1);
  }

  async function postRestore(
    userId: string,
    base: number,
    revision: number,
  ): Promise<SyncPlan | { status: "restored"; revision: number }> {
    try {
      const response = await cloudFetch("/api/cloud/saves/rpg/restore", {
        method: "POST",
        body: JSON.stringify({
          baseRevision: base,
          revision,
          requestId: randomId(),
        }),
      });
      const payload = await response.json();
      if (
        response.status === 409 &&
        payload?.error?.code === "revision_conflict" &&
        payload.server
      ) {
        return {
          status: "conflict",
          localText: readLocal() ?? "",
          remote: payload.server as RemoteHead,
        };
      }
      if (!response.ok) {
        return {
          status: "error",
          code: String(payload?.error?.code ?? response.status),
          message: String(payload?.error?.message ?? "無法恢復指定的雲端版本。"),
        };
      }
      if (payload.document) writeLocal(JSON.stringify(payload.document));
      if (typeof payload.revision === "number" && typeof payload.contentHash === "string") {
        writeMeta(userId, { revision: payload.revision, contentHash: payload.contentHash });
      }
      return { status: "restored", revision: payload.revision };
    } catch {
      return { status: "local_only", reason: "offline" };
    }
  }

  async function keepLocalVersion(): Promise<
    SyncPlan | { status: "uploaded"; revision: number } | { status: "queued" }
  > {
    const current = await plan();
    if (current.status !== "conflict" && current.status !== "local_changes") return current;
    const userId = activeUser();
    if (!userId) return { status: "local_only", reason: "signed_out" };
    const prepared = prepareLocal();
    if (!prepared.ok) return { status: "error", code: prepared.code, message: prepared.message };
    const revision = current.status === "conflict" ? current.remote.revision : current.revision;
    return sendPut(userId, {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      contentVersion: CLOUD_CONTENT_VERSION,
      baseRevision: revision,
      confirmFirstSync: false,
      requestId: randomId(),
      document: prepared.document,
    });
  }

  function rewardRequestId(eventId: string): string {
    return `reward-${eventId}`
      .replace(/:/g, "_")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 80)
      .padEnd(8, "0");
  }

  async function noteReward(eventId: string, grant: () => void): Promise<{ granted: boolean }> {
    const userId = activeUser();
    const device = readReceipts("local");
    const account = userId ? readReceipts(userId) : [];
    if (
      device.some((item) => item.eventId === eventId) ||
      account.some((item) => item.eventId === eventId)
    ) {
      return { granted: false };
    }
    const requestId = rewardRequestId(eventId);
    const record = { eventId, requestId };
    device.push(record);
    writeReceipts("local", device);
    if (userId) {
      account.push(record);
      writeReceipts(userId, account);
      enqueue({
        id: requestId,
        userId,
        kind: "receipt",
        body: { eventId, requestId },
        attempts: 0,
        nextAt: now(),
      });
    }
    grant();
    if (userId) await flush();
    return { granted: true };
  }

  async function flush(): Promise<{ sent: number; paused: boolean }> {
    const userId = activeUser();
    if (!userId) return { sent: 0, paused: false };
    const items = readQueue(userId).sort((a, b) => a.nextAt - b.nextAt);
    let sent = 0;
    const kept: QueueItem[] = [];
    for (const item of items) {
      if (item.userId !== userId) {
        kept.push(item);
        continue;
      }
      if (item.nextAt > now()) {
        kept.push(item);
        continue;
      }
      let response: Response;
      try {
        response = await cloudFetch(
          item.kind === "put" ? "/api/cloud/saves/rpg" : "/api/cloud/saves/rpg/receipts",
          {
            method: item.kind === "put" ? "PUT" : "POST",
            body: JSON.stringify(item.body),
            ifMatch: item.kind === "put" ? Number(item.body.baseRevision) : undefined,
          },
        );
      } catch {
        const attempts = item.attempts + 1;
        kept.push({
          ...item,
          attempts,
          nextAt: now() + Math.min(30_000, 1_000 * 2 ** (attempts - 1)),
        });
        continue;
      }
      if (response.status === 401) {
        kept.push(item, ...items.slice(items.indexOf(item) + 1));
        writeQueue(userId, kept);
        return { sent, paused: true };
      }
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        if (
          item.kind === "put" &&
          payload &&
          typeof payload.revision === "number" &&
          typeof payload.contentHash === "string"
        ) {
          writeMeta(userId, { revision: payload.revision, contentHash: payload.contentHash });
        }
        sent += 1;
        continue;
      }
      if (response.status === 409 || response.status === 422) continue;
      const attempts = item.attempts + 1;
      kept.push({
        ...item,
        attempts,
        nextAt: now() + Math.min(30_000, 1_000 * 2 ** (attempts - 1)),
      });
    }
    writeQueue(userId, kept);
    return { sent, paused: false };
  }

  async function loadContent(input?: { activeEvent?: boolean }): Promise<{
    manifest: ContentManifest;
    decision: ReturnType<typeof decideContentUpdate>;
  }> {
    let manifest: ContentManifest = {
      ...BUNDLED_CONTENT_MANIFEST,
      effects: [...BUNDLED_CONTENT_MANIFEST.effects],
    };
    try {
      const response = await options.fetch(`${base}/api/cloud/content/manifest`);
      if (response.ok) {
        const payload = (await response.json()) as ContentManifest;
        manifest = { ...payload, source: "server" };
      }
    } catch {
      manifest = { ...BUNDLED_CONTENT_MANIFEST, effects: [...BUNDLED_CONTENT_MANIFEST.effects] };
    }
    return {
      manifest,
      decision: decideContentUpdate({
        activeEvent: input?.activeEvent === true,
        saveContentVersion: CLOUD_CONTENT_VERSION,
        manifest,
      }),
    };
  }

  async function sendPut(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<SyncPlan | { status: "uploaded"; revision: number } | { status: "queued" }> {
    try {
      const response = await cloudFetch("/api/cloud/saves/rpg", {
        method: "PUT",
        body: JSON.stringify(body),
        ifMatch: Number(body.baseRevision),
      });
      const payload = await response.json();
      if (
        response.status === 409 &&
        payload?.error?.code === "revision_conflict" &&
        payload.server
      ) {
        return {
          status: "conflict",
          localText: readLocal() ?? "",
          remote: payload.server as RemoteHead,
        };
      }
      if (!response.ok) {
        return {
          status: "error",
          code: String(payload?.error?.code ?? response.status),
          message: String(payload?.error?.message ?? "上傳失敗。"),
        };
      }
      writeMeta(userId, { revision: payload.revision, contentHash: payload.contentHash });
      return { status: "uploaded", revision: payload.revision };
    } catch {
      enqueue({
        id: String(body.requestId),
        userId,
        kind: "put",
        body,
        attempts: 0,
        nextAt: now(),
      });
      return { status: "queued" };
    }
  }

  async function getRemote(): Promise<
    | { status: "ready"; head: RemoteHead }
    | { status: "missing" }
    | { status: "offline" }
    | { status: "down" }
    | { status: "unauthorized" }
    | { status: "error"; code: string; message: string }
  > {
    try {
      const response = await cloudFetch("/api/cloud/saves/rpg", { method: "GET" });
      if (response.status === 404) return { status: "missing" };
      if (response.status === 401) return { status: "unauthorized" };
      if (response.status >= 500) return { status: "down" };
      const payload = await response.json();
      if (!response.ok) {
        return {
          status: "error",
          code: String(payload?.error?.code ?? response.status),
          message: String(payload?.error?.message ?? "讀取失敗。"),
        };
      }
      if (!payload.document) return { status: "missing" };
      return { status: "ready", head: payload as RemoteHead };
    } catch {
      return { status: "offline" };
    }
  }

  function prepareLocal():
    { ok: true; document: SaveDocument } | { ok: false; code: string; message: string } {
    const text = readLocal();
    if (!text) return { ok: false, code: "empty_local", message: "本機還沒有可上傳的進度。" };
    try {
      const validated = validateRpgDocument(JSON.parse(text));
      if (!validated.ok) return validated;
      return { ok: true, document: validated.document };
    } catch {
      return { ok: false, code: "invalid_local", message: "本機存檔不是有效的 JSON。" };
    }
  }

  function cloudFetch(
    path: string,
    init: { method: string; body?: string; ifMatch?: number },
  ): Promise<Response> {
    const headers = new Headers({ "x-cloud-save": "1" });
    if (init.body) headers.set("content-type", "application/json");
    if (typeof init.ifMatch === "number" && init.method === "PUT") {
      headers.set("if-match", `"${init.ifMatch}"`);
    }
    return options.fetch(`${base}${path}`, { method: init.method, headers, body: init.body });
  }

  function enqueue(item: QueueItem): void {
    const items = readQueue(item.userId).filter((current) => current.id !== item.id);
    items.push(item);
    writeQueue(item.userId, items);
  }

  function readQueue(userId: string): QueueItem[] {
    const raw = storage.getItem(CLOUD_QUEUE_PREFIX + userId);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
    } catch {
      return [];
    }
  }

  function writeQueue(userId: string, items: QueueItem[]): void {
    storage.setItem(CLOUD_QUEUE_PREFIX + userId, JSON.stringify(items));
  }

  function readMeta(userId: string): Meta | null {
    const raw = storage.getItem(CLOUD_META_PREFIX + userId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Meta;
      if (typeof parsed.revision !== "number" || typeof parsed.contentHash !== "string")
        return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeMeta(userId: string, meta: Meta): void {
    storage.setItem(CLOUD_META_PREFIX + userId, JSON.stringify(meta));
  }

  function readReceipts(userId: string): Array<{ eventId: string; requestId: string }> {
    const raw = storage.getItem(CLOUD_RECEIPT_PREFIX + userId);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeReceipts(
    userId: string,
    records: Array<{ eventId: string; requestId: string }>,
  ): void {
    storage.setItem(CLOUD_RECEIPT_PREFIX + userId, JSON.stringify(records));
  }

  return {
    writeLocal,
    readLocal,
    bindAccount,
    logout,
    activeUser,
    queuedCount,
    plan,
    keepLocalOnly,
    uploadFirstSync,
    pushLocal,
    uploadLocal,
    downloadCloud,
    keepRemoteVersion,
    keepLocalVersion,
    listRevisions,
    restoreRevision,
    restorePrevious,
    noteReward,
    flush,
    loadContent,
  };
}
