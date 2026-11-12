import type { Sql } from "../../lib/db.ts";
import {
  CLOUD_CONTENT_VERSION,
  CLOUD_SCHEMA_VERSION,
  SAVE_HISTORY_LIMIT,
  canonicalJson,
  requestIdOk,
  sha256Hex,
  validateRpgDocument,
  type SaveDocument,
} from "../../features/cloud-save/contract.ts";

export type ServiceResult = {
  status: number;
  body: Record<string, unknown>;
  etag?: string;
  replay?: boolean;
};

type SaveRow = {
  schema_version: number;
  content_version: number;
  revision: number | string;
  document: unknown;
  content_hash: string;
};

export type PutSaveInput = {
  schemaVersion: number;
  contentVersion: number;
  baseRevision: number;
  confirmFirstSync: boolean;
  requestId: string;
  document: SaveDocument;
};

const REQUEST_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function etagFor(revision: number): string {
  return `"${revision}"`;
}

export async function listRpgRevisions(sql: Sql, userId: string): Promise<ServiceResult> {
  const head = await readHead(sql, userId);
  const rows = await sql.query<{
    revision: number | string;
    content_hash: string;
    created_at: Date | string;
  }>(
    `select revision, content_hash, created_at
     from rpg_save_revisions
     where user_id = $1
     order by revision desc
     limit $2`,
    [userId, SAVE_HISTORY_LIMIT],
  );
  return {
    status: 200,
    body: {
      headRevision: head ? asRevision(head.revision) : null,
      revisions: rows.map((row) => ({
        revision: asRevision(row.revision),
        contentHash: row.content_hash,
        createdAt: asTimestamp(row.created_at),
      })),
    },
  };
}

export async function getRpgSave(sql: Sql, userId: string): Promise<ServiceResult> {
  const row = await readHead(sql, userId);
  if (!row) {
    return {
      status: 404,
      body: { error: { code: "not_found", message: "尚未有雲端存檔。" } },
    };
  }
  return headResult(row);
}

export async function putRpgSave(
  sql: Sql,
  userId: string,
  input: PutSaveInput,
): Promise<ServiceResult> {
  const hash = await payloadHash({
    schemaVersion: input.schemaVersion,
    contentVersion: input.contentVersion,
    baseRevision: input.baseRevision,
    confirmFirstSync: input.confirmFirstSync,
    document: input.document,
  });
  return withIdempotency(sql, userId, input.requestId, hash, async (tx) => {
    const row = await readHead(tx, userId, true);
    if (!row) {
      if (!input.confirmFirstSync || input.baseRevision !== 0) {
        return {
          status: 409,
          body: {
            error: {
              code: "first_sync_required",
              message: "請先明確選擇是否上傳本機進度。空白雲端不會覆蓋本機存檔。",
            },
            server: null,
          },
        };
      }
      const created = await createHead(tx, userId, input.document);
      if (!created) {
        const current = await readHead(tx, userId, true);
        if (!current) throw new Error("save insert lost the row");
        return conflictResult(current, input.baseRevision);
      }
      return headResult(await mustHead(tx, userId));
    }
    const revision = asRevision(row.revision);
    if (revision !== input.baseRevision) {
      return conflictResult(row, input.baseRevision);
    }
    const updated = await updateHead(tx, userId, input.document, revision);
    if (!updated) {
      const current = await readHead(tx, userId, true);
      if (!current) throw new Error("save update lost the row");
      return conflictResult(current, input.baseRevision);
    }
    return headResult(await mustHead(tx, userId));
  });
}

export async function restoreRpgSave(
  sql: Sql,
  userId: string,
  input: { baseRevision: number; revision: number; requestId: string },
): Promise<ServiceResult> {
  const hash = await payloadHash(input);
  return withIdempotency(sql, userId, input.requestId, hash, async (tx) => {
    const head = await readHead(tx, userId, true);
    if (!head) {
      return {
        status: 404,
        body: { error: { code: "not_found", message: "尚未有雲端存檔。" } },
      };
    }
    const current = asRevision(head.revision);
    if (current !== input.baseRevision) return conflictResult(head, input.baseRevision);
    if (input.revision === current) return headResult(head);
    const history = await tx.query<SaveRow>(
      `select schema_version, content_version, revision, document, content_hash
       from rpg_save_revisions where user_id = $1 and revision = $2`,
      [userId, input.revision],
    );
    const prior = history[0];
    if (!prior) {
      return {
        status: 404,
        body: { error: { code: "revision_not_found", message: "找不到要恢復的版本。" } },
      };
    }
    const document = asDocument(prior.document);
    const validated = validateRpgDocument(document);
    if (!validated.ok) {
      return {
        status: 422,
        body: { error: { code: validated.code, message: validated.message } },
      };
    }
    const updated = await updateHead(tx, userId, validated.document, current);
    if (!updated) {
      const latest = await readHead(tx, userId, true);
      if (!latest) throw new Error("save update lost the row");
      return conflictResult(latest, input.baseRevision);
    }
    return headResult(await mustHead(tx, userId));
  });
}

