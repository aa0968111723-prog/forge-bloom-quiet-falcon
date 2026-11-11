import { getSql } from "../../lib/db.ts";
import {
  BUNDLED_CONTENT_MANIFEST,
  CLOUD_CONTENT_VERSION,
  CLOUD_SCHEMA_VERSION,
  MAX_SAVE_BYTES,
  validateRpgDocument,
} from "../../features/cloud-save/contract.ts";
import {
  getRpgSave,
  putRpgSave,
  recordRewardReceipt,
  restoreRpgSave,
  type ServiceResult,
} from "./service.ts";

const buckets = new Map<string, { start: number; count: number }>();

export function resetRateLimits(): void {
  buckets.clear();
}

export async function handleCloudRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return withCors(request, new Response(null, { status: 204 }));

  const originError = rejectOrigin(request);
  if (originError) return originError;

  try {
    if (method === "GET" && (path === "/api/health" || path === "/api/cloud/health")) {
      return withCors(request, json(200, { ok: true, service: "cloud-save" }));
    }
    if (method === "GET" && (path === "/api/ready" || path === "/api/cloud/ready")) {
      return withCors(request, await readyResponse());
    }
    if (method === "GET" && path === "/api/cloud/content/manifest") {
      return withCors(
        request,
        json(
          200,
          { ...BUNDLED_CONTENT_MANIFEST, source: "server" },
          { "cache-control": "public, max-age=60" },
        ),
      );
    }
    if (path === "/api/cloud/saves/rpg" && method === "GET") {
      return withCors(request, await readSave(request, url));
    }
    if (path === "/api/cloud/saves/rpg" && method === "PUT") {
      return withCors(request, await writeSave(request));
    }
    if (path === "/api/cloud/saves/rpg/restore" && method === "POST") {
      return withCors(request, await restoreSave(request));
    }
    if (path === "/api/cloud/saves/rpg/receipts" && method === "POST") {
      return withCors(request, await writeReceipt(request));
    }
    return withCors(
      request,
      json(404, { error: { code: "not_found", message: "沒有這個端點。" } }),
    );
  } catch (err) {
    console.error("[cloud-save] request failed", err instanceof Error ? err.name : "error");
    return withCors(
      request,
      json(500, { error: { code: "internal", message: "伺服器暫時無法處理這個請求。" } }),
    );
  }
}

async function readyResponse(): Promise<Response> {
  try {
    const sql = await getSql();
    await sql.query("select 1 as ok");
    return json(200, { ok: true });
  } catch {
    return json(503, {
      ok: false,
      error: { code: "database_unavailable", message: "資料庫無法使用。" },
    });
  }
}

async function readSave(request: Request, url: URL): Promise<Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (url.searchParams.has("userId")) return forgedUser();
  try {
    const result = await getRpgSave(await getSql(), user.id);
    return serviceResponse(result);
  } catch {
    return databaseDown();
  }
}

async function writeSave(request: Request): Promise<Response> {
  const gate = await mutationGate(request);
  if (gate instanceof Response) return gate;
  const parsed = await readJson(request);
  if (parsed instanceof Response) return parsed;
  if (hasUserId(parsed)) return forgedUser();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { error: { code: "invalid_json", message: "JSON 必須是物件。" } });
  }
  const body = parsed as Record<string, unknown>;
  if (
    body.schemaVersion !== CLOUD_SCHEMA_VERSION ||
    body.contentVersion !== CLOUD_CONTENT_VERSION
  ) {
    return json(422, {
      error: { code: "incompatible_content", message: "客戶端的存檔版本與此伺服器不相容。" },
    });
  }
  if (
    typeof body.baseRevision !== "number" ||
    !Number.isInteger(body.baseRevision) ||
    body.baseRevision < 0
  ) {
    return json(422, { error: { code: "invalid_document", message: "baseRevision 不正確。" } });
  }
  if (typeof body.requestId !== "string") {
    return json(422, { error: { code: "invalid_request_id", message: "缺少 requestId。" } });
  }
  const match = ifMatchRevision(request);
  if (match === "invalid") {
    return json(400, { error: { code: "if_match_mismatch", message: "If-Match 格式不正確。" } });
  }
  if (typeof match === "number" && match !== body.baseRevision) {
    return json(400, {
      error: { code: "if_match_mismatch", message: "If-Match 與 baseRevision 不一致。" },
    });
  }
  const validated = validateRpgDocument(body.document);
  if (!validated.ok) {
    return json(422, { error: { code: validated.code, message: validated.message } });
  }
  const limited = rateLimit(gate.id);
  if (!limited.ok) return rateLimited(limited.retryAfter);
  try {
    const result = await putRpgSave(await getSql(), gate.id, {
      schemaVersion: CLOUD_SCHEMA_VERSION,
      contentVersion: CLOUD_CONTENT_VERSION,
      baseRevision: body.baseRevision,
      confirmFirstSync: body.confirmFirstSync === true,
      requestId: body.requestId,
      document: validated.document,
    });
    return serviceResponse(result);
  } catch {
    return databaseDown();
  }
}

