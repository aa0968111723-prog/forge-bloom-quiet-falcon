/** Which database backend is active. */
export type DbSource = "neon" | "pglite";

// An empty/whitespace DATABASE_URL (an easy misconfig in deploy UIs) must mean
// "unset" — otherwise production would silently run on the PGLite fallback.
const rawDatabaseUrl = typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl = rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/**
 * Active backend: real **Neon** when `DATABASE_URL` is set (deployed / configured
 * sandbox), otherwise a local embedded **PGLite** (Postgres compiled to WASM) so
 * the app has a working database even with nothing configured — the live preview
 * included. Swap in Neon later by just setting `DATABASE_URL`; no code changes.
 */
export const dbSource: DbSource = databaseUrl ? "neon" : "pglite";

/**
 * Minimal shared SQL surface, satisfied by both Neon and PGLite. Both the
 * tagged-template and `.query()` forms resolve to an array of row objects:
 *
 *   const sql = await getSql();
 *   const rows = await sql`select * from todos where id = ${id}`; // parameterized
 *   const rows2 = await sql.query("select * from todos where id = $1", [id]);
 */
export interface Sql {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Run `fn` on one connection. The callback sees only its own statements. */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

/**
 * Init state lives on globalThis as promises: dev HMR creates new instances of
 * this module, and two instances racing module-level state would open a second
 * pool or run two concurrent PGLite migration passes (whose duplicate
 * `_migrations` insert rejects — and would get memoized, poisoning every later
 * `getSql()`). A failed init clears its slot so the next call retries.
 */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgPool__?: import("pg").Pool;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

/**
 * Result-type parity: Postgres sends every value as text plus a type OID — the
 * JS value is the DRIVER's parsing choice, and pg and PGLite disagree (pg:
 * int8 -> string, date -> local-midnight Date; PGLite: int8 -> BigInt, which
 * JSON.stringify rejects, date -> UTC Date). Normalize both so preview and
 * production return identical, JSON-safe shapes:
 *   int8/bigint (incl. count(*)) -> number (past 2^53 loses precision — cast
 *                                   `::text` if you ever need huge integers)
 *   date                         -> 'YYYY-MM-DD' string
 *   interval                     -> Postgres interval text
 * numeric already comes back as a string on both (arbitrary precision).
 */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

/** Wrap a query runner in the tagged-template + `.query()` `Sql` surface. */
function toSql(run: Run, transaction?: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    // Rebuild with $1, $2, … placeholders so values stay parameterized.
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  sql.transaction =
    transaction ??
    (<T>(fn: (tx: Sql) => Promise<T>) => {
      return fn(sql);
    });
  return sql;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    // Regular Postgres driver: node-postgres (`pg`) — works directly with Neon's
    // pooled endpoint. One pool per process; warm serverless instances reuse it.
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3_000,
    });
    globalRef.__pgPool__ = pool;
    const run = async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    };
    return toSql(run, async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const tx = toSql(async <T>(text: string, params: unknown[]) => {
          const res = await client.query(text, params);
          return res.rows as T[];
        });
        const result = await fn(tx);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The connection may already be dead. Keep the original error.
        }
        throw err;
      } finally {
        client.release();
      }
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    globalRef.__pgPool__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  // Embedded Postgres, imported on demand so it never loads on the Neon path.
  // One in-memory instance per process, shared across HMR module instances, so
  // data survives source edits (it resets on dev-server restart).
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const parsers = {
      [OID_INT8]: Number,
      [OID_DATE]: identity,
      [OID_INTERVAL]: identity,
    };
    // PGLITE_DATA_DIR persists across process restarts. Unset stays in memory,
    // which is the live-preview default and resets when the dev server exits.
    const dataDir = process.env.PGLITE_DATA_DIR?.trim();
    const pg = dataDir ? new PGlite(dataDir, { parsers }) : new PGlite({ parsers });
    await pg.waitReady;
    await pg.exec(
      "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  // Apply migrations/ (the single schema source) so preview matches production.
  // SQL is inlined by the bundler via import.meta.glob (no runtime fs); applied
  // files are tracked in _migrations. Runs once per module instance — so an HMR
  // reload after adding a migration file applies it live — with passes
  // serialized on a global chain so concurrent callers never double-apply.
  const migrate = async (): Promise<void> => {
    const migrations = await loadMigrationFiles();
    const doneRows = await pg.query<{ name: string }>("select name from _migrations");
    const done = new Set(doneRows.rows.map((r) => r.name));
    for (const { name, text } of migrations) {
      if (done.has(name)) continue;
      // Apply + record atomically (parity with scripts/migrate.mjs) so a failed
      // statement can't leave a file half-applied but untracked.
      await pg.transaction(async (tx) => {
        await tx.exec(text);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined) // an earlier failed pass must not wedge the chain
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  return toSql(
    async <T>(text: string, params: unknown[]) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
    async (fn) =>
      pg.transaction(async (tx) => {
        const txSql = toSql(async <T>(text: string, params: unknown[]) => {
          const result = await tx.query<T>(text, params);
          return result.rows;
        });
        return fn(txSql);
      }),
  );
}

/**
 * Vite inlines `import.meta.glob` so the deployed bundle does not need the
 * migrations directory. Plain Node (tests, the game-services process) reads
 * the same files from disk. The call must stay a literal `import.meta.glob`.
 */
async function loadMigrationFiles(): Promise<Array<{ name: string; text: string }>> {
  let bundled: Record<string, string> | null = null;
  try {
    bundled = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
  } catch {
    bundled = null;
  }
  if (bundled && typeof bundled === "object" && Object.keys(bundled).length > 0) {
    return Object.entries(bundled)
      .map(([path, text]) => ({ name: path.split("/").pop() as string, text }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  const { readdir, readFile } = await import("node:fs/promises");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readFile(join(dir, name), "utf8") })),
  );
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}

/**
 * Get the shared, **server-only** SQL client. Neon when `DATABASE_URL` is set,
 * otherwise the local PGLite fallback. Memoized — safe to call per request.
 *
 * Schema comes from `migrations/*.sql`, auto-applied before the first query on
 * both backends — define tables there, never inline in server functions.
 */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // don't memoize failures — let the next call retry
    throw err;
  });
  return sqlPromise;
}