export async function recordRewardReceipt(
  sql: Sql,
  userId: string,
  input: { eventId: string; requestId: string },
): Promise<ServiceResult> {
  if (!/^[a-z0-9:_-]{1,80}$/.test(input.eventId)) {
    return {
      status: 422,
      body: { error: { code: "invalid_document", message: "獎勵事件 id 不正確。" } },
    };
  }
  const hash = await payloadHash(input);
  return withIdempotency(sql, userId, input.requestId, hash, async (tx) => {
    const inserted = await tx.query<{ event_id: string }>(
      `insert into reward_receipts (user_id, event_id)
       values ($1, $2)
       on conflict (user_id, event_id) do nothing
       returning event_id`,
      [userId, input.eventId],
    );
    return {
      status: 200,
      body: {
        applied: inserted.length > 0,
        eventId: input.eventId,
      },
    };
  });
}

async function withIdempotency(
  sql: Sql,
  userId: string,
  requestId: string,
  hash: string,
  run: (tx: Sql) => Promise<ServiceResult>,
): Promise<ServiceResult> {
  if (!requestIdOk(requestId) || !REQUEST_ID.test(requestId)) {
    return {
      status: 422,
      body: { error: { code: "invalid_request_id", message: "requestId 格式不正確。" } },
    };
  }
  try {
    return await sql.transaction(async (tx) => {
      await tx.query(
        `delete from rpg_save_requests
         where user_id = $1 and created_at < now() - interval '7 days'`,
        [userId],
      );
      const existing = await tx.query<{
        payload_hash: string;
        status_code: number;
        response: unknown;
      }>(
        `select payload_hash, status_code, response
         from rpg_save_requests
         where user_id = $1 and request_id = $2
         for update`,
        [userId, requestId],
      );
      const prior = existing[0];
      if (prior) {
        if (prior.payload_hash !== hash) {
          return {
            status: 409,
            body: {
              error: {
                code: "idempotency_mismatch",
                message: "相同 requestId 不能改用不同內容重送。",
              },
            },
          };
        }
        return {
          status: prior.status_code,
          body: asObject(prior.response),
          etag: etagFromBody(asObject(prior.response)),
          replay: true,
        };
      }
      const result = await run(tx);
      await tx.query(
        `insert into rpg_save_requests (user_id, request_id, payload_hash, status_code, response)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [userId, requestId, hash, result.status, JSON.stringify(result.body)],
      );
      return result;
    });
  } catch (err) {
    if (uniqueKind(err) === "request") {
      const again = await sql.query<{
        status_code: number;
        response: unknown;
        payload_hash: string;
      }>(
        `select status_code, response, payload_hash from rpg_save_requests
         where user_id = $1 and request_id = $2`,
        [userId, requestId],
      );
      const prior = again[0];
      if (!prior) throw err;
      if (prior.payload_hash !== hash) {
        return {
          status: 409,
          body: {
            error: {
              code: "idempotency_mismatch",
              message: "相同 requestId 不能改用不同內容重送。",
            },
          },
        };
      }
      const body = asObject(prior.response);
      return { status: prior.status_code, body, etag: etagFromBody(body), replay: true };
    }
    if (uniqueKind(err) === "save") {
      const row = await readHead(sql, userId);
      if (!row) throw err;
      return conflictResult(row, 0);
    }
    throw err;
  }
}

async function createHead(tx: Sql, userId: string, document: SaveDocument): Promise<boolean> {
  const stored = await storedDocument(document);
  const inserted = await tx.query<{ revision: number | string }>(
    `insert into rpg_saves (
       user_id, schema_version, content_version, revision, document, document_bytes, content_hash, updated_at
     ) values ($1, $2, $3, 1, $4::jsonb, $5, $6, now())
     on conflict (user_id) do nothing
     returning revision`,
    [
      userId,
      CLOUD_SCHEMA_VERSION,
      CLOUD_CONTENT_VERSION,
      stored.payload,
      stored.bytes,
      stored.contentHash,
    ],
  );
  if (!inserted[0]) return false;
  await rememberRevision(tx, userId, 1, stored);
  return true;
}

async function updateHead(
  tx: Sql,
  userId: string,
  document: SaveDocument,
  baseRevision: number,
): Promise<boolean> {
  const stored = await storedDocument(document);
  const next = baseRevision + 1;
  const updated = await tx.query<{ revision: number | string }>(
    `update rpg_saves set
       schema_version = $2,
       content_version = $3,
       revision = $4,
       document = $5::jsonb,
       document_bytes = $6,
       content_hash = $7,
       updated_at = now()
     where user_id = $1 and revision = $8
     returning revision`,
    [
      userId,
      CLOUD_SCHEMA_VERSION,
      CLOUD_CONTENT_VERSION,
      next,
      stored.payload,
      stored.bytes,
      stored.contentHash,
      baseRevision,
    ],
  );
  if (!updated[0]) return false;
  await rememberRevision(tx, userId, next, stored);
  return true;
}

async function storedDocument(document: SaveDocument): Promise<{
  payload: string;
  bytes: number;
  contentHash: string;
}> {
  const payload = JSON.stringify(document);
  return {
    payload,
    bytes: new TextEncoder().encode(payload).byteLength,
    contentHash: await sha256Hex(canonicalJson(document)),
  };
}

async function rememberRevision(
  tx: Sql,
  userId: string,
  revision: number,
  stored: { payload: string; contentHash: string },
): Promise<void> {
  await tx.query(
    `insert into rpg_save_revisions (
       user_id, revision, schema_version, content_version, document, content_hash
     ) values ($1, $2, $3, $4, $5::jsonb, $6)
     on conflict (user_id, revision) do nothing`,
    [
      userId,
      revision,
      CLOUD_SCHEMA_VERSION,
      CLOUD_CONTENT_VERSION,
      stored.payload,
      stored.contentHash,
    ],
  );
  await tx.query(
    `delete from rpg_save_revisions
     where user_id = $1
       and revision not in (
         select revision from rpg_save_revisions
         where user_id = $1
         order by revision desc
         limit $2
       )`,
    [userId, SAVE_HISTORY_LIMIT],
  );
}

async function readHead(sql: Sql, userId: string, lock = false): Promise<SaveRow | null> {
  const rows = await sql.query<SaveRow>(
    `select schema_version, content_version, revision, document, content_hash
     from rpg_saves where user_id = $1${lock ? " for update" : ""}`,
    [userId],
  );
  return rows[0] ?? null;
}

async function mustHead(sql: Sql, userId: string): Promise<SaveRow> {
  const row = await readHead(sql, userId);
  if (!row) throw new Error("save head missing after write");
  return row;
}

function headResult(row: SaveRow): ServiceResult {
  const revision = asRevision(row.revision);
  const document = asDocument(row.document);
  return {
    status: 200,
    etag: etagFor(revision),
    body: {
      revision,
      schemaVersion: row.schema_version,
      contentVersion: row.content_version,
      document,
      etag: etagFor(revision),
      contentHash: row.content_hash,
    },
  };
}

function conflictResult(row: SaveRow, clientRevision: number): ServiceResult {
  const revision = asRevision(row.revision);
  const document = asDocument(row.document);
  return {
    status: 409,
    etag: etagFor(revision),
    body: {
      error: {
        code: "revision_conflict",
        message: "雲端存檔已更新。請選擇要保留的版本。",
      },
      clientRevision,
      server: {
        revision,
        schemaVersion: row.schema_version,
        contentVersion: row.content_version,
        document,
        etag: etagFor(revision),
        contentHash: row.content_hash,
      },
    },
  };
}

async function payloadHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

function asTimestamp(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function asRevision(value: number | string): number {
  const revision = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(revision)) throw new Error("invalid revision");
  return revision;
}

function asDocument(value: unknown): SaveDocument {
  if (typeof value === "string") return JSON.parse(value) as SaveDocument;
  if (value && typeof value === "object" && !Array.isArray(value)) return value as SaveDocument;
  throw new Error("stored document is not an object");
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, unknown>;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function etagFromBody(body: Record<string, unknown>): string | undefined {
  if (typeof body.etag === "string") return body.etag;
  const server = body.server;
  if (server && typeof server === "object" && "etag" in server) {
    const etag = (server as { etag?: unknown }).etag;
    if (typeof etag === "string") return etag;
  }
  return undefined;
}

function uniqueKind(err: unknown): "request" | "save" | "other" {
  if (!err || typeof err !== "object") return "other";
  const record = err as { code?: string; message?: string; constraint?: string; detail?: string };
  if (
    record.code !== "23505" &&
    !String(record.message ?? "")
      .toLowerCase()
      .includes("unique")
  ) {
    return "other";
  }
  const text = `${record.constraint ?? ""} ${record.detail ?? ""} ${record.message ?? ""}`;
  if (text.includes("rpg_save_requests")) return "request";
  if (text.includes("rpg_saves")) return "save";
  return "other";
}