async function restoreSave(request: Request): Promise<Response> {
  const gate = await mutationGate(request);
  if (gate instanceof Response) return gate;
  const parsed = await readJson(request);
  if (parsed instanceof Response) return parsed;
  if (hasUserId(parsed)) return forgedUser();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { error: { code: "invalid_json", message: "JSON 必須是物件。" } });
  }
  const body = parsed as Record<string, unknown>;
  if (typeof body.requestId !== "string") {
    return json(422, { error: { code: "invalid_request_id", message: "缺少 requestId。" } });
  }
  if (
    typeof body.baseRevision !== "number" ||
    !Number.isInteger(body.baseRevision) ||
    typeof body.revision !== "number" ||
    !Number.isInteger(body.revision) ||
    body.revision < 1
  ) {
    return json(422, { error: { code: "invalid_document", message: "恢復版本不正確。" } });
  }
  const limited = rateLimit(gate.id);
  if (!limited.ok) return rateLimited(limited.retryAfter);
  try {
    const result = await restoreRpgSave(await getSql(), gate.id, {
      baseRevision: body.baseRevision,
      revision: body.revision,
      requestId: body.requestId,
    });
    return serviceResponse(result);
  } catch {
    return databaseDown();
  }
}

async function writeReceipt(request: Request): Promise<Response> {
  const gate = await mutationGate(request);
  if (gate instanceof Response) return gate;
  const parsed = await readJson(request);
  if (parsed instanceof Response) return parsed;
  if (hasUserId(parsed)) return forgedUser();
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return json(400, { error: { code: "invalid_json", message: "JSON 必須是物件。" } });
  }
  const body = parsed as Record<string, unknown>;
  if (typeof body.requestId !== "string" || typeof body.eventId !== "string") {
    return json(422, { error: { code: "invalid_document", message: "獎勵回執缺少欄位。" } });
  }
  const limited = rateLimit(gate.id);
  if (!limited.ok) return rateLimited(limited.retryAfter);
  try {
    const result = await recordRewardReceipt(await getSql(), gate.id, {
      eventId: body.eventId,
      requestId: body.requestId,
    });
    return serviceResponse(result);
  } catch {
    return databaseDown();
  }
}

async function mutationGate(request: Request): Promise<{ id: string } | Response> {
  if (request.headers.get("x-cloud-save") !== "1") {
    return json(403, {
      error: { code: "csrf", message: "變更請求必須帶上 x-cloud-save。" },
    });
  }
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return json(403, { error: { code: "cross_site", message: "已拒絕跨站變更。" } });
  }
  return requireUser(request);
}

async function requireUser(request: Request): Promise<{ id: string } | Response> {
  const { auth, authConfigured } = await import("../../lib/auth/server.ts");
  if (!authConfigured) {
    return json(401, { error: { code: "unauthorized", message: "登入未啟用。" } });
  }
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return json(401, { error: { code: "unauthorized", message: "請先登入。" } });
  }
  return { id: session.user.id };
}

function forgedUser(): Response {
  return json(403, {
    error: {
      code: "forged_user",
      message: "不能由客戶端指定 userId。身分只採用伺服器 session。",
    },
  });
}

function hasUserId(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "userId" in value);
}

async function readJson(request: Request): Promise<unknown | Response> {
  const max = maxBytes();
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > max) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > max) return tooLarge();
  if (!text) return json(400, { error: { code: "invalid_json", message: "缺少 JSON。" } });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return json(400, { error: { code: "invalid_json", message: "JSON 無法解析。" } });
  }
}

function serviceResponse(result: ServiceResult): Response {
  const body = { ...result.body, idempotentReplay: result.replay === true };
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (result.etag) headers.etag = result.etag;
  return json(result.status, body, headers);
}

function databaseDown(): Response {
  return json(503, {
    error: { code: "database_unavailable", message: "資料庫無法使用。" },
  });
}

function tooLarge(): Response {
  return json(413, { error: { code: "payload_too_large", message: "請求超過大小上限。" } });
}

function rateLimited(retryAfter: number): Response {
  return json(
    429,
    { error: { code: "rate_limited", message: "請求過於頻繁，請稍後再試。" } },
    { "retry-after": String(retryAfter) },
  );
}

function rateLimit(userId: string): { ok: true } | { ok: false; retryAfter: number } {
  const limit = positiveInt(process.env.CLOUD_SAVE_RATE_LIMIT, 30);
  const windowMs = positiveInt(process.env.CLOUD_SAVE_RATE_WINDOW_MS, 60_000);
  const now = Date.now();
  const bucket = buckets.get(userId);
  if (!bucket || now - bucket.start >= windowMs) {
    buckets.set(userId, { start: now, count: 1 });
    return { ok: true };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((windowMs - (now - bucket.start)) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function maxBytes(): number {
  return positiveInt(process.env.CLOUD_SAVE_MAX_BYTES, MAX_SAVE_BYTES);
}

function ifMatchRevision(request: Request): number | "invalid" | null {
  const header = request.headers.get("if-match");
  if (!header) return null;
  const match = /^W\/"(\d+)"$|^"(\d+)"$/.exec(header.trim());
  if (!match) return "invalid";
  return Number(match[1] ?? match[2]);
}

function json(status: number, body: unknown, extra?: Record<string, string>): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", ...extra });
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export function allowedOrigins(): string[] {
  const extra = (process.env.CLOUD_SAVE_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== "*");
  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  return [
    ...extra,
    ...(authUrl && authUrl !== "*" ? [authUrl] : []),
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://[::1]:8080",
    "http://localhost:8088",
    "http://127.0.0.1:8088",
  ];
}

function rejectOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === "null" || origin === "*" || !allowedOrigins().includes(origin)) {
    return json(403, { error: { code: "origin_rejected", message: "這個來源不被允許。" } });
  }
  return null;
}

function withCors(request: Request, response: Response): Response {
  const origin = request.headers.get("origin");
  const headers = new Headers(response.headers);
  headers.set("vary", "Origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("access-control-allow-headers", "content-type, x-cloud-save, if-match");
    headers.set("access-control-allow-methods", "GET, PUT, POST, OPTIONS");
  }
  return new Response(response.body, { status: response.status, headers });
}