/**
 * The shared PGLite instance (preview only), with `migrations/*.sql` applied.
 * Lets Better Auth persist to the SAME embedded DB as app data in preview (via a
 * Kysely dialect). Throws when `DATABASE_URL` is set (that path uses Neon).
 */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/**
 * Finish DB bootstrap before the server handles traffic.
 *
 * - **PGLite** (preview / no `DATABASE_URL`): open the in-memory DB and apply
 *   `migrations/*.sql`. Idempotent — concurrent callers share one promise.
 * - **Neon**: no-op (pool is created lazily on first query).
 *
 * Vite `configureServer` awaits this at dev startup; production imports of this
 * module kick it off immediately (see bottom of file).
 */
export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}

/** Close the shared pool or PGLite instance. Used by graceful shutdown. */
export async function closeDb(): Promise<void> {
  const pool = globalRef.__pgPool__;
  const pglite = globalRef.__pgliteInstance__;
  globalRef.__pgPool__ = undefined;
  globalRef.__pgSqlPromise__ = undefined;
  globalRef.__pgliteInstance__ = undefined;
  globalRef.__pgliteMigrateChain__ = undefined;
  sqlPromise = null;
  if (pool) {
    await pool.end().catch(() => undefined);
  }
  if (!pglite) return;
  const pg = await pglite.catch(() => null);
  if (!pg) return;
  try {
    await pg.exec("CHECKPOINT");
  } catch {
    // A failed checkpoint still needs the instance closed.
  }
  await pg.close();
}

// Server-only eager start: kick PGLite bootstrap as soon as this module loads in
// Node. Client bundles never hit this path (`getSql` throws in the browser).
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && dbSource === "pglite") {
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
